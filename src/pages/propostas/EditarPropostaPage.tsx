import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { PropostaForm } from '@/components/propostas/PropostaForm'
import { fetchPropostaById } from '@/services/propostas'
import { PropostaWithRelations } from '@/types/proposta'
import { useAuth } from '@/hooks/use-auth'
import { LoadingState, ErrorState } from '@/components/StateViews'

export default function EditarPropostaPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [createdProposalId, setCreatedProposalId] = useState<string | null>(null)
  const [proposta, setProposta] = useState<PropostaWithRelations | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    fetchPropostaById(id)
      .then((data) => {
        if (!data) {
          setError(true)
          return
        }
        setProposta(data)
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <LoadingState count={3} />
  if (error || !proposta) {
    return (
      <ErrorState
        message="Não foi possível carregar a proposta para edição."
        onRetry={() => navigate('/controle-propostas/propostas-criadas')}
      />
    )
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {createdProposalId && (
        <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 rounded-lg p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-sm">
          <div className="text-sm text-emerald-900 dark:text-emerald-100">
            <strong>Nova versão gerada com sucesso!</strong> Se o PDF de impressão não abriu
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
        editProposta={proposta}
        onSaved={(newId, _emails, preOpenedTab) => {
          setCreatedProposalId(newId)
          if (preOpenedTab) {
            preOpenedTab.redirect(newId)
          } else {
            try {
              const opened = window.open(`/proposta/${newId}/imprimir`, '_blank')
              if (!opened || opened.closed) {
                showPrintPdfBlockedFallbackToast(newId)
              }
            } catch {
              showPrintPdfBlockedFallbackToast(newId)
            }
          }
          navigate(`/controle-propostas/proposta-pdf/${newId}`)
        }}
        onCancel={() => navigate('/controle-propostas/propostas-criadas')}
      />
    </div>
  )
}
