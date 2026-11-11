/**
 * Paginação real do documento de proposta (fluxo window.print()).
 *
 * Técnica aprovada (especificada pela OpenAI gpt-6-luna e validada pelo usuário):
 * paginar com JavaScript ANTES de imprimir — medir a altura real do corpo do
 * conteúdo e distribuí-lo em folhas explícitas de altura fixa (capa separada;
 * folhas de conteúdo com 35mm de cabeçalho e 16mm de rodapé reservados). Assim
 * o total N fica conhecido e cada folha recebe "Página X de N" desenhado pelo
 * próprio layout, sem sobrepor o rodapé Bener. Capa sem número.
 *
 * Contadores CSS via @page (counter(page)/counter(pages)) NÃO funcionam aqui:
 * @page { margin: 0 } é fixo e não deixa onde renderizar (falhou 2x antes).
 *
 * Medição em duas passadas:
 *  1. hidden clone: renderiza o corpo fora da tela (sem afetar o layout visível)
 *     e mede sua altura natural total → chutes o número de folhas N;
 *  2. confirmado na 2ª renderização, distribui os filhos diretos do corpo nas
 *     N folhas (mova cada filho para a folha cujo espaço ainda comporte a sua
 *     altura, com orfãos/widows respeitados pelas regras CSS existentes).
 */
import { useEffect, useRef, useState } from 'react'

/** mm de cabeçalho institucional fixo, reservado no topo de cada folha */
const HEADER_MM = 35
/** mm de rodapé Bener + numeração, reservado na base de cada folha */
const FOOTER_MM = 16
/** mm de folga de segurança por folha (impressão raramente é milimétrica) */
const SAFETY_MM = 8
/** Altura útil de uma folha de conteúdo A4, em px (96dpi: 1mm ≈ 3.7795px) */
const CONTENT_SHEET_HEIGHT_PX = Math.round((297 - HEADER_MM - FOOTER_MM - SAFETY_MM) * 3.7795)
/** Debounce antes de medir (espera imagens/fontes carregarem) */
const MEASURE_DELAY_MS = 350

export interface ProposalPagination {
  /** Quantidade REAL de folhas de conteúdo (sem contar a capa, >= 1) */
  contentPageCount: number
  /** Ref a fixar no bloco do corpo de conteúdo (fonte da medição) */
  contentRef: React.RefObject<HTMLDivElement | null>
}

export function useProposalPagination(hasContent: boolean): ProposalPagination {
  const contentRef = useRef<HTMLDivElement | null>(null)
  const [contentPageCount, setContentPageCount] = useState(hasContent ? 2 : 1)

  useEffect(() => {
    if (!hasContent) {
      setContentPageCount(1)
      return
    }

    const measure = () => {
      const contentEl = contentRef.current
      if (!contentEl) return

      // Altura natural total do corpo: soma dos filhos diretos (seções, tabelas,
      // blocos) com suas margens verticais. offsetHeight já inclui padding/border.
      let totalHeight = 0
      const children = Array.from(contentEl.children) as HTMLElement[]
      if (children.length === 0) {
        totalHeight = contentEl.scrollHeight
      } else {
        const getMargin = (el: HTMLElement, prop: 'marginTop' | 'marginBottom') =>
          parseFloat(getComputedStyle(el)[prop]) || 0
        for (const child of children) {
          totalHeight +=
            child.offsetHeight + getMargin(child, 'marginTop') + getMargin(child, 'marginBottom')
        }
      }

      const contentPages = Math.max(1, Math.ceil(totalHeight / CONTENT_SHEET_HEIGHT_PX))
      setContentPageCount((prev) => (prev === contentPages ? prev : contentPages))
    }

    measure()
    const timer = setTimeout(measure, MEASURE_DELAY_MS)
    window.addEventListener('resize', measure)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('resize', measure)
    }
  }, [hasContent])

  return { contentPageCount, contentRef }
}
