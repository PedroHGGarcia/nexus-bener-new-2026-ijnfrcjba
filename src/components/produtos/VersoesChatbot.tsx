import { useState, useRef, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  X,
  Send,
  Loader2,
  FileSpreadsheet,
  Download,
  Paperclip,
  FileText,
  Image as ImageIcon,
  ThumbsUp,
  ThumbsDown,
  RotateCcw,
} from 'lucide-react'
import benerTechAvatar from '@/assets/bener-tech-avatar.png'
import {
  askVersoesChatbot,
  checkChatbotHealth,
  ChatMessage,
  ChatAiStatus,
  ChatTableData,
  ChatAttachmentPayload,
  loadChatHistoryFromStorage,
  saveChatHistoryToStorage,
  clearChatHistoryFromStorage,
  recordChatFeedback,
  recordUserQuestion,
  getDynamicSuggestions,
  getOrCreateUserConversation,
  createNewUserConversation,
  fetchConversationMessages,
  sendChatFeedbackToBackend,
  saveActiveConversationId,
  getActiveConversationId,
} from '@/services/versoes-chatbot'
import { useAuth } from '@/hooks/use-auth'
import { useGerenteCategoryRestriction } from '@/hooks/use-gerente-restriction'
import {
  extractTextFromFile,
  formatFileSize,
  ExtractedDocument,
  MAX_ATTACHMENT_SIZE_BYTES,
} from '@/lib/document-extractor'
import { downloadChatbotTableAsFile } from '@/lib/chatbot-table-export'
import { splitMessageSections } from '@/lib/chatbot-table-parser'
import { cn } from '@/lib/utils'

/**
 * Remove marcadores Markdown indesejados (como **negrito**, *itálico*, `código`, etc.)
 * mantendo o texto puro e legível, sem artefatos de formatação para os representantes.
 */
export function sanitizeChatText(text: string): string {
  if (!text) return ''
  return (
    text
      // Remove cabeçalhos markdown no início da linha (ex: ### Título -> Título)
      .replace(/^#{1,6}\s+/gm, '')
      // Remove crases de código em bloco ou inline (```texto``` ou `texto` -> texto)
      .replace(/```(?:[a-zA-Z]*\n)?([\s\S]*?)```/g, '$1')
      .replace(/`([^`]+)`/g, '$1')
      // Remove marcadores de negrito/itálico com asteriscos (ex: **texto** ou ***texto*** ou *texto*)
      .replace(/\*{3,}(.*?)\*{3,}/g, '$1')
      .replace(/\*{2}(.*?)\*{2}/g, '$1')
      .replace(/(^|[^*])\*([^*\n]+)\*([^*]|$)/g, '$1$2$3')
      // Remove marcadores com underline (__texto__ ou _texto_)
      .replace(/_{2,}(.*?)_{2,}/g, '$1')
      .replace(/(^|[^_])_([^_\n]+)_([^_]|$)/g, '$1$2$3')
      // Remove marcadores de tachado (~~texto~~ -> texto)
      .replace(/~~(.*?)~~/g, '$1')
      // Converte links markdown [Texto](url) para apenas Texto (ou Texto: url se fizer sentido)
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)')
      // Remove quaisquer asteriscos isolados que tenham sobrado grudados em pontuação (ex: - **Marca:** -> - Marca:)
      .replace(/\*+/g, '')
      // Limpa espaços duplicados que possam ter sobrado antes de pontuação
      .replace(/[ \t]+([:,;.!?])/g, '$1')
      .trim()
  )
}

/**
 * Componente dedicado à renderização da tabela elegante no chat,
 * com cabeçalho verde Bener suave, linhas zebradas, cantos arredondados,
 * scroll horizontal responsivo e botão de download em planilha.
 */
function ChatTableView({ table }: { table: ChatTableData }) {
  const [downloading, setDownloading] = useState(false)

  const handleDownload = () => {
    try {
      setDownloading(true)
      downloadChatbotTableAsFile(table)
    } finally {
      setTimeout(() => setDownloading(false), 500)
    }
  }

  const rowCount = table.rows.length

  return (
    <div className="my-2 space-y-1.5 w-full">
      <div className="rounded-lg border border-[#0b3c26]/20 bg-background overflow-hidden shadow-xs">
        <div className="overflow-x-auto max-w-full scrollbar-thin">
          <table className="w-full text-[11px] text-left border-collapse">
            <thead>
              <tr className="bg-[#0b3c26]/10 border-b border-[#0b3c26]/20 text-[#0b3c26] dark:text-emerald-300 font-semibold">
                {table.headers.map((h, i) => (
                  <th
                    key={i}
                    scope="col"
                    className={cn(
                      'px-2.5 py-1.5 whitespace-nowrap text-[11px] tracking-tight',
                      i === 0 ? 'font-bold' : 'font-semibold',
                    )}
                  >
                    {sanitizeChatText(h)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {table.rows.map((row, rIdx) => (
                <tr
                  key={rIdx}
                  className={cn(
                    'transition-colors',
                    rIdx % 2 === 0 ? 'bg-background' : 'bg-muted/40',
                    'hover:bg-[#0b3c26]/5',
                  )}
                >
                  {table.headers.map((_, cIdx) => {
                    const cellVal = row[cIdx] ?? '-'
                    return (
                      <td
                        key={cIdx}
                        className={cn(
                          'px-2.5 py-1.5 align-middle text-foreground/90 leading-tight',
                          cIdx === 0 && 'font-medium text-foreground whitespace-nowrap',
                          // Colunas de valores numéricos/preços ou estoque
                          (table.headers[cIdx]?.toLowerCase().includes('valor') ||
                            table.headers[cIdx]?.toLowerCase().includes('preço')) &&
                            'whitespace-nowrap font-medium text-emerald-800 dark:text-emerald-300',
                        )}
                      >
                        {sanitizeChatText(cellVal)}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Barra de ação discreta abaixo da tabela com botão "Baixar em planilha" */}
      <div className="flex items-center justify-between gap-2 pt-0.5 px-0.5">
        <span className="text-[10px] text-muted-foreground/80">
          {rowCount} {rowCount === 1 ? 'máquina listada' : 'máquinas listadas'}
        </span>

        <button
          type="button"
          onClick={handleDownload}
          disabled={downloading}
          className={cn(
            'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium cursor-pointer',
            'bg-[#0b3c26]/10 text-[#0b3c26] hover:bg-[#0b3c26]/20 active:scale-95',
            'dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-950/70',
            'border border-[#0b3c26]/20 transition-all shadow-2xs',
            'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#0b3c26]',
          )}
          title="Baixar dados em planilha compatível com Excel (.csv UTF-8)"
          aria-label="Baixar em planilha"
        >
          <FileSpreadsheet className="w-3.5 h-3.5 text-[#0b3c26] dark:text-emerald-300 shrink-0" />
          <span>{downloading ? 'Gerando...' : 'Baixar em planilha'}</span>
          <Download className="w-3 h-3 opacity-70 shrink-0" />
        </button>
      </div>
    </div>
  )
}

/**
 * Renderiza o corpo de mensagens da Bener Tech I.A, alternando textos puros sanitizados
 * e blocos visuais de tabelas interativas com download em planilha.
 */
function AssistantMessageBody({
  content,
  tableData,
}: {
  content: string
  tableData?: ChatTableData
}) {
  const sections = splitMessageSections(content, tableData)

  return (
    <div className="space-y-2 w-full">
      {sections.map((sec, idx) => {
        if (sec.type === 'table' && sec.table) {
          return <ChatTableView key={idx} table={sec.table} />
        }
        if (sec.type === 'text' && sec.text) {
          const clean = sanitizeChatText(sec.text)
          if (!clean) return null

          // Verifica se o texto contém URLs diretas de imagem (ex: https://...jpg / png / webp)
          // para renderizar prévia sutil e limpa caso a IA cite a foto da versão
          const imgUrlMatch = clean.match(/(https?:\/\/[^\s)]+?\.(?:png|jpe?g|webp))/i)
          const imageUrl = imgUrlMatch ? imgUrlMatch[1] : null

          return (
            <div key={idx} className="space-y-2">
              <div className="whitespace-pre-line leading-relaxed">{clean}</div>
              {imageUrl && (
                <div className="mt-2 rounded-lg border bg-background/80 p-1.5 shadow-2xs max-w-xs">
                  <img
                    src={imageUrl}
                    alt="Foto do equipamento"
                    className="w-full h-36 object-cover rounded-md"
                    loading="lazy"
                    onError={(e) => {
                      // Se a imagem falhar ao carregar, esconde o card
                      ;(e.currentTarget.parentElement as HTMLElement)?.classList.add('hidden')
                    }}
                  />
                  <p className="text-[10px] text-muted-foreground text-center mt-1">
                    Foto de catálogo da máquina
                  </p>
                </div>
              )}
            </div>
          )
        }
        return null
      })}
    </div>
  )
}

export function VersoesChatbot() {
  const { user } = useAuth()
  const userId = user?.id || null
  const [open, setOpen] = useState(false)
  const [rendered, setRendered] = useState(false)
  const [animating, setAnimating] = useState(false)
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(() =>
    getActiveConversationId(userId),
  )
  const [messages, setMessages] = useState<ChatMessage[]>(() => loadChatHistoryFromStorage(userId))
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [processingFile, setProcessingFile] = useState(false)
  const [fileError, setFileError] = useState<string | null>(null)
  const [attachedFile, setAttachedFile] = useState<ExtractedDocument | null>(null)
  const [readingDocumentStatus, setReadingDocumentStatus] = useState(false)
  const [readingImageStatus, setReadingImageStatus] = useState(false)
  const [aiStatus, setAiStatus] = useState<ChatAiStatus>('checking')
  const restriction = useGerenteCategoryRestriction()
  const scrollRef = useRef<HTMLDivElement>(null)
  const chatWindowRef = useRef<HTMLDivElement>(null)
  const toggleButtonRef = useRef<HTMLButtonElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Quando o usuário autenticado mudar, recarrega o histórico isolado dele
  useEffect(() => {
    const cached = loadChatHistoryFromStorage(userId)
    setMessages(cached)
    const activeConv = getActiveConversationId(userId)
    setCurrentConversationId(activeConv)

    if (userId) {
      // Sincroniza conversa ativa com o backend
      getOrCreateUserConversation(activeConv).then(async (conv) => {
        if (conv) {
          setCurrentConversationId(conv.id)
          saveActiveConversationId(conv.id, userId)
          // Tenta carregar mensagens salvas no Supabase para esta conversa
          try {
            const remoteMsgs = await fetchConversationMessages(conv.id)
            if (remoteMsgs && remoteMsgs.length > 0) {
              setMessages(remoteMsgs)
              saveChatHistoryToStorage(remoteMsgs, userId)
            }
          } catch {
            // mantém cache local se falhar
          }
        }
      })
    }
  }, [userId])

  // Salva histórico de mensagens no localStorage sempre isolado pelo userId
  useEffect(() => {
    saveChatHistoryToStorage(messages, userId)
  }, [messages, userId])

  // Limpa conversa atual e recomeça nova conversa no backend isolada para este usuário
  const handleNewConversation = async () => {
    if (loading) return
    clearChatHistoryFromStorage(userId)
    setMessages([])
    setAttachedFile(null)
    setFileError(null)
    setInput('')

    try {
      const newConv = await createNewUserConversation()
      if (newConv) {
        setCurrentConversationId(newConv.id)
        saveActiveConversationId(newConv.id, userId)
      } else {
        setCurrentConversationId(null)
        saveActiveConversationId(null, userId)
      }
    } catch {
      setCurrentConversationId(null)
      saveActiveConversationId(null, userId)
    }

    setTimeout(() => {
      inputRef.current?.focus()
    }, 50)
  }

  // Avaliação 👍 ou 👎 para uma resposta do assistente
  const handleFeedback = (index: number, rating: 'like' | 'dislike') => {
    setMessages((prev) => {
      const next = [...prev]
      const msg = next[index]
      if (!msg || msg.role !== 'assistant') return prev
      if (msg.feedback === rating) return prev

      const updatedMsg: ChatMessage = {
        ...msg,
        feedback: rating,
      }
      next[index] = updatedMsg

      const msgId = msg.id || `msg-${index}-${Date.now()}`
      recordChatFeedback(msgId, rating, msg.content)

      // Se temos o id do backend, persiste também no Supabase
      if (msg.id && !msg.id.startsWith('asst-')) {
        sendChatFeedbackToBackend(msg.id, rating).catch(() => {})
      }

      return next
    })
  }

  // Sugestões dinâmicas calculadas com base nas mensagens e pesquisas recentes
  const dynamicSuggestions = getDynamicSuggestions(messages)

  // Função para verificar a saúde da IA com atualização de status
  const performHealthCheck = useCallback(async () => {
    // Mantém 'checking' apenas se já não estiver em uma consulta
    const isHealthy = await checkChatbotHealth()
    setAiStatus(isHealthy ? 'online' : 'offline')
    return isHealthy
  }, [])

  // 1. Verificação de saúde ao montar o componente
  useEffect(() => {
    let mounted = true
    const initCheck = async () => {
      setAiStatus('checking')
      const isHealthy = await checkChatbotHealth()
      if (mounted) {
        setAiStatus(isHealthy ? 'online' : 'offline')
      }
    }
    initCheck()
    return () => {
      mounted = false
    }
  }, [])

  // 3. Re-check automático periódico: a cada 60s
  useEffect(() => {
    const interval = setInterval(() => {
      // Re-verifica silenciosamente
      checkChatbotHealth().then((isHealthy) => {
        setAiStatus(isHealthy ? 'online' : 'offline')
      })
    }, 60000)

    return () => clearInterval(interval)
  }, [])

  // Re-check ao reabrir o chat
  useEffect(() => {
    if (open) {
      // Se estava offline ou checking, ou apenas ao abrir para garantir status fresco
      performHealthCheck()
    }
  }, [open, performHealthCheck])

  // Controla montagem/desmontagem com transição fluida e ágil ("abertura em 550ms")
  // Abertura com curva suave e desaceleração aérea (550ms) e fechamento macio (~600ms)
  useEffect(() => {
    if (open) {
      setRendered(true)
      // Dois rAFs consecutivos garantem montagem no DOM e layout prontos antes do trigger CSS
      const frame = requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setAnimating(true)
        })
      })
      return () => cancelAnimationFrame(frame)
    } else if (rendered) {
      setAnimating(false)
      const timer = setTimeout(() => {
        setRendered(false)
      }, 620) // Sincronizado com os ~600ms de fechamento + margem de segurança de 20ms
      return () => clearTimeout(timer)
    }
  }, [open, rendered])

  // Foco no input ao abrir de forma suave após a janela se assentar completamente (~550ms)
  useEffect(() => {
    if (open && animating) {
      const timer = setTimeout(() => {
        inputRef.current?.focus()
      }, 550)
      return () => clearTimeout(timer)
    }
  }, [open, animating])

  // Fechar com ESC e clicar fora
  useEffect(() => {
    if (!open) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        setOpen(false)
      }
    }

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node
      if (
        chatWindowRef.current &&
        !chatWindowRef.current.contains(target) &&
        toggleButtonRef.current &&
        !toggleButtonRef.current.contains(target)
      ) {
        setOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    document.addEventListener('mousedown', handleClickOutside)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [open])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, loading, rendered])

  // Lida com seleção de arquivo anexo
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    // Limpa o input nativo para permitir selecionar o mesmo arquivo novamente se necessário
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }

    if (!file) return

    setFileError(null)

    if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
      setFileError('Arquivo muito grande. O limite é 10 MB.')
      return
    }

    try {
      setProcessingFile(true)
      const extracted = await extractTextFromFile(file)
      setAttachedFile(extracted)
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Não foi possível carregar o arquivo selecionado.'
      setFileError(msg)
    } finally {
      setProcessingFile(false)
    }
  }

  const handleRemoveAttachment = () => {
    setAttachedFile(null)
    setFileError(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleSend = async (text?: string) => {
    const rawContent = (text ?? input).trim()
    const currentAttachment = attachedFile

    // Se não há texto e não há anexo, ou se já está carregando, não faz nada
    if ((!rawContent && !currentAttachment) || loading || processingFile) return

    const effectiveText =
      rawContent ||
      (currentAttachment
        ? `Por favor, analise o documento anexado (${currentAttachment.fileName}) e informe os detalhes técnicos e máquinas relacionadas.`
        : '')

    // Se a IA já estiver reconhecidamente offline antes do envio
    if (aiStatus === 'offline') {
      setInput('')
      setAttachedFile(null)
      setFileError(null)
      setMessages((prev) => [
        ...prev,
        {
          role: 'user',
          content: effectiveText,
          attachment: currentAttachment
            ? {
                fileName: currentAttachment.fileName,
                fileSize: currentAttachment.fileSize,
                fileType: currentAttachment.fileType,
                isImage: currentAttachment.isImage,
                previewUrl: currentAttachment.previewUrl,
              }
            : undefined,
        },
        {
          role: 'assistant',
          content:
            'A assistente Bener Tech I.A está temporariamente indisponível no momento. Por favor, tente novamente em alguns instantes.',
          isError: true,
        },
      ])
      return
    }

    // Prepara payload para a IA
    let attachmentPayload: ChatAttachmentPayload | undefined
    if (currentAttachment) {
      attachmentPayload = {
        fileName: currentAttachment.fileName,
        fileSize: currentAttachment.fileSize,
        fileType: currentAttachment.fileType,
        content: currentAttachment.text,
        isImage: currentAttachment.isImage,
        imageDataUrl: currentAttachment.previewUrl,
        isScannedOrEmpty: currentAttachment.isScannedOrEmpty,
      }
    }

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      role: 'user',
      content: effectiveText,
      attachment: currentAttachment
        ? {
            fileName: currentAttachment.fileName,
            fileSize: currentAttachment.fileSize,
            fileType: currentAttachment.fileType,
            isImage: currentAttachment.isImage,
            previewUrl: currentAttachment.previewUrl,
          }
        : undefined,
    }

    // Registra pergunta para sugestões dinâmicas adaptativas
    recordUserQuestion(effectiveText)

    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setAttachedFile(null)
    setFileError(null)
    setLoading(true)

    // Altera mensagens contextuais do indicador de progresso dependendo do tipo de anexo
    if (currentAttachment?.isImage) {
      setReadingImageStatus(true)
      setReadingDocumentStatus(false)
    } else if (currentAttachment) {
      setReadingDocumentStatus(true)
      setReadingImageStatus(false)
    } else {
      setReadingDocumentStatus(false)
      setReadingImageStatus(false)
    }

    try {
      const history = messages.slice(-10) // Mantém contexto das últimas mensagens
      const allowedCats =
        restriction.hasRestriction && restriction.categoriaIds.length > 0
          ? restriction.categoriaIds
          : restriction.hasRestriction && restriction.categoriaId
            ? [restriction.categoriaId]
            : undefined

      const res = await askVersoesChatbot(
        effectiveText,
        history,
        attachmentPayload,
        allowedCats,
        currentConversationId,
      )

      if (res.conversationId && res.conversationId !== currentConversationId) {
        setCurrentConversationId(res.conversationId)
        saveActiveConversationId(res.conversationId, userId)
      }

      setMessages((prev) => [
        ...prev,
        {
          id: res.messageId || `asst-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          role: 'assistant',
          content: res.answer,
          isError: false,
          tableData: res.table,
        },
      ])
      // Em resposta com sucesso, garante que o status está online
      setAiStatus('online')
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error && err.message
          ? err.message
          : 'Desculpe, ocorreu um erro ao consultar o catálogo. Tente novamente em instantes.'

      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          role: 'assistant',
          content: errorMessage,
          isError: true,
        },
      ])

      // Verifica a saúde real do backend antes de marcar offline
      // Se a conexão ainda responder, mantém online para não bloquear a UI do usuário
      checkChatbotHealth()
        .then((healthy) => {
          setAiStatus(healthy ? 'online' : 'offline')
        })
        .catch(() => {
          setAiStatus('offline')
        })
    } finally {
      setLoading(false)
      setReadingDocumentStatus(false)
      setReadingImageStatus(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <>
      {/* Botão flutuante Bener Tech I.A - Sempre visível, elegante com foto nobre e texto fixo Bener Tech I.A */}
      <div
        className={cn(
          'fixed z-50 transition-all duration-300 ease-out select-none',
          'bottom-4 right-4 sm:bottom-6 sm:right-6',
        )}
      >
        <button
          ref={toggleButtonRef}
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className={cn(
            'group relative inline-flex items-center gap-3 pl-1.5 pr-4 py-1.5 sm:pl-2 sm:pr-5 sm:py-2 rounded-full',
            'bg-[#0b3c26] hover:bg-[#0e4b30] active:scale-95 text-white',
            'border border-[#1d7048]/70',
            // Sombra refinada com leve tom verde da Bener + moldura elegante para destaque sóbrio
            'shadow-[0_8px_24px_rgba(11,60,38,0.4),0_2px_6px_rgba(0,0,0,0.15)] hover:shadow-[0_10px_28px_rgba(11,60,38,0.52)]',
            'ring-1 ring-amber-400/30 hover:ring-amber-300/45',
            // Micro-interação no hover (scale sutil ~1.03) e transição fluida
            'transition-all duration-200 ease-out cursor-pointer hover:scale-[1.03]',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0b3c26] focus-visible:ring-offset-2',
            open &&
              'bg-[#08291a] hover:bg-[#0b3c26] ring-white/15 shadow-[0_4px_16px_rgba(0,0,0,0.3)]',
          )}
          aria-label={open ? 'Fechar Bener Tech I.A' : 'Abrir Bener Tech I.A'}
          aria-expanded={open}
          title={
            open
              ? 'Fechar Bener Tech I.A'
              : 'Bener Tech I.A — tirar dúvidas sobre máquinas e modelos'
          }
        >
          {/* Avatar com destaque nobre ou Ícone X de fechar */}
          <div className="relative shrink-0">
            {open ? (
              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-white/15 flex items-center justify-center text-white transition-transform duration-200 rotate-0">
                <X className="w-5 h-5 text-white" />
              </div>
            ) : (
              <div className="relative">
                {/* Moldura circular com anel duplo sutil (dourado sóbrio + verde escuro) para valorizar a foto */}
                <div className="rounded-full p-0.5 bg-gradient-to-br from-amber-300/60 via-amber-200/30 to-emerald-400/40 shadow-sm">
                  <img
                    src={benerTechAvatar}
                    alt="Bener Tech I.A"
                    className="w-11 h-11 sm:w-12 sm:h-12 rounded-full object-cover shrink-0 ring-1 ring-[#0b3c26]/60 shadow-md"
                  />
                </div>
                {/* Ponto sutil de status online/offline/checking estilo chat social */}
                <span
                  className={cn(
                    'absolute bottom-0 right-0 w-3 h-3 border-2 border-[#0b3c26] rounded-full shadow-xs transition-colors duration-300',
                    aiStatus === 'online' && 'bg-emerald-400',
                    aiStatus === 'offline' && 'bg-rose-400/90 border-[#0b3c26]',
                    aiStatus === 'checking' && 'bg-amber-300 animate-pulse',
                  )}
                  aria-hidden="true"
                />
              </div>
            )}
          </div>

          <div className="flex flex-col items-start leading-tight select-none whitespace-nowrap">
            <span className="text-sm sm:text-[15px] font-bold tracking-tight text-white drop-shadow-xs">
              {open ? 'Fechar' : 'Bener Tech I.A'}
            </span>
            {!open && (
              <span
                className={cn(
                  'text-[10px] sm:text-[11px] font-medium tracking-normal transition-colors duration-200',
                  aiStatus === 'online' && 'text-emerald-200/90',
                  aiStatus === 'offline' && 'text-rose-200/90',
                  aiStatus === 'checking' && 'text-amber-200/90',
                )}
              >
                {aiStatus === 'online' && 'Online • Bener Tech I.A'}
                {aiStatus === 'offline' && 'Offline • sem conexão com a IA'}
                {aiStatus === 'checking' && 'Verificando...'}
              </span>
            )}
          </div>
        </button>
      </div>

      {/* Janela do Chat com animação refinada, orgânica e fluida ("o dobro de suavidade") */}
      {rendered && (
        <div
          ref={chatWindowRef}
          role="dialog"
          aria-label="Chatbot Bener Tech I.A"
          style={{
            transformOrigin: 'bottom right',
            transitionProperty: 'transform, opacity, filter',
            transitionDuration: animating ? '550ms' : '600ms',
            transitionTimingFunction: animating
              ? 'cubic-bezier(0.22, 1, 0.36, 1)'
              : 'cubic-bezier(0.25, 0.1, 0.25, 1)',
            transform: animating ? 'translateY(0) scale(1)' : 'translateY(40px) scale(0.88)',
            opacity: animating ? 1 : 0,
            filter: animating ? 'blur(0px)' : 'blur(8px)',
            pointerEvents: animating ? 'auto' : 'none',
            willChange: 'transform, opacity, filter',
          }}
          className={cn(
            'fixed bottom-20 right-4 sm:bottom-22 sm:right-6 z-50',
            'w-[calc(100vw-2rem)] sm:w-[440px] max-h-[calc(100vh-6.5rem)] h-[580px]',
            'bg-card border border-border/80 rounded-2xl flex flex-col overflow-hidden',
            // Sombra marcante e sofisticada de janela flutuante com leve matiz verde Bener
            'shadow-[0_20px_50px_rgba(11,60,38,0.22),0_4px_16px_rgba(0,0,0,0.1)]',
          )}
        >
          {/* Header com transição suave interna escalonada */}
          <div
            className={cn(
              'flex items-center gap-3 p-3.5 sm:p-4 border-b bg-gradient-to-r from-[#0b3c26] to-[#0d4a2f] text-white shrink-0 shadow-xs',
              'transition-[opacity,transform] duration-300 ease-out',
              animating
                ? 'opacity-100 translate-y-0 delay-100'
                : 'opacity-0 -translate-y-1 delay-0',
            )}
          >
            <div className="relative shrink-0">
              <div className="rounded-full p-0.5 bg-gradient-to-br from-amber-300/70 via-amber-200/40 to-emerald-300/50 shadow-md">
                <img
                  src={benerTechAvatar}
                  alt="Bener Tech I.A"
                  className="w-12 h-12 rounded-full object-cover shrink-0 ring-2 ring-[#0b3c26]/60 shadow-sm"
                />
              </div>
              <span
                className={cn(
                  'absolute bottom-0 right-0 w-3 h-3 border-2 border-[#0b3c26] rounded-full shadow-xs transition-colors duration-300',
                  aiStatus === 'online' && 'bg-emerald-400',
                  aiStatus === 'offline' && 'bg-rose-400/90',
                  aiStatus === 'checking' && 'bg-amber-300 animate-pulse',
                )}
                aria-hidden="true"
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold leading-tight text-white truncate drop-shadow-xs">
                  Bener Tech I.A
                </h3>
                <span
                  className={cn(
                    'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border shrink-0 transition-colors',
                    aiStatus === 'online' &&
                      'bg-emerald-400/20 text-emerald-200 border-emerald-400/30',
                    aiStatus === 'offline' && 'bg-rose-500/20 text-rose-200 border-rose-400/30',
                    aiStatus === 'checking' && 'bg-amber-400/20 text-amber-200 border-amber-400/30',
                  )}
                >
                  {aiStatus === 'online' && 'Online'}
                  {aiStatus === 'offline' && 'Offline'}
                  {aiStatus === 'checking' && 'Verificando...'}
                </span>
              </div>
              <p className="text-xs text-white/85 leading-tight mt-0.5 truncate">
                {aiStatus === 'offline' ? 'Offline • sem conexão com o catálogo' : 'Chatbot'}
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {messages.length > 0 && (
                <button
                  type="button"
                  onClick={handleNewConversation}
                  disabled={loading}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium cursor-pointer',
                    'bg-white/15 hover:bg-white/25 active:scale-95 text-white transition-all',
                    'border border-white/20 shadow-2xs select-none disabled:opacity-40 disabled:cursor-not-allowed',
                  )}
                  title="Começar uma nova conversa limpa"
                  aria-label="Nova conversa"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Nova conversa</span>
                  <span className="sm:hidden">Recomeçar</span>
                </button>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setOpen(false)}
                className="h-8 w-8 text-white hover:bg-white/20 hover:text-white shrink-0 rounded-full transition-colors cursor-pointer"
                aria-label="Fechar Bener Tech I.A"
                title="Fechar Bener Tech I.A (ESC)"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Messages / suggestions area com leve fade-in natural */}
          <div
            ref={scrollRef}
            className={cn(
              'flex-1 overflow-y-auto p-3.5 space-y-3 min-h-[220px] will-change-scroll',
              'transition-[opacity,transform] duration-300 ease-out',
              animating
                ? 'opacity-100 translate-y-0 delay-150'
                : 'opacity-0 translate-y-1.5 delay-0',
            )}
          >
            {messages.length === 0 && (
              <div className="space-y-3 pt-1">
                <div className="p-3.5 rounded-xl bg-muted/60 border text-xs leading-relaxed text-foreground flex items-start gap-3">
                  <div className="relative shrink-0 mt-0.5">
                    <div className="rounded-full p-0.5 bg-gradient-to-br from-amber-400/50 via-emerald-600/30 to-emerald-700/50 shadow-sm">
                      <img
                        src={benerTechAvatar}
                        alt="Bener Tech I.A"
                        className="w-9 h-9 rounded-full object-cover shrink-0 ring-1 ring-border"
                      />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm mb-1 text-foreground">
                      Olá! Eu sou a Bener Tech I.A.
                    </p>
                    <p className="text-muted-foreground text-xs leading-relaxed">
                      Estou aqui para te ajudar a encontrar a máquina certa para o seu cliente,
                      consultar especificações, marcas e versões ativas para propostas.
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between px-1">
                  <p className="text-xs font-semibold text-muted-foreground">
                    Perguntas sugeridas para você:
                  </p>
                </div>

                <div className="space-y-2">
                  {dynamicSuggestions.map((q) => (
                    <button
                      key={q}
                      onClick={() => handleSend(q)}
                      className="block w-full text-left text-xs p-2.5 rounded-xl border bg-card hover:bg-muted/70 hover:border-[#0b3c26]/50 transition-colors shadow-xs cursor-pointer leading-snug"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div
                key={i}
                className={cn(
                  'flex items-start gap-2.5',
                  msg.role === 'user' ? 'justify-end' : 'justify-start',
                )}
              >
                {msg.role === 'assistant' && (
                  <div className="relative shrink-0 mt-0.5">
                    <div className="rounded-full p-0.5 bg-gradient-to-br from-amber-400/40 via-emerald-600/30 to-emerald-700/50 shadow-xs">
                      <img
                        src={benerTechAvatar}
                        alt="Bener Tech I.A"
                        className="w-7 h-7 rounded-full object-cover shrink-0 ring-1 ring-border/80"
                      />
                    </div>
                  </div>
                )}
                <div
                  className={cn(
                    'text-xs rounded-xl p-3 whitespace-pre-line break-words leading-relaxed max-w-[85%]',
                    msg.role === 'user' &&
                      'bg-[#0b3c26] text-white shadow-xs ml-auto flex flex-col items-end gap-1.5',
                    msg.role === 'assistant' &&
                      msg.isError &&
                      'bg-amber-500/10 text-amber-900 dark:text-amber-200 border border-amber-500/30 shadow-xs',
                    msg.role === 'assistant' &&
                      !msg.isError &&
                      'bg-muted/80 text-foreground border shadow-xs w-full max-w-[95%] sm:max-w-[92%]',
                  )}
                >
                  {/* Chip de anexo na mensagem do usuário */}
                  {msg.role === 'user' && msg.attachment && (
                    <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-white/15 border border-white/20 text-white text-[11px] font-medium max-w-full select-none shadow-2xs">
                      {msg.attachment.isImage || msg.attachment.previewUrl ? (
                        <div className="flex items-center gap-2 min-w-0">
                          {msg.attachment.previewUrl ? (
                            <img
                              src={msg.attachment.previewUrl}
                              alt="Anexo"
                              className="w-7 h-7 rounded object-cover border border-white/30 shrink-0 shadow-2xs"
                            />
                          ) : (
                            <ImageIcon className="w-3.5 h-3.5 shrink-0 opacity-90 text-amber-200" />
                          )}
                          <div className="flex flex-col min-w-0">
                            <span
                              className="truncate max-w-[170px] sm:max-w-[220px]"
                              title={msg.attachment.fileName}
                            >
                              {msg.attachment.fileName}
                            </span>
                            <span className="text-[9px] opacity-75">
                              Foto / Imagem técnica • {formatFileSize(msg.attachment.fileSize)}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 min-w-0">
                          <FileText className="w-3.5 h-3.5 shrink-0 opacity-90 text-amber-200" />
                          <span
                            className="truncate max-w-[190px] sm:max-w-[240px]"
                            title={msg.attachment.fileName}
                          >
                            {msg.attachment.fileName}
                          </span>
                          <span className="text-[9px] opacity-75 shrink-0">
                            ({formatFileSize(msg.attachment.fileSize)})
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {msg.role === 'assistant' && !msg.isError ? (
                    <AssistantMessageBody content={msg.content} tableData={msg.tableData} />
                  ) : (
                    <div className="w-full text-left">{msg.content}</div>
                  )}

                  {/* Avaliação 👍 / 👎 discreta abaixo de cada resposta bem-sucedida do assistente */}
                  {msg.role === 'assistant' && !msg.isError && (
                    <div className="pt-1.5 mt-1 border-t border-border/50 flex items-center justify-between gap-2 text-[11px] text-muted-foreground select-none">
                      <span className="text-[10px] text-muted-foreground/75">
                        {msg.feedback ? 'Obrigado pelo feedback!' : 'Esta resposta foi útil?'}
                      </span>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleFeedback(i, 'like')}
                          disabled={Boolean(msg.feedback)}
                          className={cn(
                            'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium transition-all cursor-pointer',
                            msg.feedback === 'like'
                              ? 'bg-emerald-600/15 text-emerald-700 dark:text-emerald-300 font-semibold border border-emerald-600/30'
                              : msg.feedback === 'dislike'
                                ? 'opacity-30 cursor-not-allowed hidden'
                                : 'hover:bg-muted text-muted-foreground hover:text-foreground active:scale-95 border border-transparent hover:border-border',
                          )}
                          title="Resposta útil"
                          aria-label="Avaliar como útil"
                        >
                          <ThumbsUp className="w-3 h-3" />
                          <span>Sim</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleFeedback(i, 'dislike')}
                          disabled={Boolean(msg.feedback)}
                          className={cn(
                            'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium transition-all cursor-pointer',
                            msg.feedback === 'dislike'
                              ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300 font-semibold border border-rose-500/30'
                              : msg.feedback === 'like'
                                ? 'opacity-30 cursor-not-allowed hidden'
                                : 'hover:bg-muted text-muted-foreground hover:text-foreground active:scale-95 border border-transparent hover:border-border',
                          )}
                          title="Resposta não ajudou"
                          aria-label="Avaliar como não útil"
                        >
                          <ThumbsDown className="w-3 h-3" />
                          <span>Não</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex items-center gap-2.5 text-xs text-muted-foreground px-2 py-1">
                <div className="rounded-full p-0.5 bg-emerald-700/20 shrink-0">
                  <img
                    src={benerTechAvatar}
                    alt="Bener Tech I.A"
                    className="w-6 h-6 rounded-full object-cover shrink-0 ring-1 ring-border/60 opacity-90 shadow-xs"
                  />
                </div>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#0b3c26]" />
                <span>
                  {readingImageStatus
                    ? 'Analisando especificações da imagem e consultando o catálogo...'
                    : readingDocumentStatus
                      ? 'Lendo o documento e consultando o catálogo de máquinas...'
                      : 'Bener Tech I.A consultando o catálogo de máquinas da Bener...'}
                </span>
              </div>
            )}

            {messages.length > 0 && messages[messages.length - 1].isError && !loading && (
              <div className="flex justify-start px-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user')
                    if (lastUserMsg) handleSend(lastUserMsg.content)
                  }}
                  className="text-xs h-7 gap-1.5 text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  Tentar novamente
                </Button>
              </div>
            )}
          </div>

          {/* Input area com transição suave para compor a sensação de profundidade */}
          <div
            className={cn(
              'p-3 border-t bg-muted/20 shrink-0 space-y-2',
              'transition-[opacity,transform] duration-300 ease-out',
              animating ? 'opacity-100 translate-y-0 delay-200' : 'opacity-0 translate-y-1 delay-0',
            )}
          >
            {/* Input nativo de arquivo oculto (documentos ou fotos/prints de especificações técnicas) */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg,.webp,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,image/png,image/jpeg,image/webp,image/*"
              className="hidden"
              onChange={handleFileChange}
              disabled={loading || processingFile}
            />

            {/* Aviso de erro amigável de arquivo (se houver) */}
            {fileError && (
              <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md text-[11px] bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20">
                <span className="truncate">{fileError}</span>
                <button
                  type="button"
                  onClick={() => setFileError(null)}
                  className="shrink-0 hover:opacity-75 cursor-pointer p-0.5"
                  title="Fechar aviso"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}

            {/* Chip de arquivo anexado pendente para envio */}
            {attachedFile && (
              <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-600/30 text-emerald-900 dark:text-emerald-200 shadow-2xs">
                <div className="flex items-center gap-2.5 min-w-0">
                  {attachedFile.isImage && attachedFile.previewUrl ? (
                    <div className="relative shrink-0">
                      <img
                        src={attachedFile.previewUrl}
                        alt="Prévia do anexo"
                        className="w-9 h-9 rounded-md object-cover border border-emerald-600/30 shadow-xs"
                      />
                    </div>
                  ) : (
                    <div className="p-1.5 rounded-md bg-[#0b3c26]/10 dark:bg-emerald-400/10 shrink-0">
                      <FileText className="w-4 h-4 text-[#0b3c26] dark:text-emerald-400" />
                    </div>
                  )}
                  <div className="min-w-0 flex flex-col">
                    <span
                      className="text-[11px] font-semibold leading-tight truncate max-w-[220px] sm:max-w-[260px]"
                      title={attachedFile.fileName}
                    >
                      {attachedFile.fileName}
                    </span>
                    <span className="text-[10px] text-muted-foreground leading-tight mt-0.5">
                      {attachedFile.isImage
                        ? `Imagem técnica pronta para visão • ${formatFileSize(attachedFile.fileSize)}`
                        : `${formatFileSize(attachedFile.fileSize)} • ${attachedFile.fileType}${attachedFile.charCount > 0 ? ` • ~${attachedFile.charCount} caracteres` : ''}`}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleRemoveAttachment}
                  className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors shrink-0 cursor-pointer"
                  title="Remover anexo"
                  aria-label="Remover anexo"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            <div className="flex gap-1.5 items-end">
              {/* Botão de anexar arquivo técnico (PDF, DOCX, Imagem técnica) */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={loading || processingFile}
                className={cn(
                  'h-9 w-9 rounded-lg border border-input bg-background flex items-center justify-center shrink-0 transition-colors shadow-2xs',
                  'hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer',
                  'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                  attachedFile && 'border-[#0b3c26] text-[#0b3c26] bg-[#0b3c26]/5',
                  (loading || processingFile) && 'opacity-50 cursor-not-allowed',
                )}
                title="Anexar documento ou imagem técnica (PDF, DOCX, TXT, Fotos de plaqueta ou catálogo - até 10 MB)"
                aria-label="Anexar documento ou imagem técnica"
              >
                {processingFile ? (
                  <Loader2 className="w-4 h-4 animate-spin text-[#0b3c26]" />
                ) : (
                  <Paperclip className="w-4 h-4 rotate-45" />
                )}
              </button>

              <div className="flex-1 relative">
                <Input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={
                    attachedFile
                      ? 'Adicione uma pergunta sobre o anexo (opcional)...'
                      : 'Pergunte sobre marcas, modelos, versões...'
                  }
                  className="text-xs pr-9 h-9"
                  disabled={loading}
                  maxLength={2000}
                />
              </div>

              <Button
                size="icon"
                onClick={() => handleSend()}
                disabled={(!input.trim() && !attachedFile) || loading || processingFile}
                className="h-9 w-9 bg-[#0b3c26] hover:bg-[#0e4b30] text-white shrink-0 cursor-pointer shadow-xs disabled:opacity-40"
                aria-label="Enviar mensagem para Bener Tech I.A"
              >
                <Send className="w-3.5 h-3.5" />
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground text-center pt-0.5">
              Bener Tech I.A • Base de conhecimento atualizada do catálogo de máquinas
            </p>
          </div>
        </div>
      )}
    </>
  )
}
