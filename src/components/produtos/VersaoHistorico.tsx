import { useState, useEffect } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { LoadingState, EmptyState, ErrorState } from '@/components/StateViews'
import { fetchVersaoHistorico } from '@/services/versoes'
import { VersaoHistorico as HistoricoType } from '@/types/versao'

interface Props {
  versaoId?: string | null
}

export function VersaoHistorico({ versaoId }: Props) {
  const [data, setData] = useState<HistoricoType[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!versaoId) {
      setData([])
      return
    }
    setLoading(true)
    setError(false)
    fetchVersaoHistorico(versaoId)
      .then(setData)
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [versaoId])

  if (!versaoId) {
    return (
      <EmptyState
        title="Nenhuma versão selecionada"
        description="Selecione uma versão na aba Registros para visualizar o histórico de alterações."
      />
    )
  }

  if (loading) return <LoadingState count={4} />
  if (error) return <ErrorState message="Erro ao carregar histórico" />
  if (data.length === 0) {
    return (
      <EmptyState
        title="Sem histórico"
        description="Nenhuma alteração registrada para esta versão."
      />
    )
  }

  return (
    <div className="border rounded-lg bg-card overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Ação</TableHead>
            <TableHead>Usuário</TableHead>
            <TableHead>Data/Hora</TableHead>
            <TableHead>Detalhes</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((log) => (
            <TableRow key={log.id}>
              <TableCell>
                <Badge variant={log.acao === 'Criação' ? 'default' : 'secondary'}>{log.acao}</Badge>
              </TableCell>
              <TableCell className="text-xs">{log.usuario}</TableCell>
              <TableCell className="text-xs font-mono">
                {log.created_at ? new Date(log.created_at).toLocaleString('pt-BR') : '—'}
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">{log.detalhes}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
