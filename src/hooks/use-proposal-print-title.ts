import { useEffect } from 'react'
import { buildProposalFileName } from '@/lib/proposal-file-name'

/**
 * Names the browser print output after the proposal number and (optionally)
 * opens the print dialog automatically once the document is ready.
 *
 * Chrome/Edge use `document.title` as the default file name in the
 * "Save as PDF" destination, so setting it to `Proposta-42134-A` makes the
 * downloaded file come out as `Proposta-42134-A.pdf` — matching the old system.
 */
export function useProposalPrintTitle(
  proposal: { numero_proposta?: string | null; revisao?: string | null } | null | undefined,
  options?: { autoPrint?: boolean; ready?: boolean },
) {
  const autoPrint = options?.autoPrint ?? false
  const ready = options?.ready ?? true

  useEffect(() => {
    if (!proposal) return
    const baseTitle = 'Nexus - Bener Máquinas'
    const fileName = buildProposalFileName(proposal.numero_proposta, proposal.revisao)
    const title = fileName.replace(/\.pdf$/, '')
    document.title = title
    return () => {
      document.title = baseTitle
    }
  }, [proposal?.numero_proposta, proposal?.revisao, proposal])

  useEffect(() => {
    if (!autoPrint || !ready || !proposal) return
    const timer = setTimeout(() => window.print(), 800)
    return () => clearTimeout(timer)
  }, [autoPrint, ready, proposal])
}
