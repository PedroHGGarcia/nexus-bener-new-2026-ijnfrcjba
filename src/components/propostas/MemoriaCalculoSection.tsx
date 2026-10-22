import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Upload, FileDown, Printer, RefreshCw, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { MemoriaCalculoItem } from '@/types/memoria-calculo-item'
import {
  calcTotals,
  parseFileToItems,
  syncToPrecoItems,
  downloadCsv,
  printMemoria,
} from '@/lib/memoria-calculo-utils'
import { MemoriaCalculoTable } from './MemoriaCalculoTable'
import { PrecoItem } from './LicitacaoPrecosTable'

const STORAGE_KEY = 'bener_memoria_calculo_licitacao'

interface Props {
  moeda: string
  secao7Total: number
  onSyncToSecao7: (items: PrecoItem[]) => void
}

export function MemoriaCalculoSection({ moeda, secao7Total, onSyncToSecao7 }: Props) {
  const [items, setItems] = useState<MemoriaCalculoItem[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    } catch {
      return []
    }
  })

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  }, [items])

  const symbol = moeda === 'USD' ? 'US$' : moeda === 'EUR' ? '€' : 'R$'
  const totals = calcTotals(items)
  const divergence = Math.abs(totals.totalGeral - secao7Total)
  const hasDivergence = divergence > 0.01 && items.length > 0
  const duplicates = items.filter((it, i) => items.findIndex((x) => x.item === it.item) !== i)
  const hasDuplicates = duplicates.length > 0

  const handleFile = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: 'Arquivo muito grande (máx 10MB)', variant: 'destructive' })
      return
    }
    try {
      const parsed = await parseFileToItems(file)
      if (parsed.length === 0) {
        toast({ title: 'Nenhum dado válido encontrado no arquivo', variant: 'destructive' })
        return
      }
      setItems(parsed)
      toast({ title: `${parsed.length} item(ns) importado(s)!` })
    } catch (e) {
      toast({
        title: 'Erro ao importar arquivo',
        description: e instanceof Error ? e.message : '',
        variant: 'destructive',
      })
    }
  }

  const handleSync = () => {
    if (items.length === 0) {
      toast({ title: 'Nenhum item para sincronizar', variant: 'destructive' })
      return
    }
    onSyncToSecao7(syncToPrecoItems(items))
    toast({ title: 'Itens sincronizados com a Seção 7!' })
  }

  const fmt = (v: number) =>
    `${symbol} ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  const summaryCards = [
    { label: 'Subtotal', value: totals.subtotal, cls: '' },
    { label: 'Total Descontos', value: totals.totalDescontos, cls: 'text-red-500' },
    { label: 'Total Geral', value: totals.totalGeral, cls: 'text-primary' },
    { label: 'Total Comissões', value: totals.totalComissao, cls: 'text-amber-600' },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <label>
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs cursor-pointer"
              aria-label="Importar arquivo Excel ou CSV"
            >
              <Upload className="h-4 w-4" /> Importar Excel/CSV
            </Button>
          </label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs"
            onClick={() => downloadCsv(items)}
            disabled={!items.length}
            aria-label="Exportar CSV"
          >
            <FileDown className="h-4 w-4" /> Exportar CSV
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs"
            onClick={() => printMemoria(items, totals, moeda)}
            disabled={!items.length}
            aria-label="Imprimir memória de cálculo"
          >
            <Printer className="h-4 w-4" /> Imprimir
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs"
            onClick={handleSync}
            disabled={!items.length}
            aria-label="Sincronizar com Seção 7"
          >
            <RefreshCw className="h-4 w-4" /> Sincronizar c/ Seção 7
          </Button>
        </div>
        <span className="text-xs text-muted-foreground font-medium">{items.length} item(ns)</span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {summaryCards.map((c) => (
          <Card key={c.label} className="bg-slate-50 dark:bg-slate-900">
            <CardContent className="p-3">
              <span className="text-xs text-muted-foreground block">{c.label}</span>
              <span className={`text-base font-bold font-mono ${c.cls}`}>{fmt(c.value)}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      {hasDivergence && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Divergência: Memória ({fmt(totals.totalGeral)}) ≠ Seção 7 ({fmt(secao7Total)}).
            Diferença: {fmt(divergence)}
          </AlertDescription>
        </Alert>
      )}
      {items.length > 0 && !hasDivergence && (
        <Alert className="border-green-500/50 bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription>Totais em conformidade com a Seção 7.</AlertDescription>
        </Alert>
      )}
      {hasDuplicates && (
        <Alert>
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          <AlertDescription className="text-amber-700 dark:text-amber-400">
            Atenção: Existem itens com números duplicados. Verifique a coluna "Item".
          </AlertDescription>
        </Alert>
      )}

      <MemoriaCalculoTable items={items} moeda={moeda} onChange={setItems} />
    </div>
  )
}
