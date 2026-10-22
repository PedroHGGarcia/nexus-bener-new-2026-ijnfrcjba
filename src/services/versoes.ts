import { supabase } from '@/lib/supabase/client'
import {
  Versao,
  VersaoInsert,
  VersaoUpdate,
  VersaoWithModelo,
  VersaoHistorico,
} from '@/types/versao'

const TABLE = 'versoes'
const HISTORICO_TABLE = 'versoes_historico'
const STORAGE_BUCKET = 'versoes-images'

export interface FetchVersoesOptions {
  produtoId?: string
  activeOnly?: boolean
  categoriaId?: string
  categoriaIds?: string[]
  /**
   * If true, omits heavy text columns (especificacoes_tecnicas, acessorios_standards,
   * caracteristicas_construtivas, galeria) which weigh ~3MB+ and drastically slow down
   * initial loading of lists and cascade selectors.
   */
  lightweight?: boolean
}

// In-memory cache for fast subsequent visits within session (TTL: 60s)
interface VersoesCacheEntry {
  data: VersaoWithModelo[]
  timestamp: number
}
const versoesCache = new Map<string, VersoesCacheEntry>()
const CACHE_TTL_MS = 60_000

export function clearVersoesCache() {
  versoesCache.clear()
}

export async function fetchVersoes(
  produtoIdOrOptions?: string | FetchVersoesOptions,
): Promise<VersaoWithModelo[]> {
  const options: FetchVersoesOptions =
    typeof produtoIdOrOptions === 'string'
      ? { produtoId: produtoIdOrOptions }
      : (produtoIdOrOptions ?? {})

  const { produtoId, activeOnly = false, categoriaId, categoriaIds, lightweight = false } = options

  const effectiveCategoriaIds =
    categoriaIds && categoriaIds.length > 0 ? categoriaIds : categoriaId ? [categoriaId] : null

  // Cache key
  const catsKey = effectiveCategoriaIds ? effectiveCategoriaIds.sort().join(',') : ''
  const cacheKey = `${produtoId || ''}:${activeOnly ? 'act' : 'all'}:${catsKey}:${lightweight ? 'lite' : 'full'}`
  const cached = versoesCache.get(cacheKey)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data
  }

  let modeloIds: string[] | null = null

  if (produtoId) {
    const { data: modelosData } = await supabase
      .from('modelos')
      .select('id')
      .eq('produto', produtoId)
      .is('deleted_at', null)
    modeloIds = (modelosData ?? []).map((m) => m.id)
    if (modeloIds.length === 0) return []
  } else if (effectiveCategoriaIds && effectiveCategoriaIds.length > 0) {
    const { data: produtosData } = await supabase
      .from('produtos')
      .select('id')
      .in('categoria', effectiveCategoriaIds)
      .is('deleted_at', null)
    const prodIds = (produtosData ?? []).map((p) => p.id)
    if (prodIds.length === 0) return []

    const { data: modelosData } = await supabase
      .from('modelos')
      .select('id')
      .in('produto', prodIds)
      .is('deleted_at', null)
    modeloIds = (modelosData ?? []).map((m) => m.id)
    if (modeloIds.length === 0) return []
  }

  // Choose columns: lightweight selector payload vs full payload
  const selectColumns = lightweight
    ? 'id, modelo, categoria_id, nome, cod_erp, imagem_preview, moeda, valor, tem_fator, fator_nac, valor_anterior, data_ultimo_reajuste, nome_abreviado, tem_estoque, estoque_total, estoque_bloqueado, estoque_reservado, estoque_disponivel, status, especificacoes_tecnicas, caracteristicas_construtivas, acessorios_standards, created_at, updated_at, deleted_at, modelos(id, nome)'
    : '*, modelos(id, nome)'

  // Fetch all records using pagination chunks if total exceeds PostgREST default limit (1000)
  const PAGE_SIZE = 1000
  let allData: VersaoWithModelo[] = []
  let from = 0
  let hasMore = true

  while (hasMore) {
    let query = supabase
      .from(TABLE)
      .select(selectColumns)
      .is('deleted_at', null)
      .neq('status', 'Em Quarentena')
      .order('nome', { ascending: true })

    if (modeloIds) query = query.in('modelo', modeloIds)
    if (activeOnly) query = query.in('status', ['A', 'Ativo'])

    const { data, error } = await query.range(from, from + PAGE_SIZE - 1)
    if (error) throw new Error(error.message)

    const chunk = (data ?? []) as unknown as VersaoWithModelo[]
    allData = allData.concat(chunk)

    if (chunk.length < PAGE_SIZE) {
      hasMore = false
    } else {
      from += PAGE_SIZE
    }
  }

  // Save to cache
  versoesCache.set(cacheKey, { data: allData, timestamp: Date.now() })

  return allData
}

export async function fetchVersaoById(id: string): Promise<Versao | null> {
  const { data, error } = await supabase.from(TABLE).select('*').eq('id', id).single()
  if (error) return null
  return data as Versao
}

export interface VersaoSearchResult {
  id: string
  nome: string
  nome_abreviado?: string | null
  cod_erp?: string | null
  moeda?: string | null
  valor?: number | null
  status?: string | null
  tem_estoque?: boolean | null
  estoque_disponivel?: number | null
  modelo?: string | null
  modelos?: {
    id: string
    nome: string
    marca?: string | null
    marcas?: {
      id: string
      nome: string
    } | null
  } | null
}

/**
 * Busca versões ativas sob demanda no Supabase com limite de resultados (default 20).
 * Suporta busca por múltiplos termos (AND) em nome, cod_erp e nome_abreviado.
 */
export async function searchVersoesAtivas(
  searchTerm: string,
  limit: number = 20,
  categoriaIdOrIds?: string | string[] | null,
): Promise<VersaoSearchResult[]> {
  const trimmed = searchTerm.trim()
  if (!trimmed || trimmed.length < 2) return []

  // Divide em palavras para buscar (ex: "torno tvk")
  const words = trimmed.split(/\s+/).filter((w) => w.length > 0)
  if (words.length === 0) return []

  let query = supabase
    .from(TABLE)
    .select(`
      id,
      nome,
      nome_abreviado,
      cod_erp,
      moeda,
      valor,
      status,
      tem_estoque,
      estoque_disponivel,
      modelo,
      categoria_id,
      modelos (
        id,
        nome,
        marca,
        produto,
        marcas (
          id,
          nome
        ),
        produtos (
          id,
          categoria
        )
      )
    `)
    .in('status', ['A', 'Ativo'])
    .is('deleted_at', null)
    .neq('status', 'Em Quarentena')

  if (categoriaIdOrIds) {
    if (Array.isArray(categoriaIdOrIds) && categoriaIdOrIds.length > 0) {
      // Prioriza a categoria gravada na versão, com fallback para o modelo->produto->categoria
      const idList = categoriaIdOrIds.join(',')
      query = query.or(`categoria_id.in.(${idList}),modelos.produtos.categoria.in.(${idList})`)
    } else if (typeof categoriaIdOrIds === 'string') {
      query = query.or(
        `categoria_id.eq.${categoriaIdOrIds},modelos.produtos.categoria.eq.${categoriaIdOrIds}`,
      )
    }
  }

  // Cada termo precisa casar no nome ou no cod_erp ou no nome_abreviado
  for (const word of words) {
    const safeWord = word.replace(/[%_,()]/g, '')
    if (safeWord) {
      query = query.or(
        `nome.ilike.%${safeWord}%,cod_erp.ilike.%${safeWord}%,nome_abreviado.ilike.%${safeWord}%`,
      )
    }
  }

  const { data, error } = await query.order('nome', { ascending: true }).limit(limit)

  if (error) {
    console.error('Erro ao pesquisar versões ativas:', error)
    return []
  }

  return (data ?? []) as unknown as VersaoSearchResult[]
}

export async function uploadVersaoImage(file: File): Promise<string | null> {
  const ext = file.name.split('.').pop() ?? 'jpg'
  // Usa o bucket versao-images onde estão as imagens do catálogo de versões
  const cleanBase = file.name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
  const fileName = `versoes/versao-${Date.now()}-${Math.random().toString(36).slice(2)}-${cleanBase}`

  // Tenta versao-images primeiro (bucket oficial de versões com 4600+ imagens); fallback para versoes-images
  let bucketToUse = 'versao-images'
  let uploadRes = await supabase.storage.from(bucketToUse).upload(fileName, file, {
    upsert: true,
    cacheControl: '3600',
  })

  if (uploadRes.error) {
    bucketToUse = STORAGE_BUCKET
    uploadRes = await supabase.storage.from(bucketToUse).upload(fileName, file, {
      upsert: true,
      cacheControl: '3600',
    })
  }

  if (uploadRes.error) throw new Error(uploadRes.error.message)
  const { data } = supabase.storage.from(bucketToUse).getPublicUrl(fileName)
  return data.publicUrl
}

export async function insertVersao(payload: VersaoInsert, userName?: string): Promise<Versao> {
  const insertPayload = { ...payload, atualizado_por: userName ?? 'Sistema' }
  const { data, error } = await supabase
    .from(TABLE)
    .insert(
      insertPayload as unknown as import('@/lib/supabase/types').Database['public']['Tables']['versoes']['Insert'],
    )
    .select()
    .single()
  if (error) throw new Error(error.message)

  clearVersoesCache()

  await supabase.from(HISTORICO_TABLE).insert({
    versao_id: data.id,
    usuario: userName ?? 'Sistema',
    acao: 'Criação',
    detalhes: `Versão "${data.nome}" criada`,
  })

  return data as Versao
}

export async function updateVersao(payload: VersaoUpdate, userName?: string): Promise<Versao> {
  const { id, estoque_total, estoque_bloqueado, estoque_reservado, estoque_disponivel, ...rest } =
    payload

  rest.atualizado_por = userName ?? 'Sistema'

  clearVersoesCache()

  await supabase.from(HISTORICO_TABLE).insert({
    versao_id: id,
    usuario: userName ?? 'Sistema',
    acao: 'Atualização',
    detalhes: `Versão atualizada`,
  })

  const { data, error } = await supabase
    .from(TABLE)
    .update(
      rest as unknown as import('@/lib/supabase/types').Database['public']['Tables']['versoes']['Update'],
    )
    .eq('id', id)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data as Versao
}

export async function deleteVersao(id: string): Promise<void> {
  clearVersoesCache()
  const { error } = await supabase.from(TABLE).delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export async function fetchVersaoHistorico(versaoId: string): Promise<VersaoHistorico[]> {
  const { data, error } = await supabase
    .from(HISTORICO_TABLE)
    .select('*')
    .eq('versao_id', versaoId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as VersaoHistorico[]
}

const TIPOS_JUNCTION_TABLE = 'versao_tipos_proposta'

/**
 * Returns the ids of the tipos de proposta linked to a given versão
 * (from the versao_tipos_proposta join table).
 */
export async function fetchVersaoTiposProposta(versaoId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from(TIPOS_JUNCTION_TABLE)
    .select('tipo_proposta_id')
    .eq('versao_id', versaoId)
  if (error) throw new Error(error.message)
  return ((data ?? []) as Array<{ tipo_proposta_id: string }>).map((r) => r.tipo_proposta_id)
}

/**
 * Replaces the set of tipos de proposta linked to a versão.
 * Deletes existing links then inserts the new ones (atomic from the caller's
 * perspective; failures are surfaced to the caller).
 */
export async function replaceVersaoTiposProposta(
  versaoId: string,
  tipoIds: string[],
): Promise<void> {
  const { error: delError } = await supabase
    .from(TIPOS_JUNCTION_TABLE)
    .delete()
    .eq('versao_id', versaoId)
  if (delError) throw new Error(delError.message)

  if (tipoIds.length > 0) {
    const payload = tipoIds.map((id) => ({
      versao_id: versaoId,
      tipo_proposta_id: id,
    }))
    const { error: insError } = await supabase.from(TIPOS_JUNCTION_TABLE).insert(payload)
    if (insError) throw new Error(insError.message)
  }

  clearVersoesCache()
}

/**
 * Loads the proposal type names linked to a list of versão IDs in a single query.
 * Returns a mapping of Record<versaoId, string[]>.
 * In case of error, returns an empty object so pages never break.
 */
export async function fetchTiposPropostaBatch(
  versaoIds: string[],
): Promise<Record<string, string[]>> {
  if (!versaoIds || versaoIds.length === 0) return {}

  try {
    const { data, error } = await supabase
      .from(TIPOS_JUNCTION_TABLE)
      .select('versao_id, tipos_proposta(nome)')
      .in('versao_id', versaoIds)

    if (error) {
      console.error('Error fetching batch tipos de proposta:', error)
      return {}
    }

    const map: Record<string, string[]> = {}
    for (const vid of versaoIds) {
      map[vid] = []
    }

    type RowWithTipo = {
      versao_id: string
      tipos_proposta: { nome: string } | { nome: string }[] | null
    }

    const rows = (data ?? []) as unknown as RowWithTipo[]
    for (const row of rows) {
      if (!row || !row.versao_id) continue
      if (!map[row.versao_id]) {
        map[row.versao_id] = []
      }
      if (row.tipos_proposta) {
        if (Array.isArray(row.tipos_proposta)) {
          for (const tp of row.tipos_proposta) {
            if (tp?.nome && !map[row.versao_id].includes(tp.nome)) {
              map[row.versao_id].push(tp.nome)
            }
          }
        } else if (row.tipos_proposta.nome) {
          if (!map[row.versao_id].includes(row.tipos_proposta.nome)) {
            map[row.versao_id].push(row.tipos_proposta.nome)
          }
        }
      }
    }

    // Fallback para versões que não possuem vínculos na join table:
    // verificar se há tipos informados no JSONB da tabela versoes
    const missingVersaoIds = versaoIds.filter((id) => !map[id] || map[id].length === 0)
    if (missingVersaoIds.length > 0) {
      const { data: versoesJsonData } = await supabase
        .from('versoes')
        .select('id, tipos_proposta')
        .in('id', missingVersaoIds)

      if (versoesJsonData) {
        for (const vRow of versoesJsonData) {
          if (Array.isArray(vRow.tipos_proposta)) {
            const validNames = vRow.tipos_proposta.filter(
              (n): n is string => typeof n === 'string' && n.trim().length > 0,
            )
            if (validNames.length > 0) {
              map[vRow.id] = validNames
            }
          }
        }
      }
    }

    return map
  } catch (err) {
    console.error('Unexpected error in fetchTiposPropostaBatch:', err)
    return {}
  }
}
