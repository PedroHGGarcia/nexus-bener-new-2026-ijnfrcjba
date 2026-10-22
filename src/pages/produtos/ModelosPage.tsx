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
import { Plus, Search, Trash2, Edit, Image as ImageIcon } from 'lucide-react'
import { ModeloImagensDialog } from '@/components/produtos/ModeloImagensDialog'
import { useCanEditMachines } from '@/hooks/use-machine-permissions'
import { toast } from '@/hooks/use-toast'
import { LoadingState, EmptyState, ErrorState } from '@/components/StateViews'
import { ModeloForm } from '@/components/produtos/ModeloForm'
import { useDebounce } from '@/hooks/use-debounce'
import { formatDate } from '@/lib/format'
import { Modelo } from '@/types/modelo'
import { fetchModelos } from '@/services/modelos'
import { MachineDeleteDialog } from '@/components/produtos/MachineDeleteDialog'
import { QUARANTINE_STATUS, type MachineTable } from '@/services/machine-quarantine'

export default function ModelosPage() {
  const canEdit = useCanEditMachines()
  const [tab, setTab] = useState('registros')
  const [data, setData] = useState<Modelo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('Todos')
  const [editing, setEditing] = useState<Modelo | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Modelo | null>(null)
  const [imagesModelo, setImagesModelo] = useState<Modelo | null>(null)

  const debouncedSearch = useDebounce(search, 300)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const d = await fetchModelos()
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

  const handleEdit = (item: Modelo) => {
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
        action === 'quarantine' ? 'Item movido para quarentena' : 'Modelo excluído permanentemente',
      description: action === 'quarantine' ? 'Um Admin revisará em até 7 dias.' : undefined,
    })
    setDeleteTarget(null)
    loadData()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Modelos</h1>
          <p className="text-sm text-muted-foreground">Gerencie os modelos do catálogo</p>
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
            <ErrorState message="Erro ao carregar modelos" onRetry={loadData} />
          ) : filtered.length === 0 ? (
            <EmptyState
              title="Nenhum registro encontrado"
              description="Não há modelos cadastrados ou que correspondam aos filtros."
              actionText="Novo Modelo"
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
                  {filtered.map((m) => (
                    <TableRow
                      key={m.id}
                      className="cursor-pointer hover:bg-accent/50"
                      onClick={() => handleEdit(m)}
                    >
                      <TableCell className="font-semibold">{m.nome}</TableCell>
                      <TableCell>
                        <Badge variant={m.status === 'Ativo' ? 'default' : 'secondary'}>
                          {m.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">{formatDate(m.created_at)}</TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Biblioteca de Imagens Técnicas"
                          onClick={() => setImagesModelo(m)}
                        >
                          <ImageIcon className="w-4 h-4 text-primary" />
                        </Button>
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
          <ModeloForm
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
        table={'modelos' as MachineTable}
        itemId={deleteTarget?.id ?? ''}
        itemName={deleteTarget?.nome ?? ''}
        onDone={handleDeleteDone}
      />

      {imagesModelo && (
        <ModeloImagensDialog
          open={!!imagesModelo}
          onOpenChange={(open) => !open && setImagesModelo(null)}
          modeloId={imagesModelo.id}
          modeloNome={imagesModelo.nome}
          canEdit={canEdit}
        />
      )}
    </div>
  )
}
