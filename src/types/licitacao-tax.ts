export interface TaxConfig {
  estadoFaturamento: string
  regimePreco: 'embutido' | 'liquido'
  cambioEstimado: number | null
  cambioEstimadoData: string
  cambioEstimadoBase: string
}

export function createDefaultTaxConfig(): TaxConfig {
  return {
    estadoFaturamento: '',
    regimePreco: 'embutido',
    cambioEstimado: null,
    cambioEstimadoData: '',
    cambioEstimadoBase: '',
  }
}
