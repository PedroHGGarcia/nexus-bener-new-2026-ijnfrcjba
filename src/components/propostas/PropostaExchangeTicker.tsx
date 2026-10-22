import { useCurrencyRates } from '@/hooks/use-currency-rates'

import { RefreshCw } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

export function PropostaExchangeTicker() {
  const { rates, loading, isCached, reload } = useCurrencyRates()

  const formatPct = (val: number) => {
    const prefix = val >= 0 ? '+' : ''
    return `${prefix}${val.toFixed(4)}%`
  }

  const currentRates = rates || {
    usdRate: 5.4,
    eurRate: 5.9,
    usdPctChange: 0,
    eurPctChange: 0,
    timestamp: new Date().toISOString(),
    source: 'padrao-seguro',
  }

  const showCachedBadge =
    isCached ||
    currentRates.source?.includes('cache') ||
    currentRates.source === 'offline-default' ||
    currentRates.source === 'padrao-seguro'

  return (
    <div className="text-xs sm:text-sm flex flex-wrap items-center gap-x-4 gap-y-1 text-slate-700 dark:text-slate-300 py-1">
      <span>
        <strong className="text-slate-900 dark:text-slate-100 font-bold">Dólar (USD):</strong>{' '}
        <span className="text-slate-900 dark:text-slate-100 font-medium">
          R${' '}
          {currentRates.usdRate.toLocaleString('pt-BR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </span>{' '}
        <span
          className={
            currentRates.usdPctChange >= 0
              ? 'text-emerald-600 dark:text-emerald-400 font-medium text-xs'
              : 'text-rose-600 dark:text-rose-400 font-medium text-xs'
          }
        >
          ({formatPct(currentRates.usdPctChange)})
        </span>
      </span>

      <span>
        <strong className="text-slate-900 dark:text-slate-100 font-bold">Euro (EUR):</strong>{' '}
        <span className="text-slate-900 dark:text-slate-100 font-medium">
          R${' '}
          {currentRates.eurRate.toLocaleString('pt-BR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </span>{' '}
        <span
          className={
            currentRates.eurPctChange >= 0
              ? 'text-emerald-600 dark:text-emerald-400 font-medium text-xs'
              : 'text-rose-600 dark:text-rose-400 font-medium text-xs'
          }
        >
          ({formatPct(currentRates.eurPctChange)})
        </span>
      </span>

      <span className="text-slate-900 dark:text-slate-100 font-bold">R$: 1,00</span>

      {showCachedBadge && (
        <Badge
          variant="outline"
          className="text-[10px] h-5 px-1.5 border-amber-300 bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-700"
          title="Cotação recuperada do cache local para não travar a emissão"
        >
          cotação em cache
        </Badge>
      )}

      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => reload(true)}
        disabled={loading}
        title="Atualizar cotações agora"
        className="h-6 w-6 text-muted-foreground hover:text-foreground"
      >
        <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
      </Button>
    </div>
  )
}
