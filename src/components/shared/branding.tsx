import { Button } from '@/components/ui/button'
import { Sun, Moon } from 'lucide-react'
import { useTheme } from '@/hooks/use-theme'
import { cn } from '@/lib/utils'
import nexusLogoImg from '@/assets/logo-nexus2-fd16a.png'

/**
 * Fonte única de imagem para a logo do topo do sistema.
 * Aponta para o wordmark oficial NEXUS transparente enviado pela usuária,
 * repousando direto sobre o fundo verde corporativo #0b3c26 do topo.
 */
export const TOP_BRAND_LOGO_SRC: string | null = nexusLogoImg

interface BrandLogoProps {
  className?: string
  variant?: 'sidebar' | 'header' | 'default'
  light?: boolean
}

export function NexusLogo({ className, variant = 'default' }: BrandLogoProps) {
  // Caso haja imagem configurada, exibe a logo transparente repousando direto sobre o fundo verde #0b3c26
  if (TOP_BRAND_LOGO_SRC) {
    const imgHeight =
      variant === 'header'
        ? 'h-18 max-h-20 max-w-[320px]'
        : variant === 'sidebar'
          ? 'h-22 max-h-24 max-w-[400px]'
          : 'h-22 max-h-24 max-w-[400px]'

    // Alinhamento vertical da logo NEXUS:
    // Sem elevação artificial (translate-y negativo removido) para manter a logo
    // naturalmente centralizada na vertical dentro do container h-20 / h-22,
    // perfeitamente alinhada com os controles do topo e a divisória border-b.
    const verticalOffset = ''

    return (
      <div
        className={cn(
          'inline-flex items-center justify-center select-none',
          verticalOffset,
          variant === 'sidebar' && 'transition-transform hover:scale-[1.02]',
          className,
        )}
      >
        <img
          src={TOP_BRAND_LOGO_SRC}
          alt="NEXUS"
          className={cn('w-auto object-contain shrink-0', imgHeight)}
        />
      </div>
    )
  }

  // Fallback textual: legível sobre o fundo verde #0b3c26 da sidebar/header
  const isHeader = variant === 'header'

  return (
    <div
      className={cn(
        'inline-flex items-center justify-center select-none tracking-widest font-black transition-opacity hover:opacity-95 leading-none',
        isHeader ? 'text-4xl py-1 px-2' : 'text-5xl py-2 px-3',
        className,
      )}
      aria-label="NEXUS"
    >
      <span className="text-white drop-shadow-xs">NE</span>
      <span className="text-emerald-400 drop-shadow-xs">X</span>
      <span className="text-white drop-shadow-xs">US</span>
    </div>
  )
}

// Keep BenerLogo and BenerNexusLogo as aliases for backwards compatibility
export const BenerLogo = NexusLogo
export const BenerNexusLogo = NexusLogo

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggleTheme } = useTheme()
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      className={cn('rounded-full text-foreground hover:bg-muted', className)}
    >
      {theme === 'dark' ? (
        <Sun className="w-5 h-5 text-amber-400" />
      ) : (
        <Moon className="w-5 h-5 text-muted-foreground" />
      )}
    </Button>
  )
}
