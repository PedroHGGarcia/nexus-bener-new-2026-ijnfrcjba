import { cn } from '@/lib/utils'
import { formatCurrencyByMoeda } from '@/lib/format'
import { type CurrencyRates, formatBrlEquivalent } from '@/services/currency-rates'

interface CurrencyValueProps {
  value: number | null | undefined
  moeda: string | null | undefined
  rates: CurrencyRates | null
  className?: string
  variant?: 'inline' | 'stacked'
  size?: 'xs' | 'sm' | 'md'
}

export function CurrencyValue({
  value,
  moeda,
  rates,
  className,
  variant = 'inline',
  size = 'md',
}: CurrencyValueProps) {
  const formatted = formatCurrencyByMoeda(value, moeda)
  const brlEq = formatBrlEquivalent(value, moeda, rates)

  const valueClass = size === 'xs' ? 'text-xs' : size === 'sm' ? 'text-sm' : 'text-base'
  const eqClass = size === 'xs' ? 'text-[10px]' : 'text-xs'

  if (!brlEq) {
    return (
      <span className={cn('font-semibold tabular-nums', valueClass, className)}>{formatted}</span>
    )
  }

  if (variant === 'stacked') {
    return (
      <div className={cn('flex flex-col leading-tight', className)}>
        <span className={cn('font-semibold tabular-nums', valueClass)}>{formatted}</span>
        <span className={cn('text-muted-foreground tabular-nums', eqClass)}>{brlEq}</span>
      </div>
    )
  }

  return (
    <span className={cn('inline-flex items-baseline gap-1.5', className)}>
      <span className={cn('font-semibold tabular-nums', valueClass)}>{formatted}</span>
      <span className={cn('text-muted-foreground tabular-nums', eqClass)}>{brlEq}</span>
    </span>
  )
}
