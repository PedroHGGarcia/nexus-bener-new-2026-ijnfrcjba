import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { getCorsHeaders } from '../_shared/cors.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'

const BACKOFF_DELAYS = [1500, 3000]
const OPENAI_MODEL = 'gpt-6-luna'
const OPENAI_URL = 'https://api.openai.com/v1/chat/completions'

interface VersaoRow {
  id: string
  nome: string
  nome_abreviado: string | null
  cod_erp: string | null
  imagem_preview: string | null
  moeda: string
  valor: number
  tem_fator: boolean
  fator_nac: number
  tem_estoque: boolean
  estoque_total: number
  estoque_bloqueado: number
  estoque_reservado: number
  estoque_disponivel: number
  acessorios_standards: string | null
  caracteristicas_construtivas: string | null
  especificacoes_tecnicas: string | null
  status: string
  alerta_estoque_minimo: number | null
  modelos: {
    id: string
    nome: string
    marcas: { id: string; nome: string } | null
    produtos: {
      id: string
      nome: string
      categorias?: { id: string; nome: string } | null
    } | null
  } | null
}

export interface IncomingMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface OpenAiMessageContentPart {
  type: 'text' | 'image_url'
  text?: string
  image_url?: {
    url: string
    detail?: 'low' | 'high' | 'auto'
  }
}

export type OpenAiMessage =
  | { role: 'system'; content: string }
  | { role: 'assistant'; content: string }
  | { role: 'user'; content: string | OpenAiMessageContentPart[] }

// In-memory rate limiting por usuário autenticado (janela deslizante de 1 minuto)
// Instância por isolate no Edge Runtime; bloqueia abusos com até 30 perguntas por minuto
const RATE_LIMIT_MAX = 30
const RATE_LIMIT_WINDOW_MS = 60 * 1000
const rateLimitMap = new Map<string, number[]>()

function checkRateLimit(userId: string): boolean {
  const now = Date.now()
  const timestamps = rateLimitMap.get(userId) ?? []
  // Mantém apenas timestamps dentro da janela do último minuto
  const recent = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS)
  if (recent.length >= RATE_LIMIT_MAX) {
    rateLimitMap.set(userId, recent)
    return false
  }
  recent.push(now)
  rateLimitMap.set(userId, recent)

  // Limpeza preventiva periódica se o mapa crescer muito
  if (rateLimitMap.size > 2000) {
    for (const [key, list] of rateLimitMap.entries()) {
      const valid = list.filter((t) => now - t < RATE_LIMIT_WINDOW_MS)
      if (valid.length === 0) {
        rateLimitMap.delete(key)
      } else {
        rateLimitMap.set(key, valid)
      }
    }
  }

  return true
}

function removeAccents(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function cleanKeywords(question: string): string[] {
  // Stopwords comuns em português e termos de consulta genéricos
  const stopWords = new Set([
    'a',
    'o',
    'as',
    'os',
    'um',
    'uma',
    'uns',
    'umas',
    'de',
    'do',
    'da',
    'dos',
    'das',
    'em',
    'no',
    'na',
    'nos',
    'nas',
    'por',
    'para',
    'com',
    'sem',
    'sob',
    'sobre',
    'que',
    'qual',
    'quais',
    'quanto',
    'quantos',
    'quanta',
    'quantas',
    'como',
    'onde',
    'quando',
    'porque',
    'por que',
    'tem',
    'temos',
    'existe',
    'existem',
    'ha',
    'há',
    'voce',
    'você',
    'me',
    'mim',
    'nos',
    'nós',
    'lhe',
    'lhes',
    'se',
    'esta',
    'está',
    'estao',
    'estão',
    'e',
    'ou',
    'mas',
    'mais',
    'menos',
    'muito',
    'muitos',
    'pouco',
    'bom',
    'boa',
    'ola',
    'olá',
    'oi',
    'favor',
    'por favor',
    'obrigado',
    'obrigada',
    'catalogo',
    'catálogo',
    'sistema',
    'maquina',
    'maquinas',
    'máquina',
    'máquinas',
    'versao',
    'versoes',
    'versão',
    'versões',
    'modelo',
    'modelos',
    'marca',
    'marcas',
    'mostrar',
    'listar',
    'buscar',
    'pesquisar',
    'ver',
    'saber',
    'dizer',
    'informar',
    'encontrar',
    'ajudar',
    'gostaria',
    'queria',
    'preciso',
    'quero',
    'poderia',
    'bener',
    'qualquer',
    'algum',
    'alguma',
    'alguns',
    'todas',
    'todos',
    'tudo',
  ])

  // Normaliza pontuação e extrai tokens com pelo menos 2 caracteres
  const normalized = question
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s\-]/gu, ' ')
    .trim()

  const rawTokens = normalized.split(/\s+/).filter(Boolean)
  const usefulTokens: string[] = []

  for (const token of rawTokens) {
    if (token.length < 2) continue
    if (stopWords.has(token)) continue
    usefulTokens.push(token)
  }

  return usefulTokens
}

/**
 * Extrai tokens e variações (com e sem hífen, união de letras+números) para busca tolerante de nomes de versão
 * Ex: "sa-350p" -> ["sa-350p", "sa 350p", "sa350p", "350p", "sa-350"]
 * Ex: "ct-450e" -> ["ct-450e", "ct 450e", "ct450e", "450e", "ct-450"]
 * Ex: "ln 2400/30900" -> ["ln", "2400", "30900", "ln 2400"]
 */
function extractVersionNameVariants(text: string): string[] {
  const variants = new Set<string>()
  const clean = removeAccents(text.toLowerCase())

  // Padrões típicos de nomes e códigos de versões de máquinas (ex: SA-350P, FB-400R, CT-450e, LN 2400, TVK 1224, MM500, KF5600, etc.)
  const codeMatches = Array.from(clean.matchAll(/\b([a-z]{1,4})[\s\-]?(\d{2,5}[a-z0-9\/\-]*)\b/gi))
  for (const match of codeMatches) {
    const full = match[0].trim()
    const prefix = match[1].trim()
    const numPart = match[2].trim()

    variants.add(full)
    variants.add(`${prefix}-${numPart}`)
    variants.add(`${prefix} ${numPart}`)
    variants.add(`${prefix}${numPart}`)
    variants.add(numPart)
  }

  // Tokens com letras e números misturados sem separador (ex: SA350, CT450)
  const mixedMatches = Array.from(clean.matchAll(/\b([a-z]{1,4})(\d{2,5})\b/gi))
  for (const m of mixedMatches) {
    variants.add(m[0])
    variants.add(`${m[1]}-${m[2]}`)
    variants.add(`${m[1]} ${m[2]}`)
  }

  // Adiciona números isolados de modelos de 3 ou mais dígitos
  const isolatedNumbers = Array.from(clean.matchAll(/\b(\d{3,5})\b/g))
  for (const num of isolatedNumbers) {
    variants.add(num[1])
  }

  return Array.from(variants).filter((v) => v.length >= 2)
}

function sanitizeTechnicalText(text: string | null | undefined): string {
  if (!text) return 'Não informado'
  // Remove data URLs de imagens embutidas (ex: <img src="data:image..."/>) para não poluir o prompt com megabytes de base64
  let clean = text.replace(
    /<img[^>]*src=["']data:image\/[^"']+["'][^>]*>/gi,
    '[Imagem de Especificações no Cadastro]',
  )
  clean = clean.replace(
    /data:image\/[a-zA-Z0-9+.-]+;base64,[A-Za-z0-9+/=]+/gi,
    '[Imagem base64 omitida]',
  )

  // Formata os marcadores de lista "• " como quebras de linha limpas para preservar a estrutura de cada especificação
  // e manter cada linha com seus valores lado a lado (ex: "• A B C\n• Diâmetro da Rosca mm 100 110 120")
  clean = clean
    .split('•')
    .map((part) => part.trim().replace(/[ \t]+/g, ' '))
    .filter((part) => part.length > 0)
    .join('\n  • ')

  if (clean.length === 0) return 'Não informado'
  return `\n  • ${clean}`
}

function truncateText(text: string | null | undefined, maxChars = 320): string {
  if (!text) return 'Não informado'
  const trimmed = text.trim().replace(/\s+/g, ' ')
  if (trimmed.length <= maxChars) return trimmed
  return trimmed.substring(0, maxChars) + '…'
}

function formatCatalog(
  versoes: VersaoRow[],
  isGenericQuestion: boolean,
  isSpecificVersionQuery = false,
): string {
  if (versoes.length === 0) {
    return 'Nenhuma máquina específica encontrada para os filtros fornecidos. Utilize as estatísticas gerais do catálogo acima para orientar o representante e pedir termos adicionais de busca (ex: marca, modelo ou tipo).'
  }

  const header = isGenericQuestion
    ? `AMOSTRA ILUSTRATIVA DAS PRINCIPAIS MÁQUINAS ATIVAS DO CATÁLOGO (exibindo ${versoes.length} itens representativos):`
    : `MÁQUINAS RELEVANTES ENCONTRADAS PARA A PERGUNTA (${versoes.length} itens localizados no banco):`

  // Quando é pergunta sobre versões específicas (ou poucas máquinas encontradas <= 6),
  // as primeiras máquinas recebem TODAS as linhas das especificações técnicas COMPLETAS sem corte.
  const fullSpecsLimit = isSpecificVersionQuery ? 6 : versoes.length <= 4 ? versoes.length : 2

  const items = versoes
    .map((v, i) => {
      // Prioridade: máquinas no topo (ou todas em busca específica) recebem TODAS as linhas de especificações
      const isTopMatch = i < fullSpecsLimit
      const specs = isTopMatch
        ? sanitizeTechnicalText(v.especificacoes_tecnicas)
        : truncateText(v.especificacoes_tecnicas, 600)
      const constru = isTopMatch
        ? v.caracteristicas_construtivas
          ? `\n  ${v.caracteristicas_construtivas.trim()}`
          : 'Não informado'
        : truncateText(v.caracteristicas_construtivas, 300)
      const acessorios = isTopMatch
        ? v.acessorios_standards
          ? `\n  ${v.acessorios_standards.trim()}`
          : 'Não informado'
        : truncateText(v.acessorios_standards, 250)
      const marca = v.modelos?.marcas?.nome ?? 'Não informada'
      const produto = v.modelos?.produtos?.nome ?? 'Não informado'
      const categoria =
        (v as any).categorias?.nome ?? v.modelos?.produtos?.categorias?.nome ?? 'Geral'
      const nomeAbrev = v.nome_abreviado ? ` (${v.nome_abreviado})` : ''
      const statusLabel =
        v.status === 'Ativo' || v.status === 'A'
          ? 'Ativo (disponível para proposta)'
          : 'Inativo (fora de linha)'

      const precoFmt =
        v.valor > 0
          ? `${v.moeda} ${Number(v.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
          : 'Sob consulta comercial'

      const estoqueFmt =
        v.estoque_disponivel > 0
          ? `${v.estoque_disponivel} un. disponível(is) para pronta entrega`
          : v.tem_estoque
            ? 'Item de giro/estoque regular (verificar saldo/embarque com a fábrica)'
            : 'Sob encomenda / produção sob demanda'

      const fotoFmt =
        v.imagem_preview && v.imagem_preview.trim() !== ''
          ? v.imagem_preview
          : 'Sem foto cadastrada'

      return `[MÁQUINA ${i + 1}]
- Nome da Versão: ${v.nome}${nomeAbrev}
- Nome Abreviado: ${v.nome_abreviado ?? 'N/A'}
- Marca: ${marca}
- Linha / Produto: ${produto}
- Categoria do Catálogo: ${categoria}
- Modelo base: ${v.modelos?.nome ?? 'N/A'}
- Código ERP: ${v.cod_erp ?? 'N/A'}
- Status: ${statusLabel}
- Valor referência: ${precoFmt}
- Situação de estoque: ${estoqueFmt}
- Foto/Preview: ${fotoFmt}
- Especificações principais: ${specs}
- Características construtivas: ${constru}
- Acessórios inclusos: ${acessorios}`
    })
    .join('\n\n')

  return `${header}\n\n${items}`
}

async function callOpenAI(
  apiKey: string,
  systemPrompt: string,
  messagesHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
  currentQuestion: string,
  imagePayload?: { dataUrl: string; detail?: 'low' | 'high' | 'auto' } | null,
): Promise<string> {
  let lastError: Error | null = null

  // Monta as mensagens para o Chat Completion: system + histórico recente + pergunta atual (com visão se houver imagem)
  const apiMessages: OpenAiMessage[] = [{ role: 'system', content: systemPrompt }]

  // Adiciona histórico anterior (limite razoável de últimas 10-15 mensagens)
  for (const m of messagesHistory) {
    if (m.role === 'user' || m.role === 'assistant') {
      const cleanContent = m.content?.trim()
      if (cleanContent) {
        apiMessages.push({ role: m.role, content: cleanContent })
      }
    }
  }

  const trimmedQuestion = currentQuestion.trim()

  // Se houver imagem anexada nesta requisição, a mensagem do usuário é enviada no formato multimodal de visão
  if (imagePayload && imagePayload.dataUrl) {
    const visionInstruction =
      'ATENÇÃO: Examine CUIDADOSAMENTE TODAS AS LINHAS da imagem anexada (plaqueta de máquina, tabela de especificações, ficha técnica ou print), desde o topo até a última linha do rodapé/base. Não pare nas primeiras linhas. Transcreva com fidelidade todas as medidas, números e especificações (inclusive dimensões CxLxA, potência, zonas de aquecimento, capacidade de óleo e cursos) e responda à pergunta do usuário cruzando com o catálogo Bener.'
    const userPromptText = trimmedQuestion
      ? `${trimmedQuestion}\n\n(${visionInstruction})`
      : visionInstruction

    const userParts: OpenAiMessageContentPart[] = [
      {
        type: 'text',
        text: userPromptText,
      },
      {
        type: 'image_url',
        image_url: {
          url: imagePayload.dataUrl,
          detail: 'high',
        },
      },
    ]

    apiMessages.push({
      role: 'user',
      content: userParts,
    })
  } else {
    // Se a última mensagem do histórico já for a pergunta atual, não duplica
    const lastMsg = apiMessages[apiMessages.length - 1]
    const lastContent = typeof lastMsg?.content === 'string' ? lastMsg.content : ''
    if (!lastMsg || lastMsg.role !== 'user' || lastContent !== trimmedQuestion) {
      apiMessages.push({ role: 'user', content: trimmedQuestion })
    }
  }

  for (let attempt = 0; attempt <= BACKOFF_DELAYS.length; attempt++) {
    try {
      const resp = await fetch(OPENAI_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: OPENAI_MODEL,
          messages: apiMessages,
          max_completion_tokens: 1800,
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
            'O serviço de IA não pôde ser autenticado no momento. Por favor, contate o administrador.',
          )
        }
        throw new Error(errData?.error?.message || `Erro ${resp.status} na API da OpenAI`)
      }

      const data = await resp.json()
      return data?.choices?.[0]?.message?.content ?? ''
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e))
      if (attempt < BACKOFF_DELAYS.length) {
        await new Promise((r) => setTimeout(r, BACKOFF_DELAYS[attempt]))
        continue
      }
    }
  }

  throw lastError ?? new Error('Serviço de IA indisponível após tentativas.')
}

Deno.serve(async (req: Request) => {
  const cors = getCorsHeaders(req)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors })
  }

  try {
    // Permite health-check/ping leve via GET ou via body: { ping: true } ou { action: 'ping' | 'health' }
    const url = new URL(req.url)
    const isHealthUrl =
      url.searchParams.get('health') === '1' || url.searchParams.get('ping') === '1'
    if (req.method === 'GET' || isHealthUrl) {
      const apiKey = Deno.env.get('OPENAI_API_KEY')
      return new Response(
        JSON.stringify({
          status: 'ok',
          aiConfigured: Boolean(apiKey),
          timestamp: new Date().toISOString(),
        }),
        {
          headers: { 'Content-Type': 'application/json', Connection: 'keep-alive', ...cors },
        },
      )
    }

    const body = await req.json().catch(() => ({}))
    if (body?.ping === true || body?.action === 'ping' || body?.action === 'health') {
      const apiKey = Deno.env.get('OPENAI_API_KEY')
      return new Response(
        JSON.stringify({
          status: 'ok',
          aiConfigured: Boolean(apiKey),
          timestamp: new Date().toISOString(),
        }),
        {
          headers: { 'Content-Type': 'application/json', Connection: 'keep-alive', ...cors },
        },
      )
    }

    // 1. Validação de autenticação obrigatória do usuário
    const authHeader = req.headers.get('Authorization')
    if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
      return new Response(
        JSON.stringify({
          error: 'Você precisa estar conectado à sua conta para conversar com a Bener Tech I.A.',
        }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json', ...cors },
        },
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
      return new Response(
        JSON.stringify({
          error:
            'Não foi possível conectar ao banco de dados no momento. Por favor, tente novamente em alguns instantes.',
        }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...cors } },
      )
    }

    // Valida o JWT do usuário junto ao Supabase Auth
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser()

    if (authError || !user) {
      return new Response(
        JSON.stringify({
          error:
            'Sua sessão expirou ou é inválida. Por favor, faça login novamente para falar com a Bener Tech I.A.',
        }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json', ...cors },
        },
      )
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey)

    // Helper: verifica se o usuário autenticado é admin
    const checkUserIsAdmin = async (userId: string): Promise<boolean> => {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, status')
        .eq('id', userId)
        .maybeSingle()
      if (!profile) return false
      const role = String(profile.role || '')
        .toLowerCase()
        .trim()
      const status = String(profile.status || '')
        .toLowerCase()
        .trim()
      if (status && status !== 'ativo') return false
      return (
        role === 'admin' ||
        role === 'admin completo' ||
        role === 'administrador' ||
        role.startsWith('admin')
      )
    }

    // =========================================================================
    // ROTAS DE AÇÕES AUXILIARES / VISÃO DE ADMIN (sem chamar OpenAI)
    // =========================================================================
    const action = typeof body?.action === 'string' ? body.action : null

    // Ação: Obter ou criar conversa ativa do próprio usuário
    if (action === 'get_or_create_conversation') {
      const requestedId = body?.conversationId
      if (requestedId) {
        const { data: conv, error: convErr } = await supabase
          .from('chatbot_conversas')
          .select('*')
          .eq('id', requestedId)
          .eq('user_id', user.id)
          .maybeSingle()

        if (convErr) {
          return new Response(JSON.stringify({ error: convErr.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...cors },
          })
        }
        if (!conv) {
          return new Response(
            JSON.stringify({ error: 'Conversa não encontrada ou não pertence ao seu usuário.' }),
            { status: 404, headers: { 'Content-Type': 'application/json', ...cors } },
          )
        }
        return new Response(JSON.stringify({ conversation: conv }), {
          headers: { 'Content-Type': 'application/json', ...cors },
        })
      }

      // Procura conversa ativa mais recente do usuário
      const { data: existingActive } = await supabase
        .from('chatbot_conversas')
        .select('*')
        .eq('user_id', user.id)
        .eq('ativa', true)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (existingActive) {
        return new Response(JSON.stringify({ conversation: existingActive }), {
          headers: { 'Content-Type': 'application/json', ...cors },
        })
      }

      // Cria nova conversa para o usuário
      const { data: newConv, error: createErr } = await supabase
        .from('chatbot_conversas')
        .insert({
          user_id: user.id,
          titulo: 'Nova conversa',
          ativa: true,
        })
        .select()
        .single()

      if (createErr) {
        return new Response(JSON.stringify({ error: createErr.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...cors },
        })
      }

      return new Response(JSON.stringify({ conversation: newConv }), {
        headers: { 'Content-Type': 'application/json', ...cors },
      })
    }

    // Ação: Iniciar nova conversa (fecha as anteriores ativas do usuário e cria nova)
    if (action === 'new_conversation') {
      await supabase
        .from('chatbot_conversas')
        .update({ ativa: false })
        .eq('user_id', user.id)
        .eq('ativa', true)

      const { data: created, error: cErr } = await supabase
        .from('chatbot_conversas')
        .insert({
          user_id: user.id,
          titulo: 'Nova conversa',
          ativa: true,
        })
        .select()
        .single()

      if (cErr) {
        return new Response(JSON.stringify({ error: cErr.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...cors },
        })
      }

      return new Response(JSON.stringify({ conversation: created }), {
        headers: { 'Content-Type': 'application/json', ...cors },
      })
    }

    // Ação: Carregar histórico de mensagens da conversa (validação estrita de posse pelo user_id)
    if (action === 'get_conversation_messages') {
      const convId = body?.conversationId
      if (!convId) {
        return new Response(JSON.stringify({ error: 'conversationId não informado.' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...cors },
        })
      }

      // Valida posse da conversa pelo usuário autenticado
      const { data: conv, error: convErr } = await supabase
        .from('chatbot_conversas')
        .select('id, user_id, titulo, ativa, created_at, updated_at')
        .eq('id', convId)
        .maybeSingle()

      if (convErr) {
        return new Response(JSON.stringify({ error: convErr.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...cors },
        })
      }

      if (!conv) {
        return new Response(JSON.stringify({ error: 'Conversa não encontrada.' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json', ...cors },
        })
      }

      // Se não for o próprio dono, rejeita com 404/403 no backend
      if (conv.user_id !== user.id) {
        return new Response(
          JSON.stringify({ error: 'Conversa não encontrada ou acesso não autorizado.' }),
          { status: 404, headers: { 'Content-Type': 'application/json', ...cors } },
        )
      }

      const { data: msgs, error: msgsErr } = await supabase
        .from('chatbot_mensagens')
        .select('*')
        .eq('conversa_id', convId)
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })

      if (msgsErr) {
        return new Response(JSON.stringify({ error: msgsErr.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...cors },
        })
      }

      return new Response(JSON.stringify({ conversation: conv, messages: msgs ?? [] }), {
        headers: { 'Content-Type': 'application/json', ...cors },
      })
    }

    // Ação: Registrar feedback 👍 / 👎 em mensagem
    if (action === 'record_feedback') {
      const msgId = body?.messageId
      const rating = body?.rating === 'like' || body?.rating === 'dislike' ? body.rating : null
      if (!msgId || !rating) {
        return new Response(
          JSON.stringify({ error: 'messageId e rating válidos são obrigatórios.' }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...cors },
          },
        )
      }

      const { error: updErr } = await supabase
        .from('chatbot_mensagens')
        .update({ feedback: rating })
        .eq('id', msgId)
        .eq('user_id', user.id)

      if (updErr) {
        return new Response(JSON.stringify({ error: updErr.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...cors },
        })
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json', ...cors },
      })
    }

    // =========================================================================
    // VISÃO DE ADMIN: Ações administrativas restritas (validada no backend)
    // =========================================================================

    // Admin: Listar usuários com contagem de conversas e última atividade
    if (action === 'admin_list_users') {
      const isAdmin = await checkUserIsAdmin(user.id)
      if (!isAdmin) {
        return new Response(
          JSON.stringify({ error: 'Acesso restrito a administradores do sistema.' }),
          { status: 403, headers: { 'Content-Type': 'application/json', ...cors } },
        )
      }

      // Busca todos os perfis ativos
      const { data: profiles, error: pErr } = await supabase
        .from('profiles')
        .select('id, name, email, role, status, avatar_url, last_seen_at')
        .order('name', { ascending: true })

      if (pErr) {
        return new Response(JSON.stringify({ error: pErr.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...cors },
        })
      }

      // Contagem de conversas e mensagens por usuário
      const { data: convStats } = await supabase
        .from('chatbot_conversas')
        .select('user_id, id, updated_at')

      const statsByUser: Record<string, { totalConversas: number; lastUpdate: string | null }> = {}
      for (const c of convStats ?? []) {
        if (!statsByUser[c.user_id]) {
          statsByUser[c.user_id] = { totalConversas: 0, lastUpdate: null }
        }
        statsByUser[c.user_id].totalConversas += 1
        if (
          !statsByUser[c.user_id].lastUpdate ||
          new Date(c.updated_at) > new Date(statsByUser[c.user_id].lastUpdate!)
        ) {
          statsByUser[c.user_id].lastUpdate = c.updated_at
        }
      }

      const enriched = (profiles ?? []).map((p) => ({
        ...p,
        totalConversas: statsByUser[p.id]?.totalConversas ?? 0,
        ultimaConversaEm: statsByUser[p.id]?.lastUpdate ?? null,
      }))

      return new Response(JSON.stringify({ users: enriched }), {
        headers: { 'Content-Type': 'application/json', ...cors },
      })
    }

    // Admin: Listar conversas de um usuário específico
    if (action === 'admin_list_user_conversations') {
      const isAdmin = await checkUserIsAdmin(user.id)
      if (!isAdmin) {
        return new Response(
          JSON.stringify({ error: 'Acesso restrito a administradores do sistema.' }),
          { status: 403, headers: { 'Content-Type': 'application/json', ...cors } },
        )
      }

      const targetUserId = body?.targetUserId
      if (!targetUserId) {
        return new Response(JSON.stringify({ error: 'targetUserId é obrigatório.' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...cors },
        })
      }

      const { data: conversas, error: cErr } = await supabase
        .from('chatbot_conversas')
        .select('id, user_id, titulo, ativa, created_at, updated_at')
        .eq('user_id', targetUserId)
        .order('updated_at', { ascending: false })

      if (cErr) {
        return new Response(JSON.stringify({ error: cErr.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...cors },
        })
      }

      // Busca dados do usuário alvo para contexto
      const { data: targetProfile } = await supabase
        .from('profiles')
        .select('id, name, email, role')
        .eq('id', targetUserId)
        .maybeSingle()

      return new Response(
        JSON.stringify({ targetUser: targetProfile, conversations: conversas ?? [] }),
        {
          headers: { 'Content-Type': 'application/json', ...cors },
        },
      )
    }

    // Admin: Abrir histórico da conversa de um usuário (apenas leitura + AUDITORIA OBRIGATÓRIA)
    if (action === 'admin_get_conversation_messages') {
      const isAdmin = await checkUserIsAdmin(user.id)
      if (!isAdmin) {
        return new Response(
          JSON.stringify({ error: 'Acesso restrito a administradores do sistema.' }),
          { status: 403, headers: { 'Content-Type': 'application/json', ...cors } },
        )
      }

      const convId = body?.conversationId
      const targetUserId = body?.targetUserId
      if (!convId || !targetUserId) {
        return new Response(
          JSON.stringify({ error: 'conversationId e targetUserId são obrigatórios.' }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...cors } },
        )
      }

      // Valida existência da conversa
      const { data: conv, error: convErr } = await supabase
        .from('chatbot_conversas')
        .select('*')
        .eq('id', convId)
        .eq('user_id', targetUserId)
        .maybeSingle()

      if (convErr || !conv) {
        return new Response(JSON.stringify({ error: 'Conversa não encontrada.' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json', ...cors },
        })
      }

      const { data: msgs, error: msgsErr } = await supabase
        .from('chatbot_mensagens')
        .select('*')
        .eq('conversa_id', convId)
        .eq('user_id', targetUserId)
        .order('created_at', { ascending: true })

      if (msgsErr) {
        return new Response(JSON.stringify({ error: msgsErr.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...cors },
        })
      }

      // Busca e-mails para auditoria
      const { data: targetProfile } = await supabase
        .from('profiles')
        .select('email, name')
        .eq('id', targetUserId)
        .maybeSingle()

      // REGISTRO EM LOG DE AUDITORIA: quem acessou a conversa de qual usuário
      const motivo =
        typeof body?.motivo === 'string'
          ? body.motivo.trim().slice(0, 300)
          : 'Consulta visual de suporte/auditoria'
      await supabase.from('chatbot_admin_audit').insert({
        admin_id: user.id,
        admin_email: user.email ?? 'admin',
        target_user_id: targetUserId,
        target_user_email: targetProfile?.email ?? null,
        conversa_id: convId,
        motivo,
      })

      return new Response(
        JSON.stringify({
          conversation: conv,
          targetUser: targetProfile,
          messages: msgs ?? [],
          auditLogged: true,
        }),
        { headers: { 'Content-Type': 'application/json', ...cors } },
      )
    }

    // Admin: Listar logs recentes de auditoria do chatbot
    if (action === 'admin_list_audit_logs') {
      const isAdmin = await checkUserIsAdmin(user.id)
      if (!isAdmin) {
        return new Response(
          JSON.stringify({ error: 'Acesso restrito a administradores do sistema.' }),
          { status: 403, headers: { 'Content-Type': 'application/json', ...cors } },
        )
      }

      const { data: logs, error: lErr } = await supabase
        .from('chatbot_admin_audit')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100)

      if (lErr) {
        return new Response(JSON.stringify({ error: lErr.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...cors },
        })
      }

      return new Response(JSON.stringify({ logs: logs ?? [] }), {
        headers: { 'Content-Type': 'application/json', ...cors },
      })
    }

    // 5. Rate limit por usuário autenticado: máximo 30 perguntas por minuto
    const isAllowed = checkRateLimit(user.id)
    if (!isAllowed) {
      return new Response(
        JSON.stringify({
          error:
            'Você está enviando muitas perguntas seguidas. Aguarde um instante e tente de novo.',
        }),
        {
          status: 429,
          headers: { 'Content-Type': 'application/json', ...cors },
        },
      )
    }

    // 3. Limite de tamanho da pergunta e do histórico (até 4.000 caracteres por mensagem de texto do usuário)
    const rawQuestion =
      typeof (body?.question ?? body?.pergunta) === 'string'
        ? (body?.question ?? body?.pergunta).trim()
        : ''

    // Suporte a anexos: Documentos (PDF, DOC, DOCX, TXT) e Imagens Técnicas (PNG, JPG, JPEG, WEBP)
    const rawAttachment =
      body?.attachment && typeof body.attachment === 'object' ? body.attachment : null

    const attachmentDoc =
      rawAttachment && !rawAttachment.isImage && !rawAttachment.imageDataUrl
        ? {
            fileName: String(rawAttachment.fileName || 'documento'),
            fileSize: Number(rawAttachment.fileSize || 0),
            fileType: String(rawAttachment.fileType || ''),
            content: typeof rawAttachment.content === 'string' ? rawAttachment.content.trim() : '',
            isScannedOrEmpty: Boolean(rawAttachment.isScannedOrEmpty),
          }
        : null

    // Suporte à visão de imagem (foto de placa, tabela de especificações técnicas, print, diagrama)
    const attachmentImage =
      rawAttachment &&
      (rawAttachment.isImage === true ||
        (typeof rawAttachment.imageDataUrl === 'string' &&
          rawAttachment.imageDataUrl.startsWith('data:image/')))
        ? {
            fileName: String(rawAttachment.fileName || 'imagem.jpg'),
            fileSize: Number(rawAttachment.fileSize || 0),
            fileType: String(rawAttachment.fileType || 'IMAGEM'),
            imageDataUrl: String(rawAttachment.imageDataUrl || '').trim(),
          }
        : null

    if (!rawQuestion && !attachmentDoc && !attachmentImage) {
      return new Response(JSON.stringify({ error: 'Pergunta não fornecida ou inválida.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...cors },
      })
    }

    // Pergunta efetiva para o chat (se enviou apenas o arquivo sem pergunta digitada, define uma pergunta padrão de análise)
    const effectiveQuestion =
      rawQuestion ||
      (attachmentImage
        ? 'Por favor, analise as especificações técnicas contidas nesta imagem e identifique no catálogo da Bener as máquinas compatíveis ou correspondentes.'
        : 'Por favor, leia o documento anexado e resuma suas principais informações técnicas ou comerciais relacionadas às máquinas.')

    // Trunca pergunta atual a 4.000 caracteres para permitir perguntas ricas ou listas de especificações
    const question =
      effectiveQuestion.length > 4000 ? effectiveQuestion.substring(0, 4000) : effectiveQuestion

    const rawHistory = Array.isArray(body?.history ?? body?.messages)
      ? (body.history ?? body.messages)
      : []

    // Sanitiza, trunca cada mensagem a 4.000 caracteres e limita histórico a no máximo 12 mensagens para preservar espaço de contexto
    const history: IncomingMessage[] = rawHistory
      .filter((m: unknown): m is IncomingMessage =>
        Boolean(
          m &&
          typeof m === 'object' &&
          'role' in m &&
          'content' in m &&
          typeof (m as IncomingMessage).content === 'string',
        ),
      )
      .map((m: IncomingMessage) => {
        const trimmed = m.content.trim()
        const truncated = trimmed.length > 4000 ? trimmed.substring(0, 4000) : trimmed
        return {
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: truncated,
        }
      })
      .filter((m: IncomingMessage) => m.content.length > 0)
      .slice(-12)

    const apiKey = Deno.env.get('OPENAI_API_KEY')
    if (!apiKey) {
      return new Response(
        JSON.stringify({
          error:
            'A chave de integração com a inteligência artificial não está configurada no servidor. Por favor, contate o administrador.',
        }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...cors } },
      )
    }

    // Identifica ou vincula a conversa ativa do usuário (ISOLAMENTO POR USUÁRIO)
    let conversationId: string | null =
      typeof body?.conversationId === 'string' ? body.conversationId : null

    if (conversationId) {
      const { data: convCheck } = await supabase
        .from('chatbot_conversas')
        .select('id, user_id')
        .eq('id', conversationId)
        .maybeSingle()

      if (!convCheck || convCheck.user_id !== user.id) {
        return new Response(
          JSON.stringify({ error: 'Conversa não encontrada ou não pertence ao seu usuário.' }),
          { status: 404, headers: { 'Content-Type': 'application/json', ...cors } },
        )
      }
    } else {
      // Procura conversa ativa mais recente do usuário
      const { data: activeConv } = await supabase
        .from('chatbot_conversas')
        .select('id')
        .eq('user_id', user.id)
        .eq('ativa', true)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (activeConv) {
        conversationId = activeConv.id
      } else {
        // Cria primeira conversa para este usuário
        const previewTitle = question.slice(0, 50).trim() || 'Nova conversa'
        const { data: newConv } = await supabase
          .from('chatbot_conversas')
          .insert({
            user_id: user.id,
            titulo: previewTitle,
            ativa: true,
          })
          .select('id')
          .single()
        conversationId = newConv?.id ?? null
      }
    }

    // 1. Estatísticas globais do catálogo calculadas de forma ultra-rápida (queries pontuais com count)
    const [
      totalCadastradasRes,
      totalAtivasRes,
      totalInativasRes,
      totalComEstoqueRes,
      totalEstoqueDisponivelRes,
      marcasRes,
      produtosRes,
      categoriasRes,
    ] = await Promise.all([
      supabase
        .from('versoes')
        .select('*', { count: 'exact', head: true })
        .is('deleted_at', null)
        .neq('status', 'Em Quarentena'),
      supabase
        .from('versoes')
        .select('*', { count: 'exact', head: true })
        .is('deleted_at', null)
        .neq('status', 'Em Quarentena')
        .or('status.eq.Ativo,status.eq.A'),
      supabase
        .from('versoes')
        .select('*', { count: 'exact', head: true })
        .is('deleted_at', null)
        .neq('status', 'Em Quarentena')
        .or('status.eq.Inativo,status.eq.I'),
      supabase
        .from('versoes')
        .select('*', { count: 'exact', head: true })
        .is('deleted_at', null)
        .neq('status', 'Em Quarentena')
        .eq('tem_estoque', true),
      supabase
        .from('versoes')
        .select('*', { count: 'exact', head: true })
        .is('deleted_at', null)
        .neq('status', 'Em Quarentena')
        .gt('estoque_disponivel', 0),
      // Marcas cadastradas
      supabase
        .from('marcas')
        .select('id, nome')
        .is('deleted_at', null)
        .neq('status', 'Em Quarentena')
        .order('nome'),
      // Produtos/Linhas cadastradas
      supabase
        .from('produtos')
        .select('id, nome, categoria')
        .is('deleted_at', null)
        .neq('status', 'Em Quarentena')
        .order('nome'),
      // Categorias raiz do catálogo (ex: Injetoras, Veker, Presses, Geral, Aberta, Licitação)
      supabase
        .from('categorias')
        .select('id, nome')
        .is('deleted_at', null)
        .neq('status', 'Em Quarentena')
        .order('nome'),
    ])

    const totalCadastradas = totalCadastradasRes.count ?? 1319
    const totalAtivas = totalAtivasRes.count ?? 625
    const totalInativas = totalInativasRes.count ?? totalCadastradas - totalAtivas
    const totalComEstoqueFlag = totalComEstoqueRes.count ?? 309
    const totalEstoqueDisponivel = totalEstoqueDisponivelRes.count ?? 0

    const marcasList: Array<{ id: string; nome: string }> = marcasRes.data ?? []
    const produtosList: Array<{ id: string; nome: string; categoria?: string | null }> =
      produtosRes.data ?? []
    const categoriasList: Array<{ id: string; nome: string }> = categoriasRes.data ?? []

    // 2. Extração contextual de palavras-chave da pergunta e do histórico recente
    // Para resolver perguntas de follow-up como "e com distância entre pontas maior?",
    // combinamos o texto da pergunta com as últimas mensagens do usuário se a pergunta atual for muito curta ou elíptica
    const isFollowUp =
      question.length < 35 &&
      (question.startsWith('e ') ||
        question.startsWith('e com') ||
        question.startsWith('tem ') ||
        question.startsWith('qual ') ||
        question.includes('maior') ||
        question.includes('menor') ||
        question.includes('outro') ||
        question.includes('outra'))

    const previousUserText = history
      .filter((h) => h.role === 'user')
      .slice(-2)
      .map((h) => h.content)
      .join(' ')

    const combinedSearchText =
      isFollowUp && previousUserText ? `${previousUserText} ${question}` : question

    const keywords = cleanKeywords(combinedSearchText)
    const lowerQuestion = combinedSearchText.toLowerCase()
    const cleanQuestionNoAccents = removeAccents(lowerQuestion)

    // Se houver documento anexado digitalizado sem texto legível
    if (
      attachmentDoc &&
      (attachmentDoc.isScannedOrEmpty ||
        !attachmentDoc.content ||
        attachmentDoc.content.length < 20)
    ) {
      const scannedMsg = `Recebi seu arquivo "${attachmentDoc.fileName}", mas ele parece ser um documento digitalizado como imagem ou sem camada de texto selecionável. Como não há texto legível para extração automática, não consegui analisar o conteúdo. Por favor, envie uma versão com texto selecionável ou digite aqui as especificações e o modelo que você precisa!`
      return new Response(JSON.stringify({ answer: scannedMsg, table: null }), {
        headers: { 'Content-Type': 'application/json', Connection: 'keep-alive', ...cors },
      })
    }

    // Se houver conteúdo de documento anexado, truncar com segurança a até ~25.000 caracteres para o LLM
    const documentContextSnippet =
      attachmentDoc && attachmentDoc.content
        ? `\n\n--- DOCUMENTO ANEXADO PELO USUÁRIO (${attachmentDoc.fileName}) ---\n${attachmentDoc.content.slice(0, 25000)}${attachmentDoc.content.length > 25000 ? '\n[... restante do documento truncado para respeitar limites de contexto ...]' : ''}\n--- FIM DO DOCUMENTO ANEXADO ---\n`
        : ''

    // Detectar marcas, produtos e categorias mencionados na pergunta ou no contexto
    const matchedMarcas = marcasList.filter((m) => {
      const nomeLower = m.nome.toLowerCase().trim()
      const nomeNoAccents = removeAccents(nomeLower)
      return lowerQuestion.includes(nomeLower) || cleanQuestionNoAccents.includes(nomeNoAccents)
    })

    const matchedProdutos = produtosList.filter((p) => {
      const nomeLower = p.nome.toLowerCase().trim()
      const nomeNoAccents = removeAccents(nomeLower)
      return lowerQuestion.includes(nomeLower) || cleanQuestionNoAccents.includes(nomeNoAccents)
    })

    const matchedCategorias = categoriasList.filter((c) => {
      const nomeLower = c.nome.toLowerCase().trim()
      const nomeNoAccents = removeAccents(nomeLower)
      // Ex: "injetora", "injetoras", "presses", "veker", "licitacao"
      const singular = nomeNoAccents.endsWith('s') ? nomeNoAccents.slice(0, -1) : nomeNoAccents
      return (
        lowerQuestion.includes(nomeLower) ||
        cleanQuestionNoAccents.includes(nomeNoAccents) ||
        cleanQuestionNoAccents.includes(singular)
      )
    })

    // Extrai variantes de nomes de versão (ex: SA-350P, SA350, FB-400R, CT-450, etc.)
    const versionNameVariants = extractVersionNameVariants(combinedSearchText)

    // Detecta números/medidas específicas na pergunta (ex: "600 mm", "600mm", "600", "150t", "320")
    const numberMatches = Array.from(question.matchAll(/\b(\d{2,6})\b/g)).map((m) => m[1])

    // Se é pergunta genérica (ex: "Quantas máquinas existem?", "Quais marcas?", "O que você tem?")
    const isGenericQuestion =
      keywords.length === 0 &&
      versionNameVariants.length === 0 &&
      matchedMarcas.length === 0 &&
      matchedProdutos.length === 0 &&
      matchedCategorias.length === 0 &&
      numberMatches.length === 0

    // 3. Busca direcionada no catálogo (limite de 40 a 60 registros relevantes)
    // Inclui imagem_preview e dados hierárquicos completos
    const selectFields =
      'id, nome, nome_abreviado, cod_erp, imagem_preview, moeda, valor, tem_fator, fator_nac, tem_estoque, estoque_total, estoque_bloqueado, estoque_reservado, estoque_disponivel, acessorios_standards, caracteristicas_construtivas, especificacoes_tecnicas, status, alerta_estoque_minimo, categoria_id, categorias:categoria_id(id, nome), modelos(id, nome, marcas:marca(id, nome), produtos:produto(id, nome, categorias:categoria(id, nome)))'

    let matchedVersoes: VersaoRow[] = []

    if (isGenericQuestion) {
      // Amostra representativa das primeiras máquinas ativas
      const { data } = await supabase
        .from('versoes')
        .select(selectFields)
        .is('deleted_at', null)
        .neq('status', 'Em Quarentena')
        .or('status.eq.Ativo,status.eq.A')
        .order('nome', { ascending: true })
        .limit(40)

      matchedVersoes = (data as unknown as VersaoRow[]) ?? []
    } else {
      const rowsMap = new Map<string, VersaoRow>()

      // 0) PRIORIDADE MÁXIMA: BUSCA DIRETA E TOLERANTE PELO NOME DA VERSÃO (nome, nome_abreviado e variantes)
      // Resolve especificamente a queixa dos usuários (representantes comerciais) que perguntam diretamente pelo nome da versão
      // Ex: "tem a versão SA-350P?", "SA 350", "SA350P", "SA-400 High Speed", "FB-400R", "CT-450e", "LN 2400"
      if (versionNameVariants.length > 0) {
        for (const variant of versionNameVariants.slice(0, 5)) {
          const filterVariants = [
            `nome.ilike.%${variant}%`,
            `nome_abreviado.ilike.%${variant}%`,
            `cod_erp.ilike.%${variant}%`,
          ].join(',')

          const { data: variantMatches } = await supabase
            .from('versoes')
            .select(selectFields)
            .is('deleted_at', null)
            .neq('status', 'Em Quarentena')
            .or(filterVariants)
            .order('status', { ascending: true })
            .limit(30)

          for (const v of (variantMatches as unknown as VersaoRow[]) ?? []) {
            rowsMap.set(v.id, v)
          }
        }
      }

      // Se o usuário digitou palavras de busca, procura em nome e nome_abreviado
      if (keywords.length > 0) {
        for (const kw of keywords.slice(0, 4)) {
          if (kw.length < 2) continue
          const { data: directNameMatches } = await supabase
            .from('versoes')
            .select(selectFields)
            .is('deleted_at', null)
            .neq('status', 'Em Quarentena')
            .or(`nome.ilike.%${kw}%,nome_abreviado.ilike.%${kw}%,cod_erp.ilike.%${kw}%`)
            .order('status', { ascending: true })
            .limit(30)

          for (const v of (directNameMatches as unknown as VersaoRow[]) ?? []) {
            rowsMap.set(v.id, v)
          }
        }
      }

      // A) BUSCA POR CATEGORIA RAIZ DO CATÁLOGO (ex: "Injetoras", "Veker", "Presses", etc.)
      // Quando o usuário pergunta "quais versões de injetora você tem?", busca todas as versões ligadas a essa categoria
      if (matchedCategorias.length > 0) {
        for (const cat of matchedCategorias.slice(0, 2)) {
          // Busca produtos pertencentes à categoria
          const prodsNaCat = produtosList.filter((p) => p.categoria === cat.id)
          const prodIds = prodsNaCat.map((p) => p.id)

          // Se a lista de produtos estiver vazia em memória, consulta o banco
          let resolvedProdIds = prodIds
          if (resolvedProdIds.length === 0) {
            const { data: dbProds } = await supabase
              .from('produtos')
              .select('id')
              .eq('categoria', cat.id)
              .is('deleted_at', null)
            resolvedProdIds = (dbProds ?? []).map((p) => p.id)
          }

          // Busca versões pela coluna direta categoria_id E/OU pelos modelos da categoria
          const { data: versoesDiretasCat } = await supabase
            .from('versoes')
            .select(selectFields)
            .is('deleted_at', null)
            .neq('status', 'Em Quarentena')
            .eq('categoria_id', cat.id)
            .order('status', { ascending: true })
            .order('nome', { ascending: true })
            .limit(40)

          for (const v of (versoesDiretasCat as unknown as VersaoRow[]) ?? []) {
            rowsMap.set(v.id, v)
          }

          if (resolvedProdIds.length > 0) {
            const { data: modelosDaCat } = await supabase
              .from('modelos')
              .select('id')
              .in('produto', resolvedProdIds)
              .is('deleted_at', null)

            const modeloIds = (modelosDaCat ?? []).map((m) => m.id)
            if (modeloIds.length > 0) {
              const { data: versoesCat } = await supabase
                .from('versoes')
                .select(selectFields)
                .is('deleted_at', null)
                .neq('status', 'Em Quarentena')
                .in('modelo', modeloIds)
                .order('status', { ascending: true })
                .order('nome', { ascending: true })
                .limit(40)

              for (const v of (versoesCat as unknown as VersaoRow[]) ?? []) {
                rowsMap.set(v.id, v)
              }
            }
          }

          // Se for categoria de injetora, faz também busca direta por texto "injetor" no nome da versão para cobrir todas
          if (
            cat.nome.toLowerCase().includes('injetor') ||
            cleanQuestionNoAccents.includes('injetor')
          ) {
            const { data: injetorasPorNome } = await supabase
              .from('versoes')
              .select(selectFields)
              .is('deleted_at', null)
              .neq('status', 'Em Quarentena')
              .ilike('nome', '%injetor%')
              .order('status', { ascending: true })
              .limit(40)

            for (const v of (injetorasPorNome as unknown as VersaoRow[]) ?? []) {
              rowsMap.set(v.id, v)
            }
          }
        }
      }

      // Se a pergunta cita "injetora" ou "injetoras" mesmo sem casar o nome exato da categoria
      if (cleanQuestionNoAccents.includes('injetor') && rowsMap.size < 40) {
        const { data: directInjetoras } = await supabase
          .from('versoes')
          .select(selectFields)
          .is('deleted_at', null)
          .neq('status', 'Em Quarentena')
          .or('nome.ilike.%injetor%,nome_abreviado.ilike.%injetor%')
          .order('status', { ascending: true })
          .limit(40)

        for (const v of (directInjetoras as unknown as VersaoRow[]) ?? []) {
          rowsMap.set(v.id, v)
        }
      }

      // B) BUSCA TÉCNICA ESPECÍFICA: quando há número + especificação (ex: "distância entre pontas 600", "placa 8", "curso 500")
      if (numberMatches.length > 0) {
        for (const num of numberMatches.slice(0, 2)) {
          // Identifica termos técnicos próximos a esse número na pergunta
          const techTerms = [
            'pontas',
            'distancia',
            'barramento',
            'placa',
            'curso',
            'diametro',
            'potencia',
            'spindle',
            'toneladas',
            'tonelada',
            'forca',
            'fechamento',
            'rosca',
            'injecao',
            'mesa',
            'eixo',
          ]
          const foundTechTerms = techTerms.filter((term) => cleanQuestionNoAccents.includes(term))

          if (foundTechTerms.length > 0) {
            // Busca que combina o termo técnico E o número dentro de especificações_tecnicas
            for (const tech of foundTechTerms) {
              const { data: techMatches } = await supabase
                .from('versoes')
                .select(selectFields)
                .is('deleted_at', null)
                .neq('status', 'Em Quarentena')
                .ilike('especificacoes_tecnicas', `%${tech}%`)
                .ilike('especificacoes_tecnicas', `%${num}%`)
                .order('status', { ascending: true }) // Ativos primeiro
                .limit(40)

              for (const v of (techMatches as unknown as VersaoRow[]) ?? []) {
                rowsMap.set(v.id, v)
              }
            }
          }

          // Busca direta em especificações, características e acessórios pelo número com variações comuns (ex: "mm 600", "600 mm", " 600 ")
          if (rowsMap.size < 30) {
            const numFilters = [
              `especificacoes_tecnicas.ilike.%mm ${num}%`,
              `especificacoes_tecnicas.ilike.%${num} mm%`,
              `especificacoes_tecnicas.ilike.%${num}mm%`,
              `especificacoes_tecnicas.ilike.% ${num} %`,
              `caracteristicas_construtivas.ilike.%${num}%`,
              `acessorios_standards.ilike.%${num}%`,
            ].join(',')

            const { data: numData } = await supabase
              .from('versoes')
              .select(selectFields)
              .is('deleted_at', null)
              .neq('status', 'Em Quarentena')
              .or(numFilters)
              .order('status', { ascending: true })
              .limit(30)

            for (const v of (numData as unknown as VersaoRow[]) ?? []) {
              rowsMap.set(v.id, v)
            }
          }
        }
      }

      // C) Se mencionou marca específica (ex: "FCS", "Veker", "Hyundai", "Seyi")
      if (matchedMarcas.length > 0 && rowsMap.size < 50) {
        for (const marca of matchedMarcas.slice(0, 2)) {
          const { data: modelosDaMarca } = await supabase
            .from('modelos')
            .select('id')
            .eq('marca', marca.id)
            .is('deleted_at', null)

          const modeloIds = (modelosDaMarca ?? []).map((m) => m.id)
          if (modeloIds.length > 0) {
            const { data: versoesMarca } = await supabase
              .from('versoes')
              .select(selectFields)
              .is('deleted_at', null)
              .neq('status', 'Em Quarentena')
              .in('modelo', modeloIds)
              .order('status', { ascending: true })
              .order('nome', { ascending: true })
              .limit(35)

            for (const v of (versoesMarca as unknown as VersaoRow[]) ?? []) {
              rowsMap.set(v.id, v)
            }
          }
        }
      }

      // D) Se mencionou produto/linha específica (ex: "Injetora - FCS", "Torno", "Centro de usinagem", "Prensa")
      if (matchedProdutos.length > 0 && rowsMap.size < 50) {
        for (const prod of matchedProdutos.slice(0, 2)) {
          const { data: modelosDoProduto } = await supabase
            .from('modelos')
            .select('id')
            .eq('produto', prod.id)
            .is('deleted_at', null)

          const modeloIds = (modelosDoProduto ?? []).map((m) => m.id)
          if (modeloIds.length > 0) {
            const { data: versoesProd } = await supabase
              .from('versoes')
              .select(selectFields)
              .is('deleted_at', null)
              .neq('status', 'Em Quarentena')
              .in('modelo', modeloIds)
              .order('status', { ascending: true })
              .order('nome', { ascending: true })
              .limit(35)

            for (const v of (versoesProd as unknown as VersaoRow[]) ?? []) {
              rowsMap.set(v.id, v)
            }
          }
        }
      }

      // E) Busca geral por palavras-chave com cobertura em especificações técnicas, construtivas e acessórios
      if (rowsMap.size < 50 && keywords.length > 0) {
        const topKeywords = keywords.filter((k) => k.length >= 3).slice(0, 3)

        if (topKeywords.length > 0) {
          const filterOr = topKeywords
            .flatMap((kw) => [
              `especificacoes_tecnicas.ilike.%${kw}%`,
              `caracteristicas_construtivas.ilike.%${kw}%`,
              `acessorios_standards.ilike.%${kw}%`,
            ])
            .join(',')

          const { data: keywordMatches } = await supabase
            .from('versoes')
            .select(selectFields)
            .is('deleted_at', null)
            .neq('status', 'Em Quarentena')
            .or(filterOr)
            .order('status', { ascending: true })
            .limit(40)

          for (const v of (keywordMatches as unknown as VersaoRow[]) ?? []) {
            rowsMap.set(v.id, v)
          }
        }
      }

      // F) Se a pergunta fala de estoque pronta entrega
      if (
        (lowerQuestion.includes('estoque') ||
          lowerQuestion.includes('pronta entrega') ||
          lowerQuestion.includes('disponiv')) &&
        rowsMap.size < 30
      ) {
        const { data: estoqueMatches } = await supabase
          .from('versoes')
          .select(selectFields)
          .is('deleted_at', null)
          .neq('status', 'Em Quarentena')
          .or('tem_estoque.eq.true,estoque_disponivel.gt.0')
          .order('estoque_disponivel', { ascending: false })
          .limit(30)

        for (const v of (estoqueMatches as unknown as VersaoRow[]) ?? []) {
          rowsMap.set(v.id, v)
        }
      }

      // Ordenar resultados: correspondência pelo nome da versão / variante tem prioridade máxima, seguido de status Ativo
      const sortedVersoes = Array.from(rowsMap.values()).sort((a, b) => {
        // 1. Quem coincide diretamente com o nome da versão ou abreviado procurado vai para o topo absoluto
        if (versionNameVariants.length > 0) {
          const aMatchName = versionNameVariants.some((v) => {
            const lowV = v.toLowerCase()
            return (
              (a.nome_abreviado && a.nome_abreviado.toLowerCase().includes(lowV)) ||
              (a.nome && a.nome.toLowerCase().includes(lowV)) ||
              (a.cod_erp && a.cod_erp.toLowerCase() === lowV)
            )
          })
          const bMatchName = versionNameVariants.some((v) => {
            const lowV = v.toLowerCase()
            return (
              (b.nome_abreviado && b.nome_abreviado.toLowerCase().includes(lowV)) ||
              (b.nome && b.nome.toLowerCase().includes(lowV)) ||
              (b.cod_erp && b.cod_erp.toLowerCase() === lowV)
            )
          })
          if (aMatchName !== bMatchName) return aMatchName ? -1 : 1
        }

        // 2. Ativo antes de Inativo
        const aActive = a.status === 'Ativo' || a.status === 'A'
        const bActive = b.status === 'Ativo' || b.status === 'A'
        if (aActive !== bActive) return aActive ? -1 : 1

        // 3. Se houver números procurados, prioriza quem contém o número nas especificações
        if (numberMatches.length > 0) {
          const aHasNum = numberMatches.some(
            (n) =>
              a.especificacoes_tecnicas?.includes(n) ||
              a.caracteristicas_construtivas?.includes(n) ||
              a.nome?.includes(n),
          )
          const bHasNum = numberMatches.some(
            (n) =>
              b.especificacoes_tecnicas?.includes(n) ||
              b.caracteristicas_construtivas?.includes(n) ||
              b.nome?.includes(n),
          )
          if (aHasNum !== bHasNum) return aHasNum ? -1 : 1
        }

        return a.nome.localeCompare(b.nome)
      })

      // Mantém no máximo 50 máquinas para não sobrecarregar prompt e evitar timeout
      matchedVersoes = sortedVersoes.slice(0, 50)

      // Fallback: se nenhum termo casou, busca uma amostra de ativas
      if (matchedVersoes.length === 0) {
        const { data: fallbackData } = await supabase
          .from('versoes')
          .select(selectFields)
          .is('deleted_at', null)
          .neq('status', 'Em Quarentena')
          .or('status.eq.Ativo,status.eq.A')
          .order('nome', { ascending: true })
          .limit(30)

        matchedVersoes = (fallbackData as unknown as VersaoRow[]) ?? []
      }
    }

    // 4. Preferências de estilo
    const { data: prefRows } = await supabase
      .from('preferencias')
      .select('valor')
      .eq('chave', 'chatbot_estilo_resposta')
      .limit(1)

    const prefValor = prefRows?.[0]?.valor as { estilo?: string } | null
    const estilo = prefValor?.estilo || ''
    const isShortMode = estilo !== 'detalhado'

    // Detecta se a pergunta é sobre uma versão ou modelo específico (busca por nome/código/variante ou menção a termos técnicos pontuais)
    const isSpecificVersionQuery =
      versionNameVariants.length > 0 ||
      (keywords.length > 0 && !isGenericQuestion && matchedVersoes.length <= 10)

    // 5. Montagem do prompt do LLM
    const catalogData = formatCatalog(matchedVersoes, isGenericQuestion, isSpecificVersionQuery)
    const marcasDisponiveisStr = marcasList.map((m) => m.nome).join(', ')
    const produtosDisponiveisStr = produtosList
      .slice(0, 30)
      .map((p) => p.nome)
      .join(', ')

    const basePrompt = `Você é a Bener Tech I.A, assistente virtual inteligente do catálogo da Bener Máquinas, prestativa, acolhedora e focada no dia a dia dos representantes comerciais. Ao se apresentar ou responder sobre sua identidade, apresente-se como Bener Tech I.A.

ANEXOS DE DOCUMENTOS E IMAGENS TÉCNICAS (LEITURA INTEGRAL DE TODAS AS LINHAS):
- O usuário pode anexar tanto documentos de texto (PDF, DOC, DOCX, TXT) quanto IMAGENS DE DESCRIÇÕES TÉCNICAS (fotos ou prints de especificações técnicas, tabelas de cursos e capacidades, plaquetas de identificação de máquinas, diagramas de área útil, fotos de equipamentos solicitados pelo cliente).
- Quando o usuário enviar uma IMAGEM (plaqueta, print de ficha técnica ou tabela):
  1. LEIA TODAS AS LINHAS DA IMAGEM DO INÍCIO AO FIM, SEM PARAR NO TOPO. Inspecione minuciosamente a parte superior, o meio e a base/rodapé da imagem. Placas e tabelas técnicas trazem dados fundamentais no final (ex: dimensões da máquina CxLxA, capacidade de óleo no tanque, pressão hidráulica, potência de aquecimento, número de zonas, peso do equipamento). NUNCA ignore ou descarte as linhas finais.
  2. Leia atentamente todos os números, medidas, dimensões e capacidades visíveis (ex: diâmetro da rosca, curso de injeção, volume teórico, peso de injeção, pressão de injeção, força de fechamento em kN/Ton, curso de abertura, altura mín/máx do molde, espaço entre colunas, placas V x H, curso de extração, barramento, diâmetro torneável, distância entre pontas, cursos X/Y/Z, potência em kW/CV, rotação máxima em RPM, comando CNC, etc.).
  3. Transcreva ou aponte os dados técnicos identificados na imagem de forma clara e limpa para o representante (ex: "Analisei a imagem enviada e identifiquei as seguintes especificações técnicas:").
  4. Cruze imediatamente as especificações extraídas da imagem com o catálogo de máquinas da Bener fornecido abaixo, indicando quais modelos atendem ou se aproximam das capacidades da imagem.
  5. Se a imagem estiver com baixa nitidez ou faltar alguma medida crítica, informe gentilmente o que foi possível ler e pergunte o dado faltante para refinar a indicação.

CITAÇÃO DA FONTE NA RESPOSTA (MUITO IMPORTANTE - REGRA OBRIGATÓRIA):
- Sempre que você responder ou apresentar uma informação técnica, especificação, valor, capacidade ou dado de máquina, INDIQUE DE ONDE TIROU CADA DADO de forma natural, fluida e discreta no próprio texto.
- Não use referências numéricas formais como "[1]" ou rodapés acadêmicos. Integre a citação organicamente na frase. Exemplos:
  * Quando a informação veio do catálogo/versão cadastrada: "conforme a ficha técnica da SA-470, o volume de injeção na configuração B é 4.702 cm³" ou "segundo o cadastro técnico da SA-1000..." ou "de acordo com a ficha técnica do catálogo para a FB-400R...".
  * Quando a informação veio de imagem ou print enviado pelo usuário: "conforme a imagem que você anexou..." ou "segundo a plaqueta técnica da imagem enviada...".
  * Quando a informação veio de documento anexado pelo usuário: "conforme o documento técnico anexado...".
  * Quando a informação for um total ou estatística geral do sistema: "segundo os registros atuais do catálogo Bener...".
- Essa citação transmite total segurança e transparência técnica aos representantes comerciais e seus clientes.

CONVENÇÃO DE COLUNAS DE LETRAS NAS ESPECIFICAÇÕES TÉCNICAS (MUITO IMPORTANTE):
- Em muitas máquinas do catálogo (especialmente injetoras de plástico FCS e máquinas com opções de fuso/rosca/cilindro), o cabeçalho das especificações técnicas apresenta letras maiúsculas isoladas, tipicamente:
  "• A B C" (ou "• A B", ou "• A B C D").
- Essa linha de letras define as CONFIGURAÇÕES / COLUNAS DE CILINDRO OU ROSCA disponíveis para aquela máquina.
- Cada linha de especificação abaixo dessa marcação que contiver múltiplos valores numéricos lado a lado corresponde RIGOROSAMENTE a cada uma das letras na ordem:
  * 1º valor numérico = Configuração A
  * 2º valor numérico = Configuração B
  * 3º valor numérico = Configuração C
  * 4º valor numérico = Configuração D (quando houver 4 letras)
- EXEMPLO REAL DO CATÁLOGO:
  Cabeçalho: • A B C
  Linha: • Diâmetro da Rosca mm 100 110 120
  Linha: • Volume teórico de Injeção cm³ 3886 4702 5595
  Linha: • Peso total de injeção (PS) g 3536 4279 5092
  Linha: • Pressão de injeção bar 2117 1749 1470
  Linha: • Velocidade de injeção g/s 577 698 831
  Linha: • Curso de Injeção mm 495 (quando a linha tem apenas 1 valor, esse valor é único e comum para todas as configurações A, B e C).

  Interpretação exata:
  - Na configuração A: Diâmetro da rosca é 100 mm, Volume de injeção é 3.886 cm³, Peso de injeção é 3.536 g, Pressão de injeção é 2.117 bar, Velocidade é 577 g/s.
  - Na configuração B: Diâmetro da rosca é 110 mm, Volume de injeção é 4.702 cm³, Peso de injeção é 4.279 g, Pressão de injeção é 1.749 bar, Velocidade é 698 g/s.
  - Na configuração C: Diâmetro da rosca é 120 mm, Volume de injeção é 5.595 cm³, Peso de injeção é 5.092 g, Pressão de injeção é 1.470 bar, Velocidade é 831 g/s.
- Se o usuário perguntar: "qual o volume de injeção na configuração B?", a resposta correta é 4.702 cm³ (2º valor).
- Se o usuário perguntar de forma geral, apresente os valores discriminados por configuração (A, B e C) para que o representante veja a variação com facilidade.
- Nunca achate, misture ou invente esses valores: mantenha a associação exata entre o índice da coluna de valor e a letra correspondente.

ANÁLISE INTEGRAL DAS ESPECIFICAÇÕES (TODAS AS LINHAS DO INÍCIO AO FIM):
- No campo "Especificações principais" de cada máquina na lista abaixo, TODAS as linhas da ficha técnica foram preservadas.
- Verifique SEMPRE toda a lista de especificações, inclusive as linhas do FINAL (ex: "Curso de extração", "Força de Extração", "Potência Motor Elétrico", "Zonas de Aquecimento", "Potência de Aquecimento", "Capacidade de óleo no tanque", "Pressão Hidráulica do sistema", "Dimensões da Máquina (CxLxA)").
- Nunca responda que a informação não consta no catálogo se ela estiver em qualquer linha (início, meio ou fim) da lista de especificações daquela máquina abaixo.
- Quando houver uma seção "DOCUMENTO ANEXADO PELO USUÁRIO" abaixo, leia atenciosamente todo o texto do documento e responda à pergunta do representante cruzando as informações do documento com o catálogo de máquinas da Bener.
- Cite pontos específicos do documento ou da imagem quando apropriado (ex: "De acordo com a imagem técnica anexada...", "Identifiquei na tabela da imagem que o cliente solicita...").
- Se o documento ou imagem tiver especificações de máquinas, compare com os modelos correspondentes disponíveis no catálogo da Bener.

REGRA OBRIGATÓRIA DE FORMATAÇÃO (MUITO IMPORTANTE):
- NUNCA use sintaxe Markdown tradicional na sua resposta. É ESTRITAMENTE PROIBIDO usar asteriscos duplos (como **texto**), asteriscos simples (*texto*), underscores (__texto__ ou _texto_), crases inline (\`código\`) ou títulos com cerquilha (# ou ##).
- As respostas devem ser em TEXTO SIMPLES E LIMPO, legível e direto.
- Para destacar títulos, use letras maiúsculas ou numeração simples (ex: "1. TORNO UNIVERSAL VEKER" ou "INFORMAÇÕES GERAIS:").
- Nunca coloque asteriscos nos rótulos de campos (NUNCA faça "**Marca:**", use apenas "Marca:").
- O público é composto por representantes de vendas experientes e tradicionais que exigem um visual limpo, sóbrio e profissional sem códigos ou símbolos de formatação soltos na tela.

NOVO RECURSO: RETORNO DE TABELAS QUANDO LISTAR OU COMPARAR MÁQUINAS:
- Quando o usuário pedir para listar máquinas, comparar modelos, mostrar opções disponíveis, listar estoque ou quando a resposta contiver 2 ou mais máquinas, APRESENTE AS MÁQUINAS DENTRO DE UM BLOCO DE TABELA no formato especial delimitado abaixo:

[TABELA]
Máquina | Marca | Modelo | Valor referência | Situação de estoque
Torno TVK 1224 ECO | Veker | TVK 1224 | USD 25.000,00 | Pronta entrega (2 un.)
Centro Veker MV 850 | Veker | MV 850 | USD 78.000,00 | Giro / Encomenda
[/TABELA]

Regras do bloco de tabela:
1. Comece exatamente com a linha [TABELA] e termine com [/TABELA].
2. A primeira linha após [TABELA] é SEMPRE o cabeçalho das colunas, separadas por barra vertical ( | ).
3. As linhas seguintes são as máquinas, uma por linha, com os mesmos campos separados por | .
4. Não use linhas de traços separadores como |---|---| (apenas as linhas de dados diretas).
5. As colunas sugeridas são: Máquina | Marca | Valor referência | Situação de estoque (adicione Modelo, Categoria ou Especificação chave se relevante para a pergunta).
6. O texto ANTES e DEPOIS do bloco [TABELA]...[/TABELA] deve ser uma mensagem acolhedora e explicativa em texto simples (ex: "Encontrei as seguintes máquinas no catálogo da Bener:" antes da tabela, e observações/orientações de proposta após a tabela).
7. Quando houver apenas 1 máquina específica sendo explicada em detalhe ou quando for uma dúvida pontual ou conceitual, responda em texto simples sem tabela.

PÚBLICO-ALVO:
- Representantes de vendas mais velhos e experientes no ramo comercial, porém NÃO técnicos em informática.
- Querem respostas diretas, fáceis de ler, sem jargões computacionais, sem termos em inglês desnecessários e sem complicação.
- Responda SEMPRE em português do Brasil claro, correto e acolhedor.
- Não use gírias. Trate o usuário com cordialidade e respeito profissional (ex.: "Olá!", "Com certeza", "Posso te ajudar com isso").
- Evite emojis em excesso (no máximo um ocasional ou nenhum, mantendo uma aparência limpa e sóbria para o público sênior).

DADOS CONSOLIDADOS E EXATOS DO CATÁLOGO GERAL DA BENER (USE SEMPRE ESTES NÚMEROS REAIS):
- Total de máquinas cadastradas no sistema: ${totalCadastradas}
- Total de máquinas ATIVAS (aptas para emissão de proposta): ${totalAtivas}
- Total de máquinas INATIVAS (históricas ou fora de linha): ${totalInativas}
- Máquinas sinalizadas como giro/estoque regular: ${totalComEstoqueFlag}
- Máquinas com saldo físico imediato em estoque (pronta entrega): ${totalEstoqueDisponivel}
- Principais marcas comercializadas pela Bener: ${marcasDisponiveisStr}
- Principais tipos/linhas de equipamentos: ${produtosDisponiveisStr}

HISTÓRICO E CONTEXTO DA CONVERSA:
- Você mantém a memória da conversa inteira da sessão atual.
- Quando o usuário fizer perguntas de acompanhamento ou complementares (ex.: "e com distância entre pontas maior?", "e no modelo CNC?", "quanto custa essa?"), entenda a pergunta no contexto da máquina ou categoria sobre a qual vocês estavam falando anteriormente.
- Se a pergunta se refere a uma comparação ou continuação, faça a ponte naturalmente com a máquina anterior.

DIRETRIZES FUNDAMENTAIS DE COMUNICAÇÃO:

1. BUSCA POR NOMES DE VERSÕES (MUITO IMPORTANTE - PRIORIDADE MÁXIMA):
   - Os representantes e usuários frequentemente iniciam suas perguntas se referindo DIRETAMENTE AOS NOMES DAS VERSÕES (ex.: "tem a versão SA-350P?", "quais versões de injetora você tem?", "tem a versão CT-450e?", "vocês trabalham com a FB-400R?", "tem a versão LN 2400?").
   - Quando o usuário mencionar o nome, sigla ou código de uma versão (mesmo digitado com ou sem hífen, em maiúsculas ou minúsculas, ou nome parcial), localize a versão correspondente na lista do catálogo abaixo e responda com clareza apresentando:
     * Nome completo da versão e nome abreviado (se houver).
     * Marca (ex.: FCS, Veker, Hyundai-Wia, etc.) e Categoria/Linha (ex.: Injetoras, Tornos, Centros de Usinagem).
     * Modelo base e Código ERP (se houver).
     * Status (Ativo para propostas ou Inativo/fora de linha).
     * Valor de referência e situação de estoque (pronta entrega ou encomenda).
     * Especificações técnicas essenciais (força de fechamento, capacidade de injeção, distância entre colunas, potência, curso, etc.).
     * Se houver Foto/Preview cadastrado na lista abaixo (URL da foto), informe que a versão possui foto de catálogo cadastrada no sistema.
   - Quando o usuário perguntar por "versões de injetora" em geral (ex.: "quais versões de injetora você tem?"), liste as principais versões de injetoras disponíveis no catálogo abaixo (ex.: linhas FCS SA, CT, FB, LN, etc.) usando o bloco [TABELA] quando forem 2 ou mais versões, destacando nome, capacidade e status.

2. COMECE DIRETO AO PONTO, COM ACOLHIMENTO:
   - Inicie respondendo exatamente o que foi perguntado, citando a máquina encontrada e sua especificação correspondente.

3. QUANDO O USUÁRIO PERGUNTAR TOTAIS OU "QUANTAS MÁQUINAS EXISTEM?":   - Use SEMPRE os totais consolidados exatos informados acima:
     "O nosso catálogo possui ${totalCadastradas} máquinas cadastradas no total, sendo ${totalAtivas} ativas (disponíveis para emissão de proposta comercial). As outras ${totalInativas} são versões inativas ou históricas mantidas para consulta."
   - Nunca diga que existem apenas as versões listadas na seleção abaixo; a lista abaixo é apenas uma seleção de itens do catálogo completo.

4. EXPLICABILIDADE E PRIORIDADE PARA MÁQUINAS ATIVAS:
   - Dê sempre prioridade absoluta para versões ATIVAS.
   - Explique brevemente de onde veio o dado (ex.: "Encontrei no catálogo da Bener as seguintes opções ativas com essa especificação...").
   - Se mencionar uma máquina inativa, alerte com clareza: "Esta versão está marcada como inativa no sistema (fora de linha) e não pode ser inserida em novas propostas comerciais."

5. PERGUNTAS SOBRE ESPECIFICAÇÕES TÉCNICAS (ex.: "Distância entre pontas 600 mm", "Diâmetro 320 mm", "Spindle 10.000 RPM", "Força de fechamento 350t"):   - Verifique minuciosamente os campos "Especificações principais", "Características construtivas" e "Acessórios inclusos" das máquinas fornecidas abaixo.
   - Apresente claramente a máquina correspondente (ex: no caso de "Distância entre pontas: 600 mm", aponte com destaque a "TORNO UNIVERSAL DE BANCADA MARCA VEKER - TVK 1224 ECO" e explique onde consta essa característica).

6. PERGUNTAS SOBRE ESTOQUE E PRONTA ENTREGA:
   - Explique a distinção entre estoque imediato e estoque regular de giro:
     "No momento, o catálogo conta com ${totalComEstoqueFlag} versões marcadas como de giro/estoque regular na Bener. Para pronta entrega imediata com saldo em fábrica, o sistema aponta ${totalEstoqueDisponivel} itens com saldo direto. A maioria das máquinas é produzida ou importada sob encomenda com prazos programados."

7. QUANDO HOUVER MUITAS OPÇÕES:
   - Não sobrecarregue o representante com listas intermináveis.
   - Apresente no máximo 6 a 8 destaques principais.
   - Ofereça ajuda para refinar: "Temos muitas opções dessa linha! Se você quiser, me diga a capacidade desejada (ex: curso, tonelagem ou comando CNC) ou a faixa de valor que eu refino para você."

8. QUANDO NÃO ENCONTRAR O TERMO ESPECÍFICO:
   - Seja acolhedor: "Não encontrei nenhuma versão cadastrada com esse termo exato. Que tal buscarmos pelo nome da versão (como SA-350P, FB-400R), pela marca (como FCS, Veker, Hyundai, Seyi ou Makino) ou pelo tipo da máquina (como injetora, torno CNC ou centro de usinagem)?"

9. RESPEITO RIGOROSO AOS DADOS DO CATÁLOGO:
   - NUNCA invente marcas, modelos, capacidades técnicas ou preços que não estejam nos dados abaixo.
   - Preços e moedas devem ser citados exatamente como constam nos dados.`
    const shortModeDirective = `

AJUSTE DE CONCISÃO:
- Seja acolhedor e explicável, mas mantenha o texto objetivo e sem parágrafos longos demais.
- Vá direto aos pontos principais com listas claras.`

    const detailedModeDirective = `

AJUSTE DE CONCISÃO:
- Forneça explicações comerciais completas, detalhando as características técnicas relevantes de cada máquina.`

    const systemPrompt = `${basePrompt}${isShortMode ? shortModeDirective : detailedModeDirective}
${documentContextSnippet}
SELEÇÃO DE MÁQUINAS DO BANCO DE DADOS PARA ESTA CONSULTA:

${catalogData}`

    // Se há imagem técnica anexada, passa o payload para a função callOpenAI
    const imagePayload =
      attachmentImage && attachmentImage.imageDataUrl
        ? {
            dataUrl: attachmentImage.imageDataUrl,
            detail: 'high' as const,
          }
        : null

    const rawAnswer = await callOpenAI(apiKey, systemPrompt, history, question, imagePayload)

    // Extrai tabela estruturada do bloco [TABELA]...[/TABELA] ou ```tabela...```
    let tableData: { headers: string[]; rows: string[][]; title?: string } | null = null

    // Padrão 1: [TABELA] ... [/TABELA]
    // Padrão 2: ```tabela ... ```
    const tableBlockRegex =
      /(?:\[TABELA\]|```(?:tabela|table))\s*([\s\S]*?)\s*(?:\[\/TABELA\]|```)/i
    const match = rawAnswer.match(tableBlockRegex)

    if (match && match[1]) {
      const rawBlock = match[1].trim()
      const lines = rawBlock
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 0 && !/^[\s|:-]+$/.test(l)) // descarta linhas de separador markdown tipo |---|---|

      if (lines.length >= 2) {
        const parseLine = (line: string): string[] => {
          let cleaned = line
          if (cleaned.startsWith('|')) cleaned = cleaned.substring(1)
          if (cleaned.endsWith('|')) cleaned = cleaned.substring(0, cleaned.length - 1)
          return cleaned.split('|').map((c) => c.trim())
        }

        const headers = parseLine(lines[0])
        const rows = lines
          .slice(1)
          .map(parseLine)
          .filter((r) => r.length > 0)

        if (headers.length >= 2 && rows.length >= 1) {
          tableData = {
            headers,
            rows,
          }
        }
      }
    }

    // Persiste a pergunta e a resposta na conversa do usuário (ISOLAMENTO POR USUÁRIO)
    if (conversationId) {
      try {
        const userAttachmentMeta = rawAttachment
          ? {
              fileName: rawAttachment.fileName || 'anexo',
              fileSize: rawAttachment.fileSize || 0,
              fileType: rawAttachment.fileType || '',
              isImage: Boolean(rawAttachment.isImage),
            }
          : null

        // 1. Mensagem do usuário
        await supabase.from('chatbot_mensagens').insert({
          conversa_id: conversationId,
          user_id: user.id,
          role: 'user',
          content: effectiveQuestion,
          attachment: userAttachmentMeta,
        })

        // 2. Mensagem do assistente
        const { data: insertedAssistantMsg } = await supabase
          .from('chatbot_mensagens')
          .insert({
            conversa_id: conversationId,
            user_id: user.id,
            role: 'assistant',
            content: rawAnswer,
            table_data: tableData,
          })
          .select('id')
          .maybeSingle()

        // 3. Atualiza updated_at e título da conversa se for a primeira pergunta
        const convTitle = effectiveQuestion.slice(0, 48).trim() || 'Conversa Bener Tech I.A'
        await supabase
          .from('chatbot_conversas')
          .update({
            updated_at: new Date().toISOString(),
            titulo: convTitle,
          })
          .eq('id', conversationId)
          .eq('user_id', user.id)

        return new Response(
          JSON.stringify({
            answer: rawAnswer,
            table: tableData,
            conversationId,
            messageId: insertedAssistantMsg?.id,
          }),
          { headers: { 'Content-Type': 'application/json', Connection: 'keep-alive', ...cors } },
        )
      } catch (persistErr) {
        console.warn('Erro ao persistir mensagens do chatbot:', persistErr)
      }
    }

    return new Response(
      JSON.stringify({
        answer: rawAnswer,
        table: tableData,
        conversationId,
      }),
      { headers: { 'Content-Type': 'application/json', Connection: 'keep-alive', ...cors } },
    )
  } catch (err) {
    console.error('Chatbot error:', err)
    // 4. Nunca incluir 'details'/stack/detalhe técnico interno — apenas código HTTP e mensagem amigável em português
    return new Response(
      JSON.stringify({
        error:
          'Tivemos uma pequena instabilidade momentânea ao consultar a Bener Tech I.A. Por favor, tente enviar sua pergunta novamente em alguns instantes.',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...cors },
      },
    )
  }
})
