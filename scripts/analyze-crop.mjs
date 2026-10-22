import fs from 'node:fs'
import zlib from 'node:zlib'

const buf = fs.readFileSync('src/assets/image-3562f.png')

let offset = 8
let width = 0
let height = 0
let bitDepth = 0
let colorType = 0
const idatChunks = []

while (offset < buf.length) {
  const length = buf.readUInt32BE(offset)
  const type = buf.toString('ascii', offset + 4, offset + 8)
  const data = buf.subarray(offset + 8, offset + 8 + length)
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

const compressed = Buffer.concat(idatChunks)
const decompressed = zlib.inflateSync(compressed)
const stride = width * 4

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
const scanlines = Buffer.alloc(height * stride)

for (let y = 0; y < height; y++) {
  const filterType = decompressed[srcPos++]
  const lineStart = y * stride
  const prevLineStart = (y - 1) * stride

  for (let x = 0; x < stride; x++) {
    const rawVal = decompressed[srcPos++]
    const left = x >= 4 ? scanlines[lineStart + x - 4] : 0
    const above = y > 0 ? scanlines[prevLineStart + x] : 0
    const aboveLeft = y > 0 && x >= 4 ? scanlines[prevLineStart + x - 4] : 0

    let val = 0
    if (filterType === 0) val = rawVal
    else if (filterType === 1) val = (rawVal + left) & 0xff
    else if (filterType === 2) val = (rawVal + above) & 0xff
    else if (filterType === 3) val = (rawVal + Math.floor((left + above) / 2)) & 0xff
    else if (filterType === 4) val = (rawVal + paethPredictor(left, above, aboveLeft)) & 0xff
    scanlines[lineStart + x] = val
  }
}

// Find bounding box of pure white box: where R>240, G>240, B>240
let minX = width,
  maxX = 0,
  minY = height,
  maxY = 0
for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    const idx = y * stride + x * 4
    const r = scanlines[idx]
    const g = scanlines[idx + 1]
    const b = scanlines[idx + 2]
    // inside the white box or letters inside the white box
    // Let's sample pixel at x=50, y=30
    if (x >= 10 && x <= 110 && y >= 10 && y <= 55) {
      // inside
    }
  }
}

// Sample points along row y=32:
const row32 = []
for (let x = 0; x < width; x += 10) {
  const idx = 32 * stride + x * 4
  row32.push(`x=${x}:[${scanlines[idx]},${scanlines[idx + 1]},${scanlines[idx + 2]}]`)
}

fs.writeFileSync('scripts/out-crop.txt', `Row 32 samples: ${row32.join(', ')}`)
