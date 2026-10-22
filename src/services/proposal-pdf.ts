import { supabase } from '@/lib/supabase/client'
import type { ServiceResult } from '@/lib/utils'
import { sanitizeHtml } from '@/lib/escape-html'
import logoAsset from '@/assets/bener-thumb-accaf.png'

async function fetchAsDataUrl(url: string): Promise<string | null> {
  try {
    const response = await fetch(url)
    if (!response.ok) return null
    const blob = await response.blob()
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

/**
 * Invokes the generate-proposal-pdf edge function, which:
 *  1. Builds the styled HTML document.
 *  2. Generates a real PDF binary (pure-Deno generator).
 *  3. Uploads the PDF to the public `propostas-pdf` storage bucket as `{id}.pdf`.
 *  4. Returns { html, pdf_url, pdf_generated }.
 *
 * This is the step that must run BEFORE the n8n webhook dispatch so that the
 * .pdf is already in storage when n8n fetches link_proposta / pdf_url.
 */
export async function generateProposalPdf(
  propostaId: string,
): Promise<ServiceResult<{ html: string; pdfUrl: string | null }>> {
  const appUrl =
    import.meta.env.VITE_APP_PUBLIC_URL ||
    (typeof window !== 'undefined' ? window.location.origin : 'https://nexus.bener.com.br')

  const logoData = await fetchAsDataUrl(logoAsset)

  const { data, error } = await supabase.functions.invoke('generate-proposal-pdf', {
    body: { proposta_id: propostaId, appUrl, logoData },
  })

  if (error) {
    return { ok: false, error: error.message }
  }

  if (data?.error) {
    return { ok: false, error: data.error }
  }

  return {
    ok: true,
    data: { html: data?.html ?? '', pdfUrl: data?.pdf_url ?? null },
  }
}

export async function printProposalPdf(propostaId: string): Promise<void> {
  const result = await generateProposalPdf(propostaId)
  if (!result.ok || !result.data?.html) {
    const errorMsg = !result.ok
      ? (result as { ok: false; error: string }).error
      : 'Falha ao gerar PDF da proposta'
    throw new Error(errorMsg || 'Falha ao gerar PDF da proposta')
  }
  const printWindow = window.open('', '_blank')
  if (!printWindow) {
    throw new Error(
      'Não foi possível abrir a janela de impressão. Verifique o bloqueador de pop-ups.',
    )
  }
  printWindow.document.write(sanitizeHtml(result.data.html))
  printWindow.document.close()
  setTimeout(() => printWindow.print(), 800)
}
