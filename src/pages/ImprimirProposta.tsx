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

  // Ponto 18 & Ponto 6: Validação de bloqueio se pacote sem tipo de proposta definido
  let pacotePdfBlockReason: string | null = null
  if (proposal?.is_pacote) {
    const rawItens = proposal.itens_snapshot as Array<{
      tipo_proposta?: string
      nome?: string
    }> | null
    const itens = Array.isArray(rawItens) ? rawItens : []
    if (itens.length > 0) {
      const firstTipo =
        (typeof itens[0]?.tipo_proposta === 'string' && itens[0].tipo_proposta.trim()) ||
        (typeof proposal.tipo_proposta === 'string' && proposal.tipo_proposta.trim()) ||
        ''
      if (!firstTipo) {
        pacotePdfBlockReason =
          'Geração de documento/PDF bloqueada: a primeira máquina do pacote não possui tipo de proposta definido.'
      } else {
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
          if (!itTipo) {
            pacotePdfBlockReason = `Geração de documento/PDF bloqueada: a máquina "${itens[i]?.nome || `#${i + 1}`}" não possui tipo de proposta definido.`
            break
          }
          if (getGroup(itTipo) !== firstGroup) {
            pacotePdfBlockReason =
              'Geração de documento/PDF bloqueada: as máquinas do pacote possuem métodos de fornecimento incompatíveis.'
            break
          }
          if (itTipo !== firstTipo) {
            pacotePdfBlockReason = `Geração de documento/PDF bloqueada: a máquina "${itens[i]?.nome || `#${i + 1}`}" não possui o tipo de proposta selecionado neste pacote (${firstTipo}).`
            break
          }
        }
      }
    }
  }

  // Names the saved PDF after the proposal (Proposta-<numero>.pdf) and
  // opens the print dialog automatically once the document is rendered.
  useProposalPrintTitle(proposal, {
    autoPrint: !pacotePdfBlockReason,
    ready: !loading && !pacotePdfBlockReason,
  })

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

  if (pacotePdfBlockReason) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6 print:hidden">
        <div className="max-w-md w-full rounded-lg border border-amber-300 bg-amber-50 p-6 text-amber-900 shadow-md">
          <h2 className="text-lg font-bold">Geração de Documento Bloqueada</h2>
          <p className="mt-2 text-sm leading-relaxed">{pacotePdfBlockReason}</p>
          <p className="mt-3 text-xs text-amber-800">
            Defina o tipo de proposta de todas as máquinas dentro do mesmo método de fornecimento
            antes de imprimir ou gerar o PDF.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-100 py-8 print:min-h-0 print:h-auto print:bg-white print:p-0 print:m-0 print:overflow-visible">
      <div className="no-print print:hidden mb-4 flex justify-center print:m-0 print:p-0 print:h-0">
        <Button onClick={() => window.print()} className="gap-2 bg-primary print:hidden">
          <Printer className="w-4 h-4" /> Imprimir / Exportar PDF
        </Button>
      </div>
      <ProposalDocument proposal={proposal} />
    </div>
  )
}
