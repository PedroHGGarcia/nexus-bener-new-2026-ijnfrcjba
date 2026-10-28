import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@/components/ui/select'
import {
  Loader2,
  ImagePlus,
  X,
  AlertCircle,
  Hash,
  DollarSign,
  Info,
  Package,
  Wrench,
  Camera,
  Trash2,
} from 'lucide-react'
import { FormattedNumberInput } from '@/components/shared/formatted-number-input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { toast } from '@/hooks/use-toast'
import { versaoSchema } from '@/lib/validations/versao'
import { Versao, VersaoWithModelo } from '@/types/versao'
import { Modelo } from '@/types/modelo'
import { TipoProposta } from '@/types/tipo-proposta'
import { CategoriaProduto } from '@/types/categoria-produto'
import {
  insertVersao,
  updateVersao,
  uploadVersaoImage,
  fetchVersaoTiposProposta,
  replaceVersaoTiposProposta,
} from '@/services/versoes'
import { fetchModelos } from '@/services/modelos'
import { fetchCategoriasProdutos } from '@/services/categorias-produtos'
import { fetchProdutos } from '@/services/produtos'
import { fetchTiposProposta } from '@/services/tipos-proposta'
import { MultiSelectRelation } from '@/components/shared/searchable-multi-select'
import { Link2 } from 'lucide-react'
import { RichTextEditor } from '@/components/shared/rich-text-editor'
import { convertTechnicalToHtml } from '@/lib/technical-html-converter'

interface Props {
  editing?: VersaoWithModelo | null
  open?: boolean
  onOpenChange?: (open: boolean) => void
  initialModeloId?: string
  userName?: string
  onSaved: (versao: Versao) => void
  onCancel?: () => void
}

interface FormState {
  nome: string
  modelo: string
  categoria_id: string | null
  reg: string
  cod_erp: string
  moeda: string
  valor: number
  tem_fator: boolean
  fator_nac: number
  tem_estoque: boolean
  desconto_max_representante: number
  desconto_max_bener: number
  estoque_total: number
  estoque_bloqueado: number
  estoque_reservado: number
  estoque_disponivel: number
  acessorios_standards: string
  caracteristicas_construtivas: string
  especificacoes_tecnicas: string
  tipos_proposta: string[]
  nome_abreviado: string
  status: string
  galeria?: any
}

function emptyForm(mId?: string): FormState {
  return {
    nome: '',
    modelo: mId ?? '',
    categoria_id: null,
    reg: '',
    cod_erp: '',
    moeda: 'BRL',
    valor: 0,
    tem_fator: false,
    fator_nac: 1,
    tem_estoque: false,
    desconto_max_representante: 0,
    desconto_max_bener: 0,
    estoque_total: 0,
    estoque_bloqueado: 0,
    estoque_reservado: 0,
    estoque_disponivel: 0,
    acessorios_standards: '',
    caracteristicas_construtivas: '',
    especificacoes_tecnicas: '',
    tipos_proposta: [],
    nome_abreviado: '',
    status: 'Ativo',
    galeria: [],
  }
}

function extractGaleriaUrls(v: Versao): string[] {
  const urls: string[] = []
  if (v.imagem_preview) {
    urls.push(v.imagem_preview)
  }
  if (Array.isArray(v.galeria)) {
    for (const item of v.galeria) {
      if (typeof item === 'string' && item) {
        if (!urls.includes(item)) urls.push(item)
      } else if (item && typeof item === 'object' && (item as any).url) {
        const u = (item as any).url
        if (typeof u === 'string' && !urls.includes(u)) urls.push(u)
      }
    }
  } else if (v.galeria && typeof v.galeria === 'object') {
    const arr = (v.galeria as any).imagens || (v.galeria as any).fotos
    if (Array.isArray(arr)) {
      for (const item of arr) {
        const u = typeof item === 'string' ? item : (item as any)?.url
        if (typeof u === 'string' && !urls.includes(u)) urls.push(u)
      }
    }
  }
  return urls
}

function versaoToForm(v: Versao): FormState {
  return {
    ...emptyForm(),
    nome: v.nome,
    modelo: v.modelo ?? '',
    categoria_id: v.categoria_id ?? null,
    reg: (v as any).reg ?? v.cod_erp ?? '',
    cod_erp: v.cod_erp ?? '',
    moeda: v.moeda ?? 'BRL',
    valor: v.valor ?? 0,
    tem_fator: v.tem_fator ?? false,
    fator_nac: v.fator_nac ?? 1,
    tem_estoque: v.tem_estoque ?? false,
    desconto_max_representante: v.desconto_max_representante ?? 0,
    desconto_max_bener: v.desconto_max_bener ?? 0,
    estoque_total: v.estoque_total ?? 0,
    estoque_bloqueado: v.estoque_bloqueado ?? 0,
    estoque_reservado: v.estoque_reservado ?? 0,
    estoque_disponivel: v.estoque_disponivel ?? 0,
    acessorios_standards: v.acessorios_standards ?? '',
    caracteristicas_construtivas: v.caracteristicas_construtivas ?? '',
    especificacoes_tecnicas: v.especificacoes_tecnicas ?? '',
    tipos_proposta: Array.isArray(v.tipos_proposta) ? v.tipos_proposta : [],
    nome_abreviado: v.nome_abreviado ?? '',
    status: v.status ?? 'Ativo',
    galeria: extractGaleriaUrls(v),
  }
}

const ESTOQUE_FIELDS = [
  { key: 'estoque_total', label: 'Total' },
  { key: 'estoque_bloqueado', label: 'Bloqueado' },
  { key: 'estoque_reservado', label: 'Reservado' },
  { key: 'estoque_disponivel', label: 'Disponível' },
] as const

export function VersaoForm({
  editing,
  open,
  onOpenChange,
  initialModeloId,
  userName,
  onSaved,
  onCancel,
}: Props) {
  const [form, setForm] = useState<FormState>(
    editing ? versaoToForm(editing) : emptyForm(initialModeloId),
  )

  useEffect(() => {
    if (!editing && initialModeloId) {
      setForm((prev) => ({ ...prev, modelo: initialModeloId }))
    }
  }, [editing, initialModeloId])
  const [modelos, setModelos] = useState<Modelo[]>([])
  const [categorias, setCategorias] = useState<CategoriaProduto[]>([])
  const [produtosMap, setProdutosMap] = useState<
    Map<string, { id: string; categoria?: string | null }>
  >(new Map())
  const [tipos, setTipos] = useState<TipoProposta[]>([])
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(editing?.imagem_preview ?? null)
  const [galeriaImagens, setGaleriaImagens] = useState<string[]>(
    editing ? extractGaleriaUrls(editing) : [],
  )
  const [uploadingGaleria, setUploadingGaleria] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const galeriaInputRef = useRef<HTMLInputElement>(null)

  // Conteúdos Técnicos em Rich Text WYSIWYG (Acessórios, Características, Especificações)
  // Converte automaticamente textos legados (bullets, texto puro ou JSON de tabela) para HTML
  const [acessoriosHtml, setAcessoriosHtml] = useState<string>(() =>
    convertTechnicalToHtml(form.acessorios_standards),
  )
  const [caracteristicasHtml, setCaracteristicasHtml] = useState<string>(() =>
    convertTechnicalToHtml(form.caracteristicas_construtivas),
  )
  const [especificacoesHtml, setEspecificacoesHtml] = useState<string>(() =>
    convertTechnicalToHtml(form.especificacoes_tecnicas),
  )

  // Sincroniza estado quando o editing muda
  useEffect(() => {
    if (editing) {
      setAcessoriosHtml(convertTechnicalToHtml(editing.acessorios_standards))
      setCaracteristicasHtml(convertTechnicalToHtml(editing.caracteristicas_construtivas))
      setEspecificacoesHtml(convertTechnicalToHtml(editing.especificacoes_tecnicas))
      setGaleriaImagens(extractGaleriaUrls(editing))
    }
  }, [editing])
  // IDs of the tipos de proposta linked to this versão in the
  // versao_tipos_proposta join table (source of truth for Emitir Proposta's
  // Tipo de Proposta filter). The tipos_proposta JSONB column on versoes is
  // kept in sync for backward compatibility.
  const [linkedTipoIds, setLinkedTipoIds] = useState<string[]>([])
  const [linkedTiposLoaded, setLinkedTiposLoaded] = useState(false)

  useEffect(() => {
    Promise.all([fetchModelos(), fetchCategoriasProdutos(), fetchProdutos(), fetchTiposProposta()])
      .then(([m, c, p, t]) => {
        setModelos(m)
        setCategorias(c.filter((cat) => cat.status !== 'Em Quarentena' && cat.status !== 'Inativo'))
        setProdutosMap(
          new Map(p.map((prod) => [prod.id, { id: prod.id, categoria: prod.categoria }])),
        )
        setTipos(t)
      })
      .catch(() => {
        setModelos([])
        setCategorias([])
        setProdutosMap(new Map())
        setTipos([])
      })
  }, [])

  // Auto-fill categoria ao selecionar modelo se o modelo tiver produto com categoria
  const handleModeloChange = (modeloId: string) => {
    const selectedModelo = modelos.find((m) => m.id === modeloId)
    let autoCatId: string | null = null
    if (selectedModelo?.produto) {
      const prod = produtosMap.get(selectedModelo.produto)
      if (prod?.categoria) {
        autoCatId = prod.categoria
      }
    }
    setForm((prev) => ({
      ...prev,
      modelo: modeloId,
      // Se tiver categoria derivada, preenche automaticamente; se não tiver, preserva o que o usuário escolheu ou deixa vazio
      categoria_id: autoCatId || prev.categoria_id,
    }))
  }

  // Load the tipos currently linked to this versão (only when editing an
  // existing versão). For a new versão, the set starts empty.
  useEffect(() => {
    if (!editing?.id) {
      setLinkedTipoIds([])
      setLinkedTiposLoaded(true)
      return
    }
    let cancelled = false
    setLinkedTiposLoaded(false)
    fetchVersaoTiposProposta(editing.id)
      .then((ids) => {
        if (!cancelled) setLinkedTipoIds(ids)
      })
      .catch(() => {
        if (!cancelled) setLinkedTipoIds([])
      })
      .finally(() => {
        if (!cancelled) setLinkedTiposLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [editing?.id])

  const upd = (key: keyof FormState, value: unknown) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const handleTipoIdsChange = (ids: string[]) => {
    setLinkedTipoIds(ids)
    // Mantém form.tipos_proposta (nomes) sincronizado com os IDs selecionados
    const nomes = tipos.filter((t) => ids.includes(t.id)).map((t) => t.nome)
    setForm((prev) => ({
      ...prev,
      tipos_proposta: nomes,
    }))
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setImageFile(file)
      const objUrl = URL.createObjectURL(file)
      setImagePreview(objUrl)
      if (!galeriaImagens.includes(objUrl)) {
        setGaleriaImagens((prev) => [objUrl, ...prev])
      }
    }
  }

  const handleGaleriaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    setUploadingGaleria(true)
    try {
      const fileList = Array.from(files)
      const uploadPromises = fileList.map(async (f) => {
        const url = await uploadVersaoImage(f)
        return url
      })
      const uploadedUrls = (await Promise.all(uploadPromises)).filter(
        (u): u is string => typeof u === 'string' && u.length > 0,
      )

      setGaleriaImagens((prev) => {
        const set = new Set([...prev, ...uploadedUrls])
        return Array.from(set)
      })

      // Se ainda não tiver imagem preview principal, define a primeira enviada
      if (!imagePreview && uploadedUrls.length > 0) {
        setImagePreview(uploadedUrls[0])
      }

      toast({
        title: `${uploadedUrls.length} imagem(ns) adicionada(s)`,
        description: 'Imagens carregadas na seção técnica.',
      })
    } catch (err) {
      toast({
        title: 'Erro no envio de imagens',
        description: err instanceof Error ? err.message : 'Falha ao enviar arquivo',
        variant: 'destructive',
      })
    } finally {
      setUploadingGaleria(false)
      if (galeriaInputRef.current) {
        galeriaInputRef.current.value = ''
      }
    }
  }

  const handleRemoveGaleriaImage = (urlToRemove: string) => {
    const updated = galeriaImagens.filter((u) => u !== urlToRemove)
    setGaleriaImagens(updated)
    if (imagePreview === urlToRemove) {
      setImagePreview(updated.length > 0 ? updated[0] : null)
      setImageFile(null)
    }
  }

  const handleSetPrimaryImage = (url: string) => {
    setImagePreview(url)
    toast({
      title: 'Imagem principal definida',
      description: 'Esta imagem será a exibição padrão no catálogo e na proposta.',
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Deriva nomes de tipos_proposta dos IDs selecionados caso tipos já estejam carregados
    const selectedTipoNomes =
      linkedTipoIds.length > 0 && tipos.length > 0
        ? tipos.filter((t) => linkedTipoIds.includes(t.id)).map((t) => t.nome)
        : form.tipos_proposta

    // Salva o conteúdo formatado rico gerado pelo editor WYSIWYG
    const formToValidate = {
      ...form,
      tipos_proposta: selectedTipoNomes,
      acessorios_standards: acessoriosHtml,
      caracteristicas_construtivas: caracteristicasHtml,
      especificacoes_tecnicas: especificacoesHtml,
      galeria: galeriaImagens,
    }

    const result = versaoSchema.safeParse(formToValidate)
    if (!result.success) {
      const fieldErrors: Record<string, string> = {}
      result.error.issues.forEach((issue) => {
        const key = issue.path[0] as string
        if (!fieldErrors[key]) fieldErrors[key] = issue.message
      })
      setErrors(fieldErrors)
      const firstError = Object.values(fieldErrors)[0]
      toast({
        title: 'Verifique os campos obrigatórios',
        description: firstError || 'Existem campos com preenchimento inválido no formulário.',
        variant: 'destructive',
      })
      return
    }
    setErrors({})
    setSaving(true)
    try {
      let imagemPreview = imagePreview ?? editing?.imagem_preview ?? null
      if (imageFile) {
        const uploadedMain = await uploadVersaoImage(imageFile)
        if (uploadedMain) {
          imagemPreview = uploadedMain
          if (!galeriaImagens.includes(uploadedMain)) {
            galeriaImagens.unshift(uploadedMain)
          }
        }
      }
      // Se não houver preview definido mas tiver imagens na galeria, usa a primeira
      if (!imagemPreview && galeriaImagens.length > 0) {
        imagemPreview = galeriaImagens[0]
      }

      const payload = {
        ...result.data,
        tipos_proposta: selectedTipoNomes,
        acessorios_standards: acessoriosHtml,
        caracteristicas_construtivas: caracteristicasHtml,
        especificacoes_tecnicas: especificacoesHtml,
        imagem_preview: imagemPreview,
        galeria: galeriaImagens,
      }
      let savedItem: Versao
      if (editing) {
        savedItem = await updateVersao({ id: editing.id, ...payload }, userName)
        toast({ title: 'Versão atualizada com sucesso' })
      } else {
        savedItem = await insertVersao(payload as any, userName)
        toast({ title: 'Versão criada com sucesso' })
      }
      // Persist the tipos de proposta linked to this versão in the
      // versao_tipos_proposta join table.
      try {
        await replaceVersaoTiposProposta(savedItem.id, linkedTipoIds)
      } catch (err) {
        // Non-fatal: the versão was saved, only the links failed. Surface
        // the error so the user knows the links were not persisted.
        toast({
          title: 'Aviso: tipos de proposta não vinculados',
          description: err instanceof Error ? err.message : 'Erro ao vincular tipos de proposta',
          variant: 'destructive',
        })
      }
      onSaved(savedItem)
    } catch (err) {
      console.error('Erro ao salvar versão:', err)
      toast({
        title: 'Erro ao salvar',
        description: err instanceof Error ? err.message : 'Erro desconhecido',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    if (onCancel) onCancel()
    if (onOpenChange) onOpenChange(false)
  }

  const fieldError = (key: string) =>
    errors[key] ? (
      <p className="flex items-center gap-1 text-xs text-destructive mt-1">
        <AlertCircle className="w-3 h-3" />
        {errors[key]}
      </p>
    ) : null

  const formBody = (
    <div className="space-y-4">
      {/* Seção Identificação */}
      <div className="border rounded-lg bg-card p-4 space-y-4">
        <h3 className="text-sm font-semibold flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5 text-muted-foreground" /> Identificação
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              Nome <span className="text-destructive">*</span>
            </Label>
            <Input
              className="h-10"
              value={form.nome}
              onChange={(e) => upd('nome', e.target.value)}
              placeholder="Ex: 320 GC - Configuração Padrão"
            />
            {fieldError('nome')}
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">Nome Abreviado</Label>
            <Input
              className="h-10"
              value={form.nome_abreviado}
              onChange={(e) => upd('nome_abreviado', e.target.value)}
              placeholder="Ex: 320GC STD"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              Modelo <span className="text-destructive">*</span>
            </Label>
            <Select value={form.modelo || undefined} onValueChange={handleModeloChange}>
              <SelectTrigger className="h-10">
                <SelectValue placeholder="Selecione um modelo" />
              </SelectTrigger>
              <SelectContent>
                {modelos.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {fieldError('modelo')}
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Categoria</Label>
              {form.categoria_id && (
                <span className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">
                  Gravada na versão
                </span>
              )}
            </div>
            <Select
              value={form.categoria_id || 'none'}
              onValueChange={(v) => upd('categoria_id', v === 'none' ? null : v)}
            >
              <SelectTrigger className="h-10">
                <SelectValue placeholder="Selecione uma categoria (opcional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhuma categoria</SelectItem>
                {categorias.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Auto-preenchida a partir do modelo/produto. Pode ser ajustada manualmente.
            </p>
            {fieldError('categoria_id')}
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">REG</Label>
            <div className="relative">
              <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#0b3c26]" />
              <Input
                className="h-10 pl-9 font-mono"
                value={form.reg}
                onChange={(e) => upd('reg', e.target.value)}
                placeholder="Ex: 5"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">Cod ERP</Label>
            <div className="relative">
              <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                className="h-10 pl-9"
                value={form.cod_erp}
                onChange={(e) => upd('cod_erp', e.target.value)}
                placeholder="Ex: ERP-001234"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">Status</Label>
            <Select value={form.status} onValueChange={(v) => upd('status', v)}>
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
          <Label className="text-sm font-medium">Imagem Preview</Label>
          <div className="relative w-full max-w-xs">
            <div
              className="border-2 border-dashed rounded-lg p-4 cursor-pointer hover:bg-accent/50 transition-colors"
              onClick={() => fileRef.current?.click()}
            >
              {imagePreview ? (
                <div className="relative">
                  <img src={imagePreview} alt="Preview" className="max-h-32 mx-auto rounded" />
                  <button
                    type="button"
                    className="absolute top-1 right-1 bg-destructive text-white rounded-full p-1"
                    onClick={(e) => {
                      e.stopPropagation()
                      setImageFile(null)
                      setImagePreview(null)
                    }}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 py-4">
                  <ImagePlus className="w-8 h-8 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">Clique para adicionar imagem</p>
                </div>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageChange}
            />
          </div>
        </div>
      </div>

      {/* Seção Comercial */}
      <div className="border rounded-lg bg-card p-4 space-y-4">
        <h3 className="text-sm font-semibold flex items-center gap-1.5">
          <DollarSign className="w-3.5 h-3.5 text-muted-foreground" /> Comercial
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Moeda</Label>
            <Select value={form.moeda} onValueChange={(v) => upd('moeda', v)}>
              <SelectTrigger className="h-10">
                <SelectValue placeholder="Selecione a moeda" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="BRL">BRL</SelectItem>
                <SelectItem value="USD">USD</SelectItem>
                <SelectItem value="EUR">EUR</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">Valor</Label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <div className="pl-9">
                <FormattedNumberInput value={form.valor} onChange={(v) => upd('valor', v)} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Preço de tabela da versão.</p>
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">Desconto Máx Rep (%)</Label>
            <FormattedNumberInput
              value={form.desconto_max_representante}
              onChange={(v) => upd('desconto_max_representante', v)}
              suffix="%"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">Desconto Máx Bener (%)</Label>
            <FormattedNumberInput
              value={form.desconto_max_bener}
              onChange={(v) => upd('desconto_max_bener', v)}
              suffix="%"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">Tem Fator</Label>
            <Select
              value={form.tem_fator ? 'sim' : 'nao'}
              onValueChange={(v) => upd('tem_fator', v === 'sim')}
            >
              <SelectTrigger className="h-10">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sim">Sim</SelectItem>
                <SelectItem value="nao">Não</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">Fator NAC</Label>
            <FormattedNumberInput
              value={form.fator_nac}
              onChange={(v) => upd('fator_nac', v)}
              maxDecimals={4}
            />
            {fieldError('fator_nac')}
          </div>
        </div>
      </div>

      {/* Seção Estoque */}
      <div className="border rounded-lg bg-card p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold flex items-center gap-1.5">
            <Package className="w-3.5 h-3.5 text-muted-foreground" /> Estoque
          </h3>
          <Select
            value={form.tem_estoque ? 'sim' : 'nao'}
            onValueChange={(v) => upd('tem_estoque', v === 'sim')}
          >
            <SelectTrigger className="h-8 w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="sim">Com estoque</SelectItem>
              <SelectItem value="nao">Sem estoque</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {form.tem_estoque && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 transition-all">
            {ESTOQUE_FIELDS.map(({ key, label }) => (
              <div key={key} className="space-y-1">
                <Label className="text-xs text-muted-foreground">{label}</Label>
                <FormattedNumberInput
                  value={form[key]}
                  onChange={(v) => upd(key, v)}
                  disabled={!!editing}
                />
              </div>
            ))}
            {editing && (
              <p className="col-span-full text-xs text-muted-foreground">
                Os campos de estoque são somente leitura na edição.
              </p>
            )}
          </div>
        )}
        {!form.tem_estoque && (
          <p className="text-xs text-muted-foreground">
            Versão sem controle de estoque. Ative “Com estoque” para informar quantidades.
          </p>
        )}
      </div>

      {/* Seção Técnica */}
      <div className="border rounded-lg bg-card p-4 space-y-6">
        <div className="flex items-center justify-between border-b pb-2">
          <h3 className="text-sm font-semibold flex items-center gap-1.5 text-slate-800 dark:text-slate-100">
            <Wrench className="w-4 h-4 text-[#0b3c26]" /> Seção Técnica & Fotos do Equipamento
          </h3>
          <span className="text-xs text-muted-foreground">
            Imagens da máquina e especificações em mini-planilhas
          </span>
        </div>

        {/* 1. Upload de Imagens da Versão / Máquina */}
        <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-900/30">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <Label className="text-sm font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                <Camera className="w-4 h-4 text-[#0b3c26]" /> Imagens Técnicas do Equipamento
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Adicione fotos técnicas da máquina/versão. As fotos são salvas no catálogo e
                exibidas na proposta e nos detalhes técnicos.
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              disabled={uploadingGaleria}
              onClick={() => galeriaInputRef.current?.click()}
              className="h-8 gap-1.5 bg-[#0b3c26] hover:bg-[#0b3c26]/90 text-white text-xs"
            >
              {uploadingGaleria ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <ImagePlus className="w-3.5 h-3.5" />
              )}
              {uploadingGaleria ? 'Enviando...' : 'Adicionar Fotos'}
            </Button>
            <input
              ref={galeriaInputRef}
              type="file"
              multiple
              accept="image/*"
              className="hidden"
              onChange={handleGaleriaUpload}
            />
          </div>

          {/* Galeria de Fotos */}
          {galeriaImagens.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 pt-2">
              {galeriaImagens.map((url, idx) => {
                const isPrimary = imagePreview === url
                return (
                  <div
                    key={url || idx}
                    className={`group relative rounded-lg border overflow-hidden bg-white dark:bg-slate-900 transition-all ${
                      isPrimary
                        ? 'border-[#0b3c26] ring-2 ring-[#0b3c26]/30 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="h-28 w-full flex items-center justify-center p-1.5 bg-slate-50 dark:bg-slate-800/40">
                      <img
                        src={url}
                        alt={`Imagem ${idx + 1}`}
                        className="max-h-full max-w-full object-contain"
                        loading="lazy"
                      />
                    </div>
                    <div className="p-1.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900 text-[10px]">
                      {isPrimary ? (
                        <span className="font-bold text-[#0b3c26] text-[10px] bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded">
                          Principal
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleSetPrimaryImage(url)}
                          className="text-slate-600 hover:text-[#0b3c26] font-medium"
                        >
                          Definir principal
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleRemoveGaleriaImage(url)}
                        title="Remover foto"
                        className="text-slate-400 hover:text-red-600 p-0.5 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div
              className="border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-lg p-6 text-center cursor-pointer hover:bg-slate-100/50 transition-colors"
              onClick={() => galeriaInputRef.current?.click()}
            >
              <Camera className="w-8 h-8 text-slate-400 mx-auto mb-1.5 opacity-60" />
              <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Nenhuma foto anexada a esta versão
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Clique para selecionar fotos da máquina no seu computador (JPEG, PNG, WEBP).
              </p>
            </div>
          )}
        </div>

        {/* 2. Campos Técnicos em Rich-Text WYSIWYG (Word-like) com suporte a texto formatado, tabelas e inserção de imagens */}
        <div className="space-y-6">
          {/* Campo: Acessórios Standards */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                  Acessórios Standards
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Itens de série, descrições, tabelas e fotos dos acessórios padrão desta versão.
                </p>
              </div>
            </div>
            <RichTextEditor
              value={acessoriosHtml}
              onChange={setAcessoriosHtml}
              placeholder="Descreva os acessórios standards da máquina, insira tabelas ou adicione imagens..."
              minHeight="min-h-[180px]"
            />
          </div>

          {/* Campo: Características Construtivas */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                  Características Construtivas
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Estrutura mecânica, guias, barramento, fusos, diferenciais de projeto e fotos
                  detalhadas.
                </p>
              </div>
            </div>
            <RichTextEditor
              value={caracteristicasHtml}
              onChange={setCaracteristicasHtml}
              placeholder="Descreva as características construtivas, estrutura, guias, barramento..."
              minHeight="min-h-[180px]"
            />
          </div>

          {/* Campo: Especificações Técnicas */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                  Especificações Técnicas
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Capacidades, cursos, rotações, motorização, dimensões, pesos e diagramas com
                  imagens.
                </p>
              </div>
            </div>
            <RichTextEditor
              value={especificacoesHtml}
              onChange={setEspecificacoesHtml}
              placeholder="Descreva as especificações técnicas, cursos, potência, dimensões e tabelas..."
              minHeight="min-h-[200px]"
            />
          </div>
        </div>
      </div>

      {/* Seção Única de Tipos de Proposta Vinculados (join table e filtro de emissão) */}
      <div className="border rounded-lg bg-card p-4 space-y-4">
        <h3 className="text-sm font-semibold flex items-center gap-1.5">
          <Link2 className="w-3.5 h-3.5 text-[#0b3c26]" /> Tipos de Proposta Vinculados
        </h3>
        <p className="text-xs text-muted-foreground">
          Selecione os tipos de proposta que poderão ser emitidos com esta versão. No formulário de
          Emitir Proposta, o campo “Tipo de Proposta” será filtrado para exibir apenas os tipos
          vinculados à versão selecionada.
        </p>
        <div className="space-y-2">
          <Label className="text-sm font-medium">Tipos de proposta permitidos</Label>
          {editing && !linkedTiposLoaded ? (
            <div className="h-10 w-full animate-pulse rounded-md bg-muted" />
          ) : (
            <MultiSelectRelation
              values={linkedTipoIds}
              onChange={handleTipoIdsChange}
              tableName="tipos_proposta"
              labelColumn="nome"
              filter={{ status: ['A', 'Ativo'] }}
              placeholder="Selecionar tipos de proposta..."
            />
          )}
          {linkedTipoIds.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {linkedTipoIds.length} tipo(s) de proposta vinculado(s) a esta versão.
            </p>
          )}
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

  if (open !== undefined) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0 text-left">
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <Wrench className="w-5 h-5 text-[#0b3c26]" />
              {editing ? 'Editar Versão' : 'Nova Versão'}
            </DialogTitle>
            <DialogDescription>
              {editing
                ? 'Atualize os dados da versão da máquina.'
                : 'Configure a nova versão da máquina.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
            <div className="flex-1 overflow-y-auto p-6">{formBody}</div>
            <div className="border-t px-6 py-4 flex gap-2 justify-end shrink-0 bg-background">
              {formFooter}
            </div>
          </form>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {formBody}
      <div className="border-t pt-4 mt-2 flex gap-2 justify-end">{formFooter}</div>
    </form>
  )
}
