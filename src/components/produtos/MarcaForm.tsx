import { useState, useEffect } from 'react'
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
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Loader2, AlertCircle, Tag, Package, ToggleLeft } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { MarcaFormValues, marcaSchema } from '@/lib/validations/marca'
import { Marca } from '@/types/marca'
import { insertMarca, updateMarca, checkNomeDuplicate } from '@/services/marcas'

interface Props {
  editing?: Marca | null
  open?: boolean
  onOpenChange?: (open: boolean) => void
  onSaved: (marca: Marca) => void
  onCancel?: () => void
}

function emptyForm(): MarcaFormValues {
  return { nome: '', reg: null, cod: null, site: '', pais: '', status: 'Ativo' }
}

function toForm(m: Marca): MarcaFormValues {
  return {
    nome: m.nome,
    reg: m.reg ?? null,
    cod: m.cod ?? null,
    site: m.site ?? '',
    pais: m.pais ?? '',
    status: (m.status as 'Ativo' | 'Inativo') || 'Ativo',
  }
}

export function MarcaForm({ editing, open, onOpenChange, onSaved, onCancel }: Props) {
  const [form, setForm] = useState<MarcaFormValues>(editing ? toForm(editing) : emptyForm())
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [dupOpen, setDupOpen] = useState(false)

  useEffect(() => {
    setForm(editing ? toForm(editing) : emptyForm())
    setErrors({})
  }, [editing])

  const doSave = async (nomeOverride?: string) => {
    setSaving(true)
    try {
      const payload = { ...form, nome: nomeOverride ?? form.nome }
      let savedItem: Marca
      if (editing) {
        savedItem = await updateMarca({ id: editing.id, ...payload })
        toast({ title: 'Marca atualizada com sucesso' })
      } else {
        savedItem = await insertMarca(payload)
        toast({ title: 'Marca criada com sucesso' })
      }
      onSaved(savedItem)
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const result = marcaSchema.safeParse(form)
    if (!result.success) {
      const fieldErrors: Record<string, string> = {}
      result.error.issues.forEach((issue) => {
        const key = issue.path[0] as string
        if (!fieldErrors[key]) fieldErrors[key] = issue.message
      })
      setErrors(fieldErrors)
      return
    }
    setErrors({})
    const isDup = await checkNomeDuplicate(result.data.nome, editing?.id)
    if (isDup) {
      setDupOpen(true)
      return
    }
    doSave()
  }

  const handleCancel = () => {
    if (onCancel) onCancel()
    if (onOpenChange) onOpenChange(false)
  }

  const formBody = (
    <div className="border rounded-lg bg-card p-4 space-y-4">
      <h3 className="text-sm font-semibold flex items-center gap-1.5">
        <Package className="w-3.5 h-3.5 text-muted-foreground" /> Dados da Marca
      </h3>
      <div className="space-y-2">
        <Label className="text-sm font-medium flex items-center gap-1.5">
          <Tag className="w-3.5 h-3.5 text-muted-foreground" />
          Nome <span className="text-destructive">*</span>
        </Label>
        <Input
          className="h-10"
          value={form.nome}
          onChange={(e) => setForm({ ...form, nome: e.target.value })}
          placeholder="Ex: Caterpillar"
        />
        {errors.nome && (
          <p className="flex items-center gap-1 text-xs text-destructive mt-1">
            <AlertCircle className="w-3 h-3" />
            {errors.nome}
          </p>
        )}
      </div>
      <div className="space-y-2">
        <Label className="text-sm font-medium flex items-center gap-1.5">
          <ToggleLeft className="w-3.5 h-3.5 text-muted-foreground" />
          Status
        </Label>
        <Select
          value={form.status}
          onValueChange={(v) => setForm({ ...form, status: v as 'Ativo' | 'Inativo' })}
        >
          <SelectTrigger className="h-10">
            <SelectValue placeholder="Selecione o status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Ativo">Ativo</SelectItem>
            <SelectItem value="Inativo">Inativo</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label className="text-sm font-medium">Reg (ID Cruzamento)</Label>
          <Input
            type="number"
            className="h-10"
            value={form.reg ?? ''}
            onChange={(e) =>
              setForm({ ...form, reg: e.target.value ? Number(e.target.value) : null })
            }
            placeholder="Ex: 1"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-sm font-medium">Cód</Label>
          <Input
            type="number"
            className="h-10"
            value={form.cod ?? ''}
            onChange={(e) =>
              setForm({ ...form, cod: e.target.value ? Number(e.target.value) : null })
            }
            placeholder="Ex: 1"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-medium">Site</Label>
        <Input
          className="h-10"
          value={form.site ?? ''}
          onChange={(e) => setForm({ ...form, site: e.target.value })}
          placeholder="Ex: https://fabricante.com"
        />
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-medium">País</Label>
        <Input
          className="h-10"
          value={form.pais ?? ''}
          onChange={(e) => setForm({ ...form, pais: e.target.value })}
          placeholder="Ex: Brasil, Japão, Alemanha"
        />
      </div>
    </div>
  )

  const formFooter = (
    <>
      <Button type="button" variant="outline" onClick={handleCancel}>
        Cancelar
      </Button>
      <Button
        type="submit"
        className="bg-[#0b3c26] hover:bg-[#0b3c26]/90 text-white"
        disabled={saving}
      >
        {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
        {saving ? 'Salvando...' : editing ? 'Atualizar' : 'Salvar'}
      </Button>
    </>
  )

  const dupDialog = (
    <AlertDialog open={dupOpen} onOpenChange={setDupOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Nome duplicado</AlertDialogTitle>
          <p className="text-sm text-muted-foreground">
            Já existe um registro com o nome <strong>{form.nome}</strong>. Deseja salvar como{' '}
            <strong>{form.nome} (Copia)</strong>?
          </p>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={() => doSave(`${form.nome} (Copia)`)}>
            Salvar com (Copia)
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )

  if (open !== undefined) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="sm:max-w-lg flex flex-col p-0 gap-0">
          <SheetHeader className="px-6 pt-6 pb-4 border-b shrink-0 text-left">
            <SheetTitle className="text-lg font-bold flex items-center gap-2">
              <Package className="w-5 h-5 text-[#0b3c26]" />
              {editing ? 'Editar Marca' : 'Nova Marca'}
            </SheetTitle>
            <SheetDescription>
              Preencha os dados da marca para {editing ? 'atualizar' : 'cadastrar'} o registro.
            </SheetDescription>
          </SheetHeader>
          <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
            <div className="flex-1 overflow-y-auto p-6 space-y-4">{formBody}</div>
            <div className="border-t px-6 py-4 flex gap-2 justify-end shrink-0">{formFooter}</div>
          </form>
          {dupDialog}
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-4">
        {formBody}
        <div className="border-t pt-4 mt-2 flex gap-2 justify-end">{formFooter}</div>
      </form>
      {dupDialog}
    </>
  )
}
