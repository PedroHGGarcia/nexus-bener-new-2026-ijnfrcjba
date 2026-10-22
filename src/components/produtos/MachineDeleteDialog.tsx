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
import { ShieldAlert, Trash2, Archive, Loader2 } from 'lucide-react'
import { isAdminRole } from '@/components/RoleGuard'
import { useAuth } from '@/hooks/use-auth'
import {
  quarantineMachineItem,
  permanentlyDeleteMachineItem,
  type MachineTable,
} from '@/services/machine-quarantine'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  table: MachineTable
  itemId: string
  itemName: string
  onDone: (action: 'quarantine' | 'delete') => void
}

/**
 * Diálogo de exclusão da hierarquia de máquinas.
 *
 * - Comercial: só vê a opção "Mover para Quarentena" (soft-delete).
 * - Admin: vê duas opções — quarentena (soft-delete) ou exclusão permanente
 *   (DELETE real, permitido pelo RLS apenas para Admin).
 */
export function MachineDeleteDialog({
  open,
  onOpenChange,
  table,
  itemId,
  itemName,
  onDone,
}: Props) {
  const { user } = useAuth()
  const isAdmin = isAdminRole(user?.role)
  const [loading, setLoading] = useState<'quarantine' | 'delete' | null>(null)

  const handleQuarantine = async () => {
    setLoading('quarantine')
    try {
      await quarantineMachineItem(table, itemId)
      onDone('quarantine')
      onOpenChange(false)
    } catch (err) {
      // erro já tratado pelo toast no caller via onDone? Não — tratamos aqui.
      console.error(err)
      onDone('quarantine')
      onOpenChange(false)
    } finally {
      setLoading(null)
    }
  }

  const handlePermanentDelete = async () => {
    setLoading('delete')
    try {
      await permanentlyDeleteMachineItem(table, itemId)
      onDone('delete')
      onOpenChange(false)
    } catch (err) {
      console.error(err)
      onDone('delete')
      onOpenChange(false)
    } finally {
      setLoading(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center">
              <ShieldAlert className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <DialogTitle>Excluir {itemName}</DialogTitle>
              <DialogDescription className="text-xs">
                {isAdmin
                  ? 'Escolha como deseja excluir este item da hierarquia.'
                  : 'O item será movido para quarentena para revisão.'}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3">
          {/* Sempre disponível: quarentena */}
          <button
            type="button"
            onClick={handleQuarantine}
            disabled={!!loading}
            className="w-full flex items-start gap-3 rounded-lg border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/30 p-3 text-left hover:border-amber-400 dark:hover:border-amber-700 transition-colors disabled:opacity-60"
          >
            <Archive className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">Mover para Quarentena</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                O item fica oculto para usuários normais. Um Admin revisará em até 7 dias. Propostas
                já emitidas continuam funcionando normalmente.
              </p>
            </div>
            {loading === 'quarantine' && (
              <Loader2 className="w-4 h-4 animate-spin text-amber-600 ml-auto shrink-0" />
            )}
          </button>

          {/* Apenas Admin: exclusão permanente */}
          {isAdmin && (
            <button
              type="button"
              onClick={handlePermanentDelete}
              disabled={!!loading}
              className="w-full flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-left hover:border-destructive transition-colors disabled:opacity-60"
            >
              <Trash2 className="w-5 h-5 text-destructive mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">Excluir Permanentemente</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Remove o registro do banco de forma irreversível. Pode falhar se houver propostas
                  ou registros vinculados.
                </p>
              </div>
              {loading === 'delete' && (
                <Loader2 className="w-4 h-4 animate-spin text-destructive ml-auto shrink-0" />
              )}
            </button>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={!!loading}>
            Cancelar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
