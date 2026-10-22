import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  UserCheck,
  Scale,
} from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { LoadingState, EmptyState, ErrorState } from '@/components/StateViews'
import { useDebounce } from '@/hooks/use-debounce'
import { useAuth } from '@/hooks/use-auth'
import { ProjetoWithRelations, PROJETO_STATUS_OPTIONS } from '@/types/projeto'
import { fetchProjetos, deleteProjeto } from '@/services/projetos'
import { CreatorDisplay } from '@/components/projetos/CreatorDisplay'
import { formatDate } from '@/lib/format'

export default function ProjetosListPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [projetos, setProjetos] = useState<ProjetoWithRelations[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('Todos')
  const [showMyProjects, setShowMyProjects] = useState(false)
  const [pageSize, setPageSize] = useState('50')
  const [currentPage, setCurrentPage] = useState(1)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const debouncedSearch = useDebounce(search, 300)

  const roleLower = (user?.role || '').toLowerCase()
  const isVendedorOuRep = roleLower.includes('vendedor') || roleLower.includes('representante')

  const loadProjetos = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const data = await fetchProjetos({
        userId: user?.id,
        isVendedorOuRep,
      })
      setProjetos(data)
    } catch {
      setError(true)
      toast({ title: 'Erro ao carregar projetos', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [user?.id, isVendedorOuRep])

  useEffect(() => {
    loadProjetos()
  }, [loadProjetos])

  const filtered = useMemo(() => {
    const q = debouncedSearch.toLowerCase()
    return projetos.filter((p) => {
      const matchesSearch =
        !q ||
        p.nome.toLowerCase().includes(q) ||
        (p.clientes?.fantasia && p.clientes.fantasia.toLowerCase().includes(q))
      const matchesStatus = statusFilter === 'Todos' || p.status === statusFilter
      const matchesMyProjects = !showMyProjects || p.user === user?.id
      return matchesSearch && matchesStatus && matchesMyProjects
    })
  }, [projetos, debouncedSearch, statusFilter, showMyProjects, user?.id])

  const itemsPerPage = parseInt(pageSize, 10)
  const totalPages = Math.ceil(filtered.length / itemsPerPage) || 1
  const paginatedProjects = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    return filtered.slice(start, start + itemsPerPage)
  }, [filtered, currentPage, itemsPerPage])

  const handleDelete = async () => {
    if (!deletingId) return
    try {
      await deleteProjeto(deletingId)
      toast({ title: 'Projeto excluído com sucesso' })
      setProjetos((prev) => prev.filter((p) => p.id !== deletingId))
    } catch {
      toast({ title: 'Erro ao excluir projeto', variant: 'destructive' })
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex flex-col sm:flex-row items-center gap-3 flex-1">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              placeholder="Buscar projetos..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setCurrentPage(1)
              }}
              className="pl-9 bg-card rounded-full border-border h-10 text-sm focus-visible:ring-[#0b3c26]"
            />
          </div>
          <Select
            value={statusFilter}
            onValueChange={(val) => {
              setStatusFilter(val)
              setCurrentPage(1)
            }}
          >
            <SelectTrigger className="w-full sm:w-36 bg-card rounded-full border-border h-10 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Todos">Todos</SelectItem>
              {PROJETO_STATUS_OPTIONS.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant={showMyProjects ? 'default' : 'outline'}
            onClick={() => {
              setShowMyProjects(!showMyProjects)
              setCurrentPage(1)
            }}
            className="h-10 rounded-full px-4 gap-2 shrink-0"
            aria-pressed={showMyProjects}
            aria-label="Filtrar apenas meus projetos"
          >
            <UserCheck className="w-4 h-4" />
            <span className="text-sm font-medium">Meus Projetos</span>
          </Button>
        </div>

        <Button
          onClick={() => navigate('/projetos/novo')}
          className="bg-[#0b3c26] hover:bg-[#082e1d] text-white rounded-full px-5 h-10 font-semibold gap-2 shadow-sm text-sm shrink-0"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" /> Novo Projeto
        </Button>
      </div>

      {loading ? (
        <LoadingState count={5} />
      ) : error ? (
        <ErrorState message="Erro ao carregar projetos" onRetry={loadProjetos} />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="Nenhum projeto encontrado"
          description="Não há projetos cadastrados ou que correspondam aos filtros aplicados."
          actionText="Novo Projeto"
          onAction={() => navigate('/projetos/novo')}
        />
      ) : (
        <div className="bg-card rounded-xl border border-border/80 shadow-sm overflow-x-auto">
          <Table>
            <TableHeader className="bg-transparent">
              <TableRow className="border-b border-border/60 hover:bg-transparent">
                <TableHead className="font-semibold text-muted-foreground text-xs py-4">
                  Nome do Projeto
                </TableHead>
                <TableHead className="font-semibold text-muted-foreground text-xs py-4">
                  Cliente
                </TableHead>
                <TableHead className="font-semibold text-muted-foreground text-xs py-4 hidden md:table-cell">
                  Criado por
                </TableHead>
                <TableHead className="font-semibold text-muted-foreground text-xs py-4">
                  Status
                </TableHead>
                <TableHead className="font-semibold text-muted-foreground text-xs py-4">
                  Criado em
                </TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedProjects.map((proj) => (
                <TableRow
                  key={proj.id}
                  className="hover:bg-muted/30 transition-colors border-b border-border/40"
                >
                  <TableCell
                    className="font-bold text-foreground cursor-pointer py-4"
                    onClick={() => navigate(`/projetos/${proj.id}`)}
                  >
                    <div className="flex items-center gap-2">
                      <span>{proj.nome}</span>
                      {proj.has_licitacao && (
                        <Badge className="bg-amber-50 text-amber-700 border border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-700 font-medium px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wide flex items-center gap-1">
                          <Scale className="w-3 h-3" />
                          Licitação
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground py-4">
                    {proj.clientes?.fantasia ?? '—'}
                  </TableCell>
                  <TableCell className="py-4 hidden md:table-cell">
                    <CreatorDisplay
                      creator={proj.creator}
                      rawUser={proj.user}
                      showEmail={false}
                      size="sm"
                    />
                  </TableCell>
                  <TableCell className="py-4">
                    <Badge
                      className={
                        proj.status === 'Concluido' || proj.status === 'Concluído'
                          ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-none font-medium px-3 py-1 rounded-full text-xs'
                          : 'bg-blue-100 text-blue-800 hover:bg-blue-100 border-none font-medium px-3 py-1 rounded-full text-xs'
                      }
                    >
                      {proj.status === 'Concluido' ? 'Concluído' : proj.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground py-4">
                    {formatDate(proj.created_at)}
                  </TableCell>
                  <TableCell className="text-right py-4">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => navigate(`/projetos/${proj.id}/editar`)}
                        className="h-8 w-8 text-foreground/80 hover:text-foreground hover:bg-accent/60 rounded-full"
                        aria-label="Editar"
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeletingId(proj.id)}
                        className="h-8 w-8 text-rose-500 hover:text-rose-600 hover:bg-rose-50 rounded-full"
                        aria-label="Excluir"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="flex flex-col sm:flex-row items-center justify-between px-5 py-4 border-t border-border/60 text-xs text-muted-foreground gap-3">
            <div>
              {filtered.length > 0 ? (
                <span>
                  1–{filtered.length} de {filtered.length}
                </span>
              ) : (
                <span>0 de 0</span>
              )}
            </div>

            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <span>Itens por página</span>
                <Select
                  value={pageSize}
                  onValueChange={(val) => {
                    setPageSize(val)
                    setCurrentPage(1)
                  }}
                >
                  <SelectTrigger className="h-8 w-16 text-xs bg-card border-border rounded-md">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-1.5">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 rounded-full text-muted-foreground hover:text-foreground"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <div className="w-7 h-7 rounded-full bg-[#0b3c26] text-white flex items-center justify-center font-bold text-xs">
                  {currentPage}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 rounded-full text-muted-foreground hover:text-foreground"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <AlertDialog open={!!deletingId} onOpenChange={() => setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este projeto? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
