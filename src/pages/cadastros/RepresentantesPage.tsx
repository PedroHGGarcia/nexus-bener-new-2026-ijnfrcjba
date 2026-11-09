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
  Layers,
  MapPin,
  UserCheck,
} from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useNavigate } from 'react-router-dom'
import { toast } from '@/hooks/use-toast'
import { LoadingState, EmptyState, ErrorState } from '@/components/StateViews'
import { RepresentanteFormDialog } from '@/components/representantes/RepresentanteFormDialog'
import { RepresentanteAnotacoesDialog } from '@/components/representantes/RepresentanteAnotacoesDialog'
import { useDebounce } from '@/hooks/use-debounce'
import { Representante } from '@/types/representante'
import { fetchRepresentantes, deleteRepresentante } from '@/services/representantes'
import { useAuth } from '@/hooks/use-auth'
import { isAdminRole, isGerenteRole } from '@/components/RoleGuard'
import { FileText } from 'lucide-react'

const PAGE_SIZE = 10

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${dd}/${mm}/${yyyy}`
}

export default function RepresentantesPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const canManageAnotacoes = isAdminRole(user?.role) || isGerenteRole(user?.role)

  const [reps, setReps] = useState<Representante[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('Todos')
  const [page, setPage] = useState(0)
  const [openModal, setOpenModal] = useState(false)
  const [anotacoesRep, setAnotacoesRep] = useState<Representante | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Representante | null>(null)
  const [deleting, setDeleting] = useState(false)

  const debouncedSearch = useDebounce(search, 300)

  const loadReps = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const data = await fetchRepresentantes()
      setReps(data)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadReps()
  }, [loadReps])

  const filtered = useMemo(() => {
    const q = debouncedSearch.toLowerCase()
    return reps.filter((r) => {
      const matchesSearch =
        !q ||
        r.fantasia.toLowerCase().includes(q) ||
        (r.razao_social ?? '').toLowerCase().includes(q) ||
        (r.documento ?? '').toLowerCase().includes(q) ||
        (r.sigla ?? '').toLowerCase().includes(q) ||
        (r.email ?? '').toLowerCase().includes(q) ||
        (r.cidade ?? '').toLowerCase().includes(q) ||
        (r.estado ?? '').toLowerCase().includes(q) ||
        (r.cod ?? '').toLowerCase().includes(q) ||
        (r.gerente?.nome ?? '').toLowerCase().includes(q) ||
        (r.reg !== null && r.reg !== undefined && String(r.reg).includes(q))
      const matchesStatus = statusFilter === 'Todos' || r.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [reps, debouncedSearch, statusFilter])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages - 1)
  const paginated = filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE)

  useEffect(() => {
    setPage(0)
  }, [debouncedSearch, statusFilter])

  const openCreate = () => {
    setEditingId(null)
    setOpenModal(true)
  }

  const openEdit = (r: Representante) => {
    setEditingId(r.id)
    setOpenModal(true)
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteRepresentante(deleteTarget.id)
      toast({ title: 'Representante excluído com sucesso' })
      setDeleteTarget(null)
      loadReps()
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
          <h1 className="text-2xl font-bold tracking-tight">Representantes Comerciais</h1>
          <p className="text-sm text-muted-foreground">
            Gerencie a base de representantes da Bener Máquinas
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={openCreate} className="bg-primary gap-1.5">
            <Plus className="w-4 h-4" /> Novo Representante
          </Button>
        </div>
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
        <ErrorState message="Erro ao carregar registros" onRetry={loadReps} />
      ) : paginated.length === 0 ? (
        <EmptyState
          title="Nenhum registro encontrado"
          description="Não há representantes cadastrados ou que correspondam aos filtros aplicados."
          actionText="Novo Representante"
          onAction={openCreate}
        />
      ) : (
        <>
          <div className="border rounded-lg bg-card overflow-x-auto shadow-sm">
            <Table className="w-full table-fixed">
              <colgroup>
                <col className="w-[60px]" />
                <col className="w-[24%]" />
                <col className="w-[18%]" />
                <col className="w-[18%]" />
                <col className="w-[14%]" />
                <col className="w-[85px]" />
                <col className="w-[80px]" />
                <col className="w-[80px]" />
                <col className="w-[130px]" />
              </colgroup>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="w-16 whitespace-nowrap">Reg</TableHead>
                  <TableHead>Razão Social / Fantasia</TableHead>
                  <TableHead>Gerente</TableHead>
                  <TableHead>E-mail / Telefone</TableHead>
                  <TableHead>Cidade / UF</TableHead>
                  <TableHead className="text-center whitespace-nowrap">Categ.</TableHead>
                  <TableHead className="text-center whitespace-nowrap">Regiões</TableHead>
                  <TableHead className="whitespace-nowrap">Status</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map((r) => (
                  <TableRow
                    key={r.id}
                    className="cursor-pointer hover:bg-accent/50 transition-colors"
                    onClick={() => openEdit(r)}
                  >
                    <TableCell className="font-mono text-xs text-muted-foreground font-semibold py-2.5 px-3 truncate">
                      {r.reg ?? '—'}
                    </TableCell>
                    <TableCell className="py-2.5 px-3 overflow-hidden">
                      <div
                        className="font-semibold text-sm text-foreground truncate"
                        title={r.razao_social || r.fantasia}
                      >
                        {r.razao_social || r.fantasia}
                      </div>
                      {r.razao_social && r.fantasia && r.razao_social !== r.fantasia && (
                        <div className="text-xs text-muted-foreground truncate" title={r.fantasia}>
                          Fantasia: {r.fantasia}
                        </div>
                      )}
                      {r.documento && (
                        <div className="text-[11px] font-mono text-muted-foreground/80 truncate">
                          Doc: {r.documento}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="py-2.5 px-3 overflow-hidden">
                      {r.gerente ? (
                        <Badge
                          variant="outline"
                          className="gap-1.5 text-xs bg-emerald-50/60 border-emerald-200 text-emerald-900 font-medium py-1 px-2 max-w-full"
                          title={r.gerente.nome}
                        >
                          <UserCheck className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                          <span className="truncate">{r.gerente.nome}</span>
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground/70 italic">Sem vínculo</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground py-2.5 px-3 overflow-hidden">
                      <div
                        className="truncate"
                        title={r.email || (r.emails && r.emails[0]) || undefined}
                      >
                        {r.email || (r.emails && r.emails[0]) || '—'}
                      </div>
                      <div className="text-[11px] text-muted-foreground/80 truncate">
                        {r.celular || r.telefone || r.telefone_principal || '—'}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground py-2.5 px-3 overflow-hidden">
                      {r.cidade ? (
                        <div>
                          <span className="truncate block" title={r.cidade}>
                            {r.cidade}
                          </span>
                          {r.estado && (
                            <span className="text-[11px] text-muted-foreground/80 block">
                              UF: {r.estado}
                            </span>
                          )}
                        </div>
                      ) : r.estado ? (
                        <span className="font-medium text-foreground">{r.estado}</span>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell className="text-center py-2.5 px-2">
                      <Badge variant="outline" className="gap-1 text-xs">
                        <Layers className="w-3 h-3 text-[#0b3c26]" />
                        {r.total_categorias ?? (r.categorias ? r.categorias.length : 0)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center py-2.5 px-2">
                      {r.regioes && r.regioes.length > 0 ? (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge
                                variant="outline"
                                className="gap-1 text-xs bg-emerald-50/50 border-emerald-200 text-emerald-800 cursor-help"
                              >
                                <MapPin className="w-3 h-3 text-emerald-700" />
                                {r.total_regioes ?? r.regioes.length}
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs text-xs space-y-1">
                              <p className="font-semibold text-emerald-300">Regiões atendidas:</p>
                              {r.regioes.map((reg) => {
                                const isTodo =
                                  reg.todo_o_estado || !reg.cidades || reg.cidades.length === 0
                                return (
                                  <div key={reg.id} className="text-[11px]">
                                    <strong>{reg.nome}</strong> ({reg.uf || 'UF'}) —{' '}
                                    {isTodo ? (
                                      <span className="text-slate-300">Todo o estado</span>
                                    ) : (
                                      <span className="text-emerald-200">
                                        {reg.cidades?.length} cidades (
                                        {reg.cidades?.slice(0, 3).join(', ')}
                                        {(reg.cidades?.length || 0) > 3 ? '...' : ''})
                                      </span>
                                    )}
                                  </div>
                                )
                              })}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : (
                        <Badge
                          variant="outline"
                          className="gap-1 text-xs bg-slate-50 border-slate-200 text-slate-500"
                        >
                          <MapPin className="w-3 h-3 text-slate-400" />0
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={r.status === 'Ativo' ? 'default' : 'secondary'}>
                        {r.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      {canManageAnotacoes && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2 text-xs text-emerald-800 dark:text-emerald-300 hover:text-emerald-950 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 gap-1 mr-1"
                          onClick={() => setAnotacoesRep(r)}
                          title="Anotações sobre alinhamento da região"
                        >
                          <FileText className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                          <span className="hidden sm:inline">Anotações</span>
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEdit(r)}
                        title="Editar"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive"
                        onClick={() => setDeleteTarget(r)}
                        title="Excluir"
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

      <RepresentanteFormDialog
        open={openModal}
        onOpenChange={setOpenModal}
        editing={reps.find((r) => r.id === editingId) || null}
        onSaved={loadReps}
      />

      <RepresentanteAnotacoesDialog
        open={!!anotacoesRep}
        onOpenChange={(open) => !open && setAnotacoesRep(null)}
        representante={anotacoesRep}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <p className="text-sm text-muted-foreground">
              Deseja realmente excluir o representante <strong>{deleteTarget?.fantasia}</strong>?
              Esta ação não pode ser desfeita.
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
