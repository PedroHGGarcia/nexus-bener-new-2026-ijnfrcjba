export interface Marca {
  id: string
  nome: string
  status: string
  reg?: number | null
  cod?: number | null
  site?: string | null
  pais?: string | null
  created_at: string | null
  updated_at: string | null
  deleted_at: string | null
  deleted_by: string | null
}

export type MarcaInsert = Omit<
  Marca,
  'id' | 'created_at' | 'updated_at' | 'deleted_at' | 'deleted_by'
>
export type MarcaUpdate = Partial<MarcaInsert> & { id: string }
