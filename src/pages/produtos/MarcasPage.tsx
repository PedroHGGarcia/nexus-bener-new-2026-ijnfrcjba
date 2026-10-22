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
import { MarcaForm } from '@/components/produtos/MarcaForm'
import { useDebounce } from '@/hooks/use-debounce'
import { formatDate } from '@/lib/format'
import { Marca } from '@/types/marca'
import { fetchMarcas } from '@/services/marcas'
import { MachineDeleteDialog } from '@/components/produtos/MachineDeleteDialog'
import { QUARANTINE_STATUS, type MachineTable } from '@/services/machine-quarantine'

export default function MarcasPage() {
  const [tab, setTab] = useState('registros')
  const [data, setData] = useState<Marca[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('Todos')
  const [editing, setEditing] = useState<Marca | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Marca | null>(null)

  const debouncedSearch = useDebounce(search, 300)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const d = await fetchMarcas()
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
      .filter((m) => m.status !== QUARANTINE_STATUS)
      .filter((m) => {
        const matchesSearch = !q || m.nome.toLowerCase().includes(q)
        const matchesStatus = statusFilter === 'Todos' || m.status === statusFilter
        return matchesSearch && matchesStatus
      })
  }, [data, debouncedSearch, statusFilter])

  const handleEdit = (item: Marca) => {
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
        action === 'quarantine' ? 'Item movido para quarentena' : 'Marca excluída permanentemente',
      description: action === 'quarantine' ? 'Um Admin revisará em até 7 dias.' : undefined,
    })
    setDeleteTarget(null)
    loadData()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Marcas</h1>
          <p className="text-sm text-muted-foreground">Gerencie as marcas do catálogo</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={handleNew} className="bg-primary gap-1.5">
            <Plus className="w-4 h-4" /> Novo
          </Button>
        </div>
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
            <ErrorState message="Erro ao carregar marcas" onRetry={loadData} />
          ) : filtered.length === 0 ? (
            <EmptyState
              title="Nenhum registro encontrado"
              description="Não há marcas cadastradas ou que correspondam aos filtros."
              actionText="Nova Marca"
              onAction={handleNew}
            />
          ) : (
            <div className="border rounded-lg bg-card overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Reg</TableHead>
                    <TableHead>Cód</TableHead>
                    <TableHead>Site</TableHead>
                    <TableHead>País</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Data Cadastro</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((m) => (
                    <TableRow
                      key={m.id}
                      className="cursor-pointer hover:bg-accent/50"
                      onClick={() => handleEdit(m)}
                    >
                      <TableCell className="font-semibold">{m.nome}</TableCell>
                      <TableCell className="font-mono text-xs font-semibold text-[#0b3c26]">
                        {m.reg !== null && m.reg !== undefined ? m.reg : '—'}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {m.cod !== null && m.cod !== undefined ? m.cod : '—'}
                      </TableCell>
                      <TableCell className="text-xs text-slate-700">
                        {m.site ? (
                          <a
                            href={m.site.startsWith('http') ? m.site : `https://${m.site}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-blue-600 hover:underline truncate max-w-[150px] inline-block"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {m.site}
                          </a>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-slate-700">{m.pais || '—'}</TableCell>
                      <TableCell>
                        <Badge variant={m.status === 'Ativo' ? 'default' : 'secondary'}>
                          {m.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">{formatDate(m.created_at)}</TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(m)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive"
                          onClick={() => setDeleteTarget(m)}
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
          <MarcaForm
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
        table={'marcas' as MachineTable}
        itemId={deleteTarget?.id ?? ''}
        itemName={deleteTarget?.nome ?? ''}
        onDone={handleDeleteDone}
      />
    </div>
  )
}
