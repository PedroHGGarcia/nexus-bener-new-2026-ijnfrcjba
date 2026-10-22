import {
  Client,
  Representative,
  Region,
  Manager,
  Preposto,
  Product,
  Project,
  Proposal,
  CalendarEvent,
  AppNotification,
  ImportHistory,
  AuditLog,
  CoverageArea,
  UserProfile,
  ProductPriceHistory,
} from '@/types'

export const INITIAL_USER: UserProfile = {
  id: 'usr-01',
  name: 'Eng. Carlos Eduardo',
  email: 'carlos.eduardo@bener.com.br',
  role: 'admin',
  phone: '(11) 98765-4321',
  status: 'Ativo',
  avatarUrl: 'https://img.usecurling.com/ppl/medium?gender=male&seed=88',
}

export const INITIAL_USERS: UserProfile[] = [
  INITIAL_USER,
  {
    id: 'usr-02',
    name: 'Mariana Silva',
    email: 'mariana.silva@bener.com.br',
    role: 'gerente',
    phone: '(11) 97654-3210',
    status: 'Ativo',
    avatarUrl: 'https://img.usecurling.com/ppl/medium?gender=female&seed=42',
  },
  {
    id: 'usr-03',
    name: 'Roberto Santos',
    email: 'roberto.santos@bener.com.br',
    role: 'vendedor',
    phone: '(19) 98112-3344',
    status: 'Ativo',
    avatarUrl: 'https://img.usecurling.com/ppl/medium?gender=male&seed=15',
  },
]

export const INITIAL_CLIENTS: Client[] = [
  {
    id: 'cli-01',
    nome: 'Petrobras S.A.',
    cpfCnpj: '33.000.167/0001-01',
    email: 'compras@petrobras.com.br',
    telefone: '(21) 3814-1000',
    cidade: 'Rio de Janeiro',
    estado: 'RJ',
    status: 'Ativo',
    createdAt: '2025-01-15',
  },
  {
    id: 'cli-02',
    nome: 'WEG Equipamentos Elétricos',
    cpfCnpj: '84.429.695/0001-11',
    email: 'suprimentos@weg.net',
    telefone: '(47) 3276-4000',
    cidade: 'Jaraguá do Sul',
    estado: 'SC',
    status: 'Ativo',
    createdAt: '2025-02-10',
  },
  {
    id: 'cli-03',
    nome: 'Embraer Indústria Aeronáutica',
    cpfCnpj: '60.701.190/0001-04',
    email: 'fornecedores@embraer.com.br',
    telefone: '(12) 3927-1000',
    cidade: 'São José dos Campos',
    estado: 'SP',
    status: 'Ativo',
    createdAt: '2025-03-01',
  },
  {
    id: 'cli-04',
    nome: 'Gerdau Aços Longos',
    cpfCnpj: '03.322.289/0001-90',
    email: 'compras.sp@gerdau.com.br',
    telefone: '(11) 3094-6000',
    cidade: 'São Paulo',
    estado: 'SP',
    status: 'Ativo',
    createdAt: '2025-03-20',
  },
]

export const INITIAL_REPRESENTATIVES: Representative[] = [
  {
    id: 'rep-01',
    nome: 'Marcos Vinícius de Oliveira',
    email: 'marcos.rep@bener.com.br',
    telefone: '(19) 99123-4567',
    regiao: 'Sudeste - SP Interior',
    comissaoPct: 4.5,
    status: 'Ativo',
  },
  {
    id: 'rep-02',
    nome: 'Fernanda Lima',
    email: 'fernanda.rep@bener.com.br',
    telefone: '(41) 98877-6655',
    regiao: 'Sul - PR e SC',
    comissaoPct: 5.0,
    status: 'Ativo',
  },
]

export const INITIAL_REGIONS: Region[] = [
  {
    id: 'reg-01',
    nome: 'Sudeste Industrial',
    codigo: 'REG-SE-01',
    gerente: 'Mariana Silva',
    estado: 'SP',
  },
  {
    id: 'reg-02',
    nome: 'Sul Maquinários',
    codigo: 'REG-SUL-02',
    gerente: 'Ricardo Fonseca',
    estado: 'SC',
  },
  {
    id: 'reg-03',
    nome: 'Nordeste Expansão',
    codigo: 'REG-NE-03',
    gerente: 'Juliana Costa',
    estado: 'PE',
  },
]

export const INITIAL_MANAGERS: Manager[] = [
  {
    id: 'mng-01',
    nome: 'Mariana Silva',
    email: 'mariana.silva@bener.com.br',
    telefone: '(11) 97654-3210',
    regiao: 'Sudeste Industrial',
  },
  {
    id: 'mng-02',
    nome: 'Ricardo Fonseca',
    email: 'ricardo.fonseca@bener.com.br',
    telefone: '(47) 99887-1122',
    regiao: 'Sul Maquinários',
  },
]

export const INITIAL_PREPOSTOS: Preposto[] = [
  {
    id: 'prep-01',
    nome: 'André Ramos',
    documento: '284.912.448-90',
    telefone: '(11) 98811-2233',
    regiao: 'Sudeste Industrial',
  },
  {
    id: 'prep-02',
    nome: 'Beatriz Castro',
    documento: '192.837.465-11',
    telefone: '(47) 99122-3344',
    regiao: 'Sul Maquinários',
  },
]

export const INITIAL_PRODUCTS: Product[] = [
  {
    id: 'prod-01',
    nome: 'Torno CNC Bener Heavy Duty V8',
    categoria: 'Tornos CNC',
    marca: 'Bener HighTech',
    modelo: 'V8-1500',
    versao: '2026 Ultimate',
    preco: 485000,
    estoque: 8,
    descricao: 'Torno CNC de alta precisão para usinagem pesada com comando Siemens Sinumerik.',
    status: 'Disponível',
  },
  {
    id: 'prod-02',
    nome: 'Centro de Usinagem Vertical 5 Eixos',
    categoria: 'Centros de Usinagem',
    marca: 'Bener HighTech',
    modelo: 'MCU-5X',
    versao: 'PRO 2026',
    preco: 890000,
    estoque: 3,
    descricao: 'Usinagem simultânea em 5 eixos para peças complexas e setor aeroespacial.',
    status: 'Disponível',
  },
  {
    id: 'prod-03',
    nome: 'Corte a Laser de Fibra Optica 12kW',
    categoria: 'Corte a Laser',
    marca: 'Bener FiberCut',
    modelo: 'FC-12000',
    versao: 'V3 HighSpeed',
    preco: 1250000,
    estoque: 2,
    descricao: 'Máquina de corte a laser de fibra de ultra potência para chapas de aço até 30mm.',
    status: 'Disponível',
  },
  {
    id: 'prod-04',
    nome: 'Prensa Dobradeira Hidráulica CNC 200T',
    categoria: 'Conformação de Chapas',
    marca: 'Bener Press',
    modelo: 'PB-20030',
    versao: 'EcoServo',
    preco: 340000,
    estoque: 12,
    descricao: 'Prensa dobradeira hidráulica com comando CNC Delem e compensação hidráulica.',
    status: 'Disponível',
  },
]

export const INITIAL_PROJECTS: Project[] = [
  {
    id: 'proj-01',
    nome: 'Modernização da Linha de Usinagem WEG',
    clienteId: 'cli-02',
    clienteNome: 'WEG Equipamentos Elétricos',
    status: 'Em Andamento',
    dataInicio: '2026-01-10',
    dataFim: '2026-08-30',
    orcamento: 2350000,
    descricao:
      'Instalação e integração de 3 centros de usinagem vertical Bener MCU-5X com robôs colaboradores.',
  },
  {
    id: 'proj-02',
    nome: 'Expansão de Corte Industrial Petrobras',
    clienteId: 'cli-01',
    clienteNome: 'Petrobras S.A.',
    status: 'Pendente',
    dataInicio: '2026-04-01',
    dataFim: '2026-12-15',
    orcamento: 3750000,
    descricao:
      'Célula automatizada de corte a laser de alta capacidade para tubulações de alta pressão.',
  },
]

export const INITIAL_PROPOSALS: Proposal[] = [
  {
    id: 'prop-1001',
    numero: 'PROP-2026-001',
    clienteId: 'cli-02',
    clienteNome: 'WEG Equipamentos Elétricos',
    projetoId: 'proj-01',
    projetoNome: 'Modernização da Linha de Usinagem WEG',
    tipo: 'Venda de Equipamento Novo',
    itens: [
      {
        id: 'pi-1',
        produtoId: 'prod-02',
        produtoNome: 'Centro de Usinagem Vertical 5 Eixos',
        quantidade: 2,
        precoUnitario: 890000,
        descontoPct: 5,
      },
    ],
    valorTotal: 1691000,
    status: 'Aprovada',
    validadeDias: 30,
    dataCriacao: '2026-02-01',
    observacoes: 'Incluso frete técnico, instalação e treinamento operacional para 10 técnicos.',
  },
  {
    id: 'prop-1002',
    numero: 'PROP-2026-002',
    clienteId: 'cli-01',
    clienteNome: 'Petrobras S.A.',
    projetoId: 'proj-02',
    projetoNome: 'Expansão de Corte Industrial Petrobras',
    tipo: 'Turnkey Industrial',
    itens: [
      {
        id: 'pi-2',
        produtoId: 'prod-03',
        produtoNome: 'Corte a Laser de Fibra Optica 12kW',
        quantidade: 2,
        precoUnitario: 1250000,
        descontoPct: 3,
      },
    ],
    valorTotal: 2425000,
    status: 'Em Análise',
    validadeDias: 45,
    dataCriacao: '2026-02-12',
    observacoes: 'Aguardando parecer da diretoria de engenharia Petrobras.',
  },
]

export const INITIAL_NOTIFICATIONS: AppNotification[] = [
  {
    id: 'notif-1',
    titulo: 'Proposta PROP-2026-001 Aprovada!',
    mensagem: 'A empresa WEG Equipamentos assinou e aprovou a proposta comercial.',
    data: '2026-02-14 10:30',
    lida: false,
    link: '/controle-propostas/propostas-criadas',
  },
  {
    id: 'notif-2',
    titulo: 'Alerta de Estoque Baixo',
    mensagem: 'O modelo "Corte a Laser 12kW" atingiu o limite crítico (2 unidades).',
    data: '2026-02-13 16:45',
    lida: false,
    link: '/produtos',
  },
  {
    id: 'notif-3',
    titulo: 'Manutenção Agendada',
    mensagem: 'Visita técnica de calibração confirmada na Embraer para amanhã às 09:00.',
    data: '2026-02-12 09:00',
    lida: true,
    link: '/eventos',
  },
]

export const INITIAL_EVENTS: CalendarEvent[] = [
  {
    id: 'evt-01',
    titulo: 'Calibração CNC - Embraer',
    descricao: 'Revisão semestral de calibração a laser e alinhamento do fuso.',
    dataInicio: '2026-02-18T09:00',
    dataFim: '2026-02-18T17:00',
    tipo: 'Manutenção',
    local: 'Planta Embraer - SJC',
  },
  {
    id: 'evt-02',
    titulo: 'Apresentação de Projeto Petrobras',
    descricao: 'Demostração técnica de capacidade de corte a laser de alta espessura.',
    dataInicio: '2026-02-22T14:00',
    dataFim: '2026-02-22T16:00',
    tipo: 'Reunião',
    local: 'Sede Petrobras - Rio de Janeiro',
  },
]

export const INITIAL_IMPORT_HISTORY: ImportHistory[] = [
  {
    id: 'imp-01',
    arquivo: 'catalogo_produtos_2026_q1.xlsx',
    data: '2026-02-01 08:30',
    linhas: 150,
    status: 'Concluído',
    usuario: 'Carlos Eduardo',
  },
  {
    id: 'imp-02',
    arquivo: 'clientes_base_sp.csv',
    data: '2026-01-20 14:15',
    linhas: 420,
    status: 'Concluído',
    usuario: 'Mariana Silva',
  },
]

export const INITIAL_AUDIT_LOGS: AuditLog[] = [
  {
    id: 'aud-01',
    acao: 'Criar Proposta',
    usuario: 'Carlos Eduardo',
    timestamp: '2026-02-12 10:14:22',
    detalhes: 'Gerou a proposta PROP-2026-002 no valor de R$ 2.425.000,00',
  },
  {
    id: 'aud-02',
    acao: 'Aprovar Proposta',
    usuario: 'Mariana Silva',
    timestamp: '2026-02-14 10:30:00',
    detalhes: 'Proposta PROP-2026-001 alterada para Aprovada',
  },
]

export const INITIAL_COVERAGE_AREAS: CoverageArea[] = [
  {
    id: 'cov-01',
    regiao: 'Grande São Paulo & ABC',
    cidades: ['São Paulo', 'Santo André', 'São Bernardo', 'Guarulhos'],
    tecnicosCount: 18,
    status: 'Ativa',
  },
  {
    id: 'cov-02',
    regiao: 'Campinas & Região Industrial',
    cidades: ['Campinas', 'Sorocaba', 'Piracicaba', 'Jundiaí'],
    tecnicosCount: 12,
    status: 'Ativa',
  },
  {
    id: 'cov-03',
    regiao: 'Vale do Paraíba',
    cidades: ['São José dos Campos', 'Taubaté', 'Jacareí'],
    tecnicosCount: 8,
    status: 'Ativa',
  },
  {
    id: 'cov-04',
    regiao: 'Polo Industrial Joinville/Jaraguá',
    cidades: ['Joinville', 'Jaraguá do Sul', 'Blumenau'],
    tecnicosCount: 10,
    status: 'Expansão',
  },
]

export const INITIAL_PRICE_HISTORY: ProductPriceHistory[] = [
  {
    id: 'ph-1',
    productId: 'prod-01',
    productName: 'Torno CNC Bener Heavy Duty V8',
    precoAntigo: 450000,
    precoNovo: 485000,
    motivo: 'Ajuste de custo de componentes importados e câmbio',
    data: '2026-01-10 11:00',
    usuario: 'Carlos Eduardo',
  },
]
