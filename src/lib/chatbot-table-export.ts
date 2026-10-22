import type { ChatTableData } from '@/services/versoes-chatbot'

/**
 * Escapa uma célula para formato CSV/planilha seguro, lidando com aspas, quebras de linha e separadores.
 */
function escapeCell(cell: string | number | null | undefined): string {
  if (cell == null) return ''
  const str = String(cell).trim()
  if (str.includes(';') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

/**
 * Gera o nome padrão do arquivo com a data de hoje no padrão AAAA-MM-DD
 * ex: bener-tech-maquinas-2026-09-17.csv
 */
export function getChatbotExportFilename(extension: 'csv' | 'xlsx' = 'csv'): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `bener-tech-maquinas-${year}-${month}-${day}.${extension}`
}

/**
 * Exporta uma tabela estruturada para formato compatível com Excel (.csv com BOM UTF-8 e ponto-e-vírgula).
 * No Windows e Excel Brasil, o separador ';' com BOM \uFEFF é o padrão nativo que abre colunado
 * instantaneamente sem distorcer acentuação e sem necessidade de scripts pesados de terceiros.
 */
export function exportTableToCsv(table: ChatTableData, maxRows = 200): string {
  const safeHeaders = table.headers.map(escapeCell).join(';')
  const safeRows = table.rows
    .slice(0, maxRows)
    .map((row) => row.map(escapeCell).join(';'))
    .join('\r\n')

  return `\uFEFF${safeHeaders}\r\n${safeRows}`
}

/**
 * Dispara o download imediato da tabela no navegador do usuário.
 */
export function downloadChatbotTableAsFile(table: ChatTableData, customFilename?: string): void {
  if (!table || !table.headers.length || !table.rows.length) return

  const filename = customFilename || getChatbotExportFilename('csv')
  const csvContent = exportTableToCsv(table)

  const blob = new Blob([csvContent], {
    type: 'text/csv;charset=utf-8;',
  })

  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()

  // Limpeza
  setTimeout(() => {
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }, 150)
}
