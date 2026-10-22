import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { isAdminRole } from '@/components/RoleGuard'
import { supabase } from '@/lib/supabase/client'
import {
  fetchNotificacoes,
  markNotificacaoAsRead,
  markAllNotificacoesAsRead,
  deleteNotificacao,
  type Notificacao,
} from '@/services/notificacoes'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Bell, Check, Trash2, BellOff, ShieldAlert } from 'lucide-react'
import { LoadingState, EmptyState, ErrorState } from '@/components/StateViews'
import { toast } from '@/hooks/use-toast'

export default function NotificacoesPage() {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState<Notificacao[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const includeBroadcast = isAdminRole(user?.role)

  const loadNotifications = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    setError(false)
    try {
      const data = await fetchNotificacoes(user.id, includeBroadcast)
      setNotifications(data)
    } catch {
      setError(true)
      toast({ title: 'Erro ao carregar notificações', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [user?.id, includeBroadcast])

  useEffect(() => {
    loadNotifications()
  }, [loadNotifications])

  useEffect(() => {
    if (!user?.id) return
    const channel = supabase
      .channel('notificacoes-page-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notificacoes' }, () => {
        loadNotifications()
      })
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [user?.id, loadNotifications])

  const handleMarkAllRead = async () => {
    if (!user?.id) return
    try {
      await markAllNotificacoesAsRead(user.id, includeBroadcast)
      setNotifications((prev) => prev.map((n) => ({ ...n, lida: true })))
      toast({ title: 'Todas as notificações marcadas como lidas' })
    } catch {
      toast({ title: 'Erro ao marcar notificações', variant: 'destructive' })
    }
  }

  const handleMarkRead = async (id: string) => {
    try {
      await markNotificacaoAsRead(id)
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, lida: true } : n)))
    } catch {
      toast({ title: 'Erro ao marcar notificação', variant: 'destructive' })
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteNotificacao(id)
      setNotifications((prev) => prev.filter((n) => n.id !== id))
      toast({ title: 'Notificação removida' })
    } catch {
      toast({ title: 'Erro ao remover notificação', variant: 'destructive' })
    }
  }

  const unreadCount = notifications.filter((n) => !n.lida).length

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Central de Notificações</h1>
          {unreadCount > 0 && (
            <p className="text-sm text-muted-foreground">{unreadCount} não lida(s)</p>
          )}
        </div>
        {unreadCount > 0 && (
          <Button onClick={handleMarkAllRead} variant="outline" size="sm" className="gap-1">
            <Check className="w-4 h-4" /> Marcar Todas como Lidas
          </Button>
        )}
      </div>

      {loading ? (
        <LoadingState count={5} />
      ) : error ? (
        <ErrorState message="Erro ao carregar notificações." onRetry={loadNotifications} />
      ) : notifications.length === 0 ? (
        <EmptyState
          title="Nenhuma notificação"
          description="Você não tem notificações no momento."
        />
      ) : (
        <div className="space-y-3">
          {notifications.map((n) => (
            <Card key={n.id} className={!n.lida ? 'border-primary/50 bg-primary/5' : ''}>
              <CardContent className="p-4 flex gap-3 items-start">
                {n.tipo === 'critical_action' ? (
                  <ShieldAlert className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
                ) : (
                  <Bell className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {n.tipo === 'critical_action' && (
                      <Badge className="text-[10px] bg-amber-100 text-amber-800 hover:bg-amber-100 border-none">
                        ⚠️ Ação Crítica
                      </Badge>
                    )}
                    <span className="font-semibold">{n.titulo}</span>
                    {n.tipo && n.tipo !== 'critical_action' && (
                      <Badge variant="secondary" className="text-[10px]">
                        {n.tipo}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">{n.mensagem ?? ''}</p>
                  <div className="text-[11px] text-muted-foreground/70 mt-1">
                    {new Date(n.created_at).toLocaleString('pt-BR')}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  {!n.lida && (
                    <Button variant="ghost" size="icon" onClick={() => handleMarkRead(n.id)}>
                      <Check className="w-4 h-4" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(n.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
