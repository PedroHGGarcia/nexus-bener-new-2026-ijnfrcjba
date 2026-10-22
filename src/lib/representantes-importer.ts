import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import { supabase } from '@/lib/supabase/client'

async function loadSheetJS(): Promise<any> {
  return XLSX
}

export interface ParsedRepresentanteRow {
  lineNumber: number
  reg?: number | null
  cod?: string | null
  cpf_cnpj?: string | null
  razao_social?: string | null
  nome_fantasia?: string | null
  email?: string | null
  telefone?: string | null
  celular?: string | null
  cidade?: string | null
  uf?: string | null
  bairro?: string | null
  endereco?: string | null
  statusRaw?: string | null
  statusResolved: 'Ativo' | 'Inativo'
  statusWarning?: string | null
  categoriasRaw?: string | null
  regioesRaw?: string | null
  parseError?: string
  raw?: Record<string, unknown> | unknown[]
  hasField: {
    reg: boolean
    cod: boolean
    cpf_cnpj: boolean
    razao_social: boolean
    nome_fantasia: boolean
    email: boolean
    telefone: boolean
    celular: boolean
    cidade: boolean
    uf: boolean
    bairro: boolean
    endereco: boolean
    status: boolean
    categorias: boolean
    regioes: boolean
  }
}

export interface ParsedRepresentantesSpreadsheetResult {
  sheetName?: string
  totalRows: number
  previewRows: ParsedRepresentanteRow[]
  allRows: ParsedRepresentanteRow[]
  availableSheets?: string[]
}

export interface RepresentanteImportPendencia {
  lineNumber: number
  identificador: string
  motivo: string
  tipo: 'erro' | 'aviso'
}

export interface RepresentanteImportReport {
  representantesCriados: number
  representantesAtualizados: number
  representantesSemAlteracao: number
  totalLinhasProcessadas: number
  vinculosCategoriasCriados: number
  vinculosRegioesCriados: number
  totalAvisos: number
  pendencias: RepresentanteImportPendencia[]
  errosGerais?: string[]
}

export interface RepresentanteImportProgress {
  stage: 'carregando_dados' | 'processando' | 'salvando' | 'concluido'
  current: number
  total: number
  percentage: number
  message?: string
}

export function normalizeHeader(h: string): string {
  return (h || '')
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
}

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

export function normalizeKey(str: string | null | undefined): string {
  if (!str) return ''
  return normalizeStringMatch(str).replace(/[^a-z0-9]/g, '')
}

export function parseNumberValue(val: unknown, defaultValue: number | null = null): number | null {
  if (val === null || val === undefined) return defaultValue
  if (typeof val === 'number') return isNaN(val) ? defaultValue : Math.floor(val)
  const str = String(val).trim()
  if (!str) return defaultValue

  const cleaned = str.replace(/[^\d-]/g, '')
  const num = parseInt(cleaned, 10)
  return isNaN(num) ? defaultValue : num
}

/**
 * Resolução do status:
 * - "Ativo" -> Ativo
 * - "Inativo" -> Inativo
 * - Valores ambíguos ("Status", vazio, etc) -> Ativo + aviso para relatório
 */
export function resolveRepresentanteStatus(val: unknown): {
  status: 'Ativo' | 'Inativo'
  warning?: string
} {
  const raw = String(val ?? '').trim()
  const lower = raw.toLowerCase()

  if (!raw) {
    return {
      status: 'Ativo',
      warning: 'Campo status vazio — atribuído "Ativo" por padrão.',
    }
  }

  if (lower === 'ativo' || lower === 'ativa' || lower === 'active') {
    return { status: 'Ativo' }
  }

  if (lower === 'inativo' || lower === 'inativa' || lower === 'inactive') {
    return { status: 'Inativo' }
  }

  // Se o valor for "Status" ou qualquer outro texto ambíguo
  return {
    status: 'Ativo',
    warning: `Valor de status ambíguo ("${raw}") — registrado como "Ativo".`,
  }
}

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

function mapRowToParsedRepresentante(
  getVal: (keySynonyms: string[]) => { value: string; exists: boolean },
  lineNumber: number,
  raw: Record<string, unknown> | unknown[],
  parseError?: string,
): ParsedRepresentanteRow {
  const regLookup = getVal(['reg', 'registro', 'num_reg', 'numero_reg', 'reg_id', 'id_reg'])
  const codLookup = getVal([
    'cod',
    'codigo',
    'cod_rep',
    'cod_representante',
    'codigo_representante',
    'cod_erp',
    'coderp',
  ])
  const cpfCnpjLookup = getVal([
    'cpf_cnpj',
    'cpfcnpj',
    'documento',
    'cnpj',
    'cpf',
    'cnpj_cpf',
    'cnpjcpf',
  ])
  const razaoSocialLookup = getVal([
    'razao_social',
    'razaosocial',
    'razao',
    'empresa',
    'nome_empresa',
  ])
  const nomeFantasiaLookup = getVal([
    'nome_fantasia',
    'nomefantasia',
    'fantasia',
    'nome',
    'representante',
    'nome_representante',
  ])
  const emailLookup = getVal(['email', 'emails', 'e_mail', 'e-mail', 'correio_eletronico'])
  const telefoneLookup = getVal(['telefone', 'telefone_fixo', 'telefone_principal', 'tel', 'fone'])
  const celularLookup = getVal(['celular', 'cel', 'whatsapp', 'celular_whatsapp', 'mobile'])
  const cidadeLookup = getVal(['cidade', 'municipio', 'cidade_sede'])
  const ufLookup = getVal(['uf', 'estado', 'sigla_uf', 'sigla_estado'])
  const bairroLookup = getVal(['bairro', 'distrito'])
  const enderecoLookup = getVal(['endereco', 'logradouro', 'rua', 'end', 'logradouro_numero'])
  const statusLookup = getVal(['status', 'situacao', 'estado_cadastro'])
  const categoriasLookup = getVal([
    'categorias',
    'categoria',
    'categoria_produtos',
    'categorias_produtos',
    'cats',
  ])
  const regioesLookup = getVal([
    'regioes',
    'regiao',
    'estados',
    'estados_atuacao',
    'regioes_atuacao',
  ])

  const parsedReg = regLookup.exists ? parseNumberValue(regLookup.value) : null
  const parsedCod = codLookup.exists && codLookup.value.trim() ? codLookup.value.trim() : null
  const parsedCpfCnpj =
    cpfCnpjLookup.exists && cpfCnpjLookup.value.trim() ? cpfCnpjLookup.value.trim() : null
  const parsedRazaoSocial =
    razaoSocialLookup.exists && razaoSocialLookup.value.trim()
      ? razaoSocialLookup.value.trim()
      : null
  const parsedNomeFantasia =
    nomeFantasiaLookup.exists && nomeFantasiaLookup.value.trim()
      ? nomeFantasiaLookup.value.trim()
      : null
  const parsedEmail =
    emailLookup.exists && emailLookup.value.trim() ? emailLookup.value.trim() : null
  const parsedTelefone =
    telefoneLookup.exists && telefoneLookup.value.trim() ? telefoneLookup.value.trim() : null
  const parsedCelular =
    celularLookup.exists && celularLookup.value.trim() ? celularLookup.value.trim() : null
  const parsedCidade =
    cidadeLookup.exists && cidadeLookup.value.trim() ? cidadeLookup.value.trim() : null
  const parsedUf = ufLookup.exists && ufLookup.value.trim() ? ufLookup.value.trim() : null
  const parsedBairro =
    bairroLookup.exists && bairroLookup.value.trim() ? bairroLookup.value.trim() : null
  const parsedEndereco =
    enderecoLookup.exists && enderecoLookup.value.trim() ? enderecoLookup.value.trim() : null

  const statusResolution = resolveRepresentanteStatus(statusLookup.value)

  const parsedCategoriasRaw =
    categoriasLookup.exists && categoriasLookup.value.trim() ? categoriasLookup.value.trim() : null
  const parsedRegioesRaw =
    regioesLookup.exists && regioesLookup.value.trim() ? regioesLookup.value.trim() : null

  return {
    lineNumber,
    reg: parsedReg,
    cod: parsedCod,
    cpf_cnpj: parsedCpfCnpj,
    razao_social: parsedRazaoSocial,
    nome_fantasia: parsedNomeFantasia,
    email: parsedEmail,
    telefone: parsedTelefone,
    celular: parsedCelular,
    cidade: parsedCidade,
    uf: parsedUf,
    bairro: parsedBairro,
    endereco: parsedEndereco,
    statusRaw: statusLookup.exists ? statusLookup.value : null,
    statusResolved: statusResolution.status,
    statusWarning: statusResolution.warning,
    categoriasRaw: parsedCategoriasRaw,
    regioesRaw: parsedRegioesRaw,
    parseError,
    raw,
    hasField: {
      reg: regLookup.exists && regLookup.value.trim() !== '',
      cod: codLookup.exists && codLookup.value.trim() !== '',
      cpf_cnpj: cpfCnpjLookup.exists && cpfCnpjLookup.value.trim() !== '',
      razao_social: razaoSocialLookup.exists && razaoSocialLookup.value.trim() !== '',
      nome_fantasia: nomeFantasiaLookup.exists && nomeFantasiaLookup.value.trim() !== '',
      email: emailLookup.exists && emailLookup.value.trim() !== '',
      telefone: telefoneLookup.exists && telefoneLookup.value.trim() !== '',
      celular: celularLookup.exists && celularLookup.value.trim() !== '',
      cidade: cidadeLookup.exists && cidadeLookup.value.trim() !== '',
      uf: ufLookup.exists && ufLookup.value.trim() !== '',
      bairro: bairroLookup.exists && bairroLookup.value.trim() !== '',
      endereco: enderecoLookup.exists && enderecoLookup.value.trim() !== '',
      status: statusLookup.exists && statusLookup.value.trim() !== '',
      categorias: categoriasLookup.exists && categoriasLookup.value.trim() !== '',
      regioes: regioesLookup.exists && regioesLookup.value.trim() !== '',
    },
  }
}

export async function parseCSVFile(
  file: File,
  encoding = 'UTF-8',
): Promise<ParsedRepresentantesSpreadsheetResult> {
  return new Promise((resolve, reject) => {
    const rows: ParsedRepresentanteRow[] = []
    let lineNumber = 1
    let headerMap: Record<string, number> | null = null

    Papa.parse<string[]>(file, {
      encoding,
      skipEmptyLines: 'greedy',
      header: false,
      step: (results) => {
        const rawRow = results.data
        if (!Array.isArray(rawRow) || rawRow.length === 0) {
          lineNumber++
          return
        }

        const isNonEmpty = rawRow.some((cell) => cell && String(cell).trim() !== '')
        if (!isNonEmpty) {
          lineNumber++
          return
        }

        // Detect header row
        if (!headerMap) {
          const map: Record<string, number> = {}
          rawRow.forEach((col, idx) => {
            const norm = normalizeHeader(col)
            if (norm && map[norm] === undefined) {
              map[norm] = idx
            }
          })

          const hasReg = findHeaderMatch(map, ['reg', 'registro', 'cod', 'codigo']) !== undefined
          const hasRazao = findHeaderMatch(map, ['razaosocial', 'razao', 'empresa']) !== undefined
          const hasFantasia =
            findHeaderMatch(map, ['nomefantasia', 'fantasia', 'nome']) !== undefined

          if (hasReg || hasRazao || hasFantasia || lineNumber === 1) {
            headerMap = map
            lineNumber++
            return
          }
        }

        const getVal = (candidates: string[]): { value: string; exists: boolean } => {
          if (!headerMap) return { value: '', exists: false }
          const colIdx = findHeaderMatch(headerMap, candidates)
          if (colIdx === undefined || typeof colIdx !== 'number') {
            return { value: '', exists: false }
          }
          const val = rawRow[colIdx]
          if (val === undefined || val === null) return { value: '', exists: false }
          return { value: String(val).trim(), exists: true }
        }

        const parsed = mapRowToParsedRepresentante(getVal, lineNumber, rawRow)
        if (parsed.reg !== null || parsed.cod || parsed.razao_social || parsed.nome_fantasia) {
          rows.push(parsed)
        }
        lineNumber++
      },
      complete: () => {
        resolve({
          totalRows: rows.length,
          previewRows: rows.slice(0, 5),
          allRows: rows,
        })
      },
      error: (err) => {
        reject(new Error(`Erro ao ler CSV: ${err.message}`))
      },
    })
  })
}

export async function parseXLSXFile(
  file: File,
  targetSheetName?: string,
): Promise<ParsedRepresentantesSpreadsheetResult> {
  const XLSX = await loadSheetJS()
  const arrayBuffer = await file.arrayBuffer()
  const workbook = XLSX.read(arrayBuffer, { type: 'array' })

  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new Error('Nenhuma planilha encontrada no arquivo Excel.')
  }

  const sheetName =
    targetSheetName && workbook.SheetNames.includes(targetSheetName)
      ? targetSheetName
      : workbook.SheetNames[0]

  const worksheet = workbook.Sheets[sheetName]
  if (!worksheet) {
    throw new Error(`Aba "${sheetName}" não encontrada no arquivo.`)
  }

  const rawRows: any[][] = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    defval: '',
    blankrows: false,
  })

  if (!rawRows || rawRows.length === 0) {
    return {
      sheetName,
      availableSheets: workbook.SheetNames,
      totalRows: 0,
      previewRows: [],
      allRows: [],
    }
  }

  let headerRowIdx = -1
  let headerMap: Record<string, number> = {}

  for (let r = 0; r < Math.min(10, rawRows.length); r++) {
    const row = rawRows[r]
    if (!Array.isArray(row)) continue
    const map: Record<string, number> = {}
    row.forEach((cell, idx) => {
      const norm = normalizeHeader(String(cell || ''))
      if (norm && map[norm] === undefined) {
        map[norm] = idx
      }
    })

    const hasReg = findHeaderMatch(map, ['reg', 'registro', 'cod', 'codigo']) !== undefined
    const hasRazao = findHeaderMatch(map, ['razaosocial', 'razao', 'empresa']) !== undefined
    const hasFantasia = findHeaderMatch(map, ['nomefantasia', 'fantasia', 'nome']) !== undefined

    if (hasReg || hasRazao || hasFantasia) {
      headerRowIdx = r
      headerMap = map
      break
    }
  }

  if (headerRowIdx === -1 && rawRows.length > 0) {
    headerRowIdx = 0
    rawRows[0].forEach((cell, idx) => {
      const norm = normalizeHeader(String(cell || ''))
      if (norm) headerMap[norm] = idx
    })
  }

  const rows: ParsedRepresentanteRow[] = []

  for (let i = headerRowIdx + 1; i < rawRows.length; i++) {
    const rawRow = rawRows[i]
    if (!Array.isArray(rawRow)) continue
    const isNonEmpty = rawRow.some((cell) => cell !== '' && cell !== null && cell !== undefined)
    if (!isNonEmpty) continue

    const getVal = (candidates: string[]): { value: string; exists: boolean } => {
      const colIdx = findHeaderMatch(headerMap, candidates)
      if (colIdx === undefined || typeof colIdx !== 'number') {
        return { value: '', exists: false }
      }
      const val = rawRow[colIdx]
      if (val === undefined || val === null) return { value: '', exists: false }
      return { value: String(val).trim(), exists: true }
    }

    const lineNumber = i + 1
    const parsed = mapRowToParsedRepresentante(getVal, lineNumber, rawRow)
    if (parsed.reg !== null || parsed.cod || parsed.razao_social || parsed.nome_fantasia) {
      rows.push(parsed)
    }
  }

  return {
    sheetName,
    availableSheets: workbook.SheetNames,
    totalRows: rows.length,
    previewRows: rows.slice(0, 5),
    allRows: rows,
  }
}

export async function parseRepresentantesImportFile(
  file: File,
  targetSheetName?: string,
): Promise<ParsedRepresentantesSpreadsheetResult> {
  const name = file.name.toLowerCase()
  if (name.endsWith('.csv') || name.endsWith('.txt')) {
    return parseCSVFile(file)
  }
  return parseXLSXFile(file, targetSheetName)
}

interface LocalRepresentante {
  id: string
  reg: number | null
  cod: string | null
  fantasia: string
  razao_social: string | null
  documento: string | null
  email: string | null
  telefone: string | null
  celular: string | null
  cidade: string | null
  estado: string | null
  bairro: string | null
  endereco: string | null
  status: string
}

interface LocalCategoria {
  id: string
  nome: string
}

interface LocalRegiao {
  id: string
  nome: string
  uf: string | null
}

export interface ProcessRepresentantesImportOptions {
  userName?: string
  userId?: string
  onProgress?: (progress: RepresentanteImportProgress) => void
}

/**
 * Split values by pipe (" | ") and trim.
 */
function splitPipedValues(str: string | null | undefined): string[] {
  if (!str) return []
  return str
    .split('|')
    .map((s) => s.trim())
    .filter(Boolean)
}

/**
 * Helper to match category by name (tolerant to case/accents)
 */
function findCategoryMatch(name: string, categorias: LocalCategoria[]): LocalCategoria | undefined {
  const norm = normalizeStringMatch(name)
  const key = normalizeKey(name)
  return categorias.find((c) => {
    if (normalizeStringMatch(c.nome) === norm) return true
    if (key.length >= 3 && normalizeKey(c.nome) === key) return true
    return false
  })
}

/**
 * Helper to match region by state name or UF (tolerant to case/accents)
 */
function findRegiaoMatch(nameOrUf: string, regioes: LocalRegiao[]): LocalRegiao | undefined {
  const norm = normalizeStringMatch(nameOrUf)
  const key = normalizeKey(nameOrUf)
  return regioes.find((r) => {
    if (r.uf && normalizeStringMatch(r.uf) === norm) return true
    if (normalizeStringMatch(r.nome) === norm) return true
    if (key.length >= 2 && (normalizeKey(r.uf) === key || normalizeKey(r.nome) === key)) return true
    return false
  })
}

export async function processarImportacaoRepresentantes(
  rows: ParsedRepresentanteRow[],
  options: ProcessRepresentantesImportOptions = {},
): Promise<RepresentanteImportReport> {
  const { onProgress } = options
  const total = rows.length

  const report: RepresentanteImportReport = {
    representantesCriados: 0,
    representantesAtualizados: 0,
    representantesSemAlteracao: 0,
    totalLinhasProcessadas: 0,
    vinculosCategoriasCriados: 0,
    vinculosRegioesCriados: 0,
    totalAvisos: 0,
    pendencias: [],
    errosGerais: [],
  }

  if (total === 0) return report

  onProgress?.({
    stage: 'carregando_dados',
    current: 0,
    total,
    percentage: 5,
    message: 'Carregando representantes, categorias e regiões existentes...',
  })

  // 1. Fetch existing data
  const [
    { data: existingRepsRaw, error: repErr },
    { data: existingCatsRaw, error: catErr },
    { data: existingRegsRaw, error: regErr },
  ] = await Promise.all([
    (supabase.from('representantes') as any).select(
      'id, reg, cod, fantasia, razao_social, documento, email, telefone, celular, cidade, estado, bairro, endereco, status',
    ),
    (supabase.from('categorias') as any).select('id, nome'),
    (supabase.from('regioes') as any).select('id, nome, uf'),
  ])

  if (repErr) throw new Error(`Erro ao consultar representantes: ${repErr.message}`)
  if (catErr) throw new Error(`Erro ao consultar categorias: ${catErr.message}`)
  if (regErr) throw new Error(`Erro ao consultar regiões: ${regErr.message}`)

  const localReps: LocalRepresentante[] = (existingRepsRaw || []).map((r: any) => ({
    id: r.id,
    reg: r.reg !== null && r.reg !== undefined ? Number(r.reg) : null,
    cod: r.cod ? String(r.cod).trim() : null,
    fantasia: r.fantasia || '',
    razao_social: r.razao_social || null,
    documento: r.documento || null,
    email: r.email || null,
    telefone: r.telefone || null,
    celular: r.celular || null,
    cidade: r.cidade || null,
    estado: r.estado || null,
    bairro: r.bairro || null,
    endereco: r.endereco || null,
    status: r.status || 'Ativo',
  }))

  const localCats: LocalCategoria[] = (existingCatsRaw || []).map((c: any) => ({
    id: c.id,
    nome: c.nome,
  }))

  const localRegs: LocalRegiao[] = (existingRegsRaw || []).map((r: any) => ({
    id: r.id,
    nome: r.nome,
    uf: r.uf,
  }))

  onProgress?.({
    stage: 'processando',
    current: 0,
    total,
    percentage: 15,
    message: 'Processando representantes e cruzando dados...',
  })

  for (let idx = 0; idx < rows.length; idx++) {
    const row = rows[idx]
    report.totalLinhasProcessadas++

    const currentPct = Math.round(15 + ((idx + 1) / total) * 80)
    if (idx % 10 === 0 || idx === total - 1) {
      onProgress?.({
        stage: 'processando',
        current: idx + 1,
        total,
        percentage: currentPct,
        message: `Processando linha ${row.lineNumber} (${idx + 1}/${total}): ${
          row.nome_fantasia || row.razao_social || 'Sem nome'
        }`,
      })
    }

    // Name fallback
    const resolvedFantasia =
      (row.nome_fantasia && row.nome_fantasia.trim()) ||
      (row.razao_social && row.razao_social.trim()) ||
      (row.reg !== null && row.reg !== undefined ? `Representante ${row.reg}` : '')

    if (!resolvedFantasia) {
      report.pendencias.push({
        lineNumber: row.lineNumber,
        identificador: `Linha ${row.lineNumber}`,
        motivo: 'Linha sem Nome Fantasia ou Razão Social.',
        tipo: 'erro',
      })
      continue
    }

    // Registrar aviso de status se houver
    if (row.statusWarning) {
      report.totalAvisos++
      report.pendencias.push({
        lineNumber: row.lineNumber,
        identificador: resolvedFantasia,
        motivo: row.statusWarning,
        tipo: 'aviso',
      })
    }

    // Cruzamento do representante:
    // 1º por reg (numérico)
    // 2º por cod (string case-insensitive/trim)
    // 3º por razao_social (matching tolerante a acento/caixa)
    let matchedRep: LocalRepresentante | undefined

    if (row.reg !== null && row.reg !== undefined) {
      matchedRep = localReps.find((r) => r.reg !== null && r.reg === row.reg)
    }

    if (!matchedRep && row.cod && row.cod.trim()) {
      const rowCodNorm = row.cod.trim().toLowerCase()
      matchedRep = localReps.find((r) => r.cod && r.cod.trim().toLowerCase() === rowCodNorm)
    }

    if (!matchedRep && row.razao_social && row.razao_social.trim()) {
      const normRazao = normalizeStringMatch(row.razao_social)
      const keyRazao = normalizeKey(row.razao_social)
      matchedRep = localReps.find((r) => {
        if (!r.razao_social) return false
        if (normalizeStringMatch(r.razao_social) === normRazao) return true
        if (keyRazao.length >= 4 && normalizeKey(r.razao_social) === keyRazao) return true
        return false
      })
    }

    // Se ainda não achou, tentar pelo nome fantasia exato/tolerante
    if (!matchedRep && row.nome_fantasia && row.nome_fantasia.trim()) {
      const normFantasia = normalizeStringMatch(row.nome_fantasia)
      const keyFantasia = normalizeKey(row.nome_fantasia)
      matchedRep = localReps.find((r) => {
        if (!r.fantasia) return false
        if (normalizeStringMatch(r.fantasia) === normFantasia) return true
        if (keyFantasia.length >= 4 && normalizeKey(r.fantasia) === keyFantasia) return true
        return false
      })
    }

    let repId: string | null = null

    if (matchedRep) {
      // ATUALIZAÇÃO NÃO-DESTRUTIVA:
      // Campo vazio no arquivo NUNCA apaga dado existente.
      repId = matchedRep.id
      const updates: Record<string, any> = {}
      let hasChanges = false

      if (
        row.hasField.reg &&
        row.reg !== null &&
        row.reg !== undefined &&
        row.reg !== matchedRep.reg
      ) {
        updates.reg = row.reg
        hasChanges = true
      }

      if (row.hasField.cod && row.cod && row.cod.trim() && row.cod.trim() !== matchedRep.cod) {
        updates.cod = row.cod.trim()
        hasChanges = true
      }

      if (
        row.hasField.nome_fantasia &&
        row.nome_fantasia &&
        row.nome_fantasia.trim() &&
        row.nome_fantasia.trim() !== matchedRep.fantasia
      ) {
        updates.fantasia = row.nome_fantasia.trim()
        hasChanges = true
      }

      if (
        row.hasField.razao_social &&
        row.razao_social &&
        row.razao_social.trim() &&
        row.razao_social.trim() !== matchedRep.razao_social
      ) {
        updates.razao_social = row.razao_social.trim()
        hasChanges = true
      }

      if (
        row.hasField.cpf_cnpj &&
        row.cpf_cnpj &&
        row.cpf_cnpj.trim() &&
        row.cpf_cnpj.trim() !== matchedRep.documento
      ) {
        updates.documento = row.cpf_cnpj.trim()
        hasChanges = true
      }

      if (
        row.hasField.email &&
        row.email &&
        row.email.trim() &&
        row.email.trim() !== matchedRep.email
      ) {
        updates.email = row.email.trim()
        hasChanges = true
      }

      if (
        row.hasField.telefone &&
        row.telefone &&
        row.telefone.trim() &&
        row.telefone.trim() !== matchedRep.telefone
      ) {
        updates.telefone = row.telefone.trim()
        updates.telefone_principal = row.telefone.trim()
        hasChanges = true
      }

      if (
        row.hasField.celular &&
        row.celular &&
        row.celular.trim() &&
        row.celular.trim() !== matchedRep.celular
      ) {
        updates.celular = row.celular.trim()
        hasChanges = true
      }

      if (
        row.hasField.cidade &&
        row.cidade &&
        row.cidade.trim() &&
        row.cidade.trim() !== matchedRep.cidade
      ) {
        updates.cidade = row.cidade.trim()
        hasChanges = true
      }

      if (row.hasField.uf && row.uf && row.uf.trim() && row.uf.trim() !== matchedRep.estado) {
        updates.estado = row.uf.trim()
        hasChanges = true
      }

      if (
        row.hasField.bairro &&
        row.bairro &&
        row.bairro.trim() &&
        row.bairro.trim() !== matchedRep.bairro
      ) {
        updates.bairro = row.bairro.trim()
        hasChanges = true
      }

      if (
        row.hasField.endereco &&
        row.endereco &&
        row.endereco.trim() &&
        row.endereco.trim() !== matchedRep.endereco
      ) {
        updates.endereco = row.endereco.trim()
        hasChanges = true
      }

      if (row.hasField.status && row.statusResolved && row.statusResolved !== matchedRep.status) {
        updates.status = row.statusResolved
        hasChanges = true
      }

      if (hasChanges) {
        updates.updated_at = new Date().toISOString()
        const { error: upErr } = await (supabase.from('representantes') as any)
          .update(updates)
          .eq('id', matchedRep.id)

        if (upErr) {
          report.pendencias.push({
            lineNumber: row.lineNumber,
            identificador: resolvedFantasia,
            motivo: `Erro ao atualizar representante: ${upErr.message}`,
            tipo: 'erro',
          })
        } else {
          Object.assign(matchedRep, updates)
          report.representantesAtualizados++
        }
      } else {
        report.representantesSemAlteracao++
      }
    } else {
      // NÃO EXISTE -> CRIA NOVO
      const insertPayload: Record<string, any> = {
        fantasia: resolvedFantasia,
        status: row.statusResolved,
      }

      if (row.hasField.reg && row.reg !== null && row.reg !== undefined) {
        insertPayload.reg = row.reg
      }
      if (row.hasField.cod && row.cod && row.cod.trim()) {
        insertPayload.cod = row.cod.trim()
      }
      if (row.hasField.razao_social && row.razao_social && row.razao_social.trim()) {
        insertPayload.razao_social = row.razao_social.trim()
      }
      if (row.hasField.cpf_cnpj && row.cpf_cnpj && row.cpf_cnpj.trim()) {
        insertPayload.documento = row.cpf_cnpj.trim()
      }
      if (row.hasField.email && row.email && row.email.trim()) {
        insertPayload.email = row.email.trim()
        insertPayload.emails = [row.email.trim()]
      }
      if (row.hasField.telefone && row.telefone && row.telefone.trim()) {
        insertPayload.telefone = row.telefone.trim()
        insertPayload.telefone_principal = row.telefone.trim()
      }
      if (row.hasField.celular && row.celular && row.celular.trim()) {
        insertPayload.celular = row.celular.trim()
      }
      if (row.hasField.cidade && row.cidade && row.cidade.trim()) {
        insertPayload.cidade = row.cidade.trim()
      }
      if (row.hasField.uf && row.uf && row.uf.trim()) {
        insertPayload.estado = row.uf.trim()
      }
      if (row.hasField.bairro && row.bairro && row.bairro.trim()) {
        insertPayload.bairro = row.bairro.trim()
      }
      if (row.hasField.endereco && row.endereco && row.endereco.trim()) {
        insertPayload.endereco = row.endereco.trim()
      }

      const { data: created, error: insErr } = await (supabase.from('representantes') as any)
        .insert(insertPayload)
        .select()
        .single()

      if (insErr) {
        report.pendencias.push({
          lineNumber: row.lineNumber,
          identificador: resolvedFantasia,
          motivo: `Erro ao criar representante: ${insErr.message}`,
          tipo: 'erro',
        })
      } else if (created) {
        repId = created.id
        const newLocalRep: LocalRepresentante = {
          id: created.id,
          reg: created.reg !== null && created.reg !== undefined ? Number(created.reg) : null,
          cod: created.cod ? String(created.cod).trim() : null,
          fantasia: created.fantasia,
          razao_social: created.razao_social,
          documento: created.documento,
          email: created.email,
          telefone: created.telefone,
          celular: created.celular,
          cidade: created.cidade,
          estado: created.estado,
          bairro: created.bairro,
          endereco: created.endereco,
          status: created.status,
        }
        localReps.push(newLocalRep)
        report.representantesCriados++
      }
    }

    if (!repId) continue

    // ----------------------------------------------------
    // RESOLUÇÃO DE CATEGORIAS (coluna categorias separada por " | ")
    // ----------------------------------------------------
    if (row.categoriasRaw) {
      const catNames = splitPipedValues(row.categoriasRaw)
      for (const catName of catNames) {
        const catMatch = findCategoryMatch(catName, localCats)
        if (!catMatch) {
          report.pendencias.push({
            lineNumber: row.lineNumber,
            identificador: resolvedFantasia,
            motivo: `Categoria "${catName}" não cadastrada no catálogo. Vínculo não criado.`,
            tipo: 'erro',
          })
        } else {
          // Criar vínculo sem duplicar
          const { error: linkErr } = await (supabase as any)
            .from('representante_categorias')
            .insert({
              representante_id: repId,
              categoria_id: catMatch.id,
            })
            .select()
            .maybeSingle()

          // Se deu 23505 (unique_violation) ou sucesso, contabilizar
          if (!linkErr) {
            report.vinculosCategoriasCriados++
          } else if (linkErr.code !== '23505') {
            console.warn('Erro ao vincular categoria:', linkErr.message)
          }
        }
      }
    }

    // ----------------------------------------------------
    // RESOLUÇÃO DE REGIÕES (coluna regioes separada por " | ")
    // Regra:
    // - "BRASIL" com outros estados: ignore "BRASIL" (aviso) e vincule os estados reais
    // - Apenas "BRASIL": atuação nacional -> sem vínculo de estado + aviso explicativo
    // - Nunca crie região nova a partir do arquivo
    // ----------------------------------------------------
    if (row.regioesRaw) {
      const rawItems = splitPipedValues(row.regioesRaw)
      const hasBrasil = rawItems.some((item) => normalizeStringMatch(item) === 'brasil')
      const stateItems = rawItems.filter((item) => normalizeStringMatch(item) !== 'brasil')

      if (hasBrasil && stateItems.length > 0) {
        report.totalAvisos++
        report.pendencias.push({
          lineNumber: row.lineNumber,
          identificador: resolvedFantasia,
          motivo: 'Item "BRASIL" ignorado; estados específicos vinculados.',
          tipo: 'aviso',
        })
      } else if (hasBrasil && stateItems.length === 0) {
        report.totalAvisos++
        report.pendencias.push({
          lineNumber: row.lineNumber,
          identificador: resolvedFantasia,
          motivo: 'Atuação declarada como Nacional ("BRASIL"). Mantido sem restrição de estado.',
          tipo: 'aviso',
        })
      }

      for (const stItem of stateItems) {
        const regMatch = findRegiaoMatch(stItem, localRegs)
        if (!regMatch) {
          report.pendencias.push({
            lineNumber: row.lineNumber,
            identificador: resolvedFantasia,
            motivo: `Região/Estado "${stItem}" não encontrado na base de estados.`,
            tipo: 'erro',
          })
        } else {
          // Criar vínculo sem duplicar
          const { error: linkErr } = await (supabase as any)
            .from('representante_regioes')
            .insert({
              representante_id: repId,
              regiao_id: regMatch.id,
            })
            .select()
            .maybeSingle()

          if (!linkErr) {
            report.vinculosRegioesCriados++
          } else if (linkErr.code !== '23505') {
            console.warn('Erro ao vincular regiao:', linkErr.message)
          }
        }
      }
    }
  }

  onProgress?.({
    stage: 'concluido',
    current: total,
    total,
    percentage: 100,
    message: 'Processamento concluído!',
  })

  return report
}
