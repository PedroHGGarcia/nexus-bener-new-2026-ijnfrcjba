import { supabase } from '@/lib/supabase/client'
import type { ServiceResult } from '@/lib/utils'
import { fetchUsers, inviteUser, updateUserProfile, type AdminUser } from '@/services/users'
import { uploadAvatar, uploadSignature } from '@/services/profiles'

export async function fetchUsuarios(): Promise<ServiceResult<AdminUser[]>> {
  const { data, error } = await fetchUsers()
  if (error) return { ok: false, error }
  return { ok: true, data: data ?? [] }
}

export async function inviteUsuario(params: {
  name: string
  email: string
  setor: string
  role: string
  password?: string
}): Promise<ServiceResult<{ invited: boolean }>> {
  const { error } = await inviteUser({ ...params, password: params.password ?? 'Temp@123456' })
  if (error) return { ok: false, error }
  return { ok: true, data: { invited: true } }
}

export async function updateUsuario(
  id: string,
  updates: { role?: string; status?: string; setor?: string },
): Promise<ServiceResult<{ updated: boolean }>> {
  const { error } = await updateUserProfile(id, updates)
  if (error) return { ok: false, error }
  return { ok: true, data: { updated: true } }
}

export async function updateMenuAccess(
  userId: string,
  menuAccess: string[],
): Promise<ServiceResult<{ updated: boolean }>> {
  try {
    const { error } = await supabase
      .from('profiles')
      .update({ menu_access: menuAccess })
      .eq('id', userId)
    if (error) return { ok: false, error: error.message }
    return { ok: true, data: { updated: true } }
  } catch {
    return { ok: false, error: 'Erro ao atualizar permissões de menu.' }
  }
}

export async function updateAvatarUsuario(
  userId: string,
  file: File,
): Promise<ServiceResult<string>> {
  try {
    const url = await uploadAvatar(userId, file)
    return { ok: true, data: url }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Erro ao atualizar avatar.' }
  }
}

export async function updateSignatureUsuario(
  userId: string,
  file: File,
): Promise<ServiceResult<string>> {
  try {
    const url = await uploadSignature(userId, file)
    return { ok: true, data: url }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Erro ao atualizar assinatura.' }
  }
}
