import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
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
import { Loader2, Sparkles } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { FormattedNumberInput } from '@/components/shared/formatted-number-input'
import { MultiSelectRelation } from '@/components/shared/searchable-multi-select'
import { toast } from '@/hooks/use-toast'
import { Acessorio, AcessorioInsert, AcessorioUpdate } from '@/types/acessorio'
import { insertAcessorio, updateAcessorio } from '@/services/acessorios'
import { generateAISuggestion } from '@/services/ai-suggestions'

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  editing: Acessorio | null
  onSaved: () => void
  userName?: string
  userId?: string
}

interface FormState {
  nome: string
  tipo: string
  moeda: string
  valor: number
  fator_nac: number
  status: string
  versoes: string[]
  especificacoes_tecnicas: string
}

const empty: FormState = {
  nome: '',
  tipo: '',
  moeda: 'BRL',
  valor: 0,
  fator_nac: 1,
  status: 'Ativo',
  versoes: [],
  especificacoes_tecnicas: '',
}

export function AcessorioForm({ open, onOpenChange, editing, onSaved, userName, userId }: Props) {
  const [form, setForm] = useState<FormState>(empty)
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    if (open) {
      if (editing) {
        setForm({
          nome: editing.nome,
          tipo: editing.tipo ?? '',
          moeda: editing.moeda ?? 'BRL',
          valor: editing.valor ?? 0,
          fator_nac: editing.fator_nac ?? 1,
          status: editing.status ?? 'Ativo',
          versoes: Array.isArray(editing.versoes) ? editing.versoes : [],
          especificacoes_tecnicas: editing.especificacoes_tecnicas ?? '',
        })
      } else {
        setForm(empty)
      }
    }
  }, [editing, open])

  const upd = (k: keyof FormState, v: unknown) => setForm((p) => ({ ...p, [k]: v }))

  const handleAI = async () => {
    setGenerating(true)
    const { especificacoes, error } = await generateAISuggestion({
      nome: form.nome,
      tipo: form.tipo,
      valor: form.valor,
      moeda: form.moeda,
    })
    setGenerating(false)
    if (error) {
      toast({ title: 'Erro na sugestão IA', description: error, variant: 'destructive' })
      return
    }
    if (especificacoes) upd('especificacoes_tecnicas', especificacoes)
    toast({ title: 'Especificações geradas!' })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.nome.trim()) {
      toast({ title: 'Nome é obrigatório', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      if (editing) {
        const payload: AcessorioUpdate = { id: editing.id, ...form }
        await updateAcessorio(payload, userId, userName)
        toast({ title: 'Acessório atualizado' })
      } else {
        const payload = { ...form } as AcessorioInsert
        await insertAcessorio(payload, userId, userName)
        toast({ title: 'Acessório criado' })
      }
      onSaved()
      onOpenChange(false)
    } catch (err) {
      toast({
        title: 'Erro ao salvar',
        description: err instanceof Error ? err.message : '',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? 'Editar' : 'Novo'} Acessório</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Nome *</Label>
              <Input value={form.nome} onChange={(e) => upd('nome', e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Tipo</Label>
              <Input value={form.tipo} onChange={(e) => upd('tipo', e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Moeda</Label>
              <Select value={form.moeda} onValueChange={(v) => upd('moeda', v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BRL">BRL</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Valor</Label>
              <FormattedNumberInput value={form.valor} onChange={(v) => upd('valor', v)} />
            </div>
            <div>
              <Label className="text-xs">Fator NAC</Label>
              <FormattedNumberInput
                value={form.fator_nac}
                onChange={(v) => upd('fator_nac', v)}
                maxDecimals={4}
              />
            </div>
            <div>
              <Label className="text-xs">Status</Label>
              <Select value={form.status} onValueChange={(v) => upd('status', v)}>
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
          <div className="space-y-2">
            <Label className="text-xs mb-1 block">Versões Vinculadas</Label>
            {editing && (
              <div className="rounded-md border bg-muted/40 p-2.5">
                <span className="text-[11px] font-medium text-muted-foreground block mb-1.5">
                  Vínculos atuais:
                </span>
                {Array.isArray(editing.versao_nomes) && editing.versao_nomes.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {editing.versao_nomes.map((nome, idx) => (
                      <Badge key={idx} variant="secondary" className="text-xs font-normal">
                        {nome}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">Nenhuma versão vinculada</p>
                )}
              </div>
            )}
            <MultiSelectRelation
              values={form.versoes}
              onChange={(ids) => upd('versoes', ids)}
              tableName="versoes"
              labelColumn="nome"
              placeholder="Selecionar versões..."
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <Label className="text-xs">Especificações Técnicas</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAI}
                disabled={generating || !form.nome}
                className="gap-1.5 h-7 text-xs"
              >
                {generating ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Sparkles className="w-3 h-3" />
                )}
                Sugestão IA
              </Button>
            </div>
            <Textarea
              value={form.especificacoes_tecnicas}
              onChange={(e) => upd('especificacoes_tecnicas', e.target.value)}
              rows={4}
              placeholder="Especificações técnicas..."
            />
          </div>
          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" className="bg-primary" disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              {editing ? 'Atualizar' : 'Salvar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
