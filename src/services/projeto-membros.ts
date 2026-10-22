import { supabase } from '@/lib/supabase/client'
import { ProjetoMembroWithProfile } from '@/types/projeto-membro'

const TABLE = 'projeto_membros'

export async function fetchMembros(projetoId: string): Promise<ProjetoMembroWithProfile[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*, profiles(id, name, email, avatar_url, role)')
    .eq('projeto_id', projetoId)
    .order('created_at', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as ProjetoMembroWithProfile[]
}

export async function addMembro(projetoId: string, userId: string, papel: string): Promise<void> {
  const { error } = await supabase
    .from(TABLE)
    .insert({ projeto_id: projetoId, user_id: userId, papel })
  if (error) throw new Error(error.message)
}

export async function updateMembroPapel(membroId: string, papel: string): Promise<void> {
  const { error } = await supabase.from(TABLE).update({ papel }).eq('id', membroId)
  if (error) throw new Error(error.message)
}

export async function removeMembro(membroId: string): Promise<void> {
  const { error } = await supabase.from(TABLE).delete().eq('id', membroId)
  if (error) throw new Error(error.message)
}

export async function ensureMember(
  projetoId: string,
  userId: string,
  papel: string = 'Colaborador',
): Promise<void> {
  const { error } = await supabase
    .from(TABLE)
    .insert({ projeto_id: projetoId, user_id: userId, papel })
  if (error && error.code !== '23505') throw new Error(error.message)
}

export async function searchProfiles(
  query: string,
  excludeIds: string[] = [],
): Promise<
  { id: string; name: string; email: string; avatar_url: string | null; role: string | null }[]
> {
  let q = supabase
    .from('profiles')
    .select('id, name, email, avatar_url, role')
    .or(`name.ilike.%${query}%,email.ilike.%${query}%`)
    .limit(10)
  if (excludeIds.length > 0) {
    q = q.not('id', 'in', `(${excludeIds.join(',')})`)
  }
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return data ?? []
}
