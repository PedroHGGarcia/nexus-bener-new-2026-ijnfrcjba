/**
 * proposal-rich-text.ts
 * Pure TypeScript (Deno/Node compatible) rich text parser and renderer for proposal PDF generation.
 *
 * Rules:
 * 1. [SPn] markers are spacing markers. NEVER output [SPn] literally in the PDF.
 *    For tabular data (label + unit + value), align explicitly in columns.
 * 2. Quebras de linha (\n) criam parágrafos/blocos distintos.
 * 3. Bullets • continuam como bullets.
 * 4. <B>...</B> renderiza em negrito (fonte Helvetica-Bold F2).
 * 5. Títulos/subheadings mantêm hierarquia visual e NUNCA ficam órfãos no fim da página (keepWithNext).
 */

export interface RichSegment {
  text: string
  bold: boolean
}

export type RichBlock =
  | { type: 'subheading'; text: string; segments: RichSegment[] }
  | {
      type: 'tabular_row'
      bulletChar?: string
      col1: RichSegment[]
      col2?: RichSegment[]
      col3?: RichSegment[]
    }
  | {
      type: 'bullet'
      bulletChar: string
      segments: RichSegment[]
    }
  | {
      type: 'paragraph'
      segments: RichSegment[]
    }

export const SP_MARKER_REGEX = /\[SP(\d+)\]/gi

export function stripSpMarkers(text: string): string {
  if (!text) return ''
  return text.replace(SP_MARKER_REGEX, '')
}

export function convertSpMarkersToPlainText(text: string): string {
  if (!text) return ''
  return text.replace(SP_MARKER_REGEX, (_, countStr) => {
    const count = parseInt(countStr, 10)
    return Number.isFinite(count) && count > 0 ? ' '.repeat(count) : ''
  })
}

export function stripBoldTags(text: string): string {
  if (!text) return ''
  return text.replace(/<\/?b\b[^>]*>/gi, '')
}

/**
 * Parses a string into an array of inline segments with bold flags from <B>...</B>.
 * All [SPn] markers are converted to spaces (or removed) so they are NEVER visible.
 */
export function parseInlineSegments(rawText: string): RichSegment[] {
  if (!rawText) return []
  // Normalize [SPn] inside segments first
  const cleanSp = convertSpMarkersToPlainText(rawText)

  const segments: RichSegment[] = []
  const boldRegex = /<b\b[^>]*>([\s\S]*?)<\/b\s*>/gi
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = boldRegex.exec(cleanSp)) !== null) {
    if (match.index > lastIndex) {
      const normalPart = cleanSp.slice(lastIndex, match.index)
      if (normalPart) {
        segments.push({ text: stripBoldTags(normalPart), bold: false })
      }
    }
    const boldInner = match[1]
    if (boldInner) {
      segments.push({ text: stripBoldTags(boldInner), bold: true })
    }
    lastIndex = boldRegex.lastIndex
  }

  if (lastIndex < cleanSp.length) {
    const remaining = cleanSp.slice(lastIndex)
    if (remaining) {
      segments.push({ text: stripBoldTags(remaining), bold: false })
    }
  }

  return segments.filter((s) => s.text.length > 0)
}

/**
 * Detects if a clean line is a subheading (all-caps, <B>...</B>, numbered section, etc.)
 */
export function isLikelySubheading(raw: string): boolean {
  const clean = raw.trim()
  if (!clean) return false
  if (/^<b\b[^>]*>([\s\S]*?)<\/b\s*>$/i.test(clean)) return true
  if (
    /^(\d{1,2}[.)\-–—]|p[oó]nto\s+\d{1,3}[:.\-–—]?)[ \t]*<b\b[^>]*>([\s\S]*?)<\/b\s*>/i.test(clean)
  )
    return true

  const stripped = stripBoldTags(clean).trim()
  if (stripped.length > 0 && stripped.length <= 80) {
    const letters = stripped.replace(/[^a-zA-ZáéíóúÁÉÍÓÚãõÃÕçÇ]/g, '')
    if (letters.length >= 3) {
      const uppers = letters.replace(/[^A-ZÁÉÍÓÚÃÕÇ]/g, '').length
      if (uppers / letters.length > 0.8) {
        return true
      }
    }
    if (stripped.endsWith(':') && stripped.length < 50) {
      return true
    }
  }
  return false
}

/**
 * Splits raw technical text into structured RichBlocks.
 */
export function parseRichBlocks(rawText: string | null | undefined): RichBlock[] {
  if (!rawText) return []
  const text = String(rawText).replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim()
  if (!text) return []

  const lines = text.split('\n')
  const blocks: RichBlock[] = []

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i]
    const trimmed = rawLine.trim()
    if (!trimmed) continue

    const isBullet = /^[•·\-\*][ \t]*/.test(trimmed)
    const bulletChar = trimmed.startsWith('-') ? '-' : '•'
    const content = isBullet ? trimmed.replace(/^[•·\-\*][ \t]*/, '').trim() : trimmed

    if (!content) continue

    // Tabular row detection via [SPn]
    const spMatches = content.match(/\[SP(\d+)\]/gi)
    const hasLargeSp =
      spMatches &&
      spMatches.some((m) => {
        const num = parseInt(m.replace(/[^0-9]/g, ''), 10)
        return num >= 4
      })
    const isTabular = Boolean(hasLargeSp || (spMatches && spMatches.length >= 2))

    if (isTabular) {
      const parts = content
        .split(/\[SP\d+\]/gi)
        .map((p) => p.trim())
        .filter(Boolean)

      if (parts.length >= 3) {
        blocks.push({
          type: 'tabular_row',
          bulletChar: isBullet ? bulletChar : undefined,
          col1: parseInlineSegments(parts[0]),
          col2: parseInlineSegments(parts[1]),
          col3: parseInlineSegments(parts.slice(2).join(' ')),
        })
        continue
      } else if (parts.length === 2) {
        blocks.push({
          type: 'tabular_row',
          bulletChar: isBullet ? bulletChar : undefined,
          col1: parseInlineSegments(parts[0]),
          col2: parseInlineSegments(parts[1]),
        })
        continue
      }
    }

    const cleanContent = convertSpMarkersToPlainText(content)

    if (isBullet) {
      blocks.push({
        type: 'bullet',
        bulletChar,
        segments: parseInlineSegments(cleanContent),
      })
      continue
    }

    if (isLikelySubheading(cleanContent)) {
      const strippedHeading = stripBoldTags(cleanContent).trim()
      blocks.push({
        type: 'subheading',
        text: strippedHeading,
        segments: parseInlineSegments(cleanContent),
      })
      continue
    }

    blocks.push({
      type: 'paragraph',
      segments: parseInlineSegments(cleanContent),
    })
  }

  return blocks
}

// Approximate textWidth for Helvetica / Helvetica-Bold
function charWidth(c: string, size: number, bold: boolean): number {
  if (c === ' ' || c === '\t') return size * 0.28
  if (/[ijlI1.,:;!'|]/.test(c)) return size * (bold ? 0.35 : 0.28)
  if (/[mwMW@]/.test(c)) return size * (bold ? 0.95 : 0.85)
  if (/[A-Z]/.test(c)) return size * (bold ? 0.75 : 0.68)
  return size * (bold ? 0.6 : 0.52)
}

export function calcTextWidth(s: string, size: number, bold = false): number {
  let w = 0
  for (let i = 0; i < s.length; i++) w += charWidth(s[i], size, bold)
  return w
}

/**
 * Wraps rich segments so they do not exceed maxW.
 */
export function wrapRichSegments(
  segments: RichSegment[],
  maxW: number,
  size = 8.5,
): RichSegment[][] {
  const lines: RichSegment[][] = []
  let curLine: RichSegment[] = []
  let curLineW = 0

  for (const seg of segments) {
    const words = seg.text.split(' ')
    for (let i = 0; i < words.length; i++) {
      const word = words[i]
      if (!word) continue
      const prefix = curLine.length > 0 && i === 0 ? ' ' : i > 0 ? ' ' : ''
      const wordWithSpace = prefix + word
      const w = calcTextWidth(wordWithSpace, size, seg.bold)

      if (curLineW + w > maxW && curLine.length > 0) {
        lines.push(curLine)
        curLine = [{ text: word, bold: seg.bold }]
        curLineW = calcTextWidth(word, size, seg.bold)
      } else {
        curLine.push({ text: wordWithSpace, bold: seg.bold })
        curLineW += w
      }
    }
  }

  if (curLine.length > 0) {
    lines.push(curLine)
  }

  return lines.length > 0 ? lines : [segments]
}

/**
 * Draws an array of inline segments at (startX, y).
 */
export function drawSegments(
  doc: any,
  startX: number,
  y: number,
  segments: RichSegment[],
  size = 8.5,
  defaultColor: [number, number, number] = [0.12, 0.14, 0.16],
): void {
  let curX = startX
  for (const seg of segments) {
    if (!seg.text) continue
    const font = seg.bold ? 'F2' : 'F1'
    const color = seg.bold ? [0.043, 0.235, 0.149] : defaultColor
    doc.txt(curX, y, seg.text, { font, size, color })
    curX += calcTextWidth(seg.text, size, seg.bold)
  }
}

/**
 * Renders technical rich content onto SimplePdfDoc with:
 * - No literal [SPn]
 * - Tabular column alignment
 * - Bold <B>...</B>
 * - Subheading hierarchy
 * - Keep with next (no orphan headings at page bottoms)
 */
export function renderRichContent(
  doc: any,
  rawText: string | null | undefined,
  ensureSpace: (h: number) => void,
): void {
  if (!rawText) return
  const blocks = parseRichBlocks(rawText)
  if (blocks.length === 0) return

  const M_LEFT = doc.margins?.left ?? 34
  const M_RIGHT = doc.margins?.right ?? 34
  const PAGE_W = 595.28
  const contentW = doc.contentW ?? PAGE_W - M_LEFT - M_RIGHT
  const GREEN: [number, number, number] = [0.043, 0.235, 0.149]
  const INK: [number, number, number] = [0.12, 0.14, 0.16]

  // Column positions for tabular data
  const col1X = M_LEFT + 22
  const col2X = M_LEFT + 265
  const col3X = M_LEFT + 325

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i]

    if (block.type === 'subheading') {
      // Keep with next: ensure there is room for the subheading + at least the first 2-3 items (~42pt)
      ensureSpace(42)
      doc.y += 4
      const title = block.text.toUpperCase()
      doc.txt(M_LEFT + 10, doc.y, title, {
        font: 'F2',
        size: 9.5,
        color: GREEN,
      })
      doc.y += 12.5
      continue
    }

    if (block.type === 'tabular_row') {
      ensureSpace(12)
      if (block.bulletChar) {
        doc.txt(M_LEFT + 12, doc.y, '\u2022', { font: 'F2', size: 8.5, color: GREEN })
      }
      drawSegments(doc, col1X, doc.y, block.col1, 8.5, INK)
      if (block.col2) {
        drawSegments(doc, col2X, doc.y, block.col2, 8.5, INK)
      }
      if (block.col3) {
        drawSegments(doc, col3X, doc.y, block.col3, 8.5, INK)
      }
      doc.y += 11.5
      continue
    }

    if (block.type === 'bullet') {
      ensureSpace(12)
      doc.txt(M_LEFT + 12, doc.y, '\u2022', { font: 'F2', size: 8.5, color: GREEN })
      const maxW = contentW - 22
      const lines = wrapRichSegments(block.segments, maxW, 8.5)
      for (const line of lines) {
        ensureSpace(11.5)
        drawSegments(doc, M_LEFT + 22, doc.y, line, 8.5, INK)
        doc.y += 11.5
      }
      continue
    }

    if (block.type === 'paragraph') {
      ensureSpace(12)
      const maxW = contentW - 12
      const lines = wrapRichSegments(block.segments, maxW, 8.5)
      for (const line of lines) {
        ensureSpace(11.5)
        drawSegments(doc, M_LEFT + 12, doc.y, line, 8.5, INK)
        doc.y += 11.5
      }
      doc.y += 2
      continue
    }
  }
}
