import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Search, Loader2 } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { LoadingState, EmptyState, ErrorState } from '@/components/StateViews'
import { PropostaWithRelations, STATUS_LABELS } from '@/types/proposta'
import { fetchEligiblePropostas, linkPropostasToProject } from '@/services/projetos'
import { formatCurrency } from '@/lib/format'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  projetoId: string
  onLinked: () => void
}

export function VincularPropostaDialog({ open, onOpenChange, projetoId, onLinked }: Props) {
  const [propostas, setPropostas] = useState<PropostaWithRelations[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [linking, setLinking] = useState(false)

  const loadPropostas = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const data = await fetchEligiblePropostas()
      setPropostas(data)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open) {
      setSelectedIds(new Set())
      setSearch('')
      loadPropostas()
    }
  }, [open, loadPropostas])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    if (!q) return propostas
    return propostas.filter((p) => {
      const numero = (p.numero_proposta ?? '').toLowerCase()
      const cliente = (p.clientes?.fantasia ?? '').toLowerCase()
      return numero.includes(q) || cliente.includes(q)
    })
  }, [propostas, search])

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleLink = async () => {
    if (selectedIds.size === 0) return
    setLinking(true)
    try {
      await linkPropostasToProject(projetoId, Array.from(selectedIds))
      toast({ title: 'Proposta(s) vinculada(s) com sucesso' })
      onOpenChange(false)
      onLinked()
    } catch (err) {
      toast({
        title: 'Erro ao vincular propostas',
        description: err instanceof Error ? err.message : 'Erro desconhecido',
        variant: 'destructive',
      })
    } finally {
      setLinking(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Vincular Propostas</DialogTitle>
        </DialogHeader>

        <div className="relative mb-4">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            placeholder="Buscar por número ou cliente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {loading ? (
          <LoadingState count={3} />
        ) : error ? (
          <ErrorState message="Erro ao carregar propostas disponíveis" onRetry={loadPropostas} />
        ) : filtered.length === 0 ? (
          <EmptyState
            title="Nenhuma proposta disponível para vincular"
            description="Não há propostas elegíveis no momento."
          />
        ) : (
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {filtered.map((p) => (
              <label
                key={p.id}
                className="flex items-center gap-3 p-3 border rounded-md hover:bg-accent/50 cursor-pointer transition-colors"
              >
                <Checkbox
                  checked={selectedIds.has(p.id)}
                  onCheckedChange={() => toggleSelection(p.id)}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{p.numero_proposta ?? '—'}</span>
                    <Badge variant="outline" className="text-xs">
                      {STATUS_LABELS[p.status] ?? p.status}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                    <span>{p.clientes?.fantasia ?? '—'}</span>
                    <span>{p.versoes?.nome ?? '—'}</span>
                    <span>{formatCurrency(p.valor_final)}</span>
                  </div>
                </div>
              </label>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleLink}
            disabled={selectedIds.size === 0 || linking}
            className="bg-primary"
          >
            {linking && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
            Vincular
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
