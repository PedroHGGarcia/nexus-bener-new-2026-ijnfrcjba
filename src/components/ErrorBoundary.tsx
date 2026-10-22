import { Component, ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { AlertTriangle } from 'lucide-react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  handleRetry = () => {
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center text-destructive mb-4">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h1 className="text-xl font-bold text-foreground mb-2 text-center">
            Ocorreu um erro inesperado
          </h1>
          <p className="text-sm text-muted-foreground text-center max-w-sm">
            Não foi possível carregar esta página. Verifique sua conexão e tente novamente.
          </p>
          <Button onClick={this.handleRetry} className="mt-4 btn-bener">
            Tentar novamente
          </Button>
        </div>
      )
    }
    return this.props.children
  }
}
