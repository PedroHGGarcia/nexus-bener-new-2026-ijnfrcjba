import { supabase } from '@/lib/supabase/client'
import type { ServiceResult } from '@/lib/utils'
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
  extraParams?: {
    valor_comissao_servicos?: number | null
    base_comissao_servicos?: number | null
    percentual_comissao_servicos?: number | null
  },
): Promise<ServiceResult<{ html: string; pdfUrl: string | null }>> {
  const appUrl =
    import.meta.env.VITE_APP_PUBLIC_URL ||
    (typeof window !== 'undefined' ? window.location.origin : 'https://nexus.bener.com.br')

  const logoData = await fetchAsDataUrl(logoAsset)

  const { data, error } = await supabase.functions.invoke('generate-proposal-pdf', {
    body: {
      proposta_id: propostaId,
      appUrl,
      logoData,
      valor_comissao_servicos: extraParams?.valor_comissao_servicos,
      base_comissao_servicos: extraParams?.base_comissao_servicos,
      percentual_comissao_servicos: extraParams?.percentual_comissao_servicos,
    },
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
  // Rather than document.write on an empty window (which has an empty origin or about:blank route),
  // navigate directly to the dedicated printable route which mounts only the ProposalDocument.
  // Ponto 18 & Ponto 6: Validação prévia de pacote antes de abrir impressão
  const { data: prop } = await supabase
    .from('propostas')
    .select('is_pacote, tipo_proposta, itens_snapshot')
    .eq('id', propostaId)
    .maybeSingle()

  if (prop?.is_pacote) {
    const rawItens = prop.itens_snapshot as Array<{ tipo_proposta?: string; nome?: string }> | null
    const itens = Array.isArray(rawItens) ? rawItens : []
    if (itens.length > 0) {
      const firstTipo =
        (typeof itens[0]?.tipo_proposta === 'string' && itens[0].tipo_proposta.trim()) ||
        (typeof prop.tipo_proposta === 'string' && prop.tipo_proposta.trim()) ||
        ''
      if (!firstTipo) {
        throw new Error(
          'Geração de PDF bloqueada: selecione o tipo de proposta da primeira máquina do pacote antes de imprimir.',
        )
      }
      const getGroup = (t: string) => {
        const lower = t.toLowerCase()
        if (lower.includes('importacao direta') || lower.includes('importação direta'))
          return 'Importação Direta'
        if (lower.includes('nacionalizada')) return 'Nacionalizada'
        return 'Outro'
      }
      const firstGroup = getGroup(firstTipo)
      for (let i = 0; i < itens.length; i++) {
        const itTipo =
          typeof itens[i]?.tipo_proposta === 'string'
            ? itens[i].tipo_proposta!.trim()
            : i === 0
              ? firstTipo
              : ''
        if (!itTipo || getGroup(itTipo) !== firstGroup) {
          throw new Error(
            'Geração de PDF bloqueada: todas as máquinas do pacote devem ter tipo de proposta dentro do mesmo método de fornecimento.',
          )
        }
      }
    }
  }

  const printUrl = `/proposta/${propostaId}/imprimir`
  const printWindow = window.open(printUrl, '_blank')
  if (!printWindow) {
    throw new Error(
      'Não foi possível abrir a janela de impressão. Verifique o bloqueador de pop-ups.',
    )
  }
}
