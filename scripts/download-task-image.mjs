import fs from 'node:fs'
import path from 'node:path'

const URL =
  'https://dagtlwojkqyivnjgveda.supabase.co/storage/v1/object/public/message-attachments/a25e05ea-3712-4042-a6b8-933968ac9fbc/image-3562f.png'
const targetPath = path.resolve(process.cwd(), 'src/assets/image-3562f.png')

async function run() {
  const res = await fetch(URL)
  console.log('Status:', res.status, res.headers.get('content-type'))
  if (!res.ok) {
    console.error('Download failed')
    return
  }
  const buf = Buffer.from(await res.arrayBuffer())
  console.log('Downloaded bytes:', buf.length)
  fs.writeFileSync(targetPath, buf)
  console.log('Saved to:', targetPath)
}

run()
