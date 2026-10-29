import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Info, TrendingUp, TrendingDown, Calendar, AlertTriangle } from 'lucide-react'
import { useCurrencyRates } from '@/hooks/use-currency-rates'
import { formatPtaxRate, SAFE_DEFAULT_RATES } from '@/services/currency-rates'

export function LicitacaoCambioDashboard() {
  const { rates, isCached } = useCurrencyRates()
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

  const items = [
    {
      key: 'USD',
      code: 'USD/BRL',
      symbol: '$',
      rate: currentRates.usdRate,
      pctChange: currentRates.usdPctChange,
    },
    {
      key: 'EUR',
      code: 'EUR/BRL',
      symbol: '€',
      rate: currentRates.eurRate,
      pctChange: currentRates.eurPctChange,
    },
    {
      key: 'JPY',
      code: 'JPY/BRL',
      symbol: '¥',
      rate: currentRates.jpyRate,
      pctChange: currentRates.jpyPctChange,
    },
  ]

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
          <Info className="w-3.5 h-3.5 text-slate-400" />
          Taxas PTAX — USD / EUR / JPY (Fechamento do Dia Útil Anterior)
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 px-2 py-0.5 rounded shadow-2xs">
            <Calendar className="w-3 h-3 text-emerald-700 dark:text-emerald-400" />
            {refDateText}
          </span>
          {isOutdated && (
            <Badge
              variant="outline"
              className="text-[10px] h-5 px-1.5 border-amber-400 bg-amber-50 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200 dark:border-amber-700 inline-flex items-center gap-1 font-medium"
            >
              <AlertTriangle className="w-2.5 h-2.5 text-amber-600 dark:text-amber-400" />
              cotação desatualizada (cache)
            </Badge>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {items.map((item) => {
          const hasChange = typeof item.pctChange === 'number' && item.pctChange !== 0
          const isUp = item.pctChange >= 0
          return (
            <Card key={item.key} className="bg-slate-50/70 dark:bg-slate-900/50 border-slate-200">
              <CardContent className="p-3.5 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold text-slate-400 block uppercase tracking-wide">
                    {item.code}
                  </span>
                  <div className="flex items-baseline gap-1.5 mt-0.5">
                    <span className="text-xs font-bold text-slate-500">{item.symbol}</span>
                    <span className="text-lg font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                      R$ {formatPtaxRate(item.rate)}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 block mt-0.5">{refDateText}</span>
                </div>

                {hasChange ? (
                  <div
                    className={`flex items-center gap-0.5 px-2 py-1 rounded text-xs font-semibold ${
                      isUp
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
                        : 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400'
                    }`}
                  >
                    {isUp ? (
                      <TrendingUp className="w-3 h-3" />
                    ) : (
                      <TrendingDown className="w-3 h-3" />
                    )}
                    <span>{Math.abs(item.pctChange).toFixed(2)}%</span>
                  </div>
                ) : (
                  <div className="text-[10px] text-slate-500 font-medium px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded">
                    PTAX Fechamento
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
