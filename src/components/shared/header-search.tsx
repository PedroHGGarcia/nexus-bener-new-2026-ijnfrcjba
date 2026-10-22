import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from '@/components/ui/command'
import { Button } from '@/components/ui/button'
import {
  Search,
  LayoutDashboard,
  Users,
  FileSpreadsheet,
  Package,
  FolderKanban,
  Calendar,
  Settings,
  Bell,
} from 'lucide-react'

const PAGE_INDEX = [
  { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard },
  { label: 'Clientes', to: '/cadastros/clientes', icon: Users },
  { label: 'Representantes', to: '/cadastros/representantes', icon: Users },
  { label: 'Regiões', to: '/cadastros/regioes', icon: Users },
  { label: 'Gerentes', to: '/cadastros/gerentes', icon: Users },
  { label: 'Eventos', to: '/eventos', icon: Calendar },
  { label: 'Projetos', to: '/projetos', icon: FolderKanban },
  {
    label: 'Propostas Criadas',
    to: '/controle-propostas/propostas-criadas',
    icon: FileSpreadsheet,
  },
  { label: 'Emitir Proposta', to: '/controle-propostas/emitir-proposta', icon: FileSpreadsheet },
  { label: 'Dashboard Propostas', to: '/controle-propostas/dashboard', icon: FileSpreadsheet },
  { label: 'Produtos', to: '/produtos', icon: Package },
  { label: 'Versões', to: '/produtos/versoes', icon: Package },
  { label: 'Acessórios', to: '/produtos/acessorios', icon: Package },
  { label: 'Notificações', to: '/notificacoes', icon: Bell },
  { label: 'Configurações', to: '/configuracoes', icon: Settings },
  { label: 'Perfil', to: '/perfil', icon: Settings },
]

export function HeaderSearch() {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen((p) => !p)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  const go = useCallback(
    (to: string) => {
      navigate(to)
      setOpen(false)
    },
    [navigate],
  )

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="gap-2 w-full max-w-xs text-muted-foreground"
      >
        <Search className="w-4 h-4" /> <span className="hidden sm:inline">Buscar...</span>
        <kbd className="ml-auto hidden sm:inline-flex h-5 items-center gap-0.5 rounded border px-1.5 text-[10px] font-medium">
          ⌘K
        </kbd>
      </Button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Buscar páginas, ações..." />
        <CommandList>
          <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>
          <CommandGroup heading="Páginas">
            {PAGE_INDEX.map((page) => (
              <CommandItem key={page.to} value={page.label} onSelect={() => go(page.to)}>
                <page.icon className="w-4 h-4 mr-2 text-muted-foreground" />
                {page.label}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  )
}

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen((p) => !p)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  const go = (to: string) => {
    navigate(to)
    setOpen(false)
  }

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Digite para buscar..." />
      <CommandList>
        <CommandEmpty>Nenhum resultado.</CommandEmpty>
        <CommandGroup heading="Navegação Rápida">
          {PAGE_INDEX.map((page) => (
            <CommandItem key={page.to} value={page.label} onSelect={() => go(page.to)}>
              <page.icon className="w-4 h-4 mr-2 text-muted-foreground" />
              {page.label}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
