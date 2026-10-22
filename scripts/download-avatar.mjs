import fs from 'node:fs'
import path from 'node:path'
import https from 'node:https'
const URL =
  'https://dagtlwojkqyivnjgveda.supabase.co/storage/v1/object/public/message-attachments/a25e05ea-3712-4042-a6b8-933968ac9fbc/imagemgerada1790627784457-0fdae.png'
const targetPath = path.resolve(process.cwd(), 'src/assets/bener-tech-avatar.png')

async function download() {
  if (fs.existsSync(targetPath) && fs.statSync(targetPath).size > 1000) {
    console.log('Avatar already exists:', targetPath)
    return
  }

  console.log('Downloading official Bener Tech avatar from:', URL)
  const res = await fetch(URL)
  if (!res.ok) {
    throw new Error(`Failed to download avatar: ${res.status} ${res.statusText}`)
  }
  const buffer = Buffer.from(await res.arrayBuffer())
  fs.writeFileSync(targetPath, buffer)
  console.log('Successfully wrote', buffer.length, 'bytes to', targetPath)
}

download().catch((err) => {
  console.error('Error downloading avatar:', err)
  process.exit(1)
})
