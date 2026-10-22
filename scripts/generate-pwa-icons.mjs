import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'

// Generate 192x192, 512x512, apple-touch-icon 180x180, and favicon 32x32 / 64x64 PNGs
// Base: src/assets/logo-nexus2-fd16a.png (official top header wordmark) or fallback logo-nexus-white-transparent.png
// Background: #0b3c26 (RGB: 11, 60, 38)
// The logo is centered with proper padding so both standard and maskable icons look great!

const BRAND_BG = { r: 11, g: 60, b: 38, a: 255 } // #0b3c26

function parsePng(buffer) {
  if (buffer.readUInt32BE(0) !== 0x89504e47) {
    throw new Error('Not a PNG file')
  }

  let offset = 8
  let width = 0
  let height = 0
  let bitDepth = 0
  let colorType = 0
  const idatChunks = []

  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset)
    const type = buffer.toString('ascii', offset + 4, offset + 8)
    const data = buffer.subarray(offset + 8, offset + 8 + length)
    offset += 12 + length

    if (type === 'IHDR') {
      width = data.readUInt32BE(0)
      height = data.readUInt32BE(4)
      bitDepth = data[8]
      colorType = data[9]
    } else if (type === 'IDAT') {
      idatChunks.push(data)
    }
  }

  const decompressed = zlib.inflateSync(Buffer.concat(idatChunks))
  const bytesPerPixel = colorType === 6 ? 4 : colorType === 2 ? 3 : null
  if (!bytesPerPixel || bitDepth !== 8) {
    throw new Error(`Unsupported PNG: colorType=${colorType}, bitDepth=${bitDepth}`)
  }

  const stride = width * bytesPerPixel
  const uncompressedScanlines = Buffer.alloc(height * stride)

  function paethPredictor(a, b, c) {
    const p = a + b - c
    const pa = Math.abs(p - a)
    const pb = Math.abs(p - b)
    const pc = Math.abs(p - c)
    if (pa <= pb && pa <= pc) return a
    if (pb <= pc) return b
    return c
  }

  let srcPos = 0
  for (let y = 0; y < height; y++) {
    const filterType = decompressed[srcPos++]
    const lineStart = y * stride
    const prevLineStart = (y - 1) * stride

    for (let x = 0; x < stride; x++) {
      const rawVal = decompressed[srcPos++]
      const left = x >= bytesPerPixel ? uncompressedScanlines[lineStart + x - bytesPerPixel] : 0
      const above = y > 0 ? uncompressedScanlines[prevLineStart + x] : 0
      const aboveLeft =
        y > 0 && x >= bytesPerPixel ? uncompressedScanlines[prevLineStart + x - bytesPerPixel] : 0

      let val = 0
      if (filterType === 0) val = rawVal
      else if (filterType === 1) val = (rawVal + left) & 0xff
      else if (filterType === 2) val = (rawVal + above) & 0xff
      else if (filterType === 3) val = (rawVal + Math.floor((left + above) / 2)) & 0xff
      else if (filterType === 4) val = (rawVal + paethPredictor(left, above, aboveLeft)) & 0xff
      else throw new Error(`Unknown filter ${filterType}`)

      uncompressedScanlines[lineStart + x] = val
    }
  }

  const rgba = Buffer.alloc(width * height * 4)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const srcIdx = y * stride + x * bytesPerPixel
      const dstIdx = (y * width + x) * 4
      rgba[dstIdx] = uncompressedScanlines[srcIdx]
      rgba[dstIdx + 1] = uncompressedScanlines[srcIdx + 1]
      rgba[dstIdx + 2] = uncompressedScanlines[srcIdx + 2]
      rgba[dstIdx + 3] = bytesPerPixel === 4 ? uncompressedScanlines[srcIdx + 3] : 255
    }
  }

  return { width, height, rgba }
}

const crcTable = new Uint32Array(256)
for (let n = 0; n < 256; n++) {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  crcTable[n] = c >>> 0
}

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function makeChunk(type, data) {
  const len = data.length
  const buf = Buffer.alloc(12 + len)
  buf.writeUInt32BE(len, 0)
  buf.write(type, 4, 4, 'ascii')
  data.copy(buf, 8)
  const toCrc = buf.subarray(4, 8 + len)
  buf.writeUInt32BE(crc32(toCrc), 8 + len)
  return buf
}

function encodeRgbaToPng(width, height, rgba) {
  const outputScanlines = Buffer.alloc(height * (width * 4 + 1))
  for (let y = 0; y < height; y++) {
    const lineStart = y * (width * 4 + 1)
    outputScanlines[lineStart] = 0
    rgba.copy(outputScanlines, lineStart + 1, y * width * 4, (y + 1) * width * 4)
  }

  const deflated = zlib.deflateSync(outputScanlines)
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0

  const pngSig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  return Buffer.concat([
    pngSig,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', deflated),
    makeChunk('IEND', Buffer.alloc(0)),
  ])
}

// Bilinear scale and composite onto background
function renderIcon(srcImg, size, paddingFraction = 0.15) {
  const targetRgba = Buffer.alloc(size * size * 4)

  // Fill background with #0b3c26
  for (let i = 0; i < size * size; i++) {
    targetRgba[i * 4] = BRAND_BG.r
    targetRgba[i * 4 + 1] = BRAND_BG.g
    targetRgba[i * 4 + 2] = BRAND_BG.b
    targetRgba[i * 4 + 3] = BRAND_BG.a
  }

  // Calculate inner bounding box for logo
  const maxInnerW = size * (1 - paddingFraction * 2)
  const maxInnerH = size * (1 - paddingFraction * 2)
  const scale = Math.min(maxInnerW / srcImg.width, maxInnerH / srcImg.height)

  const drawW = Math.round(srcImg.width * scale)
  const drawH = Math.round(srcImg.height * scale)
  const startX = Math.round((size - drawW) / 2)
  const startY = Math.round((size - drawH) / 2)

  // Bilinear sampling from srcImg
  for (let dy = 0; dy < drawH; dy++) {
    const outY = startY + dy
    if (outY < 0 || outY >= size) continue

    const srcY = (dy / drawH) * (srcImg.height - 1)
    const y0 = Math.floor(srcY)
    const y1 = Math.min(y0 + 1, srcImg.height - 1)
    const yWeight = srcY - y0

    for (let dx = 0; dx < drawW; dx++) {
      const outX = startX + dx
      if (outX < 0 || outX >= size) continue

      const srcX = (dx / drawW) * (srcImg.width - 1)
      const x0 = Math.floor(srcX)
      const x1 = Math.min(x0 + 1, srcImg.width - 1)
      const xWeight = srcX - x0

      // 4 neighbors
      const idx00 = (y0 * srcImg.width + x0) * 4
      const idx10 = (y0 * srcImg.width + x1) * 4
      const idx01 = (y1 * srcImg.width + x0) * 4
      const idx11 = (y1 * srcImg.width + x1) * 4

      // Bilinear interpolation
      let r = 0,
        g = 0,
        b = 0,
        a = 0
      for (let c = 0; c < 4; c++) {
        const top = srcImg.rgba[idx00 + c] * (1 - xWeight) + srcImg.rgba[idx10 + c] * xWeight
        const bot = srcImg.rgba[idx01 + c] * (1 - xWeight) + srcImg.rgba[idx11 + c] * xWeight
        const val = top * (1 - yWeight) + bot * yWeight
        if (c === 0) r = val
        else if (c === 1) g = val
        else if (c === 2) b = val
        else a = val / 255 // alpha 0..1
      }

      // Alpha blend over background
      const dstIdx = (outY * size + outX) * 4
      const bgR = targetRgba[dstIdx]
      const bgG = targetRgba[dstIdx + 1]
      const bgB = targetRgba[dstIdx + 2]

      targetRgba[dstIdx] = Math.round(r * a + bgR * (1 - a))
      targetRgba[dstIdx + 1] = Math.round(g * a + bgG * (1 - a))
      targetRgba[dstIdx + 2] = Math.round(b * a + bgB * (1 - a))
      targetRgba[dstIdx + 3] = 255
    }
  }

  return encodeRgbaToPng(size, size, targetRgba)
}

function main() {
  const logoFile = path.resolve(process.cwd(), 'src/assets/logo-nexus2-fd16a.png')
  const fallbackFile = path.resolve(process.cwd(), 'src/assets/logo-nexus-white-transparent.png')
  const srcPath = fs.existsSync(logoFile) ? logoFile : fallbackFile

  console.log(`Generating PWA icons from: ${srcPath}`)
  const srcBuf = fs.readFileSync(srcPath)
  const parsed = parsePng(srcBuf)

  const publicDir = path.resolve(process.cwd(), 'public')
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true })
  }

  // 1. pwa-192x192.png (standard)
  const icon192 = renderIcon(parsed, 192, 0.16)
  fs.writeFileSync(path.join(publicDir, 'pwa-192x192.png'), icon192)

  // 2. pwa-512x512.png (standard)
  const icon512 = renderIcon(parsed, 512, 0.16)
  fs.writeFileSync(path.join(publicDir, 'pwa-512x512.png'), icon512)

  // 3. maskable-icon-512x512.png (maskable needs ~20% safe zone padding)
  const maskable512 = renderIcon(parsed, 512, 0.22)
  fs.writeFileSync(path.join(publicDir, 'maskable-icon-512x512.png'), maskable512)

  // 4. maskable-icon-192x192.png
  const maskable192 = renderIcon(parsed, 192, 0.22)
  fs.writeFileSync(path.join(publicDir, 'maskable-icon-192x192.png'), maskable192)

  // 5. apple-touch-icon.png (180x180)
  const appleTouch = renderIcon(parsed, 180, 0.16)
  fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), appleTouch)
  fs.writeFileSync(path.join(publicDir, 'apple-touch-icon-180x180.png'), appleTouch)

  // 6. favicon-32x32.png
  const favicon32 = renderIcon(parsed, 32, 0.08)
  fs.writeFileSync(path.join(publicDir, 'favicon-32x32.png'), favicon32)

  console.log('Successfully generated all PWA icons in /public!')
}

main()
