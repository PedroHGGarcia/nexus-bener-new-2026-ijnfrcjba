import { useState, useCallback, useEffect } from 'react'
import { Package } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { DashboardWidget } from './DashboardWidget'
import { useRealtime } from '@/hooks/use-realtime'
import { fetchVersionsWidgetData, type VersionsWidgetData } from '@/services/dashboard'

export function VersionsWidget() {
  const [data, setData] = useState<VersionsWidgetData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      setData(await fetchVersionsWidgetData())
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])
  useRealtime(['versoes'], loadData)

  const isEmpty = data !== null && data.activeCount === 0 && data.lowStock.length === 0

  return (
    <DashboardWidget
      icon={<Package className="w-4 h-4 text-primary" />}
      title="Versões de Produtos"
      linkTo="/produtos/versoes"
      loading={loading}
      error={error}
      isEmpty={isEmpty}
      onRetry={loadData}
    >
      {data && (
        <div className="space-y-2">
          <div>
            <p className="text-xs text-muted-foreground">Versões ativas</p>
            <p className="text-xl font-bold">{data.activeCount}</p>
          </div>
          {data.lowStock.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <Badge variant="destructive" className="text-[10px]">
                  {data.lowStock.length} alerta{data.lowStock.length > 1 ? 's' : ''}
                </Badge>
                <span className="text-xs text-muted-foreground">estoque baixo</span>
              </div>
              <div className="space-y-0.5">
                {data.lowStock.map((v) => (
                  <div key={v.id} className="flex items-center justify-between text-xs">
                    <span className="truncate mr-2">{v.nome}</span>
                    <span className="text-destructive whitespace-nowrap">
                      {v.estoque_disponivel} / {v.alerta_estoque_minimo}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </DashboardWidget>
  )
}
