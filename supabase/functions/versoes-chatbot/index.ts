import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { getCorsHeaders } from '../_shared/cors.ts'
import { createClient, SupabaseClient } from 'npm:@supabase/supabase-js@2'

const BACKOFF_DELAYS = [1500, 3000]
const OPENAI_MODEL = 'gpt-6-luna'
const OPENAI_URL = 'https://api.openai.com/v1/chat/completions'

export interface TipoPropostaItem {
  id: string
  nome: string
  comissao?: number | null
  imposto_ipi?: number | null
  imposto_icms?: number | null
  frase_preco?: string | null
  frase_comissao?: string | null
  prazo_entrega?: string | null
  condicoes_pagamento?: string | null
  garantia?: string | null
  assistencia_tecnica?: string | null
  transporte_seguro?: string | null
  fator_nacionalizacao?: number | null
  aplicar_fator_nac?: boolean | null
}

export interface AcessorioItem {
  id: string
  nome: string
  tipo?: string | null
  moeda?: string | null
  valor?: number | null
  fator_nac?: number | null
  especificacoes_tecnicas?: string | null
  status?: string | null
}

export interface VersaoFullRow {
  id: string
  nome: string
  nome_abreviado: string | null
  descricao_completa?: string | null
  cod_erp: string | null
  imagem_preview: string | null
  moeda: string
  valor: number
  valor_anterior?: number | null
  data_ultimo_reajuste?: string | null
  condicoes?: string | null
  tem_fator: boolean
  fator_nac: number
  impostos?: number | null
  desconto_max_representante?: number | null
  desconto_max_bener?: number | null
  tem_estoque: boolean
  estoque_total: number
  estoque_bloqueado: number
  estoque_reservado: number
  estoque_disponivel: number
  alerta_estoque_minimo: number | null
  tipo_fornecimento?: string | null
  acessorios_standards: string | null
  caracteristicas_construtivas: string | null
  especificacoes_tecnicas: string | null
  status: string
  categoria_id?: string | null
  tipos_proposta?: string[] | null
  categorias?: { id: string; nome: string } | null
  modelos?: {
    id: string
    nome: string
    marcas?: { id: string; nome: string } | null
    produtos?: {
      id: string
      nome: string
      categorias?: { id: string; nome: string } | null
    } | null
  } | null
  // Coleções enriquecidas em runtime
  tipos_proposta_relacionados?: TipoPropostaItem[]
  acessorios_opcionais?: AcessorioItem[]
}

export interface IncomingMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface OpenAiMessageContentPart {
  type: 'text' | 'image_url'
  text?: string
  image_url?: {
    url: string
    detail?: 'low' | 'high' | 'auto'
  }
}

export interface OpenAiToolCall {
  id: string
  type: 'function'
  function: {
    name: string
    arguments: string
  }
}

export type OpenAiMessage =
  | { role: 'system'; content: string }
  | { role: 'assistant'; content: string | null; tool_calls?: OpenAiToolCall[] }
  | { role: 'user'; content: string | OpenAiMessageContentPart[] }
  | { role: 'tool'; tool_call_id: string; content: string }

// Rate limiting in-memory por usuário autenticado
const RATE_LIMIT_MAX = 30
const RATE_LIMIT_WINDOW_MS = 60 * 1000
const rateLimitMap = new Map<string, number[]>()

function checkRateLimit(userId: string): boolean {
  const now = Date.now()
  const timestamps = rateLimitMap.get(userId) ?? []
  const recent = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS)
  if (recent.length >= RATE_LIMIT_MAX) {
    rateLimitMap.set(userId, recent)
    return false
  }
  recent.push(now)
  rateLimitMap.set(userId, recent)

  if (rateLimitMap.size > 2000) {
    for (const [key, list] of rateLimitMap.entries()) {
      const valid = list.filter((t) => now - t < RATE_LIMIT_WINDOW_MS)
      if (valid.length === 0) {
        rateLimitMap.delete(key)
      } else {
        rateLimitMap.set(key, valid)
      }
    }
  }

  return true
}

function removeAccents(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function normalizeTerm(str: string): string {
  return removeAccents(str.toLowerCase())
    .replace(/[^a-z0-9\.]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Cache curto por conversa / versão (TTL: 5 minutos)
interface CachedVersaoFull {
  versao: VersaoFullRow
  timestamp: number
}
const versaoCache = new Map<string, CachedVersaoFull>()
const CACHE_TTL_MS = 5 * 60 * 1000

function getCachedVersao(versaoId: string): VersaoFullRow | null {
  const entry = versaoCache.get(versaoId)
  if (!entry) return null
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    versaoCache.delete(versaoId)
    return null
  }
  return entry.versao
}

function setCachedVersao(versaoId: string, versao: VersaoFullRow): void {
  versaoCache.set(versaoId, { versao, timestamp: Date.now() })
  if (versaoCache.size > 500) {
    const oldestKey = versaoCache.keys().next().value
    if (oldestKey) versaoCache.delete(oldestKey)
  }
}

function sanitizeTechnicalText(text: string | null | undefined): string {
  if (!text || text.trim() === '') return 'Não informado no cadastro'
  let clean = text.replace(
    /<img[^>]*src=["']data:image\/[^"']+["'][^>]*>/gi,
    '[Imagem de Especificações no Cadastro]',
  )
  clean = clean.replace(
    /data:image\/[a-zA-Z0-9+.-]+;base64,[A-Za-z0-9+/=]+/gi,
    '[Imagem base64 omitida]',
  )

  clean = clean
    .split('•')
    .map((part) => part.trim().replace(/[ \t]+/g, ' '))
    .filter((part) => part.length > 0)
    .join('\n  • ')

  if (clean.length === 0) return 'Não informado no cadastro'
  return `\n  • ${clean}`
}

function formatCurrency(val: number | null | undefined, moeda = 'BRL'): string {
  if (val === null || val === undefined || val === 0) return 'Não preenchido no cadastro'
  return `${moeda} ${Number(val).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatPercent(val: number | null | undefined): string {
  if (val === null || val === undefined) return 'Não informado no cadastro'
  return `${Number(val).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}%`
}

/**
 * Monta o registro completo da versão com dados comerciais, impostos,
 * tipos de proposta vinculados, acessórios e especificações técnicas
 */
export function formatSingleVersaoFull(v: VersaoFullRow): string {
  const marca = v.modelos?.marcas?.nome ?? 'Não informada no cadastro'
  const modeloBase = v.modelos?.nome ?? 'Não informado no cadastro'
  const produto = v.modelos?.produtos?.nome ?? 'Não informado no cadastro'
  const categoria =
    v.categorias?.nome ?? v.modelos?.produtos?.categorias?.nome ?? 'Não informada no cadastro'
  const nomeAbrev = v.nome_abreviado ? ` (Abreviado: ${v.nome_abreviado})` : ''
  const codErp = v.cod_erp?.trim() ? v.cod_erp.trim() : 'Não preenchido no cadastro'
  const descricaoCompleta = v.descricao_completa?.trim()
    ? v.descricao_completa.trim()
    : 'Não preenchida no cadastro'

  const statusLabel =
    v.status === 'Ativo' || v.status === 'A'
      ? 'Ativo (disponível para propostas)'
      : `Inativo / ${v.status} (fora de linha)`

  const precoFmt =
    v.valor > 0 ? formatCurrency(v.valor, v.moeda) : 'Não preenchido / Sob consulta comercial'
  const valorAnteriorFmt =
    v.valor_anterior && v.valor_anterior > 0
      ? formatCurrency(v.valor_anterior, v.moeda)
      : 'Não informado no cadastro'
  const dataReajusteFmt = v.data_ultimo_reajuste
    ? new Date(v.data_ultimo_reajuste).toLocaleDateString('pt-BR')
    : 'Não informada no cadastro'

  const fatorNacFmt = v.tem_fator
    ? `${Number(v.fator_nac || 1).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })} (aplica fator: Sim)`
    : 'Não aplica fator de nacionalização (Não)'

  const condicoesFmt = v.condicoes?.trim() ? v.condicoes.trim() : 'Não informado no cadastro'
  const impostosFmt =
    v.impostos !== null && v.impostos !== undefined
      ? formatPercent(v.impostos)
      : 'Não informado no cadastro'
  const descRepFmt =
    v.desconto_max_representante !== null && v.desconto_max_representante !== undefined
      ? formatPercent(v.desconto_max_representante)
      : 'Não informado no cadastro'
  const descBenerFmt =
    v.desconto_max_bener !== null && v.desconto_max_bener !== undefined
      ? formatPercent(v.desconto_max_bener)
      : 'Não informado no cadastro'
  const tipoFornecimentoFmt = v.tipo_fornecimento?.trim()
    ? v.tipo_fornecimento.trim()
    : 'Não informado no cadastro'

  const estoqueFmt =
    v.estoque_disponivel > 0
      ? `${v.estoque_disponivel} un. disponível(is) para pronta entrega (Total: ${v.estoque_total}, Reservado: ${v.estoque_reservado}, Bloqueado: ${v.estoque_bloqueado})`
      : v.tem_estoque
        ? 'Item de giro/estoque regular (verificar saldo/embarque com a fábrica)'
        : 'Sob encomenda / produção sob demanda'

  let tiposPropostaFmt = 'Nenhum tipo de proposta vinculado no cadastro desta máquina'
  if (v.tipos_proposta_relacionados && v.tipos_proposta_relacionados.length > 0) {
    tiposPropostaFmt = v.tipos_proposta_relacionados
      .map((tp, idx) => {
        const comissao =
          tp.comissao !== null && tp.comissao !== undefined
            ? formatPercent(tp.comissao)
            : 'Não informada no cadastro'
        const ipi =
          tp.imposto_ipi !== null && tp.imposto_ipi !== undefined
            ? formatPercent(tp.imposto_ipi)
            : 'Não informado no cadastro'
        const icms =
          tp.imposto_icms !== null && tp.imposto_icms !== undefined
            ? formatPercent(tp.imposto_icms)
            : 'Não informado no cadastro'
        const frasePreco = tp.frase_preco?.trim()
          ? tp.frase_preco.trim()
          : 'Não informada no cadastro'
        const fraseComissao = tp.frase_comissao?.trim()
          ? tp.frase_comissao.trim()
          : 'Não informada no cadastro'
        const frete = tp.transporte_seguro?.trim()
          ? tp.transporte_seguro.trim()
          : 'Não informado no cadastro'
        const prazo = tp.prazo_entrega?.trim()
          ? tp.prazo_entrega.trim()
          : 'Não informado no cadastro'
        const condPgto = tp.condicoes_pagamento?.trim()
          ? tp.condicoes_pagamento.trim()
          : 'Não informado no cadastro'
        const garantia = tp.garantia?.trim() ? tp.garantia.trim() : 'Não informada no cadastro'

        return `  ${idx + 1}. Tipo: "${tp.nome}"
     - Comissão configurada: ${comissao}
     - IPI: ${ipi}
     - ICMS: ${icms}
     - Frase do Preço: ${frasePreco}
     - Frase da Comissão: ${fraseComissao}
     - Condições de Frete / Logística / Seguro: ${frete}
     - Prazo de Entrega: ${prazo}
     - Condições de Pagamento: ${condPgto}
     - Garantia: ${garantia}`
      })
      .join('\n')
  }

  let acessoriosOpcionaisFmt = 'Nenhum acessório/opcional cadastrado para esta versão'
  if (v.acessorios_opcionais && v.acessorios_opcionais.length > 0) {
    acessoriosOpcionaisFmt = v.acessorios_opcionais
      .map((ac, idx) => {
        const val =
          ac.valor !== null && ac.valor !== undefined
            ? formatCurrency(ac.valor, ac.moeda || 'USD')
            : 'Valor não informado no cadastro'
        const tipo = ac.tipo ? ` (${ac.tipo})` : ''
        const specsAc = ac.especificacoes_tecnicas?.trim()
          ? ` - Specs: ${ac.especificacoes_tecnicas.trim()}`
          : ''
        return `  ${idx + 1}. ${ac.nome}${tipo} — Preço cadastrado: ${val}${specsAc}`
      })
      .join('\n')
  }

  const specs = sanitizeTechnicalText(v.especificacoes_tecnicas)
  const constru = v.caracteristicas_construtivas?.trim() || 'Não informado no cadastro'
  const acessoriosStandards = v.acessorios_standards?.trim() || 'Não informado no cadastro'
  const fotoFmt =
    v.imagem_preview && v.imagem_preview.trim() !== '' ? v.imagem_preview : 'Sem foto cadastrada'

  return `[REGISTRO COMPLETO DA VERSÃO: ${v.nome}${nomeAbrev}]
- ID: ${v.id}
- Código ERP: ${codErp}
- Marca: ${marca}
- Modelo base: ${modeloBase}
- Linha / Subcategoria: ${produto}
- Categoria principal do Catálogo: ${categoria}
- Descrição Completa: ${descricaoCompleta}
- Status: ${statusLabel}
- Tipo de Fornecimento: ${tipoFornecimentoFmt}

[COMERCIAL & PREÇO BASE]
- Valor referência: ${precoFmt}
- Moeda: ${v.moeda}
- Condições comerciais: ${condicoesFmt}
- Fator de nacionalização: ${fatorNacFmt}
- Impostos da versão: ${impostosFmt}
- Desconto máximo representante: ${descRepFmt}
- Desconto máximo Bener: ${descBenerFmt}
- Último reajuste de preço: ${dataReajusteFmt} (Valor anterior: ${valorAnteriorFmt})
- Situação de estoque: ${estoqueFmt}
- Foto/Preview de catálogo: ${fotoFmt}

[TIPOS DE PROPOSTA VINCULADOS (COMISSÃO, IMPOSTOS E LOGÍSTICA)]
${tiposPropostaFmt}

[ACESSÓRIOS E OPCIONAIS COM VALORES CADASTRADOS]
${acessoriosOpcionaisFmt}

[ACESSÓRIOS STANDARDS INCLUSOS NO FORNECIMENTO BASE]
  ${acessoriosStandards}

[CARACTERÍSTICAS CONSTRUTIVAS]
  ${constru}

[ESPECIFICAÇÕES TÉCNICAS COMPLETAS]
${specs}`
}

/**
 * Passo "Carregar": busca o registro completo de uma versão e enriquece com
 * tipos de proposta e opcionais
 */
export async function carregarRegistroCompletoVersao(
  supabase: SupabaseClient,
  versaoId: string,
): Promise<VersaoFullRow | null> {
  const cached = getCachedVersao(versaoId)
  if (cached) return cached

  const selectFields =
    'id, nome, nome_abreviado, descricao_completa, cod_erp, imagem_preview, moeda, valor, valor_anterior, data_ultimo_reajuste, condicoes, tem_fator, fator_nac, impostos, desconto_max_representante, desconto_max_bener, tem_estoque, estoque_total, estoque_bloqueado, estoque_reservado, estoque_disponivel, alerta_estoque_minimo, tipo_fornecimento, acessorios_standards, caracteristicas_construtivas, especificacoes_tecnicas, status, categoria_id, tipos_proposta, categorias:categoria_id(id, nome), modelos(id, nome, marcas:marca(id, nome), produtos:produto(id, nome, categorias:categoria(id, nome)))'

  const { data: rawVersao, error } = await supabase
    .from('versoes')
    .select(selectFields)
    .eq('id', versaoId)
    .is('deleted_at', null)
    .maybeSingle()

  if (error || !rawVersao) return null

  const v = rawVersao as unknown as VersaoFullRow
  v.tipos_proposta_relacionados = []
  v.acessorios_opcionais = []

  // 1A. Tipos via versao_tipos_proposta
  const { data: vtpData } = await supabase
    .from('versao_tipos_proposta')
    .select(
      'versao_id, tipos_proposta(id, nome, comissao, imposto_ipi, imposto_icms, frase_preco, frase_comissao, prazo_entrega, condicoes_pagamento, garantia, assistencia_tecnica, transporte_seguro, fator_nacionalizacao, aplicar_fator_nac)',
    )
    .eq('versao_id', versaoId)

  for (const row of vtpData ?? []) {
    if (row.tipos_proposta) {
      const tp = row.tipos_proposta as unknown as TipoPropostaItem
      if (!v.tipos_proposta_relacionados.some((item) => item.id === tp.id)) {
        v.tipos_proposta_relacionados.push(tp)
      }
    }
  }

  // 1B. Tipos via array jsonb tipos_proposta
  if (
    v.tipos_proposta_relacionados.length === 0 &&
    Array.isArray(v.tipos_proposta) &&
    v.tipos_proposta.length > 0
  ) {
    const names = v.tipos_proposta.filter(
      (n): n is string => typeof n === 'string' && n.trim().length > 0,
    )
    if (names.length > 0) {
      const { data: tpByNames } = await supabase
        .from('tipos_proposta')
        .select(
          'id, nome, comissao, imposto_ipi, imposto_icms, frase_preco, frase_comissao, prazo_entrega, condicoes_pagamento, garantia, assistencia_tecnica, transporte_seguro, fator_nacionalizacao, aplicar_fator_nac',
        )
        .in('nome', names)
        .is('deleted_at', null)

      for (const item of (tpByNames as unknown as TipoPropostaItem[]) ?? []) {
        if (!v.tipos_proposta_relacionados.some((x) => x.id === item.id)) {
          v.tipos_proposta_relacionados.push(item)
        }
      }
    }
  }

  // 2A. Acessórios via acessorio_versoes
  const { data: avData } = await supabase
    .from('acessorio_versoes')
    .select(
      'versao_id, acessorios(id, nome, tipo, moeda, valor, fator_nac, especificacoes_tecnicas, status)',
    )
    .eq('versao_id', versaoId)

  for (const row of avData ?? []) {
    if (row.acessorios) {
      const ac = row.acessorios as unknown as AcessorioItem
      if (!v.acessorios_opcionais.some((item) => item.id === ac.id)) {
        v.acessorios_opcionais.push(ac)
      }
    }
  }

  // 2B. Acessórios via array jsonb versoes
  const { data: acArrayMatches } = await supabase
    .from('acessorios')
    .select('id, nome, tipo, moeda, valor, fator_nac, especificacoes_tecnicas, status, versoes')
    .is('deleted_at', null)
    .neq('status', 'Inativo')
    .limit(200)

  for (const acRow of acArrayMatches ?? []) {
    if (Array.isArray(acRow.versoes) && acRow.versoes.includes(versaoId)) {
      const acItem: AcessorioItem = {
        id: acRow.id,
        nome: acRow.nome,
        tipo: acRow.tipo,
        moeda: acRow.moeda,
        valor: acRow.valor,
        fator_nac: acRow.fator_nac,
        especificacoes_tecnicas: acRow.especificacoes_tecnicas,
        status: acRow.status,
      }
      if (!v.acessorios_opcionais.some((item) => item.id === acItem.id)) {
        v.acessorios_opcionais.push(acItem)
      }
    }
  }

  setCachedVersao(versaoId, v)
  return v
}

/**
 * Passo "Resolver": consulta o índice estruturado de atributos técnicos
 * com filtros combináveis e ranqueia por aderência
 */
export interface ConsultarIndiceParams {
  termo_busca?: string
  marca?: string
  modelo?: string
  cod_erp?: string
  tipo_maquina?: string
  tecnologia?: string
  potencia_w?: number
  forca_fechamento_t?: number
  curso_mm?: number
  atributos?: Array<{
    nome: string
    valor_numerico?: number
    valor_texto?: string
    unidade?: string
  }>
  exato_apenas?: boolean
}

export interface CandidatoIndice {
  versao_id: string
  modelo: string
  marca: string
  cod_erp: string
  nome_versao: string
  aderencia_score: number
  motivo_correspondencia: string
  atributos_casados: Array<{ atributo: string; valor: string; unidade?: string | null }>
  is_aproximacao?: boolean
}

export async function consultarIndiceAtributos(
  supabase: SupabaseClient,
  params: ConsultarIndiceParams,
): Promise<{ candidatos: CandidatoIndice[]; total_candidatos: number; termo_buscado: string }> {
  const {
    termo_busca = '',
    marca,
    modelo,
    cod_erp,
    tipo_maquina,
    tecnologia,
    potencia_w,
    forca_fechamento_t,
    curso_mm,
    exato_apenas = false,
  } = params

  const normTerm = normalizeTerm(termo_busca)

  // 1. Caso numérico estrito: se o usuário pediu tonelagem ou potência específica,
  // primeiro buscamos se existe versão com esse número exato no índice
  if (forca_fechamento_t !== undefined && forca_fechamento_t !== null) {
    const { data: exactRows } = await supabase
      .from('versao_atributos_indice')
      .select('versao_id, atributo, valor_texto, valor_numerico, unidade, forma_normalizada')
      .eq('atributo', 'forca_fechamento')
      .eq('valor_numerico', forca_fechamento_t)
      .limit(20)

    if (!exactRows || exactRows.length === 0) {
      // Regra de aceite obrigatória: Se pediu tonelagem específica que não existe no catálogo,
      // NUNCA devolver a máquina mais próxima como se fosse a correta!
      return {
        candidatos: [],
        total_candidatos: 0,
        termo_buscado: `${forca_fechamento_t} toneladas`,
      }
    }
  }

  if (potencia_w !== undefined && potencia_w !== null) {
    // Busca potência tanto pelo atributo 'potencia' quanto em especificações/nomes com "30w", "30 w", etc.
    const { data: exactPowerRows } = await supabase
      .from('versao_atributos_indice')
      .select('versao_id, atributo, valor_texto, valor_numerico, unidade, forma_normalizada')
      .or(
        `and(atributo.eq.potencia,valor_numerico.eq.${potencia_w}),forma_normalizada.ilike.%${potencia_w}w%,forma_normalizada.ilike.%${potencia_w} w%`,
      )
      .limit(20)

    if ((!exactPowerRows || exactPowerRows.length === 0) && exato_apenas) {
      return {
        candidatos: [],
        total_candidatos: 0,
        termo_buscado: `${potencia_w} W`,
      }
    }
  }

  // 2. Coleta de candidatos via consultas aos atributos estruturados
  const scoresMap = new Map<
    string,
    {
      score: number
      motivos: string[]
      atributos: Array<{ atributo: string; valor: string; unidade?: string | null }>
    }
  >()

  const addMatch = (
    versaoId: string,
    points: number,
    motivo: string,
    attr?: { atributo: string; valor: string; unidade?: string | null },
  ) => {
    const current = scoresMap.get(versaoId) ?? { score: 0, motivos: [], atributos: [] }
    current.score += points
    if (!current.motivos.includes(motivo)) current.motivos.push(motivo)
    if (
      attr &&
      !current.atributos.some((a) => a.atributo === attr.atributo && a.valor === attr.valor)
    ) {
      current.atributos.push(attr)
    }
    scoresMap.set(versaoId, current)
  }

  // A. Força de fechamento exata
  if (forca_fechamento_t !== undefined && forca_fechamento_t !== null) {
    const { data: fRows } = await supabase
      .from('versao_atributos_indice')
      .select('versao_id, atributo, valor_texto, unidade')
      .eq('atributo', 'forca_fechamento')
      .eq('valor_numerico', forca_fechamento_t)
    for (const r of fRows ?? []) {
      addMatch(r.versao_id, 100, `Força de fechamento: ${r.valor_texto}`, {
        atributo: 'forca_fechamento',
        valor: r.valor_texto,
        unidade: r.unidade,
      })
    }
  }

  // B. Potência exata ou textual (ex: 30W / 30 watts)
  if (potencia_w !== undefined && potencia_w !== null) {
    const { data: pRows } = await supabase
      .from('versao_atributos_indice')
      .select('versao_id, atributo, valor_texto, unidade')
      .or(
        `and(atributo.eq.potencia,valor_numerico.eq.${potencia_w}),forma_normalizada.ilike.%${potencia_w}w%,forma_normalizada.ilike.%${potencia_w} w%`,
      )
      .limit(50)
    for (const r of pRows ?? []) {
      addMatch(r.versao_id, 85, `Potência: ${r.valor_texto}`, {
        atributo: r.atributo || 'potencia',
        valor: r.valor_texto,
        unidade: r.unidade || 'W',
      })
    }
  }

  // C. Curso exato ou próximo
  if (curso_mm !== undefined && curso_mm !== null) {
    const { data: cRows } = await supabase
      .from('versao_atributos_indice')
      .select('versao_id, atributo, valor_texto, unidade')
      .eq('atributo', 'curso')
      .eq('valor_numerico', curso_mm)
    for (const r of cRows ?? []) {
      addMatch(r.versao_id, 60, `Curso: ${r.valor_texto}`, {
        atributo: 'curso',
        valor: r.valor_texto,
        unidade: r.unidade,
      })
    }
  }

  // D. Marca
  if (marca) {
    const cleanMarca = normalizeTerm(marca)
    const { data: mRows } = await supabase
      .from('versao_atributos_indice')
      .select('versao_id, valor_texto')
      .eq('atributo', 'marca')
      .ilike('forma_normalizada', `%${cleanMarca}%`)
    for (const r of mRows ?? []) {
      addMatch(r.versao_id, 50, `Marca: ${r.valor_texto}`, {
        atributo: 'marca',
        valor: r.valor_texto,
      })
    }
  }

  // E. Código ERP
  if (cod_erp) {
    const cleanErp = normalizeTerm(cod_erp)
    const { data: eRows } = await supabase
      .from('versao_atributos_indice')
      .select('versao_id, valor_texto')
      .eq('atributo', 'cod_erp')
      .ilike('forma_normalizada', `%${cleanErp}%`)
    for (const r of eRows ?? []) {
      addMatch(r.versao_id, 90, `Código ERP: ${r.valor_texto}`, {
        atributo: 'cod_erp',
        valor: r.valor_texto,
      })
    }
  }

  // F. Modelo
  if (modelo) {
    const cleanMod = normalizeTerm(modelo)
    const { data: modRows } = await supabase
      .from('versao_atributos_indice')
      .select('versao_id, valor_texto')
      .eq('atributo', 'modelo')
      .ilike('forma_normalizada', `%${cleanMod}%`)
    for (const r of modRows ?? []) {
      addMatch(r.versao_id, 45, `Modelo: ${r.valor_texto}`, {
        atributo: 'modelo',
        valor: r.valor_texto,
      })
    }
  }

  // G. Tecnologia (laser, fibra óptica, fanuc, smart plus, injetora)
  const techTermsToSearch: string[] = []
  if (tecnologia) techTermsToSearch.push(normalizeTerm(tecnologia))
  if (tipo_maquina) techTermsToSearch.push(normalizeTerm(tipo_maquina))

  // Se termos na string de busca contiverem palavras técnicas
  if (normTerm.includes('laser')) techTermsToSearch.push('laser')
  if (normTerm.includes('fibra')) techTermsToSearch.push('fibra optica')
  if (normTerm.includes('fanuc')) techTermsToSearch.push('fanuc')
  if (normTerm.includes('smart plus') || normTerm.includes('smartplus'))
    techTermsToSearch.push('smart plus')
  if (normTerm.includes('injetor')) techTermsToSearch.push('injetora')

  for (const tech of Array.from(new Set(techTermsToSearch))) {
    const { data: tRows } = await supabase
      .from('versao_atributos_indice')
      .select('versao_id, atributo, valor_texto')
      .ilike('forma_normalizada', `%${tech}%`)
      .limit(50)
    for (const r of tRows ?? []) {
      addMatch(r.versao_id, 35, `${r.atributo}: ${r.valor_texto}`, {
        atributo: r.atributo,
        valor: r.valor_texto,
      })
    }
  }

  // H. Busca textual geral no índice por tokens de busca
  if (normTerm.length > 2) {
    const tokens = normTerm.split(/\s+/).filter((t) => t.length >= 2)
    for (const tok of tokens.slice(0, 4)) {
      const { data: textRows } = await supabase
        .from('versao_atributos_indice')
        .select('versao_id, atributo, valor_texto, unidade')
        .ilike('forma_normalizada', `%${tok}%`)
        .limit(30)

      for (const r of textRows ?? []) {
        addMatch(r.versao_id, 20, `Termo "${tok}": ${r.valor_texto}`, {
          atributo: r.atributo,
          valor: r.valor_texto,
          unidade: r.unidade,
        })
      }
    }
  }

  // 3. Busca metadados das versões candidatas para retorno estruturado
  const versaoIds = Array.from(scoresMap.keys())
  if (versaoIds.length === 0) {
    return {
      candidatos: [],
      total_candidatos: 0,
      termo_buscado: termo_busca || 'filtro técnico',
    }
  }

  const { data: versoesData } = await supabase
    .from('versoes')
    .select('id, nome, cod_erp, status, deleted_at, modelos(nome, marcas(nome))')
    .in('id', versaoIds)
    .is('deleted_at', null)
    .neq('status', 'Em Quarentena')

  const candidatos: CandidatoIndice[] = []

  for (const v of versoesData ?? []) {
    const entry = scoresMap.get(v.id)
    if (!entry) continue

    // Modelos e marcas
    const modeloNome =
      (v.modelos as unknown as { nome?: string; marcas?: { nome?: string } })?.nome ||
      'Não informado'
    const marcaNome =
      (v.modelos as unknown as { nome?: string; marcas?: { nome?: string } })?.marcas?.nome ||
      'Não informada'
    const codErpStr = v.cod_erp || 'Não preenchido'

    // Bônus se está ativo
    const isActive = v.status === 'Ativo' || v.status === 'A'
    const finalScore = entry.score + (isActive ? 15 : 0)

    candidatos.push({
      versao_id: v.id,
      nome_versao: v.nome,
      cod_erp: codErpStr,
      modelo: modeloNome,
      marca: marcaNome,
      aderencia_score: finalScore,
      motivo_correspondencia: entry.motivos.join('; '),
      atributos_casados: entry.atributos,
      is_aproximacao: finalScore < 50,
    })
  }

  candidatos.sort((a, b) => b.aderencia_score - a.aderencia_score)

  return {
    candidatos: candidatos.slice(0, 8),
    total_candidatos: candidatos.length,
    termo_buscado: termo_busca || 'filtros técnicos',
  }
}

/**
 * Definições de tools do OpenAI Function Calling
 */
const TOOLS_DEFINITIONS = [
  {
    type: 'function' as const,
    function: {
      name: 'consultar_indice_atributos',
      description:
        'Busca no índice técnico estruturado de versões da Bener Máquinas. Traduz a pergunta do representante em filtros técnicos combináveis (potência, força de fechamento em toneladas, cursos, marcas, controle CNC Fanuc/Siemens, etc.) e retorna candidatos ranqueados por aderência.',
      parameters: {
        type: 'object',
        properties: {
          termo_busca: {
            type: 'string',
            description:
              'Termos livres da busca, como "gravação a laser", "fanuc smart plus", "sa-350", "torno universal", etc.',
          },
          marca: {
            type: 'string',
            description:
              'Nome da marca comercial (ex: "SISMA", "HYUNDAI", "FCS", "VEKER", "PRIMINER", etc.).',
          },
          modelo: {
            type: 'string',
            description:
              'Modelo ou família da máquina (ex: "L3000LY", "EASY-GO", "SA-750", "TVK", etc.).',
          },
          cod_erp: {
            type: 'string',
            description: 'Código ERP da versão caso mencionado (ex: "858", "1701", "830", etc.).',
          },
          tipo_maquina: {
            type: 'string',
            description:
              'Tipo de máquina (ex: "Injetora", "Torno", "Centro de Usinagem", "Solda a Laser", "Gravação a Laser").',
          },
          tecnologia: {
            type: 'string',
            description:
              'Tecnologia chave (ex: "Fibra Óptica", "Laser", "Fanuc", "Smart Plus", "Servo").',
          },
          potencia_w: {
            type: 'number',
            description: 'Potência numérica em Watts (ex: 30 para 30W, 20 para 20W).',
          },
          forca_fechamento_t: {
            type: 'number',
            description:
              'Força de fechamento numérica em toneladas (ex: 750 para 750t, 5000 para 5000t). ATENÇÃO: se o usuário pediu uma tonelagem específica, envie este número para validação estrita.',
          },
          curso_mm: {
            type: 'number',
            description: 'Curso ou dimensão em milímetros (ex: 500, 1000).',
          },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'carregar_registro_completo_versao',
      description:
        'Carrega o registro completo e detalhado de uma versão específica identificada pelo UUID. Retorna identificação, comercial/preço, moeda, impostos, comissões, tipos de proposta vinculados, acessórios e opcionais com valores e especificações técnicas completas.',
      parameters: {
        type: 'object',
        required: ['versao_id'],
        properties: {
          versao_id: {
            type: 'string',
            description: 'UUID da versão obtido no resultado da consulta ao índice.',
          },
        },
      },
    },
  },
]

/**
 * Chamada à API OpenAI com suporte a function calling (tools) e loop de 2 etapas
 */
async function callOpenAiWithTools(
  apiKey: string,
  systemPrompt: string,
  messagesHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
  currentQuestion: string,
  supabase: SupabaseClient,
  imagePayload?: { dataUrl: string; detail?: 'low' | 'high' | 'auto' } | null,
): Promise<string> {
  const apiMessages: OpenAiMessage[] = [{ role: 'system', content: systemPrompt }]

  for (const m of messagesHistory) {
    if (m.role === 'user' || m.role === 'assistant') {
      const cleanContent = m.content?.trim()
      if (cleanContent) {
        apiMessages.push({ role: m.role, content: cleanContent })
      }
    }
  }

  const trimmedQuestion = currentQuestion.trim()

  if (imagePayload && imagePayload.dataUrl) {
    const visionInstruction =
      'ATENÇÃO: Examine CUIDADOSAMENTE TODAS AS LINHAS da imagem anexada (plaqueta de máquina, tabela de especificações, ficha técnica ou print). Use a ferramenta consultar_indice_atributos para cruzar as especificações detectadas com o catálogo Bener.'
    const userPromptText = trimmedQuestion
      ? `${trimmedQuestion}\n\n(${visionInstruction})`
      : visionInstruction

    apiMessages.push({
      role: 'user',
      content: [
        { type: 'text', text: userPromptText },
        { type: 'image_url', image_url: { url: imagePayload.dataUrl, detail: 'high' } },
      ],
    })
  } else {
    const lastMsg = apiMessages[apiMessages.length - 1]
    const lastContent = typeof lastMsg?.content === 'string' ? lastMsg.content : ''
    if (!lastMsg || lastMsg.role !== 'user' || lastContent !== trimmedQuestion) {
      apiMessages.push({ role: 'user', content: trimmedQuestion })
    }
  }

  // Loop de execução de ferramentas (até 4 rodadas)
  const MAX_TOOL_ROUNDS = 4
  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    let responseData: any = null

    for (let attempt = 0; attempt <= BACKOFF_DELAYS.length; attempt++) {
      try {
        const resp = await fetch(OPENAI_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: OPENAI_MODEL,
            messages: apiMessages,
            tools: TOOLS_DEFINITIONS,
            tool_choice: 'auto',
            reasoning_effort: 'none',
            max_completion_tokens: 2200,
          }),
        })

        if ((resp.status === 503 || resp.status === 429) && attempt < BACKOFF_DELAYS.length) {
          await new Promise((r) => setTimeout(r, BACKOFF_DELAYS[attempt]))
          continue
        }

        if (!resp.ok) {
          const errData = await resp.json().catch(() => ({}))
          console.error(`[OpenAI Error ${resp.status}]:`, JSON.stringify(errData))
          if (resp.status === 401 || resp.status === 403) {
            throw new Error(
              'O serviço de IA não pôde ser autenticado no momento. Por favor, contate o administrador.',
            )
          }
          throw new Error(errData?.error?.message || `Erro ${resp.status} na API da OpenAI`)
        }

        responseData = await resp.json()
        break
      } catch (e) {
        if (attempt >= BACKOFF_DELAYS.length) throw e
        await new Promise((r) => setTimeout(r, BACKOFF_DELAYS[attempt]))
      }
    }

    const choice = responseData?.choices?.[0]
    const choiceMessage = choice?.message

    if (!choiceMessage) {
      throw new Error('Resposta vazia da IA')
    }

    // Se o modelo invocou ferramentas
    if (choiceMessage.tool_calls && choiceMessage.tool_calls.length > 0) {
      apiMessages.push({
        role: 'assistant',
        content: choiceMessage.content || null,
        tool_calls: choiceMessage.tool_calls,
      })

      for (const call of choiceMessage.tool_calls) {
        const fnName = call.function?.name
        let fnArgs: any = {}
        try {
          fnArgs = JSON.parse(call.function?.arguments || '{}')
        } catch {
          fnArgs = {}
        }

        let toolResultStr = ''

        if (fnName === 'consultar_indice_atributos') {
          const result = await consultarIndiceAtributos(supabase, fnArgs)
          toolResultStr = JSON.stringify(result)
        } else if (fnName === 'carregar_registro_completo_versao') {
          const vid = fnArgs.versao_id
          const fullRow = vid ? await carregarRegistroCompletoVersao(supabase, vid) : null
          if (fullRow) {
            toolResultStr = formatSingleVersaoFull(fullRow)
          } else {
            toolResultStr = JSON.stringify({ error: `Versão ${vid} não encontrada no banco.` })
          }
        } else {
          toolResultStr = JSON.stringify({ error: `Ferramenta ${fnName} desconhecida.` })
        }

        apiMessages.push({
          role: 'tool',
          tool_call_id: call.id,
          content: toolResultStr,
        })
      }
      // Continua no loop para a próxima rodada (OpenAI analisa o resultado da ferramenta)
      continue
    }

    // Resposta final sem novas chamadas de ferramenta
    return choiceMessage.content || ''
  }

  return 'Desculpe, a consulta técnica atingiu o limite de etapas. Por favor, tente refinar os termos da busca.'
}

Deno.serve(async (req: Request) => {
  const cors = getCorsHeaders(req)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors })
  }

  try {
    const url = new URL(req.url)
    const isHealthUrl =
      url.searchParams.get('health') === '1' || url.searchParams.get('ping') === '1'
    if (req.method === 'GET' || isHealthUrl) {
      const apiKey = Deno.env.get('OPENAI_API_KEY')
      return new Response(
        JSON.stringify({
          status: 'ok',
          aiConfigured: Boolean(apiKey),
          architecture: 'indice_atributos_tool_calling_ponto21',
          timestamp: new Date().toISOString(),
        }),
        {
          headers: { 'Content-Type': 'application/json', Connection: 'keep-alive', ...cors },
        },
      )
    }

    const body = await req.json().catch(() => ({}))
    if (body?.ping === true || body?.action === 'ping' || body?.action === 'health') {
      const apiKey = Deno.env.get('OPENAI_API_KEY')
      return new Response(
        JSON.stringify({
          status: 'ok',
          aiConfigured: Boolean(apiKey),
          architecture: 'indice_atributos_tool_calling_ponto21',
          timestamp: new Date().toISOString(),
        }),
        {
          headers: { 'Content-Type': 'application/json', Connection: 'keep-alive', ...cors },
        },
      )
    }

    // 1. Validação de autenticação obrigatória do usuário
    const authHeader = req.headers.get('Authorization')
    if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
      return new Response(
        JSON.stringify({
          error: 'Você precisa estar conectado à sua conta para conversar com a Bener Tech I.A.',
        }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json', ...cors },
        },
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
      return new Response(
        JSON.stringify({
          error:
            'Não foi possível conectar ao banco de dados no momento. Por favor, tente novamente em alguns instantes.',
        }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...cors } },
      )
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser()

    if (authError || !user) {
      return new Response(
        JSON.stringify({
          error:
            'Sua sessão expirou ou é inválida. Por favor, faça login novamente para falar com a Bener Tech I.A.',
        }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json', ...cors },
        },
      )
    }

    // Cliente com permissão de service role para leitura de todo o catálogo (APENAS SELECTs)
    const supabase = createClient(supabaseUrl, serviceRoleKey)

    const checkUserIsAdmin = async (userId: string): Promise<boolean> => {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, status')
        .eq('id', userId)
        .maybeSingle()
      if (!profile) return false
      const role = String(profile.role || '')
        .toLowerCase()
        .trim()
      const status = String(profile.status || '')
        .toLowerCase()
        .trim()
      if (status && status !== 'ativo') return false
      return (
        role === 'admin' ||
        role === 'admin completo' ||
        role === 'administrador' ||
        role.startsWith('admin')
      )
    }

    // =========================================================================
    // ROTAS DE AÇÕES AUXILIARES / ADMIN
    // =========================================================================
    const action = typeof body?.action === 'string' ? body.action : null

    if (action === 'get_or_create_conversation') {
      const requestedId = body?.conversationId
      if (requestedId) {
        const { data: conv, error: convErr } = await supabase
          .from('chatbot_conversas')
          .select('*')
          .eq('id', requestedId)
          .eq('user_id', user.id)
          .maybeSingle()

        if (convErr) {
          return new Response(JSON.stringify({ error: convErr.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...cors },
          })
        }
        if (!conv) {
          return new Response(
            JSON.stringify({ error: 'Conversa não encontrada ou não pertence ao seu usuário.' }),
            { status: 404, headers: { 'Content-Type': 'application/json', ...cors } },
          )
        }
        return new Response(JSON.stringify({ conversation: conv }), {
          headers: { 'Content-Type': 'application/json', ...cors },
        })
      }

      const { data: existingActive } = await supabase
        .from('chatbot_conversas')
        .select('*')
        .eq('user_id', user.id)
        .eq('ativa', true)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (existingActive) {
        return new Response(JSON.stringify({ conversation: existingActive }), {
          headers: { 'Content-Type': 'application/json', ...cors },
        })
      }

      const { data: newConv, error: createErr } = await supabase
        .from('chatbot_conversas')
        .insert({
          user_id: user.id,
          titulo: 'Nova conversa',
          ativa: true,
        })
        .select()
        .single()

      if (createErr) {
        return new Response(JSON.stringify({ error: createErr.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...cors },
        })
      }

      return new Response(JSON.stringify({ conversation: newConv }), {
        headers: { 'Content-Type': 'application/json', ...cors },
      })
    }

    if (action === 'new_conversation') {
      await supabase
        .from('chatbot_conversas')
        .update({ ativa: false })
        .eq('user_id', user.id)
        .eq('ativa', true)

      const { data: created, error: cErr } = await supabase
        .from('chatbot_conversas')
        .insert({
          user_id: user.id,
          titulo: 'Nova conversa',
          ativa: true,
        })
        .select()
        .single()

      if (cErr) {
        return new Response(JSON.stringify({ error: cErr.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...cors },
        })
      }

      return new Response(JSON.stringify({ conversation: created }), {
        headers: { 'Content-Type': 'application/json', ...cors },
      })
    }

    if (action === 'get_conversation_messages') {
      const convId = body?.conversationId
      if (!convId) {
        return new Response(JSON.stringify({ error: 'conversationId não informado.' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...cors },
        })
      }

      const { data: conv, error: convErr } = await supabase
        .from('chatbot_conversas')
        .select('id, user_id, titulo, ativa, created_at, updated_at')
        .eq('id', convId)
        .maybeSingle()

      if (convErr || !conv) {
        return new Response(JSON.stringify({ error: 'Conversa não encontrada.' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json', ...cors },
        })
      }

      if (conv.user_id !== user.id) {
        return new Response(
          JSON.stringify({ error: 'Conversa não encontrada ou acesso não autorizado.' }),
          { status: 404, headers: { 'Content-Type': 'application/json', ...cors } },
        )
      }

      const { data: msgs, error: msgsErr } = await supabase
        .from('chatbot_mensagens')
        .select('*')
        .eq('conversa_id', convId)
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })

      if (msgsErr) {
        return new Response(JSON.stringify({ error: msgsErr.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...cors },
        })
      }

      return new Response(JSON.stringify({ conversation: conv, messages: msgs ?? [] }), {
        headers: { 'Content-Type': 'application/json', ...cors },
      })
    }

    if (action === 'record_feedback') {
      const msgId = body?.messageId
      const rating = body?.rating === 'like' || body?.rating === 'dislike' ? body.rating : null
      if (!msgId || !rating) {
        return new Response(
          JSON.stringify({ error: 'messageId e rating válidos são obrigatórios.' }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...cors },
          },
        )
      }

      const { error: updErr } = await supabase
        .from('chatbot_mensagens')
        .update({ feedback: rating })
        .eq('id', msgId)
        .eq('user_id', user.id)

      if (updErr) {
        return new Response(JSON.stringify({ error: updErr.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...cors },
        })
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json', ...cors },
      })
    }

    if (action === 'admin_list_users') {
      const isAdmin = await checkUserIsAdmin(user.id)
      if (!isAdmin) {
        return new Response(
          JSON.stringify({ error: 'Acesso restrito a administradores do sistema.' }),
          { status: 403, headers: { 'Content-Type': 'application/json', ...cors } },
        )
      }

      const { data: profiles, error: pErr } = await supabase
        .from('profiles')
        .select('id, name, email, role, status, avatar_url, last_seen_at')
        .order('name', { ascending: true })

      if (pErr) {
        return new Response(JSON.stringify({ error: pErr.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...cors },
        })
      }

      const { data: convStats } = await supabase
        .from('chatbot_conversas')
        .select('user_id, id, updated_at')

      const statsByUser: Record<string, { totalConversas: number; lastUpdate: string | null }> = {}
      for (const c of convStats ?? []) {
        if (!statsByUser[c.user_id]) {
          statsByUser[c.user_id] = { totalConversas: 0, lastUpdate: null }
        }
        statsByUser[c.user_id].totalConversas += 1
        if (
          !statsByUser[c.user_id].lastUpdate ||
          new Date(c.updated_at) > new Date(statsByUser[c.user_id].lastUpdate!)
        ) {
          statsByUser[c.user_id].lastUpdate = c.updated_at
        }
      }

      const enriched = (profiles ?? []).map((p) => ({
        ...p,
        totalConversas: statsByUser[p.id]?.totalConversas ?? 0,
        ultimaConversaEm: statsByUser[p.id]?.lastUpdate ?? null,
      }))

      return new Response(JSON.stringify({ users: enriched }), {
        headers: { 'Content-Type': 'application/json', ...cors },
      })
    }

    if (action === 'admin_list_user_conversations') {
      const isAdmin = await checkUserIsAdmin(user.id)
      if (!isAdmin) {
        return new Response(
          JSON.stringify({ error: 'Acesso restrito a administradores do sistema.' }),
          { status: 403, headers: { 'Content-Type': 'application/json', ...cors } },
        )
      }

      const targetUserId = body?.targetUserId
      if (!targetUserId) {
        return new Response(JSON.stringify({ error: 'targetUserId é obrigatório.' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...cors },
        })
      }

      const { data: conversas, error: cErr } = await supabase
        .from('chatbot_conversas')
        .select('id, user_id, titulo, ativa, created_at, updated_at')
        .eq('user_id', targetUserId)
        .order('updated_at', { ascending: false })

      if (cErr) {
        return new Response(JSON.stringify({ error: cErr.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...cors },
        })
      }

      const { data: targetProfile } = await supabase
        .from('profiles')
        .select('id, name, email, role')
        .eq('id', targetUserId)
        .maybeSingle()

      return new Response(
        JSON.stringify({ targetUser: targetProfile, conversations: conversas ?? [] }),
        { headers: { 'Content-Type': 'application/json', ...cors } },
      )
    }

    if (action === 'admin_get_conversation_messages') {
      const isAdmin = await checkUserIsAdmin(user.id)
      if (!isAdmin) {
        return new Response(
          JSON.stringify({ error: 'Acesso restrito a administradores do sistema.' }),
          { status: 403, headers: { 'Content-Type': 'application/json', ...cors } },
        )
      }

      const convId = body?.conversationId
      const targetUserId = body?.targetUserId
      if (!convId || !targetUserId) {
        return new Response(
          JSON.stringify({ error: 'conversationId e targetUserId são obrigatórios.' }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...cors } },
        )
      }

      const { data: conv, error: convErr } = await supabase
        .from('chatbot_conversas')
        .select('*')
        .eq('id', convId)
        .eq('user_id', targetUserId)
        .maybeSingle()

      if (convErr || !conv) {
        return new Response(JSON.stringify({ error: 'Conversa não encontrada.' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json', ...cors },
        })
      }

      const { data: msgs, error: msgsErr } = await supabase
        .from('chatbot_mensagens')
        .select('*')
        .eq('conversa_id', convId)
        .eq('user_id', targetUserId)
        .order('created_at', { ascending: true })

      if (msgsErr) {
        return new Response(JSON.stringify({ error: msgsErr.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...cors },
        })
      }

      const { data: targetProfile } = await supabase
        .from('profiles')
        .select('email, name')
        .eq('id', targetUserId)
        .maybeSingle()

      const motivo =
        typeof body?.motivo === 'string'
          ? body.motivo.trim().slice(0, 300)
          : 'Consulta visual de suporte/auditoria'
      await supabase.from('chatbot_admin_audit').insert({
        admin_id: user.id,
        admin_email: user.email ?? 'admin',
        target_user_id: targetUserId,
        target_user_email: targetProfile?.email ?? null,
        conversa_id: convId,
        motivo,
      })

      return new Response(
        JSON.stringify({
          conversation: conv,
          targetUser: targetProfile,
          messages: msgs ?? [],
          auditLogged: true,
        }),
        { headers: { 'Content-Type': 'application/json', ...cors } },
      )
    }

    if (action === 'admin_list_audit_logs') {
      const isAdmin = await checkUserIsAdmin(user.id)
      if (!isAdmin) {
        return new Response(
          JSON.stringify({ error: 'Acesso restrito a administradores do sistema.' }),
          { status: 403, headers: { 'Content-Type': 'application/json', ...cors } },
        )
      }

      const { data: logs, error: lErr } = await supabase
        .from('chatbot_admin_audit')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100)

      if (lErr) {
        return new Response(JSON.stringify({ error: lErr.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...cors },
        })
      }

      return new Response(JSON.stringify({ logs: logs ?? [] }), {
        headers: { 'Content-Type': 'application/json', ...cors },
      })
    }

    // 2. Rate limit por usuário autenticado
    const isAllowed = checkRateLimit(user.id)
    if (!isAllowed) {
      return new Response(
        JSON.stringify({
          error:
            'Você está enviando muitas perguntas seguidas. Aguarde um instante e tente de novo.',
          code: 'RATE_LIMIT_EXCEEDED',
        }),
        {
          status: 429,
          headers: { 'Content-Type': 'application/json', ...cors },
        },
      )
    }

    // 3. Validação da pergunta e anexos
    const rawQuestion =
      typeof (body?.question ?? body?.pergunta) === 'string'
        ? (body?.question ?? body?.pergunta).trim()
        : ''

    const rawAttachment =
      body?.attachment && typeof body.attachment === 'object' ? body.attachment : null

    const attachmentDoc =
      rawAttachment && !rawAttachment.isImage && !rawAttachment.imageDataUrl
        ? {
            fileName: String(rawAttachment.fileName || 'documento'),
            fileSize: Number(rawAttachment.fileSize || 0),
            fileType: String(rawAttachment.fileType || ''),
            content: typeof rawAttachment.content === 'string' ? rawAttachment.content.trim() : '',
            isScannedOrEmpty: Boolean(rawAttachment.isScannedOrEmpty),
          }
        : null

    const attachmentImage =
      rawAttachment &&
      (rawAttachment.isImage === true ||
        (typeof rawAttachment.imageDataUrl === 'string' &&
          rawAttachment.imageDataUrl.startsWith('data:image/')))
        ? {
            fileName: String(rawAttachment.fileName || 'imagem.jpg'),
            fileSize: Number(rawAttachment.fileSize || 0),
            fileType: String(rawAttachment.fileType || 'IMAGEM'),
            imageDataUrl: String(rawAttachment.imageDataUrl || '').trim(),
          }
        : null

    if (!rawQuestion && !attachmentDoc && !attachmentImage) {
      return new Response(JSON.stringify({ error: 'Pergunta não fornecida ou inválida.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...cors },
      })
    }

    const effectiveQuestion =
      rawQuestion ||
      (attachmentImage
        ? 'Por favor, analise as especificações técnicas contidas nesta imagem e identifique no catálogo da Bener as máquinas compatíveis ou correspondentes.'
        : 'Por favor, leia o documento anexado e resuma suas principais informações técnicas ou comerciais relacionadas às máquinas.')

    const question =
      effectiveQuestion.length > 4000 ? effectiveQuestion.substring(0, 4000) : effectiveQuestion

    const rawHistory = Array.isArray(body?.history ?? body?.messages)
      ? (body.history ?? body.messages)
      : []

    const history: IncomingMessage[] = rawHistory
      .filter((m: unknown): m is IncomingMessage =>
        Boolean(
          m &&
          typeof m === 'object' &&
          'role' in m &&
          'content' in m &&
          typeof (m as IncomingMessage).content === 'string',
        ),
      )
      .map((m: IncomingMessage) => {
        const trimmed = m.content.trim()
        const truncated = trimmed.length > 4000 ? trimmed.substring(0, 4000) : trimmed
        return {
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: truncated,
        }
      })
      .filter((m: IncomingMessage) => m.content.length > 0)
      .slice(-12)

    const apiKey = Deno.env.get('OPENAI_API_KEY')
    if (!apiKey) {
      return new Response(
        JSON.stringify({
          error:
            'A chave de integração com a inteligência artificial não está configurada no servidor. Por favor, contate o administrador.',
          code: 'AI_KEY_MISSING',
        }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...cors } },
      )
    }

    // Conversa ativa do usuário
    let conversationId: string | null =
      typeof body?.conversationId === 'string' ? body.conversationId : null

    if (conversationId) {
      const { data: convCheck } = await supabase
        .from('chatbot_conversas')
        .select('id, user_id')
        .eq('id', conversationId)
        .maybeSingle()

      if (!convCheck || convCheck.user_id !== user.id) {
        return new Response(
          JSON.stringify({ error: 'Conversa não encontrada ou não pertence ao seu usuário.' }),
          { status: 404, headers: { 'Content-Type': 'application/json', ...cors } },
        )
      }
    } else {
      const { data: activeConv } = await supabase
        .from('chatbot_conversas')
        .select('id')
        .eq('user_id', user.id)
        .eq('ativa', true)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (activeConv) {
        conversationId = activeConv.id
      } else {
        const previewTitle = question.slice(0, 50).trim() || 'Nova conversa'
        const { data: newConv } = await supabase
          .from('chatbot_conversas')
          .insert({
            user_id: user.id,
            titulo: previewTitle,
            ativa: true,
          })
          .select('id')
          .single()
        conversationId = newConv?.id ?? null
      }
    }

    if (
      attachmentDoc &&
      (attachmentDoc.isScannedOrEmpty ||
        !attachmentDoc.content ||
        attachmentDoc.content.length < 20)
    ) {
      const scannedMsg = `Recebi seu arquivo "${attachmentDoc.fileName}", mas ele parece ser um documento digitalizado como imagem ou sem camada de texto selecionável. Como não há texto legível para extração automática, não consegui analisar o conteúdo. Por favor, envie uma versão com texto selecionável ou digite aqui as especificações e o modelo que você precisa!`
      return new Response(JSON.stringify({ answer: scannedMsg, table: null }), {
        headers: { 'Content-Type': 'application/json', Connection: 'keep-alive', ...cors },
      })
    }

    const documentContextSnippet =
      attachmentDoc && attachmentDoc.content
        ? `\n\n--- DOCUMENTO ANEXADO PELO USUÁRIO (${attachmentDoc.fileName}) ---\n${attachmentDoc.content.slice(0, 25000)}${attachmentDoc.content.length > 25000 ? '\n[... restante do documento truncado para respeitar limites de contexto ...]' : ''}\n--- FIM DO DOCUMENTO ANEXADO ---\n`
        : ''

    // Preferências de estilo
    const { data: prefRows } = await supabase
      .from('preferencias')
      .select('valor')
      .eq('chave', 'chatbot_estilo_resposta')
      .limit(1)

    const prefValor = prefRows?.[0]?.valor as { estilo?: string } | null
    const estilo = prefValor?.estilo || ''
    const isShortMode = estilo !== 'detalhado'

    // System prompt do chatbot com diretrizes de índice e ferramentas
    const systemPrompt = `Você é a Bener Tech I.A, assistente virtual inteligente do catálogo da Bener Máquinas, prestativa, acolhedora e focada no dia a dia dos representantes comerciais.

ARQUITETURA DE CONSULTA OBRIGATÓRIA (PONTO 21):
1. VOCÊ POSSUI DUAS FERRAMENTAS PARA ACESSAR O CATÁLOGO:
   a) "consultar_indice_atributos": Traduz a pergunta do usuário em filtros sobre o índice de atributos técnicos. Retorna candidatos ranqueados por aderência.
   b) "carregar_registro_completo_versao": Carrega o registro completo de uma versão (identificação, ERP, comercial, moeda, impostos, comissões, tipos de proposta vinculados, opcionais com valores, especificações técnicas).

2. FLUXO OBRIGATÓRIO EM DUAS ETAPAS:
   - ETAPA 1 (RESOLVER): Chame sempre a ferramenta "consultar_indice_atributos" com os termos, marca, modelo, potência (Watts), força de fechamento (t), curso (mm) ou código ERP solicitados pelo usuário.
   - ETAPA 2 (CARREGAR): Com os candidatos resolvidos, chame OBRIGATORIAMENTE "carregar_registro_completo_versao" para a versão escolhida (ou para cada versão se for uma comparação) e SÓ ENTÃO responda.
   - Se houver ambiguidade entre múltiplos modelos, cite os melhores candidatos com Modelo, Marca, ERP e o atributo casado, e pergunte qual o usuário deseja detalhar.

3. CASO NEGATIVO OBRIGATÓRIO (CRÍTICO!):
   - Se o usuário perguntar por um valor específico que NÃO existe no catálogo (exemplo: "Tem injetora com força de fechamento de 5000 toneladas?", "Tem máquina com potência de 9999W?"), a ferramenta de consulta retornará zero candidatos.
   - NUNCA devolva a máquina mais próxima como se fosse a correta!
   - Responda claramente que NÃO encontrou no catálogo nenhuma máquina com aquele valor específico, cite os termos buscados e sugira refinar a busca ou consultar a engenharia comercial da Bener.
   - A sinalização de "aproximação" só é permitida quando o usuário usou descrições aproximadas ou genéricas, JAMAIS quando pediu um valor numérico exato inexistente.

4. FIDELIDADE ABSOLUTA AOS DADOS REAIS:
   - Responda SEMPRE com os valores EXATOS informados no cadastro.
   - NUNCA invente, deduza lacunas, arredonde números ou faça estimativas fictícias de preços, especificações, impostos, comissões ou acessórios.
   - Se uma informação não estiver cadastrada ou o campo for vazio, DECLARE CLARAMENTE: "não preenchido no cadastro" ou "não informado no sistema".

5. RASTREABILIDADE OBRIGATÓRIA DA FONTE:
   - Sempre que responder sobre dados de uma máquina, INDIQUE DE QUAL VERSÃO E MÁQUINA VEIO A INFORMAÇÃO, citando o nome do modelo/versão e o código ERP quando existir (ex: "Conforme o cadastro da versão FB-400R (ERP: FCS-FB400)...").

6. REGRA OBRIGATÓRIA DE FORMATAÇÃO:
   - NUNCA use formatação Markdown com asteriscos duplos (**texto**), asteriscos simples (*texto*), underscores (__texto__ ou _texto_), crases inline (\`código\`) ou títulos com cerquilha (# ou ##).
   - As respostas devem ser em TEXTO SIMPLES E LIMPO, legível e direto para representantes seniores.
   - Para destacar seções ou títulos, use LETRAS MAIÚSCULAS ou numeração simples (ex: "1. TORNO UNIVERSAL VEKER" ou "ACESSÓRIOS CADASTRADOS:").
   - Quando comparar 2 ou mais máquinas, monte o bloco:
[TABELA]
Máquina | Marca | Modelo | Código ERP | Valor referência | Situação de estoque
Nome Versão | Marca | Modelo | ERP | Moeda Valor | Situação
[/TABELA]
${isShortMode ? 'AJUSTE: Seja conciso e direto ao ponto.' : 'AJUSTE: Forneça explicações comerciais detalhadas.'}
${documentContextSnippet}`

    const imagePayload =
      attachmentImage && attachmentImage.imageDataUrl
        ? {
            dataUrl: attachmentImage.imageDataUrl,
            detail: 'high' as const,
          }
        : null

    const rawAnswer = await callOpenAiWithTools(
      apiKey,
      systemPrompt,
      history,
      question,
      supabase,
      imagePayload,
    )

    let tableData: { headers: string[]; rows: string[][]; title?: string } | null = null

    const tableBlockRegex =
      /(?:\[TABELA\]|```(?:tabela|table))\s*([\s\S]*?)\s*(?:\[\/TABELA\]|```)/i
    const match = rawAnswer.match(tableBlockRegex)

    if (match && match[1]) {
      const rawBlock = match[1].trim()
      const lines = rawBlock
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 0 && !/^[\s|:-]+$/.test(l))

      if (lines.length >= 2) {
        const parseLine = (line: string): string[] => {
          let cleaned = line
          if (cleaned.startsWith('|')) cleaned = cleaned.substring(1)
          if (cleaned.endsWith('|')) cleaned = cleaned.substring(0, cleaned.length - 1)
          return cleaned.split('|').map((c) => c.trim())
        }

        const headers = parseLine(lines[0])
        const rows = lines
          .slice(1)
          .map(parseLine)
          .filter((r) => r.length > 0)

        if (headers.length >= 2 && rows.length >= 1) {
          tableData = {
            headers,
            rows,
          }
        }
      }
    }

    // Persiste mensagens na conversa do usuário (isolamento por usuário)
    if (conversationId) {
      try {
        const userAttachmentMeta = rawAttachment
          ? {
              fileName: rawAttachment.fileName || 'anexo',
              fileSize: rawAttachment.fileSize || 0,
              fileType: rawAttachment.fileType || '',
              isImage: Boolean(rawAttachment.isImage),
            }
          : null

        await supabase.from('chatbot_mensagens').insert({
          conversa_id: conversationId,
          user_id: user.id,
          role: 'user',
          content: effectiveQuestion,
          attachment: userAttachmentMeta,
        })

        const { data: insertedAssistantMsg } = await supabase
          .from('chatbot_mensagens')
          .insert({
            conversa_id: conversationId,
            user_id: user.id,
            role: 'assistant',
            content: rawAnswer,
            table_data: tableData,
          })
          .select('id')
          .maybeSingle()

        const convTitle = effectiveQuestion.slice(0, 48).trim() || 'Conversa Bener Tech I.A'
        await supabase
          .from('chatbot_conversas')
          .update({
            updated_at: new Date().toISOString(),
            titulo: convTitle,
          })
          .eq('id', conversationId)
          .eq('user_id', user.id)

        return new Response(
          JSON.stringify({
            answer: rawAnswer,
            table: tableData,
            conversationId,
            messageId: insertedAssistantMsg?.id,
          }),
          { headers: { 'Content-Type': 'application/json', Connection: 'keep-alive', ...cors } },
        )
      } catch (persistErr) {
        console.warn('Erro ao persistir mensagens do chatbot:', persistErr)
      }
    }

    return new Response(
      JSON.stringify({
        answer: rawAnswer,
        table: tableData,
        conversationId,
      }),
      { headers: { 'Content-Type': 'application/json', Connection: 'keep-alive', ...cors } },
    )
  } catch (err) {
    console.error('Chatbot error:', err)
    const errMessage = err instanceof Error ? err.message : String(err)
    return new Response(
      JSON.stringify({
        error:
          'Tivemos uma pequena instabilidade ao consultar a Bener Tech I.A. Por favor, tente enviar sua pergunta novamente em alguns instantes.',
        details: errMessage,
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...cors },
      },
    )
  }
})
