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
import { Badge } from '@/components/ui/badge'
import { Mail, Send, Clock, CheckCircle2, XCircle, Loader2, RefreshCw } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { formatDate } from '@/lib/format'
import {
  sendProposalEmail,
  getPropostaEmailEnvios,
  type PropostaEmailEnvioRecord,
} from '@/services/proposal-email'
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
  const [emailInput, setEmailInput] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [history, setHistory] = useState<PropostaEmailEnvioRecord[]>([])

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

    // Carrega histórico de envios
    loadHistory(proposta.id)
  }, [open, proposta, loadHistory])

  const handleSendEmail = async () => {
    if (!proposta) return

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

    setIsSending(true)
    try {
      const res = await sendProposalEmail({
        propostaId: proposta.id,
        emails: emailList,
        event: 'created',
      })

      if (res.ok) {
        toast({
          title: 'Notificação enviada com sucesso!',
          description: 'A proposta comercial foi enviada por e-mail com sucesso.',
        })
        loadHistory(proposta.id)
        if (onSuccess) onSuccess()
        // Fecha modal após breve confirmação
        setTimeout(() => {
          onOpenChange(false)
        }, 1200)
      } else {
        const errorDesc =
          'error' in res ? res.error : 'Ocorreu um erro ao enviar a proposta por e-mail.'
        toast({
          title: 'Falha no envio de e-mail',
          description: errorDesc || 'Ocorreu um erro ao comunicar com o servidor de e-mail.',
          variant: 'destructive',
        })
        loadHistory(proposta.id)
      }
    } catch (err) {
      toast({
        title: 'Erro inesperado',
        description: err instanceof Error ? err.message : 'Falha ao processar envio por e-mail.',
        variant: 'destructive',
      })
    } finally {
      setIsSending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[92vh] overflow-y-auto p-6 sm:p-7">
        <DialogHeader className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Mail className="h-5 w-5" />
            </span>
            <DialogTitle className="text-xl sm:text-2xl font-bold tracking-tight">
              Enviar Proposta ao Cliente por E-mail
            </DialogTitle>
          </div>
          <DialogDescription className="text-sm text-muted-foreground">
            Envie a proposta comercial{' '}
            <span className="font-semibold text-foreground">{numeroProposta}</span> diretamente para
            os destinatários por e-mail.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Seção E-mail */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                <Mail className="h-4 w-4" />
              </span>
              <span className="text-sm font-semibold text-foreground">Destinatários de E-mail</span>
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

          {/* Botão de envio por E-mail */}
          <div className="space-y-2 pt-1">
            <Button
              type="button"
              size="lg"
              disabled={isSending || !emailInput.trim()}
              onClick={handleSendEmail}
              className="w-full h-12 flex items-center justify-center gap-2 text-base font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow transition-all cursor-pointer disabled:opacity-50"
            >
              {isSending ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Enviando proposta por e-mail...</span>
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  <span>Enviar ao Cliente por E-mail</span>
                </>
              )}
            </Button>
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
                  const isSuccess = h.ok === true

                  return (
                    <div
                      key={h.id}
                      className="flex items-center justify-between text-xs p-2 rounded-md bg-muted/40 border border-slate-200/60 dark:border-slate-800/60"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Mail className="w-3.5 h-3.5 text-blue-600 shrink-0" />
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
