import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import { PropostaForm } from '@/components/propostas/PropostaForm'
import { Button } from '@/components/ui/button'
import { Printer } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { sendProposalEmail } from '@/services/proposal-email'
import { generateProposalPdf } from '@/services/proposal-pdf'
import type { PreOpenedPrintTab } from '@/lib/proposal-auto-open'
import { showPrintPdfBlockedFallbackToast } from '@/lib/proposal-auto-open'

export default function EmitirPropostaPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [createdProposalId, setCreatedProposalId] = useState<string | null>(null)

  const handleSaved = async (
    id: string,
    emails_notificacao?: string[],
    preOpenedTab?: PreOpenedPrintTab | null,
  ) => {
    toast({ title: 'Proposta emitida com sucesso!' })

    // Auto-open print-ready PDF for this specific proposal and user.
    // Use the pre-opened window (synchronous user-gesture) to bypass popup blockers reliably.
    setCreatedProposalId(id)

    if (preOpenedTab) {
      preOpenedTab.redirect(id)
    } else {
      try {
        const opened = window.open(`/proposta/${id}/imprimir`, '_blank')
        if (!opened || opened.closed) {
          showPrintPdfBlockedFallbackToast(id)
        }
      } catch {
        showPrintPdfBlockedFallbackToast(id)
      }
    }

    // 1. Generate the real PDF and save it to Supabase Storage BEFORE
    //    dispatching the n8n webhook, so the .pdf URL n8n receives is live.
    try {
      const pdfResult = await generateProposalPdf(id)
      if (pdfResult.ok) {
        if (pdfResult.data?.pdfUrl) {
          toast({ title: 'PDF gerado e salvo no storage.' })
        } else {
          toast({
            title: 'PDF: HTML gerado, mas arquivo não foi salvo no storage.',
            variant: 'destructive',
          })
        }
      } else {
        console.warn(
          'Falha ao gerar PDF da proposta:',
          (pdfResult as { ok: false; error: string }).error,
        )
        toast({
          title: 'Falha ao gerar PDF da proposta',
          description: (pdfResult as { ok: false; error: string }).error,
          variant: 'destructive',
        })
      }
    } catch (err) {
      console.warn('Erro ao gerar PDF da proposta:', err)
    }

    // 2. Dispatch the n8n webhook (send-proposal-email builds link_proposta
    //    + pdf_url from the storage .pdf URL). Single, authoritative trigger on proposal creation.
    sendProposalEmail({ propostaId: id, emails: emails_notificacao, event: 'created' })
      .then((result) => {
        if (result.ok && result.data?.sent) {
          toast({ title: 'Notificação via n8n enviada com sucesso!' })
        } else if (result.ok && result.data?.skipped) {
          // If no notification emails were specified, sending was intentionally skipped
          if (result.data?.manager_copy_dispatched) {
            toast({ title: 'Cópia da proposta enviada à gerência com sucesso!' })
          }
        } else if (result.ok && !result.data?.sent && !result.data?.skipped) {
          toast({
            title: 'Aviso: Notificação n8n não enviada',
            description:
              result.data?.message || 'Verifique a conexão e o status do webhook do n8n.',
            variant: 'destructive',
          })
        } else if (!result.ok) {
          console.warn(
            'Falha ao acionar webhook n8n:',
            (result as { ok: false; error: string }).error,
          )
        }
      })
      .catch((err) => {
        console.warn('Erro ao enviar e-mails de notificação:', err)
      })

    navigate(`/controle-propostas/proposta-pdf/${id}`)
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {createdProposalId && (
        <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 rounded-lg p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-sm">
          <div className="text-sm text-emerald-900 dark:text-emerald-100">
            <strong>Proposta gerada com sucesso!</strong> Se o PDF de impressão não abriu
            automaticamente, clique ao lado:
          </div>
          <Button
            type="button"
            onClick={() => window.open(`/proposta/${createdProposalId}/imprimir`, '_blank')}
            className="bg-[#0b3c26] text-white hover:bg-[#082f1e] font-bold shrink-0 gap-2"
          >
            <Printer className="w-4 h-4" />
            Abrir PDF de impressão
          </Button>
        </div>
      )}

      <PropostaForm
        userId={user?.id}
        userName={user?.name}
        onSaved={handleSaved}
        onCancel={() => navigate('/controle-propostas/propostas-criadas')}
      />
    </div>
  )
}
