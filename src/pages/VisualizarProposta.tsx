import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Printer, Loader2, RefreshCw, MessageSquare } from 'lucide-react'
import { ProposalDocument } from '@/components/propostas/ProposalDocument'
import { EnviarWhatsAppDialog } from '@/components/propostas/EnviarWhatsAppDialog'
import { fetchPublicProposta } from '@/services/propostas'
import { useProposalPrintTitle } from '@/hooks/use-proposal-print-title'
import { PropostaWithRelations } from '@/types/proposta'

export default function VisualizarProposta() {
  const { id, token } = useParams<{ id?: string; token?: string }>()
  const identifier = token || id
  const [proposal, setProposal] = useState<PropostaWithRelations | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [whatsAppDialogOpen, setWhatsAppDialogOpen] = useState(false)

  // Names the saved PDF after the proposal number (Proposta-<numero>.pdf)
  useProposalPrintTitle(proposal)

  const loadData = useCallback(async () => {
    if (!identifier) return
    setLoading(true)
    setError(false)
    try {
      const data = await fetchPublicProposta(identifier)
      if (!data) {
        setError(true)
      } else {
        setProposal(data)
      }
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [identifier])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handlePrint = () => {
    window.print()
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Carregando proposta comercial...
        </span>
      </div>
    )
  }

  if (error || !proposal) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-6 text-center">
        <div className="max-w-md bg-white p-8 rounded-lg border shadow-sm space-y-4">
          <h2 className="text-xl font-bold text-slate-800">Proposta não encontrada</h2>
          <p className="text-sm text-slate-600">
            A proposta solicitada não existe ou o link pode estar incorreto.
          </p>
          <Button onClick={loadData} variant="outline" className="gap-2">
            <RefreshCw className="w-4 h-4" /> Tentar novamente
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-100 py-6 px-2 sm:px-4 print:min-h-0 print:h-auto print:py-0 print:px-0 print:bg-white print:overflow-visible">
      {/* Top action bar - Hidden during print */}
      <div className="no-print max-w-4xl mx-auto mb-4 flex justify-between items-center bg-white p-3 sm:p-4 rounded-lg border shadow-sm">
        <div className="flex flex-col">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Visualização de Proposta
          </span>
          <span className="text-sm font-bold text-slate-800">
            {proposal.numero_proposta
              ? `Proposta Nº ${proposal.numero_proposta}`
              : 'Proposta Comercial'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setWhatsAppDialogOpen(true)}
            className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-sm cursor-pointer"
            title="Enviar proposta por WhatsApp"
          >
            <MessageSquare className="w-4 h-4 fill-white" /> Enviar por WhatsApp
          </Button>
          <Button onClick={handlePrint} variant="outline" className="gap-2">
            <Printer className="w-4 h-4" /> Imprimir
          </Button>
        </div>
      </div>

      {/* Main Proposal Document (same layout as PropostaPdfPage & ImprimirProposta) */}
      <div className="shadow-lg overflow-hidden border max-w-4xl mx-auto bg-white rounded-lg print:shadow-none print:border-none print:rounded-none">
        <ProposalDocument proposal={proposal} />
      </div>

      {/* Bottom action bar - Hidden during print */}
      <div className="no-print max-w-4xl mx-auto mt-4 flex justify-end items-center gap-2 bg-white p-3 sm:p-4 rounded-lg border shadow-sm">
        <Button
          onClick={() => setWhatsAppDialogOpen(true)}
          className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-sm cursor-pointer"
          title="Enviar proposta por WhatsApp"
        >
          <MessageSquare className="w-4 h-4 fill-white" /> Enviar por WhatsApp
        </Button>
        <Button onClick={handlePrint} variant="outline" className="gap-2">
          <Printer className="w-4 h-4" /> Imprimir
        </Button>
      </div>

      <EnviarWhatsAppDialog
        open={whatsAppDialogOpen}
        onOpenChange={setWhatsAppDialogOpen}
        proposta={proposal}
      />
    </div>
  )
}
