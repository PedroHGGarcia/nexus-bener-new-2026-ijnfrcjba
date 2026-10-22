import { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible'
import { ChevronDown, ChevronRight, Save, X } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'

export function PageLoading({ label = 'Carregando...' }: { label?: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {label}
        </span>
      </div>
    </div>
  )
}

interface PageLayoutProps {
  title: string
  description?: string
  children: ReactNode
  actions?: ReactNode
  className?: string
}
export function PageLayout({ title, description, children, actions, className }: PageLayoutProps) {
  return (
    <div className={cn('space-y-6', className)}>
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  )
}

interface SubMenuProps {
  icon?: ReactNode
  label: string
  items: { to: string; label: string }[]
  defaultOpen?: boolean
}
export function SidebarSubMenu({ icon, label, items, defaultOpen = false }: SubMenuProps) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center justify-between w-full px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-all">
        <div className="flex items-center gap-3">
          {icon}
          {label}
        </div>
        {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-1 mt-1">
        {items.map((item) => (
          <a
            key={item.to}
            href={item.to}
            className="flex items-center gap-2.5 px-3 py-1.5 rounded-md text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-all pl-9"
          >
            {item.label}
          </a>
        ))}
      </CollapsibleContent>
    </Collapsible>
  )
}

interface ActionBarProps {
  onSave: () => void
  onCancel: () => void
  saving?: boolean
  saveLabel?: string
  cancelLabel?: string
}
export function RegistrationActionBar({
  onSave,
  onCancel,
  saving,
  saveLabel = 'Salvar',
  cancelLabel = 'Cancelar',
}: ActionBarProps) {
  return (
    <div className="flex items-center gap-2 pt-4 border-t">
      <Button onClick={onSave} disabled={saving} className="bg-primary gap-2">
        <Save className="w-4 h-4" /> {saving ? 'Salvando...' : saveLabel}
      </Button>
      <Button variant="outline" onClick={onCancel} className="gap-2">
        <X className="w-4 h-4" /> {cancelLabel}
      </Button>
    </div>
  )
}
