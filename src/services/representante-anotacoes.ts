import { supabase } from '@/lib/supabase/client'
import {
  RepresentanteAnotacao,
  RepresentanteAnotacaoInsert,
  RepresentanteAnotacaoUpdate,
} from '@/types/representante-anotacao'

const TABLE = 'representante_anotacoes'

export async function fetchRepresentanteAnotacoes(
  representanteId: string,
  ano?: number,
): Promise<RepresentanteAnotacao[]> {
  let query = supabase
    .from(TABLE)
    .select('*')
    .eq('representante_id', representanteId)
    .order('created_at', { ascending: false })

  if (ano) {
    query = query.eq('ano_referencia', ano)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as RepresentanteAnotacao[]
}

export async function insertRepresentanteAnotacao(
  payload: RepresentanteAnotacaoInsert,
): Promise<RepresentanteAnotacao> {
  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      representante_id: payload.representante_id,
      ano_referencia: payload.ano_referencia,
      titulo: payload.titulo,
      texto: payload.texto,
      autor_id: payload.autor_id,
      autor_nome: payload.autor_nome,
    })
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data as unknown as RepresentanteAnotacao
}

export async function updateRepresentanteAnotacao(
  payload: RepresentanteAnotacaoUpdate,
): Promise<RepresentanteAnotacao> {
  const { id, ...rest } = payload
  const { data, error } = await supabase.from(TABLE).update(rest).eq('id', id).select().single()

  if (error) throw new Error(error.message)
  return data as unknown as RepresentanteAnotacao
}

export async function deleteRepresentanteAnotacao(id: string): Promise<void> {
  const { error } = await supabase.from(TABLE).delete().eq('id', id)
  if (error) throw new Error(error.message)
}
