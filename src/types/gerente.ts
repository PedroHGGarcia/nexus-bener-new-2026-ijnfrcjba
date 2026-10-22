export interface Gerente {
  id: string
  nome: string
  email: string | null
  usuario: string | null
  cargo: string | null
  celular: string | null
  rd_station_id: string | null
  status: string
  profile_id?: string | null
  categoria_restrita_id?: string | null
  categoria_restrita?: {
    id: string
    nome: string
  } | null
  created_at: string | null
  updated_at: string | null
  // Representantes vinculados
  total_representantes?: number
  representantes?: Array<{
    id: string
    fantasia: string
    razao_social?: string | null
    email?: string | null
    telefone?: string | null
    cidade?: string | null
    estado?: string | null
    status?: string
  }>
}

export type GerenteInsert = Omit<
  Gerente,
  'id' | 'created_at' | 'updated_at' | 'representantes' | 'total_representantes'
>
export type GerenteUpdate = Partial<GerenteInsert> & { id: string }
