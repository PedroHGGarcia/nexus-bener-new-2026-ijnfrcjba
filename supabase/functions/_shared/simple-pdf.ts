/**
 * Minimal pure-Deno PDF generator (zero external dependencies).
 *
 * Produces a valid multi-page PDF from an array of plain-text lines.
 * Used by the generate-proposal-pdf edge function to render a real PDF
 * binary on the Supabase Edge Runtime (no headless browser / puppeteer
 * available). The richer styled HTML document is still returned separately
 * for in-browser viewing via the public-proposal-pdf function.
 *
 * The implementation writes the classic PDF object structure by hand:
 * header, catalog, pages, font, page tree, content stream with basic
 * word-wrap pagination, xref table and trailer. Latin-1 escaping keeps
 * accented characters readable.
 */

const PAGE_WIDTH = 595.28 // A4 in points (72dpi)
const PAGE_HEIGHT = 841.89
const MARGIN_X = 56 // ~0.78in
const MARGIN_TOP = 72
const MARGIN_BOTTOM = 72
const LINE_HEIGHT = 14
const FONT_SIZE = 11
const MAX_LINE_WIDTH = PAGE_WIDTH - MARGIN_X * 2

function escapePdfText(text: string): string {
  // Normalize accented chars to ASCII so they render reliably with the
  // built-in Helvetica font (which only has WinAnsiEncoding / Latin-1).
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/\r/g, ' ')
}

/** Word-wrap a single logical line to fit MAX_LINE_WIDTH using a rough char-width estimate. */
function wrapLine(text: string, maxChars: number): string[] {
  if (text.length <= maxChars) return [text]
  const words = text.split(' ')
  const out: string[] = []
  let cur = ''
  for (const w of words) {
    const candidate = cur ? `${cur} ${w}` : w
    if (candidate.length > maxChars) {
      if (cur) out.push(cur)
      // hard-break very long single words
      if (w.length > maxChars) {
        for (let i = 0; i < w.length; i += maxChars) out.push(w.slice(i, i + maxChars))
        cur = ''
      } else {
        cur = w
      }
    } else {
      cur = candidate
    }
  }
  if (cur) out.push(cur)
  return out
}

const MAX_CHARS_PER_LINE = Math.floor(MAX_LINE_WIDTH / (FONT_SIZE * 0.52))

export function buildSimplePdf(lines: string[]): Uint8Array {
  const objects: string[] = []
  const pageRefs: number[] = []

  // Flatten input into wrapped text lines, then paginate.
  const wrapped: string[] = []
  for (const raw of lines) {
    const escaped = escapePdfText(raw == null ? '' : String(raw))
    for (const w of wrapLine(escaped, MAX_CHARS_PER_LINE)) wrapped.push(w)
  }

  const usableHeight = PAGE_HEIGHT - MARGIN_TOP - MARGIN_BOTTOM
  const linesPerPage = Math.floor(usableHeight / LINE_HEIGHT)

  const pages: string[][] = []
  for (let i = 0; i < wrapped.length; i += linesPerPage) {
    pages.push(wrapped.slice(i, i + linesPerPage))
  }
  if (pages.length === 0) pages.push([])

  // Object 1: Catalog
  objects.push('<< /Type /Catalog /Pages 2 0 R >>')

  // Object 2: Pages (placeholder, will reference page objects 3..N later)
  // We build pages after we know how many there are, so insert pages object now
  // with computed Kids once page objects exist. We'll assemble below.

  // Reserve object 2 for Pages root
  objects.push('') // placeholder, filled later

  // Object 3: Font
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>')

  // Page objects start at object 4
  let nextObj = 4
  const pageObjectIds: number[] = []

  for (const pageLines of pages) {
    const pageObjId = nextObj++
    pageObjectIds.push(pageObjId)

    const contentLines: string[] = [
      'BT',
      `/F1 ${FONT_SIZE} Tf`,
      `${LINE_HEIGHT} TL`,
      `${MARGIN_X} ${PAGE_HEIGHT - MARGIN_TOP} Td`,
    ]
    for (const line of pageLines) {
      contentLines.push(`(${line}) Tj`)
      contentLines.push('T*')
    }
    contentLines.push('ET')
    const content = contentLines.join('\n')

    const pageObj = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Contents ${nextObj} 0 R /Resources << /Font << /F1 3 0 R >> >> >>`
    objects.push(pageObj)

    // content stream object
    objects.push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`)
  }

  // Fill the Pages root (object 2)
  const kids = pageObjectIds.map((id) => `${id} 0 R`).join(' ')
  objects[1] = `<< /Type /Pages /Kids [${kids}] /Count ${pageObjectIds.length} >>`

  // Assemble PDF bytes
  const header = '%PDF-1.4\n'
  const parts: Uint8Array[] = []
  const offsets: number[] = [0] // object 0 doesn't exist; keep index aligned

  let cursor = 0
  const enc = new TextEncoder()
  const push = (s: string) => {
    const b = enc.encode(s)
    parts.push(b)
    cursor += b.length
  }

  push(header)
  // objects are 1-indexed
  for (let i = 0; i < objects.length; i++) {
    offsets[i + 1] = cursor
    push(`${i + 1} 0 obj\n${objects[i]}\nendobj\n`)
  }

  const xrefOffset = cursor
  const xrefLines = [`xref`, `0 ${objects.length + 1}`, `0000000000 65535 f `]
  for (let i = 1; i <= objects.length; i++) {
    xrefLines.push(`${String(offsets[i]).padStart(10, '0')} 00000 n `)
  }
  push(xrefLines.join('\n') + '\n')

  push(`trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`)

  // concatenate
  const total = parts.reduce((n, p) => n + p.length, 0)
  const out = new Uint8Array(total)
  let off = 0
  for (const p of parts) {
    out.set(p, off)
    off += p.length
  }
  return out
}
