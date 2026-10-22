export interface CategoriaProduto {
  id: string
  nome: string
  logo: string | null
  status: string
  created_at: string | null
  updated_at: string | null
  deleted_at: string | null
  deleted_by: string | null
}

export type CategoriaProdutoInsert = Omit<
  CategoriaProduto,
  'id' | 'created_at' | 'updated_at' | 'deleted_at' | 'deleted_by'
>
export type CategoriaProdutoUpdate = Partial<CategoriaProdutoInsert> & { id: string }
