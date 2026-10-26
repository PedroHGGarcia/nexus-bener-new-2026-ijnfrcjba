import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Printer, Loader2 } from 'lucide-react'
import { ProposalDocument } from '@/components/propostas/ProposalDocument'
import { fetchPropostaById } from '@/services/propostas'
import { PropostaWithRelations } from '@/types/proposta'
import { useProposalPrintTitle } from '@/hooks/use-proposal-print-title'

export default function ImprimirProposta() {
  const { id } = useParams()
  const [proposal, setProposal] = useState<PropostaWithRelations | null>(null)
  const [loading, setLoading] = useState(true)

  // Names the saved PDF after the proposal (Proposta-<numero>.pdf) and
  // opens the print dialog automatically once the document is rendered.
  useProposalPrintTitle(proposal, { autoPrint: true, ready: !loading })

  useEffect(() => {
    fetchPropostaById(id!).then((data) => {
      setProposal(data)
      setLoading(false)
    })
  }, [id])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white print:hidden">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!proposal) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white text-destructive print:hidden">
        Proposta não encontrada
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-100 py-8 print:min-h-0 print:h-auto print:bg-white print:p-0 print:m-0 print:overflow-visible">
      <div className="no-print print:hidden mb-4 flex justify-center">
        <Button onClick={() => window.print()} className="gap-2 bg-primary print:hidden">
          <Printer className="w-4 h-4" /> Imprimir / Exportar PDF
        </Button>
      </div>
      <ProposalDocument proposal={proposal} />
    </div>
  )
}
