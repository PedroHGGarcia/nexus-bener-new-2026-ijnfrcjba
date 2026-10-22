import { useState, useCallback, useEffect } from 'react'
import { FileSpreadsheet } from 'lucide-react'
import { DashboardWidget } from './DashboardWidget'
import { useRealtime } from '@/hooks/use-realtime'
import { fetchProposalsWidgetData, type ProposalsWidgetData } from '@/services/dashboard'

export function ProposalsWidget() {
  const [data, setData] = useState<ProposalsWidgetData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      setData(await fetchProposalsWidgetData())
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])
  useRealtime(['propostas'], loadData)

  const isEmpty = data !== null && data.statusCounts.every((s) => s.count === 0)

  return (
    <DashboardWidget
      icon={<FileSpreadsheet className="w-4 h-4 text-primary" />}
      title="Propostas"
      linkTo="/controle-propostas/propostas-criadas"
      loading={loading}
      error={error}
      isEmpty={isEmpty}
      onRetry={loadData}
    >
      {data && (
        <div className="space-y-2">
          <div>
            <p className="text-xs text-muted-foreground">Criadas este mês</p>
            <p className="text-xl font-bold">{data.monthCount}</p>
          </div>
          <div className="space-y-1">
            {data.statusCounts.map((s) => (
              <div key={s.status} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{s.label}</span>
                <span className="font-semibold">{s.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </DashboardWidget>
  )
}
