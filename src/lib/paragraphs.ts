/**
 * Utilitário de normalização e segmentação de parágrafos para os tipos de proposta.
 *
 * Regras (Point 5 / v0.0.575):
 * 1. Divide o texto em parágrafos por quebras de linha existentes (\r\n, \n, \r),
 *    preservando parágrafos já separados.
 * 2. Dentro de cada linha/bloco corrido, interpreta marcadores como inícios de novos parágrafos:
 *    - "Ponto N" (case-insensitive, com ou sem acento: "Ponto 1", "ponto 2", "PONTO 10", "Ponto 1:", etc.)
 *    - Marcador numerado tipo "1.", "1)", "1 -", "1. ", "1.Algo"
 *    - Bullet "•"
 * 3. Proteções contra falsos positivos:
 *    - Decimais e porcentagens: "8,80%", "12.5%", "12,5"
 *    - Números de milhares / leis / decretos: "1.234", "5.468/2005", "10.000"
 *    - Prefixos comuns como "n.º 123", "nº 1", "art. 5", "lei 12.345", etc.
 */

// Regex para detectar se uma posição no texto é um marcador que deve iniciar novo parágrafo.
// Padrão 1: Bullet •
// Padrão 2: Ponto N (ex: "Ponto 1", "PONTO 2:", "ponto 10 -")
// Padrão 3: Marcador numerado (1 a 99) seguido de:
//   - ponto e espaço ou letra (ex: "1. ", "1.Algo")
//   - fecha parêntese (ex: "1) ", "1)")
//   - hífen ou travessão (ex: "1 - ", "1 – ")
// SEMPRE garantindo que não seja número decimal/milhar (não seguido de dígitos)
// e não precedido de palavras como n.º, art., lei, decreto, R$, etc.

const PONTO_N_REGEX = /\b(p[oó]nto\s+\d{1,3})(?:[:\s\-)–—.]*)/i

/**
 * Insere quebras de linha antes de marcadores dentro de um bloco de texto contínuo.
 */
export function segmentParagraphMarkers(raw: string | null | undefined): string {
  if (raw == null) return ''
  const text = String(raw).replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  if (!text.trim()) return ''

  // Processa linha a linha para não interferir em quebras já existentes
  const lines = text.split('\n')
  const processedLines: string[] = []

  for (const line of lines) {
    const trimmedLine = line.trim()
    if (!trimmedLine) {
      processedLines.push('')
      continue
    }

    // Normaliza marcadores dentro da linha
    const segmented = segmentLineByMarkers(trimmedLine)
    processedLines.push(...segmented)
  }

  return processedLines.join('\n')
}

/**
 * Divide uma linha individual em múltiplos segmentos caso contenha marcadores no meio do texto.
 */
function segmentLineByMarkers(line: string): string[] {
  if (!line) return []

  // Tokens de corte identificados na linha com suas posições
  // Marcadores suportados:
  // 1. "•"
  // 2. "Ponto N" (case-insensitive)
  // 3. "N." ou "N)" ou "N -" onde N é de 1 a 99
  const cuts: number[] = []

  // 0. Encontrar marcadores <B> no meio do texto (Point 9: cada <B> inicia um novo parágrafo)
  const bMatches = line.matchAll(/<b\b[^>]*>/gi)
  for (const match of bMatches) {
    if (match.index !== undefined && match.index > 0 && !cuts.includes(match.index)) {
      cuts.push(match.index)
    }
  }

  // 1. Encontrar bullets "•" no meio do texto
  let bulletIdx = line.indexOf('•')
  while (bulletIdx !== -1) {
    if (bulletIdx > 0 && !cuts.includes(bulletIdx)) {
      cuts.push(bulletIdx)
    }
    bulletIdx = line.indexOf('•', bulletIdx + 1)
  }

  // 2. Encontrar "Ponto N"
  const pontoMatches = line.matchAll(/(?:^|[\s.;,])(p[oó]nto\s+\d{1,3}(?:[:\s\-)–—.]|$))/gi)
  for (const match of pontoMatches) {
    if (match.index !== undefined) {
      // Ajusta para o início exato de "Ponto" (descontando o caractere separador se houver)
      const fullMatch = match[0]
      const captured = match[1]
      const offset = fullMatch.indexOf(captured)
      const startIdx = match.index + offset
      if (startIdx > 0 && !cuts.includes(startIdx)) {
        cuts.push(startIdx)
      }
    }
  }

  // 3. Encontrar marcadores numerados: "N.", "N)", "N -", "N. "
  // Cuidado estrito para NÃO casar:
  // - "5.468/2005", "1.234" (seguidos de dígitos após ponto)
  // - "8,80%"
  // - Precedidos de "n.º", "nº", "art.", "artigo", "lei", "dec.", "decreto", "r$", "us$"
  const numberedMatches = line.matchAll(
    /(?:^|[\s.;,])(\d{1,2}(?:\.(?!\d)(?:\s+|[A-Za-zÀ-ÿ]|$)|[)\-–—](?:\s+|$|[A-Za-zÀ-ÿ])))/g,
  )
  for (const match of numberedMatches) {
    if (match.index !== undefined) {
      const fullMatch = match[0]
      const captured = match[1]
      const offset = fullMatch.indexOf(captured)
      const startIdx = match.index + offset

      if (startIdx > 0) {
        // Verifica o que vem imediatamente antes para evitar falsos positivos
        const prefix = line.slice(Math.max(0, startIdx - 15), startIdx).toLowerCase()
        const isExcluded = /(?:n[.°º]|nº|art(?:igo|\.)?|lei|dec(?:reto|\.)?|r\$|us\$|€)\s*$/i.test(
          prefix,
        )

        if (!isExcluded && !cuts.includes(startIdx)) {
          cuts.push(startIdx)
        }
      }
    }
  }

  if (cuts.length === 0) {
    return [line]
  }

  cuts.sort((a, b) => a - b)

  const segments: string[] = []
  let lastCut = 0

  for (const cut of cuts) {
    const part = line.slice(lastCut, cut).trim()
    if (part) {
      segments.push(part)
    }
    lastCut = cut
  }

  const remainder = line.slice(lastCut).trim()
  if (remainder) {
    segments.push(remainder)
  }

  return segments
}

/**
 * Remove quaisquer marcadores <B> e </B> de um texto para contextos em texto puro
 * (como tooltips, labels e valores não formatados), garantindo que nunca vazem visualmente.
 */
export function stripBoldMarkers(raw: string | number | null | undefined): string {
  if (raw == null) return ''
  return String(raw)
    .replace(/<\/?b\b[^>]*>/gi, '')
    .trim()
}

export interface FormattedParagraph {
  /** Texto destacado em negrito como título do parágrafo, se marcado com <B>...</B> */
  title?: string
  /** Conteúdo do corpo do parágrafo */
  body: string
}

/**
 * Analisa e segmenta um texto em parágrafos estruturados (FormattedParagraph),
 * interpretando marcadores <B>...</B> como títulos em negrito de novos parágrafos.
 * Limpa todos os marcadores literais para nunca vazarem.
 */
export function parseParagraphs(raw: string | number | null | undefined): FormattedParagraph[] {
  if (raw == null) return []
  const str = String(raw).trim()
  if (!str) return []

  const segmented = segmentParagraphMarkers(str)
  const lines = segmented
    .split(/\r?\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0)

  if (lines.length === 0) return []

  const results: FormattedParagraph[] = []

  // Regex para identificar início com <B>...</B> ou prefixo seguido de <B>...</B>
  // Suporta:
  // - "<B>Título</B> corpo..."
  // - "1. <B>Título</B> corpo..."
  // - "• <B>Título</B> corpo..."
  const boldWithCloseRegex =
    /^(?:(\d{1,2}[.)\-–—]|•|p[oó]nto\s+\d{1,3}[:.\-–—]?)\s*)?<b\b[^>]*>([\s\S]*?)<\/b\s*>(.*)$/i
  const unclosedBoldRegex =
    /^(?:(\d{1,2}[.)\-–—]|•|p[oó]nto\s+\d{1,3}[:.\-–—]?)\s*)?<b\b[^>]*>([\s\S]*)$/i

  for (const line of lines) {
    const matchClosed = line.match(boldWithCloseRegex)
    if (matchClosed) {
      const prefix = (matchClosed[1] || '').trim()
      const rawTitle = (matchClosed[2] || '').trim()
      const rawBody = (matchClosed[3] || '').trim()

      const cleanTitle = stripBoldMarkers(prefix ? `${prefix} ${rawTitle}` : rawTitle)
      const cleanBody = stripBoldMarkers(rawBody)

      results.push({
        title: cleanTitle || undefined,
        body: cleanBody,
      })
      continue
    }

    const matchUnclosed = line.match(unclosedBoldRegex)
    if (matchUnclosed) {
      const prefix = (matchUnclosed[1] || '').trim()
      const rawTitle = (matchUnclosed[2] || '').trim()
      const cleanTitle = stripBoldMarkers(prefix ? `${prefix} ${rawTitle}` : rawTitle)

      results.push({
        title: cleanTitle || undefined,
        body: '',
      })
      continue
    }

    // Linha sem <B> no início.
    // Se a linha anterior foi um título em negrito isolado (sem corpo),
    // associa esta linha como o corpo daquele parágrafo (desde que não inicie novo marcador).
    const isMarkerStart = /^(?:\d{1,2}[.)\-–—]|•|p[oó]nto\s+\d{1,3}[:.\-–—]?)/i.test(line)
    const prev = results[results.length - 1]

    if (prev && prev.title && !prev.body && !isMarkerStart) {
      prev.body = stripBoldMarkers(line)
    } else {
      results.push({
        body: stripBoldMarkers(line),
      })
    }
  }

  return results
}

/**
 * Converte qualquer texto de tipo de proposta em um array de parágrafos limpos,
 * aplicando quebras existentes e quebras por marcadores.
 * Garante que marcadores <B> e </B> nunca apareçam como literais.
 */
export function splitIntoParagraphs(raw: string | number | null | undefined): string[] {
  const parsed = parseParagraphs(raw)
  return parsed
    .map((p) => {
      if (p.title && p.body) return `${p.title}: ${p.body}`
      if (p.title) return p.title
      return p.body
    })
    .filter((p) => p.length > 0)
}

/**
 * Renderiza parágrafos formatados em HTML com a classe padronizada paragraph-item,
 * compatível com ProposalDocument, pdf-builder e proposal-pdf.
 * Renderiza títulos <B>...</B> com destaque em negrito e espaçamento adequado.
 */
export function renderParagraphsHtml(
  raw: string | number | null | undefined,
  extraClass = '',
  escaper: (s: string) => string = (s) =>
    s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;'),
): string {
  const paragraphs = parseParagraphs(raw)
  if (paragraphs.length === 0) return ''

  const cls = extraClass ? `paragraph-item ${extraClass}` : 'paragraph-item'

  // Caso tenha apenas 1 parágrafo e não possui título em negrito, renderiza texto direto
  if (paragraphs.length === 1 && !paragraphs[0].title) {
    return escaper(paragraphs[0].body)
  }

  return paragraphs
    .map((p) => {
      const titleHtml = p.title
        ? `<strong class="paragraph-title" style="display:block;font-weight:700;color:#0b3c26;margin-bottom:2px;-webkit-print-color-adjust:exact;print-color-adjust:exact;">${escaper(p.title)}</strong>`
        : ''
      const bodyHtml = p.body ? `<span>${escaper(p.body)}</span>` : ''
      return `<p class="${cls}">${titleHtml}${bodyHtml}</p>`
    })
    .join('')
}

/**
 * Normaliza um texto para comparação tolerante (trim, lowercase, sem acentos, sem pontuação final, colapsa espaços).
 */
export function normalizeForComparison(str: string | null | undefined): string {
  if (!str) return ''
  return String(str)
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[:\-–—.,;!?]+$/g, '') // remove pontuação ao final (ex: "Imposto IPI:" -> "Imposto IPI")
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Point 10: Determina se o valor de uma célula/campo apenas repete o próprio nome/rótulo da coluna.
 *
 * Exemplos:
 * - "Imposto IPI" sob a coluna "Imposto IPI" -> true
 * - "imposto IPI:" sob "Imposto IPI" -> true
 * - "IPI" sob "Imposto IPI" -> true
 * - "imposto_ipi" sob "Imposto IPI" -> true
 * - "Imposto ICMS" sob "Imposto ICMS" -> true
 * - "ICMS" sob "Imposto ICMS" -> true
 * - "imposto_icms" sob "Imposto ICMS" -> true
 * - "Garantia" sob "Garantia" -> true
 * - "Prazo de Entrega" sob "Prazo de Entrega" -> true
 * - "12 meses" sob "Garantia" -> false
 * - "8,80%" sob "Imposto IPI" -> false
 * - "Isento conforme Decreto 1.234" sob "Imposto IPI" -> false
 */
export function isSelfReferencingValue(value: unknown, columnLabelOrKey?: string | null): boolean {
  if (value == null) return false
  const rawStr = typeof value === 'string' ? value : String(value)
  const normVal = normalizeForComparison(rawStr)
  if (!normVal) return false

  // Se nenhum rótulo foi passado, checa se casa com apelidos genéricos conhecidos de IPI/ICMS
  const knownTaxHeaders = [
    'imposto ipi',
    'impostoipi',
    'ipi',
    'imposto icms',
    'impostoicms',
    'icms',
  ]

  if (!columnLabelOrKey) {
    const compactVal = normVal.replace(/[^a-z0-9]/g, '')
    return (
      knownTaxHeaders.includes(normVal) ||
      compactVal === 'impostoipi' ||
      compactVal === 'ipi' ||
      compactVal === 'impostoicms' ||
      compactVal === 'icms'
    )
  }

  const normCol = normalizeForComparison(columnLabelOrKey)
  if (!normCol) return false

  // 1. Igualdade direta após normalização
  if (normVal === normCol) return true

  // 2. Remoção total de caracteres não alfanuméricos ("imposto_ipi" vs "Imposto IPI")
  const compactVal = normVal.replace(/[^a-z0-9]/g, '')
  const compactCol = normCol.replace(/[^a-z0-9]/g, '')
  if (compactVal && compactCol && compactVal === compactCol) return true

  // 3. Casos especiais de impostos onde o valor é apenas a sigla e a coluna é "Imposto X" ou vice-versa
  const isIpiCol = compactCol === 'impostoipi' || compactCol === 'ipi' || normCol.includes('ipi')
  if (isIpiCol) {
    if (compactVal === 'ipi' || compactVal === 'impostoipi' || normVal === 'imposto ipi') {
      return true
    }
  }

  const isIcmsCol =
    compactCol === 'impostoicms' || compactCol === 'icms' || normCol.includes('icms')
  if (isIcmsCol) {
    if (compactVal === 'icms' || compactVal === 'impostoicms' || normVal === 'imposto icms') {
      return true
    }
  }

  return false
}

/**
 * Ponto 6 & Ponto 10: Determina se um valor de imposto (IPI/ICMS) deve ser omitido.
 * Suprime:
 * - nulos, vazios, "-", "—", "N/A", "0", "0%", "0.0%", "0,0%", "0,00%", etc.
 * - Point 10: valores auto-referentes como "Imposto IPI", "IPI", "Imposto ICMS", "ICMS"
 */
export function isTaxValueEmpty(raw: unknown, columnLabel?: string): boolean {
  if (raw == null) return true
  const str = String(raw).trim()
  if (!str) return true
  const normalized = str.toLowerCase().replace(/\s+/g, '')
  if (
    normalized === '-' ||
    normalized === '—' ||
    normalized === '–' ||
    normalized === 'n/a' ||
    normalized === 'na' ||
    normalized === 'none' ||
    normalized === 'nenhum' ||
    normalized === '0' ||
    normalized === '0%' ||
    normalized === '0,0%' ||
    normalized === '0.0%' ||
    normalized === '0,00%' ||
    normalized === '0.00%' ||
    normalized === '0,0' ||
    normalized === '0.0'
  ) {
    return true
  }

  // Point 10: Se o valor repete o nome da coluna de imposto ("Imposto IPI", "IPI", "Imposto ICMS", "ICMS")
  if (isSelfReferencingValue(str, columnLabel || 'imposto')) {
    return true
  }

  return false
}

/**
 * Ponto 6 & Ponto 10: Determina se um campo genérico de proposta / termos comerciais deve ser omitido.
 * Suprime se nulo, indefinido, string vazia (após trim), placeholders óbvios ("-", "—", "N/A")
 * ou quando o valor for auto-referente ao rótulo da própria coluna (Point 10).
 */
export function isCommercialFieldEmpty(raw: unknown, columnLabel?: string): boolean {
  if (raw == null) return true
  if (typeof raw === 'number') {
    return isNaN(raw)
  }
  const str = String(raw).trim()
  if (!str) return true
  const lower = str.toLowerCase()
  if (lower === '-' || lower === '—' || lower === '–' || lower === 'n/a' || lower === 'na') {
    return true
  }
  if (columnLabel && isSelfReferencingValue(str, columnLabel)) {
    return true
  }
  return false
}
