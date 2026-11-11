/**
 * Paginação real do documento de proposta (fluxo window.print()).
 *
 * Técnica aprovada (especificada pela OpenAI gpt-6-luna e validada pelo usuário):
 * paginar com JavaScript ANTES de imprimir — medir a altura real do corpo do
 * conteúdo e distribuí-lo em folhas explícitas de altura fixa (capa separada;
 * folhas de conteúdo com o cabeçalho institucional e o rodapé Bener reservados).
 * Assim o total N fica conhecido e cada folha recebe "Página X de N" desenhado
 * pelo próprio layout, sem sobrepor o rodapé Bener. Capa sem número.
 *
 * Contadores CSS via @page (counter(page)/counter(pages)) NÃO funcionam aqui:
 * @page { margin: 0 } é fixo e não deixa onde renderizar (falhou 2x antes).
 *
 * Medição: o hook mede cada filho direto do container referenciado por
 * contentRef (renderizado fora da tela pelo ProposalDocumentSheets) e agrupa
 * os filhos em folhas via greedy fill — cada folha recebe tantos blocos quanto
 * couberem em CONTENT_SHEET_HEIGHT_PX. Uma folha nunca começa no meio de um
 * bloco (o bloco que não couber inteiro abre a folha seguinte).
 */
import { useEffect, useRef, useState } from 'react'

/** mm reservados no topo de cada página impressa (offset 10mm + cabeçalho fixo 35mm) */
const HEADER_MM = 45
/** mm reservados na base de cada página impressa (offset 10mm + rodapé Bener fixo 16mm) */
const FOOTER_MM = 26
/** mm da tarja do contador "Página X de N" no fim de cada folha de conteúdo */
const PAGE_NUMBER_STRIP_MM = 6
/** mm de folga de segurança por folha (impressão raramente é milimétrica) */
const SAFETY_MM = 2
/** Altura útil de conteúdo por folha A4, em px (96dpi: 1mm ≈ 3.7795px) */
const CONTENT_SHEET_HEIGHT_PX = Math.round(
  (297 - HEADER_MM - FOOTER_MM - PAGE_NUMBER_STRIP_MM - SAFETY_MM) * 3.7795,
)
/** Debounce antes de medir (espera imagens/fontes carregarem) */
const MEASURE_DELAY_MS = 350

export interface ProposalPagination {
  /** Quantidade REAL de folhas de conteúdo (sem contar a capa, >= 1 quando há conteúdo) */
  contentPageCount: number
  /** Ref a fixar no bloco de medição (fonte da medição) */
  contentRef: React.RefObject<HTMLDivElement | null>
  /** Filhos diretos agrupados por folha (índices), ou null antes da 1ª medição */
  sheetChunks: number[][] | null
}

export function useProposalPagination(hasContent: boolean, depsKey?: string): ProposalPagination {
  const contentRef = useRef<HTMLDivElement | null>(null)
  const [sheetChunks, setSheetChunks] = useState<number[][] | null>(null)

  useEffect(() => {
    if (!hasContent) {
      setSheetChunks(null)
      return
    }

    const measure = () => {
      const contentEl = contentRef.current
      if (!contentEl) return

      const children = Array.from(contentEl.children) as HTMLElement[]
      if (children.length === 0) {
        setSheetChunks(null)
        return
      }

      // Altura natural de cada filho direto (offsetHeight inclui padding/border;
      // margens verticais somadas à parte porque colapsam entre irmãos).
      const getMargin = (el: HTMLElement, prop: 'marginTop' | 'marginBottom') =>
        parseFloat(getComputedStyle(el)[prop]) || 0

      const chunks: number[][] = []
      let current: number[] = []
      let accumulated = 0

      children.forEach((child, index) => {
        const height =
          child.offsetHeight + getMargin(child, 'marginTop') + getMargin(child, 'marginBottom')
        if (current.length > 0 && accumulated + height > CONTENT_SHEET_HEIGHT_PX) {
          chunks.push(current)
          current = []
          accumulated = 0
        }
        current.push(index)
        accumulated += height
      })
      if (current.length > 0) chunks.push(current)

      setSheetChunks((prev) => (JSON.stringify(prev) === JSON.stringify(chunks) ? prev : chunks))
    }

    measure()
    const timer = setTimeout(measure, MEASURE_DELAY_MS)
    const lateTimer = setTimeout(measure, MEASURE_DELAY_MS * 4)
    window.addEventListener('resize', measure)
    window.addEventListener('load', measure)
    return () => {
      clearTimeout(timer)
      clearTimeout(lateTimer)
      window.removeEventListener('resize', measure)
      window.removeEventListener('load', measure)
    }
  }, [hasContent, depsKey])

  return {
    contentPageCount: sheetChunks ? sheetChunks.length : hasContent ? 1 : 0,
    contentRef,
    sheetChunks,
  }
}
