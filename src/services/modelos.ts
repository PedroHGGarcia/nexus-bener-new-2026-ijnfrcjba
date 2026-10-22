import { supabase } from '@/lib/supabase/client'
import { Modelo, ModeloInsert, ModeloUpdate } from '@/types/modelo'

const TABLE = 'modelos'

export async function fetchModelos(): Promise<Modelo[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as Modelo[]
}

export async function checkNomeDuplicate(nome: string, excludeId?: string): Promise<boolean> {
  let query = supabase.from(TABLE).select('id').eq('nome', nome)
  if (excludeId) query = query.neq('id', excludeId)
  const { data, error } = await query.maybeSingle()
  if (error) return false
  return !!data
}

export async function insertModelo(payload: ModeloInsert): Promise<Modelo> {
  const { data, error } = await (supabase.from(TABLE) as any).insert(payload).select().single()
  if (error) throw new Error(error.message)
  return data as Modelo
}

export async function updateModelo(payload: ModeloUpdate): Promise<Modelo> {
  const { id, ...rest } = payload
  const { data, error } = await (supabase.from(TABLE) as any)
    .update(rest)
    .eq('id', id)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data as Modelo
}

export async function deleteModelo(id: string): Promise<void> {
  const { error } = await supabase.from(TABLE).delete().eq('id', id)
  if (error) throw new Error(error.message)
}
