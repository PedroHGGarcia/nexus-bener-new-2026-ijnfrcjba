import { useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { PrecoItem } from './LicitacaoPrecosTable'
import { TaxConfig } from '@/types/licitacao-tax'
import { getIcmsRate, IPI_DEFAULT_RATE } from '@/lib/tax-rates'
import { CurrencyRates } from '@/services/currency-rates'
import { Info } from 'lucide-react'

interface Props {
  items: PrecoItem[]
  moeda: string
  taxConfig: TaxConfig
  rates: CurrencyRates | null
}

function getEffectiveRate(
  moeda: string,
  taxConfig: TaxConfig,
  rates: CurrencyRates | null,
): number {
  if (moeda === 'BRL') return 1
  if (taxConfig.cambioEstimado && taxConfig.cambioEstimado > 0) return taxConfig.cambioEstimado
  if (moeda === 'USD' && rates) return rates.usdRate
  if (moeda === 'EUR' && rates) return rates.eurRate
  return moeda === 'USD' ? 5.09 : 5.85
}

export function LicitacaoMemoriaCompleta({ items, moeda, taxConfig, rates }: Props) {
  const rate = getEffectiveRate(moeda, taxConfig, rates)
  const icmsRate = taxConfig.estadoFaturamento ? getIcmsRate(taxConfig.estadoFaturamento) : 0
  const ipiRate = IPI_DEFAULT_RATE
  const isLiquido = taxConfig.regimePreco === 'liquido'
  const symbol = moeda === 'USD' ? 'US$' : moeda === 'EUR' ? '€' : 'R$'

  const rows = useMemo(() => {
    return items.map((item) => {
      const baseCusto = (item.qtd || 0) * (item.custoUnitario || 0) * (item.fatorNac || 1.0)
      const desc = baseCusto * ((item.descontoPct || 0) / 100)
      const comiss = baseCusto * ((item.comissaoPct || 0) / 100)
      const markup = baseCusto * ((item.markupPct || 0) / 100)
      const encargos = baseCusto * ((item.encargosPct || 0) / 100)
      const vendaOrig = baseCusto - desc + comiss + markup + encargos
      const vendaBrl = vendaOrig * rate

      let ipiValor = 0
      let icmsValor = 0
      let precoFinal = vendaBrl

      if (isLiquido) {
        ipiValor = vendaBrl * (ipiRate / 100)
        const baseIcms = vendaBrl + ipiValor
        icmsValor = baseIcms * (icmsRate / 100)
        precoFinal = vendaBrl + ipiValor + icmsValor
      } else {
        if (icmsRate > 0) icmsValor = vendaBrl - vendaBrl / (1 + icmsRate / 100)
        if (ipiRate > 0) ipiValor = vendaBrl - vendaBrl / (1 + ipiRate / 100)
      }

      return {
        id: item.id,
        unidade: item.unidade,
        descricao: item.descricao,
        custoOrig: baseCusto,
        vendaBrl,
        ipiValor,
        icmsValor,
        precoFinal,
      }
    })
  }, [items, rate, icmsRate, ipiRate, isLiquido])

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, r) => ({
        custo: acc.custo + r.custoOrig * rate,
        venda: acc.venda + r.vendaBrl,
        ipi: acc.ipi + r.ipiValor,
        icms: acc.icms + r.icmsValor,
        final: acc.final + r.precoFinal,
      }),
      { custo: 0, venda: 0, ipi: 0, icms: 0, final: 0 },
    )
  }, [rows, rate])

  const fmt = (v: number) =>
    v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 border-b pb-2 flex items-center gap-2">
          <Info className="w-4 h-4 text-primary" />
          Memória de Cálculo Completa (Impostos &amp; Câmbio)
        </h3>

        <div className="flex flex-wrap gap-2 text-xs">
          <span className="px-2 py-1 bg-muted rounded">
            Câmbio: {rate.toFixed(4)} {taxConfig.cambioEstimado ? '(estimado)' : '(live)'}
          </span>
          {taxConfig.cambioEstimadoData && (
            <span className="px-2 py-1 bg-muted rounded">Data: {taxConfig.cambioEstimadoData}</span>
          )}
          {taxConfig.cambioEstimadoBase && (
            <span className="px-2 py-1 bg-muted rounded">Base: {taxConfig.cambioEstimadoBase}</span>
          )}
          <span className="px-2 py-1 bg-muted rounded">
            Estado: {taxConfig.estadoFaturamento || '—'}
          </span>
          <span className="px-2 py-1 bg-muted rounded">
            Regime: {isLiquido ? 'Líquido' : 'Embutido'}
          </span>
          <span className="px-2 py-1 bg-muted rounded">ICMS: {icmsRate}%</span>
          <span className="px-2 py-1 bg-muted rounded">IPI: {ipiRate}%</span>
        </div>

        {items.length === 0 ? (
          <Alert>
            <AlertDescription className="text-xs">
              Adicione itens na Seção 7 para visualizar a memória de cálculo completa com impostos e
              câmbio.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="border rounded-md overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/50 border-b font-semibold">
                <tr>
                  <th className="p-2 text-left">Item</th>
                  <th className="p-2 text-right">Custo ({symbol})</th>
                  <th className="p-2 text-center">Câmbio</th>
                  <th className="p-2 text-right">Venda (R$)</th>
                  {isLiquido && <th className="p-2 text-right">IPI (R$)</th>}
                  {isLiquido && <th className="p-2 text-right">ICMS (R$)</th>}
                  <th className="p-2 text-right">Preço Final (R$)</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-muted/20">
                    <td className="p-2">
                      {r.unidade} — {r.descricao || '—'}
                    </td>
                    <td className="p-2 text-right font-mono">{fmt(r.custoOrig)}</td>
                    <td className="p-2 text-center font-mono">{rate.toFixed(4)}</td>
                    <td className="p-2 text-right font-mono">{fmt(r.vendaBrl)}</td>
                    {isLiquido && (
                      <td className="p-2 text-right font-mono text-blue-600 dark:text-blue-400">
                        {fmt(r.ipiValor)}
                      </td>
                    )}
                    {isLiquido && (
                      <td className="p-2 text-right font-mono text-purple-600 dark:text-purple-400">
                        {fmt(r.icmsValor)}
                      </td>
                    )}
                    <td className="p-2 text-right font-mono font-bold text-emerald-700 dark:text-emerald-400">
                      {fmt(r.precoFinal)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-muted/40 font-bold border-t">
                <tr>
                  <td className="p-2 text-right">Totais:</td>
                  <td className="p-2 text-right font-mono">{fmt(totals.custo)}</td>
                  <td className="p-2"></td>
                  <td className="p-2 text-right font-mono">{fmt(totals.venda)}</td>
                  {isLiquido && (
                    <td className="p-2 text-right font-mono text-blue-600 dark:text-blue-400">
                      {fmt(totals.ipi)}
                    </td>
                  )}
                  {isLiquido && (
                    <td className="p-2 text-right font-mono text-purple-600 dark:text-purple-400">
                      {fmt(totals.icms)}
                    </td>
                  )}
                  <td className="p-2 text-right font-mono text-emerald-700 dark:text-emerald-400">
                    {fmt(totals.final)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
