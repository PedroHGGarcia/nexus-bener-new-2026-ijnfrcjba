export interface Produto {
  id: string
  nome: string
  reg?: number | null
  cod?: string | null
  modelo?: string | null
  fabricante?: string | null
  categoria_nome?: string | null
  categoria: string | null
  descricao: string | null
  especificacoes: Record<string, string> | null
  fotos: string[] | null
  status: string
  created_at: string | null
  updated_at: string | null
  deleted_at: string | null
  deleted_by: string | null
}

export type ProdutoInsert = Omit<
  Produto,
  'id' | 'created_at' | 'updated_at' | 'deleted_at' | 'deleted_by'
>
export type ProdutoUpdate = Partial<ProdutoInsert> & { id: string }
