import { useState, useEffect, useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  MessageSquare,
  ExternalLink,
  AlertTriangle,
  CheckCircle2,
  User,
  Phone,
  Loader2,
} from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import {
  buildDefaultWhatsAppMessage,
  formatPhoneForWaMe,
  resolveProposalTargetPhone,
  enviarPropostaWhatsapp,
} from '@/services/proposal-whatsapp'
import type { PropostaWithRelations } from '@/types/proposta'

export interface EnviarWhatsAppDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  proposta: PropostaWithRelations | null
}

export function EnviarWhatsAppDialog({ open, onOpenChange, proposta }: EnviarWhatsAppDialogProps) {
  const [phoneInput, setPhoneInput] = useState('')
  const [messageInput, setMessageInput] = useState('')
  const [sourceLabel, setSourceLabel] = useState('')
  const [hasNoPhoneInitially, setHasNoPhoneInitially] = useState(false)
  const [loadingInitial, setLoadingInitial] = useState(false)
  const [isSending, setIsSending] = useState(false)

  const numeroProposta = useMemo(() => {
    if (!proposta) return ''
    return proposta.numero_proposta || proposta.id
  }, [proposta])

  const publicUrl = useMemo(() => {
    if (!proposta) return ''
    const tokenOrId = proposta.public_token || proposta.id
    return `${window.location.origin}/visualizar-proposta/${tokenOrId}`
  }, [proposta])

  // Inicializa os dados quando o modal abre
  useEffect(() => {
    if (!open || !proposta) return

    let cancelled = false
    setLoadingInitial(true)

    resolveProposalTargetPhone(proposta)
      .then((resolved) => {
        if (cancelled) return

        const initialPhone = resolved.phone || ''
        setPhoneInput(initialPhone)
        setSourceLabel(resolved.sourceLabel)
        setHasNoPhoneInitially(!initialPhone.trim())

        const defaultMsg = buildDefaultWhatsAppMessage({
          contatoNome: resolved.contactName,
          numeroProposta: proposta.numero_proposta || proposta.id,
          linkProposta: publicUrl,
        })
        setMessageInput(defaultMsg)
      })
      .catch((err) => {
        console.warn('[EnviarWhatsAppDialog] erro ao resolver telefone:', err)
        if (!cancelled) {
          setHasNoPhoneInitially(true)
          setPhoneInput('')
          setSourceLabel('Telefone não identificado')
          const defaultMsg = buildDefaultWhatsAppMessage({
            contatoNome: 'Cliente',
            numeroProposta: proposta.numero_proposta || proposta.id,
            linkProposta: publicUrl,
          })
          setMessageInput(defaultMsg)
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingInitial(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [open, proposta, publicUrl])

  const cleanPhonePreview = useMemo(() => {
    return formatPhoneForWaMe(phoneInput)
  }, [phoneInput])

  const isPhoneValid = cleanPhonePreview.length >= 10

  const handleSend = async () => {
    if (!proposta) return

    if (!cleanPhonePreview || !isPhoneValid) {
      toast({
        title: 'Número de telefone obrigatório',
        description: 'Informe um número com DDD para abrir o WhatsApp (ex.: (11) 99999-9999).',
        variant: 'destructive',
      })
      return
    }

    if (!messageInput.trim()) {
      toast({
        title: 'Mensagem obrigatória',
        description: 'A mensagem de texto não pode ficar vazia.',
        variant: 'destructive',
      })
      return
    }

    setIsSending(true)
    try {
      const result = await enviarPropostaWhatsapp({
        propostaId: proposta.id,
        numeroDestino: phoneInput,
        mensagem: messageInput,
        propostaNumero: numeroProposta,
      })

      if (result.ok) {
        toast({
          title: 'WhatsApp aberto!',
          description: `Conversa iniciada para o número +${cleanPhonePreview}.`,
        })
        onOpenChange(false)
      } else {
        toast({
          title: 'Não foi possível abrir o WhatsApp',
          description: result.error || 'Verifique o número digitado e tente novamente.',
          variant: 'destructive',
        })
      }
    } catch (err) {
      toast({
        title: 'Erro ao abrir WhatsApp',
        description: err instanceof Error ? err.message : 'Falha ao processar envio.',
        variant: 'destructive',
      })
    } finally {
      setIsSending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto p-6 sm:p-7">
        <DialogHeader className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <MessageSquare className="h-5 w-5 fill-emerald-600/20" />
            </span>
            <DialogTitle className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              Enviar Proposta por WhatsApp
            </DialogTitle>
          </div>
          <DialogDescription className="text-sm text-muted-foreground">
            Confirme ou edite o número e a mensagem antes de abrir a conversa no WhatsApp.
          </DialogDescription>
        </DialogHeader>

        {loadingInitial ? (
          <div className="py-10 flex flex-col items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
            <span className="text-xs">Carregando dados do destinatário...</span>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            {/* Aviso quando não há telefone pré-cadastrado */}
            {hasNoPhoneInitially && (
              <div className="rounded-lg border border-amber-200 bg-amber-50/90 dark:border-amber-800 dark:bg-amber-950/40 p-3 text-amber-900 dark:text-amber-200 text-xs flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="font-semibold">Nenhum telefone cadastrado para este cliente</p>
                  <p className="text-amber-800 dark:text-amber-300">
                    Cadastre um telefone no cliente ou digite o número abaixo para realizar a
                    demonstração agora.
                  </p>
                </div>
              </div>
            )}

            {/* Campo Telefone */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label
                  htmlFor="whatsapp-phone"
                  className="text-xs font-semibold text-foreground flex items-center gap-1.5"
                >
                  <Phone className="w-3.5 h-3.5 text-emerald-600" /> Número de Destino (WhatsApp) *
                </Label>
                {sourceLabel && (
                  <Badge variant="outline" className="text-[10px] font-normal px-1.5 py-0">
                    {sourceLabel}
                  </Badge>
                )}
              </div>
              <Input
                id="whatsapp-phone"
                type="text"
                placeholder="Ex: (11) 99999-9999 ou 11999999999"
                value={phoneInput}
                onChange={(e) => setPhoneInput(e.target.value)}
                className="h-10 text-sm font-medium"
              />
              <div className="flex items-center justify-between text-[11px] text-muted-foreground px-0.5">
                <span>
                  {cleanPhonePreview ? (
                    <span className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-medium">
                      <CheckCircle2 className="w-3 h-3" /> wa.me/+{cleanPhonePreview}
                    </span>
                  ) : (
                    'Digite DDD + número do celular'
                  )}
                </span>
                <span className="text-[10px]">Prefixo DDI 55 aplicado automaticamente</span>
              </div>
            </div>

            {/* Campo Mensagem */}
            <div className="space-y-1.5">
              <Label
                htmlFor="whatsapp-message"
                className="text-xs font-semibold text-foreground flex items-center gap-1.5"
              >
                <User className="w-3.5 h-3.5 text-emerald-600" /> Mensagem a ser enviada
              </Label>
              <Textarea
                id="whatsapp-message"
                rows={4}
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                placeholder="Digite a mensagem para o cliente..."
                className="resize-y text-xs sm:text-sm leading-relaxed min-h-[96px]"
              />
              <p className="text-[11px] text-muted-foreground">
                Você pode personalizar a saudação e o texto. O link público permite ao cliente
                visualizar a proposta na íntegra.
              </p>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSending}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleSend}
            disabled={isSending || loadingInitial || !isPhoneValid}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-2 shadow-sm cursor-pointer"
          >
            {isSending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Abrindo WhatsApp...</span>
              </>
            ) : (
              <>
                <MessageSquare className="w-4 h-4 fill-white" />
                <span>Abrir no WhatsApp</span>
                <ExternalLink className="w-3.5 h-3.5 opacity-80" />
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
