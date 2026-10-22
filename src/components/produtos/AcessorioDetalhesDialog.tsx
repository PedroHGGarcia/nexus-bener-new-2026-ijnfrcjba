import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Package, DollarSign, Wrench, Layers } from 'lucide-react'
import { Acessorio } from '@/types/acessorio'
import { formatCurrency } from '@/lib/format'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  acessorio: Acessorio | null
}

export function AcessorioDetalhesDialog({ open, onOpenChange, acessorio }: Props) {
  if (!acessorio) return null

  const isAtivo = acessorio.status === 'Ativo'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between gap-3 pr-6">
            <div className="space-y-1">
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                <Package className="w-5 h-5 text-[#0b3c26]" />
                {acessorio.nome}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Visualização de detalhes do acessório opcional (somente leitura).
              </DialogDescription>
            </div>
            <Badge
              variant="secondary"
              className={
                isAtivo
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 font-semibold'
                  : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 font-semibold'
              }
            >
              {acessorio.status ?? '—'}
            </Badge>
          </div>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Dados Gerais & Preços */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3 rounded-md bg-muted/40 border">
              <div className="text-[11px] text-muted-foreground font-medium">Tipo</div>
              <div className="text-sm font-semibold mt-0.5">{acessorio.tipo || '—'}</div>
            </div>
            <div className="p-3 rounded-md bg-muted/40 border">
              <div className="text-[11px] text-muted-foreground font-medium">Moeda</div>
              <div className="text-sm font-semibold mt-0.5">{acessorio.moeda || 'BRL'}</div>
            </div>
            <div className="p-3 rounded-md bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/50">
              <div className="text-[11px] text-emerald-800 dark:text-emerald-300 font-medium">
                Valor
              </div>
              <div className="text-sm font-bold text-emerald-900 dark:text-emerald-200 mt-0.5 font-mono">
                {acessorio.valor != null ? formatCurrency(acessorio.valor) : '—'}
              </div>
            </div>
            <div className="p-3 rounded-md bg-muted/40 border">
              <div className="text-[11px] text-muted-foreground font-medium">Fator NAC</div>
              <div className="text-sm font-semibold mt-0.5">{acessorio.fator_nac ?? 1}</div>
            </div>
          </div>

          {/* Versões Vinculadas */}
          <div className="rounded-lg border bg-card p-4 space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
              <Layers className="w-4 h-4 text-primary" />
              <span>Versões Vinculadas</span>
            </div>
            {Array.isArray(acessorio.versao_nomes) && acessorio.versao_nomes.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {acessorio.versao_nomes.map((nome, idx) => (
                  <Badge key={idx} variant="outline" className="text-xs font-normal">
                    {nome}
                  </Badge>
                ))}
              </div>
            ) : Array.isArray(acessorio.versoes) && acessorio.versoes.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 pt-1">
                <Badge variant="outline" className="font-mono text-xs font-semibold">
                  {acessorio.versoes.length}{' '}
                  {acessorio.versoes.length === 1 ? 'versão vinculada' : 'versões vinculadas'}
                </Badge>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic pt-1">Nenhuma versão vinculada.</p>
            )}
          </div>

          {/* Especificações Técnicas */}
          <div className="rounded-lg border bg-card p-4 space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
              <Wrench className="w-4 h-4 text-primary" />
              <span>Especificações Técnicas</span>
            </div>
            <div className="text-xs bg-muted/40 p-3 rounded-md border min-h-[60px] whitespace-pre-wrap text-foreground">
              {acessorio.especificacoes_tecnicas || (
                <span className="text-muted-foreground italic">
                  Nenhuma especificação técnica informada.
                </span>
              )}
            </div>
          </div>

          {/* Botão Fechar */}
          <div className="flex justify-end pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
