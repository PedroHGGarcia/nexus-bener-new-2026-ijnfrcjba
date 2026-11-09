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
        <div className="border rounded-lg bg-card overflow-x-auto shadow-sm">
          <Table className="w-full table-fixed">
            <colgroup>
              <col className="w-[180px]" />
              <col className="w-[32%]" />
              <col className="w-[18%]" />
              <col className="w-[130px]" />
              <col className="w-[110px]" />
              <col className="w-[95px]" />
              <col className="w-[50px]" />
            </colgroup>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="whitespace-nowrap py-3 px-3">Nº Oferta</TableHead>
                <TableHead className="py-3 px-3">Cliente</TableHead>
                <TableHead className="py-3 px-3">Tipo</TableHead>
                <TableHead className="py-3 px-3 whitespace-nowrap">Valor</TableHead>
                <TableHead className="py-3 px-3 whitespace-nowrap">Status</TableHead>
                <TableHead className="py-3 px-3 whitespace-nowrap">Data</TableHead>
                <TableHead className="text-right py-3 px-3 whitespace-nowrap">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p) => {
                const clienteNome = p.clientes?.fantasia || p.cliente_original || '—'
                return (
                  <TableRow key={p.id}>
                    <TableCell className="font-bold text-primary py-2.5 px-3">
                      <span
                        className="font-mono text-xs font-semibold tracking-tight truncate block text-slate-900 dark:text-slate-100 select-all"
                        title={p.numero_proposta || undefined}
                      >
                        {p.numero_proposta || '—'}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs py-2.5 px-3 truncate" title={clienteNome}>
                      {clienteNome}
                    </TableCell>
                    <TableCell
                      className="text-xs py-2.5 px-3 truncate"
                      title={p.tipo_proposta || undefined}
                    >
                      {p.tipo_proposta || '—'}
                    </TableCell>
                    <TableCell className="font-semibold text-xs sm:text-sm py-2.5 px-3 whitespace-nowrap">
                      R$ {(p.valor_final || 0).toLocaleString('pt-BR')}
                    </TableCell>
                    <TableCell className="py-2.5 px-3 whitespace-nowrap">
                      <Badge variant="outline" className="text-xs">
                        {STATUS_LABELS[p.status] || p.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground py-2.5 px-3 whitespace-nowrap">
                      {formatDate(p.created_at)}
                    </TableCell>
                    <TableCell className="text-right py-2.5 px-3 whitespace-nowrap">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => navigate(`/controle-propostas/proposta-pdf/${p.id}`)}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
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
