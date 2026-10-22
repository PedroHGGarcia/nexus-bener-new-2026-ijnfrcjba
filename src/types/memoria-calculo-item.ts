export interface MemoriaCalculoItem {
  id: string
  unidade: string
  item: number
  descricao: string
  marca: string
  modelo: string
  quantidade: number
  unidadeMedida: string
  precoUnitario: number
  descontoPct: number
  comissaoPct: number
  prazoEntrega: string
  condicoesPagamento: string
  observacoes: string
}

export interface MemoriaTotals {
  subtotal: number
  totalDescontos: number
  totalGeral: number
  totalComissao: number
}

export function createEmptyMemoriaItem(index: number): MemoriaCalculoItem {
  return {
    id: `mc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    unidade: '',
    item: index,
    descricao: '',
    marca: '',
    modelo: '',
    quantidade: 1,
    unidadeMedida: 'un',
    precoUnitario: 0,
    descontoPct: 0,
    comissaoPct: 0,
    prazoEntrega: '',
    condicoesPagamento: '',
    observacoes: '',
  }
}
