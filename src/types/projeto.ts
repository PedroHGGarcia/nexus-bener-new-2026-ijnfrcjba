export interface Projeto {
  id: string
  nome: string
  descricao: string | null
  cliente: string | null
  status: string
  user: string | null
  ooo: string | null
  created_at: string | null
  updated_at: string | null
}

export interface ProjectCreator {
  id: string
  name: string
  email: string
  avatar_url: string | null
  cargo?: string | null
  role?: string | null
}

export interface ProjetoWithRelations extends Projeto {
  clientes: { id: string; fantasia: string } | null
  creator: ProjectCreator | null
  has_licitacao?: boolean
}

export type ProjetoInsert = Omit<Projeto, 'id' | 'created_at' | 'updated_at'>
export type ProjetoUpdate = Partial<ProjetoInsert> & { id: string }

export const PROJETO_STATUS_OPTIONS = [
  { value: 'Em Andamento', label: 'Em Andamento' },
  { value: 'Concluido', label: 'Concluído' },
  { value: 'Cancelado', label: 'Cancelado' },
] as const
