import { MemoriaCalculoItem, MemoriaTotals } from '@/types/memoria-calculo-item'
import { PrecoItem } from '@/components/propostas/LicitacaoPrecosTable'

const COLUMN_MAP: Record<string, keyof MemoriaCalculoItem> = {
  unidade: 'unidade',
  unidad: 'unidade',
  unit: 'unidade',
  item: 'item',
  nº: 'item',
  numero: 'item',
  'n°': 'item',
  número: 'item',
  descrição: 'descricao',
  descricao: 'descricao',
  description: 'descricao',
  marca: 'marca',
  brand: 'marca',
  fabricante: 'marca',
  modelo: 'modelo',
  model: 'modelo',
  quantidade: 'quantidade',
  qtd: 'quantidade',
  qty: 'quantidade',
  quantity: 'quantidade',
  'unidade de medida': 'unidadeMedida',
  un: 'unidadeMedida',
  'u.m.': 'unidadeMedida',
  um: 'unidadeMedida',
  'preço unitário': 'precoUnitario',
  'preco unitario': 'precoUnitario',
  preço: 'precoUnitario',
  preco: 'precoUnitario',
  'unit price': 'precoUnitario',
  'valor unitário': 'precoUnitario',
  desconto: 'descontoPct',
  discount: 'descontoPct',
  'desconto (%)': 'descontoPct',
  desc: 'descontoPct',
  comissão: 'comissaoPct',
  comissao: 'comissaoPct',
  commission: 'comissaoPct',
  'comissão (%)': 'comissaoPct',
  prazo: 'prazoEntrega',
  'prazo de entrega': 'prazoEntrega',
  delivery: 'prazoEntrega',
  entrega: 'prazoEntrega',
  condições: 'condicoesPagamento',
  condicoes: 'condicoesPagamento',
  'condições de pagamento': 'condicoesPagamento',
  payment: 'condicoesPagamento',
  pagamento: 'condicoesPagamento',
  observações: 'observacoes',
  observacoes: 'observacoes',
  obs: 'observacoes',
  remarks: 'observacoes',
}

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, ' ')
}

function parseNumber(val: string): number {
  const c = val.trim().replace(/[^\d,.-]/g, '')
  if (c.includes(',') && c.includes('.'))
    return parseFloat(c.replace(/\./g, '').replace(',', '.')) || 0
  if (c.includes(',')) return parseFloat(c.replace(',', '.')) || 0
  return parseFloat(c) || 0
}

export function calcPrecoTotal(item: MemoriaCalculoItem): number {
  return (item.quantidade || 0) * (item.precoUnitario || 0)
}

export function calcValorDesconto(item: MemoriaCalculoItem): number {
  return calcPrecoTotal(item) * ((item.descontoPct || 0) / 100)
}

export function calcValorComissao(item: MemoriaCalculoItem): number {
  return (calcPrecoTotal(item) - calcValorDesconto(item)) * ((item.comissaoPct || 0) / 100)
}

export function calcTotals(items: MemoriaCalculoItem[]): MemoriaTotals {
  let subtotal = 0,
    totalDescontos = 0,
    totalComissao = 0
  items.forEach((it) => {
    subtotal += calcPrecoTotal(it)
    totalDescontos += calcValorDesconto(it)
    totalComissao += calcValorComissao(it)
  })
  return { subtotal, totalDescontos, totalGeral: subtotal - totalDescontos, totalComissao }
}

export function validateItem(item: MemoriaCalculoItem): string[] {
  const e: string[] = []
  if (!item.unidade?.trim()) e.push('Unidade obrigatória')
  if (!item.descricao?.trim()) e.push('Descrição obrigatória')
  if (!item.unidadeMedida?.trim()) e.push('Unidade de Medida obrigatória')
  if (item.quantidade <= 0) e.push('Quantidade deve ser > 0')
  if (item.precoUnitario <= 0) e.push('Preço Unitário deve ser > 0')
  if (item.descontoPct < 0 || item.descontoPct > 100) e.push('Desconto deve estar entre 0 e 100')
  if (item.comissaoPct < 0 || item.comissaoPct > 100) e.push('Comissão deve estar entre 0 e 100')
  return e
}

function parseCsvRows(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = [],
    field = '',
    inQ = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else inQ = false
      } else field += c
    } else if (c === '"') inQ = true
    else if (c === ',') {
      row.push(field)
      field = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(field)
      field = ''
      if (row.some((v) => v.trim())) rows.push(row)
      row = []
    } else field += c
  }
  if (field !== '' || row.length > 0) {
    row.push(field)
    if (row.some((v) => v.trim())) rows.push(row)
  }
  return rows
}

export async function parseFileToItems(file: File): Promise<MemoriaCalculoItem[]> {
  const buffer = await file.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  if (bytes[0] === 80 && bytes[1] === 75) {
    throw new Error('Arquivo .xlsx detectado. Salve como .csv e tente novamente.')
  }
  const text = new TextDecoder('utf-8').decode(buffer)
  const rows = parseCsvRows(text)
  if (rows.length < 2) throw new Error('Arquivo CSV vazio ou sem dados.')
  const headers = rows[0].map(normalizeHeader)
  const items: MemoriaCalculoItem[] = []
  rows.slice(1).forEach((row, idx) => {
    if (row.every((v) => !v.trim())) return
    const obj: Partial<MemoriaCalculoItem> = {}
    headers.forEach((h, i) => {
      const field = COLUMN_MAP[h]
      if (field && row[i] !== undefined) {
        const val = row[i].trim()
        const record = obj as Record<string, unknown>
        if (field === 'item' || field === 'quantidade')
          record[field] = parseNumber(val) || (field === 'item' ? idx + 1 : 1)
        else if (field === 'precoUnitario' || field === 'descontoPct' || field === 'comissaoPct')
          record[field] = parseNumber(val)
        else record[field] = val
      }
    })
    items.push({
      id: `mc-import-${Date.now()}-${idx}`,
      unidade: obj.unidade || '',
      item: obj.item || idx + 1,
      descricao: obj.descricao || '',
      marca: obj.marca || '',
      modelo: obj.modelo || '',
      quantidade: obj.quantidade || 1,
      unidadeMedida: obj.unidadeMedida || 'un',
      precoUnitario: obj.precoUnitario || 0,
      descontoPct: obj.descontoPct || 0,
      comissaoPct: obj.comissaoPct || 0,
      prazoEntrega: obj.prazoEntrega || '',
      condicoesPagamento: obj.condicoesPagamento || '',
      observacoes: obj.observacoes || '',
    })
  })
  return items
}

export function syncToPrecoItems(items: MemoriaCalculoItem[]): PrecoItem[] {
  return items.map((it) => ({
    id: it.id,
    unidade: it.unidade,
    descricao: it.descricao,
    qtd: it.quantidade,
    unidadeMedida: it.unidadeMedida,
    custoUnitario: it.precoUnitario,
    fatorNac: 1.0,
    descontoPct: it.descontoPct,
    comissaoPct: it.comissaoPct,
    markupPct: 0,
    encargosPct: 0,
  }))
}

export function exportToCsv(items: MemoriaCalculoItem[]): string {
  const h = [
    'Unidade',
    'Item',
    'Descrição',
    'Marca',
    'Modelo',
    'Qtd',
    'U.M.',
    'Preço Unit.',
    'Desc.%',
    'Preço Total',
    'Comiss.%',
    'Val.Comiss.',
    'Prazo',
    'Condições',
    'Obs.',
  ]
  const rows = items.map((it) =>
    [
      `"${it.unidade}"`,
      String(it.item),
      `"${it.descricao.replace(/"/g, '""')}"`,
      `"${it.marca}"`,
      `"${it.modelo}"`,
      String(it.quantidade),
      `"${it.unidadeMedida}"`,
      it.precoUnitario.toFixed(2),
      String(it.descontoPct),
      calcPrecoTotal(it).toFixed(2),
      String(it.comissaoPct),
      calcValorComissao(it).toFixed(2),
      `"${it.prazoEntrega}"`,
      `"${it.condicoesPagamento}"`,
      `"${it.observacoes.replace(/"/g, '""')}"`,
    ].join(','),
  )
  return [h.join(','), ...rows].join('\n')
}

export function downloadCsv(items: MemoriaCalculoItem[], fileName = 'memoria-calculo.csv') {
  const blob = new Blob(['\ufeff' + exportToCsv(items)], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  URL.revokeObjectURL(url)
}

export function printMemoria(items: MemoriaCalculoItem[], totals: MemoriaTotals, moeda: string) {
  const sym = moeda === 'USD' ? 'US$' : moeda === 'EUR' ? '€' : 'R$'
  const rows = items
    .map(
      (it) =>
        `<tr><td>${it.unidade}</td><td>${it.item}</td><td>${it.descricao}</td><td>${it.quantidade}</td><td>${it.unidadeMedida}</td><td style="text-align:right">${sym} ${it.precoUnitario.toFixed(2)}</td><td style="text-align:right">${it.descontoPct}%</td><td style="text-align:right">${sym} ${calcPrecoTotal(it).toFixed(2)}</td><td style="text-align:right">${sym} ${calcValorComissao(it).toFixed(2)}</td></tr>`,
    )
    .join('')
  const html = `<html><head><title>Memória de Cálculo</title><style>body{font-family:sans-serif;margin:20px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccc;padding:4px 8px;font-size:12px}</style></head><body><h1>Memória de Cálculo</h1><table><thead><tr><th>Unid</th><th>Item</th><th>Descrição</th><th>Qtd</th><th>U.M.</th><th>Preço Unit</th><th>Desc</th><th>Total</th><th>Comiss</th></tr></thead><tbody>${rows}</tbody><tfoot><tr><td colspan="7" style="text-align:right"><strong>Subtotal:</strong></td><td style="text-align:right">${sym} ${totals.subtotal.toFixed(2)}</td><td></td></tr><tr><td colspan="7" style="text-align:right"><strong>Total Geral:</strong></td><td style="text-align:right"><strong>${sym} ${totals.totalGeral.toFixed(2)}</strong></td><td></td></tr></tfoot></table></body></html>`
  const win = window.open('', '_blank')
  if (!win) return
  win.document.write(html)
  win.document.close()
  win.print()
}
