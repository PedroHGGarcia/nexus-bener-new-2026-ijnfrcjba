import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import { supabase } from '@/lib/supabase/client'

async function loadSheetJS(): Promise<any> {
  return XLSX
}

export interface ParsedModeloRow {
  lineNumber: number
  reg?: number | null
  cod?: string | null
  nome: string
  status?: string | null
  marcaNome?: string | null
  categoriaNome?: string | null
  produtoNome?: string | null
  parseError?: string
  raw?: Record<string, unknown> | unknown[]
  hasField: {
    reg: boolean
    cod: boolean
    nome: boolean
    status: boolean
    marca: boolean
    categoria: boolean
    produto: boolean
  }
}

export interface ParsedModelosSpreadsheetResult {
  sheetName?: string
  totalRows: number
  previewRows: ParsedModeloRow[]
  allRows: ParsedModeloRow[]
  availableSheets?: string[]
}

export interface ModeloImportPendencia {
  lineNumber: number
  identificador: string
  motivo: string
}

export interface ModeloImportReport {
  modelosCriados: number
  modelosAtualizados: number
  modelosSemAlteracao: number
  totalLinhasProcessadas: number
  vinculadosPorColunaProduto: number
  vinculadosPorDeducaoNome: number
  semProdutoDefinido: number
  pendenciasProdutoNaoEncontrado: number
  pendenciasProdutoAmbiguo: number
  pendencias: ModeloImportPendencia[]
  errosGerais?: string[]
}

export interface ModeloImportProgress {
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

function mapRowToParsedModelo(
  getVal: (keySynonyms: string[]) => { value: string; exists: boolean },
  lineNumber: number,
  raw: Record<string, unknown> | unknown[],
  parseError?: string,
): ParsedModeloRow {
  const regLookup = getVal(['reg', 'registro', 'num_reg', 'numero_reg', 'reg_id', 'id_reg'])
  const codLookup = getVal([
    'cod',
    'codigo',
    'cod_modelo',
    'codmodelo',
    'codigo_modelo',
    'cod_erp',
    'coderp',
  ])
  const nomeLookup = getVal(['nome', 'modelo', 'modelos', 'nome_modelo', 'nomemodelo', 'descricao'])
  const statusLookup = getVal(['status', 'situacao', 'ativo', 'estado'])
  const marcaLookup = getVal([
    'marca',
    'marcas',
    'fabricante',
    'nome_marca',
    'nomemarca',
    'marca_nome',
  ])
  const categoriaLookup = getVal(['categoria', 'categorias', 'categoria_nome', 'nome_categoria'])
  const produtoLookup = getVal(['produto', 'produtos', 'produto_nome', 'nome_produto'])

  const parsedReg = regLookup.exists ? parseNumberValue(regLookup.value) : null
  const parsedCod = codLookup.exists && codLookup.value.trim() ? codLookup.value.trim() : null
  const parsedNome = nomeLookup.value.trim()
  const parsedStatus =
    statusLookup.exists && statusLookup.value.trim() ? normalizeStatus(statusLookup.value) : 'Ativo'
  const parsedMarca =
    marcaLookup.exists && marcaLookup.value.trim() ? marcaLookup.value.trim() : null
  const parsedCategoria =
    categoriaLookup.exists && categoriaLookup.value.trim() ? categoriaLookup.value.trim() : null
  const parsedProduto =
    produtoLookup.exists && produtoLookup.value.trim() ? produtoLookup.value.trim() : null

  return {
    lineNumber,
    reg: parsedReg,
    cod: parsedCod,
    nome: parsedNome,
    status: parsedStatus,
    marcaNome: parsedMarca,
    categoriaNome: parsedCategoria,
    produtoNome: parsedProduto,
    parseError,
    raw,
    hasField: {
      reg: regLookup.exists && regLookup.value.trim() !== '',
      cod: codLookup.exists && codLookup.value.trim() !== '',
      nome: nomeLookup.exists && nomeLookup.value.trim() !== '',
      status: statusLookup.exists && statusLookup.value.trim() !== '',
      marca: marcaLookup.exists && marcaLookup.value.trim() !== '',
      categoria: categoriaLookup.exists && categoriaLookup.value.trim() !== '',
      produto: produtoLookup.exists && produtoLookup.value.trim() !== '',
    },
  }
}

export async function parseCSVFile(
  file: File,
  encoding = 'UTF-8',
): Promise<ParsedModelosSpreadsheetResult> {
  return new Promise((resolve, reject) => {
    const rows: ParsedModeloRow[] = []
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
            findHeaderMatch(map, ['nome', 'modelo', 'modelos', 'descricao']) !== undefined
          const hasReg = findHeaderMatch(map, ['reg', 'registro', 'cod', 'codigo']) !== undefined
          const hasMarca = findHeaderMatch(map, ['marca', 'marcas', 'fabricante']) !== undefined
          const hasProduto =
            findHeaderMatch(map, ['produto', 'produtos', 'produto_nome', 'nome_produto']) !==
            undefined

          if (hasNome || hasReg || hasMarca || hasProduto || lineNumber === 1) {
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

        const parsed = mapRowToParsedModelo(getVal, lineNumber, rawRow)
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
): Promise<ParsedModelosSpreadsheetResult> {
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

    const hasNome = findHeaderMatch(map, ['nome', 'modelo', 'modelos', 'descricao']) !== undefined
    const hasReg = findHeaderMatch(map, ['reg', 'registro', 'cod', 'codigo']) !== undefined
    const hasMarca = findHeaderMatch(map, ['marca', 'marcas', 'fabricante']) !== undefined
    const hasProduto =
      findHeaderMatch(map, ['produto', 'produtos', 'produto_nome', 'nome_produto']) !== undefined

    if (hasNome || hasReg || hasMarca || hasProduto) {
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

  const rows: ParsedModeloRow[] = []

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
    const parsed = mapRowToParsedModelo(getVal, lineNumber, rawRow)
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

export async function parseModelosImportFile(
  file: File,
  targetSheetName?: string,
): Promise<ParsedModelosSpreadsheetResult> {
  const fileName = file.name.toLowerCase()
  if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
    return parseXLSXFile(file, targetSheetName)
  }
  return parseCSVFile(file)
}

export interface ProcessModelosImportOptions {
  userName?: string
  userId?: string
  onProgress?: (progress: ModeloImportProgress) => void
}

interface LocalModelo {
  id: string
  nome: string
  reg: number | null
  cod: string | null
  marca: string | null
  produto: string | null
  status: string
  categoria_nome: string | null
  deleted_at: string | null
}

interface LocalMarca {
  id: string
  nome: string
  reg: number | null
  cod: number | null
}

export interface LocalProduto {
  id: string
  nome: string
  normNome: string
  keyNome: string
}

export type ResolveProdutoResult =
  | { status: 'found'; produto: LocalProduto }
  | { status: 'ambiguous'; query: string; candidates: LocalProduto[] }
  | { status: 'not_found'; query: string }

/**
 * Resolução tolerante e criteriosa do produto pelo nome da coluna:
 * 1. Match exato normalizado (NFD, lowercase, espaços extras)
 * 2. Match por chave alfanumérica (ignora pontuação, barras, hífen, etc.)
 * 3. Se casar com mais de um produto cadastrado -> status 'ambiguous'
 * 4. Jamais cria produto novo -> se não casar, status 'not_found'
 */
export function resolverProdutoPorNomeColuna(
  rawProdName: string | null | undefined,
  produtos: LocalProduto[],
): ResolveProdutoResult {
  if (!rawProdName || !rawProdName.trim()) {
    return { status: 'not_found', query: '' }
  }

  const query = rawProdName.trim()
  const normQuery = normalizeStringMatch(query)

  // 1. Match exato normalizado (acentos NFD, caixa, espaços)
  if (normQuery) {
    const exactMatches = produtos.filter((p) => p.normNome === normQuery)
    if (exactMatches.length === 1) {
      return { status: 'found', produto: exactMatches[0] }
    }
    if (exactMatches.length > 1) {
      return { status: 'ambiguous', query, candidates: exactMatches }
    }
  }

  // 2. Match por chave alfanumérica tolerante (ignora barras, traços, pontuação)
  const keyQuery = normalizeKey(query)
  if (keyQuery && keyQuery.length >= 2) {
    const keyMatches = produtos.filter((p) => p.keyNome === keyQuery)
    if (keyMatches.length === 1) {
      return { status: 'found', produto: keyMatches[0] }
    }
    if (keyMatches.length > 1) {
      return { status: 'ambiguous', query, candidates: keyMatches }
    }
  }

  return { status: 'not_found', query }
}

/**
 * Dedução conservadora de produto pelo nome do modelo:
 * (i) considerar match apenas se o nome de um produto estiver CONTIDO no nome do modelo OU vice-versa;
 * (ii) só vincular se houver EXATAMENTE UM candidato — se houver 2 ou mais candidatos empatando, NÃO vincula;
 * (iii) em caso de múltiplos candidatos por contenção, preferir o produto com nome mais longo (mais específico)
 *      apenas se for estritamente mais longo que todos os outros (comprimento único); senão não vincula.
 */
export function deduzirProdutoPorNomeModelo(
  modeloNome: string,
  produtos: LocalProduto[],
): LocalProduto | null {
  if (!modeloNome || !modeloNome.trim() || produtos.length === 0) {
    return null
  }

  const modNorm = normalizeStringMatch(modeloNome)
  if (!modNorm || modNorm.length < 2) return null

  // Encontra todos os produtos contidos no nome do modelo OU que contenham o nome do modelo
  const candidatos = produtos.filter((p) => {
    if (!p.normNome || p.normNome.length < 2) return false
    return modNorm.includes(p.normNome) || p.normNome.includes(modNorm)
  })

  if (candidatos.length === 0) {
    return null
  }

  // Se houver exatamente um candidato, vincula
  if (candidatos.length === 1) {
    return candidatos[0]
  }

  // Se houver 2 ou mais produtos empatando:
  // Preferir o produto com nome mais longo (mais específico) APENAS se for estritamente mais específico que os outros
  const sorted = [...candidatos].sort((a, b) => b.normNome.length - a.normNome.length)
  const maxLength = sorted[0].normNome.length
  const topCandidatos = sorted.filter((c) => c.normNome.length === maxLength)

  // Apenas se houver um vencedor único de maior comprimento
  if (topCandidatos.length === 1) {
    return topCandidatos[0]
  }

  // Empate sem vencedor estrito: regra conservadora => não vincula
  return null
}

/**
 * Match strategy for Modelos:
 * 1st: reg (numeric match)
 * 2nd: cod (string normalized match)
 * 3rd: nome (tolerant to accents and case)
 *
 * Brand resolution:
 * Resolves brand name against marcas table (accent and case insensitive).
 * If brand is not found, marks the row as pending without creating the brand.
 *
 * If model exists: UPDATE (empty columns in file DO NOT overwrite or delete DB values).
 * If model does not exist: INSERT with status default "Ativo".
 */
export async function processarImportacaoModelos(
  rows: ParsedModeloRow[],
  options: ProcessModelosImportOptions = {},
): Promise<ModeloImportReport> {
  const { onProgress } = options
  const total = rows.length

  const report: ModeloImportReport = {
    modelosCriados: 0,
    modelosAtualizados: 0,
    modelosSemAlteracao: 0,
    totalLinhasProcessadas: 0,
    vinculadosPorColunaProduto: 0,
    vinculadosPorDeducaoNome: 0,
    semProdutoDefinido: 0,
    pendenciasProdutoNaoEncontrado: 0,
    pendenciasProdutoAmbiguo: 0,
    pendencias: [],
    errosGerais: [],
  }

  if (total === 0) return report

  onProgress?.({
    stage: 'carregando_dados',
    current: 0,
    total,
    percentage: 5,
    message: 'Carregando marcas, produtos e modelos existentes...',
  })

  // 1. Fetch marcas for FK resolution
  const { data: marcasRaw, error: marcasErr } = await supabase
    .from('marcas')
    .select('id, nome, reg, cod')
    .is('deleted_at', null)

  if (marcasErr) {
    throw new Error(`Erro ao consultar marcas: ${marcasErr.message}`)
  }

  const localMarcas: LocalMarca[] = (marcasRaw || []).map((m: any) => ({
    id: m.id,
    nome: m.nome,
    reg: m.reg !== null && m.reg !== undefined ? Number(m.reg) : null,
    cod: m.cod !== null && m.cod !== undefined ? Number(m.cod) : null,
  }))

  // 2. Fetch produtos for direct FK resolution and name deduction
  const { data: produtosRaw, error: prodErr } = await supabase
    .from('produtos')
    .select('id, nome')
    .is('deleted_at', null)

  if (prodErr) {
    throw new Error(`Erro ao consultar produtos: ${prodErr.message}`)
  }

  const localProdutos: LocalProduto[] = (produtosRaw || []).map((p: any) => ({
    id: p.id,
    nome: p.nome,
    normNome: normalizeStringMatch(p.nome),
    keyNome: normalizeKey(p.nome),
  }))

  // 3. Fetch existing modelos
  const { data: existingModelosRaw, error: modErr } = await (
    supabase.from('modelos') as any
  ).select('id, nome, reg, cod, marca, produto, status, categoria_nome, deleted_at')

  if (modErr) {
    throw new Error(`Erro ao consultar modelos existentes: ${modErr.message}`)
  }

  const localModelos: LocalModelo[] = (existingModelosRaw || []).map((m: any) => ({
    id: m.id,
    nome: m.nome,
    reg: m.reg !== null && m.reg !== undefined ? Number(m.reg) : null,
    cod: m.cod !== null && m.cod !== undefined ? String(m.cod).trim() : null,
    marca: m.marca || null,
    produto: m.produto || null,
    status: m.status || 'Ativo',
    categoria_nome: m.categoria_nome || null,
    deleted_at: m.deleted_at || null,
  }))

  // Helper to find brand ID by name (case- and accent-insensitive)
  const findMarcaId = (rawMarcaName: string | null | undefined): string | null => {
    if (!rawMarcaName || !rawMarcaName.trim()) return null
    const norm = normalizeStringMatch(rawMarcaName)
    const key = normalizeKey(rawMarcaName)

    const found = localMarcas.find((m) => {
      const mNorm = normalizeStringMatch(m.nome)
      if (mNorm === norm) return true
      const mKey = normalizeKey(m.nome)
      return mKey.length >= 2 && mKey === key
    })

    return found ? found.id : null
  }

  onProgress?.({
    stage: 'processando',
    current: 0,
    total,
    percentage: 15,
    message: 'Iniciando correspondência e atualização dos modelos...',
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

    // Validation: model name is mandatory
    if (!row.nome || !row.nome.trim()) {
      report.pendencias.push({
        lineNumber: row.lineNumber,
        identificador:
          row.reg !== null && row.reg !== undefined
            ? `Reg: ${row.reg}`
            : row.cod
              ? `Cód: ${row.cod}`
              : `Linha ${row.lineNumber}`,
        motivo: 'Linha sem nome do modelo informado.',
      })
      continue
    }

    // Resolve Brand
    let resolvedMarcaId: string | null = null
    if (row.hasField.marca && row.marcaNome) {
      resolvedMarcaId = findMarcaId(row.marcaNome)
      if (!resolvedMarcaId) {
        report.pendencias.push({
          lineNumber: row.lineNumber,
          identificador: row.nome,
          motivo: `Marca não encontrada: ${row.marcaNome}`,
        })
        continue
      }
    }

    // Resolve Product:
    // (a) Coluna preenchida com texto: resolver por nome contra a tabela produtos com casamento tolerante.
    //     - Se casar com mais de um -> não vincula e registra pendência ("Produto ambíguo").
    //     - Se não encontrar -> registra pendência ("Produto não encontrado"), sem abortar salvamento.
    // (b) Coluna vazia ou ausente: fallback de dedução conservadora pelo nome do modelo.
    let resolvedProdutoId: string | null = null
    let produtoResolvidoPor: 'coluna' | 'deducao' | 'preservado' | null = null

    const hasExplicitProdutoValue =
      row.hasField.produto && Boolean(row.produtoNome && row.produtoNome.trim())

    if (hasExplicitProdutoValue) {
      const prodRes = resolverProdutoPorNomeColuna(row.produtoNome, localProdutos)
      if (prodRes.status === 'found') {
        resolvedProdutoId = prodRes.produto.id
        produtoResolvidoPor = 'coluna'
      } else if (prodRes.status === 'ambiguous') {
        report.pendenciasProdutoAmbiguo++
        const candNomes = prodRes.candidates.map((c) => `"${c.nome}"`).join(', ')
        report.pendencias.push({
          lineNumber: row.lineNumber,
          identificador: row.nome,
          motivo: `Produto ambíguo ("${row.produtoNome}"): múltiplos produtos cadastrados correspondem (${candNomes}). Vínculo não realizado.`,
        })
        // Não aborta salvamento do modelo; apenas não vincula
      } else {
        report.pendenciasProdutoNaoEncontrado++
        report.pendencias.push({
          lineNumber: row.lineNumber,
          identificador: row.nome,
          motivo: `Produto não encontrado: "${row.produtoNome}". Verifique se o produto está cadastrado no catálogo.`,
        })
        // Não aborta salvamento do modelo; não vincula produto não existente (nunca cria automaticamente)
      }
    } else {
      // Fallback: coluna de produtos veio vazia/ausente -> tentar dedução conservadora pelo nome do modelo
      const deduzido = deduzirProdutoPorNomeModelo(row.nome, localProdutos)
      if (deduzido) {
        resolvedProdutoId = deduzido.id
        produtoResolvidoPor = 'deducao'
      }
    }

    // Find match:
    // 1st: reg (numeric match)
    // 2nd: cod (string match)
    // 3rd: nome (tolerant to accents and case)
    let matchedModelo: LocalModelo | undefined

    if (row.reg !== null && row.reg !== undefined) {
      matchedModelo = localModelos.find((m) => m.reg !== null && m.reg === row.reg && !m.deleted_at)
    }

    if (!matchedModelo && row.cod) {
      const normCod = normalizeKey(row.cod)
      matchedModelo = localModelos.find(
        (m) => m.cod && normalizeKey(m.cod) === normCod && !m.deleted_at,
      )
    }

    if (!matchedModelo && row.nome) {
      const normRowNome = normalizeStringMatch(row.nome)
      const keyRowNome = normalizeKey(row.nome)
      matchedModelo = localModelos.find((m) => {
        if (m.deleted_at) return false
        const mNorm = normalizeStringMatch(m.nome)
        if (mNorm === normRowNome) return true
        const mKey = normalizeKey(m.nome)
        return mKey.length >= 3 && mKey === keyRowNome
      })
    }

    if (matchedModelo) {
      // UPDATE EXISTING
      // Empty fields in the incoming row DO NOT overwrite/erase existing data in DB
      // Se já tem produto e o arquivo não traz valor na coluna produtos, preservar o vínculo existente no banco
      // (Regra padrão: célula vazia = não destrutiva, não apaga vínculo existente)
      let finalProdutoId = matchedModelo.produto
      let produtoContabilizado: 'coluna' | 'deducao' | 'preservado' | null = null

      if (hasExplicitProdutoValue) {
        // Coluna preenchida explicitamente no arquivo
        if (resolvedProdutoId) {
          finalProdutoId = resolvedProdutoId
          produtoContabilizado = 'coluna'
        } else {
          // Produto informado na coluna não foi encontrado ou é ambíguo:
          // Mantém o produto que já existia no banco sem sobrescrever nem apagar
          finalProdutoId = matchedModelo.produto
          produtoContabilizado = matchedModelo.produto ? 'preservado' : null
        }
      } else if (matchedModelo.produto) {
        // Célula vazia no arquivo, preserva vínculo existente no banco
        finalProdutoId = matchedModelo.produto
        produtoContabilizado = 'preservado'
      } else if (resolvedProdutoId) {
        // Modelo existente não tinha produto no banco, mas a dedução conservadora pelo nome encontrou
        finalProdutoId = resolvedProdutoId
        produtoContabilizado = 'deducao'
      }

      const updates: {
        nome?: string
        reg?: number | null
        cod?: string | null
        status?: string
        marca?: string | null
        produto?: string | null
        categoria_nome?: string | null
        updated_at?: string
      } = {}
      let hasChanges = false

      if (row.hasField.nome && row.nome.trim() && row.nome.trim() !== matchedModelo.nome) {
        updates.nome = row.nome.trim()
        hasChanges = true
      }

      if (
        row.hasField.reg &&
        row.reg !== null &&
        row.reg !== undefined &&
        row.reg !== matchedModelo.reg
      ) {
        updates.reg = row.reg
        hasChanges = true
      }

      if (row.hasField.cod && row.cod && row.cod !== matchedModelo.cod) {
        updates.cod = row.cod
        hasChanges = true
      }

      if (row.hasField.status && row.status && row.status !== matchedModelo.status) {
        updates.status = row.status
        hasChanges = true
      }

      if (resolvedMarcaId && resolvedMarcaId !== matchedModelo.marca) {
        updates.marca = resolvedMarcaId
        hasChanges = true
      }

      if (finalProdutoId && finalProdutoId !== matchedModelo.produto) {
        updates.produto = finalProdutoId
        hasChanges = true
      }

      if (
        row.hasField.categoria &&
        row.categoriaNome &&
        row.categoriaNome !== matchedModelo.categoria_nome
      ) {
        updates.categoria_nome = row.categoriaNome
        hasChanges = true
      }

      if (!hasChanges) {
        report.modelosSemAlteracao++
      } else {
        updates.updated_at = new Date().toISOString()
        const { error: upErr } = await (supabase.from('modelos') as any)
          .update(updates)
          .eq('id', matchedModelo.id)

        if (upErr) {
          report.pendencias.push({
            lineNumber: row.lineNumber,
            identificador: row.nome,
            motivo: `Erro ao atualizar modelo: ${upErr.message}`,
          })
          continue
        } else {
          Object.assign(matchedModelo, updates)
          report.modelosAtualizados++
        }
      }

      // Contadores de relatório
      if (produtoContabilizado === 'coluna') {
        report.vinculadosPorColunaProduto++
      } else if (produtoContabilizado === 'deducao') {
        report.vinculadosPorDeducaoNome++
      } else if (!finalProdutoId) {
        report.semProdutoDefinido++
      }
    } else {
      // CREATE NEW
      const insertPayload: {
        nome: string
        status?: string
        reg?: number | null
        cod?: string | null
        marca?: string | null
        produto?: string | null
        categoria_nome?: string | null
      } = {
        nome: row.nome.trim(),
        status: row.status || 'Ativo',
      }

      if (row.hasField.reg && row.reg !== null && row.reg !== undefined) {
        insertPayload.reg = row.reg
      }
      if (row.hasField.cod && row.cod) {
        insertPayload.cod = row.cod
      }
      if (resolvedMarcaId) {
        insertPayload.marca = resolvedMarcaId
      }
      if (resolvedProdutoId) {
        insertPayload.produto = resolvedProdutoId
      }
      if (row.hasField.categoria && row.categoriaNome) {
        insertPayload.categoria_nome = row.categoriaNome
      }

      const { data: created, error: insErr } = await (supabase.from('modelos') as any)
        .insert(insertPayload)
        .select('id, nome, reg, cod, marca, produto, status, categoria_nome')
        .single()

      if (insErr) {
        report.pendencias.push({
          lineNumber: row.lineNumber,
          identificador: row.nome,
          motivo: `Erro ao inserir modelo: ${insErr.message}`,
        })
      } else if (created) {
        localModelos.push({
          id: created.id,
          nome: created.nome,
          reg: created.reg !== null && created.reg !== undefined ? Number(created.reg) : null,
          cod: created.cod !== null && created.cod !== undefined ? String(created.cod) : null,
          marca: created.marca || null,
          produto: created.produto || null,
          status: created.status || 'Ativo',
          categoria_nome: created.categoria_nome || null,
          deleted_at: null,
        })
        report.modelosCriados++

        if (produtoResolvidoPor === 'coluna') {
          report.vinculadosPorColunaProduto++
        } else if (produtoResolvidoPor === 'deducao') {
          report.vinculadosPorDeducaoNome++
        } else {
          report.semProdutoDefinido++
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
