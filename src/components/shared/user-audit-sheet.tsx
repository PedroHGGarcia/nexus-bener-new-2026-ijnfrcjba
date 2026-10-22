import { useState, useEffect } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Download } from 'lucide-react'
import { fetchAuditLogs, type AuditLogEntry } from '@/services/audit-logs'
import {
  formatAuditAction,
  formatAuditTable,
  formatAuditChanges,
  summarizeAuditChanges,
  getActionBadgeVariant,
  exportAuditLogsToCSV,
} from '@/lib/audit-utils'

interface Props {
  open: boolean
  onOpenChange: (o: boolean) => void
  userName: string
}

/** Sheet reutilizável mostrando os últimos logs de auditoria de um usuário. */
export function UserAuditSheet({ open, onOpenChange, userName }: Props) {
  const [logs, setLogs] = useState<AuditLogEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [viewMode, setViewMode] = useState<'summary' | 'technical'>('summary')

  useEffect(() => {
    if (!open || !userName) return
    setLoading(true)
    fetchAuditLogs({ userName })
      .then(({ data }) => setLogs(data ?? []))
      .catch(() => setLogs([]))
      .finally(() => setLoading(false))
  }, [open, userName])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pr-6">
            <div>
              <SheetTitle>Atividade de {userName}</SheetTitle>
              <p className="text-sm text-muted-foreground">
                Últimos registros de auditoria deste usuário
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Tabs
                value={viewMode}
                onValueChange={(val) => setViewMode(val as 'summary' | 'technical')}
                className="w-full sm:w-auto"
              >
                <TabsList className="grid w-full grid-cols-2 h-9">
                  <TabsTrigger value="summary" className="text-xs px-3">
                    Resumido
                  </TabsTrigger>
                  <TabsTrigger value="technical" className="text-xs px-3">
                    Técnico
                  </TabsTrigger>
                </TabsList>
              </Tabs>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 h-9"
                disabled={loading || logs.length === 0}
                onClick={() => exportAuditLogsToCSV(logs, userName, viewMode)}
              >
                <Download className="w-4 h-4" /> Exportar
              </Button>
            </div>
          </div>
        </SheetHeader>

        <div className="mt-4">
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : logs.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">
              Nenhuma atividade registrada para este usuário.
            </p>
          ) : viewMode === 'summary' ? (
            /* Modo Resumido (Padrão): Ação (Resumo), Tabela, Data/Hora */
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Ação</TableHead>
                  <TableHead className="text-xs">Tabela</TableHead>
                  <TableHead className="text-xs whitespace-nowrap">Data/Hora</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => {
                  const summary = summarizeAuditChanges(log)
                  return (
                    <TableRow key={log.id}>
                      <TableCell className="text-xs font-medium text-foreground max-w-xs">
                        {summary}
                      </TableCell>
                      <TableCell className="text-xs whitespace-nowrap">
                        {formatAuditTable(log.table_name)}
                      </TableCell>
                      <TableCell className="text-xs font-mono text-muted-foreground whitespace-nowrap">
                        {log.created_at ? new Date(log.created_at).toLocaleString('pt-BR') : '—'}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          ) : (
            /* Modo Técnico: Ação (Badge), Tabela, Data/Hora, Alterações (JSON) */
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Ação</TableHead>
                  <TableHead className="text-xs">Tabela</TableHead>
                  <TableHead className="text-xs whitespace-nowrap">Data/Hora</TableHead>
                  <TableHead className="text-xs">Alterações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => {
                  const changesText = formatAuditChanges(log.data_changes)
                  const truncated =
                    changesText.length > 150 ? changesText.slice(0, 150) + '…' : changesText
                  const badgeInfo = getActionBadgeVariant(log.action)
                  return (
                    <TableRow key={log.id}>
                      <TableCell>
                        <Badge className={`text-[10px] uppercase ${badgeInfo.className}`}>
                          {formatAuditAction(log.action)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs whitespace-nowrap font-medium">
                        {formatAuditTable(log.table_name)}
                      </TableCell>
                      <TableCell className="text-xs font-mono text-muted-foreground whitespace-nowrap">
                        {log.created_at ? new Date(log.created_at).toLocaleString('pt-BR') : '—'}
                      </TableCell>
                      <TableCell className="text-xs font-mono text-muted-foreground max-w-xs truncate">
                        {truncated}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
