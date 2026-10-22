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
import { Loader2, AlertCircle, Tag, Package, Factory, ToggleLeft } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { ModeloFormValues, modeloSchema } from '@/lib/validations/modelo'
import { Modelo } from '@/types/modelo'
import { Produto } from '@/types/produto'
import { Marca } from '@/types/marca'
import { insertModelo, updateModelo, checkNomeDuplicate } from '@/services/modelos'
import { fetchProdutos } from '@/services/produtos'
import { fetchMarcas } from '@/services/marcas'

interface Props {
  editing?: Modelo | null
  open?: boolean
  onOpenChange?: (open: boolean) => void
  initialProdutoId?: string
  initialMarcaId?: string
  onSaved: (modelo: Modelo) => void
  onCancel?: () => void
}

function emptyForm(pId?: string, mId?: string): ModeloFormValues {
  return { nome: '', produto: pId ?? null, marca: mId ?? null, status: 'Ativo' }
}

function toForm(m: Modelo): ModeloFormValues {
  return {
    nome: m.nome,
    produto: m.produto ?? null,
    marca: m.marca ?? null,
    status: m.status as 'Ativo' | 'Inativo',
  }
}

export function ModeloForm({
  editing,
  open,
  onOpenChange,
  initialProdutoId,
  initialMarcaId,
  onSaved,
  onCancel,
}: Props) {
  const [form, setForm] = useState<ModeloFormValues>(
    editing ? toForm(editing) : emptyForm(initialProdutoId, initialMarcaId),
  )

  useEffect(() => {
    if (!editing) {
      if (initialProdutoId || initialMarcaId) {
        setForm((prev) => ({
          ...prev,
          produto: initialProdutoId ?? prev.produto,
          marca: initialMarcaId ?? prev.marca,
        }))
      }
    }
  }, [editing, initialProdutoId, initialMarcaId])
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [dupOpen, setDupOpen] = useState(false)
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [marcas, setMarcas] = useState<Marca[]>([])

  useEffect(() => {
    Promise.all([fetchProdutos(), fetchMarcas()])
      .then(([p, m]) => {
        setProdutos(p)
        setMarcas(m)
      })
      .catch(() => {
        setProdutos([])
        setMarcas([])
      })
  }, [])

  const doSave = async (nomeOverride?: string) => {
    setSaving(true)
    try {
      const payload = { ...form, nome: nomeOverride ?? form.nome }
      let savedItem: Modelo
      if (editing) {
        savedItem = await updateModelo({ id: editing.id, ...payload })
        toast({ title: 'Modelo atualizado com sucesso' })
      } else {
        savedItem = await insertModelo(payload)
        toast({ title: 'Modelo criado com sucesso' })
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
    const result = modeloSchema.safeParse(form)
    if (!result.success) {
      const fieldErrors: Record<string, string> = {}
      result.error.issues.forEach((issue) => {
        const key = (issue.path[0] as string) || 'vinculo'
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
        <Factory className="w-3.5 h-3.5 text-muted-foreground" /> Dados do Modelo
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
          placeholder="Ex: 320 GC"
        />
        {errors.nome && (
          <p className="flex items-center gap-1 text-xs text-destructive mt-1">
            <AlertCircle className="w-3 h-3" />
            {errors.nome}
          </p>
        )}
      </div>
      {errors.vinculo && (
        <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/40 dark:border-amber-800 p-3 flex items-start gap-2.5 text-amber-900 dark:text-amber-200">
          <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
          <div className="text-xs space-y-0.5">
            <p className="font-semibold">Vínculo obrigatório</p>
            <p>{errors.vinculo}</p>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium flex items-center gap-1.5">
            <Package className="w-3.5 h-3.5 text-muted-foreground" />
            Produto
          </Label>
          <span className="text-[11px] text-muted-foreground">
            {form.marca ? 'Opcional se Marca preenchida' : 'Obrigatório se sem Marca'}
          </span>
        </div>
        <div className="flex gap-1.5">
          <Select
            value={form.produto ?? undefined}
            onValueChange={(v) => {
              setForm({ ...form, produto: v })
              if (errors.vinculo) {
                setErrors((prev) => {
                  const copy = { ...prev }
                  delete copy.vinculo
                  return copy
                })
              }
            }}
          >
            <SelectTrigger
              className={`h-10 flex-1 ${
                errors.vinculo && !form.produto && !form.marca
                  ? 'border-amber-400 focus:ring-amber-300'
                  : ''
              }`}
            >
              <SelectValue placeholder="Selecione um produto (opcional se houver marca)" />
            </SelectTrigger>
            <SelectContent>
              {produtos.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {form.produto && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-10 px-2.5 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setForm({ ...form, produto: null })}
              title="Limpar seleção de produto"
            >
              Limpar
            </Button>
          )}
        </div>
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium flex items-center gap-1.5">
            <Factory className="w-3.5 h-3.5 text-muted-foreground" />
            Marca
          </Label>
          <span className="text-[11px] text-muted-foreground">
            {form.produto ? 'Opcional se Produto preenchido' : 'Obrigatório se sem Produto'}
          </span>
        </div>
        <div className="flex gap-1.5">
          <Select
            value={form.marca ?? undefined}
            onValueChange={(v) => {
              setForm({ ...form, marca: v })
              if (errors.vinculo) {
                setErrors((prev) => {
                  const copy = { ...prev }
                  delete copy.vinculo
                  return copy
                })
              }
            }}
          >
            <SelectTrigger
              className={`h-10 flex-1 ${
                errors.vinculo && !form.produto && !form.marca
                  ? 'border-amber-400 focus:ring-amber-300'
                  : ''
              }`}
            >
              <SelectValue placeholder="Selecione uma marca (opcional se houver produto)" />
            </SelectTrigger>
            <SelectContent>
              {marcas.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {form.marca && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-10 px-2.5 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setForm({ ...form, marca: null })}
              title="Limpar seleção de marca"
            >
              Limpar
            </Button>
          )}
        </div>
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
        <SheetContent side="right" className="sm:max-w-xl flex flex-col p-0 gap-0">
          <SheetHeader className="px-6 pt-6 pb-4 border-b shrink-0 text-left">
            <SheetTitle className="text-lg font-bold flex items-center gap-2">
              <Factory className="w-5 h-5 text-[#0b3c26]" />
              {editing ? 'Editar Modelo' : 'Novo Modelo'}
            </SheetTitle>
            <SheetDescription>
              {editing
                ? 'Atualize os dados do modelo cadastrado.'
                : 'Preencha os dados do novo modelo de máquina.'}
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
