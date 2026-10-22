import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Info, TrendingUp, TrendingDown } from 'lucide-react'

interface RateItem {
  code: string
  rate: number
  pctChange: number
  previous: number
}

export function LicitacaoCambioDashboard() {
  const [rates, setRates] = useState<Record<string, RateItem>>({
    USD: { code: 'USD/BRL', rate: 5.0856, pctChange: 0.12, previous: 5.0789 },
    EUR: { code: 'EUR/BRL', rate: 5.8524, pctChange: -0.08, previous: 5.8569 },
    JPY: { code: 'JPY/BRL', rate: 0.0324, pctChange: 0.01, previous: 0.0323 },
  })

  useEffect(() => {
    fetch('https://economia.awesomeapi.com.br/last/USD-BRL,EUR-BRL,JPY-BRL')
      .then((res) => res.json())
      .then((data) => {
        if (data && data.USDBRL) {
          setRates({
            USD: {
              code: 'USD/BRL',
              rate: parseFloat(data.USDBRL.bid),
              pctChange: parseFloat(data.USDBRL.pctChange),
              previous: parseFloat(data.USDBRL.bid) - parseFloat(data.USDBRL.varBid || '0'),
            },
            EUR: {
              code: 'EUR/BRL',
              rate: parseFloat(data.EURBRL.bid),
              pctChange: parseFloat(data.EURBRL.pctChange),
              previous: parseFloat(data.EURBRL.bid) - parseFloat(data.EURBRL.varBid || '0'),
            },
            JPY: {
              code: 'JPY/BRL',
              rate: parseFloat(data.JPYBRL.bid),
              pctChange: parseFloat(data.JPYBRL.pctChange),
              previous: parseFloat(data.JPYBRL.bid) - parseFloat(data.JPYBRL.varBid || '0'),
            },
          })
        }
      })
      .catch(() => {})
  }, [])

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
        <Info className="w-3.5 h-3.5 text-slate-400" />
        Variação Cambial — USD / EUR / JPY
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {Object.entries(rates).map(([key, item]) => {
          const isUp = item.pctChange >= 0
          const symbol = key === 'USD' ? '$' : key === 'EUR' ? '€' : '¥'
          return (
            <Card key={key} className="bg-slate-50/70 dark:bg-slate-900/50 border-slate-200">
              <CardContent className="p-3.5 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold text-slate-400 block uppercase tracking-wide">
                    {item.code}
                  </span>
                  <div className="flex items-baseline gap-1.5 mt-0.5">
                    <span className="text-xs font-bold text-slate-500">{symbol}</span>
                    <span className="text-lg font-bold text-slate-900 dark:text-slate-100">
                      R$ {item.rate.toFixed(4)}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    Anterior: R$ {item.previous.toFixed(4)}
                  </span>
                </div>

                <div
                  className={`flex items-center gap-0.5 px-2 py-1 rounded text-xs font-semibold ${
                    isUp
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
                      : 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400'
                  }`}
                >
                  {isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  <span>{Math.abs(item.pctChange).toFixed(2)}%</span>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
