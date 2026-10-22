import { supabase } from '@/lib/supabase/client'
import type { VersaoImagem } from '@/types/versao'

const STORAGE_BUCKET = 'versao-images'
const TABLE = 'versao_imagens'

/**
 * Normalizes text for insensitive comparison (trims, removes accents, lowercase, multiple whitespaces).
 */
export function normalizeStringMatch(str: string | null | undefined): string {
  if (!str) return ''
  return str
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\r\n\t]/g, ' ')
    .replace(/[-_./\\+]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Normalizes text for ultra-tolerant alphanumeric matching (letters and numbers only, lowercased).
 */
export function normalizeKey(str: string | null | undefined): string {
  if (!str) return ''
  return normalizeStringMatch(str).replace(/[^a-z0-9]/g, '')
}

/**
 * Normalizes reg / cod_erp: removes leading zeros if numeric (e.g. "05" -> "5", "01460" -> "1460").
 */
export function normalizeReg(str: string | null | undefined): string {
  if (!str) return ''
  const trimmed = str.toString().trim().toLowerCase()
  // If it's purely digits, strip leading zeros
  if (/^\d+$/.test(trimmed)) {
    const stripped = trimmed.replace(/^0+/, '')
    return stripped || '0'
  }
  return trimmed
}

export interface ParsedImageFilename {
  rawFilename: string
  extension: string
  baseName: string
  // Possible numeric candidates extracted from filename
  codErpCandidate: string | null // e.g. "1460", "848", "5"
  regCandidate: string | null // e.g. "5" when "reg5_..." is present
  nomeAproximado: string | null
  tokens: string[]
}

/**
 * Parses an image filename extracting potential codes and names.
 * Tolerant patterns supported:
 * 1. "1460.jpg", "01460.png" (numeric code alone)
 * 2. "reg1460_NOME.png", "reg_1460_NOME.png", "reg-1460.jpg"
 * 3. "cod1460_NOME.png", "erp1460.jpg"
 * 4. "SE2208L.png", "MAKINO_D200z.webp", "DA300.jpg"
 * 5. Full name with underscores or dashes: "FRESADORA_FERRAMENTEIRA_VEKER_VKF-430VP.png"
 */
export function parseImageFilename(filename: string): ParsedImageFilename {
  const lastDot = filename.lastIndexOf('.')
  const ext = lastDot !== -1 ? filename.slice(lastDot + 1).toLowerCase() : ''
  const baseName = lastDot !== -1 ? filename.slice(0, lastDot) : filename

  let regCandidate: string | null = null
  let codErpCandidate: string | null = null
  let nomeAproximado: string | null = null

  // Pattern A: "reg<digits>_" or "reg_<digits>_" or "reg<digits>"
  const regPattern = baseName.match(/^reg_?(\d+)([_\s-]+(.*))?$/i)
  if (regPattern) {
    regCandidate = normalizeReg(regPattern[1])
    codErpCandidate = regCandidate
    const rest = regPattern[3] || ''
    nomeAproximado = rest.replace(/_+/g, ' ').replace(/\s+/g, ' ').trim() || null
  } else {
    // Pattern B: "cod_?<digits>" or "erp_?<digits>"
    const codPattern = baseName.match(/^(?:cod|erp|codigo)_?(\d+)([_\s-]+(.*))?$/i)
    if (codPattern) {
      codErpCandidate = normalizeReg(codPattern[1])
      regCandidate = codErpCandidate
      const rest = codPattern[3] || ''
      nomeAproximado = rest.replace(/_+/g, ' ').replace(/\s+/g, ' ').trim() || null
    } else if (/^\d+$/.test(baseName.trim())) {
      // Pattern C: Pure digits filename (e.g. "1460.jpg", "506.png")
      codErpCandidate = normalizeReg(baseName.trim())
      regCandidate = codErpCandidate
      nomeAproximado = null
    } else {
      // Pattern D: May contain prefix or standalone numbers, or plain text
      // e.g. "1460_SE2208L.png" or "1460 - SE2208L.jpg"
      const leadingNumber = baseName.match(/^(\d+)[_\s-]+(.*)$/)
      if (leadingNumber) {
        codErpCandidate = normalizeReg(leadingNumber[1])
        regCandidate = codErpCandidate
        nomeAproximado = leadingNumber[2].replace(/_+/g, ' ').replace(/\s+/g, ' ').trim() || null
      } else {
        // Fallback: replace underscores with spaces
        nomeAproximado = baseName.replace(/_+/g, ' ').replace(/\s+/g, ' ').trim() || null
      }
    }
  }

  // Tokens for keyword matching
  const tokens = normalizeStringMatch(baseName)
    .split(/\s+/)
    .filter((t) => t.length >= 2)

  return {
    rawFilename: filename,
    extension: ext,
    baseName,
    codErpCandidate,
    regCandidate,
    nomeAproximado,
    tokens,
  }
}

export interface VersaoLookupItem {
  id: string
  nome: string
  reg: string | null
  cod_erp: string | null
  nome_abreviado: string | null
  imagem_preview: string | null
  status: string | null
  modelo_nome: string | null
  marca_nome: string | null
  keyNome: string
  normNome: string
  keyNomeAbreviado: string | null
}

export interface MatchCandidate {
  versao: VersaoLookupItem
  matchType: 'cod_erp' | 'reg' | 'nome' | 'nome_abreviado'
  score: number // Higher is better
  reason: string
}

export interface ImageMatchResult {
  file: File
  parsed: ParsedImageFilename
  matchedVersao: VersaoLookupItem | null
  matchType: 'cod_erp' | 'reg' | 'nome' | 'nome_abreviado' | 'nenhum'
  matchReason?: string
  candidates: MatchCandidate[] // All potential matches if ambiguous
  isAmbiguous: boolean
  isManualOverride?: boolean
  status: 'pronto' | 'uploading' | 'sucesso' | 'erro' | 'sem_match' | 'ambiguo' | 'ja_possui_imagem'
  errorMessage?: string
  uploadedUrl?: string
}

export interface VersaoImageImportProgress {
  stage: 'carregando' | 'preparando' | 'enviando' | 'concluido'
  current: number
  total: number
  percentage: number
  message: string
}

export interface VersaoImageImportReport {
  totalArquivos: number
  totalEnviados: number
  totalErros: number
  associadosPorCodErp: number
  associadosPorReg: number
  associadosPorNome: number
  associadosPorAbreviado: number
  semCorrespondencia: ImageMatchResult[]
  ambiguos: ImageMatchResult[]
  sucessos: ImageMatchResult[]
  erros: ImageMatchResult[]
}

export interface VersoesCatalogIndex {
  all: VersaoLookupItem[]
  pendingWithoutImage: VersaoLookupItem[]
  byCodErp: Map<string, VersaoLookupItem[]>
  byReg: Map<string, VersaoLookupItem[]>
  byKeyNomeAbreviado: Map<string, VersaoLookupItem[]>
  byExactNormNome: Map<string, VersaoLookupItem[]>
  byKeyNome: Map<string, VersaoLookupItem[]>
}

/**
 * Loads all active/existing versions from database with models and brands.
 */
export async function loadVersoesForMatching(): Promise<VersoesCatalogIndex> {
  const PAGE_SIZE = 1000
  let page = 0
  let hasMore = true
  const all: VersaoLookupItem[] = []

  while (hasMore) {
    const { data, error } = await supabase
      .from('versoes')
      .select(`
        id, nome, reg, cod_erp, nome_abreviado, imagem_preview, status, deleted_at,
        modelos:modelo (
          nome,
          marcas:marca (nome)
        )
      `)
      .is('deleted_at', null)
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

    if (error) {
      throw new Error(`Erro ao carregar versões: ${error.message}`)
    }

    if (data && data.length > 0) {
      for (const row of data as any[]) {
        if (!row.id || !row.nome) continue
        const modeloObj = Array.isArray(row.modelos) ? row.modelos[0] : row.modelos
        const marcaObj = modeloObj?.marcas
          ? Array.isArray(modeloObj.marcas)
            ? modeloObj.marcas[0]
            : modeloObj.marcas
          : null

        const normNome = normalizeStringMatch(row.nome)
        const keyNome = normalizeKey(row.nome)
        const keyNomeAbreviado = row.nome_abreviado ? normalizeKey(row.nome_abreviado) : null

        all.push({
          id: row.id,
          nome: row.nome,
          reg: row.reg ?? null,
          cod_erp: row.cod_erp ?? null,
          nome_abreviado: row.nome_abreviado ?? null,
          imagem_preview:
            row.imagem_preview && row.imagem_preview.trim() !== '' ? row.imagem_preview : null,
          status: row.status ?? 'Ativo',
          modelo_nome: modeloObj?.nome ?? null,
          marca_nome: marcaObj?.nome ?? null,
          normNome,
          keyNome,
          keyNomeAbreviado,
        })
      }
      if (data.length < PAGE_SIZE) {
        hasMore = false
      } else {
        page++
      }
    } else {
      hasMore = false
    }
  }

  const byCodErp = new Map<string, VersaoLookupItem[]>()
  const byReg = new Map<string, VersaoLookupItem[]>()
  const byKeyNomeAbreviado = new Map<string, VersaoLookupItem[]>()
  const byExactNormNome = new Map<string, VersaoLookupItem[]>()
  const byKeyNome = new Map<string, VersaoLookupItem[]>()

  const addToMultimap = (
    map: Map<string, VersaoLookupItem[]>,
    key: string,
    item: VersaoLookupItem,
  ) => {
    if (!key) return
    const existing = map.get(key)
    if (existing) {
      if (!existing.some((x) => x.id === item.id)) {
        existing.push(item)
      }
    } else {
      map.set(key, [item])
    }
  }

  for (const item of all) {
    if (item.cod_erp) {
      addToMultimap(byCodErp, normalizeReg(item.cod_erp), item)
      addToMultimap(byCodErp, item.cod_erp.trim().toLowerCase(), item)
    }
    if (item.reg) {
      addToMultimap(byReg, normalizeReg(item.reg), item)
      addToMultimap(byReg, item.reg.trim().toLowerCase(), item)
    }
    if (item.keyNomeAbreviado) {
      addToMultimap(byKeyNomeAbreviado, item.keyNomeAbreviado, item)
    }
    if (item.normNome) {
      addToMultimap(byExactNormNome, item.normNome, item)
    }
    if (item.keyNome) {
      addToMultimap(byKeyNome, item.keyNome, item)
    }
  }

  const pendingWithoutImage = all.filter((v) => !v.imagem_preview && v.status === 'Ativo')

  return {
    all,
    pendingWithoutImage,
    byCodErp,
    byReg,
    byKeyNomeAbreviado,
    byExactNormNome,
    byKeyNome,
  }
}

/**
 * Finds all potential matching candidates for a parsed file, sorted by precedence:
 * Priority: cod_erp exato -> reg exato -> nome da versão tolerante -> nome abreviado.
 */
export function findCandidatesForFile(
  parsed: ParsedImageFilename,
  index: VersoesCatalogIndex,
): MatchCandidate[] {
  const candidatesMap = new Map<string, MatchCandidate>()

  const addCandidate = (
    versao: VersaoLookupItem,
    matchType: MatchCandidate['matchType'],
    score: number,
    reason: string,
  ) => {
    const existing = candidatesMap.get(versao.id)
    if (!existing || existing.score < score) {
      candidatesMap.set(versao.id, { versao, matchType, score, reason })
    }
  }

  const baseKey = normalizeKey(parsed.baseName)
  const baseNorm = normalizeStringMatch(parsed.baseName)

  // 1. COD_ERP EXATO (score: 1000)
  if (parsed.codErpCandidate) {
    const list = index.byCodErp.get(parsed.codErpCandidate) || []
    for (const v of list) {
      addCandidate(v, 'cod_erp', 1000, `Cód. ERP exato: "${v.cod_erp}"`)
    }
  }

  // 2. REG EXATO (score: 900)
  if (parsed.regCandidate) {
    const list = index.byReg.get(parsed.regCandidate) || []
    for (const v of list) {
      addCandidate(v, 'reg', 900, `REG exato: "${v.reg}"`)
    }
  }

  // 3. NOME EXATO / TOLERANTE (score: 700 - 850)
  if (parsed.nomeAproximado) {
    const queryNorm = normalizeStringMatch(parsed.nomeAproximado)
    const queryKey = normalizeKey(parsed.nomeAproximado)

    const exactNorm = index.byExactNormNome.get(queryNorm)
    if (exactNorm) {
      for (const v of exactNorm) {
        addCandidate(v, 'nome', 850, 'Nome idêntico (ignorando maiúsculas/acentos)')
      }
    }

    if (queryKey) {
      const exactKey = index.byKeyNome.get(queryKey)
      if (exactKey) {
        for (const v of exactKey) {
          addCandidate(v, 'nome', 800, 'Nome completo correspondente')
        }
      }
    }
  }

  // Also check if baseName exactly matches a version key
  if (baseKey) {
    const directKeyMatches = index.byKeyNome.get(baseKey)
    if (directKeyMatches) {
      for (const v of directKeyMatches) {
        addCandidate(v, 'nome', 750, 'Nome da versão no arquivo')
      }
    }
  }

  // 4. NOME ABREVIADO / MODELO RESUMIDO (score: 600 - 650)
  // e.g. "SE2208L.png", "MAKINO_D200z.webp", "VKF-430VP.jpg"
  if (baseKey) {
    // Check exact match on nome_abreviado
    const abbrevMatches = index.byKeyNomeAbreviado.get(baseKey)
    if (abbrevMatches) {
      for (const v of abbrevMatches) {
        addCandidate(v, 'nome_abreviado', 650, `Nome abreviado: "${v.nome_abreviado}"`)
      }
    }

    // Check if filename contains or is contained in nome_abreviado
    if (baseKey.length >= 4) {
      for (const v of index.all) {
        if (!v.keyNomeAbreviado) continue
        if (
          v.keyNomeAbreviado === baseKey ||
          baseKey.includes(v.keyNomeAbreviado) ||
          v.keyNomeAbreviado.includes(baseKey)
        ) {
          addCandidate(v, 'nome_abreviado', 600, `Nome abreviado aproximado: "${v.nome_abreviado}"`)
        }
      }
    }
  }

  // Tolerant search across all active versions if no direct match yet
  if (candidatesMap.size === 0 && baseKey.length >= 5) {
    for (const v of index.all) {
      // Check if version name contains the clean filename query (or vice versa)
      if (v.keyNome.includes(baseKey) || (baseKey.length > 8 && baseKey.includes(v.keyNome))) {
        addCandidate(v, 'nome', 500, `Nome da versão contém "${parsed.baseName}"`)
      }
    }
  }

  const candidates = Array.from(candidatesMap.values())
  candidates.sort((a, b) => b.score - a.score)
  return candidates
}

/**
 * Matches a single image file against the catalog, strictly ensuring:
 * 1. Precedence: cod_erp -> reg -> nome -> nome_abreviado
 * 2. If multiple candidates share top score or are ambiguous, marks as ambiguous for manual decision.
 */
export function matchImageToVersao(
  file: File,
  parsed: ParsedImageFilename,
  index: VersoesCatalogIndex,
): ImageMatchResult {
  const candidates = findCandidatesForFile(parsed, index)

  if (candidates.length === 0) {
    return {
      file,
      parsed,
      matchedVersao: null,
      matchType: 'nenhum',
      candidates: [],
      isAmbiguous: false,
      status: 'sem_match',
    }
  }

  // Check top candidate vs second candidate
  const top = candidates[0]
  const second = candidates[1]

  // If there's another candidate with the exact same high score, it's ambiguous
  if (second && second.score === top.score) {
    return {
      file,
      parsed,
      matchedVersao: null,
      matchType: 'nenhum',
      matchReason: `Ambiguidade detectada: ${candidates.length} versões coincidem com igual prioridade. Decisão manual necessária.`,
      candidates,
      isAmbiguous: true,
      status: 'ambiguo',
    }
  }

  return {
    file,
    parsed,
    matchedVersao: top.versao,
    matchType: top.matchType,
    matchReason: top.reason,
    candidates,
    isAmbiguous: false,
    status: 'pronto',
  }
}

/**
 * Validates uniqueness: NUNCA casar duas versões com o mesmo arquivo,
 * e NUNCA vincular múltiplos arquivos à mesma versão silenciosamente.
 * Se houver colisão de versão (2 arquivos apontando para a mesma versão), marca ambos como ambíguos.
 */
export function resolveMultiFileCollisions(results: ImageMatchResult[]): ImageMatchResult[] {
  const versaoUsageCount = new Map<string, number>()

  for (const item of results) {
    if (item.matchedVersao && !item.isManualOverride) {
      const vId = item.matchedVersao.id
      versaoUsageCount.set(vId, (versaoUsageCount.get(vId) || 0) + 1)
    }
  }

  return results.map((item) => {
    if (!item.matchedVersao || item.isManualOverride) return item

    const usage = versaoUsageCount.get(item.matchedVersao.id) || 0
    if (usage > 1) {
      return {
        ...item,
        matchedVersao: null,
        matchType: 'nenhum',
        isAmbiguous: true,
        status: 'ambiguo',
        matchReason: `Conflito: ${usage} arquivos diferentes tentaram casar com a mesma versão "${item.matchedVersao.nome}". Decisão manual necessária.`,
      }
    }
    return item
  })
}

/**
 * Uploads an image file to Supabase storage 'versao-images' and links to `versao_imagens` (and updates `versoes.imagem_preview`).
 * Safety rule:
 * NUNCA apagar imagem existente de versão que já tem foto (a menos que seja uma atualização confirmada explicitamente).
 */
export async function uploadAndLinkVersaoImage(
  file: File,
  versaoId: string,
  options?: { overwriteExisting?: boolean },
): Promise<{ url: string; recordId: string }> {
  // Check if version already has image and overwrite is forbidden
  if (!options?.overwriteExisting) {
    const { data: currentVersao, error: checkErr } = await supabase
      .from('versoes')
      .select('imagem_preview')
      .eq('id', versaoId)
      .single()

    if (!checkErr && currentVersao?.imagem_preview && currentVersao.imagem_preview.trim() !== '') {
      // Keep existing photo safe
      return {
        url: currentVersao.imagem_preview,
        recordId: 'kept_existing',
      }
    }
  }

  // Safe file name for bucket
  const cleanBase = file.name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
  const storagePath = `versoes/${versaoId}-${Date.now()}-${cleanBase}`

  const { error: uploadErr } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, file, {
      upsert: true,
      cacheControl: '3600',
    })

  if (uploadErr) {
    throw new Error(`Falha no upload do arquivo: ${uploadErr.message}`)
  }

  const { data: urlData } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(storagePath)
  const publicUrl = urlData.publicUrl

  // Upsert in versao_imagens table (unique on versao_id)
  const { data: savedRecord, error: dbErr } = await supabase
    .from(TABLE)
    .upsert(
      {
        versao_id: versaoId,
        nome_arquivo: file.name,
        url: publicUrl,
        criada_em: new Date().toISOString(),
      },
      { onConflict: 'versao_id' },
    )
    .select('id')
    .single()

  if (dbErr) {
    throw new Error(`Falha ao salvar registro no banco: ${dbErr.message}`)
  }

  // Also update versoes.imagem_preview for backward-compatibility with PDF/proposals/machine cascade
  const { error: updateErr } = await supabase
    .from('versoes')
    .update({ imagem_preview: publicUrl })
    .eq('id', versaoId)

  if (updateErr) {
    throw new Error(`Falha ao atualizar imagem_preview da versão: ${updateErr.message}`)
  }

  return {
    url: publicUrl,
    recordId: savedRecord?.id ?? '',
  }
}

/**
 * Fetches all versao_imagens records or for a specific versao.
 */
export async function fetchVersaoImagens(versaoId?: string): Promise<VersaoImagem[]> {
  let query = supabase.from(TABLE).select('*')
  if (versaoId) {
    query = query.eq('versao_id', versaoId)
  }
  const { data, error } = await query.order('criada_em', { ascending: false })
  if (error) {
    throw new Error(`Erro ao buscar imagens: ${error.message}`)
  }
  return (data || []) as VersaoImagem[]
}
