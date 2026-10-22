import { supabase } from '@/lib/supabase/client'
import type { ServiceResult } from '@/lib/utils'

export type CadastroTable =
  | 'marcas'
  | 'modelos'
  | 'categorias'
  | 'regioes'
  | 'representantes'
  | 'gerentes'
  | 'tipos_proposta'

export async function fetchCadastros<T>(table: CadastroTable): Promise<ServiceResult<T[]>> {
  try {
    const { data, error } = await (supabase.from(table as any) as any)
      .select('*')
      .order('created_at', { ascending: false })
    if (error) return { ok: false, error: error.message }
    return { ok: true, data: (data ?? []) as T[] }
  } catch {
    return { ok: false, error: `Erro ao buscar registros de ${table}.` }
  }
}

export async function insertCadastro<T>(
  table: CadastroTable,
  payload: Record<string, unknown>,
): Promise<ServiceResult<T>> {
  try {
    const { data, error } = await (supabase.from(table) as any).insert(payload).select().single()
    if (error) return { ok: false, error: error.message }
    return { ok: true, data: data as T }
  } catch {
    return { ok: false, error: `Erro ao criar registro em ${table}.` }
  }
}

export async function updateCadastro<T>(
  table: CadastroTable,
  id: string,
  payload: Record<string, unknown>,
): Promise<ServiceResult<T>> {
  try {
    const { data, error } = await (supabase.from(table) as any)
      .update(payload)
      .eq('id', id)
      .select()
      .single()
    if (error) return { ok: false, error: error.message }
    return { ok: true, data: data as T }
  } catch {
    return { ok: false, error: `Erro ao atualizar registro em ${table}.` }
  }
}

export async function deleteCadastro(
  table: CadastroTable,
  id: string,
): Promise<ServiceResult<void>> {
  try {
    const { error } = await (supabase.from(table as any) as any).delete().eq('id', id)
    if (error) return { ok: false, error: error.message }
    return { ok: true, data: undefined }
  } catch {
    return { ok: false, error: `Erro ao excluir registro de ${table}.` }
  }
}

export async function checkDuplicate(
  table: CadastroTable,
  field: string,
  value: string,
  excludeId?: string,
): Promise<boolean> {
  let query = (supabase.from(table) as any).select('id').eq(field, value)
  if (excludeId) query = query.neq('id', excludeId)
  const { data } = await query.maybeSingle()
  return !!data
}
