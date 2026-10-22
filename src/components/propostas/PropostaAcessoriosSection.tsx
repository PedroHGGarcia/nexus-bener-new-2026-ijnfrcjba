import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Command,
  CommandInput,
  CommandList,
  CommandItem,
  CommandEmpty,
} from '@/components/ui/command'
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@/components/ui/select'
import { ListFilter, Loader2, X, Plus, Minus, Search, ChevronUp, ChevronDown } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { Acessorio } from '@/types/acessorio'
import { cn } from '@/lib/utils'
import { calculateLineTotal } from '@/lib/proposta-calculations'

type InclusaoType = 'preco' | 'opcional'

export interface SelectedAcessorio {
  id: string
  nome: string
  valor: number
  moeda: string
  inclusao?: InclusaoType
  quantidade?: number
  desconto_percentual?: number
  desconto_valor?: number
  versao_id?: string
}

interface Props {
  versaoId: string | null
  currency: string
  selectedAcessorios: SelectedAcessorio[]
  onChange: (items: SelectedAcessorio[]) => void
  versaoNome?: string
  hideHeaderTitle?: boolean
  precoEspecialAtivo?: boolean
}

export function PropostaAcessoriosSection({
  versaoId,
  currency,
  selectedAcessorios,
  onChange,
  versaoNome,
  hideHeaderTitle,
  precoEspecialAtivo,
}: Props) {
  const [acessorios, setAcessorios] = useState<Acessorio[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!versaoId) {
      setAcessorios([])
      return
    }
    setLoading(true)
    supabase
      .from('acessorio_versoes')
      .select('acessorio_id, acessorios(*)')
      .eq('versao_id', versaoId)
      .then(({ data, error }) => {
        setLoading(false)
        if (!error && data) {
          // Each join row carries its single linked acessorio (the FK is
          // many-to-one from acessorio_versoes → acessorios). Defensive:
          // handle both object and array shapes from the nested select.
          const rows = data as Array<{
            acessorio_id: string
            acessorios: Acessorio | Acessorio[] | null
          }>
          const items: Acessorio[] = rows
            .map((r) => {
              const a = r.acessorios
              return Array.isArray(a) ? a[0] : a
            })
            .filter((a): a is Acessorio => !!a && (a.status ?? 'Ativo') === 'Ativo')
          // Dedupe (duplicate join rows are possible) and sort by name.
          const seen = new Set<string>()
          const deduped = items.filter((a) => {
            if (seen.has(a.id)) return false
            seen.add(a.id)
            return true
          })
          deduped.sort((a, b) => a.nome.localeCompare(b.nome))
          setAcessorios(deduped)
        } else {
          setAcessorios([])
        }
      })
  }, [versaoId])

  const isSameItem = (
    sel: SelectedAcessorio,
    candidate: { id: string; cod_erp?: string | null },
  ) => {
    if (sel.id === candidate.id) return true
    if (
      candidate.cod_erp &&
      (sel as unknown as { cod_erp?: string }).cod_erp === candidate.cod_erp
    ) {
      return true
    }
    return false
  }

  const available = acessorios.filter((a) => !selectedAcessorios.some((s) => isSameItem(s, a)))

  const addAcessorio = (item: Acessorio) => {
    // Prevent duplicate accessory insertion by id / cod_erp
    const alreadyExists = selectedAcessorios.some((s) => isSameItem(s, item))
    if (alreadyExists) {
      setOpen(false)
      return
    }

    onChange([
      ...selectedAcessorios,
      {
        id: item.id,
        nome: item.nome,
        valor: item.valor || 0,
        moeda: item.moeda || currency,
        inclusao: 'preco',
        quantidade: 1,
        desconto_percentual: 0,
        desconto_valor: 0,
        versao_id: versaoId || undefined,
      },
    ])
    setOpen(false)
  }

  const removeAcessorio = (id: string) => onChange(selectedAcessorios.filter((a) => a.id !== id))

  const updateInclusao = (id: string, inclusao: InclusaoType) =>
    onChange(selectedAcessorios.map((a) => (a.id === id ? { ...a, inclusao } : a)))

  const updateQty = (id: string, delta: number) =>
    onChange(
      selectedAcessorios.map((a) =>
        a.id === id ? { ...a, quantidade: Math.max(1, (a.quantidade || 1) + delta) } : a,
      ),
    )

  const updateField = (id: string, field: keyof SelectedAcessorio, value: number) =>
    onChange(selectedAcessorios.map((a) => (a.id === id ? { ...a, [field]: value } : a)))

  const moveItem = (index: number, dir: -1 | 1) => {
    const ni = index + dir
    if (ni < 0 || ni >= selectedAcessorios.length) return
    const arr = [...selectedAcessorios]
    ;[arr[index], arr[ni]] = [arr[ni], arr[index]]
    onChange(arr)
  }

  const fmt = (val: number, moeda?: string | null) => {
    const c = moeda || currency
    if (c === 'USD') return `US$ ${val.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
    if (c === 'EUR') return `€ ${val.toLocaleString('de-DE', { minimumFractionDigits: 2 })}`
    return `R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
  }

  return (
    <div className="space-y-3">
      {!hideHeaderTitle && (
        <div className="flex items-center gap-2 text-base font-semibold text-primary">
          <ListFilter className="w-5 h-5" />
          Acessórios {versaoNome ? `— ${versaoNome}` : ''}
        </div>
      )}

      {!versaoId ? (
        <Card className="border-dashed bg-slate-50/50 dark:bg-slate-900/50">
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            Selecione uma versão para visualizar os acessórios disponíveis.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-4 space-y-3">
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className="w-full justify-between font-normal"
                  disabled={loading || available.length === 0}
                >
                  <span className="flex items-center gap-2">
                    <Search className="w-4 h-4 text-muted-foreground" />
                    {loading
                      ? 'Carregando acessórios...'
                      : available.length === 0
                        ? 'Todos os acessórios já foram adicionados'
                        : 'Buscar e adicionar acessório...'}
                  </span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Digite para buscar acessório..." />
                  <CommandList className="max-h-60">
                    <CommandEmpty>Nenhum acessório encontrado.</CommandEmpty>
                    {available.map((item) => (
                      <CommandItem
                        key={item.id}
                        value={item.nome}
                        onSelect={() => addAcessorio(item)}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className="text-sm">{item.nome}</span>
                          <span className="text-xs font-semibold text-muted-foreground">
                            {fmt(item.valor || 0, item.moeda)}
                          </span>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>

            {selectedAcessorios.length > 0 ? (
              <div className="space-y-2 pt-2 border-t">
                {selectedAcessorios.map((item, idx) => {
                  const itemKey = item.id || `acessorio-${idx}`
                  const total = calculateLineTotal({
                    quantidade: item.quantidade || 1,
                    valor_unitario: item.valor || 0,
                    desconto_percentual: item.desconto_percentual,
                    desconto_valor: item.desconto_valor,
                  })
                  const isIncluso = (item.inclusao ?? 'preco') === 'preco'
                  return (
                    <div
                      key={itemKey}
                      className={cn(
                        'flex flex-col gap-2 p-3 rounded-lg border text-sm transition-colors',
                        isIncluso
                          ? 'border-primary/30 bg-primary/5'
                          : 'border-input bg-slate-50/50 dark:bg-slate-900/50',
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-start gap-2 min-w-0 flex-1">
                          <span className="text-xs font-bold text-muted-foreground mt-0.5 shrink-0">
                            {idx + 1}.
                          </span>
                          <span className="font-medium break-words min-w-0" title={item.nome}>
                            {item.nome}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => moveItem(idx, -1)}
                            disabled={idx === 0}
                            className="h-6 w-6 p-0"
                          >
                            <ChevronUp className="w-3 h-3" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => moveItem(idx, 1)}
                            disabled={idx === selectedAcessorios.length - 1}
                            className="h-6 w-6 p-0"
                          >
                            <ChevronDown className="w-3 h-3" />
                          </Button>
                          <button
                            type="button"
                            onClick={() => removeAcessorio(item.id)}
                            className="text-muted-foreground hover:text-destructive shrink-0 ml-1"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-wrap">
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => updateQty(item.id, -1)}
                          >
                            <Minus className="w-3 h-3" />
                          </Button>
                          <span className="w-8 text-center font-semibold tabular-nums">
                            {item.quantidade || 1}
                          </span>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => updateQty(item.id, 1)}
                          >
                            <Plus className="w-3 h-3" />
                          </Button>
                        </div>
                        <Select
                          value={item.inclusao ?? 'preco'}
                          onValueChange={(v) => updateInclusao(item.id, v as InclusaoType)}
                        >
                          <SelectTrigger className="h-7 text-xs w-[120px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="preco">No preço</SelectItem>
                            <SelectItem value="opcional">Opcional</SelectItem>
                          </SelectContent>
                        </Select>
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-muted-foreground">Desc.%:</span>
                          <input
                            type="number"
                            min={0}
                            value={precoEspecialAtivo ? 0 : item.desconto_percentual || 0}
                            onChange={(e) =>
                              updateField(
                                item.id,
                                'desconto_percentual',
                                parseFloat(e.target.value) || 0,
                              )
                            }
                            disabled={precoEspecialAtivo}
                            className={cn(
                              'w-14 h-7 px-1 text-xs border rounded text-right',
                              precoEspecialAtivo && 'opacity-60 bg-muted cursor-not-allowed',
                            )}
                          />
                        </div>
                        <Badge variant="secondary" className="text-xs ml-auto">
                          {fmt(total, item.moeda)}
                        </Badge>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground text-center py-2">
                Nenhum acessório adicionado. Use a busca acima para adicionar.
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
