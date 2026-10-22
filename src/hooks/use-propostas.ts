import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase/client'
import { PropostaWithRelations } from '@/types/proposta'
import {
  insertProposta,
  updateProposta,
  updatePropostaStatus,
  deleteProposta,
} from '@/services/propostas'

export interface PropostaFilters {
  status?: string
  cliente?: string
  representante?: string
  modelo_licitacao?: boolean
}

const SELECT_RELATIONS =
  '*, clientes(fantasia), versoes(nome), representantes:representante(id, fantasia), gerentes:gerente(id, nome), assinante_representante:assinante_representante_id(id, fantasia), assinante_gerente:assinante_gerente_id(id, nome)'

export function usePropostas(filters: PropostaFilters = {}, page = 1, pageSize = 20) {
  const [propostas, setPropostas] = useState<PropostaWithRelations[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const filtersKey = useMemo(() => JSON.stringify(filters), [filters])

  const fetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      let query = supabase.from('propostas').select(SELECT_RELATIONS, { count: 'exact' })
      if (filters.status) query = query.eq('status', filters.status)
      if (filters.cliente) query = query.eq('cliente', filters.cliente)
      if (filters.representante) query = query.eq('representante', filters.representante)
      if (filters.modelo_licitacao !== undefined)
        query = query.eq('modelo_licitacao', filters.modelo_licitacao)
      query = query
        .order('created_at', { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1)
      const { data, error: err, count } = await query
      if (err) throw new Error(err.message)
      setPropostas((data ?? []) as unknown as PropostaWithRelations[])
      setTotal(count ?? 0)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar propostas.')
    } finally {
      setLoading(false)
    }
  }, [filtersKey, page, pageSize])

  useEffect(() => {
    fetch()
  }, [fetch])

  const create = useCallback(
    async (payload: Record<string, unknown>, userName?: string) => {
      const novo = await insertProposta(payload, userName)
      await fetch()
      return novo
    },
    [fetch],
  )

  const update = useCallback(
    async (id: string, payload: Record<string, unknown>, userName?: string) => {
      const updated = await updateProposta(id, payload, userName)
      setPropostas((prev) =>
        prev.map((p) => (p.id === id ? ({ ...p, ...updated } as PropostaWithRelations) : p)),
      )
      return updated
    },
    [],
  )

  const transitionStatus = useCallback(async (id: string, status: string, userName?: string) => {
    await updatePropostaStatus(id, status, userName)
    setPropostas((prev) => prev.map((p) => (p.id === id ? { ...p, status } : p)))
  }, [])

  const remove = useCallback(async (id: string) => {
    await deleteProposta(id)
    setPropostas((prev) => prev.filter((p) => p.id !== id))
  }, [])

  const totalPages = Math.ceil(total / pageSize)

  return {
    propostas,
    total,
    totalPages,
    currentPage: page,
    loading,
    error,
    refresh: fetch,
    create,
    update,
    transitionStatus,
    remove,
  }
}
