import { useState, useEffect, useCallback } from 'react'
import { fetchPreferencias, savePreferencia } from '@/services/preferencias'

export interface TablePrefs {
  visibleColumns: string[]
  filters: Record<string, unknown>
}

export function useTablePreferences(userId: string | undefined, tableKey: string) {
  const [prefs, setPrefs] = useState<TablePrefs>({
    visibleColumns: [],
    filters: {},
  })
  const [loading, setLoading] = useState(true)

  const prefKey = `table_prefs_${tableKey}`

  useEffect(() => {
    if (!userId) {
      setLoading(false)
      return
    }
    fetchPreferencias(userId)
      .then((all) => {
        const stored = all[prefKey] as TablePrefs | undefined
        if (stored) setPrefs(stored)
      })
      .finally(() => setLoading(false))
  }, [userId, prefKey])

  const save = useCallback(
    async (next: TablePrefs) => {
      setPrefs(next)
      if (userId) {
        await savePreferencia(userId, prefKey, next)
      }
    },
    [userId, prefKey],
  )

  const toggleColumn = useCallback(
    async (col: string) => {
      const cols = prefs.visibleColumns.includes(col)
        ? prefs.visibleColumns.filter((c) => c !== col)
        : [...prefs.visibleColumns, col]
      await save({ ...prefs, visibleColumns: cols })
    },
    [prefs, save],
  )

  const setFilters = useCallback(
    async (filters: Record<string, unknown>) => {
      await save({ ...prefs, filters })
    },
    [prefs, save],
  )

  return { prefs, loading, save, toggleColumn, setFilters }
}
