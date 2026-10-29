export interface DiscountableItem {
  quantidade: number
  valor_unitario: number
  desconto_percentual?: number
  desconto_valor?: number
}

export function calculateLineTotal(item: DiscountableItem): number {
  const subtotal = item.quantidade * item.valor_unitario
  if ((item.desconto_valor ?? 0) > 0) {
    return Math.max(0, subtotal - (item.desconto_valor ?? 0))
  }
  if ((item.desconto_percentual ?? 0) > 0) {
    return subtotal * (1 - (item.desconto_percentual ?? 0) / 100)
  }
  return subtotal
}

export function calculateSubtotal(item: DiscountableItem): number {
  return item.quantidade * item.valor_unitario
}

/**
 * Calcula a diferença percentual entre o valor original (cheio) e o preço especial.
 * Retorna null se não houver desconto ou se o preço especial for >= valor original.
 * Ex.: valorOriginal = 1000, precoEspecial = 870 -> 13 (arredondado para 1 casa decimal se não inteiro: "13%")
 */
export function calculatePrecoEspecialDiscountPercent(
  valorOriginal: number | null | undefined,
  precoEspecial: number | null | undefined,
): number | null {
  if (
    valorOriginal == null ||
    precoEspecial == null ||
    isNaN(Number(valorOriginal)) ||
    isNaN(Number(precoEspecial))
  ) {
    return null
  }
  const orig = Number(valorOriginal)
  const esp = Number(precoEspecial)

  if (orig <= 0 || esp <= 0) {
    return null
  }

  if (esp >= orig) {
    return null
  }

  const rawPercent = ((orig - esp) / orig) * 100
  if (rawPercent <= 0) {
    return null
  }

  // Arredonda para no máximo 1 casa decimal amigável (ex.: 13 em vez de 13.0, 12.5 em vez de 12.5000)
  const rounded = Math.round(rawPercent * 10) / 10
  return rounded > 0 ? rounded : null
}

/**
 * Formata o percentual de desconto do preço especial para exibição amigável.
 * Ex.: 13 -> "−13%", 12.5 -> "−12,5%"
 */
export function formatPrecoEspecialDiscountBadge(
  valorOriginal: number | null | undefined,
  precoEspecial: number | null | undefined,
): string | null {
  const percent = calculatePrecoEspecialDiscountPercent(valorOriginal, precoEspecial)
  if (percent == null) return null
  const formatted = Number.isInteger(percent)
    ? String(percent)
    : percent.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
  return `−${formatted}%`
}

/**
 * Converte um valor monetário de uma moeda de origem para uma moeda de destino.
 * Validação rigorosa para impedir qualquer dupla conversão:
 * Se a moeda de origem for igual à de destino, NUNCA converte (fator = 1).
 * Cotações referem-se à taxa em Reais (1 USD = X BRL, 1 EUR = Y BRL).
 */
import { normalizeMoedaCode } from '@/lib/format'

export function convertCurrency(
  valor: number,
  fromMoeda: string | null | undefined,
  toMoeda: string | null | undefined,
  rates?: {
    cotacaoMoeda?: number | null
    usdRate?: number | null
    eurRate?: number | null
    jpyRate?: number | null
  },
): number {
  const from = normalizeMoedaCode(fromMoeda)
  const to = normalizeMoedaCode(toMoeda)

  if (!valor || isNaN(valor)) return 0
  if (from === to) return valor

  // Taxa de referência para moeda estrangeira (em relação a BRL)
  const getRateFor = (m: string): number => {
    if (m === 'BRL') return 1
    if (rates?.cotacaoMoeda && rates.cotacaoMoeda > 0) {
      return Number(rates.cotacaoMoeda)
    }
    if (m === 'USD' && rates?.usdRate && rates.usdRate > 0) {
      return Number(rates.usdRate)
    }
    if (m === 'EUR' && rates?.eurRate && rates.eurRate > 0) {
      return Number(rates.eurRate)
    }
    if (m === 'JPY' && rates?.jpyRate && rates.jpyRate > 0) {
      return Number(rates.jpyRate)
    }
    return 1
  }

  // Se origem é BRL e destino é estrangeiro (USD/EUR): divide pela taxa do destino
  if (from === 'BRL' && to !== 'BRL') {
    const rate = getRateFor(to)
    return rate > 0 ? valor / rate : valor
  }

  // Se origem é estrangeira (USD/EUR) e destino é BRL: multiplica pela taxa de origem
  if (from !== 'BRL' && to === 'BRL') {
    const rate = getRateFor(from)
    return rate > 0 ? valor * rate : valor
  }

  // Entre moedas estrangeiras diferentes (ex.: USD -> EUR ou EUR -> USD)
  const rateFrom = getRateFor(from)
  const rateTo = getRateFor(to)
  const valorInBrl = valor * rateFrom
  return rateTo > 0 ? valorInBrl / rateTo : valorInBrl
}

/**
 * Ponto 13 — Comissão de Admissão Temporária / Importação Direta.
 * Identifica se o tipo de proposta pertence às modalidades de Admissão Temporária
 * ou Importação Direta (incluindo siglas comerciais como "AT" ou nomes compostos).
 */
export function isTipoAdmissaoOrImportacao(tipoNome?: string | null): boolean {
  if (!tipoNome || typeof tipoNome !== 'string') return false
  const clean = tipoNome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()

  if (clean.includes('admissao temporaria') || clean.includes('importacao direta')) {
    return true
  }

  // Sigla "AT" (Admissão Temporária) como palavra isolada (ex: "AT - Importação Direta", "PRIMINER - AT - ")
  if (/\b(at)\b/i.test(tipoNome)) {
    return true
  }

  return false
}

export type ShippingGroup = 'importacao_direta' | 'nacionalizada' | 'outro'

/**
 * Ponto 4 — Identifica o grupo de método de envio / logística do tipo de proposta:
 * - 'importacao_direta': tipos que contenham "Importação Direta" (inclui variações CIF, FOB, etc)
 * - 'nacionalizada': tipos que contenham "Nacionalizada"
 * - 'outro': demais tipos
 */
export function getShippingGroupFromTipoNome(tipoNome?: string | null): ShippingGroup {
  if (!tipoNome || typeof tipoNome !== 'string') return 'outro'
  const clean = tipoNome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

  if (clean.includes('importacao direta')) {
    return 'importacao_direta'
  }
  if (clean.includes('nacionalizada')) {
    return 'nacionalizada'
  }
  return 'outro'
}

export function getShippingGroupLabel(group: ShippingGroup): string {
  switch (group) {
    case 'importacao_direta':
      return 'Importação Direta'
    case 'nacionalizada':
      return 'Nacionalizada'
    default:
      return 'Outro Método'
  }
}

export type BaseComissaoModo = 'completa' | 'maquina'

export const TEXTO_COMISSAO_BENER_VERBATIM =
  'Pagamento Brasil: Serviços e Comissão Bener. Itens considerados p/ base de cálculo: Máquina; Opcionais Inclusos e Impostos sobre serviços Bener'

export interface ComissaoServicosResult {
  isApplicable: boolean
  percentual: number
  baseCalculo: number
  valorCalculado: number
  textoDescritivo: string
  modo?: BaseComissaoModo
}

/**
 * Calcula a comissão/serviços Bener para tipos Admissão Temporária e Importação Direta.
 * REGRA: A base de cálculo é SEMPRE o VALOR FINAL da proposta (valor com preço especial/desconto aplicado).
 * O parâmetro `modo` é mantido por compatibilidade de assinatura, mas ignorado.
 */
export function calcComissaoServicosBener(params: {
  tipoNome?: string | null
  comissaoPct?: number | null
  baseValor: number
  modo?: BaseComissaoModo
}): ComissaoServicosResult | null {
  const { tipoNome, comissaoPct, baseValor, modo } = params
  if (!isTipoAdmissaoOrImportacao(tipoNome)) return null
  const pct = Number(comissaoPct || 0)
  if (pct <= 0) return null
  const base = Math.max(0, Number(baseValor || 0))
  if (base <= 0) return null

  const valorCalculado = Math.round(((base * pct) / 100) * 100) / 100
  return {
    isApplicable: true,
    percentual: pct,
    baseCalculo: base,
    valorCalculado,
    textoDescritivo: TEXTO_COMISSAO_BENER_VERBATIM,
    modo,
  }
}
