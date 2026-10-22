import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { isAdminRole } from '@/components/RoleGuard'
import {
  fetchNotificacoes,
  markNotificacaoAsRead,
  markAllNotificacoesAsRead,
  deleteNotificacao,
  type Notificacao,
} from '@/services/notificacoes'

export function useNotificacoes(userId: string | undefined) {
  const { user } = useAuth()
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([])
  const [loading, setLoading] = useState(true)

  const includeBroadcast = isAdminRole(user?.role)

  const unreadCount = notificacoes.filter((n) => !n.lida).length

  const refresh = useCallback(async () => {
    if (!userId) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const data = await fetchNotificacoes(userId, includeBroadcast)
      setNotificacoes(data)
    } catch {
      setNotificacoes([])
    } finally {
      setLoading(false)
    }
  }, [userId, includeBroadcast])

  useEffect(() => {
    refresh()
  }, [refresh])

  const markRead = useCallback(async (id: string) => {
    await markNotificacaoAsRead(id)
    setNotificacoes((prev) => prev.map((n) => (n.id === id ? { ...n, lida: true } : n)))
  }, [])

  const markAllRead = useCallback(async () => {
    if (!userId) return
    await markAllNotificacoesAsRead(userId, includeBroadcast)
    setNotificacoes((prev) => prev.map((n) => ({ ...n, lida: true })))
  }, [userId, includeBroadcast])

  const remove = useCallback(async (id: string) => {
    await deleteNotificacao(id)
    setNotificacoes((prev) => prev.filter((n) => n.id !== id))
  }, [])

  return { notificacoes, unreadCount, loading, refresh, markRead, markAllRead, remove }
}
