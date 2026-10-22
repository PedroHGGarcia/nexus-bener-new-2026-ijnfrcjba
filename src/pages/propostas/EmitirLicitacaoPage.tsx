import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { withJwtRetry } from '@/lib/supabase-retry'
import { AlertTriangle, RotateCw, Lock, AlertCircle, Info } from 'lucide-react'
import {
  Select,
  SelectGroup,
  SelectLabel,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@/components/ui/select'
import {
  FileText,
  ArrowLeft,
  Loader2,
  FileCheck2,
  Building2,
  ShieldCheck,
  Award,
  FileSpreadsheet,
} from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { insertProposta, uploadSignatureDataUrl } from '@/services/propostas'
import { buildPropostaSnapshot } from '@/lib/proposal-snapshot'
import { ResponsavelInternoSignatureCard } from '@/components/propostas/ResponsavelInternoSignatureCard'
import { sendProposalEmail } from '@/services/proposal-email'
import { fetchVersoes } from '@/services/versoes'
import { fetchTiposProposta } from '@/services/tipos-proposta'
import { useGerenteCategoryRestriction } from '@/hooks/use-gerente-restriction'
import { supabase } from '@/lib/supabase/client'
import { VersaoWithModelo } from '@/types/versao'
import { TipoProposta } from '@/types/tipo-proposta'
import { Cliente } from '@/types/cliente'
import { Representante } from '@/types/representante'
import { Gerente } from '@/types/gerente'
import { Acessorio } from '@/types/acessorio'
import { EmailTagInput } from '@/components/shared/email-tag-input'
import { FormattedNumberInput } from '@/components/shared/formatted-number-input'
import { LicitacaoCambioDashboard } from '@/components/propostas/LicitacaoCambioDashboard'
import { LicitacaoPrecosTable, PrecoItem } from '@/components/propostas/LicitacaoPrecosTable'
import { MemoriaCalculoSection } from '@/components/propostas/MemoriaCalculoSection'
import { CustomFieldsEditor, type CustomField } from '@/components/propostas/CustomFieldsEditor'
import { PropostaProjetoLinker } from '@/components/propostas/PropostaProjetoLinker'
import { useCurrencyRates } from '@/hooks/use-currency-rates'
import { formatBrlEquivalent } from '@/services/currency-rates'
import { fetchProjetos, fetchProjetosForUser, insertProjeto } from '@/services/projetos'
import { ProjetoWithRelations } from '@/types/projeto'
import { PropostaWithRelations } from '@/types/proposta'
import benerLogo from '@/assets/image-b1d86.png'
import { LicitacaoTaxConfig } from '@/components/propostas/LicitacaoTaxConfig'
import { LicitacaoMemoriaCompleta } from '@/components/propostas/LicitacaoMemoriaCompleta'
import { TaxConfig, createDefaultTaxConfig } from '@/types/licitacao-tax'
import { getIcmsRate } from '@/lib/tax-rates'
import { isRepresentanteRole, isAdminRole, isGerenteRole } from '@/components/RoleGuard'
import { findRepresentanteByProfile } from '@/services/representantes'
import { findGerenteByProfile } from '@/services/gerentes'
import { canDrawGerenteSignature } from '@/lib/gerente-signature-auth'

export default function EmitirLicitacaoPage() {
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const [saving, setSaving] = useState(false)

  const isAdmin = isAdminRole(user?.role)
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

  const [clientes, setClientes] = useState<Cliente[]>([])
  const [versoes, setVersoes] = useState<VersaoWithModelo[]>([])
  const [representantes, setRepresentantes] = useState<Representante[]>([])
  const [gerentes, setGerentes] = useState<Gerente[]>([])
  const [tipos, setTipos] = useState<TipoProposta[]>([])
  const [acessorios, setAcessorios] = useState<Acessorio[]>([])
  const [projetosList, setProjetosList] = useState<ProjetoWithRelations[]>([])
  const [projetoMode, setProjetoMode] = useState<'new' | 'existing'>('existing')
  const [novoProjetoNome, setNovoProjetoNome] = useState('')
  const [novoProjetoDescricao, setNovoProjetoDescricao] = useState('')
  const [projetoExistenteId, setProjetoExistenteId] = useState('')
  const [projetoError, setProjetoError] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [userProfileSignature, setUserProfileSignature] = useState<string | null>(null)

  const { rates } = useCurrencyRates()
  const [taxConfig, setTaxConfig] = useState<TaxConfig>(createDefaultTaxConfig())

  const today = new Date().toISOString().split('T')[0]

  const [form, setForm] = useState({
    cliente: '',
    representante: '',
    versao: '',
    tipo_proposta: '',
    gerente: '',
    dt_cad: today,
    moeda: 'USD',
    valor_sem_desconto: 0,
    percentual_desconto: 0,
    nota_rep: 0,
    prazo_entrega: '',
    condicoes_pagamento: '',
    descricao_proposta: '',
    especificacoes_tecnicas: '',
    materiais_utilizados: '',
    certificacoes: '',
    normas_aplicaveis: '',
    certificacoes_seguranca: '',
    normas_seguranca: '',
    cobertura_garantia: '',
    criterios_aceitacao: '',
    assistencia_tecnica_detalhada: '',
    garantia_acessorios: '',
    validade_oferta: '',
    transporte_seguro: '',
    emails_notificacao: [] as string[],
    secao7Items: [] as PrecoItem[],
    secoes_adicionais: [] as CustomField[],
    assinatura_representante: null as string | null,
    assinatura_gerente_produto: null as string | null,
  })

  const loadData = async () => {
    setLoadError(null)
    try {
      // Se for representante/vendedor, resolve também os estados de atuação para incluir os da sua região
      let rawEstadoAtuacao: string | null =
        (user?.estado_atuacao && user.estado_atuacao.trim()) || null
      if (isRepUser && user?.id && !rawEstadoAtuacao) {
        try {
          const rep = await findRepresentanteByProfile(user.id, user.email)
          if (rep?.estado && rep.estado.trim()) {
            rawEstadoAtuacao = rep.estado.trim()
          }
        } catch {
          // ignora falha de busca complementar
        }
      }

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

      let clientesQuery = supabase
        .from('clientes')
        .select('*')
        .eq('status', 'Ativo')
        .order('fantasia')

      if (isRepUser && user?.id) {
        if (estadosList.length > 0) {
          const estadoClauses = estadosList.map((uf) => `estado.ilike.${uf}`).join(',')
          clientesQuery = clientesQuery.or(`criado_por.eq.${user.id},${estadoClauses}`)
        } else {
          clientesQuery = clientesQuery.eq('criado_por', user.id)
        }
      }

      const catFilter =
        restriction.hasRestriction && restriction.categoriaId ? restriction.categoriaId : undefined

      const [c, v, r, g, t, ac] = await withJwtRetry(() =>
        Promise.all([
          clientesQuery,
          fetchVersoes({ activeOnly: true, categoriaId: catFilter, lightweight: true }),
          supabase.from('representantes').select('*').eq('status', 'Ativo').order('fantasia'),
          supabase.from('gerentes').select('*').eq('status', 'Ativo').order('nome'),
          fetchTiposProposta(),
          supabase.from('acessorios').select('*').eq('status', 'Ativo').order('nome'),
        ]),
      )
      setClientes((c.data ?? []) as unknown as Cliente[])
      setVersoes(v)
      setRepresentantes((r.data ?? []) as Representante[])
      setGerentes((g.data ?? []) as Gerente[])
      setTipos(t)
      setAcessorios((ac.data ?? []) as Acessorio[])
    } catch (err) {
      setLoadError(
        err instanceof Error
          ? `Não foi possível carregar os dados da página: ${err.message}`
          : 'Não foi possível carregar os dados da página. Tente novamente.',
      )
    }
  }

  useEffect(() => {
    if (!restriction.loading) {
      loadData()
    }
  }, [restriction.loading, restriction.hasRestriction, restriction.categoriaId])

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

  // Buscar representante e gerente vinculados se o usuário for representante/vendedor
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

          // Resolver gerente_id: rep.gerente_id prioritário, fallback profile.gerente_id
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
            gerente: resolvedGId || '',
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
            }))
          }
        }
      })
      .catch((err) => {
        console.error('Erro ao buscar representante vinculado:', err)
        if (isMounted) setHasRepError(true)
      })
      .finally(() => {
        if (isMounted) setLoadingUserRep(false)
      })

    return () => {
      isMounted = false
    }
  }, [isRepUser, user?.id, user?.email, user?.gerente_id, gerentes])

  useEffect(() => {
    if (!user?.id && !isAdmin) return
    const loader = isAdmin ? fetchProjetos() : fetchProjetosForUser(user!.id)
    loader.then(setProjetosList).catch(() => {})
  }, [user?.id, isAdmin])

  // Auto-fetch profile signature
  useEffect(() => {
    if (!user?.id) return
    let isMounted = true
    supabase
      .from('profiles')
      .select('assinatura')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (isMounted && data?.assinatura) {
          setUserProfileSignature(data.assinatura)
          setForm((prev) => {
            if (!prev.assinatura_representante) {
              return { ...prev, assinatura_representante: data.assinatura }
            }
            return prev
          })
        }
      })
    return () => {
      isMounted = false
    }
  }, [user?.id])

  const upd = (key: string, value: unknown) => setForm((p) => ({ ...p, [key]: value }))

  const onVersaoChange = (id: string) => {
    upd('versao', id)
    // BUG 2: Limpar imediatamente itens de acessórios ao trocar de máquina na emissão de licitação
    upd('secao7Items', [])
    const v = versoes.find((x) => x.id === id)
    if (v) {
      upd('valor_sem_desconto', v.valor)
      upd('moeda', v.moeda || 'USD')
      if (v.especificacoes_tecnicas) {
        upd('especificacoes_tecnicas', v.especificacoes_tecnicas)
      }
    }
  }

  const onTipoPropostaChange = (nome: string) => {
    upd('tipo_proposta', nome)
    const t = tipos.find((x) => x.nome === nome)
    if (t) {
      if (t.transporte_seguro) upd('transporte_seguro', t.transporte_seguro)
      if (t.validade_oferta) upd('validade_oferta', t.validade_oferta)
      if (t.prazo_entrega) upd('prazo_entrega', t.prazo_entrega)
      if (t.condicoes_pagamento) upd('condicoes_pagamento', t.condicoes_pagamento)
      if (t.garantia) upd('garantia_acessorios', t.garantia)
      if (t.assistencia_tecnica) upd('assistencia_tecnica_detalhada', t.assistencia_tecnica)
      if (t.campos_adicionais) {
        const parsed = Array.isArray(t.campos_adicionais)
          ? (t.campos_adicionais as unknown as CustomField[])
          : []
        if (parsed.length > 0) upd('secoes_adicionais', parsed)
      }
    }
  }

  // Recalculate financial totals from Section 7 items
  const itemsTotalVenda = form.secao7Items.reduce((acc, item) => {
    const baseCusto = (item.qtd || 0) * (item.custoUnitario || 0) * (item.fatorNac || 1.0)
    const desc = baseCusto * ((item.descontoPct || 0) / 100)
    const comiss = baseCusto * (((item.comissaoPct || 0) + (form.nota_rep || 0)) / 100)
    const markup = baseCusto * ((item.markupPct || 0) / 100)
    const encargos = baseCusto * ((item.encargosPct || 0) / 100)
    return acc + (baseCusto - desc + comiss + markup + encargos)
  }, 0)

  const valorFinal =
    form.secao7Items.length > 0
      ? itemsTotalVenda
      : (form.valor_sem_desconto || 0) * (1 - (form.percentual_desconto || 0) / 100)

  const fmtCurrency = (val: number) => {
    const formatted = val.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
    if (form.moeda === 'USD') return `US$ ${formatted}`
    if (form.moeda === 'EUR') return `€ ${formatted}`
    return `R$ ${formatted}`
  }

  const brlEquivalentBase = formatBrlEquivalent(form.valor_sem_desconto || 0, form.moeda, rates)
  const brlEquivalentFinal = formatBrlEquivalent(valorFinal, form.moeda, rates)

  const proceedWithSave = async () => {
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
          const el = document.getElementById('secao-associacao-projeto-licitacao')
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
          user: user?.id ?? null,
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
          const el = document.getElementById('secao-associacao-projeto-licitacao')
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
        const el = document.getElementById('secao-associacao-projeto-licitacao')
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
        setSaving(false)
        return
      }

      // Para representante/vendedor: forçar vínculo com representante e gerente resolvidos.
      // Se um Gerente foi selecionado como representante ("gerente:ID"):
      // 1. Resolve o ID do registro correspondente em 'representantes' para integridade da FK.
      // 2. Preenche nome_representante_comercial com o nome real do gerente.
      let resolvedRepId: string | null = null
      let resolvedRepNome: string | null = null

      if (isRepUser && userRepresentante) {
        resolvedRepId = userRepresentante.id
        resolvedRepNome = userRepresentante.fantasia || userRepresentante.razao_social || null
      } else if (form.representante?.startsWith('gerente:')) {
        const gId = form.representante.replace('gerente:', '')
        const g = gerentes.find((x) => x.id === gId)
        resolvedRepNome = g ? g.nome : null

        // Encontrar o representante vinculado a este gerente
        let matchingRep = representantes.find(
          (r) =>
            (g?.email && r.email && r.email.toLowerCase() === g.email.toLowerCase()) ||
            (g?.profile_id && r.profile_id === g.profile_id) ||
            (g?.nome && r.fantasia.toLowerCase() === g.nome.toLowerCase()),
        )

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
        resolvedRepNome = rObj ? rObj.fantasia || rObj.razao_social : null
      }

      const finalRepresentanteId = resolvedRepId
      const finalNomeRepresentante = resolvedRepNome

      const finalGerenteId = isRepUser
        ? resolvedGerenteLockedId || userRepresentante?.gerente_id || user?.gerente_id || null
        : form.gerente || null
      const selectedGerenteObj = gerentes.find((g) => g.id === finalGerenteId)
      const finalNomeGerente = isRepUser
        ? resolvedGerenteLockedNome || selectedGerenteObj?.nome || null
        : selectedGerenteObj
          ? selectedGerenteObj.nome
          : null

      const notificationEmailsClean = Array.from(
        new Set(
          form.emails_notificacao
            .flatMap((e) => e.split(/[,;\s\n\r]+/))
            .map((e) => e.trim().toLowerCase())
            .filter((e) => e && e.includes('@')),
        ),
      )

      // Upload/resolve signature (optional)
      const finalSigUrl = await uploadSignatureDataUrl(
        form.assinatura_representante,
        'assinatura-representante-licitacao',
      )

      // Validação estrita: somente o gerente associado à proposta pode gravar a assinatura
      const canSignGerente = canDrawGerenteSignature({
        user,
        userGerenteRecord,
        selectedGerenteId: finalGerenteId,
        selectedRepresentanteValue: form.representante || null,
        selectedGerenteNome: finalNomeGerente,
        gerentesList: gerentes,
      })

      const rawSigGerente = canSignGerente ? form.assinatura_gerente_produto : null
      const finalSigGerenteUrl = await uploadSignatureDataUrl(
        rawSigGerente,
        'assinatura-gerente-licitacao',
      )
      const nowIso = new Date().toISOString()

      // Captura o snapshot congelado da versão e dados técnicos
      const { itens_snapshot, dados_snapshot } = await buildPropostaSnapshot({
        is_pacote: false,
        versaoId: form.versao || null,
        tipo_proposta: form.tipo_proposta || null,
        userName: user?.name,
        itens: form.versao
          ? [
              {
                versao_id: form.versao,
                quantidade: 1,
                valor_unitario: form.valor_sem_desconto || 0,
                desconto_percentual: form.percentual_desconto || 0,
                desconto_valor: 0,
                ordem: 0,
                tipo_proposta: form.tipo_proposta || null,
                versoes: versoes.find((v) => v.id === form.versao),
              },
            ]
          : [],
        acessorios_proposta: (form.secao7Items as any[]) || [],
        secoes_adicionais:
          form.secoes_adicionais.length > 0
            ? (form.secoes_adicionais as unknown as Record<string, unknown>)
            : null,
        knownVersoes: versoes,
      })

      const result = await insertProposta(
        {
          cliente: form.cliente || null,
          representante: finalRepresentanteId,
          assinante_representante_id: finalRepresentanteId,
          versao: form.versao || null,
          tipo_proposta: form.tipo_proposta || null,
          gerente: finalGerenteId,
          assinante_gerente_id: finalGerenteId,
          modelo_licitacao: true,
          dt_cad: form.dt_cad,
          moeda: form.moeda,
          valor_sem_desconto: form.valor_sem_desconto,
          percentual_desconto: form.percentual_desconto,
          nota_rep: form.nota_rep,
          valor_final: valorFinal,
          valor_atual: form.valor_sem_desconto,
          prazo_entrega: form.prazo_entrega || null,
          condicoes_pagamento: form.condicoes_pagamento || null,
          descricao_proposta: form.descricao_proposta || null,
          especificacoes_tecnicas: form.especificacoes_tecnicas || null,
          materiais_utilizados: form.materiais_utilizados || null,
          certificacoes: form.certificacoes || null,
          normas_aplicaveis: form.normas_aplicaveis || null,
          certificacoes_seguranca: form.certificacoes_seguranca || null,
          normas_seguranca: form.normas_seguranca || null,
          cobertura_garantia: form.cobertura_garantia || null,
          criterios_aceitacao: form.criterios_aceitacao || null,
          assistencia_tecnica_detalhada: form.assistencia_tecnica_detalhada || null,
          garantia_acessorios: form.garantia_acessorios || null,
          validade_oferta: form.validade_oferta || null,
          transporte_seguro: form.transporte_seguro || null,
          emails_notificacao: notificationEmailsClean.join(', '),
          nome_assessor_tecnico: 'Jorge Polezi',
          nome_gerente_produto: finalNomeGerente,
          nome_representante_comercial: finalNomeRepresentante,
          acessorios_proposta: form.secao7Items as unknown as {
            id: string
            nome: string
            valor: number
            moeda?: string
            inclusao?: 'preco' | 'opcional'
            quantidade?: number
            desconto_percentual?: number
            desconto_valor?: number
          }[],
          secoes_adicionais:
            form.secoes_adicionais.length > 0
              ? (form.secoes_adicionais as unknown as Record<string, unknown>)
              : null,
          estado_faturamento: taxConfig.estadoFaturamento || null,
          regime_preco: taxConfig.regimePreco,
          cambio_estimado: taxConfig.cambioEstimado,
          cambio_estimado_data: taxConfig.cambioEstimadoData || null,
          cambio_estimado_base: taxConfig.cambioEstimadoBase || null,
          imposto_ipi: 5,
          imposto_icms: taxConfig.estadoFaturamento ? getIcmsRate(taxConfig.estadoFaturamento) : 0,
          projeto: projetoId,
          status: 'Em Analise',
          assinatura_representante: finalSigUrl,
          data_assinatura_representante: finalSigUrl ? nowIso : null,
          assinado_por_representante: finalSigUrl ? user?.id || null : null,
          assinatura_gerente_produto: finalSigGerenteUrl,
          data_assinatura_gerente: finalSigGerenteUrl ? nowIso : null,
          assinado_por_gerente: finalSigGerenteUrl ? user?.id || null : null,
          itens_snapshot,
          dados_snapshot,
        },
        user?.name,
        user?.id,
      )

      const notificationEmails = notificationEmailsClean

      // Trigger proposal email (and manager copy if applicable).
      // If notificationEmails is empty, proposal email is skipped, but manager copy will still fire if gerente is Gilberto Baksa.
      sendProposalEmail({
        propostaId: result.id,
        emails: notificationEmails,
        event: 'created',
      }).catch((e) => console.warn('n8n email trigger warning:', e))

      toast({
        title: 'Proposta de Licitação enviada com sucesso!',
        description: `Proposta ${result.numero_proposta || ''} emitida e cadastrada no sistema.`,
      })

      navigate(`/controle-propostas/proposta-pdf/${result.id}`)
    } catch (err) {
      toast({
        title: 'Erro ao emitir proposta de licitação',
        description: err instanceof Error ? err.message : '',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleSaveLicitacao = async () => {
    if (isRepUser) {
      if (hasRepError || !userRepresentante) {
        toast({
          title: 'Cadastro de representante não localizado',
          description:
            'Seu usuário possui papel de representante, mas não foi localizado um registro correspondente no sistema. Entre em contato com o suporte ou administrador.',
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
      toast({ title: 'Selecione um cliente ou órgão solicitante', variant: 'destructive' })
      return
    }
    if (!form.versao) {
      toast({ title: 'Selecione uma versão / equipamento', variant: 'destructive' })
      return
    }
    if (projetoMode === 'new' && !novoProjetoNome.trim()) {
      const msg = 'Informe o nome do novo projeto para emitir a proposta'
      setProjetoError(msg)
      toast({
        title: 'Associação de projeto obrigatória',
        description: msg,
        variant: 'destructive',
      })
      const el = document.getElementById('secao-associacao-projeto-licitacao')
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
      const el = document.getElementById('secao-associacao-projeto-licitacao')
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
      return
    }

    setProjetoError(null)

    await proceedWithSave()
  }

  if (loadError) {
    return (
      <div className="max-w-2xl mx-auto flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4">
        <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center text-destructive">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
            Erro ao carregar dados
          </h2>
          <p className="text-sm text-muted-foreground">{loadError}</p>
        </div>
        <Button onClick={loadData} className="gap-2">
          <RotateCw className="w-4 h-4" />
          Tentar novamente
        </Button>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-8">
      {/* Header Banner with Bener Brand Logo */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b pb-4 gap-4 bg-white dark:bg-slate-900 p-4 rounded-lg shadow-sm">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/controle-propostas/propostas-criadas')}
            className="gap-1.5 text-slate-600"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </Button>
          <div className="h-8 w-px bg-slate-200 dark:bg-slate-800" />
          <img src={benerLogo} alt="Bener Máquinas Logo" className="h-10 w-auto object-contain" />
          <div className="h-8 w-px bg-slate-200 dark:bg-slate-800" />
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              Emitir Proposta de Licitação
            </h1>
            <p className="text-xs text-slate-500">
              Formulário unificado para composição técnica e preços de licitação
            </p>
          </div>
        </div>
      </div>

      {/* Dados Gerais Card */}
      <Card>
        <CardContent className="p-5 space-y-4">
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 border-b pb-2 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-primary" />
            Dados Gerais da Licitação
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Cliente / Órgão Solicitante *
              </Label>
              <Select value={form.cliente || undefined} onValueChange={(v) => upd('cliente', v)}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Buscar cliente..." />
                </SelectTrigger>
                <SelectContent>
                  {clientes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.fantasia} {c.documento ? `(${c.documento})` : ''}
                      {c.maquina_interesse ? ` [Interesse: ${c.maquina_interesse}]` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  Representante Comercial *
                  {(isRepUser || authLoading) && <Lock className="w-3 h-3 text-muted-foreground" />}
                </Label>
                {isRepUser && (
                  <span className="text-[11px] text-muted-foreground">
                    Vinculado ao seu usuário
                  </span>
                )}
              </div>
              {authLoading ? (
                <div className="mt-1 h-10 px-3 flex items-center border rounded-md bg-muted/30 text-sm text-muted-foreground">
                  Carregando permissões do usuário...
                </div>
              ) : isRepUser ? (
                loadingUserRep ? (
                  <div className="mt-1 h-10 px-3 flex items-center border rounded-md bg-muted/30 text-sm text-muted-foreground">
                    Carregando representante vinculado...
                  </div>
                ) : hasRepError || !userRepresentante ? (
                  <div className="mt-1 p-3 border border-destructive/40 bg-destructive/5 rounded-md text-xs text-destructive flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold">Nenhum cadastro vinculado</p>
                      <p className="mt-0.5 text-muted-foreground">
                        Seu usuário ({user?.email}) não possui cadastro de representante comercial
                        vinculado.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="mt-1 h-10 px-3 flex items-center justify-between border rounded-md bg-muted/40 text-sm font-medium text-foreground cursor-not-allowed select-none">
                    <span className="truncate">
                      {userRepresentante.fantasia ||
                        userRepresentante.razao_social ||
                        'Representante'}
                    </span>
                    <Lock className="w-4 h-4 text-muted-foreground shrink-0 ml-2" />
                  </div>
                )
              ) : (
                <Select
                  value={form.representante || undefined}
                  onValueChange={(v) => upd('representante', v)}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecione o representante ou gerente..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-2 py-1">
                        Representantes Comerciais
                      </SelectLabel>
                      {representantes.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.fantasia}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                    {gerentes.filter((g) => g.status === 'Ativo').length > 0 && (
                      <SelectGroup>
                        <SelectLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-2 py-1 border-t mt-1 pt-1.5">
                          Gerência (como Representante)
                        </SelectLabel>
                        {gerentes
                          .filter((g) => g.status === 'Ativo')
                          .map((g) => (
                            <SelectItem key={`gerente:${g.id}`} value={`gerente:${g.id}`}>
                              {g.nome} (Gerência)
                            </SelectItem>
                          ))}
                      </SelectGroup>
                    )}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div>
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Versão do Equipamento Principal *
              </Label>
              <Select value={form.versao || undefined} onValueChange={onVersaoChange}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="-- Selecione a versão --" />
                </SelectTrigger>
                <SelectContent>
                  {versoes.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      <span>{v.nome}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Tipo de Proposta
              </Label>
              <Select value={form.tipo_proposta || undefined} onValueChange={onTipoPropostaChange}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="-- Selecione --" />
                </SelectTrigger>
                <SelectContent>
                  {tipos.map((t) => (
                    <SelectItem key={t.id} value={t.nome}>
                      {t.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  Gerente de Produto
                  {(isRepUser || authLoading) && <Lock className="w-3 h-3 text-muted-foreground" />}
                </Label>
                {isRepUser && (form.gerente || resolvedGerenteLockedId) && (
                  <span className="text-[11px] text-muted-foreground">
                    Vinculado ao seu cadastro
                  </span>
                )}
              </div>
              {authLoading ? (
                <div className="mt-1 h-10 px-3 flex items-center border rounded-md bg-muted/30 text-sm text-muted-foreground">
                  Carregando permissões do usuário...
                </div>
              ) : isRepUser ? (
                loadingUserRep ? (
                  <div className="mt-1 h-10 px-3 flex items-center border rounded-md bg-muted/30 text-sm text-muted-foreground">
                    Carregando gerente vinculado...
                  </div>
                ) : form.gerente || resolvedGerenteLockedId ? (
                  <div className="mt-1 h-10 px-3 flex items-center justify-between border rounded-md bg-muted/40 text-sm font-medium text-foreground cursor-not-allowed select-none">
                    <span className="truncate">
                      {resolvedGerenteLockedNome ||
                        gerentes.find((g) => g.id === (form.gerente || resolvedGerenteLockedId))
                          ?.nome ||
                        'Gerente vinculado'}
                    </span>
                    <Lock className="w-4 h-4 text-muted-foreground shrink-0 ml-2" />
                  </div>
                ) : (
                  <div className="mt-1 h-10 px-3 flex items-center justify-between border border-dashed rounded-md bg-muted/20 text-xs text-muted-foreground select-none">
                    <span className="truncate italic">
                      Nenhum gerente vinculado ao seu cadastro
                    </span>
                    <Info className="w-3.5 h-3.5 text-muted-foreground shrink-0 ml-2" />
                  </div>
                )
              ) : (
                <Select value={form.gerente || undefined} onValueChange={(v) => upd('gerente', v)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="-- Selecione --" />
                  </SelectTrigger>
                  <SelectContent>
                    {gerentes.map((g) => (
                      <SelectItem key={g.id} value={g.id}>
                        {g.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div>
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Data de Emissão
              </Label>
              <Input
                type="date"
                className="mt-1"
                value={form.dt_cad}
                onChange={(e) => upd('dt_cad', e.target.value)}
              />
            </div>

            <div>
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Assessor Técnico
              </Label>
              <Input
                value="Jorge Polezi"
                readOnly
                disabled
                className="mt-1 h-10 text-sm font-medium bg-muted/40 cursor-not-allowed select-none text-foreground"
              />
            </div>
          </div>

          {/* 1. Cabeçalho com marcador verde e seletor de moeda à direita */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-4 bg-[#0b3c26] rounded-full" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                Valores e Condições Comerciais
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                Moeda:
              </Label>
              <Select value={form.moeda} onValueChange={(v) => upd('moeda', v)}>
                <SelectTrigger className="h-8 text-xs font-semibold w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BRL">Reais (R$)</SelectItem>
                  <SelectItem value="USD">Dólar (US$)</SelectItem>
                  <SelectItem value="EUR">Euro (€)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* 2. Divisória horizontal fina */}
          <div className="border-b border-slate-200 dark:border-slate-800 -mx-5" />

          {/* 3. Card claro de DISCRIMINAÇÃO DE VALORES */}
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

            {/* Linha Valor Base */}
            <div className="flex items-center justify-between gap-3 text-xs py-0.5">
              <span className="text-slate-700 dark:text-slate-300 font-medium">Valor Base</span>
              <div className="w-36 shrink-0">
                <FormattedNumberInput
                  className="h-8 text-xs font-medium text-right bg-white dark:bg-slate-900"
                  value={form.valor_sem_desconto || 0}
                  onChange={(v) => upd('valor_sem_desconto', v)}
                />
                {brlEquivalentBase && (
                  <p className="mt-0.5 text-[10px] text-muted-foreground text-right tabular-nums">
                    {brlEquivalentBase}
                  </p>
                )}
              </div>
            </div>

            {/* Linha Comissão Rep (%) */}
            <div className="pt-2.5 border-t border-slate-200/70 dark:border-slate-800 flex items-center justify-between gap-3">
              <div className="flex-1">
                <Label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Comissão Rep (%)
                </Label>
                <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">
                  Os valores são recalculados automaticamente de acordo com os itens da Seção 7 e
                  encargos fiscais.
                </p>
              </div>
              <div className="w-28 shrink-0">
                <FormattedNumberInput
                  className="h-8 text-xs font-medium text-right bg-white dark:bg-slate-900"
                  value={form.nota_rep || 0}
                  onChange={(v) => upd('nota_rep', v)}
                  suffix="%"
                />
              </div>
            </div>
          </div>

          {/* 4. FORA DO CARD, ABAIXO DELE: Valor Final da Proposta */}
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

            {brlEquivalentFinal && (
              <p className="text-xs text-slate-500 tabular-nums">
                Equivalente: {brlEquivalentFinal}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Realtime Exchange Rate Ticker */}
      <LicitacaoCambioDashboard />

      {/* Tax & Exchange Configuration */}
      <LicitacaoTaxConfig config={taxConfig} onChange={setTaxConfig} moeda={form.moeda} />

      {/* Section 7 - Interactive Pricing & Items Table */}
      <Card>
        <CardContent className="p-5">
          <LicitacaoPrecosTable
            items={form.secao7Items}
            moeda={form.moeda}
            acessoriosCatalog={acessorios}
            onChange={(items) => upd('secao7Items', items)}
          />
        </CardContent>
      </Card>

      {/* Section 12 - Memória de Cálculo */}
      <Card>
        <CardContent className="p-5 space-y-4">
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 border-b pb-2 flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-primary" />
            Memória de Cálculo
          </h3>
          <MemoriaCalculoSection
            moeda={form.moeda}
            secao7Total={itemsTotalVenda}
            onSyncToSecao7={(items) => upd('secao7Items', items)}
          />
        </CardContent>
      </Card>

      {/* Complete Memory with Tax Breakdown */}
      <LicitacaoMemoriaCompleta
        items={form.secao7Items}
        moeda={form.moeda}
        taxConfig={taxConfig}
        rates={rates}
      />

      {/* Bidding Technical Details & Requirements */}
      <Card>
        <CardContent className="p-5 space-y-4">
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 border-b pb-2 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-primary" />
            Especificações Técnicas e Normas do Edital
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Normas Aplicáveis
              </Label>
              <Textarea
                className="mt-1 text-xs"
                rows={3}
                placeholder="Ex: ABNT NBR ISO 9001, NR-12, ABNT NBR 14153..."
                value={form.normas_aplicaveis}
                onChange={(e) => upd('normas_aplicaveis', e.target.value)}
              />
            </div>

            <div>
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Certificações Requeridas
              </Label>
              <Textarea
                className="mt-1 text-xs"
                rows={3}
                placeholder="Ex: Certificação CE, ISO 14001, Inmetro..."
                value={form.certificacoes}
                onChange={(e) => upd('certificacoes', e.target.value)}
              />
            </div>

            <div>
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Normas e Requisitos de Segurança
              </Label>
              <Textarea
                className="mt-1 text-xs"
                rows={3}
                placeholder="Ex: NR-10, NR-12, Botões de emergência duplo canal, Proteções físicas ativas..."
                value={form.normas_seguranca}
                onChange={(e) => upd('normas_seguranca', e.target.value)}
              />
            </div>

            <div>
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Critérios de Aceitação e Testes de Aferição
              </Label>
              <Textarea
                className="mt-1 text-xs"
                rows={3}
                placeholder="Ex: Teste de precisão geométrica DIN 8605, Aceitação de lote em fábrica..."
                value={form.criterios_aceitacao}
                onChange={(e) => upd('criterios_aceitacao', e.target.value)}
              />
            </div>

            <div>
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Cobertura da Garantia
              </Label>
              <Textarea
                className="mt-1 text-xs"
                rows={3}
                placeholder="Ex: 12 meses para componentes elétricos e mecânicos..."
                value={form.cobertura_garantia}
                onChange={(e) => upd('cobertura_garantia', e.target.value)}
              />
            </div>

            <div>
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Assistência Técnica e Suporte
              </Label>
              <Textarea
                className="mt-1 text-xs"
                rows={3}
                placeholder="Ex: Atendimento local em até 48 horas úteis, peças em estoque nacional..."
                value={form.assistencia_tecnica_detalhada}
                onChange={(e) => upd('assistencia_tecnica_detalhada', e.target.value)}
              />
            </div>
          </div>

          <div className="border-t pt-4 mt-2 space-y-3">
            <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Campos Adicionais do Edital
            </Label>
            <CustomFieldsEditor
              fields={form.secoes_adicionais}
              onChange={(fields) => upd('secoes_adicionais', fields)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Logistics & Conditions */}
      <Card>
        <CardContent className="p-5 space-y-4">
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 border-b pb-2 flex items-center gap-2">
            <Award className="w-4 h-4 text-primary" />
            Prazo e Condições Comerciais
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Prazo de Entrega
              </Label>
              <Input
                className="mt-1"
                value={form.prazo_entrega}
                onChange={(e) => upd('prazo_entrega', e.target.value)}
                placeholder="Ex: 60 dias após a emissão da Ordem de Compra"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Condições de Pagamento
              </Label>
              <Input
                className="mt-1"
                value={form.condicoes_pagamento}
                onChange={(e) => upd('condicoes_pagamento', e.target.value)}
                placeholder="Ex: Conforme edital ou 30/60/90 dias"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Validade da Oferta
              </Label>
              <Input
                className="mt-1"
                value={form.validade_oferta}
                onChange={(e) => upd('validade_oferta', e.target.value)}
                placeholder="Ex: 30 dias"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Transporte/Seguro
              </Label>
              <Input
                className="mt-1"
                value={form.transporte_seguro}
                onChange={(e) => upd('transporte_seguro', e.target.value)}
                placeholder="Ex: Incluso no valor"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Project Linking Selector */}
      <PropostaProjetoLinker
        id="secao-associacao-projeto-licitacao"
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
        error={projetoError}
      />

      {/* Notification Emails Tag Input */}
      <Card>
        <CardContent className="p-5 space-y-2">
          <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
            E-mails para notificação automática (Disparo via n8n Webhook)
          </Label>
          <EmailTagInput
            emails={form.emails_notificacao}
            onChange={(emails) => upd('emails_notificacao', emails)}
            placeholder="Digite os e-mails dos responsáveis e pressione Enter..."
          />
        </CardContent>
      </Card>

      {/* Assinatura do Responsável Interno — Comercial / Licitações (Opcional) */}
      <ResponsavelInternoSignatureCard
        value={form.assinatura_representante}
        onChange={(sig) => upd('assinatura_representante', sig)}
        profileSignature={userProfileSignature}
        userName={user?.name || user?.email}
        disabled={saving}
        title="Assinatura do Responsável Interno — Comercial / Licitações"
        roleLabel="Responsável"
      />

      {/* Ponto 4: Assinatura do Gerente de Produto (apenas visível se o usuário logado for Gerente E for o Gerente associado à proposta) */}
      {canDrawGerenteSignature({
        user,
        userGerenteRecord,
        selectedGerenteId: form.gerente || resolvedGerenteLockedId || null,
        selectedRepresentanteValue: form.representante || null,
        selectedGerenteNome:
          resolvedGerenteLockedNome ||
          gerentes.find((g) => g.id === (form.gerente || resolvedGerenteLockedId))?.nome ||
          null,
        gerentesList: gerentes,
      }) && (
        <ResponsavelInternoSignatureCard
          value={form.assinatura_gerente_produto}
          onChange={(sig) => upd('assinatura_gerente_produto', sig)}
          profileSignature={userProfileSignature}
          userName={
            resolvedGerenteLockedNome ||
            gerentes.find((g) => g.id === (form.gerente || resolvedGerenteLockedId))?.nome ||
            user?.name
          }
          disabled={saving}
          title="Assinatura do Gerente de Produto"
          roleLabel="Gerente de Produto"
        />
      )}
      {/* Inline Action Bar */}
      <div className="flex items-center justify-center sm:justify-end gap-3 pt-2">
        <Button
          variant="outline"
          onClick={() => navigate('/controle-propostas/propostas-criadas')}
          className="gap-1.5"
        >
          <FileCheck2 className="w-4 h-4" />
          Listar Propostas
        </Button>
        <Button
          onClick={handleSaveLicitacao}
          disabled={saving || (isRepUser && (hasRepError || !userRepresentante))}
          className="bg-[#0b3c26] text-white hover:bg-[#082f1e] font-bold px-6 gap-2"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <FileCheck2 className="w-4 h-4" />
          )}
          EMITIR PROPOSTA DE LICITAÇÃO
        </Button>{' '}
      </div>
    </div>
  )
}
