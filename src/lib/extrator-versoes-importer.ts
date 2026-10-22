import { supabase } from '@/lib/supabase/client'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import {
  decodeTextWithFallback,
  detectCsvDelimiter,
  parseNumberField,
  parseBooleanField,
  parseStatusField,
  normalizeStringMatch,
  normalizeKey,
  type CsvDelimiter,
} from '@/lib/tipos-proposta-importer'
import { VersaoWithModelo } from '@/types/versao'

export interface TargetVersaoFieldDefinition {
  key: string
  label: string
  description: string
  isKey?: boolean
  type?: 'text' | 'number' | 'boolean' | 'status' | 'multivalue' | 'rich_text'
}

/**
 * Colunas de destino conhecidas para o importador de versões
 */
export const TARGET_VERSAO_FIELDS: TargetVersaoFieldDefinition[] = [
  {
    key: 'reg',
    label: 'REG (Chave Primária do Arquivo)',
    description:
      'Identificador único da versão no extrator (corresponde a versoes.reg ou versoes.cod_erp). Obrigatório.',
    isKey: true,
    type: 'text',
  },
  {
    key: 'nome',
    label: 'Nome da Versão',
    description: 'Nome completo do equipamento/versão.',
    type: 'text',
  },
  {
    key: 'modelo',
    label: 'Modelo / Referência',
    description:
      'Nome, código REG ou identificador do modelo (resolvido para UUID automaticamente).',
    type: 'text',
  },
  {
    key: 'categoria_id',
    label: 'Categoria',
    description: 'Nome ou identificador da categoria (resolvido para UUID automaticamente).',
    type: 'text',
  },
  {
    key: 'status',
    label: 'Status (Ativo / Inativo)',
    description: 'Ativo/Inativo, 1/0, A/I. Célula vazia mantém atual.',
    type: 'status',
  },
  {
    key: 'valor',
    label: 'Preço / Valor de Tabela',
    description: 'Preço de tabela (ex: 12.345,67 ou R$ 12.345,67).',
    type: 'number',
  },
  {
    key: 'moeda',
    label: 'Moeda (BRL, USD, EUR)',
    description: 'Moeda do preço (BRL, USD, EUR). Padrão BRL.',
    type: 'text',
  },
  {
    key: 'estoque_total',
    label: 'Estoque Total',
    description: 'Quantidade em estoque.',
    type: 'number',
  },
  {
    key: 'estoque_disponivel',
    label: 'Estoque Disponível',
    description: 'Quantidade disponível para venda.',
    type: 'number',
  },
  {
    key: 'fator_nac',
    label: 'Fator Nacionalização',
    description: 'Fator NAC numérico.',
    type: 'number',
  },
  {
    key: 'tem_fator',
    label: 'Aplica Fator NAC',
    description: 'Sim/Não se utiliza fator.',
    type: 'boolean',
  },
  {
    key: 'desconto_max_representante',
    label: 'Desconto Máx. Representante (%)',
    description: 'Desconto máximo do representante.',
    type: 'number',
  },
  {
    key: 'desconto_max_bener',
    label: 'Desconto Máx. Bener (%)',
    description: 'Desconto máximo da Bener.',
    type: 'number',
  },
  {
    key: 'acessorios_standards',
    label: 'Acessórios Standards (Formatação Rica)',
    description:
      'Configuração standard com suporte a <B>, quebras, bullets "•" e espaçamento [SPn].',
    type: 'rich_text',
  },
  {
    key: 'caracteristicas_construtivas',
    label: 'Características Construtivas (Formatação Rica)',
    description:
      'Características da versão com suporte a <B>, quebras, bullets "•" e espaçamento [SPn].',
    type: 'rich_text',
  },
  {
    key: 'especificacoes_tecnicas',
    label: 'Especificações Técnicas (Formatação Rica)',
    description:
      'Especificações técnicas da versão com suporte a <B>, quebras, bullets "•" e espaçamento [SPn].',
    type: 'rich_text',
  },
  {
    key: 'tipos_proposta',
    label: 'Tipos de Proposta (Separados por |)',
    description: 'Nomes dos tipos de proposta separados por " | ". Cria vínculos linha a linha.',
    type: 'multivalue',
  },
]

export interface HeaderMappingDefinition {
  csvHeader: string
  dbColumn: string | null
  label: string
  description: string
  isMapped: boolean
  isKey?: boolean
}

export interface CsvVersaoRow {
  rawRowIndex: number
  reg: string
  nome?: string
  modelo?: string
  status?: 'Ativo' | 'Inativo'
  valor?: number
  moeda?: string
  estoque_total?: number
  estoque_disponivel?: number
  fator_nac?: number
  tem_fator?: boolean
  desconto_max_representante?: number
  desconto_max_bener?: number
  acessorios_standards?: string
  caracteristicas_construtivas?: string
  especificacoes_tecnicas?: string
  tipos_proposta_raw?: string
  tipos_proposta_list: string[]
  rawFields: Record<string, string>
  validationErrors: string[]
  action: 'update' | 'insert' | 'skip'
  existingId?: string
  existingRecord?: VersaoWithModelo
  changesToApply: Record<string, any>
  matchMethod?: 'reg_exact' | 'reg_norm' | 'cod_erp' | 'nome'
  isCollision?: boolean
  collisionWithRow?: number
  collisionMessage?: string
  collidingOtherRows?: number[]
}

export interface ParseVersoesResult {
  headers: string[]
  rawRows: Record<string, string>[]
  mapping: HeaderMappingDefinition[]
  unmappedHeaders: string[]
  rows: CsvVersaoRow[]
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

export interface ModeloLookupRecord {
  id: string
  nome: string
  reg?: string | number | null
  cod?: string | null
}

export interface CategoriaLookupRecord {
  id: string
  nome: string
}

export interface ImportVersaoRowResult {
  row: number
  reg: string
  nome: string
  status: 'atualizado' | 'criado' | 'pulado' | 'erro'
  motivo: string
  tiposVinculados?: number
  tiposNaoEncontrados?: string[]
  modeloResolvido?: {
    original: string
    modeloId?: string
    modeloNome?: string
    status: 'encontrado' | 'nao_encontrado' | 'vazio' | 'uuid_direto'
    aviso?: string
  }
}

export interface ImportVersoesExecutionReport {
  totalRows: number
  updatedCount: number
  createdCount: number
  skippedCount: number
  errorCount: number
  totalTiposAssociados: number
  items: ImportVersaoRowResult[]
  errors: Array<{ row: number; reg?: string; nome?: string; error: string }>
}

/**
 * Normaliza o cabeçalho para comparação
 */
export function normalizeHeader(h: string): string {
  return h
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_]/g, '')
}

/**
 * Normaliza REG (remove espaços e zeros à esquerda)
 */
export function normalizeReg(str: string | null | undefined): string {
  if (!str) return ''
  const clean = String(str).trim().toLowerCase()
  return clean.replace(/^0+/, '') || '0'
}

/**
 * Mapeia cabeçalhos conhecidos do CSV para colunas da tabela versoes
 */
export function mapVersaoHeaderToDbColumn(rawHeader: string): {
  dbColumn: string | null
  label: string
  description: string
} {
  const norm = normalizeHeader(rawHeader)

  // 1. REG (Chave primária do extrator)
  if (
    norm === 'reg' ||
    norm === 'registro' ||
    norm === 'num_reg' ||
    norm === 'numero_reg' ||
    norm === 'id_reg' ||
    norm === 'reg_id'
  ) {
    return {
      dbColumn: 'reg',
      label: 'REG (Chave Primária)',
      description: 'Chave principal da versão no arquivo extrator.',
    }
  }

  // Se vier como cod_erp ou coderp
  if (
    norm === 'cod_erp' ||
    norm === 'coderp' ||
    norm === 'codigo_erp' ||
    norm === 'cod_e2corp' ||
    norm === 'code2corp'
  ) {
    return {
      dbColumn: 'reg', // trata como chave no importador
      label: 'Código ERP / REG',
      description: 'Chave de busca da versão.',
    }
  }

  // 2. Nome
  if (
    norm === 'nome' ||
    norm === 'nome_versao' ||
    norm === 'versao' ||
    norm === 'versao_nome' ||
    norm === 'descricao' ||
    norm === 'nomecompleto'
  ) {
    return {
      dbColumn: 'nome',
      label: 'Nome da Versão',
      description: 'Nome completo do equipamento/versão.',
    }
  }

  // 3. Modelo
  if (
    norm === 'modelo' ||
    norm === 'nome_modelo' ||
    norm === 'modelo_nome' ||
    norm === 'id_modelo' ||
    norm === 'modeloid' ||
    norm === 'cod_modelo' ||
    norm === 'modelo_id' ||
    norm === 'reg_modelo' ||
    norm === 'modeloreg'
  ) {
    return {
      dbColumn: 'modelo',
      label: 'Modelo',
      description: 'Modelo do produto.',
    }
  }

  // Categoria (se presente na planilha)
  if (
    norm === 'categoria' ||
    norm === 'categoria_id' ||
    norm === 'categoria_nome' ||
    norm === 'nome_categoria' ||
    norm === 'id_categoria'
  ) {
    return {
      dbColumn: 'categoria_id',
      label: 'Categoria',
      description: 'Categoria do produto.',
    }
  }

  // 4. Status
  if (norm === 'status' || norm === 'situacao') {
    return {
      dbColumn: 'status',
      label: 'Status',
      description: 'Ativo ou Inativo.',
    }
  }

  // 5. Valor / Preço
  if (
    norm === 'valor' ||
    norm === 'preco' ||
    norm === 'preco_tabela' ||
    norm === 'valortabela' ||
    norm === 'valor_unitario'
  ) {
    return {
      dbColumn: 'valor',
      label: 'Preço / Valor',
      description: 'Preço de tabela da versão.',
    }
  }

  // 6. Moeda
  if (norm === 'moeda' || norm === 'currency') {
    return {
      dbColumn: 'moeda',
      label: 'Moeda',
      description: 'BRL, USD ou EUR.',
    }
  }

  // 7. Estoque
  if (norm === 'estoque' || norm === 'estoque_total' || norm === 'estoquetotal') {
    return {
      dbColumn: 'estoque_total',
      label: 'Estoque Total',
      description: 'Quantidade total em estoque.',
    }
  }
  if (norm === 'estoque_disponivel' || norm === 'disponivel') {
    return {
      dbColumn: 'estoque_disponivel',
      label: 'Estoque Disponível',
      description: 'Quantidade disponível para venda.',
    }
  }

  // 8. Fator NAC
  if (norm === 'fator_nac' || norm === 'fator' || norm === 'fatornacionalizacao') {
    return {
      dbColumn: 'fator_nac',
      label: 'Fator NAC',
      description: 'Fator de nacionalização.',
    }
  }
  if (norm === 'tem_fator' || norm === 'aplica_fator' || norm === 'aplicar_fator') {
    return {
      dbColumn: 'tem_fator',
      label: 'Aplica Fator NAC',
      description: 'Sim/Não se utiliza fator.',
    }
  }

  // 9. Descontos
  if (
    norm === 'desconto_max_representante' ||
    norm === 'desc_max_rep' ||
    norm === 'desconto_representante'
  ) {
    return {
      dbColumn: 'desconto_max_representante',
      label: 'Desc. Máx. Rep. (%)',
      description: 'Desconto máximo do representante.',
    }
  }
  if (norm === 'desconto_max_bener' || norm === 'desc_max_bener' || norm === 'desconto_bener') {
    return {
      dbColumn: 'desconto_max_bener',
      label: 'Desc. Máx. Bener (%)',
      description: 'Desconto máximo da Bener.',
    }
  }

  // 10. CAMPOS COM FORMATAÇÃO RICA (<B>, \n, •)
  if (
    norm === 'acessorios_standards' ||
    norm === 'acessorios_standard' ||
    norm === 'acessorios' ||
    norm === 'acessoriosstandard'
  ) {
    return {
      dbColumn: 'acessorios_standards',
      label: 'Acessórios Standards',
      description: 'Formatação rica com <B>, quebras e bullets.',
    }
  }

  if (
    norm === 'caracteristicas' ||
    norm === 'caracteristicas_construtivas' ||
    norm === 'caracteristicasconstrutivas' ||
    norm === 'caracteristica'
  ) {
    return {
      dbColumn: 'caracteristicas_construtivas',
      label: 'Características Construtivas',
      description: 'Formatação rica com <B>, quebras e bullets.',
    }
  }

  if (
    norm === 'especificacoes' ||
    norm === 'especificacoes_tecnicas' ||
    norm === 'especificacoestecnicas' ||
    norm === 'especificacao'
  ) {
    return {
      dbColumn: 'especificacoes_tecnicas',
      label: 'Especificações Técnicas',
      description: 'Formatação rica com <B>, quebras e bullets.',
    }
  }

  // 11. CAMPO DE VALOR MÚLTIPLO (|)
  if (
    norm === 'tipos_proposta' ||
    norm === 'tiposproposta' ||
    norm === 'tipo_proposta' ||
    norm === 'tipos' ||
    norm === 'tipos_de_proposta' ||
    norm === 'proposta_tipos'
  ) {
    return {
      dbColumn: 'tipos_proposta',
      label: 'Tipos de Proposta (|)',
      description: 'Itens separados por " | " vinculados à versão.',
    }
  }

  // Cabeçalhos ignorados por padrão (ex: dt_cad, data_cadastro etc.)
  if (norm === 'dt_cad' || norm === 'dtcad' || norm === 'data_cadastro' || norm === 'id') {
    return {
      dbColumn: null,
      label: `${rawHeader} (Ignorado)`,
      description: 'Coluna ignorada na gravação.',
    }
  }

  return {
    dbColumn: null,
    label: rawHeader,
    description: 'Não mapeado. Será ignorado.',
  }
}

/**
 * Constrói o mapeamento inicial sugerido para o arquivo de versões
 */
export function buildInitialVersaoMapping(headers: string[]): HeaderMappingDefinition[] {
  const chosenColumns = new Set<string>()

  return headers.map((hdr) => {
    const meta = mapVersaoHeaderToDbColumn(hdr)
    let finalCol = meta.dbColumn

    // Não mapeia a mesma coluna do banco para múltiplos cabeçalhos automaticamente
    if (finalCol && chosenColumns.has(finalCol)) {
      finalCol = null
    } else if (finalCol) {
      chosenColumns.add(finalCol)
    }

    const targetDef = TARGET_VERSAO_FIELDS.find((t) => t.key === finalCol)

    return {
      csvHeader: hdr,
      dbColumn: finalCol,
      label: targetDef ? targetDef.label : meta.label,
      description: targetDef ? targetDef.description : meta.description,
      isMapped: finalCol !== null,
      isKey: finalCol === 'reg',
    }
  })
}

/**
 * Divide valores separados por "|"
 */
export function splitPipeItems(str: string | null | undefined): string[] {
  if (!str) return []
  return String(str)
    .split(/[|\r\n\u2028\u2029]+/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
}

/**
 * Limpa e preserva texto rico mantendo tags <B>, quebras de linha e marcadores [SPn]
 * exatamente como no arquivo original.
 * Regra: grava os marcadores como estão no banco (fonte da verdade) e a conversão acontece na renderização.
 * Célula vazia = retorna undefined.
 */
export function parseRichTextField(val: any): string | undefined {
  if (val === undefined || val === null) return undefined
  const str = String(val).replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  if (!str.trim()) return undefined
  // REGRA: Preserva espaços internos intencionais e marcadores [SPn] intocados (fonte da verdade)
  // Remove apenas quebras de linha estritamente vazias no início e no fim do bloco.
  return str.replace(/^\n+|\n+$/g, '')
}

/**
 * Busca a versão existente no banco correspondente ao registro da planilha.
 * Casamento prioritário por REG, depois COD_ERP, depois NOME (tolerante).
 */
export function findMatchingVersao(
  candidateReg: string,
  candidateNome: string | undefined,
  existingVersoes: VersaoWithModelo[],
): {
  versao?: VersaoWithModelo
  method?: 'reg_exact' | 'reg_norm' | 'cod_erp' | 'nome'
} {
  const cleanReg = candidateReg.trim()
  const regNorm = normalizeReg(cleanReg)

  if (cleanReg) {
    // 1. Casamento exato por reg
    const exactReg = existingVersoes.find(
      (v) => (v.reg && v.reg.trim() === cleanReg) || (v.cod_erp && v.cod_erp.trim() === cleanReg),
    )
    if (exactReg) return { versao: exactReg, method: 'reg_exact' }

    // 2. Casamento tolerante por reg (sem zeros à esquerda)
    const normRegMatch = existingVersoes.find((v) => {
      const vRegNorm = normalizeReg(v.reg)
      const vErpNorm = normalizeReg(v.cod_erp)
      return vRegNorm === regNorm || vErpNorm === regNorm
    })
    if (normRegMatch) return { versao: normRegMatch, method: 'reg_norm' }
  }

  // 3. Fallback: casamento tolerante por Nome (se candidateNome fornecido)
  if (candidateNome && candidateNome.trim()) {
    const cleanNome = candidateNome.trim()
    const normNome = normalizeStringMatch(cleanNome)
    if (normNome) {
      const nomeMatches = existingVersoes.filter((v) => normalizeStringMatch(v.nome) === normNome)
      if (nomeMatches.length === 1) {
        return { versao: nomeMatches[0], method: 'nome' }
      }
    }

    const keyNome = normalizeKey(cleanNome)
    if (keyNome && keyNome.length >= 3) {
      const keyMatches = existingVersoes.filter((v) => normalizeKey(v.nome) === keyNome)
      if (keyMatches.length === 1) {
        return { versao: keyMatches[0], method: 'nome' }
      }
    }
  }

  return {}
}

/**
 * Processa as linhas do arquivo e calcula a prévia antes de aplicar
 */
export function computeVersoesRowsFromMapping(
  headers: string[],
  rawRows: Record<string, string>[],
  mapping: HeaderMappingDefinition[],
  existingVersoes: VersaoWithModelo[],
): ParseVersoesResult {
  const unmappedHeaders = mapping.filter((m) => !m.isMapped).map((m) => m.csvHeader)
  const hasRegMapped = mapping.some((m) => m.dbColumn === 'reg')

  const parsedRows: CsvVersaoRow[] = []
  let updateCount = 0
  let insertCount = 0
  let errorCount = 0
  let collisionCount = 0

  const seenRegs = new Map<string, number>() // regNorm -> lineNumber

  rawRows.forEach((row, idx) => {
    const currentRowNumber = idx + 2
    const errors: string[] = []

    const getVal = (col: string): string | undefined => {
      const mapItem = mapping.find((m) => m.dbColumn === col)
      if (!mapItem) return undefined
      return row[mapItem.csvHeader]
    }

    const rawReg = getVal('reg')
    const cleanReg = (rawReg || '').trim()

    if (!hasRegMapped) {
      errors.push(
        'Coluna-chave "REG" não está mapeada — selecione no mapeamento de colunas qual coluna identifica o código REG da versão.',
      )
    } else if (!cleanReg) {
      errors.push('Identificador REG não informado (célula vazia no arquivo).')
    }

    const rawNome = getVal('nome')
    const cleanNome = (rawNome || '').trim()

    const rawModelo = getVal('modelo')
    const cleanModelo = (rawModelo || '').trim()

    // Status
    const rawStatus = getVal('status')
    let parsedStatus: 'Ativo' | 'Inativo' | undefined
    if (rawStatus !== undefined && rawStatus.trim() !== '') {
      const stRes = parseStatusField(rawStatus)
      if (stRes.error) {
        errors.push(stRes.error)
      } else {
        parsedStatus = stRes.value
      }
    }

    // Valor (tolerante a R$, pontos e vírgulas)
    const rawValor = getVal('valor')
    let parsedValor: number | undefined
    if (rawValor !== undefined && rawValor.trim() !== '') {
      const valRes = parseNumberField(rawValor, 'valor')
      if (valRes.error) {
        errors.push(valRes.error)
      } else {
        parsedValor = valRes.value
      }
    }

    // Moeda
    const rawMoeda = getVal('moeda')
    const cleanMoeda = rawMoeda ? rawMoeda.trim().toUpperCase() : undefined

    // Estoque
    const rawEstoque = getVal('estoque_total')
    let parsedEstoque: number | undefined
    if (rawEstoque !== undefined && rawEstoque.trim() !== '') {
      const estRes = parseNumberField(rawEstoque, 'estoque_total')
      if (!estRes.error) parsedEstoque = estRes.value
    }

    const rawEstoqueDisp = getVal('estoque_disponivel')
    let parsedEstoqueDisp: number | undefined
    if (rawEstoqueDisp !== undefined && rawEstoqueDisp.trim() !== '') {
      const estDispRes = parseNumberField(rawEstoqueDisp, 'estoque_disponivel')
      if (!estDispRes.error) parsedEstoqueDisp = estDispRes.value
    }

    // Fator NAC
    const rawFator = getVal('fator_nac')
    let parsedFator: number | undefined
    if (rawFator !== undefined && rawFator.trim() !== '') {
      const fRes = parseNumberField(rawFator, 'fator_nac')
      if (!fRes.error) parsedFator = fRes.value
    }

    const rawTemFator = getVal('tem_fator')
    let parsedTemFator: boolean | undefined
    if (rawTemFator !== undefined && rawTemFator.trim() !== '') {
      const tfRes = parseBooleanField(rawTemFator)
      if (!tfRes.error) parsedTemFator = tfRes.value
    }

    // Descontos
    const rawDescRep = getVal('desconto_max_representante')
    let parsedDescRep: number | undefined
    if (rawDescRep !== undefined && rawDescRep.trim() !== '') {
      const drRes = parseNumberField(rawDescRep, 'desconto_max_representante')
      if (!drRes.error) parsedDescRep = drRes.value
    }

    const rawDescBener = getVal('desconto_max_bener')
    let parsedDescBener: number | undefined
    if (rawDescBener !== undefined && rawDescBener.trim() !== '') {
      const dbRes = parseNumberField(rawDescBener, 'desconto_max_bener')
      if (!dbRes.error) parsedDescBener = dbRes.value
    }

    // Campos ricos: preserva <B>, quebras e bullets literais no payload
    const acessorios_standards = parseRichTextField(getVal('acessorios_standards'))
    const caracteristicas_construtivas = parseRichTextField(getVal('caracteristicas_construtivas'))
    const especificacoes_tecnicas = parseRichTextField(getVal('especificacoes_tecnicas'))

    // Tipos de proposta: divididos por |
    const rawTipos = getVal('tipos_proposta')
    const tiposList = splitPipeItems(rawTipos)

    // Casamento com versões do banco
    let existing: VersaoWithModelo | undefined = undefined
    let matchMethod: 'reg_exact' | 'reg_norm' | 'cod_erp' | 'nome' | undefined = undefined

    if (cleanReg) {
      const match = findMatchingVersao(cleanReg, cleanNome, existingVersoes)
      existing = match.versao
      matchMethod = match.method
    }

    let action: 'update' | 'insert' | 'skip' = 'skip'
    const changesToApply: Record<string, any> = {}
    let isCollision = false
    let collisionWithRow: number | undefined = undefined
    let collisionMessage: string | undefined = undefined

    const regNormKey = normalizeReg(cleanReg)

    if (errors.length > 0) {
      action = 'skip'
      errorCount++
    } else if (regNormKey && seenRegs.has(regNormKey)) {
      // Colisão de REG dentro do próprio arquivo
      const firstRow = seenRegs.get(regNormKey)!
      action = 'skip'
      isCollision = true
      collisionWithRow = firstRow
      collisionMessage = `Esta linha e a linha #${firstRow} possuem o mesmo REG "${cleanReg}". Apenas a primeira linha será aplicada.`
      collisionCount++
    } else {
      if (regNormKey) {
        seenRegs.set(regNormKey, currentRowNumber)
      }

      if (existing) {
        action = 'update'
        updateCount++

        // REGRA CRÍTICA: Célula vazia = NÃO altera valor do banco.
        // Apenas adiciona ao changesToApply campos que vieram preenchidos no arquivo.
        if (cleanNome && cleanNome !== existing.nome) {
          changesToApply.nome = cleanNome
        }
        if (cleanModelo && cleanModelo !== existing.modelo) {
          changesToApply.modelo = cleanModelo
        }
        if (parsedStatus !== undefined && parsedStatus !== existing.status) {
          changesToApply.status = parsedStatus
        }
        if (parsedValor !== undefined && parsedValor !== existing.valor) {
          changesToApply.valor = parsedValor
        }
        if (cleanMoeda && cleanMoeda !== existing.moeda) {
          changesToApply.moeda = cleanMoeda
        }
        if (parsedEstoque !== undefined && parsedEstoque !== existing.estoque_total) {
          changesToApply.estoque_total = parsedEstoque
        }
        if (parsedEstoqueDisp !== undefined && parsedEstoqueDisp !== existing.estoque_disponivel) {
          changesToApply.estoque_disponivel = parsedEstoqueDisp
        }
        if (parsedFator !== undefined && parsedFator !== existing.fator_nac) {
          changesToApply.fator_nac = parsedFator
        }
        if (parsedTemFator !== undefined && parsedTemFator !== existing.tem_fator) {
          changesToApply.tem_fator = parsedTemFator
        }
        if (parsedDescRep !== undefined && parsedDescRep !== existing.desconto_max_representante) {
          changesToApply.desconto_max_representante = parsedDescRep
        }
        if (parsedDescBener !== undefined && parsedDescBener !== existing.desconto_max_bener) {
          changesToApply.desconto_max_bener = parsedDescBener
        }

        // Campos ricos (apenas se preenchidos no arquivo)
        if (
          acessorios_standards !== undefined &&
          acessorios_standards !== existing.acessorios_standards
        ) {
          changesToApply.acessorios_standards = acessorios_standards
        }
        if (
          caracteristicas_construtivas !== undefined &&
          caracteristicas_construtivas !== existing.caracteristicas_construtivas
        ) {
          changesToApply.caracteristicas_construtivas = caracteristicas_construtivas
        }
        if (
          especificacoes_tecnicas !== undefined &&
          especificacoes_tecnicas !== existing.especificacoes_tecnicas
        ) {
          changesToApply.especificacoes_tecnicas = especificacoes_tecnicas
        }

        // Garante que o reg e cod_erp estão preenchidos
        if (!existing.reg || existing.reg !== cleanReg) {
          changesToApply.reg = cleanReg
        }
        if (!existing.cod_erp) {
          changesToApply.cod_erp = cleanReg
        }
      } else {
        // Nova versão no banco
        action = 'insert'
        insertCount++

        changesToApply.reg = cleanReg
        changesToApply.cod_erp = cleanReg
        changesToApply.nome = cleanNome || `Versão ${cleanReg}`
        if (cleanModelo) changesToApply.modelo = cleanModelo
        changesToApply.status = parsedStatus || 'Ativo'
        if (parsedValor !== undefined) changesToApply.valor = parsedValor
        changesToApply.moeda = cleanMoeda || 'BRL'
        if (parsedEstoque !== undefined) changesToApply.estoque_total = parsedEstoque
        if (parsedEstoqueDisp !== undefined) changesToApply.estoque_disponivel = parsedEstoqueDisp
        if (parsedFator !== undefined) changesToApply.fator_nac = parsedFator
        if (parsedTemFator !== undefined) changesToApply.tem_fator = parsedTemFator
        if (parsedDescRep !== undefined) changesToApply.desconto_max_representante = parsedDescRep
        if (parsedDescBener !== undefined) changesToApply.desconto_max_bener = parsedDescBener

        if (acessorios_standards) changesToApply.acessorios_standards = acessorios_standards
        if (caracteristicas_construtivas)
          changesToApply.caracteristicas_construtivas = caracteristicas_construtivas
        if (especificacoes_tecnicas)
          changesToApply.especificacoes_tecnicas = especificacoes_tecnicas
      }
    }

    parsedRows.push({
      rawRowIndex: currentRowNumber,
      reg: cleanReg,
      nome: cleanNome,
      modelo: cleanModelo,
      status: parsedStatus,
      valor: parsedValor,
      moeda: cleanMoeda,
      estoque_total: parsedEstoque,
      estoque_disponivel: parsedEstoqueDisp,
      fator_nac: parsedFator,
      tem_fator: parsedTemFator,
      desconto_max_representante: parsedDescRep,
      desconto_max_bener: parsedDescBener,
      acessorios_standards,
      caracteristicas_construtivas,
      especificacoes_tecnicas,
      tipos_proposta_raw: rawTipos,
      tipos_proposta_list: tiposList,
      rawFields: row,
      validationErrors: errors,
      action,
      existingId: existing?.id,
      existingRecord: existing,
      changesToApply,
      matchMethod,
      isCollision,
      collisionWithRow,
      collisionMessage,
    })
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
    missingKeyColumn: !hasRegMapped,
  }
}

/**
 * Lê e analisa o arquivo de Versões (CSV ou Excel)
 */
export async function analyzeVersoesFile(
  file: File,
  existingVersoes: VersaoWithModelo[],
  forcedDelimiter?: CsvDelimiter,
): Promise<ParseVersoesResult> {
  const nameLower = file.name.toLowerCase()

  let headers: string[] = []
  let rawRows: Record<string, string>[] = []
  let detectedDelimiter: CsvDelimiter | undefined = undefined
  let encodingUsed: string | undefined = undefined

  if (nameLower.endsWith('.xlsx') || nameLower.endsWith('.xls')) {
    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: 'array' })
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    const jsonRows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' })

    if (jsonRows.length > 0) {
      headers = jsonRows[0].map((h) => String(h || '').trim()).filter(Boolean)
      for (let i = 1; i < jsonRows.length; i++) {
        const row = jsonRows[i]
        if (!row || row.every((c) => c === undefined || c === null || String(c).trim() === '')) {
          continue
        }
        const record: Record<string, string> = {}
        headers.forEach((hdr, idx) => {
          const val = row[idx]
          record[hdr] =
            val !== undefined && val !== null
              ? String(val).replace(/\r\n/g, '\n').replace(/\r/g, '\n')
              : ''
        })
        rawRows.push(record)
      }
    }
    encodingUsed = 'xlsx'
  } else {
    // CSV com decodificação resiliente UTF-8 / Latin-1
    const decoded = await decodeTextWithFallback(file)
    encodingUsed = decoded.encodingUsed
    detectedDelimiter = forcedDelimiter || detectCsvDelimiter(decoded.text)

    await new Promise<void>((resolve, reject) => {
      Papa.parse<Record<string, string>>(decoded.text, {
        delimiter: detectedDelimiter,
        header: true,
        skipEmptyLines: 'greedy',
        transformHeader: (h) => h.trim(),
        complete: (results) => {
          headers = results.meta.fields?.map((h) => h.trim()).filter(Boolean) || []
          rawRows = (results.data || []).map((row) => {
            const cleaned: Record<string, string> = {}
            for (const [k, v] of Object.entries(row)) {
              cleaned[k.trim()] =
                v !== undefined && v !== null
                  ? String(v).replace(/\r\n/g, '\n').replace(/\r/g, '\n')
                  : ''
            }
            return cleaned
          })
          resolve()
        },
        error: (err) => reject(new Error(`Erro ao processar CSV: ${err.message}`)),
      })
    })
  }

  const initialMapping = buildInitialVersaoMapping(headers)
  const result = computeVersoesRowsFromMapping(headers, rawRows, initialMapping, existingVersoes)

  return {
    ...result,
    detectedDelimiter,
    encodingUsed,
  }
}

/**
 * Executa a importação linha a linha com resiliência:
 * Erro de uma linha não aborta as demais.
 * Retorna relatório completo com o erro real retornado pelo Supabase.
 */
export async function executeVersoesBatchImport(
  rows: CsvVersaoRow[],
  options: {
    allowInsertNew: boolean
    userName: string
    onProgress?: (progress: { current: number; total: number; percentage: number }) => void
  },
): Promise<ImportVersoesExecutionReport> {
  const { allowInsertNew, userName, onProgress } = options
  const total = rows.length

  let updatedCount = 0
  let createdCount = 0
  let skippedCount = 0
  let errorCount = 0
  let totalTiposAssociados = 0

  const items: ImportVersaoRowResult[] = []
  const errors: Array<{ row: number; reg?: string; nome?: string; error: string }> = []

  // 1. Carrega todos os tipos_proposta do banco para relacionar por nome
  const { data: allTiposData } = await supabase.from('tipos_proposta').select('id, nome')
  const tiposList = (allTiposData || []) as Array<{ id: string; nome: string }>

  // Helper para resolver id do tipo_proposta pelo nome
  const resolveTipoId = (nomeTipo: string): string | undefined => {
    const clean = nomeTipo.trim()
    if (!clean) return undefined
    const norm = normalizeStringMatch(clean)

    const exact = tiposList.find((t) => t.nome?.trim().toLowerCase() === clean.toLowerCase())
    if (exact) return exact.id

    const normMatch = tiposList.find((t) => normalizeStringMatch(t.nome) === norm)
    if (normMatch) return normMatch.id

    const key = normalizeKey(clean)
    if (key && key.length >= 3) {
      const keyMatch = tiposList.find((t) => normalizeKey(t.nome) === key)
      if (keyMatch) return keyMatch.id
    }
    return undefined
  }

  // 1b. Carrega todos os modelos do banco para resolução tolerante de UUID (FK versoes.modelo)
  const { data: modelosData } = await supabase
    .from('modelos')
    .select('id, nome, reg, cod, status, deleted_at')
    .is('deleted_at', null)

  const modelosList = ((modelosData || []) as ModeloLookupRecord[]).filter((m) => Boolean(m.id))

  const resolveModeloUuid = (
    raw: unknown,
  ): {
    status: 'encontrado' | 'nao_encontrado' | 'vazio' | 'uuid_direto'
    uuid?: string
    modeloNome?: string
    aviso?: string
  } => {
    if (raw === undefined || raw === null) return { status: 'vazio' }
    const rawStr = String(raw).trim()
    if (!rawStr) return { status: 'vazio' }

    // 1. Se já for um UUID válido
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (UUID_REGEX.test(rawStr)) {
      const byUuid = modelosList.find((m) => m.id.toLowerCase() === rawStr.toLowerCase())
      return {
        status: 'uuid_direto',
        uuid: rawStr,
        modeloNome: byUuid?.nome,
      }
    }

    // 2. Casamento exato e tolerante por REG numérico/texto (ex.: "12", "012", 12)
    const normNum = normalizeReg(rawStr)
    const byReg = modelosList.find((m) => {
      if (m.reg !== undefined && m.reg !== null) {
        if (normalizeReg(String(m.reg)) === normNum) return true
        if (String(m.reg).trim() === rawStr) return true
      }
      return false
    })
    if (byReg) {
      return {
        status: 'encontrado',
        uuid: byReg.id,
        modeloNome: byReg.nome,
      }
    }

    // 3. Casamento por COD (ex.: "12", "VK", etc.)
    const byCod = modelosList.find((m) => {
      if (m.cod) {
        const codStr = String(m.cod).trim().toLowerCase()
        if (codStr === rawStr.toLowerCase()) return true
        if (normalizeReg(codStr) === normNum) return true
      }
      return false
    })
    if (byCod) {
      return {
        status: 'encontrado',
        uuid: byCod.id,
        modeloNome: byCod.nome,
      }
    }

    // 4. Casamento tolerante por NOME (exato -> normalizado sem acentos -> alphanumeric key)
    const normName = normalizeStringMatch(rawStr)
    if (normName) {
      const byExactName = modelosList.find(
        (m) =>
          normalizeStringMatch(m.nome) === normName ||
          m.nome?.trim().toLowerCase() === rawStr.toLowerCase(),
      )
      if (byExactName) {
        return {
          status: 'encontrado',
          uuid: byExactName.id,
          modeloNome: byExactName.nome,
        }
      }
    }

    const keyName = normalizeKey(rawStr)
    if (keyName && keyName.length >= 2) {
      const byKeyName = modelosList.find((m) => normalizeKey(m.nome) === keyName)
      if (byKeyName) {
        return {
          status: 'encontrado',
          uuid: byKeyName.id,
          modeloNome: byKeyName.nome,
        }
      }

      // Match por prefixo do nome como fallback seguro
      const byPrefix = modelosList.filter((m) => {
        const mKey = normalizeKey(m.nome)
        return mKey.startsWith(keyName) || keyName.startsWith(mKey)
      })
      if (byPrefix.length === 1) {
        return {
          status: 'encontrado',
          uuid: byPrefix[0].id,
          modeloNome: byPrefix[0].nome,
        }
      }
    }

    // Não encontrado
    return {
      status: 'nao_encontrado',
      aviso: `modelo '${rawStr}' não encontrado — campo modelo mantido/inexistente`,
    }
  }

  // 1c. Carrega categorias (caso a planilha também traga coluna categoria/categoria_id)
  const { data: categoriasData } = await supabase
    .from('categorias')
    .select('id, nome')
    .is('deleted_at', null)

  const categoriasList = (categoriasData || []) as CategoriaLookupRecord[]

  const resolveCategoriaUuid = (
    raw: unknown,
  ): {
    status: 'encontrado' | 'nao_encontrado' | 'vazio' | 'uuid_direto'
    uuid?: string
    aviso?: string
  } => {
    if (raw === undefined || raw === null) return { status: 'vazio' }
    const rawStr = String(raw).trim()
    if (!rawStr) return { status: 'vazio' }

    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (UUID_REGEX.test(rawStr)) {
      return { status: 'uuid_direto', uuid: rawStr }
    }

    const norm = normalizeStringMatch(rawStr)
    const byNorm = categoriasList.find((c) => normalizeStringMatch(c.nome) === norm)
    if (byNorm) return { status: 'encontrado', uuid: byNorm.id }

    const key = normalizeKey(rawStr)
    if (key && key.length >= 2) {
      const byKey = categoriasList.find((c) => normalizeKey(c.nome) === key)
      if (byKey) return { status: 'encontrado', uuid: byKey.id }
    }

    return {
      status: 'nao_encontrado',
      aviso: `categoria '${rawStr}' não encontrada — campo categoria mantido/inexistente`,
    }
  }

  // 2. Itera linha a linha
  for (let i = 0; i < total; i++) {
    const row = rows[i]

    if (row.isCollision) {
      skippedCount++
      items.push({
        row: row.rawRowIndex,
        reg: row.reg,
        nome: row.nome || '(sem nome)',
        status: 'pulado',
        motivo:
          row.collisionMessage ||
          `Colisão de REG: linha já associada à linha #${row.collisionWithRow}. Apenas a primeira ocorrência é aplicada.`,
      })
      onProgress?.({ current: i + 1, total, percentage: Math.round(((i + 1) / total) * 100) })
      continue
    }

    if (row.validationErrors.length > 0) {
      skippedCount++
      items.push({
        row: row.rawRowIndex,
        reg: row.reg || '(sem REG)',
        nome: row.nome || '(sem nome)',
        status: 'pulado',
        motivo: row.validationErrors.join(' | '),
      })
      onProgress?.({ current: i + 1, total, percentage: Math.round(((i + 1) / total) * 100) })
      continue
    }

    if (row.action === 'insert' && !allowInsertNew) {
      skippedCount++
      items.push({
        row: row.rawRowIndex,
        reg: row.reg,
        nome: row.nome || `Versão ${row.reg}`,
        status: 'pulado',
        motivo: 'Nova versão não cadastrada no sistema (opção "Criar novas versões" desmarcada).',
      })
      onProgress?.({ current: i + 1, total, percentage: Math.round(((i + 1) / total) * 100) })
      continue
    }

    try {
      let targetVersaoId: string | undefined = row.existingId

      // Clona as alterações a aplicar para sanitizar colunas UUID
      const sanitizedChanges: Record<string, any> = { ...row.changesToApply }
      const avisosLinha: string[] = []
      let modeloResultadoLinha: ImportVersaoRowResult['modeloResolvido'] = undefined

      // Tratamento da coluna 'modelo' (FK UUID para tabela modelos):
      // Verifica se o campo 'modelo' veio preenchido no arquivo (ou está no changesToApply)
      const rawModeloDoArquivo = row.modelo ?? row.changesToApply.modelo
      if (rawModeloDoArquivo !== undefined && String(rawModeloDoArquivo).trim() !== '') {
        const resModelo = resolveModeloUuid(rawModeloDoArquivo)
        if (resModelo.status === 'encontrado' || resModelo.status === 'uuid_direto') {
          sanitizedChanges.modelo = resModelo.uuid
          modeloResultadoLinha = {
            original: String(rawModeloDoArquivo),
            modeloId: resModelo.uuid,
            modeloNome: resModelo.modeloNome,
            status: resModelo.status,
          }
        } else {
          // Modelo não encontrado:
          // A linha NÃO deve falhar. Gravar os demais campos normalmente.
          // Em update: deletar o campo modelo do payload para manter o valor atual do banco.
          // Em insert: não passar modelo ou passar null.
          delete sanitizedChanges.modelo
          avisosLinha.push(
            resModelo.aviso ||
              `modelo '${rawModeloDoArquivo}' não encontrado — campo modelo mantido/inexistente`,
          )
          modeloResultadoLinha = {
            original: String(rawModeloDoArquivo),
            status: 'nao_encontrado',
            aviso: resModelo.aviso,
          }
        }
      } else {
        // Célula vazia: regra aprovada de célula vazia não sobrescreve
        delete sanitizedChanges.modelo
        if (row.action === 'insert') {
          // Em criação sem modelo especificado, não define coluna modelo
          delete sanitizedChanges.modelo
        }
      }

      // Tratamento da coluna 'categoria_id' (FK UUID para tabela categorias) se mapeada:
      if ('categoria_id' in sanitizedChanges && sanitizedChanges.categoria_id) {
        const resCat = resolveCategoriaUuid(sanitizedChanges.categoria_id)
        if (resCat.status === 'encontrado' || resCat.status === 'uuid_direto') {
          sanitizedChanges.categoria_id = resCat.uuid
        } else {
          delete sanitizedChanges.categoria_id
          if (resCat.aviso) avisosLinha.push(resCat.aviso)
        }
      }

      if (row.action === 'update' && row.existingId) {
        // Atualiza campos preenchidos
        if (Object.keys(sanitizedChanges).length > 0) {
          const payload = {
            ...sanitizedChanges,
            atualizado_por: userName,
            updated_at: new Date().toISOString(),
          }

          const { error: updError } = await supabase
            .from('versoes')
            .update(payload)
            .eq('id', row.existingId)

          if (updError) throw updError
        }
        updatedCount++
      } else if (row.action === 'insert') {
        const payload = {
          nome: row.nome || (sanitizedChanges.nome as string) || `Versão ${row.reg}`,
          ...sanitizedChanges,
          atualizado_por: userName,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }

        const { data: insData, error: insError } = await (supabase.from('versoes') as any)
          .insert(payload)
          .select('id')
          .single()

        if (insError) throw insError
        targetVersaoId = insData?.id
        createdCount++
      }

      // Processa relacionamento de tipos_proposta (um registro por tipo na versao_tipos_proposta)
      let tiposVinculadosCount = 0
      const tiposNaoEncontrados: string[] = []

      if (targetVersaoId && row.tipos_proposta_list.length > 0) {
        for (const tipoRaw of row.tipos_proposta_list) {
          const tId = resolveTipoId(tipoRaw)
          if (!tId) {
            tiposNaoEncontrados.push(tipoRaw)
            continue
          }

          // Insere vínculo na tabela de junção ignorando duplicatas existentes
          const { error: relError } = await supabase.from('versao_tipos_proposta').insert({
            versao_id: targetVersaoId,
            tipo_proposta_id: tId,
          })

          // Se já existia a chave primária composta (versao_id, tipo_proposta_id), ignora silenciosamente
          if (!relError) {
            tiposVinculadosCount++
            totalTiposAssociados++
          }
        }
      }

      const motivoBase =
        row.action === 'update'
          ? Object.keys(sanitizedChanges).length > 0
            ? `Versão atualizada com ${Object.keys(sanitizedChanges).length} campo(s).`
            : 'Versão já compatível com os dados do arquivo.'
          : 'Nova versão cadastrada com sucesso.'

      const complementos: string[] = []
      if (tiposVinculadosCount > 0) {
        complementos.push(`${tiposVinculadosCount} tipo(s) vinculado(s)`)
      }
      if (avisosLinha.length > 0) {
        complementos.push(`Aviso: ${avisosLinha.join('; ')}`)
      }

      const motivoFinal =
        complementos.length > 0 ? `${motivoBase} [${complementos.join(' | ')}]` : motivoBase

      items.push({
        row: row.rawRowIndex,
        reg: row.reg,
        nome: row.nome || (row.existingRecord?.nome ?? `Versão ${row.reg}`),
        status: row.action === 'update' ? 'atualizado' : 'criado',
        motivo: motivoFinal,
        tiposVinculados: tiposVinculadosCount,
        tiposNaoEncontrados: tiposNaoEncontrados.length > 0 ? tiposNaoEncontrados : undefined,
        modeloResolvido: modeloResultadoLinha,
      })
    } catch (err: any) {
      errorCount++
      const msg = err?.message || err?.details || String(err)
      errors.push({
        row: row.rawRowIndex,
        reg: row.reg,
        nome: row.nome,
        error: msg,
      })
      items.push({
        row: row.rawRowIndex,
        reg: row.reg,
        nome: row.nome || '(sem nome)',
        status: 'erro',
        motivo: `Erro no banco: ${msg}`,
      })
    }

    onProgress?.({
      current: i + 1,
      total,
      percentage: Math.round(((i + 1) / total) * 100),
    })
  }

  return {
    totalRows: total,
    updatedCount,
    createdCount,
    skippedCount,
    errorCount,
    totalTiposAssociados,
    items,
    errors,
  }
}
