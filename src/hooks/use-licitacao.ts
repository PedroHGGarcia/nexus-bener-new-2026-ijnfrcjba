import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase/client'
import { PropostaWithRelations } from '@/types/proposta'
import { updatePropostaStatus } from '@/services/propostas'

const SELECT_RELATIONS =
  '*, clientes(fantasia), versoes(nome), representantes:representante(id, fantasia), gerentes:gerente(id, nome)'

export function useLicitacao() {
  const [propostas, setPropostas] = useState<PropostaWithRelations[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data, error: err } = await supabase
        .from('propostas')
        .select(SELECT_RELATIONS)
        .eq('modelo_licitacao', true)
        .neq('status', 'Excluida')
        .order('created_at', { ascending: false })
      if (err) throw new Error(err.message)
      setPropostas((data ?? []) as unknown as PropostaWithRelations[])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar propostas de licitação.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const transitionStatus = useCallback(async (id: string, status: string, userName?: string) => {
    await updatePropostaStatus(id, status, userName)
    setPropostas((prev) => prev.map((p) => (p.id === id ? { ...p, status } : p)))
  }, [])

  return { propostas, loading, error, refresh, transitionStatus }
}
