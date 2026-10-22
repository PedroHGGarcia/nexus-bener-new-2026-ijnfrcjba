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
import { Skeleton } from '@/components/ui/skeleton'
import { Check, ChevronsUpDown, X, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface SearchableComboboxOption {
  value: string
  label: string
}

interface Props {
  value: string | null
  onChange: (value: string | null) => void
  placeholder?: string
  searchPlaceholder?: string
  fetchOptions: (
    query: string,
    page: number,
  ) => Promise<{ items: SearchableComboboxOption[]; hasMore: boolean }>
  disabled?: boolean
}

export function SearchableCombobox({
  value,
  onChange,
  placeholder = 'Selecionar...',
  searchPlaceholder = 'Buscar...',
  fetchOptions,
  disabled,
}: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [options, setOptions] = useState<SearchableComboboxOption[]>([])
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
    const timer = setTimeout(() => loadOptions(query, 1, false), 300)
    return () => clearTimeout(timer)
  }, [query, open, loadOptions])

  const [selectedLabelFallback, setSelectedLabelFallback] = useState<string | null>(null)

  const selected = options.find((o) => o.value === value)

  // Keep fallback label when option was found so it doesn't blink out when reopening
  useEffect(() => {
    if (selected) {
      setSelectedLabelFallback(selected.label)
    } else if (!value) {
      setSelectedLabelFallback(null)
    }
  }, [selected, value])

  const handleScroll = () => {
    const el = listRef.current
    if (!el || loading || !hasMore) return
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 50) {
      const next = page + 1
      setPage(next)
      loadOptions(query, next, true)
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          disabled={disabled}
          className={cn('w-full justify-between font-normal', !selected && 'text-muted-foreground')}
        >
          <span className="truncate">
            {selected ? selected.label : selectedLabelFallback || placeholder}
            {loading && <Loader2 className="w-3 h-3 inline ml-1 animate-spin" />}
          </span>
          <div className="flex items-center gap-1 shrink-0">
            {value && !disabled && (
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation()
                  setSelectedLabelFallback(null)
                  onChange(null)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.stopPropagation()
                    onChange(null)
                  }
                }}
                className="rounded-sm hover:bg-accent p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </span>
            )}
            <ChevronsUpDown className="w-4 h-4 opacity-50 shrink-0" />
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
              <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>
            ) : (
              options.map((opt) => (
                <CommandItem
                  key={opt.value}
                  value={opt.value}
                  onSelect={() => {
                    onChange(opt.value)
                    setOpen(false)
                  }}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      value === opt.value ? 'opacity-100' : 'opacity-0',
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
