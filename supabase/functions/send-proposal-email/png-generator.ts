/**
 * Helper to generate small, clean, high-contrast, pure-binary 320x80 PNG logos
 * without any external binary dependencies. Uses standard PNG format with
 * indexed 8-bit palette and uncompressed deflate blocks (PNGlib / RFC 1951 / RFC 1950).
 */

class MiniPng {
  private width: number
  private height: number
  private palette: number[] = []
  private pixels: number[]
  private crcTable: number[]

  constructor(
    width: number,
    height: number,
    bgRgba: [number, number, number, number] = [255, 255, 255, 255],
  ) {
    this.width = width
    this.height = height
    this.pixels = new Array(width * height).fill(0)

    this.crcTable = new Array(256)
    for (let n = 0; n < 256; n++) {
      let c = n
      for (let k = 0; k < 8; k++) {
        if (c & 1) {
          c = 0xedb88320 ^ (c >>> 1)
        } else {
          c = c >>> 1
        }
      }
      this.crcTable[n] = c
    }

    this.getColorIndex(...bgRgba)
  }

  public getColorIndex(r: number, g: number, b: number, a: number = 255): number {
    const key = ((a & 0xff) << 24) | ((r & 0xff) << 16) | ((g & 0xff) << 8) | (b & 0xff)
    for (let i = 0; i < this.palette.length; i++) {
      if (this.palette[i] === key) return i
    }
    const idx = this.palette.length
    if (idx >= 256) return 0
    this.palette.push(key)
    return idx
  }

  public setPixel(x: number, y: number, colorIdx: number) {
    if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
      this.pixels[y * this.width + x] = colorIdx
    }
  }

  public fillRect(x0: number, y0: number, w: number, h: number, colorIdx: number) {
    const x1 = Math.min(this.width, x0 + w)
    const y1 = Math.min(this.height, y0 + h)
    for (let y = Math.max(0, y0); y < y1; y++) {
      for (let x = Math.max(0, x0); x < x1; x++) {
        this.pixels[y * this.width + x] = colorIdx
      }
    }
  }

  public drawThickLine(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    thickness: number,
    colorIdx: number,
  ) {
    const dx = Math.abs(x1 - x0)
    const dy = Math.abs(y1 - y0)
    const sx = x0 < x1 ? 1 : -1
    const sy = y0 < y1 ? 1 : -1
    let err = dx - dy

    let cx = x0
    let cy = y0
    const half = Math.floor(thickness / 2)

    while (true) {
      this.fillRect(cx - half, cy - half, thickness, thickness, colorIdx)
      if (cx === x1 && cy === y1) break
      const e2 = 2 * err
      if (e2 > -dy) {
        err -= dy
        cx += sx
      }
      if (e2 < dx) {
        err += dx
        cy += sy
      }
    }
  }

  public drawChar(
    char: string,
    startX: number,
    startY: number,
    scale: number,
    colorIdx: number,
  ): number {
    const font = BITMAP_FONT[char.toUpperCase()] || BITMAP_FONT[' '] || [0, 0, 0, 0, 0]
    for (let col = 0; col < 5; col++) {
      const bitmask = font[col] || 0
      for (let row = 0; row < 7; row++) {
        if ((bitmask >> row) & 1) {
          this.fillRect(startX + col * scale, startY + row * scale, scale, scale, colorIdx)
        }
      }
    }
    return 5 * scale
  }

  public drawString(
    text: string,
    startX: number,
    startY: number,
    scale: number,
    colorIdx: number,
    spacing: number = 2,
  ) {
    let curX = startX
    for (let i = 0; i < text.length; i++) {
      const ch = text[i]
      if (ch === ' ') {
        curX += 4 * scale + spacing
        continue
      }
      this.drawChar(ch, curX, startY, scale, colorIdx)
      curX += 5 * scale + spacing
    }
  }

  private crc32(buf: Uint8Array, offset: number, length: number): number {
    let c = 0xffffffff
    for (let i = offset; i < offset + length; i++) {
      c = this.crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
    }
    return (c ^ 0xffffffff) >>> 0
  }

  private writeUint32(arr: number[], val: number) {
    arr.push((val >>> 24) & 0xff, (val >>> 16) & 0xff, (val >>> 8) & 0xff, val & 0xff)
  }

  private writeChunk(out: number[], typeStr: string, data: number[]) {
    this.writeUint32(out, data.length)
    const startOffset = out.length
    for (let i = 0; i < 4; i++) {
      out.push(typeStr.charCodeAt(i))
    }
    for (let i = 0; i < data.length; i++) {
      out.push(data[i])
    }
    const chunkBytes = new Uint8Array(out.slice(startOffset))
    const crc = this.crc32(chunkBytes, 0, chunkBytes.length)
    this.writeUint32(out, crc)
  }

  public toPngBytes(): Uint8Array {
    const out: number[] = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

    // 1. IHDR
    const ihdr: number[] = []
    this.writeUint32(ihdr, this.width)
    this.writeUint32(ihdr, this.height)
    ihdr.push(8)
    ihdr.push(3)
    ihdr.push(0)
    ihdr.push(0)
    ihdr.push(0)
    this.writeChunk(out, 'IHDR', ihdr)

    // 2. PLTE
    const plte: number[] = []
    const trns: number[] = []
    for (let i = 0; i < this.palette.length; i++) {
      const col = this.palette[i]
      const a = (col >>> 24) & 0xff
      const r = (col >>> 16) & 0xff
      const g = (col >>> 8) & 0xff
      const b = col & 0xff
      plte.push(r, g, b)
      trns.push(a)
    }
    this.writeChunk(out, 'PLTE', plte)

    // 3. tRNS
    if (trns.some((a) => a < 255)) {
      this.writeChunk(out, 'tRNS', trns)
    }

    // 4. IDAT
    const rawData: number[] = []
    for (let y = 0; y < this.height; y++) {
      rawData.push(0)
      const rowOffset = y * this.width
      for (let x = 0; x < this.width; x++) {
        rawData.push(this.pixels[rowOffset + x])
      }
    }

    let s1 = 1
    let s2 = 0
    const BASE = 65521
    for (let i = 0; i < rawData.length; i++) {
      s1 = (s1 + rawData[i]) % BASE
      s2 = (s2 + s1) % BASE
    }
    const adler32 = ((s2 << 16) | s1) >>> 0

    const zlibStream: number[] = [0x78, 0x01]

    let offset = 0
    while (offset < rawData.length) {
      const remaining = rawData.length - offset
      const blockSize = Math.min(remaining, 65535)
      const isFinal = offset + blockSize >= rawData.length ? 1 : 0

      zlibStream.push(isFinal)
      zlibStream.push(blockSize & 0xff, (blockSize >>> 8) & 0xff)
      const nlen = ~blockSize & 0xffff
      zlibStream.push(nlen & 0xff, (nlen >>> 8) & 0xff)

      for (let i = 0; i < blockSize; i++) {
        zlibStream.push(rawData[offset + i])
      }
      offset += blockSize
    }

    this.writeUint32(zlibStream, adler32)
    this.writeChunk(out, 'IDAT', zlibStream)

    // 5. IEND
    this.writeChunk(out, 'IEND', [])

    return new Uint8Array(out)
  }
}

const BITMAP_FONT: Record<string, number[]> = {
  ' ': [0, 0, 0, 0, 0],
  A: [0x7e, 0x11, 0x11, 0x11, 0x7e],
  B: [0x7f, 0x49, 0x49, 0x49, 0x36],
  C: [0x3e, 0x41, 0x41, 0x41, 0x22],
  D: [0x7f, 0x41, 0x41, 0x22, 0x1c],
  E: [0x7f, 0x49, 0x49, 0x49, 0x41],
  F: [0x7f, 0x09, 0x09, 0x09, 0x01],
  G: [0x3e, 0x41, 0x49, 0x49, 0x7a],
  H: [0x7f, 0x08, 0x08, 0x08, 0x7f],
  I: [0x00, 0x41, 0x7f, 0x41, 0x00],
  J: [0x20, 0x40, 0x41, 0x3f, 0x01],
  K: [0x7f, 0x08, 0x14, 0x22, 0x41],
  L: [0x7f, 0x40, 0x40, 0x40, 0x40],
  M: [0x7f, 0x02, 0x0c, 0x02, 0x7f],
  N: [0x7f, 0x04, 0x08, 0x10, 0x7f],
  O: [0x3e, 0x41, 0x41, 0x41, 0x3e],
  P: [0x7f, 0x09, 0x09, 0x09, 0x06],
  Q: [0x3e, 0x41, 0x51, 0x21, 0x5e],
  R: [0x7f, 0x09, 0x19, 0x29, 0x46],
  S: [0x46, 0x49, 0x49, 0x49, 0x31],
  T: [0x01, 0x01, 0x7f, 0x01, 0x01],
  U: [0x3f, 0x40, 0x40, 0x40, 0x3f],
  V: [0x1f, 0x20, 0x40, 0x20, 0x1f],
  W: [0x7f, 0x20, 0x18, 0x20, 0x7f],
  X: [0x63, 0x14, 0x08, 0x14, 0x63],
  Y: [0x07, 0x08, 0x70, 0x08, 0x07],
  Z: [0x61, 0x51, 0x49, 0x45, 0x43],
  '.': [0x00, 0x60, 0x60, 0x00, 0x00],
  '-': [0x08, 0x08, 0x08, 0x08, 0x08],
  ':': [0x00, 0x66, 0x66, 0x00, 0x00],
}

export function generateNexusLogoPng(): Uint8Array {
  const width = 320
  const height = 80
  const img = new MiniPng(width, height, [255, 255, 255, 255])

  const darkNavy = img.getColorIndex(15, 23, 42)
  const emerald = img.getColorIndex(16, 185, 129)
  const darkEmerald = img.getColorIndex(4, 120, 87)
  const slateText = img.getColorIndex(100, 116, 139)

  const hexPoints: [number, number][] = [
    [38, 12],
    [64, 26],
    [64, 54],
    [38, 68],
    [12, 54],
    [12, 26],
  ]

  for (let i = 0; i < hexPoints.length; i++) {
    const p1 = hexPoints[i]
    const p2 = hexPoints[(i + 1) % hexPoints.length]
    img.drawThickLine(p1[0], p1[1], p2[0], p2[1], 4, emerald)
  }

  for (const pt of hexPoints) {
    img.fillRect(pt[0] - 4, pt[1] - 4, 9, 9, darkEmerald)
  }

  img.drawThickLine(26, 28, 50, 52, 4, darkEmerald)
  img.drawThickLine(50, 28, 26, 52, 4, darkEmerald)
  img.fillRect(35, 37, 7, 7, emerald)

  img.drawString('NEXUS', 86, 15, 5, darkNavy, 5)
  img.drawString('GESTAO COMERCIAL', 88, 58, 2, slateText, 3)

  return img.toPngBytes()
}

export function generateBenerLogoPng(): Uint8Array {
  const width = 320
  const height = 80
  const img = new MiniPng(width, height, [255, 255, 255, 255])

  const benerGreen = img.getColorIndex(11, 60, 38)
  const emeraldAccent = img.getColorIndex(16, 185, 129)

  img.fillRect(8, 14, 6, 54, emeraldAccent)
  img.drawString('BENER', 24, 14, 6, benerGreen, 6)
  img.drawString('MAQUINAS QUE TRANSFORMAM', 24, 60, 2, benerGreen, 2)

  return img.toPngBytes()
}
