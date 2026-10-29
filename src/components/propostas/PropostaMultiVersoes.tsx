import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Command,
  CommandInput,
  CommandList,
  CommandItem,
  CommandEmpty,
} from '@/components/ui/command'
import { FormattedNumberInput } from '@/components/shared/formatted-number-input'
import {
  Plus,
  Trash2,
  Package,
  Layers,
  ChevronUp,
  ChevronDown,
  Search,
  Check,
  ChevronsUpDown,
  X,
  Loader2,
  Wrench,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  PropostaAcessoriosSection,
  SelectedAcessorio,
} from '@/components/propostas/PropostaAcessoriosSection'
import { VersaoWithModelo } from '@/types/versao'
import {
  calculateLineTotal,
  calculateSubtotal,
  getShippingGroupFromTipoNome,
  getShippingGroupLabel,
  ShippingGroup,
} from '@/lib/proposta-calculations'
import { useToast } from '@/hooks/use-toast'
import { useDebounce } from '@/hooks/use-debounce'
import { searchVersoesAtivas, VersaoSearchResult } from '@/services/versoes'
import { useGerenteCategoryRestriction } from '@/hooks/use-gerente-restriction'
import { fetchTiposPropostaByVersaoId, fetchTiposProposta } from '@/services/tipos-proposta'
import { TipoProposta } from '@/types/tipo-proposta'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export interface PropostaVersaoItem {
  versao_id: string
  nome: string
  quantidade: number
  valor_unitario: number
  desconto_percentual?: number
  desconto_valor?: number
  tipo_proposta?: string
}

interface Props {
  versoes: VersaoWithModelo[]
  items: PropostaVersaoItem[]
  onChange: (items: PropostaVersaoItem[]) => void
  currency: string
  disabled?: boolean
  precoEspecialAtivo?: boolean
  acessorios?: SelectedAcessorio[]
  onAcessoriosChange?: (items: SelectedAcessorio[]) => void
}

interface SelectedVersaoSummary {
  id: string
  nome: string
  valor?: number | null
}

export function PropostaMultiVersoes({
  versoes,
  items,
  onChange,
  currency,
  disabled,
  precoEspecialAtivo,
  acessorios = [],
  onAcessoriosChange,
}: Props) {
  const { toast } = useToast()
  const restriction = useGerenteCategoryRestriction()
  const [selectedVersaoId, setSelectedVersaoId] = useState('')
  const [selectedVersaoObj, setSelectedVersaoObj] = useState<SelectedVersaoSummary | null>(null)
  const [comboboxOpen, setComboboxOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<VersaoSearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [versaoTiposCache, setVersaoTiposCache] = useState<Record<string, string[]>>({})

  // Debounce da busca para não disparar requisição a cada caractere
  const debouncedQuery = useDebounce(searchQuery, 300)
  const requestIdRef = useRef(0)

  // Dispara a busca sob demanda no Supabase via searchVersoesAtivas (máximo 20 resultados)
  useEffect(() => {
    const trimmed = debouncedQuery.trim()
    if (!comboboxOpen || trimmed.length < 2) {
      setSearchResults([])
      setIsSearching(false)
      return
    }

    const currentReq = ++requestIdRef.current
    setIsSearching(true)

    const catFilter =
      restriction.hasRestriction && restriction.categoriaId ? restriction.categoriaId : undefined

    searchVersoesAtivas(trimmed, 20, catFilter)
      .then(async (results) => {
        if (requestIdRef.current !== currentReq) return

        // Pré-carrega tipos das versões encontradas para ter a informação de grupos disponível
        const missingIds = results.map((r) => r.id).filter((id) => id && !versaoTiposCache[id])
        if (missingIds.length > 0) {
          const promises = missingIds.map((vid) =>
            fetchTiposPropostaByVersaoId(vid, true)
              .then((list) => {
                if (list && list.length > 0) {
                  setVersaoTiposCache((prev) => ({
                    ...prev,
                    [vid]: list.map((t) => t.nome),
                  }))
                }
              })
              .catch(() => {}),
          )
          await Promise.all(promises)
        }

        if (requestIdRef.current === currentReq) {
          setSearchResults(results)
          setIsSearching(false)
        }
      })
      .catch((err) => {
        console.error('Erro na busca sob demanda de versões:', err)
        if (requestIdRef.current === currentReq) {
          setSearchResults([])
          setIsSearching(false)
        }
      })
  }, [
    debouncedQuery,
    comboboxOpen,
    restriction.hasRestriction,
    restriction.categoriaId,
    versaoTiposCache,
  ])

  // Limpa o termo quando o combobox fecha (se não tiver selecionado)
  useEffect(() => {
    if (!comboboxOpen) {
      setSearchQuery('')
      setSearchResults([])
      setIsSearching(false)
    }
  }, [comboboxOpen])

  const fmtCurrency = (val: number) => {
    const formatted = val.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
    if (currency === 'USD') return `US$ ${formatted}`
    if (currency === 'EUR') return `€ ${formatted}`
    return `R$ ${formatted}`
  }

  const addMachine = () => {
    if (isAddBlocked) {
      toast({
        title: 'Seleção pendente',
        description: 'Selecione o tipo de proposta da máquina anterior para adicionar outra',
        variant: 'destructive',
      })
      return
    }
    if (!selectedVersaoId) return
    if (items.some((i) => i.versao_id === selectedVersaoId)) return

    // Tenta obter os dados do objeto selecionado ou do array de versoes recebido por prop
    const v = selectedVersaoObj || versoes.find((x) => x.id === selectedVersaoId)
    if (!v) return

    // Validação de compatibilidade de shipping group se o tipo da primeira máquina já foi selecionado
    if (pacoteShippingGroup) {
      const isCompatible = isMachineCompatibleWithGroup(v.id, pacoteShippingGroup)
      if (!isCompatible) {
        const machineGroup = getMachineShippingGroup(v.id) || 'outro'
        const machineLabel = getShippingGroupLabel(machineGroup)
        const pacoteLabel = getShippingGroupLabel(pacoteShippingGroup)
        toast({
          title: 'Tipo de fornecimento incompatível',
          description: `Esta máquina é ${machineLabel} e o pacote está configurado para fornecimento de ${pacoteLabel}. Pacotes só aceitam máquinas com o mesmo tipo de fornecimento.`,
          variant: 'destructive',
        })
        return
      }
    }

    // Ponto 19 (Filtro Fino): A máquina DEVE ter o mesmo tipo de proposta da primeira máquina
    if (pacoteTargetTipo) {
      const isCompatibleExact = isMachineCompatibleWithExactTipo(v.id, pacoteTargetTipo)
      if (!isCompatibleExact) {
        toast({
          title: 'Tipo de proposta incompatível no pacote',
          description: `Esta máquina não possui o tipo de proposta selecionado neste pacote (${pacoteTargetTipo}). Cadastre o tipo na máquina ou remova-a do pacote.`,
          variant: 'destructive',
        })
        return
      }
    }

    // BUG 2: Uma nova máquina adicionada ao pacote NUNCA herda acessórios antigos
    if (onAcessoriosChange) {
      onAcessoriosChange(acessorios.filter((a) => a.versao_id !== v.id))
    }

    onChange([
      ...items,
      {
        versao_id: v.id,
        nome: v.nome,
        quantidade: 1,
        valor_unitario: v.valor || 0,
        desconto_percentual: 0,
        desconto_valor: 0,
        tipo_proposta: items.length > 0 && pacoteTargetTipo ? pacoteTargetTipo : undefined,
      },
    ])
    setSelectedVersaoId('')
    setSelectedVersaoObj(null)
  }

  const removeItem = (versaoId: string) => {
    if (items.length <= 1) return
    const remaining = items.filter((i) => i.versao_id !== versaoId)
    // Se a primeira máquina for removida, a nova primeira máquina dita o tipo
    if (items[0]?.versao_id === versaoId && remaining.length > 0) {
      const newFirstTipo = remaining[0]?.tipo_proposta?.trim() || ''
      if (newFirstTipo) {
        onChange(
          remaining.map((i, idx) => {
            if (idx === 0) return i
            const hasTipo = isMachineCompatibleWithExactTipo(i.versao_id, newFirstTipo)
            return {
              ...i,
              tipo_proposta: hasTipo ? newFirstTipo : i.tipo_proposta,
            }
          }),
        )
      } else {
        onChange(remaining)
      }
    } else {
      onChange(remaining)
    }

    if (onAcessoriosChange) {
      onAcessoriosChange(acessorios.filter((a) => a.versao_id !== versaoId))
    }
  }

  // Mapa de tipos de proposta disponíveis para cada máquina do pacote
  const [tiposPorVersao, setTiposPorVersao] = useState<Record<string, TipoProposta[]>>({})
  const [loadingTiposMap, setLoadingTiposMap] = useState<Record<string, boolean>>({})

  // Retorna os nomes de todos os tipos vinculados a uma máquina (versão)
  const getMachineTipoNomes = useCallback(
    (versaoId: string): string[] => {
      const cached = versaoTiposCache[versaoId]
      if (cached && cached.length > 0) return cached
      const fromTipos = tiposPorVersao[versaoId]
      if (fromTipos && fromTipos.length > 0) return fromTipos.map((t) => t.nome)
      const propV = versoes.find((v) => v.id === versaoId)
      if (propV?.tipos_proposta && propV.tipos_proposta.length > 0) {
        return propV.tipos_proposta
      }
      return []
    },
    [versaoTiposCache, tiposPorVersao, versoes],
  )

  // Tipo exato da primeira máquina (chave do pacote - Ponto 19 Filtro Fino)
  const pacoteTargetTipo = useMemo<string | null>(() => {
    if (items.length === 0) return null
    const firstItem = items[0]
    if (firstItem?.tipo_proposta && firstItem.tipo_proposta.trim().length > 0) {
      return firstItem.tipo_proposta.trim()
    }
    return null
  }, [items])

  // Verifica se uma máquina possui exatamente o tipo de proposta do pacote entre seus tipos vinculados
  const isMachineCompatibleWithExactTipo = useCallback(
    (versaoId: string, targetTipo: string | null): boolean => {
      if (!targetTipo) return true
      const tipos = getMachineTipoNomes(versaoId)
      // Se ainda não carregou os tipos da máquina, não bloqueia preventivamente
      if (tipos.length === 0) return true
      const targetNorm = targetTipo.toLowerCase().trim()
      return tipos.some((t) => t.toLowerCase().trim() === targetNorm)
    },
    [getMachineTipoNomes],
  )

  // Verifica se uma máquina tem pelo menos um tipo vinculado compatível com o grupo do pacote
  const isMachineCompatibleWithGroup = useCallback(
    (versaoId: string, targetGroup: ShippingGroup | null): boolean => {
      if (!targetGroup) return true
      const tipos = getMachineTipoNomes(versaoId)
      // Se ainda não carregou os tipos da máquina, assume compatível até carregar
      if (tipos.length === 0) return true
      return tipos.some((t) => getShippingGroupFromTipoNome(t) === targetGroup)
    },
    [getMachineTipoNomes],
  )

  // Retorna o grupo principal representativo da máquina (para exibição de avisos e labels)
  const getMachineShippingGroup = useCallback(
    (versaoId: string): ShippingGroup | null => {
      const tipos = getMachineTipoNomes(versaoId)
      if (tipos.length > 0) {
        return getShippingGroupFromTipoNome(tipos[0])
      }
      return null
    },
    [getMachineTipoNomes],
  )

  // Carrega tipos de proposta para cada máquina do pacote e sincroniza versaoTiposCache
  useEffect(() => {
    const versaoIds = Array.from(new Set(items.map((i) => i.versao_id).filter(Boolean)))
    versaoIds.forEach((vid) => {
      if (tiposPorVersao[vid] || loadingTiposMap[vid]) return

      setLoadingTiposMap((prev) => ({ ...prev, [vid]: true }))
      fetchTiposPropostaByVersaoId(vid, true)
        .then(async (list) => {
          const finalTipos =
            list && list.length > 0 ? list : await fetchTiposProposta(true).catch(() => [])
          setTiposPorVersao((prev) => ({ ...prev, [vid]: finalTipos }))
          setVersaoTiposCache((prev) => ({
            ...prev,
            [vid]: finalTipos.map((t) => t.nome),
          }))
        })
        .catch(async () => {
          const all = await fetchTiposProposta(true).catch(() => [])
          setTiposPorVersao((prev) => ({ ...prev, [vid]: all }))
          setVersaoTiposCache((prev) => ({
            ...prev,
            [vid]: all.map((t) => t.nome),
          }))
        })
        .finally(() => {
          setLoadingTiposMap((prev) => ({ ...prev, [vid]: false }))
        })
    })
  }, [items, tiposPorVersao, loadingTiposMap])

  // Ponto 19: Assegurar que qualquer máquina seguinte (idx > 0) receba o tipo herdado da primeira
  // caso possua o tipo vinculado e ainda esteja com o campo vazio
  useEffect(() => {
    if (items.length <= 1 || !pacoteTargetTipo) return
    let needsUpdate = false
    const updated = items.map((item, idx) => {
      if (idx === 0) return item
      const hasExact = isMachineCompatibleWithExactTipo(item.versao_id, pacoteTargetTipo)
      if (hasExact && item.tipo_proposta !== pacoteTargetTipo) {
        needsUpdate = true
        return { ...item, tipo_proposta: pacoteTargetTipo }
      }
      return item
    })
    if (needsUpdate) {
      onChange(updated)
    }
  }, [items, pacoteTargetTipo, versaoTiposCache, tiposPorVersao])

  // Ponto 18: Bloqueio rígido da adição de novas máquinas enquanto a primeira máquina
  // não tiver um tipo de proposta selecionado.
  const isAddBlocked = useMemo(() => {
    if (items.length === 0) return false
    const firstItem = items[0]
    return !firstItem?.tipo_proposta || firstItem.tipo_proposta.trim().length === 0
  }, [items])

  // Lista de máquinas adicionadas ao pacote que não possuem o tipo definido na primeira máquina
  const incompatibleItemsInPackage = useMemo(() => {
    if (!pacoteTargetTipo || items.length <= 1) return []
    return items.filter((item, idx) => {
      if (idx === 0) return false
      // Se ainda não tem tipo ou tipo diferente do alvo
      const itemTipo = item.tipo_proposta?.trim()
      const hasTipoLinked = isMachineCompatibleWithExactTipo(item.versao_id, pacoteTargetTipo)
      return !hasTipoLinked || (itemTipo && itemTipo !== pacoteTargetTipo)
    })
  }, [items, pacoteTargetTipo, versaoTiposCache, tiposPorVersao, versoes])

  // Grupo do pacote derivado exclusivamente do tipo de proposta selecionado na primeira máquina.
  // Conforme especificado pelo usuário: antes de adicionar a segunda máquina, deve-se selecionar
  // o tipo de proposta da primeira linha. Se a primeira máquina ainda não tiver tipo selecionado,
  // não aplica filtro de grupo (pacoteShippingGroup = null).
  const pacoteShippingGroup = useMemo<ShippingGroup | null>(() => {
    if (items.length === 0) return null
    const firstItem = items[0]
    if (firstItem.tipo_proposta && firstItem.tipo_proposta.trim().length > 0) {
      return getShippingGroupFromTipoNome(firstItem.tipo_proposta)
    }
    return null
  }, [items])

  // Pré-carrega tipos de proposta para os resultados de busca (para saber os shipping groups das opções)
  useEffect(() => {
    const candidateIds = searchResults.map((r) => r.id).filter((id) => id && !versaoTiposCache[id])

    if (candidateIds.length === 0) return

    candidateIds.forEach((vid) => {
      fetchTiposPropostaByVersaoId(vid, true)
        .then((list) => {
          if (list && list.length > 0) {
            setVersaoTiposCache((prev) => ({
              ...prev,
              [vid]: list.map((t) => t.nome),
            }))
          }
        })
        .catch(() => {})
    })
  }, [searchResults, versaoTiposCache])

  const updateItem = (versaoId: string, field: keyof PropostaVersaoItem, value: any) => {
    const isFirstItem = items[0]?.versao_id === versaoId
    if (field === 'tipo_proposta' && isFirstItem) {
      const newTipo = typeof value === 'string' ? value : ''
      onChange(
        items.map((i, idx) => {
          if (idx === 0) {
            return { ...i, tipo_proposta: newTipo }
          }
          // Para as máquinas seguintes: se tiver o novo tipo vinculado, herda automaticamente
          const hasNewTipo = isMachineCompatibleWithExactTipo(i.versao_id, newTipo)
          return {
            ...i,
            tipo_proposta: hasNewTipo ? newTipo : i.tipo_proposta,
          }
        }),
      )
      return
    }

    onChange(
      items.map((i) => {
        if (i.versao_id !== versaoId) return i
        if (field === 'desconto_percentual') {
          return { ...i, desconto_percentual: Number(value), desconto_valor: 0 }
        }
        return { ...i, [field]: value }
      }),
    )
  }

  const moveItem = (index: number, dir: -1 | 1) => {
    const ni = index + dir
    if (ni < 0 || ni >= items.length) return
    const arr = [...items]
    ;[arr[index], arr[ni]] = [arr[ni], arr[index]]
    // Se a primeira máquina mudou de posição, o tipo da nova primeira máquina vira a referência
    if (index === 0 || ni === 0) {
      const newFirstTipo = arr[0]?.tipo_proposta?.trim() || ''
      if (newFirstTipo) {
        const reevaluated = arr.map((i, idx) => {
          if (idx === 0) return i
          const hasTipo = isMachineCompatibleWithExactTipo(i.versao_id, newFirstTipo)
          return {
            ...i,
            tipo_proposta: hasTipo ? newFirstTipo : i.tipo_proposta,
          }
        })
        onChange(reevaluated)
        return
      }
    }
    onChange(arr)
  }

  const totalGeral = items.reduce((sum, i) => sum + calculateLineTotal(i), 0)
  const subtotalGeral = items.reduce((sum, i) => sum + calculateSubtotal(i), 0)

  // Enriquecer e filtrar resultados de busca excluindo máquinas que já estão nos itens do pacote.
  // Ponto 4 & 18: compatibilidade de grupo com badge "método diferente".
  // Ponto 19: filtro fino com tipo idêntico ao da primeira máquina. Se não tiver o tipo,
  // é bloqueada com badge "sem tipo do pacote" e mensagem explicativa.
  const enrichedSearchResults = useMemo(() => {
    const alreadySelectedIds = new Set(items.map((i) => i.versao_id))
    return searchResults
      .filter((v) => !alreadySelectedIds.has(v.id))
      .map((v) => {
        const marcaNome = v.modelos?.marcas?.nome || ''
        const modeloNome = v.modelos?.nome || ''
        const codErp = v.cod_erp || ''

        const subtitleParts: string[] = []
        if (marcaNome) subtitleParts.push(marcaNome)
        if (modeloNome) subtitleParts.push(modeloNome)
        if (codErp) subtitleParts.push(`ERP: ${codErp}`)
        const subtitle = subtitleParts.join(' • ')

        const machineGroup = getMachineShippingGroup(v.id)
        const isCompatibleGroup = isMachineCompatibleWithGroup(v.id, pacoteShippingGroup)
        const isCompatibleExact = isMachineCompatibleWithExactTipo(v.id, pacoteTargetTipo)

        const isGroupIncompatible = !!pacoteShippingGroup && !isCompatibleGroup
        const isExactIncompatible = !!pacoteTargetTipo && !isCompatibleExact
        const isIncompatible = isGroupIncompatible || isExactIncompatible

        return {
          ...v,
          _subtitle: subtitle,
          _machineGroup: machineGroup,
          _isGroupIncompatible: isGroupIncompatible,
          _isExactIncompatible: isExactIncompatible,
          _isIncompatible: isIncompatible,
        }
      })
  }, [
    searchResults,
    items,
    pacoteShippingGroup,
    pacoteTargetTipo,
    versaoTiposCache,
    tiposPorVersao,
    versoes,
  ])

  const selectedVersaoDisplay = useMemo(() => {
    if (selectedVersaoObj) return selectedVersaoObj
    if (selectedVersaoId) {
      const fromSearch = searchResults.find((v) => v.id === selectedVersaoId)
      if (fromSearch) return fromSearch
      const fromProps = versoes.find((v) => v.id === selectedVersaoId)
      if (fromProps) return fromProps
    }
    return null
  }, [selectedVersaoObj, selectedVersaoId, searchResults, versoes])

  const trimmedQuery = searchQuery.trim()
  const hasMinChars = trimmedQuery.length >= 2

  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Layers className="w-5 h-5 text-primary" />
          <h3 className="text-sm font-semibold">Equipamentos do Pacote</h3>
          {items.length > 0 && (
            <Badge variant="secondary" className="ml-auto">
              {items.length} {items.length === 1 ? 'equipamento' : 'equipamentos'}
            </Badge>
          )}
        </div>

        {!disabled && (
          <div className="space-y-1.5">
            <div className="flex gap-2 items-end">
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block">
                    Adicionar Equipamento
                  </Label>
                  {isAddBlocked && (
                    <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                      Selecione o tipo de proposta da máquina anterior para adicionar outra
                    </span>
                  )}
                </div>
                <Popover
                  open={comboboxOpen && !isAddBlocked}
                  onOpenChange={(open) => {
                    if (isAddBlocked) {
                      setComboboxOpen(false)
                      return
                    }
                    setComboboxOpen(open)
                  }}
                >
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      role="combobox"
                      aria-expanded={comboboxOpen}
                      disabled={disabled || isAddBlocked}
                      title={
                        isAddBlocked
                          ? 'Selecione o tipo de proposta da máquina anterior para adicionar outra'
                          : selectedVersaoDisplay
                            ? selectedVersaoDisplay.nome
                            : undefined
                      }
                      className={cn(
                        'w-full h-10 justify-between font-normal text-left px-3 text-sm rounded-md transition-colors',
                        'border border-input bg-background hover:bg-accent/40',
                        !selectedVersaoId && 'text-muted-foreground',
                        isAddBlocked &&
                          'opacity-60 cursor-not-allowed bg-muted/40 hover:bg-muted/40 text-muted-foreground border-amber-300 dark:border-amber-700/60',
                      )}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
                        <Search className="w-4 h-4 text-muted-foreground shrink-0" />
                        <span className="truncate">
                          {isAddBlocked
                            ? 'Bloqueado: selecione o tipo da máquina anterior...'
                            : selectedVersaoDisplay
                              ? selectedVersaoDisplay.nome
                              : 'Pesquisar máquina...'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {selectedVersaoId && !disabled && !isAddBlocked && (
                          <span
                            role="button"
                            tabIndex={0}
                            onClick={(e) => {
                              e.stopPropagation()
                              setSelectedVersaoId('')
                              setSelectedVersaoObj(null)
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.stopPropagation()
                                setSelectedVersaoId('')
                                setSelectedVersaoObj(null)
                              }
                            }}
                            className="rounded-sm hover:bg-muted p-0.5 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                            title="Limpar seleção"
                          >
                            <X className="w-3.5 h-3.5" />
                          </span>
                        )}
                        <ChevronsUpDown className="w-4 h-4 opacity-50 shrink-0" />
                      </div>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-[--radix-popover-trigger-width] max-w-[calc(100vw-2rem)] p-0"
                    align="start"
                    sideOffset={4}
                  >
                    <Command shouldFilter={false}>
                      <CommandInput
                        value={searchQuery}
                        onValueChange={setSearchQuery}
                        placeholder="Buscar por nome, modelo, marca ou ERP..."
                      />
                      {/* Altura contida (~10 itens visíveis com scroll suave) */}
                      <CommandList className="max-h-72 overflow-y-auto">
                        {!hasMinChars ? (
                          <div className="p-4 text-sm text-center text-muted-foreground flex flex-col items-center justify-center gap-1.5">
                            <Search className="w-4 h-4 opacity-40" />
                            <span>Digite pelo menos 2 caracteres para pesquisar máquinas...</span>
                          </div>
                        ) : isSearching ? (
                          <div className="p-4 text-sm text-center text-muted-foreground flex items-center justify-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin text-primary" />
                            <span>Pesquisando máquinas no catálogo...</span>
                          </div>
                        ) : enrichedSearchResults.length === 0 ? (
                          <CommandEmpty className="p-4 text-sm text-center text-muted-foreground">
                            Nenhuma máquina encontrada para &ldquo;{trimmedQuery}&rdquo;.
                          </CommandEmpty>
                        ) : (
                          enrichedSearchResults.map((v) => (
                            <CommandItem
                              key={v.id}
                              value={v.id}
                              onSelect={() => {
                                if (v._isExactIncompatible && pacoteTargetTipo) {
                                  toast({
                                    title: 'Tipo de proposta incompatível no pacote',
                                    description: `Esta máquina não possui o tipo de proposta selecionado neste pacote (${pacoteTargetTipo}). Cadastre o tipo na máquina ou remova-a do pacote.`,
                                    variant: 'destructive',
                                  })
                                  return
                                }
                                if (v._isGroupIncompatible && pacoteShippingGroup) {
                                  const machineGroup =
                                    v._machineGroup || getMachineShippingGroup(v.id) || 'outro'
                                  const machineLabel = getShippingGroupLabel(machineGroup)
                                  const pacoteLabel = getShippingGroupLabel(pacoteShippingGroup)
                                  toast({
                                    title: 'Tipo de fornecimento incompatível',
                                    description: `Esta máquina é ${machineLabel} e o pacote está configurado para fornecimento de ${pacoteLabel}. Pacotes só aceitam máquinas com o mesmo tipo de fornecimento.`,
                                    variant: 'destructive',
                                  })
                                  return
                                }
                                setSelectedVersaoId(v.id)
                                setSelectedVersaoObj({
                                  id: v.id,
                                  nome: v.nome,
                                  valor: v.valor,
                                })
                                setComboboxOpen(false)
                                setSearchQuery('')
                              }}
                              className={cn(
                                'cursor-pointer py-2 px-3 items-start gap-2',
                                v._isIncompatible && 'opacity-60 bg-muted/30 cursor-not-allowed',
                              )}
                            >
                              <Check
                                className={cn(
                                  'h-4 w-4 shrink-0 mt-0.5 text-primary',
                                  selectedVersaoId === v.id ? 'opacity-100' : 'opacity-0',
                                )}
                              />
                              <div className="flex flex-col min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span
                                    className="text-sm font-medium text-foreground truncate"
                                    title={v.nome}
                                  >
                                    {v.nome}
                                  </span>
                                  {v._isExactIncompatible && pacoteTargetTipo ? (
                                    <Badge
                                      variant="outline"
                                      className="text-[10px] px-1.5 py-0 h-4 border-destructive/60 text-destructive dark:text-red-400 dark:border-destructive/60 shrink-0 font-normal"
                                      title={`Não possui o tipo "${pacoteTargetTipo}"`}
                                    >
                                      sem tipo do pacote
                                    </Badge>
                                  ) : v._isGroupIncompatible ? (
                                    <Badge
                                      variant="outline"
                                      className="text-[10px] px-1.5 py-0 h-4 border-amber-400 text-amber-700 dark:text-amber-300 dark:border-amber-700 shrink-0 font-normal"
                                    >
                                      método diferente
                                    </Badge>
                                  ) : null}
                                </div>
                                {v._subtitle && (
                                  <span
                                    className="text-xs text-muted-foreground truncate mt-0.5"
                                    title={v._subtitle}
                                  >
                                    {v._subtitle}
                                  </span>
                                )}
                                {v._isExactIncompatible && pacoteTargetTipo && (
                                  <span className="text-[11px] text-destructive/80 dark:text-red-400 mt-0.5 leading-tight">
                                    Não possui o tipo &ldquo;{pacoteTargetTipo}&rdquo; cadastrado.
                                  </span>
                                )}
                              </div>
                              {v.valor != null && v.valor > 0 && (
                                <span className="text-xs font-semibold text-primary shrink-0 tabular-nums self-center">
                                  {fmtCurrency(v.valor)}
                                </span>
                              )}
                            </CommandItem>
                          ))
                        )}
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              <Button
                type="button"
                onClick={addMachine}
                disabled={!selectedVersaoId || isAddBlocked}
                className={cn(
                  'gap-1.5 h-10 shrink-0',
                  isAddBlocked && 'opacity-60 cursor-not-allowed',
                )}
                title={
                  isAddBlocked
                    ? 'Selecione o tipo de proposta da máquina anterior para adicionar outra'
                    : undefined
                }
              >
                <Plus className="w-4 h-4" />
                Adicionar
              </Button>
            </div>
            {isAddBlocked && (
              <div className="rounded-md bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
                Selecione o tipo de proposta da máquina anterior para adicionar outra
              </div>
            )}
            {incompatibleItemsInPackage.length > 0 && pacoteTargetTipo && (
              <div className="rounded-md bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 p-3 text-xs text-red-900 dark:text-red-200 space-y-1">
                <div className="font-semibold flex items-center gap-1.5">
                  <X className="w-4 h-4 text-destructive shrink-0" />
                  <span>Máquinas incompatíveis detectadas no pacote:</span>
                </div>
                <p className="leading-relaxed">
                  Esta máquina não possui o tipo de proposta selecionado neste pacote (
                  {pacoteTargetTipo}). Cadastre o tipo na máquina ou remova-a do pacote.
                </p>
                <ul className="list-disc list-inside space-y-0.5 pt-1 text-[11px] text-red-800 dark:text-red-300">
                  {incompatibleItemsInPackage.map((it) => (
                    <li key={it.versao_id}>
                      <span className="font-medium">{it.nome}</span> &mdash; não possui vínculo com
                      &ldquo;{pacoteTargetTipo}&rdquo;
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {items.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground border border-dashed rounded-lg">
            <Package className="w-8 h-8 mx-auto mb-2 opacity-40" />
            Nenhum equipamento adicionado. Selecione uma versão acima para começar.
          </div>
        ) : (
          <div className="space-y-2">
            <div className="hidden md:grid grid-cols-12 gap-2 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <div className="col-span-3">Equipamento</div>
              <div className="col-span-3">Tipo de Proposta desta máquina *</div>
              <div className="col-span-1 text-center">Qtd.</div>
              <div className="col-span-2 text-right">Valor Unit.</div>
              <div className="col-span-1 text-right">Desc.%</div>
              <div className="col-span-1 text-right">Total</div>
              <div className="col-span-1 text-center">Ações</div>
            </div>

            {items.map((item, idx) => {
              const versao = versoes.find((v) => v.id === item.versao_id)
              const total = calculateLineTotal(item)
              const tiposDisponiveis = tiposPorVersao[item.versao_id] || []
              const isLoadingTipos = loadingTiposMap[item.versao_id]

              // Acessórios associados a esta máquina específica
              const machineAcessorios = acessorios.filter((a) => a.versao_id === item.versao_id)
              const countAcessorios = machineAcessorios.length

              return (
                <div
                  key={item.versao_id}
                  id={`pacote-item-${item.versao_id}`}
                  className="rounded-lg border bg-slate-50/50 dark:bg-slate-900/50 p-2 space-y-3"
                >
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center">
                    <div className="md:col-span-3">
                      <div className="flex items-start gap-2">
                        <span className="text-xs font-bold text-muted-foreground mt-0.5">
                          {idx + 1}.
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start gap-1.5 flex-wrap">
                            <p
                              className="text-sm font-medium break-words leading-snug"
                              title={item.nome}
                            >
                              {item.nome}
                            </p>
                            {(versao?.status?.trim().toLowerCase() === 'inativo' ||
                              versao?.status?.trim().toLowerCase() === 'i') && (
                              <Badge
                                variant="secondary"
                                className="text-[10px] px-1.5 py-0 h-4 font-medium shrink-0 bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700 mt-0.5"
                              >
                                Inativo
                              </Badge>
                            )}
                          </div>
                          {versao?.modelos && (
                            <p
                              className="text-xs text-muted-foreground break-words mt-0.5"
                              title={versao.modelos.nome}
                            >
                              {versao.modelos.nome}
                            </p>
                          )}
                          {versao?.tem_estoque ? (
                            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium inline-block mt-0.5">
                              Estoque: {versao.estoque_disponivel || 1} un.
                            </span>
                          ) : (
                            <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium inline-block mt-0.5">
                              Sob encomenda
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Seletor Tipo de Proposta desta máquina */}
                    <div className="md:col-span-3">
                      <Label className="md:hidden text-xs text-muted-foreground block mb-1">
                        Tipo de Proposta desta máquina *
                      </Label>
                      {idx === 0 ? (
                        <Select
                          value={item.tipo_proposta || ''}
                          onValueChange={(val) => updateItem(item.versao_id, 'tipo_proposta', val)}
                          disabled={disabled || isLoadingTipos}
                        >
                          <SelectTrigger
                            className={cn(
                              'h-9 text-xs',
                              !item.tipo_proposta && 'border-amber-400 dark:border-amber-600',
                            )}
                          >
                            <SelectValue
                              placeholder={
                                isLoadingTipos
                                  ? 'Carregando tipos...'
                                  : tiposDisponiveis.length === 0
                                    ? 'Nenhum tipo disponível'
                                    : 'Selecione o tipo desta máquina...'
                              }
                            />
                          </SelectTrigger>
                          <SelectContent>
                            {tiposDisponiveis.map((t) => (
                              <SelectItem key={t.id} value={t.nome} className="text-xs">
                                {t.nome}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        /* Ponto 19 (Filtro Fino): Na segunda máquina em diante, o tipo é travado e herdado */
                        <div className="space-y-1">
                          <div
                            className={cn(
                              'h-9 px-3 rounded-md border text-xs flex items-center justify-between gap-1.5 transition-colors',
                              item.tipo_proposta && item.tipo_proposta === pacoteTargetTipo
                                ? 'bg-muted/50 border-input text-foreground cursor-not-allowed select-none'
                                : 'bg-destructive/10 border-destructive/60 text-destructive',
                            )}
                            title={
                              item.tipo_proposta && item.tipo_proposta === pacoteTargetTipo
                                ? `Tipo herdado da 1ª máquina: ${item.tipo_proposta}`
                                : `Incompatível: esta máquina não possui o tipo "${pacoteTargetTipo}"`
                            }
                          >
                            <span className="truncate font-medium">
                              {item.tipo_proposta || pacoteTargetTipo || 'Indefinido'}
                            </span>
                            <Badge
                              variant="secondary"
                              className={cn(
                                'text-[10px] px-1.5 py-0 h-4 shrink-0 font-normal inline-flex items-center gap-1',
                                item.tipo_proposta === pacoteTargetTipo
                                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                                  : 'bg-destructive/20 text-destructive border-destructive/30',
                              )}
                            >
                              <Layers className="w-2.5 h-2.5" />
                              herdado do pacote
                            </Badge>
                          </div>
                          {(!item.tipo_proposta || item.tipo_proposta !== pacoteTargetTipo) && (
                            <p className="text-[11px] text-destructive leading-tight">
                              Esta máquina não possui o tipo de proposta selecionado neste pacote (
                              {pacoteTargetTipo}). Cadastre o tipo na máquina ou remova-a do pacote.
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="md:col-span-1">
                      <Label className="md:hidden text-xs text-muted-foreground">Qtd</Label>
                      <Input
                        type="number"
                        min={1}
                        value={item.quantidade}
                        onChange={(e) =>
                          updateItem(
                            item.versao_id,
                            'quantidade',
                            Math.max(1, parseInt(e.target.value) || 1),
                          )
                        }
                        disabled={disabled}
                        className="md:text-center h-9 text-xs"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <Label className="md:hidden text-xs text-muted-foreground">
                        Valor Unitário
                      </Label>
                      <FormattedNumberInput
                        value={item.valor_unitario}
                        onChange={(v: number) => updateItem(item.versao_id, 'valor_unitario', v)}
                        disabled={disabled || precoEspecialAtivo}
                        className={cn(
                          'md:text-right h-9 text-xs',
                          precoEspecialAtivo && 'opacity-60 bg-muted cursor-not-allowed',
                        )}
                      />
                    </div>

                    <div className="md:col-span-1">
                      <Label className="md:hidden text-xs text-muted-foreground">Desc. %</Label>
                      <FormattedNumberInput
                        value={precoEspecialAtivo ? 0 : item.desconto_percentual || 0}
                        onChange={(v: number) =>
                          updateItem(item.versao_id, 'desconto_percentual', v)
                        }
                        disabled={disabled || precoEspecialAtivo}
                        suffix="%"
                        maxDecimals={2}
                        className={cn(
                          'h-9 text-xs',
                          precoEspecialAtivo && 'opacity-60 bg-muted cursor-not-allowed',
                        )}
                      />
                    </div>

                    <div className="md:col-span-1 text-right">
                      <Label className="md:hidden text-xs text-muted-foreground">Total</Label>
                      <span className="text-xs font-bold tabular-nums">{fmtCurrency(total)}</span>
                    </div>

                    <div className="md:col-span-1 flex items-center justify-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => moveItem(idx, -1)}
                        disabled={idx === 0}
                        className="h-7 w-7 p-0"
                      >
                        <ChevronUp className="w-4 h-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => moveItem(idx, 1)}
                        disabled={idx === items.length - 1}
                        className="h-7 w-7 p-0"
                      >
                        <ChevronDown className="w-4 h-4" />
                      </Button>
                      {!disabled && items.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeItem(item.versao_id)}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/50 h-7 w-7 p-0"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Seção individual de Acessórios para esta máquina */}
                  {onAcessoriosChange && (
                    <div className="pt-2 border-t border-dashed border-slate-200 dark:border-slate-800">
                      <div className="flex items-center gap-2 mb-2">
                        <Wrench className="w-3.5 h-3.5 text-primary" />
                        <span className="text-xs font-semibold text-foreground">
                          Acessórios de {item.nome}
                        </span>
                        {countAcessorios > 0 && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                            {countAcessorios} {countAcessorios === 1 ? 'acessório' : 'acessórios'}
                          </Badge>
                        )}
                      </div>
                      <PropostaAcessoriosSection
                        versaoId={item.versao_id}
                        currency={currency}
                        selectedAcessorios={machineAcessorios}
                        onChange={(newMachineAcessorios: SelectedAcessorio[]) => {
                          // Manter acessórios das outras máquinas intactos
                          const otherAcessorios = acessorios.filter(
                            (a) => a.versao_id !== item.versao_id,
                          )
                          const updatedMachineAcessorios = newMachineAcessorios.map((a) => ({
                            ...a,
                            versao_id: item.versao_id,
                          }))
                          onAcessoriosChange([...otherAcessorios, ...updatedMachineAcessorios])
                        }}
                        versaoNome={item.nome}
                        hideHeaderTitle={true}
                        precoEspecialAtivo={precoEspecialAtivo}
                      />
                    </div>
                  )}
                </div>
              )
            })}

            <div className="flex items-center justify-between pt-3 mt-2 border-t">
              <div className="flex flex-col">
                {subtotalGeral !== totalGeral && (
                  <span className="text-xs text-muted-foreground">
                    Subtotal: {fmtCurrency(subtotalGeral)}
                  </span>
                )}
                <span className="text-sm font-semibold text-muted-foreground">
                  Total dos Equipamentos
                </span>
              </div>
              <span className="text-lg font-bold text-primary tabular-nums">
                {fmtCurrency(totalGeral)}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
