import { supabase } from '@/lib/supabase/client'
import { Produto, ProdutoInsert, ProdutoUpdate } from '@/types/produto'

const TABLE = 'produtos'

export async function fetchProdutos(): Promise<Produto[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .is('deleted_at', null)
    .order('nome', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as Produto[]
}

export async function fetchProdutoById(id: string): Promise<Produto | null> {
  const { data, error } = await supabase.from(TABLE).select('*').eq('id', id).single()
  if (error) return null
  return data as Produto
}

export async function checkNomeDuplicate(nome: string, excludeId?: string): Promise<boolean> {
  let query = supabase.from(TABLE).select('id').eq('nome', nome)
  if (excludeId) query = query.neq('id', excludeId)
  const { data, error } = await query.maybeSingle()
  if (error) return false
  return !!data
}

export async function insertProduto(payload: ProdutoInsert): Promise<Produto> {
  const { data, error } = await supabase.from(TABLE).insert(payload).select().single()
  if (error) throw new Error(error.message)
  return data as Produto
}

export async function updateProduto(payload: ProdutoUpdate): Promise<Produto> {
  const { id, ...rest } = payload
  const { data, error } = await supabase.from(TABLE).update(rest).eq('id', id).select().single()
  if (error) throw new Error(error.message)
  return data as Produto
}

export async function deleteProduto(id: string): Promise<void> {
  const { error } = await supabase.from(TABLE).delete().eq('id', id)
  if (error) throw new Error(error.message)
}
