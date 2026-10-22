export interface Regiao {
  id: string
  nome: string
  uf: string | null
  status: string
  todo_o_estado?: boolean
  cidades?: string[]
  created_at: string | null
  updated_at: string | null
}

export type RegiaoInsert = Omit<Regiao, 'id' | 'created_at' | 'updated_at'>
export type RegiaoUpdate = Partial<RegiaoInsert> & { id: string }
