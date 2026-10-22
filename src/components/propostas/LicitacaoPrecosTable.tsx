import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@/components/ui/select'
import { Plus, Trash2, PackageCheck } from 'lucide-react'
import { FormattedNumberInput } from '@/components/shared/formatted-number-input'
import { Acessorio } from '@/types/acessorio'
import { useCurrencyRates } from '@/hooks/use-currency-rates'
import { formatBrlEquivalent } from '@/services/currency-rates'

export interface PrecoItem {
  id: string
  unidade: string
  descricao: string
  qtd: number
  unidadeMedida: string
  custoUnitario: number
  fatorNac: number
  descontoPct: number
  comissaoPct: number
  markupPct: number
  encargosPct: number
  acessorioId?: string
}

interface Props {
  items: PrecoItem[]
  moeda: string
  acessoriosCatalog?: Acessorio[]
  onChange: (items: PrecoItem[]) => void
}

export function LicitacaoPrecosTable({ items, moeda, acessoriosCatalog = [], onChange }: Props) {
  const { rates } = useCurrencyRates()
  const addItem = () => {
    const newItem: PrecoItem = {
      id: `s7-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      unidade: `UN-${String(items.length + 1).padStart(2, '0')}`,
      descricao: '',
      qtd: 1,
      unidadeMedida: 'un',
      custoUnitario: 0,
      fatorNac: 1.0,
      descontoPct: 0,
      comissaoPct: 0,
      markupPct: 0,
      encargosPct: 0,
    }
    onChange([...items, newItem])
  }

  const addAcessorioFromCatalog = (acessorioId: string) => {
    const ac = acessoriosCatalog.find((a) => a.id === acessorioId)
    if (!ac) return
    const newItem: PrecoItem = {
      id: `s7-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      unidade: `AC-${String(items.length + 1).padStart(2, '0')}`,
      descricao: ac.nome || '',
      qtd: 1,
      unidadeMedida: 'un',
      custoUnitario: Number(ac.valor) || 0,
      fatorNac: Number(ac.fator_nac) || 1.0,
      descontoPct: 0,
      comissaoPct: 0,
      markupPct: 0,
      encargosPct: 0,
      acessorioId: ac.id,
    }
    onChange([...items, newItem])
  }

  const updateItem = (id: string, field: keyof PrecoItem, value: unknown) => {
    onChange(items.map((it) => (it.id === id ? { ...it, [field]: value } : it)))
  }

  const removeItem = (id: string) => {
    onChange(items.filter((it) => it.id !== id))
  }

  const calcVendaTotal = (item: PrecoItem) => {
    const baseCusto = (item.qtd || 0) * (item.custoUnitario || 0) * (item.fatorNac || 1.0)
    const desc = baseCusto * ((item.descontoPct || 0) / 100)
    const comiss = baseCusto * ((item.comissaoPct || 0) / 100)
    const markup = baseCusto * ((item.markupPct || 0) / 100)
    const encargos = baseCusto * ((item.encargosPct || 0) / 100)
    return baseCusto - desc + comiss + markup + encargos
  }

  const symbol = moeda === 'USD' ? 'US$' : moeda === 'EUR' ? '€' : 'R$'

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addItem}
            className="gap-1.5 text-xs"
          >
            <Plus className="h-4 w-4" />
            Adicionar Item Manual
          </Button>

          {acessoriosCatalog.length > 0 && (
            <Select onValueChange={(val) => addAcessorioFromCatalog(val)}>
              <SelectTrigger className="w-[240px] h-9 text-xs">
                <SelectValue placeholder="Adicionar Acessório do Catálogo" />
              </SelectTrigger>
              <SelectContent>
                {acessoriosCatalog.map((ac) => (
                  <SelectItem key={ac.id} value={ac.id} className="text-xs">
                    <span className="flex items-center gap-1.5">
                      <PackageCheck className="h-3.5 w-3.5 text-muted-foreground" />
                      {ac.nome} ({ac.moeda === 'USD' ? '$' : 'R$'}
                      {Number(ac.valor).toLocaleString('pt-BR')})
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <div className="text-xs text-muted-foreground font-medium">
          Total de itens: {items.length}
        </div>
      </div>

      <div className="border rounded-md overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-muted/50 border-b">
            <tr>
              <th className="p-2 text-left font-semibold w-24">Item/Unid.</th>
              <th className="p-2 text-left font-semibold min-w-[180px]">Descrição</th>
              <th className="p-2 text-center font-semibold w-16">Qtd</th>
              <th className="p-2 text-right font-semibold w-28">Custo Unit. ({symbol})</th>
              <th className="p-2 text-center font-semibold w-20">Fator Nac.</th>
              <th className="p-2 text-center font-semibold w-20">Desc. (%)</th>
              <th className="p-2 text-center font-semibold w-20">Comissão (%)</th>
              <th className="p-2 text-center font-semibold w-20">Markup (%)</th>
              <th className="p-2 text-center font-semibold w-20">Encargos (%)</th>
              <th className="p-2 text-right font-semibold w-32">Total Venda ({symbol})</th>
              <th className="p-2 text-center font-semibold w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {items.length === 0 ? (
              <tr>
                <td colSpan={11} className="p-6 text-center text-muted-foreground">
                  Nenhum item adicionado à proposta/licitação.
                </td>
              </tr>
            ) : (
              items.map((item) => {
                const totalVenda = calcVendaTotal(item)
                return (
                  <tr key={item.id} className="hover:bg-muted/20">
                    <td className="p-1.5">
                      <Input
                        value={item.unidade}
                        onChange={(e) => updateItem(item.id, 'unidade', e.target.value)}
                        className="h-8 text-xs"
                      />
                    </td>
                    <td className="p-1.5">
                      <Input
                        value={item.descricao}
                        onChange={(e) => updateItem(item.id, 'descricao', e.target.value)}
                        placeholder="Descrição do item"
                        className="h-8 text-xs"
                      />
                    </td>
                    <td className="p-1.5">
                      <FormattedNumberInput
                        value={item.qtd}
                        onChange={(v) => updateItem(item.id, 'qtd', v || 1)}
                        maxDecimals={2}
                        className="h-8 text-xs text-center"
                      />
                    </td>
                    <td className="p-1.5">
                      <FormattedNumberInput
                        value={item.custoUnitario}
                        onChange={(v) => updateItem(item.id, 'custoUnitario', v)}
                        className="h-8 text-xs text-right font-mono"
                      />
                    </td>
                    <td className="p-1.5">
                      <FormattedNumberInput
                        value={item.fatorNac}
                        onChange={(v) => updateItem(item.id, 'fatorNac', v || 1)}
                        className="h-8 text-xs text-center"
                      />
                    </td>
                    <td className="p-1.5">
                      <FormattedNumberInput
                        value={item.descontoPct}
                        onChange={(v) => updateItem(item.id, 'descontoPct', v)}
                        className="h-8 text-xs text-center"
                      />
                    </td>
                    <td className="p-1.5">
                      <FormattedNumberInput
                        value={item.comissaoPct}
                        onChange={(v) => updateItem(item.id, 'comissaoPct', v)}
                        className="h-8 text-xs text-center"
                      />
                    </td>
                    <td className="p-1.5">
                      <FormattedNumberInput
                        value={item.markupPct}
                        onChange={(v) => updateItem(item.id, 'markupPct', v)}
                        className="h-8 text-xs text-center"
                      />
                    </td>
                    <td className="p-1.5">
                      <FormattedNumberInput
                        value={item.encargosPct}
                        onChange={(v) => updateItem(item.id, 'encargosPct', v)}
                        className="h-8 text-xs text-center"
                      />
                    </td>
                    <td className="p-1.5 text-right font-mono font-bold text-slate-800 dark:text-slate-200">
                      <div className="flex flex-col items-end leading-tight">
                        <span>
                          {symbol}{' '}
                          {totalVenda.toLocaleString('pt-BR', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </span>
                        {moeda !== 'BRL' &&
                          totalVenda > 0 &&
                          formatBrlEquivalent(totalVenda, moeda, rates) && (
                            <span className="text-[10px] text-muted-foreground font-normal tabular-nums">
                              {formatBrlEquivalent(totalVenda, moeda, rates)}
                            </span>
                          )}
                      </div>
                    </td>
                    <td className="p-1.5 text-center">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeItem(item.id)}
                        className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
