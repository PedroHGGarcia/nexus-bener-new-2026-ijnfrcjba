import { useState, useEffect, useCallback } from 'react'
import { fetchImportHistory, type ImportHistoryEntry } from '@/services/import-history'
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

export default function HistoricoImportacoesPage() {
  const [imports, setImports] = useState<ImportHistoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const loadImports = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const data = await fetchImportHistory()
      setImports(data)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadImports()
  }, [loadImports])

  const statusVariant = (status: string | null) => {
    if (!status) return 'secondary' as const
    if (status.toLowerCase().includes('conclu')) return 'default' as const
    if (status.toLowerCase().includes('falh') || status.toLowerCase().includes('erro'))
      return 'destructive' as const
    return 'secondary' as const
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Histórico de Importações de Dados</h1>
        <p className="text-sm text-muted-foreground">Registro de todas as importações realizadas</p>
      </div>

      {loading ? (
        <LoadingState count={5} />
      ) : error ? (
        <ErrorState message="Erro ao carregar histórico de importações." onRetry={loadImports} />
      ) : imports.length === 0 ? (
        <EmptyState
          title="Nenhuma importação encontrada"
          description="Não há registros de importações no sistema."
        />
      ) : (
        <div className="border rounded-lg bg-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo</TableHead>
                <TableHead>Arquivo</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Importados</TableHead>
                <TableHead>Erros</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Usuário</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {imports.map((imp) => (
                <TableRow key={imp.id}>
                  <TableCell className="text-xs font-semibold">{imp.tipo || '—'}</TableCell>
                  <TableCell className="font-mono text-xs">{imp.arquivo || '—'}</TableCell>
                  <TableCell className="text-xs">
                    {new Date(imp.created_at).toLocaleString('pt-BR')}
                  </TableCell>
                  <TableCell className="text-xs">{imp.registros_importados ?? 0}</TableCell>
                  <TableCell className="text-xs">
                    {imp.registros_erro != null && imp.registros_erro > 0 ? (
                      <span className="text-destructive font-semibold">{imp.registros_erro}</span>
                    ) : (
                      '0'
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(imp.status)}>{imp.status || '—'}</Badge>
                  </TableCell>
                  <TableCell className="text-xs">{imp.usuario || '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
