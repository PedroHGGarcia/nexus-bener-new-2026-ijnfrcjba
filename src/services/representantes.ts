import { supabase } from '@/lib/supabase/client'
import { Representante, RepresentanteInsert, RepresentanteUpdate } from '@/types/representante'

const TABLE = 'representantes'

export async function fetchRepresentantes(): Promise<Representante[]> {
  const { data, error } = await (supabase.from(TABLE) as any)
    .select(`
      *,
      gerente:gerentes (id, nome, email, cargo),
      representante_categorias (
        categoria_id,
        categorias (id, nome)
      ),
      representante_regioes (
        regiao_id,
        regioes (id, nome, uf, todo_o_estado, cidades)
      )
    `)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []).map((row: any) => {
    const cats = (row.representante_categorias || [])
      .map((rc: any) => rc.categorias)
      .filter(Boolean)
    const regs = (row.representante_regioes || []).map((rr: any) => rr.regioes).filter(Boolean)
    return {
      ...row,
      gerente: row.gerente || null,
      categorias: cats,
      regioes: regs,
      total_categorias: cats.length,
      total_regioes: regs.length,
    }
  }) as Representante[]
}

export async function fetchRepresentanteVinculos(representanteId: string): Promise<{
  categoriaIds: string[]
  regiaoIds: string[]
}> {
  const [{ data: cats }, { data: regs }] = await Promise.all([
    (supabase as any)
      .from('representante_categorias')
      .select('categoria_id')
      .eq('representante_id', representanteId),
    (supabase as any)
      .from('representante_regioes')
      .select('regiao_id')
      .eq('representante_id', representanteId),
  ])

  return {
    categoriaIds: (cats || []).map((c: any) => c.categoria_id),
    regiaoIds: (regs || []).map((r: any) => r.regiao_id),
  }
}

export async function syncRepresentanteVinculos(
  representanteId: string,
  categoriaIds: string[],
  regiaoIds: string[],
  estadosList?: string[],
): Promise<void> {
  // Sync categorias
  await (supabase as any)
    .from('representante_categorias')
    .delete()
    .eq('representante_id', representanteId)

  if (categoriaIds.length > 0) {
    const catRows = categoriaIds.map((cid) => ({
      representante_id: representanteId,
      categoria_id: cid,
    }))
    const { error: catErr } = await (supabase as any)
      .from('representante_categorias')
      .insert(catRows)
    if (catErr) throw new Error(catErr.message)
  }

  // Se estadosList foi passado, sincronizamos e adicionamos as regiões dos estados informados
  let finalRegiaoIds = Array.from(new Set(regiaoIds || []))
  if (estadosList !== undefined && estadosList.length > 0) {
    const { data: regRows } = await supabase.from('regioes').select('id, uf').in('uf', estadosList)
    if (regRows && regRows.length > 0) {
      const stateRegIds = regRows.map((r) => r.id)
      finalRegiaoIds = Array.from(new Set([...finalRegiaoIds, ...stateRegIds]))
    }
  }

  // Sync regioes
  await (supabase as any)
    .from('representante_regioes')
    .delete()
    .eq('representante_id', representanteId)

  if (finalRegiaoIds && finalRegiaoIds.length > 0) {
    const regRows = finalRegiaoIds.map((rid) => ({
      representante_id: representanteId,
      regiao_id: rid,
    }))
    const { error: regErr } = await (supabase as any).from('representante_regioes').insert(regRows)
    if (regErr) throw new Error(regErr.message)
  }

  // Sincronizar com o perfil vinculado ao representante e campo estado
  try {
    const { data: rep } = await (supabase.from(TABLE) as any)
      .select('profile_id, email, estado')
      .eq('id', representanteId)
      .maybeSingle()

    if (rep) {
      const targetEstado =
        estadosList !== undefined
          ? estadosList.length > 0
            ? estadosList.join(', ')
            : null
          : rep.estado || null

      if (estadosList !== undefined) {
        await (supabase.from(TABLE) as any)
          .update({ estado: targetEstado })
          .eq('id', representanteId)
      }

      if (rep.profile_id) {
        await supabase
          .from('profiles')
          .update({ estado_atuacao: targetEstado })
          .eq('id', rep.profile_id)
      } else if (rep.email) {
        await supabase
          .from('profiles')
          .update({ estado_atuacao: targetEstado })
          .ilike('email', rep.email)
      }
    }
  } catch (syncErr) {
    console.warn('Erro ao sincronizar profile em syncRepresentanteVinculos:', syncErr)
  }
}
export async function insertRepresentante(payload: RepresentanteInsert): Promise<Representante> {
  const { categorias, regioes, total_categorias, total_regioes, gerente, ...cleanPayload } =
    payload as any
  const { data, error } = await (supabase.from(TABLE) as any).insert(cleanPayload).select().single()
  if (error) throw new Error(error.message)
  return data as Representante
}

export async function updateRepresentante(payload: RepresentanteUpdate): Promise<Representante> {
  const { id, categorias, regioes, total_categorias, total_regioes, gerente, ...rest } =
    payload as any
  const { data, error } = await (supabase.from(TABLE) as any)
    .update(rest)
    .eq('id', id)
    .select()
    .single()
  if (error) throw new Error(error.message)

  // Sincronizar estado_atuacao no profile se o estado foi modificado
  if (rest.estado !== undefined && data) {
    try {
      if (data.profile_id) {
        await supabase
          .from('profiles')
          .update({ estado_atuacao: data.estado || null })
          .eq('id', data.profile_id)
      } else if (data.email) {
        await supabase
          .from('profiles')
          .update({ estado_atuacao: data.estado || null })
          .ilike('email', data.email)
      }
    } catch (syncErr) {
      console.warn('Erro ao sincronizar profile no updateRepresentante:', syncErr)
    }
  }

  return data as Representante
}

export async function deleteRepresentante(id: string): Promise<void> {
  const { error } = await supabase.from(TABLE).delete().eq('id', id)
  if (error) throw new Error(error.message)
}

/**
 * Encontra o registro de representante vinculado a um usuário logado.
 * Ordem de prioridade de busca:
 * 1. Campo `profile_id` igual ao id do profile/auth;
 * 2. Correspondência exata no campo `email`;
 * 3. Presença do email dentro do array JSONB `emails`.
 */
export async function findRepresentanteByProfile(
  profileId?: string | null,
  email?: string | null,
): Promise<Representante | null> {
  if (!profileId && !email) return null

  // 1. Tentar por profile_id primeiro (vínculo direto)
  if (profileId) {
    const { data: byProfile } = await (supabase.from(TABLE) as any)
      .select('*')
      .eq('profile_id', profileId)
      .maybeSingle()
    if (byProfile) return byProfile as Representante
  }

  if (!email) return null
  const normalizedEmail = email.trim().toLowerCase()

  // 2. Tentar por email direto
  const { data: byEmail } = await (supabase.from(TABLE) as any)
    .select('*')
    .ilike('email', normalizedEmail)
    .limit(1)
  if (byEmail && byEmail.length > 0) {
    return byEmail[0] as Representante
  }

  // 3. Tentar por array JSONB de emails
  const { data: allReps } = await (supabase.from(TABLE) as any).select('*')
  if (allReps) {
    const match = (allReps as any[]).find((r) => {
      if (typeof r.email === 'string' && r.email.trim().toLowerCase() === normalizedEmail) {
        return true
      }
      if (Array.isArray(r.emails)) {
        return r.emails.some(
          (e: unknown) => typeof e === 'string' && e.trim().toLowerCase() === normalizedEmail,
        )
      }
      return false
    })
    if (match) return match as Representante
  }

  return null
}
