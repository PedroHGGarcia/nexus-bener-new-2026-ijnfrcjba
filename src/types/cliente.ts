// Interface de contatos
export interface ContatoAdicional {
  id: string
  nome: string
  cargo: string
  telefone: string
  email: string
}

export interface Cliente {
  id: string
  fantasia: string
  razao_social: string | null
  documento: string | null
  status: string
  contato: string | null
  telefone: string | null
  telefone_2: string | null
  telefone_3: string | null
  celular: string | null
  email: string | null
  email_fiscal: string | null
  cep: string | null
  estado: string | null
  cidade: string | null
  bairro: string | null
  logradouro: string | null
  numero: string | null
  complementos: string | null
  contatos_adicionais: ContatoAdicional[] | null
  limite_credito: number | null
  dt_cad: string | null
  maquina_interesse?: string | null
  maquina_interesse_adicionada_por?: string | null
  maquina_interesse_adicionada_em?: string | null
  criado_por?: string | null
  created_at: string
  updated_at: string
  // Dados populados de auditoria (via profiles - R9)
  criador_nome?: string | null
  maquina_interesse_autor_nome?: string | null
}

export interface ClienteContato {
  id: string
  cliente_id: string
  nome: string
  email: string | null
  telefone: string | null
  cargo: string | null
  is_principal: boolean
  created_at?: string
}

export type ClienteContatoInput = {
  id?: string
  cliente_id?: string
  nome: string
  email?: string | null
  telefone?: string | null
  cargo?: string | null
  is_principal?: boolean
}

export type ClienteInsert = Omit<Cliente, 'id' | 'created_at' | 'updated_at'>
export type ClienteUpdate = Partial<ClienteInsert> & { id: string }
