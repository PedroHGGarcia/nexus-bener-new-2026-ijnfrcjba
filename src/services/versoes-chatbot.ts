import { supabase } from '@/lib/supabase/client'

export type ChatAiStatus = 'checking' | 'online' | 'offline'

export interface ChatTableData {
  headers: string[]
  rows: string[][]
  title?: string
}

export interface ChatAttachmentMeta {
  fileName: string
  fileSize: number
  fileType: string
  isImage?: boolean
  previewUrl?: string
}

export interface ChatAttachmentPayload extends ChatAttachmentMeta {
  content?: string
  imageDataUrl?: string
  isScannedOrEmpty?: boolean
}

export interface ChatFeedback {
  rating: 'like' | 'dislike'
  timestamp: string
  answerSnippet?: string
}

export interface ChatMessage {
  id?: string
  role: 'user' | 'assistant'
  content: string
  isError?: boolean
  tableData?: ChatTableData
  attachment?: ChatAttachmentMeta
  feedback?: 'like' | 'dislike'
  timestamp?: string
}

export interface ChatbotResponse {
  answer: string
  table?: ChatTableData
  conversationId?: string
  messageId?: string
}

export interface ChatConversation {
  id: string
  user_id: string
  titulo: string
  ativa: boolean
  created_at: string
  updated_at: string
}

export interface ChatAdminUserSummary {
  id: string
  name: string
  email: string
  role?: string
  status?: string
  avatar_url?: string
  last_seen_at?: string
  totalConversas: number
  ultimaConversaEm?: string | null
}

export interface ChatAdminAuditLog {
  id: string
  admin_id: string
  admin_email: string
  target_user_id: string
  target_user_email?: string | null
  conversa_id?: string | null
  motivo?: string | null
  created_at: string
}

export const CHAT_STORAGE_PREFIX = 'bener_tech_chat_history_user_'
export const CHAT_CONV_STORAGE_PREFIX = 'bener_tech_chat_active_conv_'
export const CHAT_FEEDBACK_STORAGE_KEY = 'bener_tech_chat_feedback_v1'
export const RECENT_QUERIES_STORAGE_KEY = 'bener_tech_chat_recent_queries_v1'

/**
 * Retorna a chave do localStorage isolada por ID de usuário
 */
export function getUserStorageKey(userId?: string | null): string {
  if (!userId) return 'bener_tech_chat_history_anonymous'
  return `${CHAT_STORAGE_PREFIX}${userId}`
}

export function getUserActiveConvKey(userId?: string | null): string {
  if (!userId) return 'bener_tech_chat_active_conv_anonymous'
  return `${CHAT_CONV_STORAGE_PREFIX}${userId}`
}

/**
 * Salva histórico local da conversa isolado pelo user_id autenticado
 */
export function saveChatHistoryToStorage(messages: ChatMessage[], userId?: string | null): void {
  try {
    const key = getUserStorageKey(userId)
    const toSave = messages.map((m) => ({
      id: m.id || `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      role: m.role,
      content: m.content,
      isError: m.isError,
      tableData: m.tableData,
      feedback: m.feedback,
      attachment: m.attachment
        ? {
            fileName: m.attachment.fileName,
            fileSize: m.attachment.fileSize,
            fileType: m.attachment.fileType,
            isImage: m.attachment.isImage,
            previewUrl:
              m.attachment.previewUrl && m.attachment.previewUrl.length < 500
                ? m.attachment.previewUrl
                : undefined,
          }
        : undefined,
    }))
    localStorage.setItem(key, JSON.stringify(toSave.slice(-40)))
  } catch (e) {
    console.warn('Falha ao salvar histórico do chat:', e)
  }
}

/**
 * Carrega histórico da conversa isolado pelo user_id autenticado
 */
export function loadChatHistoryFromStorage(userId?: string | null): ChatMessage[] {
  try {
    const key = getUserStorageKey(userId)
    const raw = localStorage.getItem(key)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      return parsed.filter((m): m is ChatMessage =>
        Boolean(m && typeof m === 'object' && (m.role === 'user' || m.role === 'assistant')),
      )
    }
    return []
  } catch (e) {
    console.warn('Falha ao recuperar histórico do chat:', e)
    return []
  }
}

/**
 * Limpa o histórico de chat salvo para o usuário
 */
export function clearChatHistoryFromStorage(userId?: string | null): void {
  try {
    const key = getUserStorageKey(userId)
    localStorage.removeItem(key)
    const convKey = getUserActiveConvKey(userId)
    localStorage.removeItem(convKey)
  } catch {
    // ignore
  }
}

export function saveActiveConversationId(
  conversationId: string | null,
  userId?: string | null,
): void {
  try {
    const key = getUserActiveConvKey(userId)
    if (conversationId) {
      localStorage.setItem(key, conversationId)
    } else {
      localStorage.removeItem(key)
    }
  } catch {
    // ignore
  }
}

export function getActiveConversationId(userId?: string | null): string | null {
  try {
    const key = getUserActiveConvKey(userId)
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

/**
 * Registra feedback (👍 ou 👎) para uma resposta
 */
export function recordChatFeedback(
  messageId: string,
  rating: 'like' | 'dislike',
  answerSnippet: string,
): void {
  try {
    const raw = localStorage.getItem(CHAT_FEEDBACK_STORAGE_KEY)
    const list: Array<{
      messageId: string
      rating: 'like' | 'dislike'
      timestamp: string
      answerSnippet: string
    }> = raw ? JSON.parse(raw) : []

    const item = {
      messageId,
      rating,
      timestamp: new Date().toISOString(),
      answerSnippet: answerSnippet.substring(0, 140),
    }

    list.push(item)
    // Mantém últimos 100 feedbacks registrados localmente
    localStorage.setItem(CHAT_FEEDBACK_STORAGE_KEY, JSON.stringify(list.slice(-100)))
  } catch (e) {
    console.warn('Falha ao registrar feedback do chat no localStorage:', e)
  }
}

/**
 * Salva pergunta recente para geração de sugestões dinâmicas
 */
export function recordUserQuestion(question: string): void {
  if (!question || question.trim().length < 3) return
  try {
    const raw = localStorage.getItem(RECENT_QUERIES_STORAGE_KEY)
    const queries: string[] = raw ? JSON.parse(raw) : []
    const clean = question.trim()

    // Evita duplicatas consecutivas
    const filtered = queries.filter((q) => q.toLowerCase() !== clean.toLowerCase())
    filtered.unshift(clean)

    // Guarda até 25 perguntas recentes
    localStorage.setItem(RECENT_QUERIES_STORAGE_KEY, JSON.stringify(filtered.slice(0, 25)))
  } catch {
    // ignore
  }
}

/**
 * Recupera perguntas recentes para derivar contexto de sugestão
 */
export function getRecentUserQuestions(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_QUERIES_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

/**
 * Gera perguntas sugeridas dinâmicas a partir das conversas e termos recentes
 */
export function getDynamicSuggestions(currentMessages: ChatMessage[] = []): string[] {
  const recentStored = getRecentUserQuestions()
  const sessionUserQuestions = currentMessages
    .filter((m) => m.role === 'user' && m.content)
    .map((m) => m.content)

  const allQueries = [...sessionUserQuestions.reverse(), ...recentStored]

  if (allQueries.length === 0) {
    return SUGGESTED_QUESTIONS
  }

  const combinedText = allQueries.slice(0, 10).join(' ').toLowerCase()

  // Detecta versões ou códigos específicos mencionados recentemente (ex: SA-350, CT-450, TVK 1224, FB-400)
  const versionMatches = Array.from(
    combinedText.matchAll(/\b([a-z]{1,4}[\s-]?[0-9]{2,5}[a-z0-9]*)\b/gi),
  )
    .map((m) => m[0].toUpperCase().replace(/\s+/g, '-'))
    .filter((v, idx, arr) => arr.indexOf(v) === idx)
    .slice(0, 3)

  const suggestions: string[] = []

  // Se o usuário tem interesse em injetoras
  const isInterestInjetora =
    combinedText.includes('injetor') ||
    combinedText.includes('rosca') ||
    combinedText.includes('fechamento') ||
    combinedText.includes('volume de inj') ||
    combinedText.includes('fcs')

  // Se o usuário tem interesse em tornos / centros / usinagem
  const isInterestUsinagem =
    combinedText.includes('torno') ||
    combinedText.includes('usinagem') ||
    combinedText.includes('veker') ||
    combinedText.includes('spindle') ||
    combinedText.includes('barramento') ||
    combinedText.includes('pontas')

  // Se o usuário tem interesse em estoque / pronta entrega
  const isInterestEstoque =
    combinedText.includes('estoque') ||
    combinedText.includes('pronta entrega') ||
    combinedText.includes('disponiv')

  // Se tem versão específica detectada
  if (versionMatches.length > 0) {
    const topVersion = versionMatches[0]
    suggestions.push(`Quais as especificações completas da ${topVersion}?`)
    suggestions.push(`A versão ${topVersion} tem estoque disponível?`)
    if (isInterestInjetora) {
      suggestions.push(`Qual o volume de injeção da ${topVersion} na configuração B?`)
    } else {
      suggestions.push(`Quais versões similares à ${topVersion} temos no catálogo?`)
    }
  }

  if (isInterestInjetora && suggestions.length < 5) {
    if (!suggestions.some((s) => s.includes('Quais versões de injetora'))) {
      suggestions.push('Quais versões de injetora você tem?')
    }
    if (!suggestions.some((s) => s.includes('força de fechamento'))) {
      suggestions.push('Quais injetoras têm força de fechamento acima de 300 toneladas?')
    }
  }

  if (isInterestUsinagem && suggestions.length < 5) {
    if (!suggestions.some((s) => s.includes('torno'))) {
      suggestions.push('Quais modelos de torno universal ou CNC temos disponíveis?')
    }
    if (!suggestions.some((s) => s.includes('centro de usinagem'))) {
      suggestions.push('Quais centros de usinagem estão ativos no catálogo?')
    }
  }

  if (isInterestEstoque && suggestions.length < 5) {
    if (!suggestions.some((s) => s.includes('pronta entrega'))) {
      suggestions.push('Quais máquinas têm estoque disponível para pronta entrega?')
    }
  }

  // Completa com as padrões até 5 itens distintos
  for (const fallback of SUGGESTED_QUESTIONS) {
    if (suggestions.length >= 5) break
    if (!suggestions.includes(fallback)) {
      suggestions.push(fallback)
    }
  }

  return suggestions.slice(0, 5)
}

/**
 * Realiza uma verificação leve de saúde na função de backend da Bener Tech I.A.
 * Retorna true se a IA e a Edge Function estiverem respondendo e com chaves válidas.
 */
export async function checkChatbotHealth(): Promise<boolean> {
  try {
    const { data, error } = await supabase.functions.invoke('versoes-chatbot', {
      body: { ping: true },
    })

    if (error) {
      return false
    }

    if (data && typeof data === 'object') {
      if ('error' in data && (data as { error?: unknown }).error) {
        return false
      }
      if ('status' in data && (data as { status?: unknown }).status === 'ok') {
        return true
      }
    }

    return true
  } catch {
    return false
  }
}

export const SUGGESTED_QUESTIONS: string[] = [
  'Quais versões de injetora você tem?',
  'Tem a versão SA-1000?',
  'Qual o volume de injeção da SA-1000 na configuração B?',
  'Quais as dimensões da máquina SA-1000?',
  'Quais máquinas têm estoque disponível para pronta entrega?',
]

export async function askVersoesChatbot(
  question: string,
  history: ChatMessage[] = [],
  attachment?: ChatAttachmentPayload,
  allowedCategoriaIds?: string[],
  conversationId?: string | null,
): Promise<ChatbotResponse> {
  try {
    // Verifica sessão do usuário antes de chamar a edge function
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session || !session.access_token) {
      throw new Error(
        'Você precisa estar conectado à sua conta para conversar com a Bener Tech I.A.',
      )
    }

    // Envia as últimas 12 mensagens sem erros, truncadas a 4.000 caracteres no client também
    const sanitizedHistory = history
      .filter((m) => !m.isError && m.content && m.content.trim().length > 0)
      .slice(-12)
      .map((m) => {
        const trimmed = m.content.trim()
        return {
          role: m.role,
          content: trimmed.length > 4000 ? trimmed.substring(0, 4000) : trimmed,
        }
      })

    const truncatedQuestion =
      question.trim().length > 4000 ? question.trim().substring(0, 4000) : question.trim()

    const requestBody: {
      question: string
      history: Array<{ role: 'user' | 'assistant'; content: string }>
      attachment?: ChatAttachmentPayload
      allowedCategoriaIds?: string[]
      conversationId?: string | null
    } = {
      question: truncatedQuestion,
      history: sanitizedHistory,
    }

    if (allowedCategoriaIds && allowedCategoriaIds.length > 0) {
      requestBody.allowedCategoriaIds = allowedCategoriaIds
    }

    if (attachment) {
      requestBody.attachment = attachment
    }

    if (conversationId) {
      requestBody.conversationId = conversationId
    }

    const { data, error } = await supabase.functions.invoke('versoes-chatbot', {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
      body: requestBody,
    })

    if (error) {
      // Quando functions.invoke falha (ex: status 500), tenta extrair a mensagem do corpo de resposta se disponível
      let backendMsg: string | null = null
      let statusCode: number | null = null

      if (data && typeof data === 'object' && 'error' in data) {
        backendMsg = String((data as Record<string, unknown>).error)
      } else if (error && typeof error === 'object' && 'context' in error) {
        // Supabase FunctionsHttpError pode conter response em context
        try {
          const ctx = (
            error as unknown as {
              context?: {
                status?: number
                json?: () => Promise<unknown>
                text?: () => Promise<string>
              }
            }
          ).context
          if (ctx && typeof ctx.status === 'number') {
            statusCode = ctx.status
          }
          if (ctx && typeof ctx.json === 'function') {
            const body = await ctx.json()
            if (body && typeof body === 'object' && 'error' in body) {
              backendMsg = String((body as Record<string, unknown>).error)
            }
          } else if (ctx && typeof ctx.text === 'function') {
            const raw = await ctx.text()
            try {
              const parsed = JSON.parse(raw)
              if (parsed?.error) backendMsg = String(parsed.error)
            } catch {
              // ignore
            }
          }
        } catch {
          // ignore parsing error
        }
      }

      if (statusCode === 429) {
        throw new Error(
          backendMsg ||
            'Você está enviando muitas perguntas seguidas. Aguarde um instante e tente de novo.',
        )
      }

      if (statusCode === 401) {
        throw new Error(
          backendMsg ||
            'Você precisa estar conectado à sua conta para conversar com a Bener Tech I.A.',
        )
      }

      throw new Error(
        backendMsg ??
          'A Bener Tech I.A está temporariamente indisponível. Por favor, aguarde alguns instantes e tente novamente.',
      )
    }

    if (typeof data === 'string') return { answer: data }
    if (data?.error) throw new Error(data.error)

    const rawAnswer =
      data?.answer ??
      data?.resposta ??
      data?.message ??
      'Não consegui obter uma resposta para essa pergunta no momento. Poderia tentar reformular com o modelo ou marca da máquina?'

    const tableData: ChatTableData | undefined =
      data?.table && Array.isArray(data.table.headers) && Array.isArray(data.table.rows)
        ? {
            headers: data.table.headers.map(String),
            rows: data.table.rows.map((r: unknown[]) => (Array.isArray(r) ? r.map(String) : [])),
            title: typeof data.table.title === 'string' ? data.table.title : undefined,
          }
        : undefined

    return {
      answer: rawAnswer,
      table: tableData,
      conversationId: typeof data?.conversationId === 'string' ? data.conversationId : undefined,
      messageId: typeof data?.messageId === 'string' ? data.messageId : undefined,
    }
  } catch (err) {
    const rawMsg = err instanceof Error ? err.message : ''
    // Converte erros técnicos comuns em mensagens simpáticas e acolhedoras para o representante
    const lower = rawMsg.toLowerCase()
    if (
      lower.includes('failed to fetch') ||
      lower.includes('network') ||
      lower.includes('connection') ||
      lower.includes('conexão')
    ) {
      throw new Error(
        'Tivemos uma pequena perda de conexão com o sistema. Por favor, verifique sua internet e tente enviar sua pergunta novamente.',
      )
    }
    if (
      lower.includes('timeout') ||
      lower.includes('tempo limite') ||
      lower.includes('timed out')
    ) {
      throw new Error(
        'A consulta demorou mais que o esperado para responder. Por favor, tente reformular com termos mais específicos (marca, modelo ou tipo).',
      )
    }
    if (rawMsg.length > 0) {
      throw new Error(rawMsg)
    }
    throw new Error(
      'Tivemos uma pequena oscilação momentânea ao consultar a Bener Tech I.A. Por favor, tente novamente.',
    )
  }
}

/**
 * Carrega a conversa ativa ou obtém do backend pelo user_id autenticado
 */
export async function getOrCreateUserConversation(
  requestedId?: string | null,
): Promise<ChatConversation | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) return null

  const { data, error } = await supabase.functions.invoke('versoes-chatbot', {
    headers: { Authorization: `Bearer ${session.access_token}` },
    body: {
      action: 'get_or_create_conversation',
      conversationId: requestedId || undefined,
    },
  })

  if (error || !data || data.error) {
    console.warn('Erro ao obter conversa ativa do chatbot:', error || data?.error)
    return null
  }

  return (data.conversation as ChatConversation) ?? null
}

/**
 * Cria uma nova conversa no backend (isolada para o usuário autenticado)
 */
export async function createNewUserConversation(): Promise<ChatConversation | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) return null

  const { data, error } = await supabase.functions.invoke('versoes-chatbot', {
    headers: { Authorization: `Bearer ${session.access_token}` },
    body: { action: 'new_conversation' },
  })

  if (error || !data || data.error) {
    throw new Error(data?.error || error?.message || 'Falha ao criar nova conversa')
  }

  return (data.conversation as ChatConversation) ?? null
}

/**
 * Carrega as mensagens de uma conversa com validação estrita no backend
 */
export async function fetchConversationMessages(conversationId: string): Promise<ChatMessage[]> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) return []

  const { data, error } = await supabase.functions.invoke('versoes-chatbot', {
    headers: { Authorization: `Bearer ${session.access_token}` },
    body: {
      action: 'get_conversation_messages',
      conversationId,
    },
  })

  if (error || !data || data.error) {
    throw new Error(data?.error || error?.message || 'Erro ao carregar histórico da conversa')
  }

  interface RawBackendMsg {
    id: string
    role: 'user' | 'assistant'
    content: string
    is_error?: boolean
    table_data?: ChatTableData
    feedback?: 'like' | 'dislike'
    attachment?: ChatAttachmentPayload
  }

  const msgs = (data.messages as RawBackendMsg[]) ?? []
  return msgs.map((m) => ({
    id: m.id,
    role: m.role,
    content: m.content,
    isError: Boolean(m.is_error),
    tableData: m.table_data,
    feedback: m.feedback,
    attachment: m.attachment,
  }))
}

/**
 * Registra feedback da mensagem no backend
 */
export async function sendChatFeedbackToBackend(
  messageId: string,
  rating: 'like' | 'dislike',
): Promise<void> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) return

  await supabase.functions.invoke('versoes-chatbot', {
    headers: { Authorization: `Bearer ${session.access_token}` },
    body: {
      action: 'record_feedback',
      messageId,
      rating,
    },
  })
}

// =============================================================================
// FUNÇÕES DE ADMINISTRAÇÃO (ACESSO RESTRITO A ADMINS - VALIDADO NO BACKEND)
// =============================================================================

/**
 * Admin: Listar todos os usuários com resumo de conversas no chatbot
 */
export async function adminListChatbotUsers(): Promise<ChatAdminUserSummary[]> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) throw new Error('Não autenticado.')

  const { data, error } = await supabase.functions.invoke('versoes-chatbot', {
    headers: { Authorization: `Bearer ${session.access_token}` },
    body: { action: 'admin_list_users' },
  })

  if (error || !data || data.error) {
    throw new Error(data?.error || error?.message || 'Falha ao listar usuários do chatbot.')
  }

  return (data.users as ChatAdminUserSummary[]) ?? []
}

/**
 * Admin: Listar conversas de um usuário específico
 */
export async function adminListUserConversations(targetUserId: string): Promise<{
  targetUser: { id: string; name: string; email: string; role?: string } | null
  conversations: ChatConversation[]
}> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) throw new Error('Não autenticado.')

  const { data, error } = await supabase.functions.invoke('versoes-chatbot', {
    headers: { Authorization: `Bearer ${session.access_token}` },
    body: {
      action: 'admin_list_user_conversations',
      targetUserId,
    },
  })

  if (error || !data || data.error) {
    throw new Error(data?.error || error?.message || 'Falha ao buscar conversas do usuário.')
  }

  return {
    targetUser: data.targetUser || null,
    conversations: (data.conversations as ChatConversation[]) ?? [],
  }
}

/**
 * Admin: Carregar histórico completo de uma conversa de um usuário (registra auditoria no backend)
 */
export async function adminGetConversationMessages(
  targetUserId: string,
  conversationId: string,
  motivo?: string,
): Promise<{
  conversation: ChatConversation
  targetUser: { name?: string; email?: string } | null
  messages: ChatMessage[]
}> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) throw new Error('Não autenticado.')

  const { data, error } = await supabase.functions.invoke('versoes-chatbot', {
    headers: { Authorization: `Bearer ${session.access_token}` },
    body: {
      action: 'admin_get_conversation_messages',
      targetUserId,
      conversationId,
      motivo: motivo || 'Consulta visual de suporte administrativo',
    },
  })

  if (error || !data || data.error) {
    throw new Error(data?.error || error?.message || 'Falha ao carregar conversa do usuário.')
  }

  interface RawBackendMsg {
    id: string
    role: 'user' | 'assistant'
    content: string
    is_error?: boolean
    table_data?: ChatTableData
    feedback?: 'like' | 'dislike'
    attachment?: ChatAttachmentPayload
    created_at?: string
  }

  const msgs = (data.messages as RawBackendMsg[]) ?? []
  return {
    conversation: data.conversation as ChatConversation,
    targetUser: data.targetUser || null,
    messages: msgs.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      isError: Boolean(m.is_error),
      tableData: m.table_data,
      feedback: m.feedback,
      attachment: m.attachment,
      timestamp: m.created_at,
    })),
  }
}

/**
 * Admin: Listar logs recentes de auditoria do chatbot
 */
export async function adminListChatbotAuditLogs(): Promise<ChatAdminAuditLog[]> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) throw new Error('Não autenticado.')

  const { data, error } = await supabase.functions.invoke('versoes-chatbot', {
    headers: { Authorization: `Bearer ${session.access_token}` },
    body: { action: 'admin_list_audit_logs' },
  })

  if (error || !data || data.error) {
    throw new Error(data?.error || error?.message || 'Falha ao carregar logs de auditoria.')
  }

  return (data.logs as ChatAdminAuditLog[]) ?? []
}
