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

  // Medição da altura do bloco de conteúdo para estimativa de total de páginas na visualização de tela
  const contentBodyRef = useRef<HTMLDivElement>(null)
  const [estimatedTotalPages, setEstimatedTotalPages] = useState<number>(
    showAdditionalPages ? 2 : 1,
  )

  useEffect(() => {
    if (!showAdditionalPages) {
      setEstimatedTotalPages(1)
      return
    }

    const measurePages = () => {
      if (!contentBodyRef.current) return
      // Na visualização em tela / impressão, cada página de conteúdo A4 tem ~226mm de altura útil
      // 1mm ~ 3.7795px (96dpi standard) -> 226mm ~ 854px
      const scrollHeight = contentBodyRef.current.scrollHeight
      const usableHeightPx = 854
      const contentPages = Math.max(1, Math.ceil(scrollHeight / usableHeightPx))
      // 1 página de capa + N páginas de conteúdo
      setEstimatedTotalPages(1 + contentPages)
    }

    measurePages()
    const timer = setTimeout(measurePages, 300)
    window.addEventListener('resize', measurePages)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('resize', measurePages)
    }
  }, [showAdditionalPages, proposal, equipmentItems])

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
          {/* Numeração no canto inferior direito para navegadores legados (sem sobrepor o rodapé de endereços) */}
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
              <div
                data-sheet-index="0"
                data-page="1"
                className="proposal-page proposal-sheet proposal-cover relative flex flex-col justify-between p-10 sm:p-12 print:p-0 bg-white min-h-[297mm] print:h-[226mm] print:min-h-[226mm] print:max-h-[226mm] print:border-none"
                style={{
                  boxSizing: 'border-box',
                  breakBefore: 'avoid',
                  pageBreakBefore: 'avoid',
                  marginTop: 0,
                  paddingTop: 0,
                }}
              >
                {/* Top & Main Body */}
                <div className="flex-1 min-h-0 flex flex-col">
                  {/* Header + Client + Reception wrapped to avoid breaking apart */}
                  <div className="break-inside-avoid shrink-0">
                    {/* Section 0: Top Header (exibido na tela; no print fica a cargo do header nativo repetido) */}
                    <div className="border-b border-black pb-1.5 mb-2 print:hidden">
                      {headerInstitucional}
                    </div>

                    {/* Section 1: Client Header (Top Left) */}
                    <div className="text-left text-xs sm:text-[13px] leading-relaxed tracking-tight text-black space-y-0.5">
                      <p className="font-normal">À</p>
                      <p className="font-bold text-sm sm:text-[14px]">{clientCompanyName}</p>
                      {clientPhone && <p className="font-normal">Telefone: {clientPhone}</p>}
                      {clientEmail && <p className="font-normal">E-mail: {clientEmail}</p>}

                      {contactName ? (
                        <p className="font-normal pt-1">
                          A/C: <span className="font-bold">{contactName}</span>
                        </p>
                      ) : (
                        <p className="font-normal pt-1">A/C: Diretor / Gerente de Compras</p>
                      )}
                    </div>

                    {/* Section 2: Reception Text */}
                    <div className="mt-2.5 sm:mt-2.5 text-xs sm:text-[13px] leading-relaxed text-black space-y-1 text-justify reception-text">
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
                        Imagens meramente ilustrativas • Fornecimento em pacote com{' '}
                        {equipmentItems.length} máquinas
                      </p>
                    </div>
                  ) : (
                    /* Modo Normal (máquina única): Título e Foto grandes centralizados — ocupa espaço restante da 1ª página (Item 2) */
                    <div className="break-inside-avoid print:break-inside-avoid machine-presentation-block flex-1 min-h-0 flex flex-col">
                      {/* Section 3: Machine Title (Bold, Uppercase, Centered) */}
                      <div className="my-1 sm:my-2 text-center px-4 break-after-avoid machine-title shrink-0">
                        <h1 className="text-sm md:text-[14px] font-bold text-black tracking-wide uppercase leading-tight">
                          {machineTitle}
                        </h1>
                      </div>

                      {/* Section 4: Machine Image (Large centered image with small caption below) */}
                      <div className="flex-1 min-h-0 flex flex-col items-center justify-center break-before-avoid break-inside-avoid image-container overflow-hidden w-full my-1 text-center">
                        {machineImage ? (
                          <div className="w-full flex-1 min-h-0 flex items-center justify-center">
                            <img
                              src={machineImage}
                              alt={machineTitle}
                              className="w-auto max-w-full h-auto max-h-full object-contain machine-img block mx-auto"
                              loading="eager"
                            />
                          </div>
                        ) : (
                          <div className="w-60 h-36 border border-dashed border-gray-300 rounded flex items-center justify-center text-xs text-gray-400">
                            Foto do equipamento indisponível no catálogo
                          </div>
                        )}
                        <p className="text-[9px] text-black/70 italic text-center mt-1 image-caption shrink-0">
                          Imagem meramente ilustrativa
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Section 5: Institutional Footer (Fixed at the bottom of the page on screen; hidden in print in favor of running-footer) */}
                <div className="pt-4 border-t border-black text-center text-[10px] sm:text-[11px] leading-tight text-black mt-auto print:hidden">
                  <p className="font-normal">
                    Rua Iracema Lucas, 450 (Antiga Rua Parsch) - Distrito Industrial
                  </p>
                  <p className="font-normal">
                    Vinhedo - SP - Brasil - CEP: 13280-172 - Fone / Fax: (0**19) 3826-7373
                  </p>
                  <p className="font-normal">
                    E-mail: vendas@bener.com.br - Site: www.bener.com.br
                  </p>
                  {/* Capa sem numeração no rodapé de tela */}
                </div>
              </div>

              {/* ================= PAGE 2+: TECHNICAL & COMMERCIAL DETAILS ================= */}
              {showAdditionalPages && (
                <div
                  ref={contentBodyRef}
                  data-sheet-index="1"
                  data-page="2"
                  className="proposal-page proposal-sheet relative flex flex-col justify-between p-10 sm:p-12 print:p-0 bg-white min-h-[297mm] print:min-h-0 print:h-auto border-t-2 border-dashed border-slate-300 print:border-none"
                  style={{
                    boxSizing: 'border-box',
                    breakBefore: 'page',
                    pageBreakBefore: 'always',
                  }}
                >
                  {/* Institutional header repeated on Page 2 on screen; in print, handled by proposal-running-header */}
                  <div className="border-b border-black pb-1.5 mb-2 break-inside-avoid print:hidden">
                    {headerInstitucional}
                  </div>

                  <div>
                    {/* Modo Pacote: Bloco estruturado por Máquina com Foto, Título e Acessórios vinculados */}
                    {proposal.is_pacote && equipmentItems.length > 0 ? (
                      <section className="proposal-section mb-5 text-xs">
                        <div className="flex items-center justify-between gap-2 mt-4 mb-1.5 pb-1.5 border-b border-slate-300 break-after-avoid">
                          <div className="flex items-center gap-2">
                            <span className="w-[3.5pt] h-[14pt] bg-[#0b3c26] rounded-xs inline-block" />
                            <h2 className="font-bold uppercase tracking-wider text-[#0b3c26] text-[12.5pt]">
                              {sectionCounter.nextLevel1('Equipamentos e Acessórios do Pacote')}
                            </h2>
                          </div>
                          <span className="text-[10pt] text-slate-500 font-medium">
                            {equipmentItems.length}{' '}
                            {equipmentItems.length === 1 ? 'máquina' : 'máquinas'}
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
                            const itemDescFontSize = resolveDescricaoFontSizeScreen(
                              (itemVersao as any)?.descricao_tamanho,
                            )
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
                                      <span className="font-medium">
                                        Quantidade:{' '}
                                        <strong className="text-slate-900">
                                          {item.quantidade}
                                        </strong>
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

                                {/* Detalhes Técnicos / Construtivos / Standard da Máquina: 1. Standard, 2. Construtivas, 3. Specs (Item 5) */}
                                {itemAcessStandards && (
                                  <div className="mt-2.5 pt-2 border-t border-slate-100 break-inside-avoid">
                                    <h4 className="font-bold text-[#0b3c26] uppercase text-[10.5pt] tracking-[0.5px] mb-1 break-after-avoid">
                                      Configuração Standard
                                    </h4>
                                    <div
                                      className="font-medium text-[#0f172a] leading-[1.45] break-words"
                                      style={{ fontSize: itemDescFontSize }}
                                    >
                                      <TechnicalDataDisplay content={itemAcessStandards} compact />
                                    </div>
                                  </div>
                                )}

                                {itemCaract && (
                                  <div className="mt-2.5 pt-2 border-t border-slate-100 break-inside-avoid">
                                    <h4 className="font-bold text-[#0b3c26] uppercase text-[10.5pt] tracking-[0.5px] mb-1 break-after-avoid">
                                      Características Construtivas
                                    </h4>
                                    <div
                                      className="font-medium text-[#0f172a] leading-[1.45] break-words"
                                      style={{ fontSize: itemDescFontSize }}
                                    >
                                      <TechnicalDataDisplay content={itemCaract} compact />
                                    </div>
                                  </div>
                                )}

                                {itemSpecs && (
                                  <div className="mt-2.5 pt-2 border-t border-slate-100 break-inside-avoid">
                                    <h4 className="font-bold text-[#0b3c26] uppercase text-[10.5pt] tracking-[0.5px] mb-1 break-after-avoid">
                                      Especificações Técnicas
                                    </h4>
                                    <div
                                      className="font-medium text-[#0f172a] leading-[1.45] break-words"
                                      style={{ fontSize: itemDescFontSize }}
                                    >
                                      <TechnicalDataDisplay content={itemSpecs} compact />
                                    </div>
                                  </div>
                                )}

                                {/* 3. ACESSÓRIOS SELECIONADOS DESTA MÁQUINA (Inclusos; Não Inclusos virou seção própria após as Condições Comerciais) */}
                                {accInclusos.length > 0 && (
                                  <div className="mt-3 pt-2.5 border-t border-dashed border-slate-300 space-y-2.5">
                                    {/* Acessórios Opcionais Inclusos no Preço daquela máquina */}
                                    {accInclusos.length > 0 && (
                                      <div>
                                        <h4 className="font-bold text-[#0b3c26] uppercase text-[10.5pt] tracking-[0.5px] mb-1 break-after-avoid">
                                          Acessórios Opcionais Inclusos no Preço abaixo
                                        </h4>
                                        <ul className="leading-[1.45] text-[9.5pt] font-medium text-[#0f172a] space-y-0.5 break-words">
                                          {accInclusos.map((a, accIdx) => (
                                            <li
                                              key={a.id || accIdx}
                                              className="flex items-start gap-1.5"
                                            >
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
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </section>
                    ) : (
                      /* Modo Padrão (máquina única): Standard + Características + Especificações + Acessórios Globais */
                      <section className="proposal-section mb-4 text-xs break-inside-avoid print:break-inside-auto">
                        {(() => {
                          const primaryDescFontSize = resolveDescricaoFontSizeScreen(
                            (primaryVersao as any)?.descricao_tamanho,
                          )
                          return (
                            <>
                              {/* Ordem das descrições: 1. Configuração Standard, 2. Características Construtivas, 3. Especificações Técnicas (Item 5) */}
                              {primaryVersao?.acessorios_standards && (
                                <div className="mb-3.5 break-inside-avoid">
                                  <h3 className="mt-3 mb-1 font-bold uppercase text-[#0b3c26] text-[10.5pt] tracking-[0.5px] break-after-avoid">
                                    {sectionCounter.nextLevel1('Configuração Standard')}
                                  </h3>
                                  <div
                                    className="font-medium text-[#0f172a] leading-[1.45] break-words"
                                    style={{ fontSize: primaryDescFontSize }}
                                  >
                                    <TechnicalDataDisplay
                                      content={primaryVersao.acessorios_standards}
                                      compact
                                    />
                                  </div>
                                </div>
                              )}

                              {primaryVersao?.caracteristicas_construtivas && (
                                <div className="mb-3.5 break-inside-avoid">
                                  <h3 className="mt-3 mb-1 font-bold uppercase text-[#0b3c26] text-[10.5pt] tracking-[0.5px] break-after-avoid">
                                    {sectionCounter.nextLevel1('Características Construtivas')}
                                  </h3>
                                  <div
                                    className="font-medium text-[#0f172a] leading-[1.45] break-words"
                                    style={{ fontSize: primaryDescFontSize }}
                                  >
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
                                    <h3 className="mt-3 mb-1 font-bold uppercase text-[#0b3c26] text-[10.5pt] tracking-[0.5px] break-after-avoid">
                                      {sectionCounter.nextLevel1('Especificações Técnicas')}
                                    </h3>
                                    <div
                                      className="font-medium text-[#0f172a] leading-[1.45] break-words"
                                      style={{ fontSize: primaryDescFontSize }}
                                    >
                                      <TechnicalDataDisplay content={desc} compact />
                                    </div>
                                  </div>
                                )
                              })()}
                            </>
                          )
                        })()}

                        {/* Acessórios Opcionais Inclusos no Preço (modo máquina única).
                            Não Inclusos virou seção própria numerada após as Condições Comerciais. */}
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

                          if (inclusos.length === 0) return null

                          return (
                            <div className="mb-3.5 break-inside-avoid">
                              <h3 className="mt-3 mb-1 font-bold uppercase text-[#0b3c26] text-[10.5pt] tracking-[0.5px] break-after-avoid">
                                {sectionCounter.nextLevel1(
                                  'Acessórios Opcionais Inclusos no Preço abaixo',
                                )}
                              </h3>
                              <ul className="leading-[1.45] text-[9.5pt] font-medium text-[#0f172a] space-y-1 break-words">
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
                          )
                        })()}
                      </section>
                    )}

                    {/* Commercial Conditions Section (R2: Tabela limpa e alinhada em tom profissional + R4: Cotação detalhada) */}
                    <section className="proposal-section mb-5 text-xs break-inside-avoid print:break-inside-auto">
                      <div className="flex items-center justify-between gap-2 mt-4 mb-1.5 pb-1.5 border-b border-slate-300 break-after-avoid">
                        <div className="flex items-center gap-2">
                          <span className="w-[3.5pt] h-[14pt] bg-[#0b3c26] rounded-xs inline-block" />
                          <h2 className="font-bold uppercase tracking-wider text-[#0b3c26] text-[12.5pt]">
                            {sectionCounter.nextLevel1('Preços')}
                          </h2>
                        </div>
                        <span className="text-[10pt] text-slate-500 font-medium">
                          {proposal.is_pacote ? 'Pacote de Máquinas' : 'Fornecimento Unitário'}
                        </span>
                      </div>

                      {/* R4: Bloco de Cotação de Moeda Estrangeira (PONTO 1: 4 decimais e texto "Cotação de fechamento de DD/MM/AAAA") */}
                      {(() => {
                        const moedaOrig = normalizeMoedaCode(
                          proposal.moeda_original || proposal.moeda || 'BRL',
                        )
                        const moedaProp = normalizeMoedaCode(proposal.moeda || 'BRL')
                        const hasRealConversion =
                          moedaProp !== moedaOrig && Boolean(proposal.cotacao_moeda)

                        if (!hasRealConversion) return null

                        const fmtPtax4 = (n: any) =>
                          (Number(n) || 0).toLocaleString('pt-BR', {
                            minimumFractionDigits: 4,
                            maximumFractionDigits: 4,
                          })

                        const rawData =
                          proposal.data_cotacao_moeda ||
                          (proposal as any)?.dados_snapshot?.data_cotacao_moeda
                        let dataFmt = ''
                        if (rawData) {
                          const s = String(rawData).trim()
                          if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) dataFmt = s
                          else if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
                            const [y, m, d] = s.split('T')[0].split('-')
                            if (y && m && d) dataFmt = `${d}/${m}/${y}`
                          } else {
                            dataFmt = s
                          }
                        }

                        return (
                          <div className="mb-3 p-2.5 bg-slate-50 border border-slate-300 rounded text-[11px] text-slate-800 flex flex-wrap items-center justify-between gap-2 break-inside-avoid">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900 uppercase tracking-wide text-[10px] bg-slate-200 px-1.5 py-0.5 rounded">
                                Câmbio / Cotação
                              </span>
                              <span>
                                Moeda da proposta: <strong>{moedaProp}</strong> (Original:{' '}
                                {moedaOrig})
                              </span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span>
                                Taxa aplicada:{' '}
                                <strong>
                                  1 {moedaProp} = R$ {fmtPtax4(proposal.cotacao_moeda)}
                                </strong>
                              </span>
                              {dataFmt && (
                                <span className="text-slate-600">
                                  <strong>Cotação de fechamento de {dataFmt}</strong>
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
                                if (!item) return null
                                const itemNome =
                                  item.versoes?.nome ||
                                  item.versoes?.nome_abreviado ||
                                  `Item ${idx + 1}`
                                const itemMoeda = normalizeMoedaCode(
                                  item.versoes?.moeda || proposal.moeda || 'BRL',
                                )
                                const qtd = Number(item.quantidade) || 1
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
                                  <tr
                                    key={item.id || idx}
                                    className="hover:bg-slate-50/70 align-middle"
                                  >
                                    <td className="text-center font-semibold text-slate-700">
                                      {idx + 1}
                                    </td>
                                    <td className="text-left font-bold text-slate-900 break-words leading-tight">
                                      {itemNome}
                                    </td>
                                    <td className="text-center font-medium text-slate-800">
                                      {qtd}
                                    </td>
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
                                <td className="text-center font-medium text-slate-800">
                                  {qtdProposta}
                                </td>
                                <td className="text-right font-semibold text-slate-900 whitespace-nowrap">
                                  {hasItemDiscount ||
                                  valorUnitarioMaquinaOrig > valorUnitarioMaquinaEfetivo ? (
                                    <div className="space-y-0.5">
                                      <span className="line-through text-slate-400 text-[9px] block whitespace-nowrap">
                                        {fmtCurrency(valorUnitarioMaquinaOrig, proposal.moeda)}
                                      </span>
                                      <span className="text-slate-900 block whitespace-nowrap font-bold">
                                        {fmtCurrency(valorUnitarioMaquinaEfetivo, proposal.moeda)}
                                      </span>
                                    </div>
                                  ) : (
                                    <span>
                                      {fmtCurrency(valorUnitarioMaquinaOrig, proposal.moeda)}
                                    </span>
                                  )}
                                </td>
                                <td className="text-right font-medium text-slate-700 whitespace-nowrap">
                                  {effectiveDiscountPercent > 0
                                    ? `${effectiveDiscountPercent}%`
                                    : '—'}
                                </td>
                                <td className="text-right font-bold text-slate-950 whitespace-nowrap">
                                  {hasItemDiscount ||
                                  valorOriginalMaquinaLimpo > valorMaquinaLimpoLinha ? (
                                    <div className="space-y-0.5">
                                      <span className="line-through text-slate-400 text-[9px] block whitespace-nowrap">
                                        {fmtCurrency(valorOriginalMaquinaLimpo, proposal.moeda)}
                                      </span>
                                      <span className="text-slate-900 block whitespace-nowrap font-extrabold">
                                        {fmtCurrency(valorMaquinaLimpoLinha, proposal.moeda)}
                                      </span>
                                    </div>
                                  ) : (
                                    <span>
                                      {fmtCurrency(valorMaquinaLimpoLinha, proposal.moeda)}
                                    </span>
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

                    {/* Acessórios Opcionais Não Inclusos no Preço Acima: seção própria numerada,
                        imediatamente após Valor Total / Condições Comerciais (espelho do servidor) */}
                    {(() => {
                      type AccItem = {
                        id?: string
                        nome?: string
                        valor?: number
                        moeda?: string
                        inclusao?: string
                        quantidade?: number
                      }
                      const rawAcc = Array.isArray(proposal.acessorios_proposta)
                        ? (proposal.acessorios_proposta as AccItem[])
                        : []
                      const naoInclusos = rawAcc.filter(
                        (a) =>
                          a &&
                          a.inclusao !== 'nao_exibir' &&
                          (a.inclusao === 'opcional' || a.inclusao === 'exibir'),
                      )
                      if (naoInclusos.length === 0) return null
                      const propMoeda = normalizeMoedaCode(proposal.moeda || 'BRL')

                      return (
                        <section className="proposal-section mb-5 text-xs break-inside-avoid print:break-inside-auto">
                          <div className="flex items-center justify-between gap-2 mt-4 mb-1.5 pb-1.5 border-b border-slate-300 break-after-avoid">
                            <div className="flex items-center gap-2">
                              <span className="w-[3.5pt] h-[14pt] bg-[#0b3c26] rounded-xs inline-block" />
                              <h2 className="font-bold uppercase tracking-wider text-[#0b3c26] text-[12.5pt]">
                                {sectionCounter.nextLevel1(
                                  'Acessórios Opcionais Não Inclusos no Preço Acima',
                                )}
                              </h2>
                            </div>
                          </div>
                          <ul className="leading-[1.45] text-[9.5pt] font-medium text-[#0f172a] space-y-1 break-words">
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
                        </section>
                      )
                    })()}

                    {/* Terms and conditions - layout vertical */}
                    {filteredTerms.length > 0 && (
                      <section className="proposal-section mb-5 print:mt-4 text-xs">
                        <div className="flex items-center justify-between gap-2 mt-4 mb-1.5 pb-1.5 border-b border-slate-300 break-after-avoid">
                          <div className="flex items-center gap-2">
                            <span className="w-[3.5pt] h-[14pt] bg-[#0b3c26] rounded-xs inline-block" />
                            <h2 className="font-bold uppercase tracking-wider text-[#0b3c26] text-[12.5pt]">
                              {sectionCounter.nextLevel1('Termos de Fornecimento')}
                            </h2>
                          </div>
                          <span className="text-[10pt] text-slate-500 font-medium">
                            Condições Gerais & Garantias
                          </span>
                        </div>
                        <div className="terms-section w-full block mb-4 space-y-3">
                          {filteredTerms.map(([label, value]) => (
                            <div
                              key={label}
                              className="term-item block w-full mb-3 print:break-inside-auto"
                            >
                              <div className="term-title block font-bold text-[#0b3c26] uppercase text-[10.5pt] tracking-[0.5px] mb-1 break-after-avoid">
                                {sectionCounter.nextLevel2(label)}
                              </div>
                              <div className="term-content block w-full text-black font-normal whitespace-pre-wrap leading-relaxed break-words text-xs sm:text-[13px]">
                                {renderMultilinhaParagraphs(value)}
                              </div>
                            </div>
                          ))}
                        </div>
                      </section>
                    )}

                    {/* Additional custom fields */}
                    {validCamposAdicionaisProposal.length > 0 && (
                      <section className="proposal-section mb-4 text-xs">
                        <div className="flex items-center justify-between gap-2 mt-4 mb-1.5 pb-1.5 border-b border-slate-300 break-after-avoid">
                          <div className="flex items-center gap-2">
                            <span className="w-[3.5pt] h-[14pt] bg-[#0b3c26] rounded-xs inline-block" />
                            <h2 className="font-bold uppercase tracking-wider text-[#0b3c26] text-[12.5pt]">
                              {sectionCounter.nextLevel1('Informações Adicionais')}
                            </h2>
                          </div>
                          <span className="text-[10pt] text-slate-500 font-medium">
                            Campos Específicos da Proposta
                          </span>
                        </div>
                        <div className="terms-section w-full block mb-4 space-y-3">
                          {validCamposAdicionaisProposal.map((field, i) => {
                            const fieldTitle = (
                              (field.titulo || field.chave || '') as string
                            ).trim()
                            const fieldVal = field.conteudo != null ? field.conteudo : field.valor
                            return (
                              <div
                                key={i}
                                className="term-item block w-full mb-3 print:break-inside-auto"
                              >
                                <div className="term-title block font-bold text-[#0b3c26] uppercase text-[10.5pt] tracking-[0.5px] mb-1 break-after-avoid">
                                  {sectionCounter.nextLevel2(fieldTitle)}
                                </div>
                                <div className="term-content block w-full text-slate-900 font-medium whitespace-pre-wrap leading-relaxed break-words text-[9.5pt] font-sans">
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
                                <th
                                  key={i}
                                  className="p-1 text-center border border-black font-bold"
                                >
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
                                <td
                                  key={i}
                                  className="p-1 border border-black text-center font-bold"
                                >
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
                        Antecipadamente agradecemos vossa honrosa preferência, permanecendo ao vosso
                        inteiro dispor, para dirimir e atender quaisquer eventuais esclarecimentos
                        adicionais que se fizerem necessários.
                      </p>
                      <p className="mt-3 text-left">Atenciosamente</p>
                    </section>

                    {/* Signatures section */}
                    <section className="proposal-signatures mt-6 break-inside-avoid">
                      <h2 className="font-bold uppercase tracking-wider text-black border-b border-black/40 pb-1 mb-3 text-xs break-after-avoid">
                        {sectionCounter.nextLevel1('De Acordo e Assinaturas')}
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

                  {/* Page 2 Footer on screen; in print, handled by proposal-running-footer */}
                  <div className="pt-4 border-t border-black text-center text-[10px] sm:text-[11px] leading-tight text-black mt-auto print:hidden">
                    <p className="font-normal">
                      Rua Iracema Lucas, 450 (Antiga Rua Parsch) - Distrito Industrial
                    </p>
                    <p className="font-normal">
                      Vinhedo - SP - Brasil - CEP: 13280-172 - Fone / Fax: (0**19) 3826-7373
                    </p>
                    <p className="font-normal">
                      E-mail: vendas@bener.com.br - Site: www.bener.com.br
                    </p>
                    <p className="text-right text-[10px] font-bold mt-1 text-black">
                      {estimatedTotalPages > 1
                        ? `Página 2 de ${estimatedTotalPages}`
                        : 'Página 1 de 1'}
                    </p>
                  </div>

                  {/* Numeração de página impressa via running-footer / margin-box do CSS */}
                </div>
              )}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}
