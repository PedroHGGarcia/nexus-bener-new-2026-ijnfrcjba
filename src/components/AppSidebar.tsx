import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/use-auth'
import { isAdminRole, isRepresentanteRole } from '@/components/RoleGuard'
import { NexusLogo } from '@/components/shared/branding'
import {
  Monitor,
  Folder,
  Calendar,
  FolderKanban,
  FileText,
  Package,
  User,
  Map,
  Users,
  Activity,
  LogOut,
  ChevronDown,
  ChevronRight,
  Download,
  LayoutDashboard,
  FilePlus,
  Gavel,
  Files,
  Search,
  Layers,
  Bot,
} from 'lucide-react'
// Diagnostic test edit
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { usePwaInstall } from '@/hooks/use-pwa-install'
import { InstallPwaDialog } from '@/components/pwa/InstallPwaDialog'

interface NavChild {
  key: string
  label: string
  path: string
  icon?: React.ComponentType<{ className?: string }>
  adminOnly?: boolean
  hideForVendedores?: boolean
}

interface NavSection {
  key: string
  label: string
  path?: string
  icon: React.ComponentType<{ className?: string }>
  adminOnly?: boolean
  hideForVendedores?: boolean
  children?: NavChild[]
}

const SECTIONS: NavSection[] = [
  { key: 'dashboard', label: 'Painel Principal', path: '/dashboard', icon: Monitor },
  {
    key: 'cadastros',
    label: 'Cadastros',
    icon: Folder,
    children: [
      { key: 'cadastros.clientes', label: 'Clientes', path: '/cadastros/clientes' },
      {
        key: 'cadastros.representantes',
        label: 'Representantes',
        path: '/cadastros/representantes',
        hideForVendedores: true,
      },
      {
        key: 'cadastros.regioes',
        label: 'Regiões',
        path: '/cadastros/regioes',
        hideForVendedores: true,
      },
      {
        key: 'cadastros.gerentes',
        label: 'Gerentes',
        path: '/cadastros/gerentes',
        hideForVendedores: true,
      },
      {
        key: 'cadastros.prepostos',
        label: 'Prepostos',
        path: '/cadastros/prepostos',
        hideForVendedores: true,
      },
    ],
  },
  {
    key: 'eventos',
    label: 'Controle de Eventos',
    icon: Calendar,
    children: [{ key: 'eventos.lista', label: 'Lista de Eventos', path: '/eventos' }],
  },
  { key: 'projetos', label: 'Projetos', path: '/projetos', icon: FolderKanban },
  {
    key: 'controle-propostas',
    label: 'Controle de Propostas',
    icon: FileText,
    children: [
      {
        key: 'controle-propostas.dashboard',
        label: 'Dashboard Propostas',
        path: '/controle-propostas/dashboard',
        icon: LayoutDashboard,
      },
      {
        key: 'controle-propostas.emitir',
        label: 'Emitir Nova Proposta',
        path: '/controle-propostas/emitir-proposta',
        icon: FilePlus,
      },
      {
        key: 'controle-propostas.emitir-licitacao',
        label: 'Emitir Licitação',
        path: '/controle-propostas/emitir-licitacao',
        hideForVendedores: true,
        icon: Gavel,
      },
      {
        key: 'controle-propostas.criadas',
        label: 'Propostas Criadas',
        path: '/controle-propostas/propostas-criadas',
        icon: Files,
      },
      {
        key: 'controle-propostas.avancadas',
        label: 'Busca Avançada',
        path: '/controle-propostas/propostas-avancadas',
        icon: Search,
      },
      {
        key: 'controle-propostas.tipos',
        label: 'Tipos de Propostas',
        path: '/controle-propostas/tipos-propostas',
        hideForVendedores: true,
        icon: Layers,
      },
    ],
  },
  {
    key: 'produtos',
    label: 'Controle de Produtos',
    icon: Package,
    children: [
      {
        key: 'produtos.gestao-maquinas',
        label: 'Gestão de Máquinas',
        path: '/produtos/gestao-maquinas',
        hideForVendedores: true,
      },
      { key: 'produtos.list', label: 'Lista de Versões', path: '/produtos' },
      { key: 'produtos.dashboard', label: 'Dashboard Produtos', path: '/produtos/dashboard' },
      {
        key: 'produtos.precos',
        label: 'Alterar Preços',
        path: '/produtos/alterar-precos',
        hideForVendedores: true,
      },
      { key: 'produtos.acessorios', label: 'Acessórios', path: '/produtos/acessorios' },
      {
        key: 'produtos.historico',
        label: 'Histórico de Modificações',
        path: '/produtos/historico-alteracoes',
        adminOnly: true,
      },
    ],
  },
  { key: 'perfil', label: 'Perfil', path: '/perfil', icon: User },
  { key: 'meus-vendedores', label: 'Meus Vendedores', path: '/meus-vendedores', icon: Users },
  {
    key: 'area-atuacao',
    label: 'Área de Atuação de Represe...',
    path: '/area-atuacao',
    icon: Map,
    hideForVendedores: true,
  },
  { key: 'usuarios', label: 'Usuários', path: '/usuarios', icon: Users, adminOnly: true },
  {
    key: 'auditoria',
    label: 'Logs de Auditoria',
    path: '/auditoria',
    icon: Activity,
    adminOnly: true,
  },
  {
    key: 'admin.chatbot',
    label: 'Conversas Chatbot IA',
    path: '/admin/chatbot-conversas',
    icon: Bot,
    adminOnly: true,
  },
]

export function AppSidebar({ onCloseMobile }: { onCloseMobile?: () => void }) {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [installModalOpen, setInstallModalOpen] = useState(false)
  const { isInstallable, isInstalled } = usePwaInstall()
  const menuAccess = user?.menuAccess ?? []
  const adminRole = isAdminRole(user?.role)
  const isVendedor = isRepresentanteRole(user?.role)
  const [open, setOpen] = useState<Record<string, boolean>>({
    cadastros: false,
    eventos: false,
    'controle-propostas': false,
    produtos: false,
  })

  const hasAccess = (key: string): boolean => {
    // REGRA PRIMÁRIA: usuário com papel admin tem acesso a TUDO — o filtro por menu_access é ignorado.
    if (adminRole) return true

    if (!menuAccess.length || menuAccess.includes('*')) return true

    // NORMALIZAÇÃO de chaves para os demais papéis:
    // Compara tanto com pontos quanto com hífens ('controle-propostas.emitir' <-> 'controle-propostas-emitir')
    // e inclui equivalência para 'produtos.list' <-> 'produtos-lista'.
    const allowed = new Set<string>()
    for (const item of menuAccess) {
      allowed.add(item)
      allowed.add(item.replace(/\./g, '-'))
      allowed.add(item.replace(/-/g, '.'))
      if (item === 'produtos-lista' || item === 'produtos.lista') {
        allowed.add('produtos.list')
        allowed.add('produtos-list')
        allowed.add('produtos-versoes')
        allowed.add('produtos.versoes')
      }
    }

    const testVariants = [
      key,
      key.replace(/\./g, '-'),
      key.replace(/-/g, '.'),
      ...(key === 'produtos.list' || key === 'produtos-list'
        ? ['produtos-lista', 'produtos.lista', 'produtos-versoes', 'produtos.versoes']
        : []),
    ]

    for (const variant of testVariants) {
      if (allowed.has(variant)) return true

      // Fallback de prefixos com ponto (ex.: 'cadastros.clientes' -> 'cadastros')
      const dotParts = variant.split('.')
      for (let i = dotParts.length - 1; i > 0; i--) {
        if (allowed.has(dotParts.slice(0, i).join('.'))) return true
      }

      // Fallback de prefixos com hífen (ex.: 'controle-propostas-emitir' -> 'controle-propostas')
      const hyphenParts = variant.split('-')
      for (let i = hyphenParts.length - 1; i > 0; i--) {
        if (allowed.has(hyphenParts.slice(0, i).join('-'))) return true
      }
    }

    return false
  }

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const navClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      'flex items-center gap-3 px-3.5 py-2 rounded-md text-sm font-medium transition-all duration-150 text-white/90 hover:bg-white/10 hover:text-white',
      isActive && 'bg-[#062417] text-white font-semibold shadow-inner',
    )

  const subClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      'flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-medium transition-all duration-150 text-white/80 hover:bg-white/10 hover:text-white pl-9',
      isActive && 'bg-[#041a0e] text-white font-semibold',
    )

  return (
    <>
      <aside className="w-60 bg-[#0b3c26] text-white h-full flex flex-col select-none border-r border-[#082e1d] overflow-hidden">
        {/* Brand Header: altura exata do AppHeader (h-20 sm:h-22) com border-b alinhada */}
        <div className="h-20 sm:h-22 shrink-0 px-2.5 flex items-center justify-center border-b border-white/15">
          <NavLink
            to="/dashboard"
            onClick={onCloseMobile}
            className="flex items-center justify-center hover:bg-white/5 rounded-md transition-all w-full py-1 px-1"
            title="Nexus - Ir para Dashboard"
          >
            <NexusLogo variant="sidebar" />
          </NavLink>
        </div>

        {/* Scrollable Container (Nav + Footer) */}
        <div className="flex-1 min-h-0 flex flex-col px-2.5 pt-2 pb-4 overflow-y-auto scrollbar-hide">
          {/* Navigation list */}
          <nav className="space-y-0.5 flex-1">
            {SECTIONS.filter((s) =>
              s.children
                ? hasAccess(s.key) || s.children.some((c) => hasAccess(c.key))
                : hasAccess(s.key),
            )
              .filter((section) => {
                if (section.hideForVendedores && isVendedor) {
                  return false
                }
                if (section.key === 'usuarios' || section.key === 'auditoria') {
                  return adminRole
                }
                if (section.key === 'meus-vendedores') {
                  return adminRole || user?.role === 'Gerente' || user?.role === 'gerente'
                }
                if (section.children) {
                  const visibleChildren = section.children.filter((c) => {
                    if (c.hideForVendedores && isVendedor) return false
                    if (c.adminOnly && !adminRole) return false
                    return hasAccess(c.key)
                  })
                  return visibleChildren.length > 0
                }
                return hasAccess(section.key)
              })
              .map((section) => {
                const SectionIcon = section.icon
                if (!section.children) {
                  return (
                    <NavLink
                      key={section.key}
                      to={section.path!}
                      onClick={onCloseMobile}
                      className={navClass}
                      end
                    >
                      <SectionIcon className="w-4 h-4 shrink-0 text-white/90" />
                      <span className="truncate flex-1">{section.label}</span>
                      {section.adminOnly && (
                        <span className="text-[10px] font-bold tracking-wider uppercase px-1.5 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-500/30 shrink-0">
                          Admin
                        </span>
                      )}
                    </NavLink>
                  )
                }
                return (
                  <Collapsible
                    key={section.key}
                    open={open[section.key] ?? false}
                    onOpenChange={(v) => setOpen((p) => ({ ...p, [section.key]: v }))}
                  >
                    <CollapsibleTrigger className="flex items-center justify-between w-full px-3.5 py-2 rounded-md text-sm font-medium text-white/90 hover:bg-white/10 transition-all">
                      <div className="flex items-center gap-3 truncate">
                        <SectionIcon className="w-4 h-4 shrink-0 text-white/90" />
                        <span className="truncate">{section.label}</span>
                      </div>
                      {open[section.key] ? (
                        <ChevronDown className="w-3.5 h-3.5 text-white/70 shrink-0" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5 text-white/70 shrink-0" />
                      )}
                    </CollapsibleTrigger>
                    <CollapsibleContent className="space-y-0.5 my-1">
                      {section.children
                        .filter((c) => hasAccess(c.key))
                        .filter((c) => !c.adminOnly || adminRole)
                        .filter((c) => !c.hideForVendedores || !isVendedor)
                        .map((child) => {
                          const ChildIcon = child.icon
                          return (
                            <NavLink
                              key={child.key}
                              to={child.path}
                              onClick={onCloseMobile}
                              className={subClass}
                              end
                            >
                              {ChildIcon && (
                                <ChildIcon className="w-3.5 h-3.5 shrink-0 text-white/70" />
                              )}
                              <span className="truncate flex-1">{child.label}</span>
                              {child.adminOnly && (
                                <span className="text-[9px] font-bold uppercase px-1 py-0.2 rounded bg-emerald-950/70 text-emerald-300 border border-emerald-500/30 shrink-0">
                                  Admin
                                </span>
                              )}
                            </NavLink>
                          )
                        })}{' '}
                    </CollapsibleContent>
                  </Collapsible>
                )
              })}
          </nav>

          {/* Sair & Instalar PWA Pinned at Bottom */}
          <div className="pt-3 border-t border-white/10 mt-auto space-y-1">
            {!isInstalled && isInstallable && (
              <button
                onClick={() => {
                  setInstallModalOpen(true)
                  onCloseMobile?.()
                }}
                className="flex items-center gap-3 w-full px-3.5 py-2 rounded-md text-sm font-medium text-emerald-300 hover:bg-white/10 transition-colors text-left group"
              >
                <Download className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
                <span className="font-semibold">Instalar aplicativo</span>
              </button>
            )}

            <button
              onClick={handleSignOut}
              className="flex items-center gap-3 w-full px-3.5 py-2 rounded-md text-sm font-medium text-white/90 hover:bg-white/10 transition-colors text-left"
            >
              <LogOut className="w-4 h-4 text-white/90" />
              <span>Sair</span>
            </button>
          </div>
        </div>
      </aside>
      <InstallPwaDialog open={installModalOpen} onOpenChange={setInstallModalOpen} />
    </>
  )
}
