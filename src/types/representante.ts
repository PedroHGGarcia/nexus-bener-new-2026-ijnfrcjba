export interface Representante {
  id: string
  reg?: number | null
  cod?: string | null
  fantasia: string
  razao_social: string | null
  documento: string | null
  email?: string | null
  telefone?: string | null
  celular?: string | null
  telefone_principal: string | null
  telefones: string[] | null
  emails: string[] | null
  cep: string | null
  estado: string | null
  cidade: string | null
  bairro: string | null
  logradouro: string | null
  numero: string | null
  complementos: string | null
  endereco?: string | null
  sigla: string | null
  regiao: string | null
  status: string
  rd_station_id: string | null
  gerente_id?: string | null
  profile_id?: string | null
  gerente?: {
    id: string
    nome: string
    email?: string | null
    cargo?: string | null
  } | null
  created_at: string | null
  updated_at: string | null
  // Relacionamentos carregados em telas
  categorias?: Array<{ id: string; nome: string }>
  regioes?: Array<{
    id: string
    nome: string
    uf: string | null
    todo_o_estado?: boolean
    cidades?: string[]
  }>
  total_categorias?: number
  total_regioes?: number
}

export type RepresentanteInsert = Omit<Representante, 'id' | 'created_at' | 'updated_at'>
export type RepresentanteUpdate = Partial<RepresentanteInsert> & { id: string }
