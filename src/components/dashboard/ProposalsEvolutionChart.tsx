import { useState, useCallback, useEffect } from 'react'
import { Line, LineChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { fetchMonthlyProposalsData, type MonthlyProposalData } from '@/services/dashboard'
import { formatCurrency } from '@/lib/format'
import { FolderOpen } from 'lucide-react'

type Metric = 'count' | 'value'

export function ProposalsEvolutionChart({ userId }: { userId?: string }) {
  const [data, setData] = useState<MonthlyProposalData[]>([])
  const [loading, setLoading] = useState(true)
  const [metric, setMetric] = useState<Metric>('count')

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      setData(await fetchMonthlyProposalsData(userId))
    } catch {
      setData([])
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    loadData()
  }, [loadData])

  const chartData = data.map((d) => ({
    monthLabel: d.monthLabel,
    count: d.count,
    value: d.totalValue,
  }))

  const chartConfig: ChartConfig = {
    count: { label: 'Quantidade', color: 'hsl(var(--primary))' },
    value: { label: 'Valor', color: 'hsl(var(--primary))' },
  }

  const formatYAxis = (v: number) => {
    if (metric === 'value') {
      if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`
      if (v >= 1_000) return `R$ ${(v / 1_000).toFixed(0)}k`
      return `R$ ${v}`
    }
    return String(v)
  }

  return (
    <Card className="shadow-sm border-border">
      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3">
        <div>
          <CardTitle className="text-base font-bold">Evolução de Propostas por Mês</CardTitle>
          <p className="text-xs text-muted-foreground">
            Acompanhamento mensal de propostas criadas
          </p>
        </div>
        <ToggleGroup
          type="single"
          value={metric}
          onValueChange={(v) => v && setMetric(v as Metric)}
          className="self-start"
        >
          <ToggleGroupItem value="count" className="text-xs">
            Quantidade
          </ToggleGroupItem>
          <ToggleGroupItem value="value" className="text-xs">
            Valor
          </ToggleGroupItem>
        </ToggleGroup>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-[200px] w-full" />
        ) : data.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <FolderOpen className="w-8 h-8 text-muted-foreground/50 mb-2" />
            <p className="text-sm text-muted-foreground">Nenhuma proposta encontrada no período</p>
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="h-[200px] w-full">
            <LineChart data={chartData} margin={{ left: 4, right: 12, top: 8 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis
                dataKey="monthLabel"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                className="text-xs"
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                width={70}
                className="text-xs"
                tickFormatter={formatYAxis}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value: number) =>
                      metric === 'value' ? formatCurrency(value) : `${value} propostas`
                    }
                  />
                }
              />
              <Line
                type="monotone"
                dataKey={metric}
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={{ r: 4, fill: 'hsl(var(--primary))', strokeWidth: 0 }}
                activeDot={{ r: 6, fill: 'hsl(var(--primary))', strokeWidth: 0 }}
              />
            </LineChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}
