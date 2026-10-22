import { useState, useEffect, useCallback, useMemo } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
} from '@/components/ui/dropdown-menu'
import {
  ArrowLeft,
  Search,
  Trash2,
  Edit,
  Plus,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  ImageIcon,
  ZoomIn,
  ExternalLink,
  UploadCloud,
} from 'lucide-react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { toast } from '@/hooks/use-toast'
import { useAuth } from '@/hooks/use-auth'
import { isRepresentanteRole } from '@/components/RoleGuard'
import { useGerenteCategoryRestriction } from '@/hooks/use-gerente-restriction'
import { LoadingState, EmptyState, ErrorState } from '@/components/StateViews'
import { useDebounce } from '@/hooks/use-debounce'
import { formatDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import { VersaoWithModelo } from '@/types/versao'
import { Produto } from '@/types/produto'
import { CategoriaProduto } from '@/types/categoria-produto'
import { fetchVersoes, deleteVersao, clearVersoesCache } from '@/services/versoes'
import { fetchProdutoById } from '@/services/produtos'
import { fetchCategoriasProdutos } from '@/services/categorias-produtos'
import { VersaoForm } from '@/components/produtos/VersaoForm'
import { VersaoHistorico } from '@/components/produtos/VersaoHistorico'
import { MachineDeleteDialog } from '@/components/produtos/MachineDeleteDialog'
import type { MachineTable } from '@/services/machine-quarantine'

const PAGE_SIZE = 10
const COL_LABELS: Record<string, string> = {
  nome: 'Nome',
  categoria: 'Categoria',
  modelo: 'Modelo',
  reg: 'REG',
  cod_erp: 'Cod ERP',
  valor: 'Valor',
  moeda: 'Moeda',
  status: 'Status',
}

function formatValor(valor: number, moeda: string) {
  const symbols: Record<string, string> = { BRL: 'R$', USD: '$', EUR: '€' }
  return `${symbols[moeda] ?? ''} ${(valor ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default function VersoesPage() {
  const [searchParams] = useSearchParams()
  const produtoId = searchParams.get('produto')
  const { user } = useAuth()

  const [tab, setTab] = useState('registros')
  const [data, setData] = useState<VersaoWithModelo[]>([])
  const [categorias, setCategorias] = useState<CategoriaProduto[]>([])
  const [produto, setProduto] = useState<Produto | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('Ativo')
  const [page, setPage] = useState(0)
  const [sortCol, setSortCol] = useState('nome')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [colVis, setColVis] = useState<Record<string, boolean>>({
    imagem: true,
    nome: true,
    categoria: true,
    modelo: true,
    reg: true,
    cod_erp: true,
    valor: true,
    moeda: true,
    status: true,
  })
  const [editing, setEditing] = useState<VersaoWithModelo | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<VersaoWithModelo | null>(null)
  const [previewImage, setPreviewImage] = useState<{ url: string; nome: string } | null>(null)
  const [brokenImages, setBrokenImages] = useState<Set<string>>(new Set())

  const debouncedSearch = useDebounce(search, 300)
  const restriction = useGerenteCategoryRestriction()
  const isRep = isRepresentanteRole(user?.role)

  const loadData = useCallback(async () => {
    if (restriction.loading) return
    setLoading(true)
    setError(false)
    try {
      const catFilter =
        restriction.hasRestriction && restriction.categoriaId ? restriction.categoriaId : undefined
      const catIdsFilter =
        restriction.hasRestriction && restriction.categoriaIds.length > 0
          ? restriction.categoriaIds
          : catFilter
            ? [catFilter]
            : undefined

      const [versoes, cats] = await Promise.all([
        fetchVersoes({
          produtoId: produtoId ?? undefined,
          activeOnly: isRep,
          categoriaId: catFilter,
          categoriaIds: catIdsFilter,
        }),
        fetchCategoriasProdutos().catch(() => []),
        produtoId
          ? fetchProdutoById(produtoId)
              .then(setProduto)
              .catch(() => {})
          : Promise.resolve(),
      ])
      setData(versoes)
      setCategorias(cats || [])
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [
    produtoId,
    isRep,
    restriction.loading,
    restriction.hasRestriction,
    restriction.categoriaId,
    restriction.categoriaIds,
  ])

  useEffect(() => {
    loadData()
  }, [loadData])

  const isQuarentena = (status?: string | null, deletedAt?: string | null) => {
    if (deletedAt) return true
    if (!status) return false
    const s = status.trim().toLowerCase()
    return s === 'em quarentena' || s === 'quarentena'
  }

  const catMap = useMemo(() => new Map(categorias.map((c) => [c.id, c.nome])), [categorias])

  const filtered = useMemo(() => {
    const q = debouncedSearch.toLowerCase()
    return data.filter((v) => {
      const catNome = v.categoria_id ? catMap.get(v.categoria_id) || '' : ''
      const matchesSearch =
        !q ||
        v.nome.toLowerCase().includes(q) ||
        (v.modelos?.nome ?? '').toLowerCase().includes(q) ||
        catNome.toLowerCase().includes(q)

      // Quarentena nunca é ativa e deve ser excluída explicitamente quando statusFilter === 'Ativo'
      const inQuarantine = isQuarentena(v.status, v.deleted_at)
      if (statusFilter === 'Ativo') {
        if (inQuarantine) return false
        if (v.status !== 'Ativo' && v.status !== 'A') return false
      } else if (statusFilter === 'Inativo') {
        if (inQuarantine) return false
        const s = v.status?.trim().toLowerCase()
        if (s !== 'inativo' && s !== 'i') return false
      } else {
        // 'Todos': esconde itens em quarentena da listagem comum (quarentena tem aba própria)
        if (inQuarantine) return false
      }

      return matchesSearch
    })
  }, [data, debouncedSearch, statusFilter])

  const sorted = useMemo(() => {
    const arr = [...filtered]
    arr.sort((a, b) => {
      let valA: string | number, valB: string | number
      if (sortCol === 'modelo') {
        valA = a.modelos?.nome ?? ''
        valB = b.modelos?.nome ?? ''
      } else if (sortCol === 'categoria') {
        valA = a.categoria_id ? catMap.get(a.categoria_id) || '' : ''
        valB = b.categoria_id ? catMap.get(b.categoria_id) || '' : ''
      } else {
        valA = ((a as unknown as Record<string, unknown>)[sortCol] as string | number) ?? ''
        valB = ((b as unknown as Record<string, unknown>)[sortCol] as string | number) ?? ''
      }
      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortDir === 'asc' ? valA - valB : valB - valA
      }
      return sortDir === 'asc'
        ? String(valA).localeCompare(String(valB))
        : String(valB).localeCompare(String(valA))
    })
    return arr
  }, [filtered, sortCol, sortDir])

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages - 1)
  const paginated = sorted.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE)

  useEffect(() => {
    setPage(0)
  }, [debouncedSearch, statusFilter])

  const toggleSort = (col: string) => {
    if (sortCol === col) {
      setSortDir((p) => (p === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortCol(col)
      setSortDir('asc')
    }
  }

  const toggleCol = (col: string) => setColVis((p) => ({ ...p, [col]: !p[col] }))

  const handleEdit = (item: VersaoWithModelo) => {
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
    clearVersoesCache()
    loadData()
  }

  const handleDeleteDone = (action: 'quarantine' | 'delete') => {
    toast({
      title:
        action === 'quarantine' ? 'Item movido para quarentena' : 'Versão excluída permanentemente',
      description: action === 'quarantine' ? 'Um Admin revisará em até 7 dias.' : undefined,
    })
    setDeleteTarget(null)
    clearVersoesCache()
    loadData()
  }

  const sortIcon = (col: string) => {
    if (sortCol !== col) return ''
    return sortDir === 'asc' ? ' ↑' : ' ↓'
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Versões de Equipamentos</h1>
          <p className="text-sm text-muted-foreground">
            {produto ? `Versões vinculadas a: ${produto.nome}` : 'Todas as versões cadastradas'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            asChild
            className="gap-1.5 border-[#0b3c26]/30 text-[#0b3c26] hover:bg-[#0b3c26]/10"
          >
            <Link to="/importar-versoes">
              <UploadCloud className="w-4 h-4 text-[#0b3c26]" /> Importar CSV (extrator)
            </Link>
          </Button>
          <Button onClick={handleNew} className="bg-primary gap-1.5" size="sm">
            <Plus className="w-4 h-4" /> Nova Versão
          </Button>
          <Button variant="outline" size="sm" asChild className="gap-1.5">
            <Link to="/produtos">
              <ArrowLeft className="w-4 h-4" /> Voltar
            </Link>
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="registros">Registros</TabsTrigger>
          <TabsTrigger value="cadastro">Cadastro</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="registros" className="space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                placeholder="Buscar versões..."
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
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <SlidersHorizontal className="w-4 h-4" /> Colunas
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {Object.entries(COL_LABELS).map(([key, label]) => (
                  <DropdownMenuCheckboxItem
                    key={key}
                    checked={colVis[key]}
                    onCheckedChange={() => toggleCol(key)}
                  >
                    {label}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {loading ? (
            <LoadingState count={5} />
          ) : error ? (
            <ErrorState message="Erro ao carregar versões" onRetry={loadData} />
          ) : paginated.length === 0 ? (
            <EmptyState
              title="Nenhuma versão encontrada"
              description="Não há versões cadastradas ou que correspondam aos filtros."
              actionText="Nova Versão"
              onAction={handleNew}
            />
          ) : (
            <>
              <div className="border rounded-lg bg-card overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {colVis.imagem && <TableHead className="w-16 text-center">Imagem</TableHead>}
                      {colVis.nome && (
                        <TableHead
                          className="cursor-pointer select-none"
                          onClick={() => toggleSort('nome')}
                        >
                          Nome{sortIcon('nome')}
                        </TableHead>
                      )}
                      {colVis.categoria && (
                        <TableHead
                          className="cursor-pointer select-none"
                          onClick={() => toggleSort('categoria')}
                        >
                          Categoria{sortIcon('categoria')}
                        </TableHead>
                      )}
                      {colVis.modelo && (
                        <TableHead
                          className="cursor-pointer select-none"
                          onClick={() => toggleSort('modelo')}
                        >
                          Modelo{sortIcon('modelo')}
                        </TableHead>
                      )}
                      {colVis.reg && (
                        <TableHead
                          className="cursor-pointer select-none"
                          onClick={() => toggleSort('reg')}
                        >
                          REG{sortIcon('reg')}
                        </TableHead>
                      )}
                      {colVis.cod_erp && (
                        <TableHead
                          className="cursor-pointer select-none"
                          onClick={() => toggleSort('cod_erp')}
                        >
                          Cod ERP{sortIcon('cod_erp')}
                        </TableHead>
                      )}
                      {colVis.valor && (
                        <TableHead
                          className="cursor-pointer select-none"
                          onClick={() => toggleSort('valor')}
                        >
                          Valor{sortIcon('valor')}
                        </TableHead>
                      )}
                      {colVis.moeda && (
                        <TableHead
                          className="cursor-pointer select-none"
                          onClick={() => toggleSort('moeda')}
                        >
                          Moeda{sortIcon('moeda')}
                        </TableHead>
                      )}
                      {colVis.status && (
                        <TableHead
                          className="cursor-pointer select-none"
                          onClick={() => toggleSort('status')}
                        >
                          Status{sortIcon('status')}
                        </TableHead>
                      )}
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginated.map((v) => (
                      <TableRow
                        key={v.id}
                        className="cursor-pointer hover:bg-accent/50"
                        onClick={() => handleEdit(v)}
                      >
                        {colVis.imagem && (
                          <TableCell
                            className="p-2 text-center"
                            onClick={(e) => {
                              if (v.imagem_preview && !brokenImages.has(v.id)) {
                                e.stopPropagation()
                                setPreviewImage({ url: v.imagem_preview, nome: v.nome })
                              }
                            }}
                          >
                            {v.imagem_preview && !brokenImages.has(v.id) ? (
                              <div className="relative group w-11 h-11 mx-auto">
                                <img
                                  src={v.imagem_preview}
                                  alt={v.nome}
                                  loading="lazy"
                                  onError={() =>
                                    setBrokenImages((prev) => {
                                      const next = new Set(prev)
                                      next.add(v.id)
                                      return next
                                    })
                                  }
                                  className="w-11 h-11 object-contain rounded-md border bg-white p-0.5 mx-auto shadow-xs transition-transform duration-150 group-hover:scale-105"
                                />
                                <div
                                  className="absolute inset-0 bg-black/40 rounded-md opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity cursor-zoom-in"
                                  title="Clique para ampliar a foto"
                                >
                                  <ZoomIn className="w-4 h-4 text-white drop-shadow" />
                                </div>
                              </div>
                            ) : (
                              <div
                                className="w-11 h-11 rounded-md border border-dashed border-border/80 bg-muted/40 flex flex-col items-center justify-center text-[10px] text-muted-foreground mx-auto gap-0.5 select-none"
                                title="Sem foto cadastrada"
                              >
                                <ImageIcon className="w-4 h-4 opacity-50" />
                                <span className="leading-none text-[8px] font-medium text-muted-foreground/80">
                                  S/ foto
                                </span>
                              </div>
                            )}
                          </TableCell>
                        )}
                        {colVis.nome && <TableCell className="font-semibold">{v.nome}</TableCell>}
                        {colVis.categoria && (
                          <TableCell>
                            {v.categoria_id && catMap.get(v.categoria_id) ? (
                              <Badge
                                variant="outline"
                                className="border-emerald-600/30 text-emerald-800 dark:text-emerald-300 bg-emerald-50/50 dark:bg-emerald-950/30 text-xs font-normal"
                              >
                                {catMap.get(v.categoria_id)}
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                        )}
                        {colVis.modelo && (
                          <TableCell className="text-xs text-muted-foreground">
                            {v.modelos?.nome ?? '—'}
                          </TableCell>
                        )}
                        {colVis.reg && (
                          <TableCell className="text-xs font-mono font-medium text-[#0b3c26]">
                            {v.reg || v.cod_erp || '—'}
                          </TableCell>
                        )}
                        {colVis.cod_erp && (
                          <TableCell className="text-xs">{v.cod_erp ?? '—'}</TableCell>
                        )}
                        {colVis.valor && (
                          <TableCell className="text-xs font-mono">
                            {formatValor(v.valor, v.moeda)}
                          </TableCell>
                        )}
                        {colVis.moeda && <TableCell className="text-xs">{v.moeda}</TableCell>}
                        {colVis.status && (
                          <TableCell>
                            <Badge variant={v.status === 'Ativo' ? 'default' : 'secondary'}>
                              {v.status}
                            </Badge>
                          </TableCell>
                        )}
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(v)}>
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive"
                            onClick={() => setDeleteTarget(v)}
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
                  {sorted.length} versão(ões) — Página {currentPage + 1} de {totalPages}
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
        </TabsContent>

        <TabsContent value="cadastro">
          <VersaoForm
            key={editing?.id ?? 'new'}
            editing={editing}
            userName={user?.name}
            onSaved={handleSaved}
            onCancel={() => setTab('registros')}
          />
        </TabsContent>

        <TabsContent value="historico">
          <VersaoHistorico versaoId={editing?.id} />
        </TabsContent>
      </Tabs>

      <MachineDeleteDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        table={'versoes' as MachineTable}
        itemId={deleteTarget?.id ?? ''}
        itemName={deleteTarget?.nome ?? ''}
        onDone={handleDeleteDone}
      />

      {/* Lightbox / Zoom da Imagem */}
      <Dialog open={!!previewImage} onOpenChange={(open) => !open && setPreviewImage(null)}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden bg-background border shadow-xl">
          <div className="px-5 py-3.5 flex items-center justify-between border-b bg-muted/30">
            <div className="pr-4">
              <h3 className="font-semibold text-sm line-clamp-1 text-foreground">
                {previewImage?.nome}
              </h3>
              <p className="text-xs text-muted-foreground">Foto da versão do equipamento</p>
            </div>
            {previewImage?.url && (
              <a
                href={previewImage.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs flex items-center gap-1.5 text-primary hover:underline shrink-0 mr-6"
              >
                <ExternalLink className="w-3.5 h-3.5" /> Abrir original
              </a>
            )}
          </div>
          <div className="max-h-[75vh] flex items-center justify-center p-6 bg-muted/10 overflow-auto">
            {previewImage?.url && (
              <img
                src={previewImage.url}
                alt={previewImage.nome}
                className="max-h-[65vh] w-auto max-w-full object-contain rounded-md border bg-white p-2 shadow-sm"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
