import { ProposalDocument } from './ProposalDocument'
import { useProposalPagination } from '@/hooks/use-proposal-pagination'
import type { PropostaWithRelations } from '@/types/proposta'

interface Props {
  proposal: PropostaWithRelations
}

/**
 * Screen/print shell for the proposal document. The document renderer keeps
 * its established print flow; this shell gives the screen the same A4 canvas,
 * spacing, and page background without touching proposal data or actions.
 */
export function ProposalDocumentSheets({ proposal }: Props) {
  const { contentPageCount, contentRef } = useProposalPagination(true)

  return (
    <div
      className="proposal-sheets-preview"
      data-content-pages={contentPageCount}
      ref={contentRef}
    >
      <ProposalDocument proposal={proposal} />
    </div>
  )
}
