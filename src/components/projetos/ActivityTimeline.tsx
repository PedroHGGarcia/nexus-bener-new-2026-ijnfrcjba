import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { LoadingState, EmptyState } from '@/components/StateViews'
import { fetchProjectActivity, ActivityItem } from '@/services/projeto-activity'
import { formatDateTime } from '@/lib/format'

export function ActivityTimeline({ projetoId }: { projetoId: string }) {
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setActivities(await fetchProjectActivity(projetoId))
    } catch {
      setActivities([])
    } finally {
      setLoading(false)
    }
  }, [projetoId])

  useEffect(() => {
    load()
  }, [load])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Linha do Tempo</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <LoadingState count={3} />
        ) : activities.length === 0 ? (
          <EmptyState title="Sem atividade" description="Nenhuma atividade registrada." />
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {activities.map((a) => {
              const initials = (a.user_name ?? '?')
                .split(' ')
                .map((n) => n[0])
                .filter(Boolean)
                .slice(0, 2)
                .join('')
                .toUpperCase()
              return (
                <div
                  key={a.id}
                  className="flex gap-3 pb-3 border-b border-border/50 last:border-0 last:pb-0"
                >
                  <Avatar className="w-8 h-8 shrink-0">
                    {a.user_avatar && <AvatarImage src={a.user_avatar} alt={a.user_name ?? ''} />}
                    <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{a.title}</p>
                    <p className="text-xs text-muted-foreground">{a.description}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-muted-foreground">
                        {a.user_name ?? 'Sistema'}
                      </span>
                      <span className="text-xs text-muted-foreground/50">•</span>
                      <span className="text-xs text-muted-foreground/50">
                        {formatDateTime(a.created_at)}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
