import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ArrowLeft, Edit, Link2, Eye, Printer, Loader2, FileText, AlertCircle } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { LoadingState, EmptyState, ErrorState } from '@/components/StateViews'
import { VincularPropostaDialog } from '@/components/projetos/VincularPropostaDialog'
import { CreatorDisplay } from '@/components/projetos/CreatorDisplay'
import { ProjectStats } from '@/components/projetos/ProjectStats'
import { ActivityTimeline } from '@/components/projetos/ActivityTimeline'
import { TeamMembersSection } from '@/components/projetos/TeamMembersSection'
import { ProjetoWithRelations, PROJETO_STATUS_OPTIONS } from '@/types/projeto'
import { PropostaWithRelations, STATUS_LABELS } from '@/types/proposta'
import { fetchProjetoById, fetchPropostasByProjeto } from '@/services/projetos'
import { printProposalPdf, generateProposalPdf } from '@/services/proposal-pdf'
import { formatDate, formatCurrency } from '@/lib/format'

function isVersaoInvalida(p: PropostaWithRelations): boolean {
  const v = p.versoes as { status?: string | null; deleted_at?: string | null } | null | undefined
  if (!v) return false
  const statusLower = (v.status || '').toLowerCase()
  return (
    statusLower === 'em quarentena' ||
    statusLower === 'quarentena' ||
    statusLower === 'inativo' ||
    !!v.deleted_at
  )
}

function getBaseNumero(numero: string | null): string {
  if (!numero) return ''
  const match = numero.match(/^(.+)-([A-Z])$/)
  return match ? match[1] : numero
}

function getRevisaoLetter(p: PropostaWithRelations): string {
  if (p.revisao && p.revisao.length === 1) return p.revisao.toUpperCase()
  const match = (p.numero_proposta || '').match(/-([A-Z])$/)
  return match ? match[1] : 'A'
}

function pickActiveProposal(chain: PropostaWithRelations[]): PropostaWithRelations | null {
  const nonExcluded = chain.filter((p) => p.status !== 'Excluida' && p.status !== 'Rejeitada')
  const pool = nonExcluded.length > 0 ? nonExcluded : chain

  const validPool = pool.filter((p) => !isVersaoInvalida(p))
  const candidates = validPool.length > 0 ? validPool : pool

  const sorted = [...candidates].sort((a, b) => {
    const revA = getRevisaoLetter(a)
    const revB = getRevisaoLetter(b)
    if (revA !== revB) return revB.localeCompare(revA)
    const timeA = a.created_at ? new Date(a.created_at).getTime() : 0
    const timeB = b.created_at ? new Date(b.created_at).getTime() : 0
    return timeB - timeA
  })

  return sorted[0] || null
}

export default function ProjetoDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [project, setProject] = useState<ProjetoWithRelations | null>(null)
  const [propostas, setPropostas] = useState<PropostaWithRelations[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [linkDialogOpen, setLinkDialogOpen] = useState(false)
  const [printingId, setPrintingId] = useState<string | null>(null)
  const [generatingPdfId, setGeneratingPdfId] = useState<string | null>(null)

  const propostasAgrupadas = useMemo(() => {
    const map = new Map<string, PropostaWithRelations[]>()
    for (const p of propostas) {
      const base = getBaseNumero(p.numero_proposta) || p.id
      const list = map.get(base) ?? []
      list.push(p)
      map.set(base, list)
    }

    const grouped: Array<{
      baseNumero: string
      activeProposal: PropostaWithRelations
      allProposals: PropostaWithRelations[]
      totalVersoes: number
    }> = []

    for (const [baseNumero, list] of map.entries()) {
      const active = pickActiveProposal(list)
      if (active) {
        grouped.push({
          baseNumero,
          activeProposal: active,
          allProposals: list,
          totalVersoes: list.length,
        })
      }
    }

    return grouped
  }, [propostas])

  const handlePrintProposta = useCallback(async (propostaId: string) => {
    setPrintingId(propostaId)
    try {
      await printProposalPdf(propostaId)
    } catch (err) {
      toast({
        title: 'Erro ao imprimir PDF',
        description: err instanceof Error ? err.message : 'Erro desconhecido',
        variant: 'destructive',
      })
    } finally {
      setPrintingId(null)
    }
  }, [])

  const handleVerPdfProposta = useCallback(async (p: PropostaWithRelations) => {
    setGeneratingPdfId(p.id)
    try {
      const res = await generateProposalPdf(p.id)
      if (res.ok && res.data?.pdfUrl) {
        window.open(res.data.pdfUrl, '_blank')
      } else {
        window.open(`/proposta/${p.id}/imprimir`, '_blank')
      }
    } catch {
      window.open(`/proposta/${p.id}/imprimir`, '_blank')
    } finally {
      setGeneratingPdfId(null)
    }
  }, [])

  const loadProject = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(false)
    try {
      const [proj, props] = await Promise.all([fetchProjetoById(id), fetchPropostasByProjeto(id)])
      if (!proj) {
        toast({ title: 'Projeto não encontrado', variant: 'destructive' })
        navigate('/projetos')
        return
      }
      setProject(proj)
      setPropostas(props)
    } catch {
      setError(true)
      toast({ title: 'Erro ao carregar projeto', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [id, navigate])

  useEffect(() => {
    loadProject()
  }, [loadProject])

  const statusLabel = (status: string) =>
    PROJETO_STATUS_OPTIONS.find((s) => s.value === status)?.label ?? status

  if (loading || (!project && !error)) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" size="sm" onClick={() => navigate('/projetos')} className="gap-1">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Button>
        <LoadingState count={4} />
      </div>
    )
  }

  if (error || !project) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" size="sm" onClick={() => navigate('/projetos')} className="gap-1">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Button>
        <ErrorState message="Erro ao carregar projeto" onRetry={loadProject} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate('/projetos')} className="gap-1">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Button>
        <Button
          onClick={() => navigate(`/projetos/${project.id}/editar`)}
          variant="outline"
          className="gap-1"
        >
          <Edit className="w-4 h-4" /> Editar
        </Button>
      </div>

      <ProjectStats
        propostas={propostas}
        createdAt={project.created_at}
        updatedAt={project.updated_at}
      />

      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <CardTitle className="text-xl">{project.nome}</CardTitle>
            <Badge>{statusLabel(project.status)}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <div className="p-3 border rounded">
              <span className="text-xs text-muted-foreground">Cliente</span>
              <div className="text-sm font-semibold">{project.clientes?.fantasia ?? '—'}</div>
            </div>
            <div className="p-3 border rounded">
              <span className="text-xs text-muted-foreground">Criado por</span>
              <div className="mt-1">
                <CreatorDisplay creator={project.creator} rawUser={project.user} />
              </div>
            </div>
            <div className="p-3 border rounded">
              <span className="text-xs text-muted-foreground">Criado em</span>
              <div className="text-sm font-semibold">{formatDate(project.created_at)}</div>
            </div>
          </div>
          <div>
            <h4 className="text-sm font-semibold mb-1">Descrição</h4>
            <p className="text-sm text-muted-foreground bg-muted/30 p-3 rounded">
              {project.descricao || '—'}
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle className="text-base">Propostas Vinculadas ({propostas.length})</CardTitle>
              <Button
                size="sm"
                onClick={() => setLinkDialogOpen(true)}
                className="gap-1 bg-primary"
              >
                <Link2 className="w-4 h-4" /> Vincular
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {propostas.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-sm font-medium text-muted-foreground">
                  Nenhuma proposta vinculada a este projeto
                </p>
                <p className="text-xs text-muted-foreground/80 mt-1">
                  Use o botão &quot;Vincular&quot; acima para associar propostas a este projeto.
                </p>
              </div>
            ) : (
              <>
                {/* Destaque visual: Acesso rápido ao PDF da(s) proposta(s) ativa(s) */}
                <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-primary" />
                      PDF da Proposta (versão ativa)
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {propostasAgrupadas.length}{' '}
                      {propostasAgrupadas.length === 1 ? 'proposta' : 'propostas'}
                    </span>
                  </div>
                  <div className="flex flex-col gap-2">
                    {propostasAgrupadas.map(({ baseNumero, activeProposal, totalVersoes }) => {
                      const versaoInvalida = isVersaoInvalida(activeProposal)
                      const isGenerating = generatingPdfId === activeProposal.id
                      return (
                        <div
                          key={baseNumero}
                          className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-md bg-card border text-sm"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-primary">
                                {activeProposal.numero_proposta ?? baseNumero}
                              </span>
                              <Badge variant="outline" className="text-[11px]">
                                {STATUS_LABELS[activeProposal.status] ?? activeProposal.status}
                              </Badge>
                              {totalVersoes > 1 && (
                                <Badge variant="secondary" className="text-[10px]">
                                  {totalVersoes} revisões (ativa: {getRevisaoLetter(activeProposal)}
                                  )
                                </Badge>
                              )}
                              {versaoInvalida && (
                                <Badge variant="destructive" className="text-[10px] gap-1">
                                  <AlertCircle className="w-3 h-3" /> Máquina inativa/quarentena
                                </Badge>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground truncate mt-0.5">
                              {activeProposal.clientes?.fantasia ?? 'Cliente não informado'} •{' '}
                              {formatCurrency(activeProposal.valor_final)}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Button
                              size="sm"
                              className="bg-primary gap-1.5 text-xs h-8"
                              disabled={isGenerating}
                              onClick={() => handleVerPdfProposta(activeProposal)}
                              title="Abre o PDF da proposta comercial"
                            >
                              {isGenerating ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <FileText className="w-3.5 h-3.5" />
                              )}
                              Ver PDF da proposta
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs h-8 gap-1"
                              onClick={() =>
                                navigate(`/controle-propostas/proposta-pdf/${activeProposal.id}`)
                              }
                              title="Visualizar documento e assinaturas"
                            >
                              <Eye className="w-3.5 h-3.5" /> Detalhes
                            </Button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Tabela completa das propostas/revisões vinculadas */}
                <div className="overflow-x-auto border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Número</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {propostas.map((p) => {
                        const isPrinting = printingId === p.id
                        return (
                          <TableRow key={p.id}>
                            <TableCell className="font-semibold text-sm">
                              {p.numero_proposta ?? '—'}
                            </TableCell>
                            <TableCell className="text-sm">{p.clientes?.fantasia ?? '—'}</TableCell>
                            <TableCell className="text-sm font-semibold">
                              {formatCurrency(p.valor_final)}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{STATUS_LABELS[p.status] ?? p.status}</Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex gap-1 justify-end items-center">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() =>
                                    navigate(`/controle-propostas/proposta-pdf/${p.id}`)
                                  }
                                  className="h-8 w-8 p-0"
                                  title="Ver documento / assinaturas"
                                  aria-label={`Ver proposta ${p.numero_proposta ?? ''}`}
                                >
                                  <Eye className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handlePrintProposta(p.id)}
                                  disabled={isPrinting}
                                  className="h-8 w-8 p-0"
                                  title="Imprimir"
                                  aria-label={`Imprimir proposta ${p.numero_proposta ?? ''}`}
                                >
                                  {isPrinting ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <Printer className="w-4 h-4" />
                                  )}
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <ActivityTimeline projetoId={project.id} />
      </div>

      <TeamMembersSection projetoId={project.id} />

      <VincularPropostaDialog
        open={linkDialogOpen}
        onOpenChange={setLinkDialogOpen}
        projetoId={project.id}
        onLinked={loadProject}
      />
    </div>
  )
}
