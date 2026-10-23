export const A4_PRINT_STYLES = `
  @page {
    size: A4;
    margin: 15mm;
  }
  *, *::before, *::after {
    box-sizing: border-box;
  }
  html, body {
    margin: 0;
    padding: 0;
    background: #fff;
    color: #000;
    font-family: 'Courier New', Courier, monospace, 'Lucida Console';
    font-size: 12px;
    line-height: 1.45;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .proposal-page {
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 0;
    margin: 0;
    min-height: auto;
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .proposal-page:not(:last-child) {
    page-break-after: page;
    break-after: page;
  }
  .proposal-page:last-child {
    page-break-after: auto;
    break-after: auto;
    margin-bottom: 0 !important;
    padding-bottom: 0 !important;
  }
  .proposal-page:last-child > *:last-child {
    margin-bottom: 0 !important;
  }
  .client-header {
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .client-header p { margin: 2px 0; font-size: 11px; }
  .client-name { font-weight: bold; font-size: 13px; }
  .proposal-top-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    border-bottom: 1px solid #000;
    padding-bottom: 12px;
    margin-bottom: 16px;
    page-break-inside: avoid;
    break-inside: avoid;
    page-break-after: avoid;
    break-after: avoid;
  }
  .bener-logo-img {
    height: 44px;
    width: auto;
    max-width: 220px;
    object-fit: contain;
  }
  .proposal-number-box {
    border: 1px solid #000;
    padding: 6px 10px;
    text-align: right;
    font-size: 10px;
    color: #000;
    min-width: 180px;
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .proposal-number-box p {
    margin: 1px 0;
    font-size: 10px;
  }
  .proposal-number-box .prop-title {
    font-size: 12px;
    font-weight: 700;
    margin-bottom: 2px;
  }
  .reception-text {
    margin-top: 14px;
    text-align: justify;
    font-size: 11px;
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .reception-text p { margin: 6px 0; }
  .machine-title {
    text-align: center;
    margin: 18px 0 12px 0;
    font-size: 14px;
    font-weight: bold;
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .image-container {
    text-align: center;
    margin: 12px 0;
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .machine-img {
    max-height: 280px;
    max-width: 100%;
    object-fit: contain;
  }
  .image-caption {
    font-size: 10px;
    font-style: italic;
    color: #555;
    margin-top: 6px;
  }
  .footer {
    border-top: 1px solid #000;
    padding-top: 8px;
    text-align: center;
    font-size: 10px;
    line-height: 1.35;
    margin-top: auto;
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .footer p { margin: 1px 0; }
  .page-number {
    text-align: right;
    font-size: 10px;
    font-weight: bold;
    margin-top: 4px;
  }

  .section-heading {
    font-size: 11px;
    font-weight: bold;
    text-transform: uppercase;
    border-bottom: 1px solid #000;
    padding-bottom: 2px;
    margin: 14px 0 6px 0;
    page-break-after: avoid;
    break-after: avoid;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 10px;
    margin-bottom: 10px;
    page-break-inside: avoid;
    break-inside: avoid;
  }
  table, th, td { border: 1px solid #000; }
  th, td { padding: 4px 6px; }
  th { background: #f1f5f9; font-weight: 700; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .shading-exact { background-color: #f1f5f9 !important; font-weight: 700 !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  .closing-text {
    margin-top: 14px;
    margin-bottom: 12px;
    font-size: 11px;
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .signatures-grid {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 12px;
    margin-top: 20px;
    text-align: center;
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .sig-line {
    border-top: 1px solid #000;
    padding-top: 4px;
    margin-top: 28px;
    font-size: 10px;
  }

  .term-value p, .tipo-field-value p { margin: 0 0 3px 0; line-height: 1.35; }
  .term-value p:last-child, .tipo-field-value p:last-child { margin-bottom: 0; }
  p.paragraph-item { margin: 0 0 3px 0; line-height: 1.35; }
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
    html, body {
      background: #fff !important;
      margin: 0 !important;
      padding: 0 !important;
    }
    .proposal-page {
      min-height: 0 !important;
      height: auto !important;
      padding: 0 !important;
      margin: 0 !important;
      box-shadow: none !important;
    }
    .proposal-page:last-child {
      page-break-after: auto !important;
      break-after: auto !important;
      margin-bottom: 0 !important;
      padding-bottom: 0 !important;
    }
  }
`

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
