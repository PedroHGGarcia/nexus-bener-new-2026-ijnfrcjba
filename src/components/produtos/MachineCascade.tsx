import { useState, useEffect, useCallback, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { CheckCircle2, AlertCircle } from 'lucide-react'
import { MachineCombobox, ComboboxOption } from './MachineCombobox'
import { MachineAddButton } from './MachineAddButton'
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

import { CategoriaForm } from './CategoriaForm'
import { ProdutoForm } from './ProdutoForm'
import { MarcaForm } from './MarcaForm'
import { ModeloForm } from './ModeloForm'
import { VersaoForm } from './VersaoForm'
import { useCanEditMachines } from '@/hooks/use-machine-permissions'

export interface MachineCascadeSelection {
  categoriaId: string | null
  produtoId: string | null
  marcaId: string | null
  modeloId: string | null
  versaoId: string | null
}

interface MachineCascadeProps {
  value: MachineCascadeSelection
  onChange: (selection: MachineCascadeSelection) => void
  disabled?: boolean
  showBreadcrumbContext?: boolean
}

export function MachineCascade({
  value,
  onChange,
  disabled = false,
  showBreadcrumbContext = true,
}: MachineCascadeProps) {
  // Raw Data State
  const [categorias, setCategorias] = useState<CategoriaProduto[]>([])
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [marcas, setMarcas] = useState<Marca[]>([])
  const [modelos, setModelos] = useState<Modelo[]>([])
  const [versoes, setVersoes] = useState<VersaoWithModelo[]>([])
  const [loading, setLoading] = useState(true)

  // Dialog Quick Create States
  const [addModal, setAddModal] = useState<
    'categoria' | 'produto' | 'marca' | 'modelo' | 'versao' | null
  >(null)

  // Permission: only Comercial/Admin may create/edit machines. Dropdowns keep
  // working for everyone — only the quick-create "+" buttons are gated.
  const canEditMachines = useCanEditMachines()

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [cats, prods, mrcs, mods, vers] = await Promise.all([
        fetchCategoriasProdutos(),
        fetchProdutos(),
        fetchMarcas(),
        fetchModelos(),
        fetchVersoes({ lightweight: true }),
      ])
      setCategorias(cats || [])
      setProdutos(prods || [])
      setMarcas(mrcs || [])
      setModelos(mods || [])
      setVersoes(vers || [])
    } catch (err) {
      console.error('Error loading machine cascade data:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  // --- Filtering Rules ---

  const isInativo = (status?: string | null, deletedAt?: string | null) => {
    if (deletedAt) return true
    if (!status) return false
    const s = status.trim().toLowerCase()
    return s === 'inativo' || s === 'i' || s === 'em quarentena' || s === 'quarentena'
  }

  const isQuarentenado = (status?: string | null, deletedAt?: string | null) => {
    if (deletedAt) return true
    if (!status) return false
    const s = status.trim().toLowerCase()
    return s === 'em quarentena' || s === 'quarentena'
  }

  // 1. Categoria options (Active items or current selection - excludes quarantine)
  const categoriaOptions: ComboboxOption[] = useMemo(() => {
    return categorias
      .filter(
        (c) =>
          (!isQuarentenado(c.status, (c as any).deleted_at) && c.status === 'Ativo') ||
          c.id === value.categoriaId,
      )
      .map((c) => ({ value: c.id, label: c.nome }))
  }, [categorias, value.categoriaId])

  // 2. Produto options (Filtered by selected Categoria if present - excludes quarantine)
  const produtoOptions: ComboboxOption[] = useMemo(() => {
    if (!value.categoriaId) return []
    return produtos
      .filter(
        (p) =>
          p.categoria === value.categoriaId &&
          ((!isQuarentenado(p.status, (p as any).deleted_at) && p.status === 'Ativo') ||
            p.id === value.produtoId),
      )
      .map((p) => ({ value: p.id, label: p.nome }))
  }, [produtos, value.categoriaId, value.produtoId])

  // 3. Marca options (Filtered by selected Produto via the `modelos` table relationship)
  const marcaOptions: ComboboxOption[] = useMemo(() => {
    if (!value.produtoId) return []
    // Get all brand IDs that have models linked to this product
    const brandIdsForProduct = new Set(
      modelos.filter((m) => m.produto === value.produtoId && m.marca).map((m) => m.marca as string),
    )
    return marcas
      .filter(
        (m) =>
          ((!isQuarentenado(m.status, (m as any).deleted_at) && m.status === 'Ativo') ||
            m.id === value.marcaId) &&
          (brandIdsForProduct.size === 0 || brandIdsForProduct.has(m.id) || m.id === value.marcaId),
      )
      .map((m) => ({ value: m.id, label: m.nome }))
  }, [marcas, modelos, value.produtoId, value.marcaId])

  // 4. Modelo options (Filtered by selected Produto AND Marca)
  const modeloOptions: ComboboxOption[] = useMemo(() => {
    if (!value.produtoId || !value.marcaId) return []
    return modelos
      .filter(
        (m) =>
          m.produto === value.produtoId &&
          m.marca === value.marcaId &&
          ((!isQuarentenado(m.status, (m as any).deleted_at) && m.status === 'Ativo') ||
            m.id === value.modeloId),
      )
      .map((m) => ({ value: m.id, label: m.nome }))
  }, [modelos, value.produtoId, value.marcaId, value.modeloId])

  const selectedVersaoObj = versoes.find((v) => v.id === value.versaoId)
  const isSelectedVersaoInativa = selectedVersaoObj
    ? isInativo(selectedVersaoObj.status, selectedVersaoObj.deleted_at)
    : false

  // 5. Versão options (Filtered by selected Modelo) — inativas também são exibidas com badge
  // Itens em quarentena ou com deleted_at são sinalizados como [Quarentena] ou [Inativo]
  const versaoOptions: ComboboxOption[] = useMemo(() => {
    if (!value.modeloId) return []
    return versoes
      .filter((v) => v.modelo === value.modeloId)
      .map((v) => {
        const inativo = isInativo(v.status, v.deleted_at)
        const s = v.status?.trim().toLowerCase()
        const isQuarantine = s === 'em quarentena' || s === 'quarentena' || !!v.deleted_at
        const parts: string[] = []
        if (isQuarantine) parts.push('[Quarentena]')
        else if (inativo) parts.push('[Inativo]')
        if (v.cod_erp) parts.push(`ERP: ${v.cod_erp}`)
        return {
          value: v.id,
          label: v.nome,
          subtitle: parts.length > 0 ? parts.join(' · ') : undefined,
        }
      })
  }, [versoes, value.modeloId])

  // --- Cascade Reset Handlers ---

  const handleCategoriaChange = (id: string | null) => {
    if (id === value.categoriaId) return
    onChange({
      categoriaId: id,
      produtoId: null,
      marcaId: null,
      modeloId: null,
      versaoId: null,
    })
  }

  const handleProdutoChange = (id: string | null) => {
    if (id === value.produtoId) return
    onChange({
      ...value,
      produtoId: id,
      marcaId: null,
      modeloId: null,
      versaoId: null,
    })
  }

  const handleMarcaChange = (id: string | null) => {
    if (id === value.marcaId) return
    onChange({
      ...value,
      marcaId: id,
      modeloId: null,
      versaoId: null,
    })
  }

  const handleModeloChange = (id: string | null) => {
    if (id === value.modeloId) return
    onChange({
      ...value,
      modeloId: id,
      versaoId: null,
    })
  }

  const handleVersaoChange = (id: string | null) => {
    if (!id) {
      onChange({
        categoriaId: null,
        produtoId: null,
        marcaId: null,
        modeloId: null,
        versaoId: null,
      })
      return
    }
    onChange({
      ...value,
      versaoId: id,
    })
  }

  // --- Breadcrumb Context ---
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

  return (
    <div className="space-y-4">
      {/* 2 or 3 Column Responsive Grid for spacious selection layout */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
        {/* 1. Categoria */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-foreground/80 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-primary/10 text-primary text-[10px] font-bold">
                1
              </span>
              Categoria
            </span>
            {value.categoriaId && (
              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-0.5">
                <CheckCircle2 className="w-3 h-3" /> Selecionado
              </span>
            )}
          </label>
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <MachineCombobox
                value={value.categoriaId}
                onChange={handleCategoriaChange}
                options={categoriaOptions}
                placeholder="Selecione a Categoria..."
                searchPlaceholder="Buscar Categoria..."
                disabled={disabled || loading}
              />
            </div>
            <MachineAddButton
              label="Cadastrar Nova Categoria"
              canEdit={canEditMachines}
              disabled={disabled}
              onClick={() => setAddModal('categoria')}
            />
          </div>
        </div>

        {/* 2. Produto */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-foreground/80 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-primary/10 text-primary text-[10px] font-bold">
                2
              </span>
              Produto
            </span>
            {value.produtoId && (
              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-0.5">
                <CheckCircle2 className="w-3 h-3" /> Selecionado
              </span>
            )}
          </label>
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <MachineCombobox
                value={value.produtoId}
                onChange={handleProdutoChange}
                options={produtoOptions}
                placeholder="Selecione o Produto..."
                searchPlaceholder="Buscar Produto..."
                disabled={disabled || loading || !value.categoriaId}
                emptyMessage={
                  !value.categoriaId
                    ? 'Selecione uma Categoria primeiro'
                    : 'Nenhum produto cadastrado nesta categoria'
                }
              />
            </div>
            <MachineAddButton
              label="Cadastrar Novo Produto"
              canEdit={canEditMachines}
              disabled={disabled || !value.categoriaId}
              onClick={() => setAddModal('produto')}
            />
          </div>
        </div>

        {/* 3. Marca */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-foreground/80 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-primary/10 text-primary text-[10px] font-bold">
                3
              </span>
              Marca
            </span>
            {value.marcaId && (
              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-0.5">
                <CheckCircle2 className="w-3 h-3" /> Selecionado
              </span>
            )}
          </label>
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <MachineCombobox
                value={value.marcaId}
                onChange={handleMarcaChange}
                options={marcaOptions}
                placeholder="Selecione a Marca..."
                searchPlaceholder="Buscar Marca..."
                disabled={disabled || loading || !value.produtoId}
                emptyMessage={
                  !value.produtoId ? 'Selecione um Produto primeiro' : 'Nenhuma marca encontrada'
                }
              />
            </div>
            <MachineAddButton
              label="Cadastrar Nova Marca"
              canEdit={canEditMachines}
              disabled={disabled || !value.produtoId}
              onClick={() => setAddModal('marca')}
            />
          </div>
        </div>

        {/* 4. Modelo */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-foreground/80 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-primary/10 text-primary text-[10px] font-bold">
                4
              </span>
              Modelo
            </span>
            {value.modeloId && (
              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-0.5">
                <CheckCircle2 className="w-3 h-3" /> Selecionado
              </span>
            )}
          </label>
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <MachineCombobox
                value={value.modeloId}
                onChange={handleModeloChange}
                options={modeloOptions}
                placeholder="Selecione o Modelo..."
                searchPlaceholder="Buscar Modelo..."
                disabled={disabled || loading || !value.marcaId}
                emptyMessage={
                  !value.marcaId
                    ? 'Selecione uma Marca primeiro'
                    : 'Nenhum modelo cadastrado para este Produto e Marca'
                }
              />
            </div>
            <MachineAddButton
              label="Cadastrar Novo Modelo"
              canEdit={canEditMachines}
              disabled={disabled || !value.marcaId}
              onClick={() => setAddModal('modelo')}
            />
          </div>
        </div>

        {/* 5. Versão */}
        <div className="space-y-1.5 sm:col-span-2 lg:col-span-2">
          <label className="text-xs font-semibold text-foreground/80 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-primary/10 text-primary text-[10px] font-bold">
                5
              </span>
              Versão / Especificação
            </span>
            {value.versaoId && (
              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-0.5">
                <CheckCircle2 className="w-3 h-3" /> Selecionado
              </span>
            )}
          </label>
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <MachineCombobox
                value={value.versaoId}
                onChange={handleVersaoChange}
                options={versaoOptions}
                placeholder="Selecione a Versão..."
                searchPlaceholder="Buscar Versão..."
                disabled={disabled || loading || !value.modeloId}
                emptyMessage={
                  !value.modeloId
                    ? 'Selecione um Modelo primeiro'
                    : 'Nenhuma versão cadastrada para este Modelo'
                }
              />
            </div>
            <MachineAddButton
              label="Cadastrar Nova Versão"
              canEdit={canEditMachines}
              disabled={disabled || !value.modeloId}
              onClick={() => setAddModal('versao')}
            />
          </div>
        </div>
      </div>

      {/* Structured Visual Summary Box */}
      {showBreadcrumbContext && (
        <div className="mt-4 p-4 bg-muted/30 dark:bg-muted/20 rounded-lg border space-y-3">
          <div className="flex items-center justify-between gap-2 border-b pb-2 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Hierarquia Selecionada
              </span>
            </div>
            <div>
              {isComplete ? (
                <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 px-2.5 py-1 rounded-full text-xs font-medium border border-emerald-200 dark:border-emerald-800">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  Hierarquia Completa
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 px-2.5 py-1 rounded-full text-xs font-medium border border-amber-200 dark:border-amber-800">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  Seleção Incompleta (5 Níveis Requeridos)
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2 items-center text-xs">
            {/* Level 1: Categoria */}
            <div className="inline-flex items-center gap-1.5 max-w-full">
              <div
                className="inline-flex items-center gap-1.5 bg-background border rounded-md px-2.5 py-1 shadow-xs max-w-full"
                title={selectedCategoria ? `Categoria: ${selectedCategoria.nome}` : undefined}
              >
                <span className="text-muted-foreground font-medium shrink-0">Categoria:</span>
                <span
                  className={cn(
                    'break-words min-w-0 whitespace-normal',
                    selectedCategoria
                      ? 'font-semibold text-foreground'
                      : 'text-muted-foreground italic',
                  )}
                >
                  {selectedCategoria?.nome || 'Pendente'}
                </span>
              </div>
            </div>

            <span className="text-muted-foreground/40 font-bold shrink-0">›</span>

            {/* Level 2: Produto */}
            <div className="inline-flex items-center gap-1.5 max-w-full">
              <div
                className="inline-flex items-center gap-1.5 bg-background border rounded-md px-2.5 py-1 shadow-xs max-w-full"
                title={selectedProduto ? `Produto: ${selectedProduto.nome}` : undefined}
              >
                <span className="text-muted-foreground font-medium shrink-0">Produto:</span>
                <span
                  className={cn(
                    'break-words min-w-0 whitespace-normal',
                    selectedProduto
                      ? 'font-semibold text-foreground'
                      : 'text-muted-foreground italic',
                  )}
                >
                  {selectedProduto?.nome || 'Pendente'}
                </span>
              </div>
            </div>

            <span className="text-muted-foreground/40 font-bold shrink-0">›</span>

            {/* Level 3: Marca */}
            <div className="inline-flex items-center gap-1.5 max-w-full">
              <div
                className="inline-flex items-center gap-1.5 bg-background border rounded-md px-2.5 py-1 shadow-xs max-w-full"
                title={selectedMarca ? `Marca: ${selectedMarca.nome}` : undefined}
              >
                <span className="text-muted-foreground font-medium shrink-0">Marca:</span>
                <span
                  className={cn(
                    'break-words min-w-0 whitespace-normal',
                    selectedMarca
                      ? 'font-semibold text-foreground'
                      : 'text-muted-foreground italic',
                  )}
                >
                  {selectedMarca?.nome || 'Pendente'}
                </span>
              </div>
            </div>

            <span className="text-muted-foreground/40 font-bold shrink-0">›</span>

            {/* Level 4: Modelo */}
            <div className="inline-flex items-center gap-1.5 max-w-full">
              <div
                className="inline-flex items-center gap-1.5 bg-background border rounded-md px-2.5 py-1 shadow-xs max-w-full"
                title={selectedModelo ? `Modelo: ${selectedModelo.nome}` : undefined}
              >
                <span className="text-muted-foreground font-medium shrink-0">Modelo:</span>
                <span
                  className={cn(
                    'break-words min-w-0 whitespace-normal',
                    selectedModelo
                      ? 'font-semibold text-foreground'
                      : 'text-muted-foreground italic',
                  )}
                >
                  {selectedModelo?.nome || 'Pendente'}
                </span>
              </div>
            </div>

            <span className="text-muted-foreground/40 font-bold shrink-0">›</span>

            {/* Level 5: Versão */}
            <div className="inline-flex items-center gap-1.5 max-w-full">
              <div
                className="inline-flex items-center gap-1.5 bg-background border rounded-md px-2.5 py-1 shadow-xs max-w-full"
                title={selectedVersao ? `Versão: ${selectedVersao.nome}` : undefined}
              >
                <span className="text-muted-foreground font-medium shrink-0">Versão:</span>
                <span
                  className={cn(
                    'break-words min-w-0 whitespace-normal',
                    selectedVersao
                      ? 'font-semibold text-foreground'
                      : 'text-muted-foreground italic',
                  )}
                >
                  {selectedVersao?.nome || 'Pendente'}
                </span>
                {isSelectedVersaoInativa && (
                  <span className="text-[10px] px-1 py-0 rounded bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-medium shrink-0">
                    Inativo
                  </span>
                )}
              </div>
            </div>
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
          onChange({
            ...value,
            produtoId: newProduto.id,
            marcaId: null,
            modeloId: null,
            versaoId: null,
          })
          setAddModal(null)
        }}
      />

      {/* 3. Modal Nova Marca */}
      <MarcaForm
        open={addModal === 'marca'}
        onOpenChange={(open) => !open && setAddModal(null)}
        onSaved={async (newMarca) => {
          await loadData()
          onChange({
            ...value,
            marcaId: newMarca.id,
            modeloId: null,
            versaoId: null,
          })
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
          onChange({
            ...value,
            modeloId: newModelo.id,
            versaoId: null,
          })
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
          onChange({
            ...value,
            versaoId: newVersao.id,
          })
          setAddModal(null)
        }}
      />
    </div>
  )
}
