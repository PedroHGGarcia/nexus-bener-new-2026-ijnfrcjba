import { supabase } from '@/lib/supabase/client'

/**
 * Throttle mínimo entre chamadas de touch_last_seen no cliente.
 * 5 minutos é suficiente para garantir rastreio fiel de quem está usando
 * o sistema sem floodar o banco ou gerar tráfego desnecessário.
 */
const MIN_TOUCH_INTERVAL_MS = 5 * 60 * 1000

let lastTouchTime = 0
let inFlightPromise: Promise<string | null> | null = null

/**
 * Registra a última atividade do usuário autenticado chamando a RPC `touch_last_seen()`.
 * Protegida no banco por SECURITY DEFINER, aceita apenas JWT válido e só toca
 * o próprio perfil do auth.uid().
 *
 * @param force Ignora o throttle de 5 minutos (usar em login inicial ou ação manual)
 */
export async function touchLastSeen(force = false): Promise<string | null> {
  const now = Date.now()
  if (!force && now - lastTouchTime < MIN_TOUCH_INTERVAL_MS) {
    return null
  }

  if (inFlightPromise) {
    return inFlightPromise
  }

  inFlightPromise = (async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session?.user) {
        return null
      }

      // Executa RPC touch_last_seen (ou touch_user_activity) no Supabase
      const { data, error } = await (supabase.rpc as any)('touch_last_seen')
      if (error) {
        // Fallback 1: tentar a RPC anterior touch_user_activity se touch_last_seen falhar
        const { error: fallbackRpcErr } = await supabase.rpc('touch_user_activity')
        if (fallbackRpcErr) {
          // Fallback 2: update direto na tabela profiles
          const { error: updErr } = await supabase
            .from('profiles')
            .update({ last_seen_at: new Date().toISOString() })
            .eq('id', session.user.id)
          if (updErr) {
            console.warn('[activity-tracker] Falha ao atualizar last_seen_at:', updErr.message)
            return null
          }
        }
      }

      lastTouchTime = Date.now()
      return (data as string) || new Date().toISOString()
    } catch (err) {
      console.warn('[activity-tracker] Erro inesperado:', err)
      return null
    } finally {
      inFlightPromise = null
    }
  })()

  return inFlightPromise
}

export interface ActiveUserItem {
  id: string
  name: string
  email: string
  role: string
  status: string
  avatar_url: string | null
  last_seen_at: string | null
  created_at: string
}

/**
 * Busca a lista de usuários ativos ordenada por atividade mais recente (last_seen_at DESC NULLS LAST).
 * Tenta ler diretamente de `profiles` (se RLS permitir) ou através da Edge Function `admin-user-management`.
 */
export async function fetchActiveUsers(): Promise<{
  data: ActiveUserItem[] | null
  error: string | null
}> {
  try {
    // 1. Tentar ler diretamente da tabela profiles (rápido, indexado)
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('id, name, email, role, status, avatar_url, last_seen_at, created_at')
      .order('last_seen_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })

    if (!error && profiles && profiles.length > 0) {
      return {
        data: profiles.map((p) => ({
          id: p.id,
          name: p.name || 'Sem nome',
          email: p.email || '',
          role: p.role || 'Usuário',
          status: p.status || 'Ativo',
          avatar_url: p.avatar_url || null,
          last_seen_at: p.last_seen_at || null,
          created_at: p.created_at,
        })),
        error: null,
      }
    }

    // 2. Fallback via Edge Function se profiles direto não vier
    const { data: edgeData, error: edgeErr } = await supabase.functions.invoke(
      'admin-user-management',
      { body: { action: 'list' } },
    )

    if (edgeErr || !edgeData?.users) {
      return {
        data: null,
        error: edgeErr?.message || error?.message || 'Falha ao carregar usuários ativos.',
      }
    }

    const items: ActiveUserItem[] = (edgeData.users || []).map((u: any) => ({
      id: u.id,
      name: u.name || 'Sem nome',
      email: u.email || '',
      role: u.role || 'Usuário',
      status: u.status || 'Ativo',
      avatar_url: u.avatar_url || null,
      last_seen_at: u.last_seen_at || null,
      created_at: u.created_at,
    }))

    // Ordenação: com last_seen_at desc, depois sem last_seen_at por created_at desc
    items.sort((a, b) => {
      if (a.last_seen_at && b.last_seen_at) {
        return new Date(b.last_seen_at).getTime() - new Date(a.last_seen_at).getTime()
      }
      if (a.last_seen_at && !b.last_seen_at) return -1
      if (!a.last_seen_at && b.last_seen_at) return 1
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })

    return { data: items, error: null }
  } catch (err: any) {
    return { data: null, error: err?.message || 'Erro inesperado ao buscar usuários ativos.' }
  }
}
