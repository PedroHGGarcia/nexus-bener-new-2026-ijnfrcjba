import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { useNavigate } from 'react-router-dom'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
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
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Cell, Pie, PieChart, Label } from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import {
  Users,
  FileText,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Search,
  ArrowUpDown,
  UserX,
  Trophy,
  BarChart3,
  PieChart as PieChartIcon,
  Eye,
  AlertTriangle,
  RefreshCw,
  Clock,
  Download,
} from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { isAdminRole } from '@/components/RoleGuard'
import { formatCurrency, formatDate } from '@/lib/format'
import {
  fetchMeusVendedores,
  fetchGerentesAtivos,
  fetchTodosGerentesConsolidado,
  VendedorResumo,
  GrupoGerenteVendedores,
} from '@/services/gerentes'
import { Gerente } from '@/types/gerente'
import { supabase } from '@/lib/supabase/client'
import { STATUS_LABELS } from '@/types/proposta'
import { cn } from '@/lib/utils'
import { fetchAuditLogs, type AuditLogEntry } from '@/services/audit-logs'
import {
  formatAuditAction,
  formatAuditTable,
  formatAuditChanges,
  summarizeAuditChanges,
  getActionBadgeVariant,
  exportAuditLogsToCSV,
} from '@/lib/audit-utils'

// ---- Helpers de exibição (mesmo padrão da PropostasCriadasPage) ----
const statusVariant = (s: string) =>
  s === 'Aprovada' || s === 'Validada'
    ? 'default'
    : s === 'Rejeitada' || s === 'Excluida'
      ? 'destructive'
      : 'secondary'

const displayNumero = (numero: string | null, revisao: string | null): string => {
  if (!numero) return '—'
  if (!revisao) return numero
  if (numero.endsWith(`-${revisao}`)) return numero
  return `${numero}-${revisao}`
}

type PropostaSimples = {
  id: string
  numero_proposta: string | null
  revisao: string | null
  cliente_original: string | null
  clientes: { fantasia: string | null } | null
  status: string
  valor_final: number | null
  created_at: string | null
}

// ---- Sheet: propostas de um vendedor ----
function VendedorPropostasSheet({
  vendedor,
  onOpenChange,
}: {
  vendedor: VendedorResumo | null
  onOpenChange: (open: boolean) => void
}) {
  const navigate = useNavigate()
  const [propostas, setPropostas] = useState<PropostaSimples[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  const handleVisualizarProposta = (propostaId: string) => {
    onOpenChange(false)
    navigate(`/controle-propostas/proposta-pdf/${propostaId}`)
  }

  const load = useCallback(async () => {
    if (!vendedor) return
    setLoading(true)
    setError(false)
    try {
      // O vendedor pode ser um representante (propostas.representante = vendedor.id)
      // ou um usuário do sistema (propostas.user = vendedor.id ou vendedor.userId)
      let query = supabase
        .from('propostas')
        .select(
          'id, numero_proposta, revisao, cliente_original, clientes(fantasia), status, valor_final, created_at',
        )

      if (vendedor.tipo === 'representante') {
        query = query.eq('representante', vendedor.id)
      } else if (vendedor.tipo === 'usuario') {
        const uId = vendedor.userId || vendedor.id
        query = query.or(`user.eq.${uId},representante.eq.${vendedor.id}`)
      } else {
        // Fallback genérico: tenta bater por representante OU por user
        const uId = vendedor.userId || vendedor.id
        query = query.or(`representante.eq.${vendedor.id},user.eq.${uId}`)
      }

      const { data, error: err } = await query.order('created_at', { ascending: false })
      if (err) throw new Error(err.message)
      setPropostas((data ?? []) as PropostaSimples[])
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [vendedor])

  useEffect(() => {
    if (vendedor) load()
    else setPropostas([])
  }, [vendedor, load])

  return (
    <Sheet open={!!vendedor} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader className="space-y-2 pr-6">
          <SheetTitle>Propostas de {vendedor?.fantasia}</SheetTitle>
          <SheetDescription>Histórico de propostas emitidas por este vendedor</SheetDescription>
        </SheetHeader>

        <div className="mt-4">
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <p className="text-sm text-muted-foreground">
                Ocorreu um erro ao carregar as propostas.
              </p>
              <Button variant="outline" size="sm" className="mt-3 gap-1.5" onClick={load}>
                <RefreshCw className="w-3.5 h-3.5" /> Tentar novamente
              </Button>
            </div>
          ) : propostas.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-10">
              Nenhuma proposta encontrada para este vendedor.
            </p>
          ) : (
            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Número</TableHead>
                    <TableHead className="text-xs">Cliente</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs text-right">Valor Final</TableHead>
                    <TableHead className="text-xs">Data</TableHead>
                    <TableHead className="text-xs text-right w-16">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {propostas.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="text-xs font-bold text-primary">
                        {displayNumero(p.numero_proposta, p.revisao)}
                      </TableCell>
                      <TableCell className="text-xs">
                        {p.clientes?.fantasia || p.cliente_original || '—'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(p.status)}>
                          {STATUS_LABELS[p.status] || p.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs font-semibold text-right">
                        {formatCurrency(p.valor_final)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDate(p.created_at)}
                      </TableCell>
                      <TableCell className="text-right">
                        <TooltipProvider delayDuration={200}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-primary hover:bg-primary/10"
                                onClick={() => handleVisualizarProposta(p.id)}
                                aria-label="Visualizar proposta"
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="left">
                              <p>Visualizar proposta</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

// ---- Sheet: atividades (logs de auditoria) de um vendedor ----
// Espelha a estrutura do UserAuditSheet (src/components/shared/user-audit-sheet.tsx),
// mas filtra por actor_id = vendedor.userId em vez de por nome.
function VendedorAtividadesSheet({
  vendedor,
  onOpenChange,
}: {
  vendedor: VendedorResumo | null
  onOpenChange: (open: boolean) => void
}) {
  const [logs, setLogs] = useState<AuditLogEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [viewMode, setViewMode] = useState<'summary' | 'technical'>('summary')

  const load = useCallback(async () => {
    if (!vendedor?.userId) {
      setLogs([])
      return
    }
    setLoading(true)
    setError(false)
    try {
      const { data, error: err } = await fetchAuditLogs({ userId: vendedor.userId })
      if (err) throw new Error(err)
      setLogs(data ?? [])
    } catch {
      setError(true)
      setLogs([])
    } finally {
      setLoading(false)
    }
  }, [vendedor?.userId])

  useEffect(() => {
    if (vendedor?.userId) load()
    else setLogs([])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendedor?.userId])

  return (
    <Sheet open={!!vendedor} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pr-6">
            <div>
              <SheetTitle>Atividades de {vendedor?.fantasia}</SheetTitle>
              <SheetDescription>Últimos registros de auditoria deste vendedor</SheetDescription>
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
                onClick={() =>
                  exportAuditLogsToCSV(logs, vendedor?.fantasia ?? 'vendedor', viewMode)
                }
              >
                <Download className="w-4 h-4" /> Exportar
              </Button>
            </div>
          </div>
        </SheetHeader>

        <div className="mt-4">
          {!vendedor?.userId ? (
            <p className="text-center text-sm text-muted-foreground py-10">
              Este vendedor não possui usuário vinculado.
            </p>
          ) : loading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <p className="text-sm text-muted-foreground">
                Ocorreu um erro ao carregar as atividades.
              </p>
              <Button variant="outline" size="sm" className="mt-3 gap-1.5" onClick={load}>
                <RefreshCw className="w-3.5 h-3.5" /> Tentar novamente
              </Button>
            </div>
          ) : logs.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-10">
              Nenhuma atividade encontrada.
            </p>
          ) : viewMode === 'summary' ? (
            /* Modo Resumido (Padrão): Ação (Resumo), Tabela, Data/Hora */
            <div className="border rounded-lg overflow-x-auto">
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
            </div>
          ) : (
            /* Modo Técnico: Ação (Badge), Tabela, Data/Hora, Alterações (JSON truncado) */
            <div className="border rounded-lg overflow-x-auto">
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
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

type SortKey =
  | 'fantasia'
  | 'totalPropostas'
  | 'aprovadas'
  | 'taxaConversao'
  | 'valorTotal'
  | 'ultimaProposta'

type SortDir = 'asc' | 'desc'

const BENER_GREEN = '#0b3c26'
const BENER_GREEN_LIGHT = '#e2e8f0'

// ---- Hook: contagem animada (count-up) ----
function useCountUp(value: number, duration = 800) {
  const [display, setDisplay] = useState(0)
  const rafRef = useRef<number | null>(null)
  const fromRef = useRef(0)

  useEffect(() => {
    const from = fromRef.current
    const start = performance.now()
    const animate = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      const current = from + (value - from) * eased
      setDisplay(current)
      if (t < 1) {
        rafRef.current = requestAnimationFrame(animate)
      } else {
        fromRef.current = value
      }
    }
    rafRef.current = requestAnimationFrame(animate)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [value, duration])

  return display
}

// ---- Variações mockadas (placeholder visual) ----
// Em produção estes valores viriam da comparação com o mês anterior.
const MOCK_VARIATIONS = {
  vendedores: 0,
  propostas: 12.5,
  valor: 8.3,
  taxa: -2.1,
}

function KpiCard({
  title,
  icon,
  iconBg,
  value,
  formatted,
  subtitle,
  variation,
  decimals = 0,
  loading,
}: {
  title: string
  icon: React.ReactNode
  iconBg: string
  value: number
  formatted?: string
  subtitle: string
  variation?: number
  decimals?: number
  loading: boolean
}) {
  const animated = useCountUp(value)
  const displayValue =
    formatted && decimals === 0
      ? Math.round(animated).toLocaleString('pt-BR')
      : animated.toLocaleString('pt-BR', {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        })

  const isUp = (variation ?? 0) >= 0

  return (
    <Card className="shadow-sm border-border hover:shadow-md transition-shadow">
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </CardTitle>
        <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center', iconBg)}>
          {icon}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-7 w-24" />
        ) : (
          <div className="flex items-end gap-2">
            <div className="text-2xl font-bold text-foreground">
              {formatted ? formatCurrency(animated) : displayValue}
              {decimals > 0 && !formatted ? '%' : ''}
            </div>
            {variation !== undefined && (
              <span
                className={cn(
                  'flex items-center gap-0.5 text-xs font-semibold pb-1',
                  isUp ? 'text-emerald-600' : 'text-rose-600',
                )}
              >
                {isUp ? (
                  <TrendingUp className="w-3.5 h-3.5" />
                ) : (
                  <TrendingDown className="w-3.5 h-3.5" />
                )}
                {isUp ? '+' : ''}
                {variation.toFixed(1)}%
              </span>
            )}
          </div>
        )}
        <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
      </CardContent>
    </Card>
  )
}

export default function MeusVendedoresPage() {
  const { user } = useAuth()
  const isAdmin = isAdminRole(user?.role)

  // Lista de gerentes ativos disponíveis para o Admin selecionar
  const [gerentesAtivos, setGerentesAtivos] = useState<Gerente[]>([])
  // 'todos' = visão consolidada de todos os gerentes; caso contrário, id do gerente selecionado
  const [selectedGerenteId, setSelectedGerenteId] = useState<string>('todos')

  // Dados do modo gerente específico / gerente logado
  const [vendedores, setVendedores] = useState<VendedorResumo[]>([])
  const [gerenteNome, setGerenteNome] = useState<string | null>(null)

  // Dados do modo consolidado "Todos os Gerentes"
  const [gruposConsolidados, setGruposConsolidados] = useState<GrupoGerenteVendedores[]>([])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('totalPropostas')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [selectedVendedor, setSelectedVendedor] = useState<VendedorResumo | null>(null)
  const [selectedVendedorAtividades, setSelectedVendedorAtividades] =
    useState<VendedorResumo | null>(null)

  // Carrega a lista de gerentes ativos para o Admin na montagem
  useEffect(() => {
    if (isAdmin) {
      fetchGerentesAtivos()
        .then((list) => setGerentesAtivos(list))
        .catch((err) => console.error('Erro ao carregar lista de gerentes:', err))
    }
  }, [isAdmin])

  const loadData = useCallback(async () => {
    if (!user?.email) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(false)
    try {
      if (isAdmin && selectedGerenteId === 'todos') {
        // Visão consolidada de Todos os Gerentes
        const consolidado = await fetchTodosGerentesConsolidado()
        setGerentesAtivos(consolidado.gerentesAtivos)
        setGruposConsolidados(consolidado.grupos)
        setVendedores(consolidado.todosVendedores)
        setGerenteNome(null)
      } else if (isAdmin) {
        // Visão de um gerente específico escolhido pelo Admin
        const { gerente, vendedores: reps } = await fetchMeusVendedores(
          user.email,
          isAdmin,
          selectedGerenteId,
        )
        setGerenteNome(gerente?.nome ?? null)
        setVendedores(reps)
        setGruposConsolidados([])
      } else {
        // Visão do perfil Gerente padrão (vê apenas sua equipe)
        const { gerente, vendedores: reps } = await fetchMeusVendedores(user.email, false)
        setGerenteNome(gerente?.nome ?? null)
        setVendedores(reps)
        setGruposConsolidados([])
      }
    } catch (err) {
      console.error('Erro ao carregar dados de Meus Vendedores:', err)
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [user?.email, isAdmin, selectedGerenteId])

  useEffect(() => {
    loadData()
  }, [loadData])

  const isConsolidatedView = isAdmin && selectedGerenteId === 'todos'

  // Helper para ordenar listas de vendedores
  const sortVendedoresList = useCallback(
    (list: VendedorResumo[]) => {
      return [...list].sort((a, b) => {
        let cmp = 0
        switch (sortKey) {
          case 'fantasia':
            cmp = a.fantasia.localeCompare(b.fantasia)
            break
          case 'ultimaProposta':
            cmp = (a.ultimaProposta ?? '').localeCompare(b.ultimaProposta ?? '')
            break
          default:
            cmp = (a[sortKey] as number) - (b[sortKey] as number)
        }
        return sortDir === 'asc' ? cmp : -cmp
      })
    },
    [sortKey, sortDir],
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const list = q ? vendedores.filter((v) => v.fantasia.toLowerCase().includes(q)) : vendedores
    return sortVendedoresList(list)
  }, [vendedores, search, sortVendedoresList])

  // Grupos consolidados filtrados por busca e ordenados
  const filteredGrupos = useMemo(() => {
    if (!isConsolidatedView) return []
    const q = search.trim().toLowerCase()

    return gruposConsolidados
      .map((grupo) => {
        const filteredList = q
          ? grupo.vendedores.filter(
              (v) =>
                v.fantasia.toLowerCase().includes(q) ||
                (v.sigla && v.sigla.toLowerCase().includes(q)) ||
                (grupo.gerenteNome && grupo.gerenteNome.toLowerCase().includes(q)),
            )
          : grupo.vendedores

        return {
          ...grupo,
          vendedores: sortVendedoresList(filteredList),
        }
      })
      .filter((grupo) => grupo.vendedores.length > 0 || !q)
  }, [isConsolidatedView, gruposConsolidados, search, sortVendedoresList])

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir(key === 'fantasia' ? 'asc' : 'desc')
    }
  }

  // Resumo agregado
  const totals = useMemo(() => {
    const totalPropostas = vendedores.reduce((s, v) => s + v.totalPropostas, 0)
    const aprovadas = vendedores.reduce((s, v) => s + v.aprovadas, 0)
    const valorTotal = vendedores.reduce((s, v) => s + v.valorTotal, 0)
    const taxa = totalPropostas > 0 ? (aprovadas / totalPropostas) * 100 : 0
    return { totalPropostas, aprovadas, valorTotal, taxa }
  }, [vendedores])

  // Dados para gráfico de barras (ordenado do maior para o menor)
  const barChartData = useMemo(() => {
    return [...vendedores]
      .sort((a, b) => b.totalPropostas - a.totalPropostas)
      .slice(0, 12)
      .map((v) => ({
        name: v.fantasia.length > 18 ? v.fantasia.slice(0, 16) + '…' : v.fantasia,
        fullName: v.fantasia,
        total: v.totalPropostas,
        aprovadas: v.aprovadas,
        taxa: v.taxaConversao,
      }))
  }, [vendedores])

  // Dados para gráfico de rosca
  const donutData = useMemo(
    () => [
      { name: 'Aprovadas', value: totals.aprovadas, color: BENER_GREEN },
      {
        name: 'Demais',
        value: Math.max(0, totals.totalPropostas - totals.aprovadas),
        color: BENER_GREEN_LIGHT,
      },
    ],
    [totals],
  )

  // Top 3 vendedores (por valor total, depois propostas)
  const top3 = useMemo(() => {
    return [...vendedores]
      .sort((a, b) => b.valorTotal - a.valorTotal || b.totalPropostas - a.totalPropostas)
      .slice(0, 3)
  }, [vendedores])

  // Pior vendedor (menor taxaConversao, desempate por menos propostas)
  const pior = useMemo(() => {
    if (vendedores.length < 2) return null
    return [...vendedores].sort(
      (a, b) => a.taxaConversao - b.taxaConversao || a.totalPropostas - b.totalPropostas,
    )[0]
  }, [vendedores])

  const barConfig = {
    total: { label: 'Propostas', color: BENER_GREEN },
  } satisfies ChartConfig

  const donutConfig = {
    aprovadas: { label: 'Aprovadas', color: BENER_GREEN },
    demais: { label: 'Demais', color: BENER_GREEN_LIGHT },
  } satisfies ChartConfig

  const SortHeader = ({
    label,
    sortableKey,
    className,
  }: {
    label: string
    sortableKey: SortKey
    className?: string
  }) => (
    <TableHead className={className}>
      <button
        type="button"
        onClick={() => toggleSort(sortableKey)}
        className={cn(
          'inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider hover:text-foreground transition-colors',
          sortKey === sortableKey ? 'text-foreground' : 'text-muted-foreground',
        )}
      >
        {label}
        <ArrowUpDown className="w-3 h-3" />
      </button>
    </TableHead>
  )

  const hasData = !loading && !error && vendedores.length > 0

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Cabeçalho */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Meus Vendedores</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isAdmin
              ? 'Visualize a equipe de vendedores por gerente ou de todos de forma consolidada'
              : 'Acompanhe o desempenho dos vendedores vinculados a você'}
          </p>
          {!isAdmin && gerenteNome && (
            <p className="text-xs text-[#0b3c26] font-semibold mt-1">Gerente: {gerenteNome}</p>
          )}
        </div>

        {/* Controles do topo: Seletor de Gerente (exclusivo Admin) + Badge */}
        <div className="flex flex-wrap items-center gap-3">
          {isAdmin && (
            <div className="flex items-center gap-2 bg-card border border-border p-1.5 rounded-lg shadow-sm">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pl-2 shrink-0">
                Visão:
              </span>
              <Select
                value={selectedGerenteId}
                onValueChange={(val) => {
                  setSelectedGerenteId(val)
                  setSearch('')
                }}
              >
                <SelectTrigger className="h-9 min-w-[220px] max-w-[280px] bg-background text-sm font-medium">
                  <SelectValue placeholder="Selecione a visão..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos" className="font-semibold text-[#0b3c26]">
                    🌐 Todos os Gerentes (Consolidado)
                  </SelectItem>
                  {gerentesAtivos.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      👤 {g.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {hasData && (
            <Badge className="bg-[#0b3c26]/10 text-[#0b3c26] border-none hover:bg-[#0b3c26]/15 self-center h-8 px-3">
              <BarChart3 className="w-3.5 h-3.5 mr-1.5" />
              Dashboard de Desempenho
            </Badge>
          )}
        </div>
      </div>

      {/* Seção 1: KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          title="Total de Vendedores"
          icon={<Users className="w-4 h-4 text-[#0b3c26]" />}
          iconBg="bg-[#0b3c26]/10"
          value={vendedores.length}
          subtitle="Representantes vinculados"
          variation={MOCK_VARIATIONS.vendedores}
          loading={loading}
        />
        <KpiCard
          title="Total de Propostas"
          icon={<FileText className="w-4 h-4 text-blue-800" />}
          iconBg="bg-blue-100"
          value={totals.totalPropostas}
          subtitle="Propostas de todos os vendedores"
          variation={MOCK_VARIATIONS.propostas}
          loading={loading}
        />
        <KpiCard
          title="Valor Total"
          icon={<DollarSign className="w-4 h-4 text-blue-800" />}
          iconBg="bg-blue-100"
          value={totals.valorTotal}
          formatted="currency"
          subtitle="Soma do valor final"
          variation={MOCK_VARIATIONS.valor}
          loading={loading}
        />
        <KpiCard
          title="Taxa de Conversão"
          icon={<TrendingUp className="w-4 h-4 text-emerald-800" />}
          iconBg="bg-emerald-100"
          value={totals.taxa}
          decimals={1}
          subtitle={`${totals.aprovadas} de ${totals.totalPropostas} aprovadas`}
          variation={MOCK_VARIATIONS.taxa}
          loading={loading}
        />
      </div>

      {/* Estado: erro */}
      {error ? (
        <Card className="shadow-sm border-destructive/20 bg-destructive/5">
          <CardContent className="p-8 text-center">
            <p className="text-sm text-muted-foreground">
              Ocorreu um erro ao carregar os vendedores.
            </p>
            <button
              type="button"
              onClick={loadData}
              className="mt-3 text-sm font-semibold text-[#0b3c26] hover:underline"
            >
              Tentar novamente
            </button>
          </CardContent>
        </Card>
      ) : loading ? (
        // Skeletons dos gráficos
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="shadow-sm border-border lg:col-span-2">
            <CardHeader className="pb-2">
              <Skeleton className="h-5 w-48" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-[300px] w-full rounded-lg" />
            </CardContent>
          </Card>
          <Card className="shadow-sm border-border">
            <CardHeader className="pb-2">
              <Skeleton className="h-5 w-40" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-[300px] w-full rounded-lg" />
            </CardContent>
          </Card>
        </div>
      ) : vendedores.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-8 text-center bg-card rounded-lg border border-dashed border-border">
          <div className="w-16 h-16 rounded-full bg-accent flex items-center justify-center text-primary mb-4">
            <UserX className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-semibold mb-1 text-foreground">
            Nenhum vendedor vinculado encontrado
          </h3>
          <p className="text-sm text-muted-foreground max-w-sm">
            Entre em contato com o administrador.
          </p>
        </div>
      ) : (
        <>
          {/* Seção 2 & 3: Gráficos lado a lado */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Gráfico de Barras */}
            <Card className="shadow-sm border-border lg:col-span-2">
              <CardHeader className="flex flex-row items-center gap-2 pb-2">
                <div className="w-8 h-8 rounded-lg bg-[#0b3c26]/10 text-[#0b3c26] flex items-center justify-center">
                  <BarChart3 className="w-4 h-4" />
                </div>
                <div>
                  <CardTitle className="text-base font-semibold text-foreground">
                    Propostas por Vendedor
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">Ordenado do maior para o menor</p>
                </div>
              </CardHeader>
              <CardContent>
                <ChartContainer config={barConfig} className="h-[320px] w-full">
                  <BarChart
                    data={barChartData}
                    layout="vertical"
                    margin={{ left: 8, right: 24, top: 8, bottom: 8 }}
                  >
                    <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                    <XAxis
                      type="number"
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
                      fontSize={11}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      tickLine={false}
                      axisLine={false}
                      width={110}
                      fontSize={11}
                    />
                    <ChartTooltip
                      cursor={{ fill: 'rgba(11, 60, 38, 0.05)' }}
                      content={
                        <ChartTooltipContent
                          hideLabel
                          formatter={(value, _name, item) => {
                            const p = item?.payload as (typeof barChartData)[number]
                            if (!p) return null
                            return (
                              <div className="flex flex-col gap-1">
                                <div className="font-semibold text-foreground">{p.fullName}</div>
                                <div className="flex items-center justify-between gap-4">
                                  <span className="text-muted-foreground">Propostas</span>
                                  <span className="font-mono font-medium">{p.total}</span>
                                </div>
                                <div className="flex items-center justify-between gap-4">
                                  <span className="text-muted-foreground">Aprovadas</span>
                                  <span className="font-mono font-medium">{p.aprovadas}</span>
                                </div>
                                <div className="flex items-center justify-between gap-4">
                                  <span className="text-muted-foreground">Conversão</span>
                                  <span className="font-mono font-medium">
                                    {p.taxa.toFixed(1)}%
                                  </span>
                                </div>
                              </div>
                            )
                          }}
                        />
                      }
                    />
                    <Bar dataKey="total" fill={BENER_GREEN} radius={[0, 4, 4, 0]} maxBarSize={28} />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>

            {/* Gráfico de Rosca */}
            <Card className="shadow-sm border-border">
              <CardHeader className="flex flex-row items-center gap-2 pb-2">
                <div className="w-8 h-8 rounded-lg bg-[#0b3c26]/10 text-[#0b3c26] flex items-center justify-center">
                  <PieChartIcon className="w-4 h-4" />
                </div>
                <div>
                  <CardTitle className="text-base font-semibold text-foreground">
                    Taxa de Conversão
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">Aprovadas vs. demais</p>
                </div>
              </CardHeader>
              <CardContent>
                <ChartContainer config={donutConfig} className="h-[320px] w-full">
                  <PieChart>
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          formatter={(value, name) => (
                            <div className="flex items-center justify-between gap-4">
                              <span className="text-muted-foreground">{name}</span>
                              <span className="font-mono font-medium">{value}</span>
                            </div>
                          )}
                        />
                      }
                    />
                    <Pie
                      data={donutData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={70}
                      outerRadius={100}
                      paddingAngle={2}
                      stroke="none"
                    >
                      {donutData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                      <Label
                        content={({ viewBox }) => {
                          if (!viewBox || !('cx' in viewBox)) return null
                          const { cx, cy } = viewBox as { cx: number; cy: number }
                          return (
                            <g>
                              <text
                                x={cx}
                                y={cy - 4}
                                textAnchor="middle"
                                dominantBaseline="central"
                                className="fill-[#0b3c26]"
                                style={{ fontSize: '28px', fontWeight: 700 }}
                              >
                                {totals.taxa.toFixed(1)}%
                              </text>
                              <text
                                x={cx}
                                y={cy + 18}
                                textAnchor="middle"
                                dominantBaseline="central"
                                className="fill-muted-foreground"
                                style={{ fontSize: '11px', fontWeight: 500 }}
                              >
                                Taxa de Conversão
                              </text>
                            </g>
                          )
                        }}
                      />
                    </Pie>
                  </PieChart>
                </ChartContainer>
                <div className="flex items-center justify-center gap-4 mt-2">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm" style={{ background: BENER_GREEN }} />
                    <span className="text-xs text-muted-foreground">
                      Aprovadas ({totals.aprovadas})
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span
                      className="w-2.5 h-2.5 rounded-sm"
                      style={{ background: BENER_GREEN_LIGHT }}
                    />
                    <span className="text-xs text-muted-foreground">
                      Demais ({totals.totalPropostas - totals.aprovadas})
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Seção 5: Top 3 — Pódio */}
          {top3.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-[#0b3c26]" />
                <h2 className="text-sm font-semibold uppercase tracking-wider text-foreground">
                  Ranking Top {top3.length}
                </h2>
              </div>
              <div
                className={cn(
                  'grid gap-3',
                  top3.length === 1
                    ? 'grid-cols-1'
                    : top3.length === 2
                      ? 'grid-cols-1 sm:grid-cols-2'
                      : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
                )}
              >
                {top3.map((v, idx) => {
                  const isFirst = idx === 0
                  const medal = ['🥇', '🥈', '🥉'][idx]
                  const placeLabel = `${idx + 1}º Lugar`
                  return (
                    <Card
                      key={v.id}
                      className={cn(
                        'shadow-sm border-border relative overflow-hidden transition-shadow hover:shadow-md',
                        isFirst &&
                          'lg:row-span-1 border-[#0b3c26]/30 bg-gradient-to-br from-[#0b3c26]/5 to-transparent',
                      )}
                    >
                      <div
                        className={cn(
                          'absolute top-0 left-0 w-1 h-full',
                          isFirst ? 'bg-[#0b3c26]' : 'bg-[#0b3c26]/40',
                        )}
                      />
                      <CardContent className="p-4 sm:p-5">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <span className="text-2xl">{medal}</span>
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-wider text-[#0b3c26]">
                                {placeLabel}
                              </p>
                            </div>
                          </div>
                        </div>
                        <h3
                          className={cn(
                            'font-bold text-foreground truncate',
                            isFirst ? 'text-lg' : 'text-base',
                          )}
                          title={v.fantasia}
                        >
                          {v.fantasia}
                        </h3>
                        {v.sigla && <p className="text-xs text-muted-foreground">{v.sigla}</p>}
                        <div className="grid grid-cols-2 gap-3 mt-3">
                          <div>
                            <p className="text-xs text-muted-foreground">Propostas</p>
                            <p
                              className={cn(
                                'font-bold text-foreground',
                                isFirst ? 'text-lg' : 'text-base',
                              )}
                            >
                              {v.totalPropostas}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Valor Total</p>
                            <p
                              className={cn(
                                'font-bold text-[#0b3c26]',
                                isFirst ? 'text-lg' : 'text-base',
                              )}
                            >
                              {formatCurrency(v.valorTotal)}
                            </p>
                          </div>
                        </div>
                        <div className="mt-3 flex items-center gap-2">
                          <p className="text-xs text-muted-foreground">Conversão:</p>
                          <Badge
                            className={cn(
                              'border-none',
                              v.taxaConversao > 60
                                ? 'bg-emerald-100 text-emerald-800'
                                : v.taxaConversao >= 30
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-rose-100 text-rose-800',
                            )}
                          >
                            {v.taxaConversao.toFixed(1)}%
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </div>
          )}

          {/* Pior Desempenho */}
          {pior && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                <h2 className="text-sm font-semibold uppercase tracking-wider text-foreground">
                  Pior Desempenho
                </h2>
              </div>
              <Card className="shadow-sm border-border border-l-4 border-l-rose-500 relative overflow-hidden">
                <CardContent className="p-4 sm:p-5">
                  <div className="flex items-start justify-between mb-3">
                    <Badge className="bg-rose-100 text-rose-800 border-none gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      Pior Desempenho
                    </Badge>
                  </div>
                  <h3
                    className="font-bold text-foreground text-base truncate"
                    title={pior.fantasia}
                  >
                    {pior.fantasia}
                  </h3>
                  {pior.sigla && <p className="text-xs text-muted-foreground">{pior.sigla}</p>}
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Propostas</p>
                      <p className="font-bold text-foreground text-base">{pior.totalPropostas}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Aprovadas</p>
                      <p className="font-bold text-foreground text-base">{pior.aprovadas}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Conversão</p>
                      <Badge className="mt-0.5 bg-rose-100 text-rose-800 border-none">
                        {pior.taxaConversao.toFixed(1)}%
                      </Badge>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Valor Total</p>
                      <p className="font-bold text-rose-700 text-base">
                        {formatCurrency(pior.valorTotal)}
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-3 italic">
                    Este vendedor precisa de atenção para melhorar seus resultados.
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Busca */}
          <div className="relative max-w-sm">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              placeholder="Buscar vendedor..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Seção 4: Tabela de Vendedores */}
          {isConsolidatedView ? (
            /* ================= VISÃO CONSOLIDADA: AGRUPADA POR GERENTE ================= */
            <div className="space-y-6">
              {filteredGrupos.length === 0 ? (
                <Card className="shadow-sm border-border">
                  <CardContent className="p-8 text-center text-sm text-muted-foreground">
                    Nenhum vendedor ou gerente encontrado para "{search}".
                  </CardContent>
                </Card>
              ) : (
                filteredGrupos.map((grupo) => {
                  const isSemGerente = !grupo.gerenteId
                  const count = grupo.vendedores.length

                  return (
                    <Card
                      key={grupo.gerenteId ?? 'sem_gerente'}
                      className={cn(
                        'shadow-sm border-border overflow-hidden',
                        isSemGerente &&
                          'border-dashed border-slate-300 dark:border-slate-700 bg-muted/20',
                      )}
                    >
                      {/* Cabeçalho da Seção do Gerente */}
                      <CardHeader className="bg-muted/40 border-b border-border py-3.5 px-5">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                          <div className="flex items-center gap-3">
                            <div
                              className={cn(
                                'w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs',
                                isSemGerente
                                  ? 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                                  : 'bg-[#0b3c26] text-white',
                              )}
                            >
                              {isSemGerente ? (
                                <UserX className="w-4 h-4" />
                              ) : (
                                grupo.gerenteNome.slice(0, 2).toUpperCase()
                              )}
                            </div>
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="text-base font-bold text-foreground">
                                  {isSemGerente
                                    ? 'Sem Gerente Vinculado'
                                    : `Equipe: ${grupo.gerenteNome}`}
                                </h3>
                                <Badge
                                  variant="secondary"
                                  className={cn(
                                    'text-xs font-semibold',
                                    isSemGerente
                                      ? 'bg-slate-200 text-slate-700'
                                      : 'bg-[#0b3c26]/10 text-[#0b3c26]',
                                  )}
                                >
                                  {count} {count === 1 ? 'integrante' : 'integrantes'}
                                </Badge>
                              </div>
                              {grupo.gerente?.cargo && (
                                <p className="text-xs text-muted-foreground">
                                  {grupo.gerente.cargo}
                                  {grupo.gerente.email ? ` • ${grupo.gerente.email}` : ''}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Mini-estatísticas da equipe deste gerente */}
                          <div className="flex items-center gap-4 text-xs">
                            <div>
                              <span className="text-muted-foreground">Propostas: </span>
                              <span className="font-bold text-foreground">
                                {grupo.totals.totalPropostas}
                              </span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Valor: </span>
                              <span className="font-bold text-[#0b3c26]">
                                {formatCurrency(grupo.totals.valorTotal)}
                              </span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Conversão: </span>
                              <span className="font-bold text-foreground">
                                {grupo.totals.taxa.toFixed(1)}%
                              </span>
                            </div>
                          </div>
                        </div>
                      </CardHeader>

                      <CardContent className="p-0">
                        {grupo.vendedores.length === 0 ? (
                          <div className="text-center text-sm text-muted-foreground py-8">
                            Nenhum integrante vinculado a esta equipe.
                          </div>
                        ) : (
                          <div className="overflow-x-auto">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <SortHeader
                                    label="Vendedor / Representante"
                                    sortableKey="fantasia"
                                  />
                                  <SortHeader
                                    label="Propostas"
                                    sortableKey="totalPropostas"
                                    className="text-right"
                                  />
                                  <SortHeader
                                    label="Aprovadas"
                                    sortableKey="aprovadas"
                                    className="text-right"
                                  />
                                  <SortHeader
                                    label="Taxa de Conversão"
                                    sortableKey="taxaConversao"
                                  />
                                  <SortHeader
                                    label="Valor Total"
                                    sortableKey="valorTotal"
                                    className="text-right"
                                  />
                                  <SortHeader
                                    label="Última Proposta"
                                    sortableKey="ultimaProposta"
                                  />
                                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">
                                    Ações
                                  </TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {grupo.vendedores.map((v) => {
                                  const taxa = v.taxaConversao
                                  const badgeClass =
                                    taxa > 60
                                      ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border-none'
                                      : taxa >= 30
                                        ? 'bg-amber-100 text-amber-800 hover:bg-amber-200 border-none'
                                        : 'bg-rose-100 text-rose-800 hover:bg-rose-200 border-none'
                                  const sparkColor =
                                    taxa > 60 ? '#10b981' : taxa >= 30 ? '#f59e0b' : '#f43f5e'
                                  return (
                                    <TableRow key={v.id} className="hover:bg-accent/40">
                                      <TableCell>
                                        <div className="flex items-center gap-2">
                                          <div>
                                            <div className="font-semibold text-sm text-foreground">
                                              {v.fantasia}
                                            </div>
                                            <div className="flex items-center gap-1.5 mt-0.5">
                                              {v.tipo && (
                                                <Badge
                                                  variant="outline"
                                                  className="text-[10px] px-1 py-0 font-normal text-muted-foreground"
                                                >
                                                  {v.tipo === 'representante'
                                                    ? 'Representante'
                                                    : 'Vendedor (Usuário)'}
                                                </Badge>
                                              )}
                                              {v.sigla && (
                                                <span className="text-xs text-muted-foreground">
                                                  {v.sigla}
                                                </span>
                                              )}
                                              {v.estado && (
                                                <span className="text-xs font-medium text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                                                  UF: {v.estado}
                                                </span>
                                              )}
                                              {v.regiao && (
                                                <span className="text-xs text-muted-foreground">
                                                  • {v.regiao}
                                                </span>
                                              )}{' '}
                                            </div>
                                          </div>
                                        </div>
                                      </TableCell>
                                      <TableCell className="text-right font-semibold">
                                        {v.totalPropostas}
                                      </TableCell>
                                      <TableCell className="text-right">{v.aprovadas}</TableCell>
                                      <TableCell>
                                        <div className="flex items-center gap-2 min-w-[140px]">
                                          <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden min-w-[60px]">
                                            <div
                                              className="h-full rounded-full transition-all"
                                              style={{
                                                width: `${Math.min(100, taxa)}%`,
                                                background: sparkColor,
                                              }}
                                            />
                                          </div>
                                          <Badge className={badgeClass}>{taxa.toFixed(1)}%</Badge>
                                        </div>
                                      </TableCell>
                                      <TableCell className="text-right font-semibold">
                                        {formatCurrency(v.valorTotal)}
                                      </TableCell>
                                      <TableCell className="text-xs text-muted-foreground">
                                        {formatDate(v.ultimaProposta)}
                                      </TableCell>
                                      <TableCell className="text-right">
                                        <div className="flex items-center justify-end gap-1">
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => setSelectedVendedor(v)}
                                            aria-label={`Ver propostas de ${v.fantasia}`}
                                            title="Ver propostas"
                                          >
                                            <Eye className="w-4 h-4" />
                                          </Button>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => setSelectedVendedorAtividades(v)}
                                            disabled={!v.userId}
                                            aria-label={`Ver atividades de ${v.fantasia}`}
                                            title="Ver atividades recentes"
                                          >
                                            <Clock className="w-4 h-4" />
                                          </Button>
                                        </div>
                                      </TableCell>
                                    </TableRow>
                                  )
                                })}
                              </TableBody>
                            </Table>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )
                })
              )}
            </div>
          ) : (
            /* ================= VISÃO DE GERENTE INDIVIDUAL ================= */
            <Card className="shadow-sm border-border">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <SortHeader label="Vendedor" sortableKey="fantasia" />
                        <SortHeader
                          label="Propostas"
                          sortableKey="totalPropostas"
                          className="text-right"
                        />
                        <SortHeader
                          label="Aprovadas"
                          sortableKey="aprovadas"
                          className="text-right"
                        />
                        <SortHeader label="Taxa de Conversão" sortableKey="taxaConversao" />
                        <SortHeader
                          label="Valor Total"
                          sortableKey="valorTotal"
                          className="text-right"
                        />
                        <SortHeader label="Última Proposta" sortableKey="ultimaProposta" />
                        <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">
                          Ações
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={7}
                            className="text-center text-sm text-muted-foreground py-8"
                          >
                            Nenhum vendedor encontrado para "{search}".
                          </TableCell>
                        </TableRow>
                      ) : (
                        filtered.map((v) => {
                          const taxa = v.taxaConversao
                          const badgeClass =
                            taxa > 60
                              ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border-none'
                              : taxa >= 30
                                ? 'bg-amber-100 text-amber-800 hover:bg-amber-200 border-none'
                                : 'bg-rose-100 text-rose-800 hover:bg-rose-200 border-none'
                          const sparkColor =
                            taxa > 60 ? '#10b981' : taxa >= 30 ? '#f59e0b' : '#f43f5e'
                          return (
                            <TableRow key={v.id} className="hover:bg-accent/40">
                              <TableCell>
                                <div className="font-semibold text-sm text-foreground">
                                  {v.fantasia}
                                </div>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  {v.tipo && (
                                    <Badge
                                      variant="outline"
                                      className="text-[10px] px-1 py-0 font-normal text-muted-foreground"
                                    >
                                      {v.tipo === 'representante'
                                        ? 'Representante'
                                        : 'Vendedor (Usuário)'}
                                    </Badge>
                                  )}
                                  {v.sigla && (
                                    <span className="text-xs text-muted-foreground">{v.sigla}</span>
                                  )}
                                  {v.estado && (
                                    <span className="text-xs font-medium text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                                      UF: {v.estado}
                                    </span>
                                  )}
                                  {v.regiao && (
                                    <span className="text-xs text-muted-foreground">
                                      • {v.regiao}
                                    </span>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-right font-semibold">
                                {v.totalPropostas}
                              </TableCell>
                              <TableCell className="text-right">{v.aprovadas}</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2 min-w-[140px]">
                                  <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden min-w-[60px]">
                                    <div
                                      className="h-full rounded-full transition-all"
                                      style={{
                                        width: `${Math.min(100, taxa)}%`,
                                        background: sparkColor,
                                      }}
                                    />
                                  </div>
                                  <Badge className={badgeClass}>{taxa.toFixed(1)}%</Badge>
                                </div>
                              </TableCell>
                              <TableCell className="text-right font-semibold">
                                {formatCurrency(v.valorTotal)}
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {formatDate(v.ultimaProposta)}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setSelectedVendedor(v)}
                                    aria-label={`Ver propostas de ${v.fantasia}`}
                                    title="Ver propostas"
                                  >
                                    <Eye className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setSelectedVendedorAtividades(v)}
                                    disabled={!v.userId}
                                    aria-label={`Ver atividades de ${v.fantasia}`}
                                    title="Ver atividades recentes"
                                  >
                                    <Clock className="w-4 h-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          )
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Sheet: propostas do vendedor selecionado */}
      <VendedorPropostasSheet
        vendedor={selectedVendedor}
        onOpenChange={(open) => {
          if (!open) setSelectedVendedor(null)
        }}
      />

      {/* Sheet: atividades do vendedor selecionado */}
      <VendedorAtividadesSheet
        vendedor={selectedVendedorAtividades}
        onOpenChange={(open) => {
          if (!open) setSelectedVendedorAtividades(null)
        }}
      />
    </div>
  )
}
