import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import { PropostaForm } from '@/components/propostas/PropostaForm'
import { toast } from '@/hooks/use-toast'
import { sendProposalEmail } from '@/services/proposal-email'
import { generateProposalPdf } from '@/services/proposal-pdf'

export default function EmitirPropostaPage() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const handleSaved = async (id: string, emails_notificacao?: string[]) => {
    toast({ title: 'Proposta emitida com sucesso!' })

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
      <PropostaForm
        userId={user?.id}
        userName={user?.name}
        onSaved={handleSaved}
        onCancel={() => navigate('/controle-propostas/propostas-criadas')}
      />
    </div>
  )
}
