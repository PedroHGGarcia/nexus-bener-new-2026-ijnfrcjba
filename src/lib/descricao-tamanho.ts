export type DescricaoTamanho = 'pequeno' | 'padrao' | 'medio' | 'grande'

export const DESCRICAO_TAMANHO_OPTIONS: Array<{
  value: DescricaoTamanho
  label: string
  hint: string
}> = [
  { value: 'pequeno', label: 'Pequeno', hint: '11.5px / 8.5pt' },
  { value: 'padrao', label: 'Padrão', hint: '12.7px / 9.5pt' },
  { value: 'medio', label: 'Médio', hint: '14px / 10.5pt' },
  { value: 'grande', label: 'Grande', hint: '15.3px / 11.5pt' },
]

export const DESCRICAO_FONT_SIZES = {
  screen: {
    pequeno: '11.5px',
    padrao: '12.7px',
    medio: '14px',
    grande: '15.3px',
  },
  pdfPt: {
    pequeno: '8.5pt',
    padrao: '9.5pt',
    medio: '10.5pt',
    grande: '11.5pt',
  },
  publicHtmlPx: {
    pequeno: '11.5px',
    padrao: '12.7px',
    medio: '14px',
    grande: '15.3px',
  },
} as const

/**
 * Normaliza e valida o tamanho da descrição. Fallback para 'padrao'.
 */
export function normalizeDescricaoTamanho(value: unknown): DescricaoTamanho {
  if (value === 'pequeno' || value === 'padrao' || value === 'medio' || value === 'grande') {
    return value
  }
  return 'padrao'
}

/**
 * Resolve tamanho em pixels para renderização em tela (ex: ProposalDocument, EquipmentDetailsSection).
 */
export function resolveDescricaoFontSizeScreen(value: unknown): string {
  const normalized = normalizeDescricaoTamanho(value)
  return DESCRICAO_FONT_SIZES.screen[normalized]
}

/**
 * Resolve tamanho em pt para renderização do PDF no navegador (proposal-pdf.ts).
 */
export function resolveDescricaoFontSizePdf(value: unknown): string {
  const normalized = normalizeDescricaoTamanho(value)
  return DESCRICAO_FONT_SIZES.pdfPt[normalized]
}

/**
 * Resolve tamanho em px para renderização do HTML público no servidor / edge (public-proposal-html.ts).
 */
export function resolveDescricaoFontSizePublicHtml(value: unknown): string {
  const normalized = normalizeDescricaoTamanho(value)
  return DESCRICAO_FONT_SIZES.publicHtmlPx[normalized]
}
