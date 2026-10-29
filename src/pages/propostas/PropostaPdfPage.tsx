import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@/components/ui/select'
import { Printer, ArrowLeft, Link as LinkIcon, Check, Send } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { useAuth } from '@/hooks/use-auth'
import { LoadingState, ErrorState } from '@/components/StateViews'
import { SignatureSection } from '@/components/propostas/SignatureSection'
import { ProposalDocument } from '@/components/propostas/ProposalDocument'
import { ReenviarNotificacaoDialog } from '@/components/propostas/ReenviarNotificacaoDialog'
import { fetchPropostaById, updatePropostaStatus } from '@/services/propostas'
import { sendProposalEmail } from '@/services/proposal-email'
import { useProposalPrintTitle } from '@/hooks/use-proposal-print-title'
import { PropostaWithRelations, STATUS_FLOW, STATUS_LABELS } from '@/types/proposta'

export default function PropostaPdfPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [proposal, setProposal] = useState<PropostaWithRelations | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)
  const [notifyDialogOpen, setNotifyDialogOpen] = useState(false)

  // Names the saved PDF after the proposal number (Proposta-<numero>.pdf)
  useProposalPrintTitle(proposal)

  const handleCopyLink = () => {
    if (!proposal) return
    const tokenOrId = proposal.public_token || proposal.id
    const publicUrl = `${window.location.origin}/visualizar-proposta/${tokenOrId}`
    navigator.clipboard.writeText(publicUrl)
    setCopiedLink(true)
    toast({
      title: 'Link público copiado!',
      description: 'O link protegido por token foi copiado para a área de transferência.',
    })
    setTimeout(() => setCopiedLink(false), 2000)
  }

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const data = await fetchPropostaById(id!)
      if (!data) {
        setError(true)
        return
      }
      setProposal(data)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleStatusChange = async (newStatus: string) => {
    if (!proposal) return
    const statusAnterior = proposal.status
    try {
      await updatePropostaStatus(proposal.id, newStatus, user?.name)
      setProposal({ ...proposal, status: newStatus })
      toast({ title: 'Status atualizado com sucesso' })

      // Dispara e-mail de notificação de mudança de status para os destinatários cadastrados
      const notificationEmails = proposal.emails_notificacao
        ? proposal.emails_notificacao
            .split(/[,;\s\n\r]+/)
            .map((e) => e.trim().toLowerCase())
            .filter((e) => e && e.includes('@'))
        : []

      sendProposalEmail({
        propostaId: proposal.id,
        emails: notificationEmails,
        event: 'status_changed',
        novoStatus: newStatus,
        statusAnterior,
      })
        .then((result) => {
          if (result.ok && result.data?.sent) {
            toast({
              title: 'Notificação de status enviada',
              description: `Notificação enviada com sucesso para os destinatários da proposta.`,
            })
          } else if (result.ok && result.data?.skipped) {
            // No notification email filled: no proposal status notification sent
            toast({
              title: 'Status atualizado',
              description: 'Nenhum e-mail de notificação informado na proposta. Envio desativado.',
            })
          }
        })
        .catch((emailErr) => {
          console.warn(
            '[PropostaPdfPage] Falha ao enviar notificação de mudança de status:',
            emailErr,
          )
        })
    } catch (err) {
      toast({
        title: 'Erro ao atualizar status',
        description: err instanceof Error ? err.message : '',
        variant: 'destructive',
      })
    }
  }

  if (loading) return <LoadingState count={4} />
  if (error || !proposal) return <ErrorState message="Proposta não encontrada" onRetry={loadData} />

  // Ponto 18 & Ponto 6: Validação de bloqueio de documento/PDF se pacote sem tipo de proposta
  let pacotePdfBlockReason: string | null = null
  if (proposal.is_pacote) {
    const rawItens = proposal.itens_snapshot as Array<{
      tipo_proposta?: string
      nome?: string
    }> | null
    const itens = Array.isArray(rawItens) ? rawItens : []
    if (itens.length > 0) {
      const firstTipo =
        (typeof itens[0]?.tipo_proposta === 'string' && itens[0].tipo_proposta.trim()) ||
        (typeof proposal.tipo_proposta === 'string' && proposal.tipo_proposta.trim()) ||
        ''
      if (!firstTipo) {
        pacotePdfBlockReason =
          'Geração de PDF bloqueada: a primeira máquina do pacote não possui tipo de proposta definido.'
      } else {
        const getGroup = (t: string) => {
          const lower = t.toLowerCase()
          if (lower.includes('importacao direta') || lower.includes('importação direta'))
            return 'Importação Direta'
          if (lower.includes('nacionalizada')) return 'Nacionalizada'
          return 'Outro'
        }
        const firstGroup = getGroup(firstTipo)
        for (let i = 0; i < itens.length; i++) {
          const itTipo =
            typeof itens[i]?.tipo_proposta === 'string'
              ? itens[i].tipo_proposta!.trim()
              : i === 0
                ? firstTipo
                : ''
          if (!itTipo) {
            pacotePdfBlockReason = `Geração de PDF bloqueada: a máquina "${itens[i]?.nome || `#${i + 1}`}" do pacote não possui tipo de proposta definido.`
            break
          }
          if (getGroup(itTipo) !== firstGroup) {
            pacotePdfBlockReason =
              'Geração de PDF bloqueada: as máquinas do pacote possuem tipos de fornecimento incompatíveis.'
            break
          }
          if (itTipo !== firstTipo) {
            pacotePdfBlockReason = `Geração de PDF bloqueada: a máquina "${itens[i]?.nome || `#${i + 1}`}" do pacote não possui o tipo de proposta selecionado neste pacote (${firstTipo}).`
            break
          }
        }
      }
    }
  }

  const allowedStatuses = STATUS_FLOW[proposal.status] || []

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center bg-card p-4 rounded-lg border shadow-sm print:hidden">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/controle-propostas/propostas-criadas')}
          className="gap-1"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Button>

        <div className="flex items-center gap-3">
          <Label className="text-sm font-semibold">Status:</Label>
          <Badge>{STATUS_LABELS[proposal.status] || proposal.status}</Badge>
          {allowedStatuses.length > 0 && (
            <Select onValueChange={handleStatusChange}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Alterar status..." />
              </SelectTrigger>
              <SelectContent>
                {allowedStatuses.map((s) => (
                  <SelectItem key={s} value={s}>
                    {STATUS_LABELS[s] || s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button
            variant="outline"
            onClick={handleCopyLink}
            className="gap-2"
            title="Copiar link público para envio ao cliente"
          >
            {copiedLink ? (
              <>
                <Check className="w-4 h-4 text-emerald-600" /> Copiado
              </>
            ) : (
              <>
                <LinkIcon className="w-4 h-4 text-primary" /> Copiar Link
              </>
            )}
          </Button>
          <Button
            onClick={() => setNotifyDialogOpen(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 font-semibold shadow-sm cursor-pointer"
            title="Enviar proposta por E-mail"
          >
            <Send className="w-4 h-4" /> Enviar ao Cliente (E-mail)
          </Button>
          <Button
            onClick={() => {
              if (pacotePdfBlockReason) {
                toast({
                  title: 'Geração bloqueada',
                  description: pacotePdfBlockReason,
                  variant: 'destructive',
                })
                return
              }
              window.open(`/proposta/${proposal.id}/imprimir`, '_blank')
            }}
            disabled={Boolean(pacotePdfBlockReason)}
            className="bg-primary gap-2"
            title={pacotePdfBlockReason || 'Imprimir proposta'}
          >
            <Printer className="w-4 h-4" /> Imprimir
          </Button>
        </div>
      </div>

      <Card className="shadow-lg overflow-hidden border">
        <CardContent className="p-8 bg-white text-slate-900">
          <ProposalDocument proposal={proposal} />

          <div className="border-t border-slate-200 mt-8 pt-6 print:hidden">
            <h3 className="font-bold text-sm mb-3 text-slate-800">Assinaturas e Validação</h3>
            <SignatureSection proposta={proposal} userName={user?.name} onUpdated={loadData} />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-between items-center bg-card p-4 rounded-lg border shadow-sm print:hidden">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/controle-propostas/propostas-criadas')}
          className="gap-1"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Button>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={handleCopyLink}
            className="gap-2"
            title="Copiar link público para envio ao cliente"
          >
            {copiedLink ? (
              <>
                <Check className="w-4 h-4 text-emerald-600" /> Copiado
              </>
            ) : (
              <>
                <LinkIcon className="w-4 h-4 text-primary" /> Copiar Link
              </>
            )}
          </Button>
          <Button
            onClick={() => setNotifyDialogOpen(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 font-semibold shadow-sm cursor-pointer"
            title="Enviar proposta por E-mail"
          >
            <Send className="w-4 h-4" /> Enviar ao Cliente (E-mail)
          </Button>
          <Button
            onClick={() => {
              if (pacotePdfBlockReason) {
                toast({
                  title: 'Geração bloqueada',
                  description: pacotePdfBlockReason,
                  variant: 'destructive',
                })
                return
              }
              window.open(`/proposta/${proposal.id}/imprimir`, '_blank')
            }}
            disabled={Boolean(pacotePdfBlockReason)}
            className="bg-primary gap-2"
            title={pacotePdfBlockReason || 'Imprimir proposta'}
          >
            <Printer className="w-4 h-4" /> Imprimir
          </Button>
        </div>
      </div>

      {pacotePdfBlockReason && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200 print:hidden">
          <p className="font-semibold text-sm">Documento bloqueado para impressão / PDF</p>
          <p className="text-xs mt-1">{pacotePdfBlockReason}</p>
        </div>
      )}

      <ReenviarNotificacaoDialog
        open={notifyDialogOpen}
        onOpenChange={setNotifyDialogOpen}
        proposta={proposal}
        onSuccess={loadData}
      />
    </div>
  )
}
