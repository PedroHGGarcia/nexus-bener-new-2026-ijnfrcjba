import { supabase } from '@/lib/supabase/client'
import { UserProfile, Role } from '@/types'

export async function fetchProfile(userId: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select(
      'id, name, email, role, avatar_url, setor, menu_access, status, assinatura, gerente_id, estado_atuacao',
    )
    .eq('id', userId)
    .single()

  if (error || !data) return null

  const row = data as Record<string, unknown>

  return {
    id: data.id,
    name: data.name,
    email: data.email,
    role: data.role as Role,
    avatarUrl: (data.avatar_url as string) ?? undefined,
    setor: (data.setor as string) ?? undefined,
    menuAccess: (() => {
      let raw = data.menu_access
      if (typeof raw === 'string') {
        try {
          raw = JSON.parse(raw)
        } catch {
          // Mantém string se falhar parse
        }
      }
      return Array.isArray(raw) ? (raw as string[]) : []
    })(),
    status: (data.status as string) === 'Inativo' ? 'Inativo' : 'Ativo',
    assinatura: (data.assinatura as string) ?? undefined,
    gerente_id: (row.gerente_id as string | null) ?? null,
    estado_atuacao: (row.estado_atuacao as string | null) ?? null,
  }
}

export async function updateProfileDb(
  userId: string,
  updates: Partial<UserProfile>,
): Promise<{ error: string | null }> {
  const dbUpdates: Record<string, unknown> = {}
  if (updates.name !== undefined) dbUpdates.name = updates.name
  if (updates.avatarUrl !== undefined) dbUpdates.avatar_url = updates.avatarUrl
  if (updates.setor !== undefined) dbUpdates.setor = updates.setor
  if (updates.assinatura !== undefined) dbUpdates.assinatura = updates.assinatura
  if (updates.estado_atuacao !== undefined) dbUpdates.estado_atuacao = updates.estado_atuacao

  const { error } = await supabase
    .from('profiles')
    .update(
      dbUpdates as import('@/lib/supabase/types').Database['public']['Tables']['profiles']['Update'],
    )
    .eq('id', userId)
  return { error: error?.message ?? null }
}

export async function uploadAvatar(userId: string, file: File): Promise<string> {
  const ext = file.name.split('.').pop() || 'png'
  const path = `${userId}/avatar-${Date.now()}.${ext}`
  const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
  if (error) throw new Error(error.message)
  const { data } = supabase.storage.from('avatars').getPublicUrl(path)
  return data.publicUrl
}

export async function uploadSignature(userId: string, file: File): Promise<string> {
  const ext = file.name.split('.').pop() || 'png'
  const path = `${userId}/signature-${Date.now()}.${ext}`
  const { error } = await supabase.storage.from('signatures').upload(path, file, { upsert: true })
  if (error) throw new Error(error.message)
  const { data } = supabase.storage.from('signatures').getPublicUrl(path)
  return data.publicUrl
}
