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
          <div className="border rounded-lg bg-card overflow-x-auto">
            <Table className="responsive-table">
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[170px] whitespace-nowrap">Nº Oferta</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Criado por</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Valor Final</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map((p) => {
                  const criadoPor = getCriadoPorName(p)
                  const projetoNome = p.projetos?.nome
                  return (
                    <TableRow key={p.id}>
                      <TableCell data-label="Nº Oferta" className="font-bold text-primary">
                        <div className="flex flex-col gap-1 min-w-[160px]">
                          <span className="font-mono text-xs sm:text-sm font-semibold tracking-tight break-all text-slate-900 dark:text-slate-100 select-all">
                            {displayNumero(p.numero_proposta, p.revisao)}
                          </span>
                          <div className="flex flex-wrap items-center gap-1">
                            {projetoNome && (
                              <Badge
                                variant="outline"
                                className="inline-flex items-center gap-1 text-[10.5px] font-normal px-1.5 py-0.5 rounded text-muted-foreground bg-muted/50 border-muted-foreground/20 max-w-[200px] truncate"
                                title={`Projeto: ${projetoNome}`}
                              >
                                <FolderKanban className="w-3 h-3 text-muted-foreground/70 shrink-0" />
                                <span className="truncate">{projetoNome}</span>
                              </Badge>
                            )}
                            {p.modelo_licitacao && (
                              <Badge
                                variant="outline"
                                className="bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-700 text-[10.5px] py-0 px-1.5"
                              >
                                Licitação
                              </Badge>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell data-label="Cliente" className="text-xs">
                        {p.clientes?.fantasia || p.cliente_original || '—'}
                      </TableCell>
                      <TableCell data-label="Criado por" className="text-xs max-w-[160px]">
                        <span
                          className="block truncate font-medium text-foreground"
                          title={criadoPor !== '—' ? criadoPor : undefined}
                        >
                          {criadoPor}
                        </span>
                      </TableCell>
                      <TableCell data-label="Tipo" className="text-xs">
                        {p.tipo_proposta || '—'}
                      </TableCell>
                      <TableCell data-label="Valor Final" className="font-semibold">
                        <div className="flex flex-col leading-tight">
                          <span>{formatValor(p.valor_final, p.moeda)}</span>
                          {p.moeda &&
                            p.moeda !== 'BRL' &&
                            p.valor_final &&
                            formatBrlEquivalent(p.valor_final, p.moeda, rates) && (
                              <span className="text-xs text-muted-foreground tabular-nums">
                                {formatBrlEquivalent(p.valor_final, p.moeda, rates)}
                              </span>
                            )}
                        </div>
                      </TableCell>
                      <TableCell data-label="Status">
                        <Badge variant={statusVariant(p.status)}>
                          {STATUS_LABELS[p.status] || p.status}
                        </Badge>
                      </TableCell>
                      <TableCell data-label="Data" className="text-xs text-muted-foreground">
                        {formatDate(p.created_at)}
                      </TableCell>
                      <TableCell data-label="Ações" className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setSelectedProposalForNotify(p)}
                            aria-label={`Reenviar notificação da proposta ${p.numero_proposta || ''}`}
                            title="Enviar ao Cliente (E-mail / WhatsApp)"
                            className="text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/40"
                          >
                            <Send className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleCopyPublicLink(p)}
                            aria-label={`Copiar link público da proposta ${p.numero_proposta || ''}`}
                            title="Copiar link público da proposta"
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
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => navigate(`/controle-propostas/proposta-pdf/${p.id}`)}
                            aria-label={`Visualizar proposta ${p.numero_proposta || ''}`}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => window.open(`/proposta/${p.id}/imprimir`, '_blank')}
                            aria-label={`Imprimir proposta ${p.numero_proposta || ''}`}
                          >
                            <Printer className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive"
                            onClick={() => handleDelete(p.id)}
                            aria-label={`Excluir proposta ${p.numero_proposta || ''}`}
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
