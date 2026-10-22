import { Card, CardContent } from '@/components/ui/card'
import { FileText, DollarSign, Clock } from 'lucide-react'
import { PropostaWithRelations } from '@/types/proposta'
import { formatCurrencyByMoeda, formatDateTime } from '@/lib/format'

interface Props {
  propostas: PropostaWithRelations[]
  createdAt: string | null
  updatedAt: string | null
}

export function ProjectStats({ propostas, createdAt, updatedAt }: Props) {
  const propostaCount = propostas.length
  const valorTotal = propostas.reduce((sum, p) => sum + (p.valor_final ?? p.valor_atual ?? 0), 0)
  const moeda = propostas[0]?.moeda ?? 'BRL'

  const recentProposalDate = propostas[0]?.created_at
  const dates = [recentProposalDate, updatedAt, createdAt].filter(Boolean) as string[]
  const recentDate = dates.sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0]

  const recentDesc =
    recentProposalDate && (!updatedAt || new Date(recentProposalDate) >= new Date(updatedAt))
      ? 'Proposta adicionada'
      : updatedAt && (!createdAt || new Date(updatedAt) > new Date(createdAt))
        ? 'Projeto atualizado'
        : 'Projeto criado'

  const stats = [
    { label: 'Propostas', value: propostaCount.toString(), icon: FileText, sub: '' },
    {
      label: 'Valor Total',
      value: formatCurrencyByMoeda(valorTotal, moeda),
      icon: DollarSign,
      sub: '',
    },
    {
      label: 'Atividade Recente',
      value: recentDesc,
      icon: Clock,
      sub: recentDate ? formatDateTime(recentDate) : '—',
    },
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {stats.map((s) => (
        <Card key={s.label}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <s.icon className="w-5 h-5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="text-sm font-bold truncate">{s.value}</p>
              {s.sub && <p className="text-xs text-muted-foreground">{s.sub}</p>}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
