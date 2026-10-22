import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { getCorsHeaders } from '../_shared/cors.ts'
import { requireUser } from '../_shared/auth.ts'

const BACKOFF_DELAYS = [2000, 4000, 8000]
const OPENAI_MODEL = 'gpt-4o-mini'
const OPENAI_URL = 'https://api.openai.com/v1/chat/completions'

function buildPrompt(type: string, nome: string, versoes: unknown[]): string {
  const versoesStr =
    versoes.length > 0
      ? versoes
          .map((v: any) => (typeof v === 'string' ? v : v?.nome || ''))
          .filter(Boolean)
          .join(', ')
      : ''
  const entidade = type === 'versao' ? 'a versão de máquina' : 'o acessório industrial'
  const contexto = versoesStr ? `\nVersões relacionadas: ${versoesStr}` : ''
  return `Gere especificações técnicas detalhadas em português para ${entidade} "${nome}".${contexto}\nInclua: características construtivas, materiais utilizados, normas aplicáveis, capacidade técnica e observações de segurança. Responda apenas com o texto das especificações, sem formatação markdown.`
}

async function callOpenAI(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
): Promise<string> {
  for (let attempt = 0; attempt <= BACKOFF_DELAYS.length; attempt++) {
    const resp = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 1024,
      }),
    })

    if ((resp.status === 503 || resp.status === 429) && attempt < BACKOFF_DELAYS.length) {
      await new Promise((r) => setTimeout(r, BACKOFF_DELAYS[attempt]))
      continue
    }

    if (!resp.ok) {
      const errData = await resp.json().catch(() => ({}))
      if (resp.status === 401 || resp.status === 403) {
        throw new Error(
          'O serviço de IA não pôde ser autenticado. Verifique se a chave OPENAI_API_KEY está configurada corretamente.',
        )
      }
      throw new Error(errData?.error?.message || `Erro ${resp.status} na API da OpenAI`)
    }

    const data = await resp.json()
    return data?.choices?.[0]?.message?.content?.trim() ?? ''
  }

  throw new Error('Serviço de IA indisponível após múltiplas tentativas.')
}

Deno.serve(async (req: Request) => {
  const cors = getCorsHeaders(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

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
    const { type, nome, versoes } = await req.json()
    if (!type || !nome) {
      return new Response(JSON.stringify({ error: 'Tipo e nome são obrigatórios.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...cors },
      })
    }

    const apiKey = Deno.env.get('OPENAI_API_KEY')
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'OPENAI_API_KEY não configurada.' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...cors },
      })
    }

    const systemPrompt =
      'Você é um assistente técnico especializado em máquinas e equipamentos industriais da Bener Máquinas. Forneça respostas técnicas detalhadas, precisas e objetivas em português, sem formatação markdown.'
    const prompt = buildPrompt(type, nome, versoes || [])
    const text = await callOpenAI(apiKey, systemPrompt, prompt)

    if (!text) {
      return new Response(JSON.stringify({ error: 'Não foi possível gerar especificações.' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...cors },
      })
    }

    return new Response(JSON.stringify({ data: { especificacoes: text } }), {
      headers: { 'Content-Type': 'application/json', Connection: 'keep-alive', ...cors },
    })
  } catch (err) {
    console.error('suggest-specs error:', err)
    return new Response(JSON.stringify({ error: 'Erro ao gerar sugestões de IA.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...cors },
    })
  }
})
