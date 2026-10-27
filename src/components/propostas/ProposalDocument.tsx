import { useState, useEffect, useMemo } from 'react'
import { PropostaWithRelations } from '@/types/proposta'
import { PropostaVersaoWithRelations } from '@/types/proposta-versao'
import { TipoProposta } from '@/types/tipo-proposta'
import { fetchPropostaVersoes } from '@/services/proposta-versoes'
import { snapshotToPropostaVersoes } from '@/lib/proposal-snapshot'
import type { CustomField } from '@/components/propostas/CustomFieldsEditor'
import { supabase } from '@/lib/supabase/client'
import { formatCurrencyByMoeda, formatBulletList, normalizeMoedaCode } from '@/lib/format'
import { calcComissaoServicosBener } from '@/lib/proposta-calculations'
import {
  splitIntoParagraphs,
  parseParagraphs,
  stripBoldMarkers,
  isTaxValueEmpty,
  isCommercialFieldEmpty,
} from '@/lib/paragraphs'
import { TechnicalDataDisplay } from '@/components/produtos/TechnicalDataDisplay'
import benerLogo from '@/assets/image-f448b.png'

interface Props {
  proposal: PropostaWithRelations
}

interface CompVersion {
  nome?: string
  valor?: number
  especificacoes?: string
}

function renderMultilinhaParagraphs(value: string | number | null | undefined) {
  if (value == null) return null
  const parsed = parseParagraphs(value)

  if (parsed.length === 0) return null
  if (parsed.length === 1 && !parsed[0].title) {
    return parsed[0].body
  }

  return (
    <div className="space-y-1.5">
      {parsed.map((p, idx) => (
        <div key={idx} className="leading-relaxed">
          {p.title && (
            <strong
              className="block font-bold text-[#0b3c26] text-[10.5px] uppercase tracking-wide mb-0.5"
              style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}
            >
              {p.title}
            </strong>
          )}
          {p.body && <span>{p.body}</span>}
        </div>
      ))}
    </div>
  )
}

function fmtCurrency(value: number | null | undefined, moeda: string | null | undefined): string {
  return formatCurrencyByMoeda(value || 0, moeda)
}

function SignatureBlock({
  title,
  name,
  signature,
}: {
  title: string
  name: string | null | undefined
  signature: string | null | undefined
}) {
  return (
    <div className="flex flex-col items-center">
      {signature ? (
        <img
          src={signature}
          alt={title}
          className="h-12 object-contain"
          loading="lazy"
          width={120}
          height={48}
        />
      ) : (
        <div className="h-12" />
      )}
      <div className="border-t border-black w-full pt-1 mt-1 text-center">
        <p className="font-bold text-black text-xs">{name || '—'}</p>
        <p className="text-black/70 text-[11px]">{title}</p>
      </div>
    </div>
  )
}

export function ProposalDocument({ proposal }: Props) {
  const c = proposal.clientes
  const [equipmentItems, setEquipmentItems] = useState<PropostaVersaoWithRelations[]>([])

  useEffect(() => {
    // 1. PRIORIDADE MÁXIMA: Snapshot congelado gravado na proposta
    const rawSnapshot = proposal.itens_snapshot
    if (Array.isArray(rawSnapshot) && rawSnapshot.length > 0) {
      setEquipmentItems(snapshotToPropostaVersoes(rawSnapshot))
      return
    }

    // 2. Se foram passados itens em memória (ex: preview do formulário)
    const inMemoryItems = (proposal as { proposta_versoes?: PropostaVersaoWithRelations[] })
      .proposta_versoes
    if (Array.isArray(inMemoryItems) && inMemoryItems.length > 0) {
      setEquipmentItems(inMemoryItems)
      return
    }

    // 3. Fallback para propostas antigas anteriores à implementação de snapshot:
    // busca viva da tabela proposta_versoes
    if (proposal.id) {
      fetchPropostaVersoes(proposal.id)
        .then((items) => setEquipmentItems(items || []))
        .catch(() => {})
    }
  }, [
    proposal.id,
    proposal.itens_snapshot,
    (proposal as { proposta_versoes?: PropostaVersaoWithRelations[] }).proposta_versoes,
  ])

  // Determine main machine name and preview image (priorizando snapshot congelado)
  const snapshotRoot = proposal.dados_snapshot as
    | import('@/lib/proposal-snapshot').PropostaSnapshotRoot
    | null
    | undefined
  const primaryFromSnapshot = snapshotRoot?.primary_versao
  const primaryPv = equipmentItems[0]
  const primaryVersao = primaryFromSnapshot || primaryPv?.versoes || proposal.versoes
  const machineTitle = (
    primaryVersao?.nome ||
    primaryVersao?.nome_abreviado ||
    proposal.versao_original ||
    proposal.descricao_proposta ||
    'EQUIPAMENTO INDUSTRIAL'
  ).toUpperCase()

  const machineImage = primaryVersao?.imagem_preview || proposal.versoes?.imagem_preview || null

  const comparisons = proposal.versoes_comparacao as unknown
  const hasComparison = Array.isArray(comparisons) && comparisons.length > 0
  const compItems = (Array.isArray(comparisons) ? comparisons : []) as CompVersion[]

  const [tipoProposta, setTipoProposta] = useState<TipoProposta | null>(null)

  const [tiposPropostaMap, setTiposPropostaMap] = useState<Record<string, TipoProposta>>({})

  useEffect(() => {
    // Se a proposta possui override local explícito (tipo_proposta_override), prioriza-o
    const overrideTp = (proposal.tipo_proposta_override || snapshotRoot?.tipo_proposta_override) as
      | TipoProposta
      | undefined

    // Se o snapshot congelou tipo_proposta_detalhes, usa ele
    const snapshotTp = (overrideTp || snapshotRoot?.tipo_proposta_detalhes) as
      | TipoProposta
      | undefined

    if (snapshotTp) {
      setTipoProposta(snapshotTp)
      if (snapshotTp.nome) {
        setTiposPropostaMap((prev) => ({ ...prev, [snapshotTp.nome!]: snapshotTp }))
      }
      if (proposal.tipo_proposta && proposal.tipo_proposta !== snapshotTp.nome) {
        setTiposPropostaMap((prev) => ({ ...prev, [proposal.tipo_proposta!]: snapshotTp }))
      }
    }

    // Se temos itens com tipo_proposta_detalhes congelados em itens_snapshot, popula também
    const rawSnapshot = proposal.itens_snapshot
    if (Array.isArray(rawSnapshot)) {
      const mapFromItems: Record<string, TipoProposta> = {}
      rawSnapshot.forEach((it) => {
        if (it?.tipo_proposta && it?.tipo_proposta_detalhes) {
          mapFromItems[it.tipo_proposta] = it.tipo_proposta_detalhes as TipoProposta
        }
      })
      if (Object.keys(mapFromItems).length > 0) {
        setTiposPropostaMap((prev) => ({ ...prev, ...mapFromItems }))
      }
    }

    if (!proposal.tipo_proposta) return

    // Se não veio do snapshot nem do override, faz a busca viva (fallback de compatibilidade)
    if (!snapshotTp) {
      void supabase
        .from('tipos_proposta')
        .select('*')
        .eq('nome', proposal.tipo_proposta)
        .maybeSingle()
        .then(({ data }) => {
          if (data) {
            const tp = data as unknown as TipoProposta
            setTipoProposta(tp)
            setTiposPropostaMap((prev) => (tp.nome ? { ...prev, [tp.nome]: tp } : prev))
          }
        })
    }
  }, [proposal.tipo_proposta, proposal.tipo_proposta_override, snapshotRoot])

  // No modo pacote (ou quando há itens de equipamento), busca os detalhes dos tipos faltantes
  useEffect(() => {
    const nomes = new Set<string>()
    if (proposal.tipo_proposta) nomes.add(proposal.tipo_proposta)
    equipmentItems.forEach((it) => {
      if (it.tipo_proposta) nomes.add(it.tipo_proposta)
    })
    const nomesArray = Array.from(nomes).filter((n) => Boolean(n) && !tiposPropostaMap[n])
    if (nomesArray.length === 0) return

    void supabase
      .from('tipos_proposta')
      .select('*')
      .in('nome', nomesArray)
      .then(({ data }) => {
        if (data) {
          setTiposPropostaMap((prev) => {
            const map: Record<string, TipoProposta> = { ...prev }
            data.forEach((row) => {
              if (row.nome) {
                map[row.nome] = row as unknown as TipoProposta
              }
            })
            return map
          })
        }
      })
  }, [proposal.is_pacote, proposal.tipo_proposta, equipmentItems, tiposPropostaMap])

  const rawIpiVal =
    proposal.imposto_ipi != null && String(proposal.imposto_ipi).trim() !== ''
      ? String(proposal.imposto_ipi)
      : tipoProposta?.imposto_ipi != null && String(tipoProposta.imposto_ipi).trim() !== ''
        ? String(tipoProposta.imposto_ipi)
        : null

  const rawIcmsVal =
    proposal.imposto_icms != null && String(proposal.imposto_icms).trim() !== ''
      ? String(proposal.imposto_icms)
      : tipoProposta?.imposto_icms != null && String(tipoProposta.imposto_icms).trim() !== ''
        ? String(tipoProposta.imposto_icms)
        : null

  const rawFrasePreco =
    (proposal as { frase_preco?: string | null }).frase_preco || tipoProposta?.frase_preco
  const frasePreco =
    rawFrasePreco && String(rawFrasePreco).trim() !== '' ? String(rawFrasePreco).trim() : null

  const terms: Array<[string, string | null | undefined]> = [
    ['Condições de Pagamento', proposal.condicoes_pagamento || tipoProposta?.condicoes_pagamento],
    ['Prazo de Entrega', proposal.prazo_entrega || tipoProposta?.prazo_entrega],
    ['Validade da Oferta', proposal.validade_oferta || tipoProposta?.validade_oferta],
    ['Garantia', proposal.garantia_acessorios || tipoProposta?.garantia],
    [
      'Assistência Técnica',
      proposal.assistencia_tecnica_detalhada || tipoProposta?.assistencia_tecnica,
    ],
    [
      'Treinamento Técnico',
      (proposal as { treinamento_tecnico?: string | null }).treinamento_tecnico ||
        tipoProposta?.treinamento_tecnico,
    ],
    ['Transporte / Seguro', proposal.transporte_seguro || tipoProposta?.transporte_seguro],
    ['Cobertura de Garantia', proposal.cobertura_garantia],
    ['Normas Aplicáveis', proposal.normas_aplicaveis],
    ['Normas de Segurança', proposal.normas_seguranca],
    ['Certificações', proposal.certificacoes],
    ['Certificações de Segurança', proposal.certificacoes_seguranca],
    ['Critérios de Aceitação', proposal.criterios_aceitacao],
    ['Materiais Utilizados', proposal.materiais_utilizados],
    ['Imposto IPI', isTaxValueEmpty(rawIpiVal, 'Imposto IPI') ? null : rawIpiVal],
    ['Imposto ICMS', isTaxValueEmpty(rawIcmsVal, 'Imposto ICMS') ? null : rawIcmsVal],
  ]

  if (tipoProposta?.campos_adicionais) {
    try {
      const extras =
        typeof tipoProposta.campos_adicionais === 'string'
          ? JSON.parse(tipoProposta.campos_adicionais)
          : tipoProposta.campos_adicionais
      if (Array.isArray(extras)) {
        extras.forEach(
          (extra: {
            titulo?: string
            conteudo?: string
            chave?: string
            valor?: string | number
          }) => {
            const lbl = (extra.titulo || extra.chave || '').trim()
            const val =
              extra.conteudo != null
                ? String(extra.conteudo).trim()
                : extra.valor != null
                  ? String(extra.valor).trim()
                  : ''
            if (lbl && !isCommercialFieldEmpty(val)) {
              terms.push([lbl, val])
            }
          },
        )
      } else if (extras && typeof extras === 'object') {
        Object.entries(extras as Record<string, string | number | null | undefined>).forEach(
          ([lbl, rawVal]) => {
            const cleanLbl = (lbl || '').trim()
            if (cleanLbl && !isCommercialFieldEmpty(rawVal)) {
              terms.push([cleanLbl, String(rawVal).trim()])
            }
          },
        )
      }
    } catch {
      // ignora erro de parse json
    }
  }

  const filteredTerms = terms.filter(([lbl, val]) => {
    if (lbl === 'Imposto IPI' || lbl === 'Imposto ICMS') {
      return !isTaxValueEmpty(val, lbl)
    }
    return !isCommercialFieldEmpty(val, lbl)
  }) as Array<[string, string | null | undefined]>

  // Client header pieces
  const clientCompanyName = c?.razao_social || c?.fantasia || proposal.cliente_original || 'Cliente'

  // Regra nova: "a sigla deverá ser o primeiro nome do representante que está criando a proposta".
  // Deriva o primeiro nome normalizado (Primeira letra maiúscula, restante minúsculo).
  // Prioriza o representante vinculado (fantasia), com fallback para nome_representante_comercial,
  // representante_original ou o usuário criador (proposal.user). Se vazio, exibe "—".
  const rawRepNome =
    proposal.representantes?.fantasia ||
    proposal.nome_representante_comercial ||
    proposal.representante_original ||
    proposal.user ||
    ''
  const firstWord = rawRepNome.trim().split(/\s+/)[0] || ''
  const repPrimeiroNome = firstWord
    ? firstWord.charAt(0).toUpperCase() + firstWord.slice(1).toLowerCase()
    : '—'
  const numeroBase = (proposal.numero_proposta || '').trim()
  const numeroOferta = numeroBase || '—'
  const dataEmissao = proposal.dt_cad ? new Date(`${proposal.dt_cad}T12:00:00`) : new Date()
  const mesOferta = String(dataEmissao.getMonth() + 1).padStart(2, '0')
  const anoOferta = String(dataEmissao.getFullYear())
  const dataPorExtenso = dataEmissao.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
  const dataPorExtensoCap = dataPorExtenso.charAt(0).toUpperCase() + dataPorExtenso.slice(1)
  const siglaBox = (
    <div className="border border-black text-[9px] leading-tight text-black shrink-0 break-inside-avoid min-w-[280px] max-w-[340px] w-auto">
      <div className="grid grid-cols-[auto_1fr_auto_auto] divide-x divide-black items-stretch">
        <div className="px-1.5 py-0.5 text-center min-w-[50px]">
          <p className="font-bold">Sigla</p>
          <p className="whitespace-nowrap">{repPrimeiroNome}</p>
        </div>
        <div className="px-1.5 py-0.5 text-center min-w-[110px] flex flex-col justify-center">
          <p className="font-bold">N° Oferta</p>
          <p className="break-all font-semibold leading-tight text-[8px] sm:text-[8.5px]">
            {numeroOferta}
          </p>
        </div>
        <div className="px-1.5 py-0.5 text-center min-w-[36px]">
          <p className="font-bold">Mês</p>
          <p className="whitespace-nowrap">{mesOferta}</p>
        </div>
        <div className="px-1.5 py-0.5 text-center min-w-[42px]">
          <p className="font-bold">Ano</p>
          <p className="whitespace-nowrap">{anoOferta}</p>
        </div>
      </div>
    </div>
  )
  const headerInstitucional = (
    <div className="flex justify-between items-start gap-4">
      <div className="flex items-center gap-2">
        <img
          src={benerLogo}
          alt="BENER - MÁQUINAS QUE TRANSFORMAM"
          className="h-12 w-auto object-contain max-w-[240px]"
          loading="eager"
        />
      </div>
      <div className="text-right text-[10px] sm:text-[11px] leading-tight text-black shrink-0">
        <p className="font-bold text-[12px] sm:text-[13px]">
          Bener Comercial Importadora Exportadora Ltda.
        </p>
        <p className="mt-1">Vinhedo, {dataPorExtensoCap}</p>
      </div>
    </div>
  )
  const clientStreet = [c?.logradouro, c?.numero].filter(Boolean).join(', ')
  const clientAddressLine = [
    clientStreet,
    c?.complementos,
    c?.bairro,
    c?.cidade ? `${c.cidade}${c.estado ? ` - ${c.estado}` : ''}` : c?.estado,
  ]
    .filter(Boolean)
    .join(' - ')
  const clientPhone = c?.telefone || proposal.telefone || ''
  const clientEmail = c?.email || ''
  const contactName = c?.contato || proposal.contato || ''

  // Calculation of original vs discounted values for Point 1
  const rawValorSemDesc =
    proposal.valor_sem_desconto != null && Number(proposal.valor_sem_desconto) > 0
      ? Number(proposal.valor_sem_desconto)
      : Number(proposal.valor_final || 0)
  const rawValorFinal = Number(proposal.valor_final || 0)
  const rawPrecoEspecial =
    proposal.preco_especial != null && Number(proposal.preco_especial) > 0
      ? Number(proposal.preco_especial)
      : null
  const percentualDesc = Number(proposal.percentual_desconto || 0)

  // Has discount if percentual_desconto > 0 OR preco_especial is set and > 0 OR valor_sem_desconto > valor_final
  const hasItemDiscount =
    percentualDesc > 0 ||
    (rawPrecoEspecial != null && rawPrecoEspecial > 0) ||
    rawValorSemDesc > rawValorFinal
  const valorOriginalTabela =
    rawValorSemDesc > 0
      ? rawValorSemDesc
      : rawValorFinal > 0
        ? rawValorFinal
        : rawPrecoEspecial || 0
  const valorEfetivoFinal =
    rawPrecoEspecial != null && rawPrecoEspecial > 0 ? rawPrecoEspecial : rawValorFinal
  const valorUnitarioEfetivo = rawValorFinal > 0 ? rawValorFinal : valorEfetivoFinal

  // Calculate effective discount percent for the Desc. % column
  const effectiveDiscountPercent =
    percentualDesc > 0
      ? percentualDesc
      : rawPrecoEspecial != null &&
          rawPrecoEspecial > 0 &&
          valorOriginalTabela > 0 &&
          rawPrecoEspecial < valorOriginalTabela
        ? Math.round(((valorOriginalTabela - rawPrecoEspecial) / valorOriginalTabela) * 100 * 10) /
          10
        : 0

  // Ponto 13: Cálculo de Serviços e Comissão Bener (Admissão Temporária / Importação Direta)
  const overrideTp = (proposal.tipo_proposta_override || snapshotRoot?.tipo_proposta_override) as
    | TipoProposta
    | undefined
  const currentTipoNome = overrideTp?.nome || proposal.tipo_proposta || tipoProposta?.nome || null
  const currentTipoComissao =
    overrideTp?.comissao != null
      ? Number(overrideTp.comissao)
      : tipoProposta?.comissao != null
        ? Number(tipoProposta.comissao)
        : 0

  // Base de cálculo da comissão:
  // REGRA NOVA: comissão calculada SEMPRE sobre o VALOR FINAL da proposta (com preço especial aplicado).
  const proposalAny = proposal as any
  const baseCalculoItens = useMemo(() => {
    // 1. Se houver base persistida válida no snapshot/proposta, respeita
    const basePersistida = Number(
      proposalAny.base_comissao_servicos || snapshotRoot?.base_comissao_servicos || 0,
    )
    if (basePersistida > 0) {
      return basePersistida
    }

    // 2. Preço especial ou valor final da proposta
    const precoEspecialVal =
      proposal.preco_especial != null && Number(proposal.preco_especial) > 0
        ? Number(proposal.preco_especial)
        : null
    if (precoEspecialVal != null && precoEspecialVal > 0) {
      return precoEspecialVal
    }

    const valorFinalNum = Number(proposal.valor_final ?? proposal.valor_atual ?? 0)
    if (valorFinalNum > 0) {
      return valorFinalNum
    }

    // 3. Fallback: soma dos itens com desconto
    let total = 0
    if (proposal.is_pacote && equipmentItems.length > 0) {
      equipmentItems.forEach((item) => {
        const qtd = item.quantidade || 1
        const valUnit = Number(item.valor_unitario || 0)
        const descPct = Number(item.desconto_percentual || 0)
        const descVal = Number(item.desconto_valor || 0)
        const subtotal = qtd * valUnit
        const totalItem =
          descVal > 0 ? Math.max(0, subtotal - descVal) : subtotal * (1 - descPct / 100)
        total += totalItem
      })
    } else {
      total = valorEfetivoFinal
    }

    // Soma opcionais inclusos
    if (Array.isArray(proposal.acessorios_proposta)) {
      type AccItem = {
        valor?: number
        inclusao?: string
        quantidade?: number
        desconto_percentual?: number
        desconto_valor?: number
      }
      const rawAcc = proposal.acessorios_proposta as AccItem[]
      rawAcc.forEach((a) => {
        const isInc = a.inclusao === 'incluir' || a.inclusao === 'preco' || a.inclusao === undefined
        if (isInc && a.valor != null && Number(a.valor) > 0) {
          const q = a.quantidade || 1
          const sub = q * Number(a.valor)
          const dPct = Number(a.desconto_percentual || 0)
          const dVal = Number(a.desconto_valor || 0)
          const tot = dVal > 0 ? Math.max(0, sub - dVal) : sub * (1 - dPct / 100)
          total += tot
        }
      })
    }

    return Math.round(total * 100) / 100
  }, [
    proposalAny.base_comissao_servicos,
    snapshotRoot?.base_comissao_servicos,
    proposal.preco_especial,
    proposal.valor_final,
    proposal.valor_atual,
    proposal.is_pacote,
    equipmentItems,
    valorEfetivoFinal,
    proposal.acessorios_proposta,
  ])

  const comissaoServicosInfo = useMemo(() => {
    // 3 níveis: persistido direto na proposta > snapshot > cálculo via calcComissaoServicosBener
    const valPersistido = Number(
      proposalAny.valor_comissao_servicos ?? snapshotRoot?.valor_comissao_servicos ?? 0,
    )
    const pctPersistido = Number(
      proposalAny.percentual_comissao_servicos ??
        snapshotRoot?.percentual_comissao_servicos ??
        currentTipoComissao,
    )

    if (valPersistido > 0) {
      return {
        isApplicable: true,
        percentual: pctPersistido,
        baseCalculo: baseCalculoItens,
        valorCalculado: valPersistido,
        textoDescritivo:
          'Pagamento Brasil: Serviços e Comissão Bener. Itens considerados p/ base de cálculo: Máquina; Opcionais Inclusos e Impostos sobre serviços Bener',
      }
    }

    return calcComissaoServicosBener({
      tipoNome: currentTipoNome,
      comissaoPct: currentTipoComissao,
      baseValor: baseCalculoItens,
    })
  }, [
    proposalAny.valor_comissao_servicos,
    proposalAny.percentual_comissao_servicos,
    snapshotRoot?.valor_comissao_servicos,
    snapshotRoot?.percentual_comissao_servicos,
    currentTipoNome,
    currentTipoComissao,
    baseCalculoItens,
  ])

  const valorComissaoCalculada = comissaoServicosInfo?.valorCalculado || 0

  // Se a proposta já persistiu o valor_final com a comissão (criada via form novo),
  // ou se é uma proposta antiga onde precisamos somar, garantimos que o total
  // exibido contenha a comissão caso o valor_final armazenado não reflita isso.
  // Regra do Ponto 13: O VALOR TOTAL DO FORNECIMENTO reflete a soma (valor anterior + comissão calculada).
  const valorTotalFornecimentoExibido = useMemo(() => {
    const rawFinal = Number(proposal.valor_final || 0)
    // Se a proposta não tem comissão aplicável, usa o valor_final gravado
    if (!comissaoServicosInfo || valorComissaoCalculada <= 0) {
      return rawFinal
    }
    // Se o valor_final armazenado for igual ou muito próximo da base antes da comissão,
    // soma a comissão; se já incluir (ex: valor_final >= base + comissao - 0.05), mantém rawFinal.
    if (Math.abs(rawFinal - baseCalculoItens) < 0.05) {
      return rawFinal + valorComissaoCalculada
    }
    return rawFinal
  }, [proposal.valor_final, comissaoServicosInfo, valorComissaoCalculada, baseCalculoItens])

  const hasTiposPropostaDetails =
    proposal.tipo_proposta ||
    equipmentItems.some((it) => it.tipo_proposta) ||
    Object.keys(tiposPropostaMap).length > 0 ||
    Boolean(comissaoServicosInfo)

  const showAdditionalPages =
    primaryVersao?.especificacoes_tecnicas ||
    proposal.especificacoes_tecnicas ||
    proposal.descricao_proposta ||
    primaryVersao?.caracteristicas_construtivas ||
    primaryVersao?.acessorios_standards ||
    (proposal.acessorios_proposta &&
      Array.isArray(proposal.acessorios_proposta) &&
      proposal.acessorios_proposta.length > 0) ||
    proposal.is_pacote ||
    equipmentItems.length > 0 ||
    filteredTerms.length > 0 ||
    proposal.valor_final != null ||
    hasComparison ||
    hasTiposPropostaDetails

  return (
    <div
      className="proposal-document bg-white text-black mx-auto print:min-h-0 print:h-auto print:w-full"
      style={{
        width: '210mm',
        maxWidth: '100%',
        fontFamily: "'Courier New', Courier, monospace, 'Lucida Console'",
        page: 'proposta',
      }}
    >
      {/* ================= PAGE 1: COVER / RECEPTION ================= */}
      <div
        data-sheet-index="0"
        data-page="1"
        className="proposal-page proposal-sheet proposal-cover relative flex flex-col justify-between p-10 sm:p-12 print:p-0 bg-white min-h-[297mm] print:min-h-0 print:h-auto print:border-none"
        style={{ boxSizing: 'border-box', breakBefore: 'avoid', pageBreakBefore: 'avoid' }}
      >
        {/* Top & Main Body */}
        <div>
          {/* Header + Client + Reception wrapped to avoid breaking apart */}
          <div className="break-inside-avoid">
            {/* Section 0: Top Header — old-system style: logo + razão social + data + Sigla/N° Oferta/Mês/Ano */}
            <div className="border-b border-black pb-4 mb-6">
              {headerInstitucional}
              <div className="flex justify-end mt-3">{siglaBox}</div>
            </div>

            {/* Section 1: Client Header (Top Left) */}
            <div className="text-left text-xs sm:text-[13px] leading-relaxed tracking-tight text-black space-y-0.5">
              <p className="font-normal">À</p>
              <p className="font-bold text-sm sm:text-[14px]">{clientCompanyName}</p>
              {clientAddressLine && <p className="font-normal">{clientAddressLine}</p>}
              {clientPhone && <p className="font-normal">Telefone: {clientPhone}</p>}
              {clientEmail && <p className="font-normal">E-mail: {clientEmail}</p>}

              {contactName ? (
                <p className="font-normal pt-2">
                  A/C: <span className="font-bold">{contactName}</span>
                </p>
              ) : (
                <p className="font-normal pt-2">A/C: Diretor / Gerente de Compras</p>
              )}
            </div>

            {/* Section 2: Reception Text */}
            <div className="mt-6 sm:mt-8 text-xs sm:text-[13px] leading-relaxed text-black space-y-2 text-justify">
              <p className="font-normal">Prezados Senhores,</p>
              <p className="font-normal indent-0">
                Atendendo a sua prezada consulta, temos o prazer de submeter a vossa devida
                apreciação nossa proposta acima citada, para o fornecimento de:
              </p>
            </div>
          </div>

          {/* Modo Pacote: Header com TODAS as máquinas lado a lado (ou em blocos) com foto, título e tipo */}
          {proposal.is_pacote && equipmentItems.length > 0 ? (
            <div className="my-6">
              {/* Se couber lado a lado (2 a 3 máquinas), exibe em grid lado a lado; para 4+ usa grid de 2 ou 3 colunas */}
              <div
                className={`grid gap-4 items-stretch ${
                  equipmentItems.length === 2
                    ? 'grid-cols-2'
                    : equipmentItems.length === 3
                      ? 'grid-cols-3'
                      : 'grid-cols-2 sm:grid-cols-3'
                }`}
              >
                {equipmentItems.map((item, idx) => {
                  const itemVersao = item.versoes
                  const itemNome = (
                    itemVersao?.nome ||
                    itemVersao?.nome_abreviado ||
                    `Equipamento ${idx + 1}`
                  ).toUpperCase()
                  const itemImg = itemVersao?.imagem_preview || null
                  const itemTipoNome =
                    item.tipo_proposta || (idx === 0 ? proposal.tipo_proposta : null)

                  return (
                    <div
                      key={item.id || idx}
                      className="border border-slate-300 rounded p-3 bg-white flex flex-col justify-between items-center text-center break-inside-avoid shadow-xs"
                    >
                      {/* Título da máquina */}
                      <div className="w-full mb-2">
                        <div className="flex items-center justify-center gap-1.5 mb-1">
                          <span className="w-1 h-3.5 bg-[#0b3c26] rounded-xs shrink-0" />
                          <h2 className="text-[11px] sm:text-xs font-bold text-black tracking-wide uppercase leading-tight line-clamp-2">
                            {idx + 1}. {itemNome}
                          </h2>
                        </div>
                        {itemTipoNome && (
                          <div className="inline-block mt-0.5 bg-slate-100 border border-slate-300 px-1.5 py-0.5 rounded text-[9.5px] font-semibold text-slate-800">
                            Tipo: {itemTipoNome}
                          </div>
                        )}
                      </div>

                      {/* Foto da máquina */}
                      <div className="w-full h-36 sm:h-44 flex items-center justify-center bg-slate-50 border border-slate-200 rounded p-1 overflow-hidden my-1">
                        {itemImg ? (
                          <img
                            src={itemImg}
                            alt={itemNome}
                            className="max-h-full max-w-full object-contain"
                            loading="eager"
                          />
                        ) : (
                          <div className="text-[10px] text-slate-400 italic px-2">
                            Foto indisponível
                          </div>
                        )}
                      </div>

                      {/* Quantidade / Indicador */}
                      <div className="text-[10px] text-slate-600 mt-1 font-medium">
                        Qtd: <strong className="text-slate-900">{item.quantidade}</strong>
                      </div>
                    </div>
                  )
                })}
              </div>
              <p className="text-[10px] sm:text-[11px] text-black/70 italic text-center mt-3">
                Imagens meramente ilustrativas • Fornecimento em pacote com {equipmentItems.length}{' '}
                máquinas
              </p>
            </div>
          ) : (
            /* Modo Normal (máquina única): Título e Foto grandes centralizados */
            <>
              {/* Section 3: Machine Title (Bold, Uppercase, Centered) */}
              <div className="my-8 sm:my-10 text-center px-4">
                <h1 className="text-sm sm:text-base md:text-[15px] font-bold text-black tracking-wide uppercase leading-snug">
                  {machineTitle}
                </h1>
              </div>

              {/* Section 4: Machine Image (Large centered image with small caption below) */}
              <div className="flex flex-col items-center justify-center my-6">
                {machineImage ? (
                  <div className="w-full max-w-md max-h-[380px] flex items-center justify-center">
                    <img
                      src={machineImage}
                      alt={machineTitle}
                      className="max-h-[340px] w-auto max-w-full object-contain"
                      loading="eager"
                    />
                  </div>
                ) : (
                  <div className="w-72 h-72 border border-dashed border-gray-300 rounded flex items-center justify-center text-xs text-gray-400">
                    Foto do equipamento indisponível no catálogo
                  </div>
                )}
                <p className="text-[10px] sm:text-[11px] text-black/70 italic text-center mt-3">
                  Imagem meramente ilustrativa
                </p>
              </div>
            </>
          )}
        </div>

        {/* Section 5: Institutional Footer (Fixed at the bottom of the page) */}
        <div className="pt-4 border-t border-black text-center text-[10px] sm:text-[11px] leading-tight text-black mt-auto">
          <p className="font-normal">
            Rua Iracema Lucas, 450 (Antiga Rua Parsch) - Distrito Industrial
          </p>
          <p className="font-normal">
            Vinhedo - SP - Brasil - CEP: 13280-172 - Fone / Fax: (0**19) 3826-7373
          </p>
          <p className="font-normal">E-mail: vendas@bener.com.br - Site: www.bener.com.br</p>
        </div>
      </div>

      {/* ================= PAGE 2+: TECHNICAL & COMMERCIAL DETAILS ================= */}
      {showAdditionalPages && (
        <div
          data-sheet-index="1"
          data-page="2"
          className="proposal-page proposal-sheet relative flex flex-col justify-between p-10 sm:p-12 print:p-0 bg-white min-h-[297mm] print:min-h-0 print:h-auto border-t-2 border-dashed border-slate-300 print:border-none"
          style={{ boxSizing: 'border-box', breakBefore: 'page', pageBreakBefore: 'always' }}
        >
          <div>
            {/* Modo Pacote: Bloco estruturado por Máquina com Foto, Título e Acessórios vinculados */}
            {proposal.is_pacote && equipmentItems.length > 0 ? (
              <section className="proposal-section mb-5 text-xs">
                <div className="flex items-center gap-2 mb-3 pb-1.5 border-b-2 border-slate-800 break-after-avoid">
                  <span className="w-1.5 h-4 bg-[#0b3c26] rounded-xs" />
                  <h2 className="font-bold uppercase tracking-wider text-slate-900 text-[12px] sm:text-xs">
                    Equipamentos e Acessórios do Pacote
                  </h2>
                  <span className="text-[10px] text-slate-600 font-medium ml-auto">
                    {equipmentItems.length} {equipmentItems.length === 1 ? 'máquina' : 'máquinas'}
                  </span>
                </div>

                <div className="space-y-4">
                  {equipmentItems.map((item, idx) => {
                    const itemVersao = item.versoes
                    const itemNome = (
                      itemVersao?.nome ||
                      itemVersao?.nome_abreviado ||
                      `Equipamento ${idx + 1}`
                    ).toUpperCase()
                    const itemImagem = itemVersao?.imagem_preview || null
                    const itemMoeda = normalizeMoedaCode(
                      itemVersao?.moeda || proposal.moeda || 'BRL',
                    )
                    const tipoDesc =
                      item.tipo_proposta || (idx === 0 ? proposal.tipo_proposta : null)
                    const itemSpecs =
                      itemVersao?.especificacoes_tecnicas ||
                      (idx === 0
                        ? proposal.descricao_proposta || proposal.especificacoes_tecnicas
                        : null)
                    const itemCaract = itemVersao?.caracteristicas_construtivas
                    const itemAcessStandards = itemVersao?.acessorios_standards

                    // Acessórios selecionados vinculados especificamente a esta máquina pelo versao_id
                    type AccItem = {
                      id?: string
                      nome?: string
                      valor?: number
                      moeda?: string
                      inclusao?: string
                      quantidade?: number
                      desconto_percentual?: number
                      desconto_valor?: number
                      versao_id?: string
                    }
                    const rawAcc = Array.isArray(proposal.acessorios_proposta)
                      ? (proposal.acessorios_proposta as AccItem[])
                      : []
                    const itemAcc = rawAcc.filter(
                      (a) => a.versao_id === item.versao_id && a.inclusao !== 'nao_exibir',
                    )
                    const accInclusos = itemAcc.filter(
                      (a) =>
                        a.inclusao === 'incluir' ||
                        a.inclusao === 'preco' ||
                        a.inclusao === undefined,
                    )
                    const accNaoInclusos = itemAcc.filter(
                      (a) => a.inclusao === 'opcional' || a.inclusao === 'exibir',
                    )

                    return (
                      <div
                        key={item.id || idx}
                        className="border border-slate-300 rounded p-3 bg-white shadow-xs break-inside-avoid"
                      >
                        {/* Cabeçalho da máquina com foto discreta + título institucional + badges */}
                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 pb-2.5 border-b border-slate-200">
                          {/* 1. FOTO DA MÁQUINA */}
                          <div className="shrink-0 w-24 h-20 sm:w-28 sm:h-24 bg-slate-50 border border-slate-200 rounded flex items-center justify-center overflow-hidden p-1">
                            {itemImagem ? (
                              <img
                                src={itemImagem}
                                alt={itemNome}
                                className="w-full h-full object-contain"
                                loading="lazy"
                              />
                            ) : (
                              <div className="text-[9px] text-slate-400 text-center px-1 leading-tight italic">
                                Foto indisponível
                              </div>
                            )}
                          </div>

                          {/* 2. TÍTULO / NOME DA MÁQUINA E INFORMAÇÕES */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="w-1 h-3.5 bg-[#0b3c26] rounded-xs shrink-0" />
                              <h3 className="font-bold uppercase tracking-wider text-[#0b3c26] text-[12px] sm:text-[13px] leading-snug">
                                {idx + 1}. {itemNome}
                              </h3>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-600 mt-1">
                              {tipoDesc && (
                                <span className="bg-slate-100 border border-slate-300 px-1.5 py-0.5 rounded font-semibold text-slate-800">
                                  Tipo: {tipoDesc}
                                </span>
                              )}
                              <span className="font-medium">
                                Quantidade:{' '}
                                <strong className="text-slate-900">{item.quantidade}</strong>
                              </span>
                              <span>•</span>
                              <span className="font-medium">
                                Unitário:{' '}
                                <strong className="text-slate-900">
                                  {formatCurrencyByMoeda(item.valor_unitario, itemMoeda)}
                                </strong>
                              </span>
                              {Boolean(item.desconto_percentual) && (
                                <>
                                  <span>•</span>
                                  <span className="font-semibold text-emerald-800">
                                    Desc: {item.desconto_percentual}%
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Detalhes Técnicos / Construtivos / Standard da Máquina (se preenchidos) */}
                        {itemAcessStandards && (
                          <div className="mt-2.5 pt-2 border-t border-slate-100">
                            <div className="flex items-center gap-1.5 mb-1 pb-0.5 border-b border-emerald-900/20">
                              <span className="w-0.5 h-3 bg-[#0b3c26] rounded-xs" />
                              <span className="font-bold text-[#0b3c26] uppercase tracking-wide text-[10px]">
                                Configuração Standard
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-700 pl-2.5">
                              <TechnicalDataDisplay content={itemAcessStandards} compact />
                            </div>
                          </div>
                        )}

                        {itemCaract && (
                          <div className="mt-2.5 pt-2 border-t border-slate-100">
                            <div className="flex items-center gap-1.5 mb-1 pb-0.5 border-b border-emerald-900/20">
                              <span className="w-0.5 h-3 bg-[#0b3c26] rounded-xs" />
                              <span className="font-bold text-[#0b3c26] uppercase tracking-wide text-[10px]">
                                Características Construtivas
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-700 pl-2.5">
                              <TechnicalDataDisplay content={itemCaract} compact />
                            </div>
                          </div>
                        )}

                        {itemSpecs && (
                          <div className="mt-2.5 pt-2 border-t border-slate-100">
                            <div className="flex items-center gap-1.5 mb-1 pb-0.5 border-b border-emerald-900/20">
                              <span className="w-0.5 h-3 bg-[#0b3c26] rounded-xs" />
                              <span className="font-bold text-[#0b3c26] uppercase tracking-wide text-[10px]">
                                Especificações Técnicas
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-700 pl-2.5">
                              <TechnicalDataDisplay content={itemSpecs} compact />
                            </div>
                          </div>
                        )}

                        {/* 3. ACESSÓRIOS SELECIONADOS DESTA MÁQUINA (Inclusos e Não Inclusos separados) */}
                        {(accInclusos.length > 0 || accNaoInclusos.length > 0) && (
                          <div className="mt-3 pt-2.5 border-t border-dashed border-slate-300 space-y-2.5">
                            {/* Acessórios Opcionais Inclusos no Preço daquela máquina */}
                            {accInclusos.length > 0 && (
                              <div>
                                <div className="flex items-center gap-1.5 mb-1 pb-0.5 border-b border-emerald-900/20">
                                  <span className="w-0.5 h-3 bg-[#0b3c26] rounded-xs" />
                                  <h4 className="font-bold uppercase tracking-wider text-[#0b3c26] text-[10px]">
                                    Acessórios Opcionais Inclusos no Preço
                                  </h4>
                                </div>
                                <ul className="leading-relaxed text-[10.5px] text-slate-800 pl-2.5 space-y-0.5">
                                  {accInclusos.map((a, accIdx) => (
                                    <li key={a.id || accIdx} className="flex items-start gap-1.5">
                                      <span className="text-[#0b3c26] select-none font-bold">
                                        •
                                      </span>
                                      <span>
                                        {a.quantidade ? `${a.quantidade}x ` : ''}
                                        {a.nome || '—'}
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {/* Acessórios Opcionais Não Inclusos no Preço daquela máquina */}
                            {accNaoInclusos.length > 0 && (
                              <div>
                                <div className="flex items-center gap-1.5 mb-1 pb-0.5 border-b border-emerald-900/20">
                                  <span className="w-0.5 h-3 bg-[#0b3c26] rounded-xs" />
                                  <h4 className="font-bold uppercase tracking-wider text-[#0b3c26] text-[10px]">
                                    Acessórios Opcionais Não Inclusos no Preço
                                  </h4>
                                </div>
                                <ul className="leading-relaxed text-[10.5px] text-slate-800 pl-2.5 space-y-0.5">
                                  {accNaoInclusos.map((a, accIdx) => {
                                    const accMoeda = a.moeda || itemMoeda
                                    const precoFormatted =
                                      a.valor != null
                                        ? formatCurrencyByMoeda(a.valor, accMoeda)
                                        : null
                                    return (
                                      <li
                                        key={a.id || accIdx}
                                        className="flex items-start justify-between gap-2"
                                      >
                                        <div className="flex items-start gap-1.5">
                                          <span className="text-[#0b3c26] select-none font-bold">
                                            •
                                          </span>
                                          <span>
                                            {a.quantidade ? `${a.quantidade}x ` : ''}
                                            {a.nome || '—'}
                                          </span>
                                        </div>
                                        {precoFormatted && (
                                          <span className="font-semibold text-slate-900 shrink-0">
                                            {precoFormatted}
                                          </span>
                                        )}
                                      </li>
                                    )
                                  })}
                                </ul>
                              </div>
                            )}
                          </div>
                        )}

                        {/* 4. DETALHES E CONDIÇÕES DO TIPO DE PROPOSTA DESTA MÁQUINA */}
                        {(() => {
                          const itemTipoObj = tipoDesc ? tiposPropostaMap[tipoDesc] : null
                          if (!itemTipoObj) return null

                          // Monta os campos e condições configurados no Tipo de Proposta
                          const tipoCampos: Array<{ label: string; value: string }> = []
                          if (!isCommercialFieldEmpty(itemTipoObj.prazo_entrega)) {
                            tipoCampos.push({
                              label: 'Prazo de Entrega',
                              value: String(itemTipoObj.prazo_entrega).trim(),
                            })
                          }
                          if (!isCommercialFieldEmpty(itemTipoObj.condicoes_pagamento)) {
                            tipoCampos.push({
                              label: 'Condições de Pagamento',
                              value: String(itemTipoObj.condicoes_pagamento).trim(),
                            })
                          }
                          if (!isCommercialFieldEmpty(itemTipoObj.garantia)) {
                            tipoCampos.push({
                              label: 'Garantia',
                              value: String(itemTipoObj.garantia).trim(),
                            })
                          }
                          if (!isCommercialFieldEmpty(itemTipoObj.assistencia_tecnica)) {
                            tipoCampos.push({
                              label: 'Assistência Técnica',
                              value: String(itemTipoObj.assistencia_tecnica).trim(),
                            })
                          }
                          if (!isCommercialFieldEmpty(itemTipoObj.treinamento_tecnico)) {
                            tipoCampos.push({
                              label: 'Treinamento Técnico',
                              value: String(itemTipoObj.treinamento_tecnico).trim(),
                            })
                          }
                          if (!isCommercialFieldEmpty(itemTipoObj.transporte_seguro)) {
                            tipoCampos.push({
                              label: 'Transporte / Seguro',
                              value: String(itemTipoObj.transporte_seguro).trim(),
                            })
                          }
                          if (!isCommercialFieldEmpty(itemTipoObj.validade_oferta)) {
                            tipoCampos.push({
                              label: 'Validade da Oferta',
                              value: String(itemTipoObj.validade_oferta).trim(),
                            })
                          }
                          if (!isCommercialFieldEmpty(itemTipoObj.frase_preco)) {
                            tipoCampos.push({
                              label: 'Frase de Preço',
                              value: String(itemTipoObj.frase_preco).trim(),
                            })
                          }
                          if (!isTaxValueEmpty(itemTipoObj.imposto_ipi, 'Imposto IPI')) {
                            tipoCampos.push({
                              label: 'Imposto IPI',
                              value: String(itemTipoObj.imposto_ipi).trim(),
                            })
                          }
                          if (!isTaxValueEmpty(itemTipoObj.imposto_icms, 'Imposto ICMS')) {
                            tipoCampos.push({
                              label: 'Imposto ICMS',
                              value: String(itemTipoObj.imposto_icms).trim(),
                            })
                          }

                          // Campos adicionais personalizados do tipo (se houver)
                          if (itemTipoObj.campos_adicionais) {
                            try {
                              const extras =
                                typeof itemTipoObj.campos_adicionais === 'string'
                                  ? JSON.parse(itemTipoObj.campos_adicionais)
                                  : itemTipoObj.campos_adicionais
                              if (Array.isArray(extras)) {
                                extras.forEach(
                                  (extra: {
                                    titulo?: string
                                    conteudo?: string
                                    chave?: string
                                    valor?: string | number
                                  }) => {
                                    const lbl = (extra.titulo || extra.chave || '').trim()
                                    const val =
                                      extra.conteudo != null
                                        ? String(extra.conteudo).trim()
                                        : extra.valor != null
                                          ? String(extra.valor).trim()
                                          : ''
                                    if (lbl && !isCommercialFieldEmpty(val)) {
                                      tipoCampos.push({ label: lbl, value: val })
                                    }
                                  },
                                )
                              } else if (extras && typeof extras === 'object') {
                                Object.entries(
                                  extras as Record<string, string | number | null | undefined>,
                                ).forEach(([lbl, rawVal]) => {
                                  const cleanLbl = (lbl || '').trim()
                                  if (cleanLbl && !isCommercialFieldEmpty(rawVal)) {
                                    tipoCampos.push({
                                      label: cleanLbl,
                                      value: String(rawVal).trim(),
                                    })
                                  }
                                })
                              }
                            } catch {
                              // ignora erro de parse json
                            }
                          }

                          if (tipoCampos.length === 0) return null

                          return (
                            <div className="mt-3 pt-2.5 border-t border-dashed border-slate-300">
                              <div className="flex items-center justify-between gap-2 mb-1.5 pb-0.5 border-b border-emerald-900/20">
                                <div className="flex items-center gap-1.5">
                                  <span className="w-0.5 h-3 bg-[#0b3c26] rounded-xs" />
                                  <h4 className="font-bold uppercase tracking-wider text-[#0b3c26] text-[10px]">
                                    Condições e Detalhes do Tipo de Proposta
                                  </h4>
                                </div>
                                <span className="text-[9.5px] font-semibold text-slate-700 bg-slate-100 border border-slate-200 px-1.5 py-0.2 rounded">
                                  {tipoDesc}
                                </span>
                              </div>
                              <div className="border border-slate-200 rounded-sm divide-y divide-slate-100 bg-white">
                                {tipoCampos.map((tc, tcIdx) => (
                                  <div
                                    key={tcIdx}
                                    className="grid grid-cols-1 sm:grid-cols-12 gap-1 sm:gap-3 p-1.5 px-2 text-[10px] items-baseline"
                                  >
                                    <div
                                      className="sm:col-span-4 font-bold text-slate-900 uppercase tracking-wide text-[9.5px] bg-slate-100/90 px-2 py-1 rounded-xs border-l-2 border-slate-300"
                                      style={{
                                        WebkitPrintColorAdjust: 'exact',
                                        printColorAdjust: 'exact',
                                        fontWeight: 700,
                                        backgroundColor: '#f1f5f9',
                                      }}
                                    >
                                      {tc.label}
                                    </div>
                                    <div className="sm:col-span-8 text-slate-900 font-medium whitespace-pre-wrap leading-relaxed break-words font-sans">
                                      {renderMultilinhaParagraphs(tc.value)}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )
                        })()}
                      </div>
                    )
                  })}
                </div>
              </section>
            ) : (
              /* Modo Padrão (máquina única): Standard + Características + Especificações + Acessórios Globais */
              <section className="proposal-section mb-4 text-xs break-inside-avoid print:break-inside-auto">
                {primaryVersao?.acessorios_standards && (
                  <div className="mb-3.5 break-inside-avoid">
                    <div className="flex items-center gap-2 mb-1.5 pb-1 border-b border-emerald-900/20 break-after-avoid">
                      <span className="w-1 h-3.5 bg-[#0b3c26] rounded-xs" />
                      <h3 className="font-bold uppercase tracking-wider text-[#0b3c26] text-[11px] sm:text-xs">
                        Configuração Standard
                      </h3>
                    </div>
                    <div className="pl-3">
                      <TechnicalDataDisplay content={primaryVersao.acessorios_standards} compact />
                    </div>
                  </div>
                )}

                {primaryVersao?.caracteristicas_construtivas && (
                  <div className="mb-3.5 break-inside-avoid">
                    <div className="flex items-center gap-2 mb-1.5 pb-1 border-b border-emerald-900/20 break-after-avoid">
                      <span className="w-1 h-3.5 bg-[#0b3c26] rounded-xs" />
                      <h3 className="font-bold uppercase tracking-wider text-[#0b3c26] text-[11px] sm:text-xs">
                        Características Construtivas
                      </h3>
                    </div>
                    <div className="pl-3">
                      <TechnicalDataDisplay
                        content={primaryVersao.caracteristicas_construtivas}
                        compact
                      />
                    </div>
                  </div>
                )}

                {(() => {
                  const desc =
                    primaryVersao?.especificacoes_tecnicas ||
                    proposal.especificacoes_tecnicas ||
                    proposal.descricao_proposta
                  if (!desc) return null
                  return (
                    <div className="mb-3.5 break-inside-avoid">
                      <div className="flex items-center gap-2 mb-1.5 pb-1 border-b border-emerald-900/20 break-after-avoid">
                        <span className="w-1 h-3.5 bg-[#0b3c26] rounded-xs" />
                        <h3 className="font-bold uppercase tracking-wider text-[#0b3c26] text-[11px] sm:text-xs">
                          Especificações Técnicas
                        </h3>
                      </div>
                      <div className="pl-3">
                        <TechnicalDataDisplay content={desc} compact />
                      </div>
                    </div>
                  )
                })()}

                {/* Accessories sections: Inclusos no Preço & Não Inclusos no Preço (modo máquina única) */}
                {(() => {
                  if (
                    !proposal.acessorios_proposta ||
                    !Array.isArray(proposal.acessorios_proposta) ||
                    proposal.acessorios_proposta.length === 0
                  ) {
                    return null
                  }
                  type AccItem = {
                    id?: string
                    nome?: string
                    valor?: number
                    moeda?: string
                    inclusao?: string
                    quantidade?: number
                    desconto_percentual?: number
                    desconto_valor?: number
                  }
                  const rawItems = (proposal.acessorios_proposta as AccItem[]).filter(
                    (a) => a.inclusao !== 'nao_exibir',
                  )
                  const inclusos = rawItems.filter(
                    (a) =>
                      a.inclusao === 'incluir' ||
                      a.inclusao === 'preco' ||
                      a.inclusao === undefined,
                  )
                  const naoInclusos = rawItems.filter(
                    (a) => a.inclusao === 'opcional' || a.inclusao === 'exibir',
                  )
                  const propMoeda = normalizeMoedaCode(proposal.moeda || 'BRL')

                  return (
                    <>
                      {inclusos.length > 0 && (
                        <div className="mb-3.5 break-inside-avoid">
                          <div className="flex items-center gap-2 mb-1.5 pb-1 border-b border-emerald-900/20 break-after-avoid">
                            <span className="w-1 h-3.5 bg-[#0b3c26] rounded-xs" />
                            <h3 className="font-bold uppercase tracking-wider text-[#0b3c26] text-[11px] sm:text-xs">
                              Acessórios Opcionais Inclusos no Preço
                            </h3>
                          </div>
                          <ul className="leading-relaxed text-[11px] text-slate-800 pl-3 space-y-1">
                            {inclusos.map((a, i) => (
                              <li key={a.id || i} className="flex items-start gap-1.5">
                                <span className="text-[#0b3c26] select-none font-bold">•</span>
                                <span>
                                  {a.quantidade ? `${a.quantidade}x ` : ''}
                                  {a.nome || '—'}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {naoInclusos.length > 0 && (
                        <div className="mb-3.5 break-inside-avoid">
                          <div className="flex items-center gap-2 mb-1.5 pb-1 border-b border-emerald-900/20 break-after-avoid">
                            <span className="w-1 h-3.5 bg-[#0b3c26] rounded-xs" />
                            <h3 className="font-bold uppercase tracking-wider text-[#0b3c26] text-[11px] sm:text-xs">
                              Acessórios Opcionais Não Inclusos no Preço
                            </h3>
                          </div>
                          <ul className="leading-relaxed text-[11px] text-slate-800 pl-3 space-y-1">
                            {naoInclusos.map((a, i) => {
                              const itemMoeda = a.moeda || propMoeda
                              const precoFormatted =
                                a.valor != null ? formatCurrencyByMoeda(a.valor, itemMoeda) : null
                              return (
                                <li
                                  key={a.id || i}
                                  className="flex items-start justify-between gap-2"
                                >
                                  <div className="flex items-start gap-1.5">
                                    <span className="text-[#0b3c26] select-none font-bold">•</span>
                                    <span>
                                      {a.quantidade ? `${a.quantidade}x ` : ''}
                                      {a.nome || '—'}
                                    </span>
                                  </div>
                                  {precoFormatted && (
                                    <span className="font-semibold text-slate-900 shrink-0">
                                      {precoFormatted}
                                    </span>
                                  )}
                                </li>
                              )
                            })}
                          </ul>
                        </div>
                      )}
                    </>
                  )
                })()}
              </section>
            )}

            {/* Commercial Conditions Section (R2: Tabela limpa e alinhada em tom profissional + R4: Cotação detalhada) */}
            <section className="proposal-section mb-5 text-xs break-inside-avoid print:break-inside-auto">
              <div className="border-b-2 border-slate-800 pb-1.5 mb-2.5 flex items-center justify-between break-after-avoid">
                <span className="font-bold tracking-wider uppercase text-slate-900 text-[11px] sm:text-xs">
                  Condições Comerciais
                </span>
                <span className="text-[10px] text-slate-600 font-medium">
                  {proposal.is_pacote ? 'Pacote de Máquinas' : 'Fornecimento Unitário'}
                </span>
              </div>

              {/* R4: Bloco de Cotação de Moeda Estrangeira (APENAS quando houver conversão real entre moedas diferentes com taxa) */}
              {(() => {
                const moedaOrig = normalizeMoedaCode(
                  proposal.moeda_original || proposal.moeda || 'BRL',
                )
                const moedaProp = normalizeMoedaCode(proposal.moeda || 'BRL')
                const hasRealConversion = moedaProp !== moedaOrig && Boolean(proposal.cotacao_moeda)

                if (!hasRealConversion) return null

                return (
                  <div className="mb-3 p-2.5 bg-slate-50 border border-slate-300 rounded text-[11px] text-slate-800 flex flex-wrap items-center justify-between gap-2 break-inside-avoid">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 uppercase tracking-wide text-[10px] bg-slate-200 px-1.5 py-0.5 rounded">
                        Câmbio / Cotação
                      </span>
                      <span>
                        Moeda da proposta: <strong>{moedaProp}</strong> (Original: {moedaOrig})
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span>
                        Taxa aplicada:{' '}
                        <strong>
                          1 {moedaProp} = {fmtCurrency(proposal.cotacao_moeda, 'BRL')}
                        </strong>
                      </span>
                      {proposal.data_cotacao_moeda && (
                        <span className="text-slate-600">
                          Data da cotação: <strong>{proposal.data_cotacao_moeda}</strong>
                        </span>
                      )}
                    </div>
                  </div>
                )
              })()}

              {/* Tabela de Condições Comerciais */}
              <div className="w-full mb-3 bg-white break-inside-avoid print:break-inside-auto">
                <table className="w-full border-collapse text-[10px] [&_th]:border [&_td]:border [&_th]:border-slate-300 [&_td]:border-slate-300 [&_th]:px-1.5 [&_th]:py-1 [&_td]:px-1.5 [&_td]:py-1">
                  <thead>
                    <tr className="bg-slate-100">
                      <th className="w-[6%] text-center">ITEM</th>
                      <th className="text-left">DESCRIÇÃO DO EQUIPAMENTO</th>
                      <th className="w-[8%] text-center">QTD</th>
                      <th className="w-[16%] text-right">VALOR UNITÁRIO</th>
                      <th className="w-[12%] text-right">DESCONTO</th>
                      <th className="w-[18%] text-right">SUBTOTAL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {proposal.is_pacote && equipmentItems.length > 0 ? (
                      equipmentItems.map((item, idx) => {
                        const itemNome =
                          item.versoes?.nome || item.versoes?.nome_abreviado || `Item ${idx + 1}`
                        const itemMoeda = normalizeMoedaCode(
                          item.versoes?.moeda || proposal.moeda || 'BRL',
                        )
                        const qtd = item.quantidade || 1
                        const valUnit = Number(item.valor_unitario || 0)
                        const descPct = Number(item.desconto_percentual || 0)
                        const descVal = Number(item.desconto_valor || 0)
                        const subtotal = qtd * valUnit
                        const totalItem =
                          descVal > 0
                            ? Math.max(0, subtotal - descVal)
                            : subtotal * (1 - descPct / 100)
                        const itemHasDiscount = descPct > 0 || descVal > 0

                        return (
                          <tr key={item.id || idx} className="hover:bg-slate-50/70 align-middle">
                            <td className="text-center font-semibold text-slate-700">{idx + 1}</td>
                            <td className="text-left font-bold text-slate-900 break-words leading-tight">
                              {itemNome}
                            </td>
                            <td className="text-center font-medium text-slate-800">{qtd}</td>
                            <td className="text-right font-semibold text-slate-900 whitespace-nowrap">
                              {fmtCurrency(valUnit, itemMoeda)}
                            </td>
                            <td className="text-right font-medium text-slate-700 whitespace-nowrap">
                              {descPct > 0
                                ? `${descPct}%`
                                : descVal > 0
                                  ? fmtCurrency(descVal, itemMoeda)
                                  : '—'}
                            </td>
                            <td className="text-right font-bold text-slate-950 whitespace-nowrap">
                              {itemHasDiscount ? (
                                <div className="space-y-0.5">
                                  <span className="line-through text-slate-400 text-[9px] block whitespace-nowrap">
                                    {fmtCurrency(subtotal, itemMoeda)}
                                  </span>
                                  <span className="text-slate-900 block whitespace-nowrap">
                                    {fmtCurrency(totalItem, itemMoeda)}
                                  </span>
                                </div>
                              ) : (
                                <span>{fmtCurrency(totalItem, itemMoeda)}</span>
                              )}
                            </td>
                          </tr>
                        )
                      })
                    ) : (
                      <tr className="hover:bg-slate-50/70 align-middle">
                        <td className="text-center font-semibold text-slate-700">1</td>
                        <td className="text-left font-bold text-slate-900 break-words leading-tight">
                          {machineTitle}
                        </td>
                        <td className="text-center font-medium text-slate-800">1</td>
                        <td className="text-right font-semibold text-slate-900 whitespace-nowrap">
                          {fmtCurrency(valorOriginalTabela, proposal.moeda)}
                        </td>
                        <td className="text-right font-medium text-slate-700 whitespace-nowrap">
                          {effectiveDiscountPercent > 0 ? `${effectiveDiscountPercent}%` : '—'}
                        </td>
                        <td className="text-right font-bold text-slate-950 whitespace-nowrap">
                          {hasItemDiscount ? (
                            <div className="space-y-0.5">
                              <span className="line-through text-slate-400 text-[9px] block whitespace-nowrap">
                                {fmtCurrency(valorOriginalTabela, proposal.moeda)}
                              </span>
                              <span className="text-slate-900 block whitespace-nowrap">
                                {fmtCurrency(valorEfetivoFinal, proposal.moeda)}
                              </span>
                            </div>
                          ) : (
                            <span>{fmtCurrency(valorEfetivoFinal, proposal.moeda)}</span>
                          )}
                        </td>
                      </tr>
                    )}
                    {comissaoServicosInfo && (
                      <tr>
                        <td className="text-center font-semibold text-slate-700">
                          {proposal.is_pacote && equipmentItems.length > 0
                            ? equipmentItems.length + 1
                            : 2}
                        </td>
                        <td className="text-left font-semibold text-slate-900 break-words leading-tight">
                          {comissaoServicosInfo.textoDescritivo}
                        </td>
                        <td className="text-center font-medium text-slate-800">—</td>
                        <td className="text-right font-medium text-slate-700">—</td>
                        <td className="text-right font-medium text-slate-700">—</td>
                        <td className="text-right font-bold text-slate-950 whitespace-nowrap">
                          {fmtCurrency(comissaoServicosInfo.valorCalculado, proposal.moeda)}
                        </td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td className="text-center font-semibold text-slate-700">—</td>
                      <td className="text-left">
                        <span className="font-bold text-slate-900">
                          VALOR TOTAL DO FORNECIMENTO
                        </span>
                        {frasePreco && (
                          <span className="block mt-0.5 text-[9.5px] font-normal text-slate-800 uppercase leading-tight">
                            {frasePreco}
                          </span>
                        )}
                      </td>
                      <td className="text-center font-medium text-slate-700">—</td>
                      <td className="text-right font-medium text-slate-700">—</td>
                      <td className="text-right font-medium text-slate-700">—</td>
                      <td className="text-right font-bold text-slate-950 whitespace-nowrap">
                        {fmtCurrency(valorTotalFornecimentoExibido, proposal.moeda)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </section>

            {/* Terms and conditions - Ficha Técnica layout */}
            {filteredTerms.length > 0 && (
              <section className="proposal-section mb-5 print:mt-4 text-xs break-inside-avoid print:break-inside-auto">
                <div className="bg-[#0b3c26] text-white px-3 py-1.5 rounded-sm flex items-center justify-between mb-3 shadow-sm break-after-avoid">
                  <span className="font-bold tracking-wider uppercase text-[11px] sm:text-xs">
                    Termos de Fornecimento
                  </span>
                  <span className="text-[10px] text-emerald-100 font-medium">
                    Condições Gerais & Garantias
                  </span>
                </div>
                <div className="border border-slate-200 rounded-sm divide-y divide-slate-100 bg-white">
                  {filteredTerms.map(([label, value]) => (
                    <div
                      key={label}
                      className="grid grid-cols-1 sm:grid-cols-12 gap-1 sm:gap-4 p-2 sm:px-3 hover:bg-slate-50/60 transition-colors items-baseline text-[11px] break-inside-avoid"
                    >
                      <div
                        className="sm:col-span-4 font-bold text-slate-900 uppercase tracking-wide text-[10px] bg-slate-100/90 px-2 py-1 rounded-xs border-l-2 border-slate-300"
                        style={{
                          WebkitPrintColorAdjust: 'exact',
                          printColorAdjust: 'exact',
                          fontWeight: 700,
                          backgroundColor: '#f1f5f9',
                        }}
                      >
                        {label}
                      </div>
                      <div className="sm:col-span-8 text-slate-900 font-medium whitespace-pre-wrap leading-relaxed break-words font-sans">
                        {renderMultilinhaParagraphs(value)}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Additional custom fields */}
            {Array.isArray(proposal.campos_adicionais) &&
              (proposal.campos_adicionais as any[]).filter(
                (f) =>
                  f &&
                  ((f.titulo && f.titulo.trim() !== '') || (f.chave && f.chave.trim() !== '')) &&
                  !isCommercialFieldEmpty(f.conteudo != null ? f.conteudo : f.valor),
              ).length > 0 && (
                <section className="proposal-section mb-4 text-xs break-inside-avoid print:break-inside-auto">
                  <h2 className="font-bold uppercase tracking-wider text-black border-b border-black/40 pb-1 mb-2 break-after-avoid">
                    Informações Adicionais
                  </h2>
                  <div className="border border-slate-200 rounded-sm divide-y divide-slate-100 bg-white">
                    {(proposal.campos_adicionais as any[])
                      .filter(
                        (f) =>
                          f &&
                          ((f.titulo && f.titulo.trim() !== '') ||
                            (f.chave && f.chave.trim() !== '')) &&
                          !isCommercialFieldEmpty(f.conteudo != null ? f.conteudo : f.valor),
                      )
                      .map((field, i) => {
                        const fieldTitle = ((field.titulo || field.chave || '') as string).trim()
                        const fieldVal = field.conteudo != null ? field.conteudo : field.valor
                        return (
                          <div
                            key={i}
                            className="grid grid-cols-1 sm:grid-cols-12 gap-1 sm:gap-4 p-2 sm:px-3 items-baseline text-[11px] break-inside-avoid"
                          >
                            <div
                              className="sm:col-span-4 font-bold text-slate-900 uppercase tracking-wide text-[10px] bg-slate-100/90 px-2 py-1 rounded-xs border-l-2 border-slate-300"
                              style={{
                                WebkitPrintColorAdjust: 'exact',
                                printColorAdjust: 'exact',
                                fontWeight: 700,
                                backgroundColor: '#f1f5f9',
                              }}
                            >
                              {fieldTitle}
                            </div>
                            <div className="sm:col-span-8 text-slate-900 font-medium whitespace-pre-wrap leading-relaxed break-words font-sans">
                              {renderMultilinhaParagraphs(fieldVal)}
                            </div>
                          </div>
                        )
                      })}
                  </div>
                </section>
              )}

            {/* Comparisons table */}
            {hasComparison && (
              <section className="proposal-section mb-4 text-xs break-inside-avoid print:break-inside-auto">
                <h2 className="font-bold uppercase tracking-wider text-black border-b border-black/40 pb-1 mb-2 break-after-avoid">
                  Comparação de Versões
                </h2>
                <table className="w-full text-[10px] border-collapse border border-black break-inside-avoid">
                  <thead>
                    <tr className="bg-black/5">
                      <th className="p-1 text-left border border-black font-bold">Item</th>
                      {compItems.map((_, i) => (
                        <th key={i} className="p-1 text-center border border-black font-bold">
                          Versão {i + 1}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(['nome', 'especificacoes'] as const).map((field) => (
                      <tr key={field} className="break-inside-avoid">
                        <td className="p-1 border border-black font-medium">
                          {field === 'nome' ? 'Nome' : 'Especificações'}
                        </td>
                        {compItems.map((item, i) => (
                          <td key={i} className="p-1 border border-black text-center">
                            {item[field] ?? '—'}
                          </td>
                        ))}
                      </tr>
                    ))}
                    <tr className="break-inside-avoid">
                      <td className="p-1 border border-black font-medium">Valor</td>
                      {compItems.map((item, i) => (
                        <td key={i} className="p-1 border border-black text-center font-bold">
                          {fmtCurrency(item.valor, proposal.moeda)}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </section>
            )}

            {/* Closing text */}
            <section className="proposal-closing-text mt-6 mb-4 text-xs text-black break-inside-avoid">
              <p className="text-justify leading-relaxed">
                Antecipadamente agradecemos vossa honrosa preferência, permanecendo ao vosso inteiro
                dispor, para dirimir e atender quaisquer eventuais esclarecimentos adicionais que se
                fizerem necessários.
              </p>
              <p className="mt-3 text-left">Atenciosamente</p>
            </section>

            {/* Signatures section */}
            <section className="proposal-signatures mt-6 break-inside-avoid">
              <h2 className="font-bold uppercase tracking-wider text-black border-b border-black/40 pb-1 mb-3 text-xs break-after-avoid">
                De Acordo e Assinaturas
              </h2>
              <div className="grid grid-cols-3 gap-4 text-center">
                <SignatureBlock
                  title="Gerente de Produto"
                  name={
                    proposal.nome_gerente_produto ||
                    proposal.gerentes?.nome ||
                    proposal.gerente_original
                  }
                  signature={proposal.assinatura_gerente_produto}
                />
                <SignatureBlock
                  title="Assessor Técnico"
                  name={proposal.nome_assessor_tecnico}
                  signature={proposal.assinatura_assessor_tecnico}
                />
                <SignatureBlock
                  title="Representante Comercial"
                  name={
                    proposal.nome_representante_comercial ||
                    proposal.representantes?.fantasia ||
                    proposal.representante_original
                  }
                  signature={proposal.assinatura_representante}
                />
              </div>
            </section>
          </div>

          {/* Page 2 Footer */}
          <div className="pt-4 border-t border-black text-center text-[10px] sm:text-[11px] leading-tight text-black mt-auto">
            <p className="font-normal">
              Rua Iracema Lucas, 450 (Antiga Rua Parsch) - Distrito Industrial
            </p>
            <p className="font-normal">
              Vinhedo - SP - Brasil - CEP: 13280-172 - Fone / Fax: (0**19) 3826-7373
            </p>
            <p className="font-normal">E-mail: vendas@bener.com.br - Site: www.bener.com.br</p>
          </div>
        </div>
      )}
    </div>
  )
}
