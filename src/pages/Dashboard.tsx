import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { isVendedorRole } from '@/components/RoleGuard'
import { fetchProjetos, fetchProjetosForUser } from '@/services/projetos'
import { fetchProposalsWidgetData, type ProposalsWidgetData } from '@/services/dashboard'
import { ProjetoWithRelations } from '@/types/projeto'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useNavigate } from 'react-router-dom'
import {
  FileCheck,
  TrendingUp,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  ChevronRight,
  RefreshCw,
  FileSpreadsheet,
  Plus,
} from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/format'
import { ProposalsEvolutionChart } from '@/components/dashboard/ProposalsEvolutionChart'

interface CurrencyRate {
  pair: string
  name: string
  rate: number
  change: number
}

const DEFAULT_STATS: ProposalsWidgetData = {
  monthCount: 0,
  statusCounts: [],
  totalCount: 0,
  approvedCount: 0,
  conversionRate: 0,
  approvedValue: 0,
}

export default function Dashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [projetos, setProjetos] = useState<ProjetoWithRelations[]>([])
  const [stats, setStats] = useState<ProposalsWidgetData>(DEFAULT_STATS)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const isVendedor = isVendedorRole(user?.role)

  // Live Currency Mock Rates
  const currencies: CurrencyRate[] = [
    { pair: 'USD/BRL', name: 'Dólar Americano', rate: 5.48, change: +0.42 },
    { pair: 'EUR/BRL', name: 'Euro', rate: 5.96, change: -0.15 },
    { pair: 'JPY/BRL', name: 'Iene Japonês', rate: 0.035, change: +0.08 },
  ]

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      // Vendedores see only their own proposals/projects; everyone else sees global.
      const userFilter = isVendedor ? user?.id : undefined

      const [projData, statsData] = await Promise.all([
        userFilter
          ? fetchProjetosForUser(userFilter).catch(() => [] as ProjetoWithRelations[])
          : fetchProjetos().catch(() => [] as ProjetoWithRelations[]),
        fetchProposalsWidgetData(userFilter).catch(() => null),
      ])
      setProjetos(projData.slice(0, 5))
      if (statsData) {
        setStats(statsData)
      } else {
        setStats(DEFAULT_STATS)
      }
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [isVendedor, user?.id])

  useEffect(() => {
    loadData()
  }, [loadData])

  const hasNoProposals = !loading && !error && stats.totalCount === 0
  const showEmptyState = isVendedor && hasNoProposals

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Greeting Header */}
      <div>
        <h1 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">
          Olá, {user?.name || 'Usuário'}!
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          {isVendedor
            ? 'Suas estatísticas de vendas.'
            : 'Aqui está o resumo de performance de vendas.'}
        </p>
      </div>

      {/* Error state for the whole summary */}
      {error && !loading && (
        <Card className="shadow-sm border-border">
          <CardContent className="flex flex-col items-center justify-center py-8 text-center">
            <p className="text-sm text-muted-foreground mb-3">
              Não foi possível carregar suas estatísticas.
            </p>
            <Button onClick={loadData} variant="outline" size="sm" className="gap-1.5">
              <RefreshCw className="w-3.5 h-3.5" /> Tentar novamente
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Empty state for Vendedores with no proposals */}
      {showEmptyState && (
        <Card className="shadow-sm border-border border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-8 text-center">
            <div className="w-12 h-12 rounded-full bg-accent flex items-center justify-center text-primary mb-3">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <h3 className="text-base font-semibold text-foreground mb-1">
              Você ainda não possui propostas
            </h3>
            <p className="text-sm text-muted-foreground max-w-sm mb-4">
              Comece emitindo sua primeira proposta!
            </p>
            <Button
              onClick={() => navigate('/controle-propostas/emitir-proposta')}
              className="gap-1.5"
            >
              <Plus className="w-4 h-4" /> Emitir proposta
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Summary Cards */}
      {!showEmptyState && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Card className="shadow-sm border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Propostas Criadas
              </CardTitle>
              <div className="w-8 h-8 rounded-lg bg-[#0b3c26]/10 text-[#0b3c26] flex items-center justify-center">
                <FileCheck className="w-4 h-4" />
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-6 w-20" />
              ) : (
                <>
                  <div className="text-xl font-bold text-foreground">{stats.totalCount}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    <span className="text-emerald-600 font-semibold">{stats.monthCount}</span>{' '}
                    criadas este mês
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-sm border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Taxa de Aprovação
              </CardTitle>
              <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center">
                <TrendingUp className="w-4 h-4" />
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-6 w-20" />
              ) : (
                <>
                  <div className="text-xl font-bold text-foreground">
                    {stats.conversionRate.toFixed(1)}%
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    <span className="text-emerald-600 font-semibold">{stats.approvedCount}</span>{' '}
                    aprovadas de {stats.totalCount}
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-sm border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Valor Aprovado
              </CardTitle>
              <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-800 flex items-center justify-center">
                <DollarSign className="w-4 h-4" />
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-6 w-28" />
              ) : (
                <>
                  <div className="text-xl font-bold text-foreground">
                    {formatCurrency(stats.approvedValue)}
                  </div>
                  <p className="text-[#0b3c26] font-semibold text-xs mt-1">Propostas aprovadas</p>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Currency Widgets Tracker */}
      <div>
        <h2 className="text-sm font-semibold mb-2">Cotação de Moedas</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {currencies.map((curr) => (
            <Card key={curr.pair} className="shadow-sm border-border">
              <CardContent className="pt-3 flex items-center justify-between">
                <div>
                  <div className="text-xs text-muted-foreground font-semibold">{curr.name}</div>
                  <div className="text-sm font-bold tracking-tight mt-0.5">{curr.pair}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold">R$ {curr.rate.toFixed(2)}</div>
                  <div
                    className={`flex items-center justify-end text-xs font-semibold ${
                      curr.change >= 0 ? 'text-emerald-600' : 'text-rose-600'
                    }`}
                  >
                    {curr.change >= 0 ? (
                      <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" />
                    ) : (
                      <ArrowDownRight className="w-3.5 h-3.5 mr-0.5" />
                    )}
                    {Math.abs(curr.change)}%
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Proposals Evolution Chart */}
      <ProposalsEvolutionChart userId={isVendedor ? user?.id : undefined} />

      {/* Project Management Section */}
      <Card className="shadow-sm border-border">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-base font-bold">Projetos Recentes</CardTitle>
            <p className="text-xs text-muted-foreground">
              {isVendedor
                ? 'Seus projetos em andamento'
                : 'Acompanhamento dos projetos em andamento'}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/projetos')}
            className="text-[#0b3c26] hover:bg-[#0b3c26]/10 font-semibold gap-1 text-xs"
          >
            Ver todos <ChevronRight className="w-4 h-4" />
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
            </div>
          ) : projetos.length === 0 ? (
            <div className="text-center py-4 text-sm text-muted-foreground">
              {isVendedor
                ? 'Você ainda não participa de nenhum projeto.'
                : 'Nenhum projeto cadastrado.'}
            </div>
          ) : (
            <div className="divide-y divide-border">
              {projetos.map((p) => (
                <div
                  key={p.id}
                  onClick={() => navigate(`/projetos/${p.id}`)}
                  className="py-2.5 flex items-center justify-between hover:bg-accent/40 rounded-md px-2 cursor-pointer transition-colors"
                >
                  <div>
                    <div className="font-semibold text-sm text-foreground">{p.nome}</div>
                    <div className="text-xs text-muted-foreground">
                      Cliente: {p.clientes?.fantasia || 'N/A'}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge
                      className={
                        p.status === 'Concluido' || p.status === 'Concluído'
                          ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border-none'
                          : 'bg-blue-100 text-blue-800 hover:bg-blue-200 border-none'
                      }
                    >
                      {p.status}
                    </Badge>
                    <span className="text-xs text-muted-foreground hidden sm:inline">
                      {formatDate(p.created_at)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
