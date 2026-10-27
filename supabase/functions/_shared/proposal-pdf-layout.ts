/**
 * Layout-aware pure-Deno PDF generator for proposals (zero external deps).
 *
 * Reproduces the old-system (Pack System) proposal look for the PDF that is
 * stored in the `propostas-pdf` bucket and attached to e-mails:
 *   - Institutional header: logo + "Bener Comercial Importadora Exportadora
 *     Ltda." + long date + Sigla | N° Oferta | Mês | Ano box
 *   - Client block ("À" / company / address / A/C)
 *   - Reception text + machine title + machine image
 *   - Technical sections (Especificações, Características, Configuração Standard)
 *   - Commercial table (Item/Descrição/Tipo/Qtd/Valor Unit./Desconto/Subtotal)
 *   - Terms of supply table + signatures + institutional footer
 *
 * Draws real vector PDF (text runs, rects, lines) with the built-in Helvetica
 * family (WinAnsiEncoding). Images: JPEG embedded directly (DCTDecode); PNG
 * decoded (8-bit, non-interlaced, color types 0/2/3/4/6) and recompressed,
 * alpha composited on white. Anything unsupported degrades gracefully.
 */

import { calcComissaoServicosBener, TEXTO_COMISSAO_BENER_VERBATIM } from './pdf-builder.ts'

const PAGE_W = 595.28
const PAGE_H = 841.89
const M_LEFT = 42
const M_RIGHT = 42
const M_TOP = 42
const M_BOTTOM = 60

// Helvetica / Helvetica-Bold advance widths (per 1000 units), ASCII 32..126
const W_REG = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556,
  556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667,
  611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667,
  667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500,
  222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
]
const W_BOLD = [
  278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556,
  556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611, 975, 722, 722, 722, 722, 667,
  611, 778, 722, 278, 556, 722, 611, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667,
  667, 611, 333, 278, 333, 584, 556, 333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556,
  278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584,
]

// WinAnsi remaps for common punctuation outside Latin-1
const WIN_ANSI_MAP: Record<number, number> = {
  0x20ac: 128,
  0x201a: 130,
  0x201e: 132,
  0x2026: 133,
  0x2020: 134,
  0x2021: 135,
  0x2030: 136,
  0x2039: 139,
  0x2018: 145,
  0x2019: 146,
  0x201c: 147,
  0x201d: 148,
  0x2022: 149,
  0x2013: 150,
  0x2014: 151,
  0x2122: 153,
  0x203a: 155,
}

function escapePdfString(s: string): string {
  let out = ''
  for (const ch of s) {
    let code = ch.codePointAt(0) ?? 63
    if (code > 255) {
      if (WIN_ANSI_MAP[code] != null) {
        out += '\\' + WIN_ANSI_MAP[code].toString(8).padStart(3, '0')
        continue
      }
      const norm = ch.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      code = norm.codePointAt(0) ?? 63
      if (code > 255) code = 63
    }
    if (ch === '\\' || ch === '(' || ch === ')') out += '\\' + ch
    else if (code < 32) out += ' '
    else if (code > 126) out += '\\' + code.toString(8).padStart(3, '0')
    else out += ch
  }
  return out
}

export function textWidth(s: string, size: number, bold = false): number {
  const table = bold ? W_BOLD : W_REG
  let total = 0
  for (const ch of s) {
    let code = ch.codePointAt(0) ?? 63
    if (code > 255 && WIN_ANSI_MAP[code] != null) code = WIN_ANSI_MAP[code]
    if (code >= 32 && code <= 126) total += table[code - 32]
    else total += bold ? 611 : 556
  }
  return (total / 1000) * size
}

type RGB = [number, number, number]
const INK: RGB = [0.09, 0.11, 0.13]
const GREEN: RGB = [0.043, 0.235, 0.149] // #0b3c26
const GRAY: RGB = [0.35, 0.39, 0.44]
const LIGHT: RGB = [0.92, 0.93, 0.94]

export interface PdfImage {
  name: string
  data: Uint8Array
  filter: 'DCTDecode' | 'FlateDecode' | 'none'
  width: number
  height: number
}

export type LoadedImg =
  | { kind: 'jpeg'; bytes: Uint8Array; width: number; height: number }
  | { kind: 'png'; width: number; height: number; rgb: Uint8Array }
  | null

interface TxtOpts {
  font?: 'F1' | 'F2' | 'F3'
  size?: number
  color?: RGB
  align?: 'left' | 'center' | 'right'
  w?: number
  strike?: boolean
}

class PdfDoc {
  pages: string[] = []
  ops: string[] = []
  y = M_TOP
  images: PdfImage[] = []
  private imgCount = 0

  get contentW(): number {
    return PAGE_W - M_LEFT - M_RIGHT
  }
  get bottomLimit(): number {
    return PAGE_H - M_BOTTOM
  }
  private flushPage(): void {
    if (this.ops.length === 0) return
    this.pages.push(this.ops.join('\n'))
    this.ops = []
  }
  newPage(): void {
    this.flushPage()
    this.y = M_TOP
  }
  get pageCount(): number {
    return this.pages.length + (this.ops.length ? 1 : 0)
  }
  ensure(h: number): void {
    if (this.y + h > this.bottomLimit) this.newPage()
  }

  txt(x: number, yTop: number, s: string, o: TxtOpts = {}): void {
    if (!s) return
    const size = o.size ?? 10
    const font = o.font ?? 'F1'
    const [r, g, b] = o.color ?? INK
    let tx = x
    const tw = textWidth(s, size, font === 'F2')
    if (o.align === 'center' && o.w != null) tx = x + (o.w - tw) / 2
    else if (o.align === 'right' && o.w != null) tx = x + o.w - tw
    const ty = PAGE_H - yTop - size * 0.78
    this.ops.push(
      `BT /${font} ${size} Tf ${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} rg 1 0 0 1 ${tx.toFixed(2)} ${ty.toFixed(2)} Tm (${escapePdfString(s)}) Tj ET`,
    )
    if (o.strike && tw > 0) {
      const ly = PAGE_H - yTop - size * 0.5
      this.ops.push(
        `${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} RG 0.5 w ${tx.toFixed(2)} ${ly.toFixed(2)} m ${(tx + tw).toFixed(2)} ${ly.toFixed(2)} l S`,
      )
    }
  }

  rect(
    x: number,
    yTop: number,
    w: number,
    h: number,
    o: { fill?: RGB; stroke?: RGB; lw?: number } = {},
  ): void {
    const y = PAGE_H - yTop - h
    if (o.fill) {
      const [r, g, b] = o.fill
      this.ops.push(
        `${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} rg ${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re f`,
      )
    }
    if (o.stroke) {
      const [r, g, b] = o.stroke
      this.ops.push(
        `${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} RG ${o.lw ?? 0.6} w ${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re S`,
      )
    }
  }

  hline(x1: number, x2: number, yTop: number, o: { lw?: number; color?: RGB } = {}): void {
    const [r, g, b] = o.color ?? [0.55, 0.57, 0.6]
    const y = PAGE_H - yTop
    this.ops.push(
      `${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} RG ${o.lw ?? 0.6} w ${x1.toFixed(2)} ${y.toFixed(2)} m ${x2.toFixed(2)} ${y.toFixed(2)} l S`,
    )
  }

  vline(x: number, yTop1: number, yTop2: number, o: { lw?: number; color?: RGB } = {}): void {
    const [r, g, b] = o.color ?? [0.55, 0.57, 0.6]
    this.ops.push(
      `${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} RG ${o.lw ?? 0.6} w ${x.toFixed(2)} ${(PAGE_H - yTop1).toFixed(2)} m ${x.toFixed(2)} ${(PAGE_H - yTop2).toFixed(2)} l S`,
    )
  }

  registerImage(img: NonNullable<LoadedImg>): string {
    this.imgCount += 1
    const name = `Im${this.imgCount}`
    if (img.kind === 'jpeg') {
      this.images.push({
        name,
        data: img.bytes,
        filter: 'DCTDecode',
        width: img.width,
        height: img.height,
      })
    } else {
      this.images.push({
        name,
        data: img.rgb,
        filter: 'FlateDecode',
        width: img.width,
        height: img.height,
      })
    }
    return name
  }

  drawImage(
    name: string,
    x: number,
    yTop: number,
    boxW: number,
    boxH: number,
    img: NonNullable<LoadedImg>,
  ): void {
    const iw = img.width || 1
    const ih = img.height || 1
    const scale = Math.min(boxW / iw, boxH / ih)
    const dw = iw * scale
    const dh = ih * scale
    const dx = x + (boxW - dw) / 2
    const dy = PAGE_H - yTop - dh
    this.ops.push(
      `q ${dw.toFixed(2)} 0 0 ${dh.toFixed(2)} ${dx.toFixed(2)} ${dy.toFixed(2)} cm /${name} Do Q`,
    )
  }

  wrap(s: string, w: number, size: number, bold = false): string[] {
    const out: string[] = []
    for (const raw of String(s ?? '').split('\n')) {
      const words = raw.split(' ')
      let cur = ''
      for (const word of words) {
        const cand = cur ? `${cur} ${word}` : word
        if (textWidth(cand, size, bold) > w && cur) {
          out.push(cur)
          cur = word
        } else {
          cur = cand
        }
      }
      out.push(cur)
    }
    return out
  }

  para(x: number, w: number, s: string, o: TxtOpts = {}, lineH = 12): void {
    const size = o.size ?? 10
    const bold = o.font === 'F2'
    const lines = this.wrap(s, w, size, bold)
    for (const line of lines) {
      this.ensure(lineH)
      this.txt(x, this.y, line, o)
      this.y += lineH
    }
  }
}

// ---------- image decoding ----------

function concatBytes(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0)
  const out = new Uint8Array(total)
  let off = 0
  for (const p of parts) {
    out.set(p, off)
  }
  return out
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

async function inflateBytes(data: Uint8Array): Promise<Uint8Array> {
  const ds = new DecompressionStream('deflate')
  const stream = new Blob([data as unknown as BlobPart]).stream().pipeThrough(ds)
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

async function deflateBytes(data: Uint8Array): Promise<Uint8Array | null> {
  try {
    const cs = new CompressionStream('deflate')
    const stream = new Blob([data as unknown as BlobPart]).stream().pipeThrough(cs)
    return new Uint8Array(await new Response(stream).arrayBuffer())
  } catch {
    return null
  }
}

function jpegSize(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return null
  let i = 2
  while (i + 9 < bytes.length) {
    if (bytes[i] !== 0xff) {
      i++
      continue
    }
    const marker = bytes[i + 1]
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      const height = (bytes[i + 5] << 8) | bytes[i + 6]
      const width = (bytes[i + 7] << 8) | bytes[i + 8]
      return { width, height }
    }
    const len = (bytes[i + 2] << 8) | bytes[i + 3]
    if (len <= 0) return null
    i += 2 + len
  }
  return null
}

async function decodePngToRgb(
  bytes: Uint8Array,
): Promise<{ width: number; height: number; rgb: Uint8Array } | null> {
  try {
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    if (bytes[0] !== 0x89 || bytes[1] !== 0x50 || bytes[2] !== 0x4e || bytes[3] !== 0x47)
      return null
    let off = 8
    let width = 0
    let height = 0
    let bitDepth = 0
    let colorType = 0
    let interlace = 0
    let plte: Uint8Array | null = null
    let trns: number[] | null = null
    const idat: Uint8Array[] = []
    while (off + 8 <= bytes.length) {
      const len = dv.getUint32(off)
      const type = String.fromCharCode(
        bytes[off + 4],
        bytes[off + 5],
        bytes[off + 6],
        bytes[off + 7],
      )
      const data = bytes.subarray(off + 8, off + 8 + len)
      if (type === 'IHDR') {
        width = dv.getUint32(off + 8)
        height = dv.getUint32(off + 12)
        bitDepth = bytes[off + 16]
        colorType = bytes[off + 17]
        interlace = bytes[off + 20]
      } else if (type === 'PLTE') plte = data
      else if (type === 'tRNS') trns = Array.from(data)
      else if (type === 'IDAT') idat.push(data)
      else if (type === 'IEND') break
      off += 12 + len
    }
    if (!width || !height || interlace !== 0 || bitDepth !== 8) return null
    const channels =
      colorType === 0
        ? 1
        : colorType === 2
          ? 3
          : colorType === 3
            ? 1
            : colorType === 4
              ? 2
              : colorType === 6
                ? 4
                : 0
    if (!channels) return null
    const raw = await inflateBytes(concatBytes(idat))
    const stride = width * channels
    const out = new Uint8Array(height * stride)
    let prev = new Uint8Array(stride)
    let p = 0
    for (let row = 0; row < height; row++) {
      if (p >= raw.length) return null
      const filter = raw[p++]
      const line = raw.subarray(p, p + stride)
      p += stride
      const cur = new Uint8Array(stride)
      for (let i = 0; i < stride; i++) {
        const a = i >= channels ? cur[i - channels] : 0
        const b = prev[i]
        const c = i >= channels ? prev[i - channels] : 0
        let v = i < line.length ? line[i] : 0
        if (filter === 1) v = (v + a) & 255
        else if (filter === 2) v = (v + b) & 255
        else if (filter === 3) v = (v + ((a + b) >> 1)) & 255
        else if (filter === 4) {
          const pa = Math.abs(b - c)
          const pb = Math.abs(a - c)
          const pc = Math.abs(a + b - 2 * c)
          const pr = pa <= pb && pa <= pc ? a : pb <= pc ? b : c
          v = (v + pr) & 255
        }
        cur[i] = v
      }
      out.set(cur, row * stride)
      prev = cur
    }
    const rgb = new Uint8Array(width * height * 3)
    for (let i = 0; i < width * height; i++) {
      let r = 255
      let g = 255
      let b = 255
      let a = 255
      if (colorType === 0) {
        r = g = b = out[i]
      } else if (colorType === 2) {
        r = out[i * 3]
        g = out[i * 3 + 1]
        b = out[i * 3 + 2]
      } else if (colorType === 3) {
        const idx = out[i]
        if (plte && idx * 3 + 2 < plte.length) {
          r = plte[idx * 3]
          g = plte[idx * 3 + 1]
          b = plte[idx * 3 + 2]
        }
        if (trns && trns[idx] != null) a = trns[idx]
      } else if (colorType === 4) {
        r = g = b = out[i * 2]
        a = out[i * 2 + 1]
      } else {
        r = out[i * 4]
        g = out[i * 4 + 1]
        b = out[i * 4 + 2]
        a = out[i * 4 + 3]
      }
      if (a < 255) {
        const k = a / 255
        r = Math.round(r * k + 255 * (1 - k))
        g = Math.round(g * k + 255 * (1 - k))
        b = Math.round(b * k + 255 * (1 - k))
      }
      rgb[i * 3] = r
      rgb[i * 3 + 1] = g
      rgb[i * 3 + 2] = b
    }
    return { width, height, rgb }
  } catch {
    return null
  }
}

export async function loadImage(urlOrDataUrl: string | null | undefined): Promise<LoadedImg> {
  if (!urlOrDataUrl) return null
  try {
    let bytes: Uint8Array
    if (urlOrDataUrl.startsWith('data:')) {
      const comma = urlOrDataUrl.indexOf(',')
      if (comma < 0) return null
      bytes = base64ToBytes(urlOrDataUrl.slice(comma + 1))
    } else {
      const resp = await fetch(urlOrDataUrl)
      if (!resp.ok) return null
      bytes = new Uint8Array(await resp.arrayBuffer())
    }
    if (bytes.length < 8) return null
    if (bytes[0] === 0xff && bytes[1] === 0xd8) {
      const size = jpegSize(bytes)
      if (size && size.width > 0)
        return { kind: 'jpeg', bytes, width: size.width, height: size.height }
      return null
    }
    if (bytes[0] === 0x89 && bytes[1] === 0x50) {
      const png = await decodePngToRgb(bytes)
      if (png) return { kind: 'png', width: png.width, height: png.height, rgb: png.rgb }
    }
  } catch {
    return null
  }
  return null
}

// ---------- PDF assembly ----------

function assemblePdf(pages: string[], images: PdfImage[]): Uint8Array {
  const enc = new TextEncoder()
  const parts: Uint8Array[] = []
  let cursor = 0
  const offsets: number[] = [0]
  const push = (s: string) => pushBytes(enc.encode(s))
  const pushBytes = (b: Uint8Array) => {
    parts.push(b)
    cursor += b.length
  }

  const header = '%PDF-1.4\n'
  pushBytes(enc.encode(header))

  const objects: (string | { bytes: Uint8Array })[] = []
  objects.push('<< /Type /Catalog /Pages 2 0 R >>') // 1
  objects.push('') // 2 placeholder (Pages)
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>') // 3
  objects.push(
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
  ) // 4
  objects.push(
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique /Encoding /WinAnsiEncoding >>',
  ) // 5

  const imgRefs = images.map((img, i) => ({ id: 6 + i, img }))
  for (const { img } of imgRefs) {
    const filterPart = img.filter === 'none' ? '' : ` /Filter /${img.filter}`
    const dict = `<< /Type /XObject /Subtype /Image /Width ${img.width} /Height ${img.height} /ColorSpace /DeviceRGB /BitsPerComponent 8${filterPart} /Length ${img.data.length} >>`
    objects.push(dict)
    objects.push({ bytes: img.data })
  }

  const firstPageObj = 6 + images.length * 2
  const kids = pages.map((_, i) => `${firstPageObj + i * 2} 0 R`).join(' ')
  objects[1] = `<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>`

  const xobjDict = images.length
    ? ` /XObject << ${images.map((im) => `/${im.name} ${6 + images.indexOf(im) * 2} 0 R`).join(' ')} >>`
    : ''

  pages.forEach((content, i) => {
    const pageId = firstPageObj + i * 2
    const pageDict = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W.toFixed(2)} ${PAGE_H.toFixed(2)}] /Contents ${pageId + 1} 0 R /Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >>${xobjDict} >> >>`
    objects.push(pageDict)
    objects.push({
      bytes: enc.encode(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`),
    })
  })

  for (let i = 0; i < objects.length; i++) {
    offsets[i + 1] = cursor
    const obj = objects[i]
    if (typeof obj === 'string') {
      push(`${i + 1} 0 obj\n${obj}\nendobj\n`)
    } else {
      push(`${i + 1} 0 obj\n`)
      pushBytes(obj.bytes)
      push('\nendobj\n')
    }
  }

  const xrefOffset = cursor
  const xrefLines = ['xref', `0 ${objects.length + 1}`, '0000000000 65535 f ']
  for (let i = 1; i <= objects.length; i++)
    xrefLines.push(`${String(offsets[i]).padStart(10, '0')} 00000 n `)
  push(xrefLines.join('\n') + '\n')
  push(`trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`)

  const total = parts.reduce((n, p) => n + p.length, 0)
  const out = new Uint8Array(total)
  let off = 0
  for (const p of parts) {
    out.set(p, off)
    off += p.length
  }
  return out
}

// ---------- proposal layout ----------

function fmt2(n: number | null | undefined): string {
  return (Number(n) || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function normalizeMoeda(m: string | null | undefined): string {
  if (!m) return 'BRL'
  const c = m.trim().toUpperCase()
  if (c === 'USD' || c === 'DOLAR' || c === 'DÓLAR') return 'USD'
  if (c === 'EUR' || c === 'EURO') return 'EUR'
  if (c === 'CHF' || c === 'FRANCO' || c.startsWith('FRANCO')) return 'CHF'
  if (c === 'BRL' || c === 'REAL' || c === 'REAIS' || c === 'R$') return 'BRL'
  return c
}

function fmtMoney(v: number | null | undefined, moeda: string | null | undefined): string {
  const norm = normalizeMoeda(moeda)
  const sym = norm === 'USD' ? 'US$ ' : norm === 'EUR' ? '\u20ac ' : norm === 'CHF' ? 'CHF ' : 'R$ '
  return sym + fmt2(v)
}

function longDate(dtCad: string | null | undefined): string {
  const d = dtCad ? new Date(`${dtCad}T12:00:00`) : new Date()
  const s = d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
  return `Vinhedo, ${s.charAt(0).toUpperCase()}${s.slice(1)}`
}

interface BuildInput {
  proposta: any
  equipmentItems: any[]
  tipoProposta?: Record<string, any> | null
  creatorInfo?: { name: string; email: string } | null
  logo?: LoadedImg
  machineImage?: LoadedImg
}

export async function buildProposalPdfBytes(input: BuildInput): Promise<Uint8Array> {
  const { proposta: p, equipmentItems, tipoProposta: tpInput } = input
  const doc = new PdfDoc()

  const dadosSnapshot = p.dados_snapshot as Record<string, any> | null
  const tp =
    (dadosSnapshot?.tipo_proposta_detalhes as Record<string, any>) ||
    (tpInput as Record<string, any>) ||
    null

  const numero = p.numero_proposta || '-'
  const revisao = p.revisao || ''
  const rawRepNome =
    p.representantes?.sigla ||
    p.representantes?.fantasia ||
    p.nome_representante_comercial ||
    p.representante_original ||
    p.user ||
    ''
  const firstWord = rawRepNome.trim().split(/\s+/)[0] || ''
  const sigla = firstWord
    ? firstWord.charAt(0).toUpperCase() + firstWord.slice(1).toLowerCase()
    : '—'
  const mes = String(
    p.dt_cad ? new Date(`${p.dt_cad}T12:00:00`).getMonth() + 1 : new Date().getMonth() + 1,
  ).padStart(2, '0')
  const ano = String(
    p.dt_cad ? new Date(`${p.dt_cad}T12:00:00`).getFullYear() : new Date().getFullYear(),
  )
  const moeda = p.moeda || 'BRL'

  const c = p.clientes || {}
  const clientName = c.razao_social || c.fantasia || p.cliente_original || 'Cliente'
  const clientStreet = [c.logradouro, c.numero].filter(Boolean).join(', ')
  const clientAddress = [
    clientStreet,
    c.complementos,
    c.bairro,
    c.cidade ? `${c.cidade}${c.estado ? ` - ${c.estado}` : ''}` : c.estado,
  ]
    .filter(Boolean)
    .join(' - ')
  const clientPhone = c.telefone || p.telefone || ''
  const clientEmail = c.email || ''
  const contactName = c.contato || p.contato || ''

  const primary = equipmentItems[0]
  const primaryV = primary?.versoes || p.versoes || {}
  const machineTitle = String(
    primaryV?.nome ||
      primaryV?.nome_abreviado ||
      p.versao_original ||
      p.descricao_proposta ||
      'EQUIPAMENTO INDUSTRIAL',
  ).toUpperCase()

  const terms: Array<[string, string]> = []
  const addTerm = (label: string, val: unknown) => {
    const s = val == null ? '' : String(val)
    if (s.trim()) terms.push([label, s])
  }
  addTerm('Condições de Pagamento', p.condicoes_pagamento || tp?.condicoes_pagamento)
  addTerm('Prazo de Entrega', p.prazo_entrega || tp?.prazo_entrega)
  addTerm('Validade da Oferta', p.validade_oferta || tp?.validade_oferta)
  addTerm('Cobertura de Garantia', p.cobertura_garantia)
  addTerm('Garantia de Acessórios', p.garantia_acessorios || tp?.garantia)
  addTerm('Normas Aplicáveis', p.normas_aplicaveis)
  addTerm('Normas de Segurança', p.normas_seguranca)
  addTerm('Certificações', p.certificacoes)
  addTerm('Certificações de Segurança', p.certificacoes_seguranca)
  addTerm('Assistência Técnica', p.assistencia_tecnica_detalhada || tp?.assistencia_tecnica)
  addTerm('Critérios de Aceitação', p.criterios_aceitacao)
  addTerm('Materiais Utilizados', p.materiais_utilizados)
  addTerm('Transporte/Seguro', p.transporte_seguro || tp?.transporte_seguro)
  addTerm(
    'Imposto IPI',
    p.imposto_ipi != null && p.imposto_ipi !== 0
      ? `${p.imposto_ipi}%`
      : tp?.imposto_ipi
        ? `${tp.imposto_ipi}%`
        : null,
  )
  addTerm(
    'Imposto ICMS',
    p.imposto_icms != null && p.imposto_icms !== 0
      ? `${p.imposto_icms}%`
      : tp?.imposto_icmi
        ? `${tp.imposto_icms}%`
        : null,
  )
  addTerm('Treinamento Técnico', p.treinamento_tecnico || tp?.treinamento_tecnico)
  addTerm('Frase de Preço', p.frase_preco || tp?.frase_preco)

  const hasAdditionalContent =
    Boolean(
      primaryV?.especificacoes_tecnicas || p.especificacoes_tecnicas || p.descricao_proposta,
    ) ||
    Boolean(primaryV?.caracteristicas_construtivas) ||
    Boolean(primaryV?.acessorios_standards) ||
    (Array.isArray(p.acessorios_proposta) && p.acessorios_proposta.length > 0) ||
    Boolean(p.is_pacote && equipmentItems && equipmentItems.length > 0) ||
    terms.length > 0 ||
    p.valor_final != null

  const drawHeader = (): void => {
    const y0 = doc.y
    if (input.logo) {
      const name = doc.registerImage(input.logo)
      doc.drawImage(name, M_LEFT, y0, 150, 44, input.logo)
    } else {
      doc.txt(M_LEFT, y0, 'BENER', { font: 'F2', size: 22, color: GREEN })
      doc.txt(M_LEFT, y0 + 24, 'MÁQUINAS QUE TRANSFORMAM', { font: 'F1', size: 6.5, color: GRAY })
    }
    doc.txt(PAGE_W - M_RIGHT, y0 + 2, 'Bener Comercial Importadora Exportadora Ltda.', {
      font: 'F2',
      size: 11,
      align: 'right',
      w: 0,
    })
    doc.txt(PAGE_W - M_RIGHT, y0 + 17, longDate(p.dt_cad), {
      font: 'F1',
      size: 9.5,
      align: 'right',
      w: 0,
    })

    // Sigla | N° Oferta | Mês | Ano box (right-aligned)
    const boxW = 250
    const colW = [45, 115, 45, 45]
    const boxX = PAGE_W - M_RIGHT - boxW
    const boxY = y0 + 34
    const rowH = 15
    doc.rect(boxX, boxY, boxW, rowH * 2, { stroke: INK, lw: 0.9 })
    const heads = ['Sigla', 'N° Oferta', 'Mês', 'Ano']
    const vals = [sigla || '—', numero, mes, ano]
    let curX = boxX
    for (let i = 0; i < 4; i++) {
      if (i > 0) doc.vline(curX, boxY, boxY + rowH * 2)
      doc.txt(curX, boxY + 4, heads[i], {
        font: 'F2',
        size: 8,
        align: 'center',
        w: colW[i],
      })
      const isOffer = i === 1
      const offerFontSize = isOffer && String(vals[i]).length > 10 ? 7.5 : 9
      doc.txt(curX, boxY + rowH + 3, vals[i], {
        font: 'F1',
        size: offerFontSize,
        align: 'center',
        w: colW[i],
      })
      curX += colW[i]
    }
    doc.hline(boxX + colW[0], boxX + colW[0] + colW[1] + colW[2], boxY + rowH, {
      lw: 0.9,
      color: [0.2, 0.2, 0.2],
    })

    doc.y = Math.max(y0 + 48, boxY + rowH * 2) + 10
    doc.hline(M_LEFT, PAGE_W - M_RIGHT, doc.y, { lw: 1.1, color: [0.15, 0.15, 0.15] })
    doc.y += 14
  }

  const drawCompactHeader = (): void => {
    doc.txt(
      M_LEFT,
      doc.y,
      `Proposta ${numero}${revisao ? ` — Rev. ${revisao}` : ''} (continuação)`,
      { font: 'F2', size: 9, color: GRAY },
    )
    doc.txt(PAGE_W - M_RIGHT, doc.y, 'Bener Comercial Importadora Exportadora Ltda.', {
      font: 'F1',
      size: 9,
      align: 'right',
      w: 0,
    })
    doc.y += 10
    doc.hline(M_LEFT, PAGE_W - M_RIGHT, doc.y, { lw: 0.8 })
    doc.y += 12
  }

  const ensureSpace = (h: number): void => {
    if (doc.y + h > doc.bottomLimit) {
      doc.newPage()
      drawCompactHeader()
    }
  }

  const sectionHeading = (title: string): void => {
    ensureSpace(26)
    doc.rect(M_LEFT, doc.y, 3, 12, { fill: GREEN })
    doc.txt(M_LEFT + 8, doc.y + 1, title.toUpperCase(), { font: 'F2', size: 10, color: GREEN })
    doc.y += 16
    doc.hline(M_LEFT, PAGE_W - M_RIGHT, doc.y, { lw: 0.5, color: [0.75, 0.78, 0.8] })
    doc.y += 6
  }

  // ===== PAGE 1 =====
  drawHeader()

  // Client block
  doc.txt(M_LEFT, doc.y, 'À', { font: 'F1', size: 10 })
  doc.y += 13
  doc.txt(M_LEFT, doc.y, clientName, { font: 'F2', size: 12 })
  doc.y += 15
  if (clientAddress) {
    doc.para(M_LEFT, doc.contentW, clientAddress, { size: 9.5 }, 12)
  }
  if (clientPhone) {
    doc.txt(M_LEFT, doc.y, `Telefone: ${clientPhone}`, { font: 'F1', size: 9.5 })
    doc.y += 12
  }
  if (clientEmail) {
    doc.txt(M_LEFT, doc.y, `E-mail: ${clientEmail}`, { font: 'F1', size: 9.5 })
    doc.y += 12
  }
  doc.y += 4
  doc.txt(
    M_LEFT,
    doc.y,
    contactName ? `A/C: ${contactName}` : 'A/C: Diretor / Gerente de Compras',
    {
      font: contactName ? 'F2' : 'F1',
      size: 10,
    },
  )
  doc.y += 18

  // Reception text
  doc.txt(M_LEFT, doc.y, 'Prezados Senhores,', { font: 'F1', size: 10 })
  doc.y += 14
  doc.para(
    M_LEFT,
    doc.contentW,
    'Atendendo a sua prezada consulta, temos o prazer de submeter a vossa devida apreciação nossa proposta acima citada, para o fornecimento de:',
    { size: 10 },
    13,
  )
  doc.y += 10

  // Machine title
  const titleLines = doc.wrap(machineTitle, doc.contentW - 40, 12, true)
  for (const line of titleLines) {
    doc.txt(M_LEFT, doc.y, line, { font: 'F2', size: 12, align: 'center', w: doc.contentW })
    doc.y += 15
  }
  doc.y += 8

  // Machine image (fits in the remaining cover space)
  const remaining = doc.bottomLimit - 24 - doc.y
  if (input.machineImage && remaining > 110) {
    const boxH = Math.min(320, remaining - 20)
    const name = doc.registerImage(input.machineImage)
    doc.drawImage(name, M_LEFT + 60, doc.y, doc.contentW - 120, boxH, input.machineImage)
    doc.y += boxH + 6
    doc.txt(M_LEFT, doc.y, 'Imagem meramente ilustrativa', {
      font: 'F3',
      size: 8,
      color: GRAY,
      align: 'center',
      w: doc.contentW,
    })
    doc.y += 12
  }

  if (hasAdditionalContent) {
    doc.newPage()
  }

  // ===== TECHNICAL SECTIONS =====
  const specs =
    primaryV?.especificacoes_tecnicas || p.especificacoes_tecnicas || p.descricao_proposta
  if (specs) {
    sectionHeading('Especificações Técnicas')
    doc.para(M_LEFT + 10, doc.contentW - 10, String(specs), { size: 9 }, 11.5)
    doc.y += 8
  }
  if (primaryV?.caracteristicas_construtivas) {
    sectionHeading('Características Construtivas')
    doc.para(
      M_LEFT + 10,
      doc.contentW - 10,
      String(primaryV.caracteristicas_construtivas),
      { size: 9 },
      11.5,
    )
    doc.y += 8
  }
  if (primaryV?.acessorios_standards) {
    sectionHeading('Configuração Standard')
    doc.para(
      M_LEFT + 10,
      doc.contentW - 10,
      String(primaryV.acessorios_standards),
      { size: 9 },
      11.5,
    )
    doc.y += 8
  }

  // Regra 7: Acessórios com 3 estados mutuamente exclusivos
  const acessorios = Array.isArray(p.acessorios_proposta) ? (p.acessorios_proposta as any[]) : []
  const filteredAcc = acessorios.filter((a) => a && a.inclusao !== 'nao_exibir')
  const inclusos = filteredAcc.filter(
    (a) =>
      a.inclusao === 'incluir' ||
      a.inclusao === 'preco' ||
      a.inclusao === undefined ||
      a.inclusao === null,
  )
  const naoInclusos = filteredAcc.filter(
    (a) => a.inclusao === 'opcional' || a.inclusao === 'exibir',
  )
  const drawAccList = (title: string, list: any[], withPrice: boolean) => {
    if (list.length === 0) return
    sectionHeading(title)
    for (const a of list) {
      const label = `${a.quantidade ? `${a.quantidade}x ` : ''}${a.nome || '—'}`
      ensureSpace(12)
      doc.txt(M_LEFT + 14, doc.y, '\u2022', { font: 'F2', size: 9, color: GREEN })
      doc.txt(M_LEFT + 24, doc.y, label, { font: 'F1', size: 9 })
      if (withPrice && a.valor != null) {
        const itemMoeda = normalizeMoeda(a.moeda || moeda)
        const price = fmtMoney(a.valor, itemMoeda)
        doc.txt(PAGE_W - M_RIGHT, doc.y, price, { font: 'F2', size: 9, align: 'right', w: 0 })
      }
      doc.y += 12
    }
    doc.y += 6
  }
  drawAccList('Acessórios Opcionais Inclusos no Preço', inclusos, false)
  drawAccList('Acessórios Opcionais Não Inclusos no Preço', naoInclusos, true)

  // ===== COMMERCIAL TABLE =====
  ensureSpace(120)
  doc.rect(M_LEFT, doc.y, 3, 12, { fill: INK })
  doc.txt(M_LEFT + 8, doc.y + 1, 'CONDIÇÕES COMERCIAIS', { font: 'F2', size: 10.5 })
  doc.txt(
    PAGE_W - M_RIGHT,
    doc.y + 3,
    p.is_pacote ? 'Pacote de Máquinas' : 'Fornecimento Unitário',
    {
      font: 'F1',
      size: 8.5,
      color: GRAY,
      align: 'right',
      w: 0,
    },
  )
  doc.y += 18

  const colW = [28, 190, 35, 95, 68, 99]
  const totalW = colW.reduce((a, b) => a + b, 0)
  const tblX = M_LEFT
  const heads = [
    'Item',
    'Descrição do Equipamento',
    'Qtd',
    'Valor Unitário',
    'Desconto',
    'Subtotal',
  ]
  const aligns: Array<'left' | 'center' | 'right'> = [
    'center',
    'left',
    'center',
    'right',
    'right',
    'right',
  ]

  const drawThead = () => {
    const h = 18
    doc.rect(tblX, doc.y, totalW, h, { fill: LIGHT })
    let x = tblX
    for (let i = 0; i < heads.length; i++) {
      doc.txt(x + 4, doc.y + 5, heads[i], {
        font: 'F2',
        size: 7.5,
        color: [0.25, 0.28, 0.32],
        align: aligns[i],
        w: colW[i] - 8,
      })
      if (i > 0) doc.vline(x, doc.y, doc.y + h)
      x += colW[i]
    }
    doc.rect(tblX, doc.y, totalW, h, { stroke: [0.6, 0.62, 0.65], lw: 0.7 })
    doc.y += h
  }
  drawThead()

  interface Row {
    nome: string
    tipo: string | null
    qtd: number
    moeda: string
    valOrig: number
    valUnitEfetivo: number
    descTxt: string
    total: number
    hasDisc: boolean
  }
  const rows: Row[] = []
  if (p.is_pacote && equipmentItems.length > 0) {
    equipmentItems.forEach((item: any, idx: number) => {
      const v = item.versoes || {}
      const qtd = item.quantidade || 1
      const unit = Number(item.valor_unitario || 0)
      const subtotal = qtd * unit
      const descVal = Number(item.desconto_valor || 0)
      const descPct = Number(item.desconto_percentual || 0)
      const total = descVal > 0 ? Math.max(0, subtotal - descVal) : subtotal * (1 - descPct / 100)
      const hasDisc = descPct > 0 || descVal > 0
      rows.push({
        nome: v?.nome || v?.nome_abreviado || `Item ${idx + 1}`,
        tipo: item.tipo_proposta || (idx === 0 ? p.tipo_proposta : null) || null,
        qtd,
        moeda: v?.moeda || moeda,
        valOrig: unit,
        valUnitEfetivo: qtd > 0 ? total / qtd : total,
        descTxt:
          descPct > 0 ? `${descPct}%` : descVal > 0 ? fmtMoney(descVal, v?.moeda || moeda) : '—',
        total,
        hasDisc,
      })
    })
  } else {
    const rawSem =
      Number(p.valor_sem_desconto) > 0 ? Number(p.valor_sem_desconto) : Number(p.valor_final || 0)
    const precoEsp =
      p.preco_especial != null && Number(p.preco_especial) > 0 ? Number(p.preco_especial) : null
    const pct = Number(p.percentual_desconto || 0)
    const hasDisc =
      pct > 0 || (precoEsp != null && precoEsp > 0) || rawSem > Number(p.valor_final || 0)
    const valOrig = rawSem > 0 ? rawSem : Number(p.valor_final || 0)
    const valEfetivo = precoEsp != null ? precoEsp : Number(p.valor_final || 0)
    const descPct =
      pct > 0
        ? pct
        : precoEsp != null && valOrig > 0 && precoEsp < valOrig
          ? Math.round(((valOrig - precoEsp) / valOrig) * 1000) / 10
          : 0
    rows.push({
      nome: machineTitle,
      tipo: p.tipo_proposta || null,
      qtd: 1,
      moeda,
      valOrig,
      valUnitEfetivo: Number(p.valor_final || 0) > 0 ? Number(p.valor_final) : valEfetivo,
      descTxt: descPct > 0 ? `${descPct}%` : '—',
      total: valEfetivo,
      hasDisc,
    })
  }

  // Ponto 13: Comissão de Admissão Temporária / Importação Direta no PDF binário
  const tpOverrideLayout =
    (p.tipo_proposta_override as Record<string, any> | null) ||
    (dadosSnapshot?.tipo_proposta_override as Record<string, any> | null) ||
    null
  const tipoNomeLayout =
    tpOverrideLayout?.nome ||
    p.tipo_proposta ||
    (dadosSnapshot?.tipo_proposta as string) ||
    (tpSnapshot?.nome as string) ||
    (equipmentItems && equipmentItems[0]?.tipo_proposta) ||
    null

  const comissaoPctLayout =
    tpOverrideLayout?.comissao != null
      ? Number(tpOverrideLayout.comissao)
      : tpSnapshot?.comissao != null
        ? Number(tpSnapshot.comissao)
        : p.percentual_comissao_servicos != null
          ? Number(p.percentual_comissao_servicos)
          : (dadosSnapshot?.percentual_comissao_servicos as number) || 0

  let baseCalculoLayout = 0
  if (p.base_comissao_servicos != null && Number(p.base_comissao_servicos) > 0) {
    baseCalculoLayout = Number(p.base_comissao_servicos)
  } else if (
    dadosSnapshot?.base_comissao_servicos != null &&
    Number(dadosSnapshot.base_comissao_servicos) > 0
  ) {
    baseCalculoLayout = Number(dadosSnapshot.base_comissao_servicos)
  } else if (rows.length > 0) {
    baseCalculoLayout = rows.reduce((acc, r) => acc + r.total, 0)
    inclusos.forEach((a: any) => {
      const q = Number(a.quantidade || 1)
      const v = Number(a.valor || 0)
      const d = Number(a.desconto_valor || 0)
      const pct = Number(a.desconto_percentual || 0)
      const sub = q * v
      const tot = d > 0 ? Math.max(0, sub - d) : sub * (1 - pct / 100)
      baseCalculoLayout += tot
    })
  } else {
    baseCalculoLayout = Number(p.valor_sem_desconto || p.valor_final || 0)
  }

  let valorComissaoLayout = 0
  let comissaoAplicavelLayout = false

  if (p.valor_comissao_servicos != null && Number(p.valor_comissao_servicos) > 0) {
    valorComissaoLayout = Number(p.valor_comissao_servicos)
    comissaoAplicavelLayout = true
  } else if (
    dadosSnapshot?.valor_comissao_servicos != null &&
    Number(dadosSnapshot.valor_comissao_servicos) > 0
  ) {
    valorComissaoLayout = Number(dadosSnapshot.valor_comissao_servicos)
    comissaoAplicavelLayout = true
  } else {
    const calcRes = calcComissaoServicosBener({
      tipoNome: tipoNomeLayout,
      comissaoPct: comissaoPctLayout,
      baseValor: baseCalculoLayout,
    })
    if (calcRes && calcRes.valorCalculado > 0) {
      valorComissaoLayout = calcRes.valorCalculado
      comissaoAplicavelLayout = true
    }
  }

  if (comissaoAplicavelLayout && valorComissaoLayout > 0) {
    rows.push({
      nome: TEXTO_COMISSAO_BENER_VERBATIM,
      tipo: null,
      qtd: 0, // exibido como "—"
      moeda,
      valOrig: 0,
      valUnitEfetivo: 0,
      descTxt: '—',
      total: valorComissaoLayout,
      hasDisc: false,
    })
  }

  for (const row of rows) {
    const descLines = doc.wrap(row.nome, colW[1] - 8, 8.5, true)
    const rowH = Math.max(16, descLines.length * 10 + 6)
    const before = doc.pageCount
    ensureSpace(rowH + 4)
    if (doc.pageCount !== before) drawThead()
    const yTop = doc.y
    doc.rect(tblX, yTop, totalW, rowH, { stroke: [0.75, 0.77, 0.8], lw: 0.5 })
    let x = tblX
    const midY = yTop + rowH / 2 - 3
    for (let i = 0; i < heads.length; i++) {
      if (i > 0) doc.vline(x, yTop, yTop + rowH)
      const cw = colW[i]
      const isComissaoRow = row.nome === TEXTO_COMISSAO_BENER_VERBATIM
      if (i === 0)
        doc.txt(x, midY, isComissaoRow ? '—' : String(rows.indexOf(row) + 1), {
          font: 'F1',
          size: 8.5,
          align: 'center',
          w: cw,
        })
      else if (i === 1)
        descLines.forEach((l, li) =>
          doc.txt(x + 4, yTop + 4 + li * 10, l, { font: 'F2', size: 8.5 }),
        )
      else if (i === 2)
        doc.txt(x, midY, isComissaoRow ? '—' : String(row.qtd), {
          font: 'F1',
          size: 8.5,
          align: 'center',
          w: cw,
        })
      else if (i === 3) {
        if (isComissaoRow) {
          doc.txt(x, midY, '—', { font: 'F1', size: 8.5, align: 'right', w: cw })
        } else if (row.hasDisc) {
          doc.txt(x, midY - 6, fmtMoney(row.valOrig, row.moeda), {
            font: 'F1',
            size: 7.5,
            color: GRAY,
            align: 'right',
            w: cw,
            strike: true,
          })
          doc.txt(x, midY + 3, fmtMoney(row.valUnitEfetivo, row.moeda), {
            font: 'F2',
            size: 8.5,
            align: 'right',
            w: cw,
          })
        } else {
          doc.txt(x, midY, fmtMoney(row.valOrig, row.moeda), {
            font: 'F2',
            size: 8.5,
            align: 'right',
            w: cw,
          })
        }
      } else if (i === 4)
        doc.txt(x, midY, isComissaoRow ? '—' : row.descTxt, {
          font: 'F1',
          size: 8.5,
          align: 'right',
          w: cw,
        })
      else {
        if (!isComissaoRow && row.hasDisc) {
          doc.txt(x, midY - 6, fmtMoney(row.qtd * row.valOrig, row.moeda), {
            font: 'F1',
            size: 7.5,
            color: GRAY,
            align: 'right',
            w: cw,
            strike: true,
          })
          doc.txt(x, midY + 3, fmtMoney(row.total, row.moeda), {
            font: 'F2',
            size: 9,
            align: 'right',
            w: cw,
          })
        } else {
          doc.txt(x, midY, fmtMoney(row.total, row.moeda), {
            font: 'F2',
            size: 9,
            align: 'right',
            w: cw,
          })
        }
      }
      x += cw
    }
    doc.y += rowH
  }

  // Totals row (soma comissão quando aplicável)
  const rawFinalLayout = Number(p.valor_final || 0)
  let totalComComissao = rawFinalLayout
  if (comissaoAplicavelLayout && valorComissaoLayout > 0) {
    if (Math.abs(rawFinalLayout - baseCalculoLayout) < 0.05) {
      totalComComissao = rawFinalLayout + valorComissaoLayout
    } else {
      totalComComissao = rawFinalLayout
    }
  }

  const totalValor =
    p.preco_especial != null && Number(p.preco_especial) > 0
      ? Number(p.preco_especial)
      : totalComComissao
  const totalOrig =
    p.preco_especial != null && Number(p.preco_especial) > 0 ? totalComComissao : null
  const totalH = 20
  ensureSpace(totalH)
  doc.rect(tblX, doc.y, totalW, totalH, { fill: LIGHT, stroke: [0.55, 0.57, 0.6], lw: 0.8 })
  const machineRowsCount = rows.filter((r) => r.nome !== TEXTO_COMISSAO_BENER_VERBATIM).length
  const totalLabel = `Valor Total do Fornecimento${p.is_pacote && machineRowsCount > 1 ? ` (${machineRowsCount} máquinas)` : ''}`
  doc.txt(tblX + 6, doc.y + 6, totalLabel.toUpperCase(), {
    font: 'F2',
    size: 8,
    color: [0.25, 0.28, 0.32],
  })
  const prevW = colW[0] + colW[1] + colW[2] + colW[3] + colW[4]
  const lastColW = colW[5]
  if (totalOrig != null) {
    doc.txt(tblX + prevW, doc.y + 2, fmtMoney(totalOrig, moeda), {
      font: 'F1',
      size: 8,
      color: GRAY,
      align: 'right',
      w: lastColW,
      strike: true,
    })
    doc.txt(tblX + prevW, doc.y + 10, fmtMoney(totalValor, moeda), {
      font: 'F2',
      size: 10,
      align: 'right',
      w: lastColW,
    })
  } else {
    doc.txt(tblX + prevW, doc.y + 5, fmtMoney(totalValor, moeda), {
      font: 'F2',
      size: 10.5,
      align: 'right',
      w: lastColW,
    })
  }
  doc.y += totalH + 8

  // Regra 1: Bloco Câmbio/Cotação só aparece quando há conversão REAL
  const moedaOrigNormalized = normalizeMoeda(p.moeda_original || p.moeda || 'BRL')
  const moedaPropNormalized = normalizeMoeda(moeda)
  if (moedaPropNormalized !== moedaOrigNormalized && p.cotacao_moeda) {
    ensureSpace(24)
    const taxa = Number(p.cotacao_moeda || p.cambio_estimado)
    const dataCot = p.data_cotacao_moeda || p.cambio_estimado_data
    doc.rect(M_LEFT, doc.y, doc.contentW, 18, {
      fill: [0.96, 0.97, 0.97],
      stroke: [0.8, 0.82, 0.84],
      lw: 0.5,
    })
    doc.txt(
      M_LEFT + 6,
      doc.y + 5,
      `Câmbio: 1 ${moedaPropNormalized} = R$ ${fmt2(taxa)}${dataCot ? ` (data: ${dataCot})` : ''} — Moeda Original: ${moedaOrigNormalized}`,
      {
        font: 'F1',
        size: 8.5,
      },
    )
    doc.y += 24
  }

  // ===== TERMS =====
  if (terms.length > 0) {
    ensureSpace(60)
    doc.rect(M_LEFT, doc.y, doc.contentW, 16, { fill: GREEN })
    doc.txt(M_LEFT + 8, doc.y + 4, 'TERMOS DE FORNECIMENTO & INFORMAÇÕES COMERCIAIS', {
      font: 'F2',
      size: 9,
      color: [1, 1, 1],
    })
    doc.y += 16
    const labelW = 170
    for (const [label, value] of terms) {
      const valLines = doc.wrap(value, doc.contentW - labelW - 12, 8.5)
      const rowH = Math.max(14, valLines.length * 10 + 5)
      ensureSpace(rowH)
      doc.rect(M_LEFT, doc.y, doc.contentW, rowH, { stroke: [0.85, 0.86, 0.88], lw: 0.4 })
      doc.txt(M_LEFT + 6, doc.y + 4, label.toUpperCase(), {
        font: 'F2',
        size: 7,
        color: [0.3, 0.33, 0.38],
      })
      valLines.forEach((l, li) =>
        doc.txt(M_LEFT + labelW, doc.y + 4 + li * 10, l, { font: 'F1', size: 8.5 }),
      )
      doc.y += rowH
    }
    doc.y += 10
  }

  // Regra 9: Campos do Tipo de Proposta e Informações Adicionais da Proposta
  const snapshotCampos = dadosSnapshot?.campos_adicionais
  let campos: any =
    Array.isArray(snapshotCampos) && snapshotCampos.length > 0
      ? snapshotCampos
      : p.campos_adicionais
  if (typeof campos === 'string') {
    try {
      campos = JSON.parse(campos)
    } catch {
      campos = null
    }
  }
  if (Array.isArray(campos) && campos.length > 0) {
    for (const f of campos) {
      const fTitle = String(f?.titulo || f?.chave || '').trim()
      const fContent = f?.conteudo != null ? f.conteudo : f?.valor
      if (!fTitle && !fContent) continue
      ensureSpace(30)
      if (fTitle) {
        sectionHeading(fTitle)
      }
      if (fContent) doc.para(M_LEFT + 10, doc.contentW - 10, String(fContent), { size: 9 }, 11.5)
      doc.y += 6
    }
  }

  // ===== CLOSING TEXT & SIGNATURES =====
  // Keep closing text and signatures together to avoid pushing only signatures onto an extra page
  ensureSpace(140)
  doc.y += 8
  doc.para(
    M_LEFT,
    doc.contentW,
    'Antecipadamente agradecemos vossa honrosa preferência, permanecendo ao vosso inteiro dispor, para dirimir e atender quaisquer eventuais esclarecimentos adicionais que se fizerem necessários.',
    { font: 'F1', size: 8.5 },
    11.5,
  )
  doc.y += 8
  doc.txt(M_LEFT, doc.y, 'Atenciosamente', { font: 'F1', size: 8.5, color: [0.1, 0.1, 0.1] })
  doc.y += 12

  // ===== SIGNATURES =====
  doc.txt(M_LEFT, doc.y, 'DE ACORDO E ASSINATURAS', { font: 'F2', size: 9.5, color: GREEN })
  doc.y += 6
  doc.hline(M_LEFT, PAGE_W - M_RIGHT, doc.y, { lw: 0.5, color: [0.75, 0.78, 0.8] })
  doc.y += 32
  const sigW = doc.contentW / 3
  const sigs: Array<[string, string | null | undefined]> = [
    ['Gerente de Produto', p.nome_gerente_produto || p.gerentes?.nome || p.gerente_original],
    ['Assessor Técnico', p.nome_assessor_tecnico],
    [
      'Representante Comercial',
      p.nome_representante_comercial || p.representantes?.fantasia || p.representante_original,
    ],
  ]
  sigs.forEach(([role, name], i) => {
    const x = M_LEFT + sigW * i
    const lineW = sigW - 24
    doc.hline(x + 12, x + 12 + lineW, doc.y, { lw: 0.8, color: [0.2, 0.2, 0.2] })
    doc.txt(x + 12, doc.y + 4, name || '—', { font: 'F2', size: 8.5, align: 'center', w: lineW })
    doc.txt(x + 12, doc.y + 14, role, {
      font: 'F1',
      size: 7.5,
      color: GRAY,
      align: 'center',
      w: lineW,
    })
  })
  doc.y += 26

  // ===== FOOTERS (drawn per page at the end) =====
  // Flush any pending ops of the last page before counting/appending footers.
  if (doc.ops.length) {
    doc.pages.push(doc.ops.join('\n'))
    doc.ops = []
  }
  const total = doc.pageCount
  for (let i = 0; i < doc.pages.length; i++) {
    const footerOps: string[] = []
    const savedOps = doc.ops
    doc.ops = footerOps
    const fy = PAGE_H - 46
    doc.hline(M_LEFT, PAGE_W - M_RIGHT, fy, { lw: 0.6, color: [0.7, 0.72, 0.75] })
    doc.txt(M_LEFT, fy + 4, 'Rua Iracema Lucas, 450 (Antiga Rua Parsch) - Distrito Industrial', {
      font: 'F1',
      size: 7.5,
      color: GRAY,
      align: 'center',
      w: doc.contentW,
    })
    doc.txt(
      M_LEFT,
      fy + 13,
      'Vinhedo - SP - Brasil - CEP: 13280-172 - Fone / Fax: (0**19) 3826-7373',
      { font: 'F1', size: 7.5, color: GRAY, align: 'center', w: doc.contentW },
    )
    doc.txt(M_LEFT, fy + 22, 'E-mail: vendas@bener.com.br - Site: www.bener.com.br', {
      font: 'F1',
      size: 7.5,
      color: GRAY,
      align: 'center',
      w: doc.contentW,
    })
    doc.txt(M_LEFT, fy - 12, `Página ${i + 1}/${total}`, {
      font: 'F2',
      size: 8,
      align: 'right',
      w: doc.contentW,
    })
    doc.ops = savedOps
    doc.pages[i] = doc.pages[i] ? `${doc.pages[i]}\n${footerOps.join('\n')}` : footerOps.join('\n')
  }

  // Compress PNG payloads
  for (const img of doc.images) {
    if (img.filter === 'FlateDecode') {
      const compressed = await deflateBytes(img.data)
      if (compressed && compressed.length < img.data.length) {
        img.data = compressed
      } else {
        img.filter = 'none'
      }
    }
  }

  return assemblePdf(doc.pages, doc.images)
}
