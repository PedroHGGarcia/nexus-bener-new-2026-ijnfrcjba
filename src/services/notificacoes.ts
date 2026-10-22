import { supabase } from '@/lib/supabase/client'

export interface Notificacao {
  id: string
  usuario: string | null
  titulo: string
  mensagem: string | null
  lida: boolean
  tipo: string | null
  created_at: string
}

/**
 * Busca as notificações de um usuário.
 *
 * Quando `includeBroadcast` é true (Admins), também retorna as notificações
 * "broadcast" (onde `usuario` IS NULL), que são exibidas para todos os Admins.
 */
export async function fetchNotificacoes(
  userId: string,
  includeBroadcast = false,
): Promise<Notificacao[]> {
  let query = supabase.from('notificacoes').select('*').order('created_at', { ascending: false })

  if (includeBroadcast) {
    query = query.or(`usuario.eq.${userId},usuario.is.null`)
  } else {
    query = query.eq('usuario', userId)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []) as Notificacao[]
}

export async function markNotificacaoAsRead(id: string): Promise<void> {
  const { error } = await supabase.from('notificacoes').update({ lida: true }).eq('id', id)
  if (error) throw new Error(error.message)
}

/**
 * Marca todas as notificações do usuário como lidas.
 *
 * Quando `includeBroadcast` é true (Admins), também marca as notificações
 * broadcast (usuario IS NULL) como lidas.
 */
export async function markAllNotificacoesAsRead(
  userId: string,
  includeBroadcast = false,
): Promise<void> {
  let query = supabase.from('notificacoes').update({ lida: true }).eq('lida', false)

  if (includeBroadcast) {
    query = query.or(`usuario.eq.${userId},usuario.is.null`)
  } else {
    query = query.eq('usuario', userId)
  }

  const { error } = await query
  if (error) throw new Error(error.message)
}

export async function deleteNotificacao(id: string): Promise<void> {
  const { error } = await supabase.from('notificacoes').delete().eq('id', id)
  if (error) throw new Error(error.message)
}
