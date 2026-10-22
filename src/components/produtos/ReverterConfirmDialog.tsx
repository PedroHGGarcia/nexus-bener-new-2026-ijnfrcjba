import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { AlertCircle, RotateCcw, Loader2, ArrowRight } from 'lucide-react'
import {
  type RegistroAlteracao,
  ENTIDADE_LABELS,
  ACAO_LABELS,
  CAMPOS_AMIGAVEIS,
} from '@/services/registro-alteracoes'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  alteracao: RegistroAlteracao | null
  onConfirm: () => Promise<void>
}

export function ReverterConfirmDialog({ open, onOpenChange, alteracao, onConfirm }: Props) {
  const [loading, setLoading] = useState(false)

  if (!alteracao) return null

  const entidadeLabel = ENTIDADE_LABELS[alteracao.entidade] || alteracao.entidade
  const acaoLabel = ACAO_LABELS[alteracao.acao] || alteracao.acao
  const nomeItem = alteracao.registro_nome || 'Registro'
  const dataFormatada = new Date(alteracao.created_at).toLocaleString('pt-BR')
  const autorNome = alteracao.usuario_nome || 'Sistema'
  const autorEmail = alteracao.usuario_email
  const autor = autorEmail ? `${autorNome} (${autorEmail})` : autorNome

  const handleConfirm = async () => {
    setLoading(true)
    try {
      await onConfirm()
      onOpenChange(false)
    } finally {
      setLoading(false)
    }
  }

  let explicacaoAcao = ''
  if (alteracao.acao === 'editado') {
    explicacaoAcao = `Esta ação irá restaurar os dados de "${nomeItem}" para o estado imediatamente anterior a esta edição feita por ${autor}.`
  } else if (alteracao.acao === 'excluido') {
    explicacaoAcao = `Esta ação irá reativar ou recriar ${entidadeLabel} "${nomeItem}" com os dados existentes antes da exclusão feita por ${autor}.`
  } else if (alteracao.acao === 'criado') {
    explicacaoAcao = `Atenção: como esta alteração foi uma criação original feita por ${autor}, revertê-la irá DESATIVAR ou EXCLUIR este registro de ${entidadeLabel}. Se houver vínculos em propostas ou modelos, ele será movido para quarentena com segurança.`
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">
              <RotateCcw className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <DialogTitle className="text-lg">Confirmar Reversão de Alteração</DialogTitle>
              <DialogDescription className="text-xs">
                Revise os detalhes abaixo antes de confirmar o restauro.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 text-sm py-1">
          {/* Box de contexto */}
          <div className="rounded-lg border bg-muted/40 p-3.5 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Entidade:</span>
              <span className="font-semibold text-foreground uppercase tracking-wide">
                {entidadeLabel}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Item:</span>
              <span className="font-semibold text-foreground truncate max-w-[260px]">
                {nomeItem}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Tipo de alteração original:</span>
              <span className="font-semibold text-foreground">{acaoLabel}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Feito por:</span>
              <div className="text-right">
                <span className="font-bold text-foreground block">{autorNome}</span>
                {autorEmail && (
                  <span className="text-[11px] text-muted-foreground font-mono">{autorEmail}</span>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Quando:</span>
              <span className="font-mono text-foreground">{dataFormatada}</span>
            </div>
          </div>

          {/* O que será feito */}
          <div className="rounded-lg border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/20 p-3.5 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
            <div className="text-xs text-amber-900 dark:text-amber-200 space-y-1">
              <p className="font-semibold">O que vai acontecer:</p>
              <p>{explicacaoAcao}</p>
            </div>
          </div>

          {/* Campos que serão restaurados (se edição) */}
          {alteracao.acao === 'editado' &&
            alteracao.campos_alterados &&
            alteracao.campos_alterados.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Valores que serão restaurados:
                </span>
                <div className="max-h-36 overflow-y-auto rounded border bg-background divide-y text-xs">
                  {alteracao.campos_alterados.slice(0, 6).map((c, i) => (
                    <div key={i} className="p-2 flex items-center justify-between gap-2">
                      <span className="font-medium text-foreground">
                        {CAMPOS_AMIGAVEIS[c.campo] || c.campo}:
                      </span>
                      <div className="flex items-center gap-1.5 font-mono text-[11px] truncate max-w-[220px]">
                        <span className="text-destructive line-through">
                          {formatValorSimples(c.para)}
                        </span>
                        <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />
                        <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
                          {formatValorSimples(c.de)}
                        </span>
                      </div>
                    </div>
                  ))}
                  {alteracao.campos_alterados.length > 6 && (
                    <div className="p-1.5 text-center text-[11px] text-muted-foreground bg-muted/20">
                      + {alteracao.campos_alterados.length - 6} outro(s) campo(s)
                    </div>
                  )}
                </div>
              </div>
            )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={loading}
            className="gap-2 bg-primary text-primary-foreground"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Confirmar Reversão
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function formatValorSimples(val: unknown): string {
  if (val === null || val === undefined || val === '') return 'Vazio'
  if (typeof val === 'boolean') return val ? 'Sim' : 'Não'
  if (typeof val === 'object') return JSON.stringify(val).slice(0, 20) + '...'
  return String(val)
}
