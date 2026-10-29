import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { isVendedorRole } from '@/components/RoleGuard'
import { fetchProjetos, fetchProjetosForUser } from '@/services/projetos'
import { fetchProposalsWidgetData, type ProposalsWidgetData } from '@/services/dashboard'
import { useCurrencyRates } from '@/hooks/use-currency-rates'
import { formatPtaxRate, SAFE_DEFAULT_RATES } from '@/services/currency-rates'
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
  Calendar,
  AlertTriangle,
} from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/format'
import { ProposalsEvolutionChart } from '@/components/dashboard/ProposalsEvolutionChart'

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

  const {
    rates,
    loading: loadingRates,
    isCached: isRatesCached,
    reload: reloadRates,
  } = useCurrencyRates()
  const currentRates = rates || SAFE_DEFAULT_RATES

  const isRatesOutdated =
    Boolean(currentRates.isOutdated) ||
    isRatesCached ||
    currentRates.source?.includes('cache') ||
    currentRates.source === 'offline-default' ||
    currentRates.source === 'padrao-seguro'

  const refDateText = currentRates.refDate
    ? `Cotação de fechamento de ${currentRates.refDate}`
    : 'Cotação de fechamento do dia útil anterior'

  const currencyCards = [
    {
      pair: 'USD/BRL',
      code: 'USD',
      symbol: '$',
      name: 'Dólar Americano',
      rate: currentRates.usdRate,
      change: currentRates.usdPctChange,
    },
    {
      pair: 'EUR/BRL',
      code: 'EUR',
      symbol: '€',
      name: 'Euro',
      rate: currentRates.eurRate,
      change: currentRates.eurPctChange,
    },
    {
      pair: 'JPY/BRL',
      code: 'JPY',
      symbol: '¥',
      name: 'Iene Japonês',
      rate: currentRates.jpyRate,
      change: currentRates.jpyPctChange,
    },
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

      {/* Currency Widgets Tracker — Cotações PTAX Fechamento do Dia Útil Anterior (USD, EUR, JPY) */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold">Cotação de Moedas</h2>
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 px-2 py-0.5 rounded shadow-2xs">
              <Calendar className="w-3 h-3 text-emerald-700 dark:text-emerald-400" />
              {refDateText}
            </span>
            {isRatesOutdated && (
              <Badge
                variant="outline"
                className="text-[10px] h-5 px-1.5 border-amber-400 bg-amber-50 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200 dark:border-amber-700 inline-flex items-center gap-1 font-medium"
                title={`Fonte: ${currentRates.source}. Esta cotação pode estar desatualizada em relação ao Banco Central.`}
              >
                <AlertTriangle className="w-2.5 h-2.5 text-amber-600 dark:text-amber-400" />
                cotação desatualizada (cache)
              </Badge>
            )}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => reloadRates(true)}
            disabled={loadingRates}
            title="Atualizar cotação PTAX junto ao Banco Central"
            className="h-6 px-2 gap-1 text-[11px] text-muted-foreground hover:text-foreground"
          >
            <RefreshCw
              className={`h-3 w-3 ${loadingRates ? 'animate-spin text-emerald-600' : ''}`}
            />
            <span>Atualizar</span>
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {currencyCards.map((curr) => {
            const hasChange = typeof curr.change === 'number' && curr.change !== 0
            const isUp = curr.change >= 0
            return (
              <Card key={curr.pair} className="shadow-sm border-border bg-card">
                <CardContent className="pt-3 flex items-center justify-between">
                  <div>
                    <div className="text-xs text-muted-foreground font-semibold flex items-center gap-1">
                      <span>{curr.name}</span>
                      <span className="text-[10px] text-muted-foreground/80">({curr.symbol})</span>
                    </div>
                    <div className="text-sm font-bold tracking-tight mt-0.5">{curr.pair}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">{refDateText}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold tabular-nums">
                      R$ {formatPtaxRate(curr.rate)}
                    </div>
                    {hasChange ? (
                      <div
                        className={`flex items-center justify-end text-xs font-semibold ${
                          isUp ? 'text-emerald-600' : 'text-rose-600'
                        }`}
                      >
                        {isUp ? (
                          <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" />
                        ) : (
                          <ArrowDownRight className="w-3.5 h-3.5 mr-0.5" />
                        )}
                        {Math.abs(curr.change).toFixed(2)}%
                      </div>
                    ) : (
                      <div className="text-[10px] text-slate-500 font-medium mt-0.5">
                        Fechamento PTAX
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
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
