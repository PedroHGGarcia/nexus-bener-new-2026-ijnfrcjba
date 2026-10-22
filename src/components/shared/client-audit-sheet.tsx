import { useState, useEffect } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { fetchAuditLogs, type AuditLogEntry } from '@/services/audit-logs'

interface Props {
  open: boolean
  onOpenChange: (o: boolean) => void
  clientId: string
  clientName?: string
}
export function ClientAuditSheet({ open, onOpenChange, clientId, clientName }: Props) {
  const [logs, setLogs] = useState<AuditLogEntry[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open || !clientId) return
    setLoading(true)
    fetchAuditLogs({ tableName: 'clientes', recordId: clientId })
      .then(({ data }) => setLogs(data ?? []))
      .catch(() => setLogs([]))
      .finally(() => setLoading(false))
  }, [open, clientId])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Histórico de Auditoria</SheetTitle>
          {clientName && <p className="text-sm text-muted-foreground">{clientName}</p>}
        </SheetHeader>
        <div className="mt-4">
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : logs.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">
              Nenhum registro de auditoria encontrado.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Ação</TableHead>
                  <TableHead className="text-xs">Usuário</TableHead>
                  <TableHead className="text-xs">Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      <Badge variant="secondary" className="text-[10px]">
                        {log.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">{log.user_name ?? '—'}</TableCell>
                    <TableCell className="text-xs font-mono">
                      {log.created_at ? new Date(log.created_at).toLocaleString('pt-BR') : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
