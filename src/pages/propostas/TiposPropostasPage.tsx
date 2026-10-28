import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog'
import { Textarea } from '@/components/ui/textarea'
import { Plus, Search, Edit, Trash2, Loader2, Clock, User, Info, Eye } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  parseParagraphs,
  stripBoldMarkers,
  splitIntoParagraphs,
  isTaxValueEmpty,
  isCommercialFieldEmpty,
} from '@/lib/paragraphs'
import { toast } from '@/hooks/use-toast'
import { LoadingState, EmptyState, ErrorState } from '@/components/StateViews'
import { useDebounce } from '@/hooks/use-debounce'
import { formatDate, formatDateTime } from '@/lib/format'
import { useAuth } from '@/hooks/use-auth'
import { CustomFieldsEditor, CustomField } from '@/components/propostas/CustomFieldsEditor'
import {
  fetchTiposProposta,
  insertTipoProposta,
  updateTipoProposta,
  deleteTipoProposta,
  checkNomeDuplicate,
} from '@/services/tipos-proposta'
import { TipoProposta } from '@/types/tipo-proposta'

function ParagraphsDisplay({
  value,
  columnLabel,
  placeholder = 'Não informado',
}: {
  value?: string | number | null
  columnLabel?: string
  placeholder?: string
}) {
  const isTax =
    columnLabel &&
    (columnLabel.toLowerCase().includes('ipi') || columnLabel.toLowerCase().includes('icms'))
  const isEmpty = isTax
    ? isTaxValueEmpty(value, columnLabel)
    : isCommercialFieldEmpty(value, columnLabel)
  if (isEmpty) {
    return <span className="text-muted-foreground italic text-xs">{placeholder}</span>
  }
  const paragraphs = parseParagraphs(value)
  if (paragraphs.length === 0) {
    return <span className="text-muted-foreground italic text-xs">{placeholder}</span>
  }
  return (
    <div className="space-y-1.5 text-xs text-foreground leading-relaxed">
      {paragraphs.map((p, idx) => (
        <div key={idx} className="border-l-2 border-primary/30 pl-2 py-0.5 bg-muted/20 rounded-xs">
          {p.title && (
            <strong className="block font-bold text-primary text-[11px] uppercase tracking-wide mb-0.5">
              {p.title}
            </strong>
          )}
          {p.body && <span>{p.body}</span>}
        </div>
      ))}
    </div>
  )
}

interface FormData {
  nome: string
  status: string
  aplicar_fator_nac: boolean
  comissao: number
  frase_preco: string
  frase_comissao: string
  prazo_entrega: string
  condicoes_pagamento: string
  garantia: string
  assistencia_tecnica: string
  treinamento_tecnico: string
  transporte_seguro: string
  validade_oferta: string
  imposto_ipi: string
  imposto_icms: string
  campos_adicionais: CustomField[]
  atualizado_por?: string
}

const emptyForm: FormData = {
  nome: '',
  status: 'Ativo',
  aplicar_fator_nac: false,
  comissao: 0,
  frase_preco: '',
  frase_comissao: '',
  prazo_entrega: '',
  condicoes_pagamento: '',
  garantia: '',
  assistencia_tecnica: '',
  treinamento_tecnico: '',
  transporte_seguro: '',
  validade_oferta: '',
  imposto_ipi: '',
  imposto_icms: '',
  campos_adicionais: [],
  atualizado_por: '',
}

export default function TiposPropostasPage() {
  const { user } = useAuth()
  const [tab, setTab] = useState('registros')
  const [data, setData] = useState<TipoProposta[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('Todos')
  const [editing, setEditing] = useState<TipoProposta | null>(null)
  const [viewing, setViewing] = useState<TipoProposta | null>(null)
  const [form, setForm] = useState<FormData>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<TipoProposta | null>(null)
  const [deleting, setDeleting] = useState(false)
  const debouncedSearch = useDebounce(search, 300)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      setData(await fetchTiposProposta())
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const formatStatusLabel = (st?: string | null): string => {
    if (!st) return 'Ativo'
    const clean = st.trim()
    if (clean === 'A' || clean.toLowerCase() === 'ativo') return 'Ativo'
    if (clean === 'I' || clean.toLowerCase() === 'inativo') return 'Inativo'
    return clean
  }

  const filtered = data.filter((t) => {
    const matchesSearch =
      !debouncedSearch || t.nome.toLowerCase().includes(debouncedSearch.toLowerCase())
    const formattedStatus = formatStatusLabel(t.status)
    const matchesStatus =
      statusFilter === 'Todos' || formattedStatus === statusFilter || t.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const upd = (key: keyof FormData, value: any) => setForm((p) => ({ ...p, [key]: value }))

  const parseCamposAdicionais = (raw: any): CustomField[] => {
    if (!raw) return []
    if (Array.isArray(raw)) return raw as CustomField[]
    if (typeof raw === 'string') {
      try {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) return parsed
      } catch {
        return []
      }
    }
    return []
  }

  const handleEdit = (item: TipoProposta) => {
    setEditing(item)
    setForm({
      nome: item.nome,
      status: formatStatusLabel(item.status),
      aplicar_fator_nac: item.aplicar_fator_nac ?? false,
      comissao: item.comissao ?? 0,
      frase_preco: item.frase_preco ?? '',
      frase_comissao: item.frase_comissao ?? '',
      prazo_entrega: item.prazo_entrega ?? '',
      condicoes_pagamento: item.condicoes_pagamento ?? '',
      garantia: item.garantia ?? '',
      assistencia_tecnica: item.assistencia_tecnica ?? '',
      treinamento_tecnico: item.treinamento_tecnico ?? '',
      transporte_seguro: item.transporte_seguro ?? '',
      validade_oferta: item.validade_oferta ?? '',
      imposto_ipi: item.imposto_ipi ?? '',
      imposto_icms: item.imposto_icms ?? '',
      campos_adicionais: parseCamposAdicionais(item.campos_adicionais),
      atualizado_por: item.atualizado_por ?? '',
    })
    setTab('cadastro')
  }

  const handleNew = () => {
    setEditing(null)
    setForm(emptyForm)
    setTab('cadastro')
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmedNome = form.nome.replace(/\s+/g, ' ').trim()
    if (!trimmedNome) {
      toast({ title: 'Nome é obrigatório', variant: 'destructive' })
      return
    }
    let finalNome = trimmedNome
    const isDup = await checkNomeDuplicate(trimmedNome, editing?.id)
    if (isDup) {
      if (!window.confirm('Já existe um tipo com este nome. Deseja criar com sufixo "(Copia)"?')) {
        return
      }
      finalNome = `${trimmedNome} (Copia)`
      upd('nome', finalNome)
    }
    setSaving(true)
    try {
      const userName = user?.name || user?.email || 'Sistema'
      const payload = {
        ...form,
        nome: finalNome,
        campos_adicionais: form.campos_adicionais,
        atualizado_por: userName,
      }
      if (editing) {
        await updateTipoProposta({ id: editing.id, ...payload })
        toast({ title: 'Tipo atualizado com sucesso' })
      } else {
        await insertTipoProposta(payload)
        toast({ title: 'Tipo criado com sucesso' })
      }
      setTab('registros')
      setEditing(null)
      loadData()
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

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteTipoProposta(deleteTarget.id)
      toast({ title: 'Tipo excluído com sucesso' })
      setDeleteTarget(null)
      loadData()
    } catch (err) {
      toast({
        title: 'Erro ao excluir',
        description: err instanceof Error ? err.message : '',
        variant: 'destructive',
      })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <h1 className="text-2xl font-bold">Tipos de Propostas</h1>
        <div className="flex items-center gap-2">
          <Button onClick={handleNew} className="bg-primary gap-1">
            <Plus className="w-4 h-4" /> Novo
          </Button>
        </div>
      </div>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="registros">Registros</TabsTrigger>
          <TabsTrigger value="cadastro">Cadastro</TabsTrigger>
        </TabsList>
        <TabsContent value="registros" className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                placeholder="Buscar..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Todos">Todos</SelectItem>
                <SelectItem value="Ativo">Ativo</SelectItem>
                <SelectItem value="Inativo">Inativo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {loading ? (
            <LoadingState count={4} />
          ) : error ? (
            <ErrorState message="Erro ao carregar tipos" onRetry={loadData} />
          ) : filtered.length === 0 ? (
            <EmptyState
              title="Nenhum tipo encontrado"
              actionText="Novo Tipo"
              onAction={handleNew}
            />
          ) : (
            <div className="border rounded-lg bg-card overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Comissão</TableHead>
                    <TableHead>Última Alteração</TableHead>
                    <TableHead>Data Cadastro</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((t) => {
                    const statusLabel = formatStatusLabel(t.status)
                    const isAtivo = statusLabel === 'Ativo'
                    return (
                      <TableRow key={t.id}>
                        <TableCell className="font-medium">{t.nome}</TableCell>
                        <TableCell>
                          <Badge variant={isAtivo ? 'default' : 'secondary'}>{statusLabel}</Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {t.comissao != null ? `${t.comissao}%` : '-'}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {t.atualizado_por ? (
                            <span>{t.atualizado_por}</span>
                          ) : (
                            <span className="italic opacity-60">N/A</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatDate(t.created_at)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Visualizar detalhes e parágrafos formatados"
                            onClick={() => setViewing(t)}
                          >
                            <Eye className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Editar"
                            onClick={() => handleEdit(t)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Excluir"
                            className="text-destructive"
                            onClick={() => setDeleteTarget(t)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}{' '}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
        <TabsContent value="cadastro">
          <form onSubmit={handleSave} className="space-y-6 max-w-4xl">
            <Card>
              <CardContent className="p-5 space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  Informações Básicas
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Nome *</Label>
                    <Input
                      value={form.nome}
                      onChange={(e) => upd('nome', e.target.value)}
                      placeholder="Nome do tipo de proposta"
                    />
                  </div>
                  <div>
                    <Label>Status</Label>
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
                <div className="flex items-center gap-3 pt-1">
                  <Checkbox
                    id="aplicar_fator_nac"
                    checked={form.aplicar_fator_nac}
                    onCheckedChange={(v) => upd('aplicar_fator_nac', v === true)}
                  />
                  <Label htmlFor="aplicar_fator_nac" className="cursor-pointer">
                    Aplicar fator de Nacionalização
                  </Label>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5 space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  Comercial
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label>Comissão (%)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={form.comissao}
                      onChange={(e) => upd('comissao', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div>
                    <Label>Frase do Preço</Label>
                    <Input
                      value={form.frase_preco}
                      onChange={(e) => upd('frase_preco', e.target.value)}
                      placeholder="Ex: Preços sujeitos a confirmação"
                    />
                  </div>
                  <div>
                    <Label>Frase Comissão</Label>
                    <Input
                      value={form.frase_comissao}
                      onChange={(e) => upd('frase_comissao', e.target.value)}
                      placeholder="Ex: Comissão inclusa no valor"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                  <div>
                    <Label>Imposto IPI</Label>
                    <Textarea
                      rows={3}
                      value={form.imposto_ipi}
                      onChange={(e) => upd('imposto_ipi', e.target.value)}
                      placeholder="Alíquota ou texto explicativo de IPI com decretos..."
                      className="whitespace-pre-wrap font-sans text-xs"
                    />
                    {form.imposto_ipi && splitIntoParagraphs(form.imposto_ipi).length > 1 && (
                      <div className="mt-1.5 p-2 bg-muted/30 border border-dashed rounded text-[11px] space-y-1">
                        <span className="text-muted-foreground font-semibold block text-[10px] uppercase tracking-wider">
                          Prévia da renderização (parágrafos detectados:{' '}
                          {splitIntoParagraphs(form.imposto_ipi).length}):
                        </span>
                        <ParagraphsDisplay value={form.imposto_ipi} />
                      </div>
                    )}
                  </div>
                  <div>
                    <Label>Imposto ICMS</Label>
                    <Textarea
                      rows={3}
                      value={form.imposto_icms}
                      onChange={(e) => upd('imposto_icms', e.target.value)}
                      placeholder="Alíquota ou texto explicativo de ICMS com convênios..."
                      className="whitespace-pre-wrap font-sans text-xs"
                    />
                    {form.imposto_icms && splitIntoParagraphs(form.imposto_icms).length > 1 && (
                      <div className="mt-1.5 p-2 bg-muted/30 border border-dashed rounded text-[11px] space-y-1">
                        <span className="text-muted-foreground font-semibold block text-[10px] uppercase tracking-wider">
                          Prévia da renderização (parágrafos detectados:{' '}
                          {splitIntoParagraphs(form.imposto_icms).length}):
                        </span>
                        <ParagraphsDisplay value={form.imposto_icms} />
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5 space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  Logística e Condições
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Prazo de Entrega</Label>
                    <Input
                      value={form.prazo_entrega}
                      onChange={(e) => upd('prazo_entrega', e.target.value)}
                      placeholder="Ex: 60 dias após confirmação"
                    />
                  </div>
                  <div>
                    <Label>Condições de Pagamento</Label>
                    <Input
                      value={form.condicoes_pagamento}
                      onChange={(e) => upd('condicoes_pagamento', e.target.value)}
                      placeholder="Ex: 30/60/90 dias"
                    />
                    {form.condicoes_pagamento &&
                      splitIntoParagraphs(form.condicoes_pagamento).length > 1 && (
                        <div className="mt-1.5 p-2 bg-muted/30 border border-dashed rounded text-[11px] space-y-1">
                          <span className="text-muted-foreground font-semibold block text-[10px] uppercase tracking-wider">
                            Prévia da renderização (parágrafos:{' '}
                            {splitIntoParagraphs(form.condicoes_pagamento).length}):
                          </span>
                          <ParagraphsDisplay value={form.condicoes_pagamento} />
                        </div>
                      )}
                  </div>
                  <div>
                    <Label>Validade desta Oferta</Label>
                    <Input
                      value={form.validade_oferta}
                      onChange={(e) => upd('validade_oferta', e.target.value)}
                      placeholder="Ex: 30 dias"
                    />
                  </div>
                  <div>
                    <Label>Transporte/Seguro</Label>
                    <Input
                      value={form.transporte_seguro}
                      onChange={(e) => upd('transporte_seguro', e.target.value)}
                      placeholder="Ex: Incluso no valor"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5 space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  Pós-Venda
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Garantia</Label>
                    <Input
                      value={form.garantia}
                      onChange={(e) => upd('garantia', e.target.value)}
                      placeholder="Ex: 12 meses"
                    />
                  </div>
                  <div>
                    <Label>Assistência Técnica</Label>
                    <Input
                      value={form.assistencia_tecnica}
                      onChange={(e) => upd('assistencia_tecnica', e.target.value)}
                      placeholder="Ex: Assistência técnica nacional"
                    />
                  </div>
                  <div>
                    <Label>Treinamento Técnico</Label>
                    <Input
                      value={form.treinamento_tecnico}
                      onChange={(e) => upd('treinamento_tecnico', e.target.value)}
                      placeholder="Ex: Treinamento operacional incluso"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                    Campos Adicionais / Personalizados
                  </h3>
                </div>
                <p className="text-xs text-muted-foreground">
                  Adicione pares chave/valor que serão pré-carregados automaticamente ao emitir
                  propostas deste tipo.
                </p>
                <CustomFieldsEditor
                  fields={form.campos_adicionais}
                  onChange={(fields) => upd('campos_adicionais', fields)}
                />
              </CardContent>
            </Card>

            {editing && (
              <Card className="bg-muted/30 border-dashed">
                <CardContent className="p-5 space-y-3">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 text-primary" />
                    Últimas alterações
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div className="flex items-center gap-2">
                      <User className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <div>
                        <span className="text-muted-foreground">Alterado por: </span>
                        <span className="font-semibold text-foreground">
                          {editing.atualizado_por || 'Não informado'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <div>
                        <span className="text-muted-foreground">Data/Hora da modificação: </span>
                        <span className="font-semibold text-foreground">
                          {editing.updated_at
                            ? formatDateTime(editing.updated_at)
                            : editing.created_at
                              ? formatDateTime(editing.created_at)
                              : 'Não informado'}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setTab('registros')}>
                Cancelar
              </Button>
              <Button type="submit" className="bg-primary" disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                {editing ? 'Atualizar' : 'Salvar'}
              </Button>
            </div>
          </form>
        </TabsContent>
      </Tabs>
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <p className="text-sm text-muted-foreground">
              Deseja excluir <strong>{deleteTarget?.nome}</strong>?
            </p>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deleting ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Diálogo de visualização do tipo de proposta com segmentação de parágrafos */}
      <Dialog open={!!viewing} onOpenChange={(open) => !open && setViewing(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <Badge
                variant={formatStatusLabel(viewing?.status) === 'Ativo' ? 'default' : 'secondary'}
              >
                {formatStatusLabel(viewing?.status)}
              </Badge>
              {viewing?.aplicar_fator_nac && (
                <Badge
                  variant="outline"
                  className="border-emerald-600 text-emerald-700 bg-emerald-50 text-[10px]"
                >
                  Fator Nacionalização
                </Badge>
              )}
            </div>
            <DialogTitle className="text-xl font-bold mt-1">{viewing?.nome}</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Visualização dos campos com marcadores segmentados em parágrafos separados.
            </DialogDescription>
          </DialogHeader>

          {viewing && (
            <div className="space-y-4 pt-2">
              {/* Comercial */}
              <div className="rounded-lg border p-4 space-y-3 bg-card">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Comercial
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <span className="text-muted-foreground block">Comissão:</span>
                    <span className="font-semibold text-foreground">
                      {viewing.comissao != null ? `${viewing.comissao}%` : '0%'}
                    </span>
                  </div>
                  <div className="sm:col-span-2">
                    <span className="text-muted-foreground block">Frase de Comissão:</span>
                    <ParagraphsDisplay value={viewing.frase_comissao} />
                  </div>
                </div>

                <div className="pt-2 border-t space-y-1">
                  <span className="text-xs font-semibold text-muted-foreground block">
                    Frase de Preço:
                  </span>
                  <ParagraphsDisplay value={viewing.frase_preco} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t">
                  <div className="space-y-1">
                    <span className="text-xs font-semibold text-muted-foreground block">
                      Imposto IPI:
                    </span>
                    <ParagraphsDisplay value={viewing.imposto_ipi} columnLabel="Imposto IPI" />
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs font-semibold text-muted-foreground block">
                      Imposto ICMS:
                    </span>
                    <ParagraphsDisplay value={viewing.imposto_icms} columnLabel="Imposto ICMS" />
                  </div>
                </div>
              </div>

              {/* Logística e Condições */}
              <div className="rounded-lg border p-4 space-y-3 bg-card">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Logística e Condições
                </h4>
                <div className="space-y-2">
                  <div className="space-y-1">
                    <span className="text-xs font-semibold text-muted-foreground block">
                      Condições de Pagamento:
                    </span>
                    <ParagraphsDisplay value={viewing.condicoes_pagamento} />
                  </div>

                  <div className="space-y-1 pt-2 border-t">
                    <span className="text-xs font-semibold text-muted-foreground block">
                      Prazo de Entrega:
                    </span>
                    <ParagraphsDisplay value={viewing.prazo_entrega} />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t">
                    <div className="space-y-1">
                      <span className="text-xs font-semibold text-muted-foreground block">
                        Validade da Oferta:
                      </span>
                      <ParagraphsDisplay value={viewing.validade_oferta} />
                    </div>
                    <div className="space-y-1">
                      <span className="text-xs font-semibold text-muted-foreground block">
                        Transporte / Seguro:
                      </span>
                      <ParagraphsDisplay value={viewing.transporte_seguro} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Pós-Venda */}
              <div className="rounded-lg border p-4 space-y-3 bg-card">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Pós-Venda
                </h4>
                <div className="space-y-2">
                  <div className="space-y-1">
                    <span className="text-xs font-semibold text-muted-foreground block">
                      Garantia:
                    </span>
                    <ParagraphsDisplay value={viewing.garantia} />
                  </div>
                  <div className="space-y-1 pt-2 border-t">
                    <span className="text-xs font-semibold text-muted-foreground block">
                      Assistência Técnica:
                    </span>
                    <ParagraphsDisplay value={viewing.assistencia_tecnica} />
                  </div>
                  <div className="space-y-1 pt-2 border-t">
                    <span className="text-xs font-semibold text-muted-foreground block">
                      Treinamento Técnico:
                    </span>
                    <ParagraphsDisplay value={viewing.treinamento_tecnico} />
                  </div>
                </div>
              </div>

              {/* Campos adicionais */}
              {(() => {
                const extras = parseCamposAdicionais(viewing.campos_adicionais)
                if (extras.length === 0) return null
                return (
                  <div className="rounded-lg border p-4 space-y-3 bg-card">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Campos Adicionais
                    </h4>
                    <div className="space-y-2">
                      {extras.map((field, idx) => (
                        <div
                          key={idx}
                          className="space-y-1 border-b last:border-b-0 pb-2 last:pb-0"
                        >
                          <span className="text-xs font-semibold text-muted-foreground block">
                            {field.titulo || `Campo ${idx + 1}`}:
                          </span>
                          <ParagraphsDisplay value={field.conteudo} />
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })()}

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setViewing(null)}>
                  Fechar
                </Button>
                <Button
                  onClick={() => {
                    const item = viewing
                    setViewing(null)
                    handleEdit(item)
                  }}
                  className="bg-primary gap-1.5"
                >
                  <Edit className="w-4 h-4" /> Editar Este Tipo
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
