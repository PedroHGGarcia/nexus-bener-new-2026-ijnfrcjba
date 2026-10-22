import { useState, useEffect, useCallback } from 'react'
import { Shield, RotateCcw, Trash2, RefreshCw, AlertTriangle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { toast } from '@/hooks/use-toast'
import { LoadingState, EmptyState, ErrorState } from '@/components/StateViews'
import { formatDate } from '@/lib/format'
import {
  fetchQuarantineItems,
  restoreMachineItem,
  permanentlyDeleteMachineItem,
  daysRemaining,
  isReadyForPermanentDeletion,
  MACHINE_TABLE_LABEL,
  QUARANTINE_DAYS,
  type QuarantineItem,
  type MachineTable,
} from '@/services/machine-quarantine'

const TABLE_TABS: MachineTable[] = [
  'categorias_produtos',
  'produtos',
  'marcas',
  'modelos',
  'versoes',
]

export default function QuarentenaMaquinasPage() {
  const [items, setItems] = useState<QuarantineItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [activeTab, setActiveTab] = useState<MachineTable>('categorias_produtos')
  const [actionTarget, setActionTarget] = useState<QuarantineItem | null>(null)
  const [actionType, setActionType] = useState<'restore' | 'delete' | null>(null)
  const [processing, setProcessing] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const data = await fetchQuarantineItems()
      setItems(data)
      // Se a tab atual não tem itens mas outra tem, troca para a primeira com itens
      if (data.length > 0 && !data.some((i) => i.table === activeTab)) {
        const firstWithItems = TABLE_TABS.find((t) => data.some((i) => i.table === t))
        if (firstWithItems) setActiveTab(firstWithItems)
      }
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const itemsByTable = (table: MachineTable) => items.filter((i) => i.table === table)

  const openRestore = (item: QuarantineItem) => {
    setActionTarget(item)
    setActionType('restore')
  }
  const openDelete = (item: QuarantineItem) => {
    setActionTarget(item)
    setActionType('delete')
  }

  const handleConfirm = async () => {
    if (!actionTarget || !actionType) return
    setProcessing(true)
    try {
      if (actionType === 'restore') {
        await restoreMachineItem(actionTarget.table, actionTarget.id)
        toast({
          title: 'Item restaurado',
          description: `${actionTarget.nome} voltou para 'Ativo'.`,
        })
      } else {
        await permanentlyDeleteMachineItem(actionTarget.table, actionTarget.id)
        toast({
          title: 'Item excluído permanentemente',
          description: `${actionTarget.nome} foi removido do banco.`,
          variant: 'destructive',
        })
      }
      setActionTarget(null)
      setActionType(null)
      loadData()
    } catch (err) {
      toast({
        title: 'Erro',
        description: err instanceof Error ? err.message : 'Erro desconhecido',
        variant: 'destructive',
      })
    } finally {
      setProcessing(false)
    }
  }

  const totalItems = items.length
  const readyForDeletion = items.filter((i) => isReadyForPermanentDeletion(i.deleted_at)).length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-lg bg-amber-500/10 flex items-center justify-center">
            <Shield className="w-6 h-6 text-amber-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Quarentena 🛡️</h1>
            <p className="text-sm text-muted-foreground">
              Itens excluídos pelo Comercial aguardando revisão (até {QUARANTINE_DAYS} dias).
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={loadData}
          disabled={loading}
          className="gap-1.5"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          Atualizar
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Itens em quarentena</p>
            <p className="text-2xl font-bold mt-1">{totalItems}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Prontos para exclusão permanente</p>
            <p className="text-2xl font-bold mt-1 text-amber-600">{readyForDeletion}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Aguardando revisão</p>
            <p className="text-2xl font-bold mt-1 text-blue-600">
              {Math.max(0, totalItems - readyForDeletion)}
            </p>
          </CardContent>
        </Card>
      </div>

      {loading ? (
        <LoadingState count={4} />
      ) : error ? (
        <ErrorState message="Erro ao carregar itens em quarentena" onRetry={loadData} />
      ) : totalItems === 0 ? (
        <EmptyState
          title="Nenhum item em quarentena"
          description="Quando o Comercial excluir um item da hierarquia de máquinas, ele aparecerá aqui para revisão."
        />
      ) : (
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as MachineTable)}>
          <TabsList className="flex flex-wrap h-auto">
            {TABLE_TABS.map((t) => {
              const count = itemsByTable(t).length
              return (
                <TabsTrigger key={t} value={t} className="gap-1.5">
                  {MACHINE_TABLE_LABEL[t]}
                  {count > 0 && (
                    <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
                      {count}
                    </Badge>
                  )}
                </TabsTrigger>
              )
            })}
          </TabsList>

          {TABLE_TABS.map((t) => (
            <TabsContent key={t} value={t} className="space-y-3">
              {itemsByTable(t).length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  Nenhum item em quarentena nesta categoria.
                </p>
              ) : (
                itemsByTable(t).map((item) => {
                  const ready = isReadyForPermanentDeletion(item.deleted_at)
                  const remaining = daysRemaining(item.deleted_at)
                  return (
                    <Card
                      key={`${item.table}-${item.id}`}
                      className={
                        ready
                          ? 'border-amber-400 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/20'
                          : ''
                      }
                    >
                      <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold truncate">{item.nome}</span>
                            {ready ? (
                              <Badge className="bg-amber-500 hover:bg-amber-500 text-white gap-1">
                                <AlertTriangle className="w-3 h-3" />
                                Pronto para exclusão permanente
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-blue-600 border-blue-300">
                                Faltam {remaining} dia{remaining === 1 ? '' : 's'}
                              </Badge>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                            <span>
                              Excluído por:{' '}
                              <strong className="text-foreground">
                                {item.deleted_by_name ?? '—'}
                              </strong>
                            </span>
                            <span>
                              Em:{' '}
                              <strong className="text-foreground">
                                {formatDate(item.deleted_at)}
                              </strong>
                            </span>
                            <span>
                              Categoria:{' '}
                              <strong className="text-foreground">
                                {MACHINE_TABLE_LABEL[item.table]}
                              </strong>
                            </span>
                          </div>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openRestore(item)}
                            className="gap-1.5"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            Restaurar
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => openDelete(item)}
                            className="gap-1.5"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Excluir Permanentemente
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })
              )}
            </TabsContent>
          ))}
        </Tabs>
      )}

      {/* Confirmation dialog */}
      <Dialog
        open={!!actionTarget}
        onOpenChange={(open) => {
          if (!open) {
            setActionTarget(null)
            setActionType(null)
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {actionType === 'restore' ? 'Restaurar item' : 'Excluir permanentemente'}
            </DialogTitle>
            <DialogDescription>
              {actionType === 'restore' ? (
                <>
                  Deseja restaurar <strong>{actionTarget?.nome}</strong>? O status voltará para
                  'Ativo' e o item reaparecerá no catálogo. Os vínculos com níveis superiores da
                  hierarquia são mantidos.
                </>
              ) : (
                <>
                  Deseja excluir <strong>{actionTarget?.nome}</strong> permanentemente? Esta ação
                  não pode ser desfeita. Pode falhar se houver propostas ou registros vinculados.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setActionTarget(null)
                setActionType(null)
              }}
              disabled={processing}
            >
              Cancelar
            </Button>
            <Button
              variant={actionType === 'restore' ? 'default' : 'destructive'}
              onClick={handleConfirm}
              disabled={processing}
              className="gap-1.5"
            >
              {processing && <Loader2 className="w-4 h-4 animate-spin" />}
              {actionType === 'restore' ? 'Restaurar' : 'Excluir permanentemente'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
