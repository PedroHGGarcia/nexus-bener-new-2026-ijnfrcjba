import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Search,
  Plus,
  Edit2,
  Trash2,
  Eye,
  RefreshCw,
  Cpu,
  X,
  Lock,
  ChevronLeft,
  ChevronRight,
  PackageX,
  ArrowRight,
  ImageIcon,
  ZoomIn,
  ExternalLink,
} from 'lucide-react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { toast } from '@/hooks/use-toast'
import { ErrorState } from '@/components/StateViews'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/use-auth'
import { isRepresentanteRole } from '@/components/RoleGuard'
import { useGerenteCategoryRestriction } from '@/hooks/use-gerente-restriction'

import { fetchCategoriasProdutos } from '@/services/categorias-produtos'
import { fetchProdutos } from '@/services/produtos'
import { fetchMarcas } from '@/services/marcas'
import { fetchModelos } from '@/services/modelos'
import { fetchVersoes, clearVersoesCache } from '@/services/versoes'

import { CategoriaProduto } from '@/types/categoria-produto'
import { Produto } from '@/types/produto'
import { Marca } from '@/types/marca'
import { Modelo } from '@/types/modelo'
import { VersaoWithModelo } from '@/types/versao'

import { VersaoForm } from '@/components/produtos/VersaoForm'
import {
  VersaoDetalhesDialog,
  VersaoDetalhesData,
} from '@/components/produtos/VersaoDetalhesDialog'
import { MachineDeleteDialog } from '@/components/produtos/MachineDeleteDialog'
import { MachineCombobox, ComboboxOption } from '@/components/produtos/MachineCombobox'
import { formatCurrencyByMoeda } from '@/lib/format'
import { useCanEditMachines, MACHINE_EDIT_DENIED_TOOLTIP } from '@/hooks/use-machine-permissions'
import { QUARANTINE_STATUS } from '@/services/machine-quarantine'

const PAGE_SIZE = 15
const COLSPAN = 9

/** Versão enriquecida com os dados da cascata (modelo → marca → produto → categoria). */
type VersaoEnriched = VersaoWithModelo & {
  _modeloId: string | null
  _marcaId: string | null
  _produtoId: string | null
  _categoriaId: string | null
  _modeloNome: string
  _marcaNome: string
  _produtoNome: string
  _categoriaNome: string
}

export default function ProdutosListPage() {
  const navigate = useNavigate()

  // ---- data state ----
  const [categorias, setCategorias] = useState<CategoriaProduto[]>([])
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [marcas, setMarcas] = useState<Marca[]>([])
  const [modelos, setModelos] = useState<Modelo[]>([])
  const [versoes, setVersoes] = useState<VersaoWithModelo[]>([])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  // ---- search ----
  const [search, setSearch] = useState('')

  // ---- filters (cascade) ----
  const [filters, setFilters] = useState<{
    categoriaId: string | null
    produtoId: string | null
    marcaId: string | null
    modeloId: string | null
    status: 'Todos' | 'Ativo' | 'Inativo'
  }>({ categoriaId: null, produtoId: null, marcaId: null, modeloId: null, status: 'Ativo' })

  // ---- pagination ----
  const [page, setPage] = useState(1)

  // ---- add / edit / delete modals ----
  const [versaoFormOpen, setVersaoFormOpen] = useState(false)
  const [editingVersao, setEditingVersao] = useState<VersaoWithModelo | null>(null)
  const [viewingVersao, setViewingVersao] = useState<VersaoDetalhesData | null>(null)
  const [initialModeloId, setInitialModeloId] = useState<string | undefined>(undefined)
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string
    name: string
  } | null>(null)
  const [previewImage, setPreviewImage] = useState<{ url: string; nome: string } | null>(null)
  const [brokenImages, setBrokenImages] = useState<Set<string>>(new Set())

  const { user } = useAuth()
  const isRepUser = isRepresentanteRole(user?.role)
  const canEditMachines = useCanEditMachines()
  const restriction = useGerenteCategoryRestriction()

  const loadData = useCallback(async () => {
    if (restriction.loading) return
    setLoading(true)
    setError(false)
    try {
      // Regra 3 da Bianca: Representantes e Vendedores somente visualizam versões ativas.
      // O serviço fetchVersoes já suporta o parâmetro activeOnly e categoriaId.
      const shouldFilterActive = isRepresentanteRole(user?.role)
      const catFilter =
        restriction.hasRestriction && restriction.categoriaId ? restriction.categoriaId : undefined
      const catIdsFilter =
        restriction.hasRestriction && restriction.categoriaIds.length > 0
          ? restriction.categoriaIds
          : catFilter
            ? [catFilter]
            : undefined

      const [cats, prods, mrcs, mods, vers] = await Promise.all([
        fetchCategoriasProdutos(),
        fetchProdutos(),
        fetchMarcas(),
        fetchModelos(),
        fetchVersoes({
          activeOnly: shouldFilterActive,
          categoriaId: catFilter,
          categoriaIds: catIdsFilter,
        }),
      ])
      setCategorias(cats || [])
      setProdutos(prods || [])
      setMarcas(mrcs || [])
      setModelos(mods || [])
      setVersoes(vers || [])
    } catch (err) {
      console.error('Error loading versões catalog:', err)
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [
    user?.role,
    restriction.loading,
    restriction.hasRestriction,
    restriction.categoriaId,
    restriction.categoriaIds,
  ])

  useEffect(() => {
    loadData()
  }, [loadData])

  // ---- lookup maps ----
  const catMap = useMemo(() => new Map(categorias.map((c) => [c.id, c])), [categorias])
  const prodMap = useMemo(() => new Map(produtos.map((p) => [p.id, p])), [produtos])
  const marcaMap = useMemo(() => new Map(marcas.map((m) => [m.id, m])), [marcas])
  const modeloMap = useMemo(() => new Map(modelos.map((m) => [m.id, m])), [modelos])

  const isQuarentenado = (status?: string | null, deletedAt?: string | null) => {
    if (deletedAt) return true
    if (!status) return false
    const s = status.trim().toLowerCase()
    return s === 'em quarentena' || s === 'quarentena'
  }

  // ---- enriched versões (joins modelo → marca → produto → categoria) ----
  // Suprime explicitamente versões em quarentena E versões cujos pais (categoria, produto ou modelo) estejam em quarentena
  const versoesEnriched = useMemo<VersaoEnriched[]>(() => {
    return versoes
      .filter((v) => !isQuarentenado(v.status, v.deleted_at))
      .filter((v) => {
        // Garantia adicional em memória para Representante/Vendedor
        if (isRepUser) {
          return (v.status === 'Ativo' || v.status === 'A') && !v.deleted_at
        }
        return true
      })
      .map((v) => {
        const mod = v.modelo ? modeloMap.get(v.modelo) : undefined
        const prod = mod?.produto ? prodMap.get(mod.produto) : undefined
        const mrc = mod?.marca ? marcaMap.get(mod.marca) : undefined
        const cat = prod?.categoria ? catMap.get(prod.categoria) : undefined
        return {
          ...v,
          _modeloId: mod?.id ?? null,
          _marcaId: mrc?.id ?? null,
          _produtoId: prod?.id ?? null,
          _categoriaId: cat?.id ?? null,
          _modeloNome: mod?.nome ?? '—',
          _marcaNome: mrc?.nome ?? '—',
          _produtoNome: prod?.nome ?? '—',
          _categoriaNome: cat?.nome ?? '—',
        }
      })
      .filter((v) => {
        // Suprime versões cujos pais estejam em quarentena ou marcados como deletados
        const mod = v.modelo ? modeloMap.get(v.modelo) : undefined
        if (mod && isQuarentenado(mod.status, (mod as any).deleted_at)) return false

        const prod = mod?.produto ? prodMap.get(mod.produto) : undefined
        if (prod && isQuarentenado(prod.status, (prod as any).deleted_at)) return false

        const cat = prod?.categoria ? catMap.get(prod.categoria) : undefined
        if (cat && isQuarentenado(cat.status, (cat as any).deleted_at)) return false

        // Se houver restrição ativa de categoria por gerente
        if (restriction.hasRestriction) {
          if (restriction.categoriaIds.length > 0) {
            return v._categoriaId ? restriction.categoriaIds.includes(v._categoriaId) : false
          }
          if (restriction.categoriaId) {
            return v._categoriaId === restriction.categoriaId
          }
        }
        return true
      })
  }, [
    versoes,
    modeloMap,
    prodMap,
    marcaMap,
    catMap,
    isRepUser,
    restriction.hasRestriction,
    restriction.categoriaId,
    restriction.categoriaIds,
  ])

  // ---- cascading filter options (derivadas do conjunto de versões) ----
  const categoriaOptions = useMemo<ComboboxOption[]>(() => {
    const seen = new Map<string, string>()
    for (const v of versoesEnriched) {
      if (v._categoriaId && !seen.has(v._categoriaId)) seen.set(v._categoriaId, v._categoriaNome)
    }
    return Array.from(seen.entries())
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([value, label]) => ({ value, label }))
  }, [versoesEnriched])

  const produtoOptions = useMemo<ComboboxOption[]>(() => {
    const seen = new Map<string, string>()
    for (const v of versoesEnriched) {
      if (filters.categoriaId && v._categoriaId !== filters.categoriaId) continue
      if (v._produtoId && !seen.has(v._produtoId)) seen.set(v._produtoId, v._produtoNome)
    }
    return Array.from(seen.entries())
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([value, label]) => ({ value, label }))
  }, [versoesEnriched, filters.categoriaId])

  const marcaOptions = useMemo<ComboboxOption[]>(() => {
    const seen = new Map<string, string>()
    for (const v of versoesEnriched) {
      if (filters.categoriaId && v._categoriaId !== filters.categoriaId) continue
      if (filters.produtoId && v._produtoId !== filters.produtoId) continue
      if (v._marcaId && !seen.has(v._marcaId)) seen.set(v._marcaId, v._marcaNome)
    }
    return Array.from(seen.entries())
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([value, label]) => ({ value, label }))
  }, [versoesEnriched, filters.categoriaId, filters.produtoId])

  const modeloOptions = useMemo<ComboboxOption[]>(() => {
    const seen = new Map<string, string>()
    for (const v of versoesEnriched) {
      if (filters.categoriaId && v._categoriaId !== filters.categoriaId) continue
      if (filters.produtoId && v._produtoId !== filters.produtoId) continue
      if (filters.marcaId && v._marcaId !== filters.marcaId) continue
      if (v._modeloId && !seen.has(v._modeloId)) seen.set(v._modeloId, v._modeloNome)
    }
    return Array.from(seen.entries())
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([value, label]) => ({ value, label }))
  }, [versoesEnriched, filters.categoriaId, filters.produtoId, filters.marcaId])

  const activeFilterCount =
    (filters.categoriaId ? 1 : 0) +
    (filters.produtoId ? 1 : 0) +
    (filters.marcaId ? 1 : 0) +
    (filters.modeloId ? 1 : 0) +
    (filters.status !== 'Todos' ? 1 : 0)

  const clearFilters = () => {
    setFilters({
      categoriaId: null,
      produtoId: null,
      marcaId: null,
      modeloId: null,
      status: 'Todos',
    })
    setSearch('')
    setPage(1)
  }

  // ---- filtered + paginated ----
  const filteredRows = useMemo(() => {
    const qs = search.trim().toLowerCase()
    return versoesEnriched
      .filter((v) => {
        if (filters.categoriaId && v._categoriaId !== filters.categoriaId) return false
        if (filters.produtoId && v._produtoId !== filters.produtoId) return false
        if (filters.marcaId && v._marcaId !== filters.marcaId) return false
        if (filters.modeloId && v._modeloId !== filters.modeloId) return false

        // O filtro "Ativo" deve excluir explicitamente status 'Em Quarentena' e deleted_at != null
        const inQuarantine = isQuarentenado(v.status, v.deleted_at)
        if (inQuarantine) return false

        if (filters.status === 'Ativo') {
          if (v.status !== 'Ativo' && v.status !== 'A') return false
        }
        if (filters.status === 'Inativo') {
          const s = v.status?.trim().toLowerCase()
          if (s !== 'inativo' && s !== 'i') return false
        }

        if (qs) {
          if (v.nome.toLowerCase().includes(qs)) return true
          if (v.cod_erp) return v.cod_erp.toLowerCase().includes(qs)
          return false
        }
        return true
      })
      .sort((a, b) => {
        const ta = a.created_at ? new Date(a.created_at).getTime() : 0
        const tb = b.created_at ? new Date(b.created_at).getTime() : 0
        return tb - ta
      })
  }, [versoesEnriched, filters, search])

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pagedRows = filteredRows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  // reset page when filters/search change
  useEffect(() => {
    setPage(1)
  }, [filters, search])

  // ---- handlers ----
  const handleNovaVersao = () => {
    setEditingVersao(null)
    setInitialModeloId(filters.modeloId ?? undefined)
    setVersaoFormOpen(true)
  }

  const handleEditRow = (v: VersaoEnriched) => {
    setEditingVersao(v)
    setInitialModeloId(v.modelo ?? undefined)
    setVersaoFormOpen(true)
  }

  const handleDeleteDone = (action: 'quarantine' | 'delete') => {
    if (action === 'quarantine') {
      toast({
        title: 'Versão movida para quarentena',
        description: 'Um Admin revisará em até 7 dias.',
      })
    } else {
      toast({ title: 'Versão excluída permanentemente' })
    }
    setDeleteTarget(null)
    clearVersoesCache()
    loadData()
  }

  const renderRowActions = (v: VersaoEnriched) => {
    return (
      <div className="flex items-center justify-end gap-1">
        {/* Botão Visualizar: visível para TODOS os perfis (incluindo Representante e Vendedor) */}
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-foreground hover:bg-muted"
          onClick={() => setViewingVersao(v)}
          title="Visualizar detalhes da versão"
        >
          <Eye className="w-3.5 h-3.5" />
        </Button>

        {canEditMachines ? (
          <>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-foreground hover:bg-muted"
              onClick={() => handleEditRow(v)}
              title="Editar"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => setDeleteTarget({ id: v.id, name: v.nome })}
              title="Excluir"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 opacity-40 cursor-not-allowed"
                disabled
              >
                <Lock className="w-3.5 h-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{MACHINE_EDIT_DENIED_TOOLTIP}</TooltipContent>
          </Tooltip>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Cpu className="w-7 h-7 text-primary" />
            Lista de Versões
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Catálogo de máquinas — versões cadastradas (Categoria → Produto → Marca → Modelo →
            Versão).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            disabled={loading}
            className="gap-1.5"
          >
            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
            Atualizar
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5"
            onClick={() => navigate('/produtos/gestao-maquinas')}
          >
            Gestão de Máquinas
            <ArrowRight className="w-4 h-4" />
          </Button>
          {canEditMachines ? (
            <Button
              size="sm"
              className="gap-1.5 text-white"
              style={{ backgroundColor: '#0b3c26' }}
              onClick={handleNovaVersao}
            >
              <Plus className="w-4 h-4" />
              Nova Versão
            </Button>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="sm" variant="outline" className="gap-1.5 opacity-60" disabled>
                  <Lock className="w-4 h-4" />
                  Nova Versão
                </Button>
              </TooltipTrigger>
              <TooltipContent>{MACHINE_EDIT_DENIED_TOOLTIP}</TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>

      {/* Filters — always visible, single row */}
      <div className="flex flex-wrap items-end gap-3">
        <FilterField
          label="Categoria"
          value={filters.categoriaId}
          onChange={(v) => {
            setFilters((f) => ({
              ...f,
              categoriaId: v,
              produtoId: null,
              marcaId: null,
              modeloId: null,
            }))
          }}
          options={categoriaOptions}
          placeholder="Todas"
        />
        <FilterField
          label="Produto"
          value={filters.produtoId}
          onChange={(v) => {
            setFilters((f) => ({ ...f, produtoId: v, marcaId: null, modeloId: null }))
          }}
          options={produtoOptions}
          placeholder="Todos"
        />
        <FilterField
          label="Marca"
          value={filters.marcaId}
          onChange={(v) => {
            setFilters((f) => ({ ...f, marcaId: v, modeloId: null }))
          }}
          options={marcaOptions}
          placeholder="Todas"
        />
        <FilterField
          label="Modelo"
          value={filters.modeloId}
          onChange={(v) => setFilters((f) => ({ ...f, modeloId: v }))}
          options={modeloOptions}
          placeholder="Todos"
        />

        {!isRepUser && (
          <StatusFilterField
            value={filters.status}
            onChange={(v) => setFilters((f) => ({ ...f, status: v }))}
          />
        )}

        <div className="flex-1 min-w-[220px] space-y-1">
          <label className="text-[11px] font-medium text-muted-foreground">Busca</label>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Nome da versão ou código ERP..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-10 text-sm"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-10 gap-1.5"
          onClick={clearFilters}
          disabled={activeFilterCount === 0 && !search}
        >
          <X className="w-3.5 h-3.5" />
          Limpar filtros
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left">
                <Th className="text-foreground">Versão</Th>
                <Th>Status</Th>
                <Th>Código ERP</Th>
                <Th>Categoria</Th>
                <Th>Produto</Th>
                <Th>Marca</Th>
                <Th>Modelo</Th>
                <Th align="right">Preço</Th>
                <Th align="right">Ações</Th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-b last:border-0">
                    {Array.from({ length: COLSPAN }).map((__, j) => (
                      <td key={j} className="px-4 py-3">
                        <Skeleton className="h-5 w-full max-w-[120px]" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : error ? (
                <tr>
                  <td colSpan={COLSPAN} className="px-4 py-8">
                    <ErrorState message="Erro ao carregar as versões" onRetry={loadData} />
                  </td>
                </tr>
              ) : pagedRows.length === 0 ? (
                <tr>
                  <td colSpan={COLSPAN} className="px-4 py-12">
                    <div className="flex flex-col items-center justify-center gap-3 text-center">
                      <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
                        <PackageX className="w-7 h-7 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          Nenhuma versão encontrada
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Ajuste a busca ou os filtros, ou cadastre uma nova versão.
                        </p>
                      </div>
                      {canEditMachines && (
                        <Button
                          size="sm"
                          className="gap-1.5 text-white"
                          style={{ backgroundColor: '#0b3c26' }}
                          onClick={handleNovaVersao}
                        >
                          <Plus className="w-4 h-4" />
                          Nova Versão
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                pagedRows.map((v) => (
                  <tr
                    key={v.id}
                    className="border-b last:border-0 hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-3">
                        {v.imagem_preview && !brokenImages.has(v.id) ? (
                          <div
                            role="button"
                            tabIndex={0}
                            aria-label={`Ampliar foto de ${v.nome}`}
                            className="relative group w-11 h-11 shrink-0 rounded-md border bg-white p-0.5 shadow-xs transition-transform duration-150 hover:scale-105 cursor-zoom-in focus:outline-hidden focus:ring-2 focus:ring-primary focus:ring-offset-1"
                            onClick={(e) => {
                              e.stopPropagation()
                              setPreviewImage({ url: v.imagem_preview!, nome: v.nome })
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault()
                                e.stopPropagation()
                                setPreviewImage({ url: v.imagem_preview!, nome: v.nome })
                              }
                            }}
                          >
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
                              className="w-full h-full object-contain rounded-sm"
                            />
                            <div
                              className="absolute inset-0 bg-black/40 rounded-sm opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity pointer-events-none"
                              title="Clique para ampliar a foto"
                            >
                              <ZoomIn className="w-4 h-4 text-white drop-shadow" />
                            </div>
                          </div>
                        ) : (
                          <div
                            className="w-11 h-11 shrink-0 rounded-md border border-dashed border-border/80 bg-muted/40 flex flex-col items-center justify-center text-[10px] text-muted-foreground gap-0.5 select-none"
                            title="Sem foto cadastrada"
                          >
                            <ImageIcon className="w-4 h-4 opacity-50" />
                            <span className="leading-none text-[8px] font-medium text-muted-foreground/80">
                              S/ foto
                            </span>
                          </div>
                        )}
                        <span className="font-semibold text-foreground leading-snug">{v.nome}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge
                        variant="secondary"
                        className={
                          v.status === 'Ativo'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 font-medium'
                            : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 font-medium'
                        }
                      >
                        {v.status === 'Ativo' ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground tabular-nums">
                      {v.cod_erp || '—'}
                    </td>
                    <td className="px-4 py-2.5">{v._categoriaNome}</td>
                    <td className="px-4 py-2.5">{v._produtoNome}</td>
                    <td className="px-4 py-2.5">{v._marcaNome}</td>
                    <td className="px-4 py-2.5">{v._modeloNome}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-medium text-foreground">
                      {formatCurrencyByMoeda(v.valor, v.moeda)}
                    </td>
                    <td className="px-4 py-2.5 text-right">{renderRowActions(v)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!loading && !error && filteredRows.length > 0 && (
          <div className="flex items-center justify-between gap-2 px-4 py-3 border-t bg-muted/20">
            <span className="text-xs text-muted-foreground">
              {filteredRows.length} {filteredRows.length === 1 ? 'versão' : 'versões'} · página{' '}
              {safePage} de {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage <= 1}
              >
                <ChevronLeft className="w-4 h-4" />
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
              >
                Próximo
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ===================== MODALS ===================== */}

      {/* Visualizar Versão (Somente Leitura) */}
      <VersaoDetalhesDialog
        versao={viewingVersao}
        open={!!viewingVersao}
        onOpenChange={(open) => !open && setViewingVersao(null)}
      />

      {/* Add / Edit Versão */}
      <VersaoForm
        key={editingVersao?.id ?? 'new-versao'}
        open={versaoFormOpen}
        editing={editingVersao}
        initialModeloId={initialModeloId}
        onOpenChange={(open) => {
          setVersaoFormOpen(open)
          if (!open) {
            setEditingVersao(null)
            setInitialModeloId(undefined)
          }
        }}
        onSaved={async () => {
          clearVersoesCache()
          await loadData()
          setVersaoFormOpen(false)
          setEditingVersao(null)
          setInitialModeloId(undefined)
        }}
      />

      {/* Delete / Quarantine */}
      <MachineDeleteDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        table="versoes"
        itemId={deleteTarget?.id ?? ''}
        itemName={deleteTarget?.name ?? 'esta versão'}
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

// ---- table header cell ----
function Th({
  children,
  align = 'left',
  className,
}: {
  children: React.ReactNode
  align?: 'left' | 'right'
  className?: string
}) {
  return (
    <th
      className={cn(
        'px-4 py-2.5 font-semibold text-muted-foreground',
        align === 'right' ? 'text-right' : 'text-left',
        className,
      )}
    >
      {children}
    </th>
  )
}

// ---- small subcomponent ----

function FilterField({
  label,
  value,
  onChange,
  options,
  placeholder,
}: {
  label: string
  value: string | null
  onChange: (v: string | null) => void
  options: ComboboxOption[]
  placeholder: string
}) {
  return (
    <div className="space-y-1 min-w-[160px]">
      <label className="text-[11px] font-medium text-muted-foreground">{label}</label>
      <MachineCombobox
        value={value}
        onChange={onChange}
        options={options}
        placeholder={placeholder}
        searchPlaceholder={`Buscar ${label.toLowerCase()}...`}
        emptyMessage={`Nenhum(a) ${label.toLowerCase()} disponível`}
      />
    </div>
  )
}

function StatusFilterField({
  value,
  onChange,
}: {
  value: 'Todos' | 'Ativo' | 'Inativo'
  onChange: (v: 'Todos' | 'Ativo' | 'Inativo') => void
}) {
  return (
    <div className="space-y-1 min-w-[140px]">
      <label className="text-[11px] font-medium text-muted-foreground">Status</label>
      <Select value={value} onValueChange={(val) => onChange(val as 'Todos' | 'Ativo' | 'Inativo')}>
        <SelectTrigger className="h-10 text-sm bg-background">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="Todos">Todos</SelectItem>
          <SelectItem value="Ativo">Ativo</SelectItem>
          <SelectItem value="Inativo">Inativo</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}
