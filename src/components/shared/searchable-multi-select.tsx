import { useState, useEffect, useCallback, useRef } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Command,
  CommandInput,
  CommandList,
  CommandItem,
  CommandEmpty,
} from '@/components/ui/command'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Check, ChevronsUpDown, X, Loader2, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface MultiSelectOption {
  value: string
  label: string
}

interface MultiSelectProps {
  values: string[]
  onChange: (values: string[]) => void
  placeholder?: string
  searchPlaceholder?: string
  fetchOptions: (
    query: string,
    page: number,
  ) => Promise<{ items: MultiSelectOption[]; hasMore: boolean }>
}

export function SearchableMultiSelect({
  values,
  onChange,
  placeholder = 'Selecionar...',
  searchPlaceholder = 'Buscar...',
  fetchOptions,
}: MultiSelectProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [options, setOptions] = useState<MultiSelectOption[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)

  const loadOptions = useCallback(
    async (q: string, p: number, append: boolean) => {
      setLoading(true)
      try {
        const res = await fetchOptions(q, p)
        setOptions((prev) => (append ? [...prev, ...res.items] : res.items))
        setHasMore(res.hasMore)
      } catch {
        setOptions([])
        setHasMore(false)
      } finally {
        setLoading(false)
      }
    },
    [fetchOptions],
  )

  useEffect(() => {
    if (open) {
      setPage(1)
      setQuery('')
      loadOptions('', 1, false)
    }
  }, [open, loadOptions])
  useEffect(() => {
    if (!open) return
    const t = setTimeout(() => loadOptions(query, 1, false), 300)
    return () => clearTimeout(t)
  }, [query, open, loadOptions])

  const handleScroll = () => {
    const el = listRef.current
    if (!el || loading || !hasMore) return
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 50) {
      const next = page + 1
      setPage(next)
      loadOptions(query, next, true)
    }
  }

  const selectedLabels = options.filter((o) => values.includes(o.value))
  const toggle = (val: string) => {
    onChange(values.includes(val) ? values.filter((v) => v !== val) : [...values, val])
  }
  const remove = (val: string, e: React.MouseEvent) => {
    e.stopPropagation()
    onChange(values.filter((v) => v !== val))
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          className="w-full justify-between font-normal h-auto min-h-10"
        >
          <div className="flex flex-wrap gap-1 items-center py-1">
            {selectedLabels.length === 0 ? (
              <span className="text-muted-foreground">{placeholder}</span>
            ) : (
              selectedLabels.map((s) => (
                <Badge key={s.value} variant="secondary" className="gap-1">
                  {s.label}
                  <X className="w-3 h-3 cursor-pointer" onClick={(e) => remove(s.value, e)} />
                </Badge>
              ))
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {values.length > 0 && (
              <X
                className="w-3.5 h-3.5 cursor-pointer opacity-50"
                onClick={(e) => {
                  e.stopPropagation()
                  onChange([])
                }}
              />
            )}
            <ChevronsUpDown className="w-4 h-4 opacity-50" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput value={query} onValueChange={setQuery} placeholder={searchPlaceholder} />
          <CommandList ref={listRef} onScroll={handleScroll} className="max-h-60">
            {loading && options.length === 0 ? (
              <div className="p-2 space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            ) : options.length === 0 ? (
              <CommandEmpty>Nenhum resultado.</CommandEmpty>
            ) : (
              options.map((opt) => (
                <CommandItem key={opt.value} value={opt.value} onSelect={() => toggle(opt.value)}>
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      values.includes(opt.value) ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                  {opt.label}
                </CommandItem>
              ))
            )}
            {loading && options.length > 0 && (
              <div className="p-2 text-center">
                <Loader2 className="w-4 h-4 animate-spin inline" />
              </div>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

interface RelationProps {
  values: string[]
  onChange: (ids: string[]) => void
  tableName: string
  labelColumn?: string
  filter?: Record<string, unknown>
  placeholder?: string
}

export function MultiSelectRelation({
  values,
  onChange,
  tableName,
  labelColumn = 'nome',
  filter,
  placeholder,
}: RelationProps) {
  const fetchOpts = useCallback(
    async (
      query: string,
      _page: number,
    ): Promise<{ items: MultiSelectOption[]; hasMore: boolean }> => {
      const { supabase } = await import('@/lib/supabase/client')
      let q = (supabase as any)
        .from(tableName)
        .select(`id, ${labelColumn}`)
        .ilike(labelColumn, `%${query}%`)
        .limit(20)
      if (filter)
        Object.entries(filter).forEach(([k, v]) => {
          if (Array.isArray(v)) {
            q = q.in(k, v)
          } else {
            q = q.eq(k, v as string)
          }
        })
      const { data, error } = await q
      if (error || !data) return { items: [], hasMore: false }
      return {
        items: (data as any[]).map((r: Record<string, unknown>) => ({
          value: r.id as string,
          label: (r[labelColumn] as string) || '',
        })),
        hasMore: false,
      }
    },
    [tableName, labelColumn, filter],
  )

  return (
    <SearchableMultiSelect
      values={values}
      onChange={onChange}
      fetchOptions={fetchOpts}
      placeholder={placeholder ?? 'Selecionar relacionados...'}
    />
  )
}
