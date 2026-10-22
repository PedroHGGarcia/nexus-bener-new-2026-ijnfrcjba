export interface Modelo {
  id: string
  nome: string
  produto: string | null
  marca: string | null
  status: string
  reg?: number | null
  cod?: string | null
  categoria_nome?: string | null
  created_at: string | null
  updated_at: string | null
  deleted_at: string | null
  deleted_by: string | null
}

export type ModeloInsert = Omit<
  Modelo,
  'id' | 'created_at' | 'updated_at' | 'deleted_at' | 'deleted_by'
>
export type ModeloUpdate = Partial<ModeloInsert> & { id: string }

export interface ModeloImagem {
  id: string
  modelo_id: string
  nome_arquivo: string | null
  url: string
  descricao: string | null
  tipo_documento: string | null
  tamanho_bytes: number | null
  criado_por: string | null
  created_at: string
  updated_at: string
  // Dados enriquecidos opcionais para visualização / listagem
  modelo?: {
    id: string
    nome: string
  } | null
}
