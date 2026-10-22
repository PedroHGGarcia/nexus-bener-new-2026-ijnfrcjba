import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { getCorsHeaders } from '../_shared/cors.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { requireUser } from '../_shared/auth.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

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
    let cep = ''

    if (req.method === 'POST') {
      const body = await req.json().catch(() => ({}))
      cep = body.cep || ''
    } else {
      const url = new URL(req.url)
      cep = url.searchParams.get('cep') || ''
    }

    const cleanCep = cep.replace(/\D/g, '')
    if (cleanCep.length !== 8) {
      return new Response(JSON.stringify({ error: 'CEP inválido. Deve conter 8 dígitos.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...cors },
      })
    }

    // Helper: verifica se a string contém pelo menos uma letra (a-z, A-Z, acentos Unicode)
    const hasLetters = (val: unknown): boolean => {
      if (!val || typeof val !== 'string') return false
      return /[\p{L}]/u.test(val)
    }

    const isValidBaseRecord = (record: Record<string, any> | null | undefined): boolean => {
      if (!record) return false
      const enderecoValido = hasLetters(record.endereco)
      const cidadeValida = hasLetters(record.cidade)
      return enderecoValido || cidadeValida
    }

    // 1. Consultar base antiga primeiro (tabelas clientes_base_antiga e clientes_antigos)
    let clienteAntigo: Record<string, any> | null = null
    if (SUPABASE_URL && SERVICE_ROLE_KEY) {
      try {
        const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
          auth: { autoRefreshToken: false, persistSession: false },
        })

        // Buscar por CEP formatado ou limpo na clientes_base_antiga
        const { data: cBase, error: dbErrBase } = await supabase
          .from('clientes_base_antiga')
          .select('*')
          .or(`cep.eq.${cleanCep},cep.eq.${cleanCep.slice(0, 5)}-${cleanCep.slice(5)}`)
          .limit(1)
          .maybeSingle()

        if (!dbErrBase && isValidBaseRecord(cBase)) {
          clienteAntigo = cBase
        } else {
          // Fallback para clientes_antigos
          const { data: cAntigo, error: dbErrAntigo } = await supabase
            .from('clientes_antigos')
            .select('*')
            .or(`cep.eq.${cleanCep},cep.eq.${cleanCep.slice(0, 5)}-${cleanCep.slice(5)}`)
            .limit(1)
            .maybeSingle()
          if (!dbErrAntigo && isValidBaseRecord(cAntigo)) {
            clienteAntigo = cAntigo
          }
        }

        if (clienteAntigo && isValidBaseRecord(clienteAntigo)) {
          const validEndereco = hasLetters(clienteAntigo.endereco) ? clienteAntigo.endereco : ''
          const validCidade = hasLetters(clienteAntigo.cidade) ? clienteAntigo.cidade : ''

          const result = {
            cep: cleanCep,
            estado: clienteAntigo.uf ?? '',
            cidade: validCidade,
            bairro: clienteAntigo.bairro ?? '',
            logradouro: validEndereco,
            complemento: clienteAntigo.complemento ?? '',
            origem: 'base_antiga',
          }

          return new Response(JSON.stringify(result), {
            headers: {
              'Content-Type': 'application/json',
              Connection: 'keep-alive',
              ...cors,
            },
          })
        }
      } catch (err) {
        console.warn('Erro ao consultar clientes_base_antiga para CEP:', err)
      }
    }

    // 2. Fallback para ViaCEP
    const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`)
    const data = await response.json()

    if (data.erro) {
      return new Response(JSON.stringify({ error: 'CEP não encontrado.' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...cors },
      })
    }

    const result = {
      cep: data.cep ? data.cep.replace(/\D/g, '') : cleanCep,
      estado: data.uf,
      cidade: data.localidade,
      bairro: data.bairro,
      logradouro: data.logradouro,
      complemento: data.complemento,
      origem: 'viacep',
    }

    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json', Connection: 'keep-alive', ...cors },
    })
  } catch {
    return new Response(JSON.stringify({ error: 'Erro ao buscar CEP.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...cors },
    })
  }
})
