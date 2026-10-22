import { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { ArrowRight, AlertTriangle, RefreshCw, FolderOpen } from 'lucide-react'

interface DashboardWidgetProps {
  icon: ReactNode
  title: string
  linkTo: string
  loading: boolean
  error: boolean
  isEmpty: boolean
  onRetry: () => void
  children: ReactNode
}

export function DashboardWidget({
  icon,
  title,
  linkTo,
  loading,
  error,
  isEmpty,
  onRetry,
  children,
}: DashboardWidgetProps) {
  return (
    <Card className="flex flex-col h-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="text-sm font-semibold">{title}</h3>
        </div>
        <Link
          to={linkTo}
          className="text-xs text-primary font-medium hover:underline flex items-center gap-1"
        >
          Ver mais <ArrowRight className="w-3 h-3" />
        </Link>
      </CardHeader>
      <CardContent className="flex-1">
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-7 w-full" />
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-5 w-1/2" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-5 text-center">
            <AlertTriangle className="w-5 h-5 text-destructive mb-2" />
            <p className="text-xs text-muted-foreground mb-3">Erro ao carregar dados</p>
            <Button onClick={onRetry} variant="outline" size="sm" className="gap-1.5">
              <RefreshCw className="w-3 h-3" /> Tentar novamente
            </Button>
          </div>
        ) : isEmpty ? (
          <div className="flex flex-col items-center justify-center py-5 text-center">
            <FolderOpen className="w-7 h-7 text-muted-foreground/50 mb-2" />
            <p className="text-xs text-muted-foreground">Nenhum registro encontrado</p>
          </div>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  )
}
