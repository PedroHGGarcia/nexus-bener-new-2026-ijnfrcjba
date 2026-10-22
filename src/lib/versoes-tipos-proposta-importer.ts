import Papa from 'papaparse'
import * as XLSX from 'xlsx'

async function loadSheetJS(): Promise<any> {
  return XLSX
}

export interface ParsedVersaoTipoRow {
  lineNumber: number
  versaoIdentificador: string
  versaoNome?: string
  reg?: string
  codErp?: string
  versaoId?: string
  tiposPropostaStr: string
  tiposPropostaList: string[]
  parseError?: string
  raw?: Record<string, unknown> | unknown[]
}

export interface ParsedVersaoTipoSpreadsheetResult {
  sheetName?: string
  totalRows: number
  previewRows: ParsedVersaoTipoRow[]
  allRows: ParsedVersaoTipoRow[]
  availableSheets?: string[]
}

/**
 * Normalizes header string for comparison (removes accents, punctuation, lowercase, alphanumeric only)
 */
export function normalizeHeader(h: string): string {
  return (h || '')
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
}

/**
 * Normalizes text for insensitive comparison (trims, removes accents, lowercase, replaces multiple whitespace)
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
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Normalizes string for ultra-tolerant matching (strips punctuation, accents, and non-alphanumeric chars)
 */
export function normalizeKey(str: string | null | undefined): string {
  if (!str) return ''
  return normalizeStringMatch(str).replace(/[^a-z0-9]/g, '')
}

/**
 * Validates if string is a standard UUID
 */
export const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isValidUUID(str: string | null | undefined): boolean {
  if (!str) return false
  return UUID_REGEX.test(str.trim())
}

/**
 * Splits string by '|', trims each item, and discards empty items
 */
export function splitPipeItems(str: string | null | undefined): string[] {
  if (!str) return []
  return str
    .toString()
    .split(/[|\r\n\u2028\u2029]+/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
}

/**
 * Helper to match common CSV/XLSX header synonyms
 */
function findHeaderMatch(
  headerMap: Record<string, string | number>,
  candidates: string[],
): string | number | undefined {
  for (const c of candidates) {
    const norm = normalizeHeader(c)
    if (headerMap[norm] !== undefined) {
      return headerMap[norm]
    }
  }
  return undefined
}

/**
 * Parses XLSX files and extracts version and tipo_proposta columns
 */
export async function parseVersaoTiposXLSXFile(
  file: File,
  targetSheetName?: string,
): Promise<ParsedVersaoTipoSpreadsheetResult> {
  const XLSX = await loadSheetJS()
  const arrayBuffer = await file.arrayBuffer()
  const workbook = XLSX.read(arrayBuffer, { type: 'array' })

  const sheetNames: string[] = workbook.SheetNames || []
  if (sheetNames.length === 0) {
    throw new Error('A planilha está vazia (nenhuma aba encontrada).')
  }

  // Choose sheet: targetSheetName > "Versoes" or "Tipos" > first sheet
  let chosenSheetName = sheetNames[0]
  if (targetSheetName && sheetNames.includes(targetSheetName)) {
    chosenSheetName = targetSheetName
  } else {
    const preferredSheet = sheetNames.find((s: string) => {
      const norm = normalizeHeader(s)
      return (
        norm === 'versoes' ||
        norm === 'versao' ||
        norm === 'tiposproposta' ||
        norm === 'tipos' ||
        norm === 'versaotipos'
      )
    })
    if (preferredSheet) {
      chosenSheetName = preferredSheet
    }
  }

  const worksheet = workbook.Sheets[chosenSheetName]
  if (!worksheet) {
    throw new Error(`Aba "${chosenSheetName}" não encontrada no arquivo.`)
  }

  const sheetData = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    defval: '',
    blankrows: false,
  }) as unknown[][]

  if (!sheetData || sheetData.length === 0) {
    return {
      sheetName: chosenSheetName,
      totalRows: 0,
      previewRows: [],
      allRows: [],
      availableSheets: sheetNames,
    }
  }

  const firstRow = (sheetData[0] || []) as string[]
  const headerMap: Record<string, number> = {}
  firstRow.forEach((colVal, idx) => {
    const norm = normalizeHeader(colVal)
    if (norm) headerMap[norm] = idx
  })

  // Detect relevant columns
  const tipoPropostaIdx = findHeaderMatch(headerMap, [
    'tipo proposta',
    'tipos proposta',
    'tipos de proposta',
    'tipo_proposta',
    'tipos_proposta',
    'tipo de proposta',
    'tipo de propostas',
    'tipos de propostas',
    'tipoproposta',
    'tiposproposta',
    'tipo_propostas',
    'tipos_propostas',
    'tipopropostas',
    'tipospropostas',
    'tipo_de_proposta',
    'tipos',
    'tipo',
    'proposta_tipos',
    'propostas',
  ]) as number | undefined

  const regIdx = findHeaderMatch(headerMap, [
    'reg',
    'registro',
    'num_reg',
    'numero_reg',
    'reg_id',
    'id_reg',
  ]) as number | undefined

  const codErpIdx = findHeaderMatch(headerMap, [
    'cod_erp',
    'coderp',
    'cod_e2corp',
    'code2corp',
    'codigo_erp',
    'codigo_e2corp',
    'codigoe2corp',
    'codigoo_erp',
    'cod_erp_versao',
  ]) as number | undefined

  const versaoNomeIdx = findHeaderMatch(headerMap, [
    'nome',
    'versao',
    'versoes',
    'nome_versao',
    'nomeversao',
    'versao_nome',
    'modelo_versao',
    'maquina',
    'equipamento',
  ]) as number | undefined

  const versaoIdIdx = findHeaderMatch(headerMap, [
    'versao_id',
    'versaoid',
    'id_versao',
    'idversao',
    'uuid_versao',
    'versao_id_supabase',
    'id',
  ]) as number | undefined

  const dataRows = sheetData.slice(1)
  const allRows: ParsedVersaoTipoRow[] = []

  // If no specific header found for tipo_proposta, fallback to looking for '|' or column 1
  const tCol = tipoPropostaIdx !== undefined ? tipoPropostaIdx : 1
  const vCol =
    versaoNomeIdx !== undefined
      ? versaoNomeIdx
      : regIdx !== undefined
        ? regIdx
        : codErpIdx !== undefined
          ? codErpIdx
          : versaoIdIdx !== undefined
            ? versaoIdIdx
            : 0

  dataRows.forEach((row, i) => {
    const lineNum = i + 2
    const cells = (Array.isArray(row) ? row : []) as unknown[]

    const rawTipoProposta =
      tCol !== undefined && cells[tCol] !== undefined ? String(cells[tCol]).trim() : ''

    const rawNome =
      versaoNomeIdx !== undefined && cells[versaoNomeIdx] !== undefined
        ? String(cells[versaoNomeIdx]).trim()
        : ''

    const rawReg =
      regIdx !== undefined && cells[regIdx] !== undefined ? String(cells[regIdx]).trim() : ''

    const rawCodErp =
      codErpIdx !== undefined && cells[codErpIdx] !== undefined
        ? String(cells[codErpIdx]).trim()
        : ''

    const rawId =
      versaoIdIdx !== undefined && cells[versaoIdIdx] !== undefined
        ? String(cells[versaoIdIdx]).trim()
        : ''

    const rawFallback = cells[vCol] !== undefined ? String(cells[vCol]).trim() : ''
    const identifier = rawReg || rawCodErp || rawNome || rawId || rawFallback

    if (!identifier && !rawTipoProposta) return

    allRows.push({
      lineNumber: lineNum,
      versaoIdentificador: identifier,
      versaoNome:
        rawNome ||
        (identifier !== rawReg && identifier !== rawCodErp && identifier !== rawId
          ? identifier
          : ''),
      reg: rawReg,
      codErp: rawCodErp || rawReg,
      versaoId: isValidUUID(rawId) ? rawId : undefined,
      tiposPropostaStr: rawTipoProposta,
      tiposPropostaList: splitPipeItems(rawTipoProposta),
      raw: { row },
    })
  })

  return {
    sheetName: chosenSheetName,
    totalRows: allRows.length,
    previewRows: allRows.slice(0, 5),
    allRows,
    availableSheets: sheetNames,
  }
}

/**
 * Parses CSV files and extracts version and tipo_proposta columns
 */
export async function parseVersaoTiposCSVFile(
  file: File,
): Promise<ParsedVersaoTipoSpreadsheetResult> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: 'greedy',
      transformHeader: (header) => header.trim(),
      complete: (results) => {
        const headers = results.meta.fields || []
        const data = results.data || []

        if (data.length === 0) {
          resolve({
            totalRows: 0,
            previewRows: [],
            allRows: [],
          })
          return
        }

        // Map header names normalized -> original header name
        const headerMap: Record<string, string> = {}
        headers.forEach((h) => {
          headerMap[normalizeHeader(h)] = h
        })

        const tipoPropostaKey = findHeaderMatch(headerMap, [
          'tipo proposta',
          'tipos proposta',
          'tipos de proposta',
          'tipo_proposta',
          'tipos_proposta',
          'tipo de proposta',
          'tipo de propostas',
          'tipos de propostas',
          'tipoproposta',
          'tiposproposta',
          'tipo_propostas',
          'tipos_propostas',
          'tipopropostas',
          'tipospropostas',
          'tipo_de_proposta',
          'tipos',
          'tipo',
          'proposta_tipos',
          'propostas',
        ]) as string | undefined

        const regKey = findHeaderMatch(headerMap, [
          'reg',
          'registro',
          'num_reg',
          'numero_reg',
          'reg_id',
          'id_reg',
        ]) as string | undefined

        const codErpKey = findHeaderMatch(headerMap, [
          'cod_erp',
          'coderp',
          'cod_e2corp',
          'code2corp',
          'codigo_erp',
          'codigo_e2corp',
          'codigoe2corp',
          'codigoo_erp',
          'cod_erp_versao',
        ]) as string | undefined

        const versaoNomeKey = findHeaderMatch(headerMap, [
          'nome',
          'versao',
          'versoes',
          'nome_versao',
          'nomeversao',
          'versao_nome',
          'modelo_versao',
          'maquina',
          'equipamento',
        ]) as string | undefined

        const versaoIdKey = findHeaderMatch(headerMap, [
          'versao_id',
          'versaoid',
          'id_versao',
          'idversao',
          'uuid_versao',
          'versao_id_supabase',
          'id',
        ]) as string | undefined

        // Track papa parse errors
        const parseErrorsByRow = new Map<number, string>()
        if (results.errors && results.errors.length > 0) {
          results.errors.forEach((err) => {
            if (typeof err.row === 'number') {
              parseErrorsByRow.set(err.row + 2, err.message)
            }
          })
        }

        const allRows: ParsedVersaoTipoRow[] = []

        data.forEach((row, i) => {
          const lineNum = i + 2
          const parseErr = parseErrorsByRow.get(lineNum)

          const rawTipoProposta = tipoPropostaKey ? (row[tipoPropostaKey] || '').trim() : ''
          const rawNome = versaoNomeKey ? (row[versaoNomeKey] || '').trim() : ''
          const rawReg = regKey ? (row[regKey] || '').trim() : ''
          const rawCodErp = codErpKey ? (row[codErpKey] || '').trim() : ''
          const rawId = versaoIdKey ? (row[versaoIdKey] || '').trim() : ''

          const fallbackCol = headers[0] ? (row[headers[0]] || '').trim() : ''
          const identifier = rawReg || rawCodErp || rawNome || rawId || fallbackCol

          if (!identifier && !rawTipoProposta) {
            if (parseErr) {
              allRows.push({
                lineNumber: lineNum,
                versaoIdentificador: '(Linha mal formatada)',
                tiposPropostaStr: '',
                tiposPropostaList: [],
                parseError: `Linha mal formatada no CSV: ${parseErr}`,
                raw: row,
              })
            }
            return
          }

          allRows.push({
            lineNumber: lineNum,
            versaoIdentificador: identifier,
            versaoNome:
              rawNome ||
              (identifier !== rawReg && identifier !== rawCodErp && identifier !== rawId
                ? identifier
                : ''),
            reg: rawReg,
            codErp: rawCodErp || rawReg,
            versaoId: isValidUUID(rawId) ? rawId : undefined,
            tiposPropostaStr: rawTipoProposta,
            tiposPropostaList: splitPipeItems(rawTipoProposta),
            parseError: parseErr,
            raw: row,
          })
        })

        resolve({
          totalRows: allRows.length,
          previewRows: allRows.slice(0, 5),
          allRows,
        })
      },
      error: (err) => {
        reject(new Error(err.message || 'Erro ao processar arquivo CSV.'))
      },
    })
  })
}

/**
 * Universal file parser for XLSX and CSV.
 */
export async function parseVersaoTiposImportFile(
  file: File,
  targetSheetName?: string,
): Promise<ParsedVersaoTipoSpreadsheetResult> {
  const fileName = file.name.toLowerCase()
  if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
    return parseVersaoTiposXLSXFile(file, targetSheetName)
  }
  if (fileName.endsWith('.csv') || fileName.endsWith('.txt')) {
    return parseVersaoTiposCSVFile(file)
  }
  if (file.type.includes('spreadsheet') || file.type.includes('excel')) {
    return parseVersaoTiposXLSXFile(file, targetSheetName)
  }
  return parseVersaoTiposCSVFile(file)
}

export interface PendenciaImportacao {
  lineNumber: number
  identificadorVersao: string
  tipoPropostaItem?: string
  motivo: string
}

export interface VersaoTipoImportReport {
  totalVersoesProcessadas: number
  totalAssociacoesCriadas: number
  totalAssociacoesIgnoradas: number
  versoesComTipoVinculado: number
  pendenciasTipoNaoEncontrado: number
  pendenciasTipoAmbiguo: number
  vinculosPorCodErp: number
  vinculosPorNome: number
  vinculosPorId: number
  pendencias: PendenciaImportacao[]
  errosGerais?: string[]
}

export interface ProcessarVersaoTipoOptions {
  onProgress?: (progress: {
    stage: 'carregando_dados' | 'processando' | 'salvando' | 'concluido'
    current: number
    total: number
    percentage: number
    message?: string
  }) => void
  userName?: string
  userId?: string
}

interface VersaoRecord {
  id: string
  nome: string
  reg?: string | null
  cod_erp?: string | null
}

interface TipoPropostaRecord {
  id: string
  nome: string
}

/**
 * Main import processor for Versões × Tipos de Proposta
 *
 * Rules:
 * 1. Read existing versoes and tipos_proposta (READ ONLY - never create or modify versions or tipos).
 * 2. Look up versao:
 *    - By ID (if valid UUID)
 *    - By cod_erp (exact / normalized)
 *    - By nome (tolerant to accents, case, multiple spaces)
 * 3. Look up tipo_proposta by nome (tolerant to accents, case, spaces).
 * 4. Create link in versao_tipos_proposta (versao_id, tipo_proposta_id).
 *    - If already exists, count as ignored (totalAssociacoesIgnoradas).
 *    - If missing versao or tipo, register in pendencias with original line number.
 *    - If line has no valid data or malformed, register in pendencias.
 */
export async function processarImportacaoVersaoTipos(
  rows: ParsedVersaoTipoRow[],
  options?: ProcessarVersaoTipoOptions,
): Promise<VersaoTipoImportReport> {
  const { supabase } = await import('@/lib/supabase/client')

  const report: VersaoTipoImportReport = {
    totalVersoesProcessadas: 0,
    totalAssociacoesCriadas: 0,
    totalAssociacoesIgnoradas: 0,
    versoesComTipoVinculado: 0,
    pendenciasTipoNaoEncontrado: 0,
    pendenciasTipoAmbiguo: 0,
    vinculosPorCodErp: 0,
    vinculosPorNome: 0,
    vinculosPorId: 0,
    pendencias: [],
    errosGerais: [],
  }

  if (!rows || rows.length === 0) {
    return report
  }

  options?.onProgress?.({
    stage: 'carregando_dados',
    current: 0,
    total: rows.length,
    percentage: 5,
    message: 'Carregando dados existentes de versões e tipos de proposta...',
  })

  // 1. Fetch all existing active versions
  const allVersoesList: VersaoRecord[] = []
  const versoesByIdMap = new Map<string, VersaoRecord>()
  const versoesByRegMap = new Map<string, VersaoRecord>()
  const versoesByCodErpMap = new Map<string, VersaoRecord>()
  const versoesByNomeNormMap = new Map<string, VersaoRecord>()
  const versoesByNomeKeyMap = new Map<string, VersaoRecord>()

  let vPage = 0
  const PAGE_SIZE = 1000
  let hasMoreVersoes = true

  while (hasMoreVersoes) {
    const { data: versoesData, error: vErr } = await supabase
      .from('versoes')
      .select('id, nome, reg, cod_erp, deleted_at')
      .is('deleted_at', null)
      .range(vPage * PAGE_SIZE, (vPage + 1) * PAGE_SIZE - 1)

    if (vErr) {
      throw new Error(`Erro ao consultar versões no banco: ${vErr.message}`)
    }

    if (versoesData && versoesData.length > 0) {
      versoesData.forEach((v) => {
        const effectiveReg = (v as any).reg || v.cod_erp
        const record: VersaoRecord = {
          id: v.id,
          nome: v.nome || '',
          reg: effectiveReg,
          cod_erp: v.cod_erp,
        }
        allVersoesList.push(record)
        if (v.id) {
          versoesByIdMap.set(v.id.toLowerCase(), record)
        }
        if (effectiveReg) {
          const cleanReg = effectiveReg.trim().toLowerCase()
          const regNorm = cleanReg.replace(/^0+/, '') || '0'
          if (!versoesByRegMap.has(cleanReg)) versoesByRegMap.set(cleanReg, record)
          if (!versoesByRegMap.has(regNorm)) versoesByRegMap.set(regNorm, record)
          const keyReg = normalizeKey(effectiveReg)
          if (keyReg && !versoesByRegMap.has(keyReg)) versoesByRegMap.set(keyReg, record)
        }
        if (v.cod_erp) {
          const cleanCod = v.cod_erp.trim().toLowerCase()
          const codNorm = cleanCod.replace(/^0+/, '') || '0'
          if (!versoesByCodErpMap.has(cleanCod)) {
            versoesByCodErpMap.set(cleanCod, record)
          }
          if (!versoesByCodErpMap.has(codNorm)) {
            versoesByCodErpMap.set(codNorm, record)
          }
          const keyCod = normalizeKey(v.cod_erp)
          if (keyCod && !versoesByCodErpMap.has(keyCod)) {
            versoesByCodErpMap.set(keyCod, record)
          }
        }
        if (v.nome) {
          const norm = normalizeStringMatch(v.nome)
          const key = normalizeKey(v.nome)
          if (norm && !versoesByNomeNormMap.has(norm)) {
            versoesByNomeNormMap.set(norm, record)
          }
          if (key && !versoesByNomeKeyMap.has(key)) {
            versoesByNomeKeyMap.set(key, record)
          }
        }
      })
      if (versoesData.length < PAGE_SIZE) {
        hasMoreVersoes = false
      } else {
        vPage++
      }
    } else {
      hasMoreVersoes = false
    }
  }

  // Version finder helper with multi-tier matching (REG, ERP, exact, key, prefix, contains)
  const findVersao = (
    id?: string,
    reg?: string,
    codErp?: string,
    nome?: string,
    fallback?: string,
  ): { versao: VersaoRecord; matchedBy: 'id' | 'reg' | 'cod_erp' | 'nome' } | undefined => {
    // 1. Direct ID match
    if (id && isValidUUID(id)) {
      const v = versoesByIdMap.get(id.toLowerCase())
      if (v) return { versao: v, matchedBy: 'id' }
    }

    // 2. REG match (tolerant to leading zeros: "05" vs "5")
    if (reg) {
      const cleanReg = reg.trim().toLowerCase()
      const regNorm = cleanReg.replace(/^0+/, '') || '0'
      const v =
        versoesByRegMap.get(cleanReg) ||
        versoesByRegMap.get(regNorm) ||
        versoesByRegMap.get(normalizeKey(reg)) ||
        versoesByCodErpMap.get(cleanReg) ||
        versoesByCodErpMap.get(regNorm)
      if (v) return { versao: v, matchedBy: 'reg' }
    }

    // 3. COD_ERP match
    if (codErp) {
      const clean = codErp.trim().toLowerCase()
      const codNorm = clean.replace(/^0+/, '') || '0'
      const v =
        versoesByCodErpMap.get(clean) ||
        versoesByCodErpMap.get(codNorm) ||
        versoesByCodErpMap.get(normalizeKey(codErp)) ||
        versoesByRegMap.get(clean) ||
        versoesByRegMap.get(codNorm)
      if (v) return { versao: v, matchedBy: 'cod_erp' }
    }

    // Check if fallback looks like a cod_erp
    if (fallback) {
      const clean = fallback.trim().toLowerCase()
      const v = versoesByCodErpMap.get(clean) || versoesByCodErpMap.get(normalizeKey(fallback))
      if (v) return { versao: v, matchedBy: 'cod_erp' }
    }

    // 3. Name match (multi-tier tolerant)
    const candidateName = nome || fallback
    if (candidateName) {
      const norm = normalizeStringMatch(candidateName)
      if (norm) {
        const exact = versoesByNomeNormMap.get(norm)
        if (exact) return { versao: exact, matchedBy: 'nome' }
      }

      const queryKey = normalizeKey(candidateName)
      if (queryKey) {
        const keyed = versoesByNomeKeyMap.get(queryKey)
        if (keyed) return { versao: keyed, matchedBy: 'nome' }

        // Prefix match
        const MIN_PREFIX_LEN = 10
        const prefixCandidates: { record: VersaoRecord; diff: number }[] = []

        for (const record of allVersoesList) {
          const dbKey = normalizeKey(record.nome)
          if (!dbKey) continue

          const minLen = Math.min(queryKey.length, dbKey.length)
          if (minLen >= MIN_PREFIX_LEN) {
            if (dbKey.startsWith(queryKey) || queryKey.startsWith(dbKey)) {
              prefixCandidates.push({
                record,
                diff: Math.abs(dbKey.length - queryKey.length),
              })
            }
          }
        }

        if (prefixCandidates.length > 0) {
          prefixCandidates.sort((a, b) => a.diff - b.diff)
          const bestDiff = prefixCandidates[0].diff
          const bestCandidates = prefixCandidates.filter((c) => c.diff === bestDiff)
          if (bestCandidates.length === 1) {
            return { versao: bestCandidates[0].record, matchedBy: 'nome' }
          }
          const uniqueIds = new Set(bestCandidates.map((c) => c.record.id))
          if (uniqueIds.size === 1) {
            return { versao: bestCandidates[0].record, matchedBy: 'nome' }
          }
        }

        // Contains match
        const MIN_CONTAINS_LEN = 10
        const containsCandidates: { record: VersaoRecord; diff: number }[] = []

        for (const record of allVersoesList) {
          const dbKey = normalizeKey(record.nome)
          if (!dbKey) continue

          const minLen = Math.min(queryKey.length, dbKey.length)
          if (minLen >= MIN_CONTAINS_LEN) {
            if (dbKey.includes(queryKey) || queryKey.includes(dbKey)) {
              containsCandidates.push({
                record,
                diff: Math.abs(dbKey.length - queryKey.length),
              })
            }
          }
        }

        if (containsCandidates.length > 0) {
          containsCandidates.sort((a, b) => a.diff - b.diff)
          const bestDiff = containsCandidates[0].diff
          const bestCandidates = containsCandidates.filter((c) => c.diff === bestDiff)
          if (bestCandidates.length === 1) {
            return { versao: bestCandidates[0].record, matchedBy: 'nome' }
          }
          const uniqueIds = new Set(bestCandidates.map((c) => c.record.id))
          if (uniqueIds.size === 1) {
            return { versao: bestCandidates[0].record, matchedBy: 'nome' }
          }
        }
      }
    }

    return undefined
  }

  // 2. Fetch all existing tipos_proposta
  const allTiposPropostaList: TipoPropostaRecord[] = []
  const tiposNormMap = new Map<string, TipoPropostaRecord>()
  const tiposKeyMap = new Map<string, TipoPropostaRecord>()
  let tPage = 0
  let hasMoreTipos = true

  while (hasMoreTipos) {
    const { data: tiposData, error: tErr } = await supabase
      .from('tipos_proposta')
      .select('id, nome')
      .range(tPage * PAGE_SIZE, (tPage + 1) * PAGE_SIZE - 1)

    if (tErr) {
      throw new Error(`Erro ao consultar tipos de proposta no banco: ${tErr.message}`)
    }

    if (tiposData && tiposData.length > 0) {
      tiposData.forEach((t) => {
        if (t.nome) {
          const record: TipoPropostaRecord = { id: t.id, nome: t.nome }
          allTiposPropostaList.push(record)

          const norm = normalizeStringMatch(t.nome)
          const key = normalizeKey(t.nome)
          if (norm && !tiposNormMap.has(norm)) {
            tiposNormMap.set(norm, record)
          }
          if (key && !tiposKeyMap.has(key)) {
            tiposKeyMap.set(key, record)
          }
        }
      })
      if (tiposData.length < PAGE_SIZE) {
        hasMoreTipos = false
      } else {
        tPage++
      }
    } else {
      hasMoreTipos = false
    }
  }

  type ResolveTipoResult =
    | { status: 'found'; tipo: TipoPropostaRecord }
    | { status: 'not_found'; query: string }
    | { status: 'ambiguous'; query: string; candidates: TipoPropostaRecord[] }

  const resolveTipoProposta = (name: string): ResolveTipoResult => {
    if (!name || !name.trim()) return { status: 'not_found', query: '' }
    const trimmed = name.trim()

    if (isValidUUID(trimmed)) {
      const byId = allTiposPropostaList.find((t) => t.id.toLowerCase() === trimmed.toLowerCase())
      if (byId) return { status: 'found', tipo: byId }
    }

    const norm = normalizeStringMatch(trimmed)
    if (norm) {
      const exactMatches = allTiposPropostaList.filter((t) => normalizeStringMatch(t.nome) === norm)
      if (exactMatches.length === 1) return { status: 'found', tipo: exactMatches[0] }
      if (exactMatches.length > 1) {
        return { status: 'ambiguous', query: trimmed, candidates: exactMatches }
      }
    }

    const queryKey = normalizeKey(trimmed)
    if (queryKey && queryKey.length >= 2) {
      const keyMatches = allTiposPropostaList.filter((t) => normalizeKey(t.nome) === queryKey)
      if (keyMatches.length === 1) return { status: 'found', tipo: keyMatches[0] }
      if (keyMatches.length > 1) {
        return { status: 'ambiguous', query: trimmed, candidates: keyMatches }
      }
    }

    return { status: 'not_found', query: trimmed }
  }

  // 3. Fetch existing associations from versao_tipos_proposta
  const existingAssocSet = new Set<string>() // key: `${versao_id}:${tipo_proposta_id}`
  let assocPage = 0
  let hasMoreAssoc = true

  while (hasMoreAssoc) {
    const { data: assocData, error: asErr } = await supabase
      .from('versao_tipos_proposta')
      .select('versao_id, tipo_proposta_id')
      .range(assocPage * PAGE_SIZE, (assocPage + 1) * PAGE_SIZE - 1)

    if (asErr) {
      throw new Error(`Erro ao consultar associações existentes: ${asErr.message}`)
    }

    if (assocData && assocData.length > 0) {
      assocData.forEach((as) => {
        if (as.versao_id && as.tipo_proposta_id) {
          existingAssocSet.add(`${as.versao_id}:${as.tipo_proposta_id}`)
        }
      })
      if (assocData.length < PAGE_SIZE) {
        hasMoreAssoc = false
      } else {
        assocPage++
      }
    } else {
      hasMoreAssoc = false
    }
  }

  // 4. Process all rows
  options?.onProgress?.({
    stage: 'processando',
    current: 0,
    total: rows.length,
    percentage: 30,
    message: 'Processando associações de versões e tipos de proposta...',
  })

  const newAssociationsToInsert: { versao_id: string; tipo_proposta_id: string }[] = []
  const stagedAssocSet = new Set<string>()
  const processedVersoesSet = new Set<string>()

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]

    if (row.parseError) {
      report.pendencias.push({
        lineNumber: row.lineNumber,
        identificadorVersao: row.versaoIdentificador || '(Linha mal formatada)',
        motivo: row.parseError,
      })
      continue
    }

    const identifier = row.versaoIdentificador || row.versaoNome || row.codErp || row.versaoId || ''
    if (!identifier) {
      report.pendencias.push({
        lineNumber: row.lineNumber,
        identificadorVersao: '(Linha sem identificador de versão)',
        motivo: 'A linha não possui identificador de versão (nome ou cód. ERP em branco)',
      })
      continue
    }

    // Lookup version
    const foundVersaoMatch = findVersao(
      row.versaoId,
      row.reg,
      row.codErp,
      row.versaoNome,
      identifier,
    )

    if (!foundVersaoMatch) {
      report.pendencias.push({
        lineNumber: row.lineNumber,
        identificadorVersao: identifier,
        motivo: `Versão não encontrada no cadastro (busca por cód. ERP "${row.codErp || identifier}" e nome "${row.versaoNome || identifier}")`,
      })
      continue
    }

    const { versao, matchedBy } = foundVersaoMatch
    if (!processedVersoesSet.has(versao.id)) {
      processedVersoesSet.add(versao.id)
      report.totalVersoesProcessadas++
    }

    const tipos = row.tiposPropostaList
    if (tipos.length === 0) {
      report.pendencias.push({
        lineNumber: row.lineNumber,
        identificadorVersao: `${versao.nome}${versao.cod_erp ? ` (ERP: ${versao.cod_erp})` : ''}`,
        motivo: 'Coluna tipo_proposta em branco ou sem valores válidos',
      })
      continue
    }

    let versaoHasAtLeastOneLinkedTipo = false

    for (const tipoRaw of tipos) {
      const tipoClean = tipoRaw.trim()
      if (!tipoClean) continue

      const resTipo = resolveTipoProposta(tipoClean)
      if (resTipo.status === 'not_found') {
        report.pendenciasTipoNaoEncontrado++
        report.pendencias.push({
          lineNumber: row.lineNumber,
          identificadorVersao: `${versao.nome}${versao.cod_erp ? ` (ERP: ${versao.cod_erp})` : ''}`,
          tipoPropostaItem: tipoClean,
          motivo: `Tipo de proposta não encontrado no sistema: "${tipoClean}" (não cria tipos automaticamente)`,
        })
        continue
      }

      if (resTipo.status === 'ambiguous') {
        report.pendenciasTipoAmbiguo++
        const candNames = resTipo.candidates.map((c) => `"${c.nome}"`).join(', ')
        report.pendencias.push({
          lineNumber: row.lineNumber,
          identificadorVersao: `${versao.nome}${versao.cod_erp ? ` (ERP: ${versao.cod_erp})` : ''}`,
          tipoPropostaItem: tipoClean,
          motivo: `Mais de um tipo de proposta candidato para "${tipoClean}": ${candNames}`,
        })
        continue
      }

      const foundTipo = resTipo.tipo
      versaoHasAtLeastOneLinkedTipo = true
      const assocKey = `${versao.id}:${foundTipo.id}`
      if (existingAssocSet.has(assocKey) || stagedAssocSet.has(assocKey)) {
        report.totalAssociacoesIgnoradas++
      } else {
        stagedAssocSet.add(assocKey)
        newAssociationsToInsert.push({
          versao_id: versao.id,
          tipo_proposta_id: foundTipo.id,
        })
        if (matchedBy === 'cod_erp') {
          report.vinculosPorCodErp++
        } else if (matchedBy === 'id') {
          report.vinculosPorId++
        } else {
          report.vinculosPorNome++
        }
      }
    }

    if (versaoHasAtLeastOneLinkedTipo) {
      report.versoesComTipoVinculado++
    }

    if (i % 20 === 0 || i === rows.length - 1) {
      const pct = 30 + Math.round((i / rows.length) * 45)
      options?.onProgress?.({
        stage: 'processando',
        current: i + 1,
        total: rows.length,
        percentage: pct,
        message: `Analisando linha ${i + 1} de ${rows.length}: "${versao.nome}"...`,
      })
    }
  }

  // 5. Insert new associations in batches
  if (newAssociationsToInsert.length > 0) {
    const BATCH_SIZE_ASSOC = 100
    const totalBatches = Math.ceil(newAssociationsToInsert.length / BATCH_SIZE_ASSOC)

    for (let b = 0; b < totalBatches; b++) {
      const chunk = newAssociationsToInsert.slice(b * BATCH_SIZE_ASSOC, (b + 1) * BATCH_SIZE_ASSOC)

      const { data: inserted, error: insertErr } = await supabase
        .from('versao_tipos_proposta')
        .insert(chunk)
        .select('versao_id, tipo_proposta_id')

      if (insertErr) {
        report.errosGerais?.push(
          `Erro ao salvar lote de vínculos (${b + 1}/${totalBatches}): ${insertErr.message}`,
        )
      } else {
        report.totalAssociacoesCriadas += inserted?.length ?? chunk.length
      }

      const pct = 75 + Math.round(((b + 1) / totalBatches) * 25)
      options?.onProgress?.({
        stage: 'salvando',
        current: Math.min(newAssociationsToInsert.length, (b + 1) * BATCH_SIZE_ASSOC),
        total: newAssociationsToInsert.length,
        percentage: pct,
        message: `Gravando associações no banco: lote ${b + 1} de ${totalBatches}...`,
      })
    }
  }

  options?.onProgress?.({
    stage: 'concluido',
    current: rows.length,
    total: rows.length,
    percentage: 100,
    message: 'Importação concluída com sucesso!',
  })

  return report
}
