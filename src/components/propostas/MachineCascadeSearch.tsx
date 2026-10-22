import { useState, useEffect, useCallback, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  Command,
  CommandInput,
  CommandList,
  CommandItem,
  CommandEmpty,
  CommandGroup,
} from '@/components/ui/command'
import {
  CheckCircle2,
  AlertCircle,
  Search,
  SlidersHorizontal,
  ChevronDown,
  X,
  Check,
  Package,
  ChevronsUpDown,
  Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { MachineCombobox, ComboboxOption } from '@/components/produtos/MachineCombobox'
import { fetchCategoriasProdutos } from '@/services/categorias-produtos'
import { fetchProdutos } from '@/services/produtos'
import { fetchMarcas } from '@/services/marcas'
import { fetchModelos } from '@/services/modelos'
import { fetchVersoes } from '@/services/versoes'

import { CategoriaProduto } from '@/types/categoria-produto'
import { Produto } from '@/types/produto'
import { Marca } from '@/types/marca'
import { Modelo } from '@/types/modelo'
import { VersaoWithModelo } from '@/types/versao'

import { CategoriaForm } from '@/components/produtos/CategoriaForm'
import { ProdutoForm } from '@/components/produtos/ProdutoForm'
import { MarcaForm } from '@/components/produtos/MarcaForm'
import { ModeloForm } from '@/components/produtos/ModeloForm'
import { VersaoForm } from '@/components/produtos/VersaoForm'
import { MachineAddButton } from '@/components/produtos/MachineAddButton'
import { useCanEditMachines } from '@/hooks/use-machine-permissions'
import { useGerenteCategoryRestriction } from '@/hooks/use-gerente-restriction'

export interface MachineCascadeSelection {
  categoriaId: string | null
  produtoId: string | null
  marcaId: string | null
  modeloId: string | null
  versaoId: string | null
}

interface MachineCascadeSearchProps {
  value: MachineCascadeSelection
  onChange: (selection: MachineCascadeSelection) => void
  disabled?: boolean
  showBreadcrumbContext?: boolean
}

/**
 * Versão "busca" do seletor de máquina, otimizada para o fluxo de emissão de
 * proposta. A VERSÃO é o campo principal e destacado (autocompletável, mostra
 * todas as versões disponíveis quando nenhum filtro está ativo). Categoria,
 * Produto, Marca e Modelo viram filtros secundários discretos e opcionais que
 * apenas refinam a lista de versões exibida.
 *
 * Ao selecionar uma versão, todos os filtros (Categoria, Produto, Marca,
 * Modelo) são preenchidos automaticamente a partir dos vínculos da versão — o
 * que mantém a obrigatoriedade dos 5 níveis para emitir a proposta sem exigir
 * que o representante os selecione manualmente.
 *
 * A cascata clássica (5 níveis sequenciais) usada na Gestão de Máquinas não é
 * afetada — continua no componente `MachineCascade`.
 */
export function MachineCascadeSearch({
  value,
  onChange,
  disabled = false,
  showBreadcrumbContext = true,
}: MachineCascadeSearchProps) {
  // Raw Data State
  const [categorias, setCategorias] = useState<CategoriaProduto[]>([])
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [marcas, setMarcas] = useState<Marca[]>([])
  const [modelos, setModelos] = useState<Modelo[]>([])
  const [versoes, setVersoes] = useState<VersaoWithModelo[]>([])
  const [loading, setLoading] = useState(true)

  // Versão search Popover
  const [versaoOpen, setVersaoOpen] = useState(false)
  const [versaoSearch, setVersaoSearch] = useState('')

  // Collapsible filters
  const [filtersOpen, setFiltersOpen] = useState(false)

  // Dialog Quick Create States
  const [addModal, setAddModal] = useState<
    'categoria' | 'produto' | 'marca' | 'modelo' | 'versao' | null
  >(null)

  // Permission: only Comercial/Admin may create/edit machines. Dropdowns keep
  // working for everyone — only the quick-create "+" buttons are gated.
  const canEditMachines = useCanEditMachines()
  const restriction = useGerenteCategoryRestriction()

  const loadData = useCallback(async () => {
    if (restriction.loading) return
    setLoading(true)
    try {
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
          activeOnly: true,
          categoriaId: catFilter,
          categoriaIds: catIdsFilter,
          lightweight: true,
        }),
      ])

      // Filtra apenas pais ativos (não quarentenados / não deletados)
      const isParentActive = (item: { status?: string | null; deleted_at?: string | null }) => {
        if (item.deleted_at) return false
        const s = item.status?.trim().toLowerCase()
        return s !== 'em quarentena' && s !== 'quarentena' && s !== 'inativo' && s !== 'i'
      }

      setCategorias((cats || []).filter(isParentActive))
      setProdutos((prods || []).filter(isParentActive))
      setMarcas((mrcs || []).filter(isParentActive))
      setModelos((mods || []).filter(isParentActive))
      setVersoes(vers || [])
    } catch (err) {
      console.error('Error loading machine cascade search data:', err)
    } finally {
      setLoading(false)
    }
  }, [
    restriction.loading,
    restriction.hasRestriction,
    restriction.categoriaId,
    restriction.categoriaIds,
  ])

  useEffect(() => {
    loadData()
  }, [loadData])

  // --- Derived lookup maps (for resolving the parent chain of each versão) ---
  const modeloMap = useMemo(() => new Map(modelos.map((m) => [m.id, m])), [modelos])
  const produtoMap = useMemo(() => new Map(produtos.map((p) => [p.id, p])), [produtos])

  // Enriched versão list with resolved parent names — used both for the search
  // results and for filtering by the secondary filters.
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

  const isVersaoInativa = (status?: string | null, deletedAt?: string | null) => {
    if (deletedAt) return true
    if (!status) return false
    const s = status.trim().toLowerCase()
    return s === 'inativo' || s === 'i' || s === 'em quarentena' || s === 'quarentena'
  }

  // Na emissão de proposta, retornar EXCLUSIVAMENTE versões com status ativo ('A'/'Ativo'),
  // excluindo 'inativo', 'i', 'em quarentena', 'quarentena' e deleted_at != null.
  const versoesAtivas = useMemo(() => {
    return versoes.filter((v) => !isVersaoInativa(v.status, v.deleted_at))
  }, [versoes])

  const versoesEnriched = useMemo<VersaoEnriched[]>(() => {
    return versoesAtivas
      .map((v) => {
        const modelo = v.modelo ? modeloMap.get(v.modelo) : undefined
        const produto = modelo?.produto ? produtoMap.get(modelo.produto) : undefined
        const marca = modelo?.marca ? marcas.find((m) => m.id === modelo.marca) : undefined
        // Prioriza a categoria gravada diretamente na versão, com fallback na cadeia modelo->produto
        const effectiveCatId = v.categoria_id || produto?.categoria || null
        const categoria = effectiveCatId
          ? categorias.find((c) => c.id === effectiveCatId)
          : undefined
        return {
          ...v,
          _modeloId: modelo?.id ?? null,
          _marcaId: marca?.id ?? null,
          _produtoId: produto?.id ?? null,
          _categoriaId: categoria?.id ?? null,
          _modeloNome: modelo?.nome ?? '—',
          _marcaNome: marca?.nome ?? '—',
          _produtoNome: produto?.nome ?? '—',
          _categoriaNome: categoria?.nome ?? '—',
        }
      })
      .filter((v) => {
        // Exclui versões cujos pais (categoria, produto ou modelo) não existem na lista ativa (ex: foram postos em quarentena)
        if (v.modelo && !modeloMap.has(v.modelo)) return false
        if (v._produtoId && !produtoMap.has(v._produtoId)) return false
        if (v._categoriaId && !categorias.some((c) => c.id === v._categoriaId)) return false

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
    versoesAtivas,
    modeloMap,
    produtoMap,
    marcas,
    categorias,
    restriction.hasRestriction,
    restriction.categoriaId,
    restriction.categoriaIds,
  ])

  // --- Secondary filter option lists ---
  // Each filter only shows values that actually exist within the currently
  // applied sibling filters — e.g. choosing Marca narrows Categoria/Produto/
  // Modelo options to those compatible with that Marca. This keeps the filters
  // feeling responsive without ever making them mandatory.

  // The set of versões that match ALL currently active filters (any filter
  // may be empty, which means "no constraint on that level").
  const filteredVersoes = useMemo(() => {
    return versoesEnriched.filter((v) => {
      if (value.categoriaId && v._categoriaId !== value.categoriaId) return false
      if (value.produtoId && v._produtoId !== value.produtoId) return false
      if (value.marcaId && v._marcaId !== value.marcaId) return false
      if (value.modeloId && v._modeloId !== value.modeloId) return false
      return true
    })
  }, [versoesEnriched, value.categoriaId, value.produtoId, value.marcaId, value.modeloId])

  // Helper: distinct active values for a given level within filteredVersoes.
  const distinctActive = (key: keyof VersaoEnriched) => {
    const seen = new Map<string, string>()
    for (const v of filteredVersoes) {
      if (!v) continue
      const id = (v[key] as string | null) ?? null
      if (id) {
        const nomeKey = (
          {
            _categoriaId: '_categoriaNome',
            _produtoId: '_produtoNome',
            _marcaId: '_marcaNome',
            _modeloId: '_modeloNome',
          } as const
        )[key as '_categoriaId' | '_produtoId' | '_marcaId' | '_modeloId']
        const nome = (v[nomeKey] as string) || '—'
        if (!seen.has(id)) seen.set(id, nome)
      }
    }
    return seen
  }

  const categoriaOptions: ComboboxOption[] = useMemo(() => {
    const active = distinctActive('_categoriaId')
    // Always include the currently selected value even if no versão matches
    // (so the chip stays visible while the user is editing).
    if (value.categoriaId && !active.has(value.categoriaId)) {
      const c = categorias.find((x) => x?.id === value.categoriaId)
      if (c) active.set(c.id, c.nome || '—')
    }
    let list = Array.from(active.entries())
    if (restriction.hasRestriction) {
      if (restriction.categoriaIds.length > 0) {
        list = list.filter(([catId]) => restriction.categoriaIds.includes(catId))
      } else if (restriction.categoriaId) {
        list = list.filter(([catId]) => catId === restriction.categoriaId)
      }
    }
    return list
      .sort((a, b) => (a[1] || '').localeCompare(b[1] || ''))
      .map(([val, label]) => ({ value: val, label: label || '—' }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    filteredVersoes,
    categorias,
    value.categoriaId,
    restriction.hasRestriction,
    restriction.categoriaId,
    restriction.categoriaIds,
  ])

  const produtoOptions: ComboboxOption[] = useMemo(() => {
    const active = distinctActive('_produtoId')
    if (value.produtoId && !active.has(value.produtoId)) {
      const p = produtos.find((x) => x?.id === value.produtoId)
      if (p) active.set(p.id, p.nome || '—')
    }
    return Array.from(active.entries())
      .sort((a, b) => (a[1] || '').localeCompare(b[1] || ''))
      .map(([val, label]) => ({ value: val, label: label || '—' }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredVersoes, produtos, value.produtoId])

  const marcaOptions: ComboboxOption[] = useMemo(() => {
    const active = distinctActive('_marcaId')
    if (value.marcaId && !active.has(value.marcaId)) {
      const m = marcas.find((x) => x?.id === value.marcaId)
      if (m) active.set(m.id, m.nome || '—')
    }
    return Array.from(active.entries())
      .sort((a, b) => (a[1] || '').localeCompare(b[1] || ''))
      .map(([val, label]) => ({ value: val, label: label || '—' }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredVersoes, marcas, value.marcaId])

  const modeloOptions: ComboboxOption[] = useMemo(() => {
    const active = distinctActive('_modeloId')
    if (value.modeloId && !active.has(value.modeloId)) {
      const m = modelos.find((x) => x?.id === value.modeloId)
      if (m) active.set(m.id, m.nome || '—')
    }
    return Array.from(active.entries())
      .sort((a, b) => (a[1] || '').localeCompare(b[1] || ''))
      .map(([val, label]) => ({ value: val, label: label || '—' }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredVersoes, modelos, value.modeloId])

  // --- Versão search results ---
  const versaoSearchResults = useMemo<VersaoEnriched[]>(() => {
    const q = versaoSearch.trim().toLowerCase()
    if (!q) {
      return filteredVersoes.slice(0, 100)
    }

    // Split search terms by whitespace to support multi-term queries (e.g. "V5XP M80A")
    const terms = q.split(/\s+/).filter(Boolean)

    const list = filteredVersoes.filter((v) => {
      const searchTarget = [
        v.nome,
        v.nome_abreviado ?? '',
        v.cod_erp ?? '',
        v._modeloNome,
        v._marcaNome,
        v._produtoNome,
        v._categoriaNome,
      ]
        .join(' ')
        .toLowerCase()

      return terms.every((term) => searchTarget.includes(term))
    })

    // Cap the rendered list for performance / UX on very large catalogs.
    return list.slice(0, 100)
  }, [filteredVersoes, versaoSearch])

  const totalVersoesAvailable = filteredVersoes.length

  // --- Filter change handlers ---
  // Changing a filter NEVER clears the versão selection directly — the versão
  // remains selected (and its parent filters are kept in sync) until the user
  // either picks a different versão or explicitly clears a filter that the
  // current versão no longer matches. If a filter is set that excludes the
  // currently selected versão, we clear the versão (but keep the filter).
  const applyFilter = (
    patch: Partial<
      Pick<MachineCascadeSelection, 'categoriaId' | 'produtoId' | 'marcaId' | 'modeloId'>
    >,
  ) => {
    const next: MachineCascadeSelection = { ...value, ...patch }
    // If the selected versão no longer matches the new filter set, drop it.
    if (next.versaoId) {
      const sel = versoesEnriched.find((v) => v.id === next.versaoId)
      if (
        sel &&
        ((next.categoriaId && sel._categoriaId !== next.categoriaId) ||
          (next.produtoId && sel._produtoId !== next.produtoId) ||
          (next.marcaId && sel._marcaId !== next.marcaId) ||
          (next.modeloId && sel._modeloId !== next.modeloId))
      ) {
        next.versaoId = null
      }
    }
    onChange(next)
  }

  const handleCategoriaChange = (id: string | null) => applyFilter({ categoriaId: id })
  const handleProdutoChange = (id: string | null) => applyFilter({ produtoId: id })
  const handleMarcaChange = (id: string | null) => applyFilter({ marcaId: id })
  const handleModeloChange = (id: string | null) => applyFilter({ modeloId: id })

  // --- Versão selection: fills all parent filters automatically ---
  const handleVersaoSelect = (id: string) => {
    const v = versoesEnriched.find((x) => x.id === id)
    if (!v) {
      onChange({ ...value, versaoId: id })
      setVersaoOpen(false)
      setVersaoSearch('')
      return
    }
    onChange({
      categoriaId: v._categoriaId,
      produtoId: v._produtoId,
      marcaId: v._marcaId,
      modeloId: v._modeloId,
      versaoId: v.id,
    })
    setVersaoOpen(false)
    setVersaoSearch('')
  }

  const handleVersaoClear = () => {
    setVersaoSearch('')
    onChange({
      categoriaId: null,
      produtoId: null,
      marcaId: null,
      modeloId: null,
      versaoId: null,
    })
  }

  const handleClearFilters = () => {
    onChange({ ...value, categoriaId: null, produtoId: null, marcaId: null, modeloId: null })
  }

  // --- Resolved selected entities (for chips & breadcrumb) ---
  const selectedCategoria = categorias.find((c) => c.id === value.categoriaId)
  const selectedProduto = produtos.find((p) => p.id === value.produtoId)
  const selectedMarca = marcas.find((m) => m.id === value.marcaId)
  const selectedModelo = modelos.find((m) => m.id === value.modeloId)
  const selectedVersao = versoes.find((v) => v.id === value.versaoId)

  const isComplete =
    !!value.categoriaId &&
    !!value.produtoId &&
    !!value.marcaId &&
    !!value.modeloId &&
    !!value.versaoId

  const activeFilterCount =
    (value.categoriaId ? 1 : 0) +
    (value.produtoId ? 1 : 0) +
    (value.marcaId ? 1 : 0) +
    (value.modeloId ? 1 : 0)

  const hasAnyFilter = activeFilterCount > 0

  // When the versão is selected, filters are auto-filled — but if the user
  // never touched them manually we don't want to show the filters panel as
  // "active" in a noisy way. We still show chips for whatever is set.
  return (
    <div className="space-y-4">
      {/* ===== VERSÃO — campo principal em destaque ===== */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <label className="text-sm font-bold text-[#0b3c26] dark:text-emerald-300 flex items-center gap-2">
            <Package className="w-4 h-4" />
            Escolha a Máquina
          </label>
          {value.versaoId ? (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 px-2.5 py-1 rounded-full border border-emerald-200 dark:border-emerald-800">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Máquina selecionada
            </span>
          ) : (
            <span className="text-xs text-muted-foreground flex items-center gap-1.5">
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />}
              {loading
                ? 'Carregando catálogo de máquinas...'
                : `${totalVersoesAvailable} ${totalVersoesAvailable === 1 ? 'versão disponível' : 'versões disponíveis'}`}
            </span>
          )}
        </div>

        {/* Versão search combobox — large, green-accented border */}
        <div className="flex items-stretch gap-2">
          <Popover open={versaoOpen} onOpenChange={setVersaoOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                role="combobox"
                disabled={disabled}
                title={selectedVersao?.nome}
                className={cn(
                  'flex-1 min-w-0 h-auto min-h-14 justify-between font-normal text-left px-4 py-3 whitespace-normal',
                  'border-2 rounded-xl transition-colors',
                  value.versaoId
                    ? 'border-[#0b3c26] dark:border-emerald-700 bg-[#0b3c26]/5 dark:bg-emerald-950/20'
                    : 'border-[#0b3c26]/40 dark:border-emerald-800/50 hover:border-[#0b3c26] dark:hover:border-emerald-600',
                  !value.versaoId && 'text-muted-foreground',
                )}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1 mr-2">
                  {loading ? (
                    <Loader2 className="w-5 h-5 text-[#0b3c26] dark:text-emerald-400 shrink-0 self-start mt-0.5 animate-spin" />
                  ) : (
                    <Search className="w-5 h-5 text-[#0b3c26] dark:text-emerald-400 shrink-0 self-start mt-0.5" />
                  )}
                  <div className="flex flex-col min-w-0 flex-1">
                    {loading && !value.versaoId ? (
                      <span className="text-sm sm:text-base font-medium text-muted-foreground">
                        Carregando máquinas disponíveis...
                      </span>
                    ) : value.versaoId && selectedVersao ? (
                      <>
                        <span className="text-sm sm:text-base font-bold text-foreground leading-snug break-words line-clamp-2 sm:line-clamp-none">
                          {selectedVersao.nome}
                        </span>
                        <span
                          className="text-xs text-muted-foreground mt-0.5 truncate"
                          title={`${selectedMarca?.nome || '—'} · ${selectedModelo?.nome || '—'}${selectedVersao.cod_erp ? ` · ERP: ${selectedVersao.cod_erp}` : ''}`}
                        >
                          {selectedMarca?.nome || '—'} · {selectedModelo?.nome || '—'}
                          {selectedVersao.cod_erp ? ` · ERP: ${selectedVersao.cod_erp}` : ''}
                        </span>
                      </>
                    ) : (
                      <span className="text-sm sm:text-base font-medium">
                        Buscar máquina por nome, código, modelo...
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0 self-center">
                  {value.versaoId && !disabled && (
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleVersaoClear()
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.stopPropagation()
                          handleVersaoClear()
                        }
                      }}
                      className="rounded-md hover:bg-black/10 dark:hover:bg-white/10 p-1.5 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                      title="Limpar seleção"
                    >
                      <X className="w-4 h-4" />
                    </span>
                  )}
                  <ChevronsUpDown className="w-4 h-4 opacity-50" />
                </div>
              </Button>
            </PopoverTrigger>
            <PopoverContent
              className="w-[--radix-popover-trigger-width] p-0"
              align="start"
              sideOffset={4}
            >
              <Command shouldFilter={false}>
                <CommandInput
                  value={versaoSearch}
                  onValueChange={setVersaoSearch}
                  placeholder="Digite o nome ou código da versão..."
                />
                <CommandList className="max-h-80 overflow-y-auto">
                  {loading && versaoSearchResults.length === 0 ? (
                    <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                      <Loader2 className="w-4 h-4 animate-spin text-primary" />
                      <span>Carregando catálogo de máquinas...</span>
                    </div>
                  ) : versaoSearchResults.length === 0 ? (
                    <CommandEmpty className="p-4 text-sm text-center text-muted-foreground">
                      {totalVersoesAvailable === 0
                        ? loading
                          ? 'Carregando versões...'
                          : 'Nenhuma versão encontrada para os filtros atuais.'
                        : 'Nenhuma versão encontrada.'}
                    </CommandEmpty>
                  ) : (
                    <CommandGroup>
                      <div className="px-2 py-1.5 text-[11px] uppercase tracking-wider text-muted-foreground sticky top-0 bg-popover z-10">
                        {versaoSearchResults.length}
                        {totalVersoesAvailable > versaoSearchResults.length
                          ? ` de ${totalVersoesAvailable}`
                          : ''}{' '}
                        versões
                      </div>
                      {versaoSearchResults.map((v) => (
                        <CommandItem
                          key={v.id}
                          value={v.id}
                          onSelect={() => handleVersaoSelect(v.id)}
                          className="cursor-pointer py-2.5"
                        >
                          <Check
                            className={cn(
                              'mr-2 h-4 w-4 shrink-0',
                              value.versaoId === v.id ? 'opacity-100' : 'opacity-0',
                            )}
                          />
                          <div className="flex flex-col min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="truncate text-sm font-semibold">{v.nome}</span>
                              {v.cod_erp && (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] px-1.5 py-0 h-4 font-normal shrink-0"
                                >
                                  ERP: {v.cod_erp}
                                </Badge>
                              )}
                            </div>
                            <span className="truncate text-xs text-muted-foreground">
                              {v._categoriaNome} › {v._produtoNome} › {v._marcaNome} ›{' '}
                              {v._modeloNome}
                            </span>
                          </div>
                          <span className="text-xs font-semibold text-[#0b3c26] dark:text-emerald-400 shrink-0 ml-2 tabular-nums">
                            {(() => {
                              const num =
                                typeof v.valor === 'number' && !isNaN(v.valor) ? v.valor : 0
                              const curr = (v.moeda || 'BRL').trim().toUpperCase()
                              const validCurr = /^[A-Z]{3}$/.test(curr) ? curr : 'BRL'
                              try {
                                return num.toLocaleString('pt-BR', {
                                  style: 'currency',
                                  currency: validCurr,
                                })
                              } catch {
                                return `R$ ${num.toFixed(2)}`
                              }
                            })()}
                          </span>
                        </CommandItem>
                      ))}
                      {totalVersoesAvailable > versaoSearchResults.length && (
                        <div className="px-3 py-2 text-xs text-center text-muted-foreground border-t">
                          Refine a busca para ver mais
                        </div>
                      )}
                    </CommandGroup>
                  )}
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>

          {/* Quick-create versão button */}
          <MachineAddButton
            label="Cadastrar Nova Versão"
            canEdit={canEditMachines}
            disabled={disabled}
            onClick={() => setAddModal('versao')}
            iconClassName="w-5 h-5"
            className="h-auto min-h-14 w-14 self-stretch shrink-0 border-2 border-[#0b3c26]/40 dark:border-emerald-800/50 hover:border-[#0b3c26] dark:hover:border-emerald-600 hover:text-[#0b3c26] dark:hover:text-emerald-400 transition-colors"
          />
        </div>
      </div>

      {/* ===== FILTROS SECUNDÁRIOS — discretos e colapsáveis ===== */}
      <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CollapsibleTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground h-7 px-2"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Filtrar por
              {hasAnyFilter && (
                <Badge className="ml-1 h-4 px-1.5 text-[10px] font-semibold bg-[#0b3c26] text-white hover:bg-[#0b3c26]">
                  {activeFilterCount}
                </Badge>
              )}
              <ChevronDown
                className={cn('w-3.5 h-3.5 transition-transform', filtersOpen && 'rotate-180')}
              />
            </Button>
          </CollapsibleTrigger>

          {hasAnyFilter && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
              onClick={handleClearFilters}
              disabled={disabled}
            >
              <X className="w-3 h-3 mr-1" />
              Limpar filtros
            </Button>
          )}
        </div>

        {/* Active filter chips — always visible when a filter is set */}
        {hasAnyFilter && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {selectedCategoria && (
              <Badge
                variant="secondary"
                title={`Categoria: ${selectedCategoria.nome}`}
                className="inline-flex max-w-full items-center gap-1 py-1 pl-2 pr-1 text-xs bg-[#0b3c26]/10 text-[#0b3c26] dark:bg-emerald-950/40 dark:text-emerald-300 border-[#0b3c26]/20 dark:border-emerald-800/40 whitespace-normal text-left h-auto"
              >
                <span className="text-muted-foreground font-normal shrink-0">Categoria:</span>
                <span className="font-semibold break-words min-w-0">{selectedCategoria.nome}</span>
                {!disabled && (
                  <button
                    type="button"
                    onClick={() => handleCategoriaChange(null)}
                    className="ml-0.5 rounded-full hover:bg-[#0b3c26]/20 p-0.5 shrink-0"
                    title="Remover filtro"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </Badge>
            )}
            {selectedProduto && (
              <Badge
                variant="secondary"
                title={`Produto: ${selectedProduto.nome}`}
                className="inline-flex max-w-full items-center gap-1 py-1 pl-2 pr-1 text-xs bg-[#0b3c26]/10 text-[#0b3c26] dark:bg-emerald-950/40 dark:text-emerald-300 border-[#0b3c26]/20 dark:border-emerald-800/40 whitespace-normal text-left h-auto"
              >
                <span className="text-muted-foreground font-normal shrink-0">Produto:</span>
                <span className="font-semibold break-words min-w-0">{selectedProduto.nome}</span>
                {!disabled && (
                  <button
                    type="button"
                    onClick={() => handleProdutoChange(null)}
                    className="ml-0.5 rounded-full hover:bg-[#0b3c26]/20 p-0.5 shrink-0"
                    title="Remover filtro"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </Badge>
            )}
            {selectedMarca && (
              <Badge
                variant="secondary"
                title={`Marca: ${selectedMarca.nome}`}
                className="inline-flex max-w-full items-center gap-1 py-1 pl-2 pr-1 text-xs bg-[#0b3c26]/10 text-[#0b3c26] dark:bg-emerald-950/40 dark:text-emerald-300 border-[#0b3c26]/20 dark:border-emerald-800/40 whitespace-normal text-left h-auto"
              >
                <span className="text-muted-foreground font-normal shrink-0">Marca:</span>
                <span className="font-semibold break-words min-w-0">{selectedMarca.nome}</span>
                {!disabled && (
                  <button
                    type="button"
                    onClick={() => handleMarcaChange(null)}
                    className="ml-0.5 rounded-full hover:bg-[#0b3c26]/20 p-0.5 shrink-0"
                    title="Remover filtro"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </Badge>
            )}
            {selectedModelo && (
              <Badge
                variant="secondary"
                title={`Modelo: ${selectedModelo.nome}`}
                className="inline-flex max-w-full items-center gap-1 py-1 pl-2 pr-1 text-xs bg-[#0b3c26]/10 text-[#0b3c26] dark:bg-emerald-950/40 dark:text-emerald-300 border-[#0b3c26]/20 dark:border-emerald-800/40 whitespace-normal text-left h-auto"
              >
                <span className="text-muted-foreground font-normal shrink-0">Modelo:</span>
                <span className="font-semibold break-words min-w-0">{selectedModelo.nome}</span>
                {!disabled && (
                  <button
                    type="button"
                    onClick={() => handleModeloChange(null)}
                    className="ml-0.5 rounded-full hover:bg-[#0b3c26]/20 p-0.5 shrink-0"
                    title="Remover filtro"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </Badge>
            )}
          </div>
        )}

        <CollapsibleContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-3 mt-3 pt-3 border-t border-dashed">
            {/* Categoria */}
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground">Categoria</label>
              <div className="flex items-center gap-1.5">
                <div className="flex-1 min-w-0">
                  <MachineCombobox
                    value={value.categoriaId}
                    onChange={handleCategoriaChange}
                    options={categoriaOptions}
                    placeholder="Todas"
                    searchPlaceholder="Buscar categoria..."
                    disabled={disabled || loading}
                    emptyMessage="Nenhuma categoria disponível"
                  />
                </div>
                <MachineAddButton
                  label="Cadastrar Nova Categoria"
                  canEdit={canEditMachines}
                  disabled={disabled}
                  size="sm"
                  onClick={() => setAddModal('categoria')}
                />
              </div>
            </div>

            {/* Produto */}
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground">Produto</label>
              <div className="flex items-center gap-1.5">
                <div className="flex-1 min-w-0">
                  <MachineCombobox
                    value={value.produtoId}
                    onChange={handleProdutoChange}
                    options={produtoOptions}
                    placeholder="Todos"
                    searchPlaceholder="Buscar produto..."
                    disabled={disabled || loading}
                    emptyMessage="Nenhum produto disponível"
                  />
                </div>
                <MachineAddButton
                  label="Cadastrar Novo Produto"
                  canEdit={canEditMachines}
                  disabled={disabled}
                  size="sm"
                  onClick={() => setAddModal('produto')}
                />
              </div>
            </div>

            {/* Marca */}
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground">Marca</label>
              <div className="flex items-center gap-1.5">
                <div className="flex-1 min-w-0">
                  <MachineCombobox
                    value={value.marcaId}
                    onChange={handleMarcaChange}
                    options={marcaOptions}
                    placeholder="Todas"
                    searchPlaceholder="Buscar marca..."
                    disabled={disabled || loading}
                    emptyMessage="Nenhuma marca disponível"
                  />
                </div>
                <MachineAddButton
                  label="Cadastrar Nova Marca"
                  canEdit={canEditMachines}
                  disabled={disabled}
                  size="sm"
                  onClick={() => setAddModal('marca')}
                />
              </div>
            </div>

            {/* Modelo */}
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground">Modelo</label>
              <div className="flex items-center gap-1.5">
                <div className="flex-1 min-w-0">
                  <MachineCombobox
                    value={value.modeloId}
                    onChange={handleModeloChange}
                    options={modeloOptions}
                    placeholder="Todos"
                    searchPlaceholder="Buscar modelo..."
                    disabled={disabled || loading}
                    emptyMessage="Nenhum modelo disponível"
                  />
                </div>
                <MachineAddButton
                  label="Cadastrar Novo Modelo"
                  canEdit={canEditMachines}
                  disabled={disabled}
                  size="sm"
                  onClick={() => setAddModal('modelo')}
                />
              </div>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* ===== Status / Breadcrumb ===== */}
      {showBreadcrumbContext && (
        <div className="p-3 bg-muted/30 dark:bg-muted/20 rounded-lg border space-y-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Hierarquia Selecionada
            </span>
            {isComplete ? (
              <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 px-2.5 py-1 rounded-full text-xs font-medium border border-emerald-200 dark:border-emerald-800">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                Hierarquia Completa
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 px-2.5 py-1 rounded-full text-xs font-medium border border-amber-200 dark:border-amber-800">
                <AlertCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                {value.versaoId ? 'Preenchendo filtros...' : 'Selecione uma versão (5 níveis)'}
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-1.5 items-center text-xs">
            {[
              { label: 'Categoria', val: selectedCategoria?.nome },
              { label: 'Produto', val: selectedProduto?.nome },
              { label: 'Marca', val: selectedMarca?.nome },
              { label: 'Modelo', val: selectedModelo?.nome },
              {
                label: 'Versão',
                val: selectedVersao?.nome,
              },
            ].map((item, i, arr) => (
              <div key={item.label} className="inline-flex items-center gap-1.5 max-w-full">
                <div
                  className="inline-flex items-center gap-1.5 bg-background border rounded-md px-2 py-1 shadow-xs max-w-full"
                  title={item.val ? `${item.label}: ${item.val}` : undefined}
                >
                  <span className="text-muted-foreground font-medium shrink-0">{item.label}:</span>
                  <span
                    className={cn(
                      'break-words min-w-0 whitespace-normal',
                      item.val ? 'font-semibold text-foreground' : 'text-muted-foreground italic',
                    )}
                  >
                    {item.val || 'Pendente'}
                  </span>
                </div>
                {i < arr.length - 1 && (
                  <span className="text-muted-foreground/40 font-bold shrink-0">›</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* --- QUICK CREATE MODALS --- */}

      {/* 1. Modal Nova Categoria */}
      <CategoriaForm
        open={addModal === 'categoria'}
        onOpenChange={(open) => !open && setAddModal(null)}
        onSaved={async (newCategoria) => {
          await loadData()
          handleCategoriaChange(newCategoria.id)
          setAddModal(null)
        }}
      />

      {/* 2. Modal Novo Produto */}
      <ProdutoForm
        open={addModal === 'produto'}
        onOpenChange={(open) => !open && setAddModal(null)}
        initialCategoriaId={value.categoriaId || undefined}
        onSaved={async (newProduto) => {
          await loadData()
          handleProdutoChange(newProduto.id)
          setAddModal(null)
        }}
      />

      {/* 3. Modal Nova Marca */}
      <MarcaForm
        open={addModal === 'marca'}
        onOpenChange={(open) => !open && setAddModal(null)}
        onSaved={async (newMarca) => {
          await loadData()
          handleMarcaChange(newMarca.id)
          setAddModal(null)
        }}
      />

      {/* 4. Modal Novo Modelo */}
      <ModeloForm
        open={addModal === 'modelo'}
        onOpenChange={(open) => !open && setAddModal(null)}
        initialProdutoId={value.produtoId || undefined}
        initialMarcaId={value.marcaId || undefined}
        onSaved={async (newModelo) => {
          await loadData()
          handleModeloChange(newModelo.id)
          setAddModal(null)
        }}
      />

      {/* 5. Modal Nova Versão */}
      <VersaoForm
        open={addModal === 'versao'}
        onOpenChange={(open) => !open && setAddModal(null)}
        initialModeloId={value.modeloId || undefined}
        onSaved={async (newVersao) => {
          await loadData()
          handleVersaoSelect(newVersao.id)
          setAddModal(null)
        }}
      />
    </div>
  )
}
