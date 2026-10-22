export interface Acessorio {
  id: string
  nome: string
  tipo: string | null
  moeda: string | null
  valor: number | null
  fator_nac: number | null
  status: string | null
  versoes: string[] | null
  versao_nomes?: string[] | null
  especificacoes_tecnicas: string | null
  valor_anterior: number | null
  data_ultimo_reajuste: string | null
  atualizado_por: string | null
  created_at: string | null
  updated_at: string | null
}

export type AcessorioInsert = Omit<Acessorio, 'id' | 'created_at' | 'updated_at' | 'versao_nomes'>
export type AcessorioUpdate = Partial<AcessorioInsert> & { id: string }
