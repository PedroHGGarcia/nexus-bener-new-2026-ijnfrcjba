import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Info,
  DollarSign,
  Package,
  Wrench,
  Link2,
  Cpu,
  Layers,
  Image as ImageIcon,
  CheckCircle2,
  XCircle,
  Camera,
} from 'lucide-react'
import { VersaoWithModelo } from '@/types/versao'
import { formatCurrencyByMoeda } from '@/lib/format'
import { fetchVersaoTiposProposta } from '@/services/versoes'
import { fetchTiposProposta } from '@/services/tipos-proposta'
import { TipoProposta } from '@/types/tipo-proposta'
import { TechnicalDataDisplay } from '@/components/produtos/TechnicalDataDisplay'

export interface VersaoDetalhesData extends VersaoWithModelo {
  _modeloNome?: string
  _marcaNome?: string
  _produtoNome?: string
  _categoriaNome?: string
}

interface VersaoDetalhesDialogProps {
  versao: VersaoDetalhesData | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function VersaoDetalhesDialog({ versao, open, onOpenChange }: VersaoDetalhesDialogProps) {
  const [tiposVinculadosNomes, setTiposVinculadosNomes] = useState<string[]>([])
  const [loadingTipos, setLoadingTipos] = useState(false)

  useEffect(() => {
    if (!versao?.id || !open) {
      setTiposVinculadosNomes([])
      setLoadingTipos(false)
      return
    }

    let isMounted = true
    setLoadingTipos(true)

    Promise.all([fetchVersaoTiposProposta(versao.id), fetchTiposProposta()])
      .then(([linkedIds, allTipos]: [string[], TipoProposta[]]) => {
        if (!isMounted) return
        const mapIdToNome = new Map(allTipos.map((t) => [t.id, t.nome]))
        const nomesFromJoin = linkedIds
          .map((id) => mapIdToNome.get(id))
          .filter((n): n is string => !!n)

        // Se a join table tiver registros, usa eles; senão faz fallback para o array de strings em versao.tipos_proposta
        if (nomesFromJoin.length > 0) {
          setTiposVinculadosNomes(nomesFromJoin)
        } else if (Array.isArray(versao.tipos_proposta) && versao.tipos_proposta.length > 0) {
          setTiposVinculadosNomes(versao.tipos_proposta)
        } else {
          setTiposVinculadosNomes([])
        }
      })
      .catch((err) => {
        console.error('Erro ao carregar tipos vinculados da versão:', err)
        if (isMounted) {
          setTiposVinculadosNomes(Array.isArray(versao.tipos_proposta) ? versao.tipos_proposta : [])
        }
      })
      .finally(() => {
        if (isMounted) setLoadingTipos(false)
      })

    return () => {
      isMounted = false
    }
  }, [versao, open])

  if (!versao) return null

  const isAtivo = versao.status === 'Ativo' || versao.status === 'A'
  const modeloNome = versao._modeloNome || versao.modelos?.nome || '—'
  const marcaNome = versao._marcaNome || '—'
  const produtoNome = versao._produtoNome || '—'
  const categoriaNome = versao._categoriaNome || versao.categorias_produtos?.nome || '—'

  // Coleta todas as fotos técnicas (galeria + imagem_preview)
  const galeriaUrls: string[] = []
  if (versao.imagem_preview) {
    galeriaUrls.push(versao.imagem_preview)
  }
  if (Array.isArray(versao.galeria)) {
    for (const item of versao.galeria) {
      if (typeof item === 'string' && item) {
        if (!galeriaUrls.includes(item)) galeriaUrls.push(item)
      } else if (item && typeof item === 'object' && (item as any).url) {
        const u = (item as any).url
        if (typeof u === 'string' && !galeriaUrls.includes(u)) galeriaUrls.push(u)
      }
    }
  } else if (versao.galeria && typeof versao.galeria === 'object') {
    const arr = (versao.galeria as any).imagens || (versao.galeria as any).fotos
    if (Array.isArray(arr)) {
      for (const item of arr) {
        const u = typeof item === 'string' ? item : (item as any)?.url
        if (typeof u === 'string' && !galeriaUrls.includes(u)) galeriaUrls.push(u)
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0">
        {/* Cabeçalho Fixo */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0 text-left bg-background">
          <div className="flex flex-wrap items-center justify-between gap-3 pr-6">
            <div className="space-y-1">
              <DialogTitle className="text-xl font-bold flex items-center gap-2 text-foreground">
                <Cpu className="w-5 h-5 text-[#0b3c26]" />
                {versao.nome}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Detalhes completos da versão no catálogo (somente leitura).
              </DialogDescription>
            </div>
            <Badge
              variant="secondary"
              className={
                isAtivo
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 font-semibold px-2.5 py-1 text-xs'
                  : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 font-semibold px-2.5 py-1 text-xs'
              }
            >
              {isAtivo ? 'Versão Ativa' : 'Versão Inativa'}
            </Badge>
          </div>
        </DialogHeader>

        {/* Corpo Rolável */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Cascata / Hierarquia */}
          <div className="border rounded-lg bg-card p-4 space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-primary" />
              Hierarquia da Máquina
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div className="p-2.5 rounded-md bg-muted/40 border">
                <div className="text-[11px] text-muted-foreground font-medium flex items-center justify-between">
                  <span>Categoria</span>
                  {versao.categoria_id && (
                    <span className="text-[9px] text-emerald-700 dark:text-emerald-400 font-semibold uppercase">
                      Na Versão
                    </span>
                  )}
                </div>
                <div
                  className="font-semibold text-foreground mt-0.5 truncate"
                  title={categoriaNome}
                >
                  {categoriaNome}
                </div>
              </div>
              <div className="p-2.5 rounded-md bg-muted/40 border">
                <div className="text-[11px] text-muted-foreground font-medium">Produto</div>
                <div className="font-semibold text-foreground mt-0.5 truncate" title={produtoNome}>
                  {produtoNome}
                </div>
              </div>
              <div className="p-2.5 rounded-md bg-muted/40 border">
                <div className="text-[11px] text-muted-foreground font-medium">Marca</div>
                <div className="font-semibold text-foreground mt-0.5 truncate" title={marcaNome}>
                  {marcaNome}
                </div>
              </div>
              <div className="p-2.5 rounded-md bg-muted/40 border">
                <div className="text-[11px] text-muted-foreground font-medium">Modelo</div>
                <div className="font-semibold text-foreground mt-0.5 truncate" title={modeloNome}>
                  {modeloNome}
                </div>
              </div>
            </div>
          </div>

          {/* Identificação e Imagem */}
          <div className="border rounded-lg bg-card p-4 space-y-4">
            <h3 className="text-sm font-semibold flex items-center gap-1.5">
              <Info className="w-4 h-4 text-muted-foreground" /> Identificação da Versão
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
              <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <div className="text-muted-foreground font-medium">Nome Completo</div>
                  <div className="text-sm font-semibold text-foreground mt-0.5">{versao.nome}</div>
                </div>
                <div>
                  <div className="text-muted-foreground font-medium">Nome Abreviado</div>
                  <div className="text-sm font-medium text-foreground mt-0.5">
                    {versao.nome_abreviado || '—'}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground font-medium">Código ERP</div>
                  <div className="text-sm font-mono font-medium text-foreground mt-0.5">
                    {versao.cod_erp || '—'}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground font-medium">REG</div>
                  <div className="text-sm font-mono font-medium text-[#0b3c26] mt-0.5">
                    {(versao as any).reg || versao.cod_erp || '—'}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground font-medium">Status do Catálogo</div>
                  <div className="text-sm font-medium text-foreground mt-0.5 flex items-center gap-1.5">
                    {isAtivo ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>Ativo</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="w-4 h-4 text-slate-500" />
                        <span>Inativo</span>
                      </>
                    )}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground font-medium">Última Atualização Por</div>
                  <div className="text-sm font-medium text-foreground mt-0.5">
                    {versao.atualizado_por || 'Sistema'}
                  </div>
                </div>
              </div>

              {/* Preview da Imagem */}
              <div className="flex flex-col items-center justify-center p-3 border rounded-lg bg-muted/20">
                <div className="text-[11px] font-medium text-muted-foreground mb-2">
                  Imagem da Máquina
                </div>
                {versao.imagem_preview ? (
                  <img
                    src={versao.imagem_preview}
                    alt={versao.nome}
                    className="max-h-36 max-w-full object-contain rounded border bg-white p-1 shadow-xs"
                  />
                ) : (
                  <div className="h-28 w-full border border-dashed rounded flex flex-col items-center justify-center text-muted-foreground gap-1 bg-muted/30">
                    <ImageIcon className="w-6 h-6 opacity-40" />
                    <span className="text-[11px]">Sem imagem cadastrada</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Valores Comerciais */}
          <div className="border rounded-lg bg-card p-4 space-y-4">
            <h3 className="text-sm font-semibold flex items-center gap-1.5">
              <DollarSign className="w-4 h-4 text-muted-foreground" /> Dados Comerciais & Preços
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
              <div className="p-3 rounded-md bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/50 dark:border-emerald-900/40">
                <div className="text-emerald-800 dark:text-emerald-300 font-medium">
                  Preço de Tabela ({versao.moeda || 'BRL'})
                </div>
                <div className="text-lg font-bold text-emerald-900 dark:text-emerald-200 mt-1">
                  {formatCurrencyByMoeda(versao.valor, versao.moeda)}
                </div>
              </div>

              <div className="p-3 rounded-md bg-muted/40 border">
                <div className="text-muted-foreground font-medium">Desconto Máx. Representante</div>
                <div className="text-base font-semibold text-foreground mt-1">
                  {versao.desconto_max_representante ?? 0}%
                </div>
              </div>

              <div className="p-3 rounded-md bg-muted/40 border">
                <div className="text-muted-foreground font-medium">Desconto Máx. Bener</div>
                <div className="text-base font-semibold text-foreground mt-1">
                  {versao.desconto_max_bener ?? 0}%
                </div>
              </div>

              <div className="p-3 rounded-md bg-muted/40 border">
                <div className="text-muted-foreground font-medium">Fator NAC</div>
                <div className="text-base font-semibold text-foreground mt-1">
                  {versao.tem_fator ? `${versao.fator_nac ?? 1} (Ativo)` : 'Não utiliza'}
                </div>
              </div>
            </div>
          </div>

          {/* Estoque */}
          <div className="border rounded-lg bg-card p-4 space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-1.5">
              <Package className="w-4 h-4 text-muted-foreground" /> Controle de Estoque
            </h3>
            {versao.tem_estoque ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-2.5 rounded-md border bg-muted/30">
                  <div className="text-muted-foreground">Estoque Total</div>
                  <div className="text-base font-semibold text-foreground mt-0.5 tabular-nums">
                    {versao.estoque_total ?? 0}
                  </div>
                </div>
                <div className="p-2.5 rounded-md border bg-muted/30">
                  <div className="text-muted-foreground">Bloqueado</div>
                  <div className="text-base font-semibold text-amber-700 dark:text-amber-400 mt-0.5 tabular-nums">
                    {versao.estoque_bloqueado ?? 0}
                  </div>
                </div>
                <div className="p-2.5 rounded-md border bg-muted/30">
                  <div className="text-muted-foreground">Reservado</div>
                  <div className="text-base font-semibold text-blue-700 dark:text-blue-400 mt-0.5 tabular-nums">
                    {versao.estoque_reservado ?? 0}
                  </div>
                </div>
                <div className="p-2.5 rounded-md border bg-emerald-50/60 dark:bg-emerald-950/30 border-emerald-200/50">
                  <div className="text-emerald-800 dark:text-emerald-300 font-medium">
                    Disponível
                  </div>
                  <div className="text-base font-bold text-emerald-900 dark:text-emerald-200 mt-0.5 tabular-nums">
                    {versao.estoque_disponivel ?? 0}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic">
                Esta versão não possui controle de estoque ativado.
              </p>
            )}
          </div>

          {/* Tipos de Proposta Vinculados */}
          <div className="border rounded-lg bg-card p-4 space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-1.5">
              <Link2 className="w-4 h-4 text-muted-foreground" /> Tipos de Proposta Vinculados
            </h3>
            {loadingTipos ? (
              <div className="flex flex-wrap gap-1.5">
                <Skeleton className="h-6 w-24 rounded-md" />
                <Skeleton className="h-6 w-28 rounded-md" />
                <Skeleton className="h-6 w-20 rounded-md" />
              </div>
            ) : tiposVinculadosNomes.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {tiposVinculadosNomes.map((tipo) => (
                  <Badge
                    key={tipo}
                    variant="outline"
                    className="border-emerald-600/40 text-emerald-800 dark:text-emerald-300 bg-emerald-50/70 dark:bg-emerald-950/40 text-xs font-medium px-2.5 py-1"
                  >
                    {tipo}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic">
                Nenhum tipo de proposta vinculado a esta versão.
              </p>
            )}
          </div>

          {/* Dados Técnicos */}
          <div className="border rounded-lg bg-card p-4 space-y-5">
            <h3 className="text-sm font-semibold flex items-center gap-1.5 text-foreground">
              <Wrench className="w-4 h-4 text-[#0b3c26]" /> Seção Técnica do Equipamento
            </h3>

            {/* Galeria de Fotos Técnicas */}
            {galeriaUrls.length > 0 && (
              <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50/50 p-3.5 dark:border-slate-800 dark:bg-slate-900/40">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Camera className="h-3.5 w-3.5 text-[#0b3c26]" />
                  Fotos do Equipamento ({galeriaUrls.length})
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 pt-1">
                  {galeriaUrls.map((url, idx) => (
                    <a
                      key={url || idx}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group relative block h-24 rounded-md border border-slate-200 bg-white dark:bg-slate-900 overflow-hidden hover:border-[#0b3c26] transition-colors"
                      title="Clique para abrir imagem em tamanho real"
                    >
                      <img
                        src={url}
                        alt={`Foto do equipamento ${idx + 1}`}
                        className="h-full w-full object-contain p-1"
                        loading="lazy"
                      />
                    </a>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                Acessórios Standards
              </div>
              <TechnicalDataDisplay
                content={versao.acessorios_standards}
                emptyMessage="Nenhum acessório standard cadastrado."
              />
            </div>

            <div className="space-y-2">
              <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                Características Construtivas
              </div>
              <TechnicalDataDisplay
                content={versao.caracteristicas_construtivas}
                emptyMessage="Nenhuma característica construtiva cadastrada."
              />
            </div>

            <div className="space-y-2">
              <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                Especificações Técnicas
              </div>
              <TechnicalDataDisplay
                content={versao.especificacoes_tecnicas}
                emptyMessage="Nenhuma especificação técnica cadastrada."
              />
            </div>
          </div>
        </div>

        {/* Rodapé Fixo */}
        <div className="border-t px-6 py-4 flex justify-end shrink-0 bg-background">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="min-w-[90px]"
          >
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
