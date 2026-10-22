import { useState, useEffect, useCallback, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Pie, PieChart, Cell } from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { LoadingState, ErrorState, EmptyState } from '@/components/StateViews'
import { fetchPropostas } from '@/services/propostas'
import { fetchRepresentantes } from '@/services/representantes'
import { useRealtime } from '@/hooks/use-realtime'
import { PropostaWithRelations, STATUS_LABELS } from '@/types/proposta'
import { Representante } from '@/types/representante'
import { formatCurrency } from '@/lib/format'

const PIE_COLORS = ['#3b82f6', '#10b981', '#ef4444', '#f59e0b', '#6b7280']

const barConfig = {
  total: { label: 'Propostas', color: 'hsl(var(--primary))' },
} satisfies ChartConfig
const pieConfig = { value: { label: 'Propostas' } } satisfies ChartConfig

export default function PropostasDashboardPage() {
  const [propostas, setPropostas] = useState<PropostaWithRelations[]>([])
  const [representantes, setRepresentantes] = useState<Representante[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const [props, reps] = await Promise.all([fetchPropostas(), fetchRepresentantes()])
      setPropostas(props)
      setRepresentantes(reps)
    } catch (e) {
      setError(true)
      setErrorMsg(e instanceof Error ? e.message : 'Erro desconhecido')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])
  useRealtime(['propostas', 'representantes'], loadData)

  const monthlyData = useMemo(() => {
    const now = new Date()
    const months: { mes: string; total: number }[] = []
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const label = d.toLocaleDateString('pt-BR', { month: 'short' })
      const count = propostas.filter((p) => {
        if (!p.created_at) return false
        const pd = new Date(p.created_at)
        return pd.getFullYear() === d.getFullYear() && pd.getMonth() === d.getMonth()
      }).length
      months.push({ mes: label, total: count })
    }
    return months
  }, [propostas])

  const statusData = useMemo(
    () =>
      Object.keys(STATUS_LABELS)
        .map((s) => ({
          status: STATUS_LABELS[s],
          total: propostas.filter((p) => p.status === s).length,
        }))
        .filter((s) => s.total > 0),
    [propostas],
  )

  const kpis = useMemo(() => {
    const valid = propostas.filter((p) => p.status !== 'Excluida')
    const totalValue = valid.reduce((acc, p) => acc + (p.valor_final || 0), 0)
    const avgDiscount =
      valid.length > 0
        ? valid.reduce((acc, p) => acc + (p.percentual_desconto || 0), 0) / valid.length
        : 0
    const approved = valid.filter((p) => p.status === 'Aprovada').length
    const approvalRate = valid.length > 0 ? (approved / valid.length) * 100 : 0
    return { totalValue, avgDiscount, approvalRate }
  }, [propostas])

  const topReps = useMemo(() => {
    const counts = new Map<string, number>()
    propostas.forEach((p) => {
      if (p.representante) {
        counts.set(p.representante, (counts.get(p.representante) ?? 0) + 1)
      }
    })
    return Array.from(counts.entries())
      .map(([id, count]) => {
        const rep = representantes.find((r) => r.id === id)
        return { id, nome: rep?.fantasia ?? 'N/A', sigla: rep?.sigla ?? '', count }
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
  }, [propostas, representantes])

  if (loading) return <LoadingState count={4} />
  if (error) return <ErrorState message={errorMsg} onRetry={loadData} />
  if (propostas.length === 0) {
    return (
      <EmptyState
        title="Nenhuma proposta encontrada"
        description="Não há propostas cadastradas no momento."
      />
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-2xl font-bold">Métricas & Dashboard de Propostas</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Valor Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{formatCurrency(kpis.totalValue)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Desconto Médio</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{kpis.avgDiscount.toFixed(2)}%</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Taxa de Aprovação</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">
              {kpis.approvalRate.toFixed(1)}%
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Propostas por Mês (12 meses)</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={barConfig} className="h-[300px] w-full">
              <BarChart data={monthlyData}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="mes" tickLine={false} axisLine={false} className="text-xs" />
                <YAxis tickLine={false} axisLine={false} allowDecimals={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="total" fill="var(--color-total)" radius={4} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Distribuição por Status</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={pieConfig} className="h-[300px] w-full">
              <PieChart>
                <Pie
                  data={statusData}
                  dataKey="total"
                  nameKey="status"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label
                >
                  {statusData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <ChartTooltip content={<ChartTooltipContent />} />
              </PieChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Top Representantes</CardTitle>
          <CardDescription>Ranking por número de propostas vinculadas</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {topReps.map((rep, i) => (
              <div
                key={rep.id}
                className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/40 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">
                    {i + 1}
                  </span>
                  <div>
                    <span className="text-sm font-medium">{rep.nome}</span>
                    {rep.sigla && (
                      <span className="text-xs text-muted-foreground ml-2">{rep.sigla}</span>
                    )}
                  </div>
                </div>
                <span className="text-sm font-bold">{rep.count}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
