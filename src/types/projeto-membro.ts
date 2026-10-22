export interface ProjetoMembro {
  id: string
  projeto_id: string
  user_id: string
  papel: string
  created_at: string
}

export interface ProjetoMembroWithProfile extends ProjetoMembro {
  profiles: {
    id: string
    name: string
    email: string
    avatar_url: string | null
    role: string | null
  } | null
}

export const PAPEL_OPTIONS = [
  { value: 'Criador', label: 'Criador' },
  { value: 'Colaborador', label: 'Colaborador' },
  { value: 'Gerente', label: 'Gerente' },
  { value: 'Visualizador', label: 'Visualizador' },
] as const
