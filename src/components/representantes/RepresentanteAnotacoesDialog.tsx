import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
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
  StickyNote,
  Plus,
  Trash2,
  Edit2,
  Calendar,
  User,
  Loader2,
  Clock,
  Sparkles,
} from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { useAuth } from '@/hooks/use-auth'
import { Representante } from '@/types/representante'
import { RepresentanteAnotacao } from '@/types/representante-anotacao'
import {
  fetchRepresentanteAnotacoes,
  insertRepresentanteAnotacao,
  updateRepresentanteAnotacao,
  deleteRepresentanteAnotacao,
} from '@/services/representante-anotacoes'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  representante: Representante | null
}

const CURRENT_YEAR = new Date().getFullYear()
const YEAR_OPTIONS = [CURRENT_YEAR + 1, CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2]

export function RepresentanteAnotacoesDialog({ open, onOpenChange, representante }: Props) {
  const { user } = useAuth()
  const [anotacoes, setAnotacoes] = useState<RepresentanteAnotacao[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedYear, setSelectedYear] = useState<string>('todos')

  // Form states
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingAnotacao, setEditingAnotacao] = useState<RepresentanteAnotacao | null>(null)
  const [titulo, setTitulo] = useState('')
  const [texto, setTexto] = useState('')
  const [anoReferencia, setAnoReferencia] = useState<number>(CURRENT_YEAR)
  const [saving, setSaving] = useState(false)

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<RepresentanteAnotacao | null>(null)
  const [deleting, setDeleting] = useState(false)

  const repId = representante?.id

  const loadAnotacoes = useCallback(async () => {
    if (!repId) return
    setLoading(true)
    try {
      const data = await fetchRepresentanteAnotacoes(repId)
      setAnotacoes(data)
    } catch (err) {
      toast({
        title: 'Erro ao carregar anotações',
        description: err instanceof Error ? err.message : 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [repId])

  useEffect(() => {
    if (open && repId) {
      loadAnotacoes()
      setIsFormOpen(false)
      setEditingAnotacao(null)
      setSelectedYear('todos')
    } else {
      setAnotacoes([])
    }
  }, [open, repId, loadAnotacoes])

  const openNewForm = () => {
    setEditingAnotacao(null)
    setTitulo('')
    setTexto('')
    setAnoReferencia(CURRENT_YEAR)
    setIsFormOpen(true)
  }

  const openEditForm = (item: RepresentanteAnotacao) => {
    setEditingAnotacao(item)
    setTitulo(item.titulo)
    setTexto(item.texto)
    setAnoReferencia(item.ano_referencia || CURRENT_YEAR)
    setIsFormOpen(true)
  }

  const cancelForm = () => {
    setIsFormOpen(false)
    setEditingAnotacao(null)
    setTitulo('')
    setTexto('')
    setAnoReferencia(CURRENT_YEAR)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!repId) return
    if (!titulo.trim()) {
      toast({ title: 'Título é obrigatório', variant: 'destructive' })
      return
    }
    if (!texto.trim()) {
      toast({ title: 'O alinhamento/texto da anotação é obrigatório', variant: 'destructive' })
      return
    }

    setSaving(true)
    try {
      if (editingAnotacao) {
        await updateRepresentanteAnotacao({
          id: editingAnotacao.id,
          titulo: titulo.trim(),
          texto: texto.trim(),
          ano_referencia: anoReferencia,
        })
        toast({ title: 'Anotação atualizada com sucesso' })
      } else {
        await insertRepresentanteAnotacao({
          representante_id: repId,
          ano_referencia: anoReferencia,
          titulo: titulo.trim(),
          texto: texto.trim(),
          autor_id: user?.id || null,
          autor_nome: user?.name || user?.email || 'Gestão',
        })
        toast({ title: 'Anotação cadastrada com sucesso' })
      }
      cancelForm()
      loadAnotacoes()
    } catch (err) {
      toast({
        title: 'Erro ao salvar anotação',
        description: err instanceof Error ? err.message : 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteRepresentanteAnotacao(deleteTarget.id)
      toast({ title: 'Anotação removida com sucesso' })
      setDeleteTarget(null)
      loadAnotacoes()
    } catch (err) {
      toast({
        title: 'Erro ao excluir',
        description: err instanceof Error ? err.message : 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setDeleting(false)
    }
  }

  const filteredAnotacoes = useMemo(() => {
    if (selectedYear === 'todos') return anotacoes
    const yr = parseInt(selectedYear, 10)
    return anotacoes.filter((a) => a.ano_referencia === yr)
  }, [anotacoes, selectedYear])

  const repNome = representante?.fantasia || representante?.razao_social || 'Representante'

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
          {/* Header Bener style */}
          <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0 bg-[#0b3c26] text-white">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-1">
                <DialogTitle className="text-lg font-bold flex items-center gap-2 text-white">
                  <StickyNote className="w-5 h-5 text-emerald-300" />
                  Anotações &amp; Alinhamentos Regionais
                </DialogTitle>
                <DialogDescription className="text-emerald-100 text-xs">
                  Plano anual e combinados de atuação com o representante{' '}
                  <strong className="text-white underline">{repNome}</strong>
                </DialogDescription>
              </div>
              {!isFormOpen && (
                <Button
                  onClick={openNewForm}
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold gap-1.5 shadow-sm"
                >
                  <Plus className="w-4 h-4" /> Nova Anotação
                </Button>
              )}
            </div>
          </DialogHeader>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6 min-h-[300px]">
            {/* Inline creation/edit form */}
            {isFormOpen && (
              <form
                onSubmit={handleSave}
                className="border-2 border-emerald-500/40 bg-emerald-50/20 dark:bg-emerald-950/20 rounded-lg p-5 space-y-4 shadow-sm animate-in fade-in-50 duration-200"
              >
                <div className="flex items-center justify-between pb-2 border-b border-emerald-500/20">
                  <h3 className="text-sm font-bold text-emerald-900 dark:text-emerald-200 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    {editingAnotacao ? 'Editar Alinhamento' : 'Novo Alinhamento Regional'}
                  </h3>
                  <Badge
                    variant="outline"
                    className="border-emerald-300 text-emerald-800 dark:text-emerald-300 font-mono text-xs"
                  >
                    Ano: {anoReferencia}
                  </Badge>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div className="sm:col-span-3">
                    <Label className="text-xs font-semibold">Título do Alinhamento *</Label>
                    <Input
                      value={titulo}
                      onChange={(e) => setTitulo(e.target.value)}
                      placeholder="Ex: Metas de torneamento, foco em feiras regionais, clientes prioritários..."
                      className="mt-1"
                      required
                      autoFocus
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold">Ano de Referência *</Label>
                    <Select
                      value={String(anoReferencia)}
                      onValueChange={(v) => setAnoReferencia(parseInt(v, 10))}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {YEAR_OPTIONS.map((yr) => (
                          <SelectItem key={yr} value={String(yr)}>
                            {yr}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label className="text-xs font-semibold">
                    O que foi alinhado para a região durante o ano *
                  </Label>
                  <Textarea
                    value={texto}
                    onChange={(e) => setTexto(e.target.value)}
                    rows={4}
                    placeholder="Descreva detalhadamente o que foi combinado: plano de visitas, modelos foco, metas de faturamento, apoio técnico ou feiras alinhadas com o representante..."
                    className="mt-1 text-sm"
                    required
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Visão exclusiva de gestão (Admin e Gerentes).
                  </p>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-emerald-500/20">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={cancelForm}
                    disabled={saving}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={saving}
                    className="bg-[#0b3c26] hover:bg-[#082f1e] text-white font-semibold"
                  >
                    {saving && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
                    {editingAnotacao ? 'Salvar Alterações' : 'Salvar Anotação'}
                  </Button>
                </div>
              </form>
            )}

            {/* Filter and stats row */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-muted/30 p-3 rounded-md border text-xs">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground font-medium">Filtrar por ano:</span>
                <Select value={selectedYear} onValueChange={setSelectedYear}>
                  <SelectTrigger className="h-8 w-32 bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os anos</SelectItem>
                    {YEAR_OPTIONS.map((yr) => (
                      <SelectItem key={yr} value={String(yr)}>
                        Ano {yr}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="text-muted-foreground">
                Total de <strong>{filteredAnotacoes.length}</strong> anotação(ões) encontrada(s)
              </div>
            </div>

            {/* List */}
            {loading ? (
              <div className="py-12 flex flex-col items-center justify-center gap-2 text-muted-foreground text-sm">
                <Loader2 className="w-6 h-6 animate-spin text-[#0b3c26]" />
                Carregando anotações do representante...
              </div>
            ) : filteredAnotacoes.length === 0 ? (
              <div className="py-10 text-center border border-dashed rounded-lg bg-card p-6 space-y-3">
                <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-[#0b3c26] dark:text-emerald-400 mx-auto flex items-center justify-center">
                  <StickyNote className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-foreground">
                    Nenhuma anotação cadastrada
                  </p>
                  <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                    {selectedYear !== 'todos'
                      ? `Não há anotações cadastradas para o ano de ${selectedYear}.`
                      : 'Registre alinhamentos, acordos de metas e plano regional para acompanhar o representante.'}
                  </p>
                </div>
                {!isFormOpen && (
                  <Button
                    onClick={openNewForm}
                    size="sm"
                    variant="outline"
                    className="gap-1.5 text-xs text-[#0b3c26] border-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                  >
                    <Plus className="w-3.5 h-3.5" /> Adicionar primeira anotação
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {filteredAnotacoes.map((item) => (
                  <div
                    key={item.id}
                    className="border rounded-lg p-4 bg-card hover:border-emerald-400/60 hover:shadow-sm transition-all space-y-2.5"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm font-bold text-foreground">{item.titulo}</h4>
                          <Badge
                            variant="secondary"
                            className="bg-emerald-50 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 font-semibold text-[11px]"
                          >
                            <Calendar className="w-3 h-3 mr-1" />
                            {item.ano_referencia}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                          {item.autor_nome && (
                            <span className="flex items-center gap-1">
                              <User className="w-3 h-3" /> Registrado por:{' '}
                              <strong className="text-foreground font-medium">
                                {item.autor_nome}
                              </strong>
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />{' '}
                            {new Date(item.created_at).toLocaleDateString('pt-BR', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 self-end sm:self-start">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          onClick={() => openEditForm(item)}
                          title="Editar anotação"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive/80 hover:text-destructive"
                          onClick={() => setDeleteTarget(item)}
                          title="Excluir anotação"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>

                    <p className="text-xs text-foreground/90 leading-relaxed whitespace-pre-wrap bg-muted/30 p-3 rounded-md border">
                      {item.texto}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="border-t px-6 py-3 bg-muted/20 flex justify-end">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmation modal for delete */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir anotação?</AlertDialogTitle>
            <p className="text-sm text-muted-foreground">
              Deseja realmente excluir a anotação &quot;<strong>{deleteTarget?.titulo}</strong>
              &quot;? Esta ação não pode ser desfeita.
            </p>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deleting ? 'Excluindo...' : 'Excluir Anotação'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
