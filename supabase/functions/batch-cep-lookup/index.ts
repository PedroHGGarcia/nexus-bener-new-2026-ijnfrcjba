import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { getCorsHeaders } from '../_shared/cors.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { requireUser } from '../_shared/auth.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

Deno.serve(async (req: Request) => {
  const cors = getCorsHeaders(req)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors })
  }

  try {
    await requireUser(req)
  } catch (authResp) {
    if (authResp instanceof Response) return authResp
    return new Response(JSON.stringify({ error: 'Autenticação necessária.' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', ...cors },
    })
  }

  try {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      return new Response(
        JSON.stringify({ error: 'Variáveis de ambiente do Supabase não configuradas.' }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...cors },
        },
      )
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    let limit = 50

    if (req.method === 'POST') {
      const body = await req.json().catch(() => ({}))
      if (typeof body.limit === 'number' && body.limit > 0) {
        limit = Math.min(body.limit, 100) // max 100 por lote para segurança de timeout
      }
    } else {
      const url = new URL(req.url)
      const l = parseInt(url.searchParams.get('limit') || '', 10)
      if (!isNaN(l) && l > 0) limit = Math.min(l, 100)
    }

    // Buscar clientes que precisam de atualização de endereço:
    // - cep não nulo e não vazio
    // - logradouro é nulo, vazio ou não tem letras
    // Nota: Sempre buscamos os primeiros pendentes (offset 0). À medida que são atualizados,
    // saem do filtro automaticamente e os próximos avançam para o início.
    // Regex no PostgREST: not.logradouro.match.[A-Za-zÀ-ÿ] ou or com null/empty
    // Usando .or() com filtros do PostgREST:
    const pendingFilter = 'logradouro.is.null,logradouro.eq.,logradouro.not.match.[A-Za-zÀ-ÿ]'

    // 1. Obter registros do lote (sempre offset 0)
    const { data: clientes, error: selectErr } = await supabase
      .from('clientes')
      .select('id, cep, logradouro, bairro, cidade, estado, complementos')
      .not('cep', 'is', null)
      .neq('cep', '')
      .or(pendingFilter)
      .order('id', { ascending: true })
      .range(0, limit - 1)

    if (selectErr) {
      console.error('Erro ao buscar clientes pendentes:', selectErr)
      return new Response(JSON.stringify({ error: selectErr.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...cors },
      })
    }

    let updatedCount = 0
    let skippedCount = 0
    let processedCount = 0

    if (clientes && clientes.length > 0) {
      for (const cliente of clientes) {
        processedCount++
        const rawCep = cliente.cep || ''
        const cleanCep = rawCep.replace(/\D/g, '')

        if (cleanCep.length !== 8) {
          // CEP inválido (tamanho diferente de 8). Marca logradouro como 'Não localizado' para que saia do filtro de pendentes
          await supabase
            .from('clientes')
            .update({
              logradouro: 'Não localizado',
              updated_at: new Date().toISOString(),
            })
            .eq('id', cliente.id)
          skippedCount++
          continue
        }

        try {
          // Chamada à API ViaCEP
          const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`)
          if (!response.ok) {
            await supabase
              .from('clientes')
              .update({
                logradouro: 'Não localizado',
                updated_at: new Date().toISOString(),
              })
              .eq('id', cliente.id)
            skippedCount++
            await delay(150)
            continue
          }

          const data = await response.json().catch(() => null)
          if (!data || data.erro) {
            // CEP inexistente no ViaCEP: marca logradouro como 'Não localizado' para sair do filtro
            await supabase
              .from('clientes')
              .update({
                logradouro: 'Não localizado',
                updated_at: new Date().toISOString(),
              })
              .eq('id', cliente.id)
            skippedCount++
            await delay(150)
            continue
          }

          // Se veio com dados válidos, faz o update no banco
          // Se o ViaCEP não retornou nome de rua (ex: cidades com CEP único sem logradouro cadastrado),
          // usamos localidade/UF ou 'Centro/Sede' para garantir que tenha letras e não fique preso no filtro
          const resolvedLogradouro =
            data.logradouro ||
            (data.localidade ? `Área Urbana - ${data.localidade}` : 'Não informado')

          const updatePayload: Record<string, any> = {
            logradouro: resolvedLogradouro,
            bairro: data.bairro || '',
            cidade: data.localidade || '',
            estado: data.uf || '',
            updated_at: new Date().toISOString(),
          }

          if (data.complemento) {
            updatePayload.complementos = data.complemento
          }

          const { error: updateErr } = await supabase
            .from('clientes')
            .update(updatePayload)
            .eq('id', cliente.id)

          if (updateErr) {
            console.error(`Erro ao atualizar cliente ${cliente.id}:`, updateErr)
            skippedCount++
          } else {
            updatedCount++
          }
        } catch (err) {
          console.error(`Erro no lookup do cliente ${cliente.id} (CEP ${cleanCep}):`, err)
          skippedCount++
        }

        // Aguarda 150ms entre cada chamada ViaCEP para respeitar rate limit
        await delay(150)
      }
    }

    // 2. Contagem total restante
    const { count: remainingCount, error: countErr } = await supabase
      .from('clientes')
      .select('id', { count: 'exact', head: true })
      .not('cep', 'is', null)
      .neq('cep', '')
      .or(pendingFilter)

    const remaining = countErr ? 0 : (remainingCount ?? 0)

    const result = {
      processed: processedCount,
      updated: updatedCount,
      skipped: skippedCount,
      remaining,
    }

    return new Response(JSON.stringify(result), {
      headers: {
        'Content-Type': 'application/json',
        Connection: 'keep-alive',
        ...cors,
      },
    })
  } catch (err: any) {
    console.error('Erro geral no batch-cep-lookup:', err)
    return new Response(
      JSON.stringify({ error: 'Erro interno no processamento em lote de CEP.' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...cors },
      },
    )
  }
})
