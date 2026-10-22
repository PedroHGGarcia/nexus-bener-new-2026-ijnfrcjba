import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
import {
  Loader2,
  Plus,
  Trash2,
  AlertCircle,
  Tag,
  FolderTree,
  ToggleLeft,
  FileText,
  ListChecks,
} from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { ProdutoFormValues, produtoSchema } from '@/lib/validations/produto'
import { Produto } from '@/types/produto'
import { CategoriaProduto } from '@/types/categoria-produto'
import { insertProduto, updateProduto, checkNomeDuplicate } from '@/services/produtos'
import { fetchCategoriasProdutos } from '@/services/categorias-produtos'

interface SpecRow {
  chave: string
  valor: string
}

interface Props {
  editing?: Produto | null
  open?: boolean
  onOpenChange?: (open: boolean) => void
  initialCategoriaId?: string
  onSaved: (produto: Produto) => void
  onCancel?: () => void
}

function emptyForm(initialCategoriaId?: string): ProdutoFormValues {
  return {
    nome: '',
    categoria: initialCategoriaId ?? null,
    status: 'Ativo',
    descricao: '',
    especificacoes: {},
    fotos: null,
  }
}

function produtoToForm(p: Produto): ProdutoFormValues {
  return {
    nome: p.nome,
    categoria: p.categoria ?? null,
    status: p.status as 'Ativo' | 'Inativo',
    descricao: p.descricao ?? '',
    especificacoes: p.especificacoes ?? {},
    fotos: p.fotos ?? null,
  }
}

function specsToRows(specs: Record<string, string> | null | undefined): SpecRow[] {
  if (!specs) return []
  return Object.entries(specs).map(([chave, valor]) => ({ chave, valor }))
}

function rowsToSpecs(rows: SpecRow[]): Record<string, string> {
  const obj: Record<string, string> = {}
  for (const r of rows) {
    if (r.chave.trim()) obj[r.chave.trim()] = r.valor
  }
  return obj
}

export function ProdutoForm({
  editing,
  open,
  onOpenChange,
  initialCategoriaId,
  onSaved,
  onCancel,
}: Props) {
  const [form, setForm] = useState<ProdutoFormValues>(
    editing ? produtoToForm(editing) : emptyForm(initialCategoriaId),
  )

  useEffect(() => {
    if (!editing && initialCategoriaId) {
      setForm((prev) => ({ ...prev, categoria: initialCategoriaId }))
    }
  }, [editing, initialCategoriaId])
  const [specRows, setSpecRows] = useState<SpecRow[]>(
    editing ? specsToRows(editing.especificacoes) : [],
  )
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [dupOpen, setDupOpen] = useState(false)
  const [categorias, setCategorias] = useState<CategoriaProduto[]>([])

  useEffect(() => {
    fetchCategoriasProdutos()
      .then((cats) => setCategorias(cats.filter((c) => c.status === 'Ativo')))
      .catch(() => setCategorias([]))
  }, [])

  const addSpecRow = () => setSpecRows((prev) => [...prev, { chave: '', valor: '' }])

  const removeSpecRow = (idx: number) => setSpecRows((prev) => prev.filter((_, i) => i !== idx))

  const updateSpecRow = (idx: number, key: keyof SpecRow, value: string) =>
    setSpecRows((prev) => prev.map((r, i) => (i === idx ? { ...r, [key]: value } : r)))

  const doSave = async (nomeOverride?: string) => {
    setSaving(true)
    try {
      const especificacoes = rowsToSpecs(specRows)
      const payload = { ...form, nome: nomeOverride ?? form.nome, especificacoes }
      let savedItem: Produto
      if (editing) {
        savedItem = await updateProduto({ id: editing.id, ...payload })
        toast({ title: 'Produto atualizado com sucesso' })
      } else {
        savedItem = await insertProduto(payload)
        toast({ title: 'Produto criado com sucesso' })
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
    const result = produtoSchema.safeParse({ ...form, especificacoes: rowsToSpecs(specRows) })
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
    <div className="space-y-4">
      {/* Dados Básicos */}
      <div className="border rounded-lg bg-card p-4 space-y-4">
        <h3 className="text-sm font-semibold flex items-center gap-1.5">
          <FileText className="w-3.5 h-3.5 text-muted-foreground" /> Dados Básicos
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
            placeholder="Ex: Escavadeira Hidráulica"
          />
          {errors.nome && (
            <p className="flex items-center gap-1 text-xs text-destructive mt-1">
              <AlertCircle className="w-3 h-3" />
              {errors.nome}
            </p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center gap-1.5">
              <FolderTree className="w-3.5 h-3.5 text-muted-foreground" />
              Categoria
            </Label>
            <Select
              value={form.categoria ?? undefined}
              onValueChange={(v) => setForm({ ...form, categoria: v })}
            >
              <SelectTrigger className="h-10">
                <SelectValue placeholder="Selecione uma categoria" />
              </SelectTrigger>
              <SelectContent>
                {categorias.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
        <div className="space-y-2">
          <Label className="text-sm font-medium flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-muted-foreground" />
            Descrição
          </Label>
          <Textarea
            className="resize-none"
            value={form.descricao}
            onChange={(e) => setForm({ ...form, descricao: e.target.value })}
            rows={3}
            placeholder="Descrição do produto..."
          />
        </div>
      </div>

      {/* Especificações */}
      <div className="border rounded-lg bg-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold flex items-center gap-1.5">
            <ListChecks className="w-3.5 h-3.5 text-muted-foreground" /> Especificações
          </h3>
          <Button type="button" variant="outline" size="sm" onClick={addSpecRow} className="gap-1">
            <Plus className="w-3.5 h-3.5" /> Adicionar
          </Button>
        </div>
        {specRows.length === 0 && (
          <p className="text-xs text-muted-foreground border border-dashed rounded-md p-3 text-center">
            Nenhuma especificação adicionada.
          </p>
        )}
        <div className="space-y-2">
          {specRows.map((row, idx) => (
            <div key={idx} className="flex gap-2 items-center">
              <Input
                className="h-10 flex-1"
                placeholder="Chave (ex: Potência)"
                value={row.chave}
                onChange={(e) => updateSpecRow(idx, 'chave', e.target.value)}
              />
              <Input
                className="h-10 flex-1"
                placeholder="Valor (ex: 15 kW)"
                value={row.valor}
                onChange={(e) => updateSpecRow(idx, 'valor', e.target.value)}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-destructive shrink-0"
                onClick={() => removeSpecRow(idx)}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
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
              <FileText className="w-5 h-5 text-[#0b3c26]" />
              {editing ? 'Editar Produto' : 'Novo Produto'}
            </SheetTitle>
            <SheetDescription>
              {editing
                ? 'Atualize os dados do produto cadastrado.'
                : 'Preencha os dados do novo produto.'}
            </SheetDescription>
          </SheetHeader>
          <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
            <div className="flex-1 overflow-y-auto p-6">{formBody}</div>
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
