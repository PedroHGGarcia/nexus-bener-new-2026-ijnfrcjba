import { useState, useEffect, useCallback, useMemo } from 'react'
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
import { Badge } from '@/components/ui/badge'
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
import {
  Plus,
  Search,
  Trash2,
  Edit,
  ChevronLeft,
  ChevronRight,
  Building2,
  MapPin,
} from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { toast } from '@/hooks/use-toast'
import { LoadingState, EmptyState, ErrorState } from '@/components/StateViews'
import { RegiaoFormDialog } from '@/components/regioes/RegiaoFormDialog'
import { useDebounce } from '@/hooks/use-debounce'
import { Regiao } from '@/types/regiao'
import { fetchRegioes, deleteRegiao } from '@/services/regioes'

const PAGE_SIZE = 10

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${dd}/${mm}/${yyyy}`
}

export default function RegioesPage() {
  const [regioes, setRegioes] = useState<Regiao[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('Todos')
  const [page, setPage] = useState(0)
  const [openModal, setOpenModal] = useState(false)
  const [editing, setEditing] = useState<Regiao | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Regiao | null>(null)
  const [deleting, setDeleting] = useState(false)

  const debouncedSearch = useDebounce(search, 300)

  const loadRegioes = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const data = await fetchRegioes()
      setRegioes(data)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadRegioes()
  }, [loadRegioes])

  const filtered = useMemo(() => {
    const q = debouncedSearch.toLowerCase()
    return regioes.filter((r) => {
      const matchesSearch = !q || r.nome.toLowerCase().includes(q)
      const matchesStatus = statusFilter === 'Todos' || r.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [regioes, debouncedSearch, statusFilter])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages - 1)
  const paginated = filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE)

  useEffect(() => {
    setPage(0)
  }, [debouncedSearch, statusFilter])

  const openCreate = () => {
    setEditing(null)
    setOpenModal(true)
  }

  const openEdit = (r: Regiao) => {
    setEditing(r)
    setOpenModal(true)
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteRegiao(deleteTarget.id)
      toast({ title: 'Região excluída com sucesso' })
      setDeleteTarget(null)
      loadRegioes()
    } catch (err) {
      toast({
        title: 'Erro ao excluir',
        description: err instanceof Error ? err.message : 'Erro desconhecido',
        variant: 'destructive',
      })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Regiões Comerciais</h1>
          <p className="text-sm text-muted-foreground">
            Gerencie a base de regiões da Bener Máquinas
          </p>
        </div>
        <Button onClick={openCreate} className="bg-primary gap-1.5">
          <Plus className="w-4 h-4" /> Nova Região
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            placeholder="Buscar por nome..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
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
        <ErrorState message="Erro ao carregar registros" onRetry={loadRegioes} />
      ) : paginated.length === 0 ? (
        <EmptyState
          title="Nenhum registro encontrado"
          description="Não há regiões cadastradas ou que correspondam aos filtros aplicados."
          actionText="Nova Região"
          onAction={openCreate}
        />
      ) : (
        <>
          <div className="border rounded-lg bg-card overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>UF</TableHead>
                  <TableHead>Cobertura Territorial</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data Cadastro</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map((r) => (
                  <TableRow
                    key={r.id}
                    className="cursor-pointer hover:bg-accent/50"
                    onClick={() => openEdit(r)}
                  >
                    <TableCell className="font-semibold">{r.nome}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className="font-mono text-xs font-bold text-emerald-800 bg-emerald-50 border-emerald-200"
                      >
                        {r.uf || '—'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {r.todo_o_estado || !r.cidades || r.cidades.length === 0 ? (
                        <div className="flex items-center gap-1.5 text-xs text-slate-700 font-medium">
                          <Building2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Todo o estado ({r.uf || 'UF'})</span>
                        </div>
                      ) : (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex items-center gap-1.5 cursor-help">
                                <Badge
                                  variant="secondary"
                                  className="gap-1 text-xs bg-slate-100 text-slate-800 border-slate-200 hover:bg-slate-200"
                                >
                                  <MapPin className="w-3 h-3 text-emerald-700" />
                                  {r.cidades.length} cidade(s) de {r.uf}
                                </Badge>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs text-xs">
                              <p className="font-semibold mb-1 text-emerald-300">
                                Cidades cobertas:
                              </p>
                              <p className="line-clamp-4">{r.cidades.join(', ')}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={r.status === 'Ativo' ? 'default' : 'secondary'}>
                        {r.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">{formatDate(r.created_at)}</TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" onClick={() => openEdit(r)}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive"
                        onClick={() => setDeleteTarget(r)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {filtered.length} registro(s) — Página {currentPage + 1} de {totalPages}
            </p>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="icon"
                disabled={currentPage === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                disabled={currentPage >= totalPages - 1}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </>
      )}

      <RegiaoFormDialog
        open={openModal}
        onOpenChange={setOpenModal}
        editing={editing}
        onSaved={loadRegioes}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <p className="text-sm text-muted-foreground">
              Deseja realmente excluir a região <strong>{deleteTarget?.nome}</strong>? Esta ação não
              pode ser desfeita.
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
