export interface MenuItemDef {
  key: string
  label: string
  path: string
  icon?: string
  children?: MenuItemDef[]
}

export const MENU_ITEMS: MenuItemDef[] = [
  { key: 'dashboard', label: 'Dashboard', path: '/dashboard' },
  {
    key: 'cadastros',
    label: 'Cadastros',
    path: '/cadastros',
    children: [
      { key: 'cadastros.clientes', label: 'Clientes', path: '/cadastros/clientes' },
      {
        key: 'cadastros.representantes',
        label: 'Representantes',
        path: '/cadastros/representantes',
      },
      { key: 'cadastros.regioes', label: 'Regiões', path: '/cadastros/regioes' },
      { key: 'cadastros.gerentes', label: 'Gerentes', path: '/cadastros/gerentes' },
      { key: 'cadastros.prepostos', label: 'Prepostos', path: '/cadastros/prepostos' },
    ],
  },
  { key: 'eventos', label: 'Eventos', path: '/eventos' },
  { key: 'projetos', label: 'Projetos', path: '/projetos' },
  {
    key: 'controle-propostas',
    label: 'Controle de Propostas',
    path: '/controle-propostas',
    children: [
      {
        key: 'controle-propostas.criadas',
        label: 'Propostas Criadas',
        path: '/controle-propostas/propostas-criadas',
      },
      {
        key: 'controle-propostas.emitir',
        label: 'Emitir Proposta',
        path: '/controle-propostas/emitir-proposta',
      },
      {
        key: 'controle-propostas.dashboard',
        label: 'Dashboard',
        path: '/controle-propostas/dashboard',
      },
      {
        key: 'controle-propostas.avancadas',
        label: 'Propostas Avançadas',
        path: '/controle-propostas/propostas-avancadas',
      },
      {
        key: 'controle-propostas.tipos',
        label: 'Tipos de Propostas',
        path: '/controle-propostas/tipos-propostas',
      },
    ],
  },
  {
    key: 'produtos',
    label: 'Produtos',
    path: '/produtos',
    children: [
      { key: 'produtos.list', label: 'Lista de Versões', path: '/produtos' },
      {
        key: 'produtos.gestao-maquinas',
        label: 'Gestão de Máquinas',
        path: '/produtos/gestao-maquinas',
      },
      { key: 'produtos.precos', label: 'Alterar Preços', path: '/produtos/alterar-precos' },
      { key: 'produtos.dashboard', label: 'Dashboard', path: '/produtos/dashboard' },
      { key: 'produtos.acessorios', label: 'Acessórios', path: '/produtos/acessorios' },
      {
        key: 'produtos.historico',
        label: 'Histórico de Modificações',
        path: '/produtos/historico-alteracoes',
      },
    ],
  },
  { key: 'notificacoes', label: 'Notificações', path: '/notificacoes' },
  { key: 'area-atuacao', label: 'Área de Atuação', path: '/area-atuacao' },
  { key: 'perfil', label: 'Perfil', path: '/perfil' },
  { key: 'usuarios', label: 'Usuários', path: '/usuarios' },
  { key: 'auditoria', label: 'Auditoria', path: '/auditoria' },
  { key: 'configuracoes', label: 'Configurações', path: '/configuracoes' },
]

export const FORBIDDEN_REP_VENDEDOR_MENU_KEYS = [
  'area-atuacao',
  'controle-propostas.emitir-licitacao',
  'propostas-emitir-licitacao',
  'controle-propostas.tipos',
  'propostas-tipos',
  'produtos.gestao-maquinas',
  'produtos-gestao-maquinas',
  'produtos-categorias',
  'produtos-marcas',
  'produtos-modelos',
  'produtos-versoes',
  'produtos.precos',
  'produtos-precos',
]

/** Normaliza uma chave de menu gerando aliases de separador (ponto <-> hífen) e equivalências de catálogo */
export function normalizeMenuKeyVariants(key: string): string[] {
  const variants = new Set<string>()
  if (!key) return []
  variants.add(key)
  variants.add(key.replace(/\./g, '-'))
  variants.add(key.replace(/-/g, '.'))

  // Mapeamentos específicos entre nomes de catálogo e IDs de rota
  if (key === 'produtos.list' || key === 'produtos-list') {
    variants.add('produtos-lista')
    variants.add('produtos.lista')
    variants.add('produtos-versoes')
    variants.add('produtos.versoes')
  } else if (key === 'produtos-lista' || key === 'produtos.lista') {
    variants.add('produtos.list')
    variants.add('produtos-list')
  }

  return Array.from(variants)
}

export function hasMenuAccess(
  menuAccess: string[] | undefined,
  key: string,
  userRole?: string,
): boolean {
  if (
    userRole &&
    (userRole.toLowerCase().includes('admin') || userRole.toLowerCase() === 'administrador')
  ) {
    return true
  }
  if (!menuAccess || menuAccess.length === 0) return true
  if (menuAccess.includes('*')) return true

  // Cria conjunto com chaves existentes + variantes normalizadas
  const allowedSet = new Set<string>()
  for (const item of menuAccess) {
    normalizeMenuKeyVariants(item).forEach((v) => allowedSet.add(v))
  }

  const keyVariants = normalizeMenuKeyVariants(key)
  for (const variant of keyVariants) {
    if (allowedSet.has(variant)) return true

    // Fallback de prefixos tanto com ponto quanto com hífen
    const dotParts = variant.split('.')
    for (let i = dotParts.length - 1; i > 0; i--) {
      const prefix = dotParts.slice(0, i).join('.')
      if (allowedSet.has(prefix)) return true
    }

    const hyphenParts = variant.split('-')
    for (let i = hyphenParts.length - 1; i > 0; i--) {
      const prefix = hyphenParts.slice(0, i).join('-')
      if (allowedSet.has(prefix)) return true
    }
  }

  return false
}

export function getAccessibleMenus(menuAccess: string[] | undefined): MenuItemDef[] {
  if (!menuAccess || menuAccess.length === 0 || menuAccess.includes('*')) {
    return MENU_ITEMS
  }
  return MENU_ITEMS.filter((item) => {
    if (hasMenuAccess(menuAccess, item.key)) return true
    if (item.children) {
      return item.children.some((child) => hasMenuAccess(menuAccess, child.key))
    }
    return false
  }).map((item) => ({
    ...item,
    children: item.children?.filter((child) => hasMenuAccess(menuAccess, child.key)),
  }))
}

export function getDefaultMenuAccess(role: string): string[] {
  if (role === 'Admin Completo' || role === 'admin') return ['*']
  if (role === 'Gerente' || role === 'gerente') {
    return [
      'dashboard',
      'cadastros',
      'cadastros.clientes',
      'cadastros.representantes',
      'projetos',
      'controle-propostas',
      'controle-propostas.criadas',
      'controle-propostas.emitir',
      'controle-propostas.dashboard',
      'produtos',
      'notificacoes',
      'perfil',
      'meus-vendedores',
    ]
  }
  return ['dashboard', 'controle-propostas.criadas', 'notificacoes', 'perfil']
}
