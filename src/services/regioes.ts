import { supabase } from '@/lib/supabase/client'
import { Regiao, RegiaoInsert, RegiaoUpdate } from '@/types/regiao'

const TABLE = 'regioes'

export async function fetchRegioes(): Promise<Regiao[]> {
  const { data, error } = await supabase.from(TABLE).select('*').order('nome', { ascending: true })

  if (error) throw new Error(error.message)
  return (data ?? []).map((row: any) => ({
    ...row,
    todo_o_estado:
      row.todo_o_estado ?? (Array.isArray(row.cidades) ? row.cidades.length === 0 : true),
    cidades: Array.isArray(row.cidades) ? row.cidades : [],
  })) as Regiao[]
}

export async function insertRegiao(payload: RegiaoInsert): Promise<Regiao> {
  const { data, error } = await (supabase.from(TABLE) as any).insert(payload).select().single()
  if (error) throw new Error(error.message)
  return data as Regiao
}

export async function updateRegiao(payload: RegiaoUpdate): Promise<Regiao> {
  const { id, ...rest } = payload
  const { data, error } = await (supabase.from(TABLE) as any)
    .update(rest)
    .eq('id', id)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data as Regiao
}

export async function deleteRegiao(id: string): Promise<void> {
  const { error } = await supabase.from(TABLE).delete().eq('id', id)
  if (error) throw new Error(error.message)
}
