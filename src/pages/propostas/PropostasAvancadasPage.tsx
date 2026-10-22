import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Eye } from 'lucide-react'
import { LoadingState, EmptyState, ErrorState } from '@/components/StateViews'
import { formatDate } from '@/lib/format'
import { fetchPropostas } from '@/services/propostas'
import { PropostaWithRelations, STATUS_LABELS } from '@/types/proposta'

export default function PropostasAvancadasPage() {
  const navigate = useNavigate()
  const [data, setData] = useState<PropostaWithRelations[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [clientSearch, setClientSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('Todos')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [minValue, setMinValue] = useState('')
  const [maxValue, setMaxValue] = useState('')

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      setData(await fetchPropostas())
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const filtered = data.filter((p) => {
    const matchesClient =
      !clientSearch ||
      (p.clientes?.fantasia || p.cliente_original || '')
        .toLowerCase()
        .includes(clientSearch.toLowerCase())
    const matchesStatus = statusFilter === 'Todos' || p.status === statusFilter
    const created = p.created_at ? new Date(p.created_at) : null
    const matchesDateFrom = !dateFrom || (created && created >= new Date(dateFrom))
    const matchesDateTo = !dateTo || (created && created <= new Date(dateTo + 'T23:59:59'))
    const val = p.valor_final || 0
    const matchesMin = !minValue || val >= parseFloat(minValue)
    const matchesMax = !maxValue || val <= parseFloat(maxValue)
    return (
      matchesClient && matchesStatus && matchesDateFrom && matchesDateTo && matchesMin && matchesMax
    )
  })

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Busca Avançada de Propostas</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <Label className="text-xs">Cliente</Label>
          <Input
            placeholder="Nome do cliente..."
            value={clientSearch}
            onChange={(e) => setClientSearch(e.target.value)}
          />
        </div>
        <div>
          <Label className="text-xs">Status</Label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Todos">Todos</SelectItem>
              <SelectItem value="Em Analise">Em Análise</SelectItem>
              <SelectItem value="Aprovada">Aprovada</SelectItem>
              <SelectItem value="Rejeitada">Rejeitada</SelectItem>
              <SelectItem value="Validada">Validada</SelectItem>
              <SelectItem value="Excluida">Excluída</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Data Inicial</Label>
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">Data Final</Label>
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">Valor Mínimo</Label>
          <Input
            type="number"
            placeholder="0,00"
            value={minValue}
            onChange={(e) => setMinValue(e.target.value)}
          />
        </div>
        <div>
          <Label className="text-xs">Valor Máximo</Label>
          <Input
            type="number"
            placeholder="0,00"
            value={maxValue}
            onChange={(e) => setMaxValue(e.target.value)}
          />
        </div>
      </div>
      {loading ? (
        <LoadingState count={5} />
      ) : error ? (
        <ErrorState message="Erro ao carregar propostas" onRetry={loadData} />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="Nenhuma proposta encontrada"
          description="Ajuste os filtros para encontrar propostas."
        />
      ) : (
        <div className="border rounded-lg bg-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[170px] whitespace-nowrap">Nº Oferta</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Data</TableHead>
                <TableHead className="text-right">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-bold text-primary min-w-[160px]">
                    <span className="font-mono text-xs sm:text-sm font-semibold tracking-tight break-all text-slate-900 dark:text-slate-100 select-all">
                      {p.numero_proposta || '—'}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs">
                    {p.clientes?.fantasia || p.cliente_original || '—'}
                  </TableCell>
                  <TableCell className="text-xs">{p.tipo_proposta || '—'}</TableCell>
                  <TableCell className="font-semibold">
                    R$ {(p.valor_final || 0).toLocaleString('pt-BR')}
                  </TableCell>
                  <TableCell>
                    <Badge>{STATUS_LABELS[p.status] || p.status}</Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDate(p.created_at)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => navigate(`/controle-propostas/proposta-pdf/${p.id}`)}
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="p-2 text-xs text-muted-foreground text-right">
            {filtered.length} resultado(s)
          </div>
        </div>
      )}
    </div>
  )
}
