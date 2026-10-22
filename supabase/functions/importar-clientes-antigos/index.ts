import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { getCorsHeaders } from '../_shared/cors.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || ''
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

interface ClienteInput {
  nome?: string
  cnpj?: string
  email?: string
  telefone?: string
  contato?: string
  endereco?: string
  cidade?: string
  uf?: string
  cep?: string
}

async function verifyAdmin(authHeader: string) {
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  })
  const {
    data: { user },
    error,
  } = await userClient.auth.getUser()
  if (error || !user) return null

  const { data: profile } = await userClient
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const role = (profile?.role || '').toLowerCase()
  if (role !== 'admin completo' && role !== 'admin') {
    return null
  }
  return user
}

function cleanCnpjStr(cnpj?: string): string {
  if (!cnpj) return ''
  return cnpj.replace(/\D/g, '')
}

function cleanCepStr(cep?: string): string {
  if (!cep) return ''
  return cep.replace(/\D/g, '')
}

Deno.serve(async (req: Request) => {
  const cors = getCorsHeaders(req)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado. Token de autenticação ausente.' }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json', ...cors },
        },
      )
    }

    const adminUser = await verifyAdmin(authHeader)
    if (!adminUser) {
      return new Response(JSON.stringify({ error: 'Acesso negado. Apenas administradores.' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json', ...cors },
      })
    }

    const body = await req.json().catch(() => ({}))
    // Aceita tanto { clientes: [...] } quanto array direto [...]
    const rawList = Array.isArray(body)
      ? body
      : Array.isArray(body.clientes)
        ? body.clientes
        : Array.isArray(body.registros)
          ? body.registros
          : []
    const clientes: ClienteInput[] = rawList

    if (clientes.length === 0) {
      return new Response(JSON.stringify({ error: 'Nenhum registro de cliente enviado.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...cors },
      })
    }

    if (clientes.length > 500) {
      return new Response(
        JSON.stringify({ error: 'Limite máximo de 500 registros por chamada excedido.' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...cors },
        },
      )
    }

    const adminClient = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // Preparar registros válidos
    const validRows: Array<{
      nome: string
      cnpj: string
      email: string
      telefone: string
      contato: string
      endereco: string
      cidade: string
      uf: string
      cep: string
      updated_at: string
    }> = []

    for (const c of clientes) {
      const cnpj = cleanCnpjStr(c.cnpj)
      if (!cnpj) continue // pular linhas sem CNPJ

      const uf = (c.uf || '').trim().toUpperCase().slice(0, 2)
      validRows.push({
        nome: (c.nome || '').trim(),
        cnpj,
        email: (c.email || '').trim(),
        telefone: (c.telefone || '').trim(),
        contato: (c.contato || '').trim(),
        endereco: (c.endereco || '').trim(),
        cidade: (c.cidade || '').trim(),
        uf,
        cep: cleanCepStr(c.cep),
        updated_at: new Date().toISOString(),
      })
    }

    if (validRows.length === 0) {
      return new Response(
        JSON.stringify({
          error: 'Nenhum registro continha CNPJ válido.',
          inseridos: 0,
          atualizados: 0,
          total: 0,
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...cors },
        },
      )
    }

    // Verificar quais CNPJs já existem para contar inseridos vs atualizados
    const cnpjs = validRows.map((r) => r.cnpj)
    const { data: existingRows } = await adminClient
      .from('clientes_base_antiga')
      .select('cnpj')
      .in('cnpj', cnpjs)

    const existingSet = new Set((existingRows || []).map((r: { cnpj: string }) => r.cnpj))
    let inseridos = 0
    let atualizados = 0

    // Deduplicar dentro do mesmo lote mantendo o último registro
    const deduplicatedMap = new Map<string, (typeof validRows)[0]>()
    for (const row of validRows) {
      deduplicatedMap.set(row.cnpj, row)
    }
    const finalRows = Array.from(deduplicatedMap.values())

    for (const row of finalRows) {
      if (existingSet.has(row.cnpj)) {
        atualizados++
      } else {
        inseridos++
      }
    }

    // Realizar upsert em clientes_base_antiga com ON CONFLICT (cnpj)
    const { error: upsertError1 } = await adminClient
      .from('clientes_base_antiga')
      .upsert(finalRows, {
        onConflict: 'cnpj',
        ignoreDuplicates: false,
      })

    if (upsertError1) {
      return new Response(
        JSON.stringify({
          error: `Erro ao salvar registros em clientes_base_antiga: ${upsertError1.message}`,
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...cors },
        },
      )
    }

    // Manter sincronizado com clientes_antigos também
    await adminClient.from('clientes_antigos').upsert(finalRows, {
      onConflict: 'cnpj',
      ignoreDuplicates: false,
    })

    return new Response(
      JSON.stringify({
        inseridos,
        atualizados,
        total: finalRows.length,
        ignorados: clientes.length - validRows.length,
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
