import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { getCorsHeaders } from '../_shared/cors.ts'
import { requireUser } from '../_shared/auth.ts'

const BACKOFF_DELAYS = [2000, 4000, 8000]
const OPENAI_MODEL = 'gpt-4o-mini'
const OPENAI_URL = 'https://api.openai.com/v1/chat/completions'

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
    const body = await req.json()
    const { nome, tipo, valor, moeda, contexto } = body ?? {}

    if (!nome) {
      return new Response(JSON.stringify({ error: 'Nome é obrigatório.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...cors },
      })
    }

    const apiKey = Deno.env.get('OPENAI_API_KEY')
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'OPENAI_API_KEY não configurada no servidor.' }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...cors } },
      )
    }

    const systemPrompt =
      'Você é um assistente técnico especializado em máquinas e equipamentos industriais da Bener Máquinas. Forneça respostas técnicas, precisas e objetivas em português, sem formatação markdown (sem asteriscos, cerquilhas ou marcadores especiais de markdown).'

    let userPrompt = ''
    if (tipo === 'email') {
      userPrompt = `Gere uma sugestão de e-mail profissional em português sobre o assunto "${nome}".${contexto ? ` Contexto adicional: ${contexto}` : ''} Responda apenas com o texto do e-mail, sem formatação markdown.`
    } else if (tipo === 'notificacao') {
      userPrompt = `Gere o texto de uma notificação clara e direta em português com o título "${nome}".${contexto ? ` Contexto: ${contexto}` : ''} Responda apenas com o texto da mensagem, sem formatação markdown.`
    } else if (tipo === 'descricao_proposta') {
      userPrompt = `Gere uma descrição comercial e técnica resumida em português para uma proposta com o equipamento "${nome}". Responda apenas com o texto, sem formatação markdown.`
    } else {
      const valorStr =
        valor !== undefined && valor !== null
          ? ` com valor de referência ${valor} ${moeda || 'BRL'}`
          : ''
      const tipoStr = tipo ? ` do tipo "${tipo}"` : ''
      const contextoStr = contexto ? ` Contexto adicional: ${contexto}` : ''
      userPrompt = `Gere especificações técnicas detalhadas em português para o acessório industrial "${nome}"${tipoStr}${valorStr}.${contextoStr} Inclua: características construtivas, materiais utilizados, normas aplicáveis, capacidade técnica e observações de segurança. Responda apenas com o texto das especificações, sem formatação markdown.`
    }

    const text = await callOpenAI(apiKey, systemPrompt, userPrompt)

    const especificacoes = text || 'Não foi possível gerar especificações.'

    return new Response(JSON.stringify({ especificacoes }), {
      headers: { 'Content-Type': 'application/json', Connection: 'keep-alive', ...cors },
    })
  } catch (err) {
    console.error('ai-suggestions error:', err)
    return new Response(JSON.stringify({ error: 'Erro ao processar sugestões de IA.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...cors },
    })
  }
})
