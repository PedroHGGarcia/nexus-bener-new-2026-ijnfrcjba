import { useState, useEffect, useCallback } from 'react'
import { Cliente, ClienteInsert, ClienteUpdate } from '@/types/cliente'
import { fetchClientes, insertCliente, updateCliente, deleteCliente } from '@/services/clientes'

export function useClientes(options?: {
  estado?: string | null
  criadoPor?: string | null
  matchAny?: boolean
}) {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const estadoFilter = options?.estado
  const criadoPorFilter = options?.criadoPor
  const matchAnyFilter = options?.matchAny

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchClientes({
        estado: estadoFilter,
        criadoPor: criadoPorFilter,
        matchAny: matchAnyFilter,
      })
      setClientes(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar clientes.')
    } finally {
      setLoading(false)
    }
  }, [estadoFilter, criadoPorFilter, matchAnyFilter])

  useEffect(() => {
    refresh()
  }, [refresh])

  const create = useCallback(async (payload: ClienteInsert) => {
    try {
      const novo = await insertCliente(payload)
      setClientes((prev) => [novo, ...prev])
      return novo
    } catch (e) {
      throw new Error(e instanceof Error ? e.message : 'Erro ao criar cliente.')
    }
  }, [])

  const update = useCallback(async (payload: ClienteUpdate) => {
    try {
      const updated = await updateCliente(payload)
      setClientes((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
      return updated
    } catch (e) {
      throw new Error(e instanceof Error ? e.message : 'Erro ao atualizar cliente.')
    }
  }, [])

  const remove = useCallback(async (id: string) => {
    try {
      await deleteCliente(id)
      setClientes((prev) => prev.filter((c) => c.id !== id))
    } catch (e) {
      throw new Error(e instanceof Error ? e.message : 'Erro ao excluir cliente.')
    }
  }, [])

  return { clientes, loading, error, refresh, create, update, remove }
}
