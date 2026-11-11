import { useState, useEffect, useMemo, useRef } from 'react'
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
import { resolveDescricaoFontSizeScreen } from '@/lib/descricao-tamanho'
import { ProposalSectionCounter } from '@/lib/proposal-section-numbering'


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
    const overrideTp = (proposal?.tipo_proposta_override ||
      snapshotRoot?.tipo_proposta_override) as TipoProposta | undefined

    // Se o snapshot congelou tipo_proposta_detalhes, usa ele
    const snapshotTp = (overrideTp || snapshotRoot?.tipo_proposta_detalhes) as
      | TipoProposta
      | undefined

    if (snapshotTp) {
      setTipoProposta(snapshotTp)
      if (snapshotTp.nome) {
        setTiposPropostaMap((prev) => ({ ...prev, [snapshotTp.nome!]: snapshotTp }))
      }
      if (proposal?.tipo_proposta && proposal.tipo_proposta !== snapshotTp.nome) {
        setTiposPropostaMap((prev) => ({ ...prev, [proposal.tipo_proposta!]: snapshotTp }))
      }
    }

    // Se temos itens com tipo_proposta_detalhes congelados em itens_snapshot, popula também
    const rawSnapshot = proposal?.itens_snapshot
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

    if (!proposal?.tipo_proposta) return

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
  }, [proposal?.tipo_proposta, proposal?.tipo_proposta_override, snapshotRoot])

  // No modo pacote (ou quando há itens de equipamento), busca os detalhes dos tipos faltantes
  useEffect(() => {
    const nomes = new Set<string>()
    if (proposal?.tipo_proposta) nomes.add(proposal.tipo_proposta)
    if (Array.isArray(equipmentItems)) {
      equipmentItems.forEach((it) => {
        if (it?.tipo_proposta) nomes.add(it.tipo_proposta)
      })
    }
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
              if (row?.nome) {
                map[row.nome] = row as unknown as TipoProposta
              }
            })
            return map
          })
        }
      })
  }, [proposal?.is_pacote, proposal?.tipo_proposta, equipmentItems, tiposPropostaMap])

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

  // Concatenação inteligente de garantias (garantia principal + garantia de acessórios/cobertura) para respeitar os 7 subtítulos exatos (Item 7)
  const combinedGarantia = [
    proposal.garantia_acessorios || tipoProposta?.garantia,
    proposal.cobertura_garantia,
  ]
    .filter((v) => v && String(v).trim())
    .join('\n\n')

  const terms: Array<[string, string | null | undefined]> = [
    ['Prazo de entrega', proposal.prazo_entrega || tipoProposta?.prazo_entrega],
    ['Condições de pagamento', proposal.condicoes_pagamento || tipoProposta?.condicoes_pagamento],
    ['Garantia', combinedGarantia || null],
    [
      'Assistência técnica',
      proposal.assistencia_tecnica_detalhada || tipoProposta?.assistencia_tecnica,
    ],
    [
      'Treinamento técnico',
      (proposal as { treinamento_tecnico?: string | null }).treinamento_tecnico ||
        tipoProposta?.treinamento_tecnico,
    ],
    ['Transporte/seguro', proposal.transporte_seguro || tipoProposta?.transporte_seguro],
    ['Validade da oferta', proposal.validade_oferta || tipoProposta?.validade_oferta],
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

  // Regra 9 / Ponto 25: Deduplicação de campos customizados e Informações Adicionais
  // Descarta dos "Informações Adicionais" os campos já exibidos nos Termos de Fornecimento,
  // e se o bloco Informações Adicionais ficar vazio, não renderiza nada (nem o título).
  const normCampoKey = (s: unknown): string =>
    String(s ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
  const renderedCampoKeys = new Set<string>()
  for (const [termLabel] of filteredTerms) {
    const k = normCampoKey(termLabel)
    if (k) renderedCampoKeys.add(k)
  }

  const validCamposAdicionaisProposal = Array.isArray(proposal.campos_adicionais)
    ? (proposal.campos_adicionais as any[]).filter((f) => {
        if (!f) return false
        const fTitle = String(f.titulo || f.chave || '').trim()
        const fContent = f.conteudo != null ? f.conteudo : f.valor
        if (!fTitle && !fContent) return false
        if (isCommercialFieldEmpty(fContent)) return false
        const fKey = normCampoKey(f.chave || f.id || f.titulo)
        if (fKey && renderedCampoKeys.has(fKey)) return false
        if (fKey) renderedCampoKeys.add(fKey)
        return true
      })
    : []

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
  const rawCad = proposal.dt_cad ? String(proposal.dt_cad).trim() : ''
  const parsedDate = rawCad
    ? new Date(rawCad.includes('T') ? rawCad : `${rawCad}T12:00:00`)
    : new Date()
  const dataEmissao = isNaN(parsedDate.getTime()) ? new Date() : parsedDate
  const mesOferta = String(dataEmissao.getMonth() + 1).padStart(2, '0')
  const anoOferta = String(dataEmissao.getFullYear())
  const dataPorExtenso = dataEmissao.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
  const dataPorExtensoCap = dataPorExtenso
    ? dataPorExtenso.charAt(0).toUpperCase() + dataPorExtenso.slice(1)
    : ''
  const siglaBox = (
    <div className="border border-black text-[9.5px] leading-tight text-black shrink-0 break-inside-avoid min-w-[340px] max-w-[420px] w-full">
      <table className="w-full border-collapse m-0 text-[9.5px] leading-tight bg-white">
        <thead>
          <tr className="border-b border-black">
            <th className="p-0.5 px-1.5 text-center font-bold border-r border-black w-[65px]">
              Sigla
            </th>
            <th className="p-0.5 px-2 text-center font-bold border-r border-black w-[180px]">
              N° Oferta
            </th>
            <th className="p-0.5 px-1.5 text-center font-bold border-r border-black w-[85px]">
              Mês
            </th>
            <th className="p-0.5 px-1.5 text-center font-bold w-[90px]">Ano</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="p-1 text-center border-r border-black whitespace-nowrap">
              {repPrimeiroNome}
            </td>
            <td
              className="p-1 text-center font-bold border-r border-black whitespace-nowrap"
              style={{
                fontSize:
                  numeroOferta.length > 22 ? '7.5px' : numeroOferta.length > 16 ? '8.5px' : '9.5px',
              }}
            >
              {numeroOferta}
            </td>
            <td className="p-1 text-center border-r border-black whitespace-nowrap">{mesOferta}</td>
            <td className="p-1 text-center whitespace-nowrap">{anoOferta}</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
  const headerInstitucional = (
    <div className="flex justify-between items-stretch gap-4">
      <div className="flex items-start gap-2">
        <img
          src={benerLogo}
          alt="BENER - MÁQUINAS QUE TRANSFORMAM"
          className="object-contain"
          style={{
            width: '60mm',
            height: 'auto',
            maxWidth: '62mm',
            maxHeight: '27mm',
            objectFit: 'contain',
          }}
          loading="eager"
        />
      </div>
      <div className="flex flex-col items-end text-right text-[10px] sm:text-[11px] leading-tight text-black shrink-0">
        <p className="font-bold text-[12px] sm:text-[13px]">
          Bener Comercial Importadora Exportadora Ltda.
        </p>
        <p className="mt-0.5 sm:mt-1">Vinhedo, {dataPorExtensoCap}</p>
        <div className="mt-auto pt-1">{siglaBox}</div>
      </div>
    </div>
  )
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
  const overrideTp = (proposal?.tipo_proposta_override || snapshotRoot?.tipo_proposta_override) as
    | TipoProposta
    | undefined
  const currentTipoNome = overrideTp?.nome || proposal?.tipo_proposta || tipoProposta?.nome || null
  const currentTipoComissao =
    overrideTp?.comissao != null
      ? Number(overrideTp.comissao) || 0
      : tipoProposta?.comissao != null
        ? Number(tipoProposta.comissao) || 0
        : 0

  // Base de cálculo da comissão:
  // PONTO 3: Subtotal da máquina DEVE ser limpo (sem comissão embutida).
  // A comissão fica em linha separada. O Valor Total do Fornecimento = subtotal limpo + comissão.
  const proposalAny = (proposal || {}) as any

  // 1. Calcula o subtotal limpo das máquinas + acessórios opcionais inclusos
  const subtotalMaquinasLimpo = useMemo(() => {
    let total = 0
    if (proposal?.is_pacote && Array.isArray(equipmentItems) && equipmentItems.length > 0) {
      equipmentItems.forEach((item) => {
        if (!item) return
        const qtd = Number(item.quantidade) || 1
        const valUnit = Number(item.valor_unitario || 0)
        const descPct = Number(item.desconto_percentual || 0)
        const descVal = Number(item.desconto_valor || 0)
        const subtotal = qtd * valUnit
        const totalItem =
          descVal > 0 ? Math.max(0, subtotal - descVal) : subtotal * (1 - descPct / 100)
        total += isNaN(totalItem) ? 0 : totalItem
      })
    } else {
      // Máquina única: Se o valor da versão estiver disponível, prioriza
      const versaoVal = Number(primaryVersao?.valor || 0)
      if (versaoVal > 0) {
        total = versaoVal
      } else {
        total = Number(valorEfetivoFinal) || 0
      }
    }

    // Soma opcionais inclusos
    if (Array.isArray(proposal?.acessorios_proposta)) {
      type AccItem = {
        valor?: number
        inclusao?: string
        quantidade?: number
        desconto_percentual?: number
        desconto_valor?: number
      }
      const rawAcc = proposal.acessorios_proposta as AccItem[]
      rawAcc.forEach((a) => {
        if (!a) return
        const isInc = a.inclusao === 'incluir' || a.inclusao === 'preco' || a.inclusao === undefined
        if (isInc && a.valor != null && Number(a.valor) > 0) {
          const q = Number(a.quantidade) || 1
          const sub = q * Number(a.valor)
          const dPct = Number(a.desconto_percentual || 0)
          const dVal = Number(a.desconto_valor || 0)
          const tot = dVal > 0 ? Math.max(0, sub - dVal) : sub * (1 - dPct / 100)
          total += isNaN(tot) ? 0 : tot
        }
      })
    }

    return Math.round(total * 100) / 100
  }, [
    proposal?.is_pacote,
    equipmentItems,
    primaryVersao?.valor,
    valorEfetivoFinal,
    proposal?.acessorios_proposta,
  ])

  const baseCalculoItens = useMemo(() => {
    // Se houver base persistida válida no snapshot/proposta, respeita
    const basePersistida = Number(
      proposalAny?.base_comissao_servicos || snapshotRoot?.base_comissao_servicos || 0,
    )
    if (!isNaN(basePersistida) && basePersistida > 0) {
      return basePersistida
    }

    // Preço especial se houver
    const precoEspecialVal =
      proposal?.preco_especial != null && Number(proposal.preco_especial) > 0
        ? Number(proposal.preco_especial)
        : null
    if (precoEspecialVal != null && precoEspecialVal > 0) {
      return precoEspecialVal
    }

    if (subtotalMaquinasLimpo > 0) {
      return subtotalMaquinasLimpo
    }

    const valorFinalNum = Number(proposal?.valor_final ?? proposal?.valor_atual ?? 0)
    return isNaN(valorFinalNum) ? 0 : valorFinalNum
  }, [
    proposalAny?.base_comissao_servicos,
    snapshotRoot?.base_comissao_servicos,
    proposal?.preco_especial,
    subtotalMaquinasLimpo,
    proposal?.valor_final,
    proposal?.valor_atual,
  ])

  const comissaoServicosInfo = useMemo(() => {
    const rawValPersistido =
      proposalAny?.valor_comissao_servicos ?? snapshotRoot?.valor_comissao_servicos ?? 0
    const valPersistido = Number(rawValPersistido) || 0

    const rawPctPersistido =
      proposalAny?.percentual_comissao_servicos ??
      snapshotRoot?.percentual_comissao_servicos ??
      currentTipoComissao
    const pctPersistido = Number(rawPctPersistido) || 0

    if (valPersistido > 0) {
      return {
        isApplicable: true,
        percentual: pctPersistido,
        baseCalculo: baseCalculoItens || 0,
        valorCalculado: valPersistido,
        textoDescritivo:
          'Pagamento Brasil: Serviços e Comissão Bener. Itens considerados p/ base de cálculo: Máquina; Opcionais Inclusos e Impostos sobre serviços Bener',
      }
    }

    return calcComissaoServicosBener({
      tipoNome: currentTipoNome,
      comissaoPct: currentTipoComissao,
      baseValor: baseCalculoItens || 0,
    })
  }, [
    proposalAny?.valor_comissao_servicos,
    proposalAny?.percentual_comissao_servicos,
    snapshotRoot?.valor_comissao_servicos,
    snapshotRoot?.percentual_comissao_servicos,
    currentTipoNome,
    currentTipoComissao,
    baseCalculoItens,
  ])

  const valorComissaoCalculada = Number(comissaoServicosInfo?.valorCalculado) || 0
  const isComissaoAtiva = Boolean(comissaoServicosInfo && valorComissaoCalculada > 0)

  // PONTO 3: Garantir linha da máquina limpa (sem comissão)
  // Se o valor_final gravado embute comissão (rawFinal ~= base + comissao), subtrair comissão na linha da máquina!
  const rawValorFinalGravado = Number(proposal?.valor_final || 0)
  const qtdProposta =
    Number(proposalAny?.quantidade || 1) > 0 ? Number(proposalAny?.quantidade || 1) : 1

  const valorMaquinaLimpoLinha = useMemo(() => {
    if (proposal?.preco_especial != null && Number(proposal.preco_especial) > 0) {
      return Number(proposal.preco_especial)
    }
    if (!isComissaoAtiva) return valorEfetivoFinal
    // Se temos subtotalMaquinasLimpo confiável > 0, usa-o
    if (
      subtotalMaquinasLimpo > 0 &&
      (Math.abs(rawValorFinalGravado - (subtotalMaquinasLimpo + valorComissaoCalculada)) < 0.1 ||
        rawValorFinalGravado === subtotalMaquinasLimpo)
    ) {
      return subtotalMaquinasLimpo
    }
    // Se rawValorFinalGravado tem comissão embutida, remove
    if (rawValorFinalGravado > valorComissaoCalculada) {
      return rawValorFinalGravado - valorComissaoCalculada
    }
    if (subtotalMaquinasLimpo > 0) {
      return subtotalMaquinasLimpo
    }
    return valorEfetivoFinal
  }, [
    proposal?.preco_especial,
    isComissaoAtiva,
    subtotalMaquinasLimpo,
    rawValorFinalGravado,
    valorComissaoCalculada,
    valorEfetivoFinal,
  ])

  // Valor original da tabela da máquina limpo de comissão
  const valorOriginalMaquinaLimpo = useMemo(() => {
    let orig = valorOriginalTabela > 0 ? valorOriginalTabela : valorMaquinaLimpoLinha
    if (isComissaoAtiva && valorComissaoCalculada > 0 && orig > valorComissaoCalculada) {
      if (
        Math.abs(orig - (valorMaquinaLimpoLinha + valorComissaoCalculada)) < 0.1 ||
        orig >= valorMaquinaLimpoLinha + valorComissaoCalculada - 0.05
      ) {
        orig = orig - valorComissaoCalculada
      }
    }
    return Math.max(orig, valorMaquinaLimpoLinha)
  }, [valorOriginalTabela, valorMaquinaLimpoLinha, isComissaoAtiva, valorComissaoCalculada])

  const valorUnitarioMaquinaEfetivo = useMemo(() => {
    return qtdProposta > 0 ? valorMaquinaLimpoLinha / qtdProposta : valorMaquinaLimpoLinha
  }, [valorMaquinaLimpoLinha, qtdProposta])

  const valorUnitarioMaquinaOrig = useMemo(() => {
    return qtdProposta > 0 ? valorOriginalMaquinaLimpo / qtdProposta : valorOriginalMaquinaLimpo
  }, [valorOriginalMaquinaLimpo, qtdProposta])

  // PONTO 3: VALOR TOTAL DO FORNECIMENTO = subtotal da máquina limpo + comissão (sem soma dupla)
  const valorTotalFornecimentoExibido = useMemo(() => {
    if (proposal?.preco_especial != null && Number(proposal.preco_especial) > 0) {
      return Number(proposal.preco_especial)
    }
    if (!isComissaoAtiva) {
      return rawValorFinalGravado > 0 ? rawValorFinalGravado : valorEfetivoFinal
    }
    // Se o valor_final já tinha comissão somada (ex: rawFinal >= valorMaquinaLimpoLinha + valorComissaoCalculada - 0.05)
    if (Math.abs(rawValorFinalGravado - (valorMaquinaLimpoLinha + valorComissaoCalculada)) < 0.1) {
      return rawValorFinalGravado
    }
    return valorMaquinaLimpoLinha + valorComissaoCalculada
  }, [
    proposal?.preco_especial,
    isComissaoAtiva,
    rawValorFinalGravado,
    valorEfetivoFinal,
    valorMaquinaLimpoLinha,
    valorComissaoCalculada,
  ])

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

  // Numeração hierárquica de seções — espelho do gerador do servidor (ProposalSectionCounter)
  const sectionCounter = new ProposalSectionCounter()

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
      {/* Running Header Nativo para @media print (aparece no topo de TODAS as páginas impressas via fixed header) */}
      {/* Ponto 2: altura fixa 35mm ancorada a top:10mm e margens laterais de 12mm */}
      <div className="proposal-running-header hidden print:block print:fixed print:top-[10mm] print:left-[12mm] print:right-[12mm] print:h-[35mm] print:bg-white print:z-[9999] box-border pb-2">
        <div className="border-b border-black pb-1.5">{headerInstitucional}</div>
      </div>

      {/* Running Footer Nativo para @media print (aparece no rodapé de TODAS as páginas impressas via fixed footer) */}
      <div className="proposal-running-footer hidden print:block print:fixed print:bottom-[10mm] print:left-[12mm] print:right-[12mm] print:h-[16mm] print:bg-white print:z-[9999] border-t border-black pt-1 text-center text-[12px] leading-[1.15] text-black">
        <div className="relative w-full h-full flex flex-col justify-center">
          <p className="font-normal">
            Rua Iracema Lucas, 450 (Antiga Rua Parsch) - Distrito Industrial
          </p>
          <p className="font-normal">
            Vinhedo - SP - Brasil - CEP: 13280-172 - Fone / Fax: (0**19) 3826-7373
          </p>
          <p className="font-normal">E-mail: vendas@bener.com.br - Site: www.bener.com.br</p>
          {/* Numeração de página é desenhada por folha paginada (proposal-sheet-page-number) */}
          <span className="proposal-running-footer-page-counter absolute bottom-0 right-0 text-[9px] font-bold text-black pointer-events-none" />
        </div>
      </div>

      <table className="proposal-print-table w-full border-collapse m-0 p-0 border-none">
        <thead className="hidden print:table-header-group border-none m-0 p-0">
          <tr className="border-none m-0 p-0">
            <th className="proposal-print-header-space border-none m-0 p-0 font-normal print:h-[45mm]">
              &nbsp;
            </th>
          </tr>
        </thead>
        <tfoot className="hidden print:table-footer-group border-none m-0 p-0">
          <tr className="border-none m-0 p-0">
            <td className="proposal-print-footer-space border-none m-0 p-0 font-normal print:h-[26mm]">
              &nbsp;
            </td>
          </tr>
        </tfoot>
        <tbody className="border-none m-0 p-0">
          <tr className="border-none m-0 p-0">
            <td className="border-none m-0 p-0 align-top">
              <ProposalDocumentSheets
                proposal={proposal}
                showAdditionalPages={showAdditionalPages}
                headerInstitucional={headerInstitucional}
                c={c}
                clientCompanyName={clientCompanyName}
                clientPhone={clientPhone}
                clientEmail={clientEmail}
                contactName={contactName}
                machineTitle={machineTitle}
                machineImage={machineImage}
                sectionCounter={sectionCounter}
              />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}
