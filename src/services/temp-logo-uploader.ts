import { supabase } from '@/lib/supabase/client'
import benerImg from '@/assets/image-4da64.png'
import nexusImg from '@/assets/imagem-do-codex-22-de-set.de-2026-090327-22ef8.png'

async function urlToBase64(url: string): Promise<string> {
  const res = await fetch(url)
  const blob = await res.blob()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const base64 = (reader.result as string).split(',')[1]
      resolve(base64)
    }
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

export async function uploadEmailLogosToStorage() {
  const benerBase64 = await urlToBase64(benerImg)
  const nexusBase64 = await urlToBase64(nexusImg)

  const res1 = await supabase.functions.invoke('upload-asset', {
    body: {
      bucket: 'public',
      path: 'logos/bener-logo.png',
      base64: benerBase64,
      contentType: 'image/png',
    },
  })

  const res2 = await supabase.functions.invoke('upload-asset', {
    body: {
      bucket: 'public',
      path: 'logos/nexus-logo.png',
      base64: nexusBase64,
      contentType: 'image/png',
    },
  })

  // Also upload to propostas-files bucket just in case
  await supabase.functions.invoke('upload-asset', {
    body: {
      bucket: 'propostas-files',
      path: 'logos/bener-logo.png',
      base64: benerBase64,
      contentType: 'image/png',
    },
  })

  await supabase.functions.invoke('upload-asset', {
    body: {
      bucket: 'propostas-files',
      path: 'logos/nexus-logo.png',
      base64: nexusBase64,
      contentType: 'image/png',
    },
  })

  return { bener: res1.data, nexus: res2.data }
}
