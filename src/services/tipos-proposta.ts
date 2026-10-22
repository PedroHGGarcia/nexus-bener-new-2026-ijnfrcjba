import { supabase } from '@/lib/supabase/client'
import { withJwtRetry } from '@/lib/supabase-retry'
import { TipoProposta, TipoPropostaInsert, TipoPropostaUpdate } from '@/types/tipo-proposta'

// Service for managing Tipos de Proposta
const TABLE = 'tipos_proposta'

export async function fetchTiposProposta(activeOnly = false): Promise<TipoProposta[]> {
  return withJwtRetry(async () => {
    let query = supabase.from(TABLE).select('*').order('nome', { ascending: true })
    if (activeOnly) query = query.in('status', ['A', 'Ativo'])
    const { data, error } = await query
    if (error) throw new Error(error.message)
    return (data ?? []) as TipoProposta[]
  })
}

/**
 * Fetches only the tipos de proposta associated with a given versão via
 * the versao_tipos_proposta join table.
 */
export async function fetchTiposPropostaByVersaoId(
  versaoId: string,
  activeOnly = false,
): Promise<TipoProposta[]> {
  if (!versaoId) return []
  return withJwtRetry(async () => {
    const { data: links, error: linkError } = await supabase
      .from('versao_tipos_proposta')
      .select('tipo_proposta_id')
      .eq('versao_id', versaoId)

    if (linkError) throw new Error(linkError.message)
    const tipoIds = (links ?? [])
      .map((r: { tipo_proposta_id: string }) => r.tipo_proposta_id)
      .filter(Boolean)

    if (tipoIds.length > 0) {
      let query = supabase
        .from(TABLE)
        .select('*')
        .in('id', tipoIds)
        .order('nome', { ascending: true })

      if (activeOnly) query = query.in('status', ['A', 'Ativo'])

      const { data, error } = await query
      if (error) throw new Error(error.message)
      return (data ?? []) as TipoProposta[]
    }

    // Fallback: quando a join table não retornar registros, verificar a coluna
    // JSONB tipos_proposta em versoes (compatibilidade com versões antigas ou
    // criadas antes da unificação do formulário, como a SA-470).
    const { data: versaoData, error: versaoError } = await supabase
      .from('versoes')
      .select('tipos_proposta')
      .eq('id', versaoId)
      .maybeSingle()

    if (versaoError) throw new Error(versaoError.message)

    const rawTipos = versaoData?.tipos_proposta
    const nomesJson: string[] = Array.isArray(rawTipos)
      ? rawTipos.filter((n): n is string => typeof n === 'string' && n.trim().length > 0)
      : []

    if (nomesJson.length === 0) return []

    let tiposQuery = supabase.from(TABLE).select('*').order('nome', { ascending: true })

    if (activeOnly) tiposQuery = tiposQuery.in('status', ['A', 'Ativo'])

    const { data: allTipos, error: allTiposError } = await tiposQuery
    if (allTiposError) throw new Error(allTiposError.message)
    if (!allTipos || allTipos.length === 0) return []

    const normalizedJsonSet = new Set(nomesJson.map((n) => normalizeTipoPropostaNome(n)))

    return (allTipos as TipoProposta[]).filter((t) =>
      normalizedJsonSet.has(normalizeTipoPropostaNome(t.nome)),
    )
  })
}

/**
 * Normalizes a name for comparison:
 * - strips leading/trailing whitespace
 * - collapses internal consecutive whitespace / non-breaking spaces into a single regular space
 * - converts to lowercase
 * - strips zero-width spaces/characters
 */
export function normalizeTipoPropostaNome(nome: string): string {
  if (!nome) return ''
  return nome
    .replace(/[\u200B-\u200D\uFEFF]/g, '') // remove zero-width characters and BOM
    .replace(/\s+/g, ' ') // collapse tabs, non-breaking spaces & multiple spaces into a single space
    .trim()
    .toLowerCase()
}

export async function checkNomeDuplicate(nome: string, excludeId?: string): Promise<boolean> {
  const cleanNome = nome.trim()
  if (!cleanNome) return false

  return withJwtRetry(async () => {
    // Case-insensitive query via ilike
    let query = supabase.from(TABLE).select('id, nome').ilike('nome', cleanNome)
    if (excludeId) query = query.neq('id', excludeId)
    const { data, error } = await query
    if (error) return false
    if (!data || data.length === 0) return false

    const targetNorm = normalizeTipoPropostaNome(cleanNome)
    return data.some((row) => normalizeTipoPropostaNome(row.nome) === targetNorm)
  })
}

export async function fetchAllTiposPropostaNomes(): Promise<Set<string>> {
  return withJwtRetry(async () => {
    const { data, error } = await supabase.from(TABLE).select('nome')
    if (error) throw new Error(error.message)
    const set = new Set<string>()
    ;(data || []).forEach((row: { nome: string }) => {
      if (row.nome) {
        const norm = normalizeTipoPropostaNome(row.nome)
        if (norm) set.add(norm)
      }
    })
    return set
  })
}

export async function insertTipoProposta(payload: TipoPropostaInsert): Promise<TipoProposta> {
  const { data, error } = await supabase
    .from(TABLE)
    .insert(payload as any)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data as TipoProposta
}

export async function updateTipoProposta(payload: TipoPropostaUpdate): Promise<TipoProposta> {
  const { id, ...rest } = payload
  const { data, error } = await supabase
    .from(TABLE)
    .update({ ...rest, updated_at: new Date().toISOString() } as any)
    .eq('id', id)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data as TipoProposta
}

export async function deleteTipoProposta(id: string): Promise<void> {
  const { error } = await supabase.from(TABLE).delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export async function deleteAllTiposProposta(): Promise<number> {
  return withJwtRetry(async () => {
    // 1. Delete junctions from versao_tipos_proposta first to avoid FK issues
    try {
      await supabase.from('versao_tipos_proposta').delete().not('tipo_proposta_id', 'is', null)
    } catch {
      // Continue even if junction table was already empty or failed
    }

    // 2. Perform delete on tipos_proposta
    // PostgREST requires a filter for deletes, using not.is.null
    const { data, error } = await supabase.from(TABLE).delete().not('id', 'is', null).select('id')

    if (error) throw new Error(error.message)
    return data?.length ?? 0
  })
}
