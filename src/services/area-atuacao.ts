import { supabase } from '@/lib/supabase/client'
import {
  AreaAtuacao,
  AreaAtuacaoInsert,
  AreaAtuacaoUpdate,
  TerritoryWithRep,
} from '@/types/area-atuacao'

const TABLE = 'area_atuacao'

export async function fetchTerritorios(): Promise<TerritoryWithRep[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*, representantes:representante(fantasia, sigla)')
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => {
    const repData = row.representantes as unknown as {
      fantasia: string
      sigla: string | null
    } | null
    return {
      id: row.id,
      representante: row.representante,
      geometria: row.geometria as unknown as TerritoryWithRep['geometria'],
      cor: row.cor,
      created_at: row.created_at,
      updated_at: row.updated_at,
      representante_nome: repData?.fantasia ?? null,
      representante_sigla: repData?.sigla ?? null,
    } as unknown as TerritoryWithRep
  })
}

export async function insertTerritorio(payload: AreaAtuacaoInsert): Promise<AreaAtuacao> {
  const { data, error } = await supabase
    .from(TABLE)
    .insert(
      payload as unknown as import('@/lib/supabase/types').Database['public']['Tables']['area_atuacao']['Insert'],
    )
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data as unknown as AreaAtuacao
}

export async function updateTerritorio(payload: AreaAtuacaoUpdate): Promise<AreaAtuacao> {
  const { id, ...rest } = payload
  const { data, error } = await supabase
    .from(TABLE)
    .update(
      rest as unknown as import('@/lib/supabase/types').Database['public']['Tables']['area_atuacao']['Update'],
    )
    .eq('id', id)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data as unknown as AreaAtuacao
}

export async function deleteTerritorio(id: string): Promise<void> {
  const { error } = await supabase.from(TABLE).delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export async function fetchClientsByRepresentative(
  representanteId: string,
): Promise<{ id: string; fantasia: string; cidade: string | null; estado: string | null }[]> {
  const { data, error } = await supabase
    .from('clientes')
    .select('id, fantasia, cidade, estado')
    .eq('status', 'Ativo')
    .order('fantasia')

  if (error) throw new Error(error.message)
  return (data ?? []).map((c) => ({
    id: c.id,
    fantasia: c.fantasia,
    cidade: c.cidade,
    estado: c.estado,
  }))
}
