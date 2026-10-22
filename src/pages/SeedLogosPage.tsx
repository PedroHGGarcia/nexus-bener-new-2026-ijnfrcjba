import { useEffect, useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
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

export default function SeedLogosPage() {
  const [status, setStatus] = useState<string>('idle')
  const [results, setResults] = useState<any>(null)

  const handleUpload = async () => {
    try {
      setStatus('Carregando imagens e convertendo...')
      const benerB64 = await urlToBase64(benerImg)
      const nexusB64 = await urlToBase64(nexusImg)

      setStatus('Fazendo upload para public/logos/bener-logo.png...')
      const r1 = await supabase.functions.invoke('upload-asset', {
        body: { name: 'bener-logo.png', base64: benerB64, printB64: true },
      })

      setStatus('Fazendo upload para public/logos/nexus-logo.png...')
      const r2 = await supabase.functions.invoke('upload-asset', {
        body: { name: 'nexus-logo.png', base64: nexusB64, printB64: true },
      })

      setStatus('Sucesso!')
      setResults({ bener: r1.data, nexus: r2.data })
    } catch (err) {
      setStatus('Erro: ' + (err instanceof Error ? err.message : String(err)))
    }
  }

  useEffect(() => {
    handleUpload()
  }, [])

  return (
    <div className="p-8 max-w-xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Upload das Logos para Supabase Storage</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm">
            Status: <strong>{status}</strong>
          </p>
          {results && (
            <pre className="p-4 bg-muted text-xs overflow-auto rounded">
              {JSON.stringify(results, null, 2)}
            </pre>
          )}
          <Button onClick={handleUpload}>Reenviar</Button>
        </CardContent>
      </Card>
    </div>
  )
}
