import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Download, Share2, PlusSquare, Smartphone, Laptop, CheckCircle2 } from 'lucide-react'
import { usePwaInstall } from '@/hooks/use-pwa-install'

interface InstallPwaDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function InstallPwaDialog({ open, onOpenChange }: InstallPwaDialogProps) {
  const { isIOS, canPromptDirectly, installApp, isInstalled } = usePwaInstall()
  const [installing, setInstalling] = useState(false)

  const handleInstallClick = async () => {
    if (canPromptDirectly) {
      setInstalling(true)
      try {
        const outcome = await installApp()
        if (outcome === 'accepted') {
          onOpenChange(false)
        }
      } finally {
        setInstalling(false)
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card text-foreground border border-border shadow-xl">
        <DialogHeader className="text-left space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-[#0b3c26] flex items-center justify-center text-white shrink-0 shadow-md">
              <Download className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-foreground">
                Instalar Bener Nexus
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Acesse o sistema diretamente da tela inicial do seu celular ou desktop, com abertura
                rápida e em tela cheia.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {isInstalled ? (
          <div className="py-4 space-y-3 text-center">
            <div className="inline-flex p-3 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <p className="text-sm font-semibold text-foreground">
              O aplicativo já está instalado no seu dispositivo!
            </p>
            <p className="text-xs text-muted-foreground">
              Você pode abri-lo pelo ícone na tela inicial ou lista de aplicativos.
            </p>
          </div>
        ) : isIOS ? (
          // Instruções específicas para iOS (Safari não tem evento de instalação automático)
          <div className="py-2 space-y-3">
            <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl space-y-2.5 text-xs text-foreground">
              <div className="font-semibold text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                Como instalar no iPhone ou iPad (Safari):
              </div>
              <ol className="space-y-2 pl-1 list-none text-muted-foreground">
                <li className="flex items-start gap-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#0b3c26] text-white text-[11px] font-bold">
                    1
                  </span>
                  <span>
                    Toque no botão{' '}
                    <strong className="text-foreground inline-flex items-center gap-1 font-semibold">
                      <Share2 className="w-3.5 h-3.5 text-blue-500 inline" /> Compartilhar
                    </strong>{' '}
                    na barra inferior do Safari.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#0b3c26] text-white text-[11px] font-bold">
                    2
                  </span>
                  <span>
                    Role para baixo e selecione{' '}
                    <strong className="text-foreground inline-flex items-center gap-1 font-semibold">
                      <PlusSquare className="w-3.5 h-3.5 text-foreground inline" /> Adicionar à Tela
                      de Início
                    </strong>
                    .
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#0b3c26] text-white text-[11px] font-bold">
                    3
                  </span>
                  <span>
                    Toque em <strong className="text-foreground font-semibold">Adicionar</strong> no
                    canto superior direito. Pronto!
                  </span>
                </li>
              </ol>
            </div>
            <p className="text-[11px] text-muted-foreground text-center">
              Recomendamos abrir pelo Safari no iPhone para melhor compatibilidade.
            </p>
          </div>
        ) : (
          // Android ou Desktop (Chrome/Edge/Brave)
          <div className="py-2 space-y-3">
            <div className="p-3.5 bg-muted/60 border border-border rounded-xl space-y-2 text-xs">
              <div className="flex items-center gap-2 font-semibold text-foreground">
                <Laptop className="w-4 h-4 text-[#0b3c26] dark:text-emerald-400" />
                Vantagens do aplicativo instalado:
              </div>
              <ul className="space-y-1.5 text-muted-foreground list-disc pl-4">
                <li>Acesso com 1 clique pela tela inicial ou menu iniciar</li>
                <li>Visual limpo em tela cheia, sem barra de navegação do browser</li>
                <li>Carregamento otimizado de recursos visuais e dados operacionais</li>
              </ul>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="text-xs">
            {isInstalled ? 'Fechar' : 'Agora não'}
          </Button>

          {!isInstalled && canPromptDirectly && (
            <Button
              onClick={handleInstallClick}
              disabled={installing}
              className="bg-[#0b3c26] hover:bg-[#0b3c26]/90 text-white font-semibold text-xs gap-1.5"
            >
              <Download className="w-4 h-4" />
              {installing ? 'Instalando...' : 'Instalar aplicativo agora'}
            </Button>
          )}

          {!isInstalled && isIOS && (
            <Button
              onClick={() => onOpenChange(false)}
              className="bg-[#0b3c26] hover:bg-[#0b3c26]/90 text-white font-semibold text-xs"
            >
              Entendido
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
