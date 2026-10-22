import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import { supabase } from '@/lib/supabase/client'

async function loadSheetJS(): Promise<any> {
  return XLSX
}

export interface ParsedMarcaRow {
  lineNumber: number
  reg?: number | null
  cod?: number | null
  nome: string
  status?: string | null
  site?: string | null
  pais?: string | null
  parseError?: string
  raw?: Record<string, unknown> | unknown[]
  hasField: {
    reg: boolean
    cod: boolean
    nome: boolean
    status: boolean
    site: boolean
    pais: boolean
  }
}

export interface ParsedMarcasSpreadsheetResult {
  sheetName?: string
  totalRows: number
  previewRows: ParsedMarcaRow[]
  allRows: ParsedMarcaRow[]
  availableSheets?: string[]
}

export interface MarcaImportPendencia {
  lineNumber: number
  identificador: string
  motivo: string
}

export interface MarcaImportReport {
  marcasCriadas: number
  marcasAtualizadas: number
  marcasSemAlteracao: number
  totalLinhasProcessadas: number
  pendencias: MarcaImportPendencia[]
  errosGerais?: string[]
}

export interface MarcaImportProgress {
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
  if (typeof val === 'number') return isNaN(val) ? defaultValue : val
  const str = String(val).trim()
  if (!str) return defaultValue

  const cleaned = str.replace(/[^\d.,-]/g, '').replace(',', '.')
  const num = parseFloat(cleaned)
  return isNaN(num) ? defaultValue : num
}

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

function mapRowToParsedMarca(
  getVal: (keySynonyms: string[]) => { value: string; exists: boolean },
  lineNumber: number,
  raw: Record<string, unknown> | unknown[],
  parseError?: string,
): ParsedMarcaRow {
  const regLookup = getVal(['reg', 'registro', 'num_reg', 'numero_reg', 'reg_id', 'id_reg'])
  const codLookup = getVal([
    'cod',
    'codigo',
    'cod_marca',
    'codmarca',
    'codigo_marca',
    'cod_erp',
    'coderp',
  ])
  const nomeLookup = getVal([
    'nome',
    'marca',
    'marcas',
    'nome_marca',
    'nomemarca',
    'fabricante',
    'descricao',
  ])
  const statusLookup = getVal(['status', 'situacao', 'ativo', 'estado'])
  const siteLookup = getVal(['site', 'website', 'url', 'web', 'link', 'homepage'])
  const paisLookup = getVal(['pais', 'country', 'nacao', 'origem', 'pais_origem'])

  const parsedReg = regLookup.exists ? parseNumberValue(regLookup.value) : null
  const parsedCod = codLookup.exists ? parseNumberValue(codLookup.value) : null
  const parsedNome = nomeLookup.value.trim()
  const parsedStatus =
    statusLookup.exists && statusLookup.value.trim() ? normalizeStatus(statusLookup.value) : 'Ativo'
  const parsedSite = siteLookup.exists && siteLookup.value.trim() ? siteLookup.value.trim() : null
  const parsedPais = paisLookup.exists && paisLookup.value.trim() ? paisLookup.value.trim() : null

  return {
    lineNumber,
    reg: parsedReg,
    cod: parsedCod,
    nome: parsedNome,
    status: parsedStatus,
    site: parsedSite,
    pais: parsedPais,
    parseError,
    raw,
    hasField: {
      reg: regLookup.exists && regLookup.value.trim() !== '',
      cod: codLookup.exists && codLookup.value.trim() !== '',
      nome: nomeLookup.exists && nomeLookup.value.trim() !== '',
      status: statusLookup.exists && statusLookup.value.trim() !== '',
      site: siteLookup.exists && siteLookup.value.trim() !== '',
      pais: paisLookup.exists && paisLookup.value.trim() !== '',
    },
  }
}

export async function parseCSVFile(
  file: File,
  encoding = 'UTF-8',
): Promise<ParsedMarcasSpreadsheetResult> {
  return new Promise((resolve, reject) => {
    const rows: ParsedMarcaRow[] = []
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

          const hasNome =
            findHeaderMatch(map, ['nome', 'marca', 'marcas', 'fabricante', 'descricao']) !==
            undefined
          const hasReg = findHeaderMatch(map, ['reg', 'registro', 'cod', 'codigo']) !== undefined

          if (hasNome || hasReg || lineNumber === 1) {
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

        const parsed = mapRowToParsedMarca(getVal, lineNumber, rawRow)
        if (parsed.nome || parsed.reg !== null || parsed.cod !== null) {
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
): Promise<ParsedMarcasSpreadsheetResult> {
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

    const hasNome =
      findHeaderMatch(map, ['nome', 'marca', 'marcas', 'fabricante', 'descricao']) !== undefined
    const hasReg = findHeaderMatch(map, ['reg', 'registro', 'cod', 'codigo']) !== undefined

    if (hasNome || hasReg) {
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

  const rows: ParsedMarcaRow[] = []

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
    const parsed = mapRowToParsedMarca(getVal, lineNumber, rawRow)
    if (parsed.nome || parsed.reg !== null || parsed.cod !== null) {
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

export async function parseMarcasImportFile(
  file: File,
  targetSheetName?: string,
): Promise<ParsedMarcasSpreadsheetResult> {
  const fileName = file.name.toLowerCase()
  if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
    return parseXLSXFile(file, targetSheetName)
  }
  return parseCSVFile(file)
}

export interface ProcessMarcasImportOptions {
  userName?: string
  userId?: string
  onProgress?: (progress: MarcaImportProgress) => void
}

interface LocalMarca {
  id: string
  nome: string
  reg: number | null
  cod: number | null
  status: string
  site: string | null
  pais: string | null
  deleted_at: string | null
}

/**
 * Process import rows: deduplicates / matches by:
 * 1st: reg (numeric match, primary unique cross key)
 * 2nd: cod (numeric match)
 * 3rd: nome (tolerant to case and accents)
 *
 * If exists -> UPDATE (empty fields in file DO NOT overwrite/erase existing data in DB).
 * If not exists -> CREATE.
 * Returns detailed report of created, updated, unchanged and pending items.
 */
export async function processarImportacaoMarcas(
  rows: ParsedMarcaRow[],
  options: ProcessMarcasImportOptions = {},
): Promise<MarcaImportReport> {
  const { onProgress } = options
  const total = rows.length

  const report: MarcaImportReport = {
    marcasCriadas: 0,
    marcasAtualizadas: 0,
    marcasSemAlteracao: 0,
    totalLinhasProcessadas: 0,
    pendencias: [],
    errosGerais: [],
  }

  if (total === 0) return report

  onProgress?.({
    stage: 'carregando_dados',
    current: 0,
    total,
    percentage: 5,
    message: 'Carregando marcas existentes...',
  })

  // 1. Fetch existing marcas
  const { data: existingMarcasRaw, error: marcaErr } = await supabase
    .from('marcas')
    .select('id, nome, reg, cod, status, site, pais, deleted_at')

  if (marcaErr) {
    throw new Error(`Erro ao consultar marcas existentes: ${marcaErr.message}`)
  }

  // Live in-memory registry of brands
  const localMarcas: LocalMarca[] = (existingMarcasRaw || []).map((m: any) => ({
    id: m.id,
    nome: m.nome,
    reg: m.reg !== null && m.reg !== undefined ? Number(m.reg) : null,
    cod: m.cod !== null && m.cod !== undefined ? Number(m.cod) : null,
    status: m.status || 'Ativo',
    site: m.site || null,
    pais: m.pais || null,
    deleted_at: m.deleted_at || null,
  }))

  onProgress?.({
    stage: 'processando',
    current: 0,
    total,
    percentage: 15,
    message: 'Iniciando correspondência e atualização das marcas...',
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
        message: `Processando linha ${row.lineNumber} (${idx + 1}/${total}): ${row.nome || 'Sem nome'}`,
      })
    }

    // Validation: brand name is mandatory
    if (!row.nome || !row.nome.trim()) {
      report.pendencias.push({
        lineNumber: row.lineNumber,
        identificador:
          row.reg !== null && row.reg !== undefined
            ? `Reg: ${row.reg}`
            : row.cod !== null && row.cod !== undefined
              ? `Cód: ${row.cod}`
              : `Linha ${row.lineNumber}`,
        motivo: 'Linha sem nome da marca/fabricante informado.',
      })
      continue
    }

    // Find match:
    // 1st: reg (numeric match)
    // 2nd: cod (numeric match)
    // 3rd: nome (tolerant match)
    let matchedMarca: LocalMarca | undefined

    if (row.reg !== null && row.reg !== undefined) {
      matchedMarca = localMarcas.find((m) => m.reg !== null && m.reg === row.reg && !m.deleted_at)
    }

    if (!matchedMarca && row.cod !== null && row.cod !== undefined) {
      matchedMarca = localMarcas.find((m) => m.cod !== null && m.cod === row.cod && !m.deleted_at)
    }

    if (!matchedMarca && row.nome) {
      const normRowNome = normalizeStringMatch(row.nome)
      const keyRowNome = normalizeKey(row.nome)
      matchedMarca = localMarcas.find((m) => {
        if (m.deleted_at) return false
        const mNorm = normalizeStringMatch(m.nome)
        if (mNorm === normRowNome) return true
        const mKey = normalizeKey(m.nome)
        return mKey.length >= 3 && mKey === keyRowNome
      })
    }

    if (matchedMarca) {
      // UPDATE EXISTING
      // Empty fields in the incoming row DO NOT overwrite/erase existing data in DB
      const updates: {
        nome?: string
        reg?: number | null
        cod?: number | null
        status?: string
        site?: string | null
        pais?: string | null
        updated_at?: string
      } = {}
      let hasChanges = false

      if (row.hasField.nome && row.nome.trim() && row.nome.trim() !== matchedMarca.nome) {
        updates.nome = row.nome.trim()
        hasChanges = true
      }

      if (
        row.hasField.reg &&
        row.reg !== null &&
        row.reg !== undefined &&
        row.reg !== matchedMarca.reg
      ) {
        updates.reg = row.reg
        hasChanges = true
      }

      if (
        row.hasField.cod &&
        row.cod !== null &&
        row.cod !== undefined &&
        row.cod !== matchedMarca.cod
      ) {
        updates.cod = row.cod
        hasChanges = true
      }

      if (row.hasField.status && row.status && row.status !== matchedMarca.status) {
        updates.status = row.status
        hasChanges = true
      }

      if (row.hasField.site && row.site && row.site !== matchedMarca.site) {
        updates.site = row.site
        hasChanges = true
      }

      if (row.hasField.pais && row.pais && row.pais !== matchedMarca.pais) {
        updates.pais = row.pais
        hasChanges = true
      }

      if (!hasChanges) {
        report.marcasSemAlteracao++
      } else {
        updates.updated_at = new Date().toISOString()
        const { error: upErr } = await supabase
          .from('marcas')
          .update(updates)
          .eq('id', matchedMarca.id)

        if (upErr) {
          report.pendencias.push({
            lineNumber: row.lineNumber,
            identificador: row.nome,
            motivo: `Erro ao atualizar marca: ${upErr.message}`,
          })
        } else {
          // Update local mirror
          Object.assign(matchedMarca, updates)
          report.marcasAtualizadas++
        }
      }
    } else {
      // CREATE NEW
      const insertPayload: {
        nome: string
        status?: string
        reg?: number | null
        cod?: number | null
        site?: string | null
        pais?: string | null
      } = {
        nome: row.nome.trim(),
        status: row.status || 'Ativo',
      }

      if (row.hasField.reg && row.reg !== null && row.reg !== undefined) {
        insertPayload.reg = row.reg
      }
      if (row.hasField.cod && row.cod !== null && row.cod !== undefined) {
        insertPayload.cod = row.cod
      }
      if (row.hasField.site && row.site) {
        insertPayload.site = row.site
      }
      if (row.hasField.pais && row.pais) {
        insertPayload.pais = row.pais
      }

      const { data: created, error: insErr } = await supabase
        .from('marcas')
        .insert(insertPayload)
        .select('id, nome, reg, cod, status, site, pais')
        .single()

      if (insErr) {
        report.pendencias.push({
          lineNumber: row.lineNumber,
          identificador: row.nome,
          motivo: `Erro ao inserir marca: ${insErr.message}`,
        })
      } else if (created) {
        localMarcas.push({
          id: created.id,
          nome: created.nome,
          reg: created.reg !== null && created.reg !== undefined ? Number(created.reg) : null,
          cod: created.cod !== null && created.cod !== undefined ? Number(created.cod) : null,
          status: created.status || 'Ativo',
          site: created.site || null,
          pais: created.pais || null,
          deleted_at: null,
        })
        report.marcasCriadas++
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
