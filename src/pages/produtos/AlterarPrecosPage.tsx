import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog'
import { History, CheckCircle2, Loader2, Search } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { useAuth } from '@/hooks/use-auth'
import { LoadingState, EmptyState, ErrorState } from '@/components/StateViews'
import { VersaoWithModelo } from '@/types/versao'
import { Modelo } from '@/types/modelo'
import { Marca } from '@/types/marca'
import { fetchVersoes } from '@/services/versoes'
import { fetchModelos } from '@/services/modelos'
import { fetchMarcas } from '@/services/marcas'
import { applyBulkPriceChanges } from '@/services/bulk-prices'
import { PriceHistoryDialog } from '@/components/produtos/PriceHistoryDialog'
import { PaginationBar } from '@/components/shared/table-controls'

function fmtValor(valor: number, moeda: string) {
  const s: Record<string, string> = { BRL: 'R$', USD: '$', EUR: '€' }
  return `${s[moeda] ?? ''} ${(valor ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
}

function normalizeSearch(term: string): string {
  return term
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

export default function AlterarPrecosPage() {
  const { user } = useAuth()
  const [versoes, setVersoes] = useState<VersaoWithModelo[]>([])
  const [modelos, setModelos] = useState<Modelo[]>([])
  const [marcas, setMarcas] = useState<Marca[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [mode, setMode] = useState<'absolute' | 'percentage'>('absolute')
  const [adjustValue, setAdjustValue] = useState(0)
  const [applying, setApplying] = useState(false)
  const [appliedCount, setAppliedCount] = useState<number | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [historyVersao, setHistoryVersao] = useState<VersaoWithModelo | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const [v, m, b] = await Promise.all([fetchVersoes(), fetchModelos(), fetchMarcas()])
      setVersoes(v)
      setModelos(m)
      setMarcas(b)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const modeloMap = useMemo(() => new Map(modelos.map((m) => [m.id, m])), [modelos])
  const marcaMap = useMemo(() => new Map(marcas.map((b) => [b.id, b])), [marcas])

  const filtered = useMemo(() => {
    const q = normalizeSearch(searchTerm)
    if (!q) return versoes

    return versoes.filter((v) => {
      const nomeVersao = normalizeSearch(v.nome || '')
      const codErp = normalizeSearch(v.cod_erp || '')
      const modelo = v.modelo ? modeloMap.get(v.modelo) : undefined
      const nomeModelo = normalizeSearch(v.modelos?.nome || modelo?.nome || '')
      const marca = modelo?.marca ? marcaMap.get(modelo.marca) : undefined
      const nomeMarca = normalizeSearch(marca?.nome || '')

      return (
        nomeVersao.includes(q) ||
        nomeModelo.includes(q) ||
        nomeMarca.includes(q) ||
        codErp.includes(q)
      )
    })
  }, [versoes, searchTerm, modeloMap, marcaMap])

  const toggleSel = (id: string) =>
    setSelected((p) => {
      const n = new Set(p)
      if (n.has(id)) {
        n.delete(id)
      } else {
        n.add(id)
      }
      return n
    })
  const toggleAll = () =>
    setSelected((p) =>
      p.size === filtered.length ? new Set() : new Set(filtered.map((v) => v.id)),
    )

  const preview = useMemo(() => {
    return versoes
      .filter((v) => selected.has(v.id))
      .map((v) => {
        const newValor = mode === 'absolute' ? adjustValue : v.valor * (1 + adjustValue / 100)
        return { ...v, newValor, diff: newValor - v.valor }
      })
  }, [versoes, selected, mode, adjustValue])

  const handleApply = async () => {
    setApplying(true)
    setConfirmOpen(false)
    try {
      const updates = preview.map((p) => ({ id: p.id, valor: p.newValor, valor_anterior: p.valor }))
      const { updated } = await applyBulkPriceChanges(
        updates,
        user?.id ?? '',
        user?.name ?? 'Sistema',
      )
      setAppliedCount(updated)
      setSelected(new Set())
      loadData()
      toast({ title: `${updated} versão(ões) atualizada(s)` })
    } catch (err) {
      toast({
        title: 'Erro ao aplicar alterações',
        description: err instanceof Error ? err.message : '',
        variant: 'destructive',
      })
    } finally {
      setApplying(false)
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Reajuste de Tabela de Preços</h1>

      {/* Campo de Busca por texto */}
      <div className="w-full">
        <div className="relative w-full">
          <Search className="w-5 h-5 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <Input
            type="text"
            placeholder="Pesquisar versão..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value)
              setPage(1)
            }}
            className="w-full h-11 pl-11 pr-4 text-sm bg-background border rounded-lg shadow-2xs"
          />
        </div>
      </div>

      {/* Painel de Reajuste FIXO / Sticky no TOPO (acima da tabela) */}
      <div className="sticky top-0 z-20 bg-card/95 backdrop-blur-md border rounded-xl p-4 shadow-sm transition-shadow">
        <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-end justify-between">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end flex-wrap flex-1">
            {/* Modo de ajuste */}
            <div className="w-full sm:w-auto">
              <Label className="text-sm font-medium mb-1.5 block text-foreground">
                Modo de Ajuste
              </Label>
              <Tabs
                value={mode}
                onValueChange={(v) => setMode(v as 'absolute' | 'percentage')}
                className="w-full sm:w-auto"
              >
                <TabsList className="h-10 p-1 w-full sm:w-auto">
                  <TabsTrigger
                    value="absolute"
                    className="text-sm font-medium px-4 h-8 flex-1 sm:flex-initial"
                  >
                    Novo Preço
                  </TabsTrigger>
                  <TabsTrigger
                    value="percentage"
                    className="text-sm font-medium px-4 h-8 flex-1 sm:flex-initial"
                  >
                    Percentual (%)
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {/* Campo de valor */}
            <div className="w-full sm:w-56">
              <Label className="text-sm font-medium mb-1.5 block text-foreground">
                {mode === 'absolute' ? 'Novo Valor (R$)' : 'Percentual (+/- %)'}
              </Label>
              <Input
                type="number"
                step="0.01"
                value={adjustValue}
                onChange={(e) => setAdjustValue(parseFloat(e.target.value) || 0)}
                className="h-10 text-sm font-medium bg-background"
                placeholder={mode === 'absolute' ? 'Ex: 150000' : 'Ex: 5 ou -3'}
              />
            </div>
          </div>

          {/* Botão de aplicar alterações */}
          <div className="flex items-center gap-3 shrink-0 pt-2 lg:pt-0">
            <Button
              size="lg"
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-6 h-10 shadow-sm gap-2 w-full lg:w-auto cursor-pointer"
              disabled={selected.size === 0 || applying}
              onClick={() => setConfirmOpen(true)}
            >
              {applying ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Aplicar Alterações ({selected.size})
            </Button>
          </div>
        </div>

        {/* Indicador de itens selecionados e instruções visuais claras para representantes */}
        <div className="mt-3 pt-3 border-t flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>
            {selected.size === 0 ? (
              'Selecione as versões na tabela abaixo para aplicar o reajuste.'
            ) : (
              <span className="font-medium text-foreground">
                {selected.size} versão(ões) selecionada(s) para reajuste.
              </span>
            )}
          </span>
          {selected.size > 0 && (
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="text-primary hover:underline font-medium cursor-pointer"
            >
              Limpar seleção
            </button>
          )}
        </div>
      </div>

      {appliedCount !== null && (
        <div className="flex items-center gap-2 p-4 border rounded-lg bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800">
          <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 shrink-0" />
          <p className="text-sm font-medium text-green-800 dark:text-green-200">
            {appliedCount} versão(ões) atualizada(s) com sucesso.
          </p>
        </div>
      )}

      {loading ? (
        <LoadingState count={5} />
      ) : error ? (
        <ErrorState message="Erro ao carregar versões" onRetry={loadData} />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="Nenhuma versão encontrada"
          description="Ajuste os filtros para ver versões."
        />
      ) : (
        <div className="space-y-2">
          <div className="border rounded-lg bg-card overflow-x-auto shadow-xs">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={selected.size === filtered.length && filtered.length > 0}
                      onCheckedChange={toggleAll}
                    />
                  </TableHead>
                  <TableHead>Versão</TableHead>
                  <TableHead>Modelo</TableHead>
                  <TableHead>Valor Atual</TableHead>
                  <TableHead>Novo Valor</TableHead>
                  <TableHead>Diferença</TableHead>
                  <TableHead className="text-right">Histórico</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.slice((page - 1) * pageSize, page * pageSize).map((v) => {
                  const isSel = selected.has(v.id)
                  const newValor = isSel
                    ? mode === 'absolute'
                      ? adjustValue
                      : v.valor * (1 + adjustValue / 100)
                    : null
                  const diff = newValor != null ? newValor - v.valor : null
                  return (
                    <TableRow key={v.id}>
                      <TableCell>
                        <Checkbox checked={isSel} onCheckedChange={() => toggleSel(v.id)} />
                      </TableCell>
                      <TableCell className="font-semibold text-sm">{v.nome}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {v.modelos?.nome ?? '—'}
                      </TableCell>
                      <TableCell className="text-xs font-mono">
                        {fmtValor(v.valor, v.moeda)}
                      </TableCell>
                      <TableCell className="text-xs font-mono">
                        {newValor != null ? fmtValor(newValor, v.moeda) : '—'}
                      </TableCell>
                      <TableCell className="text-xs">
                        {diff != null ? (
                          <Badge variant={diff >= 0 ? 'default' : 'destructive'}>
                            {diff >= 0 ? '+' : ''}
                            {fmtValor(diff, v.moeda)}
                          </Badge>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => setHistoryVersao(v)}>
                          <History className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
          <PaginationBar
            page={page}
            pageSize={pageSize}
            total={filtered.length}
            onPageChange={setPage}
            onPageSizeChange={(s) => {
              setPageSize(s)
              setPage(1)
            }}
            pageSizeOptions={[20, 25, 50, 100]}
            itemLabel="itens"
          />
        </div>
      )}

      <PriceHistoryDialog
        versao={historyVersao}
        open={!!historyVersao}
        onOpenChange={(o) => !o && setHistoryVersao(null)}
      />

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar alterações de preço</AlertDialogTitle>
            <p className="text-sm text-muted-foreground">
              {selected.size} versão(ões) serão atualizadas. O valor anterior será salvo no
              histórico. Deseja continuar?
            </p>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleApply} className="bg-primary">
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
