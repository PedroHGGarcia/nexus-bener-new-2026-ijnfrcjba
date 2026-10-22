import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'

interface MapFullscreenOverlayProps {
  open: boolean
  onClose: () => void
  src: string
  title: string
}

export function MapFullscreenOverlay({ open, onClose, src, title }: MapFullscreenOverlayProps) {
  useEffect(() => {
    if (!open) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex flex-col animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label={`Mapa em tela cheia: ${title}`}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h2 className="text-sm font-semibold text-foreground truncate">{title}</h2>
        <Button
          variant="outline"
          size="sm"
          onClick={onClose}
          className="gap-1.5"
          aria-label="Fechar mapa em tela cheia"
        >
          <X className="w-4 h-4" />
          Fechar
        </Button>
      </div>
      <div className="flex-1 relative overflow-auto">
        <iframe
          src={src}
          title={title}
          className="w-full h-full min-h-[60vh]"
          style={{ border: 0 }}
          loading="lazy"
          allowFullScreen
        />
      </div>
    </div>
  )
}
