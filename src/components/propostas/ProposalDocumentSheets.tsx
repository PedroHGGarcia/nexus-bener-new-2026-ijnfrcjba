/**
 * ProposalDocumentSheets — corpo paginado do documento de proposta.
 *
 * Recebe o corpo de conteúdo (já montado pelo ProposalDocument) e o distribui
 * em folhas A4 explícitas de altura fixa, cada uma com o cabeçalho institucional
 * repetido no topo e o rodapé Bener + contador "Página X de N" no canto
 * inferior direito. A capa é desenhada pelo ProposalDocument (fora deste
 * componente) e NUNCA recebe número.
 *
 * Motor de medição: useProposalPagination (src/hooks/use-proposal-pagination.ts)
 * mede cada filho direto do corpo natural e agrupa em folhas via greedy fill.
 * Antes da 1ª medição (e fora da tela de impressão) o corpo é renderizado
 * inteiro e contínuo — a paginação só "ativa" quando sheetChunks existe.
 *
 * Alturas (impressão, @page margin: 0):
 *   folha               = 297mm de altura fixa (exatamente uma página física)
 *   cabeçalho reservado = 45mm (10mm de offset + 35mm do header fixo)
 *   rodapé reservado    = 26mm (10mm de offset + 16mm do footer fixo + 6mm
 *                         da tarja do contador "Página X de N")
 *   conteúdo útil       = 226mm por folha
 */
// touch
import { useMemo } from 'react'
import { useProposalPagination } from '@/hooks/use-proposal-pagination'
import benerLogo from '@/assets/image-f448b.png'

interface SheetsProps {
  /** Bloco de conteúdo completo (o corpo de páginas 2+ do documento) */
  children: React.ReactNode
  /** Chave que invalida a medição quando o conteúdo muda (dados da proposta) */
  depsKey?: string
  /** Esconde o corpo inteiro (ex.: enquanto a proposta carrega) */
  hidden?: boolean
}

/** Rodapé Bener (endereços), repetido em TODAS as folhas de conteúdo. */
function BenerFooter() {
  return (
    <div className="proposal-sheets-footer text-center text-[10px] sm:text-[11px] leading-tight text-black">
      <p className="font-normal">
        Rua Iracema Lucas, 450 (Antiga Rua Parsch) - Distrito Industrial
      </p>
      <p className="font-normal">
        Vinhedo - SP - Brasil - CEP: 13280-172 - Fone / Fax: (0**19) 3826-7373
      </p>
      <p className="font-normal">E-mail: vendas@bener.com.br - Site: www.bener.com.br</p>
    </div>
  )
}

/** Cabeçalho institucional (logo + razão social + "Vinhedo, ..."), sem o quadro Sigla/Nº Oferta. */
function InstitutionalHeader({ dataPorExtensoCap }: { dataPorExtensoCap: string }) {
  return (
    <div className="flex justify-between items-stretch gap-4">
      <div className="flex items-start gap-2">
        <img
          src={benerLogo}
          alt="BENER - MÁQUINAS QUE TRANSFORMAM"
          className="object-contain"
          style={{
            width: '60mm',
            height: 'auto',
            maxWidth: '62mm',
            maxHeight: '27mm',
            objectFit: 'contain',
          }}
          loading="eager"
        />
      </div>
      <div className="flex flex-col items-end text-right text-[10px] sm:text-[11px] leading-tight text-black shrink-0">
        <p className="font-bold text-[12px] sm:text-[13px]">
          Bener Comercial Importadora Exportadora Ltda.
        </p>
        <p className="mt-0.5 sm:mt-1">Vinhedo, {dataPorExtensoCap}</p>
      </div>
    </div>
  )
}

/**
 * Folha A4 de conteúdo: cabeçalho institucional no topo, corpo + rodapé Bener +
 * contador "Página X de N" no canto inferior direito. `page` é o índice REAL da
 * folha (2 = primeira folha de conteúdo, a 1 é a capa, que não recebe número).
 */
function ContentSheet({
  children,
  page,
  total,
  dataPorExtensoCap,
}: {
  children: React.ReactNode
  page: number
  total: number
  dataPorExtensoCap: string
}) {
  return (
    <div
      className="proposal-sheet proposal-sheet-content relative bg-white flex flex-col"
      style={{ width: '210mm', minHeight: '297mm' }}
      data-sheet-page={page}
    >
      {/* Cabeçalho institucional repetido no topo da folha */}
      <div className="shrink-0 border-b border-black pb-1.5 px-12 pt-8">
        <InstitutionalHeader dataPorExtensoCap={dataPorExtensoCap} />
      </div>

      {/* Corpo da folha (blocos distribuídos pelo motor de paginação) */}
      <div className="flex-1 min-h-0 px-12 pt-4 overflow-hidden">{children}</div>

      {/* Rodapé Bener + contador no canto inferior direito (lado a lado, sem sobrepor) */}
      <div className="shrink-0 border-t border-black pt-1 px-12 pb-6 mt-auto">
        <div className="relative w-full">
          <BenerFooter />
          <span className="proposal-sheet-page-counter absolute bottom-0 right-0 text-[9px] font-bold text-black pointer-events-none whitespace-nowrap">
            Página {page} de {total}
          </span>
        </div>
      </div>
    </div>
  )
}

export function ProposalDocumentSheets({ children, depsKey, hidden = false }: SheetsProps) {
  const { contentRef, sheetChunks } = useProposalPagination(true, depsKey)

  // Bloco de medição: renderizado fora da tela com os filhos diretos = blocos
  // de conteúdo. Nunca visível (o usuário vê as folhas, não a "fonte").
  const blocks = useMemo(() => {
    const list = Array.isArray(children) ? children : [children]
    return list.map((block, i) => (
      <div key={i} className="proposal-pagination-block" data-block-index={i}>
        {block}
      </div>
    ))
  }, [children])

  // Folhas finais: greedy fill já feito pelo hook (sheetChunks = índices por folha)
  const sheets = useMemo(() => {
    if (!sheetChunks) return null
    return sheetChunks.map((chunk, sheetIdx) => (
      <ContentSheet
        key={sheetIdx}
        page={sheetIdx + 2}
        total={sheetChunks.length + 1}
        dataPorExtensoCap={''}
      >
        {chunk.map((blockIndex) => blocks[blockIndex])}
      </ContentSheet>
    ))
  }, [sheetChunks, blocks])

  return (
    <div className="proposal-document-sheets" style={hidden ? { display: 'none' } : undefined}>
      {/* Fonte de medição — fora da tela, invisível, sem afetar o layout */}
      <div
        ref={contentRef}
        aria-hidden="true"
        className="proposal-pagination-measure"
        style={{
          position: 'absolute',
          top: 0,
          left: -99999,
          width: 186,
          visibility: 'hidden',
          pointerEvents: 'none',
        }}
      >
        {blocks}
      </div>

      {/* Folhas visíveis: contínuas antes da 1ª medição; paginadas depois */}
      {sheets === null ? (
        <div
          className="proposal-sheet proposal-sheet-content proposal-sheets-continuous relative bg-white flex flex-col"
          style={{ width: '210mm', minHeight: '297mm' }}
        >
          <div className="flex-1 min-h-0 px-12 pt-4">{children}</div>
        </div>
      ) : (
        sheets
      )}
    </div>
  )
}
