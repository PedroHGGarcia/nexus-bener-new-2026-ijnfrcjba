import { useState, useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Printer, Search } from 'lucide-react'
import { PrecoItem } from './LicitacaoPrecosTable'

interface Props {
  items: PrecoItem[]
  moeda: string
  notaRep?: number | null
}

export function LicitacaoMemoriaCalculo({ items, moeda }: Props) {
  const [search, setSearch] = useState('')

  const symbol = moeda === 'USD' ? 'US$' : moeda === 'EUR' ? '€' : 'R$'

  const filteredItems = useMemo(() => {
    return items.filter((it) => {
      return (
        it.descricao.toLowerCase().includes(search.toLowerCase()) ||
        it.unidade.toLowerCase().includes(search.toLowerCase())
      )
    })
  }, [items, search])

  const totals = useMemo(() => {
    let custoTotal = 0
    let vendaTotal = 0
    let comissaoTotal = 0
    let encargosTotal = 0
    let descontoTotal = 0

    items.forEach((item) => {
      const baseCusto = (item.qtd || 0) * (item.custoUnitario || 0) * (item.fatorNac || 1.0)
      const desc = baseCusto * ((item.descontoPct || 0) / 100)
      const comiss = baseCusto * ((item.comissaoPct || 0) / 100)
      const markup = baseCusto * ((item.markupPct || 0) / 100)
      const encargos = baseCusto * ((item.encargosPct || 0) / 100)
      const venda = baseCusto - desc + comiss + markup + encargos

      custoTotal += baseCusto
      descontoTotal += desc
      comissaoTotal += comiss
      encargosTotal += encargos
      vendaTotal += venda
    })

    const margemBruta = vendaTotal - custoTotal - comissaoTotal - encargosTotal
    const margemPct = vendaTotal > 0 ? (margemBruta / vendaTotal) * 100 : 0

    return {
      custoTotal,
      descontoTotal,
      comissaoTotal,
      encargosTotal,
      vendaTotal,
      margemBruta,
      margemPct,
    }
  }, [items])

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-slate-50 dark:bg-slate-900 border shadow-xs">
          <CardContent className="p-4">
            <span className="text-xs font-medium text-muted-foreground block">
              Custo Total Base
            </span>
            <span className="text-lg font-bold font-mono">
              {symbol}{' '}
              {totals.custoTotal.toLocaleString('pt-BR', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
          </CardContent>
        </Card>

        <Card className="bg-slate-50 dark:bg-slate-900 border shadow-xs">
          <CardContent className="p-4">
            <span className="text-xs font-medium text-muted-foreground block">
              Comissões & Encargos
            </span>
            <span className="text-lg font-bold font-mono text-amber-600 dark:text-amber-400">
              {symbol}{' '}
              {(totals.comissaoTotal + totals.encargosTotal).toLocaleString('pt-BR', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
          </CardContent>
        </Card>

        <Card className="bg-slate-50 dark:bg-slate-900 border shadow-xs">
          <CardContent className="p-4">
            <span className="text-xs font-medium text-muted-foreground block">
              Valor Final Proposto
            </span>
            <span className="text-lg font-bold font-mono text-primary">
              {symbol}{' '}
              {totals.vendaTotal.toLocaleString('pt-BR', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
          </CardContent>
        </Card>

        <Card className="bg-slate-50 dark:bg-slate-900 border shadow-xs">
          <CardContent className="p-4">
            <span className="text-xs font-medium text-muted-foreground block">Margem Estimada</span>
            <span
              className={`text-lg font-bold font-mono ${totals.margemPct >= 0 ? 'text-emerald-600' : 'text-red-600'}`}
            >
              {totals.margemPct.toFixed(2)}% ({symbol}{' '}
              {totals.margemBruta.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})
            </span>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 justify-between items-center">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por item ou descrição..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-xs"
          />
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handlePrint} className="gap-1.5 text-xs">
            <Printer className="h-3.5 w-3.5" />
            Imprimir Memória
          </Button>
        </div>
      </div>

      <div className="border rounded-lg overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-muted/60 border-b font-semibold">
            <tr>
              <th className="p-2.5 text-left">Unidade</th>
              <th className="p-2.5 text-left">Descrição</th>
              <th className="p-2.5 text-center">Qtd</th>
              <th className="p-2.5 text-right">Custo Base ({symbol})</th>
              <th className="p-2.5 text-center">Fator Nac.</th>
              <th className="p-2.5 text-right">Comissão</th>
              <th className="p-2.5 text-right">Markup</th>
              <th className="p-2.5 text-right">Encargos</th>
              <th className="p-2.5 text-right font-bold">Preço Final ({symbol})</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filteredItems.length === 0 ? (
              <tr>
                <td colSpan={9} className="p-6 text-center text-muted-foreground">
                  Nenhum item encontrado na memória de cálculo.
                </td>
              </tr>
            ) : (
              filteredItems.map((item) => {
                const baseCusto =
                  (item.qtd || 0) * (item.custoUnitario || 0) * (item.fatorNac || 1.0)
                const desc = baseCusto * ((item.descontoPct || 0) / 100)
                const comiss = baseCusto * ((item.comissaoPct || 0) / 100)
                const markup = baseCusto * ((item.markupPct || 0) / 100)
                const encargos = baseCusto * ((item.encargosPct || 0) / 100)
                const venda = baseCusto - desc + comiss + markup + encargos

                return (
                  <tr key={item.id} className="hover:bg-muted/30">
                    <td className="p-2.5 font-semibold text-slate-700 dark:text-slate-300">
                      {item.unidade}
                    </td>
                    <td className="p-2.5">{item.descricao || '—'}</td>
                    <td className="p-2.5 text-center font-mono">{item.qtd}</td>
                    <td className="p-2.5 text-right font-mono">
                      {baseCusto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-2.5 text-center font-mono">{item.fatorNac}</td>
                    <td className="p-2.5 text-right font-mono text-muted-foreground">
                      {comiss.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (
                      {item.comissaoPct}%)
                    </td>
                    <td className="p-2.5 text-right font-mono text-muted-foreground">
                      {markup.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (
                      {item.markupPct}%)
                    </td>
                    <td className="p-2.5 text-right font-mono text-muted-foreground">
                      {encargos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (
                      {item.encargosPct}%)
                    </td>
                    <td className="p-2.5 text-right font-mono font-bold">
                      {venda.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
          <tfoot className="bg-muted/40 font-bold border-t">
            <tr>
              <td colSpan={3} className="p-2.5 text-right">
                Totais:
              </td>
              <td className="p-2.5 text-right font-mono">
                {symbol} {totals.custoTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </td>
              <td className="p-2.5"></td>
              <td className="p-2.5 text-right font-mono">
                {symbol}{' '}
                {totals.comissaoTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </td>
              <td className="p-2.5"></td>
              <td className="p-2.5 text-right font-mono">
                {symbol}{' '}
                {totals.encargosTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </td>
              <td className="p-2.5 text-right font-mono text-primary">
                {symbol} {totals.vendaTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
