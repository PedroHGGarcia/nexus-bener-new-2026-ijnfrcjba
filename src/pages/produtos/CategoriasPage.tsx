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
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@/components/ui/select'
import { Plus, Search, Trash2, Edit } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { LoadingState, EmptyState, ErrorState } from '@/components/StateViews'
import { CategoriaForm } from '@/components/produtos/CategoriaForm'
import { useDebounce } from '@/hooks/use-debounce'
import { formatDate } from '@/lib/format'
import { CategoriaProduto } from '@/types/categoria-produto'
import { fetchCategoriasProdutos } from '@/services/categorias-produtos'
import { MachineDeleteDialog } from '@/components/produtos/MachineDeleteDialog'
import { QUARANTINE_STATUS, type MachineTable } from '@/services/machine-quarantine'

export default function CategoriasPage() {
  const [tab, setTab] = useState('registros')
  const [data, setData] = useState<CategoriaProduto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('Todos')
  const [editing, setEditing] = useState<CategoriaProduto | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<CategoriaProduto | null>(null)

  const debouncedSearch = useDebounce(search, 300)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const d = await fetchCategoriasProdutos()
      setData(d)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const filtered = useMemo(() => {
    const q = debouncedSearch.toLowerCase()
    return data
      .filter((c) => c.status !== QUARANTINE_STATUS)
      .filter((c) => {
        const matchesSearch = !q || c.nome.toLowerCase().includes(q)
        const matchesStatus = statusFilter === 'Todos' || c.status === statusFilter
        return matchesSearch && matchesStatus
      })
  }, [data, debouncedSearch, statusFilter])

  const handleEdit = (item: CategoriaProduto) => {
    setEditing(item)
    setTab('cadastro')
  }

  const handleNew = () => {
    setEditing(null)
    setTab('cadastro')
  }

  const handleSaved = () => {
    setTab('registros')
    setEditing(null)
    loadData()
  }

  const handleDeleteDone = (action: 'quarantine' | 'delete') => {
    toast({
      title:
        action === 'quarantine'
          ? 'Item movido para quarentena'
          : 'Categoria excluída permanentemente',
      description: action === 'quarantine' ? 'Um Admin revisará em até 7 dias.' : undefined,
    })
    setDeleteTarget(null)
    loadData()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Categorias de Produtos</h1>
          <p className="text-sm text-muted-foreground">Gerencie as categorias do catálogo</p>
        </div>
        <Button onClick={handleNew} className="bg-primary gap-1.5">
          <Plus className="w-4 h-4" /> Novo
        </Button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="registros">Registros</TabsTrigger>
          <TabsTrigger value="cadastro">Cadastro</TabsTrigger>
        </TabsList>

        <TabsContent value="registros" className="space-y-4">
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
            <ErrorState message="Erro ao carregar categorias" onRetry={loadData} />
          ) : filtered.length === 0 ? (
            <EmptyState
              title="Nenhum registro encontrado"
              description="Não há categorias cadastradas ou que correspondam aos filtros."
              actionText="Nova Categoria"
              onAction={handleNew}
            />
          ) : (
            <div className="border rounded-lg bg-card overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Data Cadastro</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((c) => (
                    <TableRow
                      key={c.id}
                      className="cursor-pointer hover:bg-accent/50"
                      onClick={() => handleEdit(c)}
                    >
                      <TableCell className="font-semibold">{c.nome}</TableCell>
                      <TableCell>
                        <Badge variant={c.status === 'Ativo' ? 'default' : 'secondary'}>
                          {c.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">{formatDate(c.created_at)}</TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(c)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive"
                          onClick={() => setDeleteTarget(c)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="cadastro">
          <CategoriaForm
            key={editing?.id ?? 'new'}
            editing={editing}
            onSaved={handleSaved}
            onCancel={() => setTab('registros')}
          />
        </TabsContent>
      </Tabs>

      <MachineDeleteDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        table={'categorias_produtos' as MachineTable}
        itemId={deleteTarget?.id ?? ''}
        itemName={deleteTarget?.nome ?? ''}
        onDone={handleDeleteDone}
      />
    </div>
  )
}
