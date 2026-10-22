import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import { useTheme } from '@/hooks/use-theme'
import { isAdminRole } from '@/components/RoleGuard'
import { supabase } from '@/lib/supabase/client'
import {
  fetchNotificacoes,
  markNotificacaoAsRead,
  markAllNotificacoesAsRead,
  type Notificacao,
} from '@/services/notificacoes'
import { NexusLogo } from '@/components/shared/branding'
import {
  Bell,
  Sun,
  Moon,
  Search,
  PanelLeft,
  Check,
  User,
  LogOut,
  Settings,
  ShieldAlert,
  Download,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { usePwaInstall } from '@/hooks/use-pwa-install'
import { InstallPwaDialog } from '@/components/pwa/InstallPwaDialog'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'

export function AppHeader({ onToggleMobileSidebar }: { onToggleMobileSidebar: () => void }) {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [notifications, setNotifications] = useState<Notificacao[]>([])
  const { theme, toggleTheme } = useTheme()
  const [searchOpen, setSearchOpen] = useState(false)
  const [globalSearch, setGlobalSearch] = useState('')
  const [installModalOpen, setInstallModalOpen] = useState(false)
  const { isInstallable, isInstalled } = usePwaInstall()

  const includeBroadcast = isAdminRole(user?.role)

  useEffect(() => {
    if (!user?.id) return
    fetchNotificacoes(user.id, includeBroadcast)
      .then(setNotifications)
      .catch(() => {})
    const channel = supabase
      .channel('notificacoes-header-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notificacoes' }, () => {
        fetchNotificacoes(user.id, includeBroadcast)
          .then(setNotifications)
          .catch(() => {})
      })
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [user?.id, includeBroadcast])

  const unreadCount = notifications.filter((n) => !n.lida).length
  const badgeDisplay = unreadCount > 9 ? '9+' : unreadCount > 0 ? `${unreadCount}` : '9+'

  const markAllRead = async () => {
    if (!user?.id) return
    await markAllNotificacoesAsRead(user.id, includeBroadcast)
    setNotifications((prev) => prev.map((n) => ({ ...n, lida: true })))
  }

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (globalSearch.trim()) {
      navigate(`/controle-propostas/propostas-criadas?q=${encodeURIComponent(globalSearch.trim())}`)
    }
  }

  return (
    <>
      <header className="h-20 sm:h-22 bg-[#0b3c26] text-white border-b border-[#082e1d] shrink-0 sticky top-0 z-10 px-3 md:px-5 shadow-xs flex items-center justify-between">
        {/* Left side: Mobile menu toggle + Global Search */}
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden text-white/90 hover:bg-white/10 hover:text-white rounded-md shrink-0"
            onClick={onToggleMobileSidebar}
            aria-label="Abrir menu"
          >
            <PanelLeft className="w-5 h-5 text-white/80" />
          </Button>

          {searchOpen ? (
            <form onSubmit={handleSearchSubmit} className="flex items-center">
              <Input
                type="search"
                placeholder="Buscar no sistema..."
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                onBlur={() => !globalSearch && setSearchOpen(false)}
                autoFocus
                className="h-8 w-40 md:w-64 bg-white/10 border-white/20 text-white placeholder:text-white/60 text-xs focus:ring-1 focus:ring-emerald-400 focus:bg-white/15 rounded-md"
              />
            </form>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSearchOpen(true)}
              className="text-white/90 hover:bg-white/10 hover:text-white rounded-md"
              aria-label="Buscar"
            >
              <Search className="w-5 h-5 text-white/80" />
            </Button>
          )}
        </div>

        {/* Center Branding Logo on mobile view when sidebar is hidden */}
        <div className="flex md:hidden items-center justify-center min-w-0">
          <Link
            to="/dashboard"
            className="flex items-center justify-center transition-transform hover:scale-105 py-1 px-1"
            title="Nexus - Ir para Dashboard"
          >
            <NexusLogo variant="header" />
          </Link>
        </div>

        {/* Right side controls */}
        <div className="flex items-center gap-2 md:gap-3">
          {/* Install PWA Button (Visível quando instalável para facilitar o acesso de representantes) */}
          {!isInstalled && isInstallable && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setInstallModalOpen(true)}
              className="hidden sm:inline-flex items-center gap-1.5 h-8 px-2.5 rounded-full bg-white/15 hover:bg-white/25 text-white text-xs font-medium border border-white/20 transition-all shadow-xs"
              title="Instalar Nexus no seu aparelho"
            >
              <Download className="w-3.5 h-3.5 text-emerald-300" />
              <span>Instalar App</span>
            </Button>
          )}

          {/* Theme Toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="text-white/90 hover:bg-white/10 hover:text-white rounded-full"
            aria-label="Alternar tema"
          >
            {theme === 'dark' ? (
              <Sun className="w-5 h-5 text-amber-300" />
            ) : (
              <Moon className="w-5 h-5 text-white/80" />
            )}
          </Button>

          {/* Notifications */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="relative text-white/90 hover:bg-white/10 hover:text-white rounded-full"
                aria-label="Notificações"
              >
                <Bell className="w-5 h-5 text-white/80" />
                <Badge className="absolute -top-1 -right-1 h-5 min-w-5 px-1 rounded-full p-0 flex items-center justify-center bg-red-600 text-white font-bold text-[10px] border-2 border-[#0b3c26]">
                  {badgeDisplay}
                </Badge>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 p-0 text-foreground">
              <div className="flex items-center justify-between p-3 border-b border-border bg-muted/40">
                <span className="font-semibold text-sm">Notificações</span>
                {unreadCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={markAllRead}
                    className="text-xs h-7 gap-1 text-[#0b3c26] dark:text-emerald-400"
                  >
                    <Check className="w-3 h-3" /> Marcar lidas
                  </Button>
                )}
              </div>
              <div className="max-h-72 overflow-y-auto divide-y divide-border">
                {notifications.length === 0 ? (
                  <div className="p-4 text-center text-xs text-muted-foreground">
                    Sem notificações no momento
                  </div>
                ) : (
                  notifications.slice(0, 5).map((n) => (
                    <div
                      key={n.id}
                      className={`p-3 text-xs cursor-pointer hover:bg-accent/50 transition-colors ${!n.lida ? 'bg-primary/5 font-medium' : ''}`}
                      onClick={() => {
                        if (!n.lida) {
                          markNotificacaoAsRead(n.id).catch(() => {})
                          setNotifications((prev) =>
                            prev.map((x) => (x.id === n.id ? { ...x, lida: true } : x)),
                          )
                        }
                        const linkMap: Record<string, string> = {
                          proposta: '/controle-propostas/propostas-criadas',
                          projeto: '/projetos',
                          cliente: '/cadastros/clientes',
                        }
                        const link = n.tipo ? linkMap[n.tipo] : undefined
                        if (link) navigate(link)
                      }}
                    >
                      <div className="flex items-center gap-1.5 mb-0.5">
                        {n.tipo === 'critical_action' && (
                          <ShieldAlert className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        )}
                        <span className="font-semibold text-foreground">{n.titulo}</span>
                      </div>
                      <div className="text-muted-foreground line-clamp-2">{n.mensagem ?? ''}</div>
                      <div className="text-[10px] text-muted-foreground/70 mt-1">
                        {new Date(n.created_at).toLocaleString('pt-BR')}
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="p-2 border-t border-border text-center">
                <Link
                  to="/notificacoes"
                  className="text-xs font-semibold text-[#0b3c26] dark:text-emerald-400 hover:underline"
                >
                  Ver todas as notificações
                </Link>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* User Profile Avatar */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="text-white/90 hover:bg-white/10 hover:text-white rounded-full p-0.5"
                aria-label="Perfil de usuário"
              >
                <Avatar className="w-8 h-8 border border-white/20">
                  <AvatarImage src={user?.avatarUrl} />
                  <AvatarFallback className="bg-white/15 text-white font-bold text-xs">
                    <User className="w-4 h-4 text-white/80" />
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 text-foreground">
              <DropdownMenuLabel>
                <div className="flex flex-col">
                  <span className="font-semibold text-sm">{user?.name || 'Usuário Bener'}</span>
                  <span className="text-xs text-muted-foreground">{user?.email}</span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate('/perfil')}>
                <User className="w-4 h-4 mr-2" /> Meu Perfil
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate('/configuracoes')}>
                <Settings className="w-4 h-4 mr-2" /> Configurações
              </DropdownMenuItem>
              {!isInstalled && (
                <DropdownMenuItem
                  onClick={() => setInstallModalOpen(true)}
                  className="text-emerald-700 dark:text-emerald-400 font-medium"
                >
                  <Download className="w-4 h-4 mr-2 text-emerald-600 dark:text-emerald-400" />
                  Instalar aplicativo
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleSignOut}
                className="text-destructive focus:text-destructive"
              >
                <LogOut className="w-4 h-4 mr-2" /> Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
      <InstallPwaDialog open={installModalOpen} onOpenChange={setInstallModalOpen} />
    </>
  )
}
