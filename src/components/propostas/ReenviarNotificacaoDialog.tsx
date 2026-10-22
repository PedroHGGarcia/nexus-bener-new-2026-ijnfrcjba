import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Mail,
  MessageSquare,
  Send,
  AlertTriangle,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
  Phone,
  Sparkles,
  Info,
} from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { formatPhoneBR } from '@/lib/cpf-cnpj'
import { formatDate } from '@/lib/format'
import {
  normalizePhoneToE164,
  resolveProposalClientPhone,
  buildDefaultWhatsAppMessage,
  sendProposalNotification,
  type NotificationChannel,
  type ClientPhoneCandidate,
} from '@/services/proposal-whatsapp'
import { getPropostaEmailEnvios, type PropostaEmailEnvioRecord } from '@/services/proposal-email'
import type { PropostaWithRelations } from '@/types/proposta'

export interface ReenviarNotificacaoDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  proposta: PropostaWithRelations | null
  onSuccess?: () => void
}

export function ReenviarNotificacaoDialog({
  open,
  onOpenChange,
  proposta,
  onSuccess,
}: ReenviarNotificacaoDialogProps) {
  const [loadingPhone, setLoadingPhone] = useState(false)
  const [phoneInfo, setPhoneInfo] = useState<ClientPhoneCandidate | null>(null)
  const [celularInput, setCelularInput] = useState('')
  const [emailInput, setEmailInput] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [history, setHistory] = useState<PropostaEmailEnvioRecord[]>([])

  const tokenOrId = proposta?.public_token || proposta?.id || ''
  const linkProposta = useMemo(() => {
    if (!tokenOrId) return ''
    return `${window.location.origin}/visualizar-proposta/${tokenOrId}`
  }, [tokenOrId])

  const contatoNome = useMemo(() => {
    if (!proposta) return 'Cliente'
    return (
      phoneInfo?.nomeContato ||
      proposta.contato ||
      proposta.clientes?.contato ||
      proposta.clientes?.fantasia ||
      proposta.cliente_original ||
      'Cliente'
    )
  }, [proposta, phoneInfo])

  const numeroProposta = useMemo(() => {
    if (!proposta) return ''
    return proposta.numero_proposta || proposta.id
  }, [proposta])

  // Carrega histórico de envios
  const loadHistory = useCallback(async (propostaId: string) => {
    setHistoryLoading(true)
    try {
      const res = await getPropostaEmailEnvios(propostaId)
      if (res.ok && res.data) {
        setHistory(res.data)
      }
    } catch (err) {
      console.warn('[ReenviarNotificacaoDialog] Erro ao buscar histórico:', err)
    } finally {
      setHistoryLoading(false)
    }
  }, [])

  // Inicialização ao abrir modal
  useEffect(() => {
    if (!open || !proposta) return

    // Default do campo de e-mail
    const initialEmails = proposta.emails_notificacao || proposta.clientes?.email || ''
    setEmailInput(initialEmails)

    // Mensagem WhatsApp padrão
    const defaultMsg = buildDefaultWhatsAppMessage({
      contatoNome,
      numeroProposta,
      linkProposta,
    })
    setMensagem(defaultMsg)

    // Busca dados do telefone do cliente
    setLoadingPhone(true)
    resolveProposalClientPhone(proposta)
      .then((resolved) => {
        setPhoneInfo(resolved)
        if (resolved.celular) {
          setCelularInput(formatPhoneBR(resolved.celular))
        } else {
          setCelularInput('')
        }
      })
      .finally(() => {
        setLoadingPhone(false)
      })

    // Carrega histórico de envios
    loadHistory(proposta.id)
  }, [open, proposta, linkProposta, numeroProposta, contatoNome, loadHistory])

  // Normalização do celular digitado
  const normalizedPhone = useMemo(() => {
    return normalizePhoneToE164(celularInput)
  }, [celularInput])

  const hasValidPhone = normalizedPhone.ok && Boolean(normalizedPhone.e164)

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneBR(e.target.value)
    setCelularInput(formatted)
  }

  const handleResetMessage = () => {
    setMensagem(
      buildDefaultWhatsAppMessage({
        contatoNome,
        numeroProposta,
        linkProposta,
      }),
    )
  }

  const handleSend = async (canal: NotificationChannel) => {
    if (!proposta) return

    // Validações prévias
    if (canal === 'whatsapp' || canal === 'ambos') {
      if (!hasValidPhone) {
        toast({
          title: 'Número de WhatsApp inválido',
          description:
            normalizedPhone.error || 'Informe um celular com DDD válido no padrão (DD) 9XXXX-XXXX.',
          variant: 'destructive',
        })
        return
      }
      if (!mensagem.trim()) {
        toast({
          title: 'Mensagem vazia',
          description: 'A mensagem de WhatsApp não pode ficar em branco.',
          variant: 'destructive',
        })
        return
      }
    }

    if (canal === 'email' || canal === 'ambos') {
      const emailList = emailInput
        .split(/[,;\s\n\r]+/)
        .map((e) => e.trim().toLowerCase())
        .filter((e) => e && e.includes('@'))
      if (emailList.length === 0) {
        toast({
          title: 'E-mail destinatário obrigatório',
          description: 'Informe pelo menos um e-mail válido para envio.',
          variant: 'destructive',
        })
        return
      }
    }

    setIsSending(true)
    try {
      const emailList = emailInput
        .split(/[,;\s\n\r]+/)
        .map((e) => e.trim().toLowerCase())
        .filter((e) => e && e.includes('@'))

      const res = await sendProposalNotification({
        proposta,
        canal,
        whatsapp:
          canal === 'whatsapp' || canal === 'ambos'
            ? {
                numero_e164: normalizedPhone.e164!,
                contato_nome: contatoNome,
                mensagem,
              }
            : undefined,
        email:
          canal === 'email' || canal === 'ambos'
            ? {
                destinatarios: emailList,
              }
            : undefined,
      })

      if (res.ok) {
        const canalLabel =
          canal === 'ambos' ? 'E-mail e WhatsApp' : canal === 'whatsapp' ? 'WhatsApp' : 'E-mail'
        toast({
          title: 'Notificação enviada com sucesso!',
          description: `Disparo realizado via ${canalLabel}. O cliente receberá a proposta em instantes.`,
        })
        loadHistory(proposta.id)
        if (onSuccess) onSuccess()
        // Fecha modal após breve confirmação
        setTimeout(() => {
          onOpenChange(false)
        }, 1200)
      } else {
        const errorDesc =
          'error' in res ? res.error : 'Ocorreu um erro ao comunicar com os canais de envio.'
        toast({
          title: 'Falha no disparo da notificação',
          description: errorDesc || 'Ocorreu um erro ao comunicar com os canais de envio.',
          variant: 'destructive',
        })
        loadHistory(proposta.id)
      }
    } catch (err) {
      toast({
        title: 'Erro inesperado',
        description: err instanceof Error ? err.message : 'Falha ao processar envio.',
        variant: 'destructive',
      })
    } finally {
      setIsSending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto p-6 sm:p-7">
        <DialogHeader className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Send className="h-5 w-5" />
            </span>
            <DialogTitle className="text-xl sm:text-2xl font-bold tracking-tight">
              Enviar Proposta ao Cliente
            </DialogTitle>
          </div>
          <DialogDescription className="text-sm text-muted-foreground">
            Escolha o canal desejado para notificar o cliente sobre a proposta comercial{' '}
            <span className="font-semibold text-foreground">{numeroProposta}</span>.
          </DialogDescription>
        </DialogHeader>

        {/* Banner de aviso caso cliente não possua celular cadastrado */}
        {!loadingPhone && !hasValidPhone && (
          <div
            className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3.5 text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-200"
            role="alert"
          >
            <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
            <div className="text-sm space-y-0.5">
              <p className="font-semibold">Cliente sem celular cadastrado ou inválido</p>
              <p className="text-xs text-amber-800 dark:text-amber-300">
                Para enviar via WhatsApp, digite o celular abaixo com DDD e o 9º dígito (ex.: (19)
                99517-5261).
              </p>
            </div>
          </div>
        )}

        <div className="space-y-5 py-2">
          {/* Seção WhatsApp */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 p-4 space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                  <MessageSquare className="h-4 w-4" />
                </span>
                <span className="text-sm font-semibold text-foreground">
                  Canal WhatsApp (Notificação Direta)
                </span>
              </div>
              {phoneInfo && phoneInfo.origem !== 'nenhum' && (
                <Badge variant="outline" className="text-[11px] font-normal text-muted-foreground">
                  {phoneInfo.labelOrigem}
                </Badge>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label
                  htmlFor="whatsapp-numero"
                  className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 mb-1.5"
                >
                  <Phone className="w-3.5 h-3.5" /> Número do Celular (com DDD)
                </Label>
                <Input
                  id="whatsapp-numero"
                  placeholder="(19) 99517-5261"
                  value={celularInput}
                  onChange={handlePhoneChange}
                  className="h-11 text-base font-medium input-bener"
                  maxLength={15}
                  disabled={isSending}
                />
                {celularInput && !normalizedPhone.ok && (
                  <p className="text-[11px] text-destructive mt-1 font-medium">
                    {normalizedPhone.error}
                  </p>
                )}
                {normalizedPhone.ok && normalizedPhone.e164 && (
                  <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1 font-medium flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 inline" /> E.164: +{normalizedPhone.e164}
                  </p>
                )}
              </div>

              <div>
                <Label
                  htmlFor="whatsapp-contato"
                  className="text-xs font-medium text-muted-foreground mb-1.5 block"
                >
                  Nome do Contato
                </Label>
                <Input
                  id="whatsapp-contato"
                  value={contatoNome}
                  readOnly
                  disabled
                  className="h-11 text-base bg-muted/60 text-muted-foreground"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <Label
                  htmlFor="whatsapp-mensagem"
                  className="text-xs font-medium text-muted-foreground"
                >
                  Mensagem (editável)
                </Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleResetMessage}
                  className="h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground gap-1"
                >
                  <RefreshCw className="w-3 h-3" /> Restaurar texto padrão
                </Button>
              </div>
              <Textarea
                id="whatsapp-mensagem"
                value={mensagem}
                onChange={(e) => setMensagem(e.target.value)}
                rows={3}
                className="text-sm leading-relaxed resize-none"
                placeholder="Digite a mensagem que o cliente receberá no WhatsApp..."
                disabled={isSending}
              />
              <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
                <Info className="w-3 h-3" /> O link seguro com token de validação pública é incluído
                automaticamente.
              </p>
            </div>
          </div>

          {/* Seção E-mail */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                <Mail className="h-4 w-4" />
              </span>
              <span className="text-sm font-semibold text-foreground">
                Canal E-mail (Destinatários de Notificação)
              </span>
            </div>

            <div>
              <Label
                htmlFor="email-destinatarios"
                className="text-xs font-medium text-muted-foreground mb-1.5 block"
              >
                Destinatários (separar múltiplos por vírgula ou ponto-e-vírgula)
              </Label>
              <Input
                id="email-destinatarios"
                type="text"
                placeholder="cliente@empresa.com.br, compras@empresa.com.br"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                className="h-11 text-base input-bener"
                disabled={isSending}
              />
            </div>
          </div>

          {/* 3 Botões Grandes e Óbvios para Usabilidade Sênior */}
          <div className="space-y-2 pt-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block text-center">
              Selecione como deseja enviar:
            </Label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Botão 1: Apenas E-mail */}
              <Button
                type="button"
                variant="outline"
                size="lg"
                disabled={isSending || !emailInput.trim()}
                onClick={() => handleSend('email')}
                className="h-16 flex flex-col items-center justify-center gap-1 text-base font-semibold border-2 hover:border-blue-500 hover:bg-blue-50/50 dark:hover:bg-blue-950/30 transition-all cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Mail className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  <span>Apenas E-mail</span>
                </div>
                <span className="text-[11px] font-normal text-muted-foreground">
                  Disparo tradicional por e-mail
                </span>
              </Button>

              {/* Botão 2: Apenas WhatsApp */}
              <Button
                type="button"
                variant="outline"
                size="lg"
                disabled={isSending || !hasValidPhone}
                onClick={() => handleSend('whatsapp')}
                className="h-16 flex flex-col items-center justify-center gap-1 text-base font-semibold border-2 border-emerald-300 dark:border-emerald-700 hover:border-emerald-500 hover:bg-emerald-50/60 dark:hover:bg-emerald-950/40 text-emerald-900 dark:text-emerald-100 transition-all cursor-pointer disabled:opacity-50"
              >
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  <span>Apenas WhatsApp</span>
                </div>
                <span className="text-[11px] font-normal text-emerald-700/80 dark:text-emerald-300/80">
                  {hasValidPhone ? 'Mensagem instantânea' : 'Requer celular'}
                </span>
              </Button>

              {/* Botão 3: Enviar em Ambos */}
              <Button
                type="button"
                size="lg"
                disabled={isSending || !hasValidPhone || !emailInput.trim()}
                onClick={() => handleSend('ambos')}
                className="h-16 flex flex-col items-center justify-center gap-1 text-base font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-md hover:shadow-lg transition-all cursor-pointer disabled:opacity-50"
              >
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-amber-300" />
                  <span>Enviar em Ambos</span>
                </div>
                <span className="text-[11px] font-normal text-primary-foreground/80">
                  E-mail + WhatsApp juntos
                </span>
              </Button>
            </div>
            {isSending && (
              <div className="flex items-center justify-center gap-2 text-sm text-primary font-medium py-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Processando disparo de notificação...
              </div>
            )}
          </div>

          {/* Histórico dos Últimos Envios na Base do Modal */}
          <div className="border-t border-slate-200 dark:border-slate-800 pt-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" /> Histórico de Envios desta Proposta
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => proposta && loadHistory(proposta.id)}
                className="h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground gap-1"
                disabled={historyLoading}
              >
                <RefreshCw className={`w-3 h-3 ${historyLoading ? 'animate-spin' : ''}`} />{' '}
                Atualizar
              </Button>
            </div>

            {historyLoading ? (
              <div className="py-4 text-center text-xs text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin inline mr-1" /> Carregando histórico...
              </div>
            ) : history.length === 0 ? (
              <div className="py-3 text-center text-xs text-muted-foreground bg-muted/30 rounded-lg">
                Nenhum envio registrado para esta proposta ainda.
              </div>
            ) : (
              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                {history.slice(0, 5).map((h) => {
                  const isWhatsApp = (h.destinatarios || '').toLowerCase().includes('whatsapp')
                  const isSuccess = h.ok === true

                  return (
                    <div
                      key={h.id}
                      className="flex items-center justify-between text-xs p-2 rounded-md bg-muted/40 border border-slate-200/60 dark:border-slate-800/60"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {isWhatsApp ? (
                          <MessageSquare className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        ) : (
                          <Mail className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        )}
                        <span className="font-medium truncate text-foreground max-w-[240px] sm:max-w-[320px]">
                          {h.destinatarios || 'Destinatário não identificado'}
                        </span>
                        <Badge
                          variant={isSuccess ? 'outline' : 'destructive'}
                          className={`text-[10px] px-1.5 py-0 h-4 font-normal ${
                            isSuccess
                              ? 'text-emerald-700 border-emerald-300 dark:text-emerald-300 dark:border-emerald-700'
                              : ''
                          }`}
                        >
                          {isSuccess ? (
                            <span className="flex items-center gap-0.5">
                              <CheckCircle2 className="w-2.5 h-2.5" /> Sucesso
                            </span>
                          ) : (
                            <span className="flex items-center gap-0.5">
                              <XCircle className="w-2.5 h-2.5" /> Falha
                            </span>
                          )}
                        </Badge>
                      </div>

                      <span className="text-[11px] text-muted-foreground shrink-0 ml-2">
                        {formatDate(h.criado_em)}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
