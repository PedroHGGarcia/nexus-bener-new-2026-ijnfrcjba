export interface Versao {
  id: string
  modelo: string | null
  nome: string
  reg?: string | null
  cod_erp: string | null
  imagem_preview: string | null
  moeda: string
  valor: number
  tem_fator: boolean
  fator_nac: number
  valor_anterior: number | null
  data_ultimo_reajuste: string | null
  nome_abreviado: string | null
  tem_estoque: boolean
  desconto_max_representante: number
  desconto_max_bener: number
  estoque_total: number
  estoque_bloqueado: number
  estoque_reservado: number
  estoque_disponivel: number
  acessorios_standards: string | null
  caracteristicas_construtivas: string | null
  especificacoes_tecnicas: string | null
  tipos_proposta: string[] | null
  atualizado_por: string | null
  status: string
  galeria: any | null
  alerta_estoque_minimo: number | null
  created_at: string | null
  updated_at: string | null
  deleted_at: string | null
  deleted_by: string | null
  categoria_id?: string | null
  categorias_produtos?: { id: string; nome: string } | null
}

export type VersaoInsert = Omit<
  Versao,
  'id' | 'created_at' | 'updated_at' | 'deleted_at' | 'deleted_by'
>
export type VersaoUpdate = Partial<VersaoInsert> & { id: string }

export interface VersaoWithModelo extends Versao {
  modelos: { id: string; nome: string } | null
  categorias_produtos?: { id: string; nome: string } | null
}

export interface VersaoHistorico {
  id: string
  versao_id: string
  usuario: string | null
  acao: string | null
  detalhes: string | null
  created_at: string | null
}

export interface VersaoImagemItem {
  id?: string
  url: string
  nome_arquivo?: string | null
  criada_em?: string
  legenda?: string | null
}

export interface VersaoImagem {
  id: string
  versao_id: string
  nome_arquivo: string | null
  url: string
  criada_em: string
  versao?: Versao | null
}
