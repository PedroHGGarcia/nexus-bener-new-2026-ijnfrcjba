import { useCurrencyRates } from '@/hooks/use-currency-rates'
import { formatPtaxRate, SAFE_DEFAULT_RATES } from '@/services/currency-rates'

import { RefreshCw, AlertTriangle, Calendar } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

export function PropostaExchangeTicker() {
  const { rates, loading, isCached, reload } = useCurrencyRates()

  const currentRates = rates || SAFE_DEFAULT_RATES

  const isOutdated =
    Boolean(currentRates.isOutdated) ||
    isCached ||
    currentRates.source?.includes('cache') ||
    currentRates.source === 'offline-default' ||
    currentRates.source === 'padrao-seguro'

  const refDateText = currentRates.refDate
    ? `Cotação de fechamento de ${currentRates.refDate}`
    : 'Cotação de fechamento do dia útil anterior'

  return (
    <div className="text-xs sm:text-sm flex flex-wrap items-center gap-x-3 gap-y-1.5 text-slate-700 dark:text-slate-300 py-1 border-y border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 px-2.5 rounded-md">
      {/* Indicador de Data de Referência PTAX */}
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 px-2 py-0.5 rounded shadow-2xs">
        <Calendar className="w-3 h-3 text-emerald-700 dark:text-emerald-400" />
        {refDateText}
      </span>

      {/* Dólar PTAX (4 casas decimais) */}
      <span className="inline-flex items-center gap-1">
        <strong className="text-slate-900 dark:text-slate-100 font-bold">Dólar (USD):</strong>{' '}
        <span className="text-slate-900 dark:text-slate-100 font-semibold tabular-nums">
          R$ {formatPtaxRate(currentRates.usdRate)}
        </span>
      </span>

      {/* Euro PTAX (4 casas decimais) */}
      <span className="inline-flex items-center gap-1">
        <strong className="text-slate-900 dark:text-slate-100 font-bold">Euro (EUR):</strong>{' '}
        <span className="text-slate-900 dark:text-slate-100 font-semibold tabular-nums">
          R$ {formatPtaxRate(currentRates.eurRate)}
        </span>
      </span>

      {/* Iene PTAX (4 casas decimais) */}
      <span className="inline-flex items-center gap-1">
        <strong className="text-slate-900 dark:text-slate-100 font-bold">Iene (JPY):</strong>{' '}
        <span className="text-slate-900 dark:text-slate-100 font-semibold tabular-nums">
          R$ {formatPtaxRate(currentRates.jpyRate)}
        </span>
      </span>

      <span className="text-slate-700 dark:text-slate-300 font-medium text-xs">
        Real: <strong>R$ 1,0000</strong>
      </span>

      {/* Aviso explícito de cotação desatualizada se estiver em fallback */}
      {isOutdated && (
        <Badge
          variant="outline"
          className="text-[10px] h-5 px-1.5 border-amber-400 bg-amber-50 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200 dark:border-amber-700 inline-flex items-center gap-1 font-medium"
          title={`Fonte: ${currentRates.source}. Esta cotação pode estar desatualizada em relação ao Banco Central.`}
        >
          <AlertTriangle className="w-2.5 h-2.5 text-amber-600 dark:text-amber-400" />
          cotação desatualizada (cache)
        </Badge>
      )}

      {/* Botão de atualizar cotação */}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => reload(true)}
        disabled={loading}
        title="Atualizar cotação PTAX agora junto ao Banco Central"
        className="h-6 px-2 gap-1 text-[11px] text-muted-foreground hover:text-foreground ml-auto"
      >
        <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin text-emerald-600' : ''}`} />
        <span>Atualizar cotação</span>
      </Button>
    </div>
  )
}
