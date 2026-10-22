import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { getCorsHeaders } from '../_shared/cors.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { requireRole } from '../_shared/auth.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

interface ReceitaData {
  razao_social?: string
  nome_fantasia?: string
  situacao_cadastral?: string
  data_abertura?: string
  cnae_principal?: string
  cnae_descricao?: string
  logradouro?: string
  numero?: string
  complemento?: string
  bairro?: string
  municipio?: string
  uf?: string
  cep?: string
  telefone?: string
  email?: string
  natureza_juridica?: string
  porte?: string
  qsa?: unknown
  cnaes_secundarios?: unknown
  provedor: 'brasilapi' | 'minhareceita'
}

function cleanDigits(str?: string | null): string {
  if (!str) return ''
  return String(str).replace(/\D/g, '')
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// 1. Consulta BrasilAPI
async function fetchBrasilApi(cnpj: string): Promise<ReceitaData | null> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 7000)
    const resp = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    })
    clearTimeout(timer)

    if (resp.status === 404) {
      return null
    }

    if (!resp.ok) {
      return null
    }

    const data = await resp.json()
    if (!data || data.error) return null

    const dddTel = data.ddd_telefone_1 || data.ddd_telefone_2 || data.telefone || ''
    const cnaeCode = data.cnae_fiscal ? String(data.cnae_fiscal) : ''

    return {
      razao_social: data.razao_social || data.nome_empresarial || '',
      nome_fantasia: data.nome_fantasia || '',
      situacao_cadastral: data.descricao_situacao_cadastral || data.situacao_cadastral || '',
      data_abertura: data.data_inicio_atividade || data.data_abertura || '',
      cnae_principal: cnaeCode,
      cnae_descricao: data.cnae_fiscal_descricao || '',
      logradouro:
        [data.descricao_tipo_de_logradouro, data.logradouro].filter(Boolean).join(' ').trim() ||
        data.logradouro ||
        '',
      numero: data.numero || '',
      complemento: data.complemento || '',
      bairro: data.bairro || '',
      municipio: data.municipio || '',
      uf: data.uf || '',
      cep: cleanDigits(data.cep),
      telefone: dddTel,
      email: data.email || '',
      natureza_juridica: data.natureza_juridica || '',
      porte: data.porte || data.descricao_porte || '',
      qsa: data.qsa || null,
      cnaes_secundarios: data.cnaes_secundarios || null,
      provedor: 'brasilapi',
    }
  } catch (_e) {
    return null
  }
}

// 2. Fallback MinhaReceita
async function fetchMinhaReceita(cnpj: string): Promise<ReceitaData | null> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 7000)
    const resp = await fetch(`https://minhareceita.org/${cnpj}`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    })
    clearTimeout(timer)

    if (resp.status === 404) {
      return null
    }

    if (!resp.ok) {
      return null
    }

    const data = await resp.json()
    if (!data || data.message || data.error) return null

    const dddTel = [data.ddd_telefone_1, data.ddd_telefone_2].filter(Boolean).join(' / ')
    const cnaeCode = data.cnae_fiscal ? String(data.cnae_fiscal) : ''

    return {
      razao_social: data.razao_social || '',
      nome_fantasia: data.nome_fantasia || '',
      situacao_cadastral: data.descricao_situacao_cadastral || '',
      data_abertura: data.data_inicio_atividade || '',
      cnae_principal: cnaeCode,
      cnae_descricao: data.cnae_fiscal_descricao || '',
      logradouro:
        [data.descricao_tipo_de_logradouro, data.logradouro].filter(Boolean).join(' ').trim() ||
        data.logradouro ||
        '',
      numero: data.numero || '',
      complemento: data.complemento || '',
      bairro: data.bairro || '',
      municipio: data.municipio || '',
      uf: data.uf || '',
      cep: cleanDigits(data.cep),
      telefone: dddTel,
      email: data.email || '',
      natureza_juridica: data.natureza_juridica || '',
      porte: data.porte || '',
      qsa: data.qsa || null,
      cnaes_secundarios: data.cnaes_secundarios || null,
      provedor: 'minhareceita',
    }
  } catch (_e) {
    return null
  }
}

async function consultReceita(cnpj: string): Promise<ReceitaData | 'nao_encontrado' | 'erro'> {
  // 1ª tentativa: BrasilAPI
  const bApi = await fetchBrasilApi(cnpj)
  if (bApi && (bApi.razao_social || bApi.nome_fantasia)) {
    return bApi
  }

  // 2ª tentativa: MinhaReceita fallback
  const mRec = await fetchMinhaReceita(cnpj)
  if (mRec && (mRec.razao_social || mRec.nome_fantasia)) {
    return mRec
  }

  // Se ambas responderam 404 ou vazio
  return 'nao_encontrado'
}

Deno.serve(async (req: Request) => {
  const cors = getCorsHeaders(req)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors })
  }

  // Apenas admins podem rodar enriquecimento
  try {
    await requireRole(req, ['admin', 'admin completo'])
  } catch (errResp) {
    if (errResp instanceof Response) return errResp
    return new Response(JSON.stringify({ error: 'Acesso negado. Apenas administradores.' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json', ...cors },
    })
  }

  try {
    const adminClient = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const body = await req.json().catch(() => ({}))
    const limit = Math.min(Math.max(Number(body.limit) || 10, 1), 30) // padrão 10 clientes por lote
    const delayMs = Math.max(Number(body.delayMs) || 1200, 500) // throttle padrão 1.2s entre requisições

    // 1. Obter total geral de clientes com status pendente (para barra de progresso)
    const { count: pendentesCount, error: countErr } = await adminClient
      .from('clientes_base_antiga')
      .select('id', { count: 'exact', head: true })
      .not('cnpj', 'is', null)
      .eq('receita_status', 'pendente')

    if (countErr) {
      return new Response(
        JSON.stringify({ error: `Erro ao contar pendentes: ${countErr.message}` }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...cors } },
      )
    }

    // 2. Buscar próximo lote de clientes pendentes
    const { data: batch, error: batchErr } = await adminClient
      .from('clientes_base_antiga')
      .select('id, cnpj, nome, endereco, cidade, uf, cep, telefone, email, receita_status')
      .not('cnpj', 'is', null)
      .eq('receita_status', 'pendente')
      .limit(limit)

    if (batchErr) {
      return new Response(
        JSON.stringify({ error: `Erro ao buscar lote pendente: ${batchErr.message}` }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...cors } },
      )
    }

    if (!batch || batch.length === 0) {
      return new Response(
        JSON.stringify({
          processados: 0,
          ok: 0,
          nao_encontrados: 0,
          erros: 0,
          restantes: 0,
          concluido: true,
          mensagem: 'Nenhum cliente com CNPJ pendente de enriquecimento.',
        }),
        { headers: { 'Content-Type': 'application/json', ...cors } },
      )
    }

    let okCount = 0
    let naoEncontradosCount = 0
    let errosCount = 0

    // Processar sequencialmente com throttle para não tomar 429 da BrasilAPI/MinhaReceita
    for (let i = 0; i < batch.length; i++) {
      const client = batch[i]
      const cnpj = cleanDigits(client.cnpj)

      if (cnpj.length !== 14) {
        // Marca como erro/inválido
        await adminClient
          .from('clientes_base_antiga')
          .update({
            receita_status: 'erro',
            receita_consultado_em: new Date().toISOString(),
          })
          .eq('id', client.id)
        errosCount++
        continue
      }

      // Aplica throttle antes de consultar (exceto no primeiríssimo se quiser, mas mantemos o delay)
      if (i > 0) {
        await delay(delayMs)
      }

      const lookupRes = await consultReceita(cnpj)
      const nowIso = new Date().toISOString()

      if (lookupRes === 'nao_encontrado') {
        naoEncontradosCount++
        await adminClient
          .from('clientes_base_antiga')
          .update({
            receita_status: 'nao_encontrado',
            receita_consultado_em: nowIso,
          })
          .eq('id', client.id)
      } else if (lookupRes === 'erro') {
        errosCount++
        await adminClient
          .from('clientes_base_antiga')
          .update({
            receita_status: 'erro',
            receita_consultado_em: nowIso,
          })
          .eq('id', client.id)
      } else {
        // Sucesso! Dados oficiais obtidos
        okCount++

        // Preenche campos cadastrais gerais SOMENTE se estavam vazios (não sobrescreve razão social importada se houver)
        const updateData: Record<string, unknown> = {
          rece_status: undefined, // limpador
          receita_status: 'ok',
          receita_consultado_em: nowIso,
          receita_provedor: lookupRes.provedor,
          razao_social_receita: lookupRes.razao_social || null,
          nome_fantasia_receita: lookupRes.nome_fantasia || null,
          situacao_cadastral: lookupRes.situacao_cadastral || null,
          data_abertura: lookupRes.data_abertura || null,
          cnae_principal: lookupRes.cnae_principal || null,
          cnae_descricao: lookupRes.cnae_descricao || null,
          logradouro: lookupRes.logradouro || null,
          numero: lookupRes.numero || null,
          complemento: lookupRes.complemento || null,
          bairro: lookupRes.bairro || null,
          municipio: lookupRes.municipio || null,
          uf_receita: lookupRes.uf || null,
          cep_receita: lookupRes.cep || null,
          telefone_receita: lookupRes.telefone || null,
          email_receita: lookupRes.email || null,
          natureza_juridica: lookupRes.natureza_juridica || null,
          porte: lookupRes.porte || null,
          qsa: lookupRes.qsa,
          cnaes_secundarios: lookupRes.cnaes_secundarios,
        }

        // Se campos locais estavam vazios, preencher com os dados da Receita
        if (!client.nome && (lookupRes.razao_social || lookupRes.nome_fantasia)) {
          updateData.nome = lookupRes.razao_social || lookupRes.nome_fantasia
        }
        if (!client.endereco && lookupRes.logradouro) {
          const endParts = [lookupRes.logradouro, lookupRes.numero, lookupRes.bairro]
            .filter(Boolean)
            .join(', ')
          updateData.endereco = endParts
        }
        if (!client.cidade && lookupRes.municipio) {
          updateData.cidade = lookupRes.municipio
        }
        if (!client.uf && lookupRes.uf) {
          updateData.uf = lookupRes.uf
        }
        if (!client.cep && lookupRes.cep) {
          updateData.cep = lookupRes.cep
        }
        if (!client.telefone && lookupRes.telefone) {
          updateData.telefone = lookupRes.telefone
        }
        if (!client.email && lookupRes.email) {
          updateData.email = lookupRes.email
        }

        delete updateData.rece_status

        await adminClient.from('clientes_base_antiga').update(updateData).eq('id', client.id)

        // Se clientes_antigos tem esse CNPJ, sincroniza também
        const antigoPatch: Record<string, unknown> = {}
        if (!client.cidade && lookupRes.municipio) antigoPatch.cidade = lookupRes.municipio
        if (!client.uf && lookupRes.uf) antigoPatch.uf = lookupRes.uf
        if (!client.cep && lookupRes.cep) antigoPatch.cep = lookupRes.cep
        if (Object.keys(antigoPatch).length > 0) {
          await adminClient.from('clientes_antigos').update(antigoPatch).eq('cnpj', cnpj)
        }
      }
    }

    // Calcula quantos ainda restam
    const restantesApos = Math.max(0, (pendentesCount ?? 0) - batch.length)

    return new Response(
      JSON.stringify({
        processados: batch.length,
        ok: okCount,
        nao_encontrados: naoEncontradosCount,
        erros: errosCount,
        restantes: restantesApos,
        concluido: restantesApos === 0,
      }),
      {
        headers: { 'Content-Type': 'application/json', Connection: 'keep-alive', ...cors },
      },
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro interno'
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...cors },
    })
  }
})
