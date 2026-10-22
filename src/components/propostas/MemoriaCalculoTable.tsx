import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Trash2, Plus } from 'lucide-react'
import { FormattedNumberInput } from '@/components/shared/formatted-number-input'
import { MemoriaCalculoItem, createEmptyMemoriaItem } from '@/types/memoria-calculo-item'
import { calcPrecoTotal, calcValorComissao, calcTotals } from '@/lib/memoria-calculo-utils'

interface Props {
  items: MemoriaCalculoItem[]
  moeda: string
  onChange: (items: MemoriaCalculoItem[]) => void
}

export function MemoriaCalculoTable({ items, moeda, onChange }: Props) {
  const symbol = moeda === 'USD' ? 'US$' : moeda === 'EUR' ? '€' : 'R$'
  const totals = calcTotals(items)

  const add = () => onChange([...items, createEmptyMemoriaItem(items.length + 1)])
  const remove = (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir esta linha?')) {
      onChange(items.filter((i) => i.id !== id))
    }
  }
  const update = (id: string, field: keyof MemoriaCalculoItem, val: unknown) =>
    onChange(items.map((i) => (i.id === id ? { ...i, [field]: val } : i)))

  const numCell = (
    id: string,
    field: keyof MemoriaCalculoItem,
    val: number,
    step: string,
    cls: string,
  ) => {
    const maxDecimals = step === '1' ? 0 : step === '0.1' ? 1 : 2
    return (
      <td className="p-1">
        <FormattedNumberInput
          value={val}
          onChange={(v) => update(id, field, v)}
          maxDecimals={maxDecimals}
          className={`h-8 text-xs ${cls}`}
        />
      </td>
    )
  }
  const txtCell = (
    id: string,
    field: keyof MemoriaCalculoItem,
    val: string,
    ph: string,
    cls: string,
  ) => (
    <td className="p-1">
      <Input
        value={val}
        onChange={(e) => update(id, field, e.target.value)}
        placeholder={ph}
        className={`h-8 text-xs ${cls}`}
      />
    </td>
  )

  return (
    <div className="space-y-3">
      <div className="border rounded-md overflow-x-auto">
        <table className="w-full text-xs min-w-[1500px]">
          <thead className="bg-muted/50 border-b">
            <tr>
              {[
                'Unidade',
                'Item',
                'Descrição',
                'Marca',
                'Modelo',
                'Qtd',
                'U.M.',
                'Preço Unit.',
                'Desc.%',
                'Preço Total',
                'Comiss.%',
                'Val.Comiss.',
                'Prazo',
                'Condições',
                'Obs.',
              ].map((h) => (
                <th key={h} className="p-2 text-left font-semibold whitespace-nowrap">
                  {h}
                </th>
              ))}
              <th className="p-2 w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {items.length === 0 ? (
              <tr>
                <td colSpan={16} className="p-6 text-center text-muted-foreground">
                  Nenhum item adicionado. Clique em "Adicionar Item" ou importe um arquivo.
                </td>
              </tr>
            ) : (
              items.map((it) => (
                <tr key={it.id} className="hover:bg-muted/20">
                  {txtCell(it.id, 'unidade', it.unidade, 'UN-01', 'w-20')}
                  {numCell(it.id, 'item', it.item, '1', 'w-16 text-center')}
                  {txtCell(it.id, 'descricao', it.descricao, 'Descrição', 'min-w-[180px]')}
                  {txtCell(it.id, 'marca', it.marca, '—', 'w-24')}
                  {txtCell(it.id, 'modelo', it.modelo, '—', 'w-24')}
                  {numCell(it.id, 'quantidade', it.quantidade, '1', 'w-16 text-center')}
                  {txtCell(it.id, 'unidadeMedida', it.unidadeMedida, 'un', 'w-20')}
                  {numCell(
                    it.id,
                    'precoUnitario',
                    it.precoUnitario,
                    '0.01',
                    'w-28 text-right font-mono',
                  )}
                  {numCell(it.id, 'descontoPct', it.descontoPct, '0.1', 'w-20 text-center')}
                  <td className="p-1.5 text-right font-mono font-bold">
                    {symbol}{' '}
                    {calcPrecoTotal(it).toLocaleString('pt-BR', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </td>
                  {numCell(it.id, 'comissaoPct', it.comissaoPct, '0.1', 'w-20 text-center')}
                  <td className="p-1.5 text-right font-mono text-muted-foreground">
                    {symbol}{' '}
                    {calcValorComissao(it).toLocaleString('pt-BR', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </td>
                  {txtCell(it.id, 'prazoEntrega', it.prazoEntrega, '—', 'w-28')}
                  {txtCell(it.id, 'condicoesPagamento', it.condicoesPagamento, '—', 'w-28')}
                  {txtCell(it.id, 'observacoes', it.observacoes, '—', 'w-28')}
                  <td className="p-1.5 text-center">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => remove(it.id)}
                      className="h-8 w-8 text-destructive hover:bg-destructive/10"
                      aria-label="Excluir linha"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot className="bg-muted/40 font-bold border-t">
            <tr>
              <td colSpan={9} className="p-2.5 text-right">
                Total Geral:
              </td>
              <td className="p-2.5 text-right font-mono text-primary">
                {symbol}{' '}
                {totals.totalGeral.toLocaleString('pt-BR', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </td>
              <td colSpan={6} className="p-2.5"></td>
            </tr>
          </tfoot>
        </table>
      </div>
      <Button type="button" variant="outline" size="sm" onClick={add} className="gap-1.5 text-xs">
        <Plus className="h-4 w-4" /> Adicionar Item
      </Button>
    </div>
  )
}
