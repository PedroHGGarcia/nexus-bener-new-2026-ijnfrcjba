/**
 * Converte dados técnicos legados (bullets, texto puro ou JSON de tabela)
 * em HTML formatado pronto para o RichTextEditor e para renderização visual/PDF.
 */
import { isTechnicalTableJson, parseTechnicalData } from '@/lib/technical-table'
import { escapeHtml, sanitizeHtml } from '@/lib/escape-html'
import { renderVersaoRichHtml } from '@/lib/versao-rich-text'

export function isHtmlContent(raw: string | null | undefined): boolean {
  if (!raw || typeof raw !== 'string') return false
  const trimmed = raw.trim()
  if (!trimmed) return false
  // Detecta se contém tags HTML como <p>, <div>, <table>, <ul>, <ol>, <span>, <strong>, <b>, <em>, <i>, <img, <br
  return /<\/?(?:p|div|table|thead|tbody|tr|td|th|ul|ol|li|span|strong|b|em|i|u|s|strike|img|br|h[1-6]|font|a)\b/i.test(
    trimmed,
  )
}

/**
 * Converte dados técnicos em formato TechnicalTableData (JSON) para uma tabela HTML limpa e estilizável.
 */
export function technicalTableDataToHtml(raw: string): string {
  const table = parseTechnicalData(raw)
  if (!table || table.rows.length === 0) return ''

  const hasAnyImage = table.rows.some((r) => Boolean(r.imagem && r.imagem.trim()))

  const ths = [
    hasAnyImage
      ? `<th style="border:1px solid #cbd5e1;padding:6px 8px;font-size:10px;text-transform:uppercase;font-weight:700;background:#f1f5f9;color:#334155;text-align:center;width:60px;">Foto</th>`
      : '',
    ...table.columns.map(
      (c, idx) =>
        `<th style="border:1px solid #cbd5e1;padding:6px 10px;font-size:10px;text-transform:uppercase;font-weight:700;background:#f1f5f9;color:#334155;${
          idx === 0 ? 'text-align:center;width:60px;' : 'text-align:left;'
        }">${escapeHtml(c.label)}</th>`,
    ),
  ].join('')

  const trs = table.rows
    .map((r) => {
      const imgCell = hasAnyImage
        ? `<td style="border:1px solid #cbd5e1;padding:4px 6px;text-align:center;vertical-align:middle;width:60px;">${
            r.imagem
              ? `<img src="${escapeHtml(r.imagem)}" alt="Item" style="max-height:48px;max-width:56px;object-fit:contain;display:inline-block;border-radius:3px;vertical-align:middle;" />`
              : `<span style="color:#cbd5e1;font-size:10px;">—</span>`
          }</td>`
        : ''

      const dataCells = table.columns
        .map(
          (c, cIdx) =>
            `<td style="border:1px solid #cbd5e1;padding:5px 10px;font-size:11px;color:#0f172a;vertical-align:middle;${
              cIdx === 0 ? 'text-align:center;font-weight:600;' : ''
            }">${escapeHtml(r.values[c.id] || '—')}</td>`,
        )
        .join('')

      return `<tr>${imgCell}${dataCells}</tr>`
    })
    .join('')

  return `<table style="width:100%;border-collapse:collapse;border:1px solid #cbd5e1;margin:8px 0;"><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table>`
}

/**
 * Converte qualquer valor técnico existente (HTML, JSON de tabela ou texto/bullets legado)
 * para HTML seguro pronto para ser carregado no editor rich text.
 */
export function convertTechnicalToHtml(raw: string | null | undefined): string {
  if (!raw || typeof raw !== 'string') return ''
  const trimmed = raw.trim()
  if (!trimmed) return ''

  // 1. Já é HTML sanitizado? Preserva e sanitiza
  if (isHtmlContent(trimmed)) {
    return sanitizeHtml(trimmed)
  }

  // 2. É JSON de tabela técnica? Converte em tabela HTML
  if (isTechnicalTableJson(trimmed)) {
    return technicalTableDataToHtml(trimmed)
  }

  // 3. Fallback inteligente: utiliza renderVersaoRichHtml para converter <B>, quebras e bullets "•" em HTML puro
  return renderVersaoRichHtml(trimmed)
}
