import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'

// Generate transparent PNG with white letters and preserve olive-green X from logo-nexus-48c2f.png
// The PNG specification:
// Read PNG chunks, decode IDAT, analyze pixels, recolor dark/black text to pure white (or keep alpha),
// turn white background (R>240, G>240, B>240) transparent, keep olive green / green X as olive green with alpha.

const sourcePath = path.resolve(process.cwd(), 'src/assets/logo-nexus-48c2f.png')
const targetPath = path.resolve(process.cwd(), 'src/assets/logo-nexus-white-transparent.png')

const fileBuffer = fs.readFileSync(sourcePath)

// Parse PNG
if (fileBuffer.readUInt32BE(0) !== 0x89504e47) {
  throw new Error('Not a PNG file')
}

let offset = 8
let width = 0
let height = 0
let bitDepth = 0
let colorType = 0
const idatChunks = []

while (offset < fileBuffer.length) {
  const length = fileBuffer.readUInt32BE(offset)
  const type = fileBuffer.toString('ascii', offset + 4, offset + 8)
  const data = fileBuffer.subarray(offset + 8, offset + 8 + length)
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

console.log(`Input image: ${width}x${height}, bitDepth=${bitDepth}, colorType=${colorType}`)

const compressedData = Buffer.concat(idatChunks)
const decompressed = zlib.inflateSync(compressedData)

// Decode scanlines
// colorType 6 is RGBA (4 bytes per pixel), 2 is RGB (3 bytes per pixel)
const bytesPerPixel = colorType === 6 ? 4 : colorType === 2 ? 3 : null
if (!bytesPerPixel || bitDepth !== 8) {
  throw new Error(`Unsupported PNG format: colorType=${colorType}, bitDepth=${bitDepth}`)
}

const stride = width * bytesPerPixel
const rawPixels = Buffer.alloc(width * height * 4) // target RGBA

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
const uncompressedScanlines = Buffer.alloc(height * stride)

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
    if (filterType === 0) {
      // None
      val = rawVal
    } else if (filterType === 1) {
      // Sub
      val = (rawVal + left) & 0xff
    } else if (filterType === 2) {
      // Up
      val = (rawVal + above) & 0xff
    } else if (filterType === 3) {
      // Average
      val = (rawVal + Math.floor((left + above) / 2)) & 0xff
    } else if (filterType === 4) {
      // Paeth
      val = (rawVal + paethPredictor(left, above, aboveLeft)) & 0xff
    } else {
      throw new Error(`Unknown filter type ${filterType} at row ${y}`)
    }
    uncompressedScanlines[lineStart + x] = val
  }
}

// Now process uncompressed pixels to RGBA with transparent background and white lettering
for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    const srcIdx = y * stride + x * bytesPerPixel
    const dstIdx = (y * width + x) * 4

    const r = uncompressedScanlines[srcIdx]
    const g = uncompressedScanlines[srcIdx + 1]
    const b = uncompressedScanlines[srcIdx + 2]
    const a = bytesPerPixel === 4 ? uncompressedScanlines[srcIdx + 3] : 255

    // Distinguish background, olive green X, and dark text
    // Let's sample what colors exist
    // Background is generally pure white or very light: r > 240 && g > 240 && b > 240
    // Olive green X: has prominent green, with r < g or olive tone (e.g. r between 70..180, g between 100..200, b < 100)
    // Dark letters: r < 120 && g < 120 && b < 120 (low saturation, dark)

    // Check if it's green/olive:
    // In olive green, green is significantly higher than blue: g > b + 25 and g > 60
    const isGreenish = g > b + 25 && g > 50 && g > r * 0.75 && (r < 210 || g > 150)

    // Background brightness:
    // If RGB are all high and close to each other:
    const minC = Math.min(r, g, b)
    const maxC = Math.max(r, g, b)
    const isMonochrome = maxC - minC < 20

    if (minC >= 245) {
      // Background -> fully transparent
      rawPixels[dstIdx] = 255
      rawPixels[dstIdx + 1] = 255
      rawPixels[dstIdx + 2] = 255
      rawPixels[dstIdx + 3] = 0
    } else if (isGreenish) {
      // Olive green element (the X of NEXUS)
      // If it borders white background, compute alpha anti-aliasing against white
      // For pixel (r, g, b) blended over white (255, 255, 255)
      rawPixels[dstIdx] = r
      rawPixels[dstIdx + 1] = g
      rawPixels[dstIdx + 2] = b
      rawPixels[dstIdx + 3] = a
    } else {
      // Lettering (N E U S, etc. or anti-aliased dark edges)
      // The original letters are black/dark grey on white background.
      // Darkness = 255 - brightness
      const brightness = Math.round(0.299 * r + 0.587 * g + 0.114 * b)

      if (brightness > 242) {
        // Almost white -> transparent
        rawPixels[dstIdx] = 255
        rawPixels[dstIdx + 1] = 255
        rawPixels[dstIdx + 2] = 255
        rawPixels[dstIdx + 3] = 0
      } else {
        // Recolor dark letters to WHITE (#FFFFFF) with alpha proportional to ink coverage!
        // When brightness was 0 (black), alpha = 255 (solid white)
        // When brightness was 240 (light gray edge against white), alpha is low
        const alpha = Math.min(255, Math.max(0, Math.round((255 - brightness) * (255 / 245))))
        rawPixels[dstIdx] = 255
        rawPixels[dstIdx + 1] = 255
        rawPixels[dstIdx + 2] = 255
        rawPixels[dstIdx + 3] = alpha
      }
    }
  }
}

// Encode to PNG (colorType 6: RGBA)
const outputScanlines = Buffer.alloc(height * (width * 4 + 1))
for (let y = 0; y < height; y++) {
  const lineStart = y * (width * 4 + 1)
  outputScanlines[lineStart] = 0 // Filter type None
  rawPixels.copy(outputScanlines, lineStart + 1, y * width * 4, (y + 1) * width * 4)
}

const deflated = zlib.deflateSync(outputScanlines)

// CRC32 calculation
const crcTable = new Uint32Array(256)
for (let n = 0; n < 256; n++) {
  let c = n
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  }
  crcTable[n] = c >>> 0
}

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  }
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

// IHDR
const ihdr = Buffer.alloc(13)
ihdr.writeUInt32BE(width, 0)
ihdr.writeUInt32BE(height, 4)
ihdr[8] = 8 // bit depth
ihdr[9] = 6 // color type RGBA
ihdr[10] = 0 // compression
ihdr[11] = 0 // filter
ihdr[12] = 0 // interlace

const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const ihdrChunk = makeChunk('IHDR', ihdr)
const idatChunk = makeChunk('IDAT', deflated)
const iendChunk = makeChunk('IEND', Buffer.alloc(0))

const finalPng = Buffer.concat([pngSignature, ihdrChunk, idatChunk, iendChunk])
fs.writeFileSync(targetPath, finalPng)
console.log(
  `Generated transparent logo with white letters at ${targetPath} (${finalPng.length} bytes)`,
)
