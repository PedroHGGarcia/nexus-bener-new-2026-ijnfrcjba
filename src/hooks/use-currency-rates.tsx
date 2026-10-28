import { useState, useEffect, useCallback } from 'react'
import { fetchCurrencyRates, getCachedRates, type CurrencyRates } from '@/services/currency-rates'

export function useCurrencyRates() {
  const [rates, setRates] = useState<CurrencyRates>(() => getCachedRates())
  const [loading, setLoading] = useState<boolean>(false)
  const [isCached, setIsCached] = useState<boolean>(() => {
    const initial = getCachedRates()
    return (
      Boolean(initial.isOutdated) ||
      initial.source.includes('cache') ||
      initial.source === 'padrao-seguro' ||
      initial.source === 'offline-default'
    )
  })

  const reload = useCallback(async (force = true) => {
    setLoading(true)
    try {
      const r = await fetchCurrencyRates(force)
      if (r) {
        setRates(r)
        setIsCached(
          Boolean(r.isOutdated) ||
            r.source?.includes('cache') ||
            r.source === 'padrao-seguro' ||
            r.source === 'offline-default',
        )
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let mounted = true
    setLoading(true)
    fetchCurrencyRates(false)
      .then((r) => {
        if (mounted && r) {
          setRates(r)
          setIsCached(
            Boolean(r.isOutdated) ||
              r.source?.includes('cache') ||
              r.source === 'padrao-seguro' ||
              r.source === 'offline-default',
          )
          setLoading(false)
        }
      })
      .catch(() => {
        if (mounted) setLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [])

  return { rates, loading, isCached, reload }
}
