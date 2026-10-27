import type { ClienteContato } from './cliente'

export interface Proposta {
  id: string
  numero_proposta: string | null
  revisao: string | null
  cliente: string | null
  modelo_licitacao: boolean
  descricao_proposta: string | null
  especificacoes_tecnicas: string | null
  materiais_utilizados: string | null
  certificacoes: string | null
  normas_aplicaveis: string | null
  certificacoes_seguranca: string | null
  normas_seguranca: string | null
  cobertura_garantia: string | null
  assistencia_tecnica_detalhada: string | null
  criterios_aceitacao: string | null
  garantia_acessorios: string | null
  validade_oferta: string | null
  secoes_adicionais: Record<string, unknown> | null
  contato: string | null
  contato_id?: string | null
  telefone: string | null
  versao: string | null
  representante: string | null
  gerente: string | null
  moeda: string | null
  valor_sem_desconto: number | null
  percentual_desconto: number | null
  valor_atual: number | null
  valor_final: number | null
  preco_especial?: number | null
  prazo_entrega: string | null
  condicoes_pagamento: string | null
  acessorios_proposta:
    | Array<{
        id: string
        nome: string
        valor: number
        moeda?: string
        inclusao?: 'preco' | 'opcional' | 'incluir' | 'exibir' | 'nao_exibir'
        quantidade?: number
        desconto_percentual?: number
        desconto_valor?: number
        versao_id?: string
      }>
    | Record<string, unknown>
    | null
  cliente_original: string | null
  versao_original: string | null
  representante_original: string | null
  gerente_original: string | null
  nota_rep: number | null
  dt_cad: string | null
  user: string | null
  tipo_proposta: string | null
  projeto: string | null
  status: string
  data_alteracao_status: string | null
  ultimo_usuario_status: string | null
  assinatura_cliente: string | null
  assinatura_representante: string | null
  emails_notificacao: string | null
  assinatura_gerente_produto: string | null
  assinatura_assessor_tecnico: string | null
  nome_gerente_produto: string | null
  nome_assessor_tecnico: string | null
  nome_representante_comercial: string | null
  assinante_representante_id: string | null
  assinante_gerente_id: string | null
  assinado_por_representante: string | null
  assinado_por_gerente: string | null
  data_assinatura_representante: string | null
  data_assinatura_gerente: string | null
  versoes_comparacao: string[] | Record<string, unknown> | null
  pdf_anexo: string | null
  transporte_seguro: string | null
  imposto_ipi: number | null
  imposto_icms: number | null
  estado_faturamento: string | null
  regime_preco: string | null
  cambio_estimado: number | null
  cambio_estimado_data: string | null
  cambio_estimado_base: string | null
  cotacao_moeda?: number | null
  data_cotacao_moeda?: string | null
  moeda_original?: string | null
  campos_adicionais: Array<{ titulo: string; conteudo: string }> | Record<string, unknown> | null
  frase_preco?: string | null
  frase_comissao?: string | null
  treinamento_tecnico?: string | null
  is_pacote: boolean
  link_publico?: string | null
  public_token?: string | null
  tipo_proposta_override?:
    | import('@/types/tipo-proposta').TipoProposta
    | Record<string, unknown>
    | null
  itens_snapshot?: import('@/lib/proposal-snapshot').PropostaItemSnapshot[] | null
  dados_snapshot?:
    | import('@/lib/proposal-snapshot').PropostaSnapshotRoot
    | Record<string, unknown>
    | null
  created_at: string | null
  updated_at: string | null
}

export type PropostaInsert = Omit<Proposta, 'id' | 'created_at' | 'updated_at'>
export type PropostaUpdate = Partial<PropostaInsert> & { id: string }

export interface PropostaWithRelations extends Proposta {
  clientes: {
    id: string
    fantasia: string
    razao_social: string | null
    documento: string | null
    contato: string | null
    email: string | null
    telefone: string | null
    cep: string | null
    estado: string | null
    cidade: string | null
    bairro: string | null
    logradouro: string | null
    numero: string | null
    complementos: string | null
  } | null
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
  representantes: { id: string; fantasia: string; sigla?: string | null } | null
  gerentes: { id: string; nome: string } | null
  projetos?: { id: string; nome: string } | null
  assinante_representante?: { id: string; fantasia: string } | null
  assinante_gerente?: { id: string; nome: string } | null
  cliente_contatos?: ClienteContato | null
}

export const STATUS_FLOW: Record<string, string[]> = {
  'Em Analise': ['Aprovada', 'Rejeitada', 'Validada'],
  Aprovada: ['Excluida'],
  Rejeitada: [],
  Validada: [],
  Excluida: [],
}

export const STATUS_LABELS: Record<string, string> = {
  'Em Analise': 'Em Análise',
  Aprovada: 'Aprovada',
  Rejeitada: 'Rejeitada',
  Validada: 'Validada',
  Excluida: 'Excluída',
}
