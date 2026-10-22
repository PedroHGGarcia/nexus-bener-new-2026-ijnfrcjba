import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { TableHead } from '@/components/ui/table'
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Eye,
  EyeOff,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export const DEFAULT_PAGE_SIZE = 20

export const PAGE_SIZE_OPTIONS = [20, 25, 50, 100]

interface PaginationProps {
  page: number
  pageSize: number
  total: number
  onPageChange: (p: number) => void
  onPageSizeChange: (s: number) => void
  pageSizeOptions?: number[]
  itemLabel?: string
}

export function PaginationBar({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = PAGE_SIZE_OPTIONS,
  itemLabel = 'itens',
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const safePage = Math.min(Math.max(1, page), totalPages)
  const start = total === 0 ? 0 : (safePage - 1) * pageSize + 1
  const end = Math.min(safePage * pageSize, total)
  return (
    <div className="flex items-center justify-between flex-wrap gap-3 py-3 border-t bg-muted/10 px-2 rounded-b-lg">
      <div className="text-sm text-muted-foreground">
        Mostrando <strong className="text-foreground">{start}</strong> a{' '}
        <strong className="text-foreground">{end}</strong> de{' '}
        <strong className="text-foreground">{total}</strong> {itemLabel}
        <span className="mx-2 text-muted-foreground/60">|</span>
        Página <strong className="text-foreground">{safePage}</strong> de{' '}
        <strong className="text-foreground">{totalPages}</strong>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span>Itens por página:</span>
          <Select value={String(pageSize)} onValueChange={(v) => onPageSizeChange(Number(v))}>
            <SelectTrigger className="w-[110px] h-9 text-xs font-medium">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {pageSizeOptions.map((s) => (
                <SelectItem key={s} value={String(s)}>
                  {s} / página
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            className="h-9 px-2.5 text-xs gap-1 font-medium"
            disabled={safePage <= 1}
            onClick={() => onPageChange(1)}
            title="Primeira página"
          >
            <ChevronsLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Primeira</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-9 px-2.5 text-xs gap-1 font-medium"
            disabled={safePage <= 1}
            onClick={() => onPageChange(safePage - 1)}
            title="Página anterior"
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Anterior</span>
          </Button>
          <span className="text-xs px-2 font-semibold tabular-nums">
            {safePage} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="h-9 px-2.5 text-xs gap-1 font-medium"
            disabled={safePage >= totalPages}
            onClick={() => onPageChange(safePage + 1)}
            title="Próxima página"
          >
            <span className="hidden sm:inline">Próxima</span>
            <ChevronRight className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-9 px-2.5 text-xs gap-1 font-medium"
            disabled={safePage >= totalPages}
            onClick={() => onPageChange(totalPages)}
            title="Última página"
          >
            <span className="hidden sm:inline">Última</span>
            <ChevronsRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

interface SortableHeadProps {
  label: string
  column: string
  currentSort: string | null
  currentDir: 'asc' | 'desc' | null
  onSort: (col: string) => void
}
export function SortableHead({
  label,
  column,
  currentSort,
  currentDir,
  onSort,
}: SortableHeadProps) {
  const isActive = currentSort === column
  return (
    <TableHead
      className="cursor-pointer select-none hover:bg-accent/50 transition-colors"
      onClick={() => onSort(column)}
    >
      <div className="flex items-center gap-1.5">
        {label}
        {isActive ? (
          currentDir === 'asc' ? (
            <ArrowUp className="w-3.5 h-3.5" />
          ) : (
            <ArrowDown className="w-3.5 h-3.5" />
          )
        ) : (
          <ArrowUpDown className="w-3 h-3 opacity-40" />
        )}
      </div>
    </TableHead>
  )
}

export interface ColumnDef {
  key: string
  label: string
  visible: boolean
}
interface ColVisProps {
  columns: ColumnDef[]
  onToggle: (key: string) => void
  onReset: () => void
}
export function ColumnVisibilityDropdown({ columns, onToggle, onReset }: ColVisProps) {
  const [open, setOpen] = useState(false)
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Eye className="w-4 h-4" /> Colunas
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel className="text-xs">Visibilidade das Colunas</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {columns.map((col) => (
          <DropdownMenuItem
            key={col.key}
            onClick={() => onToggle(col.key)}
            className="cursor-pointer gap-2"
          >
            {col.visible ? (
              <Eye className="w-3.5 h-3.5" />
            ) : (
              <EyeOff className="w-3.5 h-3.5 text-muted-foreground" />
            )}
            <span className={cn(!col.visible && 'text-muted-foreground')}>{col.label}</span>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onReset} className="text-xs text-muted-foreground">
          Restaurar padrão
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
