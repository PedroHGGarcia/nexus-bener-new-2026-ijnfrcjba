import * as XLSX from 'xlsx'
import Papa from 'papaparse'
import { supabase } from '@/lib/supabase/client'
import { normalizeTipoPropostaNome } from '@/services/tipos-proposta'
import { TipoProposta, TipoPropostaInsert, TipoPropostaUpdate } from '@/types/tipo-proposta'
import { segmentParagraphMarkers, isSelfReferencingValue } from '@/lib/paragraphs'

export interface ConvertedFieldInfo {
  original: string
  converted: number | boolean | string
  display: string // e.g. "12,5 → 12.5"
}

export interface TextFallbackInfo {
  column: string
  label: string
  originalText: string
  targetField: string
}

export interface SelfReferencingClearedInfo {
  column: string
  label: string
  originalText: string
}

export interface CsvTipoPropostaRow {
  rawRowIndex: number
  reg?: string
  nome: string
  status?: string
  aplicar_fator_nac?: boolean
  comissao?: number
  frase_preco?: string
  frase_comissao?: string
  prazo_entrega?: string
  condicoes_pagamento?: string
  garantia?: string
  assistencia_tecnica?: string
  treinamento_tecnico?: string
  transporte_seguro?: string
  validade_oferta?: string
  imposto_ipi?: string
  imposto_icms?: string
  rawFields: Record<string, string>
  validationErrors: string[]
  action: 'update' | 'insert' | 'skip'
  existingId?: string
  existingRecord?: TipoProposta
  changesToApply?: Record<string, any>
  matchMethod?: 'exact' | 'normalized' | 'alphanumeric' | 'fuzzy'
  matchedDbName?: string
  nameDiffers?: boolean
  namePreservedNotice?: string
  isCollision?: boolean
  collisionWithRow?: number
  collisionDbName?: string
  collisionMessage?: string
  collidingOtherRows?: number[]
  collidingOtherRowsMessage?: string
  conversions?: Record<string, ConvertedFieldInfo> // column -> conversion details
  textFallbacks?: TextFallbackInfo[] // numeric columns that contained descriptive text redirected to campos_adicionais
  selfReferencingCleared?: SelfReferencingClearedInfo[] // Point 10: fields where value repeated column name and was cleared
}

export interface TargetFieldDefinition {
  key: string
  label: string
  description: string
  isKey?: boolean
  type?: 'text' | 'number' | 'boolean' | 'status'
}

export const TARGET_FIELDS: TargetFieldDefinition[] = [
  {
    key: 'nome',
    label: 'Nome do Tipo (Chave de busca)',
    description: 'Chave única de correspondência com o banco. Obrigatório.',
    isKey: true,
    type: 'text',
  },
  {
    key: 'status',
    label: 'Status (Ativo / Inativo)',
    description: 'Aceita Ativo, Inativo, 1, 0, etc. Vazio mantém atual.',
    type: 'status',
  },
  {
    key: 'aplicar_fator_nac',
    label: 'Aplicar Fator Nacionalização',
    description: 'S/Sim/1/True = Sim; N/Não/0/False = Não.',
    type: 'boolean',
  },
  {
    key: 'comissao',
    label: 'Comissão (%)',
    description: 'Percentual de comissão (ex: 5,5% ou 5.5).',
    type: 'number',
  },
  {
    key: 'frase_preco',
    label: 'Frase do Preço',
    description: 'Texto explicativo do preço da proposta.',
    type: 'text',
  },
  {
    key: 'frase_comissao',
    label: 'Frase da Comissão',
    description: 'Texto explicativo da comissão.',
    type: 'text',
  },
  {
    key: 'prazo_entrega',
    label: 'Prazo de Entrega',
    description: 'Texto descritivo do prazo de entrega.',
    type: 'text',
  },
  {
    key: 'condicoes_pagamento',
    label: 'Condições de Pagamento',
    description: 'Texto descritivo de pagamento e parcelamento.',
    type: 'text',
  },
  {
    key: 'garantia',
    label: 'Garantia',
    description: 'Cláusulas e prazos de garantia.',
    type: 'text',
  },
  {
    key: 'assistencia_tecnica',
    label: 'Assistência Técnica',
    description: 'Informações e condições de assistência técnica.',
    type: 'text',
  },
  {
    key: 'treinamento_tecnico',
    label: 'Treinamento Técnico',
    description: 'Informações sobre treinamento operacional/técnico.',
    type: 'text',
  },
  {
    key: 'transporte_seguro',
    label: 'Transporte e Seguro',
    description: 'Condições de frete e seguro do equipamento.',
    type: 'text',
  },
  {
    key: 'validade_oferta',
    label: 'Validade da Oferta',
    description: 'Prazo de validade padrão da proposta.',
    type: 'text',
  },
  {
    key: 'imposto_ipi',
    label: 'Imposto IPI',
    description: 'Texto descritivo ou alíquota de IPI (com decretos e formatação exata).',
    type: 'text',
  },
  {
    key: 'imposto_icms',
    label: 'Imposto ICMS',
    description: 'Texto descritivo ou alíquota de ICMS (com convênios e formatação exata).',
    type: 'text',
  },
]

export interface HeaderMappingDefinition {
  csvHeader: string
  dbColumn: string | null // null means ignored/not mapped to DB
  label: string
  description: string
  isMapped: boolean
  isKey?: boolean
}

export type CsvDelimiter = ';' | ',' | '\t'

export interface ParseTiposPropostaResult {
  headers: string[]
  rawRows: Record<string, string>[]
  mapping: HeaderMappingDefinition[]
  unmappedHeaders: string[]
  rows: CsvTipoPropostaRow[]
  totalRows: number
  validCount: number
  updateCount: number
  insertCount: number
  errorCount: number
  collisionCount: number
  missingKeyColumn: boolean
  detectedDelimiter?: CsvDelimiter
  encodingUsed?: string
}

export interface ImportRowResult {
  row: number
  nome: string
  status: 'atualizado' | 'criado' | 'pulado' | 'erro'
  motivo: string
}

export interface ImportExecutionReport {
  totalRows: number
  updatedCount: number
  createdCount: number
  skippedCount: number
  errorCount: number
  items: ImportRowResult[]
  errors: Array<{ row: number; nome?: string; error: string }>
}

/**
 * Normalizes header string for comparison
 */
export function normalizeHeader(h: string): string {
  return h
    .replace(/[\u200B-\u200D\uFEFF]/g, '') // remove zero-width chars & BOM
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_]/g, '')
}

/**
 * Normalizes text for accent-insensitive, case-insensitive comparison
 */
export function normalizeStringMatch(str: string | null | undefined): string {
  if (!str) return ''
  return str
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Normalizes string for ultra-tolerant matching (strips all punctuation, dashes, spaces, accents)
 */
export function normalizeKey(str: string | null | undefined): string {
  return normalizeStringMatch(str).replace(/[^a-z0-9]/g, '')
}

/**
 * Finds best matching existing TipoProposta with multi-tier tolerance:
 * 1. Exact string match
 * 2. Accent-insensitive & whitespace-collapsed match
 * 3. Alphanumeric-only key match (ignores hyphens, colons, underscores, slashes, extra spaces)
 */
export function findMatchingTipoProposta(
  candidateName: string,
  existingTipos: TipoProposta[],
): { tipo?: TipoProposta; method?: 'exact' | 'normalized' | 'alphanumeric' } {
  if (!candidateName || !candidateName.trim()) return {}
  const clean = candidateName.trim()

  // 1. Exact match (case-sensitive first, then case-insensitive)
  const exact = existingTipos.find((t) => t.nome?.trim() === clean)
  if (exact) return { tipo: exact, method: 'exact' }

  const exactCi = existingTipos.filter((t) => t.nome?.trim().toLowerCase() === clean.toLowerCase())
  if (exactCi.length === 1) return { tipo: exactCi[0], method: 'exact' }

  // 2. Accent-insensitive + lower + whitespace collapsed
  const normCandidate = normalizeStringMatch(clean)
  if (normCandidate) {
    const normMatches = existingTipos.filter((t) => normalizeStringMatch(t.nome) === normCandidate)
    if (normMatches.length === 1) return { tipo: normMatches[0], method: 'normalized' }
  }

  // 3. Alphanumeric key (ignoring symbols: "-", ":", "/", "_", spaces)
  // Only match if UNAMBIGUOUS (exactly 1 match across all existing types)
  const keyCandidate = normalizeKey(clean)
  if (keyCandidate && keyCandidate.length >= 3) {
    const keyMatches = existingTipos.filter((t) => normalizeKey(t.nome) === keyCandidate)
    if (keyMatches.length === 1) return { tipo: keyMatches[0], method: 'alphanumeric' }
  }

  return {}
}

/**
 * Maps known headers to database columns
 */
export function mapHeaderToDbColumn(rawHeader: string): {
  dbColumn: string | null
  label: string
  description: string
} {
  const norm = normalizeHeader(rawHeader)

  if (norm === 'reg' || norm === 'registro' || norm === 'ordem') {
    return {
      dbColumn: null,
      label: 'Registro (Ignorado)',
      description: 'Identificador do export antigo. Apenas para referência.',
    }
  }
  if (
    norm === 'nome' ||
    norm === 'nometipo' ||
    norm === 'nome_tipo' ||
    norm === 'nomedotipo' ||
    norm === 'nome_do_tipo' ||
    norm === 'tipo' ||
    norm === 'tipos' ||
    norm === 'tipoproposta' ||
    norm === 'tipo_proposta' ||
    norm === 'tiposproposta' ||
    norm === 'tipos_propostas' ||
    norm === 'descricao' ||
    norm === 'descricaotipo' ||
    norm === 'descricao_tipo' ||
    norm === 'desc'
  ) {
    return {
      dbColumn: 'nome',
      label: 'Nome do Tipo',
      description: 'Chave de correspondência única no sistema.',
    }
  }
  if (norm === 'status' || norm === 'situacao') {
    return {
      dbColumn: 'status',
      label: 'Status',
      description: 'Aceita "Ativo" ou "Inativo". Vazio mantém atual.',
    }
  }
  if (
    norm === 'aplicar_fator' ||
    norm === 'aplicarfator' ||
    norm === 'fator_nacionalizacao' ||
    norm === 'fatornacionalizacao' ||
    norm === 'aplicar_fator_nac'
  ) {
    return {
      dbColumn: 'aplicar_fator_nac',
      label: 'Aplicar Fator Nac.',
      description: 'S/sim/true/1 = Sim; N/não/false/0 = Não.',
    }
  }
  if (
    norm === 'comissao_pct' ||
    norm === 'comissao' ||
    norm === 'comissaopct' ||
    norm === 'comissao_percent'
  ) {
    return {
      dbColumn: 'comissao',
      label: 'Comissão (%)',
      description: 'Percentual de comissão (ex: 5,5% ou 5.5).',
    }
  }
  if (norm === 'frase_preco' || norm === 'frasepreco') {
    return {
      dbColumn: 'frase_preco',
      label: 'Frase do Preço',
      description: 'Texto explicativo do preço da proposta.',
    }
  }
  if (norm === 'frase_comissao' || norm === 'frasecomissao') {
    return {
      dbColumn: 'frase_comissao',
      label: 'Frase da Comissão',
      description: 'Texto explicativo da comissão.',
    }
  }
  if (
    norm === 'dt_cad' ||
    norm === 'dtcad' ||
    norm === 'data_cadastro' ||
    norm === 'datacadastro'
  ) {
    return {
      dbColumn: null,
      label: 'Data de Cadastro (Ignorada)',
      description: 'Data do export original. Não sobrescreve data do banco.',
    }
  }
  if (norm === 'prazo_entrega' || norm === 'prazoentrega') {
    return {
      dbColumn: 'prazo_entrega',
      label: 'Prazo de Entrega',
      description: 'Texto padrão do prazo de entrega.',
    }
  }
  if (norm === 'condicoes_pagamento' || norm === 'condicoespagamento' || norm === 'pagamento') {
    return {
      dbColumn: 'condicoes_pagamento',
      label: 'Condições de Pagamento',
      description: 'Texto padrão de pagamento.',
    }
  }
  if (norm === 'garantia') {
    return {
      dbColumn: 'garantia',
      label: 'Garantia',
      description: 'Texto das cláusulas de garantia.',
    }
  }
  if (norm === 'assistencia_tecnica' || norm === 'assistenciatecnica' || norm === 'assistencia') {
    return {
      dbColumn: 'assistencia_tecnica',
      label: 'Assistência Técnica',
      description: 'Texto de assistência técnica.',
    }
  }
  if (norm === 'treinamento_tecnico' || norm === 'treinamentotecnico' || norm === 'treinamento') {
    return {
      dbColumn: 'treinamento_tecnico',
      label: 'Treinamento Técnico',
      description: 'Texto de treinamento técnico.',
    }
  }
  if (norm === 'transporte_seguro' || norm === 'transporteseguro' || norm === 'transporte') {
    return {
      dbColumn: 'transporte_seguro',
      label: 'Transporte e Seguro',
      description: 'Texto de transporte e seguro.',
    }
  }
  if (norm === 'validade_oferta' || norm === 'validadeoferta' || norm === 'validade') {
    return {
      dbColumn: 'validade_oferta',
      label: 'Validade da Oferta',
      description: 'Prazo de validade padrão da proposta.',
    }
  }
  if (norm === 'imposto_ipi' || norm === 'impostoipi' || norm === 'ipi') {
    return {
      dbColumn: 'imposto_ipi',
      label: 'Imposto IPI',
      description: 'Texto de imposto IPI / decreto.',
    }
  }
  if (norm === 'imposto_icms' || norm === 'impostoicms' || norm === 'icms') {
    return {
      dbColumn: 'imposto_icms',
      label: 'Imposto ICMS',
      description: 'Texto de imposto ICMS / convênio.',
    }
  }

  return {
    dbColumn: null,
    label: rawHeader,
    description: 'Não mapeado para o banco de dados. Será ignorado na gravação.',
  }
}

/**
 * Builds the initial suggested mapping based on file headers
 */
export function buildInitialMapping(headers: string[]): HeaderMappingDefinition[] {
  const chosenColumns = new Set<string>()

  return headers.map((hdr) => {
    const meta = mapHeaderToDbColumn(hdr)
    // Avoid assigning the same dbColumn to multiple headers in initial auto-detection
    let finalCol = meta.dbColumn
    if (finalCol && chosenColumns.has(finalCol)) {
      finalCol = null
    } else if (finalCol) {
      chosenColumns.add(finalCol)
    }

    const targetDef = TARGET_FIELDS.find((t) => t.key === finalCol)

    return {
      csvHeader: hdr,
      dbColumn: finalCol,
      label: targetDef ? targetDef.label : meta.label,
      description: targetDef ? targetDef.description : meta.description,
      isMapped: finalCol !== null,
      isKey: finalCol === 'nome',
    }
  })
}

/**
 * Recalculates preview rows from rawRows and a custom mapping definition
 */
export function computeRowsFromMapping(
  headers: string[],
  rawRows: Record<string, string>[],
  mapping: HeaderMappingDefinition[],
  existingTipos: TipoProposta[],
): ParseTiposPropostaResult {
  const unmappedHeaders = mapping.filter((m) => !m.isMapped).map((m) => m.csvHeader)
  const hasNomeMapped = mapping.some((m) => m.dbColumn === 'nome')

  const parsedRows: CsvTipoPropostaRow[] = []

  let updateCount = 0
  let insertCount = 0
  let errorCount = 0
  let collisionCount = 0

  // Track collisions:
  // existing.id -> line number (idx + 2) of the FIRST row that matched this DB record
  const seenDbIds = new Map<string, number>()
  // normalized new name -> line number of first occurrence for new inserts
  const seenNewNames = new Map<string, number>()
  // firstRowIndex -> array of subsequent line numbers that collided with it
  const collisionsPerFirstRow = new Map<number, number[]>()

  rawRows.forEach((row, idx) => {
    const errors: string[] = []

    const conversions: Record<string, ConvertedFieldInfo> = {}

    // Helper to get field value by mapped column name
    const getVal = (col: string): any => {
      const mapItem = mapping.find((m) => m.dbColumn === col)
      if (!mapItem) return undefined
      return row[mapItem.csvHeader]
    }

    const regHeader = mapping.find((m) => normalizeHeader(m.csvHeader) === 'reg')?.csvHeader
    const regVal = regHeader
      ? row[regHeader] !== undefined && row[regHeader] !== null
        ? String(row[regHeader]).trim()
        : undefined
      : undefined

    const rawNome = getVal('nome')
    const cleanedNome = parseTextField(rawNome, { collapseWhitespace: true }) || ''

    if (!hasNomeMapped) {
      errors.push(
        'Campo chave "Nome do Tipo" não está mapeado em nenhuma coluna — selecione na aba "Mapeamento Manual de Colunas" qual coluna contém o nome do tipo.',
      )
    } else if (!cleanedNome) {
      errors.push('Nome do tipo de proposta não informado (célula vazia no arquivo).')
    }

    // Status
    const rawStatus = getVal('status')
    let parsedStatus: 'Ativo' | 'Inativo' | undefined
    if (rawStatus !== undefined && rawStatus !== null && String(rawStatus).trim() !== '') {
      const res = parseStatusField(rawStatus)
      if (res.error) {
        errors.push(res.error)
      } else {
        parsedStatus = res.value
        const origStr = String(rawStatus).trim()
        if (origStr.toLowerCase() !== res.value?.toLowerCase()) {
          conversions.status = {
            original: origStr,
            converted: res.value!,
            display: `${origStr} → ${res.value}`,
          }
        }
      }
    }

    // Aplicar Fator Nac
    const rawFator = getVal('aplicar_fator_nac')
    let parsedFator: boolean | undefined
    if (rawFator !== undefined && rawFator !== null && String(rawFator).trim() !== '') {
      const res = parseBooleanField(rawFator)
      if (res.error) {
        errors.push(res.error)
      } else {
        parsedFator = res.value
        const origStr = String(rawFator).trim()
        conversions.aplicar_fator_nac = {
          original: origStr,
          converted: res.value!,
          display: `${origStr} → ${res.value ? 'Sim' : 'Não'}`,
        }
      }
    }

    const textFallbacks: TextFallbackInfo[] = []
    const pendingCamposAdicionais: Array<{ titulo: string; conteudo: string }> = []

    // Helper to process numeric columns with descriptive text fallback (used for comissao)
    const processNumericWithFallback = (
      colKey: 'comissao',
      fieldTitle: string,
    ): number | undefined => {
      const rawVal = getVal(colKey)
      if (rawVal === undefined || rawVal === null) return undefined
      const trimmed = String(rawVal).trim()
      if (trimmed === '') return undefined

      const res = parseNumberField(rawVal, colKey)
      if (res.value !== undefined) {
        if (res.originalFormatted) {
          conversions[colKey] = {
            original: res.originalFormatted,
            converted: res.value,
            display: `${res.originalFormatted} → ${res.value}`,
          }
        }
        return res.value
      }

      // If value could not be converted to number but is non-empty text:
      // DO NOT REJECT / ERROR! Store as custom additional field (campos_adicionais).
      // Preserve exact formatting/paragraphs of the fallback text (norm CRLF -> \n)
      const preservedFallbackText = String(rawVal)
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .replace(/^\n+|\n+$/g, '')

      const mapItem = mapping.find((m) => m.dbColumn === colKey)
      const label = mapItem?.label || fieldTitle
      textFallbacks.push({
        column: colKey,
        label,
        originalText: preservedFallbackText,
        targetField: fieldTitle,
      })
      pendingCamposAdicionais.push({
        titulo: fieldTitle,
        conteudo: preservedFallbackText,
      })
      return undefined
    }

    // Comissão (numeric)
    const parsedComissao = processNumericWithFallback('comissao', 'Comissão')

    const selfReferencingCleared: SelfReferencingClearedInfo[] = []

    // Helper Point 10: Limpa valores que repetem apenas o próprio nome da coluna.
    // Retorna undefined se o valor for nulo/vazio ou auto-referente ao cabeçalho.
    const cleanTextFieldWithSelfRefCheck = (
      colKey: string,
      defaultLabel: string,
      options?: { preserveExactFormatting?: boolean; collapseWhitespace?: boolean },
    ): string | undefined => {
      const raw = getVal(colKey)
      const parsed = parseTextField(raw, options)
      if (!parsed) return undefined

      const mapItem = mapping.find((m) => m.dbColumn === colKey)
      const label = mapItem?.label || defaultLabel
      const csvHdr = mapItem?.csvHeader || colKey

      // Checa contra o rótulo amigável, o cabeçalho original no CSV ou o nome da coluna DB
      if (
        isSelfReferencingValue(parsed, label) ||
        isSelfReferencingValue(parsed, csvHdr) ||
        isSelfReferencingValue(parsed, colKey)
      ) {
        selfReferencingCleared.push({
          column: colKey,
          label,
          originalText: parsed,
        })
        return undefined
      }

      return parsed
    }

    // IPI and ICMS are real database text columns (Point 2: do NOT divert to campos_adicionais).
    // Point 10: Value = column name repeated ("Imposto IPI" under "Imposto IPI") -> treated as empty.
    // Long decree texts and percentages must preserve exact paragraphs and spacing.
    const imposto_ipi = cleanTextFieldWithSelfRefCheck('imposto_ipi', 'Imposto IPI', {
      preserveExactFormatting: true,
    })
    const imposto_icms = cleanTextFieldWithSelfRefCheck('imposto_icms', 'Imposto ICMS', {
      preserveExactFormatting: true,
    })

    // Texts (convert numbers or texts safely, never rejecting numbers).
    // Point 4: Long text fields MUST preserve exact paragraphs, newlines, indents and spacing as in the uploaded file!
    // Point 10: Apply self-referencing check defensively to all text fields as well.
    const frase_preco = cleanTextFieldWithSelfRefCheck('frase_preco', 'Frase do Preço', {
      preserveExactFormatting: true,
    })
    const frase_comissao = cleanTextFieldWithSelfRefCheck('frase_comissao', 'Frase da Comissão', {
      preserveExactFormatting: true,
    })
    const prazo_entrega = cleanTextFieldWithSelfRefCheck('prazo_entrega', 'Prazo de Entrega', {
      preserveExactFormatting: true,
    })
    const condicoes_pagamento = cleanTextFieldWithSelfRefCheck(
      'condicoes_pagamento',
      'Condições de Pagamento',
      { preserveExactFormatting: true },
    )
    const garantia = cleanTextFieldWithSelfRefCheck('garantia', 'Garantia', {
      preserveExactFormatting: true,
    })
    const assistencia_tecnica = cleanTextFieldWithSelfRefCheck(
      'assistencia_tecnica',
      'Assistência Técnica',
      { preserveExactFormatting: true },
    )
    const treinamento_tecnico = cleanTextFieldWithSelfRefCheck(
      'treinamento_tecnico',
      'Treinamento Técnico',
      { preserveExactFormatting: true },
    )
    const transporte_seguro = cleanTextFieldWithSelfRefCheck(
      'transporte_seguro',
      'Transporte e Seguro',
      { preserveExactFormatting: true },
    )
    const validade_oferta = cleanTextFieldWithSelfRefCheck(
      'validade_oferta',
      'Validade da Oferta',
      {
        preserveExactFormatting: true,
      },
    )

    // Find existing match using multi-tier tolerance and unambiguous matching
    let existing: TipoProposta | undefined = undefined
    let matchMethod: 'exact' | 'normalized' | 'alphanumeric' | undefined = undefined

    if (cleanedNome) {
      const match = findMatchingTipoProposta(cleanedNome, existingTipos)
      existing = match.tipo
      matchMethod = match.method
    }

    let action: 'update' | 'insert' | 'skip' = 'skip'
    const changesToApply: Record<string, any> = {}
    let nameDiffers = false
    let namePreservedNotice: string | undefined = undefined
    let isCollision = false
    let collisionWithRow: number | undefined = undefined
    let collisionDbName: string | undefined = undefined
    let collisionMessage: string | undefined = undefined

    const currentRowNumber = idx + 2

    if (errors.length > 0) {
      action = 'skip'
      errorCount++
    } else if (existing) {
      const dbId = existing.id
      const isAlreadyClaimed = seenDbIds.has(dbId)

      if (isAlreadyClaimed) {
        // Collision! Multiple CSV lines matched the EXACT SAME database TipoProposta!
        // Requirement 3: apply only the first occurrence without error; mark this one as skipped collision
        const firstRowNumber = seenDbIds.get(dbId)!
        const collidingList = collisionsPerFirstRow.get(firstRowNumber) || []
        collidingList.push(currentRowNumber)
        collisionsPerFirstRow.set(firstRowNumber, collidingList)

        action = 'skip'
        isCollision = true
        collisionWithRow = firstRowNumber
        collisionDbName = existing.nome
        collisionMessage = `Esta linha e a linha #${firstRowNumber} casam com o mesmo tipo "${existing.nome}". Apenas a linha #${firstRowNumber} será aplicada.`
        collisionCount++
      } else {
        // First occurrence: register this DB id to this row
        seenDbIds.set(dbId, currentRowNumber)
        collisionsPerFirstRow.set(currentRowNumber, [])
        action = 'update'
        updateCount++

        // Requirement 2: Do NOT change "nome" on update! Name is the key and must remain the existing DB name.
        if (cleanedNome.trim() !== existing.nome.trim()) {
          nameDiffers = true
          namePreservedNotice = `Nome no arquivo difere; manterá o nome cadastrado "${existing.nome}"`
        }

        // Only prepare changes for non-empty CSV values!
        if (parsedStatus !== undefined && parsedStatus !== existing.status) {
          changesToApply.status = parsedStatus
        }
        if (parsedFator !== undefined && parsedFator !== existing.aplicar_fator_nac) {
          changesToApply.aplicar_fator_nac = parsedFator
        }
        if (parsedComissao !== undefined && parsedComissao !== existing.comissao) {
          changesToApply.comissao = parsedComissao
        }
        if (
          imposto_ipi !== undefined &&
          imposto_ipi !== '' &&
          imposto_ipi !== existing.imposto_ipi
        ) {
          changesToApply.imposto_ipi = imposto_ipi
        }
        if (
          imposto_icms !== undefined &&
          imposto_icms !== '' &&
          imposto_icms !== existing.imposto_icms
        ) {
          changesToApply.imposto_icms = imposto_icms
        }
        if (
          frase_preco !== undefined &&
          frase_preco !== '' &&
          frase_preco !== existing.frase_preco
        ) {
          changesToApply.frase_preco = frase_preco
        }
        if (
          frase_comissao !== undefined &&
          frase_comissao !== '' &&
          frase_comissao !== existing.frase_comissao
        ) {
          changesToApply.frase_comissao = frase_comissao
        }
        if (
          prazo_entrega !== undefined &&
          prazo_entrega !== '' &&
          prazo_entrega !== existing.prazo_entrega
        ) {
          changesToApply.prazo_entrega = prazo_entrega
        }
        if (
          condicoes_pagamento !== undefined &&
          condicoes_pagamento !== '' &&
          condicoes_pagamento !== existing.condicoes_pagamento
        ) {
          changesToApply.condicoes_pagamento = condicoes_pagamento
        }
        if (garantia !== undefined && garantia !== '' && garantia !== existing.garantia) {
          changesToApply.garantia = garantia
        }
        if (
          assistencia_tecnica !== undefined &&
          assistencia_tecnica !== '' &&
          assistencia_tecnica !== existing.assistencia_tecnica
        ) {
          changesToApply.assistencia_tecnica = assistencia_tecnica
        }
        if (
          treinamento_tecnico !== undefined &&
          treinamento_tecnico !== '' &&
          treinamento_tecnico !== existing.treinamento_tecnico
        ) {
          changesToApply.treinamento_tecnico = treinamento_tecnico
        }
        if (
          transporte_seguro !== undefined &&
          transporte_seguro !== '' &&
          transporte_seguro !== existing.transporte_seguro
        ) {
          changesToApply.transporte_seguro = transporte_seguro
        }
        if (
          validade_oferta !== undefined &&
          validade_oferta !== '' &&
          validade_oferta !== existing.validade_oferta
        ) {
          changesToApply.validade_oferta = validade_oferta
        }

        // Merge descriptive text saved into campos_adicionais
        if (pendingCamposAdicionais.length > 0) {
          const existingExtras: Array<{ titulo: string; conteudo: string }> = []
          if (existing.campos_adicionais) {
            try {
              const parsed =
                typeof existing.campos_adicionais === 'string'
                  ? JSON.parse(existing.campos_adicionais)
                  : existing.campos_adicionais
              if (Array.isArray(parsed)) {
                parsed.forEach((item: any) => {
                  const t = item?.titulo || item?.chave
                  const c = item?.conteudo || item?.valor
                  if (t && c) existingExtras.push({ titulo: String(t), conteudo: String(c) })
                })
              }
            } catch {
              // ignore parse errors
            }
          }

          // Merge or append pending fields
          const merged = [...existingExtras]
          for (const pending of pendingCamposAdicionais) {
            const idx = merged.findIndex(
              (m) => m.titulo.trim().toLowerCase() === pending.titulo.trim().toLowerCase(),
            )
            if (idx >= 0) {
              merged[idx] = pending
            } else {
              merged.push(pending)
            }
          }
          changesToApply.campos_adicionais = merged
        }
      }
    } else {
      // New candidate record
      const normNewName = normalizeStringMatch(cleanedNome)
      if (seenNewNames.has(normNewName)) {
        // Collision among new types in the file
        const firstRowNumber = seenNewNames.get(normNewName)!
        action = 'skip'
        isCollision = true
        collisionWithRow = firstRowNumber
        collisionDbName = cleanedNome
        collisionMessage = `Esta linha e a linha #${firstRowNumber} possuem o mesmo nome "${cleanedNome}". Apenas a linha #${firstRowNumber} será considerada.`
        collisionCount++
      } else {
        seenNewNames.set(normNewName, currentRowNumber)
        action = 'insert'
        insertCount++

        changesToApply.nome = cleanedNome
        changesToApply.status = parsedStatus || 'Ativo'
        changesToApply.aplicar_fator_nac = parsedFator ?? false
        changesToApply.comissao = parsedComissao ?? 0
        if (imposto_ipi) changesToApply.imposto_ipi = imposto_ipi
        if (imposto_icms) changesToApply.imposto_icms = imposto_icms
        if (frase_preco) changesToApply.frase_preco = frase_preco
        if (frase_comissao) changesToApply.frase_comissao = frase_comissao
        if (prazo_entrega) changesToApply.prazo_entrega = prazo_entrega
        if (condicoes_pagamento) changesToApply.condicoes_pagamento = condicoes_pagamento
        if (garantia) changesToApply.garantia = garantia
        if (assistencia_tecnica) changesToApply.assistencia_tecnica = assistencia_tecnica
        if (treinamento_tecnico) changesToApply.treinamento_tecnico = treinamento_tecnico
        if (transporte_seguro) changesToApply.transporte_seguro = transporte_seguro
        if (validade_oferta) changesToApply.validade_oferta = validade_oferta
        changesToApply.campos_adicionais = pendingCamposAdicionais
      }
    }

    parsedRows.push({
      rawRowIndex: currentRowNumber,
      reg: regVal,
      nome: cleanedNome,
      status: parsedStatus,
      aplicar_fator_nac: parsedFator,
      comissao: parsedComissao,
      frase_preco,
      frase_comissao,
      prazo_entrega,
      condicoes_pagamento,
      garantia,
      assistencia_tecnica,
      treinamento_tecnico,
      transporte_seguro,
      validade_oferta,
      imposto_ipi,
      imposto_icms,
      rawFields: row,
      validationErrors: errors,
      action,
      existingId: existing?.id,
      existingRecord: existing,
      changesToApply,
      matchMethod,
      matchedDbName: existing?.nome,
      nameDiffers,
      namePreservedNotice,
      isCollision,
      collisionWithRow,
      collisionDbName,
      collisionMessage,
      conversions: Object.keys(conversions).length > 0 ? conversions : undefined,
      textFallbacks: textFallbacks.length > 0 ? textFallbacks : undefined,
      selfReferencingCleared:
        selfReferencingCleared.length > 0 ? selfReferencingCleared : undefined,
    })
  })

  // Second pass: attach colliding list to the first row that claimed the match
  parsedRows.forEach((r) => {
    const colliders = collisionsPerFirstRow.get(r.rawRowIndex)
    if (colliders && colliders.length > 0) {
      r.collidingOtherRows = colliders
      r.collidingOtherRowsMessage = `Outras linhas (${colliders.map((n) => '#' + n).join(', ')}) também casam com este tipo. Apenas esta primeira linha será aplicada.`
    }
  })

  return {
    headers,
    rawRows,
    mapping,
    unmappedHeaders,
    rows: parsedRows,
    totalRows: parsedRows.length,
    validCount: parsedRows.length - errorCount,
    updateCount,
    insertCount,
    errorCount,
    collisionCount,
    missingKeyColumn: !hasNomeMapped,
  }
}

/**
 * Result of parsing a numeric cell
 */
export interface ParseNumberResult {
  value?: number
  error?: string
  originalFormatted?: string
}

/**
 * Parses numeric values with ultra-tolerant heuristics for Brazilian & international formats.
 *
 * Requirements:
 * - Accepts strings or numbers from Excel/CSV indistintamente.
 * - Supports:
 *   "12", "12,5", "12.5", "1.234,56", "1234.56", "R$ 12,50", "12%", "12 %", "-5",
 *   "12,0", "12,00", integers, negatives.
 * - Decision rules:
 *   1. Strips currency symbols (R$, $), percentage (%), regular spaces, non-breaking spaces (\u00A0),
 *      and other invisible whitespace.
 *   2. If contains both '.' and ',', '.' is thousand separator and ',' is decimal (e.g. 1.234,56 -> 1234.56).
 *   3. If contains only ',', it is decimal separator (e.g. 12,5 -> 12.5, 12,00 -> 12).
 *   4. If contains only '.':
 *      - If followed by exactly 3 digits and either is thousands (like "1.234" or "10.000") where it matches
 *        the pattern ^-?\d{1,3}(\.\d{3})+$ => treat '.' as thousand separator (1.234 -> 1234).
 *      - Otherwise '.' is treated as decimal (e.g. 12.5 -> 12.5, 1234.56 -> 1234.56).
 *   5. If after cleaning nothing valid numeric remains (or contains letters/illegal chars), returns clear error:
 *      "não conseguiu converter 'VALOR' para número na coluna COLUNA"
 */
export function parseNumberField(val: any, columnName = 'numérico'): ParseNumberResult {
  if (val === undefined || val === null) {
    return {}
  }

  // If already a JS number
  if (typeof val === 'number') {
    if (isNaN(val) || !isFinite(val)) {
      return { error: `não conseguiu converter '${val}' para número na coluna ${columnName}` }
    }
    return { value: val }
  }

  const rawStr = String(val).trim()
  if (rawStr === '') {
    return {}
  }

  // 1. Remove NBSP, regular spaces, tabs, currency symbols and percentage signs
  let clean = rawStr
    .replace(/[\u00A0\u1680\u2000-\u200B\u202F\u205F\u3000\uFEFF]/g, '') // invisible / non-breaking spaces
    .replace(/\s+/g, '')
    .replace(/^(R\$|\$|EUR|BRL)/i, '')
    .replace(/(R\$|\$|EUR|BRL)$/i, '')
    .replace(/%/g, '')
    .trim()

  if (clean === '') {
    return {}
  }

  // Handle negative sign
  let isNegative = false
  if (clean.startsWith('-')) {
    isNegative = true
    clean = clean.slice(1)
  } else if (clean.endsWith('-')) {
    isNegative = true
    clean = clean.slice(0, -1)
  } else if (clean.startsWith('(') && clean.endsWith(')')) {
    isNegative = true
    clean = clean.slice(1, -1)
  }

  const hasComma = clean.includes(',')
  const hasDot = clean.includes('.')

  let normalized = ''

  if (hasComma && hasDot) {
    // Both present: '.' is thousands, ',' is decimal (e.g. "1.234,56" or "1.234.567,89")
    // Also tolerate rare inverted format like "1,234.56" if dot is after comma and last separator has 2 decimals
    const lastComma = clean.lastIndexOf(',')
    const lastDot = clean.lastIndexOf('.')
    if (lastComma > lastDot) {
      // Standard BR: dots are thousands, comma is decimal
      normalized = clean.replace(/\./g, '').replace(',', '.')
    } else {
      // Standard US: commas are thousands, dot is decimal
      normalized = clean.replace(/,/g, '')
    }
  } else if (hasComma && !hasDot) {
    // Only comma:
    // Check if multiple commas or single comma. Single comma is decimal in BR: "12,5" -> 12.5
    // If format is like "1,234" (3 digits after single comma), could be thousand?
    // In PT-BR context, comma is virtually always decimal (1,234 = 1.234, 12,5 = 12.5).
    // If someone wrote "1,234,567" (multiple commas), treat commas as thousands
    const commaCount = (clean.match(/,/g) || []).length
    if (commaCount > 1) {
      normalized = clean.replace(/,/g, '')
    } else {
      normalized = clean.replace(',', '.')
    }
  } else if (!hasComma && hasDot) {
    // Only dot:
    // Check if clear thousand separator: e.g. "1.234", "10.000", "1.234.567"
    // Regex matches 1-3 digits followed by one or more groups of exactly 3 digits (all separated by dot)
    const isClearlyThousand = /^\d{1,3}(\.\d{3})+$/.test(clean)
    if (isClearlyThousand) {
      normalized = clean.replace(/\./g, '')
    } else {
      // Otherwise treat as decimal: "12.5", "1234.56", "12.00", "12.0"
      normalized = clean
    }
  } else {
    // Neither comma nor dot: pure integer (e.g. "12", "1234")
    normalized = clean
  }

  // Validate that normalized contains only digits and at most one decimal dot
  if (!/^\d+(\.\d+)?$/.test(normalized)) {
    return {
      error: `não conseguiu converter '${rawStr}' para número na coluna ${columnName}`,
    }
  }

  const num = Number(normalized)
  if (isNaN(num) || !isFinite(num)) {
    return {
      error: `não conseguiu converter '${rawStr}' para número na coluna ${columnName}`,
    }
  }

  const finalValue = isNegative ? -num : num
  return {
    value: finalValue,
    originalFormatted: rawStr !== String(finalValue) ? rawStr : undefined,
  }
}

/**
 * Tolerantly parses text fields. Never rejects because of numbers, punctuation or slashes.
 * Converts numbers/booleans from Excel cells to string cleanly without error.
 */
export function parseTextField(
  val: any,
  options?: { collapseWhitespace?: boolean; preserveExactFormatting?: boolean },
): string | undefined {
  if (val === undefined || val === null) {
    return undefined
  }
  // Convert value to string, standardizing CRLF to LF to prevent mismatched line endings
  let str = String(val).replace(/\r\n/g, '\n').replace(/\r/g, '\n')

  // If text is completely empty or only whitespace, return undefined
  if (!str.trim()) {
    return undefined
  }

  // If exact formatting is requested (Point 4 / Point 5): preserve internal spaces, multiple newlines,
  // tabs, indentation and apply paragraph marker segmentation (Ponto N, N., •) so that markers
  // inside continuous text also become newlines/paragraphs consistently.
  if (options?.preserveExactFormatting) {
    const segmented = segmentParagraphMarkers(str)
    // Strip leading and trailing global empty lines/spaces, leaving internal paragraphs & spacing intact
    return segmented.replace(/^\n+|\n+$/g, '')
  }

  if (options?.collapseWhitespace) {
    return str.replace(/\s+/g, ' ').trim()
  }
  return str.trim()
}

/**
 * Parses boolean fields with ultra-tolerant representations:
 * S/N, sim/não, true/false, 1/0, com ou sem acento, maiúsculas ou minúsculas, com espaços.
 */
export function parseBooleanField(val: any): { value?: boolean; error?: string } {
  if (val === undefined || val === null) {
    return {}
  }
  const raw = String(val).trim()
  if (raw === '') {
    return {}
  }

  // Normalize accents & casing
  const norm = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, '')

  if (['s', 'sim', 'true', '1', 'v', 'verdadeiro', 'yes', 'y'].includes(norm)) {
    return { value: true }
  }
  if (['n', 'nao', 'false', '0', 'f', 'falso', 'no'].includes(norm)) {
    return { value: false }
  }

  return { error: `não conseguiu converter '${raw}' para valor booleano (use Sim/Não ou 1/0)` }
}

/**
 * Parses status field ("Ativo", "Inativo") tolerantly
 */
export function parseStatusField(val: any): { value?: 'Ativo' | 'Inativo'; error?: string } {
  if (val === undefined || val === null) {
    return {}
  }
  const raw = String(val).trim()
  if (raw === '') {
    return {}
  }
  const norm = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, '')

  if (['ativo', 'a', '1', 'true', 'active', 'sim', 's'].includes(norm)) {
    return { value: 'Ativo' }
  }
  if (['inativo', 'i', '0', 'false', 'inactive', 'nao', 'n'].includes(norm)) {
    return { value: 'Inativo' }
  }
  return { error: `Status não reconhecido: '${raw}' (use Ativo ou Inativo)` }
}

/**
 * Splits CSV line taking quotes into account (or without quotes if unquoted)
 */
function splitLineWithDelimiter(line: string, delim: string): string[] {
  const parts: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      inQuotes = !inQuotes
      current += char
    } else if (char === delim && !inQuotes) {
      parts.push(current)
      current = ''
    } else {
      current += char
    }
  }
  parts.push(current)
  return parts
}

/**
 * Robust CSV delimiter detection between semicolon (;), comma (,) and tab (\t).
 *
 * Requirements:
 * 1. Analyzes the first non-empty lines of the file.
 * 2. Chooses the delimiter producing the highest consistent column count across lines (> 1).
 * 3. In case of tie or typical Brazilian Excel exports (where decimals use comma and separator is semicolon),
 *    semicolon (;) wins.
 * 4. Does NOT rely on quotes.
 */
export function detectCsvDelimiter(text: string): CsvDelimiter {
  const lines = text
    .split(/\r\n|\n|\r/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .slice(0, 15)

  if (lines.length === 0) return ';'

  const candidates: CsvDelimiter[] = [';', ',', '\t']

  // Score each candidate based on column counts across lines
  interface DelimiterScore {
    delim: CsvDelimiter
    avgCols: number
    consistentRows: number
    headerCols: number
    score: number
  }

  const scores: DelimiterScore[] = candidates.map((delim) => {
    const counts = lines.map((l) => splitLineWithDelimiter(l, delim).length)
    const headerCols = counts[0] || 0
    if (headerCols <= 1) {
      return { delim, avgCols: 0, consistentRows: 0, headerCols: 0, score: 0 }
    }

    const matchingRows = counts.filter((c) => c === headerCols).length
    const sumCols = counts.reduce((acc, c) => acc + c, 0)
    const avgCols = sumCols / counts.length

    // Score: strongly prioritize consistency and column count > 1
    // Brazilian CSV preference: give semicolon a decisive boost when it provides multiple columns
    let score = headerCols * 10 + matchingRows * 5
    if (delim === ';') {
      score += 8 // Brazilian Excel default bias
    }

    return {
      delim,
      avgCols,
      consistentRows: matchingRows,
      headerCols,
      score,
    }
  })

  // Sort by score desc, then by headerCols desc, then semicolon first
  scores.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    if (b.headerCols !== a.headerCols) return b.headerCols - a.headerCols
    if (a.delim === ';') return -1
    if (b.delim === ';') return 1
    return 0
  })

  const best = scores[0]
  if (!best || best.headerCols <= 1) {
    // If no candidate broke into > 1 columns, default to ';' (Brazilian standard)
    return ';'
  }

  return best.delim
}

/**
 * Decodes a File or ArrayBuffer trying UTF-8 first (strict), and falling back to Latin-1 (ISO-8859-1 / Windows-1252)
 * if UTF-8 contains replacement characters (\uFFFD) or throws.
 */
export async function decodeTextWithFallback(
  fileOrBuffer: File | ArrayBuffer,
): Promise<{ text: string; encodingUsed: 'utf-8' | 'latin1' }> {
  const buffer =
    fileOrBuffer instanceof ArrayBuffer ? fileOrBuffer : await fileOrBuffer.arrayBuffer()
  const bytes = new Uint8Array(buffer)

  // Try strict UTF-8
  try {
    const utf8Decoder = new TextDecoder('utf-8', { fatal: true })
    const text = utf8Decoder.decode(bytes)
    return {
      text: text.charCodeAt(0) === 0xfeff ? text.slice(1) : text,
      encodingUsed: 'utf-8',
    }
  } catch {
    // UTF-8 failed, decode as Latin-1 (ISO-8859-1) which represents 1:1 single-byte Windows ANSI
    const latinDecoder = new TextDecoder('latin1')
    const text = latinDecoder.decode(bytes)
    return {
      text: text.charCodeAt(0) === 0xfeff ? text.slice(1) : text,
      encodingUsed: 'latin1',
    }
  }
}

/**
 * Extracts raw table rows from CSV or XLSX File with delimiter override support
 */
export async function extractRawRowsFromFile(
  file: File,
  forcedDelimiter?: CsvDelimiter,
): Promise<{
  headers: string[]
  rawRows: Record<string, string>[]
  detectedDelimiter?: CsvDelimiter
  encodingUsed?: string
}> {
  const nameLower = file.name.toLowerCase()

  if (nameLower.endsWith('.xlsx') || nameLower.endsWith('.xls')) {
    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: 'array' })
    const firstSheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[firstSheetName]
    const jsonRows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' })

    if (jsonRows.length === 0) {
      return { headers: [], rawRows: [] }
    }

    const headers = jsonRows[0].map((h) => String(h || '').trim()).filter(Boolean)
    const rawRows: Record<string, string>[] = []

    for (let i = 1; i < jsonRows.length; i++) {
      const row = jsonRows[i]
      if (!row || row.every((c) => c === undefined || c === null || String(c).trim() === '')) {
        continue
      }
      const record: Record<string, string> = {}
      headers.forEach((hdr, idx) => {
        const val = row[idx]
        // Preserve newlines and cell spacing inside Excel cells (normalize CRLF to \n, don't trim internal breaks)
        record[hdr] =
          val !== undefined && val !== null
            ? String(val).replace(/\r\n/g, '\n').replace(/\r/g, '\n')
            : ''
      })
      rawRows.push(record)
    }

    return { headers, rawRows, encodingUsed: 'xlsx' }
  }

  // Handle CSV file: decode with UTF-8 / Latin-1 fallback
  const { text, encodingUsed } = await decodeTextWithFallback(file)
  const delimiter = forcedDelimiter || detectCsvDelimiter(text)

  return new Promise((resolve, reject) => {
    try {
      Papa.parse<Record<string, string>>(text, {
        delimiter,
        header: true,
        skipEmptyLines: 'greedy',
        transformHeader: (h) => h.trim(),
        complete: (results) => {
          const headers = results.meta.fields?.map((h) => h.trim()).filter(Boolean) || []
          const rawRows = (results.data || []).map((row) => {
            const cleaned: Record<string, string> = {}
            for (const [k, v] of Object.entries(row)) {
              // Preserve line breaks and internal formatting within CSV cells (normalize CRLF to \n)
              cleaned[k.trim()] =
                v !== undefined && v !== null
                  ? String(v).replace(/\r\n/g, '\n').replace(/\r/g, '\n')
                  : ''
            }
            return cleaned
          })
          resolve({
            headers,
            rawRows,
            detectedDelimiter: delimiter,
            encodingUsed,
          })
        },
        error: (err) => {
          reject(new Error(`Erro ao processar CSV: ${err.message}`))
        },
      })
    } catch (err) {
      reject(err)
    }
  })
}

/**
 * Analyzes file rows, maps columns and correlates with existing DB tipos_proposta
 */
export async function analyzeTiposPropostaFile(
  file: File,
  existingTipos: TipoProposta[],
  forcedDelimiter?: CsvDelimiter,
): Promise<ParseTiposPropostaResult> {
  const { headers, rawRows, detectedDelimiter, encodingUsed } = await extractRawRowsFromFile(
    file,
    forcedDelimiter,
  )
  const initialMapping = buildInitialMapping(headers)
  const result = computeRowsFromMapping(headers, rawRows, initialMapping, existingTipos)
  return {
    ...result,
    detectedDelimiter,
    encodingUsed,
  }
}

/**
 * Applies updates and optional inserts to database table public.tipos_proposta
 */
// Whitelist of valid writable columns in table public.tipos_proposta
const ALLOWED_DB_COLUMNS = new Set([
  'nome',
  'status',
  'aplicar_fator_nac',
  'comissao',
  'frase_preco',
  'frase_comissao',
  'prazo_entrega',
  'condicoes_pagamento',
  'garantia',
  'assistencia_tecnica',
  'treinamento_tecnico',
  'transporte_seguro',
  'validade_oferta',
  'imposto_ipi',
  'imposto_icms',
  'campos_adicionais',
  'dados_adicionais',
  'atualizado_por',
  'updated_at',
  'fator_nacionalizacao',
])

function sanitizePayload(raw: Record<string, any>): Record<string, any> {
  const clean: Record<string, any> = {}
  for (const [k, v] of Object.entries(raw)) {
    if (!ALLOWED_DB_COLUMNS.has(k)) continue
    if (v === undefined) continue

    // Numeric columns: ensure clean float or null
    if (['comissao', 'imposto_ipi', 'imposto_icms'].includes(k)) {
      if (v === null || v === '') {
        clean[k] = null
      } else {
        const n = Number(v)
        clean[k] = isNaN(n) ? null : n
      }
      continue
    }

    // Boolean columns
    if (k === 'aplicar_fator_nac') {
      clean[k] = Boolean(v)
      continue
    }

    // Status: default to Ativo
    if (k === 'status') {
      clean[k] = v === 'Inativo' ? 'Inativo' : 'Ativo'
      continue
    }

    // campos_adicionais: ensure jsonb array format
    if (k === 'campos_adicionais') {
      if (Array.isArray(v)) {
        clean[k] = v
      } else if (typeof v === 'string') {
        try {
          clean[k] = JSON.parse(v)
        } catch {
          clean[k] = []
        }
      } else {
        clean[k] = []
      }
      continue
    }

    clean[k] = v
  }
  return clean
}

/**
 * Applies updates and optional inserts to database table public.tipos_proposta
 */
/**
 * Formats full real database error message without truncation or generic strings
 */
function extractDatabaseErrorMessage(err: any): string {
  if (!err) return 'Erro desconhecido retornado pelo banco'
  if (typeof err === 'string') return err

  const parts: string[] = []
  if (err.message) parts.push(err.message)
  if (err.details && err.details !== err.message) parts.push(`Detalhes: ${err.details}`)
  if (err.hint) parts.push(`Dica: ${err.hint}`)
  if (err.code) parts.push(`Código: ${err.code}`)

  if (parts.length > 0) {
    return parts.join(' | ')
  }

  try {
    return JSON.stringify(err)
  } catch {
    return String(err)
  }
}

export async function executeTiposPropostaBatchImport(
  rows: CsvTipoPropostaRow[],
  options: {
    allowInsertNew: boolean
    userName: string
    onProgress?: (progress: { current: number; total: number; percentage: number }) => void
  },
): Promise<ImportExecutionReport> {
  const { allowInsertNew, userName, onProgress } = options
  const total = rows.length
  let updatedCount = 0
  let createdCount = 0
  let skippedCount = 0
  let errorCount = 0
  const items: ImportRowResult[] = []
  const errors: Array<{ row: number; nome?: string; error: string }> = []

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]

    // 1. Collision check (Requirement 3: apply only first occurrence, skip subsequent cleanly without error)
    if (row.isCollision) {
      skippedCount++
      items.push({
        row: row.rawRowIndex,
        nome: row.nome || '(sem nome)',
        status: 'pulado',
        motivo:
          row.collisionMessage ||
          `Casou com o tipo "${row.collisionDbName || row.nome}" já associado à linha #${row.collisionWithRow}. Apenas a primeira linha foi aplicada.`,
      })
      onProgress?.({ current: i + 1, total, percentage: Math.round(((i + 1) / total) * 100) })
      continue
    }

    // 2. Validation error check
    if (row.validationErrors.length > 0) {
      skippedCount++
      errorCount++
      const msg = `Dados inválidos: ${row.validationErrors.join('; ')}`
      errors.push({
        row: row.rawRowIndex,
        nome: row.nome || '(sem nome)',
        error: msg,
      })
      items.push({
        row: row.rawRowIndex,
        nome: row.nome || '(sem nome)',
        status: 'erro',
        motivo: msg,
      })
      onProgress?.({ current: i + 1, total, percentage: Math.round(((i + 1) / total) * 100) })
      continue
    }

    // 3. Update existing record (Requirement 2 & 4: NEVER change nome, resilient loop)
    if (row.action === 'update' && row.existingId) {
      const rawPayload = {
        ...(row.changesToApply || {}),
        atualizado_por: userName,
        updated_at: new Date().toISOString(),
      }
      const updatePayload = sanitizePayload(rawPayload)

      // Requirement 2: Do NOT update the "nome" column on existing records.
      // Name is the match key and must be preserved exactly as registered in the database.
      delete updatePayload.nome

      try {
        const { error: updError } = await (supabase.from('tipos_proposta') as any)
          .update(updatePayload)
          .eq('id', row.existingId)

        if (updError) {
          throw updError
        }

        updatedCount++
        const note = row.nameDiffers
          ? ` (Nome cadastrado no banco "${row.matchedDbName}" mantido)`
          : ''
        items.push({
          row: row.rawRowIndex,
          nome: row.nome,
          status: 'atualizado',
          motivo: `Atualizado com sucesso no banco de dados${note}`,
        })
      } catch (err: any) {
        skippedCount++
        errorCount++
        const realError = extractDatabaseErrorMessage(err)
        errors.push({
          row: row.rawRowIndex,
          nome: row.nome,
          error: `Erro ao gravar no banco: ${realError}`,
        })
        items.push({
          row: row.rawRowIndex,
          nome: row.nome,
          status: 'erro',
          motivo: `Erro no banco: ${realError}`,
        })
      }
    } else if (row.action === 'insert') {
      // 4. Insert new record
      if (!allowInsertNew) {
        skippedCount++
        items.push({
          row: row.rawRowIndex,
          nome: row.nome,
          status: 'pulado',
          motivo: 'Tipo não encontrado no banco (a opção "Criar tipos novos" está desmarcada)',
        })
        onProgress?.({ current: i + 1, total, percentage: Math.round(((i + 1) / total) * 100) })
        continue
      }

      const rawPayload = {
        nome: row.nome,
        ...(row.changesToApply || {}),
        atualizado_por: userName,
      }
      const insertData = sanitizePayload(rawPayload)

      try {
        const { error: insError } = await (supabase.from('tipos_proposta') as any).insert(
          insertData,
        )

        if (insError) {
          throw insError
        }

        createdCount++
        items.push({
          row: row.rawRowIndex,
          nome: row.nome,
          status: 'criado',
          motivo: 'Novo tipo de proposta cadastrado com sucesso no banco de dados',
        })
      } catch (err: any) {
        skippedCount++
        errorCount++
        const realError = extractDatabaseErrorMessage(err)
        errors.push({
          row: row.rawRowIndex,
          nome: row.nome,
          error: `Erro ao cadastrar novo tipo: ${realError}`,
        })
        items.push({
          row: row.rawRowIndex,
          nome: row.nome,
          status: 'erro',
          motivo: `Erro ao cadastrar no banco: ${realError}`,
        })
      }
    } else {
      skippedCount++
      items.push({
        row: row.rawRowIndex,
        nome: row.nome || '(sem nome)',
        status: 'pulado',
        motivo: 'Linha ignorada ou com dados incompletos',
      })
    }

    onProgress?.({ current: i + 1, total, percentage: Math.round(((i + 1) / total) * 100) })
  }

  return {
    totalRows: total,
    updatedCount,
    createdCount,
    skippedCount,
    errorCount,
    items,
    errors,
  }
}
