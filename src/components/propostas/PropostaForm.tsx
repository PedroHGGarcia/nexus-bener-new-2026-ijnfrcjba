import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'

import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { FormattedNumberInput } from '@/components/shared/formatted-number-input'
import { Package } from 'lucide-react'
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@/components/ui/select'
import {
  FileText,
  ArrowLeft,
  Loader2,
  CheckCircle2,
  X,
  FileCheck2,
  PenTool,
  Upload,
  AlertCircle,
  History,
  Pencil,
  Clock,
  User,
  Info,
  Plus,
  Eye,
  ChevronDown,
  RotateCcw,
  Maximize2,
  Minimize2,
} from 'lucide-react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ProposalDocument } from '@/components/propostas/ProposalDocument'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { ClienteFormDialog } from '@/components/clientes/ClienteFormDialog'
import { toast } from '@/hooks/use-toast'
import { insertProposta, createPropostaVersion, uploadSignatureDataUrl } from '@/services/propostas'
import { preOpenProposalPrintTab } from '@/lib/proposal-auto-open'
import { buildPropostaSnapshot } from '@/lib/proposal-snapshot'
import { ResponsavelInternoSignatureCard } from '@/components/propostas/ResponsavelInternoSignatureCard'
import { PropostaWithRelations } from '@/types/proposta'

import { fetchVersoes, fetchVersaoById } from '@/services/versoes'
import { useGerenteCategoryRestriction } from '@/hooks/use-gerente-restriction'
import { Versao } from '@/types/versao'
import { fetchTiposProposta, fetchTiposPropostaByVersaoId } from '@/services/tipos-proposta'
import { supabase } from '@/lib/supabase/client'
import { VersaoWithModelo } from '@/types/versao'
import { TipoProposta } from '@/types/tipo-proposta'
import { Representante } from '@/types/representante'
import { Gerente } from '@/types/gerente'
import { EmailTagInput } from '@/components/shared/email-tag-input'
import { PropostaExchangeTicker } from '@/components/propostas/PropostaExchangeTicker'
import { PropostaAcessoriosSection } from '@/components/propostas/PropostaAcessoriosSection'
import {
  MachineCascadeSearch,
  MachineCascadeSelection,
} from '@/components/propostas/MachineCascadeSearch'
import { CustomFieldsEditor, type CustomField } from '@/components/propostas/CustomFieldsEditor'
import {
  SearchableCombobox,
  type SearchableComboboxOption,
} from '@/components/shared/searchable-combobox'
import { PropostaProjetoLinker } from '@/components/propostas/PropostaProjetoLinker'
import {
  PropostaMultiVersoes,
  type PropostaVersaoItem,
} from '@/components/propostas/PropostaMultiVersoes'
import { fetchPropostaVersoes, replacePropostaVersoes } from '@/services/proposta-versoes'
import { fetchContatosByCliente } from '@/services/clientes'
import type { ClienteContato } from '@/types/cliente'
import { Badge } from '@/components/ui/badge'
import { fetchProjetos, fetchProjetosForUser, insertProjeto } from '@/services/projetos'
import { ProjetoWithRelations } from '@/types/projeto'
import { useCurrencyRates } from '@/hooks/use-currency-rates'
import { formatBrlEquivalent } from '@/services/currency-rates'
import {
  calculateLineTotal,
  calculateSubtotal,
  convertCurrency,
  formatPrecoEspecialDiscountBadge,
  calcComissaoServicosBener,
  isTipoAdmissaoOrImportacao,
  BaseComissaoModo,
} from '@/lib/proposta-calculations'
import { useAuth } from '@/hooks/use-auth'
import { cn } from '@/lib/utils'
import { formatDateTime, normalizeMoedaCode, formatCurrencyByMoeda } from '@/lib/format'
import { isRepresentanteRole, isAdminRole, isGerenteRole } from '@/components/RoleGuard'
import { findRepresentanteByProfile } from '@/services/representantes'
import { findGerenteByProfile } from '@/services/gerentes'
import { canDrawGerenteSignature } from '@/lib/gerente-signature-auth'
import { Lock } from 'lucide-react'

interface TipoFormData {
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
}

function tipoToForm(t: TipoProposta): TipoFormData {
  let campos: CustomField[] = []
  const raw = t.campos_adicionais
  if (raw) {
    if (Array.isArray(raw)) {
      campos = raw as unknown as CustomField[]
    } else if (typeof raw === 'string') {
      try {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) campos = parsed as unknown as CustomField[]
      } catch {
        // ignore
      }
    }
  }
  const normalizeStatus = (st?: string | null): string => {
    if (!st) return 'Ativo'
    const clean = st.trim()
    if (clean === 'A' || clean.toLowerCase() === 'ativo') return 'Ativo'
    if (clean === 'I' || clean.toLowerCase() === 'inativo') return 'Inativo'
    return clean
  }

  return {
    nome: t.nome,
    status: normalizeStatus(t.status),
    aplicar_fator_nac: t.aplicar_fator_nac ?? false,
    comissao: t.comissao ?? 0,
    frase_preco: t.frase_preco ?? '',
    frase_comissao: t.frase_comissao ?? '',
    prazo_entrega: t.prazo_entrega ?? '',
    condicoes_pagamento: t.condicoes_pagamento ?? '',
    garantia: t.garantia ?? '',
    assistencia_tecnica: t.assistencia_tecnica ?? '',
    treinamento_tecnico: t.treinamento_tecnico ?? '',
    transporte_seguro: t.transporte_seguro ?? '',
    validade_oferta: t.validade_oferta ?? '',
    imposto_ipi: t.imposto_ipi ?? '',
    imposto_icms: t.imposto_icms ?? '',
    campos_adicionais: campos,
  }
}

interface Props {
  userId?: string
  userName?: string
  editProposta?: PropostaWithRelations | null
  onSaved: (
    id: string,
    emails?: string[],
    preOpenedTab?: import('@/lib/proposal-auto-open').PreOpenedPrintTab | null,
  ) => void
  onCancel: () => void
}

export function PropostaForm({ userId, userName, editProposta, onSaved, onCancel }: Props) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [saving, setSaving] = useState(false)
  const isEditing = !!editProposta

  const { loading: authLoading } = useAuth()
  const isAdmin = isAdminRole(user?.role)
  // Normalização de checagem do papel: nunca depende de role com espaços ou caixa alta
  const roleNormalized = (user?.role ?? '').trim().toLowerCase()
  const isVendedorOrRepRole =
    isRepresentanteRole(roleNormalized) ||
    roleNormalized === 'vendedor' ||
    roleNormalized === 'representante'
  const isRepUser = !isAdmin && isVendedorOrRepRole
  const restriction = useGerenteCategoryRestriction()
  const [userRepresentante, setUserRepresentante] = useState<Representante | null>(null)
  const [loadingUserRep, setLoadingUserRep] = useState(false)
  const [hasRepError, setHasRepError] = useState(false)
  const [resolvedGerenteLockedId, setResolvedGerenteLockedId] = useState<string | null>(null)
  const [resolvedGerenteLockedNome, setResolvedGerenteLockedNome] = useState<string>('')
  const [userGerenteRecord, setUserGerenteRecord] = useState<Gerente | null>(null)

  const [versoes, setVersoes] = useState<VersaoWithModelo[]>([])
  const [representantes, setRepresentantes] = useState<Representante[]>([])
  const [gerentes, setGerentes] = useState<Gerente[]>([])
  const [tipos, setTipos] = useState<TipoProposta[]>([])
  const [loadingTipos, setLoadingTipos] = useState(false)
  const [tipoSheetOpen, setTipoSheetOpen] = useState(false)
  const [tipoSheetFullscreen, setTipoSheetFullscreen] = useState(false)
  const [clienteDialogOpen, setClienteDialogOpen] = useState(false)
  const [tipoEditing, setTipoEditing] = useState<TipoProposta | null>(null)
  const [tipoForm, setTipoForm] = useState<TipoFormData | null>(null)
  const [tipoSaving, setTipoSaving] = useState(false)
  const [tipoPropostaOverride, setTipoPropostaOverride] = useState<TipoProposta | null>(
    (editProposta?.tipo_proposta_override as TipoProposta | null) || null,
  )
  // When true, after the tipos list refreshes we re-run onTipoPropostaChange
  // with the currently-selected tipo name so the form picks up any updated values.
  const pendingTipoReapply = useRef(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [clienteCompleto, setClienteCompleto] = useState<any>(null)
  const [projetoMode, setProjetoMode] = useState<'new' | 'existing'>('existing')
  const [novoProjetoNome, setNovoProjetoNome] = useState('')
  const [novoProjetoDescricao, setNovoProjetoDescricao] = useState('')
  const [projetoExistenteId, setProjetoExistenteId] = useState('')
  const [projetosList, setProjetosList] = useState<ProjetoWithRelations[]>([])
  const [projetoError, setProjetoError] = useState<string | null>(null)
  const [itensVersoes, setItensVersoes] = useState<PropostaVersaoItem[]>([])
  const [contatosCliente, setContatosCliente] = useState<ClienteContato[]>([])
  const [loadingContatos, setLoadingContatos] = useState(false)
  const [contatoId, setContatoId] = useState<string | null>(editProposta?.contato_id || null)
  const [clienteFormTab, setClienteFormTab] = useState<
    'principais' | 'contato' | 'endereco' | 'contatos_multiplos'
  >('principais')
  const [cascadeSelection, setCascadeSelection] = useState<MachineCascadeSelection>({
    categoriaId: null,
    produtoId: null,
    marcaId: null,
    modeloId: null,
    versaoId: null,
  })
  const baseComissaoModo: BaseComissaoModo = 'completa'
  const [converterMoeda, setConverterMoeda] = useState(false)
  const [moedaManualOverride, setMoedaManualOverride] = useState(false)
  const [itensMoedasMap, setItensMoedasMap] = useState<Record<string, string>>({})
  const { rates } = useCurrencyRates()

  const [form, setForm] = useState({
    cliente: '',
    tipo_proposta: '',
    representante: '',
    gerente: '',
    validade_oferta: '30 dias',
    versao: '',
    moeda: 'BRL',
    moeda_original: 'BRL',
    cotacao_moeda: null as number | null,
    data_cotacao_moeda: '' as string,
    valor_sem_desconto: 0,
    percentual_desconto: 0,
    tem_preco_especial: false,
    preco_especial: 0 as number | null,
    prazo_entrega: '',
    condicoes_pagamento: '',
    descricao_proposta: '',
    emails_notificacao: [] as string[],
    nome_gerente_produto: '',
    nome_assessor_tecnico: 'Jorge Polezi',
    nome_representante_comercial: '',
    acessorios_proposta: [] as Array<{
      id: string
      nome: string
      valor: number
      moeda: string
      inclusao?: 'preco' | 'opcional' | 'incluir' | 'exibir' | 'nao_exibir'
      quantidade?: number
      desconto_percentual?: number
      desconto_valor?: number
      versao_id?: string
    }>,
    assinatura_representante: null as string | null,
    assinatura_gerente_produto: null as string | null,
    transporte_seguro: '',
    imposto_ipi: '' as string | number | null,
    imposto_icms: '' as string | number | null,
    garantia_acessorios: '',
    assistencia_tecnica_detalhada: '',
    campos_adicionais: [] as CustomField[],
    is_pacote: false,
  })

  // Carregar dados de apoio
  useEffect(() => {
    if (restriction.loading) return
    const catFilter =
      restriction.hasRestriction && restriction.categoriaId ? restriction.categoriaId : undefined
    const catIdsFilter =
      restriction.hasRestriction && restriction.categoriaIds.length > 0
        ? restriction.categoriaIds
        : catFilter
          ? [catFilter]
          : undefined

    Promise.all([
      fetchVersoes({
        activeOnly: !isEditing,
        categoriaId: catFilter,
        categoriaIds: catIdsFilter,
        lightweight: true,
      }),
      supabase.from('representantes').select('*').eq('status', 'Ativo').order('fantasia'),
      supabase.from('gerentes').select('*').eq('status', 'Ativo').order('nome'),
    ]).then(([v, r, g]) => {
      setVersoes(v)
      setRepresentantes((r.data ?? []) as unknown as Representante[])
      setGerentes((g.data ?? []) as unknown as Gerente[])
    })
  }, [
    isEditing,
    restriction.loading,
    restriction.hasRestriction,
    restriction.categoriaId,
    restriction.categoriaIds,
  ])

  // Regra de Representante / Vendedor:
  // Busca o registro correspondente em 'representantes' e bloqueia a seleção nele mesmo.
  // Resolve o gerente vinculado: prioridade representantes.gerente_id, fallback profiles.gerente_id.
  // Busca o nome do gerente direto no Supabase caso a lista ainda não tenha carregado.
  useEffect(() => {
    if (!isRepUser || !user) {
      setLoadingUserRep(false)
      setHasRepError(false)
      setResolvedGerenteLockedId(null)
      setResolvedGerenteLockedNome('')
      return
    }

    let isMounted = true
    setLoadingUserRep(true)
    setHasRepError(false)

    // Helper para buscar nome do gerente direto no banco ou na lista
    const fetchGerenteNome = async (gid: string): Promise<string> => {
      const inList = gerentes.find((g) => g.id === gid)
      if (inList?.nome) return inList.nome
      try {
        const { data } = await supabase
          .from('gerentes')
          .select('id, nome')
          .eq('id', gid)
          .maybeSingle()
        return data?.nome || ''
      } catch {
        return ''
      }
    }

    findRepresentanteByProfile(user.id, user.email)
      .then(async (rep) => {
        if (!isMounted) return
        if (rep) {
          setUserRepresentante(rep)
          setHasRepError(false)

          // 1. Prioridade rep.gerente_id, 2. Fallback user.gerente_id
          const resolvedGId = rep.gerente_id || user.gerente_id || null
          let resolvedGNome = ''
          if (resolvedGId) {
            resolvedGNome = await fetchGerenteNome(resolvedGId)
          }

          if (!isMounted) return
          setResolvedGerenteLockedId(resolvedGId)
          setResolvedGerenteLockedNome(resolvedGNome)

          setForm((prev) => ({
            ...prev,
            representante: rep.id,
            nome_representante_comercial:
              rep.fantasia || rep.razao_social || prev.nome_representante_comercial,
            gerente: resolvedGId || '',
            nome_gerente_produto: resolvedGNome || prev.nome_gerente_produto,
          }))
        } else {
          setUserRepresentante(null)
          setHasRepError(true)

          const resolvedGId = user.gerente_id || null
          let resolvedGNome = ''
          if (resolvedGId) {
            resolvedGNome = await fetchGerenteNome(resolvedGId)
          }

          if (!isMounted) return
          setResolvedGerenteLockedId(resolvedGId)
          setResolvedGerenteLockedNome(resolvedGNome)

          if (resolvedGId) {
            setForm((prev) => ({
              ...prev,
              gerente: resolvedGId,
              nome_gerente_produto: resolvedGNome || prev.nome_gerente_produto,
            }))
          }
        }
      })
      .catch((err) => {
        console.error('Erro ao buscar representante vinculado ao usuário:', err)
        if (isMounted) setHasRepError(true)
      })
      .finally(() => {
        if (isMounted) setLoadingUserRep(false)
      })

    return () => {
      isMounted = false
    }
  }, [isRepUser, user?.id, user?.email, user?.gerente_id, gerentes])

  // Se o usuário logado possui papel de gerente, busca o registro correspondente em 'gerentes'
  useEffect(() => {
    if (!user || !isGerenteRole(user.role)) {
      setUserGerenteRecord(null)
      return
    }

    let isMounted = true
    findGerenteByProfile(user.id, user.email, user.gerente_id)
      .then((g) => {
        if (isMounted) setUserGerenteRecord(g)
      })
      .catch((err) => {
        console.error('Erro ao resolver registro de gerente do usuário:', err)
      })

    return () => {
      isMounted = false
    }
  }, [user?.id, user?.email, user?.role, user?.gerente_id])

  const [userProfileSignature, setUserProfileSignature] = useState<string | null>(null)

  // Auto-fetch profile signature
  useEffect(() => {
    const targetUserId = userId || user?.id
    if (!targetUserId) return
    let isMounted = true
    supabase
      .from('profiles')
      .select('assinatura')
      .eq('id', targetUserId)
      .maybeSingle()
      .then(({ data }) => {
        if (isMounted && data?.assinatura) {
          setUserProfileSignature(data.assinatura)
          setForm((prev) => {
            if (!prev.assinatura_representante && !editProposta) {
              return { ...prev, assinatura_representante: data.assinatura }
            }
            return prev
          })
        }
      })
    return () => {
      isMounted = false
    }
  }, [userId, user?.id, editProposta])

  useEffect(() => {
    if (!editProposta) return
    const emails = editProposta.emails_notificacao
      ? editProposta.emails_notificacao
          .split(',')
          .map((e) => e.trim())
          .filter(Boolean)
      : []
    const rawAcessorios = Array.isArray(editProposta.acessorios_proposta)
      ? (editProposta.acessorios_proposta as Array<{
          id: string
          nome: string
          valor: number
          moeda: string
          inclusao?: 'preco' | 'opcional' | 'incluir' | 'exibir' | 'nao_exibir'
          quantidade?: number
          desconto_percentual?: number
          desconto_valor?: number
          versao_id?: string
        }>)
      : []

    // Deduplicate accessories by id + versao_id (keep first occurrence per machine)
    const seenAcessorioIds = new Set<string>()
    const acessorios = rawAcessorios
      .filter((a) => {
        const idKey = `${a.versao_id || ''}-${a.id ? String(a.id) : a.nome}`
        if (!idKey || seenAcessorioIds.has(idKey)) return false
        seenAcessorioIds.add(idKey)
        return true
      })
      .map((a) => ({
        id: a.id,
        nome: a.nome,
        valor: a.valor,
        moeda: a.moeda || editProposta.moeda || 'USD',
        inclusao: a.inclusao ?? 'incluir',
        quantidade: a.quantidade ?? 1,
        desconto_percentual: a.desconto_percentual ?? 0,
        desconto_valor: a.desconto_valor ?? 0,
        versao_id: a.versao_id,
      }))
    if (editProposta.contato_id) {
      setContatoId(editProposta.contato_id)
    }
    const editMoedaOrig = normalizeMoedaCode(
      editProposta.moeda_original || editProposta.moeda || 'BRL',
    )
    const editMoeda = normalizeMoedaCode(editProposta.moeda || 'BRL')
    const hasActiveConversion = Boolean(editProposta.cotacao_moeda) && editMoeda !== editMoedaOrig
    setConverterMoeda(hasActiveConversion)

    setForm({
      cliente: editProposta.cliente || '',
      tipo_proposta: editProposta.tipo_proposta || '',
      representante: editProposta.representante || '',
      gerente: editProposta.gerente || '',
      validade_oferta: editProposta.validade_oferta || '30 dias',
      versao: editProposta.versao || '',
      moeda: editMoeda,
      moeda_original: editMoedaOrig,
      cotacao_moeda: editProposta.cotacao_moeda ?? null,
      data_cotacao_moeda: editProposta.data_cotacao_moeda || '',
      valor_sem_desconto: editProposta.valor_sem_desconto || 0,
      percentual_desconto: 0,
      tem_preco_especial:
        editProposta.preco_especial != null && Number(editProposta.preco_especial) > 0,
      preco_especial: editProposta.preco_especial ?? null,
      prazo_entrega: editProposta.prazo_entrega || '',
      condicoes_pagamento: editProposta.condicoes_pagamento || '',
      descricao_proposta: editProposta.descricao_proposta || '',
      emails_notificacao: emails,
      nome_gerente_produto: editProposta.nome_gerente_produto || '',
      nome_assessor_tecnico: editProposta.nome_assessor_tecnico || 'Jorge Polezi',
      nome_representante_comercial: editProposta.nome_representante_comercial || '',
      acessorios_proposta: acessorios,
      assinatura_representante: editProposta.assinatura_representante || null,
      assinatura_gerente_produto: editProposta.assinatura_gerente_produto || null,
      transporte_seguro: editProposta.transporte_seguro || '',
      imposto_ipi:
        editProposta.imposto_ipi != null && String(editProposta.imposto_ipi).trim() !== ''
          ? editProposta.imposto_ipi
          : null,
      imposto_icms:
        editProposta.imposto_icms != null && String(editProposta.imposto_icms).trim() !== ''
          ? editProposta.imposto_icms
          : null,
      garantia_acessorios: editProposta.garantia_acessorios || '',
      assistencia_tecnica_detalhada: editProposta.assistencia_tecnica_detalhada || '',
      campos_adicionais: Array.isArray(editProposta.campos_adicionais)
        ? (editProposta.campos_adicionais as unknown as CustomField[])
        : [],
      is_pacote: editProposta.is_pacote ?? false,
    })
    setTipoPropostaOverride((editProposta.tipo_proposta_override as TipoProposta | null) || null)
    if (editProposta.projeto) {
      setProjetoMode('existing')
      setProjetoExistenteId(editProposta.projeto)
    } else {
      setProjetoMode('new')
    }
  }, [editProposta])

  useEffect(() => {
    if (!editProposta) return
    fetchPropostaVersoes(editProposta.id)
      .then((items) => {
        const mapped: PropostaVersaoItem[] = items.map((item) => ({
          versao_id: item.versao_id,
          nome: item.versoes?.nome ?? '',
          quantidade: item.quantidade,
          valor_unitario: item.valor_unitario,
          desconto_percentual: item.desconto_percentual ?? 0,
          desconto_valor: item.desconto_valor ?? 0,
          tipo_proposta: item.tipo_proposta ?? undefined,
        }))
        setItensVersoes(mapped)
        const initialMoedas: Record<string, string> = {}
        for (const item of items) {
          if (item.versao_id && item.versoes?.moeda) {
            initialMoedas[item.versao_id] = normalizeMoedaCode(item.versoes.moeda)
          }
        }
        if (Object.keys(initialMoedas).length > 0) {
          setItensMoedasMap((prev) => ({ ...prev, ...initialMoedas }))
        }
      })
      .catch(() => {})
  }, [editProposta])

  useEffect(() => {
    if (!userId && !isAdmin) return
    const loader = isAdmin ? fetchProjetos() : fetchProjetosForUser(userId!)
    loader.then(setProjetosList).catch(() => {})
  }, [userId, isAdmin])

  // Load the tipos de proposta linked to the selected versão (via the
  // versao_tipos_proposta join table). Drives the "Tipo de Proposta" options.
  // When no versão is selected, the list of tipos is empty and the dropdown is disabled.
  const activeVersaoId = form.is_pacote ? itensVersoes[0]?.versao_id || '' : form.versao
  useEffect(() => {
    if (!activeVersaoId) {
      setTipos([])
      setLoadingTipos(false)
      return
    }
    let cancelled = false
    setLoadingTipos(true)
    fetchTiposPropostaByVersaoId(activeVersaoId, true)
      .then((tiposData) => {
        if (!cancelled) {
          setTipos(tiposData)
          setLoadingTipos(false)
        }
      })
      .catch((err) => {
        console.error('Erro ao carregar tipos de proposta da versão:', err)
        if (!cancelled) {
          setTipos([])
          setLoadingTipos(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [activeVersaoId])

  // Initialize the MachineCascade selection from the loaded versão (edit mode).
  // Resolves the full chain versão → modelo → produto → marca/categoria so the
  // hierarchy breadcrumb displays correctly. In edit mode the cascade is disabled,
  // so this is purely presentational.
  //
  // IMPORTANT: when there is no versaoId to resolve, do NOT touch cascadeSelection.
  // In create mode the user builds the cascade top-down (Categoria → ... → Versão);
  // each upstream change clears form.versao/itensVersoes, which would re-trigger
  // this effect and wipe out the selection the user just made (the "selection
  // doesn't stick" bug). The cascade's own change handlers already clear the
  // appropriate downstream levels, so leaving cascadeSelection untouched here is
  // both safe and correct.
  useEffect(() => {
    const versaoId = itensVersoes[0]?.versao_id || form.versao
    if (!versaoId) {
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const vObj = versoes.find((x) => x.id === versaoId)
        const modeloId = vObj?.modelo ?? null
        let produtoId: string | null = null
        let marcaId: string | null = null
        let categoriaId: string | null = null
        if (modeloId) {
          const { data: mod } = await supabase
            .from('modelos')
            .select('produto, marca, produtos(categoria)')
            .eq('id', modeloId)
            .maybeSingle()
          if (mod) {
            produtoId = (mod as { produto?: string | null }).produto ?? null
            marcaId = (mod as { marca?: string | null }).marca ?? null
            const prod = (mod as { produtos?: { categoria?: string | null } | null }).produtos
            categoriaId = prod?.categoria ?? null
          }
        }
        if (cancelled) return
        setCascadeSelection({
          categoriaId,
          produtoId,
          marcaId,
          modeloId,
          versaoId,
        })
      } catch {
        // ignore — keep previous selection
      }
    })()
    return () => {
      cancelled = true
    }
  }, [itensVersoes, form.versao, versoes])

  useEffect(() => {
    if (!form.cliente) {
      setClienteCompleto(null)
      setContatosCliente([])
      setContatoId(null)
      return
    }
    let isCurrent = true
    const fetchCliente = async () => {
      try {
        const { data } = await supabase
          .from('clientes')
          .select('*')
          .eq('id', form.cliente)
          .maybeSingle()
        if (isCurrent && data) setClienteCompleto(data)
      } catch {
        // ignore
      }
    }
    fetchCliente()

    setLoadingContatos(true)
    fetchContatosByCliente(form.cliente)
      .then((contatos) => {
        if (!isCurrent) return
        setContatosCliente(contatos)

        // Preseleção inteligente de contato:
        // Se editProposta já tem contato_id e ele pertence a esta lista, mantém.
        if (contatoId && contatos.some((c) => c.id === contatoId)) {
          // mantém contato selecionado
          return
        }

        if (contatos.length === 1) {
          // Vínculo automático se 1 contato
          setContatoId(contatos[0].id)
        } else if (contatos.length > 1) {
          // Preseleção: is_principal = true; se nenhum, primeiro alfabético de nome
          const sorted = [...contatos].sort((a, b) => a.nome.localeCompare(b.nome))
          const principal = sorted.find((c) => c.is_principal) || sorted[0]
          setContatoId(principal ? principal.id : null)
        } else {
          // 0 contatos
          setContatoId(null)
        }
      })
      .catch((err) => {
        console.error('Erro ao carregar contatos do cliente:', err)
        if (isCurrent) setContatosCliente([])
      })
      .finally(() => {
        if (isCurrent) setLoadingContatos(false)
      })

    return () => {
      isCurrent = false
    }
  }, [form.cliente])

  const upd = (key: string, value: unknown) => setForm((p) => ({ ...p, [key]: value }))

  const selectedVersaoObj = versoes.find((v) => v.id === form.versao)
  const selectedGerenteObj = gerentes.find((g) => g.id === form.gerente)

  // O representante selecionado pode ser um representante normal ou um gerente escolhido como representante
  const selectedRepresentanteObj =
    isRepUser && userRepresentante
      ? userRepresentante
      : form.representante &&
          typeof form.representante === 'string' &&
          form.representante.startsWith('gerente:')
        ? (() => {
            const gId = form.representante.replace('gerente:', '')
            const g = gerentes.find((x) => x.id === gId)
            if (!g) return undefined
            const repLinked = representantes.find(
              (r) =>
                (g.email && r?.email && r.email.toLowerCase() === g.email.toLowerCase()) ||
                (g.profile_id && r?.profile_id === g.profile_id) ||
                (r?.fantasia && g.nome && r.fantasia.toLowerCase() === g.nome.toLowerCase()),
            )
            return {
              id: repLinked?.id || g.id,
              fantasia: `${g.nome || 'Gerente'} (Gerência)`,
              razao_social: g.nome || 'Gerente',
            } as unknown as Representante
          })()
        : representantes.find((r) => r.id === form.representante)

  const onVersaoChange = async (id: string) => {
    // Reset selected tipo de proposta when version changes or is cleared
    upd('tipo_proposta', '')
    upd('tem_preco_especial', false)
    upd('preco_especial', null)
    upd('versao', id)

    // BUG 2: Limpar imediatamente os acessórios da máquina anterior ao trocar ou desmarcar a máquina
    if (!form.is_pacote) {
      upd('acessorios_proposta', [])
    }

    if (!id) {
      setItensVersoes([])
      setTipos([])
      return
    }
    // Resolve the versão locally first; fall back to a DB fetch if the local
    // `versoes` state hasn't loaded yet or doesn't contain the selection. This
    // guarantees itensVersoes/valor_sem_desconto are always populated from the
    // real `valor` field — the root cause of "Valor Final" staying at zero.
    let v: Versao | undefined = versoes.find((x) => x.id === id)
    if (!v || v.especificacoes_tecnicas === undefined || v.especificacoes_tecnicas === null) {
      const fullV = await fetchVersaoById(id)
      if (fullV) {
        v = fullV
      }
    }
    if (v) {
      upd('valor_sem_desconto', v.valor)
      const versaoMoedaNorm = normalizeMoedaCode(v.moeda)
      // Sempre grava a moeda original normalizada da máquina
      upd('moeda_original', versaoMoedaNorm)
      // Padrão: SEM conversão. A moeda da proposta segue a moeda original cadastrada na máquina.
      if (!converterMoeda) {
        upd('moeda', versaoMoedaNorm)
        upd('cotacao_moeda', null)
        upd('data_cotacao_moeda', '')
      } else if (!moedaManualOverride && !isEditing) {
        if (form.moeda !== versaoMoedaNorm) {
          const autoRate =
            form.moeda === 'USD' || versaoMoedaNorm === 'USD'
              ? Number(rates?.usdRate ?? 5.4)
              : Number(rates?.eurRate ?? 5.9)
          if (autoRate && !form.cotacao_moeda) {
            upd('cotacao_moeda', autoRate)
          }
          if (!form.data_cotacao_moeda) {
            upd('data_cotacao_moeda', new Date().toISOString().split('T')[0])
          }
        }
      }
      if (!form.is_pacote) {
        setItensVersoes([
          {
            versao_id: v.id,
            nome: v.nome,
            quantidade: 1,
            valor_unitario: v.valor || 0,
            desconto_percentual: 0,
            desconto_valor: 0,
            tipo_proposta: form.tipo_proposta || undefined,
          },
        ])
      }
    }
  }

  const onGerenteChange = (id: string) => {
    upd('gerente', id)
    const g = gerentes.find((x) => x.id === id)
    upd('nome_gerente_produto', g ? g.nome : '')
  }

  const onRepresentanteChange = (id: string) => {
    upd('representante', id)
    if (id.startsWith('gerente:')) {
      const gId = id.replace('gerente:', '')
      const g = gerentes.find((x) => x.id === gId)
      upd('nome_representante_comercial', g ? g.nome : '')
    } else {
      const r = representantes.find((x) => x.id === id)
      upd('nome_representante_comercial', r ? r.fantasia || r.razao_social || '' : '')
    }
  }

  const onTipoPropostaChange = (nome: string) => {
    upd('tipo_proposta', nome)
    if (!form.is_pacote && itensVersoes.length > 0) {
      setItensVersoes((prev) =>
        prev.map((it, idx) => (idx === 0 ? { ...it, tipo_proposta: nome } : it)),
      )
    }
    const t = tipos.find((x) => x.nome === nome)
    if (t) {
      if (t.transporte_seguro) upd('transporte_seguro', t.transporte_seguro)
      if (t.validade_oferta) upd('validade_oferta', t.validade_oferta)
      if (t.prazo_entrega) upd('prazo_entrega', t.prazo_entrega)
      if (t.condicoes_pagamento) upd('condicoes_pagamento', t.condicoes_pagamento)
      if (t.imposto_ipi != null && String(t.imposto_ipi).trim() !== '') {
        upd('imposto_ipi', t.imposto_ipi)
      } else {
        upd('imposto_ipi', null)
      }
      if (t.imposto_icms != null && String(t.imposto_icms).trim() !== '') {
        upd('imposto_icms', t.imposto_icms)
      } else {
        upd('imposto_icms', null)
      }
      if (t.garantia) upd('garantia_acessorios', t.garantia)
      if (t.assistencia_tecnica) upd('assistencia_tecnica_detalhada', t.assistencia_tecnica)
      if (t.campos_adicionais) {
        const parsed = Array.isArray(t.campos_adicionais)
          ? (t.campos_adicionais as unknown as CustomField[])
          : []
        if (parsed.length > 0) upd('campos_adicionais', parsed)
      }
    }
  }

  // After the tipos list is refreshed following a save in the inline Tipo sheet,
  // re-trigger onTipoPropostaChange with the currently-selected tipo name so the
  // form picks up any updated commercial values (the tipo object in `tipos`
  // now reflects the latest DB state). `nomeForReapply` lets the effect read a
  // fresh value without depending on `tipos`/`form` (which would loop).
  const nomeForReapply = useRef<string | null>(null)
  useEffect(() => {
    if (pendingTipoReapply.current) {
      pendingTipoReapply.current = false
      if (nomeForReapply.current) {
        onTipoPropostaChange(nomeForReapply.current)
        nomeForReapply.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipos])

  const updT = (key: keyof TipoFormData, value: unknown) =>
    setTipoForm((prev) => (prev ? { ...prev, [key]: value as never } : prev))

  const openTipoSheet = () => {
    const rootT = tipos.find((x) => x.nome === form.tipo_proposta)
    const t = tipoPropostaOverride || rootT
    if (!t) return
    setTipoEditing(t)
    setTipoForm(tipoToForm(t))
    setTipoSheetOpen(true)
  }

  const handleRestoreTipoRaiz = () => {
    setTipoPropostaOverride(null)
    const t = tipos.find((x) => x.nome === form.tipo_proposta)
    if (t) {
      setForm((prev) => ({
        ...prev,
        transporte_seguro: t.transporte_seguro || '',
        validade_oferta: t.validade_oferta || '30 dias',
        prazo_entrega: t.prazo_entrega || '',
        condicoes_pagamento: t.condicoes_pagamento || '',
        imposto_ipi:
          t.imposto_ipi != null && String(t.imposto_ipi).trim() !== '' ? t.imposto_ipi : null,
        imposto_icms:
          t.imposto_icms != null && String(t.imposto_icms).trim() !== '' ? t.imposto_icms : null,
        garantia_acessorios: t.garantia || '',
        assistencia_tecnica_detalhada: t.assistencia_tecnica || '',
        campos_adicionais: Array.isArray(t.campos_adicionais)
          ? (t.campos_adicionais as unknown as CustomField[])
          : [],
      }))
    }
    toast({ title: 'Valores originais restaurados' })
  }

  const handleTipoSheetSave = (e: React.FormEvent) => {
    e.preventDefault()
    if (!tipoEditing || !tipoForm) return
    if (!tipoForm.nome.trim()) {
      toast({ title: 'Nome é obrigatório', variant: 'destructive' })
      return
    }

    const mergedOverride: TipoProposta = {
      ...(tipoPropostaOverride || tipoEditing),
      id: tipoEditing.id,
      nome: tipoForm.nome.trim(),
      status: tipoForm.status,
      aplicar_fator_nac: tipoForm.aplicar_fator_nac,
      comissao: tipoForm.comissao,
      frase_preco: tipoForm.frase_preco,
      frase_comissao: tipoForm.frase_comissao,
      prazo_entrega: tipoForm.prazo_entrega,
      condicoes_pagamento: tipoForm.condicoes_pagamento,
      garantia: tipoForm.garantia,
      assistencia_tecnica: tipoForm.assistencia_tecnica,
      treinamento_tecnico: tipoForm.treinamento_tecnico,
      transporte_seguro: tipoForm.transporte_seguro,
      validade_oferta: tipoForm.validade_oferta,
      imposto_ipi: tipoForm.imposto_ipi,
      imposto_icms: tipoForm.imposto_icms,
      campos_adicionais: tipoForm.campos_adicionais,
    }

    setTipoPropostaOverride(mergedOverride)

    setForm((prev) => ({
      ...prev,
      transporte_seguro: tipoForm.transporte_seguro,
      validade_oferta: tipoForm.validade_oferta,
      prazo_entrega: tipoForm.prazo_entrega,
      condicoes_pagamento: tipoForm.condicoes_pagamento,
      imposto_ipi:
        tipoForm.imposto_ipi != null && String(tipoForm.imposto_ipi).trim() !== ''
          ? tipoForm.imposto_ipi
          : null,
      imposto_icms:
        tipoForm.imposto_icms != null && String(tipoForm.imposto_icms).trim() !== ''
          ? tipoForm.imposto_icms
          : null,
      garantia_acessorios: tipoForm.garantia,
      assistencia_tecnica_detalhada: tipoForm.assistencia_tecnica,
      campos_adicionais: tipoForm.campos_adicionais,
    }))

    toast({
      title: 'Tipo personalizado',
      description: 'As alterações foram aplicadas apenas nesta proposta.',
    })

    setTipoSheetOpen(false)
    setTipoEditing(null)
    setTipoForm(null)
  }

  // Detecta se as máquinas selecionadas no modo pacote possuem moedas diferentes entre si
  const moedasDivergentesInfo = useMemo(() => {
    if (!form.is_pacote || itensVersoes.length <= 1) {
      return null
    }

    const moedasEncontradas = new Set<string>()
    for (const item of itensVersoes) {
      const vMoeda =
        itensMoedasMap[item.versao_id] ||
        normalizeMoedaCode(versoes.find((v) => v.id === item.versao_id)?.moeda)
      moedasEncontradas.add(vMoeda.toUpperCase())
    }

    if (moedasEncontradas.size <= 1) {
      return null
    }

    const listaMoedas = Array.from(moedasEncontradas).sort()
    return {
      moedas: listaMoedas,
      moedaProposta: form.moeda,
    }
  }, [form.is_pacote, itensVersoes, itensMoedasMap, versoes, form.moeda])

  // BUG 1: Conversão correta e precisa por item / equipamento / acessório
  // Respeita a moeda armazenada da máquina (USD/EUR/BRL). NUNCA assume BRL se a máquina já estiver em USD/EUR!
  // Converte SOMENTE se a moeda da proposta for diferente da moeda original da máquina.
  const ratesConfig = useMemo(
    () => ({
      cotacaoMoeda: form.cotacao_moeda,
      usdRate: rates?.usdRate,
      eurRate: rates?.eurRate,
    }),
    [form.cotacao_moeda, rates?.usdRate, rates?.eurRate],
  )

  // Helper para obter a moeda original de um item/versão
  const getItemMoeda = (versaoId?: string): string => {
    if (!versaoId) return normalizeMoedaCode(form.moeda_original)
    const fromMap = itensMoedasMap[versaoId]
    if (fromMap) return normalizeMoedaCode(fromMap)
    const fromList = versoes.find((v) => v.id === versaoId)?.moeda
    if (fromList) return normalizeMoedaCode(fromList)
    return normalizeMoedaCode(form.moeda_original)
  }

  // Converter valor unitário de um item para a moeda de destino da proposta (apenas se conversão ativa)
  const getItemValorUnitarioConverted = (item: PropostaVersaoItem): number => {
    if (!converterMoeda) return item.valor_unitario || 0
    const itemMoeda = getItemMoeda(item.versao_id)
    return convertCurrency(item.valor_unitario, itemMoeda, form.moeda, ratesConfig)
  }

  const getItemDescontoValorConverted = (item: PropostaVersaoItem): number => {
    if (!item.desconto_valor) return 0
    if (!converterMoeda) return item.desconto_valor
    const itemMoeda = getItemMoeda(item.versao_id)
    return convertCurrency(item.desconto_valor, itemMoeda, form.moeda, ratesConfig)
  }

  // Subtotais e totais dos equipamentos já expressos na moeda da proposta
  const equipamentosSubtotal = itensVersoes.reduce((sum, i) => {
    const unitValConverted = getItemValorUnitarioConverted(i)
    return sum + (i.quantidade || 1) * unitValConverted
  }, 0)

  const equipamentosComDesconto = itensVersoes.reduce((sum, i) => {
    const unitValConverted = getItemValorUnitarioConverted(i)
    const descValConverted = getItemDescontoValorConverted(i)
    return (
      sum +
      calculateLineTotal({
        quantidade: i.quantidade || 1,
        valor_unitario: unitValConverted,
        desconto_percentual: i.desconto_percentual,
        desconto_valor: descValConverted,
      })
    )
  }, 0)

  // Subtotais e totais dos acessórios já convertidos para a moeda da proposta
  const isAcessorioIncludedInPrice = (inc?: string) =>
    inc === 'incluir' || inc === 'preco' || inc === undefined

  const acessoriosSubtotal = form.acessorios_proposta
    .filter((a) => isAcessorioIncludedInPrice(a.inclusao))
    .reduce((sum, a) => {
      const acMoeda = (
        a.moeda ||
        (a.versao_id ? getItemMoeda(a.versao_id) : form.moeda_original) ||
        'BRL'
      ).toUpperCase()
      const valConverted = converterMoeda
        ? convertCurrency(a.valor || 0, acMoeda, form.moeda, ratesConfig)
        : a.valor || 0
      return sum + valConverted * (a.quantidade || 1)
    }, 0)

  const acessoriosComDesconto = form.acessorios_proposta
    .filter((a) => isAcessorioIncludedInPrice(a.inclusao))
    .reduce((sum, a) => {
      const acMoeda = (
        a.moeda ||
        (a.versao_id ? getItemMoeda(a.versao_id) : form.moeda_original) ||
        'BRL'
      ).toUpperCase()
      const valConverted = converterMoeda
        ? convertCurrency(a.valor || 0, acMoeda, form.moeda, ratesConfig)
        : a.valor || 0
      const descValConverted = converterMoeda
        ? convertCurrency(a.desconto_valor || 0, acMoeda, form.moeda, ratesConfig)
        : a.desconto_valor || 0
      return (
        sum +
        calculateLineTotal({
          quantidade: a.quantidade || 1,
          valor_unitario: valConverted,
          desconto_percentual: a.desconto_percentual,
          desconto_valor: descValConverted,
        })
      )
    }, 0)

  // Ponto 13: Cálculo de Serviços e Comissão Bener para Admissão Temporária / Importação Direta
  // O tipo de proposta selecionado (ou override) fornece a % de comissão
  const currentTipoObj = useMemo(() => {
    return tipoPropostaOverride || tipos.find((t) => t.nome === form.tipo_proposta) || null
  }, [tipoPropostaOverride, tipos, form.tipo_proposta])

  // Subtotal sem desconto dos itens
  const valorSemDescontoBase = equipamentosSubtotal + acessoriosSubtotal
  // Valor dos itens após descontos individuais
  const valorAtualBase = equipamentosComDesconto + acessoriosComDesconto

  // REGRA NOVA: A comissão é calculada SEMPRE sobre o VALOR FINAL da proposta (com preço especial aplicado se houver)
  const baseCalculoComissao = useMemo(() => {
    if (form.tem_preco_especial && form.preco_especial != null && Number(form.preco_especial) > 0) {
      return Number(form.preco_especial)
    }
    return valorAtualBase
  }, [form.tem_preco_especial, form.preco_especial, valorAtualBase])

  const comissaoServicosInfo = useMemo(() => {
    if (!currentTipoObj) return null
    return calcComissaoServicosBener({
      tipoNome: currentTipoObj.nome,
      comissaoPct: currentTipoObj.comissao,
      baseValor: baseCalculoComissao,
      modo: baseComissaoModo,
    })
  }, [currentTipoObj, baseCalculoComissao])

  const valorComissaoCalculada = comissaoServicosInfo?.valorCalculado || 0

  const valorSemDesconto = valorSemDescontoBase + valorComissaoCalculada
  const valorAtual = valorAtualBase + valorComissaoCalculada

  // Ponto 1: Desconto Geral (%) removido do cálculo; descontos ocorrem apenas por item ou Preço Especial
  const valorFinal = form.tem_preco_especial
    ? form.preco_especial != null && Number(form.preco_especial) > 0
      ? Number(form.preco_especial)
      : valorAtual
    : valorAtual

  const fmtCurrency = (val: number) => {
    return formatCurrencyByMoeda(val, form.moeda)
  }

  const proceedWithSave = async (
    preOpenedTab?: import('@/lib/proposal-auto-open').PreOpenedPrintTab | null,
  ) => {
    setSaving(true)
    try {
      let projetoId: string | null = null

      if (projetoMode === 'new') {
        if (!novoProjetoNome.trim()) {
          const msg = 'Informe o nome do novo projeto para emitir a proposta'
          setProjetoError(msg)
          toast({
            title: 'Associação de projeto obrigatória',
            description: msg,
            variant: 'destructive',
          })
          const el = document.getElementById('secao-associacao-projeto')
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' })
          }
          setSaving(false)
          return
        }
        const novoProjeto = await insertProjeto({
          nome: novoProjetoNome.trim(),
          descricao: novoProjetoDescricao || null,
          cliente: form.cliente || null,
          status: 'Em Andamento',
          user: userId ?? null,
          ooo: null,
        })
        projetoId = novoProjeto.id
      } else if (projetoMode === 'existing') {
        if (!projetoExistenteId) {
          const msg = 'Selecione um projeto cadastrado ou crie um novo para emitir a proposta'
          setProjetoError(msg)
          toast({
            title: 'Associação de projeto obrigatória',
            description: msg,
            variant: 'destructive',
          })
          const el = document.getElementById('secao-associacao-projeto')
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' })
          }
          setSaving(false)
          return
        }
        projetoId = projetoExistenteId
      }

      if (!projetoId) {
        const msg = 'Selecione um projeto ou crie um novo para emitir a proposta'
        setProjetoError(msg)
        toast({
          title: 'Associação de projeto obrigatória',
          description: msg,
          variant: 'destructive',
        })
        const el = document.getElementById('secao-associacao-projeto')
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
        setSaving(false)
        return
      }

      // Para representante/vendedor: forçar vínculo com o representante e gerente resolvidos.
      // Se um Gerente foi selecionado como representante ("gerente:ID"):
      // 1. Resolve o ID do registro correspondente em 'representantes' para manter integridade da FK.
      // 2. Preenche nome_representante_comercial com o nome real do gerente.
      let resolvedRepId: string | null = null
      let resolvedRepNome: string | null = null

      if (isRepUser && userRepresentante) {
        resolvedRepId = userRepresentante.id
        resolvedRepNome =
          userRepresentante.fantasia ||
          userRepresentante.razao_social ||
          form.nome_representante_comercial ||
          null
      } else if (form.representante?.startsWith('gerente:')) {
        const gId = form.representante.replace('gerente:', '')
        const g = gerentes.find((x) => x.id === gId)
        resolvedRepNome = g ? g.nome : form.nome_representante_comercial || null

        // Encontrar o representante vinculado a este gerente
        let matchingRep = representantes.find(
          (r) =>
            (g?.email && r.email && r.email.toLowerCase() === g.email.toLowerCase()) ||
            (g?.profile_id && r.profile_id === g.profile_id) ||
            (g?.nome && r.fantasia.toLowerCase() === g.nome.toLowerCase()),
        )

        // Se ainda não carregou ou não encontrou na lista local, buscar no banco
        if (!matchingRep && g) {
          const { data: dbRep } = await supabase
            .from('representantes')
            .select('id, fantasia, razao_social')
            .or(
              [
                g.email ? `email.ilike.${g.email}` : null,
                g.profile_id ? `profile_id.eq.${g.profile_id}` : null,
                `fantasia.ilike.${g.nome}`,
              ]
                .filter(Boolean)
                .join(','),
            )
            .limit(1)
            .maybeSingle()

          if (dbRep) {
            matchingRep = dbRep as unknown as Representante
          }
        }

        resolvedRepId = matchingRep ? matchingRep.id : null
      } else if (form.representante) {
        resolvedRepId = form.representante
        const rObj = representantes.find((r) => r.id === form.representante)
        resolvedRepNome = rObj
          ? rObj.fantasia || rObj.razao_social
          : form.nome_representante_comercial || null
      }

      const finalRepresentanteId = resolvedRepId
      const finalNomeRepresentante = resolvedRepNome

      const finalGerenteId = isRepUser
        ? resolvedGerenteLockedId || userRepresentante?.gerente_id || user?.gerente_id || null
        : form.gerente || null
      const finalNomeGerente = isRepUser
        ? resolvedGerenteLockedNome || selectedGerenteObj?.nome || form.nome_gerente_produto || null
        : selectedGerenteObj
          ? selectedGerenteObj.nome
          : form.nome_gerente_produto || null

      const notificationEmailsClean = Array.from(
        new Set(
          form.emails_notificacao
            .flatMap((e) => e.split(/[,;\s\n\r]+/))
            .map((e) => e.trim().toLowerCase())
            .filter((e) => e && e.includes('@')),
        ),
      )

      // Upload/resolve signature: converts data URL to storage PNG URL; preserves existing URLs; null if none
      const finalSigUrl = editProposta
        ? form.assinatura_representante?.startsWith('http')
          ? form.assinatura_representante
          : await uploadSignatureDataUrl(form.assinatura_representante, 'assinatura-representante')
        : await uploadSignatureDataUrl(form.assinatura_representante, 'assinatura-representante')

      // Segurança: só permitir gravar assinatura de gerente se o usuário tiver permissão
      const canSignGerente = canDrawGerenteSignature({
        user,
        userGerenteRecord,
        selectedGerenteId: finalGerenteId,
        selectedRepresentanteValue: form.representante,
        selectedGerenteNome: finalNomeGerente,
        gerentesList: gerentes,
      })

      const rawSigGerente = canSignGerente ? form.assinatura_gerente_produto : null

      const finalSigGerenteUrl = editProposta
        ? rawSigGerente?.startsWith('http')
          ? rawSigGerente
          : await uploadSignatureDataUrl(rawSigGerente, 'assinatura-gerente')
        : await uploadSignatureDataUrl(rawSigGerente, 'assinatura-gerente')

      const nowIso = new Date().toISOString()

      const mainTipoProposta =
        form.tipo_proposta ||
        (form.is_pacote && itensVersoes[0]?.tipo_proposta ? itensVersoes[0].tipo_proposta : null)

      const payload = {
        cliente: form.cliente || null,
        contato_id: contatoId || null,
        tipo_proposta: mainTipoProposta,
        tipo_proposta_override: tipoPropostaOverride || null,
        representante: finalRepresentanteId,
        gerente: finalGerenteId,
        assinante_representante_id: finalRepresentanteId,
        assinante_gerente_id: finalGerenteId,
        validade_oferta: form.validade_oferta || null,
        versao: itensVersoes[0]?.versao_id || null,
        moeda: converterMoeda
          ? normalizeMoedaCode(form.moeda)
          : normalizeMoedaCode(form.moeda_original || 'BRL'),
        moeda_original: normalizeMoedaCode(form.moeda_original || 'BRL'),
        cotacao_moeda:
          converterMoeda &&
          normalizeMoedaCode(form.moeda) !== normalizeMoedaCode(form.moeda_original)
            ? form.cotacao_moeda
            : null,
        data_cotacao_moeda:
          converterMoeda &&
          normalizeMoedaCode(form.moeda) !== normalizeMoedaCode(form.moeda_original)
            ? form.data_cotacao_moeda
            : null,
        valor_sem_desconto: valorSemDesconto,
        percentual_desconto: 0,
        valor_final: valorFinal,
        preco_especial:
          form.tem_preco_especial && form.preco_especial != null && Number(form.preco_especial) > 0
            ? Number(form.preco_especial)
            : null,
        valor_atual: valorAtual,
        prazo_entrega: form.prazo_entrega || null,
        condicoes_pagamento: form.condicoes_pagamento || null,
        descricao_proposta: form.descricao_proposta || null,
        emails_notificacao: notificationEmailsClean.join(', '),
        nome_gerente_produto: finalNomeGerente,
        nome_assessor_tecnico: 'Jorge Polezi',
        nome_representante_comercial: finalNomeRepresentante,
        acessorios_proposta: form.acessorios_proposta,
        transporte_seguro: form.transporte_seguro || null,
        imposto_ipi:
          form.imposto_ipi != null &&
          String(form.imposto_ipi).trim() !== '' &&
          !isNaN(Number(form.imposto_ipi))
            ? Number(form.imposto_ipi)
            : null,
        imposto_icms:
          form.imposto_icms != null &&
          String(form.imposto_icms).trim() !== '' &&
          !isNaN(Number(form.imposto_icms))
            ? Number(form.imposto_icms)
            : null,
        garantia_acessorios: form.garantia_acessorios || null,
        assistencia_tecnica_detalhada: form.assistencia_tecnica_detalhada || null,
        campos_adicionais: form.campos_adicionais,
        assinatura_representante: finalSigUrl,
        data_assinatura_representante: finalSigUrl ? nowIso : null,
        assinado_por_representante: finalSigUrl ? user?.id || null : null,
        assinatura_gerente_produto: finalSigGerenteUrl,
        data_assinatura_gerente: finalSigGerenteUrl ? nowIso : null,
        assinado_por_gerente: finalSigGerenteUrl ? user?.id || null : null,
        projeto: projetoId,
        is_pacote: form.is_pacote,
        status: 'Em Analise',
      }

      // Captura o snapshot imutável das máquinas/versões no momento da criação/revisão
      // BUG 1: O snapshot congelado e as linhas de proposta_versoes devem refletir a moeda correta convertida
      // usando convertCurrency por item (respeitando se a máquina já estava em USD/EUR)
      const { itens_snapshot, dados_snapshot } = await buildPropostaSnapshot({
        is_pacote: form.is_pacote,
        versaoId: itensVersoes[0]?.versao_id || null,
        tipo_proposta: mainTipoProposta,
        tipo_proposta_override: tipoPropostaOverride || null,
        userName,
        itens: itensVersoes.map((item, idx) => ({
          versao_id: item.versao_id,
          quantidade: item.quantidade,
          valor_unitario: getItemValorUnitarioConverted(item),
          desconto_percentual: item.desconto_percentual ?? 0,
          desconto_valor: getItemDescontoValorConverted(item),
          ordem: idx,
          tipo_proposta: item.tipo_proposta ?? (form.is_pacote ? null : form.tipo_proposta) ?? null,
          versoes: versoes.find((v) => v.id === item.versao_id),
        })),
        acessorios_proposta: (form.acessorios_proposta || []).map((a) => {
          const acMoeda = normalizeMoedaCode(
            a.moeda || (a.versao_id ? getItemMoeda(a.versao_id) : form.moeda_original) || 'BRL',
          )
          const targetMoeda = normalizeMoedaCode(form.moeda)
          return {
            ...a,
            valor: converterMoeda
              ? convertCurrency(a.valor || 0, acMoeda, targetMoeda, ratesConfig)
              : a.valor || 0,
            desconto_valor: converterMoeda
              ? convertCurrency(a.desconto_valor || 0, acMoeda, targetMoeda, ratesConfig)
              : a.desconto_valor || 0,
            moeda: targetMoeda,
          }
        }),
        secoes_adicionais: (form as any).secoes_adicionais || null,
        campos_adicionais: form.campos_adicionais || [],
        comissao_servicos: comissaoServicosInfo
          ? {
              valor_comissao_servicos: comissaoServicosInfo.valorCalculado,
              base_comissao_servicos: comissaoServicosInfo.baseCalculo,
              percentual_comissao_servicos: comissaoServicosInfo.percentual,
              comissao_servicos_aplicavel: true,
              base_comissao_modo: baseComissaoModo,
            }
          : {
              valor_comissao_servicos: 0,
              base_comissao_servicos: baseCalculoComissao,
              percentual_comissao_servicos: Number(currentTipoObj?.comissao || 0),
              comissao_servicos_aplicavel: false,
              base_comissao_modo: baseComissaoModo,
            },
        knownVersoes: versoes,
      })

      const payloadWithSnapshot = {
        ...payload,
        tipo_proposta_override: tipoPropostaOverride || null,
        itens_snapshot,
        dados_snapshot,
      }

      const result = editProposta
        ? await createPropostaVersion(editProposta.id, payloadWithSnapshot, userName, userId)
        : await insertProposta(payloadWithSnapshot, userName, userId)

      await replacePropostaVersoes(
        result.id,
        itensVersoes.map((item, idx) => ({
          proposta_id: result.id,
          versao_id: item.versao_id,
          quantidade: item.quantidade,
          valor_unitario: getItemValorUnitarioConverted(item),
          desconto_percentual: item.desconto_percentual ?? 0,
          desconto_valor: getItemDescontoValorConverted(item),
          ordem: idx,
          tipo_proposta: item.tipo_proposta ?? (form.is_pacote ? null : form.tipo_proposta) ?? null,
        })),
      )

      const notificationEmails = notificationEmailsClean

      toast({
        title: editProposta ? 'Nova versão criada com sucesso!' : 'Proposta emitida com sucesso!',
        description: editProposta
          ? `Revisão ${result.revisao || ''} gerada a partir de ${editProposta.numero_proposta}.`
          : 'A proposta comercial foi registrada no sistema.',
      })

      onSaved(result.id, notificationEmails, preOpenedTab)
    } catch (err) {
      if (preOpenedTab) {
        preOpenedTab.close()
      }
      toast({
        title: 'Erro ao salvar proposta',
        description: err instanceof Error ? err.message : 'Ocorreu um erro desconhecido.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e && e.preventDefault) {
      e.preventDefault()
    }

    if (isRepUser) {
      if (hasRepError || !userRepresentante) {
        toast({
          title: 'Cadastro de representante não localizado',
          description:
            'Seu usuário possui papel de representante, mas não foi encontrado um registro correspondente de Representante vinculado. Entre em contato com o suporte ou administrador.',
          variant: 'destructive',
        })
        return
      }
      if (form.representante !== userRepresentante.id) {
        toast({
          title: 'Permissão negada',
          description: 'Representantes só podem emitir propostas em seu próprio nome.',
          variant: 'destructive',
        })
        return
      }
    }

    if (!form.cliente) {
      toast({ title: 'Selecione um cliente', variant: 'destructive' })
      return
    }

    // Regra de Contato do Cliente:
    // 0 contatos: BLOQUEAR emissão
    if (contatosCliente.length === 0 && !loadingContatos) {
      toast({
        title: 'Contato do cliente obrigatório',
        description:
          'Este cliente não possui nenhum contato cadastrado. É obrigatório cadastrar pelo menos um contato para prosseguir com a emissão da proposta.',
        variant: 'destructive',
      })
      return
    }

    // Se possui contatos mas nenhum foi selecionado
    if (contatosCliente.length > 0 && !contatoId) {
      toast({
        title: 'Selecione um contato',
        description: 'Selecione o contato destinatário da proposta.',
        variant: 'destructive',
      })
      return
    }

    if (itensVersoes.length === 0) {
      toast({ title: 'Selecione ao menos uma versão do equipamento', variant: 'destructive' })
      return
    }

    if (form.is_pacote) {
      const itemSemTipo = itensVersoes.find((it) => !it.tipo_proposta || !it.tipo_proposta.trim())
      if (itemSemTipo) {
        toast({
          title: 'Tipo de proposta pendente',
          description: `Selecione o tipo de proposta para a máquina "${itemSemTipo.nome || 'do pacote'}".`,
          variant: 'destructive',
        })
        const el =
          document.getElementById(`pacote-item-${itemSemTipo.versao_id}`) ||
          document.getElementById('pacote-item-0')
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
        return
      }
    } else {
      if (!form.tipo_proposta) {
        toast({ title: 'Selecione o tipo de proposta', variant: 'destructive' })
        return
      }
    }

    // Validação obrigatória de Associação de Projeto (exigência Bianca)
    if (projetoMode === 'new' && !novoProjetoNome.trim()) {
      const msg = 'Informe o nome do novo projeto para emitir a proposta'
      setProjetoError(msg)
      toast({
        title: 'Associação de projeto obrigatória',
        description: msg,
        variant: 'destructive',
      })
      const el = document.getElementById('secao-associacao-projeto')
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
      return
    }

    if (projetoMode === 'existing' && !projetoExistenteId) {
      const msg = 'Selecione um projeto ou crie um novo para emitir a proposta'
      setProjetoError(msg)
      toast({
        title: 'Associação de projeto obrigatória',
        description: msg,
        variant: 'destructive',
      })
      const el = document.getElementById('secao-associacao-projeto')
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
      return
    }

    setProjetoError(null)

    // Pre-open print-ready PDF window synchronously inside the user-gesture click handler
    // so modern browser popup blockers allow opening the generated document automatically.
    const preOpenedTab = preOpenProposalPrintTab()

    try {
      await proceedWithSave(preOpenedTab)
    } catch (saveErr) {
      preOpenedTab.close()
      throw saveErr
    }
  }

  return (
    <div className="space-y-6 pb-6">
      {/* Navigation Header */}
      <div className="flex items-center justify-between border-b pb-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onCancel} className="gap-1 text-slate-600">
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </Button>
          <div className="h-5 w-px bg-border" />
          <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            {editProposta ? 'Editar Proposta' : 'Emitir Proposta'}
          </h1>
        </div>
      </div>

      {editProposta && (
        <div className="bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
              Ao salvar esta edição, uma nova versão será criada e a versão atual será preservada.
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
              A proposta original ({editProposta.numero_proposta || '—'}) não será alterada. Um novo
              registro será criado com a próxima letra de revisão (ex: A → B). Apenas desconto,
              acessórios e condições de pagamento podem ser editados.
            </p>
          </div>
        </div>
      )}

      {/* 1. Cliente & Equipe Comercial */}
      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="space-y-4">
            {/* Linha 1: Cliente em linha própria (campo principal e obrigatório com largura total) */}
            <div className="w-full">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Cliente *
              </Label>
              <div className="mt-1 flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <SearchableCombobox
                    value={form.cliente || null}
                    onChange={(v) => upd('cliente', v || '')}
                    placeholder="Selecione um cliente..."
                    searchPlaceholder="Buscar por nome, razão social ou CNPJ..."
                    disabled={isEditing}
                    fetchOptions={async (query, page) => {
                      const from = (page - 1) * 20
                      const to = page * 20 - 1

                      let q = supabase
                        .from('clientes')
                        .select(
                          'id, fantasia, razao_social, documento, cidade, estado, maquina_interesse',
                          {
                            count: 'exact',
                          },
                        )
                        .eq('status', 'Ativo')

                      // Se o usuário logado for vendedor ou representante, filtra clientes criados por ele OU de seus estados de atuação
                      const roleLower = (user?.role || '').toLowerCase()
                      const isVendedorOuRep =
                        roleLower.includes('vendedor') || roleLower.includes('representante')

                      if (isVendedorOuRep) {
                        if (!user?.id) {
                          return { items: [], hasMore: false }
                        }
                        const rawEstadoAtuacao =
                          (userRepresentante?.estado && userRepresentante.estado.trim()) ||
                          (user.estado_atuacao && user.estado_atuacao.trim()) ||
                          null

                        const estadosList = rawEstadoAtuacao
                          ? Array.from(
                              new Set(
                                rawEstadoAtuacao
                                  .split(',')
                                  .map((s) => s.trim().toUpperCase())
                                  .filter((s) => s.length > 0),
                              ),
                            )
                          : []

                        if (estadosList.length > 0) {
                          const estadoClauses = estadosList
                            .map((uf) => `estado.ilike.${uf}`)
                            .join(',')
                          q = q.or(`criado_por.eq.${user.id},${estadoClauses}`)
                        } else {
                          q = q.eq('criado_por', user.id)
                        }
                      }

                      if (query && query.trim()) {
                        const trimmed = query.trim()
                        q = q.or(
                          `fantasia.ilike.%${trimmed}%,razao_social.ilike.%${trimmed}%,documento.ilike.%${trimmed}%`,
                        )
                      }

                      const { data, count, error } = await q.order('fantasia').range(from, to)

                      if (error || !data) {
                        return { items: [], hasMore: false }
                      }

                      const items = data.map(
                        (c: {
                          id: string
                          fantasia: string
                          razao_social?: string | null
                          documento: string | null
                          cidade?: string | null
                          estado?: string | null
                          maquina_interesse?: string | null
                        }) => {
                          const nomePrincipal = c.fantasia || c.razao_social || 'Cliente sem nome'
                          const subParts: string[] = []
                          if (c.documento) subParts.push(`Doc: ${c.documento}`)
                          const local = [c.cidade, c.estado].filter(Boolean).join(' - ')
                          if (local) subParts.push(local)
                          if (c.maquina_interesse)
                            subParts.push(`Interesse: ${c.maquina_interesse}`)

                          return {
                            value: c.id,
                            label: c.maquina_interesse
                              ? `${nomePrincipal} — Interesse: ${c.maquina_interesse}`
                              : nomePrincipal,
                            sublabel: subParts.join(' • '),
                          }
                        },
                      )

                      const hasMore = count != null ? to + 1 < count : items.length === 20
                      return { items, hasMore }
                    }}
                  />
                </div>
                {!isEditing && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-10 w-10 shrink-0 text-muted-foreground hover:text-foreground border-slate-200 dark:border-slate-800"
                          onClick={() => setClienteDialogOpen(true)}
                          aria-label="Cadastrar novo cliente"
                        >
                          <Plus className="w-4 h-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Cadastrar novo cliente</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
            </div>

            {/* Linha 2: Equipe Comercial com largura confortável em 3 colunas (responsivo: 1 col no mobile, 3 col a partir de md) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
              {/* Representante Comercial */}
              <div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    Representante Comercial
                    {(isRepUser || authLoading) && (
                      <Lock className="w-3 h-3 text-muted-foreground" />
                    )}
                  </Label>
                  {isRepUser && (
                    <span className="text-[11px] text-muted-foreground">
                      Vinculado ao seu usuário
                    </span>
                  )}
                </div>
                <div className="mt-1">
                  {authLoading ? (
                    <div className="h-10 px-3 flex items-center border rounded-md bg-muted/30 text-sm text-muted-foreground">
                      Carregando permissões do usuário...
                    </div>
                  ) : isRepUser ? (
                    loadingUserRep ? (
                      <div className="h-10 px-3 flex items-center border rounded-md bg-muted/30 text-sm text-muted-foreground">
                        Carregando representante vinculado...
                      </div>
                    ) : hasRepError || !userRepresentante ? (
                      <div className="p-3 border border-destructive/40 bg-destructive/5 rounded-md text-xs text-destructive flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-semibold">
                            Nenhum cadastro de representante vinculado
                          </p>
                          <p className="mt-0.5 text-muted-foreground">
                            Seu perfil é de representante/vendedor, porém não localizamos seu
                            cadastro de representante comercial pelo e-mail ({user?.email}). Entre
                            em contato com o suporte para liberar a emissão.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="h-10 px-3 flex items-center justify-between border rounded-md bg-muted/40 text-sm font-medium text-foreground cursor-not-allowed select-none">
                        <span className="truncate">
                          {userRepresentante?.fantasia ||
                            userRepresentante?.razao_social ||
                            'Representante'}
                        </span>
                        <Lock className="w-4 h-4 text-muted-foreground shrink-0 ml-2" />
                      </div>
                    )
                  ) : (
                    <SearchableCombobox
                      value={form.representante || null}
                      onChange={(v) => onRepresentanteChange(v || '')}
                      placeholder="Selecione o representante ou gerente..."
                      searchPlaceholder="Buscar representante ou gerente..."
                      disabled={isEditing}
                      fetchOptions={async (query, page) => {
                        const trimmed = query.trim().toLowerCase()
                        const pageSize = 25
                        const from = (page - 1) * pageSize
                        const to = page * pageSize - 1

                        // 1. Buscar representantes comerciais ativos
                        let q = supabase
                          .from('representantes')
                          .select('id, fantasia, razao_social, status', { count: 'exact' })
                          .eq('status', 'Ativo')

                        if (trimmed) {
                          q = q.ilike('fantasia', `%${trimmed}%`)
                        }

                        const { data: repData, count: repCount } = await q
                          .order('fantasia')
                          .range(from, to)

                        const repItems: SearchableComboboxOption[] = (repData ?? []).map(
                          (r: { id: string; fantasia: string; razao_social?: string }) => ({
                            value: r.id,
                            label: r.fantasia || r.razao_social || 'Sem nome',
                            sublabel:
                              r.razao_social && r.razao_social !== r.fantasia
                                ? r.razao_social
                                : undefined,
                          }),
                        )

                        // 2. Gerentes ativos agrupados após representantes na 1ª página ou quando filtrados
                        const matchingGerentes: SearchableComboboxOption[] = gerentes
                          .filter((g) => g.status === 'Ativo')
                          .filter((g) => !trimmed || g.nome.toLowerCase().includes(trimmed))
                          .map((g) => ({
                            value: `gerente:${g.id}`,
                            label: `${g.nome} (Gerência)`,
                          }))

                        let items: SearchableComboboxOption[] = repItems
                        if (page === 1) {
                          items = [...repItems, ...matchingGerentes]
                        }

                        const totalReps = repCount ?? 0
                        const hasMore = to + 1 < totalReps

                        return { items, hasMore }
                      }}
                    />
                  )}
                </div>
              </div>

              {/* Gerente de Produto */}
              <div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    Gerente de Produto
                    {(isRepUser || authLoading) && (
                      <Lock className="w-3 h-3 text-muted-foreground" />
                    )}
                  </Label>
                  {isRepUser && (form.gerente || resolvedGerenteLockedId) && (
                    <span className="text-[11px] text-muted-foreground">
                      Vinculado ao seu cadastro
                    </span>
                  )}
                </div>
                <div className="mt-1">
                  {authLoading ? (
                    <div className="h-10 px-3 flex items-center border rounded-md bg-muted/30 text-sm text-muted-foreground">
                      Carregando permissões do usuário...
                    </div>
                  ) : isRepUser ? (
                    loadingUserRep ? (
                      <div className="h-10 px-3 flex items-center border rounded-md bg-muted/30 text-sm text-muted-foreground">
                        Carregando gerente vinculado...
                      </div>
                    ) : form.gerente || resolvedGerenteLockedId ? (
                      <div className="h-10 px-3 flex items-center justify-between border rounded-md bg-muted/40 text-sm font-medium text-foreground cursor-not-allowed select-none">
                        <span className="truncate">
                          {form.nome_gerente_produto ||
                            resolvedGerenteLockedNome ||
                            selectedGerenteObj?.nome ||
                            'Gerente vinculado'}
                        </span>
                        <Lock className="w-4 h-4 text-muted-foreground shrink-0 ml-2" />
                      </div>
                    ) : (
                      <div className="h-10 px-3 flex items-center justify-between border border-dashed rounded-md bg-muted/20 text-xs text-muted-foreground select-none">
                        <span className="truncate italic">
                          Nenhum gerente vinculado ao seu cadastro
                        </span>
                        <Info className="w-3.5 h-3.5 text-muted-foreground shrink-0 ml-2" />
                      </div>
                    )
                  ) : (
                    <SearchableCombobox
                      value={form.gerente || null}
                      onChange={(v) => onGerenteChange(v || '')}
                      placeholder="Selecione o gerente..."
                      searchPlaceholder="Buscar por nome..."
                      disabled={isEditing}
                      fetchOptions={async (query, page) => {
                        const from = (page - 1) * 20
                        const to = page * 20 - 1

                        let q = supabase
                          .from('gerentes')
                          .select('id, nome, email', { count: 'exact' })
                          .eq('status', 'Ativo')

                        if (query && query.trim()) {
                          const trimmed = query.trim()
                          q = q.ilike('nome', `%${trimmed}%`)
                        }

                        const { data, count, error } = await q.order('nome').range(from, to)

                        if (error || !data) {
                          return { items: [], hasMore: false }
                        }

                        const items = data.map(
                          (g: { id: string; nome: string; email?: string }) => ({
                            value: g.id,
                            label: g.nome,
                            sublabel: g.email || undefined,
                          }),
                        )

                        const hasMore = count != null ? to + 1 < count : items.length === 20
                        return { items, hasMore }
                      }}
                    />
                  )}
                </div>
              </div>

              {/* Assessor Técnico */}
              <div>
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Assessor Técnico
                </Label>
                <div className="mt-1">
                  <Input
                    value="Jorge Polezi"
                    readOnly
                    disabled
                    placeholder="Jorge Polezi"
                    className="h-10 text-sm font-medium bg-muted/40 cursor-not-allowed select-none text-foreground"
                  />
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Project Linking Selector */}
      <PropostaProjetoLinker
        id="secao-associacao-projeto"
        mode={projetoMode}
        onModeChange={(m) => {
          setProjetoMode(m)
          setProjetoError(null)
        }}
        novoProjetoNome={novoProjetoNome}
        onNovoProjetoNomeChange={(v) => {
          setNovoProjetoNome(v)
          if (projetoError && v.trim()) setProjetoError(null)
        }}
        novoProjetoDescricao={novoProjetoDescricao}
        onNovoProjetoDescricaoChange={setNovoProjetoDescricao}
        projetoExistenteId={projetoExistenteId}
        onProjetoExistenteIdChange={(v) => {
          setProjetoExistenteId(v)
          if (projetoError && v) setProjetoError(null)
        }}
        projetos={projetosList}
        clienteId={form.cliente || null}
        disabled={isEditing}
        error={projetoError}
      />

      {/* Package Selector — discreet inline toggle */}
      <div className="flex items-center gap-2 px-1 -mt-2">
        <Switch
          id="is-pacote"
          checked={form.is_pacote}
          onCheckedChange={(checked) => {
            upd('is_pacote', checked)
            if (!checked && itensVersoes.length > 1) {
              const first = itensVersoes[0]
              setItensVersoes(first ? [first] : [])
              upd('versao', first?.versao_id || '')
            }
          }}
          disabled={isEditing}
          className="scale-90"
        />
        <Label
          htmlFor="is-pacote"
          className="text-xs text-muted-foreground cursor-pointer select-none"
        >
          Proposta pacote (múltiplos equipamentos)
        </Label>
      </div>

      {/* 2. Seleção de Máquina / Versão (Primeiro passo da máquina) */}
      {form.is_pacote ? (
        <PropostaMultiVersoes
          versoes={versoes}
          items={itensVersoes}
          onChange={async (items) => {
            const previousVersaoId = itensVersoes[0]?.versao_id
            const newVersaoId = items[0]?.versao_id
            if (previousVersaoId !== newVersaoId) {
              upd('tipo_proposta', '')
            }

            // Detectar mudança na composição de máquinas do pacote (adição/remoção/troca)
            const previousVersaoIds = itensVersoes.map((it) => it.versao_id)
            const nextVersaoIds = items.map((it) => it.versao_id)
            const composicaoMudou =
              previousVersaoIds.length !== nextVersaoIds.length ||
              previousVersaoIds.some((vId, idx) => vId !== nextVersaoIds[idx])

            if (composicaoMudou) {
              upd('tem_preco_especial', false)
              upd('preco_especial', null)
            }

            // BUG 2: Limpar imediatamente os acessórios de quaisquer máquinas removidas do pacote
            const currentVersaoIds = new Set(items.map((it) => it.versao_id))
            const filteredAcessorios = form.acessorios_proposta.filter(
              (a) => !a.versao_id || currentVersaoIds.has(a.versao_id),
            )
            if (filteredAcessorios.length !== form.acessorios_proposta.length) {
              upd('acessorios_proposta', filteredAcessorios)
            }

            setItensVersoes(items)
            if (items[0]) {
              upd('versao', items[0].versao_id)
            } else {
              upd('versao', '')
            }

            // Atualiza o mapa de moedas das versões selecionadas para detecção de divergência
            const newMoedasMap: Record<string, string> = {}
            for (const item of items) {
              if (item.versao_id) {
                let vMoeda =
                  itensMoedasMap[item.versao_id] ||
                  versoes.find((x) => x.id === item.versao_id)?.moeda
                if (!vMoeda) {
                  const fetched = await fetchVersaoById(item.versao_id)
                  if (fetched?.moeda) vMoeda = fetched.moeda
                }
                newMoedasMap[item.versao_id] = normalizeMoedaCode(vMoeda)
              }
            }
            setItensMoedasMap((prev) => ({ ...prev, ...newMoedasMap }))

            // Se o usuário ainda não escolheu uma moeda manualmente, atualiza a moeda padrão da proposta
            // a partir da primeira versão selecionada no pacote
            if (!converterMoeda && items[0]) {
              const firstVersaoMoeda = newMoedasMap[items[0].versao_id] || 'BRL'
              upd('moeda', firstVersaoMoeda)
              upd('moeda_original', firstVersaoMoeda)
              upd('cotacao_moeda', null)
              upd('data_cotacao_moeda', '')
            } else if (!moedaManualOverride && !isEditing && items[0]) {
              const firstVersaoMoeda = newMoedasMap[items[0].versao_id] || 'BRL'
              upd('moeda_original', firstVersaoMoeda)
              if (form.moeda !== firstVersaoMoeda) {
                const autoRate =
                  firstVersaoMoeda === 'USD' || form.moeda === 'USD'
                    ? Number(rates?.usdRate ?? 5.4)
                    : Number(rates?.eurRate ?? 5.9)
                if (autoRate && !form.cotacao_moeda) {
                  upd('cotacao_moeda', autoRate)
                }
                if (!form.data_cotacao_moeda) {
                  upd('data_cotacao_moeda', new Date().toISOString().split('T')[0])
                }
              }
            }
          }}
          currency={form.moeda}
          precoEspecialAtivo={!!form.tem_preco_especial}
          acessorios={form.acessorios_proposta}
          onAcessoriosChange={(newAcessorios) => {
            upd('acessorios_proposta', newAcessorios)
          }}
        />
      ) : (
        <Card>
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Package className="w-5 h-5 text-primary" />
              <h3 className="text-sm font-semibold">
                1. Seleção de Máquina / Versão (Obrigatório primeiro)
              </h3>
            </div>
            <div>
              <MachineCascadeSearch
                value={cascadeSelection}
                onChange={(sel) => {
                  setCascadeSelection(sel)
                  // Only re-seed price/itens when the versão actually changes;
                  // filter-only changes keep the user's discount edits intact.
                  if (sel.versaoId && sel.versaoId !== form.versao) {
                    onVersaoChange(sel.versaoId)
                  } else if (!sel.versaoId) {
                    // Quando a seleção é cancelada/removida, restaura todos os filtros da cascata
                    // para a listagem completa (sem retenção residual) e zera a versão da proposta.
                    if (
                      sel.categoriaId !== null ||
                      sel.produtoId !== null ||
                      sel.marcaId !== null ||
                      sel.modeloId !== null
                    ) {
                      setCascadeSelection({
                        categoriaId: null,
                        produtoId: null,
                        marcaId: null,
                        modeloId: null,
                        versaoId: null,
                      })
                    }
                    onVersaoChange('')
                  }
                }}
                disabled={isEditing}
                showBreadcrumbContext={true}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* 3. Tipo de Proposta (Habilitado apenas após selecionar a Versão; oculto no modo pacote onde cada máquina já define seu tipo) */}
      {!form.is_pacote && (
        <Card className={!activeVersaoId ? 'opacity-70 border-dashed' : ''}>
          <CardContent className="p-5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                <Label className="text-sm font-semibold text-foreground">
                  2. Tipo de Proposta *
                  {activeVersaoId && (
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      {loadingTipos
                        ? '(carregando tipos...)'
                        : `(${tipos.length} associado${tipos.length === 1 ? '' : 's'} a esta versão)`}
                    </span>
                  )}
                </Label>
              </div>
              {form.tipo_proposta && !isEditing && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1 text-xs text-muted-foreground hover:text-primary"
                  onClick={openTipoSheet}
                  title="Editar dados comerciais deste tipo"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Editar tipo
                </Button>
              )}
            </div>

            {tipoPropostaOverride !== null && (
              <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-md bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/80">
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className="bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-900/40 dark:text-amber-200 dark:border-amber-700 text-xs font-semibold gap-1"
                  >
                    Personalizado nesta proposta
                  </Badge>
                  <span className="text-xs text-amber-800 dark:text-amber-300 hidden sm:inline">
                    Termos comerciais customizados apenas para este documento.
                  </span>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs bg-white dark:bg-slate-900 hover:bg-amber-100 dark:hover:bg-amber-950 border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 gap-1.5"
                  onClick={handleRestoreTipoRaiz}
                  title="Restaurar valores padrão do catálogo raiz"
                >
                  <RotateCcw className="w-3 h-3 text-amber-700 dark:text-amber-400" />
                  Restaurar original da raiz
                </Button>
              </div>
            )}

            {!activeVersaoId ? (
              <div className="p-4 rounded-lg bg-muted/40 border border-dashed flex items-center gap-3 text-sm text-muted-foreground">
                <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                <span>
                  Escolha a <strong>versão da máquina</strong> acima para desbloquear a seleção do
                  tipo de proposta.
                </span>
              </div>
            ) : loadingTipos ? (
              <div className="flex items-center gap-2 py-3 px-4 border rounded-md bg-muted/20 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                Carregando tipos de proposta associados à versão...
              </div>
            ) : tipos.length === 0 ? (
              <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 flex items-center gap-3 text-sm text-amber-800 dark:text-amber-300">
                <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
                <span>Nenhum tipo de proposta associado a esta versão.</span>
              </div>
            ) : (
              <Select
                value={form.tipo_proposta || undefined}
                onValueChange={onTipoPropostaChange}
                disabled={isEditing}
              >
                <SelectTrigger className="w-full h-11" disabled={isEditing}>
                  <SelectValue placeholder="Selecione o tipo de proposta associado à versão..." />
                </SelectTrigger>
                <SelectContent>
                  {tipos.map((t) => (
                    <SelectItem key={t.id} value={t.nome}>
                      <span className="font-medium">{t.nome}</span>
                      {t.comissao ? (
                        <span className="ml-2 text-xs text-muted-foreground">
                          (Comissão: {t.comissao}%)
                        </span>
                      ) : null}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </CardContent>
        </Card>
      )}

      {/* Aviso de Moedas Divergentes na Proposta Pacote */}
      {moedasDivergentesInfo && (
        <div
          role="status"
          aria-live="polite"
          className="rounded-lg border border-amber-200 bg-amber-50/80 p-4 text-amber-900 shadow-sm dark:border-amber-800/80 dark:bg-amber-950/30 dark:text-amber-200 animate-in fade-in-50 duration-200"
        >
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1 text-sm">
              <p className="font-semibold text-amber-950 dark:text-amber-100">
                Máquinas com moedas diferentes no pacote
              </p>
              <p className="text-amber-900/90 dark:text-amber-200/90 leading-relaxed">
                As máquinas selecionadas estão cadastradas em moedas diferentes (
                {moedasDivergentesInfo.moedas.join(', ')}). O valor total da proposta será
                consolidado em{' '}
                <strong className="font-semibold text-amber-950 dark:text-amber-100">
                  {moedasDivergentesInfo.moedaProposta === 'USD'
                    ? 'Dólar Americano (USD)'
                    : moedasDivergentesInfo.moedaProposta === 'EUR'
                      ? 'Euro (EUR)'
                      : 'Reais (BRL)'}
                </strong>
                . Se desejar, você pode alterar a moeda da proposta e a taxa de câmbio abaixo.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Financial Controls - Layout alinhado ao print de referência */}
      <Card className="overflow-hidden border-slate-200 dark:border-slate-800 shadow-sm">
        <CardContent className="p-5 sm:p-6 space-y-4">
          {/* 1. Cabeçalho da seção: Título com marcador verde à esquerda e Seletor de Moeda à direita */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-4 bg-[#0b3c26] rounded-full" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                Valores e Condições Comerciais
              </h3>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {form.is_pacote && (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300">
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {itensVersoes.length} {itensVersoes.length === 1 ? 'máquina' : 'máquinas'}
                  </span>
                  <span>no pacote</span>
                </div>
              )}

              {/* Ponto 2: Moeda padrão é a da máquina (sem conversão). Toggle explícito para ativar conversão */}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
                <Switch
                  id="toggle-converter-moeda"
                  checked={converterMoeda}
                  onCheckedChange={(checked) => {
                    setConverterMoeda(checked)
                    if (!checked) {
                      const orig = normalizeMoedaCode(form.moeda_original)
                      upd('moeda', orig)
                      upd('cotacao_moeda', null)
                      upd('data_cotacao_moeda', '')
                    } else {
                      const orig = normalizeMoedaCode(form.moeda_original)
                      const target = orig === 'BRL' ? 'USD' : 'BRL'
                      upd('moeda', target)
                      const defaultRate =
                        target === 'USD' || orig === 'USD'
                          ? Number(rates?.usdRate ?? 5.4)
                          : orig === 'EUR'
                            ? Number(rates?.eurRate ?? 5.9)
                            : 1
                      upd('cotacao_moeda', defaultRate)
                      upd('data_cotacao_moeda', new Date().toISOString().split('T')[0])
                    }
                  }}
                  disabled={isEditing}
                />
                <Label
                  htmlFor="toggle-converter-moeda"
                  className="text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer select-none"
                >
                  Converter Moeda
                </Label>
              </div>

              {!converterMoeda ? (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300">
                  <span>Moeda:</span>
                  <strong className="text-slate-900 dark:text-slate-100">
                    {form.moeda_original || 'BRL'} (Original)
                  </strong>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                    Converter para:
                  </Label>
                  <Select
                    value={form.moeda}
                    onValueChange={(v) => {
                      setMoedaManualOverride(true)
                      upd('moeda', v)
                      const orig = normalizeMoedaCode(form.moeda_original)
                      if (v !== orig) {
                        const autoRate =
                          v === 'USD' || orig === 'USD'
                            ? Number(rates?.usdRate ?? 5.4)
                            : v === 'EUR' || orig === 'EUR'
                              ? Number(rates?.eurRate ?? 5.9)
                              : 1
                        upd('cotacao_moeda', autoRate)
                        if (!form.data_cotacao_moeda) {
                          upd('data_cotacao_moeda', new Date().toISOString().split('T')[0])
                        }
                      } else {
                        upd('cotacao_moeda', null)
                        upd('data_cotacao_moeda', '')
                      }
                    }}
                    disabled={isEditing}
                  >
                    <SelectTrigger
                      className="h-8 text-xs font-semibold w-[150px]"
                      disabled={isEditing}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BRL">Reais (R$)</SelectItem>
                      <SelectItem value="USD">Dólar (US$)</SelectItem>
                      <SelectItem value="EUR">Euro (€)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>

          {/* 2. Linha divisória horizontal fina atravessando toda a largura */}
          <div className="border-b border-slate-200 dark:border-slate-800 -mx-5 sm:-mx-6" />

          {/* R4 / R14: Cotação e Data da Moeda SOMENTE quando conversão ativada e houver conversão entre moedas diferentes */}
          {converterMoeda && form.moeda !== form.moeda_original && (
            <Collapsible
              defaultOpen={true}
              className="border border-slate-200 dark:border-slate-800 rounded-md bg-slate-50/70 dark:bg-slate-900/40"
            >
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className="w-full flex items-center justify-between px-3.5 py-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors group"
                >
                  <span className="flex items-center gap-2">
                    <span>
                      Taxa de Câmbio ({form.moeda_original} ➔ {form.moeda}):
                    </span>
                    <strong className="text-foreground">
                      R${' '}
                      {Number(
                        form.cotacao_moeda ??
                          (form.moeda === 'USD' || form.moeda_original === 'USD'
                            ? (rates?.usdRate ?? 5.4)
                            : (rates?.eurRate ?? 5.9)),
                      ).toFixed(2)}
                    </strong>
                    {form.data_cotacao_moeda && (
                      <span className="text-[11px] text-muted-foreground">
                        ({form.data_cotacao_moeda})
                      </span>
                    )}
                  </span>
                  <span className="flex items-center gap-1 text-[11px] text-primary group-hover:underline">
                    Ajustar cotação
                    <ChevronDown className="w-3.5 h-3.5 transition-transform duration-200 [[data-state=open]>&]:rotate-180" />
                  </span>
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="p-3.5 pt-2 border-t border-slate-200 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-medium text-foreground">Cotação (em R$) *</Label>
                    <button
                      type="button"
                      className="text-[10px] text-primary hover:underline font-medium"
                      onClick={() => {
                        const target = form.moeda === 'BRL' ? form.moeda_original : form.moeda
                        const r =
                          target === 'USD'
                            ? Number(rates?.usdRate ?? 5.4)
                            : Number(rates?.eurRate ?? 5.9)
                        if (r) {
                          upd('cotacao_moeda', r)
                          upd('data_cotacao_moeda', new Date().toISOString().split('T')[0])
                        }
                      }}
                    >
                      Usar cotação do dia (R${' '}
                      {form.moeda === 'USD' || form.moeda_original === 'USD'
                        ? Number(rates?.usdRate ?? 5.4).toFixed(2)
                        : Number(rates?.eurRate ?? 5.9).toFixed(2)}
                      )
                    </button>
                  </div>
                  <FormattedNumberInput
                    className="mt-1 bg-white dark:bg-slate-900"
                    value={
                      form.cotacao_moeda ??
                      (form.moeda === 'USD' || form.moeda_original === 'USD'
                        ? (rates?.usdRate ?? 5.4)
                        : (rates?.eurRate ?? 5.9))
                    }
                    onChange={(val) => upd('cotacao_moeda', val || null)}
                    prefix="R$"
                  />
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Valor de 1 moeda estrangeira em reais para conversão dos valores
                  </p>
                </div>

                <div>
                  <Label className="text-xs font-medium text-foreground">Data da Cotação *</Label>
                  <Input
                    type="date"
                    className="mt-1 bg-white dark:bg-slate-900 text-xs"
                    value={form.data_cotacao_moeda || new Date().toISOString().split('T')[0]}
                    onChange={(e) => upd('data_cotacao_moeda', e.target.value)}
                  />
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Data de referência da taxa cambial aplicada
                  </p>
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* 3. Card de Discriminação de Valores ocupando a largura */}
          <div className="p-4 sm:p-5 rounded-lg bg-slate-50/70 dark:bg-slate-900/40 border border-slate-200/80 dark:border-slate-800 space-y-3.5">
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-200/70 dark:border-slate-800">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                DISCRIMINAÇÃO DE VALORES
              </span>
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Moeda:{' '}
                <strong className="text-slate-700 dark:text-slate-200 font-semibold">
                  {form.moeda}
                </strong>
              </span>
            </div>

            {/* Subtotal sem desconto */}
            <div className="flex items-baseline justify-between text-xs py-1">
              <span className="text-slate-700 dark:text-slate-300 font-medium">
                {form.is_pacote ? 'Subtotal (Pacote)' : 'Subtotal / Tabela'}
              </span>
              <div className="text-right">
                <span className="font-semibold text-slate-800 dark:text-slate-200 tabular-nums">
                  {fmtCurrency(valorSemDesconto)}
                </span>
                {form.moeda !== 'BRL' &&
                  valorSemDesconto > 0 &&
                  formatBrlEquivalent(valorSemDesconto, form.moeda, rates) && (
                    <span className="block text-[10px] text-muted-foreground tabular-nums">
                      {formatBrlEquivalent(valorSemDesconto, form.moeda, rates)}
                    </span>
                  )}
              </div>
            </div>

            {/* Desconto por item (se houver diferença entre valorSemDesconto e valorAtual) */}
            {valorAtual < valorSemDesconto && (
              <div className="flex items-baseline justify-between text-xs py-1 border-t border-slate-200/70 dark:border-slate-800 text-amber-700 dark:text-amber-400">
                <span className="font-medium">Após descontos por item</span>
                <span className="font-semibold tabular-nums">{fmtCurrency(valorAtual)}</span>
              </div>
            )}

            {/* Ponto 13: Linha informativa de Serviços e Comissão Bener (Admissão Temporária / Importação Direta) — oculta quando percentual = 0% */}
            {comissaoServicosInfo &&
              Number(comissaoServicosInfo.percentual || 0) > 0 &&
              comissaoServicosInfo.valorCalculado > 0 && (
                <div className="flex items-start justify-between text-xs py-1 border-t border-slate-200/70 dark:border-slate-800 text-[#0b3c26] dark:text-emerald-400 gap-2">
                  <div className="flex flex-col">
                    <span className="font-medium leading-snug">
                      Serviços e Comissão Bener ({comissaoServicosInfo.percentual}%):
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      Base: Valor Final da Proposta ({fmtCurrency(baseCalculoComissao)})
                    </span>
                  </div>
                  <span className="font-semibold tabular-nums text-right whitespace-nowrap">
                    + {fmtCurrency(comissaoServicosInfo.valorCalculado)}
                  </span>
                </div>
              )}
          </div>

          {/* 4. FORA DO CARD, ABAIXO DELE: Valor Final da Proposta (destaque aprovado pela Bianca) */}
          <div className="pt-2 pb-1 space-y-1">
            <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
              VALOR FINAL DA PROPOSTA
            </span>

            <div
              className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-slate-100 tracking-tight tabular-nums break-words"
              aria-label={`Valor final: ${fmtCurrency(valorFinal)}`}
            >
              {fmtCurrency(valorFinal)}
            </div>

            {/* Equivalência em BRL se a moeda for estrangeira (R4 intacto) */}
            {form.moeda !== 'BRL' &&
              valorFinal > 0 &&
              formatBrlEquivalent(valorFinal, form.moeda, rates) && (
                <p className="text-xs text-slate-500 tabular-nums">
                  Equivalente: {formatBrlEquivalent(valorFinal, form.moeda, rates)}
                </p>
              )}
          </div>

          {/* 5. Preço Especial com divisória fina antes */}
          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex items-center space-x-2.5">
              <Checkbox
                id="tem-preco-especial"
                checked={form.tem_preco_especial}
                onCheckedChange={(checked) => {
                  const isChecked = checked === true
                  upd('tem_preco_especial', isChecked)
                  if (!isChecked) {
                    upd('preco_especial', null)
                  } else if (!form.preco_especial || form.preco_especial === 0) {
                    upd('preco_especial', valorFinal > 0 ? valorFinal : 0)
                  }
                }}
              />
              <Label
                htmlFor="tem-preco-especial"
                className="text-xs font-semibold text-slate-800 dark:text-slate-200 cursor-pointer select-none"
              >
                Deseja criar um preço especial para o cliente?
              </Label>
            </div>

            {form.tem_preco_especial && (
              <div className="p-4 rounded-lg border border-[#0b3c26]/20 bg-[#0b3c26]/5 dark:bg-[#0b3c26]/10 space-y-2 animate-in fade-in-50 duration-200">
                <div className="max-w-xs">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold text-[#0b3c26] dark:text-emerald-400">
                      Preço Especial ({form.moeda}) *
                    </Label>
                    {formatPrecoEspecialDiscountBadge(valorFinal, form.preco_especial) && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#0b3c26] text-white">
                        {formatPrecoEspecialDiscountBadge(valorFinal, form.preco_especial)}
                      </span>
                    )}
                  </div>
                  <FormattedNumberInput
                    className="mt-1 font-bold text-[#0b3c26] border-[#0b3c26]/30 focus-visible:ring-[#0b3c26]"
                    value={form.preco_especial || 0}
                    onChange={(v) => upd('preco_especial', v)}
                    prefix={form.moeda === 'USD' ? 'US$' : form.moeda === 'EUR' ? '€' : 'R$'}
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Na proposta gerada, o valor cheio ({fmtCurrency(valorFinal)}) será mostrado
                    cortado e este preço especial aparecerá abaixo em destaque
                    {formatPrecoEspecialDiscountBadge(valorFinal, form.preco_especial)
                      ? ` com a indicação de ${formatPrecoEspecialDiscountBadge(valorFinal, form.preco_especial)} de desconto.`
                      : '.'}
                  </p>
                  {form.moeda !== 'BRL' &&
                    (form.preco_especial || 0) > 0 &&
                    formatBrlEquivalent(form.preco_especial || 0, form.moeda, rates) && (
                      <p className="text-xs text-muted-foreground mt-0.5 tabular-nums">
                        {formatBrlEquivalent(form.preco_especial || 0, form.moeda, rates)}
                      </p>
                    )}
                </div>
              </div>
            )}
          </div>

          {/* 6. Linha de Cotações na base */}
          <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
            <PropostaExchangeTicker />
          </div>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card>
        <CardContent className="p-5 space-y-4">
          <div>
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              E-mails para notificação
            </Label>
            <div className="mt-1">
              <EmailTagInput
                emails={form.emails_notificacao}
                onChange={(emails) => upd('emails_notificacao', emails)}
                placeholder="Digite um e-mail e pressione Enter..."
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Estes e-mails receberão uma notificação quando a proposta for criada e quando o status
              mudar.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Informações comerciais (Transporte/Seguro, Validade, IPI, ICMS, Garantia,
          Assistência) vêm EXCLUSIVAMENTE do Tipo de Proposta selecionado e são
          aplicados automaticamente via onTipoPropostaChange. Use o lápis ao lado
          do campo "Tipo de Proposta" para editá-los. */}

      {/* Dynamic Accessories Section — na Proposta Pacote, os acessórios são exibidos por máquina dentro do PropostaMultiVersoes */}
      {!form.is_pacote && (
        <PropostaAcessoriosSection
          versaoId={form.versao || null}
          currency={form.moeda}
          selectedAcessorios={form.acessorios_proposta}
          onChange={(items) => upd('acessorios_proposta', items)}
          precoEspecialAtivo={!!form.tem_preco_especial}
        />
      )}

      {/* Custom Additional Fields */}
      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            <h3 className="text-sm font-semibold">Campos Adicionais</h3>
          </div>
          <p className="text-xs text-muted-foreground">
            Adicione campos personalizados conforme a necessidade da proposta (normas específicas,
            exigências do edital, etc.).
          </p>
          <CustomFieldsEditor
            fields={form.campos_adicionais}
            onChange={(fields) => upd('campos_adicionais', fields)}
          />
        </CardContent>
      </Card>

      {/* Signature and Internal Responsibility — Desenho manual no canvas ou assinatura do perfil (opcional) */}
      <ResponsavelInternoSignatureCard
        value={form.assinatura_representante}
        onChange={(sig) => upd('assinatura_representante', sig)}
        profileSignature={userProfileSignature}
        userName={userName || user?.name || user?.email}
        disabled={saving}
        title="Assinatura do Responsável Interno / Representante"
        roleLabel="Representante"
      />

      {/* Ponto 4: Assinatura do Gerente só visível se o usuário logado for gerente E for o gerente associado à proposta */}
      {canDrawGerenteSignature({
        user,
        userGerenteRecord,
        selectedGerenteId: form.gerente || resolvedGerenteLockedId || null,
        selectedRepresentanteValue: form.representante || null,
        selectedGerenteNome:
          form.nome_gerente_produto ||
          resolvedGerenteLockedNome ||
          selectedGerenteObj?.nome ||
          null,
        gerentesList: gerentes,
      }) && (
        <ResponsavelInternoSignatureCard
          value={form.assinatura_gerente_produto}
          onChange={(sig) => upd('assinatura_gerente_produto', sig)}
          profileSignature={userProfileSignature}
          userName={
            form.nome_gerente_produto ||
            resolvedGerenteLockedNome ||
            selectedGerenteObj?.nome ||
            userName ||
            user?.name
          }
          disabled={saving}
          title="Assinatura do Gerente de Produto"
          roleLabel="Gerente de Produto"
        />
      )}

      {/* Action Toolbar */}
      <div className="sticky bottom-0 z-20 bg-background/95 backdrop-blur border-t p-4 shadow-lg flex items-center justify-center sm:justify-end gap-3 rounded-b-lg">
        <Button
          type="button"
          variant="outline"
          onClick={() => setPreviewOpen(true)}
          className="gap-1.5 border-slate-300 dark:border-slate-700 font-semibold"
        >
          <Eye className="w-4 h-4 text-primary" />
          VISUALIZAR PROPOSTA
        </Button>

        <Button
          onClick={() => handleSubmit()}
          disabled={saving || (isRepUser && (hasRepError || !userRepresentante))}
          className="bg-[#0b3c26] text-white hover:bg-[#082f1e] font-bold px-6 gap-2"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
          {editProposta ? 'SALVAR NOVA VERSÃO' : 'GERAR PROPOSTA'}
        </Button>
      </div>

      {/* Modal de Pré-Visualização em Tela Cheia em Memória */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-4xl h-[92vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="px-6 py-4 border-b shrink-0 flex flex-row items-center justify-between bg-slate-50 dark:bg-slate-900">
            <DialogTitle className="text-base font-bold flex items-center gap-2 text-foreground">
              <Eye className="w-5 h-5 text-primary" />
              Pré-Visualização da Proposta (Em Memória)
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-100 dark:bg-slate-950/60">
            {(() => {
              const selectedTipo = tipos.find((t) => t.nome === form.tipo_proposta)
              const primaryVersaoId = form.is_pacote
                ? itensVersoes[0]?.versao_id || form.versao
                : form.versao
              const resolvedVersaoObj = versoes.find((v) => v.id === primaryVersaoId)

              const tempProposalVersoes = form.is_pacote
                ? itensVersoes.map((item, idx) => {
                    const itemVersao = versoes.find((v) => v.id === item.versao_id)
                    const unitVal = getItemValorUnitarioConverted(item)
                    const descVal = getItemDescontoValorConverted(item)
                    return {
                      id: `temp-${idx}`,
                      proposta_id: editProposta?.id || 'temp-preview',
                      versao_id: item.versao_id,
                      quantidade: item.quantidade,
                      valor_unitario: unitVal,
                      desconto_percentual: item.desconto_percentual ?? 0,
                      desconto_valor: descVal,
                      ordem: idx,
                      tipo_proposta: item.tipo_proposta ?? form.tipo_proposta ?? null,
                      created_at: new Date().toISOString(),
                      updated_at: new Date().toISOString(),
                      versoes: itemVersao
                        ? {
                            ...itemVersao,
                            especificacoes_tecnicas: itemVersao.especificacoes_tecnicas || null,
                            caracteristicas_construtivas:
                              itemVersao.caracteristicas_construtivas || null,
                            acessorios_standards: itemVersao.acessorios_standards || null,
                          }
                        : {
                            id: item.versao_id,
                            nome: item.nome,
                            cod_erp: null,
                            nome_abreviado: null,
                            imagem_preview: null,
                            moeda: form.moeda,
                            valor: unitVal,
                            especificacoes_tecnicas: null,
                            caracteristicas_construtivas: null,
                            acessorios_standards: null,
                            tem_estoque: true,
                            estoque_disponivel: 1,
                            modelos: null,
                          },
                    }
                  })
                : undefined

              const tempProposal: any = {
                id: editProposta?.id || 'temp-preview',
                numero_proposta: editProposta?.numero_proposta || 'PRÉVIA-TEMPORÁRIA',
                revisao: editProposta?.revisao || 'A',
                dt_cad: editProposta?.dt_cad || new Date().toISOString().split('T')[0],
                status: 'Em Analise',
                cliente: form.cliente,
                clientes: clienteCompleto || {
                  id: form.cliente,
                  fantasia: 'Cliente Selecionado',
                  razao_social: 'Cliente Selecionado',
                },
                versao: primaryVersaoId,
                versoes: resolvedVersaoObj
                  ? {
                      ...resolvedVersaoObj,
                      especificacoes_tecnicas: resolvedVersaoObj.especificacoes_tecnicas || null,
                      caracteristicas_construtivas:
                        resolvedVersaoObj.caracteristicas_construtivas || null,
                      acessorios_standards: resolvedVersaoObj.acessorios_standards || null,
                    }
                  : {
                      id: primaryVersaoId,
                      nome: itensVersoes[0]?.nome || 'Equipamento',
                      imagem_preview: null,
                      especificacoes_tecnicas: null,
                      caracteristicas_construtivas: null,
                      acessorios_standards: null,
                    },
                proposta_versoes: tempProposalVersoes,
                tipo_proposta: form.tipo_proposta,
                tipo_proposta_override: tipoPropostaOverride || null,
                tipo_proposta_detalhes: tipoPropostaOverride || selectedTipo || null,
                moeda: converterMoeda ? form.moeda || 'BRL' : form.moeda_original || 'BRL',
                moeda_original: form.moeda_original || 'BRL',
                cotacao_moeda:
                  converterMoeda && form.moeda !== form.moeda_original
                    ? form.cotacao_moeda || (form.moeda === 'USD' ? rates?.usdRate : rates?.eurRate)
                    : null,
                data_cotacao_moeda:
                  converterMoeda && form.moeda !== form.moeda_original
                    ? form.data_cotacao_moeda || new Date().toISOString().split('T')[0]
                    : null,
                valor_sem_desconto: valorSemDesconto,
                valor_atual: valorAtual,
                valor_final: valorFinal,
                percentual_desconto: 0,
                preco_especial: form.tem_preco_especial ? form.preco_especial : null,
                prazo_entrega: form.prazo_entrega || selectedTipo?.prazo_entrega || '',
                condicoes_pagamento:
                  form.condicoes_pagamento || selectedTipo?.condicoes_pagamento || '',
                validade_oferta: form.validade_oferta || selectedTipo?.validade_oferta || '30 dias',
                transporte_seguro: form.transporte_seguro || selectedTipo?.transporte_seguro || '',
                imposto_ipi:
                  form.imposto_ipi != null && String(form.imposto_ipi).trim() !== ''
                    ? form.imposto_ipi
                    : selectedTipo?.imposto_ipi != null &&
                        String(selectedTipo.imposto_ipi).trim() !== ''
                      ? selectedTipo.imposto_ipi
                      : null,
                imposto_icms:
                  form.imposto_icms != null && String(form.imposto_icms).trim() !== ''
                    ? form.imposto_icms
                    : selectedTipo?.imposto_icms != null &&
                        String(selectedTipo.imposto_icms).trim() !== ''
                      ? selectedTipo.imposto_icms
                      : null,
                garantia_acessorios: form.garantia_acessorios || selectedTipo?.garantia || '',
                assistencia_tecnica_detalhada:
                  form.assistencia_tecnica_detalhada || selectedTipo?.assistencia_tecnica || '',
                treinamento_tecnico: selectedTipo?.treinamento_tecnico || '',
                frase_preco: selectedTipo?.frase_preco || '',
                frase_comissao: selectedTipo?.frase_comissao || '',
                campos_adicionais: form.campos_adicionais || [],
                acessorios_proposta: form.acessorios_proposta || [],
                assinatura_representante: form.assinatura_representante || null,
                assinatura_gerente_produto: form.assinatura_gerente_produto || null,
                nome_representante_comercial:
                  form.nome_representante_comercial ||
                  userRepresentante?.fantasia ||
                  userName ||
                  '',
                nome_gerente_produto:
                  form.nome_gerente_produto ||
                  resolvedGerenteLockedNome ||
                  selectedGerenteObj?.nome ||
                  '',
                nome_assessor_tecnico: 'Jorge Polezi',
                is_pacote: form.is_pacote,
                dados_snapshot: {
                  valor_comissao_servicos: comissaoServicosInfo?.valorCalculado ?? null,
                  base_comissao_servicos: comissaoServicosInfo?.baseCalculo ?? null,
                  percentual_comissao_servicos: comissaoServicosInfo?.percentual ?? null,
                  comissao_servicos_aplicavel: Boolean(comissaoServicosInfo),
                  base_comissao_modo: baseComissaoModo,
                },
              }

              return <ProposalDocument proposal={tempProposal} />
            })()}
          </div>
        </DialogContent>
      </Dialog>

      {/* ============================================================
          CLIENTE FORM DIALOG — Novo Cliente
      ============================================================ */}
      <ClienteFormDialog
        open={clienteDialogOpen}
        onOpenChange={setClienteDialogOpen}
        editing={null}
        onSaved={(novoCliente) => {
          if (novoCliente?.id) {
            upd('cliente', novoCliente.id)
          }
        }}
      />

      {/* ============================================================
          INLINE EDIT SHEET — Tipo de Proposta
          Lets the user edit the currently selected tipo's commercial
          fields without leaving the Emitir Proposta screen. On save we
          re-fetch the tipos list and re-trigger onTipoPropostaChange so
          the form picks up any updated values.
      ============================================================ */}
      <Sheet
        open={tipoSheetOpen}
        onOpenChange={(open) => {
          setTipoSheetOpen(open)
          if (!open) {
            setTipoEditing(null)
            setTipoForm(null)
          }
        }}
      >
        <SheetContent
          side="right"
          className={cn(
            'flex flex-col p-0 gap-0 transition-all duration-200',
            tipoSheetFullscreen
              ? 'w-full sm:max-w-none max-w-none'
              : 'w-full sm:max-w-4xl lg:max-w-5xl xl:max-w-6xl',
          )}
        >
          <SheetHeader className="px-6 pt-5 pb-4 border-b shrink-0 text-left bg-[#0b3c26] text-white">
            <div className="flex items-center justify-between pr-8">
              <SheetTitle className="text-lg font-bold flex items-center gap-2 text-white">
                <FileText className="w-5 h-5 shrink-0" />
                <span>Editar Tipo de Proposta</span>
              </SheetTitle>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setTipoSheetFullscreen((prev) => !prev)}
                className="text-white/80 hover:text-white hover:bg-white/10 h-8 px-2.5 gap-1.5 text-xs font-medium"
                title={
                  tipoSheetFullscreen ? 'Restaurar largura padrão' : 'Expandir para tela cheia'
                }
              >
                {tipoSheetFullscreen ? (
                  <>
                    <Minimize2 className="w-4 h-4" />
                    <span className="hidden sm:inline">Restaurar</span>
                  </>
                ) : (
                  <>
                    <Maximize2 className="w-4 h-4" />
                    <span className="hidden sm:inline">Tela Cheia</span>
                  </>
                )}
              </Button>
            </div>
            <SheetDescription className="text-white/80 text-xs">
              Personalize os dados comerciais e condições deste tipo para esta proposta (as
              alterações são locais).
            </SheetDescription>
          </SheetHeader>
          {tipoEditing && tipoForm && (
            <form onSubmit={handleTipoSheetSave} className="flex flex-col flex-1 min-h-0">
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Informações Básicas */}
                <Card>
                  <CardContent className="p-5 space-y-4">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                      Informações Básicas
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="md:col-span-2">
                        <Label className="text-xs font-semibold">Nome do Tipo *</Label>
                        <Textarea
                          rows={2}
                          value={tipoForm.nome}
                          onChange={(e) => updT('nome', e.target.value)}
                          placeholder="Nome do tipo de proposta"
                          className="min-h-[56px] resize-y font-medium text-sm leading-snug"
                        />
                        <p className="text-[11px] text-muted-foreground mt-1">
                          Exibição completa sem truncamento. Redimensione a altura conforme
                          necessário.
                        </p>
                      </div>
                      <div>
                        <Label className="text-xs font-semibold">Status</Label>
                        <Select value={tipoForm.status} onValueChange={(v) => updT('status', v)}>
                          <SelectTrigger className="mt-1">
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
                        id="tipo-aplicar-fator-nac"
                        checked={tipoForm.aplicar_fator_nac}
                        onCheckedChange={(v) => updT('aplicar_fator_nac', v === true)}
                      />
                      <Label
                        htmlFor="tipo-aplicar-fator-nac"
                        className="cursor-pointer text-xs sm:text-sm"
                      >
                        Aplicar fator de Nacionalização
                      </Label>
                    </div>
                  </CardContent>
                </Card>

                {/* Comercial */}
                <Card>
                  <CardContent className="p-5 space-y-4">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                      Comercial
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <Label className="text-xs font-semibold">Comissão (%)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          value={tipoForm.comissao}
                          onChange={(e) => updT('comissao', parseFloat(e.target.value) || 0)}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-xs font-semibold">Frase do Preço</Label>
                        <Textarea
                          rows={2}
                          value={tipoForm.frase_preco}
                          onChange={(e) => updT('frase_preco', e.target.value)}
                          placeholder="Ex: MÁQUINA COLOCADA FOB NO PORTO DE ORIGEM"
                          className="mt-1 min-h-[56px] resize-y text-xs"
                        />
                      </div>
                      <div>
                        <Label className="text-xs font-semibold">Frase Comissão</Label>
                        <Textarea
                          rows={2}
                          value={tipoForm.frase_comissao}
                          onChange={(e) => updT('frase_comissao', e.target.value)}
                          placeholder="Ex: Comissão inclusa no valor"
                          className="mt-1 min-h-[56px] resize-y text-xs"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                      <div>
                        <Label className="text-xs font-semibold">Imposto IPI</Label>
                        <Textarea
                          rows={4}
                          value={tipoForm.imposto_ipi}
                          onChange={(e) => updT('imposto_ipi', e.target.value)}
                          placeholder="Alíquota ou texto explicativo de IPI com decretos..."
                          className="mt-1 min-h-[96px] resize-y whitespace-pre-wrap font-sans text-xs leading-relaxed"
                        />
                      </div>
                      <div>
                        <Label className="text-xs font-semibold">Imposto ICMS</Label>
                        <Textarea
                          rows={4}
                          value={tipoForm.imposto_icms}
                          onChange={(e) => updT('imposto_icms', e.target.value)}
                          placeholder="Alíquota ou texto explicativo de ICMS com convênios..."
                          className="mt-1 min-h-[96px] resize-y whitespace-pre-wrap font-sans text-xs leading-relaxed"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Logística e Condições */}
                <Card>
                  <CardContent className="p-5 space-y-4">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                      Logística e Condições
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-xs font-semibold">Prazo de Entrega</Label>
                        <Textarea
                          rows={3}
                          value={tipoForm.prazo_entrega}
                          onChange={(e) => updT('prazo_entrega', e.target.value)}
                          placeholder="Ex: 60 dias após confirmação e aprovação técnica"
                          className="mt-1 min-h-[72px] resize-y text-xs leading-relaxed"
                        />
                      </div>
                      <div>
                        <Label className="text-xs font-semibold">Condições de Pagamento</Label>
                        <Textarea
                          rows={3}
                          value={tipoForm.condicoes_pagamento}
                          onChange={(e) => updT('condicoes_pagamento', e.target.value)}
                          placeholder="Ex: Sinal de 20%, 30 dias após embarque e restante financiado"
                          className="mt-1 min-h-[72px] resize-y text-xs leading-relaxed"
                        />
                      </div>
                      <div>
                        <Label className="text-xs font-semibold">Validade desta Oferta</Label>
                        <Textarea
                          rows={2}
                          value={tipoForm.validade_oferta}
                          onChange={(e) => updT('validade_oferta', e.target.value)}
                          placeholder="Ex: 30 dias contados a partir da data de emissão"
                          className="mt-1 min-h-[56px] resize-y text-xs leading-relaxed"
                        />
                      </div>
                      <div>
                        <Label className="text-xs font-semibold">Transporte/Seguro</Label>
                        <Textarea
                          rows={2}
                          value={tipoForm.transporte_seguro}
                          onChange={(e) => updT('transporte_seguro', e.target.value)}
                          placeholder="Ex: Incluso até o local de entrega indicado pelo cliente"
                          className="mt-1 min-h-[56px] resize-y text-xs leading-relaxed"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Pós-Venda */}
                <Card>
                  <CardContent className="p-5 space-y-4">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                      Pós-Venda
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <Label className="text-xs font-semibold">Garantia</Label>
                        <Textarea
                          rows={3}
                          value={tipoForm.garantia}
                          onChange={(e) => updT('garantia', e.target.value)}
                          placeholder="Ex: 12 meses contra defeitos de fabricação"
                          className="mt-1 min-h-[72px] resize-y text-xs leading-relaxed"
                        />
                      </div>
                      <div>
                        <Label className="text-xs font-semibold">Assistência Técnica</Label>
                        <Textarea
                          rows={3}
                          value={tipoForm.assistencia_tecnica}
                          onChange={(e) => updT('assistencia_tecnica', e.target.value)}
                          placeholder="Ex: Prestada diretamente pela Bener com técnicos homologados"
                          className="mt-1 min-h-[72px] resize-y text-xs leading-relaxed"
                        />
                      </div>
                      <div>
                        <Label className="text-xs font-semibold">Treinamento Técnico</Label>
                        <Textarea
                          rows={3}
                          value={tipoForm.treinamento_tecnico}
                          onChange={(e) => updT('treinamento_tecnico', e.target.value)}
                          placeholder="Ex: Treinamento operacional e de programação incluso"
                          className="mt-1 min-h-[72px] resize-y text-xs leading-relaxed"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Campos Adicionais */}
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
                      fields={tipoForm.campos_adicionais}
                      onChange={(fields) => updT('campos_adicionais', fields)}
                    />
                  </CardContent>
                </Card>
              </div>

              <div className="border-t px-6 py-4 flex gap-2 justify-end shrink-0 bg-slate-50/50">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setTipoSheetOpen(false)
                    setTipoEditing(null)
                    setTipoForm(null)
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  className="bg-[#0b3c26] hover:bg-[#0b3c26]/90 text-white"
                  disabled={tipoSaving}
                >
                  {tipoSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {tipoSaving ? 'Salvando...' : 'Salvar'}
                </Button>
              </div>
            </form>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
