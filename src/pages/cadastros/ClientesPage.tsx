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
import { PaginationBar } from '@/components/shared/table-controls'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Trash2, Edit, UserCheck, Cpu, Eye } from 'lucide-react'
import { isAdminRole, isGerenteRole } from '@/components/RoleGuard'
import { useAuth } from '@/hooks/use-auth'
import { toast } from '@/hooks/use-toast'
import { LoadingState, EmptyState, ErrorState } from '@/components/StateViews'
import { ClienteFormDialog } from '@/components/clientes/ClienteFormDialog'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { useDebounce } from '@/hooks/use-debounce'
import { Cliente } from '@/types/cliente'
import { fetchClientes, deleteCliente } from '@/services/clientes'
import { findRepresentanteByProfile } from '@/services/representantes'

const PAGE_SIZE = 50

export default function ClientesPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const roleLower = (user?.role || '').toLowerCase()
  const isVendedorOuRep = roleLower.includes('vendedor') || roleLower.includes('representante')

  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('Todos')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(PAGE_SIZE)
  const [openModal, setOpenModal] = useState(false)
  const [editing, setEditing] = useState<Cliente | null>(null)
  const [viewing, setViewing] = useState<Cliente | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Cliente | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [resolvedEstado, setResolvedEstado] = useState<string | null>(null)

  const debouncedSearch = useDebounce(search, 300)

  // Descobre o(s) estado(s) de atuação do usuário comercial (profile ou representante)
  useEffect(() => {
    if (!isVendedorOuRep || !user) {
      setResolvedEstado(null)
      return
    }

    if (user.estado_atuacao && user.estado_atuacao.trim()) {
      setResolvedEstado(user.estado_atuacao.trim().toUpperCase())
      return
    }

    let isMounted = true
    findRepresentanteByProfile(user.id, user.email)
      .then((rep) => {
        if (!isMounted) return
        if (rep?.estado && rep.estado.trim()) {
          setResolvedEstado(rep.estado.trim().toUpperCase())
        } else {
          setResolvedEstado(null)
        }
      })
      .catch(() => {
        if (isMounted) setResolvedEstado(null)
      })

    return () => {
      isMounted = false
    }
  }, [isVendedorOuRep, user?.id, user?.email, user?.estado_atuacao])

  const loadClientes = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      // Vendedor / Representante vê clientes cadastrados por ele OU de algum dos seus estados de atuação
      let options: { criadoPor?: string; estado?: string; matchAny?: boolean } | undefined =
        undefined
      if (isVendedorOuRep && user?.id) {
        const estadoAtuacao =
          resolvedEstado || (user.estado_atuacao ? user.estado_atuacao.trim().toUpperCase() : null)
        if (estadoAtuacao) {
          options = {
            criadoPor: user.id,
            estado: estadoAtuacao,
            matchAny: true,
          }
        } else {
          options = { criadoPor: user.id }
        }
      }
      setClientes(await fetchClientes(options))
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [isVendedorOuRep, user?.id, user?.estado_atuacao, resolvedEstado])

  useEffect(() => {
    loadClientes()
  }, [loadClientes])

  const filtered = useMemo(() => {
    const q = debouncedSearch.toLowerCase()
    return clientes.filter((c) => {
      const matchesSearch =
        !q ||
        c.fantasia.toLowerCase().includes(q) ||
        (c.razao_social ?? '').toLowerCase().includes(q) ||
        (c.documento ?? '').includes(q) ||
        (c.maquina_interesse ?? '').toLowerCase().includes(q)
      const matchesStatus = statusFilter === 'Todos' || c.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [clientes, debouncedSearch, statusFilter])

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, statusFilter])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  const openCreate = () => {
    setEditing(null)
    setOpenModal(true)
  }
  const openEdit = (c: Cliente) => {
    setEditing(c)
    setOpenModal(true)
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteCliente(deleteTarget.id)
      toast({ title: 'Cliente excluído com sucesso' })
      setDeleteTarget(null)
      loadClientes()
    } catch {
      toast({
        title: 'Erro ao excluir',
        description: 'Não foi possível conectar ao servidor. Tente novamente.',
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
          <h1 className="text-2xl font-bold tracking-tight">Cadastro de Clientes</h1>
          <p className="text-sm text-muted-foreground">
            Gerencie a base de clientes da Bener Máquinas
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          <Button onClick={openCreate} className="bg-primary gap-1.5">
            <Plus className="w-4 h-4" /> Novo Cliente
          </Button>
        </div>
      </div>

      {isVendedorOuRep && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 px-3 py-2 rounded-md w-fit">
          <UserCheck className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
          <span>
            Mostrando apenas os clientes cadastrados por você
            {resolvedEstado || user?.estado_atuacao
              ? ` e dos seus estados de atuação (${resolvedEstado || user?.estado_atuacao})`
              : ' e dos seus estados de atuação'}
            .
          </span>
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            placeholder="Buscar por nome, razão social ou documento..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 input-bener"
            aria-label="Buscar clientes"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger
            className="w-full sm:w-40 select-bener-trigger"
            aria-label="Filtrar por status"
          >
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
        <ErrorState
          message="Não foi possível carregar os clientes. Tente novamente."
          onRetry={loadClientes}
        />
      ) : paginated.length === 0 ? (
        <EmptyState
          title="Nenhum cliente encontrado"
          description={
            isVendedorOuRep
              ? 'Nenhum cliente cadastrado por você ou encontrado na sua região de atuação. Clique no botão abaixo para cadastrar seu primeiro cliente.'
              : 'Não há clientes cadastrados ou que correspondam aos filtros aplicados.'
          }
          actionText="Cadastrar Primeiro Cliente"
          onAction={openCreate}
        />
      ) : (
        <>
          <div className="border rounded-lg bg-card overflow-x-auto">
            <Table className="responsive-table">
              <TableHeader>
                <TableRow>
                  <TableHead>Nome Fantasia</TableHead>
                  <TableHead>Razão Social</TableHead>
                  <TableHead>CPF/CNPJ</TableHead>
                  <TableHead>Máquina de Interesse</TableHead>
                  <TableHead>Cidade / UF</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map((c) => (
                  <TableRow
                    key={c.id}
                    className="cursor-pointer hover:bg-accent/50"
                    onClick={() => openEdit(c)}
                  >
                    <TableCell data-label="Nome Fantasia" className="font-semibold">
                      {c.fantasia}
                    </TableCell>
                    <TableCell data-label="Razão Social" className="text-xs text-muted-foreground">
                      {c.razao_social || '—'}
                    </TableCell>
                    <TableCell data-label="CPF/CNPJ" className="text-xs font-mono">
                      {c.documento || '—'}
                    </TableCell>
                    <TableCell data-label="Máquina de Interesse" className="text-xs max-w-[200px]">
                      {c.maquina_interesse ? (
                        <div
                          className="flex items-center gap-1.5 text-foreground bg-primary/5 border border-primary/15 px-2 py-1 rounded text-[11px] font-medium"
                          title={c.maquina_interesse}
                        >
                          <Cpu className="w-3 h-3 text-primary shrink-0" />
                          <span className="truncate">{c.maquina_interesse}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground/60 italic">—</span>
                      )}
                    </TableCell>
                    <TableCell data-label="Cidade / UF" className="text-xs">
                      {c.cidade || '—'}
                      {c.estado ? ` / ${c.estado}` : ''}
                    </TableCell>
                    <TableCell data-label="Status">
                      <Badge variant={c.status === 'Ativo' ? 'default' : 'secondary'}>
                        {c.status}
                      </Badge>
                    </TableCell>
                    <TableCell data-label="Telefone" className="text-xs">
                      {c.telefone || '—'}
                    </TableCell>
                    <TableCell
                      data-label="Ações"
                      className="text-right"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setViewing(c)}
                        aria-label={`Ver detalhes de ${c.fantasia}`}
                        title="Ver detalhes"
                      >
                        <Eye className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEdit(c)}
                        aria-label={`Editar ${c.fantasia}`}
                        title="Editar"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive"
                        onClick={() => setDeleteTarget(c)}
                        aria-label={`Excluir ${c.fantasia}`}
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
          <PaginationBar
            page={currentPage}
            pageSize={pageSize}
            total={filtered.length}
            onPageChange={setPage}
            onPageSizeChange={(s) => {
              setPageSize(s)
              setPage(1)
            }}
          />
        </>
      )}

      <ClienteFormDialog
        open={openModal}
        onOpenChange={setOpenModal}
        editing={editing}
        onSaved={loadClientes}
      />

      {/* Modal de Detalhes do Cliente */}
      <Dialog open={!!viewing} onOpenChange={(open) => !open && setViewing(null)}>
        <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center justify-between">
              <span>{viewing?.fantasia}</span>
              <Badge variant={viewing?.status === 'Ativo' ? 'default' : 'secondary'}>
                {viewing?.status}
              </Badge>
            </DialogTitle>
            <DialogDescription className="text-xs">
              {viewing?.razao_social || 'Sem razão social informada'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2 text-sm">
            {/* Bloco de Máquina de Interesse em destaque com Auditoria (R9) */}
            <div className="p-4 rounded-lg bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                  <Cpu className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  Máquina de Interesse
                </span>
                {viewing?.maquina_interesse && (
                  <span className="text-[11px] text-emerald-800 dark:text-emerald-300 font-medium bg-emerald-100/70 dark:bg-emerald-900/50 px-2 py-0.5 rounded">
                    Descrição adicionada por:{' '}
                    <strong>
                      {viewing?.maquina_interesse_autor_nome || viewing?.criador_nome || 'Bianca'}
                    </strong>
                    {viewing?.maquina_interesse_adicionada_em
                      ? ` em ${new Date(viewing.maquina_interesse_adicionada_em).toLocaleDateString('pt-BR')}`
                      : viewing?.created_at
                        ? ` em ${new Date(viewing.created_at).toLocaleDateString('pt-BR')}`
                        : ''}
                  </span>
                )}
              </div>
              <p className="text-sm font-medium text-emerald-950 dark:text-emerald-100 whitespace-pre-wrap">
                {viewing?.maquina_interesse ||
                  'Nenhuma anotação de máquina de interesse registrada.'}
              </p>
            </div>

            {/* R9: Auditoria do Cadastro (visível para todos) */}
            <div className="p-3 rounded-md bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs flex items-center justify-between">
              <div>
                <span className="text-muted-foreground block text-[11px]">Cadastrado por:</span>
                <span className="font-semibold text-foreground text-xs">
                  {viewing?.criador_nome || 'Bianca (Admin)'}
                </span>
              </div>
              <div className="text-right">
                <span className="text-muted-foreground block text-[11px]">Data de cadastro:</span>
                <span className="font-mono text-xs font-medium text-foreground">
                  {viewing?.created_at
                    ? new Date(viewing.created_at).toLocaleString('pt-BR')
                    : viewing?.dt_cad || '—'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-md bg-muted/40 space-y-0.5">
                <span className="text-muted-foreground">CPF / CNPJ:</span>
                <p className="font-mono font-medium text-foreground">{viewing?.documento || '—'}</p>
              </div>
              <div className="p-3 rounded-md bg-muted/40 space-y-0.5">
                <span className="text-muted-foreground">Contato:</span>
                <p className="font-medium text-foreground">{viewing?.contato || '—'}</p>
              </div>
              <div className="p-3 rounded-md bg-muted/40 space-y-0.5">
                <span className="text-muted-foreground">Telefone:</span>
                <p className="font-medium text-foreground">
                  {viewing?.telefone || viewing?.celular || '—'}
                </p>
              </div>
              <div className="p-3 rounded-md bg-muted/40 space-y-0.5">
                <span className="text-muted-foreground">E-mail:</span>
                <p className="font-medium text-foreground truncate">{viewing?.email || '—'}</p>
              </div>
              <div className="p-3 rounded-md bg-muted/40 space-y-0.5 col-span-2">
                <span className="text-muted-foreground">Localização:</span>
                <p className="font-medium text-foreground">
                  {[
                    viewing?.logradouro,
                    viewing?.numero,
                    viewing?.bairro,
                    viewing?.cidade,
                    viewing?.estado,
                  ]
                    .filter(Boolean)
                    .join(', ') || '—'}
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button variant="outline" size="sm" onClick={() => setViewing(null)}>
                Fechar
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  const target = viewing
                  setViewing(null)
                  if (target) openEdit(target)
                }}
                className="gap-1.5"
              >
                <Edit className="w-3.5 h-3.5" /> Editar Cadastro
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <p className="text-sm text-muted-foreground">
              Deseja realmente excluir o cliente <strong>{deleteTarget?.fantasia}</strong>? Esta
              ação não pode ser desfeita.
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
