import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { AlertTriangle, FolderOpen, RefreshCw } from 'lucide-react'

export function LoadingState({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-4 w-full animate-fade-in">
      <Skeleton className="h-10 w-full rounded-md" />
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex gap-4 items-center">
          <Skeleton className="h-12 w-full rounded-md" />
        </div>
      ))}
    </div>
  )
}

export function EmptyState({
  title = 'Nenhum registro encontrado',
  description = 'Não encontramos dados cadastrados nesta categoria até o momento.',
  actionText,
  onAction,
}: {
  title?: string
  description?: string
  actionText?: string
  onAction?: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center bg-card rounded-lg border border-dashed border-border my-4 animate-fade-in">
      <div className="w-16 h-16 rounded-full bg-accent flex items-center justify-center text-primary mb-4">
        <FolderOpen className="w-8 h-8" />
      </div>
      <h3 className="text-lg font-semibold mb-1 text-foreground">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-sm mb-6">{description}</p>
      {actionText && onAction && (
        <Button onClick={onAction} className="bg-primary hover:bg-primary/90">
          {actionText}
        </Button>
      )}
    </div>
  )
}

export function ErrorState({
  message = 'Ocorreu um erro ao carregar as informações do servidor.',
  onRetry,
}: {
  message?: string
  onRetry?: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center bg-destructive/10 rounded-lg border border-destructive/20 my-4 animate-fade-in">
      <div className="w-12 h-12 rounded-full bg-destructive/20 flex items-center justify-center text-destructive mb-3">
        <AlertTriangle className="w-6 h-6" />
      </div>
      <h3 className="text-base font-semibold text-foreground mb-1">Erro ao carregar dados</h3>
      <p className="text-sm text-muted-foreground max-w-sm mb-4">{message}</p>
      {onRetry && (
        <Button onClick={onRetry} variant="outline" size="sm" className="gap-2">
          <RefreshCw className="w-4 h-4" /> Tentar novamente
        </Button>
      )}
    </div>
  )
}
