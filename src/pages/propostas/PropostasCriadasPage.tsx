import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
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
import { PaginationBar } from '@/components/shared/table-controls'
import {
  Plus,
  Search,
  Eye,
  Printer,
  Trash2,
  Pencil,
  Link as LinkIcon,
  Check,
  FolderKanban,
  Send,
  Cpu,
  User as UserIcon,
  Calendar,
  Layers,
} from 'lucide-react'
import { Proposta } from '@/types/proposta'
import { ReenviarNotificacaoDialog } from '@/components/propostas/ReenviarNotificacaoDialog'
import { toast } from '@/hooks/use-toast'
import { LoadingState, EmptyState, ErrorState } from '@/components/StateViews'
import { useAuth } from '@/hooks/use-auth'
import { useDebounce } from '@/hooks/use-debounce'
import { formatDate } from '@/lib/format'
import { fetchPropostas, deleteProposta } from '@/services/propostas'
import { PropostaWithRelations, STATUS_LABELS } from '@/types/proposta'
import { useCurrencyRates } from '@/hooks/use-currency-rates'
import { formatBrlEquivalent } from '@/services/currency-rates'

const PAGE_SIZE = 50

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

export const getCriadoPorName = (p: PropostaWithRelations): string => {
  return (
    p.nome_representante_comercial ||
    p.representantes?.fantasia ||
    p.representante_original ||
    p.user ||
    '—'
  )
}

export const getMaquinasInfo = (
  p: PropostaWithRelations,
): { primary: string; count: number; secondary?: string } => {
  // 1. Snapshot multi-itens (propostas com itens_snapshot)
  const snap = p.itens_snapshot as
    | Array<{ versoes?: { nome?: string; nome_abreviado?: string } }>
    | null
    | undefined
  if (Array.isArray(snap) && snap.length > 0) {
    const names = snap
      .map((it) => it?.versoes?.nome_abreviado || it?.versoes?.nome)
      .filter((n): n is string => Boolean(n && n.trim()))
    if (names.length > 0) {
      return {
        primary: names[0],
        count: names.length,
        secondary: names.length > 1 ? `+${names.length - 1} item(ns)` : undefined,
      }
    }
  }

  // 2. Relação de versão direta (join via select relations)
  if (p.versoes) {
    const vNome = p.versoes.nome_abreviado || p.versoes.nome
    if (vNome) return { primary: vNome, count: 1 }
  }

  // 3. Fallback para versao_original ou descricao_proposta
  if (p.versao_original && p.versao_original.length < 100) {
    return { primary: p.versao_original, count: 1 }
  }
  if (p.descricao_proposta && p.descricao_proposta.trim()) {
    return { primary: p.descricao_proposta.trim(), count: 1 }
  }

  return { primary: '—', count: 0 }
}

const formatValor = (valor: number | null, moeda: string | null): string => {
  const v = valor || 0
  if (moeda === 'USD') return `US$ ${v.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
  if (moeda === 'EUR') return `€ ${v.toLocaleString('de-DE', { minimumFractionDigits: 2 })}`
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
}

export default function PropostasCriadasPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const roleLower = (user?.role || '').toLowerCase()
  const isVendedorOuRep = roleLower.includes('vendedor') || roleLower.includes('representante')

  const [data, setData] = useState<PropostaWithRelations[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('Todos')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(PAGE_SIZE)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [selectedProposalForNotify, setSelectedProposalForNotify] =
    useState<PropostaWithRelations | null>(null)
  const debouncedSearch = useDebounce(search, 300)
  const { rates } = useCurrencyRates()

  const handleCopyPublicLink = (p: Proposta | PropostaWithRelations) => {
    const tokenOrId = p.public_token || p.id
    const publicUrl = `${window.location.origin}/visualizar-proposta/${tokenOrId}`
    navigator.clipboard.writeText(publicUrl)
    setCopiedId(p.id)
    toast({
      title: 'Link público copiado!',
      description: 'O link protegido por token foi copiado para a área de transferência.',
    })
    setTimeout(() => {
      setCopiedId((current) => (current === p.id ? null : current))
    }, 2000)
  }

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      setData(
        await fetchPropostas({
          userId: user?.id,
          userName: user?.name,
          userEmail: user?.email,
          isVendedorOuRep,
        }),
      )
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [user?.id, user?.name, user?.email, isVendedorOuRep])

  useEffect(() => {
    loadData()
  }, [loadData])

  const filtered = useMemo(() => {
    const q = debouncedSearch.toLowerCase().trim()
    return data.filter((p) => {
      const criadoPor = getCriadoPorName(p).toLowerCase()
      const projetoNome = (p.projetos?.nome || '').toLowerCase()
      const matchesSearch =
        !q ||
        (p.numero_proposta || '').toLowerCase().includes(q) ||
        (p.clientes?.fantasia || p.cliente_original || '').toLowerCase().includes(q) ||
        criadoPor.includes(q) ||
        projetoNome.includes(q)
      const matchesStatus = statusFilter === 'Todos' || p.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [data, debouncedSearch, statusFilter])

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, statusFilter])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  const handleDelete = async (id: string) => {
    if (!window.confirm('Deseja realmente excluir esta proposta?')) return
    try {
      await deleteProposta(id)
      toast({ title: 'Proposta excluída com sucesso' })
      loadData()
    } catch {
      toast({
        title: 'Erro ao excluir',
        description: 'Não foi possível conectar ao servidor. Tente novamente.',
        variant: 'destructive',
      })
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Propostas Comerciais</h1>
          <p className="text-sm text-muted-foreground">
            Histórico e emissão de propostas para clientes
          </p>
        </div>
        <Button
          onClick={() => navigate('/controle-propostas/emitir-proposta')}
          className="bg-primary gap-1"
        >
          <Plus className="w-4 h-4" /> Emitir Proposta
        </Button>
      </div>
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            placeholder="Buscar por número, projeto, cliente ou criado por..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 input-bener"
            aria-label="Buscar propostas"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger
            className="w-full sm:w-40 select-bener-trigger"
            aria-label="Filtrar por status"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Todos">Todos</SelectItem>
            <SelectItem value="Em Analise">Em Análise</SelectItem>
            <SelectItem value="Aprovada">Aprovada</SelectItem>
            <SelectItem value="Rejeitada">Rejeitada</SelectItem>
            <SelectItem value="Validada">Validada</SelectItem>
            <SelectItem value="Excluida">Excluída</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {loading ? (
        <LoadingState count={5} />
      ) : error ? (
        <ErrorState
          message="Não foi possível carregar as propostas. Tente novamente."
          onRetry={loadData}
        />
      ) : paginated.length === 0 ? (
        <EmptyState
          title="Nenhuma proposta encontrada"
          description="Não há propostas cadastradas ou que correspondam aos filtros."
          actionText="Nova Proposta"
          onAction={() => navigate('/controle-propostas/emitir-proposta')}
        />
      ) : (
        <>
          <div className="border rounded-lg bg-card overflow-x-auto shadow-sm">
            <Table className="responsive-table min-w-[1240px]">
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="w-[185px] min-w-[170px] whitespace-nowrap">
                    Nº Oferta
                  </TableHead>
                  <TableHead className="w-[200px] min-w-[170px]">Cliente</TableHead>
                  <TableHead className="w-[260px] min-w-[210px]">
                    <div className="flex items-center gap-1.5">
                      <Cpu className="w-3.5 h-3.5 text-muted-foreground" />
                      <span>Máquina / Versão</span>
                    </div>
                  </TableHead>
                  <TableHead className="w-[160px] min-w-[130px]">
                    <div className="flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-muted-foreground" />
                      <span>Tipo Proposta</span>
                    </div>
                  </TableHead>
                  <TableHead className="w-[150px] min-w-[130px]">
                    <div className="flex items-center gap-1.5">
                      <UserIcon className="w-3.5 h-3.5 text-muted-foreground" />
                      <span>Criado por</span>
                    </div>
                  </TableHead>
                  <TableHead className="w-[150px] min-w-[130px]">Valor Final</TableHead>
                  <TableHead className="w-[115px] min-w-[105px]">Status</TableHead>
                  <TableHead className="w-[100px] min-w-[90px]">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                      <span>Data</span>
                    </div>
                  </TableHead>
                  <TableHead className="w-[180px] min-w-[170px] text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map((p) => {
                  const criadoPor = getCriadoPorName(p)
                  const projetoNome = p.projetos?.nome
                  const clienteNome = p.clientes?.fantasia || p.cliente_original || '—'
                  const maquinaInfo = getMaquinasInfo(p)
                  return (
                    <TableRow key={p.id} className="align-top">
                      {/* Nº Oferta */}
                      <TableCell data-label="Nº Oferta" className="font-bold text-primary py-3">
                        <div className="flex flex-col gap-1 min-w-[160px]">
                          <span className="font-mono text-xs sm:text-sm font-semibold tracking-tight break-all text-slate-900 dark:text-slate-100 select-all">
                            {displayNumero(p.numero_proposta, p.revisao)}
                          </span>
                          <div className="flex flex-wrap items-center gap-1">
                            {projetoNome && (
                              <Badge
                                variant="outline"
                                className="inline-flex items-center gap-1 text-[10.5px] font-normal px-1.5 py-0.5 rounded text-muted-foreground bg-muted/50 border-muted-foreground/20 max-w-[190px] truncate"
                                title={`Projeto: ${projetoNome}`}
                              >
                                <FolderKanban className="w-3 h-3 text-muted-foreground/70 shrink-0" />
                                <span className="truncate">{projetoNome}</span>
                              </Badge>
                            )}
                            {p.modelo_licitacao && (
                              <Badge
                                variant="outline"
                                className="bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-700 text-[10.5px] py-0 px-1.5 font-medium shrink-0"
                              >
                                Licitação
                              </Badge>
                            )}
                            {p.is_pacote && (
                              <Badge
                                variant="outline"
                                className="bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-700 text-[10.5px] py-0 px-1.5 font-medium shrink-0"
                              >
                                Pacote
                              </Badge>
                            )}
                          </div>
                        </div>
                      </TableCell>

                      {/* Cliente */}
                      <TableCell data-label="Cliente" className="text-xs py-3">
                        <div
                          className="font-medium text-foreground leading-snug break-words line-clamp-3 select-text"
                          title={clienteNome}
                        >
                          {clienteNome}
                        </div>
                        {p.clientes?.cidade && p.clientes?.estado && (
                          <span className="text-[11px] text-muted-foreground block mt-0.5">
                            {p.clientes.cidade}/{p.clientes.estado}
                          </span>
                        )}
                      </TableCell>

                      {/* Máquina / Versão */}
                      <TableCell data-label="Máquina" className="text-xs py-3">
                        <div className="flex flex-col gap-1">
                          <span
                            className="font-medium text-foreground leading-snug break-words line-clamp-3"
                            title={maquinaInfo.primary !== '—' ? maquinaInfo.primary : undefined}
                          >
                            {maquinaInfo.primary}
                          </span>
                          {maquinaInfo.secondary && (
                            <Badge
                              variant="secondary"
                              className="w-fit text-[10px] px-1.5 py-0 font-normal text-muted-foreground bg-muted"
                            >
                              {maquinaInfo.secondary}
                            </Badge>
                          )}
                        </div>
                      </TableCell>

                      {/* Tipo de Proposta */}
                      <TableCell data-label="Tipo" className="text-xs py-3">
                        <span
                          className="block text-muted-foreground leading-snug break-words line-clamp-2"
                          title={p.tipo_proposta || undefined}
                        >
                          {p.tipo_proposta || '—'}
                        </span>
                      </TableCell>

                      {/* Criado por */}
                      <TableCell data-label="Criado por" className="text-xs py-3">
                        <span
                          className="block font-medium text-foreground leading-snug break-words line-clamp-2"
                          title={criadoPor !== '—' ? criadoPor : undefined}
                        >
                          {criadoPor}
                        </span>
                      </TableCell>

                      {/* Valor Final */}
                      <TableCell
                        data-label="Valor Final"
                        className="font-semibold py-3 whitespace-nowrap"
                      >
                        <div className="flex flex-col leading-tight">
                          <span className="text-sm font-bold text-foreground">
                            {formatValor(p.valor_final, p.moeda)}
                          </span>
                          {p.moeda &&
                            p.moeda !== 'BRL' &&
                            p.valor_final &&
                            formatBrlEquivalent(p.valor_final, p.moeda, rates) && (
                              <span className="text-[11px] text-muted-foreground tabular-nums mt-0.5">
                                {formatBrlEquivalent(p.valor_final, p.moeda, rates)}
                              </span>
                            )}
                        </div>
                      </TableCell>

                      {/* Status */}
                      <TableCell data-label="Status" className="py-3 whitespace-nowrap">
                        <Badge
                          variant={statusVariant(p.status)}
                          className="font-semibold text-[11px]"
                        >
                          {STATUS_LABELS[p.status] || p.status}
                        </Badge>
                      </TableCell>

                      {/* Data */}
                      <TableCell
                        data-label="Data"
                        className="text-xs text-muted-foreground py-3 whitespace-nowrap"
                      >
                        {formatDate(p.created_at)}
                      </TableCell>

                      {/* Ações */}
                      <TableCell data-label="Ações" className="text-right py-3 whitespace-nowrap">
                        <div className="flex justify-end items-center gap-0.5">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setSelectedProposalForNotify(p)}
                            aria-label={`Reenviar notificação da proposta ${p.numero_proposta || ''}`}
                            title="Enviar ao Cliente (E-mail)"
                            className="h-8 w-8 text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/40"
                          >
                            <Send className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleCopyPublicLink(p)}
                            aria-label={`Copiar link público da proposta ${p.numero_proposta || ''}`}
                            title="Copiar link público da proposta"
                            className="h-8 w-8"
                          >
                            {copiedId === p.id ? (
                              <Check className="w-4 h-4 text-emerald-600" />
                            ) : (
                              <LinkIcon className="w-4 h-4 text-primary" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => navigate(`/controle-propostas/editar-proposta/${p.id}`)}
                            aria-label={`Editar proposta ${p.numero_proposta || ''}`}
                            title="Editar Proposta"
                            className="h-8 w-8"
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => navigate(`/controle-propostas/proposta-pdf/${p.id}`)}
                            aria-label={`Visualizar proposta ${p.numero_proposta || ''}`}
                            title="Visualizar Proposta (PDF)"
                            className="h-8 w-8"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => window.open(`/proposta/${p.id}/imprimir`, '_blank')}
                            aria-label={`Imprimir proposta ${p.numero_proposta || ''}`}
                            title="Imprimir Proposta"
                            className="h-8 w-8"
                          >
                            <Printer className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:bg-destructive/10"
                            onClick={() => handleDelete(p.id)}
                            aria-label={`Excluir proposta ${p.numero_proposta || ''}`}
                            title="Excluir Proposta"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
          <PaginationBar
            page={currentPage}
            pageSize={pageSize}
            total={filtered.length}
            onPageChange={setPage}
            onPageSizeChange={(s) => {
              setPageSize(s)
              setPage(1)
            }}
          />
        </>
      )}

      <ReenviarNotificacaoDialog
        open={Boolean(selectedProposalForNotify)}
        onOpenChange={(isOpen) => {
          if (!isOpen) setSelectedProposalForNotify(null)
        }}
        proposta={selectedProposalForNotify}
        onSuccess={loadData}
      />
    </div>
  )
}
