import { supabase } from '@/lib/supabase/client'
import {
  CategoriaProduto,
  CategoriaProdutoInsert,
  CategoriaProdutoUpdate,
} from '@/types/categoria-produto'

const TABLE = 'categorias'

export async function fetchCategoriasProdutos(): Promise<CategoriaProduto[]> {
  const { data, error } = await (supabase.from(TABLE) as any)
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as CategoriaProduto[]
}

export async function checkNomeDuplicate(nome: string, excludeId?: string): Promise<boolean> {
  let query = (supabase.from(TABLE) as any).select('id').eq('nome', nome)
  if (excludeId) query = query.neq('id', excludeId)
  const { data, error } = await query.maybeSingle()
  if (error) return false
  return !!data
}

export async function insertCategoriaProduto(
  payload: CategoriaProdutoInsert,
): Promise<CategoriaProduto> {
  const { data, error } = await (supabase.from(TABLE) as any).insert(payload).select().single()
  if (error) throw new Error(error.message)
  return data as CategoriaProduto
}

export async function updateCategoriaProduto(
  payload: CategoriaProdutoUpdate,
): Promise<CategoriaProduto> {
  const { id, ...rest } = payload
  const { data, error } = await (supabase.from(TABLE) as any)
    .update(rest)
    .eq('id', id)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data as CategoriaProduto
}

export async function deleteCategoriaProduto(id: string): Promise<void> {
  const { error } = await (supabase.from(TABLE) as any).delete().eq('id', id)
  if (error) throw new Error(error.message)
}
