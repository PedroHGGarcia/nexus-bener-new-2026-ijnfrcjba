import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { fetchCategoriasProdutos } from '@/services/categorias-produtos'
import { CategoriaProduto } from '@/types/categoria-produto'
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
import { Loader2 } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { GerenteFormValues, gerenteSchema } from '@/lib/validations/gerente'
import { Gerente } from '@/types/gerente'
import { insertGerente, updateGerente } from '@/services/gerentes'
import { SearchableCombobox } from '@/components/shared/searchable-combobox'
import { normalizeSearchTerm } from '@/lib/cidades-brasil'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  editing: Gerente | null
  onSaved: () => void
}

function emptyForm(): GerenteFormValues {
  return {
    nome: '',
    cargo: '',
    email: '',
    celular: '',
    rd_station_id: '',
    usuario: '',
    categoria_restrita_id: null,
    status: 'Ativo',
  }
}

function toForm(g: Gerente): GerenteFormValues {
  return {
    nome: g.nome ?? '',
    cargo: g.cargo ?? '',
    email: g.email ?? '',
    celular: g.celular ?? '',
    rd_station_id: g.rd_station_id ?? '',
    usuario: g.usuario ?? '',
    categoria_restrita_id: g.categoria_restrita_id ?? null,
    status: g.status as 'Ativo' | 'Inativo',
  }
}
function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  const hh = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`
}

export function GerenteFormDialog({ open, onOpenChange, editing, onSaved }: Props) {
  const [form, setForm] = useState<GerenteFormValues>(emptyForm())
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [categorias, setCategorias] = useState<CategoriaProduto[]>([])

  useEffect(() => {
    if (open) {
      setForm(editing ? toForm(editing) : emptyForm())
      setErrors({})
      fetchCategoriasProdutos()
        .then((cats) => {
          const list = cats || []
          setCategorias(list)
        })
        .catch(() => {})
    }
  }, [open, editing])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const result = gerenteSchema.safeParse(form)
    if (!result.success) {
      const fieldErrors: Record<string, string> = {}
      result.error.issues.forEach((issue) => {
        const key = issue.path[0] as string
        if (!fieldErrors[key]) fieldErrors[key] = issue.message
      })
      setErrors(fieldErrors)
      toast({
        title: 'Erro de validação',
        description: 'Verifique os campos destacados.',
        variant: 'destructive',
      })
      return
    }

    setErrors({})
    setSaving(true)
    try {
      if (editing) {
        await updateGerente({ id: editing.id, ...result.data })
        toast({ title: 'Gerente atualizado com sucesso' })
      } else {
        await insertGerente(result.data)
        toast({ title: 'Gerente criado com sucesso' })
      }
      onSaved()
      onOpenChange(false)
    } catch (err) {
      toast({
        title: 'Erro ao salvar',
        description: err instanceof Error ? err.message : 'Erro desconhecido',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? 'Editar Gerente' : 'Novo Gerente'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <Label>Nome *</Label>
            <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
            {errors.nome && <p className="text-xs text-destructive mt-1">{errors.nome}</p>}
          </div>
          <div>
            <Label>Cargo</Label>
            <Input
              value={form.cargo}
              onChange={(e) => setForm({ ...form, cargo: e.target.value })}
              placeholder="Ex: Gerente de Contas"
            />
          </div>
          <div>
            <Label>E-mail *</Label>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="exemplo@bener.com.br"
            />
            {errors.email && <p className="text-xs text-destructive mt-1">{errors.email}</p>}
          </div>
          <div>
            <Label>Celular</Label>
            <Input
              value={form.celular}
              onChange={(e) => setForm({ ...form, celular: e.target.value })}
              placeholder="(00) 00000-0000"
            />
          </div>
          <div>
            <Label>RD Station ID</Label>
            <Input
              value={form.rd_station_id}
              onChange={(e) => setForm({ ...form, rd_station_id: e.target.value })}
              placeholder="ID no RD Station"
            />
          </div>
          <div>
            <Label>Categoria Restrita (Catálogo)</Label>
            <div className="mt-1">
              <SearchableCombobox
                value={form.categoria_restrita_id || null}
                onChange={(val) =>
                  setForm((prev) => ({
                    ...prev,
                    categoria_restrita_id: val,
                  }))
                }
                placeholder="Sem restrição (todas as categorias)"
                searchPlaceholder="Buscar categoria..."
                fetchOptions={async (query, page) => {
                  let cats = categorias
                  if (cats.length === 0) {
                    try {
                      cats = await fetchCategoriasProdutos()
                      setCategorias(cats)
                    } catch {
                      cats = []
                    }
                  }

                  const q = normalizeSearchTerm(query || '')
                  const activeCats = cats.filter((c) => (c.status ? c.status === 'Ativo' : true))
                  const filtered = q
                    ? activeCats.filter((c) => normalizeSearchTerm(c.nome || '').includes(q))
                    : activeCats

                  const pageSize = 20
                  const from = (page - 1) * pageSize
                  const to = page * pageSize
                  const paged = filtered.slice(from, to)

                  return {
                    items: paged.map((c) => ({
                      value: c.id,
                      label: c.nome,
                    })),
                    hasMore: to < filtered.length,
                  }
                }}
              />
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Se configurada, todos os representantes e vendedores vinculados a este gerente só
              poderão ver e emitir propostas com máquinas desta categoria. O seletor é opcional e
              permite busca tolerante a acentos.
            </p>
          </div>
          <div>
            <Label>Status</Label>
            <Select
              value={form.status}
              onValueChange={(v) => setForm({ ...form, status: v as 'Ativo' | 'Inativo' })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Ativo">Ativo</SelectItem>
                <SelectItem value="Inativo">Inativo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {editing && (
            <div>
              <Label>Data de Cadastro</Label>
              <Input value={formatDate(editing.created_at)} disabled />
            </div>
          )}
          <DialogFooter className="mt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" className="bg-primary" disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              {editing ? 'Atualizar' : 'Salvar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
