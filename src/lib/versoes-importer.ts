import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import { supabase } from '@/lib/supabase/client'
import type { Database } from '@/lib/supabase/types'

async function loadSheetJS(): Promise<any> {
  return XLSX
}

export interface ParsedVersaoRow {
  lineNumber: number
  nome: string
  reg?: string
  codErp?: string
  modeloNomeOuId?: string
  status?: string
  nomeAbreviado?: string
  moeda?: string
  valor?: number
  temFator?: boolean
  fatorNac?: number
  descMaxRep?: number
  descMaxBener?: number
  temEstoque?: boolean
  estoqueTotal?: number
  estoqueBloqueado?: number
  estoqueReservado?: number
  estoqueDisponivel?: number
  tiposPropostaStr: string
  tiposPropostaList: string[]
  acessoriosStandards?: string
  caracteristicasConstrutivas?: string
  especificacoesTecnicas?: string
  alertaEstoqueMinimo?: number
  parseError?: string
  raw?: Record<string, unknown> | unknown[]
  // Track which fields were present in the source file
  hasField?: {
    nome: boolean
    reg: boolean
    codErp: boolean
    modelo: boolean
    status: boolean
    nomeAbreviado: boolean
    moeda: boolean
    valor: boolean
    temFator: boolean
    fatorNac: boolean
    descMaxRep: boolean
    descMaxBener: boolean
    temEstoque: boolean
    estoqueTotal: boolean
    estoqueBloqueado: boolean
    estoqueReservado: boolean
    estoqueDisponivel: boolean
    tipoProposta?: boolean
    acessoriosStandards: boolean
    caracteristicasConstrutivas: boolean
    especificacoesTecnicas: boolean
    alertaEstoqueMinimo: boolean
  }
}

export interface ParsedVersoesSpreadsheetResult {
  sheetName?: string
  totalRows: number
  previewRows: ParsedVersaoRow[]
  allRows: ParsedVersaoRow[]
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
 * Parses numeric values safely from Brazilian or standard formats
 */
export function parseNumberValue(val: unknown, defaultValue = 0): number {
  if (val === null || val === undefined) return defaultValue
  if (typeof val === 'number') return isNaN(val) ? defaultValue : val
  const str = String(val).trim()
  if (!str) return defaultValue

  let cleaned = str.replace(/\s+/g, '').replace(/R\$/gi, '').replace(/\$/g, '')
  if (cleaned.includes(',') && cleaned.includes('.')) {
    if (cleaned.indexOf('.') < cleaned.indexOf(',')) {
      // 1.234,56 -> 1234.56
      cleaned = cleaned.replace(/\./g, '').replace(',', '.')
    } else {
      // 1,234.56 -> 1234.56
      cleaned = cleaned.replace(/,/g, '')
    }
  } else if (cleaned.includes(',')) {
    cleaned = cleaned.replace(',', '.')
  }

  const num = parseFloat(cleaned)
  return isNaN(num) ? defaultValue : num
}

/**
 * Parses boolean values safely from common representations (true, sim, s, 1, false, nao, n, 0)
 */
export function parseBooleanValue(val: unknown, defaultValue = false): boolean {
  if (val === null || val === undefined) return defaultValue
  if (typeof val === 'boolean') return val
  const s = String(val).trim().toLowerCase()
  if (['true', 'sim', 's', '1', 'yes', 'y', 't'].includes(s)) return true
  if (['false', 'nao', 'não', 'n', '0', 'no', 'f'].includes(s)) return false
  return defaultValue
}

/**
 * Normalizes status value to standard ('Ativo' or 'Inativo')
 */
export function normalizeStatus(val: unknown): string {
  const s = String(val || '')
    .trim()
    .toLowerCase()
  if (
    s === 'inativo' ||
    s === 'inativa' ||
    s === 'false' ||
    s === '0' ||
    s === 'desativado' ||
    s === 'i'
  ) {
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
 * Extracts and maps row values to ParsedVersaoRow
 */
function mapRowToParsedVersao(
  getVal: (keySynonyms: string[]) => { value: string; exists: boolean },
  lineNumber: number,
  raw: Record<string, unknown> | unknown[],
  parseError?: string,
): ParsedVersaoRow {
  const regLookup = getVal(['reg', 'registro', 'num_reg', 'numero_reg', 'reg_id', 'id_reg'])

  const codErpLookup = getVal([
    'cod_e2corp',
    'code2corp',
    'cod_erp',
    'coderp',
    'codigo_erp',
    'codigo_e2corp',
    'codigoe2corp',
    'cod_erp_versao',
  ])

  const nomeLookup = getVal([
    'nome',
    'versao',
    'versoes',
    'nome_versao',
    'nomeversao',
    'versao_nome',
    'maquina',
    'equipamento',
    'descricao',
    'descricao_versao',
  ])

  const modeloLookup = getVal([
    'modelo',
    'modelos',
    'modelo_nome',
    'modelonome',
    'nome_modelo',
    'nomemodelo',
    'id_modelo',
    'modeloid',
    'cod_modelo',
  ])

  const statusLookup = getVal(['status', 'situacao', 'ativo'])
  const nomeAbreviadoLookup = getVal([
    'nome_abreviado',
    'nomeabreviado',
    'abreviado',
    'apelido',
    'sigla',
  ])
  const moedaLookup = getVal(['moeda', 'currency', 'tipo_moeda'])
  const valorLookup = getVal(['valor', 'preco', 'val', 'preco_venda', 'valor_tabela'])
  const temFatorLookup = getVal(['tem_fator', 'temfator', 'fator_ativo', 'aplicar_fator'])
  const fatorNacLookup = getVal([
    'fator_nac',
    'fatornac',
    'fator',
    'fator_nacionalizacao',
    'fatornacionalizacao',
  ])
  const descMaxRepLookup = getVal([
    'desc_max_rep',
    'descmaxrep',
    'desconto_max_representante',
    'descontomaxrepresentante',
    'desconto_rep',
    'desc_rep',
  ])
  const descMaxBenerLookup = getVal([
    'desc_max_bener',
    'descmaxbener',
    'desconto_max_bener',
    'descontomaxbener',
    'desconto_bener',
    'desc_bener',
  ])
  const temEstoqueLookup = getVal(['tem_estoque', 'temestoque', 'controla_estoque'])
  const estoqueTotalLookup = getVal(['estoque_total', 'estoquetotal', 'total_estoque', 'estoque'])
  const estoqueBloqueadoLookup = getVal([
    'estoque_bloqueado',
    'estoquebloqueado',
    'bloqueado',
    'estoque_bloq',
  ])
  const estoqueReservadoLookup = getVal([
    'estoque_reservado',
    'estoquereservado',
    'reservado',
    'estoque_res',
  ])
  const estoqueDisponivelLookup = getVal([
    'estoque_disponivel',
    'estoquedisponivel',
    'disponivel',
    'estoque_disp',
  ])

  const tipoPropostaLookup = getVal([
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
  ])

  const acessoriosStandardsLookup = getVal([
    'acessorios_standards',
    'acessoriosstandards',
    'standards',
    'itens_standard',
    'acessorios_padrao',
  ])

  const caracteristicasLookup = getVal([
    'caracteristicas_construtivas',
    'caracteristicasconstrutivas',
    'caracteristicas',
    'construtivas',
  ])

  const especificacoesLookup = getVal([
    'especificacoes_tecnicas',
    'especificacoestecnicas',
    'especificacoes',
    'especificacao',
  ])

  const alertaEstoqueLookup = getVal([
    'alerta_estoque_minimo',
    'alertaestoqueminimo',
    'estoque_minimo',
    'estoqueminimo',
  ])

  const hasField = {
    nome: nomeLookup.exists && nomeLookup.value.length > 0,
    reg: regLookup.exists && regLookup.value.length > 0,
    codErp: codErpLookup.exists && codErpLookup.value.length > 0,
    modelo: modeloLookup.exists && modeloLookup.value.length > 0,
    status: statusLookup.exists && statusLookup.value.length > 0,
    nomeAbreviado: nomeAbreviadoLookup.exists && nomeAbreviadoLookup.value.length > 0,
    moeda: moedaLookup.exists && moedaLookup.value.length > 0,
    valor: valorLookup.exists && valorLookup.value.length > 0,
    temFator: temFatorLookup.exists && temFatorLookup.value.length > 0,
    fatorNac: fatorNacLookup.exists && fatorNacLookup.value.length > 0,
    descMaxRep: descMaxRepLookup.exists && descMaxRepLookup.value.length > 0,
    descMaxBener: descMaxBenerLookup.exists && descMaxBenerLookup.value.length > 0,
    temEstoque: temEstoqueLookup.exists && temEstoqueLookup.value.length > 0,
    estoqueTotal: estoqueTotalLookup.exists && estoqueTotalLookup.value.length > 0,
    estoqueBloqueado: estoqueBloqueadoLookup.exists && estoqueBloqueadoLookup.value.length > 0,
    estoqueReservado: estoqueReservadoLookup.exists && estoqueReservadoLookup.value.length > 0,
    estoqueDisponivel: estoqueDisponivelLookup.exists && estoqueDisponivelLookup.value.length > 0,
    tipoProposta: tipoPropostaLookup.exists && tipoPropostaLookup.value.length > 0,
    acessoriosStandards:
      acessoriosStandardsLookup.exists && acessoriosStandardsLookup.value.length > 0,
    caracteristicasConstrutivas:
      caracteristicasLookup.exists && caracteristicasLookup.value.length > 0,
    especificacoesTecnicas: especificacoesLookup.exists && especificacoesLookup.value.length > 0,
    alertaEstoqueMinimo: alertaEstoqueLookup.exists && alertaEstoqueLookup.value.length > 0,
  }

  const totalEstoque = hasField.estoqueTotal ? parseNumberValue(estoqueTotalLookup.value, 0) : 0
  const estoqueBloqueado = hasField.estoqueBloqueado
    ? parseNumberValue(estoqueBloqueadoLookup.value, 0)
    : 0
  const estoqueReservado = hasField.estoqueReservado
    ? parseNumberValue(estoqueReservadoLookup.value, 0)
    : 0
  const calculatedDisponivel = Math.max(0, totalEstoque - estoqueBloqueado - estoqueReservado)
  const estoqueDisponivel = hasField.estoqueDisponivel
    ? parseNumberValue(estoqueDisponivelLookup.value, calculatedDisponivel)
    : calculatedDisponivel

  // Resolved REG value and COD_ERP value:
  // If reg is present in file, use it as reg; if cod_erp is also present, keep both;
  // If only reg is present, populate both reg and codErp with it (to guarantee backward-compatibility)
  // If only cod_erp is present, populate both reg and codErp with it as well
  const resolvedReg = hasField.reg
    ? regLookup.value
    : hasField.codErp
      ? codErpLookup.value
      : undefined
  const resolvedCodErp = hasField.codErp
    ? codErpLookup.value
    : hasField.reg
      ? regLookup.value
      : undefined

  return {
    lineNumber,
    nome: nomeLookup.value,
    reg: resolvedReg,
    codErp: resolvedCodErp,
    modeloNomeOuId: hasField.modelo ? modeloLookup.value : undefined,
    status: hasField.status ? normalizeStatus(statusLookup.value) : 'Ativo',
    nomeAbreviado: hasField.nomeAbreviado ? nomeAbreviadoLookup.value : undefined,
    moeda: hasField.moeda ? normalizeMoeda(moedaLookup.value) : 'BRL',
    valor: hasField.valor ? parseNumberValue(valorLookup.value, 0) : 0,
    temFator: hasField.temFator ? parseBooleanValue(temFatorLookup.value, false) : false,
    fatorNac: hasField.fatorNac ? parseNumberValue(fatorNacLookup.value, 1) : 1,
    descMaxRep: hasField.descMaxRep ? parseNumberValue(descMaxRepLookup.value, 0) : 0,
    descMaxBener: hasField.descMaxBener ? parseNumberValue(descMaxBenerLookup.value, 0) : 0,
    temEstoque: hasField.temEstoque ? parseBooleanValue(temEstoqueLookup.value, false) : false,
    estoqueTotal: totalEstoque,
    estoqueBloqueado,
    estoqueReservado,
    estoqueDisponivel,
    tiposPropostaStr: tipoPropostaLookup.value,
    tiposPropostaList: splitPipeItems(tipoPropostaLookup.value),
    acessoriosStandards: hasField.acessoriosStandards ? acessoriosStandardsLookup.value : undefined,
    caracteristicasConstrutivas: hasField.caracteristicasConstrutivas
      ? caracteristicasLookup.value
      : undefined,
    especificacoesTecnicas: hasField.especificacoesTecnicas
      ? especificacoesLookup.value
      : undefined,
    alertaEstoqueMinimo: hasField.alertaEstoqueMinimo
      ? parseNumberValue(alertaEstoqueLookup.value, 0)
      : undefined,
    parseError,
    raw,
    hasField,
  }
}

/**
 * Parses XLSX files and extracts version records
 */
export async function parseVersoesXLSXFile(
  file: File,
  targetSheetName?: string,
): Promise<ParsedVersoesSpreadsheetResult> {
  const XLSX = await loadSheetJS()
  const arrayBuffer = await file.arrayBuffer()
  const workbook = XLSX.read(arrayBuffer, { type: 'array' })

  const sheetNames: string[] = workbook.SheetNames || []
  if (sheetNames.length === 0) {
    throw new Error('A planilha está vazia (nenhuma aba encontrada).')
  }

  let chosenSheetName = sheetNames[0]
  if (targetSheetName && sheetNames.includes(targetSheetName)) {
    chosenSheetName = targetSheetName
  } else {
    const preferredSheet = sheetNames.find((s: string) => {
      const norm = normalizeHeader(s)
      return (
        norm === 'versoes' ||
        norm === 'versao' ||
        norm === 'produtos' ||
        norm === 'maquinas' ||
        norm === 'equipamentos'
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

  const dataRows = sheetData.slice(1)
  const allRows: ParsedVersaoRow[] = []

  dataRows.forEach((row, i) => {
    const lineNum = i + 2
    const cells = (Array.isArray(row) ? row : []) as unknown[]

    const getVal = (candidates: string[]): { value: string; exists: boolean } => {
      const colIdx = findHeaderMatch(headerMap, candidates) as number | undefined
      if (colIdx !== undefined && cells[colIdx] !== undefined && cells[colIdx] !== null) {
        const valStr = String(cells[colIdx]).trim()
        return { value: valStr, exists: true }
      }
      return { value: '', exists: false }
    }

    const parsedRow = mapRowToParsedVersao(getVal, lineNum, { row })
    // If row has neither name nor reg nor codErp and no types, discard empty line
    if (!parsedRow.nome && !parsedRow.reg && !parsedRow.codErp && !parsedRow.tiposPropostaStr) {
      return
    }

    allRows.push(parsedRow)
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
 * Parses CSV files and extracts version records
 */
export async function parseVersoesCSVFile(file: File): Promise<ParsedVersoesSpreadsheetResult> {
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

        const headerMap: Record<string, string> = {}
        headers.forEach((h) => {
          headerMap[normalizeHeader(h)] = h
        })

        const parseErrorsByRow = new Map<number, string>()
        if (results.errors && results.errors.length > 0) {
          results.errors.forEach((err) => {
            if (typeof err.row === 'number') {
              parseErrorsByRow.set(err.row + 2, err.message)
            }
          })
        }

        const allRows: ParsedVersaoRow[] = []

        data.forEach((row, i) => {
          const lineNum = i + 2
          const parseErr = parseErrorsByRow.get(lineNum)

          const getVal = (candidates: string[]): { value: string; exists: boolean } => {
            const key = findHeaderMatch(headerMap, candidates) as string | undefined
            if (key && row[key] !== undefined && row[key] !== null) {
              const valStr = String(row[key]).trim()
              return { value: valStr, exists: true }
            }
            return { value: '', exists: false }
          }

          const parsedRow = mapRowToParsedVersao(getVal, lineNum, row, parseErr)
          if (
            !parsedRow.nome &&
            !parsedRow.reg &&
            !parsedRow.codErp &&
            !parsedRow.tiposPropostaStr
          ) {
            if (parseErr) {
              allRows.push({
                ...parsedRow,
                parseError: `Linha mal formatada no CSV: ${parseErr}`,
              })
            }
            return
          }

          allRows.push(parsedRow)
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
 * Universal file parser for Versões (CSV, XLSX, XLS)
 */
export async function parseVersoesImportFile(
  file: File,
  targetSheetName?: string,
): Promise<ParsedVersoesSpreadsheetResult> {
  const fileName = file.name.toLowerCase()
  if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
    return parseVersoesXLSXFile(file, targetSheetName)
  }
  if (fileName.endsWith('.csv') || fileName.endsWith('.txt')) {
    return parseVersoesCSVFile(file)
  }
  if (file.type.includes('spreadsheet') || file.type.includes('excel')) {
    return parseVersoesXLSXFile(file, targetSheetName)
  }
  return parseVersoesCSVFile(file)
}

export interface PendenciaVersaoImport {
  lineNumber: number
  identificadorVersao: string
  tipoPropostaItem?: string
  motivo: string
}

export interface VersaoImportReport {
  totalVersoesProcessadas: number
  versoesCriadas: number
  versoesAtualizadas: number
  versoesExistentesIgnoradas: number
  versoesCriadasPorReg: number
  versoesCriadasPorCodErp: number
  versoesCriadasPorNome: number
  versoesAtualizadasPorReg: number
  versoesAtualizadasPorCodErp: number
  versoesAtualizadasPorNome: number
  totalAssociacoesCriadas: number
  totalAssociacoesIgnoradas: number
  versoesComTipoVinculado: number
  pendenciasTipoNaoEncontrado: number
  pendenciasTipoAmbiguo: number
  vinculadosPorColunaModelo: number
  pendenciasModeloNaoEncontrado: number
  pendenciasModeloAmbiguo: number
  pendencias: PendenciaVersaoImport[]
  errosGerais?: string[]
}

export interface ProcessarVersoesImportOptions {
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

interface VersaoDbRecord {
  id: string
  nome: string
  reg?: string | null
  cod_erp?: string | null
  modelo?: string | null
  status?: string | null
  moeda?: string | null
  valor?: number | null
  tem_fator?: boolean | null
  fator_nac?: number | null
  nome_abreviado?: string | null
  desconto_max_representante?: number | null
  desconto_max_bener?: number | null
  tem_estoque?: boolean | null
  estoque_total?: number | null
  estoque_bloqueado?: number | null
  estoque_reservado?: number | null
  estoque_disponivel?: number | null
  acessorios_standards?: string | null
  caracteristicas_construtivas?: string | null
  especificacoes_tecnicas?: string | null
  alerta_estoque_minimo?: number | null
}

interface ModeloDbRecord {
  id: string
  nome: string
  reg?: string | number | null
  cod?: string | null
}

interface TipoPropostaDbRecord {
  id: string
  nome: string
}

/**
 * Main import processor for VERSÕES:
 *
 * Rules:
 * 1. Read existing versoes, modelos, tipos_proposta and versao_tipos_proposta from Supabase.
 * 2. For each row:
 *    - Search existing version first by cod_erp (or cod_e2corp) and fallback by nome (tolerant to accents, case, whitespace).
 *    - If version DOES NOT exist:
 *        * Resolve modelo: if row provides modelo (name or UUID), map to existing modelo; if not found or empty, fallback to first available active modelo or null.
 *        * INSERT into `versoes` with all available file fields (nome, cod_erp, status, nome_abreviado, modelo, moeda, valor, tem_fator, fator_nac, desc_max_rep, desc_max_bener, tem_estoque, estoque_total, estoque_bloqueado, estoque_reservado, estoque_disponivel, acessorios_standards, caracteristicas_construtivas, especificacoes_tecnicas, alerta_estoque_minimo, atualizado_por).
 *        * Increment versoesCriadas.
 *    - If version ALREADY exists:
 *        * UPDATE technical and commercial fields that are present in the file (non-empty) without overwriting existing data with blanks.
 *        * If any field actually changes, update in `versoes` and record in `versoes_historico`.
 *        * Increment versoesAtualizadas (or versoesExistentesIgnoradas if no fields were updated).
 * 3. After ensuring the version exists (either just created or already existing):
 *    - Process `tipo_proposta` column:
 *        * Split by "|", trim each, filter empty.
 *        * Lookup each type by name in `tipos_proposta` (tolerant).
 *        * Create junction link in `versao_tipos_proposta` (versao_id, tipo_proposta_id), avoiding duplicates.
 *        * NEVER create or edit tipos_proposta (unmatched type becomes a pendência with line number).
 * 4. Return complete VersaoImportReport with breakdown of processed, created, updated, ignored, associations, and pendências list.
 */
export async function processarImportacaoVersoes(
  rows: ParsedVersaoRow[],
  options?: ProcessarVersoesImportOptions,
): Promise<VersaoImportReport> {
  const { supabase } = await import('@/lib/supabase/client')

  const report: VersaoImportReport = {
    totalVersoesProcessadas: 0,
    versoesCriadas: 0,
    versoesAtualizadas: 0,
    versoesExistentesIgnoradas: 0,
    versoesCriadasPorReg: 0,
    versoesCriadasPorCodErp: 0,
    versoesCriadasPorNome: 0,
    versoesAtualizadasPorReg: 0,
    versoesAtualizadasPorCodErp: 0,
    versoesAtualizadasPorNome: 0,
    totalAssociacoesCriadas: 0,
    totalAssociacoesIgnoradas: 0,
    versoesComTipoVinculado: 0,
    pendenciasTipoNaoEncontrado: 0,
    pendenciasTipoAmbiguo: 0,
    vinculadosPorColunaModelo: 0,
    pendenciasModeloNaoEncontrado: 0,
    pendenciasModeloAmbiguo: 0,
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
    message: 'Carregando cadastros existentes do banco de dados...',
  })

  // 1. Fetch all existing active versions
  const allVersoesList: VersaoDbRecord[] = []
  const versoesByIdMap = new Map<string, VersaoDbRecord>()
  const versoesByRegMap = new Map<string, VersaoDbRecord>()
  const versoesByCodErpMap = new Map<string, VersaoDbRecord>()
  const versoesByNomeNormMap = new Map<string, VersaoDbRecord>()
  const versoesByNomeKeyMap = new Map<string, VersaoDbRecord>()

  let vPage = 0
  const PAGE_SIZE = 1000
  let hasMoreVersoes = true

  while (hasMoreVersoes) {
    const { data: versoesData, error: vErr } = await supabase
      .from('versoes')
      .select(
        'id, nome, reg, cod_erp, modelo, status, moeda, valor, tem_fator, fator_nac, nome_abreviado, desconto_max_representante, desconto_max_bener, tem_estoque, estoque_total, estoque_bloqueado, estoque_reservado, estoque_disponivel, acessorios_standards, caracteristicas_construtivas, especificacoes_tecnicas, alerta_estoque_minimo, deleted_at',
      )
      .is('deleted_at', null)
      .range(vPage * PAGE_SIZE, (vPage + 1) * PAGE_SIZE - 1)

    if (vErr) {
      throw new Error(`Erro ao consultar versões no banco: ${vErr.message}`)
    }

    if (versoesData && versoesData.length > 0) {
      versoesData.forEach((v) => {
        const record: VersaoDbRecord = {
          id: v.id,
          nome: v.nome || '',
          reg: (v as any).reg || v.cod_erp,
          cod_erp: v.cod_erp,
          modelo: v.modelo,
          status: v.status,
          moeda: v.moeda,
          valor: v.valor !== null ? Number(v.valor) : null,
          tem_fator: v.tem_fator,
          fator_nac: v.fator_nac !== null ? Number(v.fator_nac) : null,
          nome_abreviado: v.nome_abreviado,
          desconto_max_representante:
            v.desconto_max_representante !== null ? Number(v.desconto_max_representante) : null,
          desconto_max_bener: v.desconto_max_bener !== null ? Number(v.desconto_max_bener) : null,
          tem_estoque: v.tem_estoque,
          estoque_total: v.estoque_total !== null ? Number(v.estoque_total) : null,
          estoque_bloqueado: v.estoque_bloqueado !== null ? Number(v.estoque_bloqueado) : null,
          estoque_reservado: v.estoque_reservado !== null ? Number(v.estoque_reservado) : null,
          estoque_disponivel: v.estoque_disponivel !== null ? Number(v.estoque_disponivel) : null,
          acessorios_standards: v.acessorios_standards,
          caracteristicas_construtivas: v.caracteristicas_construtivas,
          especificacoes_tecnicas: v.especificacoes_tecnicas,
          alerta_estoque_minimo:
            v.alerta_estoque_minimo !== null ? Number(v.alerta_estoque_minimo) : null,
        }
        allVersoesList.push(record)
        if (v.id) {
          versoesByIdMap.set(v.id.toLowerCase(), record)
        }
        const effectiveReg = (v as any).reg || v.cod_erp
        if (effectiveReg) {
          const cleanReg = effectiveReg.trim().toLowerCase()
          if (cleanReg && !versoesByRegMap.has(cleanReg)) {
            versoesByRegMap.set(cleanReg, record)
          }
          const keyReg = normalizeKey(effectiveReg)
          if (keyReg && !versoesByRegMap.has(keyReg)) {
            versoesByRegMap.set(keyReg, record)
          }
          // Also strip leading zeros for tolerant matching (e.g. "05" -> "5")
          const regNorm = cleanReg.replace(/^0+/, '') || '0'
          if (!versoesByRegMap.has(regNorm)) {
            versoesByRegMap.set(regNorm, record)
          }
        }
        if (v.cod_erp) {
          const cleanCod = v.cod_erp.trim().toLowerCase()
          if (cleanCod && !versoesByCodErpMap.has(cleanCod)) {
            versoesByCodErpMap.set(cleanCod, record)
          }
          const keyCod = normalizeKey(v.cod_erp)
          if (keyCod && !versoesByCodErpMap.has(keyCod)) {
            versoesByCodErpMap.set(keyCod, record)
          }
          const codNorm = cleanCod.replace(/^0+/, '') || '0'
          if (!versoesByCodErpMap.has(codNorm)) {
            versoesByCodErpMap.set(codNorm, record)
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

  /**
   * Helper to find existing version with multi-tier tolerant matching:
   * a. Código ERP (if provided in row)
   * b. Exact normalized name (normalizeStringMatch)
   * c. Alphanumeric key (normalizeKey)
   * d. Prefix match (file name starts with DB name or DB name starts with file name)
   * e. Contains match (file name contains DB name or DB name contains file name)
   *
   * IMPORTANT: Always ensures a single unambiguous match. If multiple candidates tie at
   * prefix or contains tier, returns undefined (treated as pendência due to ambiguity).
   */
  const findExistingVersao = (
    reg?: string,
    codErp?: string,
    nome?: string,
  ): { record: VersaoDbRecord; matchedBy: 'reg' | 'cod_erp' | 'nome' } | undefined => {
    // 1. Match by REG (tolerant to leading zeros: "05" vs "5")
    if (reg) {
      const cleanReg = reg.trim().toLowerCase()
      const strippedReg = cleanReg.replace(/^0+/, '') || '0'
      const v =
        versoesByRegMap.get(cleanReg) ||
        versoesByRegMap.get(strippedReg) ||
        versoesByRegMap.get(normalizeKey(reg)) ||
        versoesByCodErpMap.get(cleanReg) ||
        versoesByCodErpMap.get(strippedReg)
      if (v) return { record: v, matchedBy: 'reg' }
    }

    // 2. Match by COD_ERP / COD_E2CORP
    if (codErp) {
      const clean = codErp.trim().toLowerCase()
      const stripped = clean.replace(/^0+/, '') || '0'
      const v =
        versoesByCodErpMap.get(clean) ||
        versoesByCodErpMap.get(stripped) ||
        versoesByCodErpMap.get(normalizeKey(codErp)) ||
        versoesByRegMap.get(clean) ||
        versoesByRegMap.get(stripped)
      if (v) return { record: v, matchedBy: 'cod_erp' }
    }

    // 2. Fallback match by Name
    if (nome) {
      const norm = normalizeStringMatch(nome)
      if (norm) {
        const exact = versoesByNomeNormMap.get(norm)
        if (exact) return { record: exact, matchedBy: 'nome' }
      }

      const queryKey = normalizeKey(nome)
      if (queryKey) {
        const keyed = versoesByNomeKeyMap.get(queryKey)
        if (keyed) return { record: keyed, matchedBy: 'nome' }

        // d. Prefix match (min length 10 to avoid false positives)
        const MIN_PREFIX_LEN = 10
        const prefixCandidates: { record: VersaoDbRecord; diff: number }[] = []

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
          // Single unambiguous best match
          if (bestCandidates.length === 1) {
            return { record: bestCandidates[0].record, matchedBy: 'nome' }
          }
          // If ambiguous among different versions, do not pick arbitrarily
          const uniqueIds = new Set(bestCandidates.map((c) => c.record.id))
          if (uniqueIds.size === 1) {
            return { record: bestCandidates[0].record, matchedBy: 'nome' }
          }
        }

        // e. Contains match (min length 10)
        const MIN_CONTAINS_LEN = 10
        const containsCandidates: { record: VersaoDbRecord; diff: number }[] = []

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
            return { record: bestCandidates[0].record, matchedBy: 'nome' }
          }
          const uniqueIds = new Set(bestCandidates.map((c) => c.record.id))
          if (uniqueIds.size === 1) {
            return { record: bestCandidates[0].record, matchedBy: 'nome' }
          }
        }
      }
    }

    return undefined
  }

  // Register newly created/updated version into lookup maps and list
  const registerVersaoInMaps = (record: VersaoDbRecord) => {
    allVersoesList.push(record)
    versoesByIdMap.set(record.id.toLowerCase(), record)
    const effectiveReg = record.reg || record.cod_erp
    if (effectiveReg) {
      const cleanReg = effectiveReg.trim().toLowerCase()
      versoesByRegMap.set(cleanReg, record)
      versoesByRegMap.set(normalizeKey(effectiveReg), record)
      const regNorm = cleanReg.replace(/^0+/, '') || '0'
      versoesByRegMap.set(regNorm, record)
    }
    if (record.cod_erp) {
      const cleanCod = record.cod_erp.trim().toLowerCase()
      versoesByCodErpMap.set(cleanCod, record)
      versoesByCodErpMap.set(normalizeKey(record.cod_erp), record)
      const codNorm = cleanCod.replace(/^0+/, '') || '0'
      versoesByCodErpMap.set(codNorm, record)
    }
    if (record.nome) {
      const norm = normalizeStringMatch(record.nome)
      const key = normalizeKey(record.nome)
      if (norm) versoesByNomeNormMap.set(norm, record)
      if (key) versoesByNomeKeyMap.set(key, record)
    }
  }

  // 2. Fetch all existing active modelos for FK matching
  const allModelosList: ModeloDbRecord[] = []
  const modelosByIdMap = new Map<string, ModeloDbRecord>()
  const modelosByRegMap = new Map<string, ModeloDbRecord>()
  const modelosByCodMap = new Map<string, ModeloDbRecord>()

  const { data: modelosData, error: mErr } = await supabase
    .from('modelos')
    .select('id, nome, reg, cod, deleted_at')
    .is('deleted_at', null)

  if (mErr) {
    throw new Error(`Erro ao consultar modelos no banco: ${mErr.message}`)
  }

  if (modelosData && modelosData.length > 0) {
    modelosData.forEach((m) => {
      const record: ModeloDbRecord = {
        id: m.id,
        nome: m.nome,
        reg: (m as any).reg,
        cod: (m as any).cod,
      }
      allModelosList.push(record)
      if (m.id) {
        modelosByIdMap.set(m.id.toLowerCase(), record)
      }
      if ((m as any).reg !== undefined && (m as any).reg !== null) {
        const rawReg = String((m as any).reg)
          .trim()
          .toLowerCase()
        const normReg = rawReg.replace(/^0+/, '') || '0'
        modelosByRegMap.set(rawReg, record)
        modelosByRegMap.set(normReg, record)
      }
      if ((m as any).cod) {
        const rawCod = String((m as any).cod)
          .trim()
          .toLowerCase()
        const normCod = rawCod.replace(/^0+/, '') || '0'
        modelosByCodMap.set(rawCod, record)
        modelosByCodMap.set(normCod, record)
      }
    })
  }

  /**
   * Resolves modelo with tolerant matching (no accents, case-insensitive, trim).
   * Conservative rules:
   * 1. If UUID -> match by ID.
   * 2. Exact match by normalized string (trim, lowercase, accents removed, collapsed whitespace).
   * 3. Alphanumeric key match (all punctuation removed).
   * 4. Multi-candidate detection:
   *    - If exactly one candidate: status 'found'
   *    - If multiple tied candidates: status 'ambiguous' (DO NOT link, report candidate names)
   *    - If none: status 'not_found' (DO NOT create)
   */
  type ResolveModeloResult =
    | { status: 'none' }
    | { status: 'found'; modelo: ModeloDbRecord }
    | { status: 'not_found'; query: string }
    | { status: 'ambiguous'; query: string; candidates: ModeloDbRecord[] }

  const resolveModelo = (query?: string | null): ResolveModeloResult => {
    if (!query || !query.trim()) {
      return { status: 'none' }
    }

    const trimmed = query.trim()

    // 1. Direct UUID
    if (isValidUUID(trimmed)) {
      const byId = modelosByIdMap.get(trimmed.toLowerCase())
      if (byId) return { status: 'found', modelo: byId }
    }

    // 2. Match por REG (ex.: "12", "012", 12)
    const normNum = trimmed.toLowerCase().replace(/^0+/, '') || '0'
    const byReg = modelosByRegMap.get(trimmed.toLowerCase()) || modelosByRegMap.get(normNum)
    if (byReg) {
      return { status: 'found', modelo: byReg }
    }

    // 3. Match por COD
    const byCod = modelosByCodMap.get(trimmed.toLowerCase()) || modelosByCodMap.get(normNum)
    if (byCod) {
      return { status: 'found', modelo: byCod }
    }

    // 4. Exact normalized match por NOME
    const norm = normalizeStringMatch(trimmed)
    if (norm) {
      const exactMatches = allModelosList.filter((m) => normalizeStringMatch(m.nome) === norm)
      if (exactMatches.length === 1) {
        return { status: 'found', modelo: exactMatches[0] }
      }
      if (exactMatches.length > 1) {
        return { status: 'ambiguous', query: trimmed, candidates: exactMatches }
      }
    }

    // 5. Alphanumeric key match
    const queryKey = normalizeKey(trimmed)
    if (queryKey && queryKey.length >= 2) {
      const keyMatches = allModelosList.filter((m) => normalizeKey(m.nome) === queryKey)
      if (keyMatches.length === 1) {
        return { status: 'found', modelo: keyMatches[0] }
      }
      if (keyMatches.length > 1) {
        return { status: 'ambiguous', query: trimmed, candidates: keyMatches }
      }

      // Prefix match como fallback seguro
      const prefixMatches = allModelosList.filter((m) => {
        const mKey = normalizeKey(m.nome)
        return mKey.startsWith(queryKey) || queryKey.startsWith(mKey)
      })
      if (prefixMatches.length === 1) {
        return { status: 'found', modelo: prefixMatches[0] }
      }
    }

    return { status: 'not_found', query: trimmed }
  }

  // 3. Fetch all existing tipos_proposta (NUNCA criar novos tipos)
  const allTiposPropostaList: TipoPropostaDbRecord[] = []
  const tiposNormMap = new Map<string, TipoPropostaDbRecord>()
  const tiposKeyMap = new Map<string, TipoPropostaDbRecord>()
  let tPage = 0
  let hasMoreTipos = true

  while (hasMoreTipos) {
    const { data: tiposData, error: tErr } = await supabase
      .from('tipos_proposta')
      .select('id, nome')
      .range(tPage * PAGE_SIZE, (tPage + 1) * PAGE_SIZE - 1)

    if (tErr) {
      throw new Error(`Erro ao consultar tipos de proposta: ${tErr.message}`)
    }

    if (tiposData && tiposData.length > 0) {
      tiposData.forEach((t) => {
        if (t.nome) {
          const record: TipoPropostaDbRecord = { id: t.id, nome: t.nome }
          allTiposPropostaList.push(record)

          const norm = normalizeStringMatch(t.nome)
          const key = normalizeKey(t.nome)
          if (norm && !tiposNormMap.has(norm)) tiposNormMap.set(norm, record)
          if (key && !tiposKeyMap.has(key)) tiposKeyMap.set(key, record)
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

  type ResolveTipoPropostaResult =
    | { status: 'found'; tipo: TipoPropostaDbRecord }
    | { status: 'not_found'; query: string }
    | { status: 'ambiguous'; query: string; candidates: TipoPropostaDbRecord[] }

  const resolveTipoProposta = (name: string): ResolveTipoPropostaResult => {
    if (!name || !name.trim()) {
      return { status: 'not_found', query: '' }
    }

    const trimmed = name.trim()

    // 1. Direct UUID
    if (isValidUUID(trimmed)) {
      const byId = allTiposPropostaList.find((t) => t.id.toLowerCase() === trimmed.toLowerCase())
      if (byId) return { status: 'found', tipo: byId }
    }

    // 2. Exact match normalized (lowercase, accents removed, multiple spaces collapsed)
    const norm = normalizeStringMatch(trimmed)
    if (norm) {
      const exactMatches = allTiposPropostaList.filter((t) => normalizeStringMatch(t.nome) === norm)
      if (exactMatches.length === 1) {
        return { status: 'found', tipo: exactMatches[0] }
      }
      if (exactMatches.length > 1) {
        return { status: 'ambiguous', query: trimmed, candidates: exactMatches }
      }
    }

    // 3. Alphanumeric key match (stripping punctuation/symbols)
    const queryKey = normalizeKey(trimmed)
    if (queryKey && queryKey.length >= 2) {
      const keyMatches = allTiposPropostaList.filter((t) => normalizeKey(t.nome) === queryKey)
      if (keyMatches.length === 1) {
        return { status: 'found', tipo: keyMatches[0] }
      }
      if (keyMatches.length > 1) {
        return { status: 'ambiguous', query: trimmed, candidates: keyMatches }
      }
    }

    return { status: 'not_found', query: trimmed }
  }

  // 4. Fetch existing associations from versao_tipos_proposta
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

  // 5. Process all rows
  options?.onProgress?.({
    stage: 'processando',
    current: 0,
    total: rows.length,
    percentage: 20,
    message: 'Processando versões e identificando atualizações/criações...',
  })

  const newAssociationsToInsert: { versao_id: string; tipo_proposta_id: string }[] = []
  const stagedAssocSet = new Set<string>()
  const userName = options?.userName || 'Importação de Versões'

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]

    if (row.parseError && !row.nome && !row.reg && !row.codErp) {
      report.pendencias.push({
        lineNumber: row.lineNumber,
        identificadorVersao: '(Linha mal formatada)',
        motivo: row.parseError,
      })
      continue
    }

    const nomeVersao = (row.nome || '').trim()
    const regValue = (row.reg || '').trim()
    const codErp = (row.codErp || '').trim()
    const identifier = nomeVersao || regValue || codErp

    if (!identifier) {
      report.pendencias.push({
        lineNumber: row.lineNumber,
        identificadorVersao: '(Linha sem identificação)',
        motivo: 'A linha não possui nome, REG nem código ERP da versão.',
      })
      continue
    }

    report.totalVersoesProcessadas++

    // Check if version exists in database (or was just created earlier in this run)
    const matchResult = findExistingVersao(regValue, codErp, nomeVersao)
    let versaoRecord = matchResult?.record
    const has = row.hasField

    // Detect if this is a "cross-reference only" row (arquivo só de cruzamento):
    // Line has NO technical or commercial fields present (all hasField flags false except nome and tiposProposta)
    const isCruzamentoOnlyRow =
      !has?.reg &&
      !has?.codErp &&
      !has?.modelo &&
      !has?.status &&
      !has?.nomeAbreviado &&
      !has?.moeda &&
      !has?.valor &&
      !has?.temFator &&
      !has?.fatorNac &&
      !has?.descMaxRep &&
      !has?.descMaxBener &&
      !has?.temEstoque &&
      !has?.estoqueTotal &&
      !has?.estoqueBloqueado &&
      !has?.estoqueReservado &&
      !has?.estoqueDisponivel &&
      !has?.acessoriosStandards &&
      !has?.caracteristicasConstrutivas &&
      !has?.especificacoesTecnicas &&
      !has?.alertaEstoqueMinimo

    // Resolve modelo from column (if present in row)
    const modeloRes = resolveModelo(row.modeloNomeOuId)
    let resolvedModeloId: string | null = null

    if (row.hasField?.modelo && row.modeloNomeOuId) {
      if (modeloRes.status === 'found') {
        resolvedModeloId = modeloRes.modelo.id
      } else if (modeloRes.status === 'ambiguous') {
        report.pendenciasModeloAmbiguo++
        const candNames = modeloRes.candidates.map((c) => `"${c.nome}"`).join(', ')
        report.pendencias.push({
          lineNumber: row.lineNumber,
          identificadorVersao: identifier,
          motivo: `Mais de um modelo candidato: ${candNames}`,
        })
      } else if (modeloRes.status === 'not_found') {
        report.pendenciasModeloNaoEncontrado++
        report.pendencias.push({
          lineNumber: row.lineNumber,
          identificadorVersao: identifier,
          motivo: `Modelo não encontrado: ${modeloRes.query}`,
        })
      }
    }

    if (!versaoRecord) {
      if (isCruzamentoOnlyRow) {
        // In crossing-only mode, DO NOT create a dummy version with default zeros.
        // Register as a pendência instead.
        report.pendencias.push({
          lineNumber: row.lineNumber,
          identificadorVersao: identifier,
          motivo: `Versão "${identifier}" não encontrada no cadastro para vincular ao(s) tipo(s) de proposta`,
        })
        continue
      }

      // Create new version in `versoes` (only when technical/commercial fields are present)
      const insertPayload = {
        nome: nomeVersao || `Versão ${regValue || codErp}`,
        reg: regValue || codErp || null,
        cod_erp: codErp || regValue || null,
        status: row.status || 'Ativo',
        nome_abreviado: row.nomeAbreviado || null,
        modelo: resolvedModeloId,
        moeda: row.moeda || 'BRL',
        valor: row.valor || 0,
        tem_fator: row.temFator ?? false,
        fator_nac: row.fatorNac || 1,
        desconto_max_representante: row.descMaxRep || 0,
        desconto_max_bener: row.descMaxBener || 0,
        tem_estoque: row.temEstoque ?? false,
        estoque_total: row.estoqueTotal || 0,
        estoque_bloqueado: row.estoqueBloqueado || 0,
        estoque_reservado: row.estoqueReservado || 0,
        estoque_disponivel: row.estoqueDisponivel || 0,
        acessorios_standards: row.acessoriosStandards || null,
        caracteristicas_construtivas: row.caracteristicasConstrutivas || null,
        especificacoes_tecnicas: row.especificacoesTecnicas || null,
        alerta_estoque_minimo: row.alertaEstoqueMinimo ?? null,
        tipos_proposta: [],
        atualizado_por: userName,
      }

      const { data: insertedVersao, error: insErr } = await supabase
        .from('versoes')
        .insert(insertPayload as any)
        .select(
          'id, nome, reg, cod_erp, modelo, status, moeda, valor, tem_fator, fator_nac, nome_abreviado, desconto_max_representante, desconto_max_bener, tem_estoque, estoque_total, estoque_bloqueado, estoque_reservado, estoque_disponivel, acessorios_standards, caracteristicas_construtivas, especificacoes_tecnicas, alerta_estoque_minimo',
        )
        .single()

      if (insErr || !insertedVersao) {
        report.pendencias.push({
          lineNumber: row.lineNumber,
          identificadorVersao: identifier,
          motivo: `Erro ao criar versão no banco de dados: ${insErr?.message || 'Falha desconhecida'}`,
        })
        continue
      }

      versaoRecord = {
        id: insertedVersao.id,
        nome: insertedVersao.nome,
        reg: (insertedVersao as any).reg || insertedVersao.cod_erp,
        cod_erp: insertedVersao.cod_erp,
        modelo: insertedVersao.modelo,
        status: insertedVersao.status,
        moeda: insertedVersao.moeda,
        valor: insertedVersao.valor !== null ? Number(insertedVersao.valor) : null,
        tem_fator: insertedVersao.tem_fator,
        fator_nac: insertedVersao.fator_nac !== null ? Number(insertedVersao.fator_nac) : null,
        nome_abreviado: insertedVersao.nome_abreviado,
        desconto_max_representante:
          insertedVersao.desconto_max_representante !== null
            ? Number(insertedVersao.desconto_max_representante)
            : null,
        desconto_max_bener:
          insertedVersao.desconto_max_bener !== null
            ? Number(insertedVersao.desconto_max_bener)
            : null,
        tem_estoque: insertedVersao.tem_estoque,
        estoque_total:
          insertedVersao.estoque_total !== null ? Number(insertedVersao.estoque_total) : null,
        estoque_bloqueado:
          insertedVersao.estoque_bloqueado !== null
            ? Number(insertedVersao.estoque_bloqueado)
            : null,
        estoque_reservado:
          insertedVersao.estoque_reservado !== null
            ? Number(insertedVersao.estoque_reservado)
            : null,
        estoque_disponivel:
          insertedVersao.estoque_disponivel !== null
            ? Number(insertedVersao.estoque_disponivel)
            : null,
        acessorios_standards: insertedVersao.acessorios_standards,
        caracteristicas_construtivas: insertedVersao.caracteristicas_construtivas,
        especificacoes_tecnicas: insertedVersao.especificacoes_tecnicas,
        alerta_estoque_minimo:
          insertedVersao.alerta_estoque_minimo !== null
            ? Number(insertedVersao.alerta_estoque_minimo)
            : null,
      }
      registerVersaoInMaps(versaoRecord)
      report.versoesCriadas++

      if (resolvedModeloId) {
        report.vinculadosPorColunaModelo++
      }

      if (regValue) {
        report.versoesCriadasPorReg++
        report.versoesCriadasPorCodErp++
      } else if (codErp) {
        report.versoesCriadasPorCodErp++
      } else {
        report.versoesCriadasPorNome++
      }

      // Log in historico table
      try {
        await supabase.from('versoes_historico').insert({
          versao_id: versaoRecord.id,
          usuario: userName,
          acao: 'Criação por Importação',
          detalhes: `Versão criada via importação em lote de arquivo (${fileIdentificationDetails(row)})`,
        })
      } catch (histErr) {
        console.warn('Erro ao gravar histórico da versão:', histErr)
      }
    } else {
      // Existing version: UPDATE technical and commercial fields from file (do NOT overwrite with blanks)
      const updatePayload: Database['public']['Tables']['versoes']['Update'] & {
        reg?: string | null
      } = {}
      const changedFields: string[] = []

      // 1. Nome (if row has nome and it differs)
      if (has?.nome && nomeVersao && nomeVersao !== versaoRecord.nome) {
        updatePayload.nome = nomeVersao
        changedFields.push(`Nome: "${versaoRecord.nome}" ➔ "${nomeVersao}"`)
      }

      // 2. REG / Cód. ERP (if row has reg or codErp and it differs)
      if (has?.reg && regValue && regValue !== (versaoRecord.reg || '')) {
        updatePayload.reg = regValue
        // Also update cod_erp if cod_erp is empty or was using old value
        if (
          !updatePayload.cod_erp &&
          (!versaoRecord.cod_erp || versaoRecord.cod_erp === versaoRecord.reg)
        ) {
          updatePayload.cod_erp = regValue
        }
        changedFields.push(`REG: "${versaoRecord.reg || '—'}" ➔ "${regValue}"`)
      }

      if (has?.codErp && codErp && codErp !== (versaoRecord.cod_erp || '')) {
        updatePayload.cod_erp = codErp
        if (!updatePayload.reg && !versaoRecord.reg) {
          updatePayload.reg = codErp
        }
        changedFields.push(`Cód. ERP: "${versaoRecord.cod_erp || '—'}" ➔ "${codErp}"`)
      }

      // 3. Nome abreviado
      if (
        has?.nomeAbreviado &&
        row.nomeAbreviado &&
        row.nomeAbreviado !== (versaoRecord.nome_abreviado || '')
      ) {
        updatePayload.nome_abreviado = row.nomeAbreviado
        changedFields.push(
          `Nome abreviado: "${versaoRecord.nome_abreviado || '—'}" ➔ "${row.nomeAbreviado}"`,
        )
      }

      // 4. Modelo (atualização não-destrutiva: se preenchido e resolvido, atualiza; se vazio, preserva existente)
      if (has?.modelo && row.modeloNomeOuId && resolvedModeloId) {
        if (resolvedModeloId !== versaoRecord.modelo) {
          updatePayload.modelo = resolvedModeloId
          changedFields.push('Modelo atualizado')
        }
        report.vinculadosPorColunaModelo++
      } else if (has?.modelo && !row.modeloNomeOuId && versaoRecord.modelo) {
        // Célula vazia no arquivo mas versão já tinha modelo: preserva o vínculo existente
      }

      // 5. Status
      if (has?.status && row.status && row.status !== versaoRecord.status) {
        updatePayload.status = row.status
        changedFields.push(`Status: "${versaoRecord.status}" ➔ "${row.status}"`)
      }

      // 6. Moeda
      if (has?.moeda && row.moeda && row.moeda !== versaoRecord.moeda) {
        updatePayload.moeda = row.moeda
        changedFields.push(`Moeda: "${versaoRecord.moeda}" ➔ "${row.moeda}"`)
      }

      // 7. Valor (price)
      if (has?.valor && row.valor !== undefined && row.valor !== versaoRecord.valor) {
        updatePayload.valor = row.valor
        if (versaoRecord.valor !== null && versaoRecord.valor !== undefined) {
          updatePayload.valor_anterior = versaoRecord.valor
        }
        updatePayload.data_ultimo_reajuste = new Date().toISOString()
        changedFields.push(`Valor: ${versaoRecord.valor ?? 0} ➔ ${row.valor}`)
      }

      // 8. Fator de Nacionalização
      if (has?.temFator && row.temFator !== undefined && row.temFator !== versaoRecord.tem_fator) {
        updatePayload.tem_fator = row.temFator
        changedFields.push(`Tem fator: ${row.temFator ? 'Sim' : 'Não'}`)
      }
      if (
        has?.fatorNac &&
        row.fatorNac !== undefined &&
        Math.abs(Number(row.fatorNac) - Number(versaoRecord.fator_nac ?? 1)) > 0.00001
      ) {
        updatePayload.fator_nac = row.fatorNac
        changedFields.push(`Fator nac.: ${versaoRecord.fator_nac} ➔ ${row.fatorNac}`)
      }

      // 9. Descontos máximos
      if (
        has?.descMaxRep &&
        row.descMaxRep !== undefined &&
        row.descMaxRep !== versaoRecord.desconto_max_representante
      ) {
        updatePayload.desconto_max_representante = row.descMaxRep
        changedFields.push(
          `Desc. máx. representante: ${versaoRecord.desconto_max_representante ?? 0}% ➔ ${row.descMaxRep}%`,
        )
      }
      if (
        has?.descMaxBener &&
        row.descMaxBener !== undefined &&
        row.descMaxBener !== versaoRecord.desconto_max_bener
      ) {
        updatePayload.desconto_max_bener = row.descMaxBener
        changedFields.push(
          `Desc. máx. Bener: ${versaoRecord.desconto_max_bener ?? 0}% ➔ ${row.descMaxBener}%`,
        )
      }

      // 10. Estoque
      if (
        has?.temEstoque &&
        row.temEstoque !== undefined &&
        row.temEstoque !== versaoRecord.tem_estoque
      ) {
        updatePayload.tem_estoque = row.temEstoque
        changedFields.push(`Controla estoque: ${row.temEstoque ? 'Sim' : 'Não'}`)
      }

      const fileHasAnyEstoque =
        has?.estoqueTotal ||
        has?.estoqueBloqueado ||
        has?.estoqueReservado ||
        has?.estoqueDisponivel

      if (fileHasAnyEstoque) {
        const currentTotal = versaoRecord.estoque_total ?? 0
        const currentBloq = versaoRecord.estoque_bloqueado ?? 0
        const currentRes = versaoRecord.estoque_reservado ?? 0

        const newTotal = has?.estoqueTotal ? (row.estoqueTotal ?? 0) : currentTotal
        const newBloq = has?.estoqueBloqueado ? (row.estoqueBloqueado ?? 0) : currentBloq
        const newRes = has?.estoqueReservado ? (row.estoqueReservado ?? 0) : currentRes
        const newDisp = has?.estoqueDisponivel
          ? (row.estoqueDisponivel ?? Math.max(0, newTotal - newBloq - newRes))
          : Math.max(0, newTotal - newBloq - newRes)

        if (has?.estoqueTotal && newTotal !== versaoRecord.estoque_total) {
          updatePayload.estoque_total = newTotal
          changedFields.push(`Estoque total: ${versaoRecord.estoque_total ?? 0} ➔ ${newTotal}`)
        }
        if (has?.estoqueBloqueado && newBloq !== versaoRecord.estoque_bloqueado) {
          updatePayload.estoque_bloqueado = newBloq
          changedFields.push(`Estoque bloq.: ${versaoRecord.estoque_bloqueado ?? 0} ➔ ${newBloq}`)
        }
        if (has?.estoqueReservado && newRes !== versaoRecord.estoque_reservado) {
          updatePayload.estoque_reservado = newRes
          changedFields.push(`Estoque res.: ${versaoRecord.estoque_reservado ?? 0} ➔ ${newRes}`)
        }
        if (newDisp !== versaoRecord.estoque_disponivel) {
          updatePayload.estoque_disponivel = newDisp
        }
      }

      // 11. Textos técnicos (acessorios_standards, caracteristicas_construtivas, especificacoes_tecnicas)
      if (
        has?.acessoriosStandards &&
        row.acessoriosStandards &&
        row.acessoriosStandards !== (versaoRecord.acessorios_standards || '')
      ) {
        updatePayload.acessorios_standards = row.acessoriosStandards
        changedFields.push('Acessórios standards atualizados')
      }
      if (
        has?.caracteristicasConstrutivas &&
        row.caracteristicasConstrutivas &&
        row.caracteristicasConstrutivas !== (versaoRecord.caracteristicas_construtivas || '')
      ) {
        updatePayload.caracteristicas_construtivas = row.caracteristicasConstrutivas
        changedFields.push('Características construtivas atualizadas')
      }
      if (
        has?.especificacoesTecnicas &&
        row.especificacoesTecnicas &&
        row.especificacoesTecnicas !== (versaoRecord.especificacoes_tecnicas || '')
      ) {
        updatePayload.especificacoes_tecnicas = row.especificacoesTecnicas
        changedFields.push('Especificações técnicas atualizadas')
      }

      // 12. Alerta estoque mínimo
      if (
        has?.alertaEstoqueMinimo &&
        row.alertaEstoqueMinimo !== undefined &&
        row.alertaEstoqueMinimo !== versaoRecord.alerta_estoque_minimo
      ) {
        updatePayload.alerta_estoque_minimo = row.alertaEstoqueMinimo
        changedFields.push(
          `Alerta estoque mín.: ${versaoRecord.alerta_estoque_minimo ?? '—'} ➔ ${row.alertaEstoqueMinimo}`,
        )
      }

      // If there are changes to update
      if (Object.keys(updatePayload).length > 0) {
        updatePayload.atualizado_por = userName

        const { data: updatedVersao, error: updErr } = await supabase
          .from('versoes')
          .update(updatePayload as any)
          .eq('id', versaoRecord.id)
          .select(
            'id, nome, reg, cod_erp, modelo, status, moeda, valor, tem_fator, fator_nac, nome_abreviado, desconto_max_representante, desconto_max_bener, tem_estoque, estoque_total, estoque_bloqueado, estoque_reservado, estoque_disponivel, acessorios_standards, caracteristicas_construtivas, especificacoes_tecnicas, alerta_estoque_minimo',
          )
          .single()

        if (updErr || !updatedVersao) {
          report.pendencias.push({
            lineNumber: row.lineNumber,
            identificadorVersao: identifier,
            motivo: `Erro ao atualizar versão existente no banco: ${updErr?.message || 'Falha desconhecida'}`,
          })
          continue
        }

        versaoRecord = {
          id: updatedVersao.id,
          nome: updatedVersao.nome,
          reg: (updatedVersao as any).reg || updatedVersao.cod_erp,
          cod_erp: updatedVersao.cod_erp,
          modelo: updatedVersao.modelo,
          status: updatedVersao.status,
          moeda: updatedVersao.moeda,
          valor: updatedVersao.valor !== null ? Number(updatedVersao.valor) : null,
          tem_fator: updatedVersao.tem_fator,
          fator_nac: updatedVersao.fator_nac !== null ? Number(updatedVersao.fator_nac) : null,
          nome_abreviado: updatedVersao.nome_abreviado,
          desconto_max_representante:
            updatedVersao.desconto_max_representante !== null
              ? Number(updatedVersao.desconto_max_representante)
              : null,
          desconto_max_bener:
            updatedVersao.desconto_max_bener !== null
              ? Number(updatedVersao.desconto_max_bener)
              : null,
          tem_estoque: updatedVersao.tem_estoque,
          estoque_total:
            updatedVersao.estoque_total !== null ? Number(updatedVersao.estoque_total) : null,
          estoque_bloqueado:
            updatedVersao.estoque_bloqueado !== null
              ? Number(updatedVersao.estoque_bloqueado)
              : null,
          estoque_reservado:
            updatedVersao.estoque_reservado !== null
              ? Number(updatedVersao.estoque_reservado)
              : null,
          estoque_disponivel:
            updatedVersao.estoque_disponivel !== null
              ? Number(updatedVersao.estoque_disponivel)
              : null,
          acessorios_standards: updatedVersao.acessorios_standards,
          caracteristicas_construtivas: updatedVersao.caracteristicas_construtivas,
          especificacoes_tecnicas: updatedVersao.especificacoes_tecnicas,
          alerta_estoque_minimo:
            updatedVersao.alerta_estoque_minimo !== null
              ? Number(updatedVersao.alerta_estoque_minimo)
              : null,
        }
        registerVersaoInMaps(versaoRecord)
        report.versoesAtualizadas++

        if (matchResult.matchedBy === 'reg') {
          report.versoesAtualizadasPorReg++
          report.versoesAtualizadasPorCodErp++
        } else if (matchResult.matchedBy === 'cod_erp') {
          report.versoesAtualizadasPorCodErp++
        } else {
          report.versoesAtualizadasPorNome++
        }

        // Log update in historico
        try {
          await supabase.from('versoes_historico').insert({
            versao_id: versaoRecord.id,
            usuario: userName,
            acao: 'Atualização por Importação',
            detalhes: `Campos técnicos/comerciais atualizados via importação em lote: ${changedFields.join('; ')}`,
          })
        } catch (histErr) {
          console.warn('Erro ao gravar histórico da versão:', histErr)
        }
      } else {
        // No fields needed update
        report.versoesExistentesIgnoradas++
      }
    }

    // Now process `tipo_proposta` links
    const tipos = row.tiposPropostaList
    if (tipos.length > 0) {
      let versaoHasAtLeastOneLinkedTipo = false

      for (const tipoRaw of tipos) {
        const tipoClean = tipoRaw.trim()
        if (!tipoClean) continue

        const resTipo = resolveTipoProposta(tipoClean)

        if (resTipo.status === 'not_found') {
          report.pendenciasTipoNaoEncontrado++
          report.pendencias.push({
            lineNumber: row.lineNumber,
            identificadorVersao: `${versaoRecord.nome}${versaoRecord.cod_erp ? ` (ERP: ${versaoRecord.cod_erp})` : ''}`,
            tipoPropostaItem: tipoClean,
            motivo: `Tipo de proposta não encontrado no sistema: "${tipoClean}" (nenhum tipo novo foi criado)`,
          })
          continue
        }

        if (resTipo.status === 'ambiguous') {
          report.pendenciasTipoAmbiguo++
          const candNames = resTipo.candidates.map((c) => `"${c.nome}"`).join(', ')
          report.pendencias.push({
            lineNumber: row.lineNumber,
            identificadorVersao: `${versaoRecord.nome}${versaoRecord.cod_erp ? ` (ERP: ${versaoRecord.cod_erp})` : ''}`,
            tipoPropostaItem: tipoClean,
            motivo: `Mais de um tipo de proposta candidato para "${tipoClean}": ${candNames}`,
          })
          continue
        }

        const foundTipo = resTipo.tipo
        versaoHasAtLeastOneLinkedTipo = true
        const assocKey = `${versaoRecord.id}:${foundTipo.id}`

        if (existingAssocSet.has(assocKey) || stagedAssocSet.has(assocKey)) {
          report.totalAssociacoesIgnoradas++
        } else {
          stagedAssocSet.add(assocKey)
          newAssociationsToInsert.push({
            versao_id: versaoRecord.id,
            tipo_proposta_id: foundTipo.id,
          })
        }
      }

      if (versaoHasAtLeastOneLinkedTipo) {
        report.versoesComTipoVinculado++
      }
    }

    if (i % 20 === 0 || i === rows.length - 1) {
      const pct = 20 + Math.round((i / rows.length) * 55)
      options?.onProgress?.({
        stage: 'processando',
        current: i + 1,
        total: rows.length,
        percentage: pct,
        message: `Processando linha ${i + 1} de ${rows.length}: "${versaoRecord.nome}"...`,
      })
    }
  }

  // 6. Insert new associations in batches into versao_tipos_proposta
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
          `Erro ao salvar lote de vínculos de tipos de proposta (${b + 1}/${totalBatches}): ${insertErr.message}`,
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
        message: `Gravando vínculos de tipos de proposta: lote ${b + 1} de ${totalBatches}...`,
      })
    }
  }

  options?.onProgress?.({
    stage: 'concluido',
    current: rows.length,
    total: rows.length,
    percentage: 100,
    message: 'Importação e atualização de versões concluída com sucesso!',
  })

  return report
}

function fileIdentificationDetails(row: ParsedVersaoRow): string {
  const parts: string[] = []
  if (row.reg) parts.push(`REG: ${row.reg}`)
  if (row.codErp && row.codErp !== row.reg) parts.push(`Cód ERP: ${row.codErp}`)
  if (row.moeda) parts.push(`Moeda: ${row.moeda}`)
  if (row.valor) parts.push(`Valor: ${row.valor}`)
  return parts.join(', ') || 'dados padrão'
}
