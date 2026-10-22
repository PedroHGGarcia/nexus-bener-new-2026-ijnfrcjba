import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import { supabase } from '@/lib/supabase/client'
import type { Database } from '@/lib/supabase/types'

type ProdutoInsert = Database['public']['Tables']['produtos']['Insert']
type ProdutoUpdate = Database['public']['Tables']['produtos']['Update']

async function loadSheetJS(): Promise<any> {
  return XLSX
}

export interface ParsedProdutoRow {
  lineNumber: number
  reg?: number | null
  cod?: string | null
  nome: string
  status?: string | null
  modelo?: string | null
  categoria?: string | null
  fabricante?: string | null
  parseError?: string
  raw?: Record<string, unknown> | unknown[]
  hasField: {
    reg: boolean
    cod: boolean
    nome: boolean
    status: boolean
    modelo: boolean
    categoria: boolean
    fabricante: boolean
  }
}

export interface ParsedProdutosSpreadsheetResult {
  sheetName?: string
  totalRows: number
  previewRows: ParsedProdutoRow[]
  allRows: ParsedProdutoRow[]
  availableSheets?: string[]
}

export interface ProdutoImportPendencia {
  lineNumber: number
  identificador: string
  motivo: string
}

export interface ProdutoImportReport {
  produtosCriados: number
  produtosAtualizados: number
  produtosSemAlteracao: number
  totalLinhasProcessadas: number
  pendencias: ProdutoImportPendencia[]
  errosGerais?: string[]
}

export interface ProdutoImportProgress {
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

function mapRowToParsedProduto(
  getVal: (keySynonyms: string[]) => { value: string; exists: boolean },
  lineNumber: number,
  raw: Record<string, unknown> | unknown[],
  parseError?: string,
): ParsedProdutoRow {
  const regLookup = getVal(['reg', 'registro', 'num_reg', 'numero_reg', 'reg_id', 'id_reg'])
  const codLookup = getVal([
    'cod',
    'codigo',
    'cod_erp',
    'coderp',
    'cod_produto',
    'codproduto',
    'codigo_produto',
  ])
  const nomeLookup = getVal([
    'nome',
    'produto',
    'produtos',
    'nome_produto',
    'nomeproduto',
    'descricao',
    'descricao_produto',
  ])
  const statusLookup = getVal(['status', 'situacao', 'ativo', 'estado'])
  const modeloLookup = getVal(['modelo', 'modelos', 'nome_modelo', 'nomemodelo'])
  const categoriaLookup = getVal([
    'categoria',
    'categorias',
    'nome_categoria',
    'categoria_produto',
    'categoria_nome',
  ])
  const fabricanteLookup = getVal([
    'fabricante',
    'marca',
    'fabricantes',
    'fornecedor',
    'marca_fabricante',
  ])

  const parsedReg = regLookup.exists ? parseNumberValue(regLookup.value) : null
  const parsedCod = codLookup.exists && codLookup.value.trim() ? codLookup.value.trim() : null
  const parsedNome = nomeLookup.value.trim()
  const parsedStatus =
    statusLookup.exists && statusLookup.value.trim() ? normalizeStatus(statusLookup.value) : 'Ativo'
  const parsedModelo =
    modeloLookup.exists && modeloLookup.value.trim() ? modeloLookup.value.trim() : null
  const parsedCategoria =
    categoriaLookup.exists && categoriaLookup.value.trim() ? categoriaLookup.value.trim() : null
  const parsedFabricante =
    fabricanteLookup.exists && fabricanteLookup.value.trim() ? fabricanteLookup.value.trim() : null

  return {
    lineNumber,
    reg: parsedReg,
    cod: parsedCod,
    nome: parsedNome,
    status: parsedStatus,
    modelo: parsedModelo,
    categoria: parsedCategoria,
    fabricante: parsedFabricante,
    parseError,
    raw,
    hasField: {
      reg: regLookup.exists && regLookup.value.trim() !== '',
      cod: codLookup.exists && codLookup.value.trim() !== '',
      nome: nomeLookup.exists && nomeLookup.value.trim() !== '',
      status: statusLookup.exists && statusLookup.value.trim() !== '',
      modelo: modeloLookup.exists && modeloLookup.value.trim() !== '',
      categoria: categoriaLookup.exists && categoriaLookup.value.trim() !== '',
      fabricante: fabricanteLookup.exists && fabricanteLookup.value.trim() !== '',
    },
  }
}

export async function parseCSVFile(
  file: File,
  encoding = 'UTF-8',
): Promise<ParsedProdutosSpreadsheetResult> {
  return new Promise((resolve, reject) => {
    const rows: ParsedProdutoRow[] = []
    let lineNumber = 1
    let headerMap: Record<string, number> | null = null

    Papa.parse<string[]>(file, {
      encoding,
      skipEmptyLines: 'greedy',
      header: false,
      step: (results, parser) => {
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
            findHeaderMatch(map, ['nome', 'produto', 'produtos', 'descricao']) !== undefined
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

        const parsed = mapRowToParsedProduto(getVal, lineNumber, rawRow)
        if (parsed.nome || parsed.reg !== null || parsed.cod) {
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
): Promise<ParsedProdutosSpreadsheetResult> {
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

    const hasNome = findHeaderMatch(map, ['nome', 'produto', 'produtos', 'descricao']) !== undefined
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

  const rows: ParsedProdutoRow[] = []

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
    const parsed = mapRowToParsedProduto(getVal, lineNumber, rawRow)
    if (parsed.nome || parsed.reg !== null || parsed.cod) {
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

export async function parseProdutosImportFile(
  file: File,
  targetSheetName?: string,
): Promise<ParsedProdutosSpreadsheetResult> {
  const fileName = file.name.toLowerCase()
  if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
    return parseXLSXFile(file, targetSheetName)
  }
  return parseCSVFile(file)
}

export interface ProcessProdutosImportOptions {
  userName?: string
  userId?: string
  onProgress?: (progress: ProdutoImportProgress) => void
}

/**
 * Process import rows: deduplicates / matches by reg (priority), then cod, then tolerant name.
 * If exists -> UPDATE (empty fields in file DO NOT overwrite existing data).
 * If not exists -> CREATE.
 * Returns detailed report of created, updated, unchanged and pending items.
 */
export async function processarImportacaoProdutos(
  rows: ParsedProdutoRow[],
  options: ProcessProdutosImportOptions = {},
): Promise<ProdutoImportReport> {
  const { onProgress } = options
  const total = rows.length

  const report: ProdutoImportReport = {
    produtosCriados: 0,
    produtosAtualizados: 0,
    produtosSemAlteracao: 0,
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
    message: 'Carregando produtos e categorias existentes...',
  })

  // 1. Fetch existing produtos and categorias_produtos
  const { data: existingProdutosRaw, error: prodErr } = await supabase
    .from('produtos')
    .select(
      'id, nome, reg, cod, status, modelo, categoria, fabricante, categoria_nome, descricao, deleted_at',
    )

  if (prodErr) {
    throw new Error(`Erro ao consultar produtos existentes: ${prodErr.message}`)
  }

  const { data: existingCategoriasRaw } = await (supabase.from('categorias') as any).select(
    'id, nome',
  )

  const categoriasList: { id: string; nome: string }[] = existingCategoriasRaw || []

  // Helper: tolerant category resolution by name, code or normalized variation
  const findCategoriaId = (rawCat: string | null | undefined): string | null => {
    if (!rawCat || !rawCat.trim()) return null
    const trimmed = rawCat.trim()
    const norm = normalizeStringMatch(trimmed)
    const key = normalizeKey(trimmed)

    // 1. Exact match by UUID
    const uuidMatch = categoriasList.find((c) => c.id.toLowerCase() === trimmed.toLowerCase())
    if (uuidMatch) return uuidMatch.id

    // 2. Exact normalized name match
    const exactMatch = categoriasList.find((c) => normalizeStringMatch(c.nome) === norm)
    if (exactMatch) return exactMatch.id

    // 3. Alphanumeric key match (handles accents, spaces, punctuation, case)
    const keyMatch = categoriasList.find((c) => {
      const cKey = normalizeKey(c.nome)
      return cKey.length >= 2 && cKey === key
    })
    if (keyMatch) return keyMatch.id

    // 4. Tolerant prefix/alias matches (e.g. "High Tech 2" -> "High Tech")
    const prefixMatch = categoriasList.find((c) => {
      const cNorm = normalizeStringMatch(c.nome)
      return (
        (norm.startsWith(cNorm) && cNorm.length >= 4) ||
        (cNorm.startsWith(norm) && norm.length >= 4)
      )
    })
    if (prefixMatch) return prefixMatch.id

    return null
  }

  // Live in-memory registry of products
  interface LocalProd {
    id: string
    nome: string
    reg: number | null
    cod: string | null
    status: string
    modelo: string | null
    categoria: string | null
    fabricante: string | null
    categoria_nome: string | null
    deleted_at: string | null
  }

  const localProdutos: LocalProd[] = (existingProdutosRaw || []).map((p: any) => ({
    id: p.id,
    nome: p.nome,
    reg: p.reg !== null && p.reg !== undefined ? Number(p.reg) : null,
    cod: p.cod ? String(p.cod).trim() : null,
    status: p.status || 'Ativo',
    modelo: p.modelo || null,
    categoria: p.categoria || null,
    fabricante: p.fabricante || null,
    categoria_nome: p.categoria_nome || null,
    deleted_at: p.deleted_at || null,
  }))

  onProgress?.({
    stage: 'processando',
    current: 0,
    total,
    percentage: 15,
    message: 'Iniciando correspondência e atualização dos produtos...',
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

    // Validation: name is mandatory for products
    if (!row.nome || !row.nome.trim()) {
      report.pendencias.push({
        lineNumber: row.lineNumber,
        identificador:
          row.reg !== null && row.reg !== undefined
            ? `Reg: ${row.reg}`
            : row.cod || `Linha ${row.lineNumber}`,
        motivo: 'Linha sem nome do produto informado.',
      })
      continue
    }

    // Resolve category UUID if categoria name was provided
    let resolvedCategoriaId: string | null = null
    if (row.hasField.categoria && row.categoria) {
      resolvedCategoriaId = findCategoriaId(row.categoria)
      if (!resolvedCategoriaId) {
        // Categoria informada mas não encontrada no cadastro
        report.pendencias.push({
          lineNumber: row.lineNumber,
          identificador: row.nome,
          motivo: `Categoria "${row.categoria}" não encontrada no cadastro. Produto importado sem vínculo de categoria.`,
        })
      }
    }

    // Find match:
    // 1st: reg (numeric match)
    // 2nd: cod (case-insensitive string match)
    // 3rd: nome (tolerant match)
    let matchedProd: LocalProd | undefined

    if (row.reg !== null && row.reg !== undefined) {
      matchedProd = localProdutos.find((p) => p.reg !== null && p.reg === row.reg && !p.deleted_at)
    }

    if (!matchedProd && row.cod) {
      const searchCod = row.cod.trim().toLowerCase()
      matchedProd = localProdutos.find(
        (p) => p.cod && p.cod.trim().toLowerCase() === searchCod && !p.deleted_at,
      )
    }

    if (!matchedProd && row.nome) {
      const normRowNome = normalizeStringMatch(row.nome)
      const keyRowNome = normalizeKey(row.nome)
      matchedProd = localProdutos.find((p) => {
        if (p.deleted_at) return false
        const pNorm = normalizeStringMatch(p.nome)
        if (pNorm === normRowNome) return true
        const pKey = normalizeKey(p.nome)
        return pKey.length > 3 && pKey === keyRowNome
      })
    }

    if (matchedProd) {
      // UPDATE EXISTING
      // Empty fields in the incoming row DO NOT overwrite existing data
      const updates: ProdutoUpdate = {}
      let hasChanges = false

      if (row.hasField.nome && row.nome.trim() && row.nome.trim() !== matchedProd.nome) {
        updates.nome = row.nome.trim()
        hasChanges = true
      }

      if (
        row.hasField.reg &&
        row.reg !== null &&
        row.reg !== undefined &&
        row.reg !== matchedProd.reg
      ) {
        updates.reg = row.reg
        hasChanges = true
      }

      if (row.hasField.cod && row.cod && row.cod !== matchedProd.cod) {
        updates.cod = row.cod
        hasChanges = true
      }

      if (row.hasField.status && row.status && row.status !== matchedProd.status) {
        updates.status = row.status
        hasChanges = true
      }

      if (row.hasField.modelo && row.modelo && row.modelo !== matchedProd.modelo) {
        updates.modelo = row.modelo
        hasChanges = true
      }

      if (row.hasField.fabricante && row.fabricante && row.fabricante !== matchedProd.fabricante) {
        updates.fabricante = row.fabricante
        hasChanges = true
      }

      if (row.hasField.categoria && row.categoria && row.categoria !== matchedProd.categoria_nome) {
        updates.categoria_nome = row.categoria
        if (resolvedCategoriaId && resolvedCategoriaId !== matchedProd.categoria) {
          updates.categoria = resolvedCategoriaId
        }
        hasChanges = true
      } else if (resolvedCategoriaId && resolvedCategoriaId !== matchedProd.categoria) {
        updates.categoria = resolvedCategoriaId
        hasChanges = true
      }

      if (!hasChanges) {
        report.produtosSemAlteracao++
      } else {
        updates.updated_at = new Date().toISOString()
        const { error: upErr } = await supabase
          .from('produtos')
          .update(updates)
          .eq('id', matchedProd.id)

        if (upErr) {
          report.pendencias.push({
            lineNumber: row.lineNumber,
            identificador: row.nome,
            motivo: `Erro ao atualizar produto: ${upErr.message}`,
          })
        } else {
          // Update local mirror
          Object.assign(matchedProd, updates)
          report.produtosAtualizados++
        }
      }
    } else {
      // CREATE NEW
      const insertPayload: ProdutoInsert = {
        nome: row.nome.trim(),
        status: row.status || 'Ativo',
      }

      if (row.hasField.reg && row.reg !== null && row.reg !== undefined) {
        insertPayload.reg = row.reg
      }
      if (row.hasField.cod && row.cod) {
        insertPayload.cod = row.cod
      }
      if (row.hasField.modelo && row.modelo) {
        insertPayload.modelo = row.modelo
      }
      if (row.hasField.fabricante && row.fabricante) {
        insertPayload.fabricante = row.fabricante
      }
      if (row.hasField.categoria && row.categoria) {
        insertPayload.categoria_nome = row.categoria
      }
      if (resolvedCategoriaId) {
        insertPayload.categoria = resolvedCategoriaId
      }

      const { data: created, error: insErr } = await supabase
        .from('produtos')
        .insert(insertPayload)
        .select('id, nome, reg, cod, status, modelo, categoria, fabricante, categoria_nome')
        .single()

      if (insErr) {
        report.pendencias.push({
          lineNumber: row.lineNumber,
          identificador: row.nome,
          motivo: `Erro ao inserir produto: ${insErr.message}`,
        })
      } else if (created) {
        localProdutos.push({
          id: created.id,
          nome: created.nome,
          reg: created.reg !== null && created.reg !== undefined ? Number(created.reg) : null,
          cod: created.cod || null,
          status: created.status || 'Ativo',
          modelo: created.modelo || null,
          categoria: created.categoria || null,
          fabricante: created.fabricante || null,
          categoria_nome: created.categoria_nome || null,
          deleted_at: null,
        })
        report.produtosCriados++
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
