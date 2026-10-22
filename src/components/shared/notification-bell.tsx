import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import { isAdminRole } from '@/components/RoleGuard'
import { supabase } from '@/lib/supabase/client'
import {
  fetchNotificacoes,
  markNotificacaoAsRead,
  markAllNotificacoesAsRead,
  type Notificacao,
} from '@/services/notificacoes'
import { Bell, Check, ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
} from '@/components/ui/dropdown-menu'
import { Link } from 'react-router-dom'

interface Props {
  userId: string
}
export function NotificationBell({ userId }: Props) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [notifications, setNotifications] = useState<Notificacao[]>([])

  const includeBroadcast = isAdminRole(user?.role)

  useEffect(() => {
    if (!userId) return
    fetchNotificacoes(userId, includeBroadcast)
      .then(setNotifications)
      .catch(() => {})
    const channel = supabase
      .channel('notif-bell')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notificacoes' }, () => {
        fetchNotificacoes(userId, includeBroadcast)
          .then(setNotifications)
          .catch(() => {})
      })
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId, includeBroadcast])

  const unread = notifications.filter((n) => !n.lida).length
  const markAll = async () => {
    await markAllNotificacoesAsRead(userId, includeBroadcast)
    setNotifications((p) => p.map((n) => ({ ...n, lida: true })))
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative rounded-full"
          aria-label="Notificações"
        >
          <Bell className="w-5 h-5 text-muted-foreground" />
          {unread > 0 && (
            <Badge className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center bg-primary text-[11px]">
              {unread}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between p-3 border-b bg-muted/40">
          <span className="font-semibold text-sm">Notificações</span>
          {unread > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={markAll}
              className="text-xs h-7 gap-1 text-primary"
            >
              <Check className="w-3 h-3" /> Marcar lidas
            </Button>
          )}
        </div>
        <div className="max-h-72 overflow-y-auto divide-y divide-border">
          {notifications.length === 0 ? (
            <div className="p-4 text-center text-xs text-muted-foreground">
              Sem notificações no momento
            </div>
          ) : (
            notifications.slice(0, 5).map((n) => (
              <div
                key={n.id}
                onClick={() => {
                  if (!n.lida) {
                    markNotificacaoAsRead(n.id).catch(() => {})
                    setNotifications((prev) =>
                      prev.map((x) => (x.id === n.id ? { ...x, lida: true } : x)),
                    )
                  }
                  const m: Record<string, string> = {
                    proposta: '/controle-propostas/propostas-criadas',
                    projeto: '/projetos',
                    cliente: '/cadastros/clientes',
                  }
                  const link = n.tipo ? m[n.tipo] : undefined
                  if (link) navigate(link)
                }}
                className={`p-3 text-xs cursor-pointer hover:bg-accent/50 transition-colors ${!n.lida ? 'bg-primary/5 font-medium' : ''}`}
              >
                <div className="flex items-center gap-1.5 mb-0.5">
                  {n.tipo === 'critical_action' && (
                    <ShieldAlert className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  )}
                  <span className="font-semibold">{n.titulo}</span>
                </div>
                <div className="text-muted-foreground line-clamp-2">{n.mensagem ?? ''}</div>
                <div className="text-[10px] text-muted-foreground/70 mt-1">
                  {new Date(n.created_at).toLocaleString('pt-BR')}
                </div>
              </div>
            ))
          )}
        </div>
        <div className="p-2 border-t text-center">
          <Link to="/notificacoes" className="text-xs font-semibold text-primary hover:underline">
            Ver todas as notificações
          </Link>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
