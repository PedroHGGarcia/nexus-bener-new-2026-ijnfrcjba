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
  Users,
  Eye,
  Building2,
  Link2,
} from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { LoadingState, EmptyState, ErrorState } from '@/components/StateViews'
import { GerenteFormDialog } from '@/components/gerentes/GerenteFormDialog'
import { GerenteVinculosDialog } from '@/components/gerentes/GerenteVinculosDialog'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { useDebounce } from '@/hooks/use-debounce'
import { useAuth } from '@/hooks/use-auth'
import { isAdminRole } from '@/components/RoleGuard'
import { Gerente } from '@/types/gerente'
import { fetchGerentes, deleteGerente } from '@/services/gerentes'

const PAGE_SIZE = 10

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${dd}/${mm}/${yyyy}`
}

export default function GerentesPage() {
  const { user } = useAuth()
  const isAdmin = isAdminRole(user?.role)

  const [gerentes, setGerentes] = useState<Gerente[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('Todos')
  const [page, setPage] = useState(0)
  const [openModal, setOpenModal] = useState(false)
  const [editing, setEditing] = useState<Gerente | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Gerente | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [viewRepsGerente, setViewRepsGerente] = useState<Gerente | null>(null)
  const [manageVinculosGerente, setManageVinculosGerente] = useState<Gerente | null>(null)

  const debouncedSearch = useDebounce(search, 300)

  const loadGerentes = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const data = await fetchGerentes()
      setGerentes(data)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadGerentes()
  }, [loadGerentes])

  const filtered = useMemo(() => {
    const q = debouncedSearch.toLowerCase()
    return gerentes.filter((g) => {
      const matchesSearch =
        !q ||
        g.nome.toLowerCase().includes(q) ||
        (g.cargo && g.cargo.toLowerCase().includes(q)) ||
        (g.categoria_restrita && g.categoria_restrita.nome.toLowerCase().includes(q))
      const matchesStatus = statusFilter === 'Todos' || g.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [gerentes, debouncedSearch, statusFilter])

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

  const openEdit = (g: Gerente) => {
    setEditing(g)
    setOpenModal(true)
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteGerente(deleteTarget.id)
      toast({ title: 'Gerente excluído com sucesso' })
      setDeleteTarget(null)
      loadGerentes()
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
          <h1 className="text-2xl font-bold tracking-tight">Gerentes de Contas</h1>
          <p className="text-sm text-muted-foreground">
            Gerencie a base de gerentes da Bener Máquinas
          </p>
        </div>
        <Button onClick={openCreate} className="bg-primary gap-1.5">
          <Plus className="w-4 h-4" /> Novo Gerente
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
        <ErrorState message="Erro ao carregar registros" onRetry={loadGerentes} />
      ) : paginated.length === 0 ? (
        <EmptyState
          title="Nenhum registro encontrado"
          description="Não há gerentes cadastrados ou que correspondam aos filtros aplicados."
          actionText="Novo Gerente"
          onAction={openCreate}
        />
      ) : (
        <>
          <div className="border rounded-lg bg-card overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead className="text-center">Representantes Vinculados</TableHead>
                  <TableHead>Catálogo Restrito</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Celular</TableHead>
                  <TableHead>RD Station ID</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data Cadastro</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map((g) => (
                  <TableRow
                    key={g.id}
                    className="cursor-pointer hover:bg-accent/50"
                    onClick={() => openEdit(g)}
                  >
                    <TableCell className="font-semibold">{g.nome}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {g.cargo || '—'}
                    </TableCell>
                    <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                      {(g.total_representantes ?? 0) > 0 ? (
                        <button
                          type="button"
                          onClick={() => setViewRepsGerente(g)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 transition-colors cursor-pointer"
                          title="Clique para ver a lista de representantes vinculados"
                        >
                          <Users className="w-3.5 h-3.5 text-emerald-700" />
                          <span>
                            {g.total_representantes}{' '}
                            {g.total_representantes === 1 ? 'representante' : 'representantes'}
                          </span>
                        </button>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground/70">
                          <Users className="w-3.5 h-3.5 text-muted-foreground/50" />0
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">
                      {g.categoria_restrita ? (
                        <Badge
                          variant="secondary"
                          className="font-normal text-xs bg-muted text-foreground/80 border border-border"
                          title={`Vendedores vinculados só veem produtos da categoria ${g.categoria_restrita.nome}`}
                        >
                          {g.categoria_restrita.nome}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground/80">Livre</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {g.email || '—'}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {g.celular || '—'}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {g.rd_station_id || '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={g.status === 'Ativo' ? 'default' : 'secondary'}>
                        {g.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">{formatDate(g.created_at)}</TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        {isAdmin && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2 text-xs text-emerald-800 hover:text-emerald-900 hover:bg-emerald-50 gap-1.5"
                            onClick={() => setManageVinculosGerente(g)}
                            title="Gerenciar vínculos de representantes e vendedores"
                          >
                            <Link2 className="w-3.5 h-3.5 text-emerald-700" />
                            <span className="hidden sm:inline font-medium">Vincular</span>
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(g)}
                          title="Editar gerente"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive"
                          onClick={() => setDeleteTarget(g)}
                          title="Excluir gerente"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
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

      <GerenteFormDialog
        open={openModal}
        onOpenChange={setOpenModal}
        editing={editing}
        onSaved={loadGerentes}
      />

      {/* Modal limpo e legível com lista de representantes vinculados */}
      <Dialog open={!!viewRepsGerente} onOpenChange={(open) => !open && setViewRepsGerente(null)}>
        <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <div className="flex items-center justify-between gap-2">
              <DialogTitle className="flex items-center gap-2 text-lg text-foreground">
                <Users className="w-5 h-5 text-emerald-700" />
                Representantes Vinculados a {viewRepsGerente?.nome}
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-muted-foreground">
              {viewRepsGerente?.cargo ? `${viewRepsGerente.cargo} • ` : ''}
              {viewRepsGerente?.total_representantes ?? 0} representante(s) sob responsabilidade
              deste gerente
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto pr-1 mt-2 space-y-2">
            {!viewRepsGerente?.representantes || viewRepsGerente.representantes.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground border border-dashed rounded-lg">
                Nenhum representante vinculado a este gerente no momento.
              </div>
            ) : (
              <div className="divide-y border rounded-lg overflow-hidden bg-card">
                {viewRepsGerente.representantes.map((rep) => (
                  <div
                    key={rep.id}
                    className="p-3.5 hover:bg-accent/40 flex items-start justify-between gap-3 transition-colors"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-emerald-700 shrink-0" />
                        <span className="font-semibold text-sm text-foreground truncate">
                          {rep.razao_social || rep.fantasia}
                        </span>
                      </div>
                      {rep.razao_social && rep.fantasia && rep.razao_social !== rep.fantasia && (
                        <p className="text-xs text-muted-foreground pl-6">
                          Fantasia: {rep.fantasia}
                        </p>
                      )}
                      <div className="text-xs text-muted-foreground pl-6 flex flex-wrap gap-x-4 gap-y-0.5">
                        {rep.cidade && (
                          <span>
                            {rep.cidade}
                            {rep.estado ? ` - ${rep.estado}` : ''}
                          </span>
                        )}
                        {rep.email && <span>{rep.email}</span>}
                        {rep.telefone && <span>{rep.telefone}</span>}
                      </div>
                    </div>
                    <Badge
                      variant={rep.status === 'Ativo' ? 'default' : 'secondary'}
                      className="text-[11px] shrink-0"
                    >
                      {rep.status || 'Ativo'}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>

          {isAdmin && viewRepsGerente && (
            <div className="pt-3 border-t flex justify-end">
              <Button
                type="button"
                onClick={() => {
                  const g = viewRepsGerente
                  setViewRepsGerente(null)
                  setManageVinculosGerente(g)
                }}
                className="bg-emerald-700 hover:bg-emerald-800 text-white gap-1.5 text-xs h-9"
              >
                <Link2 className="w-3.5 h-3.5" />
                Gerenciar Vínculos deste Gerente
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Gerenciador completo de vínculos (Admin) */}
      <GerenteVinculosDialog
        open={!!manageVinculosGerente}
        onOpenChange={(open) => !open && setManageVinculosGerente(null)}
        gerente={manageVinculosGerente}
        onVinculosChanged={async () => {
          await loadGerentes()
          // Atualiza o objeto manageVinculosGerente com o estado mais recente
          if (manageVinculosGerente) {
            try {
              const updatedList = await fetchGerentes()
              const fresh = updatedList.find((g) => g.id === manageVinculosGerente.id)
              if (fresh) setManageVinculosGerente(fresh)
            } catch {
              // Silently ignore background refresh error
            }
          }
        }}
      />
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <p className="text-sm text-muted-foreground">
              Deseja realmente excluir o gerente <strong>{deleteTarget?.nome}</strong>? Esta ação
              não pode ser desfeita.
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
