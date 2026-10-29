import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Loader2, UserPlus, Star } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { insertClienteContato } from '@/services/clientes'
import type { ClienteContato } from '@/types/cliente'

interface ClienteContatoFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  clienteId: string
  clienteNome?: string | null
  onSaved: (novoContato: ClienteContato) => void
}

export function ClienteContatoFormDialog({
  open,
  onOpenChange,
  clienteId,
  clienteNome,
  onSaved,
}: ClienteContatoFormDialogProps) {
  const [nome, setNome] = useState('')
  const [cargo, setCargo] = useState('')
  const [email, setEmail] = useState('')
  const [telefone, setTelefone] = useState('')
  const [isPrincipal, setIsPrincipal] = useState(false)
  const [saving, setSaving] = useState(false)

  const resetForm = () => {
    setNome('')
    setCargo('')
    setEmail('')
    setTelefone('')
    setIsPrincipal(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!clienteId) {
      toast({
        title: 'Cliente não selecionado',
        description: 'Selecione um cliente antes de cadastrar um contato.',
        variant: 'destructive',
      })
      return
    }

    const trimmedNome = nome.trim()
    if (!trimmedNome) {
      toast({
        title: 'Nome obrigatório',
        description: 'Informe o nome do contato.',
        variant: 'destructive',
      })
      return
    }

    setSaving(true)
    try {
      const novo = await insertClienteContato({
        cliente_id: clienteId,
        nome: trimmedNome,
        cargo: cargo.trim() || null,
        email: email.trim() || null,
        telefone: telefone.trim() || null,
        is_principal: isPrincipal,
      })

      toast({
        title: 'Contato cadastrado com sucesso!',
        description: `${novo.nome} foi vinculado ao cliente e selecionado na proposta.`,
      })

      resetForm()
      onOpenChange(false)
      onSaved(novo)
    } catch (err) {
      console.error('[ClienteContatoFormDialog] erro ao salvar contato:', err)
      toast({
        title: 'Erro ao cadastrar contato',
        description: err instanceof Error ? err.message : 'Não foi possível cadastrar o contato.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) resetForm()
        onOpenChange(v)
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-bold text-foreground">
            <UserPlus className="w-5 h-5 text-primary" />
            Novo Contato do Cliente
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Cadastre um novo contato vinculado ao cliente{' '}
            <strong className="text-foreground">{clienteNome || 'selecionado'}</strong>. Ele será
            automaticamente selecionado nesta proposta.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <Label htmlFor="contato-nome" className="text-xs font-semibold">
              Nome do Contato *
            </Label>
            <Input
              id="contato-nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Carlos Eduardo Silva"
              className="h-9 text-sm"
              autoFocus
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="contato-cargo" className="text-xs font-semibold">
              Cargo / Departamento
            </Label>
            <Input
              id="contato-cargo"
              value={cargo}
              onChange={(e) => setCargo(e.target.value)}
              placeholder="Ex: Gerente de Compras / Manutenção"
              className="h-9 text-sm"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="contato-email" className="text-xs font-semibold">
                E-mail
              </Label>
              <Input
                id="contato-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="contato@empresa.com"
                className="h-9 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="contato-telefone" className="text-xs font-semibold">
                Telefone / Celular
              </Label>
              <Input
                id="contato-telefone"
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                placeholder="(11) 98765-4321"
                className="h-9 text-sm"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2 border-t">
            <Checkbox
              id="contato-principal"
              checked={isPrincipal}
              onCheckedChange={(checked) => setIsPrincipal(checked === true)}
            />
            <Label
              htmlFor="contato-principal"
              className="text-xs font-medium cursor-pointer flex items-center gap-1.5 text-foreground"
            >
              <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
              Definir como contato principal deste cliente
            </Label>
          </div>

          <DialogFooter className="pt-2 gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={saving}
              className="bg-[#0b3c26] text-white hover:bg-[#082f1e] font-semibold gap-1.5"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <UserPlus className="w-4 h-4" />
              )}
              {saving ? 'Cadastrando...' : 'Salvar e Selecionar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
