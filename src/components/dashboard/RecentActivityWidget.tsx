import { useState, useCallback, useEffect } from 'react'
import { Activity } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { DashboardWidget } from './DashboardWidget'
import { useRealtime } from '@/hooks/use-realtime'
import { fetchRecentActivityWidgetData, type RecentActivityItem } from '@/services/dashboard'

export function RecentActivityWidget() {
  const [data, setData] = useState<RecentActivityItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      setData(await fetchRecentActivityWidgetData())
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])
  useRealtime(['versoes_historico'], loadData)

  return (
    <DashboardWidget
      icon={<Activity className="w-4 h-4 text-primary" />}
      title="Atividade Recente"
      linkTo="/produtos/versoes"
      loading={loading}
      error={error}
      isEmpty={!loading && !error && data.length === 0}
      onRetry={loadData}
    >
      <div className="space-y-1.5 max-h-56 overflow-y-auto">
        {data.map((item) => (
          <div key={item.id} className="text-xs py-1 border-b border-border/50 last:border-0">
            <div className="flex items-center justify-between mb-0.5">
              <span className="font-medium">{item.usuario ?? 'Sistema'}</span>
              <Badge variant="secondary" className="text-[10px]">
                {item.acao}
              </Badge>
            </div>
            {item.versoes && <p className="text-muted-foreground truncate">{item.versoes.nome}</p>}
            {item.detalhes && <p className="text-muted-foreground/70 truncate">{item.detalhes}</p>}
            <p className="text-muted-foreground/50 mt-0.5">
              {item.created_at ? new Date(item.created_at).toLocaleString('pt-BR') : '—'}
            </p>
          </div>
        ))}
      </div>
    </DashboardWidget>
  )
}
