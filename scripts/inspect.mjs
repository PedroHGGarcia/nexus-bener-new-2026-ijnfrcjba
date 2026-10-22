import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

console.log('Running test script')
const assets = fs.readdirSync('src/assets')
const result = []

for (const a of assets) {
  const stat = fs.statSync(path.join('src/assets', a))
  result.push({ name: a, size: stat.size, mtime: stat.mtime })
}

fs.writeFileSync('temp-assets.json', JSON.stringify(result, null, 2))
console.log('Wrote temp-assets.json')
