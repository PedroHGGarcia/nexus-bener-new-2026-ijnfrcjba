import { useState, useEffect, useCallback } from 'react'
import { fetchImportHistory, type ImportHistoryEntry } from '@/services/import-history'
import { supabase } from '@/lib/supabase/client'

export function useImportacao() {
  const [history, setHistory] = useState<ImportHistoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [progress, setProgress] = useState<{ active: boolean; current: string | null }>({
    active: false,
    current: null,
  })

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchImportHistory()
      setHistory(data)
    } catch {
      setHistory([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const recordImport = useCallback(
    async (params: {
      tipo: string
      arquivo: string
      status: string
      registros_importados: number
      registros_erro: number
      erros?: unknown
      usuario: string
    }) => {
      setProgress({ active: true, current: params.arquivo })
      const { data, error } = await supabase
        .from('historico_importacoes')
        .insert(params as any)
        .select()
        .single()
      setProgress({ active: false, current: null })
      if (error) throw new Error(error.message)
      await refresh()
      return data
    },
    [refresh],
  )

  return { history, loading, progress, refresh, recordImport }
}
