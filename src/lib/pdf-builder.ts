export const A4_PRINT_STYLES = `
  @page {
    size: A4 portrait;
    margin: 10mm 12mm;
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
    padding: 4mm 0;
    margin: 0;
    min-height: 0;
    height: auto;
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .proposal-page:last-child {
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
    width: 60mm;
    height: auto;
    max-width: 62mm;
    max-height: 27mm;
    object-fit: contain;
  }
  .header-company-info {
    text-align: right;
    font-size: 11px;
    line-height: 1.35;
    flex-shrink: 0;
  }
  .header-company-info .company-name {
    font-weight: bold;
    font-size: 12px;
  }
  .header-offer-table-wrapper {
    display: flex;
    justify-content: flex-end;
    margin-top: 3px;
    width: 100%;
    min-width: 340px;
    max-width: 420px;
  }
  .header-offer-table {
    width: 100% !important;
    min-width: 340px !important;
    max-width: 420px !important;
    border-collapse: collapse;
    border: 1px solid #000;
    margin: 0 !important;
    font-size: 9.5px;
    line-height: 1.2;
    background: #fff;
  }
  .header-offer-table th, .header-offer-table td {
    border: 1px solid #000 !important;
    padding: 2px 6px !important;
    text-align: center !important;
  }
  .header-offer-table th {
    background: #fff !important;
    font-weight: bold !important;
  }
  .header-offer-table td.offer-num {
    font-weight: bold;
    white-space: nowrap;
    padding: 3px 8px !important;
  }
  .reception-text {
    margin-top: 10px !important;
    text-align: justify;
    font-size: 11px;
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .reception-text p { margin: 4px 0 !important; }
  .machine-presentation-block {
    page-break-inside: avoid !important;
    break-inside: avoid !important;
  }
  .machine-title {
    text-align: center;
    margin: 8px 0 8px !important;
    font-size: 14px !important;
    line-height: 1.2 !important;
    font-weight: bold;
    page-break-inside: avoid;
    break-inside: avoid;
    page-break-after: avoid !important;
    break-after: avoid !important;
  }
  .image-container {
    text-align: center;
    margin: 6px 0 !important;
    page-break-before: avoid !important;
    page-break-inside: avoid !important;
    break-before: avoid !important;
    break-inside: avoid !important;
  }
  .machine-img {
    display: block !important;
    margin: 0 auto !important;
    width: auto !important;
    max-height: 230px !important;
    max-width: 100% !important;
    object-fit: contain !important;
  }
  .proposal-cover .image-container {
    width: 100% !important;
    flex: 1 1 auto !important;
    height: auto !important;
    min-height: auto !important;
    max-height: 140mm !important;
    display: flex !important;
    flex-direction: column !important;
    align-items: center !important;
    justify-content: center !important;
    text-align: center !important;
    margin: 4mm 0 2mm !important;
    page-break-before: avoid !important;
    page-break-inside: avoid !important;
    break-before: avoid !important;
    break-inside: avoid !important;
    overflow: hidden !important;
  }
  .proposal-cover .machine-img {
    display: block !important;
    width: auto !important;
    max-width: 155mm !important;
    height: auto !important;
    max-height: 125mm !important;
    object-fit: contain !important;
    margin: 0 auto !important;
  }
  .image-caption,
  .proposal-cover .image-caption {
    font-size: 9px !important;
    font-style: italic;
    color: #555;
    margin-top: 2mm !important;
  }
  .footer {
    border-top: 1px solid #000;
    padding-top: 6px;
    text-align: center;
    font-size: 12px;
    line-height: 1.35;
    margin-top: auto;
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .footer p { margin: 1px 0; }
  .page-number {
    display: none !important;
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
  /* Descrições das máquinas: mesmo padrão do bloco "Termos de Fornecimento"
     (corpo 9,5pt / #0f172a / peso 500 / line-height 1,45, largura total, sem recuo) */
  .term-desc-content .versao-rich-block {
    padding-left: 0 !important;
    margin-top: 0 !important;
  }
  .term-desc-content .versao-rich-block p,
  .term-desc-content .versao-rich-block ul {
    font-size: 9.5pt !important;
    color: #0f172a !important;
    font-weight: 500 !important;
    line-height: 1.45 !important;
  }
  .term-desc-content .versao-rich-block li {
    color: inherit !important;
  }

  @media print {
    html, body {
      background: #fff !important;
      margin: 0 !important;
      padding: 0 !important;
    }
    .proposal-document,
    .proposal-page,
    .proposal-sheet {
      min-height: auto !important;
      height: auto !important;
    }
    .proposal-cover,
    [data-page="1"],
    [data-sheet-index="0"] {
      break-before: avoid !important;
      page-break-before: avoid !important;
      margin-top: 0 !important;
      padding-top: 0 !important;
    }
    [data-page="2"],
    [data-sheet-index="1"] {
      break-before: page !important;
      page-break-before: always !important;
      margin-top: 0 !important;
      padding-top: 0 !important;
    }
    .proposal-sheet,
    .proposal-page,
    [data-page],
    [data-sheet-index] {
      margin-top: 0 !important;
      padding-top: 0 !important;
    }
    .proposal-page {
      padding: 0 !important;
      margin: 0 !important;
      box-shadow: none !important;
    }
    .proposal-page:last-child {
      margin-bottom: 0 !important;
      padding-bottom: 0 !important;
    }

    .proposal-cover .image-container {
      width: 100% !important;
      height: 105mm !important;
      min-height: 105mm !important;
      max-height: 105mm !important;
      display: flex !important;
      flex-direction: column !important;
      align-items: center !important;
      justify-content: center !important;
      text-align: center !important;
      margin: 6mm 0 2mm !important;
      page-break-before: avoid !important;
      page-break-inside: avoid !important;
      break-before: avoid !important;
      break-inside: avoid !important;
      overflow: hidden !important;
    }

    .proposal-cover .machine-img {
      display: block !important;
      width: auto !important;
      max-width: 145mm !important;
      height: auto !important;
      max-height: 92mm !important;
      object-fit: contain !important;
      margin: 0 auto !important;
    }

    .proposal-cover .image-caption {
      margin-top: 3mm !important;
      font-size: 9px !important;
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
  return ''
}

export function wrapForPrint(content: string): string {
  return `<div style="max-width: 210mm; margin: 0 auto;">${content}</div>`
}
