import type { MemoriaItem } from '@/hooks/use-memoria-calculo'
import { escapeHtml } from '@/lib/escape-html'

export function exportMemoriaToCsv(items: MemoriaItem[]): string {
  const headers = ['Descrição', 'Quantidade', 'Valor Unitário', 'Desconto (%)', 'Subtotal']
  const rows = items.map((item) => {
    const subtotal = item.quantidade * item.valorUnitario
    const desconto = subtotal * (item.descontoPct / 100)
    return [
      `"${item.descricao.replace(/"/g, '""')}"`,
      String(item.quantidade),
      item.valorUnitario.toFixed(2),
      String(item.descontoPct),
      (subtotal - desconto).toFixed(2),
    ].join(',')
  })
  return [headers.join(','), ...rows].join('\n')
}

export function downloadMemoriaCsv(items: MemoriaItem[], fileName = 'memoria-calculo.csv') {
  const csv = exportMemoriaToCsv(items)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}

export function generateMemoriaHtml(items: MemoriaItem[], total: number): string {
  const rows = items
    .map(
      (item) => `
    <tr>
      <td>${escapeHtml(item.descricao)}</td>
      <td style="text-align:right">${escapeHtml(item.quantidade)}</td>
      <td style="text-align:right">R$ ${item.valorUnitario.toFixed(2)}</td>
      <td style="text-align:right">${escapeHtml(item.descontoPct)}%</td>
      <td style="text-align:right">R$ ${(
        item.quantidade *
        item.valorUnitario *
        (1 - item.descontoPct / 100)
      ).toFixed(2)}</td>
    </tr>`,
    )
    .join('')
  return `<!DOCTYPE html>
    <html lang="pt-BR"><head><meta charset="utf-8"><title>Memória de Cálculo</title></head>
    <body>
      <h1>Memória de Cálculo</h1>
      <table border="1" style="border-collapse:collapse;width:100%">
        <thead><tr>
          <th>Descrição</th><th>Qtd</th><th>Valor Unit.</th><th>Desc.</th><th>Subtotal</th>
        </tr></thead>
        <tbody>${rows}</tbody>
        <tfoot><tr><td colspan="4" style="text-align:right"><strong>Total:</strong></td>
        <td style="text-align:right"><strong>R$ ${total.toFixed(2)}</strong></td></tr></tfoot>
      </table>
    </body></html>`
}

export function printMemoria(items: MemoriaItem[], total: number) {
  const html = generateMemoriaHtml(items, total)
  const win = window.open('', '_blank')
  if (!win) return
  // Sanitize via DOMPurify before writing to print document
  const winDoc = win.document
  winDoc.open()
  winDoc.write(html)
  winDoc.close()
  win.print()
}
