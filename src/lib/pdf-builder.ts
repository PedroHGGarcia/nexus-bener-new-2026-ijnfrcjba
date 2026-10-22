export const A4_PRINT_STYLES = `
  @page { size: A4; margin: 15mm; }
  * { box-sizing: border-box; }
  body {
    font-family: 'Courier New', Courier, monospace;
    color: #000;
    margin: 0;
    padding: 0;
    font-size: 13px;
    line-height: 1.45;
    background: #fff;
  }
  .proposal-page {
    min-height: 297mm;
    padding: 10px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    box-sizing: border-box;
    page-break-after: always;
    break-after: page;
  }
  .proposal-page:last-child {
    page-break-after: auto;
    break-after: auto;
  }
  .client-header p { margin: 2px 0; }
  .client-name { font-weight: bold; font-size: 14px; }
  .proposal-top-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    border-bottom: 1px solid #000;
    padding-bottom: 16px;
    margin-bottom: 24px;
  }
  .bener-logo-img {
    height: 48px;
    width: auto;
    max-width: 240px;
    object-fit: contain;
  }
  .proposal-number-box {
    border: 1px solid #000;
    padding: 8px 12px;
    text-align: right;
    font-size: 11px;
    color: #000;
    min-width: 190px;
  }
  .proposal-number-box p {
    margin: 1px 0;
    font-size: 11px;
  }
  .proposal-number-box .prop-title {
    font-size: 13px;
    font-weight: 700;
    margin-bottom: 3px;
  }
  .reception-text { margin-top: 24px; text-align: justify; }
  .reception-text p { margin: 8px 0; }
  .machine-title { text-align: center; margin: 36px 0; font-size: 15px; font-weight: bold; }
  .image-container { text-align: center; margin: 24px 0; }
  .machine-img { max-height: 340px; max-width: 100%; object-fit: contain; }
  .image-caption { font-size: 11px; font-style: italic; color: #444; margin-top: 8px; }
  .footer { border-top: 1px solid #000; padding-top: 10px; text-align: center; font-size: 10.5px; line-height: 1.35; margin-top: auto; }
  .footer p { margin: 2px 0; }
  .page-number { text-align: right; font-size: 11px; font-weight: bold; margin-top: 6px; }

  .section-heading { font-size: 12px; font-weight: bold; text-transform: uppercase; border-bottom: 1px solid #000; padding-bottom: 2px; margin: 18px 0 8px 0; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 12px; }
  table, th, td { border: 1px solid #000; }
  th, td { padding: 6px; }
  th { background: #f1f5f9; font-weight: 700; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .shading-exact { background-color: #f1f5f9 !important; font-weight: 700 !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  .signatures-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; margin-top: 32px; text-align: center; }
  .sig-line { border-top: 1px solid #000; padding-top: 4px; margin-top: 36px; font-size: 11px; }

  .term-value p, .tipo-field-value p { margin: 0 0 4px 0; line-height: 1.35; }
  .term-value p:last-child, .tipo-field-value p:last-child { margin-bottom: 0; }
  p.paragraph-item { margin: 0 0 4px 0; line-height: 1.35; }
  p.paragraph-item:last-child { margin-bottom: 0; }
  .paragraph-title {
    display: block;
    font-weight: 700;
    color: #0b3c26;
    margin-bottom: 2px;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .versao-rich-block, .versao-rich-block p, .versao-rich-block li {
    white-space: pre-wrap !important;
    font-family: 'Courier New', Courier, monospace, 'Lucida Console' !important;
  }
  .versao-rich-block span[style*="white-space:pre"] {
    white-space: pre !important;
    font-family: 'Courier New', Courier, monospace, 'Lucida Console' !important;
  }

  @media print {
    body { background: #fff; }
    .proposal-page { min-height: 100vh; padding: 20px; }
  }
`

import { escapeHtml } from '@/lib/escape-html'

export function openPrintWindow(html: string): Window | null {
  const win = window.open('', '_blank', 'width=900,height=700')
  if (!win) return null
  win.document.open()
  win.document.write(
    `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><title>Proposta</title><style>${A4_PRINT_STYLES}</style></head><body>${html}</body></html>`,
  )
  win.document.close()
  win.focus()
  setTimeout(() => {
    win.print()
  }, 500)
  return win
}

export function addPageBreak(): string {
  return '<div style="page-break-after: always; break-after: page;"></div>'
}

export function wrapForPrint(content: string): string {
  return `<div style="max-width: 210mm; margin: 0 auto;">${content}</div>`
}
