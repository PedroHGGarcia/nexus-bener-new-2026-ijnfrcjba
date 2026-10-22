import { useState, useEffect, useCallback, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Link, useNavigate } from 'react-router-dom'
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
  Link2,
  Loader2,
  UploadCloud,
  Layers,
  Award,
  ChevronRight as BreadcrumbChevron,
  FilterX,
  History,
} from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { ErrorState } from '@/components/StateViews'
import { cn } from '@/lib/utils'

import { fetchCategoriasProdutos } from '@/services/categorias-produtos'
import { fetchProdutos } from '@/services/produtos'
import { fetchMarcas } from '@/services/marcas'
import { fetchModelos } from '@/services/modelos'
import {
  fetchVersoes,
  replaceVersaoTiposProposta,
  fetchTiposPropostaBatch,
} from '@/services/versoes'
import { ImageIcon } from 'lucide-react'

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
import { CategoriaForm } from '@/components/produtos/CategoriaForm'
import { ModeloImagensDialog } from '@/components/produtos/ModeloImagensDialog'
import { ProdutoForm } from '@/components/produtos/ProdutoForm'
import { MarcaForm } from '@/components/produtos/MarcaForm'
import { ModeloForm } from '@/components/produtos/ModeloForm'
import { MachineDeleteDialog } from '@/components/produtos/MachineDeleteDialog'

import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet'
import { MultiSelectRelation } from '@/components/shared/searchable-multi-select'

import { formatCurrencyByMoeda } from '@/lib/format'
import { useCanEditMachines, MACHINE_EDIT_DENIED_TOOLTIP } from '@/hooks/use-machine-permissions'
import { useAuth } from '@/hooks/use-auth'
import { isAdminRole } from '@/components/RoleGuard'
import { QUARANTINE_STATUS, type MachineTable } from '@/services/machine-quarantine'

const PAGE_SIZE = 15

type FlowId = 'flowA' | 'flowB'

type NivelFlowA = 'categoria' | 'produto' | 'modelo' | 'versao'
type NivelFlowB = 'marca' | 'modelo' | 'versao'
type Nivel = 'categoria' | 'produto' | 'marca' | 'modelo' | 'versao'

interface FlowStepConfig {
  value: Nivel
  label: string
  table: MachineTable
  createLabel: string
}

// Flow A: Categoria > Produto > Modelo > Versão
const FLOW_A_STEPS: FlowStepConfig[] = [
  {
    value: 'categoria',
    label: 'Categorias',
    table: 'categorias_produtos',
    createLabel: 'Categoria',
  },
  { value: 'produto', label: 'Produto', table: 'produtos', createLabel: 'Produto' },
  { value: 'modelo', label: 'Modelo', table: 'modelos', createLabel: 'Modelo' },
  { value: 'versao', label: 'Versão', table: 'versoes', createLabel: 'Versão' },
]

// Flow B: Marca > Modelo > Versão
const FLOW_B_STEPS: FlowStepConfig[] = [
  { value: 'marca', label: 'Marca', table: 'marcas', createLabel: 'Marca' },
  { value: 'modelo', label: 'Modelo', table: 'modelos', createLabel: 'Modelo' },
  { value: 'versao', label: 'Versão', table: 'versoes', createLabel: 'Versão' },
]

const STEP_BY_VALUE: Record<Nivel, FlowStepConfig> = {
  categoria: FLOW_A_STEPS[0],
  produto: FLOW_A_STEPS[1],
  marca: FLOW_B_STEPS[0],
  modelo: FLOW_A_STEPS[2],
  versao: FLOW_A_STEPS[3],
}

/** Linha normalizada para a tabela, independente do nível selecionado. */
interface LevelRow {
  id: string
  nome: string
  table: MachineTable
  raw: CategoriaProduto | Produto | Marca | Modelo | VersaoWithModelo
  // ids em forma de array p/ filtragem uniforme pela cascata
  categoriaIds: string[]
  produtoIds: string[]
  marcaIds: string[]
  modeloIds: string[]
  // strings de exibição
  categoriaNome: string
  produtoNome: string
  marcaNome: string
  modeloNome: string
  reg?: number | null
  cod?: string | null
  fabricante?: string | null
  site?: string | null
  pais?: string | null
  status?: string | null
  cod_erp?: string | null
  valor?: number
  moeda?: string
  imagem_preview?: string | null
  created_at?: string | null
}
export default function GestaoMaquinasPage() {
  // ---- data state ----
  const [categorias, setCategorias] = useState<CategoriaProduto[]>([])
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [marcas, setMarcas] = useState<Marca[]>([])
  const [modelos, setModelos] = useState<Modelo[]>([])
  const [versoes, setVersoes] = useState<VersaoWithModelo[]>([])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  // ---- fluxo e nível selecionado ----
  const [flow, setFlow] = useState<FlowId>('flowA')
  const [nivel, setNivel] = useState<Nivel>('versao')

  // ---- cascaded filters for breadcrumbs navigation ----
  const [selectedCategoriaId, setSelectedCategoriaId] = useState<string>('all')
  const [selectedProdutoId, setSelectedProdutoId] = useState<string>('all')
  const [selectedMarcaId, setSelectedMarcaId] = useState<string>('all')
  const [selectedModeloId, setSelectedModeloId] = useState<string>('all')

  // ---- search ----
  const [search, setSearch] = useState('')

  // ---- pagination ----
  const [page, setPage] = useState(1)

  // ---- page-scoped tipos de proposta map (nível versao) ----
  const [pageTiposMap, setPageTiposMap] = useState<Record<string, string[]>>({})
  const [loadingPageTipos, setLoadingPageTipos] = useState(false)
  const [brokenImageIds, setBrokenImageIds] = useState<Set<string>>(new Set())

  // ---- add / edit / delete modals ----
  const [versaoFormOpen, setVersaoFormOpen] = useState(false)
  const [editingVersao, setEditingVersao] = useState<VersaoWithModelo | null>(null)
  const [viewingVersao, setViewingVersao] = useState<VersaoDetalhesData | null>(null)
  const [initialModeloId, setInitialModeloId] = useState<string | undefined>(undefined)
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string
    name: string
    table: MachineTable
  } | null>(null)

  const [imagesModelo, setImagesModelo] = useState<{ id: string; nome: string } | null>(null)

  // ---- batch selection (versão level) ----
  const [selectedVersaoIds, setSelectedVersaoIds] = useState<Set<string>>(new Set())
  const [batchSheetOpen, setBatchSheetOpen] = useState(false)
  const [batchTipoIds, setBatchTipoIds] = useState<string[]>([])
  const [savingBatch, setSavingBatch] = useState(false)

  // ---- create / edit modals for the upper hierarchy levels ----
  const [categoriaFormOpen, setCategoriaFormOpen] = useState(false)
  const [editingCategoria, setEditingCategoria] = useState<CategoriaProduto | null>(null)
  const [produtoFormOpen, setProdutoFormOpen] = useState(false)
  const [editingProduto, setEditingProduto] = useState<Produto | null>(null)
  const [marcaFormOpen, setMarcaFormOpen] = useState(false)
  const [editingMarca, setEditingMarca] = useState<Marca | null>(null)
  const [modeloFormOpen, setModeloFormOpen] = useState(false)
  const [editingModelo, setEditingModelo] = useState<Modelo | null>(null)
  const [initialCategoriaId, setInitialCategoriaId] = useState<string | undefined>(undefined)
  const [initialProdutoId, setInitialProdutoId] = useState<string | undefined>(undefined)
  const [initialMarcaId, setInitialMarcaId] = useState<string | undefined>(undefined)

  const { user } = useAuth()
  const isAdmin = isAdminRole(user?.role)
  const canEditMachines = useCanEditMachines()

  const loadAllData = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const [cats, prods, mrcs, mods, vers] = await Promise.all([
        fetchCategoriasProdutos(),
        fetchProdutos(),
        fetchMarcas(),
        fetchModelos(),
        fetchVersoes({ activeOnly: true }),
      ])
      setCategorias(cats || [])
      setProdutos(prods || [])
      setMarcas(mrcs || [])
      setModelos(mods || [])
      setVersoes(vers || [])
    } catch (err) {
      console.error('Error loading machine catalog:', err)
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadAllData()
  }, [loadAllData])

  // ---- lookup maps ----
  const catMap = useMemo(() => new Map(categorias.map((c) => [c.id, c])), [categorias])
  const prodMap = useMemo(() => new Map(produtos.map((p) => [p.id, p])), [produtos])
  const marcaMap = useMemo(() => new Map(marcas.map((m) => [m.id, m])), [marcas])
  const modeloMap = useMemo(() => new Map(modelos.map((m) => [m.id, m])), [modelos])

  const isNotQuarantined = (status?: string) => status !== QUARANTINE_STATUS
  const isVersaoAtiva = (status?: string) => isNotQuarantined(status) && status === 'Ativo'

  const activeVersoes = useMemo(() => versoes.filter((v) => isVersaoAtiva(v.status)), [versoes])

  // ---- enriched versões ----
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

  const versoesEnriched = useMemo<VersaoEnriched[]>(() => {
    return activeVersoes.map((v) => {
      const mod = v.modelo ? modeloMap.get(v.modelo) : undefined
      const prod = mod?.produto ? prodMap.get(mod.produto) : undefined
      const mrc = mod?.marca ? marcaMap.get(mod.marca) : undefined
      // Prioriza a categoria gravada na versão (v.categoria_id) com fallback para prod.categoria
      const effectiveCatId = v.categoria_id || prod?.categoria || null
      const cat = effectiveCatId ? catMap.get(effectiveCatId) : undefined
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
  }, [activeVersoes, modeloMap, prodMap, marcaMap, catMap])

  // ---- enriched níveis superiores ----
  const activeCategorias = useMemo(
    () => categorias.filter((c) => isNotQuarantined(c.status)),
    [categorias],
  )

  const activeProdutosEnriched = useMemo(
    () =>
      produtos
        .filter((p) => isNotQuarantined(p.status))
        .map((p) => {
          const directCat = p.categoria ? catMap.get(p.categoria) : undefined
          const catNome = directCat?.nome || p.categoria_nome || '—'
          return {
            ...p,
            _categoriaId: p.categoria ?? null,
            _categoriaNome: catNome,
            _reg: p.reg ?? null,
            _cod: p.cod ?? null,
            _fabricante: p.fabricante ?? null,
            _modelo: p.modelo ?? null,
          }
        }),
    [produtos, catMap],
  )

  const activeMarcasEnriched = useMemo(() => {
    return marcas
      .filter((m) => isNotQuarantined(m.status))
      .map((m) => {
        const mods = modelos.filter((mo) => mo.marca === m.id && isNotQuarantined(mo.status))
        const prodIds = Array.from(
          new Set(mods.map((mo) => mo.produto).filter((x): x is string => !!x)),
        )
        const catIds = Array.from(
          new Set(
            prodIds.map((pid) => prodMap.get(pid)?.categoria).filter((x): x is string => !!x),
          ),
        )
        // Nome dos produtos e categorias derivados dos modelos pertencentes a esta marca
        const derivedProdutoNomes = prodIds.map((pid) => prodMap.get(pid)?.nome ?? '—')
        const derivedCategoriaNomes = catIds.map((cid) => catMap.get(cid)?.nome ?? '—')
        const produtoNome = derivedProdutoNomes.length ? derivedProdutoNomes.join(', ') : '—'
        return {
          ...m,
          _produtoIds: Array.from(new Set(prodIds)),
          _categoriaIds: catIds,
          _produtoNomes: derivedProdutoNomes,
          _categoriaNomes: derivedCategoriaNomes,
          _produtoNome: produtoNome,
        }
      })
  }, [marcas, modelos, prodMap, catMap])

  const activeModelosEnriched = useMemo(() => {
    return modelos
      .filter((mo) => isNotQuarantined(mo.status))
      .map((mo) => {
        const prod = mo.produto ? prodMap.get(mo.produto) : undefined
        const mrc = mo.marca ? marcaMap.get(mo.marca) : undefined
        const cat = prod?.categoria ? catMap.get(prod.categoria) : undefined
        return {
          ...mo,
          _produtoId: mo.produto ?? null,
          _marcaId: mo.marca ?? null,
          _categoriaId: prod?.categoria ?? null,
          _produtoNome: prod?.nome ?? '—',
          _marcaNome: mrc?.nome ?? '—',
          _categoriaNome: cat?.nome ?? '—',
        }
      })
  }, [modelos, prodMap, marcaMap, catMap])

  // ---- contextual options for breadcrumb dropdowns ----
  // Flow A: Categoria > Produto > Modelo > Versão
  const flowAProdutosOptions = useMemo(() => {
    return activeProdutosEnriched.filter((p) => {
      if (selectedCategoriaId !== 'all') {
        return p._categoriaId === selectedCategoriaId
      }
      return true
    })
  }, [activeProdutosEnriched, selectedCategoriaId])

  const flowAModelosOptions = useMemo(() => {
    return activeModelosEnriched.filter((m) => {
      if (selectedProdutoId !== 'all') {
        return m._produtoId === selectedProdutoId
      }
      if (selectedCategoriaId !== 'all') {
        return m._categoriaId === selectedCategoriaId
      }
      return true
    })
  }, [activeModelosEnriched, selectedProdutoId, selectedCategoriaId])

  // Flow B: Marca > Modelo > Versão (bypasses Produto)
  const flowBModelosOptions = useMemo(() => {
    return activeModelosEnriched.filter((m) => {
      if (selectedMarcaId !== 'all') {
        return m._marcaId === selectedMarcaId
      }
      return true
    })
  }, [activeModelosEnriched, selectedMarcaId])

  // ---- linhas normalizadas para o nível atual ----
  const rows = useMemo<LevelRow[]>(() => {
    const empty: string[] = []
    switch (nivel) {
      case 'categoria':
        return activeCategorias.map((c) => ({
          id: c.id,
          nome: c.nome,
          table: 'categorias_produtos',
          raw: c,
          categoriaIds: [c.id],
          produtoIds: empty,
          marcaIds: empty,
          modeloIds: empty,
          categoriaNome: c.nome,
          produtoNome: '—',
          marcaNome: '—',
          modeloNome: '—',
          created_at: c.created_at,
        }))
      case 'produto':
        return activeProdutosEnriched.map((p) => ({
          id: p.id,
          nome: p.nome,
          table: 'produtos',
          raw: p,
          categoriaIds: p._categoriaId ? [p._categoriaId] : empty,
          produtoIds: [p.id],
          marcaIds: empty,
          modeloIds: empty,
          categoriaNome: p._categoriaNome,
          produtoNome: p.nome,
          marcaNome: '—',
          modeloNome: p._modelo || '—',
          reg: p._reg,
          cod: p._cod,
          fabricante: p._fabricante,
          created_at: p.created_at,
        }))
      case 'marca':
        return activeMarcasEnriched.map((m) => ({
          id: m.id,
          nome: m.nome,
          table: 'marcas',
          raw: m,
          categoriaIds: m._categoriaIds,
          produtoIds: m._produtoIds,
          marcaIds: [m.id],
          modeloIds: empty,
          categoriaNome: m._categoriaNomes.length ? m._categoriaNomes.join(', ') : '—',
          produtoNome:
            m._produtoNome ?? (m._produtoNomes.length ? m._produtoNomes.join(', ') : '—'),
          marcaNome: m.nome,
          modeloNome: '—',
          reg: m.reg ?? null,
          cod: m.cod !== null && m.cod !== undefined ? String(m.cod) : null,
          site: m.site ?? null,
          pais: m.pais ?? null,
          status: m.status ?? 'Ativo',
          created_at: m.created_at,
        }))
      case 'modelo':
        return activeModelosEnriched.map((mo) => ({
          id: mo.id,
          nome: mo.nome,
          table: 'modelos',
          raw: mo,
          categoriaIds: mo._categoriaId ? [mo._categoriaId] : empty,
          produtoIds: mo._produtoId ? [mo._produtoId] : empty,
          marcaIds: mo._marcaId ? [mo._marcaId] : empty,
          modeloIds: [mo.id],
          categoriaNome: mo._categoriaNome,
          produtoNome: mo._produtoNome,
          marcaNome: mo._marcaNome,
          modeloNome: mo.nome,
          created_at: mo.created_at,
        }))
      case 'versao':
        return versoesEnriched.map((v) => ({
          id: v.id,
          nome: v.nome,
          table: 'versoes',
          raw: v,
          categoriaIds: v._categoriaId ? [v._categoriaId] : empty,
          produtoIds: v._produtoId ? [v._produtoId] : empty,
          marcaIds: v._marcaId ? [v._marcaId] : empty,
          modeloIds: v._modeloId ? [v._modeloId] : empty,
          categoriaNome: v._categoriaNome,
          produtoNome: v._produtoNome,
          marcaNome: v._marcaNome,
          modeloNome: v._modeloNome,
          cod_erp: v.cod_erp,
          valor: v.valor,
          moeda: v.moeda,
          imagem_preview: v.imagem_preview,
          created_at: v.created_at,
        }))
    }
  }, [
    nivel,
    activeCategorias,
    activeProdutosEnriched,
    activeMarcasEnriched,
    activeModelosEnriched,
    versoesEnriched,
  ])

  // ---- filtered by search AND flow-specific breadcrumb cascaded filters ----
  const filteredRows = useMemo(() => {
    const qs = search.trim().toLowerCase()
    return rows
      .filter((r) => {
        // Search text filter
        if (qs) {
          if (r.nome.toLowerCase().includes(qs)) return true
          if (nivel === 'versao' && r.cod_erp && r.cod_erp.toLowerCase().includes(qs)) return true
          return false
        }
        return true
      })
      .filter((r) => {
        // Flow-specific hierarchy filtering
        if (flow === 'flowA') {
          // Flow A: Categoria > Produto > Modelo > Versão
          if (selectedCategoriaId !== 'all') {
            if (nivel === 'categoria' && r.id !== selectedCategoriaId) return false
            if (nivel !== 'categoria' && !r.categoriaIds.includes(selectedCategoriaId)) return false
          }
          if (selectedProdutoId !== 'all') {
            if (nivel === 'produto' && r.id !== selectedProdutoId) return false
            if (
              nivel !== 'categoria' &&
              nivel !== 'produto' &&
              !r.produtoIds.includes(selectedProdutoId)
            )
              return false
          }
          if (selectedModeloId !== 'all') {
            if (nivel === 'modelo' && r.id !== selectedModeloId) return false
            if (nivel === 'versao' && !r.modeloIds.includes(selectedModeloId)) return false
          }
        } else {
          // Flow B: Marca > Modelo > Versão (bypasses Produto completely)
          if (selectedMarcaId !== 'all') {
            if (nivel === 'marca' && r.id !== selectedMarcaId) return false
            if (nivel !== 'marca' && !r.marcaIds.includes(selectedMarcaId)) return false
          }
          if (selectedModeloId !== 'all') {
            if (nivel === 'modelo' && r.id !== selectedModeloId) return false
            if (nivel === 'versao' && !r.modeloIds.includes(selectedModeloId)) return false
          }
        }
        return true
      })
      .sort((a, b) => {
        const ta = a.created_at ? new Date(a.created_at).getTime() : 0
        const tb = b.created_at ? new Date(b.created_at).getTime() : 0
        return tb - ta
      })
  }, [
    rows,
    nivel,
    search,
    flow,
    selectedCategoriaId,
    selectedProdutoId,
    selectedMarcaId,
    selectedModeloId,
  ])

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pagedRows = useMemo(
    () => filteredRows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [filteredRows, safePage],
  )

  // Fetch proposal types only for current page's versões (no N+1, 1 query per page)
  // Stable key based on comma-separated IDs to prevent unnecessary refetches when reference changes
  const pagedVersaoIdsKey = useMemo(() => {
    if (nivel !== 'versao') return ''
    return pagedRows.map((r) => r.id).join(',')
  }, [nivel, pagedRows])

  useEffect(() => {
    if (nivel !== 'versao' || !pagedVersaoIdsKey) {
      setPageTiposMap({})
      setLoadingPageTipos(false)
      return
    }

    const ids = pagedVersaoIdsKey.split(',').filter(Boolean)
    if (ids.length === 0) {
      setPageTiposMap({})
      setLoadingPageTipos(false)
      return
    }

    let isMounted = true
    setLoadingPageTipos(true)

    fetchTiposPropostaBatch(ids)
      .then((map) => {
        if (isMounted) {
          setPageTiposMap(map)
        }
      })
      .catch((err) => {
        console.error('Error fetching page tipos de proposta:', err)
        if (isMounted) setPageTiposMap({})
      })
      .finally(() => {
        if (isMounted) setLoadingPageTipos(false)
      })

    return () => {
      isMounted = false
    }
  }, [nivel, pagedVersaoIdsKey])

  // reset page when search/nível/flow/filters change
  useEffect(() => {
    setPage(1)
  }, [
    search,
    nivel,
    flow,
    selectedCategoriaId,
    selectedProdutoId,
    selectedMarcaId,
    selectedModeloId,
  ])

  // clear batch selection when switching tabs or flows
  useEffect(() => {
    setSelectedVersaoIds(new Set())
  }, [nivel, flow])

  // ---- batch selection (versão level) ----
  const toggleVersaoSelected = (id: string) => {
    setSelectedVersaoIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const allFilteredSelected =
    filteredRows.length > 0 && filteredRows.every((r) => selectedVersaoIds.has(r.id))
  const someFilteredSelected =
    !allFilteredSelected && filteredRows.some((r) => selectedVersaoIds.has(r.id))

  const toggleSelectAll = () => {
    setSelectedVersaoIds((prev) => {
      if (filteredRows.length > 0 && filteredRows.every((r) => prev.has(r.id))) {
        const next = new Set(prev)
        filteredRows.forEach((r) => next.delete(r.id))
        return next
      }
      const next = new Set(prev)
      filteredRows.forEach((r) => next.add(r.id))
      return next
    })
  }

  const handleBatchVincular = async () => {
    if (batchTipoIds.length === 0 || selectedVersaoIds.size === 0) return
    setSavingBatch(true)
    try {
      const ids = Array.from(selectedVersaoIds)
      await Promise.all(ids.map((vid) => replaceVersaoTiposProposta(vid, batchTipoIds)))
      toast({
        title: 'Tipos vinculados em lote',
        description: `${batchTipoIds.length} tipo(s) vinculado(s) a ${ids.length} versão(ões).`,
      })
      setBatchSheetOpen(false)
      setBatchTipoIds([])
      setSelectedVersaoIds(new Set())
      await loadAllData()
    } catch (err) {
      toast({
        title: 'Erro ao vincular em lote',
        description: err instanceof Error ? err.message : 'Erro desconhecido',
        variant: 'destructive',
      })
    } finally {
      setSavingBatch(false)
    }
  }

  // ---- handlers ----
  const handleNovaVersao = () => {
    setEditingVersao(null)
    setInitialModeloId(selectedModeloId !== 'all' ? selectedModeloId : undefined)
    setVersaoFormOpen(true)
  }

  const handleNovaCategoria = () => {
    setEditingCategoria(null)
    setCategoriaFormOpen(true)
  }

  const handleNovoProduto = () => {
    setEditingProduto(null)
    setInitialCategoriaId(selectedCategoriaId !== 'all' ? selectedCategoriaId : undefined)
    setProdutoFormOpen(true)
  }

  const handleNovaMarca = () => {
    setEditingMarca(null)
    setMarcaFormOpen(true)
  }

  const handleNovoModelo = () => {
    setEditingModelo(null)
    if (flow === 'flowA') {
      setInitialProdutoId(selectedProdutoId !== 'all' ? selectedProdutoId : undefined)
      setInitialMarcaId(undefined)
    } else {
      setInitialProdutoId(undefined)
      setInitialMarcaId(selectedMarcaId !== 'all' ? selectedMarcaId : undefined)
    }
    setModeloFormOpen(true)
  }

  const handleEditRow = (row: LevelRow) => {
    switch (row.table) {
      case 'categorias_produtos':
        setEditingCategoria(row.raw as CategoriaProduto)
        setCategoriaFormOpen(true)
        break
      case 'produtos':
        setEditingProduto(row.raw as Produto)
        setInitialCategoriaId((row.raw as Produto).categoria ?? undefined)
        setProdutoFormOpen(true)
        break
      case 'marcas':
        setEditingMarca(row.raw as Marca)
        setMarcaFormOpen(true)
        break
      case 'modelos': {
        const mo = row.raw as Modelo
        setEditingModelo(mo)
        setInitialProdutoId(
          mo.produto ??
            (flow === 'flowA' && selectedProdutoId !== 'all' ? selectedProdutoId : undefined),
        )
        setInitialMarcaId(
          mo.marca ?? (flow === 'flowB' && selectedMarcaId !== 'all' ? selectedMarcaId : undefined),
        )
        setModeloFormOpen(true)
        break
      }
      case 'versoes': {
        const v = row.raw as VersaoWithModelo
        setEditingVersao(v)
        setInitialModeloId(v.modelo ?? (selectedModeloId !== 'all' ? selectedModeloId : undefined))
        setVersaoFormOpen(true)
        break
      }
    }
  }

  const handleDeleteDone = (action: 'quarantine' | 'delete') => {
    if (action === 'quarantine') {
      toast({
        title: 'Item movido para quarentena',
        description: 'Um Admin revisará em até 7 dias.',
      })
    } else {
      toast({ title: 'Item excluído permanentemente' })
    }
    setDeleteTarget(null)
    loadAllData()
  }

  const renderRowActions = (row: LevelRow) => {
    return (
      <div className="flex items-center justify-end gap-1.5">
        {/* Botão de Imagens Técnicas quando o nível for modelo */}
        {row.table === 'modelos' && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 hover:bg-muted text-primary"
            onClick={() => setImagesModelo({ id: row.id, nome: row.nome })}
            title="Biblioteca de Imagens Técnicas (plaqueta, tabelas, diagramas)"
          >
            <ImageIcon className="w-4 h-4" />
          </Button>
        )}

        {/* Botão de Visualização quando o nível for versão: disponível para todos os perfis */}
        {row.table === 'versoes' && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 hover:bg-muted text-foreground"
            onClick={() => {
              const v = row.raw as VersaoWithModelo
              setViewingVersao({
                ...v,
                _modeloNome: row.modeloNome,
                _marcaNome: row.marcaNome,
                _produtoNome: row.produtoNome,
                _categoriaNome: row.categoriaNome,
              })
            }}
            title="Visualizar detalhes da versão"
          >
            <Eye className="w-4 h-4" />
          </Button>
        )}

        {canEditMachines ? (
          <>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 hover:bg-muted text-foreground"
              onClick={() => handleEditRow(row)}
              title="Editar"
            >
              <Edit2 className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => setDeleteTarget({ id: row.id, name: row.nome, table: row.table })}
              title="Excluir"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 opacity-40 cursor-not-allowed"
                disabled
              >
                <Lock className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{MACHINE_EDIT_DENIED_TOOLTIP}</TooltipContent>
          </Tooltip>
        )}
      </div>
    )
  }

  const currentSteps = flow === 'flowA' ? FLOW_A_STEPS : FLOW_B_STEPS

  const colSpan = useMemo(() => {
    if (nivel === 'categoria') return 2
    if (nivel === 'produto') return 3
    if (nivel === 'marca') return 2
    if (nivel === 'modelo') return flow === 'flowA' ? 4 : 3
    // Versão flowA: [checkbox, imagem, versao, tipos_proposta, cod_erp, moeda, modelo, produto, categoria, preco, acoes] = 11 colunas
    // Versão flowB: [checkbox, imagem, versao, tipos_proposta, cod_erp, moeda, modelo, marca, preco, acoes] = 10 colunas
    return flow === 'flowA' ? 11 : 10
  }, [nivel, flow])

  const searchPlaceholder =
    nivel === 'versao' ? 'Nome da versão ou código ERP...' : 'Buscar por nome...'

  const hasActiveFilters =
    flow === 'flowA'
      ? selectedCategoriaId !== 'all' || selectedProdutoId !== 'all' || selectedModeloId !== 'all'
      : selectedMarcaId !== 'all' || selectedModeloId !== 'all'

  const clearFlowFilters = () => {
    setSelectedCategoriaId('all')
    setSelectedProdutoId('all')
    setSelectedMarcaId('all')
    setSelectedModeloId('all')
  }

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Cpu className="w-7 h-7 text-primary" />
            Gestão de Máquinas
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Cadastro e manutenção da hierarquia do catálogo (categorias, produtos, marcas, modelos e
            versões).
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <Button
              variant="outline"
              size="sm"
              asChild
              className="gap-1.5 border-primary/30 text-primary hover:bg-primary/5 font-semibold"
            >
              <Link to="/produtos/historico-alteracoes">
                <History className="w-4 h-4" />
                Histórico de Modificações
              </Link>
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={loadAllData}
            disabled={loading}
            className="gap-1.5"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Fluxo Selector: Flow A vs Flow B */}
      <div className="rounded-xl border bg-card p-4 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Estrutura de Gestão
            </div>
            <div className="text-sm text-foreground font-medium mt-0.5">
              Selecione o fluxo de navegação do catálogo
            </div>
          </div>
          <div className="inline-flex items-center p-1 rounded-lg bg-muted border">
            <button
              type="button"
              onClick={() => {
                setFlow('flowA')
                if (nivel === 'marca') setNivel('versao')
              }}
              className={cn(
                'flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all',
                flow === 'flowA'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Layers className="w-3.5 h-3.5 text-primary" />
              <span>Categorias &gt; Produto &gt; Modelo &gt; Versão</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setFlow('flowB')
                if (nivel === 'categoria' || nivel === 'produto') setNivel('versao')
              }}
              className={cn(
                'flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all',
                flow === 'flowB'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Award className="w-3.5 h-3.5 text-primary" />
              <span>Marca &gt; Modelo &gt; Versão</span>
            </button>
          </div>
        </div>

        {/* Visual Breadcrumb Steps according to the selected Flow */}
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <span>Etapas do Fluxo:</span>
              <span className="font-semibold text-foreground">
                {flow === 'flowA' ? 'Fluxo por Categoria' : 'Fluxo por Marca'}
              </span>
            </div>
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFlowFilters}
                className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground"
              >
                <FilterX className="w-3.5 h-3.5" />
                Limpar filtros de cascata
              </Button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {currentSteps.map((step, idx) => {
              const isCurrent = nivel === step.value
              const isPassed = currentSteps.findIndex((s) => s.value === nivel) > idx

              return (
                <div key={step.value} className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setNivel(step.value)}
                    className={cn(
                      'group relative flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all border',
                      isCurrent
                        ? 'bg-[#0b3c26] text-white border-[#0b3c26] shadow-sm'
                        : isPassed
                          ? 'bg-muted/80 text-foreground border-border hover:bg-muted'
                          : 'bg-background text-muted-foreground border-border/70 hover:bg-muted/50 hover:text-foreground',
                    )}
                  >
                    <span
                      className={cn(
                        'w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 transition-colors',
                        isCurrent
                          ? 'bg-white/20 text-white'
                          : isPassed
                            ? 'bg-primary/20 text-primary'
                            : 'bg-muted text-muted-foreground',
                      )}
                    >
                      {idx + 1}
                    </span>
                    <span>{step.label}</span>
                  </button>

                  {idx < currentSteps.length - 1 && (
                    <BreadcrumbChevron className="w-4 h-4 text-muted-foreground/50 shrink-0" />
                  )}
                </div>
              )
            })}
          </div>

          {/* Contextual breadcrumb cascade filters */}
          <div className="pt-2 flex flex-wrap items-center gap-2.5 text-xs">
            <span className="font-medium text-muted-foreground">Filtrar por cascata:</span>

            {flow === 'flowA' ? (
              <>
                {/* Categoria select */}
                <div className="min-w-[170px]">
                  <select
                    value={selectedCategoriaId}
                    onChange={(e) => {
                      const newCat = e.target.value
                      setSelectedCategoriaId(newCat)
                      setSelectedProdutoId('all')
                      setSelectedModeloId('all')
                    }}
                    className="h-8 w-full rounded-md border border-input bg-background px-2.5 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="all">Todas as Categorias</option>
                    {activeCategorias.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nome}
                      </option>
                    ))}
                  </select>
                </div>

                <BreadcrumbChevron className="w-3.5 h-3.5 text-muted-foreground/40" />

                {/* Produto select */}
                <div className="min-w-[170px]">
                  <select
                    value={selectedProdutoId}
                    onChange={(e) => {
                      const newProd = e.target.value
                      setSelectedProdutoId(newProd)
                      setSelectedModeloId('all')
                    }}
                    className="h-8 w-full rounded-md border border-input bg-background px-2.5 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="all">Todos os Produtos</option>
                    {flowAProdutosOptions.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nome}
                      </option>
                    ))}
                  </select>
                </div>

                <BreadcrumbChevron className="w-3.5 h-3.5 text-muted-foreground/40" />

                {/* Modelo select */}
                <div className="min-w-[170px]">
                  <select
                    value={selectedModeloId}
                    onChange={(e) => setSelectedModeloId(e.target.value)}
                    className="h-8 w-full rounded-md border border-input bg-background px-2.5 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="all">Todos os Modelos</option>
                    {flowAModelosOptions.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.nome}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            ) : (
              <>
                {/* Marca select */}
                <div className="min-w-[190px]">
                  <select
                    value={selectedMarcaId}
                    onChange={(e) => {
                      const newMarca = e.target.value
                      setSelectedMarcaId(newMarca)
                      setSelectedModeloId('all')
                    }}
                    className="h-8 w-full rounded-md border border-input bg-background px-2.5 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="all">Todas as Marcas</option>
                    {activeMarcasEnriched.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.nome}
                      </option>
                    ))}
                  </select>
                </div>

                <BreadcrumbChevron className="w-3.5 h-3.5 text-muted-foreground/40" />

                {/* Modelo select */}
                <div className="min-w-[190px]">
                  <select
                    value={selectedModeloId}
                    onChange={(e) => setSelectedModeloId(e.target.value)}
                    className="h-8 w-full rounded-md border border-input bg-background px-2.5 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="all">Todos os Modelos</option>
                    {flowBModelosOptions.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.nome}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Action bar — create new items contextual to current flow */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card shadow-sm px-3 py-2.5">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mr-1">
          Cadastrar:
        </span>
        {currentSteps.map((step) => (
          <CreateButton
            key={step.value}
            label={step.createLabel}
            onClick={() => {
              if (step.value === 'categoria') handleNovaCategoria()
              else if (step.value === 'produto') handleNovoProduto()
              else if (step.value === 'marca') handleNovaMarca()
              else if (step.value === 'modelo') handleNovoModelo()
              else handleNovaVersao()
            }}
            canEdit={canEditMachines}
            highlight={nivel === step.value}
          />
        ))}
        {selectedVersaoIds.size > 0 && nivel === 'versao' && (
          <>
            <div className="h-6 w-px bg-border mx-1" />
            <Button
              size="sm"
              className="gap-1.5 text-white"
              style={{ backgroundColor: '#0b3c26' }}
              onClick={() => {
                setBatchTipoIds([])
                setBatchSheetOpen(true)
              }}
            >
              <Link2 className="w-4 h-4" />
              Vincular em Lote ({selectedVersaoIds.size})
            </Button>
          </>
        )}
      </div>

      {/* Search Bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={searchPlaceholder}
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

      {/* Table */}
      <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left">
                {nivel === 'categoria' && (
                  <>
                    <Th className="text-foreground">Nome da Categoria</Th>
                    <Th align="right">Ações</Th>
                  </>
                )}
                {nivel === 'produto' && (
                  <>
                    <Th className="text-foreground">Nome do Produto</Th>
                    <Th>Reg</Th>
                    <Th>Cód</Th>
                    <Th>Fabricante</Th>
                    <Th>Categoria</Th>
                    <Th align="right">Ações</Th>
                  </>
                )}
                {nivel === 'marca' && (
                  <>
                    <Th className="text-foreground">Nome da Marca</Th>
                    <Th>Reg</Th>
                    <Th>Cód</Th>
                    <Th>Site</Th>
                    <Th>País</Th>
                    <Th>Status</Th>
                    <Th align="right">Ações</Th>
                  </>
                )}
                {nivel === 'modelo' && (
                  <>
                    <Th className="text-foreground">Nome do Modelo</Th>
                    {flow === 'flowA' ? (
                      <>
                        <Th>Produto</Th>
                        <Th>Categoria</Th>
                      </>
                    ) : (
                      <>
                        <Th>Marca</Th>
                      </>
                    )}
                    <Th align="right">Ações</Th>
                  </>
                )}
                {nivel === 'versao' && (
                  <>
                    <Th className="w-10">
                      <Checkbox
                        checked={
                          allFilteredSelected
                            ? true
                            : someFilteredSelected
                              ? 'indeterminate'
                              : false
                        }
                        onCheckedChange={toggleSelectAll}
                        aria-label="Selecionar todos"
                      />
                    </Th>
                    <Th className="w-14 text-center">Imagem</Th>
                    <Th className="text-foreground">Versão</Th>
                    <Th>Tipos de Proposta</Th>
                    <Th>Código ERP</Th>
                    <Th>Moeda</Th>
                    <Th>Modelo</Th>
                    {flow === 'flowA' ? (
                      <>
                        <Th>Produto</Th>
                        <Th>Categoria</Th>
                      </>
                    ) : (
                      <>
                        <Th>Marca</Th>
                      </>
                    )}
                    <Th align="right">Preço</Th>
                    <Th align="right">Ações</Th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-b last:border-0">
                    {Array.from({ length: colSpan }).map((__, j) => (
                      <td key={j} className="px-4 py-3">
                        <Skeleton className="h-5 w-full max-w-[120px]" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : error ? (
                <tr>
                  <td colSpan={colSpan} className="px-4 py-8">
                    <ErrorState message="Erro ao carregar o catálogo" onRetry={loadAllData} />
                  </td>
                </tr>
              ) : pagedRows.length === 0 ? (
                <tr>
                  <td colSpan={colSpan} className="px-4 py-12">
                    <div className="flex flex-col items-center justify-center gap-3 text-center">
                      <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
                        <PackageX className="w-7 h-7 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          Nenhum registro encontrado
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Ajuste a busca ou os filtros em cascata para encontrar{' '}
                          {STEP_BY_VALUE[nivel].label.toLowerCase()}.
                        </p>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                pagedRows.map((r) => (
                  <tr
                    key={`${r.table}-${r.id}`}
                    className={cn(
                      'border-b last:border-0 hover:bg-muted/30 transition-colors',
                      nivel === 'versao' && selectedVersaoIds.has(r.id) && 'bg-primary/5',
                    )}
                  >
                    {nivel === 'categoria' && (
                      <>
                        <td className="px-4 py-2.5 font-semibold text-foreground">{r.nome}</td>
                        <td className="px-4 py-2.5 text-right">{renderRowActions(r)}</td>
                      </>
                    )}
                    {nivel === 'produto' && (
                      <>
                        <td className="px-4 py-2.5 font-semibold text-foreground">
                          <div>{r.nome}</div>
                          {r.modeloNome !== '—' && (
                            <div className="text-[11px] text-muted-foreground font-normal">
                              Modelo: {r.modeloNome}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-2.5 font-mono text-xs font-semibold text-[#0b3c26]">
                          {r.reg !== null && r.reg !== undefined ? r.reg : '—'}
                        </td>
                        <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                          {r.cod || '—'}
                        </td>
                        <td className="px-4 py-2.5 text-slate-700">{r.fabricante || '—'}</td>
                        <td className="px-4 py-2.5">
                          {r.categoriaNome !== '—' ? (
                            <Badge variant="outline" className="text-xs bg-slate-50">
                              {r.categoriaNome}
                            </Badge>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right">{renderRowActions(r)}</td>
                      </>
                    )}
                    {nivel === 'marca' && (
                      <>
                        <td className="px-4 py-2.5 font-semibold text-foreground">{r.nome}</td>
                        <td className="px-4 py-2.5 font-mono text-xs font-semibold text-[#0b3c26]">
                          {r.reg !== null && r.reg !== undefined ? r.reg : '—'}
                        </td>
                        <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                          {r.cod || '—'}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-slate-700">
                          {r.site ? (
                            <a
                              href={r.site.startsWith('http') ? r.site : `https://${r.site}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-blue-600 hover:underline truncate max-w-[160px] inline-block"
                            >
                              {r.site}
                            </a>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-slate-700">{r.pais || '—'}</td>
                        <td className="px-4 py-2.5">
                          <Badge
                            variant="secondary"
                            className={
                              r.status === 'Ativo'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-slate-100 text-slate-700'
                            }
                          >
                            {r.status || 'Ativo'}
                          </Badge>
                        </td>
                        <td className="px-4 py-2.5 text-right">{renderRowActions(r)}</td>
                      </>
                    )}
                    {nivel === 'modelo' && (
                      <>
                        <td className="px-4 py-2.5 font-semibold text-foreground">{r.nome}</td>
                        {flow === 'flowA' ? (
                          <>
                            <td className="px-4 py-2.5">{r.produtoNome}</td>
                            <td className="px-4 py-2.5">{r.categoriaNome}</td>
                          </>
                        ) : (
                          <>
                            <td className="px-4 py-2.5">{r.marcaNome}</td>
                          </>
                        )}
                        <td className="px-4 py-2.5 text-right">{renderRowActions(r)}</td>
                      </>
                    )}
                    {nivel === 'versao' && (
                      <>
                        <td className="px-4 py-2.5">
                          <Checkbox
                            checked={selectedVersaoIds.has(r.id)}
                            onCheckedChange={() => toggleVersaoSelected(r.id)}
                            aria-label={`Selecionar ${r.nome}`}
                          />
                        </td>
                        <td className="px-2 py-2 text-center">
                          {r.imagem_preview && !brokenImageIds.has(r.id) ? (
                            <img
                              src={r.imagem_preview}
                              alt={r.nome}
                              onError={() =>
                                setBrokenImageIds((prev) => {
                                  const next = new Set(prev)
                                  next.add(r.id)
                                  return next
                                })
                              }
                              className="w-12 h-12 object-contain rounded-md border bg-white p-0.5 mx-auto shadow-xs"
                            />
                          ) : (
                            <div
                              className="w-12 h-12 rounded-md border border-dashed border-border/80 bg-muted/40 flex flex-col items-center justify-center text-[10px] text-muted-foreground mx-auto gap-0.5 select-none"
                              title="Sem imagem cadastrada ou indisponível"
                            >
                              <ImageIcon className="w-3.5 h-3.5 opacity-60" />
                              <span className="leading-none text-[9px]">Sem imagem</span>
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-2.5 font-semibold text-foreground">{r.nome}</td>
                        <td className="px-4 py-2.5 max-w-[280px]">
                          {loadingPageTipos ? (
                            <div className="flex flex-wrap gap-1">
                              <Skeleton className="h-5 w-20 rounded-md" />
                              <Skeleton className="h-5 w-16 rounded-md" />
                            </div>
                          ) : pageTiposMap[r.id] && pageTiposMap[r.id].length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {pageTiposMap[r.id].map((tipo) => (
                                <Badge
                                  key={tipo}
                                  variant="outline"
                                  className="border-emerald-600/40 text-emerald-800 dark:text-emerald-300 bg-emerald-50/60 dark:bg-emerald-950/30 text-xs font-medium px-2 py-0.5 leading-tight hover:bg-emerald-100/70"
                                >
                                  {tipo}
                                </Badge>
                              ))}
                            </div>
                          ) : (
                            <Badge
                              variant="outline"
                              className="border-muted text-muted-foreground bg-muted/30 text-[11px] font-normal px-2 py-0.5"
                            >
                              Sem tipo vinculado
                            </Badge>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground tabular-nums">
                          {r.cod_erp || '—'}
                        </td>
                        <td className="px-4 py-2.5">
                          <Badge
                            variant="outline"
                            className="font-mono text-[11px] font-semibold tracking-wider text-slate-700 bg-slate-50 border-slate-200"
                          >
                            {r.moeda || 'BRL'}
                          </Badge>
                        </td>
                        <td className="px-4 py-2.5">{r.modeloNome}</td>
                        {flow === 'flowA' ? (
                          <>
                            <td className="px-4 py-2.5">{r.produtoNome}</td>
                            <td className="px-4 py-2.5">{r.categoriaNome}</td>
                          </>
                        ) : (
                          <>
                            <td className="px-4 py-2.5">{r.marcaNome}</td>
                          </>
                        )}
                        <td className="px-4 py-2.5 text-right tabular-nums font-medium text-foreground">
                          {formatCurrencyByMoeda(r.valor, r.moeda)}
                        </td>
                        <td className="px-4 py-2.5 text-right">{renderRowActions(r)}</td>
                      </>
                    )}
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
              {filteredRows.length} registro{filteredRows.length === 1 ? '' : 's'} · página{' '}
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
          await loadAllData()
          setVersaoFormOpen(false)
          setEditingVersao(null)
          setInitialModeloId(undefined)
        }}
      />

      {/* Delete / Quarantine */}
      <MachineDeleteDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        table={deleteTarget?.table ?? 'versoes'}
        itemId={deleteTarget?.id ?? ''}
        itemName={deleteTarget?.name ?? 'este item'}
        onDone={handleDeleteDone}
      />

      {/* Add / Edit Categoria */}
      <CategoriaForm
        key={editingCategoria?.id ?? 'new-categoria'}
        open={categoriaFormOpen}
        editing={editingCategoria}
        onOpenChange={(open) => {
          setCategoriaFormOpen(open)
          if (!open) setEditingCategoria(null)
        }}
        onSaved={async () => {
          await loadAllData()
          setCategoriaFormOpen(false)
          setEditingCategoria(null)
        }}
      />

      {/* Add / Edit Produto */}
      <ProdutoForm
        key={editingProduto?.id ?? 'new-produto'}
        open={produtoFormOpen}
        editing={editingProduto}
        initialCategoriaId={initialCategoriaId}
        onOpenChange={(open) => {
          setProdutoFormOpen(open)
          if (!open) {
            setEditingProduto(null)
            setInitialCategoriaId(undefined)
          }
        }}
        onSaved={async () => {
          await loadAllData()
          setProdutoFormOpen(false)
          setEditingProduto(null)
          setInitialCategoriaId(undefined)
        }}
      />

      {/* Add / Edit Marca */}
      <MarcaForm
        key={editingMarca?.id ?? 'new-marca'}
        open={marcaFormOpen}
        editing={editingMarca}
        onOpenChange={(open) => {
          setMarcaFormOpen(open)
          if (!open) setEditingMarca(null)
        }}
        onSaved={async () => {
          await loadAllData()
          setMarcaFormOpen(false)
          setEditingMarca(null)
        }}
      />

      {/* Add / Edit Modelo */}
      <ModeloForm
        key={editingModelo?.id ?? 'new-modelo'}
        open={modeloFormOpen}
        editing={editingModelo}
        initialProdutoId={initialProdutoId}
        initialMarcaId={initialMarcaId}
        onOpenChange={(open) => {
          setModeloFormOpen(open)
          if (!open) {
            setEditingModelo(null)
            setInitialProdutoId(undefined)
            setInitialMarcaId(undefined)
          }
        }}
        onSaved={async () => {
          await loadAllData()
          setModeloFormOpen(false)
          setEditingModelo(null)
          setInitialProdutoId(undefined)
          setInitialMarcaId(undefined)
        }}
      />

      {/* Vincular em Lote — Tipos de Proposta */}
      <Sheet open={batchSheetOpen} onOpenChange={setBatchSheetOpen}>
        <SheetContent side="right" className="sm:max-w-lg flex flex-col p-0 gap-0">
          <SheetHeader className="px-6 pt-6 pb-4 border-b shrink-0 text-left">
            <SheetTitle className="text-lg font-bold flex items-center gap-2">
              <Link2 className="w-5 h-5 text-[#0b3c26]" />
              Vincular Tipos de Proposta em Lote
            </SheetTitle>
            <SheetDescription>Selecionadas: {selectedVersaoIds.size} versão(ões)</SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            <div className="border rounded-lg bg-card p-4 space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-1.5">
                <Link2 className="w-3.5 h-3.5 text-muted-foreground" /> Tipos de Proposta
              </h3>
              <p className="text-xs text-muted-foreground">
                Os tipos selecionados serão vinculados a todas as versões selecionadas, substituindo
                os vínculos existentes de cada uma.
              </p>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Tipos vinculados</Label>
                <MultiSelectRelation
                  values={batchTipoIds}
                  onChange={setBatchTipoIds}
                  tableName="tipos_proposta"
                  labelColumn="nome"
                  filter={{ status: 'Ativo' }}
                  placeholder="Selecionar tipos de proposta..."
                />
                {batchTipoIds.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {batchTipoIds.length} tipo(s) selecionado(s) para {selectedVersaoIds.size}{' '}
                    versão(ões).
                  </p>
                )}
              </div>
            </div>
          </div>
          <SheetFooter className="border-t px-6 py-4 flex gap-2 justify-end shrink-0">
            <Button
              variant="outline"
              onClick={() => setBatchSheetOpen(false)}
              disabled={savingBatch}
            >
              Cancelar
            </Button>
            <Button
              className="bg-[#0b3c26] hover:bg-[#0b3c26]/90 text-white"
              onClick={handleBatchVincular}
              disabled={savingBatch || batchTipoIds.length === 0}
            >
              {savingBatch && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {savingBatch ? 'Vinculando...' : 'Vincular'}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Biblioteca Técnica de Imagens do Modelo */}
      {imagesModelo && (
        <ModeloImagensDialog
          open={!!imagesModelo}
          onOpenChange={(open) => !open && setImagesModelo(null)}
          modeloId={imagesModelo.id}
          modeloNome={imagesModelo.nome}
          canEdit={canEditMachines}
        />
      )}
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

// ---- create button (enabled / locked) ----
function CreateButton({
  label,
  onClick,
  canEdit,
  highlight,
}: {
  label: string
  onClick: () => void
  canEdit: boolean
  highlight?: boolean
}) {
  if (canEdit) {
    return (
      <Button
        size="sm"
        className={cn(
          'gap-1.5 text-white',
          highlight && 'ring-2 ring-primary ring-offset-2 ring-offset-background font-semibold',
        )}
        style={{ backgroundColor: '#0b3c26' }}
        onClick={onClick}
      >
        <Plus className="w-4 h-4" />
        {label}
      </Button>
    )
  }
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          className={cn(
            'gap-1.5 opacity-60',
            highlight && 'ring-2 ring-primary ring-offset-2 ring-offset-background font-semibold',
          )}
          disabled
        >
          <Lock className="w-4 h-4" />
          {label}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{MACHINE_EDIT_DENIED_TOOLTIP}</TooltipContent>
    </Tooltip>
  )
}
