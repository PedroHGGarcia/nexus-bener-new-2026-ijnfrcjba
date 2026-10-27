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
  sublabel?: string
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
  className?: string
  popoverClassName?: string
}

export function SearchableCombobox({
  value,
  onChange,
  placeholder = 'Selecionar...',
  searchPlaceholder = 'Buscar...',
  fetchOptions,
  disabled,
  className,
  popoverClassName,
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
          title={selected ? selected.label : selectedLabelFallback || placeholder}
          className={cn(
            'w-full justify-between font-normal text-left h-10 px-3',
            !selected && 'text-muted-foreground',
            className,
          )}
        >
          <span className="truncate flex-1 min-w-0 pr-2">
            {selected ? selected.label : selectedLabelFallback || placeholder}
            {loading && <Loader2 className="w-3 h-3 inline ml-1.5 animate-spin" />}
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
      <PopoverContent
        className={cn(
          'p-0 z-50 w-[max(var(--radix-popover-trigger-width),380px)] min-w-[min(100vw-2rem,360px)] sm:min-w-[460px] max-w-[94vw] shadow-lg border-slate-200 dark:border-slate-800',
          popoverClassName,
        )}
        align="start"
      >
        <Command shouldFilter={false}>
          <CommandInput value={query} onValueChange={setQuery} placeholder={searchPlaceholder} />
          <CommandList ref={listRef} onScroll={handleScroll} className="max-h-72 overflow-y-auto">
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
                  title={opt.label}
                  className="py-2.5 px-3 cursor-pointer flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800/60 last:border-b-0 hover:bg-accent/70"
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <Check
                      className={cn(
                        'h-4 w-4 shrink-0 text-primary',
                        value === opt.value ? 'opacity-100' : 'opacity-0',
                      )}
                    />
                    <div className="flex flex-col min-w-0 flex-1">
                      <span
                        className="text-xs sm:text-sm font-medium text-foreground truncate whitespace-nowrap block"
                        title={opt.label}
                      >
                        {opt.label}
                      </span>
                      {opt.sublabel && (
                        <span className="text-[11px] text-muted-foreground truncate whitespace-nowrap block">
                          {opt.sublabel}
                        </span>
                      )}
                    </div>
                  </div>
                </CommandItem>
              ))
            )}
            {loading && options.length > 0 && (
              <div className="p-2 text-center text-xs text-muted-foreground flex items-center justify-center gap-1.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin inline" />
                <span>Carregando mais opções...</span>
              </div>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
