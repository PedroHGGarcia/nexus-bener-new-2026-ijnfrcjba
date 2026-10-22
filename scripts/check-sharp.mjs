import fs from 'node:fs'
import path from 'node:path'

const files = [
  'src/assets/logo-nexus-48c2f.png',
  'src/assets/imagem-do-codex-22-de-set.de-2026-090327-22ef8.png',
  'src/assets/imagem-do-codex-22-de-set.de-2026-090327-1045f.png',
  'src/assets/imagem-do-codex-22-de-set.de-2026-090327-76b8a.png',
  'src/assets/imagem-do-codex-22-de-set.de-2026-090327-c2f8f.png',
  'src/assets/imagemgerada1789590092173-b518c.png',
  'src/assets/imagemgerada1789590092173-f0db9.png',
  'src/assets/imagemgerada1789591151742-c5adc.png',
  'src/assets/imagemgerada1790021615151-2002c.png',
  'src/assets/imagemgerada1790076730451-b89f2.png',
  'src/assets/imagemgerada1790627784457-9b8ba.png',
  'src/assets/systemlogo-large-092c5.png',
  'src/assets/systemlogoin-large-69fac.png',
]

async function check() {
  let sharp
  try {
    const mod = await import('sharp')
    sharp = mod.default
    console.log('Sharp loaded successfully')
  } catch (err) {
    console.log('Sharp import error:', err)
    return
  }

  for (const f of files) {
    if (fs.existsSync(f)) {
      const meta = await sharp(f).metadata()
      console.log(
        `FILE: ${f} -> ${meta.width}x${meta.height}, format=${meta.format}, channels=${meta.channels}, hasAlpha=${meta.hasAlpha}`,
      )
    }
  }
}

check()
