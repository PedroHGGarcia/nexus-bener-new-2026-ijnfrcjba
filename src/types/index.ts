export type Role =
  | 'Admin Completo'
  | 'Vendedor'
  | 'Representante'
  | 'Gerente'
  | 'Financeiro'
  | 'admin'
  | 'gerente'
  | 'vendedor'
  | 'representante'
  | 'tecnico'
  | 'user'

export interface UserProfile {
  id: string
  name: string
  email: string
  role: Role
  avatarUrl?: string
  phone?: string
  status: 'Ativo' | 'Inativo'
  setor?: string
  menuAccess?: string[]
  assinatura?: string
  gerente_id?: string | null
  estado_atuacao?: string | null
}

export interface Client {
  id: string
  nome: string
  cpfCnpj: string
  email: string
  telefone: string
  cidade: string
  estado: string
  status: 'Ativo' | 'Inativo'
  createdAt: string
}

export interface Representative {
  id: string
  nome: string
  email: string
  telefone: string
  regiao: string
  comissaoPct: number
  status: 'Ativo' | 'Inativo'
}

export interface Region {
  id: string
  nome: string
  codigo: string
  gerente: string
  estado: string
}

export interface Manager {
  id: string
  nome: string
  email: string
  telefone: string
  regiao: string
}

export interface Preposto {
  id: string
  nome: string
  documento: string
  telefone: string
  regiao: string
}

export interface Product {
  id: string
  nome: string
  categoria: string
  marca: string
  modelo: string
  versao: string
  preco: number
  estoque: number
  descricao?: string
  status: 'Disponível' | 'Esgotado' | 'Sob Encomenda'
}

export interface ProductPriceHistory {
  id: string
  productId: string
  productName: string
  precoAntigo: number
  precoNovo: number
  motivo: string
  data: string
  usuario: string
}

export interface Project {
  id: string
  nome: string
  clienteId: string
  clienteNome: string
  status: 'Em Andamento' | 'Concluído' | 'Pendente' | 'Cancelado'
  dataInicio: string
  dataFim: string
  orcamento: number
  descricao: string
}

export interface ProposalItem {
  id: string
  produtoId: string
  produtoNome: string
  quantidade: number
  precoUnitario: number
  descontoPct: number
}

export interface Proposal {
  id: string
  numero: string
  clienteId: string
  clienteNome: string
  projetoId?: string
  projetoNome?: string
  tipo: string
  itens: ProposalItem[]
  valorTotal: number
  status: 'Aprovada' | 'Em Análise' | 'Recusada' | 'Rascunho' | 'Expirada'
  validadeDias: number
  dataCriacao: string
  observacoes?: string
}

export interface CalendarEvent {
  id: string
  titulo: string
  descricao: string
  dataInicio: string
  dataFim: string
  tipo: 'Reunião' | 'Manutenção' | 'Visita Técnica' | 'Treinamento'
  local: string
}

export interface AppNotification {
  id: string
  titulo: string
  mensagem: string
  data: string
  lida: boolean
  link?: string
}

export interface ImportHistory {
  id: string
  arquivo: string
  data: string
  linhas: number
  status: 'Concluído' | 'Falha' | 'Em Processamento'
  usuario: string
}

export interface AuditLog {
  id: string
  acao: string
  usuario: string
  timestamp: string
  detalhes: string
}

export interface CoverageArea {
  id: string
  regiao: string
  cidades: string[]
  tecnicosCount: number
  status: 'Ativa' | 'Expansão'
}
