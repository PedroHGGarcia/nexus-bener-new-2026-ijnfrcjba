import { Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import benerLogo from '@/assets/systemlogo-large-092c5.png'

export default function Index() {
  const { isAuthenticated, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4 print:hidden">
        <div className="flex flex-col items-center gap-4 animate-fade-in">
          <img
            src={benerLogo}
            alt="Bener Máquinas"
            className="h-10 w-auto object-contain max-w-[180px] opacity-90"
          />
          <div className="flex items-center gap-2.5 text-muted-foreground text-xs font-medium tracking-wide">
            <div
              className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"
              role="status"
              aria-label="Carregando..."
            />
            <span>Carregando sessão...</span>
          </div>
        </div>
      </div>
    )
  }

  return <Navigate to={isAuthenticated ? '/dashboard' : '/login'} replace />
}
