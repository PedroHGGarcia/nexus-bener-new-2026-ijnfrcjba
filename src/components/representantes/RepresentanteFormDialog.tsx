import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@/components/ui/select'
import {
  Plus,
  Trash2,
  Loader2,
  Phone,
  Mail,
  Search,
  CheckSquare,
  Square,
  Layers,
  MapPin,
  UserCheck,
} from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { RepresentanteFormValues, representanteSchema } from '@/lib/validations/representante'
import { Representante } from '@/types/representante'
import {
  insertRepresentante,
  updateRepresentante,
  fetchRepresentanteVinculos,
  syncRepresentanteVinculos,
} from '@/services/representantes'
import { fetchCategoriasProdutos } from '@/services/categorias-produtos'
import { fetchRegioes } from '@/services/regioes'
import { fetchGerentesParaSelect } from '@/services/users'
import { CategoriaProduto } from '@/types/categoria-produto'
import { Regiao } from '@/types/regiao'
import { formatDate } from '@/lib/utils'
import { ESTADOS_BR } from '@/lib/tax-rates'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  editing: Representante | null
  onSaved: () => void
}

function parseEstadosList(estadoStr?: string | null): string[] {
  if (!estadoStr) return []
  return Array.from(
    new Set(
      estadoStr
        .split(',')
        .map((s) => s.trim().toUpperCase())
        .filter((s) => s.length > 0),
    ),
  )
}

function emptyForm(): RepresentanteFormValues {
  return {
    reg: null,
    cod: '',
    fantasia: '',
    sigla: '',
    regiao: '',
    status: 'Ativo',
    gerente_id: null,
    documento: '',
    rd_station_id: '',
    razao_social: '',
    email: '',
    telefone: '',
    celular: '',
    telefone_principal: '',
    telefones: [],
    emails: [],
    cep: '',
    estado: '',
    estados_atuacao: [],
    cidade: '',
    bairro: '',
    logradouro: '',
    numero: '',
    complementos: '',
    endereco: '',
    categoriaIds: [],
    regiaoIds: [],
  }
}

function toForm(r: Representante): RepresentanteFormValues {
  const parsedEstados = parseEstadosList(r.estado)
  return {
    reg: r.reg !== null && r.reg !== undefined ? r.reg : null,
    cod: r.cod ?? '',
    fantasia: r.fantasia,
    sigla: r.sigla ?? '',
    regiao: r.regiao ?? '',
    status: (r.status as 'Ativo' | 'Inativo') || 'Ativo',
    gerente_id: r.gerente_id ?? null,
    documento: r.documento ?? '',
    rd_station_id: r.rd_station_id ?? '',
    razao_social: r.razao_social ?? '',
    email: r.email ?? '',
    telefone: r.telefone ?? '',
    celular: r.celular ?? '',
    telefone_principal: r.telefone_principal ?? '',
    telefones: r.telefones ?? [],
    emails: r.emails ?? [],
    cep: r.cep ?? '',
    estado: r.estado ?? '',
    estados_atuacao: parsedEstados,
    cidade: r.cidade ?? '',
    bairro: r.bairro ?? '',
    logradouro: r.logradouro ?? '',
    numero: r.numero ?? '',
    complementos: r.complementos ?? '',
    endereco: r.endereco ?? '',
    categoriaIds: [],
    regiaoIds: [],
  }
}

export function RepresentanteFormDialog({ open, onOpenChange, editing, onSaved }: Props) {
  const [form, setForm] = useState<RepresentanteFormValues>(emptyForm())
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Database domain options
  const [availableCategorias, setAvailableCategorias] = useState<CategoriaProduto[]>([])
  const [availableRegioes, setAvailableRegioes] = useState<Regiao[]>([])
  const [availableGerentes, setAvailableGerentes] = useState<{ id: string; nome: string }[]>([])
  const [loadingLookups, setLoadingLookups] = useState(false)

  // Filters for multi-selects
  const [searchCategoria, setSearchCategoria] = useState('')
  const [searchRegiao, setSearchRegiao] = useState('')

  // Load domain lookups when dialog opens
  useEffect(() => {
    if (!open) return

    let isMounted = true
    const loadLookups = async () => {
      setLoadingLookups(true)
      try {
        const [cats, regs, gers] = await Promise.all([
          fetchCategoriasProdutos().catch(() => []),
          fetchRegioes().catch(() => []),
          fetchGerentesParaSelect().catch(() => []),
        ])

        if (!isMounted) return

        // Sort categories by name
        setAvailableCategorias([...cats].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')))
        setAvailableGerentes(gers)

        // Sort regions: all 26 states + DF
        setAvailableRegioes(
          [...regs].sort((a, b) => (a.uf || a.nome).localeCompare(b.uf || b.nome, 'pt-BR')),
        )

        // If editing, load linked IDs
        if (editing) {
          const base = toForm(editing)
          try {
            const vinculos = await fetchRepresentanteVinculos(editing.id)
            if (isMounted) {
              setForm({
                ...base,
                categoriaIds: vinculos.categoriaIds,
                regiaoIds: vinculos.regiaoIds,
              })
            }
          } catch {
            if (isMounted) setForm(base)
          }
        } else {
          setForm(emptyForm())
        }
      } finally {
        if (isMounted) setLoadingLookups(false)
      }
    }

    loadLookups()
    setErrors({})
    setSearchCategoria('')
    setSearchRegiao('')

    return () => {
      isMounted = false
    }
  }, [open, editing])

  const setField = useCallback((key: keyof RepresentanteFormValues, value: unknown) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }, [])

  const addTelefone = () => {
    setForm((prev) => ({ ...prev, telefones: [...prev.telefones, ''] }))
  }

  const removeTelefone = (index: number) => {
    setForm((prev) => ({ ...prev, telefones: prev.telefones.filter((_, i) => i !== index) }))
  }

  const updateTelefone = (index: number, value: string) => {
    setForm((prev) => ({
      ...prev,
      telefones: prev.telefones.map((t, i) => (i === index ? value : t)),
    }))
  }

  const addEmail = () => {
    setForm((prev) => ({ ...prev, emails: [...prev.emails, ''] }))
  }

  const removeEmail = (index: number) => {
    setForm((prev) => ({ ...prev, emails: prev.emails.filter((_, i) => i !== index) }))
  }

  const updateEmail = (index: number, value: string) => {
    setForm((prev) => ({
      ...prev,
      emails: prev.emails.map((e, i) => (i === index ? value : e)),
    }))
  }

  // Multi-select helpers for Categories
  const toggleCategoria = (catId: string) => {
    setForm((prev) => {
      const exists = prev.categoriaIds.includes(catId)
      return {
        ...prev,
        categoriaIds: exists
          ? prev.categoriaIds.filter((id) => id !== catId)
          : [...prev.categoriaIds, catId],
      }
    })
  }

  const selectAllCategorias = () => {
    setForm((prev) => ({
      ...prev,
      categoriaIds: availableCategorias.map((c) => c.id),
    }))
  }

  const clearCategorias = () => {
    setForm((prev) => ({ ...prev, categoriaIds: [] }))
  }

  // Multi-select helpers for Regions (All 26 states + DF)
  const toggleRegiao = (regId: string) => {
    setForm((prev) => {
      const exists = prev.regiaoIds.includes(regId)
      return {
        ...prev,
        regiaoIds: exists
          ? prev.regiaoIds.filter((id) => id !== regId)
          : [...prev.regiaoIds, regId],
      }
    })
  }

  const selectAllRegioes = () => {
    setForm((prev) => ({
      ...prev,
      regiaoIds: availableRegioes.map((r) => r.id),
    }))
  }

  const clearRegioes = () => {
    setForm((prev) => ({ ...prev, regiaoIds: [] }))
  }

  // Multi-select helpers for Estados de Atuação (UF)
  const toggleEstadoAtuacao = (uf: string) => {
    setForm((prev) => {
      const current = prev.estados_atuacao || []
      const exists = current.includes(uf)
      const next = exists ? current.filter((item) => item !== uf) : [...current, uf]
      return {
        ...prev,
        estados_atuacao: next,
        estado: next.join(', '),
      }
    })
  }

  const selectAllEstadosAtuacao = () => {
    const all = ESTADOS_BR.map((e) => e.uf)
    setForm((prev) => ({
      ...prev,
      estados_atuacao: all,
      estado: all.join(', '),
    }))
  }

  const clearEstadosAtuacao = () => {
    setForm((prev) => ({
      ...prev,
      estados_atuacao: [],
      estado: '',
    }))
  }

  // Filtered views
  const filteredCategorias = useMemo(() => {
    const q = searchCategoria.trim().toLowerCase()
    if (!q) return availableCategorias
    return availableCategorias.filter((c) => c.nome.toLowerCase().includes(q))
  }, [availableCategorias, searchCategoria])

  const filteredRegioes = useMemo(() => {
    const q = searchRegiao.trim().toLowerCase()
    if (!q) return availableRegioes
    return availableRegioes.filter((r) => {
      const matchNome = r.nome.toLowerCase().includes(q)
      const matchUf = r.uf && r.uf.toLowerCase().includes(q)
      const matchCidade =
        Array.isArray(r.cidades) && r.cidades.some((cid) => cid.toLowerCase().includes(q))
      return matchNome || matchUf || matchCidade
    })
  }, [availableRegioes, searchRegiao])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const result = representanteSchema.safeParse(form)
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
      const { categoriaIds, regiaoIds, estados_atuacao, ...repData } = result.data

      const finalEstadosList =
        estados_atuacao && estados_atuacao.length > 0
          ? estados_atuacao
          : parseEstadosList(repData.estado)

      const finalEstadoString = finalEstadosList.length > 0 ? finalEstadosList.join(', ') : null

      const payload = {
        ...repData,
        reg: repData.reg !== null && repData.reg !== undefined ? repData.reg : null,
        cod: repData.cod || null,
        razao_social: repData.razao_social || null,
        email: repData.email || null,
        telefone: repData.telefone || null,
        celular: repData.celular || null,
        endereco: repData.endereco || null,
        telefone_principal: repData.telefone_principal || repData.telefone || null,
        telefones: repData.telefones.length > 0 ? repData.telefones : null,
        emails:
          repData.emails.filter((em) => em !== '').length > 0
            ? repData.emails.filter((em) => em !== '')
            : repData.email
              ? [repData.email]
              : null,
        estado: finalEstadoString,
      }

      let targetId: string

      if (editing) {
        targetId = editing.id
        await updateRepresentante({ id: editing.id, ...payload })
      } else {
        const created = await insertRepresentante(payload as any)
        targetId = created.id
      }

      // Sync categories & regions (passando a lista de estados selecionados)
      await syncRepresentanteVinculos(targetId, categoriaIds, regiaoIds, finalEstadosList)

      toast({
        title: editing ? 'Representante atualizado' : 'Representante criado',
        description: `${categoriaIds.length} categoria(s), ${regiaoIds.length} região(ões) e ${finalEstadosList.length} estado(s) de atuação vinculado(s).`,
      })

      onSaved()
      onOpenChange(false)
    } catch (err) {
      toast({
        title: 'Erro ao salvar representante',
        description: err instanceof Error ? err.message : 'Erro desconhecido',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
            {editing ? 'Editar Representante' : 'Novo Representante'}
            {editing?.reg !== null && editing?.reg !== undefined && (
              <Badge variant="outline" className="text-xs font-mono">
                Reg {editing.reg}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <Tabs defaultValue="identificacao" className="w-full">
            <TabsList className="grid grid-cols-5 w-full mb-4">
              <TabsTrigger value="identificacao">Identificação</TabsTrigger>
              <TabsTrigger value="contato">Contato</TabsTrigger>
              <TabsTrigger value="endereco">Endereço</TabsTrigger>
              <TabsTrigger value="categorias" className="gap-1.5">
                <Layers className="w-3.5 h-3.5" />
                Categorias ({form.categoriaIds.length})
              </TabsTrigger>
              <TabsTrigger value="regioes" className="gap-1.5">
                <MapPin className="w-3.5 h-3.5" />
                Regiões ({form.regiaoIds.length})
              </TabsTrigger>
            </TabsList>

            {/* ABA 1: IDENTIFICAÇÃO */}
            <TabsContent value="identificacao" className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <Label>Registro (Reg)</Label>
                  <Input
                    type="number"
                    value={form.reg !== null && form.reg !== undefined ? form.reg : ''}
                    onChange={(e) =>
                      setField('reg', e.target.value === '' ? null : parseInt(e.target.value, 10))
                    }
                    placeholder="Ex: 101"
                  />
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Identificador único no ERP
                  </p>
                </div>
                <div>
                  <Label>Código (Cód)</Label>
                  <Input
                    value={form.cod || ''}
                    onChange={(e) => setField('cod', e.target.value)}
                    placeholder="Ex: 101"
                  />
                </div>
                <div>
                  <Label>Status</Label>
                  <Select
                    value={form.status}
                    onValueChange={(v) => setField('status', v as 'Ativo' | 'Inativo')}
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
              </div>

              <div>
                <Label>Nome Fantasia *</Label>
                <Input
                  value={form.fantasia}
                  onChange={(e) => setField('fantasia', e.target.value)}
                  placeholder="Nome comercial do representante"
                />
                {errors.fantasia && (
                  <p className="text-xs text-destructive mt-1">{errors.fantasia}</p>
                )}
              </div>

              <div>
                <Label>Razão Social</Label>
                <Input
                  value={form.razao_social || ''}
                  onChange={(e) => setField('razao_social', e.target.value)}
                  placeholder="Razão social completa"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>CPF / CNPJ</Label>
                  <Input
                    value={form.documento || ''}
                    onChange={(e) => setField('documento', e.target.value)}
                    placeholder="Somente dígitos ou formatado"
                  />
                </div>
                <div>
                  <Label>Sigla</Label>
                  <Input
                    value={form.sigla || ''}
                    onChange={(e) => setField('sigla', e.target.value)}
                    placeholder="Ex: BENER-SP"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5 text-primary" />
                    Gerente Responsável
                  </Label>
                  <Select
                    value={form.gerente_id || 'none'}
                    onValueChange={(v) => setField('gerente_id', v === 'none' ? null : v)}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Selecione o gerente responsável..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum gerente vinculado</SelectItem>
                      {availableGerentes.map((g) => (
                        <SelectItem key={g.id} value={g.id}>
                          {g.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Gerente de contas/produto responsável pelo acompanhamento deste representante
                  </p>
                </div>
                <div>
                  <Label>RD Station ID</Label>
                  <Input
                    value={form.rd_station_id || ''}
                    onChange={(e) => setField('rd_station_id', e.target.value)}
                    placeholder="ID para integração CRM"
                    className="mt-1"
                  />
                </div>
              </div>

              <div>
                <Label>Data de Cadastro</Label>
                <Input
                  value={
                    editing?.created_at
                      ? formatDate(editing.created_at)
                      : formatDate(new Date().toISOString())
                  }
                  readOnly
                  disabled
                  className="bg-muted/50 max-w-xs mt-1"
                />
              </div>
            </TabsContent>

            {/* ABA 2: CONTATO */}
            <TabsContent value="contato" className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-1">
                  <Label>E-mail Principal</Label>
                  <Input
                    type="email"
                    value={form.email || ''}
                    onChange={(e) => setField('email', e.target.value)}
                    placeholder="vendas@representante.com.br"
                  />
                  {errors.email && <p className="text-xs text-destructive mt-1">{errors.email}</p>}
                </div>
                <div>
                  <Label>Telefone Fixo</Label>
                  <Input
                    value={form.telefone || ''}
                    onChange={(e) => setField('telefone', e.target.value)}
                    placeholder="(00) 0000-0000"
                  />
                </div>
                <div>
                  <Label>Celular / WhatsApp</Label>
                  <Input
                    value={form.celular || ''}
                    onChange={(e) => setField('celular', e.target.value)}
                    placeholder="(00) 90000-0000"
                  />
                </div>
              </div>

              <div className="border-t pt-3">
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Telefones Adicionais
                  </Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addTelefone}
                    className="gap-1 h-7 text-xs"
                  >
                    <Plus className="w-3.5 h-3.5" /> Adicionar
                  </Button>
                </div>
                <div className="space-y-2">
                  {form.telefones.length === 0 && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground border border-dashed rounded-md p-3">
                      <Phone className="w-4 h-4" /> Nenhum telefone extra cadastrado.
                    </div>
                  )}
                  {form.telefones.map((tel, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Input
                        value={tel}
                        onChange={(e) => updateTelefone(index, e.target.value)}
                        placeholder="(00) 0000-0000"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-destructive shrink-0"
                        onClick={() => removeTelefone(index)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t pt-3">
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    E-mails Adicionais
                  </Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addEmail}
                    className="gap-1 h-7 text-xs"
                  >
                    <Plus className="w-3.5 h-3.5" /> Adicionar
                  </Button>
                </div>
                <div className="space-y-2">
                  {form.emails.length === 0 && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground border border-dashed rounded-md p-3">
                      <Mail className="w-4 h-4" /> Nenhum e-mail extra cadastrado.
                    </div>
                  )}
                  {form.emails.map((em, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Input
                        type="email"
                        value={em}
                        onChange={(e) => updateEmail(index, e.target.value)}
                        placeholder="contato@representante.com.br"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-destructive shrink-0"
                        onClick={() => removeEmail(index)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
                {errors.emails && <p className="text-xs text-destructive mt-1">{errors.emails}</p>}
              </div>
            </TabsContent>

            {/* ABA 3: ENDEREÇO */}
            <TabsContent value="endereco" className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <Label>CEP</Label>
                  <Input
                    value={form.cep || ''}
                    onChange={(e) => setField('cep', e.target.value)}
                    placeholder="00000-000"
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label>Logradouro / Endereço Completo</Label>
                  <Input
                    value={form.endereco || form.logradouro || ''}
                    onChange={(e) => {
                      setField('endereco', e.target.value)
                      setField('logradouro', e.target.value)
                    }}
                    placeholder="Av. Paulista, 1000"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Número</Label>
                  <Input
                    value={form.numero || ''}
                    onChange={(e) => setField('numero', e.target.value)}
                    placeholder="123"
                  />
                </div>
                <div className="col-span-2">
                  <Label>Complemento</Label>
                  <Input
                    value={form.complementos || ''}
                    onChange={(e) => setField('complementos', e.target.value)}
                    placeholder="Sala 402, Bloco B"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Bairro</Label>
                  <Input
                    value={form.bairro || ''}
                    onChange={(e) => setField('bairro', e.target.value)}
                    placeholder="Centro"
                  />
                </div>
                <div>
                  <Label>Cidade Sede / Município</Label>
                  <Input
                    value={form.cidade || ''}
                    onChange={(e) => setField('cidade', e.target.value)}
                    placeholder="São Paulo"
                  />
                </div>
              </div>

              {/* SELEÇÃO AMIGÁVEL DE ESTADOS DE ATUAÇÃO (MULTI-SELEÇÃO EM CHECKBOXES) */}
              <div className="rounded-lg border p-3 bg-muted/20 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="font-semibold text-xs text-foreground">
                      Estados de Atuação Comercial (UF)
                    </Label>
                    <p className="text-[11px] text-muted-foreground">
                      Selecione todos os estados onde este representante atua
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={selectAllEstadosAtuacao}
                      className="text-xs font-medium text-[#0b3c26] hover:underline cursor-pointer"
                    >
                      Marcar todos
                    </button>
                    <span className="text-muted-foreground text-xs">•</span>
                    <button
                      type="button"
                      onClick={clearEstadosAtuacao}
                      className="text-xs font-medium text-muted-foreground hover:text-foreground cursor-pointer"
                    >
                      Limpar
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-7 gap-1.5 pt-1">
                  {ESTADOS_BR.map((item) => {
                    const isChecked = (form.estados_atuacao || []).includes(item.uf)
                    return (
                      <label
                        key={item.uf}
                        title={`${item.uf} - ${item.nome}`}
                        className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md border text-xs font-semibold cursor-pointer transition-colors select-none ${
                          isChecked
                            ? 'bg-[#0b3c26] text-white border-[#0b3c26] shadow-xs'
                            : 'bg-background hover:bg-accent text-foreground border-input'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleEstadoAtuacao(item.uf)}
                          className="w-3.5 h-3.5 accent-[#0b3c26] cursor-pointer rounded"
                        />
                        <span>{item.uf}</span>
                      </label>
                    )
                  })}
                </div>

                {(form.estados_atuacao || []).length > 0 && (
                  <div className="text-[11px] text-muted-foreground bg-background/80 p-2 rounded border">
                    <strong>Estados selecionados ({form.estados_atuacao.length}):</strong>{' '}
                    <span className="font-mono text-foreground font-medium">
                      {form.estados_atuacao.join(', ')}
                    </span>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* ABA 4: CATEGORIAS DE PRODUTOS */}
            <TabsContent value="categorias" className="space-y-3">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                  <Input
                    placeholder="Buscar categoria..."
                    value={searchCategoria}
                    onChange={(e) => setSearchCategoria(e.target.value)}
                    className="pl-9 h-9 text-xs"
                  />
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={selectAllCategorias}
                    className="h-9 text-xs gap-1"
                  >
                    <CheckSquare className="w-3.5 h-3.5" /> Marcar Todas
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={clearCategorias}
                    className="h-9 text-xs gap-1"
                  >
                    <Square className="w-3.5 h-3.5" /> Limpar
                  </Button>
                </div>
              </div>

              <div className="text-xs text-muted-foreground flex items-center justify-between">
                <span>
                  {form.categoriaIds.length} de {availableCategorias.length} categoria(s)
                  selecionada(s)
                </span>
                {form.categoriaIds.length > 0 && (
                  <Badge variant="outline" className="text-[11px] bg-[#0b3c26]/5 text-[#0b3c26]">
                    {form.categoriaIds.length} ativas
                  </Badge>
                )}
              </div>

              {loadingLookups ? (
                <div className="flex items-center justify-center p-8 text-xs text-muted-foreground gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-[#0b3c26]" />
                  Carregando categorias...
                </div>
              ) : availableCategorias.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted-foreground border rounded-md">
                  Nenhuma categoria cadastrada no sistema.
                </div>
              ) : (
                <div className="border rounded-md p-3 max-h-72 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-50/50">
                  {filteredCategorias.map((cat) => {
                    const isChecked = form.categoriaIds.includes(cat.id)
                    return (
                      <label
                        key={cat.id}
                        onClick={() => toggleCategoria(cat.id)}
                        className={`flex items-center gap-2.5 p-2 rounded-md border cursor-pointer transition-all ${
                          isChecked
                            ? 'bg-[#0b3c26]/10 border-[#0b3c26]/40 text-[#0b3c26] font-medium'
                            : 'bg-white border-slate-200 hover:bg-slate-100 text-slate-800'
                        }`}
                      >
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={() => toggleCategoria(cat.id)}
                        />
                        <span className="text-xs truncate flex-1">{cat.nome}</span>
                      </label>
                    )
                  })}
                  {filteredCategorias.length === 0 && (
                    <p className="col-span-2 text-xs text-muted-foreground text-center py-4">
                      Nenhuma categoria coincide com a busca.
                    </p>
                  )}
                </div>
              )}
            </TabsContent>

            {/* ABA 5: REGIÕES / ESTADOS (TODOS OS 26 ESTADOS + DF) */}
            <TabsContent value="regioes" className="space-y-3">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                  <Input
                    placeholder="Buscar região, estado ou cidade (ex: SP, Interior, Campinas)..."
                    value={searchRegiao}
                    onChange={(e) => setSearchRegiao(e.target.value)}
                    className="pl-9 h-9 text-xs"
                  />
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={selectAllRegioes}
                    className="h-9 text-xs gap-1"
                  >
                    <CheckSquare className="w-3.5 h-3.5" /> Marcar Todas
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={clearRegioes}
                    className="h-9 text-xs gap-1"
                  >
                    <Square className="w-3.5 h-3.5" /> Limpar
                  </Button>
                </div>
              </div>

              <div className="text-xs text-muted-foreground flex items-center justify-between">
                <span>
                  {form.regiaoIds.length} de {availableRegioes.length} região(ões) selecionada(s)
                </span>
                {form.regiaoIds.length > 0 ? (
                  <Badge
                    variant="outline"
                    className="text-[11px] bg-emerald-50 text-emerald-800 border-emerald-200"
                  >
                    {form.regiaoIds.length} região(ões) vinculada(s)
                  </Badge>
                ) : (
                  <span className="text-[11px] text-muted-foreground">
                    Nenhuma região vinculada
                  </span>
                )}
              </div>

              {loadingLookups ? (
                <div className="flex items-center justify-center p-8 text-xs text-muted-foreground gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-[#0b3c26]" />
                  Carregando regiões...
                </div>
              ) : (
                <div className="border rounded-md p-3 max-h-80 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-50/50">
                  {filteredRegioes.map((reg) => {
                    const isChecked = form.regiaoIds.includes(reg.id)
                    const isTodoEstado =
                      reg.todo_o_estado || !reg.cidades || reg.cidades.length === 0
                    return (
                      <div
                        key={reg.id}
                        onClick={() => toggleRegiao(reg.id)}
                        className={`flex items-start gap-2.5 p-2.5 rounded-md border cursor-pointer transition-all ${
                          isChecked
                            ? 'bg-emerald-50 border-emerald-400 text-emerald-950 font-medium shadow-xs'
                            : 'bg-white border-slate-200 hover:bg-slate-100 text-slate-800'
                        }`}
                      >
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={() => toggleRegiao(reg.id)}
                          className="mt-0.5"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-semibold truncate">{reg.nome}</span>
                            {reg.uf && (
                              <Badge
                                variant="outline"
                                className="font-mono text-[10px] font-bold text-emerald-800 bg-white border-emerald-300 shrink-0"
                              >
                                {reg.uf}
                              </Badge>
                            )}
                          </div>
                          <div className="text-[11px] mt-1 text-muted-foreground">
                            {isTodoEstado ? (
                              <span className="text-slate-600">
                                Cobertura: <strong>Todo o estado ({reg.uf || 'UF'})</strong>
                              </span>
                            ) : (
                              <span className="text-emerald-800">
                                <strong>{reg.cidades?.length} cidades</strong> de {reg.uf}
                                <span className="block text-[10px] text-muted-foreground truncate mt-0.5">
                                  {reg.cidades?.slice(0, 4).join(', ')}
                                  {(reg.cidades?.length || 0) > 4 ? '...' : ''}
                                </span>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                  {filteredRegioes.length === 0 && (
                    <p className="col-span-full text-xs text-muted-foreground text-center py-4">
                      Nenhuma região coincide com a busca.
                    </p>
                  )}
                </div>
              )}
            </TabsContent>
          </Tabs>

          <DialogFooter className="mt-6 border-t pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              className="bg-[#0b3c26] text-white hover:bg-[#082a1b]"
              disabled={saving}
            >
              {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              {editing ? 'Salvar Alterações' : 'Cadastrar Representante'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
