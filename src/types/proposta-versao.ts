export interface PropostaVersao {
  id: string
  proposta_id: string
  versao_id: string
  quantidade: number
  valor_unitario: number
  desconto_percentual: number
  desconto_valor: number
  ordem: number
  tipo_proposta?: string | null
  created_at: string | null
  updated_at: string | null
}

export interface PropostaVersaoWithRelations extends PropostaVersao {
  versoes: {
    id: string
    nome: string
    cod_erp: string | null
    nome_abreviado: string | null
    imagem_preview: string | null
    moeda: string | null
    valor: number | null
    especificacoes_tecnicas: string | null
    caracteristicas_construtivas: string | null
    acessorios_standards: string | null
    tem_estoque: boolean
    estoque_disponivel: number
    modelos: {
      id: string
      nome: string
      marcas: { id: string; nome: string } | null
      produtos: {
        id: string
        nome: string
        categorias_produtos: { id: string; nome: string } | null
      } | null
    } | null
  } | null
}

export type PropostaVersaoInsert = Omit<PropostaVersao, 'id' | 'created_at' | 'updated_at'>
