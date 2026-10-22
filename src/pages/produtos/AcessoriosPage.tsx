import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog'
import { Search, Plus, Edit, Trash2, Eye } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { useAuth } from '@/hooks/use-auth'
import { isRepresentanteRole } from '@/components/RoleGuard'
import { LoadingState, EmptyState, ErrorState } from '@/components/StateViews'
import { formatDate, formatCurrency } from '@/lib/format'
import { Acessorio } from '@/types/acessorio'
import { fetchAcessorios, deleteAcessorio } from '@/services/acessorios'
import { AcessorioForm } from '@/components/produtos/AcessorioForm'
import { AcessorioDetalhesDialog } from '@/components/produtos/AcessorioDetalhesDialog'
import { PaginationBar } from '@/components/shared/table-controls'

export default function AcessoriosPage() {
  const { user } = useAuth()
  const canEdit = !isRepresentanteRole(user?.role)
  const [data, setData] = useState<Acessorio[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [search, setSearch] = useState('')
  const [tipoFilter, setTipoFilter] = useState('Todos')
  const [statusFilter, setStatusFilter] = useState('Todos')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Acessorio | null>(null)
  const [viewing, setViewing] = useState<Acessorio | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Acessorio | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      setData(await fetchAcessorios())
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const tipos = useMemo(() => {
    const set = new Set(data.filter((d) => d.tipo).map((d) => d.tipo!))
    return ['Todos', ...Array.from(set)]
  }, [data])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return data.filter((d) => {
      const ms = !q || d.nome.toLowerCase().includes(q)
      const mt = tipoFilter === 'Todos' || d.tipo === tipoFilter
      const mst = statusFilter === 'Todos' || d.status === statusFilter
      return ms && mt && mst
    })
  }, [data, search, tipoFilter, statusFilter])

  const handleNew = () => {
    if (!canEdit) return
    setEditing(null)
    setFormOpen(true)
  }
  const handleRowClick = (item: Acessorio) => {
    if (canEdit) {
      setEditing(item)
      setFormOpen(true)
    } else {
      setViewing(item)
    }
  }
  const handleEdit = (item: Acessorio) => {
    if (!canEdit) return
    setEditing(item)
    setFormOpen(true)
  }
  const handleView = (item: Acessorio) => {
    setViewing(item)
  }
  const handleSaved = () => {
    loadData()
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteAcessorio(deleteTarget.id, user?.id, user?.name)
      toast({ title: 'Acessório excluído' })
      setDeleteTarget(null)
      loadData()
    } catch (err) {
      toast({
        title: 'Erro',
        description: err instanceof Error ? err.message : '',
        variant: 'destructive',
      })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Acessórios Opcionais</h1>
          {!canEdit && (
            <p className="text-xs text-muted-foreground mt-0.5">
              Modo de visualização (somente leitura). Clique em um acessório para ver detalhes.
            </p>
          )}
        </div>
        {canEdit && (
          <Button onClick={handleNew} className="bg-primary gap-1.5">
            <Plus className="w-4 h-4" /> Novo Acessório
          </Button>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            placeholder="Buscar por nome..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            className="pl-9"
          />
        </div>
        <Select
          value={tipoFilter}
          onValueChange={(val) => {
            setTipoFilter(val)
            setPage(1)
          }}
        >
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {tipos.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={statusFilter}
          onValueChange={(val) => {
            setStatusFilter(val)
            setPage(1)
          }}
        >
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Todos">Todos</SelectItem>
            <SelectItem value="Ativo">Ativo</SelectItem>
            <SelectItem value="Inativo">Inativo</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <LoadingState count={5} />
      ) : error ? (
        <ErrorState message="Erro ao carregar acessórios" onRetry={loadData} />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="Nenhum acessório encontrado"
          description={
            canEdit
              ? 'Cadastre um novo acessório para começar.'
              : 'Nenhum acessório disponível com os filtros aplicados.'
          }
          actionText={canEdit ? 'Novo Acessório' : undefined}
          onAction={canEdit ? handleNew : undefined}
        />
      ) : (
        <div className="space-y-2">
          <div className="border rounded-lg bg-card overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Moeda</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Fator NAC</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Versões</TableHead>
                  <TableHead>Atualizado</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.slice((page - 1) * pageSize, page * pageSize).map((d) => (
                  <TableRow
                    key={d.id}
                    className="cursor-pointer hover:bg-accent/50"
                    onClick={() => handleRowClick(d)}
                  >
                    <TableCell className="font-semibold">{d.nome}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{d.tipo ?? '—'}</TableCell>
                    <TableCell className="text-xs">{d.moeda ?? '—'}</TableCell>
                    <TableCell className="text-xs font-mono">
                      {d.valor != null ? formatCurrency(d.valor) : '—'}
                    </TableCell>
                    <TableCell className="text-xs">{d.fator_nac ?? '—'}</TableCell>
                    <TableCell>
                      <Badge variant={d.status === 'Ativo' ? 'default' : 'secondary'}>
                        {d.status ?? '—'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      {Array.isArray(d.versoes) && d.versoes.length > 0 ? (
                        <Badge variant="outline" className="font-mono text-xs font-semibold">
                          {d.versoes.length} {d.versoes.length === 1 ? 'versão' : 'versões'}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground font-mono">0</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">{formatDate(d.updated_at)}</TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      {canEdit ? (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Editar"
                            onClick={() => handleEdit(d)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Excluir"
                            className="text-destructive"
                            onClick={() => setDeleteTarget(d)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </>
                      ) : (
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Visualizar Detalhes"
                          onClick={() => handleView(d)}
                        >
                          <Eye className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
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

      {canEdit && (
        <AcessorioForm
          open={formOpen}
          onOpenChange={setFormOpen}
          editing={editing}
          onSaved={handleSaved}
          userName={user?.name}
          userId={user?.id}
        />
      )}

      <AcessorioDetalhesDialog
        open={!!viewing}
        onOpenChange={(o) => !o && setViewing(null)}
        acessorio={viewing}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <p className="text-sm text-muted-foreground">
              Excluir <strong>{deleteTarget?.nome}</strong>?
            </p>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deleting ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
