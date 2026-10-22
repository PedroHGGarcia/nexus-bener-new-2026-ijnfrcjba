import { supabase } from '@/lib/supabase/client'
import { Database } from '@/lib/supabase/types'
import { Acessorio, AcessorioInsert, AcessorioUpdate } from '@/types/acessorio'

const TABLE = 'acessorios'
type AcessorioRowInsert = Database['public']['Tables']['acessorios']['Insert']
type AcessorioRowUpdate = Database['public']['Tables']['acessorios']['Update']

export async function fetchAcessorios(): Promise<Acessorio[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*, acessorio_versoes(versao_id, versoes(nome))')
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)

  return (data ?? []).map((item) => {
    const rawVersoes = (
      item as {
        acessorio_versoes?: Array<{
          versao_id?: string | null
          versoes?: { nome?: string | null } | Array<{ nome?: string | null }> | null
        }> | null
      }
    ).acessorio_versoes

    let versaoIds: string[] = []
    let versaoNomes: string[] = []

    if (Array.isArray(rawVersoes)) {
      for (const av of rawVersoes) {
        if (av.versao_id && typeof av.versao_id === 'string') {
          versaoIds.push(av.versao_id)
        }

        if (av.versoes) {
          if (Array.isArray(av.versoes)) {
            for (const v of av.versoes) {
              if (v?.nome && typeof v.nome === 'string' && v.nome.trim()) {
                versaoNomes.push(v.nome.trim())
              }
            }
          } else if (
            typeof av.versoes === 'object' &&
            av.versoes.nome &&
            typeof av.versoes.nome === 'string'
          ) {
            if (av.versoes.nome.trim()) {
              versaoNomes.push(av.versoes.nome.trim())
            }
          }
        }
      }
      versaoIds = Array.from(new Set(versaoIds))
      versaoNomes = Array.from(new Set(versaoNomes))
    }

    const { acessorio_versoes: _ignored, ...rest } = item as Record<string, unknown>
    return {
      ...rest,
      versoes: versaoIds,
      versao_nomes: versaoNomes,
    } as Acessorio
  })
}

export async function insertAcessorio(
  payload: AcessorioInsert,
  userId?: string,
  userName?: string,
): Promise<Acessorio> {
  const insertPayload: AcessorioRowInsert = {
    nome: payload.nome,
    tipo: payload.tipo,
    moeda: payload.moeda,
    valor: payload.valor,
    fator_nac: payload.fator_nac,
    status: payload.status,
    versoes:
      payload.versoes as unknown as Database['public']['Tables']['acessorios']['Insert']['versoes'],
    especificacoes_tecnicas: payload.especificacoes_tecnicas,
    valor_anterior: payload.valor_anterior,
    data_ultimo_reajuste: payload.data_ultimo_reajuste,
    atualizado_por: userName ?? 'Sistema',
  }

  const { data, error } = await supabase.from(TABLE).insert(insertPayload).select().single()
  if (error) throw new Error(error.message)

  await supabase.from('audit_logs').insert({
    action: 'create',
    table_name: 'acessorios',
    record_id: data.id,
    user_id: userId ?? null,
    user_name: userName ?? null,
    data_changes: insertPayload as unknown as import('@/lib/supabase/types').Json,
  })

  return data as Acessorio
}

export async function updateAcessorio(
  payload: AcessorioUpdate,
  userId?: string,
  userName?: string,
): Promise<Acessorio> {
  const { id, valor, ...rest } = payload
  const { data: current } = await supabase.from(TABLE).select('valor').eq('id', id).single()

  const updateData: AcessorioRowUpdate = {
    ...rest,
    versoes:
      rest.versoes as unknown as Database['public']['Tables']['acessorios']['Update']['versoes'],
    atualizado_por: userName ?? 'Sistema',
  }

  if (current && valor !== undefined && valor !== current.valor) {
    updateData.valor = valor
    updateData.valor_anterior = current.valor
    updateData.data_ultimo_reajuste = new Date().toISOString()
  } else if (valor !== undefined) {
    updateData.valor = valor
  }

  const { data, error } = await supabase
    .from(TABLE)
    .update(updateData)
    .eq('id', id)
    .select()
    .single()
  if (error) throw new Error(error.message)

  await supabase.from('audit_logs').insert({
    action: 'update',
    table_name: 'acessorios',
    record_id: id,
    user_id: userId ?? null,
    user_name: userName ?? null,
    data_changes: updateData as unknown as import('@/lib/supabase/types').Json,
  })

  return data as Acessorio
}

export async function deleteAcessorio(
  id: string,
  userId?: string,
  userName?: string,
): Promise<void> {
  const { error } = await supabase.from(TABLE).delete().eq('id', id)
  if (error) throw new Error(error.message)

  await supabase.from('audit_logs').insert({
    action: 'delete',
    table_name: 'acessorios',
    record_id: id,
    user_id: userId ?? null,
    user_name: userName ?? null,
  })
}
