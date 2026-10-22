import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Search,
  Building2,
  UserCheck,
  UserX,
  Users,
  Loader2,
  Link2,
  Unlink,
  ArrowRightLeft,
  Briefcase,
  Mail,
  Phone,
  MapPin,
  Check,
} from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { normalizeSearchTerm } from '@/lib/cidades-brasil'
import { Gerente } from '@/types/gerente'
import {
  RepresentanteVinculoItem,
  VendedorVinculoItem,
  fetchAllRepresentantesComGerente,
  fetchAllVendedoresComGerente,
  setRepresentanteGerente,
  setVendedorGerente,
  fetchRepresentantesGerentesCategorias,
  setRepresentanteGerenteCategoria,
  removeRepresentanteGerenteCategoria,
  RepGerenteCategoriaVinculo,
} from '@/services/gerentes'
import { fetchCategoriasProdutos } from '@/services/categorias-produtos'
import { CategoriaProduto } from '@/types/categoria-produto'

interface GerenteVinculosDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  gerente: Gerente | null
  onVinculosChanged?: () => void
}

type TabType = 'representantes' | 'vendedores'
type FilterMode = 'todos' | 'vinculados' | 'disponiveis'

export function GerenteVinculosDialog({
  open,
  onOpenChange,
  gerente,
  onVinculosChanged,
}: GerenteVinculosDialogProps) {
  const [activeTab, setActiveTab] = useState<TabType>('representantes')
  const [searchRep, setSearchRep] = useState('')
  const [searchVend, setSearchVend] = useState('')
  const [filterModeRep, setFilterModeRep] = useState<FilterMode>('todos')
  const [filterModeVend, setFilterModeVend] = useState<FilterMode>('todos')

  const [representantes, setRepresentantes] = useState<RepresentanteVinculoItem[]>([])
  const [vendedores, setVendedores] = useState<VendedorVinculoItem[]>([])
  const [categorias, setCategorias] = useState<CategoriaProduto[]>([])
  const [rgcVinculos, setRgcVinculos] = useState<RepGerenteCategoriaVinculo[]>([])
  const [selectedCategoriaByRep, setSelectedCategoriaByRep] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [processingId, setProcessingId] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    if (!open || !gerente) return
    setLoading(true)
    try {
      const [reps, vends, cats, vinculos] = await Promise.all([
        fetchAllRepresentantesComGerente(),
        fetchAllVendedoresComGerente(),
        fetchCategoriasProdutos(),
        fetchRepresentantesGerentesCategorias(),
      ])
      setRepresentantes(reps)
      setVendedores(vends)
      setCategorias(cats.filter((c) => c.status === 'Ativo' && !c.deleted_at))
      setRgcVinculos(vinculos)
    } catch (err) {
      toast({
        title: 'Erro ao carregar lista de vínculos',
        description: err instanceof Error ? err.message : 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [open, gerente])

  useEffect(() => {
    if (open && gerente) {
      loadData()
      setSearchRep('')
      setSearchVend('')
      setFilterModeRep('todos')
      setFilterModeVend('todos')
    }
  }, [open, gerente, loadData])

  // Mapa de categorias por ID
  const categoriaMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const c of categorias) {
      map.set(c.id, c.nome)
    }
    return map
  }, [categorias])

  // Vínculos por categoria agrupados por representante_id
  const rgcByRep = useMemo(() => {
    const map = new Map<string, RepGerenteCategoriaVinculo[]>()
    for (const v of rgcVinculos) {
      const list = map.get(v.representante_id) || []
      list.push(v)
      map.set(v.representante_id, list)
    }
    return map
  }, [rgcVinculos])

  // Contadores de representantes
  const repCounts = useMemo(() => {
    if (!gerente) return { vinculados: 0, outros: 0, livres: 0, total: 0 }
    let vinculados = 0
    let outros = 0
    let livres = 0
    for (const r of representantes) {
      const catVincs = rgcByRep.get(r.id) || []
      const hasCatVinculoHere = catVincs.some((v) => v.gerente_id === gerente.id)
      const isLegadoHere = r.gerente_id === gerente.id

      if (hasCatVinculoHere || (catVincs.length === 0 && isLegadoHere)) {
        vinculados++
      } else if (catVincs.length > 0 || r.gerente_id) {
        outros++
      } else {
        livres++
      }
    }
    return { vinculados, outros, livres, total: representantes.length }
  }, [representantes, gerente, rgcByRep])

  const vendCounts = useMemo(() => {
    if (!gerente) return { vinculados: 0, outros: 0, livres: 0, total: 0 }
    let vinculados = 0
    let outros = 0
    let livres = 0
    for (const v of vendedores) {
      if (v.gerente_id === gerente.id) vinculados++
      else if (v.gerente_id) outros++
      else livres++
    }
    return { vinculados, outros, livres, total: vendedores.length }
  }, [vendedores, gerente])

  // Vincular representante para uma categoria específica
  const handleVincularCategoria = async (rep: RepresentanteVinculoItem) => {
    if (!gerente || processingId) return
    const chosenCatId = selectedCategoriaByRep[rep.id]
    if (!chosenCatId) {
      toast({
        title: 'Escolha uma categoria',
        description: 'Selecione a categoria de produtos antes de vincular.',
        variant: 'destructive',
      })
      return
    }

    const catNome = categoriaMap.get(chosenCatId) || 'Categoria'
    const busyKey = `${rep.id}-${chosenCatId}`
    setProcessingId(busyKey)

    try {
      await setRepresentanteGerenteCategoria(rep.id, gerente.id, chosenCatId)

      // Atualiza também o fallback legado caso ainda não tenha gerente_id
      if (!rep.gerente_id) {
        await setRepresentanteGerente(rep.id, gerente.id)
        setRepresentantes((prev) =>
          prev.map((r) =>
            r.id === rep.id ? { ...r, gerente_id: gerente.id, gerente_nome: gerente.nome } : r,
          ),
        )
      }

      // Atualização otimista de vínculos por categoria
      setRgcVinculos((prev) => {
        const filtered = prev.filter(
          (v) => !(v.representante_id === rep.id && v.categoria_id === chosenCatId),
        )
        return [
          ...filtered,
          {
            id: `temp-${Date.now()}`,
            representante_id: rep.id,
            gerente_id: gerente.id,
            categoria_id: chosenCatId,
          },
        ]
      })

      // Limpa a categoria selecionada para este representante
      setSelectedCategoriaByRep((prev) => {
        const next = { ...prev }
        delete next[rep.id]
        return next
      })

      toast({
        title: 'Vínculo por categoria salvo',
        description: `Representante vinculado a ${gerente.nome} na categoria ${catNome}.`,
      })

      onVinculosChanged?.()
    } catch (err) {
      toast({
        title: 'Erro ao vincular categoria',
        description: err instanceof Error ? err.message : 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setProcessingId(null)
    }
  }

  // Remover vínculo de uma categoria específica
  const handleRemoverCategoria = async (rep: RepresentanteVinculoItem, categoriaId: string) => {
    if (!gerente || processingId) return
    const catNome = categoriaMap.get(categoriaId) || 'Categoria'
    const busyKey = `${rep.id}-${categoriaId}`
    setProcessingId(busyKey)

    try {
      await removeRepresentanteGerenteCategoria(rep.id, categoriaId)

      setRgcVinculos((prev) =>
        prev.filter((v) => !(v.representante_id === rep.id && v.categoria_id === categoriaId)),
      )

      toast({
        title: 'Vínculo removido',
        description: `Removido vínculo de ${catNome} com ${gerente.nome}.`,
      })

      onVinculosChanged?.()
    } catch (err) {
      toast({
        title: 'Erro ao desvincular categoria',
        description: err instanceof Error ? err.message : 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setProcessingId(null)
    }
  }

  // Desvincular geral do representante (fallback legado)
  const handleDesvincularLegado = async (rep: RepresentanteVinculoItem) => {
    if (!gerente || processingId) return
    setProcessingId(rep.id)
    try {
      // Remove vínculos por categoria que apontem para este gerente
      const repVincs = (rgcByRep.get(rep.id) || []).filter((v) => v.gerente_id === gerente.id)
      for (const v of repVincs) {
        await removeRepresentanteGerenteCategoria(rep.id, v.categoria_id)
      }
      setRgcVinculos((prev) =>
        prev.filter((v) => !(v.representante_id === rep.id && v.gerente_id === gerente.id)),
      )

      // Limpa gerente_id legado se apontar para este gerente
      if (rep.gerente_id === gerente.id) {
        await setRepresentanteGerente(rep.id, null)
        setRepresentantes((prev) =>
          prev.map((r) => (r.id === rep.id ? { ...r, gerente_id: null, gerente_nome: null } : r)),
        )
      }

      toast({
        title: 'Representante desvinculado',
        description: `Vínculos com ${gerente.nome} foram removidos.`,
      })
      onVinculosChanged?.()
    } catch (err) {
      toast({
        title: 'Erro ao desvincular',
        description: err instanceof Error ? err.message : 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setProcessingId(null)
    }
  }

  // Ações de vincular / desvincular vendedor
  const handleToggleVend = async (vend: VendedorVinculoItem) => {
    if (!gerente || processingId) return
    const isCurrentlyLinked = vend.gerente_id === gerente.id
    const newGerenteId = isCurrentlyLinked ? null : gerente.id
    const prevGerenteNome = vend.gerente_nome

    setProcessingId(vend.id)
    try {
      await setVendedorGerente(vend.id, newGerenteId)

      // Atualização otimista local
      setVendedores((prev) =>
        prev.map((v) =>
          v.id === vend.id
            ? {
                ...v,
                gerente_id: newGerenteId,
                gerente_nome: newGerenteId ? gerente.nome : null,
              }
            : v,
        ),
      )

      if (isCurrentlyLinked) {
        toast({
          title: 'Vínculo removido',
          description: `O vendedor "${vend.name || vend.email}" foi desvinculado de ${gerente.nome}.`,
        })
      } else {
        const transferMsg = prevGerenteNome ? ` (transferido de ${prevGerenteNome})` : ''
        toast({
          title: 'Vendedor vinculado com sucesso',
          description: `"${vend.name || vend.email}" agora está vinculado a ${gerente.nome}${transferMsg}.`,
        })
      }

      onVinculosChanged?.()
    } catch (err) {
      toast({
        title: 'Erro ao alterar vínculo do vendedor',
        description: err instanceof Error ? err.message : 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setProcessingId(null)
    }
  }

  // Filtragem de representantes (com tolerância a acentos)
  const filteredRepresentantes = useMemo(() => {
    if (!gerente) return []
    const q = normalizeSearchTerm(searchRep)
    return representantes.filter((r) => {
      // Checa vínculos por categoria e fallback legado
      const catVincs = rgcByRep.get(r.id) || []
      const isLinkedHere =
        catVincs.some((v) => v.gerente_id === gerente.id) ||
        (catVincs.length === 0 && r.gerente_id === gerente.id)

      // Filtro de status de vínculo
      if (filterModeRep === 'vinculados' && !isLinkedHere) return false
      if (filterModeRep === 'disponiveis' && isLinkedHere) return false

      if (!q) return true

      const matchFantasia = normalizeSearchTerm(r.fantasia || '').includes(q)
      const matchRazao = normalizeSearchTerm(r.razao_social || '').includes(q)
      const matchCidade = normalizeSearchTerm(r.cidade || '').includes(q)
      const matchEstado = normalizeSearchTerm(r.estado || '').includes(q)
      const matchEmail = normalizeSearchTerm(r.email || '').includes(q)
      const matchGerente = normalizeSearchTerm(r.gerente_nome || '').includes(q)

      return matchFantasia || matchRazao || matchCidade || matchEstado || matchEmail || matchGerente
    })
  }, [representantes, searchRep, filterModeRep, gerente, rgcByRep])

  // Filtragem de vendedores
  const filteredVendedores = useMemo(() => {
    if (!gerente) return []
    const q = normalizeSearchTerm(searchVend)
    return vendedores.filter((v) => {
      if (filterModeVend === 'vinculados' && v.gerente_id !== gerente.id) return false
      if (filterModeVend === 'disponiveis' && v.gerente_id === gerente.id) return false

      if (!q) return true

      const matchName = normalizeSearchTerm(v.name || '').includes(q)
      const matchEmail = normalizeSearchTerm(v.email || '').includes(q)
      const matchSetor = normalizeSearchTerm(v.setor || '').includes(q)
      const matchGerente = normalizeSearchTerm(v.gerente_nome || '').includes(q)

      return matchName || matchEmail || matchSetor || matchGerente
    })
  }, [vendedores, searchVend, filterModeVend, gerente])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-hidden flex flex-col p-6">
        <DialogHeader className="pb-2 border-b">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
              <Link2 className="w-5 h-5 text-emerald-700" />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-xl font-bold text-foreground truncate">
                Gerenciar Vínculos — {gerente?.nome}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                {gerente?.cargo ? `${gerente.cargo} • ` : ''}
                Vincule ou transfira representantes e vendedores sob a responsabilidade deste
                gerente
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as TabType)}
          className="flex-1 flex flex-col min-h-0 mt-3"
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="representantes" className="gap-2 text-sm">
              <Building2 className="w-4 h-4" />
              <span>Representantes</span>
              <Badge
                variant="secondary"
                className="ml-1 text-[11px] font-semibold bg-emerald-100 text-emerald-800 hover:bg-emerald-100"
              >
                {repCounts.vinculados}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="vendedores" className="gap-2 text-sm">
              <Users className="w-4 h-4" />
              <span>Vendedores (Usuários)</span>
              <Badge
                variant="secondary"
                className="ml-1 text-[11px] font-semibold bg-emerald-100 text-emerald-800 hover:bg-emerald-100"
              >
                {vendCounts.vinculados}
              </Badge>
            </TabsTrigger>
          </TabsList>

          {/* ===================== ABA REPRESENTANTES ===================== */}
          <TabsContent
            value="representantes"
            className="flex-1 flex flex-col min-h-0 space-y-3 mt-3"
          >
            {/* Controles de busca e filtro */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  placeholder="Buscar por nome, razão social, cidade, estado..."
                  value={searchRep}
                  onChange={(e) => setSearchRep(e.target.value)}
                  className="pl-9 text-sm"
                />
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Button
                  type="button"
                  variant={filterModeRep === 'todos' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilterModeRep('todos')}
                  className="text-xs h-9"
                >
                  Todos ({repCounts.total})
                </Button>
                <Button
                  type="button"
                  variant={filterModeRep === 'vinculados' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilterModeRep('vinculados')}
                  className="text-xs h-9 gap-1"
                >
                  <Check className="w-3.5 h-3.5" />
                  Vinculados ({repCounts.vinculados})
                </Button>
                <Button
                  type="button"
                  variant={filterModeRep === 'disponiveis' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilterModeRep('disponiveis')}
                  className="text-xs h-9"
                >
                  Outros / Livres ({repCounts.total - repCounts.vinculados})
                </Button>
              </div>
            </div>

            {/* Dica amigável */}
            <div className="text-xs text-muted-foreground bg-muted/40 p-2.5 rounded-md flex items-center justify-between">
              <span>
                💡 Cada representante pode ter gerentes diferentes por categoria de produto (ex:
                Tornos com um gerente, Centros de Usinagem com outro). Escolha a categoria e
                vincule.
              </span>
              <span className="font-medium text-foreground ml-2 shrink-0">
                {filteredRepresentantes.length} resultado(s)
              </span>
            </div>

            {/* Lista com scroll */}
            <div className="flex-1 overflow-y-auto pr-1 border rounded-lg divide-y bg-card min-h-[300px]">
              {loading ? (
                <div className="flex flex-col items-center justify-center p-12 text-sm text-muted-foreground gap-2">
                  <Loader2 className="w-6 h-6 animate-spin text-emerald-700" />
                  <span>Carregando representantes...</span>
                </div>
              ) : filteredRepresentantes.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-12 text-center text-sm text-muted-foreground space-y-1">
                  <UserX className="w-8 h-8 text-muted-foreground/60 mb-1" />
                  <p className="font-semibold text-foreground">Nenhum representante encontrado</p>
                  <p className="text-xs">
                    Tente ajustar a busca ou alternar entre os filtros acima.
                  </p>
                </div>
              ) : (
                filteredRepresentantes.map((rep) => {
                  const catVincs = rgcByRep.get(rep.id) || []
                  const vincsHere = catVincs.filter((v) => v.gerente_id === gerente?.id)
                  const vincsOther = catVincs.filter((v) => v.gerente_id !== gerente?.id)

                  const isLegadoHere = rep.gerente_id === gerente?.id
                  const hasOtherLegado = !!rep.gerente_id && !isLegadoHere
                  const isLinkedHere =
                    vincsHere.length > 0 || (catVincs.length === 0 && isLegadoHere)

                  const selectedCatId = selectedCategoriaByRep[rep.id] || ''
                  const busyKey = `${rep.id}-${selectedCatId}`
                  const isBusyVincular = processingId === busyKey
                  const isBusyLegado = processingId === rep.id

                  return (
                    <div
                      key={rep.id}
                      className={`p-3.5 flex flex-col gap-3 transition-colors ${
                        isLinkedHere ? 'bg-emerald-50/60 hover:bg-emerald-50' : 'hover:bg-accent/40'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                        <div className="min-w-0 space-y-1 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Building2
                              className={`w-4 h-4 shrink-0 ${
                                isLinkedHere ? 'text-emerald-700' : 'text-muted-foreground'
                              }`}
                            />
                            <span className="font-semibold text-sm text-foreground">
                              {rep.fantasia || rep.razao_social}
                            </span>

                            {isLinkedHere && (
                              <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white text-[11px] font-medium gap-1">
                                <Check className="w-3 h-3" /> Vinculado a {gerente?.nome}
                              </Badge>
                            )}

                            {catVincs.length === 0 && hasOtherLegado && (
                              <Badge
                                variant="outline"
                                className="text-[11px] font-normal border-amber-300 bg-amber-50 text-amber-900"
                              >
                                Gerente legado: {rep.gerente_nome || 'Outro'}
                              </Badge>
                            )}

                            {catVincs.length === 0 && !rep.gerente_id && (
                              <Badge
                                variant="outline"
                                className="text-[11px] font-normal border-slate-200 text-muted-foreground"
                              >
                                Sem vínculos
                              </Badge>
                            )}

                            {rep.status && rep.status !== 'Ativo' && (
                              <Badge variant="secondary" className="text-[10px]">
                                {rep.status}
                              </Badge>
                            )}
                          </div>

                          {rep.razao_social &&
                            rep.fantasia &&
                            rep.razao_social !== rep.fantasia && (
                              <p className="text-xs text-muted-foreground">
                                Razão Social: {rep.razao_social}
                              </p>
                            )}

                          <div className="text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-0.5">
                            {(rep.cidade || rep.estado) && (
                              <span className="inline-flex items-center gap-1">
                                <MapPin className="w-3 h-3 text-muted-foreground/70" />
                                {rep.cidade || '—'}
                                {rep.estado ? `/${rep.estado}` : ''}
                              </span>
                            )}
                            {rep.email && (
                              <span className="inline-flex items-center gap-1">
                                <Mail className="w-3 h-3 text-muted-foreground/70" />
                                {rep.email}
                              </span>
                            )}
                            {rep.telefone && (
                              <span className="inline-flex items-center gap-1">
                                <Phone className="w-3 h-3 text-muted-foreground/70" />
                                {rep.telefone}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Botão para desvincular tudo deste gerente se estiver vinculado */}
                        {isLinkedHere && (
                          <div className="shrink-0">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={isBusyLegado}
                              onClick={() => handleDesvincularLegado(rep)}
                              className="text-xs h-7 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive gap-1"
                            >
                              {isBusyLegado ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <Unlink className="w-3 h-3" />
                              )}
                              Desvincular Tudo
                            </Button>
                          </div>
                        )}
                      </div>

                      {/* Vínculos por categoria já existentes para este representante */}
                      <div className="rounded-md border bg-background/80 p-2.5 text-xs space-y-2">
                        <div className="flex items-center justify-between text-muted-foreground font-medium">
                          <span>Categorias vinculadas a este gerente:</span>
                          <span className="text-[11px]">
                            {vincsHere.length > 0
                              ? `${vincsHere.length} categoria(s)`
                              : isLegadoHere
                                ? 'Vínculo legado ativo (todas)'
                                : 'Nenhuma'}
                          </span>
                        </div>

                        {/* Chips com as categorias vinculadas a este gerente */}
                        {vincsHere.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {vincsHere.map((v) => {
                              const cName = categoriaMap.get(v.categoria_id) || 'Categoria'
                              const isBusyRem = processingId === `${rep.id}-${v.categoria_id}`
                              return (
                                <span
                                  key={v.id}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300 font-medium text-[11px]"
                                >
                                  {cName}
                                  <button
                                    type="button"
                                    disabled={isBusyRem}
                                    onClick={() => handleRemoverCategoria(rep, v.categoria_id)}
                                    title={`Remover vínculo de ${cName}`}
                                    className="hover:text-destructive text-emerald-700 ml-0.5"
                                  >
                                    {isBusyRem ? <Loader2 className="w-3 h-3 animate-spin" /> : '×'}
                                  </button>
                                </span>
                              )
                            })}
                          </div>
                        ) : isLegadoHere ? (
                          <p className="text-[11px] text-muted-foreground italic">
                            Sem categoria individual definida — respondendo pelo vínculo geral de
                            gerente_id.
                          </p>
                        ) : (
                          <p className="text-[11px] text-muted-foreground italic">
                            Nenhuma categoria vinculada a {gerente?.nome}.
                          </p>
                        )}

                        {/* Exibe vínculos com outros gerentes para transparência */}
                        {vincsOther.length > 0 && (
                          <div className="pt-1 border-t text-[11px] text-muted-foreground flex flex-wrap items-center gap-1.5">
                            <span className="font-medium text-amber-800">
                              Vinculado a outros gerentes em:
                            </span>
                            {vincsOther.map((vo) => (
                              <Badge
                                key={vo.id}
                                variant="outline"
                                className="text-[10px] py-0 px-1.5 border-amber-300 bg-amber-50 text-amber-900"
                              >
                                {categoriaMap.get(vo.categoria_id) || 'Categoria'}
                              </Badge>
                            ))}
                          </div>
                        )}

                        {/* Seletor para adicionar/vincular nova categoria */}
                        <div className="pt-2 border-t flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                          <div className="flex-1">
                            <select
                              value={selectedCatId}
                              onChange={(e) =>
                                setSelectedCategoriaByRep((prev) => ({
                                  ...prev,
                                  [rep.id]: e.target.value,
                                }))
                              }
                              className="w-full text-xs h-8 rounded-md border border-input bg-background px-2 py-1 text-foreground shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                            >
                              <option value="">Selecione uma categoria para vincular...</option>
                              {categorias.map((c) => {
                                const isAlreadyLinkedHere = vincsHere.some(
                                  (vh) => vh.categoria_id === c.id,
                                )
                                return (
                                  <option key={c.id} value={c.id} disabled={isAlreadyLinkedHere}>
                                    {c.nome} {isAlreadyLinkedHere ? '(Já vinculada aqui)' : ''}
                                  </option>
                                )
                              })}
                            </select>
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            disabled={!selectedCatId || isBusyVincular}
                            onClick={() => handleVincularCategoria(rep)}
                            className="text-xs h-8 bg-emerald-700 hover:bg-emerald-800 text-white shrink-0 gap-1.5"
                          >
                            {isBusyVincular ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Link2 className="w-3.5 h-3.5" />
                            )}
                            Vincular Categoria
                          </Button>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </TabsContent>

          {/* ===================== ABA VENDEDORES ===================== */}
          <TabsContent value="vendedores" className="flex-1 flex flex-col min-h-0 space-y-3 mt-3">
            {/* Controles de busca e filtro */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  placeholder="Buscar vendedor por nome, e-mail, setor..."
                  value={searchVend}
                  onChange={(e) => setSearchVend(e.target.value)}
                  className="pl-9 text-sm"
                />
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Button
                  type="button"
                  variant={filterModeVend === 'todos' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilterModeVend('todos')}
                  className="text-xs h-9"
                >
                  Todos ({vendCounts.total})
                </Button>
                <Button
                  type="button"
                  variant={filterModeVend === 'vinculados' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilterModeVend('vinculados')}
                  className="text-xs h-9 gap-1"
                >
                  <Check className="w-3.5 h-3.5" />
                  Vinculados ({vendCounts.vinculados})
                </Button>
                <Button
                  type="button"
                  variant={filterModeVend === 'disponiveis' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilterModeVend('disponiveis')}
                  className="text-xs h-9"
                >
                  Outros / Livres ({vendCounts.total - vendCounts.vinculados})
                </Button>
              </div>
            </div>

            {/* Dica amigável */}
            <div className="text-xs text-muted-foreground bg-muted/40 p-2.5 rounded-md flex items-center justify-between">
              <span>
                💡 Usuários com perfil <strong>Vendedor</strong> registrados no sistema. O vínculo
                determina quais vendedores aparecem na aba &quot;Meus Vendedores&quot; deste
                gerente.
              </span>
              <span className="font-medium text-foreground ml-2 shrink-0">
                {filteredVendedores.length} resultado(s)
              </span>
            </div>

            {/* Lista com scroll */}
            <div className="flex-1 overflow-y-auto pr-1 border rounded-lg divide-y bg-card min-h-[300px]">
              {loading ? (
                <div className="flex flex-col items-center justify-center p-12 text-sm text-muted-foreground gap-2">
                  <Loader2 className="w-6 h-6 animate-spin text-emerald-700" />
                  <span>Carregando vendedores...</span>
                </div>
              ) : filteredVendedores.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-12 text-center text-sm text-muted-foreground space-y-1">
                  <UserX className="w-8 h-8 text-muted-foreground/60 mb-1" />
                  <p className="font-semibold text-foreground">Nenhum vendedor encontrado</p>
                  <p className="text-xs">
                    Não há usuários com a role &quot;Vendedor&quot; que atendam aos filtros.
                  </p>
                </div>
              ) : (
                filteredVendedores.map((vend) => {
                  const isLinkedHere = vend.gerente_id === gerente?.id
                  const hasOtherGerente = !!vend.gerente_id && !isLinkedHere
                  const isBusy = processingId === vend.id

                  return (
                    <div
                      key={vend.id}
                      className={`p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                        isLinkedHere ? 'bg-emerald-50/60 hover:bg-emerald-50' : 'hover:bg-accent/40'
                      }`}
                    >
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <UserCheck
                            className={`w-4 h-4 shrink-0 ${
                              isLinkedHere ? 'text-emerald-700' : 'text-muted-foreground'
                            }`}
                          />
                          <span className="font-semibold text-sm text-foreground">
                            {vend.name || vend.email}
                          </span>

                          {isLinkedHere && (
                            <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white text-[11px] font-medium gap-1">
                              <Check className="w-3 h-3" /> Vinculado a este gerente
                            </Badge>
                          )}

                          {hasOtherGerente && (
                            <Badge
                              variant="outline"
                              className="text-[11px] font-normal border-amber-300 bg-amber-50 text-amber-900"
                            >
                              Gerente atual: {vend.gerente_nome || 'Outro'}
                            </Badge>
                          )}

                          {!vend.gerente_id && (
                            <Badge
                              variant="outline"
                              className="text-[11px] font-normal border-slate-200 text-muted-foreground"
                            >
                              Sem gerente
                            </Badge>
                          )}

                          {vend.status && vend.status !== 'ativo' && vend.status !== 'Ativo' && (
                            <Badge variant="secondary" className="text-[10px]">
                              {vend.status}
                            </Badge>
                          )}
                        </div>

                        <div className="text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-0.5">
                          {vend.email && (
                            <span className="inline-flex items-center gap-1">
                              <Mail className="w-3 h-3 text-muted-foreground/70" />
                              {vend.email}
                            </span>
                          )}
                          {vend.setor && (
                            <span className="inline-flex items-center gap-1">
                              <Briefcase className="w-3 h-3 text-muted-foreground/70" />
                              Setor: {vend.setor}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Botão de ação */}
                      <div className="sm:self-center shrink-0">
                        {isLinkedHere ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={isBusy}
                            onClick={() => handleToggleVend(vend)}
                            className="text-xs h-8 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive gap-1.5"
                          >
                            {isBusy ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Unlink className="w-3.5 h-3.5" />
                            )}
                            Desvincular
                          </Button>
                        ) : hasOtherGerente ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={isBusy}
                            onClick={() => handleToggleVend(vend)}
                            className="text-xs h-8 text-amber-900 border-amber-300 bg-amber-50/70 hover:bg-amber-100 gap-1.5"
                          >
                            {isBusy ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <ArrowRightLeft className="w-3.5 h-3.5" />
                            )}
                            Transferir para cá
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            variant="default"
                            size="sm"
                            disabled={isBusy}
                            onClick={() => handleToggleVend(vend)}
                            className="text-xs h-8 bg-emerald-700 hover:bg-emerald-800 text-white gap-1.5"
                          >
                            {isBusy ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Link2 className="w-3.5 h-3.5" />
                            )}
                            Vincular
                          </Button>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
