import { useState, useCallback, useEffect } from 'react'
import { FolderKanban } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { DashboardWidget } from './DashboardWidget'
import { useRealtime } from '@/hooks/use-realtime'
import { fetchProjectsWidgetData, type ProjectWidgetItem } from '@/services/dashboard'

export function ProjectsWidget() {
  const [data, setData] = useState<ProjectWidgetItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      setData(await fetchProjectsWidgetData())
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])
  useRealtime(['projetos', 'propostas'], loadData)

  return (
    <DashboardWidget
      icon={<FolderKanban className="w-4 h-4 text-blue-500" />}
      title="Projetos"
      linkTo="/projetos"
      loading={loading}
      error={error}
      isEmpty={!loading && !error && data.length === 0}
      onRetry={loadData}
    >
      <div className="space-y-1.5">
        {data.map((p) => (
          <div key={p.id} className="flex items-center justify-between text-xs py-1">
            <div className="min-w-0 flex-1">
              <p className="font-medium truncate">{p.nome}</p>
              {p.clientes && (
                <p className="text-muted-foreground truncate">{p.clientes.fantasia}</p>
              )}
            </div>
            <div className="flex items-center gap-2 ml-2">
              <Badge variant="secondary" className="text-[10px]">
                {p.status}
              </Badge>
              <span className="text-muted-foreground whitespace-nowrap">
                {p.proposalsCount} prop.
              </span>
            </div>
          </div>
        ))}
      </div>
    </DashboardWidget>
  )
}
