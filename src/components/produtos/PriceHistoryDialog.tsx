import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDate } from '@/lib/format'
import { VersaoWithModelo } from '@/types/versao'
import { fetchAuditLogs, AuditLogEntry } from '@/services/audit-logs'

interface Props {
  versao: VersaoWithModelo | null
  open: boolean
  onOpenChange: (v: boolean) => void
}

export function PriceHistoryDialog({ versao, open, onOpenChange }: Props) {
  const [logs, setLogs] = useState<AuditLogEntry[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open || !versao) return
    setLoading(true)
    fetchAuditLogs({ tableName: 'versoes', recordId: versao.id })
      .then(({ data }) => setLogs(data ?? []))
      .catch(() => setLogs([]))
      .finally(() => setLoading(false))
  }, [open, versao])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Histórico de Preço — {versao?.nome}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="border rounded-lg p-3">
              <p className="text-xs text-muted-foreground">Valor Anterior</p>
              <p className="text-sm font-semibold mt-1">
                {versao?.valor_anterior != null
                  ? versao.valor_anterior.toLocaleString('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    })
                  : '—'}
              </p>
            </div>
            <div className="border rounded-lg p-3">
              <p className="text-xs text-muted-foreground">Último Reajuste</p>
              <p className="text-sm font-semibold mt-1">
                {formatDate(versao?.data_ultimo_reajuste)}
              </p>
            </div>
            <div className="border rounded-lg p-3">
              <p className="text-xs text-muted-foreground">Atualizado Por</p>
              <p className="text-sm font-semibold mt-1">{versao?.atualizado_por ?? '—'}</p>
            </div>
          </div>
          <div className="border rounded-lg overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ação</TableHead>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Alterações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={4}>
                      <Skeleton className="h-8 w-full" />
                    </TableCell>
                  </TableRow>
                ) : logs.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="text-center text-xs text-muted-foreground py-4"
                    >
                      Nenhum registro.
                    </TableCell>
                  </TableRow>
                ) : (
                  logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>
                        <Badge variant="secondary">{log.action}</Badge>
                      </TableCell>
                      <TableCell className="text-xs">{log.user_name ?? '—'}</TableCell>
                      <TableCell className="text-xs font-mono">
                        {log.created_at ? new Date(log.created_at).toLocaleString('pt-BR') : '—'}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {log.data_changes
                          ? JSON.stringify(log.data_changes).slice(0, 80) + '...'
                          : '—'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
