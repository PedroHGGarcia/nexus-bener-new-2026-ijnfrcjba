import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { getCorsHeaders } from '../_shared/cors.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'

const BACKOFF_DELAYS = [1500, 3000]
const OPENAI_MODEL = 'gpt-6-luna'
const OPENAI_URL = 'https://api.openai.com/v1/chat/completions'

export interface TipoPropostaItem {
  id: string
  nome: string
  comissao?: number | null
  imposto_ipi?: number | null
  imposto_icms?: number | null
  frase_preco?: string | null
  frase_comissao?: string | null
  prazo_entrega?: string | null
  condicoes_pagamento?: string | null
  garantia?: string | null
  assistencia_tecnica?: string | null
  transporte_seguro?: string | null
  fator_nacionalizacao?: number | null
  aplicar_fator_nac?: boolean | null
}

export interface AcessorioItem {
  id: string
  nome: string
  tipo?: string | null
  moeda?: string | null
  valor?: number | null
  fator_nac?: number | null
  especificacoes_tecnicas?: string | null
  status?: string | null
}

export interface VersaoFullRow {
  id: string
  nome: string
  nome_abreviado: string | null
  descricao_completa?: string | null
  cod_erp: string | null
  imagem_preview: string | null
  moeda: string
  valor: number
  valor_anterior?: number | null
  data_ultimo_reajuste?: string | null
  condicoes?: string | null
  tem_fator: boolean
  fator_nac: number
  impostos?: number | null
  desconto_max_representante?: number | null
  desconto_max_bener?: number | null
  tem_estoque: boolean
  estoque_total: number
  estoque_bloqueado: number
  estoque_reservado: number
  estoque_disponivel: number
  alerta_estoque_minimo: number | null
  tipo_fornecimento?: string | null
  acessorios_standards: string | null
  caracteristicas_construtivas: string | null
  especificacoes_tecnicas: string | null
  status: string
  categoria_id?: string | null
  tipos_proposta?: string[] | null
  categorias?: { id: string; nome: string } | null
  modelos?: {
    id: string
    nome: string
    marcas?: { id: string; nome: string } | null
    produtos?: {
      id: string
      nome: string
      categorias?: { id: string; nome: string } | null
    } | null
  } | null
  // Coleções enriquecidas em runtime
  tipos_proposta_relacionados?: TipoPropostaItem[]
  acessorios_opcionais?: AcessorioItem[]
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
const RATE_LIMIT_MAX = 30
const RATE_LIMIT_WINDOW_MS = 60 * 1000
const rateLimitMap = new Map<string, number[]>()

function checkRateLimit(userId: string): boolean {
  const now = Date.now()
  const timestamps = rateLimitMap.get(userId) ?? []
  const recent = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS)
  if (recent.length >= RATE_LIMIT_MAX) {
    rateLimitMap.set(userId, recent)
    return false
  }
  recent.push(now)
  rateLimitMap.set(userId, recent)

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

function extractVersionNameVariants(text: string): string[] {
  const variants = new Set<string>()
  const clean = removeAccents(text.toLowerCase())

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

  const mixedMatches = Array.from(clean.matchAll(/\b([a-z]{1,4})(\d{2,5})\b/gi))
  for (const m of mixedMatches) {
    variants.add(m[0])
    variants.add(`${m[1]}-${m[2]}`)
    variants.add(`${m[1]} ${m[2]}`)
  }

  const isolatedNumbers = Array.from(clean.matchAll(/\b(\d{3,5})\b/g))
  for (const num of isolatedNumbers) {
    variants.add(num[1])
  }

  return Array.from(variants).filter((v) => v.length >= 2)
}

function sanitizeTechnicalText(text: string | null | undefined): string {
  if (!text || text.trim() === '') return 'Não informado no cadastro'
  let clean = text.replace(
    /<img[^>]*src=["']data:image\/[^"']+["'][^>]*>/gi,
    '[Imagem de Especificações no Cadastro]',
  )
  clean = clean.replace(
    /data:image\/[a-zA-Z0-9+.-]+;base64,[A-Za-z0-9+/=]+/gi,
    '[Imagem base64 omitida]',
  )

  clean = clean
    .split('•')
    .map((part) => part.trim().replace(/[ \t]+/g, ' '))
    .filter((part) => part.length > 0)
    .join('\n  • ')

  if (clean.length === 0) return 'Não informado no cadastro'
  return `\n  • ${clean}`
}

function truncateText(text: string | null | undefined, maxChars = 800): string {
  if (!text || text.trim() === '') return 'Não informado no cadastro'
  const trimmed = text.trim().replace(/\s+/g, ' ')
  if (trimmed.length <= maxChars) return trimmed
  return trimmed.substring(0, maxChars) + '…'
}

function formatCurrency(val: number | null | undefined, moeda = 'BRL'): string {
  if (val === null || val === undefined || val === 0) return 'Não preenchido no cadastro'
  return `${moeda} ${Number(val).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatPercent(val: number | null | undefined): string {
  if (val === null || val === undefined) return 'Não informado no cadastro'
  return `${Number(val).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}%`
}

function formatCatalog(
  versoes: VersaoFullRow[],
  isGenericQuestion: boolean,
  isSpecificVersionQuery = false,
): string {
  if (versoes.length === 0) {
    return 'Nenhuma máquina específica encontrada no catálogo para a busca realizada. Peça termos adicionais de identificação ao representante (como nome exato da versão, modelo, marca ou código ERP).'
  }

  const header = isGenericQuestion
    ? `AMOSTRA DO CATÁLOGO DE MÁQUINAS (${versoes.length} itens):`
    : `MÁQUINAS LOCALIZADAS NO BANCO DE DADOS (${versoes.length} itens com cadastro completo):`

  // Para consultas específicas ou poucos itens, todas as máquinas recebem especificações integrais sem corte
  const fullSpecsLimit = isSpecificVersionQuery ? 15 : versoes.length <= 6 ? versoes.length : 3

  const items = versoes
    .map((v, i) => {
      const isTopMatch = i < fullSpecsLimit
      const specs = isTopMatch
        ? sanitizeTechnicalText(v.especificacoes_tecnicas)
        : truncateText(v.especificacoes_tecnicas, 1200)

      const constru = isTopMatch
        ? v.caracteristicas_construtivas?.trim() || 'Não informado no cadastro'
        : truncateText(v.caracteristicas_construtivas, 500)

      const acessoriosStandards = isTopMatch
        ? v.acessorios_standards?.trim() || 'Não informado no cadastro'
        : truncateText(v.acessorios_standards, 400)

      const marca = v.modelos?.marcas?.nome ?? 'Não informada no cadastro'
      const modeloBase = v.modelos?.nome ?? 'Não informado no cadastro'
      const produto = v.modelos?.produtos?.nome ?? 'Não informado no cadastro'
      const categoria =
        v.categorias?.nome ?? v.modelos?.produtos?.categorias?.nome ?? 'Não informada no cadastro'
      const nomeAbrev = v.nome_abreviado ? ` (Abreviado: ${v.nome_abreviado})` : ''
      const codErp = v.cod_erp?.trim() ? v.cod_erp.trim() : 'Não preenchido no cadastro'
      const descricaoCompleta = v.descricao_completa?.trim()
        ? v.descricao_completa.trim()
        : 'Não preenchida no cadastro'

      const statusLabel =
        v.status === 'Ativo' || v.status === 'A'
          ? 'Ativo (disponível para propostas)'
          : `Inativo / ${v.status} (fora de linha)`

      // Comercial
      const precoFmt =
        v.valor > 0 ? formatCurrency(v.valor, v.moeda) : 'Não preenchido / Sob consulta comercial'
      const valorAnteriorFmt =
        v.valor_anterior && v.valor_anterior > 0
          ? formatCurrency(v.valor_anterior, v.moeda)
          : 'Não informado no cadastro'
      const dataReajusteFmt = v.data_ultimo_reajuste
        ? new Date(v.data_ultimo_reajuste).toLocaleDateString('pt-BR')
        : 'Não informada no cadastro'

      const fatorNacFmt = v.tem_fator
        ? `${Number(v.fator_nac || 1).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })} (aplica fator: Sim)`
        : 'Não aplica fator de nacionalização (Não)'

      const condicoesFmt = v.condicoes?.trim() ? v.condicoes.trim() : 'Não informado no cadastro'
      const impostosFmt =
        v.impostos !== null && v.impostos !== undefined
          ? formatPercent(v.impostos)
          : 'Não informado no cadastro'
      const descRepFmt =
        v.desconto_max_representante !== null && v.desconto_max_representante !== undefined
          ? formatPercent(v.desconto_max_representante)
          : 'Não informado no cadastro'
      const descBenerFmt =
        v.desconto_max_bener !== null && v.desconto_max_bener !== undefined
          ? formatPercent(v.desconto_max_bener)
          : 'Não informado no cadastro'
      const tipoFornecimentoFmt = v.tipo_fornecimento?.trim()
        ? v.tipo_fornecimento.trim()
        : 'Não informado no cadastro'

      // Estoque
      const estoqueFmt =
        v.estoque_disponivel > 0
          ? `${v.estoque_disponivel} un. disponível(is) para pronta entrega (Total: ${v.estoque_total}, Reservado: ${v.estoque_reservado}, Bloqueado: ${v.estoque_bloqueado})`
          : v.tem_estoque
            ? 'Item de giro/estoque regular (verificar saldo/embarque com a fábrica)'
            : 'Sob encomenda / produção sob demanda'

      // Tipos de Proposta Vinculados
      let tiposPropostaFmt = 'Nenhum tipo de proposta vinculado no cadastro desta máquina'
      if (v.tipos_proposta_relacionados && v.tipos_proposta_relacionados.length > 0) {
        tiposPropostaFmt = v.tipos_proposta_relacionados
          .map((tp, idx) => {
            const comissao =
              tp.comissao !== null && tp.comissao !== undefined
                ? formatPercent(tp.comissao)
                : 'Não informada no cadastro'
            const ipi =
              tp.imposto_ipi !== null && tp.imposto_ipi !== undefined
                ? formatPercent(tp.imposto_ipi)
                : 'Não informado no cadastro'
            const icms =
              tp.imposto_icms !== null && tp.imposto_icms !== undefined
                ? formatPercent(tp.imposto_icms)
                : 'Não informado no cadastro'
            const frasePreco = tp.frase_preco?.trim()
              ? tp.frase_preco.trim()
              : 'Não informada no cadastro'
            const fraseComissao = tp.frase_comissao?.trim()
              ? tp.frase_comissao.trim()
              : 'Não informada no cadastro'
            const frete = tp.transporte_seguro?.trim()
              ? tp.transporte_seguro.trim()
              : 'Não informado no cadastro'
            const prazo = tp.prazo_entrega?.trim()
              ? tp.prazo_entrega.trim()
              : 'Não informado no cadastro'
            const condPgto = tp.condicoes_pagamento?.trim()
              ? tp.condicoes_pagamento.trim()
              : 'Não informado no cadastro'
            const garantia = tp.garantia?.trim() ? tp.garantia.trim() : 'Não informada no cadastro'

            return `  ${idx + 1}. Tipo: "${tp.nome}"
     - Comissão configurada: ${comissao}
     - IPI: ${ipi}
     - ICMS: ${icms}
     - Frase do Preço: ${frasePreco}
     - Frase da Comissão: ${fraseComissao}
     - Condições de Frete / Logística / Seguro: ${frete}
     - Prazo de Entrega: ${prazo}
     - Condições de Pagamento: ${condPgto}
     - Garantia: ${garantia}`
          })
          .join('\n')
      }

      // Acessórios / Opcionais Vinculados
      let acessoriosOpcionaisFmt = 'Nenhum acessório/opcional cadastrado para esta versão'
      if (v.acessorios_opcionais && v.acessorios_opcionais.length > 0) {
        acessoriosOpcionaisFmt = v.acessorios_opcionais
          .map((ac, idx) => {
            const val =
              ac.valor !== null && ac.valor !== undefined
                ? formatCurrency(ac.valor, ac.moeda || 'USD')
                : 'Valor não informado no cadastro'
            const tipo = ac.tipo ? ` (${ac.tipo})` : ''
            const specsAc = ac.especificacoes_tecnicas?.trim()
              ? ` - Specs: ${ac.especificacoes_tecnicas.trim()}`
              : ''
            return `  ${idx + 1}. ${ac.nome}${tipo} — Preço cadastrado: ${val}${specsAc}`
          })
          .join('\n')
      }

      const fotoFmt =
        v.imagem_preview && v.imagem_preview.trim() !== ''
          ? v.imagem_preview
          : 'Sem foto cadastrada'

      return `[MÁQUINA ${i + 1}]
- Nome da Versão: ${v.nome}${nomeAbrev}
- Código ERP: ${codErp}
- Marca: ${marca}
- Modelo base: ${modeloBase}
- Linha / Subcategoria: ${produto}
- Categoria principal do Catálogo: ${categoria}
- Descrição Completa: ${descricaoCompleta}
- Status: ${statusLabel}
- Tipo de Fornecimento: ${tipoFornecimentoFmt}

[COMERCIAL & PREÇO BASE]
- Valor referência: ${precoFmt}
- Moeda: ${v.moeda}
- Condições comerciais: ${condicoesFmt}
- Fator de nacionalização: ${fatorNacFmt}
- Impostos da versão: ${impostosFmt}
- Desconto máximo representante: ${descRepFmt}
- Desconto máximo Bener: ${descBenerFmt}
- Último reajuste de preço: ${dataReajusteFmt} (Valor anterior: ${valorAnteriorFmt})
- Situação de estoque: ${estoqueFmt}
- Foto/Preview de catálogo: ${fotoFmt}

[TIPOS DE PROPOSTA VINCULADOS (COMISSÃO, IMPOSTOS E LOGÍSTICA)]
${tiposPropostaFmt}

[ACESSÓRIOS E OPCIONAIS COM VALORES CADASTRADOS]
${acessoriosOpcionaisFmt}

[ACESSÓRIOS STANDARDS INCLUSOS NO FORNECIMENTO BASE]
  ${acessoriosStandards}

[CARACTERÍSTICAS CONSTRUTIVAS]
  ${constru}

[ESPECIFICAÇÕES TÉCNICAS COMPLETAS]
${specs}`
    })
    .join('\n\n========================================\n\n')

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

  const apiMessages: OpenAiMessage[] = [{ role: 'system', content: systemPrompt }]

  for (const m of messagesHistory) {
    if (m.role === 'user' || m.role === 'assistant') {
      const cleanContent = m.content?.trim()
      if (cleanContent) {
        apiMessages.push({ role: m.role, content: cleanContent })
      }
    }
  }

  const trimmedQuestion = currentQuestion.trim()

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
          max_completion_tokens: 2200,
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

    // Cliente com permissão de service role para leitura de todo o catálogo (APENAS SELECTs)
    const supabase = createClient(supabaseUrl, serviceRoleKey)

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

    // Ação: Iniciar nova conversa
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

    // Ação: Carregar histórico de mensagens da conversa
    if (action === 'get_conversation_messages') {
      const convId = body?.conversationId
      if (!convId) {
        return new Response(JSON.stringify({ error: 'conversationId não informado.' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...cors },
        })
      }

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

    // Admin: Listar usuários com contagem de conversas
    if (action === 'admin_list_users') {
      const isAdmin = await checkUserIsAdmin(user.id)
      if (!isAdmin) {
        return new Response(
          JSON.stringify({ error: 'Acesso restrito a administradores do sistema.' }),
          { status: 403, headers: { 'Content-Type': 'application/json', ...cors } },
        )
      }

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

    // Admin: Abrir histórico da conversa de um usuário (apenas leitura + auditoria)
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

      const { data: targetProfile } = await supabase
        .from('profiles')
        .select('email, name')
        .eq('id', targetUserId)
        .maybeSingle()

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

    // 5. Rate limit por usuário autenticado
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

    // 3. Validação da pergunta e anexos
    const rawQuestion =
      typeof (body?.question ?? body?.pergunta) === 'string'
        ? (body?.question ?? body?.pergunta).trim()
        : ''

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

    const effectiveQuestion =
      rawQuestion ||
      (attachmentImage
        ? 'Por favor, analise as especificações técnicas contidas nesta imagem e identifique no catálogo da Bener as máquinas compatíveis ou correspondentes.'
        : 'Por favor, leia o documento anexado e resuma suas principais informações técnicas ou comerciais relacionadas às máquinas.')

    const question =
      effectiveQuestion.length > 4000 ? effectiveQuestion.substring(0, 4000) : effectiveQuestion

    const rawHistory = Array.isArray(body?.history ?? body?.messages)
      ? (body.history ?? body.messages)
      : []

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

    // Conversa ativa do usuário
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

    // Estatísticas globais do catálogo
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
      supabase
        .from('marcas')
        .select('id, nome')
        .is('deleted_at', null)
        .neq('status', 'Em Quarentena')
        .order('nome'),
      supabase
        .from('produtos')
        .select('id, nome, categoria')
        .is('deleted_at', null)
        .neq('status', 'Em Quarentena')
        .order('nome'),
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

    const documentContextSnippet =
      attachmentDoc && attachmentDoc.content
        ? `\n\n--- DOCUMENTO ANEXADO PELO USUÁRIO (${attachmentDoc.fileName}) ---\n${attachmentDoc.content.slice(0, 25000)}${attachmentDoc.content.length > 25000 ? '\n[... restante do documento truncado para respeitar limites de contexto ...]' : ''}\n--- FIM DO DOCUMENTO ANEXADO ---\n`
        : ''

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
      const singular = nomeNoAccents.endsWith('s') ? nomeNoAccents.slice(0, -1) : nomeNoAccents
      return (
        lowerQuestion.includes(nomeLower) ||
        cleanQuestionNoAccents.includes(nomeNoAccents) ||
        cleanQuestionNoAccents.includes(singular)
      )
    })

    const versionNameVariants = extractVersionNameVariants(combinedSearchText)
    const numberMatches = Array.from(question.matchAll(/\b(\d{2,6})\b/g)).map((m) => m[1])

    const isGenericQuestion =
      keywords.length === 0 &&
      versionNameVariants.length === 0 &&
      matchedMarcas.length === 0 &&
      matchedProdutos.length === 0 &&
      matchedCategorias.length === 0 &&
      numberMatches.length === 0

    // Campos completos da versão conforme Requisito 1 do Ponto 21
    const selectFields =
      'id, nome, nome_abreviado, descricao_completa, cod_erp, imagem_preview, moeda, valor, valor_anterior, data_ultimo_reajuste, condicoes, tem_fator, fator_nac, impostos, desconto_max_representante, desconto_max_bener, tem_estoque, estoque_total, estoque_bloqueado, estoque_reservado, estoque_disponivel, alerta_estoque_minimo, tipo_fornecimento, acessorios_standards, caracteristicas_construtivas, especificacoes_tecnicas, status, categoria_id, tipos_proposta, categorias:categoria_id(id, nome), modelos(id, nome, marcas:marca(id, nome), produtos:produto(id, nome, categorias:categoria(id, nome)))'

    let matchedVersoesRaw: VersaoFullRow[] = []

    if (isGenericQuestion) {
      const { data } = await supabase
        .from('versoes')
        .select(selectFields)
        .is('deleted_at', null)
        .neq('status', 'Em Quarentena')
        .or('status.eq.Ativo,status.eq.A')
        .order('nome', { ascending: true })
        .limit(30)

      matchedVersoesRaw = (data as unknown as VersaoFullRow[]) ?? []
    } else {
      const rowsMap = new Map<string, VersaoFullRow>()

      // 0) BUSCA DIRETA E TOLERANTE PELO NOME DA VERSÃO E CÓDIGO ERP
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

          for (const v of (variantMatches as unknown as VersaoFullRow[]) ?? []) {
            rowsMap.set(v.id, v)
          }
        }
      }

      // 1) Busca direta por palavras da pergunta (inclui cod_erp e modelo)
      if (keywords.length > 0) {
        for (const kw of keywords.slice(0, 4)) {
          if (kw.length < 2) continue
          const { data: directMatches } = await supabase
            .from('versoes')
            .select(selectFields)
            .is('deleted_at', null)
            .neq('status', 'Em Quarentena')
            .or(`nome.ilike.%${kw}%,nome_abreviado.ilike.%${kw}%,cod_erp.ilike.%${kw}%`)
            .order('status', { ascending: true })
            .limit(30)

          for (const v of (directMatches as unknown as VersaoFullRow[]) ?? []) {
            rowsMap.set(v.id, v)
          }
        }
      }

      // 2) Busca por modelos cuja descrição/nome case com as keywords
      if (rowsMap.size < 40 && keywords.length > 0) {
        for (const kw of keywords.slice(0, 3)) {
          if (kw.length < 3) continue
          const { data: modMatches } = await supabase
            .from('modelos')
            .select('id')
            .ilike('nome', `%${kw}%`)
            .is('deleted_at', null)
            .limit(15)

          const modIds = (modMatches ?? []).map((m) => m.id)
          if (modIds.length > 0) {
            const { data: versoesMod } = await supabase
              .from('versoes')
              .select(selectFields)
              .in('modelo', modIds)
              .is('deleted_at', null)
              .neq('status', 'Em Quarentena')
              .limit(30)

            for (const v of (versoesMod as unknown as VersaoFullRow[]) ?? []) {
              rowsMap.set(v.id, v)
            }
          }
        }
      }

      // 3) Busca por categoria
      if (matchedCategorias.length > 0) {
        for (const cat of matchedCategorias.slice(0, 2)) {
          const prodsNaCat = produtosList.filter((p) => p.categoria === cat.id)
          let resolvedProdIds = prodsNaCat.map((p) => p.id)
          if (resolvedProdIds.length === 0) {
            const { data: dbProds } = await supabase
              .from('produtos')
              .select('id')
              .eq('categoria', cat.id)
              .is('deleted_at', null)
            resolvedProdIds = (dbProds ?? []).map((p) => p.id)
          }

          const { data: versoesDiretasCat } = await supabase
            .from('versoes')
            .select(selectFields)
            .is('deleted_at', null)
            .neq('status', 'Em Quarentena')
            .eq('categoria_id', cat.id)
            .order('status', { ascending: true })
            .limit(40)

          for (const v of (versoesDiretasCat as unknown as VersaoFullRow[]) ?? []) {
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
                .limit(40)

              for (const v of (versoesCat as unknown as VersaoFullRow[]) ?? []) {
                rowsMap.set(v.id, v)
              }
            }
          }

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

            for (const v of (injetorasPorNome as unknown as VersaoFullRow[]) ?? []) {
              rowsMap.set(v.id, v)
            }
          }
        }
      }

      // Se a pergunta cita injetora
      if (cleanQuestionNoAccents.includes('injetor') && rowsMap.size < 40) {
        const { data: directInjetoras } = await supabase
          .from('versoes')
          .select(selectFields)
          .is('deleted_at', null)
          .neq('status', 'Em Quarentena')
          .or('nome.ilike.%injetor%,nome_abreviado.ilike.%injetor%')
          .order('status', { ascending: true })
          .limit(40)

        for (const v of (directInjetoras as unknown as VersaoFullRow[]) ?? []) {
          rowsMap.set(v.id, v)
        }
      }

      // 4) Busca técnica por números e medidas
      if (numberMatches.length > 0) {
        for (const num of numberMatches.slice(0, 2)) {
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
            for (const tech of foundTechTerms) {
              const { data: techMatches } = await supabase
                .from('versoes')
                .select(selectFields)
                .is('deleted_at', null)
                .neq('status', 'Em Quarentena')
                .ilike('especificacoes_tecnicas', `%${tech}%`)
                .ilike('especificacoes_tecnicas', `%${num}%`)
                .order('status', { ascending: true })
                .limit(40)

              for (const v of (techMatches as unknown as VersaoFullRow[]) ?? []) {
                rowsMap.set(v.id, v)
              }
            }
          }

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

            for (const v of (numData as unknown as VersaoFullRow[]) ?? []) {
              rowsMap.set(v.id, v)
            }
          }
        }
      }

      // 5) Marca específica
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
              .limit(35)

            for (const v of (versoesMarca as unknown as VersaoFullRow[]) ?? []) {
              rowsMap.set(v.id, v)
            }
          }
        }
      }

      // 6) Produto/Linha específica
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
              .limit(35)

            for (const v of (versoesProd as unknown as VersaoFullRow[]) ?? []) {
              rowsMap.set(v.id, v)
            }
          }
        }
      }

      // 7) Especificações gerais por palavras-chave
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

          for (const v of (keywordMatches as unknown as VersaoFullRow[]) ?? []) {
            rowsMap.set(v.id, v)
          }
        }
      }

      // 8) Estoque
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

        for (const v of (estoqueMatches as unknown as VersaoFullRow[]) ?? []) {
          rowsMap.set(v.id, v)
        }
      }

      // Ordenação: variante exata no topo, depois Ativos, depois matches numéricos
      const sortedVersoes = Array.from(rowsMap.values()).sort((a, b) => {
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

        const aActive = a.status === 'Ativo' || a.status === 'A'
        const bActive = b.status === 'Ativo' || b.status === 'A'
        if (aActive !== bActive) return aActive ? -1 : 1

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

      matchedVersoesRaw = sortedVersoes.slice(0, 30)

      // Fallback: se nenhum termo casou
      if (matchedVersoesRaw.length === 0) {
        const { data: fallbackData } = await supabase
          .from('versoes')
          .select(selectFields)
          .is('deleted_at', null)
          .neq('status', 'Em Quarentena')
          .or('status.eq.Ativo,status.eq.A')
          .order('nome', { ascending: true })
          .limit(25)

        matchedVersoesRaw = (fallbackData as unknown as VersaoFullRow[]) ?? []
      }
    }

    // =========================================================================
    // REQUISITO 1 & 2 DO PONTO 21: ENRIQUECIMENTO COMPLETO COM COLEÇÕES RELACIONADAS
    // 1. Tipos de Proposta Vinculados (versao_tipos_proposta + tipos_proposta por nome/json)
    // 2. Acessórios e Opcionais (acessorio_versoes + acessorios com array de versoes)
    // =========================================================================
    const versaoIds = matchedVersoesRaw.map((v) => v.id)
    const versaoMap = new Map<string, VersaoFullRow>()
    for (const v of matchedVersoesRaw) {
      v.tipos_proposta_relacionados = []
      v.acessorios_opcionais = []
      versaoMap.set(v.id, v)
    }

    if (versaoIds.length > 0) {
      // 1A. Busca relações versao_tipos_proposta (N:N estruturada)
      const { data: vtpData } = await supabase
        .from('versao_tipos_proposta')
        .select(
          'versao_id, tipos_proposta(id, nome, comissao, imposto_ipi, imposto_icms, frase_preco, frase_comissao, prazo_entrega, condicoes_pagamento, garantia, assistencia_tecnica, transporte_seguro, fator_nacionalizacao, aplicar_fator_nac)',
        )
        .in('versao_id', versaoIds)

      for (const row of vtpData ?? []) {
        const v = versaoMap.get(row.versao_id)
        if (v && row.tipos_proposta) {
          const tp = row.tipos_proposta as unknown as TipoPropostaItem
          if (!v.tipos_proposta_relacionados!.some((item) => item.id === tp.id)) {
            v.tipos_proposta_relacionados!.push(tp)
          }
        }
      }

      // 1B. Para compatibilidade com versões cujo tipos_proposta está gravado em jsonb (array de nomes)
      const missingTpVersoes = matchedVersoesRaw.filter(
        (v) =>
          (!v.tipos_proposta_relacionados || v.tipos_proposta_relacionados.length === 0) &&
          Array.isArray(v.tipos_proposta) &&
          v.tipos_proposta.length > 0,
      )

      if (missingTpVersoes.length > 0) {
        const allNamesToFetch = new Set<string>()
        for (const mv of missingTpVersoes) {
          for (const name of mv.tipos_proposta ?? []) {
            if (typeof name === 'string' && name.trim()) allNamesToFetch.add(name.trim())
          }
        }

        if (allNamesToFetch.size > 0) {
          const { data: tpByNames } = await supabase
            .from('tipos_proposta')
            .select(
              'id, nome, comissao, imposto_ipi, imposto_icms, frase_preco, frase_comissao, prazo_entrega, condicoes_pagamento, garantia, assistencia_tecnica, transporte_seguro, fator_nacionalizacao, aplicar_fator_nac',
            )
            .in('nome', Array.from(allNamesToFetch))
            .is('deleted_at', null)

          const tpByNameMap = new Map<string, TipoPropostaItem>()
          for (const item of (tpByNames as unknown as TipoPropostaItem[]) ?? []) {
            tpByNameMap.set(item.nome.trim(), item)
          }

          for (const mv of missingTpVersoes) {
            for (const name of mv.tipos_proposta ?? []) {
              const item = tpByNameMap.get(name.trim())
              if (item && !mv.tipos_proposta_relacionados!.some((x) => x.id === item.id)) {
                mv.tipos_proposta_relacionados!.push(item)
              }
            }
          }
        }
      }

      // 2A. Busca relações acessorio_versoes (N:N estruturada)
      const { data: avData } = await supabase
        .from('acessorio_versoes')
        .select(
          'versao_id, acessorios(id, nome, tipo, moeda, valor, fator_nac, especificacoes_tecnicas, status)',
        )
        .in('versao_id', versaoIds)

      for (const row of avData ?? []) {
        const v = versaoMap.get(row.versao_id)
        if (v && row.acessorios) {
          const ac = row.acessorios as unknown as AcessorioItem
          if (!v.acessorios_opcionais!.some((item) => item.id === ac.id)) {
            v.acessorios_opcionais!.push(ac)
          }
        }
      }

      // 2B. Para compatibilidade com acessórios vinculados via array jsonb `versoes` na tabela acessorios
      const { data: acArrayMatches } = await supabase
        .from('acessorios')
        .select('id, nome, tipo, moeda, valor, fator_nac, especificacoes_tecnicas, status, versoes')
        .is('deleted_at', null)
        .neq('status', 'Inativo')
        .limit(200)

      for (const acRow of acArrayMatches ?? []) {
        if (Array.isArray(acRow.versoes)) {
          for (const vid of acRow.versoes) {
            const v = versaoMap.get(vid)
            if (v) {
              const acItem: AcessorioItem = {
                id: acRow.id,
                nome: acRow.nome,
                tipo: acRow.tipo,
                moeda: acRow.moeda,
                valor: acRow.valor,
                fator_nac: acRow.fator_nac,
                especificacoes_tecnicas: acRow.especificacoes_tecnicas,
                status: acRow.status,
              }
              if (!v.acessorios_opcionais!.some((item) => item.id === acItem.id)) {
                v.acessorios_opcionais!.push(acItem)
              }
            }
          }
        }
      }
    }

    const matchedVersoes = Array.from(versaoMap.values())

    // Preferências de estilo
    const { data: prefRows } = await supabase
      .from('preferencias')
      .select('valor')
      .eq('chave', 'chatbot_estilo_resposta')
      .limit(1)

    const prefValor = prefRows?.[0]?.valor as { estilo?: string } | null
    const estilo = prefValor?.estilo || ''
    const isShortMode = estilo !== 'detalhado'

    const isSpecificVersionQuery =
      versionNameVariants.length > 0 ||
      (keywords.length > 0 && !isGenericQuestion && matchedVersoes.length <= 8)

    // Montagem do prompt do LLM
    const catalogData = formatCatalog(matchedVersoes, isGenericQuestion, isSpecificVersionQuery)
    const marcasDisponiveisStr = marcasList.map((m) => m.nome).join(', ')
    const produtosDisponiveisStr = produtosList
      .slice(0, 30)
      .map((p) => p.nome)
      .join(', ')

    const basePrompt = `Você é a Bener Tech I.A, assistente virtual inteligente do catálogo da Bener Máquinas, prestativa, acolhedora e focada no dia a dia dos representantes comerciais. Ao se apresentar ou responder sobre sua identidade, apresente-se como Bener Tech I.A.

DIRETRIZES DE FIDELIDADE, RASTREABILIDADE E RECUPERAÇÃO (REQUISITOS DO PONTO 21):
1. FIDELIDADE ABSOLUTA AOS DADOS REAIS:
   - Responda SEMPRE com os valores EXATOS informados no cadastro fornecido abaixo.
   - NUNCA invente, deduza lacunas, arredonde números ou faça estimativas fictícias de preços, especificações, impostos, comissões ou acessórios.
   - Se uma informação foi cadastrada com valor 0, null ou não informada, NUNCA invente um número substituto.

2. TRATAMENTO DE CAMPOS VAZIOS / NÃO PREENCHIDOS:
   - Se a informação solicitada pelo usuário (ex: um acessório específico, comissão de um tipo de proposta, IPI/ICMS, torque de spindle, curso específico, código ERP) NÃO estiver preenchida no cadastro da versão ou estiver como "Não informado no cadastro", RESPONDA CLARAMENTE QUE O CAMPO NÃO ESTÁ PREENCHIDO NO CADASTRO DO SISTEMA.
   - Exemplo correto: "Conforme o cadastro da versão FB-400R (ERP: FCS-FB400), o campo de Frase da Comissão não está preenchido no sistema."
   - Exemplo correto: "A versão SA-350P não possui acessórios opcionais com valor cadastrado no catálogo atual."

3. RASTREABILIDADE OBRIGATÓRIA DA FONTE:
   - Sempre que responder sobre dados de uma máquina, INDIQUE DE QUAL VERSÃO E MÁQUINA VEIO A INFORMAÇÃO, citando o nome do modelo/versão e o código ERP quando existir (ex: "Conforme o cadastro da versão SA-350P (ERP: FCS-SA350)...").
   - Integre a citação organicamente no texto.

4. ESCOPO TOTAL DO CATÁLOGO:
   - Você tem acesso à busca de qualquer máquina, marca, modelo e versão do catálogo Bener no banco de dados.
   - Quando o usuário perguntar por uma máquina (mesmo que não esteja na tela que ele está visualizando), identifique-a pelo nome, modelo, marca ou código ERP através dos dados localizados abaixo.

5. CONSULTA DE ACESSÓRIOS E OPCIONAIS:
   - Cada máquina abaixo traz a seção "[ACESSÓRIOS E OPCIONAIS COM VALORES CADASTRADOS]" e "[ACESSÓRIOS STANDARDS INCLUSOS NO FORNECIMENTO BASE]".
   - Ao ser perguntado sobre acessórios e quanto custam, liste exatamente os itens cadastrados com seus respectivos valores e moedas.

6. CONSULTA DE TIPOS DE PROPOSTA, COMISSÃO E IMPOSTOS:
   - Cada máquina abaixo traz a seção "[TIPOS DE PROPOSTA VINCULADOS (COMISSÃO, IMPOSTOS E LOGÍSTICA)]".
   - Ao ser perguntado sobre comissão, IPI, ICMS, frases de proposta, condições de pagamento ou frete, consulte diretamente os tipos de proposta vinculados àquela máquina e informe os percentuais e frases exatas cadastradas.

7. ESPECIFICAÇÕES TÉCNICAS E CONFIGURAÇÕES DE COLUNA (A B C):
   - A seção "[ESPECIFICAÇÕES TÉCNICAS COMPLETAS]" de cada versão traz todas as linhas de especificações.
   - Quando houver cabeçalho de colunas como "• A B C" ou "• A B", os valores das linhas subsequentes correspondem respectivamente às colunas A, B e C na mesma ordem.
   - Ao perguntar sobre a configuração B, consulte rigorosamente o 2º valor da linha correspondente.

8. REGRA OBRIGATÓRIA DE FORMATAÇÃO:
   - NUNCA use formatação Markdown com asteriscos duplos (**texto**), asteriscos simples (*texto*), underscores (__texto__ ou _texto_), crases inline (\`código\`) ou títulos com cerquilha (# ou ##).
   - As respostas devem ser em TEXTO SIMPLES E LIMPO, legível e direto para representantes seniores.
   - Para destacar seções ou títulos, use LETRAS MAIÚSCULAS ou numeração simples (ex: "1. TORNO UNIVERSAL VEKER" ou "ACESSÓRIOS CADASTRADOS:").
   - Nunca coloque asteriscos nos rótulos de campos (use "Marca:", "Comissão:", etc.).

9. RETORNO DE TABELAS QUANDO COMPARAR OU LISTAR 2 OU MAIS MÁQUINAS:
   - Quando listar máquinas, comparar modelos ou opções de estoque, apresente o bloco:
[TABELA]
Máquina | Marca | Modelo | Valor referência | Situação de estoque
Nome Versão | Marca | Modelo | Moeda Valor | Situação
[/TABELA]

DADOS CONSOLIDADOS DO CATÁLOGO GERAL BENER:
- Total de máquinas cadastradas: ${totalCadastradas}
- Total de máquinas ATIVAS: ${totalAtivas}
- Total de máquinas INATIVAS: ${totalInativas}
- Máquinas com estoque regular/giro: ${totalComEstoqueFlag}
- Máquinas com pronta entrega imediata: ${totalEstoqueDisponivel}
- Principais marcas: ${marcasDisponiveisStr}
- Principais linhas/produtos: ${produtosDisponiveisStr}`

    const shortModeDirective = `

AJUSTE DE CONCISÃO:
- Seja acolhedor e direto ao ponto, mantendo o texto objetivo e sem parágrafos desnecessariamente longos.`

    const detailedModeDirective = `

AJUSTE DE CONCISÃO:
- Forneça explicações comerciais completas, detalhando as características técnicas, comerciais e opcionais de cada máquina.`

    const systemPrompt = `${basePrompt}${isShortMode ? shortModeDirective : detailedModeDirective}
${documentContextSnippet}
CADASTRO COMPLETO DAS MÁQUINAS DISPONÍVEIS NO BANCO DE DADOS PARA ESTA CONSULTA:

${catalogData}`

    const imagePayload =
      attachmentImage && attachmentImage.imageDataUrl
        ? {
            dataUrl: attachmentImage.imageDataUrl,
            detail: 'high' as const,
          }
        : null

    const rawAnswer = await callOpenAI(apiKey, systemPrompt, history, question, imagePayload)

    let tableData: { headers: string[]; rows: string[][]; title?: string } | null = null

    const tableBlockRegex =
      /(?:\[TABELA\]|```(?:tabela|table))\s*([\s\S]*?)\s*(?:\[\/TABELA\]|```)/i
    const match = rawAnswer.match(tableBlockRegex)

    if (match && match[1]) {
      const rawBlock = match[1].trim()
      const lines = rawBlock
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 0 && !/^[\s|:-]+$/.test(l))

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

    // Persiste mensagens na conversa do usuário (isolamento por usuário)
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

        await supabase.from('chatbot_mensagens').insert({
          conversa_id: conversationId,
          user_id: user.id,
          role: 'user',
          content: effectiveQuestion,
          attachment: userAttachmentMeta,
        })

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
