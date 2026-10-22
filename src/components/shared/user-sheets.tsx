import { useState, useEffect } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ROLE_OPTIONS, fetchRoleOptions } from '@/services/role-templates'
import { updateUserProfile, type AdminUser } from '@/services/users'
import { toast } from 'sonner'

const MENU_KEYS = [
  'dashboard',
  'cadastros-clientes',
  'cadastros-representantes',
  'cadastros-regioes',
  'cadastros-gerentes',
  'cadastros-prepostos',
  'eventos',
  'projetos',
  'propostas-dashboard',
  'propostas-emitir',
  'propostas-criadas',
  'propostas-avancadas',
  'propostas-tipos',
  'produtos-lista',
  'produtos-dashboard',
  'produtos-precos',
  'produtos-categorias',
  'produtos-marcas',
  'produtos-modelos',
  'produtos-versoes',
  'produtos-acessorios',
  'notificacoes',
  'importacoes',
  'area-atuacao',
  'usuarios',
  'auditoria',
  'configuracoes',
]

interface AccessProps {
  open: boolean
  onOpenChange: (o: boolean) => void
  user: AdminUser | null
  onSaved: () => void
}
export function UserAccessSheet({ open, onOpenChange, user, onSaved }: AccessProps) {
  const [access, setAccess] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [roleOptions, setRoleOptions] = useState<string[]>(ROLE_OPTIONS)

  useEffect(() => {
    fetchRoleOptions()
      .then(setRoleOptions)
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (user) setAccess(user.menu_access ?? [])
  }, [user])

  const toggle = (key: string) =>
    setAccess((p) => (p.includes(key) ? p.filter((k) => k !== key) : [...p, key]))
  const save = async () => {
    if (!user) return
    setSaving(true)
    const { error } = await updateUserProfile(user.id, {
      role: user.role,
      setor: user.setor,
      status: user.status,
    })
    if (error) toast.error(`Erro: ${error}`)
    else {
      toast.success('Permissões atualizadas!')
      onSaved()
      onOpenChange(false)
    }
    setSaving(false)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Permissões de Acesso — {user?.name}</SheetTitle>
        </SheetHeader>
        <ScrollArea className="h-[60vh] mt-4 pr-4">
          <div className="space-y-2">
            {MENU_KEYS.map((key) => (
              <div key={key} className="flex items-center gap-2 p-2 rounded-md hover:bg-accent">
                <Checkbox
                  checked={access.includes(key)}
                  onCheckedChange={() => toggle(key)}
                  id={key}
                />
                <Label htmlFor={key} className="text-sm cursor-pointer flex-1">
                  {key}
                </Label>
              </div>
            ))}
          </div>
        </ScrollArea>
        <SheetFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={saving} className="bg-primary">
            {saving ? 'Salvando...' : 'Salvar'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

interface EditProps {
  open: boolean
  onOpenChange: (o: boolean) => void
  user: AdminUser | null
  onSaved: () => void
}
export function UserEditSheet({ open, onOpenChange, user, onSaved }: EditProps) {
  const [form, setForm] = useState({ role: '', setor: '', status: 'Ativo' })
  const [saving, setSaving] = useState(false)
  const [roleOptions, setRoleOptions] = useState<string[]>(ROLE_OPTIONS)

  useEffect(() => {
    fetchRoleOptions()
      .then(setRoleOptions)
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (user) setForm({ role: user.role, setor: user.setor, status: user.status })
  }, [user])
  const save = async () => {
    if (!user) return
    setSaving(true)
    const { error } = await updateUserProfile(user.id, form)
    if (error) toast.error(`Erro: ${error}`)
    else {
      toast.success('Usuário atualizado!')
      onSaved()
      onOpenChange(false)
    }
    setSaving(false)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Editar Usuário — {user?.name}</SheetTitle>
        </SheetHeader>
        <div className="space-y-4 mt-4">
          <div>
            <Label>Email</Label>
            <Input value={user?.email ?? ''} disabled />
          </div>
          <div>
            <Label>Setor</Label>
            <Input
              value={form.setor}
              onChange={(e) => setForm({ ...form, setor: e.target.value })}
            />
          </div>
          <div>
            <Label>Perfil</Label>
            <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {roleOptions.map((r: string) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Status</Label>
            <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Ativo">Ativo</SelectItem>
                <SelectItem value="Inativo">Inativo</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <SheetFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={saving} className="bg-primary">
            {saving ? 'Salvando...' : 'Salvar'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
