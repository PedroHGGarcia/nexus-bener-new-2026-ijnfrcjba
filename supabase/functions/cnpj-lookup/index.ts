import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { getCorsHeaders } from '../_shared/cors.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { requireUser } from '../_shared/auth.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

function isValidCnpjDigits(cnpj: string): boolean {
  if (cnpj.length !== 14) return false
  if (/^(\d)\1{13}$/.test(cnpj)) return false

  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  let sum = 0
  for (let i = 0; i < 12; i++) {
    sum += parseInt(cnpj[i]) * weights1[i]
  }
  const digit1 = sum % 11 < 2 ? 0 : 11 - (sum % 11)
  if (parseInt(cnpj[12]) !== digit1) return false

  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  sum = 0
  for (let i = 0; i < 13; i++) {
    sum += parseInt(cnpj[i]) * weights2[i]
  }
  const digit2 = sum % 11 < 2 ? 0 : 11 - (sum % 11)
  if (parseInt(cnpj[13]) !== digit2) return false

  return true
}

interface ExternalCnpjData {
  razao_social?: string
  nome_fantasia?: string
  logradouro?: string
  numero?: string
  complemento?: string
  bairro?: string
  municipio?: string
  uf?: string
  cep?: string
  email?: string
  ddd_telefone_1?: string
  telefone?: string
  qsa?: Array<{ nome_socio?: string; qual?: string }>
}

async function fetchBrasilApi(cleanCnpj: string): Promise<ExternalCnpjData | null> {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)
    const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCnpj}`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    })
    clearTimeout(timeoutId)
    if (!response.ok) return null
    const data = await response.json()
    if (data && !data.error) {
      return data as ExternalCnpjData
    }
  } catch (err) {
    console.warn('Erro ao consultar BrasilAPI:', err)
  }
  return null
}

async function fetchReceitaWs(cleanCnpj: string): Promise<ExternalCnpjData | null> {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)
    const response = await fetch(`https://www.receitaws.com.br/v1/cnpj/${cleanCnpj}`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    })
    clearTimeout(timeoutId)
    if (!response.ok) return null
    const data = await response.json()
    if (data && data.status !== 'ERROR') {
      return {
        razao_social: data.nome || '',
        nome_fantasia: data.fantasia || data.nome || '',
        logradouro: data.logradouro || '',
        numero: data.numero || '',
        complemento: data.complemento || '',
        bairro: data.bairro || '',
        municipio: data.municipio || '',
        uf: data.uf || '',
        cep: data.cep ? String(data.cep).replace(/\D/g, '') : '',
        email: data.email || '',
        telefone: data.telefone || '',
        qsa: data.qsa?.map((q: any) => ({ nome_socio: q.nome, qual: q.qual })) || [],
      }
    }
  } catch (err) {
    console.warn('Erro ao consultar ReceitaWS fallback:', err)
  }
  return null
}

async function fetchPublicCnpj(
  cleanCnpj: string,
): Promise<{ data: ExternalCnpjData; provider: string } | null> {
  // Primária: BrasilAPI
  const brasilApi = await fetchBrasilApi(cleanCnpj)
  if (brasilApi && (brasilApi.razao_social || brasilApi.nome_fantasia)) {
    return { data: brasilApi, provider: 'brasilapi' }
  }

  // Fallback: ReceitaWS
  const receitaWs = await fetchReceitaWs(cleanCnpj)
  if (receitaWs && (receitaWs.razao_social || receitaWs.nome_fantasia)) {
    return { data: receitaWs, provider: 'receitaws' }
  }

  return null
}

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
    let cnpjParam = ''

    if (req.method === 'POST') {
      const body = await req.json().catch(() => ({}))
      cnpjParam = body.cnpj || ''
    } else {
      const url = new URL(req.url)
      cnpjParam = url.searchParams.get('cnpj') || ''
    }

    const cleanCnpj = cnpjParam.replace(/\D/g, '')

    if (cleanCnpj.length !== 14) {
      return new Response(JSON.stringify({ error: 'CNPJ inválido. Deve conter 14 dígitos.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...cors },
      })
    }

    if (!isValidCnpjDigits(cleanCnpj)) {
      return new Response(
        JSON.stringify({ error: 'CNPJ inválido. Dígitos verificadores não conferem.' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...cors } },
      )
    }

    // 1. Consultar base antiga primeiro (tabelas: clientes_base_antiga e fallback clientes_antigos)
    let clienteAntigo: Record<string, any> | null = null
    if (SUPABASE_URL && SERVICE_ROLE_KEY) {
      try {
        const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
          auth: { autoRefreshToken: false, persistSession: false },
        })

        // Tentar clientes_base_antiga
        const { data: cBase, error: errBase } = await supabase
          .from('clientes_base_antiga')
          .select('*')
          .eq('cnpj', cleanCnpj)
          .limit(1)
          .maybeSingle()

        if (!errBase && cBase) {
          clienteAntigo = cBase
        } else {
          // Tentar clientes_antigos
          const { data: cAntigo, error: errAntigo } = await supabase
            .from('clientes_antigos')
            .select('*')
            .eq('cnpj', cleanCnpj)
            .limit(1)
            .maybeSingle()
          if (!errAntigo && cAntigo) {
            clienteAntigo = cAntigo
          }
        }
      } catch (err) {
        console.warn('Erro ao consultar clientes_base_antiga:', err)
      }
    }

    // Se encontrou na base antiga:
    if (clienteAntigo) {
      const telefoneRaw = (clienteAntigo.telefone || '').trim()
      let ddd = ''
      let tel = telefoneRaw
      if (telefoneRaw) {
        const parts = telefoneRaw
          .replace(/[^0-9\s]/g, '')
          .trim()
          .split(/\s+/)
        if (parts.length >= 2 && /^\d{2}$/.test(parts[0])) {
          ddd = parts[0]
          tel = parts.slice(1).join(' ')
        }
      }

      // Rastrear quais campos vieram preenchidos da base antiga
      const baseCampos: Record<string, boolean> = {
        razao_social: Boolean(clienteAntigo.nome),
        nome_fantasia: Boolean(clienteAntigo.nome),
        logradouro: Boolean(clienteAntigo.endereco),
        municipio: Boolean(clienteAntigo.cidade),
        uf: Boolean(clienteAntigo.uf),
        cep: Boolean(clienteAntigo.cep),
        email: Boolean(clienteAntigo.email),
        telefone: Boolean(clienteAntigo.telefone),
        contato: Boolean(clienteAntigo.contato),
      }

      const result = {
        razao_social: clienteAntigo.nome ?? '',
        nome_fantasia: clienteAntigo.nome ?? '',
        logradouro: clienteAntigo.endereco ?? '',
        numero: '',
        complemento: '',
        bairro: '',
        municipio: clienteAntigo.cidade ?? '',
        uf: clienteAntigo.uf ?? '',
        cep: clienteAntigo.cep ? clienteAntigo.cep.replace(/\D/g, '') : '',
        email: clienteAntigo.email ?? '',
        ddd,
        telefone: tel,
        contato: clienteAntigo.contato ?? '',
        origem: 'base_antiga',
        campos_base_antiga: baseCampos,
      }

      // Complementar com BrasilAPI para campos vazios (ex: numero, bairro, complemento, ou se faltar email/tel/cep/etc)
      const needComplement =
        !result.logradouro ||
        !result.numero ||
        !result.bairro ||
        !result.cep ||
        !result.email ||
        !result.telefone

      if (needComplement) {
        const publicLookup = await fetchPublicCnpj(cleanCnpj)
        if (publicLookup) {
          const apiData = publicLookup.data
          if (!result.razao_social && apiData.razao_social)
            result.razao_social = apiData.razao_social
          if (!result.nome_fantasia && apiData.nome_fantasia)
            result.nome_fantasia = apiData.nome_fantasia
          if (!result.logradouro && apiData.logradouro) result.logradouro = apiData.logradouro
          if (!result.numero && apiData.numero) result.numero = apiData.numero
          if (!result.complemento && apiData.complemento) result.complemento = apiData.complemento
          if (!result.bairro && apiData.bairro) result.bairro = apiData.bairro
          if (!result.municipio && apiData.municipio) result.municipio = apiData.municipio
          if (!result.uf && apiData.uf) result.uf = apiData.uf
          if (!result.cep && apiData.cep) result.cep = apiData.cep.replace(/\D/g, '')
          if (!result.email && apiData.email) result.email = apiData.email

          if (!result.telefone) {
            const apiTelStr = apiData.ddd_telefone_1 || apiData.telefone || ''
            if (apiTelStr) {
              const parts = apiTelStr.trim().split(/\s+/)
              if (parts.length >= 2 && /^\d{2}$/.test(parts[0])) {
                result.ddd = parts[0]
                result.telefone = parts.slice(1).join(' ')
              } else {
                result.telefone = apiTelStr
              }
            }
          }
        }
      }
      return new Response(JSON.stringify(result), {
        headers: {
          'Content-Type': 'application/json',
          Connection: 'keep-alive',
          ...cors,
        },
      })
    }

    // 2. Não encontrado na base antiga → buscar via BrasilAPI com fallback ReceitaWS
    const publicLookup = await fetchPublicCnpj(cleanCnpj)
    if (!publicLookup) {
      return new Response(
        JSON.stringify({ error: 'CNPJ não encontrado nas bases públicas de consulta.' }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json', ...cors },
        },
      )
    }

    const apiData = publicLookup.data
    const telefoneStr: string = apiData.ddd_telefone_1 || apiData.telefone || ''
    let ddd = ''
    let telefone = ''
    if (telefoneStr) {
      const parts = telefoneStr.trim().split(/\s+/)
      if (parts.length >= 2 && /^\d{2}$/.test(parts[0])) {
        ddd = parts[0]
        telefone = parts.slice(1).join(' ')
      } else {
        telefone = telefoneStr
      }
    }

    const result = {
      razao_social: apiData.razao_social ?? '',
      nome_fantasia: apiData.nome_fantasia ?? '',
      logradouro: apiData.logradouro ?? '',
      numero: apiData.numero ?? '',
      complemento: apiData.complemento ?? '',
      bairro: apiData.bairro ?? '',
      municipio: apiData.municipio ?? '',
      uf: apiData.uf ?? '',
      cep: apiData.cep ? apiData.cep.replace(/\D/g, '') : '',
      email: apiData.email ?? '',
      ddd,
      telefone,
      contato: '',
      origem: publicLookup.provider,
      campos_base_antiga: {},
    }

    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json', Connection: 'keep-alive', ...cors },
    })
  } catch (err) {
    console.error('cnpj-lookup error:', err)
    return new Response(
      JSON.stringify({
        error:
          'Não foi possível processar a consulta de CNPJ. Tente novamente ou contate o suporte.',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...cors },
      },
    )
  }
})
