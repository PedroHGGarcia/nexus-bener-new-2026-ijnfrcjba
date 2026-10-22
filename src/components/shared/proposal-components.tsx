import { formatDate, formatCurrencyByMoeda } from '@/lib/format'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Calculator, History } from 'lucide-react'

export interface CalcStep {
  label: string
  value: number
  detail?: string
}
interface MemoriaProps {
  steps: CalcStep[]
  result: number
  currency?: string
}
export function MemoriaCalculo({ steps, result, currency = 'BRL' }: MemoriaProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <Calculator className="w-4 h-4" /> Memória de Cálculo
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {steps.map((step, i) => (
          <div
            key={i}
            className="flex items-center justify-between text-sm border-b border-border/50 pb-1.5"
          >
            <div>
              <span className="font-medium">{step.label}</span>
              {step.detail && (
                <span className="text-xs text-muted-foreground ml-2">{step.detail}</span>
              )}
            </div>
            <span className="font-mono text-xs">{formatCurrencyByMoeda(step.value, currency)}</span>
          </div>
        ))}
        <div className="flex items-center justify-between pt-2">
          <span className="font-bold text-sm">Resultado Final</span>
          <span className="font-bold text-primary text-lg font-mono">
            {formatCurrencyByMoeda(result, currency)}
          </span>
        </div>
      </CardContent>
    </Card>
  )
}

export interface ProposalHistoryEntry {
  status: string
  date: string | null
  user: string | null
}
interface HistoryProps {
  entries: ProposalHistoryEntry[]
}
export function ProposalHistory({ entries }: HistoryProps) {
  if (!entries.length)
    return (
      <p className="text-sm text-muted-foreground text-center py-4">Sem histórico de alterações.</p>
    )
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <History className="w-4 h-4" /> Histórico de Status
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative pl-6 space-y-4">
          <div className="absolute left-2 top-2 bottom-2 w-0.5 bg-border" />
          {entries.map((entry, i) => (
            <div key={i} className="relative">
              <div
                className={`absolute -left-4 w-3 h-3 rounded-full border-2 border-background ${i === 0 ? 'bg-primary' : 'bg-muted-foreground'}`}
              />
              <div className="flex items-center gap-2">
                <Badge variant={i === 0 ? 'default' : 'secondary'} className="text-xs">
                  {entry.status}
                </Badge>
                <span className="text-xs text-muted-foreground">{entry.user ?? 'Sistema'}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {entry.date ? formatDate(entry.date) : '—'}
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
