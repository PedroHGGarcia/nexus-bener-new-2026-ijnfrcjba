import { useState, useEffect, useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, Search, CheckSquare, Square, MapPin, Building2, Info } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { RegiaoFormValues, regiaoSchema } from '@/lib/validations/regiao'
import { Regiao } from '@/types/regiao'
import { insertRegiao, updateRegiao } from '@/services/regioes'
import { ESTADOS_BR } from '@/lib/tax-rates'
import { getCidadesPorUf, normalizeSearchTerm } from '@/lib/cidades-brasil'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  editing: Regiao | null
  onSaved: () => void
}

function emptyForm(): RegiaoFormValues {
  return {
    nome: '',
    uf: '',
    todo_o_estado: true,
    cidades: [],
    status: 'Ativo',
  }
}

function toForm(r: Regiao): RegiaoFormValues {
  const isTodo = r.todo_o_estado ?? (Array.isArray(r.cidades) ? r.cidades.length === 0 : true)
  return {
    nome: r.nome,
    uf: r.uf ?? '',
    todo_o_estado: isTodo,
    cidades: Array.isArray(r.cidades) ? r.cidades : [],
    status: (r.status as 'Ativo' | 'Inativo') || 'Ativo',
  }
}

export function RegiaoFormDialog({ open, onOpenChange, editing, onSaved }: Props) {
  const [form, setForm] = useState<RegiaoFormValues>(emptyForm())
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [searchCidade, setSearchCidade] = useState('')

  useEffect(() => {
    if (open) {
      setForm(editing ? toForm(editing) : emptyForm())
      setErrors({})
      setSearchCidade('')
    }
  }, [open, editing])

  // Lista de cidades disponíveis para a UF selecionada
  const availableCidades = useMemo(() => {
    return getCidadesPorUf(form.uf)
  }, [form.uf])

  // Cidades filtradas pela busca
  const filteredCidades = useMemo(() => {
    const q = normalizeSearchTerm(searchCidade)
    if (!q) return availableCidades
    return availableCidades.filter((c) => normalizeSearchTerm(c).includes(q))
  }, [availableCidades, searchCidade])

  const handleUfChange = (newUf: string) => {
    // Ao trocar de estado, se não for modo edição ou se trocar de UF, limpar cidades selecionadas se não existirem no novo estado
    const currentCidadesForNewUf = getCidadesPorUf(newUf)
    const preservedCidades = form.cidades.filter((c) => currentCidadesForNewUf.includes(c))

    setForm((prev) => ({
      ...prev,
      uf: newUf,
      cidades: preservedCidades,
    }))
    setSearchCidade('')
    if (errors.uf) {
      setErrors((prev) => {
        const next = { ...prev }
        delete next.uf
        return next
      })
    }
  }

  const toggleCidade = (cidade: string) => {
    setForm((prev) => {
      const exists = prev.cidades.includes(cidade)
      const nextCidades = exists
        ? prev.cidades.filter((c) => c !== cidade)
        : [...prev.cidades, cidade]
      return {
        ...prev,
        cidades: nextCidades,
      }
    })
    if (errors.cidades) {
      setErrors((prev) => {
        const next = { ...prev }
        delete next.cidades
        return next
      })
    }
  }

  const selectAllCidades = () => {
    setForm((prev) => ({
      ...prev,
      cidades: [...availableCidades],
    }))
    if (errors.cidades) {
      setErrors((prev) => {
        const next = { ...prev }
        delete next.cidades
        return next
      })
    }
  }

  const clearAllCidades = () => {
    setForm((prev) => ({
      ...prev,
      cidades: [],
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const result = regiaoSchema.safeParse(form)
    if (!result.success) {
      const fieldErrors: Record<string, string> = {}
      result.error.issues.forEach((issue) => {
        const key = issue.path[0] as string
        if (!fieldErrors[key]) fieldErrors[key] = issue.message
      })
      setErrors(fieldErrors)
      toast({
        title: 'Verifique os campos obrigatórios',
        description:
          fieldErrors.nome ||
          fieldErrors.uf ||
          fieldErrors.cidades ||
          'Preencha todos os campos destacados.',
        variant: 'destructive',
      })
      return
    }

    setErrors({})
    setSaving(true)
    try {
      // Se marcou "todo o estado", cidades fica vazio por consistência retroativa
      const payload = {
        nome: result.data.nome.trim(),
        uf: result.data.uf.toUpperCase().trim(),
        todo_o_estado: result.data.todo_o_estado,
        cidades: result.data.todo_o_estado ? [] : result.data.cidades,
        status: result.data.status,
      }

      if (editing) {
        await updateRegiao({ id: editing.id, ...payload })
        toast({ title: 'Região atualizada com sucesso' })
      } else {
        await insertRegiao(payload)
        toast({ title: 'Região criada com sucesso' })
      }
      onSaved()
      onOpenChange(false)
    } catch (err) {
      toast({
        title: 'Erro ao salvar região',
        description: err instanceof Error ? err.message : 'Erro desconhecido',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const selectedUfInfo = ESTADOS_BR.find((e) => e.uf === form.uf)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <MapPin className="w-5 h-5 text-emerald-700" />
            {editing ? 'Editar Região Comercial' : 'Nova Região Comercial'}
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            Defina o estado e se a região cobre todo o estado ou apenas cidades específicas.
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Nome da Região */}
          <div className="space-y-1">
            <Label className="text-xs font-semibold">
              Nome da Região <span className="text-destructive">*</span>
            </Label>
            <Input
              placeholder="Ex: Interior SP, Capital e Litoral SP, Vale do Paraíba..."
              value={form.nome}
              onChange={(e) => {
                setForm({ ...form, nome: e.target.value })
                if (errors.nome) setErrors((prev) => ({ ...prev, nome: '' }))
              }}
              className="h-10 text-sm"
              autoFocus
            />
            {errors.nome && <p className="text-xs text-destructive mt-1">{errors.nome}</p>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Seleção do Estado (UF) */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold">
                Estado (UF) <span className="text-destructive">*</span>
              </Label>
              <Select value={form.uf} onValueChange={handleUfChange}>
                <SelectTrigger className="h-10 text-sm">
                  <SelectValue placeholder="Selecione o estado..." />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {ESTADOS_BR.map((item) => (
                    <SelectItem key={item.uf} value={item.uf}>
                      <span className="font-semibold text-emerald-900 mr-2">{item.uf}</span>
                      <span className="text-slate-600">— {item.nome}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.uf && <p className="text-xs text-destructive mt-1">{errors.uf}</p>}
            </div>

            {/* Status */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Status</Label>
              <Select
                value={form.status}
                onValueChange={(v) => setForm({ ...form, status: v as 'Ativo' | 'Inativo' })}
              >
                <SelectTrigger className="h-10 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Ativo">Ativo</SelectItem>
                  <SelectItem value="Inativo">Inativo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Opção: Cobrir Todo o Estado vs Apenas Cidades Específicas */}
          <div className="p-3.5 rounded-lg border bg-emerald-50/50 border-emerald-100 space-y-3">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <Label
                  htmlFor="todo_o_estado_toggle"
                  className="text-sm font-semibold text-emerald-950 cursor-pointer flex items-center gap-1.5"
                >
                  <Building2 className="w-4 h-4 text-emerald-700" />
                  Cobrir todo o estado de {selectedUfInfo ? selectedUfInfo.nome : 'selecionado'}
                </Label>
                <p className="text-xs text-muted-foreground">
                  Quando ativo, a região atende a qualquer cidade do estado. Desative para escolher
                  apenas cidades específicas.
                </p>
              </div>
              <Switch
                id="todo_o_estado_toggle"
                checked={form.todo_o_estado}
                onCheckedChange={(checked) => {
                  setForm((prev) => ({
                    ...prev,
                    todo_o_estado: checked,
                  }))
                  if (errors.cidades) {
                    setErrors((prev) => {
                      const next = { ...prev }
                      delete next.cidades
                      return next
                    })
                  }
                }}
              />
            </div>

            {/* SELEÇÃO DE CIDADES ESPECÍFICAS (quando todo_o_estado é falso) */}
            {!form.todo_o_estado && (
              <div className="mt-3 pt-3 border-t border-emerald-200/60 space-y-3 bg-white p-3 rounded-md">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
                  <div>
                    <span className="text-xs font-semibold text-slate-800">
                      Cidades de{' '}
                      {form.uf
                        ? `${form.uf} (${selectedUfInfo?.nome || ''})`
                        : 'selecione um estado primeiro'}
                    </span>
                    <span className="text-xs text-muted-foreground ml-2">
                      ({form.cidades.length} selecionada{form.cidades.length === 1 ? '' : 's'})
                    </span>
                  </div>

                  {form.uf && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={selectAllCidades}
                        className="h-8 text-xs gap-1"
                        disabled={availableCidades.length === 0}
                      >
                        <CheckSquare className="w-3.5 h-3.5" /> Selecionar todas
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={clearAllCidades}
                        className="h-8 text-xs gap-1"
                        disabled={form.cidades.length === 0}
                      >
                        <Square className="w-3.5 h-3.5" /> Limpar
                      </Button>
                    </div>
                  )}
                </div>

                {!form.uf ? (
                  <div className="p-4 text-center text-xs text-muted-foreground border border-dashed rounded-md bg-slate-50">
                    Selecione o estado (UF) acima para listar as cidades disponíveis.
                  </div>
                ) : (
                  <>
                    <div className="relative">
                      <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                      <Input
                        placeholder={`Buscar cidade em ${form.uf} (ex: Campinas, Santos, Sorocaba)...`}
                        value={searchCidade}
                        onChange={(e) => setSearchCidade(e.target.value)}
                        className="pl-9 h-9 text-xs"
                      />
                    </div>

                    <div className="border rounded-md p-2.5 max-h-56 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-1.5 bg-slate-50/50">
                      {filteredCidades.map((cidade) => {
                        const isChecked = form.cidades.includes(cidade)
                        return (
                          <label
                            key={cidade}
                            onClick={() => toggleCidade(cidade)}
                            className={`flex items-center gap-2 px-2.5 py-1.5 rounded border text-xs cursor-pointer transition-colors ${
                              isChecked
                                ? 'bg-emerald-50 border-emerald-400 text-emerald-950 font-medium shadow-xs'
                                : 'bg-white border-slate-200 hover:bg-slate-100 text-slate-700'
                            }`}
                          >
                            <Checkbox
                              checked={isChecked}
                              onCheckedChange={() => toggleCidade(cidade)}
                            />
                            <span className="truncate">{cidade}</span>
                          </label>
                        )
                      })}

                      {filteredCidades.length === 0 && (
                        <p className="col-span-full text-center text-xs text-muted-foreground py-4">
                          Nenhuma cidade encontrada para &quot;{searchCidade}&quot;.
                        </p>
                      )}
                    </div>

                    {errors.cidades && (
                      <p className="text-xs text-destructive font-medium">{errors.cidades}</p>
                    )}

                    {/* Resumo das cidades selecionadas */}
                    {form.cidades.length > 0 && (
                      <div className="p-2 rounded bg-emerald-50 border border-emerald-200 text-xs">
                        <div className="font-semibold text-emerald-900 mb-1 flex items-center justify-between">
                          <span>Cidades selecionadas ({form.cidades.length}):</span>
                        </div>
                        <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                          {form.cidades.map((c) => (
                            <Badge
                              key={c}
                              variant="secondary"
                              className="text-[11px] bg-white border border-emerald-300 text-emerald-900 font-normal"
                            >
                              {c}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <span>
              Múltiplas regiões podem ter a mesma UF (ex.: representantes diferentes atuando em
              cidades distintas do mesmo estado).
            </span>
          </div>

          <DialogFooter className="mt-4 pt-3 border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              className="bg-[#0b3c26] hover:bg-[#082a1b] text-white"
              disabled={saving}
            >
              {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              {editing ? 'Salvar Alterações' : 'Criar Região'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
