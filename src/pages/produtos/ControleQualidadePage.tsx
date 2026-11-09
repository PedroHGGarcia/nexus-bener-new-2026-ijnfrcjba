import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Loader2, RefreshCw, ShieldCheck, ShieldAlert } from 'lucide-react'
import { VersaoWithModelo } from '@/types/versao'
import { fetchVersoes } from '@/services/versoes'
import { PaginationBar } from '@/components/shared/table-controls'
import {
  PENDENCIA_LABELS,
  PENDENCIA_TIPOS,
  PendenciaTipo,
  detectarPendencias,
  isVersaoLiberada,
  resumoAlteracaoPreco,
} from '@/lib/catalogo-qualidade'

function fmtValor(valor: number | null, moeda: string) {
  const s: Record<string, string> = { BRL: 'R$', USD: '$', EUR: '€' }
  return `${s[moeda] ?? ''} ${(valor ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
}

function fmtData(iso: string | null) {
  if (!iso) return '—'
  const d = new Date(iso)
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString('pt-BR')
}

export default function ControleQualidadePage() {
  const [versoes, setVersoes] = useState<VersaoWithModelo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [filtro, setFiltro] = useState<PendenciaTipo | 'todas' | 'liberadas' | 'precos'>('todas')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const data = await fetchVersoes({ activeOnly: false })
      setVersoes(data.filter((v) => !v.deleted_at))
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const linhas = useMemo(
    () =>
      versoes.map((v) => ({
        versao: v,
        pendencias: detectarPendencias(v),
        liberada: isVersaoLiberada(v.status),
        resumoPreco: resumoAlteracaoPreco(v),
      })),
    [versoes],
  )

  const contadores = useMemo(() => {
    const c: Record<PendenciaTipo, number> = {
      foto_ausente: 0,
      especificacao_vazia: 0,
      caracteristicas_vazias: 0,
      preco_ausente: 0,
      tipos_proposta_vazios: 0,
      sem_modelo: 0,
    }
    for (const l of linhas) for (const p of l.pendencias) c[p]++
    return c
  }, [linhas])

  const totais = useMemo(
    () => ({
      liberadas: linhas.filter((l) => l.liberada).length,
      comPendencia: linhas.filter((l) => l.pendencias.length > 0).length,
      comAlteracaoPreco: linhas.filter((l) => l.resumoPreco).length,
    }),
    [linhas],
  )

  const filtradas = useMemo(() => {
    if (filtro === 'todas') return linhas
    if (filtro === 'liberadas') return linhas.filter((l) => l.liberada)
    if (filtro === 'precos') return linhas.filter((l) => l.resumoPreco)
    return linhas.filter((l) => l.pendencias.includes(filtro))
  }, [linhas, filtro])

  const paginadas = useMemo(
    () => filtradas.slice((page - 1) * pageSize, page * pageSize),
    [filtradas, page, pageSize],
  )

  useEffect(() => {
    setPage(1)
  }, [filtro])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Carregando catálogo...
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 py-16">
        <p className="text-destructive">Não foi possível carregar o catálogo.</p>
        <Button variant="outline" onClick={loadData}>
          <RefreshCw className="mr-2 h-4 w-4" /> Tentar novamente
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Controle de Qualidade do Catálogo</h1>
          <p className="text-sm text-muted-foreground">
            Pendências detectadas automaticamente nas versões ativas e inativas (sem exclusões em
            quarentena).
          </p>
        </div>
        <Button variant="outline" onClick={loadData}>
          <RefreshCw className="mr-2 h-4 w-4" /> Atualizar
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">Versões no catálogo</p>
          <p className="text-xl font-semibold">{linhas.length}</p>
        </div>
        <div className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">Liberadas (proposta e chatbot)</p>
          <p className="text-xl font-semibold">{totais.liberadas}</p>
        </div>
        <div className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">Com pendência</p>
          <p className="text-xl font-semibold">{totais.comPendencia}</p>
        </div>
        <div className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">Com alteração de preço registrada</p>
          <p className="text-xl font-semibold">{totais.comAlteracaoPreco}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant={filtro === 'todas' ? 'default' : 'outline'}
          onClick={() => setFiltro('todas')}
        >
          Todas ({linhas.length})
        </Button>
        <Button
          size="sm"
          variant={filtro === 'liberadas' ? 'default' : 'outline'}
          onClick={() => setFiltro('liberadas')}
        >
          Liberadas ({totais.liberadas})
        </Button>
        <Button
          size="sm"
          variant={filtro === 'precos' ? 'default' : 'outline'}
          onClick={() => setFiltro('precos')}
        >
          Alteração de preço ({totais.comAlteracaoPreco})
        </Button>
        {PENDENCIA_TIPOS.map((tipo) => (
          <Button
            key={tipo}
            size="sm"
            variant={filtro === tipo ? 'default' : 'outline'}
            onClick={() => setFiltro(tipo)}
          >
            {PENDENCIA_LABELS[tipo]} ({contadores[tipo]})
          </Button>
        ))}
      </div>

      {filtradas.length === 0 ? (
        <p className="py-10 text-center text-muted-foreground">Nenhuma versão para este filtro.</p>
      ) : (
        <>
          <div className="rounded-md border overflow-x-auto shadow-sm">
            <Table className="w-full table-fixed">
              <colgroup>
                <col className="w-[28%]" />
                <col className="w-[18%]" />
                <col className="w-[140px]" />
                <col className="w-[24%]" />
                <col className="w-[20%]" />
              </colgroup>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="py-3 px-3">Versão</TableHead>
                  <TableHead className="py-3 px-3">Modelo</TableHead>
                  <TableHead className="py-3 px-3 whitespace-nowrap">Status</TableHead>
                  <TableHead className="py-3 px-3">Pendências</TableHead>
                  <TableHead className="py-3 px-3">Alteração de preço</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginadas.map(({ versao: v, pendencias, liberada, resumoPreco }) => (
                  <TableRow key={v.id}>
                    <TableCell className="font-medium py-2.5 px-3 truncate" title={v.nome}>
                      <span className="truncate block">{v.nome}</span>
                      {v.cod_erp && (
                        <span className="block text-xs text-muted-foreground truncate">
                          {v.cod_erp}
                        </span>
                      )}
                    </TableCell>
                    <TableCell
                      className="py-2.5 px-3 truncate"
                      title={v.modelos?.nome ?? undefined}
                    >
                      {v.modelos?.nome ?? '—'}
                    </TableCell>
                    <TableCell className="py-2.5 px-3 whitespace-nowrap">
                      {liberada ? (
                        <Badge className="gap-1 text-xs">
                          <ShieldCheck className="h-3 w-3" /> Liberada
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="gap-1 text-xs">
                          <ShieldAlert className="h-3 w-3" /> Não liberada ({v.status})
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="py-2.5 px-3">
                      {pendencias.length === 0 ? (
                        <span className="text-xs text-emerald-600 font-medium">Sem pendências</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {pendencias.map((p) => (
                            <Badge
                              key={p}
                              variant="destructive"
                              className="font-normal text-[11px] py-0"
                            >
                              {PENDENCIA_LABELS[p]}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm py-2.5 px-3 truncate">
                      {resumoPreco ? (
                        <div className="truncate">
                          <span className="text-muted-foreground text-xs">
                            {fmtValor(resumoPreco.anterior, v.moeda)} →{' '}
                          </span>
                          <span className="font-medium text-xs">
                            {fmtValor(resumoPreco.atual, v.moeda)}
                          </span>
                          {resumoPreco.variacaoPct !== null && (
                            <span className="ml-1 text-[11px]">
                              ({resumoPreco.variacaoPct > 0 ? '+' : ''}
                              {resumoPreco.variacaoPct.toFixed(1)}%)
                            </span>
                          )}
                          <span className="block text-[11px] text-muted-foreground">
                            Reajuste em {fmtData(resumoPreco.data)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <PaginationBar
            page={page}
            pageSize={pageSize}
            total={filtradas.length}
            onPageChange={setPage}
            onPageSizeChange={(s) => {
              setPageSize(s)
              setPage(1)
            }}
          />
        </>
      )}
    </div>
  )
}
