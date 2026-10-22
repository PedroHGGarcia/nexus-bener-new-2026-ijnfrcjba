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
      <PropostaForm
        userId={user?.id}
        userName={user?.name}
        editProposta={proposta}
        onSaved={(newId) => {
          navigate(`/controle-propostas/proposta-pdf/${newId}`)
        }}
        onCancel={() => navigate('/controle-propostas/propostas-criadas')}
      />
    </div>
  )
}
