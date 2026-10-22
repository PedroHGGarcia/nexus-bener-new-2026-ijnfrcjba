import React, { useState, useEffect, useCallback } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Search,
  RotateCcw,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  FilterX,
  History,
  Info,
  Clock,
  ArrowRight,
  User,
  Package,
} from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { LoadingState, EmptyState } from '@/components/StateViews'
import { useAuth } from '@/hooks/use-auth'
import { useCanEditMachines } from '@/hooks/use-machine-permissions'
import {
  fetchHistoricoAlteracoes,
  reverterAlteracao,
  type RegistroAlteracao,
  type EntidadeCatalogo,
  type AcaoAlteracao,
  ENTIDADE_LABELS,
  CAMPOS_AMIGAVEIS,
} from '@/services/registro-alteracoes'
import { ReverterConfirmDialog } from '@/components/produtos/ReverterConfirmDialog'

interface Props {
  defaultEntidade?: EntidadeCatalogo | 'todas'
  initialRegistroId?: string
  showTitle?: boolean
  onAfterRevert?: () => void
}

export function HistoricoAlteracoesCatalogo({
  defaultEntidade = 'todas',
  initialRegistroId,
  showTitle = true,
  onAfterRevert,
}: Props) {
  const { user } = useAuth()
  const canEdit = useCanEditMachines()

  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<RegistroAlteracao[]>([])
  const [totalCount, setTotalCount] = useState(0)

  // Filtros
  const [entidade, setEntidade] = useState<EntidadeCatalogo | 'todas'>(defaultEntidade)
  const [acao, setAcao] = useState<AcaoAlteracao | 'todas'>('todas')
  const [termoBusca, setTermoBusca] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)

  // Linhas expandidas para ver o detalhe de alterações
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  // Modal de confirmação de reversão
  const [selectedForRevert, setSelectedForRevert] = useState<RegistroAlteracao | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const { data, total, error } = await fetchHistoricoAlteracoes({
        entidade,
        acao,
        termoBusca,
        registroId: initialRegistroId,
        page,
        pageSize,
      })
      if (error) {
        toast({
          title: 'Erro ao carregar histórico',
          description: error,
          variant: 'destructive',
        })
      } else {
        setItems(data)
        setTotalCount(total)
      }
    } finally {
      setLoading(false)
    }
  }, [entidade, acao, termoBusca, initialRegistroId, page, pageSize])

  useEffect(() => {
    loadData()
  }, [loadData])

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleOpenRevert = (item: RegistroAlteracao) => {
    setSelectedForRevert(item)
    setConfirmOpen(true)
  }

  const handleConfirmRevert = async () => {
    if (!selectedForRevert) return
    const res = await reverterAlteracao(selectedForRevert, {
      nome: user?.name,
      email: user?.email,
    })

    if (res.success) {
      toast({
        title: 'Alteração revertida com sucesso!',
        description: res.message,
      })
      loadData()
      if (onAfterRevert) onAfterRevert()
    } else {
      toast({
        title: 'Não foi possível reverter',
        description: res.message,
        variant: 'destructive',
      })
    }
  }

  const totalPages = Math.ceil(totalCount / pageSize) || 1

  return (
    <div className="space-y-4">
      {showTitle && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <History className="w-5 h-5 text-primary" />
              Histórico de Modificações do Catálogo
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Auditoria completa com antes e depois das versões, modelos, produtos e categorias.
              Permite reverter qualquer modificação.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            disabled={loading}
            className="gap-1.5 self-start sm:self-auto"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
      )}

      {/* Barra de Filtros */}
      <div className="rounded-xl border bg-card p-4 shadow-sm space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {/* Busca textual */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome do registro ou usuário..."
              value={termoBusca}
              onChange={(e) => {
                setTermoBusca(e.target.value)
                setPage(1)
              }}
              className="pl-9 h-10 text-sm"
            />
          </div>

          {/* Entidade */}
          <div>
            <Select
              value={entidade}
              onValueChange={(val) => {
                setEntidade(val as any)
                setPage(1)
              }}
            >
              <SelectTrigger className="h-10 text-sm">
                <SelectValue placeholder="Todas as entidades" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as entidades</SelectItem>
                <SelectItem value="versoes">Versões</SelectItem>
                <SelectItem value="modelos">Modelos</SelectItem>
                <SelectItem value="produtos">Produtos</SelectItem>
                <SelectItem value="categorias_produtos">Categorias</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Ação */}
          <div>
            <Select
              value={acao}
              onValueChange={(val) => {
                setAcao(val as any)
                setPage(1)
              }}
            >
              <SelectTrigger className="h-10 text-sm">
                <SelectValue placeholder="Todas as ações" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as ações</SelectItem>
                <SelectItem value="criado">Criações</SelectItem>
                <SelectItem value="editado">Edições</SelectItem>
                <SelectItem value="excluido">Exclusões</SelectItem>
                <SelectItem value="revertido">Reversões</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Limpar Filtros */}
          <div className="flex items-center gap-2">
            {(termoBusca || entidade !== 'todas' || acao !== 'todas') && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setTermoBusca('')
                  setEntidade('todas')
                  setAcao('todas')
                  setPage(1)
                }}
                className="gap-1.5 text-xs text-muted-foreground hover:text-foreground h-10 px-3"
              >
                <FilterX className="w-4 h-4" />
                Limpar filtros
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Tabela de Histórico */}
      <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead className="w-10"></TableHead>
                <TableHead className="text-foreground">O que foi alterado</TableHead>
                <TableHead className="text-foreground">Ação</TableHead>
                <TableHead className="text-foreground">Quem fez</TableHead>
                <TableHead className="text-foreground">Quando</TableHead>
                <TableHead className="text-right">Reversão</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-12">
                    <LoadingState count={5} />
                  </TableCell>
                </TableRow>
              ) : items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-12">
                    <EmptyState
                      title="Nenhuma alteração encontrada"
                      description="Não há registros de alterações no catálogo para os filtros selecionados."
                    />
                  </TableCell>
                </TableRow>
              ) : (
                items.map((item) => {
                  const isExpanded = expandedIds.has(item.id)
                  const hasDetails =
                    (item.campos_alterados && item.campos_alterados.length > 0) ||
                    item.dados_anteriores ||
                    item.dados_novos

                  return (
                    <React.Fragment key={item.id}>
                      <TableRow
                        className={`hover:bg-muted/30 transition-colors cursor-pointer ${
                          isExpanded ? 'bg-muted/20' : ''
                        }`}
                        onClick={() => hasDetails && toggleExpand(item.id)}
                      >
                        {/* Botão de Expandir */}
                        <TableCell className="p-2 text-center">
                          {hasDetails ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground"
                              onClick={(e) => {
                                e.stopPropagation()
                                toggleExpand(item.id)
                              }}
                            >
                              {isExpanded ? (
                                <ChevronDown className="w-4 h-4" />
                              ) : (
                                <ChevronRight className="w-4 h-4" />
                              )}
                            </Button>
                          ) : (
                            <span className="w-7 inline-block text-center text-muted-foreground/40">
                              ·
                            </span>
                          )}
                        </TableCell>

                        {/* Entidade + Nome */}
                        <TableCell className="py-3">
                          <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-2">
                              <Badge
                                variant="outline"
                                className="text-[11px] font-semibold uppercase tracking-wider bg-slate-50 dark:bg-slate-900 border-slate-300 dark:border-slate-700"
                              >
                                {ENTIDADE_LABELS[item.entidade] || item.entidade}
                              </Badge>
                              <span className="text-sm font-semibold text-foreground">
                                {item.registro_nome || 'Sem nome'}
                              </span>
                            </div>
                            <span className="text-[11px] font-mono text-muted-foreground">
                              ID: {item.registro_id.slice(0, 8)}...
                            </span>
                          </div>
                        </TableCell>

                        {/* Ação */}
                        <TableCell className="py-3">
                          <Badge
                            className={`text-xs font-semibold px-2.5 py-0.5 ${getAcaoBadgeStyle(
                              item.acao,
                            )}`}
                          >
                            {formatAcao(item.acao)}
                          </Badge>
                        </TableCell>

                        {/* Quem fez */}
                        <TableCell className="py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 text-primary font-bold text-xs">
                              {getInitials(item.usuario_nome || item.usuario_email || 'Sistema')}
                            </div>
                            <div className="flex flex-col min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-xs text-muted-foreground font-medium">
                                  {formatAcaoPrefix(item.acao)} por
                                </span>
                                <span className="text-sm font-bold text-foreground">
                                  {item.usuario_nome || 'Sistema'}
                                </span>
                              </div>
                              {item.usuario_email && (
                                <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                                  {item.usuario_email}
                                </span>
                              )}
                            </div>
                          </div>
                        </TableCell>

                        {/* Quando */}
                        <TableCell className="py-3 font-mono text-xs text-muted-foreground">
                          <div className="flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-muted-foreground/70 shrink-0" />
                            <span>{new Date(item.created_at).toLocaleString('pt-BR')}</span>
                          </div>
                        </TableCell>

                        {/* Botão de Reverter */}
                        <TableCell className="py-3 text-right" onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={!canEdit || item.acao === 'revertido'}
                            onClick={() => handleOpenRevert(item)}
                            className="gap-1.5 text-xs border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/30 dark:hover:bg-amber-950/60 font-semibold"
                            title={
                              !canEdit
                                ? 'Apenas comercial/admin pode reverter alterações'
                                : 'Restaurar estado anterior desta alteração'
                            }
                          >
                            <RotateCcw className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                            Reverter
                          </Button>
                        </TableCell>
                      </TableRow>

                      {/* Linha Expandida: Detalhes do Antes e Depois */}
                      {isExpanded && (
                        <TableRow className="bg-muted/15 border-b">
                          <TableCell colSpan={6} className="p-4 pl-8 md:pl-12">
                            <div className="space-y-3">
                              {/* Destaque de quem fez a modificação */}
                              <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted/40 border text-xs">
                                <User className="w-4 h-4 text-primary shrink-0" />
                                <span className="text-muted-foreground">
                                  Modificação realizada por:
                                </span>
                                <span className="font-bold text-foreground">
                                  {item.usuario_nome || 'Sistema'}
                                </span>
                                {item.usuario_email && (
                                  <span className="text-muted-foreground font-mono text-[11px]">
                                    ({item.usuario_email})
                                  </span>
                                )}
                                <span className="text-muted-foreground ml-auto font-mono text-[11px]">
                                  {new Date(item.created_at).toLocaleString('pt-BR')}
                                </span>
                              </div>
                              <DiffView alteracao={item} />
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Paginação */}
        {!loading && totalCount > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t bg-muted/20 text-xs">
            <span className="text-muted-foreground">
              Total de <strong>{totalCount}</strong> alteração(ões) registradas · Página{' '}
              <strong>{page}</strong> de <strong>{totalPages}</strong>
            </span>
            <div className="flex items-center gap-2">
              <Select
                value={String(pageSize)}
                onValueChange={(val) => {
                  setPageSize(Number(val))
                  setPage(1)
                }}
              >
                <SelectTrigger className="h-8 w-24 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">15 por pág.</SelectItem>
                  <SelectItem value="25">25 por pág.</SelectItem>
                  <SelectItem value="50">50 por pág.</SelectItem>
                  <SelectItem value="100">100 por pág.</SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="h-8 px-2.5"
              >
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="h-8 px-2.5"
              >
                Próximo
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Modal de Reversão */}
      <ReverterConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        alteracao={selectedForRevert}
        onConfirm={handleConfirmRevert}
      />
    </div>
  )
}

function getAcaoBadgeStyle(acao: AcaoAlteracao): string {
  switch (acao) {
    case 'criado':
      return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
    case 'editado':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-300 dark:border-blue-800'
    case 'excluido':
      return 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300 dark:border-rose-800'
    case 'revertido':
      return 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-300 dark:border-purple-800'
    default:
      return 'bg-slate-100 text-slate-800'
  }
}

function formatAcao(acao: AcaoAlteracao): string {
  switch (acao) {
    case 'criado':
      return 'Criado'
    case 'editado':
      return 'Editado'
    case 'excluido':
      return 'Excluído'
    case 'revertido':
      return 'Revertido'
    default:
      return acao
  }
}

function formatAcaoPrefix(acao: AcaoAlteracao): string {
  switch (acao) {
    case 'criado':
      return 'Criado'
    case 'editado':
      return 'Editado'
    case 'excluido':
      return 'Excluído'
    case 'revertido':
      return 'Revertido'
    default:
      return 'Modificado'
  }
}

function getInitials(name: string): string {
  if (!name) return '?'
  return name
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

/**
 * Componente que renderiza a visualização antes → depois legível,
 * pensada para ser limpa e clara para usuários seniores.
 */
function DiffView({ alteracao }: { alteracao: RegistroAlteracao }) {
  const campos = alteracao.campos_alterados || []

  if (alteracao.acao === 'criado') {
    return (
      <div className="rounded-lg border bg-card p-4 space-y-2">
        <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-300 uppercase tracking-wide">
          Registro criado com os seguintes dados iniciais:
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 text-xs">
          {Object.entries(alteracao.dados_novos || {}).map(([key, val]) => {
            if (
              ['id', 'created_at', 'updated_at', 'fotos', 'especificacoes'].includes(key) ||
              val === null ||
              val === ''
            ) {
              return null
            }
            return (
              <div key={key} className="rounded border bg-muted/20 p-2">
                <span className="font-semibold text-muted-foreground block text-[11px]">
                  {CAMPOS_AMIGAVEIS[key] || key}:
                </span>
                <span className="text-foreground font-medium">{formatDisplayVal(val)}</span>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  if (alteracao.acao === 'excluido') {
    return (
      <div className="rounded-lg border bg-rose-50/50 dark:bg-rose-950/20 p-4 space-y-2">
        <p className="text-xs font-semibold text-rose-800 dark:text-rose-300 uppercase tracking-wide">
          Registro que foi excluído (snapshot dos dados originais):
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 text-xs">
          {Object.entries(alteracao.dados_anteriores || {}).map(([key, val]) => {
            if (
              ['id', 'created_at', 'updated_at', 'fotos', 'especificacoes'].includes(key) ||
              val === null ||
              val === ''
            ) {
              return null
            }
            return (
              <div key={key} className="rounded border bg-background p-2">
                <span className="font-semibold text-muted-foreground block text-[11px]">
                  {CAMPOS_AMIGAVEIS[key] || key}:
                </span>
                <span className="text-foreground font-medium">{formatDisplayVal(val)}</span>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // Ação de Edição: Exibir valores antigos riscados e novos em destaque
  if (campos.length === 0) {
    return (
      <div className="text-xs text-muted-foreground p-3 border rounded bg-background">
        Nenhum campo específico com diferença detectada.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-foreground uppercase tracking-wide">
          Campos alterados nesta edição ({campos.length}):
        </span>
        <span className="text-[11px] text-muted-foreground">
          <span className="text-rose-600 line-through mr-1">Vermelho riscado</span> = valor anterior
          · <span className="text-emerald-700 font-semibold ml-1">Verde</span> = novo valor
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {campos.map((c, idx) => {
          const nomeCampo = CAMPOS_AMIGAVEIS[c.campo] || c.campo
          return (
            <div
              key={idx}
              className="rounded-lg border bg-card p-3 shadow-xs space-y-1.5 hover:border-primary/40 transition-colors"
            >
              <div className="text-xs font-bold text-foreground flex items-center justify-between">
                <span>{nomeCampo}</span>
                <span className="text-[10px] font-mono text-muted-foreground/70">({c.campo})</span>
              </div>

              <div className="flex items-center gap-2 pt-1 text-xs">
                {/* Antes (riscado) */}
                <div className="flex-1 rounded bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 p-2">
                  <span className="block text-[10px] uppercase font-semibold text-rose-700 dark:text-rose-400 mb-0.5">
                    Antes
                  </span>
                  <span className="text-rose-800 dark:text-rose-200 line-through break-words font-medium">
                    {formatDisplayVal(c.de)}
                  </span>
                </div>

                <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />

                {/* Depois (destaque) */}
                <div className="flex-1 rounded bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/40 p-2">
                  <span className="block text-[10px] uppercase font-semibold text-emerald-700 dark:text-emerald-400 mb-0.5">
                    Depois
                  </span>
                  <span className="text-emerald-900 dark:text-emerald-100 font-bold break-words">
                    {formatDisplayVal(c.para)}
                  </span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function formatDisplayVal(val: unknown): string {
  if (val === null || val === undefined || val === '') return '— (Vazio)'
  if (typeof val === 'boolean') return val ? 'Sim' : 'Não'
  if (typeof val === 'number') {
    return val.toLocaleString('pt-BR')
  }
  if (typeof val === 'object') {
    try {
      return JSON.stringify(val)
    } catch {
      return String(val)
    }
  }
  return String(val)
}
