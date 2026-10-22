import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { AlertTriangle, Copy, AlertCircle } from 'lucide-react'
import { useState, useEffect } from 'react'

interface DeleteProps {
  open: boolean
  onOpenChange: (o: boolean) => void
  itemName: string
  onConfirm: () => void
  loading?: boolean
}
export function DeleteConfirmModal({
  open,
  onOpenChange,
  itemName,
  onConfirm,
  loading,
}: DeleteProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-destructive" />
            </div>
            <div>
              <DialogTitle>Tem certeza?</DialogTitle>
              <DialogDescription className="text-xs">
                Esta ação não pode ser desfeita.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Você está prestes a excluir <strong className="text-foreground">{itemName}</strong>.
          Confirma a exclusão?
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={loading}>
            {loading ? 'Excluindo...' : 'Excluir'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface DupProps {
  open: boolean
  onOpenChange: (o: boolean) => void
  message: string
  onCopy: () => void
  onCancel: () => void
}
export function DuplicateConflictDialog({
  open,
  onOpenChange,
  message,
  onCopy,
  onCancel,
}: DupProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <DialogTitle>Registro Duplicado</DialogTitle>
            </div>
          </div>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">{message}</p>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button onClick={onCopy} className="gap-2">
            <Copy className="w-4 h-4" /> Continuar com Cópia
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface ClearProps {
  open: boolean
  onOpenChange: (o: boolean) => void
  onConfirm: () => void
  loading?: boolean
}
export function ClearAllClientsDialog({ open, onOpenChange, onConfirm, loading }: ClearProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Limpar Todos os Clientes?</DialogTitle>
          <DialogDescription>
            Esta ação removerá permanentemente todos os registros de clientes do sistema.
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3">
          <p className="text-xs text-destructive font-medium">
            ⚠️ Todos os clientes serão excluídos. Esta ação é irreversível e pode afetar propostas e
            projetos vinculados.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={loading}>
            {loading ? 'Limpando...' : 'Sim, Limpar Tudo'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export interface AdvanceProposalData {
  modelo_licitacao: boolean
  revisao: string
  condicoes_pagamento: string
  prazo_entrega: string
  validade_oferta: string
  nota_rep: number
}
interface AdvProps {
  open: boolean
  onOpenChange: (o: boolean) => void
  onConfirm: (data: AdvanceProposalData) => void
  initial?: Partial<AdvanceProposalData>
}
export function AdvanceProposalDialog({ open, onOpenChange, onConfirm, initial }: AdvProps) {
  const [data, setData] = useState<AdvanceProposalData>({
    modelo_licitacao: false,
    revisao: '',
    condicoes_pagamento: '',
    prazo_entrega: '',
    validade_oferta: '30 dias',
    nota_rep: 0,
    ...initial,
  })
  useEffect(() => {
    if (open)
      setData({
        modelo_licitacao: false,
        revisao: '',
        condicoes_pagamento: '',
        prazo_entrega: '',
        validade_oferta: '30 dias',
        nota_rep: 0,
        ...initial,
      })
  }, [open])
  const upd = (k: keyof AdvanceProposalData, v: unknown) => setData((p) => ({ ...p, [k]: v }))
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Opções Avançadas da Proposta</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label className="text-sm font-medium">Modelo de Licitação</Label>
              <p className="text-xs text-muted-foreground">Marca como proposta de licitação</p>
            </div>
            <Switch
              checked={data.modelo_licitacao}
              onCheckedChange={(v) => upd('modelo_licitacao', v)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Revisão</Label>
              <Input
                value={data.revisao}
                onChange={(e) => upd('revisao', e.target.value)}
                placeholder="Ex: Rev. 01"
              />
            </div>
            <div>
              <Label className="text-xs">Validade da Oferta</Label>
              <Input
                value={data.validade_oferta}
                onChange={(e) => upd('validade_oferta', e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs">Prazo de Entrega</Label>
              <Input
                value={data.prazo_entrega}
                onChange={(e) => upd('prazo_entrega', e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs">Nota do Representante</Label>
              <Input
                type="number"
                step="0.1"
                value={data.nota_rep}
                onChange={(e) => upd('nota_rep', parseFloat(e.target.value) || 0)}
              />
            </div>
          </div>
          <div>
            <Label className="text-xs">Condições de Pagamento</Label>
            <Textarea
              rows={2}
              value={data.condicoes_pagamento}
              onChange={(e) => upd('condicoes_pagamento', e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button className="bg-primary" onClick={() => onConfirm(data)}>
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
