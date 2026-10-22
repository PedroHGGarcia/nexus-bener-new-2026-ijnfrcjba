import { supabase } from '@/lib/supabase/client'
import { Marca, MarcaInsert, MarcaUpdate } from '@/types/marca'

const TABLE = 'marcas'

export async function fetchMarcas(): Promise<Marca[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as Marca[]
}

export async function checkNomeDuplicate(nome: string, excludeId?: string): Promise<boolean> {
  let query = supabase.from(TABLE).select('id').eq('nome', nome)
  if (excludeId) query = query.neq('id', excludeId)
  const { data, error } = await query.maybeSingle()
  if (error) return false
  return !!data
}

export async function insertMarca(payload: MarcaInsert): Promise<Marca> {
  const { data, error } = await supabase.from(TABLE).insert(payload).select().single()
  if (error) throw new Error(error.message)
  return data as Marca
}

export async function updateMarca(payload: MarcaUpdate): Promise<Marca> {
  const { id, ...rest } = payload
  const { data, error } = await supabase.from(TABLE).update(rest).eq('id', id).select().single()
  if (error) throw new Error(error.message)
  return data as Marca
}

export async function deleteMarca(id: string): Promise<void> {
  const { error } = await supabase.from(TABLE).delete().eq('id', id)
  if (error) throw new Error(error.message)
}
