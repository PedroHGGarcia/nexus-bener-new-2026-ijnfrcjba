import Papa from 'papaparse'
import * as XLSX from 'xlsx'

async function loadSheetJS(): Promise<any> {
  return XLSX
}

export interface ParsedImportRow {
  lineNumber: number
  // Legacy / standard fields
  versaoNome: string
  acessoriosStr: string
  acessoriosList: string[]
  // Rich CSV format fields (e.g. Nome_Acessorio, status, Versao_Associada_Nome, Versao_ID_Supabase, tipo, moeda, valor, fator)
  nome?: string
  status?: string
  tipo?: string
  moeda?: string
  valor?: number
  fator?: number
  versoesList?: string[]
  versaoIdSupabase?: string
  versaoIdsList?: string[]
  isRichAcessorioFormat?: boolean
  parseError?: string
  raw?: Record<string, unknown> | unknown[]
}

export interface ParsedSpreadsheetResult {
  sheetName?: string
  totalRows: number
  previewRows: ParsedImportRow[]
  allRows: ParsedImportRow[]
  availableSheets?: string[]
  isRichAcessorioFormat?: boolean
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
 * Normalizes ERP / code string: trims, lowercases, removes leading zeros if purely numeric or mixed, strips surrounding whitespace
 */
export function normalizeCodErp(str: string | null | undefined): string {
  if (!str) return ''
  const trimmed = str.toString().trim().toLowerCase()
  if (!trimmed) return ''
  // Strip leading zeros for digits (e.g. "0008" -> "8", "0136" -> "136")
  const strippedZeros = trimmed.replace(/^0+/, '')
  return strippedZeros || '0'
}

/**
 * Extracts ERP code from version names like "MÁQUINA X (ERP: 8)", "(erp: 136)", "(cod: 8)", "COD. ERP 8", etc.
 */
export function extractCodErpFromName(str: string | null | undefined): string | null {
  if (!str) return null
  const text = str.toString()

  // Match patterns like (ERP: 8), (erp: 008), (cod: 136), (cód: 136), [ERP: 136], {ERP: 136}, ERP: 136, COD_ERP: 136
  const patterns = [
    /[([{]\s*(?:erp|cod|cód|cod_erp|cód_erp|codigo|código|cod\.?\s*erp)\s*[:=-]?\s*([a-z0-9_-]+)\s*[)\]}]/i,
    /\b(?:erp|cod_erp|cód_erp|cod\.?\s*erp)\s*[:=-]\s*([a-z0-9_-]+)\b/i,
  ]
  for (const regex of patterns) {
    const match = text.match(regex)
    if (match && match[1]) {
      const code = match[1].trim()
      if (code) {
        return code
      }
    }
  }

  return null
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
 * Parses a string/number value into a clean float or default
 */
export function parseNumberValue(val: unknown, defaultValue = 0): number {
  if (val === null || val === undefined) return defaultValue
  if (typeof val === 'number') return isNaN(val) ? defaultValue : val
  const str = String(val).trim()
  if (!str) return defaultValue

  // Replace dot thousands if Brazilian formatting (e.g., 1.234,56)
  // or simple standard number (e.g., 15000.00 or 1,2)
  let cleaned = str.replace(/\s+/g, '')
  if (cleaned.includes(',') && cleaned.includes('.')) {
    if (cleaned.indexOf('.') < cleaned.indexOf(',')) {
      // 1.234,56 -> 1234.56
      cleaned = cleaned.replace(/\./g, '').replace(',', '.')
    } else {
      // 1,234.56 -> 1234.56
      cleaned = cleaned.replace(/,/g, '')
    }
  } else if (cleaned.includes(',')) {
    // 123,45 -> 123.45 or 1,2 -> 1.2
    cleaned = cleaned.replace(',', '.')
  }

  const num = parseFloat(cleaned)
  return isNaN(num) ? defaultValue : num
}

/**
 * Splits accessories, versions or IDs by '|' or ',', trims whitespace, discards empty items
 */
export function splitPipeItems(str: string | null | undefined): string[] {
  if (!str) return []
  return str
    .toString()
    .split(/[|,]/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
}

// Backward compatibility alias
export const splitAccessories = splitPipeItems

/**
 * Normalizes status value to 'Ativo' or 'Inativo'
 */
export function normalizeStatus(val: unknown): string {
  const s = String(val || '')
    .trim()
    .toLowerCase()
  if (s === 'inativo' || s === 'inativa' || s === 'false' || s === '0' || s === 'desativado') {
    return 'Inativo'
  }
  return 'Ativo'
}

/**
 * Normalizes currency to uppercase standard (BRL, USD, EUR, etc.)
 */
export function normalizeMoeda(val: unknown): string {
  const m = String(val || '')
    .trim()
    .toUpperCase()
  if (m === 'R$' || m === 'REAL' || m === 'REAIS') return 'BRL'
  if (m === '$' || m === 'US$' || m === 'DOLAR' || m === 'DOLARES') return 'USD'
  if (m === '€' || m === 'EURO' || m === 'EUROS') return 'EUR'
  return m || 'BRL'
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
 * Parses XLSX files and extracts rows.
 * Handles both rich accessories columns (Nome_Acessorio, status, Versao_Associada_Nome, Versao_ID_Supabase, tipo, moeda, valor, fator)
 * and legacy version/accessories columns.
 */
export async function parseXLSXFile(
  file: File,
  targetSheetName?: string,
): Promise<ParsedSpreadsheetResult> {
  const XLSX = await loadSheetJS()
  const arrayBuffer = await file.arrayBuffer()
  const workbook = XLSX.read(arrayBuffer, { type: 'array' })

  const sheetNames: string[] = workbook.SheetNames || []
  if (sheetNames.length === 0) {
    throw new Error('A planilha está vazia (nenhuma aba encontrada).')
  }

  // Choose sheet: targetSheetName > "Versoes" or "Acessorios" > first sheet
  let chosenSheetName = sheetNames[0]
  if (targetSheetName && sheetNames.includes(targetSheetName)) {
    chosenSheetName = targetSheetName
  } else {
    const preferredSheet = sheetNames.find((s: string) => {
      const norm = normalizeHeader(s)
      return (
        norm === 'acessorios' || norm === 'acessorio' || norm === 'versoes' || norm === 'versao'
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
      isRichAcessorioFormat: false,
    }
  }

  const firstRow = (sheetData[0] || []) as string[]
  const headerMap: Record<string, number> = {}
  firstRow.forEach((colVal, idx) => {
    const norm = normalizeHeader(colVal)
    if (norm) headerMap[norm] = idx
  })

  // Detect rich format columns in XLSX (including new column names)
  const nomeIdx = findHeaderMatch(headerMap, [
    'Nome_Acessorio',
    'nome_acessorio',
    'nomeacessorio',
    'nome',
    'acessorio',
    'descricao',
    'acessorios',
  ]) as number | undefined

  const codErpIdx = findHeaderMatch(headerMap, [
    'cod_erp',
    'coderp',
    'codigo_erp',
    'codigoerp',
    'cod_erp_versao',
    'coderpversao',
    'erp',
    'cod_e2corp',
    'e2corp',
  ]) as number | undefined

  const versaoIdIdx = findHeaderMatch(headerMap, [
    'Versao_ID_Supabase',
    'versao_id_supabase',
    'versaoidsupabase',
    'versao_id',
    'versaoid',
    'id_versao',
    'idversao',
    'uuid_versao',
    'uuidversao',
  ]) as number | undefined

  const versaoNomeIdx = findHeaderMatch(headerMap, [
    'Versao_Associada_Nome',
    'versao_associada_nome',
    'versaoassociadanome',
    'versao_associada',
    'versaoassociada',
    'versao',
    'versoes',
    'maquina',
    'modelo',
    'nomeversao',
    'nome_versao',
  ]) as number | undefined
  const statusIdx = findHeaderMatch(headerMap, ['status', 'situacao', 'ativo']) as
    | number
    | undefined
  const tipoIdx = findHeaderMatch(headerMap, [
    'tipo',
    'tipoacessorio',
    'tipo_acessorio',
    'categoria',
    'tipo_de_acessorio',
  ]) as number | undefined
  const moedaIdx = findHeaderMatch(headerMap, ['moeda', 'currency', 'tipo_moeda']) as
    | number
    | undefined
  const valorIdx = findHeaderMatch(headerMap, [
    'valor',
    'preco',
    'val',
    'valor_acessorio',
    'preco_venda',
  ]) as number | undefined
  const fatorIdx = findHeaderMatch(headerMap, [
    'fator',
    'fator_nac',
    'fatornac',
    'fatornacionalizacao',
    'fator_nacionalizacao',
  ]) as number | undefined

  const isRich =
    nomeIdx !== undefined &&
    (versaoIdIdx !== undefined ||
      versaoNomeIdx !== undefined ||
      codErpIdx !== undefined ||
      tipoIdx !== undefined ||
      valorIdx !== undefined ||
      fatorIdx !== undefined ||
      statusIdx !== undefined)
  const dataRows = sheetData.slice(1)
  const allRows: ParsedImportRow[] = []

  if (isRich && nomeIdx !== undefined) {
    dataRows.forEach((row, i) => {
      const lineNum = i + 2
      const cells = (Array.isArray(row) ? row : []) as unknown[]
      const rawNome = cells[nomeIdx] !== undefined ? String(cells[nomeIdx]).trim() : ''
      if (!rawNome) return

      const rawStatus =
        statusIdx !== undefined && cells[statusIdx] !== undefined
          ? normalizeStatus(cells[statusIdx])
          : 'Ativo'
      const rawTipo =
        tipoIdx !== undefined && cells[tipoIdx] !== undefined ? String(cells[tipoIdx]).trim() : ''
      const rawMoeda =
        moedaIdx !== undefined && cells[moedaIdx] !== undefined
          ? normalizeMoeda(cells[moedaIdx])
          : 'BRL'
      const rawValor =
        valorIdx !== undefined && cells[valorIdx] !== undefined
          ? parseNumberValue(cells[valorIdx], 0)
          : 0
      const rawFator =
        fatorIdx !== undefined &&
        cells[fatorIdx] !== undefined &&
        String(cells[fatorIdx]).trim() !== ''
          ? parseNumberValue(cells[fatorIdx], 1)
          : 1
      const rawVersaoId =
        versaoIdIdx !== undefined && cells[versaoIdIdx] !== undefined
          ? String(cells[versaoIdIdx]).trim()
          : ''
      const rawCodErp =
        codErpIdx !== undefined && cells[codErpIdx] !== undefined
          ? String(cells[codErpIdx]).trim()
          : ''
      let rawVersoes =
        versaoNomeIdx !== undefined && cells[versaoNomeIdx] !== undefined
          ? String(cells[versaoNomeIdx]).trim()
          : ''
      if (!rawVersoes && rawCodErp) {
        rawVersoes = rawCodErp
      }
      const versoesList = splitPipeItems(rawVersoes)
      const versaoIdsList = splitPipeItems(rawVersaoId)

      allRows.push({
        lineNumber: lineNum,
        nome: rawNome,
        status: rawStatus,
        tipo: rawTipo,
        moeda: rawMoeda,
        valor: rawValor,
        fator: rawFator,
        versaoIdSupabase: rawVersaoId,
        versaoIdsList,
        versaoNome: rawVersoes,
        acessoriosStr: rawNome,
        acessoriosList: [rawNome],
        versoesList,
        isRichAcessorioFormat: true,
        raw: { row },
      })
    })
  } else {
    // Legacy format: versao in col 0, acessorios in col 1
    const vCol = versaoNomeIdx ?? 0
    const aCol =
      headerMap['acessorios'] ??
      headerMap['acessorio'] ??
      headerMap['opcionais'] ??
      (vCol === 0 ? 1 : 0)

    dataRows.forEach((row, i) => {
      const lineNum = i + 2
      const cells = (Array.isArray(row) ? row : []) as unknown[]
      const rawVersao = cells[vCol] !== undefined ? String(cells[vCol]).trim() : ''
      const rawAcessorios = cells[aCol] !== undefined ? String(cells[aCol]).trim() : ''

      if (!rawVersao && !rawAcessorios) return

      allRows.push({
        lineNumber: lineNum,
        versaoNome: rawVersao,
        acessoriosStr: rawAcessorios,
        acessoriosList: splitPipeItems(rawAcessorios),
        isRichAcessorioFormat: false,
        raw: { row },
      })
    })
  }

  return {
    sheetName: chosenSheetName,
    totalRows: allRows.length,
    previewRows: allRows.slice(0, 5),
    allRows,
    availableSheets: sheetNames,
    isRichAcessorioFormat: isRich,
  }
}

/**
 * Parses CSV files and extracts rows using PapaParse.
 * Maps both new CSV format (Nome_Acessorio, Versao_Associada_Nome, Versao_ID_Supabase, status, tipo, moeda, valor, fator)
 * and earlier formats (nome, status, versao, tipo, moeda, valor, fator).
 * Tolerates malformed lines and captures parse errors gracefully.
 */
export async function parseCSVImportFile(file: File): Promise<ParsedSpreadsheetResult> {
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
            isRichAcessorioFormat: false,
          })
          return
        }

        // Map header names normalized -> original header name
        const headerMap: Record<string, string> = {}
        headers.forEach((h) => {
          headerMap[normalizeHeader(h)] = h
        })

        // Check if this CSV has the rich accessory format
        // Match columns flexibly with synonyms:
        const nomeKey = findHeaderMatch(headerMap, [
          'Nome_Acessorio',
          'nome_acessorio',
          'nomeacessorio',
          'nome',
          'acessorio',
          'descricao',
          'acessorios',
        ]) as string | undefined

        const codErpKey = findHeaderMatch(headerMap, [
          'cod_erp',
          'coderp',
          'codigo_erp',
          'codigoerp',
          'cod_erp_versao',
          'coderpversao',
          'erp',
          'cod_e2corp',
          'e2corp',
        ]) as string | undefined

        const versaoIdKey = findHeaderMatch(headerMap, [
          'Versao_ID_Supabase',
          'versao_id_supabase',
          'versaoidsupabase',
          'versao_id',
          'versaoid',
          'id_versao',
          'idversao',
          'uuid_versao',
          'uuidversao',
        ]) as string | undefined

        const versaoKey = findHeaderMatch(headerMap, [
          'Versao_Associada_Nome',
          'versao_associada_nome',
          'versaoassociadanome',
          'versao_associada',
          'versaoassociada',
          'versao',
          'versoes',
          'maquina',
          'modelo',
          'nomeversao',
          'nome_versao',
        ]) as string | undefined

        const statusKey = findHeaderMatch(headerMap, ['status', 'situacao', 'ativo']) as
          | string
          | undefined
        const tipoKey = findHeaderMatch(headerMap, [
          'tipo',
          'tipoacessorio',
          'tipo_acessorio',
          'categoria',
          'tipo_de_acessorio',
        ]) as string | undefined
        const moedaKey = findHeaderMatch(headerMap, ['moeda', 'currency', 'tipo_moeda']) as
          | string
          | undefined
        const valorKey = findHeaderMatch(headerMap, [
          'valor',
          'preco',
          'val',
          'valor_acessorio',
          'preco_venda',
        ]) as string | undefined
        const fatorKey = findHeaderMatch(headerMap, [
          'fator',
          'fator_nac',
          'fatornac',
          'fatornacionalizacao',
          'fator_nacionalizacao',
        ]) as string | undefined

        const isRich = !!(
          nomeKey &&
          (versaoIdKey ||
            codErpKey ||
            statusKey ||
            versaoKey ||
            tipoKey ||
            moedaKey ||
            valorKey ||
            fatorKey)
        )

        const allRows: ParsedImportRow[] = []

        // Also track any papa parse row errors
        const parseErrorsByRow = new Map<number, string>()
        if (results.errors && results.errors.length > 0) {
          results.errors.forEach((err) => {
            if (typeof err.row === 'number') {
              parseErrorsByRow.set(err.row + 2, err.message)
            }
          })
        }

        if (isRich && nomeKey) {
          data.forEach((row, i) => {
            const lineNum = i + 2
            const parseErr = parseErrorsByRow.get(lineNum)

            const rawNome = (row[nomeKey] || '').trim()
            if (!rawNome) {
              if (parseErr) {
                allRows.push({
                  lineNumber: lineNum,
                  nome: '',
                  status: 'Inativo',
                  tipo: '',
                  moeda: 'BRL',
                  valor: 0,
                  fator: 1,
                  versaoIdSupabase: '',
                  versaoIdsList: [],
                  versaoNome: '',
                  acessoriosStr: '',
                  acessoriosList: [],
                  versoesList: [],
                  isRichAcessorioFormat: true,
                  parseError: `Linha mal formatada no CSV: ${parseErr}`,
                  raw: row,
                })
              }
              return
            }

            const rawStatus =
              statusKey && row[statusKey] !== undefined ? normalizeStatus(row[statusKey]) : 'Ativo'
            const rawTipo = tipoKey && row[tipoKey] !== undefined ? row[tipoKey].trim() : ''
            const rawMoeda =
              moedaKey && row[moedaKey] !== undefined ? normalizeMoeda(row[moedaKey]) : 'BRL'
            const rawValor =
              valorKey !== undefined && row[valorKey] !== undefined
                ? parseNumberValue(row[valorKey], 0)
                : 0
            const rawFator =
              fatorKey !== undefined &&
              row[fatorKey] !== undefined &&
              String(row[fatorKey]).trim() !== ''
                ? parseNumberValue(row[fatorKey], 1)
                : 1
            const rawVersaoId =
              versaoIdKey && row[versaoIdKey] !== undefined ? row[versaoIdKey].trim() : ''
            const rawCodErp = codErpKey && row[codErpKey] !== undefined ? row[codErpKey].trim() : ''
            let rawVersoes = versaoKey && row[versaoKey] !== undefined ? row[versaoKey].trim() : ''
            if (!rawVersoes && rawCodErp) {
              rawVersoes = rawCodErp
            }
            const versoesList = splitPipeItems(rawVersoes)
            const versaoIdsList = splitPipeItems(rawVersaoId)

            allRows.push({
              lineNumber: lineNum,
              nome: rawNome,
              status: rawStatus,
              tipo: rawTipo,
              moeda: rawMoeda,
              valor: rawValor,
              fator: rawFator,
              versaoIdSupabase: rawVersaoId,
              versaoIdsList,
              versaoNome: rawVersoes,
              acessoriosStr: rawNome,
              acessoriosList: [rawNome],
              versoesList,
              isRichAcessorioFormat: true,
              parseError: parseErr,
              raw: row,
            })
          })
        } else {
          // Standard/Legacy format: Version in one col, accessories in another
          const finalVersaoCol =
            versaoKey ||
            codErpKey ||
            headerMap['versao'] ||
            headerMap['versoes'] ||
            headerMap['nomeversao'] ||
            headers[0]

          const finalAcessoriosCol =
            headerMap['acessorios'] ||
            headerMap['acessorio'] ||
            headerMap['opcionais'] ||
            headerMap['itens'] ||
            headers[1] ||
            headers[0]

          data.forEach((row, i) => {
            const lineNum = i + 2
            const vName = (row[finalVersaoCol] || '').trim()
            const accs = (row[finalAcessoriosCol] || '').trim()
            if (!vName && !accs) return

            allRows.push({
              lineNumber: lineNum,
              versaoNome: vName,
              acessoriosStr: accs,
              acessoriosList: splitPipeItems(accs),
              isRichAcessorioFormat: false,
              parseError: parseErrorsByRow.get(lineNum),
              raw: row,
            })
          })
        }

        resolve({
          totalRows: allRows.length,
          previewRows: allRows.slice(0, 5),
          allRows,
          isRichAcessorioFormat: isRich,
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
 * Automatically detects whether file is CSV or XLSX and routes accordingly.
 */
export async function parseAccessoriesImportFile(
  file: File,
  targetSheetName?: string,
): Promise<ParsedSpreadsheetResult> {
  const fileName = file.name.toLowerCase()
  if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
    return parseXLSXFile(file, targetSheetName)
  }
  if (fileName.endsWith('.csv') || fileName.endsWith('.txt')) {
    return parseCSVImportFile(file)
  }
  // Fallback check by MIME type
  if (file.type.includes('spreadsheet') || file.type.includes('excel')) {
    return parseXLSXFile(file, targetSheetName)
  }
  return parseCSVImportFile(file)
}

export type ImportLine = ParsedImportRow

export interface PendenciaVersao {
  lineNumber: number
  versaoNome: string
  versaoId?: string
  acessoriosStr: string
  motivo: string
}

export interface PendenciaAcessorio {
  lineNumber: number
  versaoNome: string
  acessorioNome: string
  motivo: string
}

export interface ImportReport {
  totalLines: number
  acessoriosCriados: number
  acessoriosAtualizados: number
  associacoesCriadas: number
  associacoesIgnoradas: number
  vinculosPorIdDireto: number
  vinculosPorNomeFallback: number
  pendencias: PendenciaVersao[]
  pendenciasAcessorios?: PendenciaAcessorio[]
  errosGerais?: string[]
}

export interface ProcessarImportacaoOptions {
  criarAcessoriosNaoEncontrados?: boolean
  onProgress?: (progress: {
    stage:
      | 'carregando_dados'
      | 'processando_acessorios'
      | 'criando_acessorios'
      | 'processando'
      | 'salvando'
      | 'concluido'
    current: number
    total: number
    percentage: number
    message?: string
  }) => void
  userName?: string
  userId?: string
}

/**
 * Main import processor function:
 * 1. Loads all existing versoes and acessorios from Supabase.
 * 2. If rich CSV format (Nome_Acessorio, status, tipo, moeda, valor, fator, Versao_ID_Supabase, Versao_Associada_Nome):
 *    - For each row, checks if accessory already exists by tolerant name matching.
 *    - If exists: UPDATES with status, tipo, moeda, valor, fator, atualizado_por.
 *    - If doesn't exist: INSERTS accessory with status, tipo, moeda, valor, fator, atualizado_por.
 *    - Resolves version links:
 *      * Direct link by ID (Versao_ID_Supabase / versaoIdsList): if valid UUID and present in database, links directly without name lookup.
 *      * Fallback by name: if ID is absent, invalid or not found, looks up Versao_Associada_Nome (tolerating accents/whitespace).
 *    - Versao not found (neither by ID nor by name) -> logged as pendencia with line number.
 *    - Creates association in acessorio_versoes if not already existing.
 * 3. Returns detailed ImportReport.
 */
export async function processarImportacao(
  rows: ImportLine[],
  options?: ProcessarImportacaoOptions,
): Promise<ImportReport> {
  const { supabase } = await import('@/lib/supabase/client')

  const report: ImportReport = {
    totalLines: rows.length,
    acessoriosCriados: 0,
    acessoriosAtualizados: 0,
    associacoesCriadas: 0,
    associacoesIgnoradas: 0,
    vinculosPorIdDireto: 0,
    vinculosPorNomeFallback: 0,
    pendencias: [],
    pendenciasAcessorios: [],
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
    message: 'Carregando dados existentes de versões e acessórios...',
  })

  // 1. Fetch all versions with pagination (CRITICAL: Read-only, never create or modify versions)
  type VersaoRecord = {
    id: string
    nome: string
    cod_erp?: string | null
    normNome: string
    keyNome: string
  }
  const allVersoesList: VersaoRecord[] = []
  const versoesByIdMap = new Map<string, VersaoRecord>()
  const versoesByCodErpMap = new Map<string, VersaoRecord>()
  const versoesExactMap = new Map<string, VersaoRecord>()
  const versoesKeyMap = new Map<string, VersaoRecord>()
  let vPage = 0
  const PAGE_SIZE = 1000
  let hasMoreVersoes = true

  while (hasMoreVersoes) {
    const { data: versoesData, error: vErr } = await supabase
      .from('versoes')
      .select('id, nome, cod_erp, deleted_at')
      .is('deleted_at', null)
      .range(vPage * PAGE_SIZE, (vPage + 1) * PAGE_SIZE - 1)

    if (vErr) {
      throw new Error(`Erro ao consultar versões no banco: ${vErr.message}`)
    }

    if (versoesData && versoesData.length > 0) {
      versoesData.forEach((v) => {
        const nomeStr = v.nome || ''
        const normNome = normalizeStringMatch(nomeStr)
        const keyNome = normalizeKey(nomeStr)
        const record: VersaoRecord = {
          id: v.id,
          nome: nomeStr,
          cod_erp: v.cod_erp,
          normNome,
          keyNome,
        }

        allVersoesList.push(record)

        if (v.id) {
          versoesByIdMap.set(v.id.toLowerCase(), record)
        }

        if (v.cod_erp) {
          const cleanCod = v.cod_erp.trim().toLowerCase()
          if (cleanCod && !versoesByCodErpMap.has(cleanCod)) {
            versoesByCodErpMap.set(cleanCod, record)
          }
          const normCod = normalizeCodErp(v.cod_erp)
          if (normCod && !versoesByCodErpMap.has(normCod)) {
            versoesByCodErpMap.set(normCod, record)
          }
          const keyCod = normalizeKey(v.cod_erp)
          if (keyCod && !versoesByCodErpMap.has(keyCod)) {
            versoesByCodErpMap.set(keyCod, record)
          }
        }

        if (nomeStr) {
          if (normNome && !versoesExactMap.has(normNome)) {
            versoesExactMap.set(normNome, record)
          }
          if (keyNome && !versoesKeyMap.has(keyNome)) {
            versoesKeyMap.set(keyNome, record)
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

  // Lookup helpers for versions
  const findVersaoById = (idStr: string | null | undefined): VersaoRecord | undefined => {
    if (!idStr) return undefined
    const cleanId = idStr.trim().toLowerCase()
    return versoesByIdMap.get(cleanId)
  }

  const findVersaoByCodErp = (codErp: string | null | undefined): VersaoRecord | undefined => {
    if (!codErp) return undefined
    const clean = codErp.toString().trim().toLowerCase()
    const norm = normalizeCodErp(codErp)
    const key = normalizeKey(codErp)
    return (
      (clean ? versoesByCodErpMap.get(clean) : undefined) ||
      (norm ? versoesByCodErpMap.get(norm) : undefined) ||
      (key ? versoesByCodErpMap.get(key) : undefined)
    )
  }

  const findVersaoByNome = (query: string | null | undefined): VersaoRecord | undefined => {
    if (!query) return undefined
    const trimmedQuery = query.toString().trim()
    if (!trimmedQuery) return undefined

    // 1. Check if an ERP code is embedded in the query string (e.g., "(ERP: 8)", "(erp: 136)", "(cod: 8)")
    const extractedCode = extractCodErpFromName(trimmedQuery)
    if (extractedCode) {
      const matchByExtracted = findVersaoByCodErp(extractedCode)
      if (matchByExtracted) return matchByExtracted
    }

    // 2. Direct match by COD_ERP if the whole query string is a code / number
    const directCodeMatch = findVersaoByCodErp(trimmedQuery)
    if (directCodeMatch) return directCodeMatch

    // 3. Multi-tier tolerant name matching:
    // a. Exact normalized string match (accents, lowercase, whitespace)
    const norm = normalizeStringMatch(trimmedQuery)
    const exactMatch = versoesExactMap.get(norm)
    if (exactMatch) return exactMatch

    // b. Alphanumeric normalized key match
    const queryKey = normalizeKey(trimmedQuery)
    if (!queryKey) return undefined
    const keyMatch = versoesKeyMap.get(queryKey)
    if (keyMatch) return keyMatch

    // c. PREFIX match (min length 12 chars to avoid false positives)
    // if queryKey is prefix of dbKey or dbKey is prefix of queryKey
    const MIN_PREFIX_LEN = 12
    const prefixCandidates: { record: VersaoRecord; diff: number }[] = []

    for (const record of allVersoesList) {
      const dbKey = record.keyNome
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
      // Pick the candidate with the smallest length difference; if tie, first one
      prefixCandidates.sort((a, b) => a.diff - b.diff)
      return prefixCandidates[0].record
    }

    // d. CONTAINS match (min length 12 chars)
    // if queryKey is contained in dbKey or dbKey is contained in queryKey
    const MIN_CONTAINS_LEN = 12
    const containsCandidates: { record: VersaoRecord; diff: number }[] = []

    for (const record of allVersoesList) {
      const dbKey = record.keyNome
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
      // Pick the candidate with the smallest length difference; if tie, first one
      containsCandidates.sort((a, b) => a.diff - b.diff)
      return containsCandidates[0].record
    }

    return undefined
  }

  // 2. Fetch all existing accessories
  const acessoriosExactMap = new Map<string, { id: string; nome: string }>()
  const acessoriosKeyMap = new Map<string, { id: string; nome: string }>()
  let aPage = 0
  let hasMoreAcessorios = true

  while (hasMoreAcessorios) {
    const { data: accData, error: aErr } = await supabase
      .from('acessorios')
      .select('id, nome')
      .range(aPage * PAGE_SIZE, (aPage + 1) * PAGE_SIZE - 1)

    if (aErr) {
      throw new Error(`Erro ao consultar acessórios no banco: ${aErr.message}`)
    }

    if (accData && accData.length > 0) {
      accData.forEach((a) => {
        if (a.nome) {
          const norm = normalizeStringMatch(a.nome)
          const key = normalizeKey(a.nome)
          const record = { id: a.id, nome: a.nome }
          if (norm && !acessoriosExactMap.has(norm)) {
            acessoriosExactMap.set(norm, record)
          }
          if (key && !acessoriosKeyMap.has(key)) {
            acessoriosKeyMap.set(key, record)
          }
        }
      })
      if (accData.length < PAGE_SIZE) {
        hasMoreAcessorios = false
      } else {
        aPage++
      }
    } else {
      hasMoreAcessorios = false
    }
  }

  // Lookup helper for accessories
  const findAcessorio = (query: string): { id: string; nome: string } | undefined => {
    if (!query) return undefined
    const norm = normalizeStringMatch(query)
    const exactMatch = acessoriosExactMap.get(norm)
    if (exactMatch) return exactMatch

    const key = normalizeKey(query)
    return acessoriosKeyMap.get(key)
  }

  // 3. Fetch existing associations from acessorio_versoes table
  const existingAssocSet = new Set<string>() // key: `${acessorio_id}:${versao_id}`
  let assocPage = 0
  let hasMoreAssoc = true

  while (hasMoreAssoc) {
    const { data: assocData, error: asErr } = await supabase
      .from('acessorio_versoes')
      .select('acessorio_id, versao_id')
      .range(assocPage * PAGE_SIZE, (assocPage + 1) * PAGE_SIZE - 1)

    if (asErr) {
      throw new Error(`Erro ao consultar associações existentes: ${asErr.message}`)
    }

    if (assocData && assocData.length > 0) {
      assocData.forEach((as) => {
        if (as.acessorio_id && as.versao_id) {
          existingAssocSet.add(`${as.acessorio_id}:${as.versao_id}`)
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

  const isRichFormat = rows.some(
    (r) =>
      r.isRichAcessorioFormat ||
      (r.nome && r.nome.trim().length > 0) ||
      (r.versaoIdSupabase && r.versaoIdSupabase.trim().length > 0),
  )

  const newAssociationsToInsert: { acessorio_id: string; versao_id: string }[] = []
  const stagedAssocSet = new Set<string>()

  const registerAssociation = (
    acessorioId: string,
    versaoId: string,
    origin: 'id_direto' | 'nome_fallback' = 'nome_fallback',
  ) => {
    const assocKey = `${acessorioId}:${versaoId}`
    if (existingAssocSet.has(assocKey) || stagedAssocSet.has(assocKey)) {
      report.associacoesIgnoradas++
    } else {
      stagedAssocSet.add(assocKey)
      newAssociationsToInsert.push({
        acessorio_id: acessorioId,
        versao_id: versaoId,
      })
      if (origin === 'id_direto') {
        report.vinculosPorIdDireto++
      } else {
        report.vinculosPorNomeFallback++
      }
    }
  }

  if (isRichFormat) {
    // -------------------------------------------------------------
    // RICH CSV FORMAT PROCESSING (Nome_Acessorio, status, tipo, moeda, valor, fator, Versao_ID_Supabase, Versao_Associada_Nome)
    // -------------------------------------------------------------
    options?.onProgress?.({
      stage: 'processando_acessorios',
      current: 0,
      total: rows.length,
      percentage: 20,
      message: 'Processando acessórios (atualizando existentes e cadastrando novos)...',
    })

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]

      // Handle malformed rows captured during CSV parsing
      if (row.parseError && !row.nome) {
        report.pendencias.push({
          lineNumber: row.lineNumber,
          versaoNome: '(Linha mal formatada)',
          acessoriosStr: '',
          motivo: row.parseError,
        })
        continue
      }

      const accNome = (row.nome || '').trim()
      if (!accNome) continue

      const status = normalizeStatus(row.status)
      const tipo = row.tipo ? row.tipo.trim() : null
      const moeda = normalizeMoeda(row.moeda)
      const valor = row.valor !== undefined ? row.valor : 0
      const fator_nac = row.fator !== undefined ? row.fator : 1
      const userName = options?.userName || 'Importação CSV'

      // Check if accessory already exists (tolerantly by name)
      const existing = findAcessorio(accNome)
      let acessorioId: string

      if (existing) {
        // UPDATE existing accessory with the new values from CSV
        const { error: updErr } = await supabase
          .from('acessorios')
          .update({
            status,
            tipo,
            moeda,
            valor,
            fator_nac,
            atualizado_por: userName,
          })
          .eq('id', existing.id)

        if (updErr) {
          report.errosGerais?.push(`Erro ao atualizar acessório "${accNome}": ${updErr.message}`)
        } else {
          report.acessoriosAtualizados++
        }
        acessorioId = existing.id
      } else {
        // INSERT new accessory
        const { data: insData, error: insErr } = await supabase
          .from('acessorios')
          .insert({
            nome: accNome,
            status,
            tipo,
            moeda,
            valor,
            fator_nac,
            versoes: [],
            atualizado_por: userName,
          })
          .select('id, nome')
          .single()

        if (insErr || !insData) {
          report.errosGerais?.push(
            `Erro ao criar acessório "${accNome}": ${insErr?.message || 'Falha desconhecida'}`,
          )
          continue
        }

        report.acessoriosCriados++
        acessorioId = insData.id

        // Store in local lookup maps for future rows in this import
        const norm = normalizeStringMatch(accNome)
        const key = normalizeKey(accNome)
        const record = { id: insData.id, nome: insData.nome }
        if (norm) acessoriosExactMap.set(norm, record)
        if (key) acessoriosKeyMap.set(key, record)
      }

      // Link version(s):
      // 1. Direct link by Versao_ID_Supabase if present and valid UUID in versoes table
      // 2. Fallback to Versao_Associada_Nome / versaoNome (split by '|')
      const idCandidates =
        row.versaoIdsList && row.versaoIdsList.length > 0
          ? row.versaoIdsList
          : splitPipeItems(row.versaoIdSupabase)

      const nameCandidates =
        row.versoesList && row.versoesList.length > 0
          ? row.versoesList
          : splitPipeItems(row.versaoNome)

      // Pair or loop items. If IDs are present (single or list):
      if (idCandidates.length > 0) {
        for (let idx = 0; idx < idCandidates.length; idx++) {
          const candidateId = idCandidates[idx]
          const correspondingName = nameCandidates[idx] || nameCandidates[0] || ''

          if (isValidUUID(candidateId)) {
            const versaoById = findVersaoById(candidateId)
            if (versaoById) {
              registerAssociation(acessorioId, versaoById.id, 'id_direto')
              continue
            }
          }

          // Fallback to name search if ID was not valid UUID or ID not found in database
          if (correspondingName) {
            const versaoByName = findVersaoByNome(correspondingName)
            if (versaoByName) {
              registerAssociation(acessorioId, versaoByName.id, 'nome_fallback')
              continue
            }
          }

          // If neither ID nor name matched
          report.pendencias.push({
            lineNumber: row.lineNumber,
            versaoNome: correspondingName || candidateId,
            versaoId: candidateId,
            acessoriosStr: accNome,
            motivo: isValidUUID(candidateId)
              ? 'ID da versão (Versao_ID_Supabase) não encontrado no banco'
              : `Versão não encontrada por ID ("${candidateId}") nem por nome ("${correspondingName}")`,
          })
        }
      } else if (nameCandidates.length > 0) {
        // No IDs provided: purely search by version name(s)
        for (const vName of nameCandidates) {
          const trimmedVName = vName.trim()
          if (!trimmedVName) continue

          const versao = findVersaoByNome(trimmedVName)
          if (!versao) {
            report.pendencias.push({
              lineNumber: row.lineNumber,
              versaoNome: trimmedVName,
              acessoriosStr: accNome,
              motivo: 'Versão não encontrada no banco de dados (busca por nome)',
            })
            continue
          }

          registerAssociation(acessorioId, versao.id, 'nome_fallback')
        }
      }

      if (i % 10 === 0 || i === rows.length - 1) {
        const pct = 20 + Math.round((i / rows.length) * 55)
        options?.onProgress?.({
          stage: 'processando_acessorios',
          current: i + 1,
          total: rows.length,
          percentage: pct,
          message: `Processando acessório ${i + 1} de ${rows.length}: "${accNome}"...`,
        })
      }
    }
  } else {
    // -------------------------------------------------------------
    // LEGACY VERSION-CENTRIC FORMAT PROCESSING (versao, acessorios)
    // -------------------------------------------------------------
    const shouldCreateAccessories = options?.criarAcessoriosNaoEncontrados !== false

    if (shouldCreateAccessories) {
      options?.onProgress?.({
        stage: 'criando_acessorios',
        current: 0,
        total: rows.length,
        percentage: 25,
        message: 'Identificando e criando novos acessórios no cadastro...',
      })

      const uniqueAccessoriesToCreate = new Map<string, string>()

      rows.forEach((row) => {
        row.acessoriosList.forEach((accName) => {
          const trimmed = accName.trim()
          if (!trimmed) return
          const existing = findAcessorio(trimmed)
          if (!existing) {
            const key = normalizeKey(trimmed)
            if (key && !uniqueAccessoriesToCreate.has(key)) {
              uniqueAccessoriesToCreate.set(key, trimmed)
            }
          }
        })
      })

      if (uniqueAccessoriesToCreate.size > 0) {
        const accessoriesToInsert = Array.from(uniqueAccessoriesToCreate.values()).map((nome) => ({
          nome,
          status: 'Ativo',
          moeda: 'BRL',
          valor: 0,
          fator_nac: 1,
          versoes: [],
          atualizado_por: options?.userName || 'Importação Automática',
        }))

        const INSERT_BATCH = 50
        for (let i = 0; i < accessoriesToInsert.length; i += INSERT_BATCH) {
          const chunk = accessoriesToInsert.slice(i, i + INSERT_BATCH)
          const { data: insertedAccs, error: insErr } = await supabase
            .from('acessorios')
            .insert(chunk)
            .select('id, nome')

          if (insErr) {
            report.errosGerais?.push(
              `Erro ao cadastrar lote de novos acessórios: ${insErr.message}`,
            )
          } else if (insertedAccs) {
            insertedAccs.forEach((a) => {
              const norm = normalizeStringMatch(a.nome)
              const key = normalizeKey(a.nome)
              const record = { id: a.id, nome: a.nome }
              if (norm) acessoriosExactMap.set(norm, record)
              if (key) acessoriosKeyMap.set(key, record)
            })
            report.acessoriosCriados += insertedAccs.length
          }
        }
      }
    }

    options?.onProgress?.({
      stage: 'processando',
      current: 0,
      total: rows.length,
      percentage: 50,
      message: 'Vinculando acessórios às versões correspondentes...',
    })

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const trimmedVersaoNome = (row.versaoNome || '').trim()

      if (!trimmedVersaoNome) {
        report.pendencias.push({
          lineNumber: row.lineNumber,
          versaoNome: '(Em branco)',
          acessoriosStr: row.acessoriosStr,
          motivo: 'Nome da versão em branco na linha',
        })
        continue
      }

      const versao = findVersaoByNome(trimmedVersaoNome)
      if (!versao) {
        report.pendencias.push({
          lineNumber: row.lineNumber,
          versaoNome: trimmedVersaoNome,
          acessoriosStr: row.acessoriosStr,
          motivo: 'Versão não encontrada no banco de dados',
        })
        continue
      }

      for (const accName of row.acessoriosList) {
        const trimmedAcc = accName.trim()
        if (!trimmedAcc) continue

        const acessorio = findAcessorio(trimmedAcc)
        if (!acessorio) {
          report.pendenciasAcessorios?.push({
            lineNumber: row.lineNumber,
            versaoNome: trimmedVersaoNome,
            acessorioNome: trimmedAcc,
            motivo: 'Acessório não encontrado no cadastro',
          })
          continue
        }

        registerAssociation(acessorio.id, versao.id, 'nome_fallback')
      }

      if (i % 50 === 0 || i === rows.length - 1) {
        const pct = 50 + Math.round((i / rows.length) * 25)
        options?.onProgress?.({
          stage: 'processando',
          current: i + 1,
          total: rows.length,
          percentage: pct,
          message: `Analisando linha ${i + 1} de ${rows.length}...`,
        })
      }
    }
  }

  // 4. Insert new associations into acessorio_versoes table in batches
  if (newAssociationsToInsert.length > 0) {
    const BATCH_SIZE_ASSOC = 100
    const totalBatches = Math.ceil(newAssociationsToInsert.length / BATCH_SIZE_ASSOC)

    for (let b = 0; b < totalBatches; b++) {
      const chunk = newAssociationsToInsert.slice(b * BATCH_SIZE_ASSOC, (b + 1) * BATCH_SIZE_ASSOC)

      const { data: inserted, error: insertErr } = await supabase
        .from('acessorio_versoes')
        .insert(chunk)
        .select('id')

      if (insertErr) {
        report.errosGerais?.push(
          `Erro ao salvar lote de vínculos (${b + 1}/${totalBatches}): ${insertErr.message}`,
        )
      } else {
        report.associacoesCriadas += inserted?.length ?? chunk.length
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
