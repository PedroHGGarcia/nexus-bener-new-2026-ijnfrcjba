import { useState, useCallback, useEffect } from 'react'
import { Building2 } from 'lucide-react'
import { DashboardWidget } from './DashboardWidget'
import { useRealtime } from '@/hooks/use-realtime'
import { fetchClientsWidgetData, type ClientsWidgetData } from '@/services/dashboard'

export function ClientsWidget() {
  const [data, setData] = useState<ClientsWidgetData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      setData(await fetchClientsWidgetData())
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])
  useRealtime(['clientes'], loadData)

  const isEmpty = data !== null && data.activeCount === 0 && data.monthCount === 0

  return (
    <DashboardWidget
      icon={<Building2 className="w-4 h-4 text-primary" />}
      title="Clientes"
      linkTo="/cadastros/clientes"
      loading={loading}
      error={error}
      isEmpty={isEmpty}
      onRetry={loadData}
    >
      {data && (
        <div className="space-y-2">
          <div>
            <p className="text-xs text-muted-foreground">Clientes ativos</p>
            <p className="text-xl font-bold">{data.activeCount}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Novos este mês:</span>
            <span className="text-sm font-semibold text-primary">{data.monthCount}</span>
          </div>
        </div>
      )}
    </DashboardWidget>
  )
}
