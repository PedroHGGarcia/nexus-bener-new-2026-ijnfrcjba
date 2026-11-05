/**
 * Builds a complete, standalone, styled HTML page for a proposal matching
 * the formal Bener document format. Aligned with the 9 PDF rules (v0.0.17).
 */

import { escapeHtml } from './escape-html.ts'
import { calcComissaoServicosBener, TEXTO_COMISSAO_BENER_VERBATIM } from './pdf-builder.ts'
const esc = escapeHtml

export function normalizeMoedaCode(raw?: string | null): string {
  if (!raw) return 'BRL'
  const c = raw.trim().toUpperCase()
  if (c === 'USD' || c === 'DOLAR' || c === 'DÓLAR') return 'USD'
  if (c === 'EUR' || c === 'EURO') return 'EUR'
  if (c === 'CHF' || c === 'FRANCO' || c.startsWith('FRANCO')) return 'CHF'
  if (c === 'BRL' || c === 'REAL' || c === 'REAIS' || c === 'R$') return 'BRL'
  return c
}

export function formatCurrencyByMoeda(
  value: number | string | null | undefined,
  moeda: string = 'BRL',
): string {
  const num = typeof value === 'string' ? parseFloat(value) : (value ?? 0)
  const normMoeda = normalizeMoedaCode(moeda)
  const formatted = (isNaN(num as number) ? 0 : (num as number)).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  switch (normMoeda) {
    case 'USD':
      return `US$ ${formatted}`
    case 'EUR':
      return `€ ${formatted}`
    case 'CHF':
      return `CHF ${formatted}`
    case 'BRL':
    default:
      return `R$ ${formatted}`
  }
}

export function formatPrecoEspecialDiscountBadge(
  valorOriginal: number | null | undefined,
  precoEspecial: number | null | undefined,
): string | null {
  if (
    valorOriginal == null ||
    precoEspecial == null ||
    isNaN(Number(valorOriginal)) ||
    isNaN(Number(precoEspecial))
  ) {
    return null
  }
  const orig = Number(valorOriginal)
  const esp = Number(precoEspecial)
  if (orig <= 0 || esp <= 0 || esp >= orig) return null
  const rawPercent = ((orig - esp) / orig) * 100
  if (rawPercent <= 0) return null
  const rounded = Math.round(rawPercent * 10) / 10
  if (rounded <= 0) return null
  const formatted = Number.isInteger(rounded)
    ? String(rounded)
    : rounded.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
  return `−${formatted}%`
}

export function segmentParagraphMarkers(raw: string | null | undefined): string {
  if (raw == null) return ''
  const text = String(raw).replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  if (!text.trim()) return ''

  const lines = text.split('\n')
  const processedLines: string[] = []

  for (const line of lines) {
    const trimmedLine = line.trim()
    if (!trimmedLine) {
      processedLines.push('')
      continue
    }

    const cuts: number[] = []

    const bMatches = trimmedLine.matchAll(/<b\b[^>]*>/gi)
    for (const match of bMatches) {
      if (match.index !== undefined && match.index > 0 && !cuts.includes(match.index)) {
        cuts.push(match.index)
      }
    }

    let bulletIdx = trimmedLine.indexOf('•')
    while (bulletIdx !== -1) {
      if (bulletIdx > 0 && !cuts.includes(bulletIdx)) {
        cuts.push(bulletIdx)
      }
      bulletIdx = trimmedLine.indexOf('•', bulletIdx + 1)
    }

    const pontoMatches = trimmedLine.matchAll(
      /(?:^|[\s.;,])(p[oó]nto\s+\d{1,3}(?:[:\s\-)–—.]|$))/gi,
    )
    for (const match of pontoMatches) {
      if (match.index !== undefined) {
        const fullMatch = match[0]
        const captured = match[1]
        const offset = fullMatch.indexOf(captured)
        const startIdx = match.index + offset
        if (startIdx > 0 && !cuts.includes(startIdx)) {
          cuts.push(startIdx)
        }
      }
    }

    const numberedMatches = trimmedLine.matchAll(
      /(?:^|[\s.;,])(\d{1,2}(?:\.(?!\d)(?:\s+|[A-Za-zÀ-ÿ]|$)|[)\-–—](?:\s+|$|[A-Za-zÀ-ÿ])))/g,
    )
    for (const match of numberedMatches) {
      if (match.index !== undefined) {
        const fullMatch = match[0]
        const captured = match[1]
        const offset = fullMatch.indexOf(captured)
        const startIdx = match.index + offset

        if (startIdx > 0) {
          const prefix = trimmedLine.slice(Math.max(0, startIdx - 15), startIdx).toLowerCase()
          const isExcluded =
            /(?:n[.°º]|nº|art(?:igo|\.)?|lei|dec(?:reto|\.)?|r\$|us\$|€)\s*$/i.test(prefix)

          if (!isExcluded && !cuts.includes(startIdx)) {
            cuts.push(startIdx)
          }
        }
      }
    }

    if (cuts.length === 0) {
      processedLines.push(trimmedLine)
      continue
    }

    cuts.sort((a, b) => a - b)
    let lastCut = 0
    for (const cut of cuts) {
      const part = trimmedLine.slice(lastCut, cut).trim()
      if (part) {
        processedLines.push(part)
      }
      lastCut = cut
    }
    const remainder = trimmedLine.slice(lastCut).trim()
    if (remainder) {
      processedLines.push(remainder)
    }
  }

  return processedLines.join('\n')
}

function stripBoldMarkers(raw: string | number | null | undefined): string {
  if (raw == null) return ''
  return String(raw)
    .replace(/<\/?b\b[^>]*>/gi, '')
    .trim()
}

interface FormattedParagraph {
  title?: string
  body: string
}

function parseParagraphs(raw: string | number | null | undefined): FormattedParagraph[] {
  if (raw == null) return []
  const str = String(raw).trim()
  if (!str) return []

  const segmented = segmentParagraphMarkers(str)
  const lines = segmented
    .split(/\r?\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0)

  if (lines.length === 0) return []

  const results: FormattedParagraph[] = []
  const boldWithCloseRegex =
    /^(?:(\d{1,2}[.)\-–—]|•|p[oó]nto\s+\d{1,3}[:.\-–—]?)\s*)?<b\b[^>]*>([\s\S]*?)<\/b\s*>(.*)$/i
  const unclosedBoldRegex =
    /^(?:(\d{1,2}[.)\-–—]|•|p[oó]nto\s+\d{1,3}[:.\-–—]?)\s*)?<b\b[^>]*>([\s\S]*)$/i

  for (const line of lines) {
    const matchClosed = line.match(boldWithCloseRegex)
    if (matchClosed) {
      const prefix = (matchClosed[1] || '').trim()
      const rawTitle = (matchClosed[2] || '').trim()
      const rawBody = (matchClosed[3] || '').trim()
      const cleanTitle = stripBoldMarkers(prefix ? `${prefix} ${rawTitle}` : rawTitle)
      const cleanBody = stripBoldMarkers(rawBody)
      results.push({
        title: cleanTitle || undefined,
        body: cleanBody,
      })
      continue
    }

    const matchUnclosed = line.match(unclosedBoldRegex)
    if (matchUnclosed) {
      const prefix = (matchUnclosed[1] || '').trim()
      const rawTitle = (matchUnclosed[2] || '').trim()
      const cleanTitle = stripBoldMarkers(prefix ? `${prefix} ${rawTitle}` : rawTitle)
      results.push({
        title: cleanTitle || undefined,
        body: '',
      })
      continue
    }

    const isMarkerStart = /^(?:\d{1,2}[.)\-–—]|•|p[oó]nto\s+\d{1,3}[:.\-–—]?)/i.test(line)
    const prev = results[results.length - 1]
    if (prev && prev.title && !prev.body && !isMarkerStart) {
      prev.body = stripBoldMarkers(line)
    } else {
      results.push({
        body: stripBoldMarkers(line),
      })
    }
  }

  return results
}

export function renderMultilinhaHtml(raw: string | null | undefined, extraClass = ''): string {
  const paragraphs = parseParagraphs(raw)
  if (paragraphs.length === 0) return ''

  const cls = extraClass ? `paragraph-item ${extraClass}` : 'paragraph-item'

  if (paragraphs.length === 1 && !paragraphs[0].title) {
    return esc(paragraphs[0].body)
  }

  return paragraphs
    .map((p) => {
      const titleHtml = p.title
        ? `<strong class="paragraph-title" style="display:block;font-weight:700;color:#0b3c26;margin-bottom:2px;-webkit-print-color-adjust:exact;print-color-adjust:exact;">${esc(p.title)}</strong>`
        : ''
      const bodyHtml = p.body ? `<span>${esc(p.body)}</span>` : ''
      return `<p class="${cls}">${titleHtml}${bodyHtml}</p>`
    })
    .join('')
}

function isTaxValEmpty(val: unknown, columnLabel?: string): boolean {
  if (val == null) return true
  const s = String(val).trim().toLowerCase()
  if (
    !s ||
    s === '-' ||
    s === '—' ||
    s === 'n/a' ||
    s === '0' ||
    s === '0%' ||
    s === '0,00%' ||
    s === '0.00%'
  )
    return true
  const clean = s.replace(/[:\-–—.,;!?]+$/g, '').trim()
  const compact = clean.replace(/[^a-z0-9]/g, '')
  if (
    compact === 'impostoipi' ||
    compact === 'ipi' ||
    compact === 'impostoicms' ||
    compact === 'icms'
  ) {
    return true
  }
  if (columnLabel) {
    const colCompact = columnLabel.toLowerCase().replace(/[^a-z0-9]/g, '')
    if (compact && colCompact && compact === colCompact) return true
  }
  return false
}

function isCommercialEmpty(val: unknown, columnLabel?: string): boolean {
  if (val == null) return true
  if (typeof val === 'string') {
    const s = val.trim()
    if (!s || s === '-' || s === '—' || s.toLowerCase() === 'n/a') return true
    if (columnLabel) {
      const normVal = s
        .toLowerCase()
        .replace(/[:\-–—.,;!?]+$/g, '')
        .replace(/[^a-z0-9]/g, '')
      const normCol = columnLabel
        .toLowerCase()
        .replace(/[:\-–—.,;!?]+$/g, '')
        .replace(/[^a-z0-9]/g, '')
      if (normVal && normCol && normVal === normCol) return true
    }
  }
  return false
}

function renderBulletList(text: string | null | undefined): string {
  if (!text) return ''
  const trimmed = text.trim()
  if (!trimmed) return ''
  if (!trimmed.includes('•')) {
    return esc(trimmed)
  }
  const parts = trimmed.split('•')
  const items: string[] = []
  parts.forEach((part, index) => {
    const item = part.trim()
    if (!item) return
    if (index === 0 && !trimmed.startsWith('•')) {
      items.push(esc(item))
    } else {
      items.push(`• ${esc(item)}`)
    }
  })
  return items.join('\n')
}

export function buildPublicProposalHtml(
  proposta: any,
  _publicAppUrl: string = 'https://nexus.bener.com.br',
  _creatorInfo?: any,
  _projectCreator?: any,
  tipoProposta?: Record<string, unknown> | null,
  equipmentItems?: any[] | null,
  logoUrlOverride?: string | null,
): string {
  const c = proposta.clientes

  // Normalização de Moeda (Regras 1 e 2)
  const moedaProp = normalizeMoedaCode(proposta.moeda || 'BRL')
  const moedaOrig = normalizeMoedaCode(proposta.moeda_original || proposta.moeda || 'BRL')
  const hasRealConversion = moedaProp !== moedaOrig && Boolean(proposta.cotacao_moeda)

  // Snapshot congelado (Regra 9)
  const dadosSnapshot = proposta.dados_snapshot as Record<string, any> | null
  const tpOverride =
    (proposta.tipo_proposta_override as Record<string, any> | null) ||
    (dadosSnapshot?.tipo_proposta_override as Record<string, any> | null) ||
    null
  const tpSnapshot =
    tpOverride ||
    (dadosSnapshot?.tipo_proposta_detalhes as Record<string, any>) ||
    (tipoProposta as Record<string, any>) ||
    null

  const primaryFromSnapshot = dadosSnapshot?.primary_versao
  const primaryItem = (equipmentItems && equipmentItems[0]) || {}
  const primaryVersao = primaryFromSnapshot || primaryItem.versoes || proposta.versoes || {}

  const machineTitle = (
    primaryVersao?.nome ||
    primaryVersao?.nome_abreviado ||
    proposta.versao_original ||
    proposta.descricao_proposta ||
    'EQUIPAMENTO INDUSTRIAL'
  ).toUpperCase()

  const machineImage = primaryVersao?.imagem_preview || proposta.versoes?.imagem_preview || ''

  const clientCompanyName = c?.razao_social || c?.fantasia || proposta.cliente_original || 'Cliente'
  const clientStreet = [c?.logradouro, c?.numero].filter(Boolean).join(', ')
  const clientAddressLine = [
    clientStreet,
    c?.complementos,
    c?.bairro,
    c?.cidade ? `${c.cidade}${c.estado ? ` - ${c.estado}` : ''}` : c?.estado,
  ]
    .filter(Boolean)
    .join(' - ')
  const clientPhone = c?.telefone || proposta.telefone || ''
  const clientEmail = c?.email || ''
  const contactName = c?.contato || proposta.contato || ''

  const rawIpiVal =
    proposta.imposto_ipi != null && !isTaxValEmpty(proposta.imposto_ipi, 'Imposto IPI')
      ? `${proposta.imposto_ipi}${String(proposta.imposto_ipi).includes('%') ? '' : '%'}`
      : tpSnapshot?.imposto_ipi != null && !isTaxValEmpty(tpSnapshot.imposto_ipi, 'Imposto IPI')
        ? `${tpSnapshot.imposto_ipi}${String(tpSnapshot.imposto_ipi).includes('%') ? '' : '%'}`
        : null

  const rawIcmsVal =
    proposta.imposto_icms != null && !isTaxValEmpty(proposta.imposto_icms, 'Imposto ICMS')
      ? `${proposta.imposto_icms}${String(proposta.imposto_icms).includes('%') ? '' : '%'}`
      : tpSnapshot?.imposto_icms != null && !isTaxValEmpty(tpSnapshot.imposto_icms, 'Imposto ICMS')
        ? `${tpSnapshot.imposto_icms}${String(tpSnapshot.imposto_icms).includes('%') ? '' : '%'}`
        : null

  // Regra 9: Termos do Tipo de Proposta
  const terms: Array<[string, string | null | undefined]> = [
    ['Condições de Pagamento', proposta.condicoes_pagamento || tpSnapshot?.condicoes_pagamento],
    ['Prazo de Entrega', proposta.prazo_entrega || tpSnapshot?.prazo_entrega],
    ['Validade da Oferta', proposta.validade_oferta || tpSnapshot?.validade_oferta],
    ['Cobertura de Garantia', proposta.cobertura_garantia],
    ['Garantia de Acessórios', proposta.garantia_acessorios || tpSnapshot?.garantia],
    ['Normas Aplicáveis', proposta.normas_aplicaveis],
    ['Normas de Segurança', proposta.normas_seguranca],
    ['Certificações', proposta.certificacoes],
    [
      'Assistência Técnica',
      proposta.assistencia_tecnica_detalhada || tpSnapshot?.assistencia_tecnica,
    ],
    ['Critérios de Aceitação', proposta.criterios_aceitacao],
    ['Materiais Utilizados', proposta.materiais_utilizados],
    ['Transporte/Seguro', proposta.transporte_seguro || tpSnapshot?.transporte_seguro],
    ['Imposto IPI', rawIpiVal],
    ['Imposto ICMS', rawIcmsVal],
    ['Treinamento Técnico', proposta.treinamento_tecnico || tpSnapshot?.treinamento_tecnico],
  ]

  if (tpSnapshot?.campos_adicionais) {
    try {
      const extras =
        typeof tpSnapshot.campos_adicionais === 'string'
          ? JSON.parse(tpSnapshot.campos_adicionais)
          : tpSnapshot.campos_adicionais
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
            if (lbl && !isCommercialEmpty(val)) {
              terms.push([lbl, val])
            }
          },
        )
      } else if (extras && typeof extras === 'object') {
        Object.entries(extras as Record<string, string | number | null | undefined>).forEach(
          ([lbl, rawVal]) => {
            const cleanLbl = (lbl || '').trim()
            if (cleanLbl && !isCommercialEmpty(rawVal)) {
              terms.push([cleanLbl, String(rawVal).trim()])
            }
          },
        )
      }
    } catch {
      // ignore
    }
  }

  const filteredTerms = terms.filter(([lbl, val]) => {
    if (isCommercialEmpty(val, lbl)) return false
    const lower = lbl.toLowerCase()
    if (lower.includes('ipi') || lower.includes('icms') || lower.includes('imposto')) {
      return !isTaxValEmpty(val, lbl)
    }
    return true
  }) as Array<[string, string | null | undefined]>

  // Informações adicionais da proposta (fora do tipo) (Regra 9)
  const snapshotCampos = dadosSnapshot?.campos_adicionais
  let parsedCamposAdicionais: any[] = []
  const rawCamposAdicionais =
    Array.isArray(snapshotCampos) && snapshotCampos.length > 0
      ? snapshotCampos
      : proposta.campos_adicionais
  if (Array.isArray(rawCamposAdicionais)) {
    parsedCamposAdicionais = rawCamposAdicionais
  } else if (typeof rawCamposAdicionais === 'string') {
    try {
      const p = JSON.parse(rawCamposAdicionais)
      if (Array.isArray(p)) parsedCamposAdicionais = p
    } catch {
      // ignore
    }
  }
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

  const validCamposAdicionais = parsedCamposAdicionais.filter((f) => {
    if (!f) return false
    const fTitle = String(f.titulo || f.chave || '').trim()
    const fContent = f.conteudo != null ? f.conteudo : f.valor
    if (!fTitle && !fContent) return false
    if (isCommercialEmpty(fContent)) return false
    const fKey = normCampoKey(f.chave || f.id || f.titulo)
    if (fKey && renderedCampoKeys.has(fKey)) return false
    if (fKey) renderedCampoKeys.add(fKey)
    return true
  })

  const valorFinal = Number(proposta.valor_final ?? proposta.valor_atual ?? 0)
  const precoEspecial =
    proposta.preco_especial != null && Number(proposta.preco_especial) > 0
      ? Number(proposta.preco_especial)
      : null
  const discountBadge = formatPrecoEspecialDiscountBadge(valorFinal, precoEspecial)
  const valorSemDesc =
    proposta.valor_sem_desconto != null && Number(proposta.valor_sem_desconto) > 0
      ? Number(proposta.valor_sem_desconto)
      : valorFinal
  const descPerc = Number(proposta.percentual_desconto || 0)

  const hasItemDiscount =
    descPerc > 0 || (precoEspecial != null && precoEspecial > 0) || valorSemDesc > valorFinal
  const valorOriginalTabela =
    valorSemDesc > 0 ? valorSemDesc : valorFinal > 0 ? valorFinal : precoEspecial || 0
  const valorEfetivoFinal = precoEspecial != null && precoEspecial > 0 ? precoEspecial : valorFinal
  const valorUnitarioEfetivo = valorFinal > 0 ? valorFinal : valorEfetivoFinal
  const effectiveDiscountPercent =
    descPerc > 0
      ? descPerc
      : precoEspecial != null &&
          precoEspecial > 0 &&
          valorOriginalTabela > 0 &&
          precoEspecial < valorOriginalTabela
        ? Math.round(((valorOriginalTabela - precoEspecial) / valorOriginalTabela) * 100 * 10) / 10
        : 0

  // Derivação de dados para o cabeçalho institucional unificado
  const rawRepNome =
    proposta.representantes?.fantasia ||
    proposta.representantes?.sigla ||
    proposta.nome_representante_comercial ||
    proposta.representante_original ||
    proposta.user ||
    ''
  const firstWord = rawRepNome.trim().split(/\s+/)[0] || ''
  const siglaRepr = firstWord
    ? firstWord.charAt(0).toUpperCase() + firstWord.slice(1).toLowerCase()
    : '—'

  const dCad = proposta.dt_cad
    ? new Date(proposta.dt_cad + (String(proposta.dt_cad).includes('T') ? '' : 'T12:00:00'))
    : new Date()
  const mesOferta = String(dCad.getMonth() + 1).padStart(2, '0')
  const anoOferta = String(dCad.getFullYear())

  // Formatação de data com cidade: "Vinhedo, 22 de outubro de 2026" (Regra 5)
  const formattedDateWithCity = (() => {
    const dtStr = dCad.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    })
    return `Vinhedo, ${dtStr}`
  })()

  const numeroBase = (proposta.numero_proposta || '').trim() || '—'
  const numeroCompleto = proposta.revisao ? `${numeroBase} (Rev. ${proposta.revisao})` : numeroBase

  const renderInstitutionalHeaderHtml = () => `
    <div class="proposal-institutional-header" style="border-bottom:1px solid #000;padding-bottom:10px;margin-bottom:14px;page-break-inside:avoid;break-inside:avoid;page-break-after:avoid;break-after:avoid;">
      <div style="display:flex;justify-content:space-between;align-items:stretch;gap:16px;">
        <div style="display:flex;flex-direction:column;align-items:flex-start;">
          ${
            logoUrlOverride
              ? `<img src="${esc(logoUrlOverride)}" alt="BENER - MÁQUINAS QUE TRANSFORMAM" style="width:60mm;height:auto;max-width:62mm;max-height:27mm;object-fit:contain;" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';" /><div style="display:none;flex-direction:column;"><span style="font-size:24px;font-weight:800;letter-spacing:2px;color:#0b3c26;line-height:1;">BENER</span><span style="font-size:9px;font-weight:600;letter-spacing:1px;color:#0b3c26;text-transform:uppercase;margin-top:2px;">MÁQUINAS QUE TRANSFORMAM</span></div>`
              : `<img src="https://ugnhnbfogxbcptprsfot.supabase.co/storage/v1/object/public/propostas-files/bener-header-logo.png" alt="BENER - MÁQUINAS QUE TRANSFORMAM" style="width:60mm;height:auto;max-width:62mm;max-height:27mm;object-fit:contain;" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';" /><div style="display:none;flex-direction:column;"><span style="font-size:24px;font-weight:800;letter-spacing:2px;color:#0b3c26;line-height:1;">BENER</span><span style="font-size:9px;font-weight:600;letter-spacing:1px;color:#0b3c26;text-transform:uppercase;margin-top:2px;">MÁQUINAS QUE TRANSFORMAM</span></div>`
          }
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;text-align:right;color:#000;font-size:11px;line-height:1.35;flex-shrink:0;">
          <div style="font-weight:bold;font-size:12px;">Bener Comercial Importadora Exportadora Ltda.</div>
          <div style="margin-top:2px;">${esc(formattedDateWithCity)}</div>
          <div style="margin-top:auto;padding-top:8px;">
        <table style="width:auto;min-width:280px;max-width:340px;border-collapse:collapse;border:1px solid #000;margin:0;font-size:9.5px;line-height:1.2;background:#fff;">
          <thead>
            <tr style="background:#fff;border-bottom:1px solid #000;">
              <th style="padding:2px 6px;text-align:center;font-weight:bold;border:1px solid #000;width:55px;">Sigla</th>
              <th style="padding:2px 8px;text-align:center;font-weight:bold;border:1px solid #000;min-width:130px;width:130px;">N° Oferta</th>
              <th style="padding:2px 6px;text-align:center;font-weight:bold;border:1px solid #000;width:40px;">Mês</th>
              <th style="padding:2px 6px;text-align:center;font-weight:bold;border:1px solid #000;width:45px;">Ano</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="padding:3px 6px;text-align:center;border:1px solid #000;">${esc(siglaRepr)}</td>
              <td style="padding:3px 8px;text-align:center;font-weight:bold;border:1px solid #000;white-space:nowrap;min-width:130px;font-size:${numeroCompleto.length > 18 ? '7.5px' : numeroCompleto.length > 13 ? '8.5px' : '9.5px'};">${esc(numeroCompleto)}</td>
              <td style="padding:3px 6px;text-align:center;border:1px solid #000;">${esc(mesOferta)}</td>
              <td style="padding:3px 6px;text-align:center;border:1px solid #000;">${esc(anoOferta)}</td>
            </tr>
          </tbody>
        </table>
          </div>
        </div>
      </div>
    </div>
  `

  // Regra 6: Paginação adaptativa sem gerar páginas em branco
  const hasPage2Content =
    Boolean(
      primaryVersao?.especificacoes_tecnicas ||
      proposta.especificacoes_tecnicas ||
      proposta.descricao_proposta,
    ) ||
    Boolean(primaryVersao?.caracteristicas_construtivas) ||
    Boolean(primaryVersao?.acessorios_standards) ||
    (Array.isArray(proposta.acessorios_proposta) && proposta.acessorios_proposta.length > 0) ||
    filteredTerms.length > 0 ||
    validCamposAdicionais.length > 0 ||
    Boolean(proposta.is_pacote && equipmentItems && equipmentItems.length > 0)

  const totalPaginas = hasPage2Content ? 2 : 1
  const page1Number = `Página 1 de ${totalPaginas}`
  const page2Number = `Página 2 de 2`

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Proposta ${esc(proposta.numero_proposta || '')} — Bener</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 0;
      background: #f1f5f9;
      color: #000;
      font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
      font-size: 13px;
      line-height: 1.5;
    }
    .page-container {
      max-width: 210mm;
      margin: 20px auto;
      background: #fff;
      box-shadow: 0 4px 20px rgba(0,0,0,0.08);
    }
    .print-bar {
      max-width: 210mm;
      margin: 20px auto 0 auto;
      text-align: right;
    }
    .print-btn {
      background: #0b3c26;
      color: #fff;
      border: none;
      padding: 8px 16px;
      font-family: inherit;
      font-size: 13px;
      font-weight: 600;
      border-radius: 4px;
      cursor: pointer;
    }
    .page {
      min-height: auto;
      padding: 45px 50px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      box-sizing: border-box;
      background: #fff;
      page-break-inside: auto;
      break-inside: auto;
    }
    .page ~ .page {
    }
    .page:last-child {
      page-break-after: auto;
      break-after: auto;
    }
    .page-divider {
      border-top: 2px dashed #cbd5e1;
    }
    .proposal-top-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 1px solid #000;
      padding-bottom: 10px;
      margin-bottom: 14px;
      page-break-inside: avoid;
      break-inside: avoid;
      page-break-after: avoid;
      break-after: avoid;
    }
    .bener-logo-text {
      font-size: 24px;
      font-weight: 800;
      letter-spacing: 2px;
      color: #0b3c26;
    }
    .bener-logo-img {
      width: 60mm;
      height: auto;
      max-width: 62mm;
      max-height: 27mm;
      object-fit: contain;
    }
    .proposal-number-box {
      border: 1px solid #000;
      padding: 6px 10px;
      text-align: right;
      font-size: 10.5px;
      color: #000;
      min-width: 190px;
      max-width: 320px;
      white-space: normal;
      word-break: break-word;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .proposal-number-box p {
      margin: 1px 0;
      font-size: 10.5px;
      white-space: normal;
      word-break: break-word;
    }
    .proposal-number-box .prop-title {
      font-size: 12px;
      font-weight: 700;
      margin-bottom: 2px;
    }
    .client-header {
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .client-header p { margin: 1.5px 0; }
    .client-name { font-weight: bold; font-size: 13.5px; }
    .reception-text {
      margin-top: 10px !important;
      text-align: justify;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .reception-text p { margin: 4px 0 !important; }
    .machine-presentation-block {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    .machine-title {
      text-align: center;
      margin: 8px 0 8px !important;
      font-size: 14.5pt !important;
      line-height: 1.2 !important;
      font-weight: bold;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      color: #0b3c26;
      page-break-inside: avoid;
      break-inside: avoid;
      page-break-after: avoid !important;
      break-after: avoid !important;
    }
    .image-container {
      text-align: center;
      margin: 6px 0 !important;
      page-break-before: avoid !important;
      page-break-inside: avoid !important;
      break-before: avoid !important;
      break-inside: avoid !important;
    }
    .machine-img {
      display: block !important;
      margin: 0 auto !important;
      width: auto !important;
      max-height: 230px !important;
      max-width: 100% !important;
      object-fit: contain !important;
    }
    .proposal-cover .image-container {
      width: 100% !important;
      height: 105mm !important;
      min-height: 105mm !important;
      max-height: 105mm !important;
      display: flex !important;
      flex-direction: column !important;
      align-items: center !important;
      justify-content: center !important;
      text-align: center !important;
      margin: 6mm 0 2mm !important;
      page-break-before: avoid !important;
      page-break-inside: avoid !important;
      break-before: avoid !important;
      break-inside: avoid !important;
      overflow: hidden !important;
    }
    .proposal-cover .machine-img {
      display: block !important;
      width: auto !important;
      max-width: 145mm !important;
      height: auto !important;
      max-height: 92mm !important;
      object-fit: contain !important;
      margin: 0 auto !important;
    }
    .image-caption,
    .proposal-cover .image-caption {
      font-size: 9px !important;
      font-style: italic;
      color: #444;
      margin-top: 3mm !important;
    }
    .footer {
      border-top: 1px solid #000;
      padding-top: 6px;
      text-align: center;
      font-size: 9.5px;
      line-height: 1.35;
      margin-top: auto;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .footer p { margin: 1px 0; }
    .page-number {
      text-align: right;
      font-size: 11px;
      font-weight: bold;
      margin-top: 6px;
    }

    .section-heading {
      font-size: 12.5pt;
      font-weight: bold;
      color: #0b3c26;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      border-bottom: 0.5pt solid #cbd5e1;
      padding-bottom: 5px;
      margin: 16px 0 5px 0;
      page-break-after: avoid;
      break-after: avoid;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 11px;
      margin-bottom: 12px;
      page-break-inside: auto;
      break-inside: auto;
    }
    tr {
      page-break-inside: avoid;
      break-inside: avoid;
    }
    table, th, td {
      border: 1px solid #000;
    }
    th, td {
      padding: 6px;
    }
    th { background: #f1f5f9; font-weight: 700; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .signatures-grid {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 16px;
      margin-top: 32px;
      text-align: center;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .sig-line {
      border-top: 1px solid #000;
      padding-top: 4px;
      margin-top: 36px;
      font-size: 11px;
    }
    .term-value p, .tipo-field-value p, p.paragraph-item {
      margin: 0 0 4px 0;
      line-height: 1.35;
    }
    .term-value p:last-child, .tipo-field-value p:last-child, p.paragraph-item:last-child {
      margin-bottom: 0;
    }
    .paragraph-title {
      display: block;
      font-weight: 700;
      color: #0b3c26;
      margin-bottom: 2px;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    @page {
      size: A4 portrait;
      margin: 43mm 12mm 20mm 12mm;
    }

    .proposal-running-header {
      display: none;
    }
    .proposal-running-footer {
      display: none;
    }

    @media print {
      html, body {
        background: #fff !important;
        margin: 0 !important;
        padding: 0 !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      .print-bar { display: none !important; }
      .page-container {
        box-shadow: none !important;
        margin: 0 auto !important;
        width: 100% !important;
        max-width: 100% !important;
      }
      .page-container,
      .page {
        min-height: auto !important;
        height: auto !important;
      }
      .page-screen-header {
        display: none !important;
      }
      .page-screen-footer {
        display: none !important;
      }
      .proposal-running-header {
        display: block !important;
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        right: 0 !important;
        height: 38mm !important;
        background: #ffffff !important;
        z-index: 9999 !important;
        box-sizing: border-box !important;
      }
      .proposal-running-footer {
        display: block !important;
        position: fixed !important;
        bottom: 0 !important;
        left: 0 !important;
        right: 0 !important;
        height: 16mm !important;
        background: #ffffff !important;
        z-index: 9999 !important;
        box-sizing: border-box !important;
        border-top: 1px solid #000 !important;
        padding-top: 4px !important;
        text-align: center !important;
        font-size: 8.5px !important;
        line-height: 1.35 !important;
        color: #000 !important;
      }
      .page-container > :first-child,
      .page[data-page="1"],
      [data-page="1"],
      [data-sheet-index="0"] {
        break-before: avoid !important;
        page-break-before: avoid !important;
        margin-top: 0 !important;
        padding-top: 0 !important;
      }

      .page {
        box-sizing: border-box !important;
        width: 100% !important;
        max-width: 100% !important;
        padding: 0 !important;
        margin: 0 !important;
        page-break-inside: auto !important;
        break-inside: auto !important;
      }
      /* Única quebra explícita entre capa e detalhes através do .page-divider;
         evitar page-break-after aqui para não duplicar quebra gerando folha vazia */
      .page:not(:last-child) {
        page-break-after: auto !important;
        break-after: auto !important;
      }
      .page-divider {
        page-break-before: always !important;
        break-before: page !important;
        page-break-inside: auto !important;
        break-inside: auto !important;
        border: none !important;
      }
      .page-divider > div {
        page-break-inside: auto !important;
        break-inside: auto !important;
      }
      .page:last-child {
        page-break-after: auto !important;
        break-after: auto !important;
        margin-bottom: 0 !important;
        padding-bottom: 0 !important;
      }
      .page:last-child > *:last-child {
        margin-bottom: 0 !important;
      }
      table {
        table-layout: fixed !important;
        width: 100% !important;
        max-width: 100% !important;
        word-break: break-word;
      }

      .proposal-cover .image-container {
        width: 100% !important;
        height: 105mm !important;
        min-height: 105mm !important;
        max-height: 105mm !important;
        display: flex !important;
        flex-direction: column !important;
        align-items: center !important;
        justify-content: center !important;
        text-align: center !important;
        margin: 6mm 0 2mm !important;
        page-break-before: avoid !important;
        page-break-inside: avoid !important;
        break-before: avoid !important;
        break-inside: avoid !important;
        overflow: hidden !important;
      }

      .proposal-cover .machine-img {
        display: block !important;
        width: auto !important;
        max-width: 145mm !important;
        height: auto !important;
        max-height: 92mm !important;
        object-fit: contain !important;
        margin: 0 auto !important;
      }

      .proposal-cover .image-caption {
        margin-top: 3mm !important;
        font-size: 9px !important;
      }
    }
  </style>
</head>
<body>
  <div class="print-bar">
    <button class="print-btn" onclick="window.print()">Imprimir / Salvar PDF</button>
  </div>

  <!-- Cabeçalho nativo repetido em TODAS as folhas na impressão (@media print via position fixed) -->
  <div class="proposal-running-header">
    ${renderInstitutionalHeaderHtml()}
  </div>

  <!-- Rodapé nativo com contador real "Página X de Y" repetido em TODAS as folhas na impressão -->
  <div class="proposal-running-footer">
    <p style="margin:0;">Rua Iracema Lucas, 450 (Antiga Rua Parsch) - Distrito Industrial</p>
    <p style="margin:0;">Vinhedo - SP - Brasil - CEP: 13280-172 - Fone / Fax: (0**19) 3826-7373</p>
    <p style="margin:0;">E-mail: vendas@bener.com.br - Site: www.bener.com.br</p>

  </div>

  <div class="page-container">
    <!-- PAGE 1: COVER -->
    <div class="page proposal-cover" data-sheet-index="0" data-page="1" style="break-before: avoid !important; page-break-before: avoid !important; margin-top: 0 !important; padding-top: 0 !important;">
      <div>
        <div style="page-break-inside:avoid;break-inside:avoid;">
          <!-- Top Header na tela (oculto no print pelo .page-screen-header) -->
          <div class="page-screen-header">
            ${renderInstitutionalHeaderHtml()}
          </div>

          <div class="client-header">
            <p>À</p>
            <p class="client-name">${esc(clientCompanyName)}</p>
            ${clientAddressLine ? `<p>${esc(clientAddressLine)}</p>` : ''}
            ${clientPhone ? `<p>Telefone: ${esc(clientPhone)}</p>` : ''}
            ${clientEmail ? `<p>E-mail: ${esc(clientEmail)}</p>` : ''}
            ${
              hasRealConversion
                ? (() => {
                    const fmtPtax4 = (n: any) =>
                      (Number(n) || 0).toLocaleString('pt-BR', {
                        minimumFractionDigits: 4,
                        maximumFractionDigits: 4,
                      })
                    const rawData = proposta.data_cotacao_moeda || dadosSnapshot?.data_cotacao_moeda
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
                    const dataTxt = dataFmt
                      ? ` &bull; <strong>Cotação de fechamento de ${esc(dataFmt)}</strong>`
                      : ''
                    return `<p style="font-size:11px;color:#334155;margin-top:4px;"><strong>Moeda da Proposta:</strong> ${esc(moedaProp)} &bull; <strong>Cotação:</strong> 1 ${esc(moedaProp)} = R$ ${fmtPtax4(proposta.cotacao_moeda)}${dataTxt}</p>`
                  })()
                : ''
            }
            <p style="padding-top: 6px;">A/C: <strong>${esc(contactName || 'Diretor / Gerente de Compras')}</strong></p>
          </div>

          <div class="reception-text">
            <p>Prezados Senhores,</p>
            <p>Atendendo a sua prezada consulta, temos o prazer de submeter a vossa devida apreciação nossa proposta acima citada, para o fornecimento de:</p>
          </div>
        </div>

        <div class="machine-presentation-block" style="page-break-inside: avoid !important; break-inside: avoid !important;">
          <div class="machine-title">
            ${esc(machineTitle)}
          </div>

          <div class="image-container">
            ${
              machineImage
                ? `<img src="${esc(machineImage)}" alt="${esc(machineTitle)}" class="machine-img" onerror="this.style.display='none'" />`
                : `<div style="height:140px;border:1px dashed #ccc;display:flex;align-items:center;justify-content:center;color:#888;">Imagem do equipamento</div>`
            }
            <p class="image-caption">Imagem meramente ilustrativa</p>
          </div>
        </div>
      </div>

      <div class="footer page-screen-footer">
        <p>Rua Iracema Lucas, 450 (Antiga Rua Parsch) - Distrito Industrial</p>
        <p>Vinhedo - SP - Brasil - CEP: 13280-172 - Fone / Fax: (0**19) 3826-7373</p>
        <p>E-mail: vendas@bener.com.br - Site: www.bener.com.br</p>
        <div class="page-number">${page1Number}</div>
      </div>
    </div>

    <!-- PAGE 2+: DETAILS -->
    ${
      hasPage2Content
        ? `<div class="page page-divider" data-sheet-index="1" data-page="2" style="margin-top:0 !important;padding-top:0 !important;">
      <div>
        <!-- Institutional header on screen (Page 2 — oculto no print para o cabeçalho nativo @media print atuar de forma contínua em todas as páginas) -->
        <div class="page-screen-header">
          ${renderInstitutionalHeaderHtml()}
        </div>

        <div style="margin-bottom:12px;">
          <div style="display:flex;align-items:center;gap:8px;margin-top:16px;margin-bottom:5px;padding-bottom:5px;border-bottom:0.5pt solid #cbd5e1;page-break-after:avoid;break-after:avoid;-webkit-print-color-adjust:exact;print-color-adjust:exact;">
            <span style="display:inline-block;width:3.5pt;height:14pt;background:#0b3c26;border-radius:1px;"></span>
            <span style="font-size:12.5pt;font-weight:bold;letter-spacing:0.8px;text-transform:uppercase;color:#0b3c26;">Especificações Técnicas</span>
          </div>
          <div style="font-size:9.5pt;white-space:pre-wrap;line-height:1.45;color:#1e293b;padding-left:12px;">${renderBulletList(primaryVersao?.especificacoes_tecnicas || proposta.especificacoes_tecnicas || proposta.descricao_proposta || 'Conforme catálogo e especificações técnicas de fábrica.')}</div>
        </div>

        ${
          primaryVersao?.caracteristicas_construtivas
            ? `<div style="margin-bottom:12px;">
                 <div style="display:flex;align-items:center;gap:8px;margin-top:16px;margin-bottom:5px;padding-bottom:5px;border-bottom:0.5pt solid #cbd5e1;page-break-after:avoid;break-after:avoid;-webkit-print-color-adjust:exact;print-color-adjust:exact;">
                   <span style="display:inline-block;width:3.5pt;height:14pt;background:#0b3c26;border-radius:1px;"></span>
                   <span style="font-size:12.5pt;font-weight:bold;letter-spacing:0.8px;text-transform:uppercase;color:#0b3c26;">Características Construtivas</span>
                 </div>
                 <div style="font-size:9.5pt;white-space:pre-wrap;line-height:1.45;color:#1e293b;padding-left:12px;">${renderBulletList(primaryVersao.caracteristicas_construtivas)}</div>
               </div>`
            : ''
        }

        ${
          primaryVersao?.acessorios_standards
            ? `<div style="margin-bottom:12px;">
                 <div style="display:flex;align-items:center;gap:8px;margin-top:16px;margin-bottom:5px;padding-bottom:5px;border-bottom:0.5pt solid #cbd5e1;page-break-after:avoid;break-after:avoid;-webkit-print-color-adjust:exact;print-color-adjust:exact;">
                   <span style="display:inline-block;width:3.5pt;height:14pt;background:#0b3c26;border-radius:1px;"></span>
                   <span style="font-size:12.5pt;font-weight:bold;letter-spacing:0.8px;text-transform:uppercase;color:#0b3c26;">Acessórios Standards Inclusos</span>
                 </div>
                 <div style="font-size:9.5pt;white-space:pre-wrap;line-height:1.45;color:#1e293b;padding-left:12px;">${renderBulletList(primaryVersao.acessorios_standards)}</div>
               </div>`
            : ''
        }
        ${(() => {
          // Regra 7: Acessórios com 3 estados mutuamente exclusivos
          const rawAcc = Array.isArray(proposta.acessorios_proposta)
            ? (proposta.acessorios_proposta as any[])
            : []
          const filteredAcc = rawAcc.filter((a) => a && a.inclusao !== 'nao_exibir')
          if (filteredAcc.length === 0) return ''

          const inclusos = filteredAcc.filter(
            (a) =>
              a.inclusao === 'incluir' ||
              a.inclusao === 'preco' ||
              a.inclusao === undefined ||
              a.inclusao === null,
          )
          const naoInclusos = filteredAcc.filter(
            (a) => a.inclusao === 'opcional' || a.inclusao === 'exibir',
          )
          let out = ''

          if (inclusos.length > 0) {
            out += `<div style="margin-bottom:12px;page-break-inside:avoid;break-inside:avoid;">
              <div style="display:flex;align-items:center;gap:8px;margin-top:16px;margin-bottom:5px;padding-bottom:5px;border-bottom:0.5pt solid #cbd5e1;page-break-after:avoid;break-after:avoid;-webkit-print-color-adjust:exact;print-color-adjust:exact;">
                <span style="display:inline-block;width:3.5pt;height:14pt;background:#0b3c26;border-radius:1px;"></span>
                <span style="font-size:12.5pt;font-weight:bold;letter-spacing:0.8px;text-transform:uppercase;color:#0b3c26;">Acessórios Opcionais Inclusos no Preço</span>
              </div>
              <ul style="list-style:none;padding:0 0 0 12px;margin:0;font-size:9.5pt;line-height:1.55;color:#1e293b;">
                ${inclusos
                  .map(
                    (a) =>
                      `<li style="display:flex;align-items:baseline;gap:6px;margin-bottom:2px;"><span style="color:#0b3c26;font-weight:bold;">•</span><span>${a.quantidade ? `${a.quantidade}x ` : ''}${esc(a.nome || '—')}</span></li>`,
                  )
                  .join('')}
              </ul>
            </div>`
          }

          if (naoInclusos.length > 0) {
            out += `<div style="margin-bottom:12px;page-break-inside:avoid;break-inside:avoid;">
              <div style="display:flex;align-items:center;gap:8px;margin-top:16px;margin-bottom:5px;padding-bottom:5px;border-bottom:0.5pt solid #cbd5e1;page-break-after:avoid;break-after:avoid;-webkit-print-color-adjust:exact;print-color-adjust:exact;">
                <span style="display:inline-block;width:3.5pt;height:14pt;background:#0b3c26;border-radius:1px;"></span>
                <span style="font-size:12.5pt;font-weight:bold;letter-spacing:0.8px;text-transform:uppercase;color:#0b3c26;">Acessórios Opcionais Não Inclusos no Preço</span>
              </div>
              <ul style="list-style:none;padding:0 0 0 12px;margin:0;font-size:9.5pt;line-height:1.55;color:#1e293b;">
                ${naoInclusos
                  .map((a) => {
                    const itemMoeda = normalizeMoedaCode(a.moeda || moedaProp)
                    const valFmt =
                      a.valor != null ? formatCurrencyByMoeda(a.valor, itemMoeda) : null
                    return `<li style="display:flex;justify-content:space-between;align-items:baseline;gap:8px;margin-bottom:2px;"><div style="display:flex;align-items:baseline;gap:6px;"><span style="color:#0b3c26;font-weight:bold;">•</span><span>${a.quantidade ? `${a.quantidade}x ` : ''}${esc(a.nome || '—')}</span></div>${valFmt ? `<span style="font-weight:bold;color:#0f172a;white-space:nowrap;">${valFmt}</span>` : ''}</li>`
                  })
                  .join('')}
              </ul>
            </div>`
          }

          return out
        })()}

        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:12.5pt;font-weight:bold;color:#0b3c26;text-transform:uppercase;letter-spacing:0.8px;margin:16px 0 5px 0;padding-bottom:5px;border-bottom:0.5pt solid #cbd5e1;page-break-after:avoid;break-after:avoid;-webkit-print-color-adjust:exact;print-color-adjust:exact;">
          <div style="display:flex;align-items:center;gap:8px;">
            <span style="display:inline-block;width:3.5pt;height:14pt;background:#0b3c26;border-radius:1px;"></span>
            <span>Condições Comerciais</span>
          </div>
          <span style="font-size:10pt;color:#64748b;font-weight:500;text-transform:none;">${proposta.is_pacote ? 'Pacote de Máquinas' : 'Fornecimento Unitário'}</span>
        </div>

        <!-- Regra 1: Bloco Câmbio/Cotação só aparece quando há conversão REAL (PONTO 1: 4 decimais e texto de fechamento) -->
        ${
          hasRealConversion
            ? (() => {
                const fmtPtax4 = (n: any) =>
                  (Number(n) || 0).toLocaleString('pt-BR', {
                    minimumFractionDigits: 4,
                    maximumFractionDigits: 4,
                  })
                const rawData = proposta.data_cotacao_moeda || dadosSnapshot?.data_cotacao_moeda
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
                const dataTxt = dataFmt ? ` &bull; Cotação de fechamento de ${esc(dataFmt)}` : ''
                return `<div style="background:#f8fafc;border:1px solid #cbd5e1;padding:6px 10px;border-radius:3px;font-size:10px;color:#334155;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;page-break-inside:avoid;break-inside:avoid;">
                 <span>Moeda da proposta: <strong>${esc(moedaProp)}</strong> (Original: ${esc(moedaOrig)})</span>
                 <span>Taxa de Câmbio: <strong>1 ${esc(moedaProp)} = R$ ${fmtPtax4(proposta.cotacao_moeda)}</strong>${dataTxt}</span>
               </div>`
              })()
            : ''
        }

        ${(() => {
          // Ponto 13: Cálculo e resolução de comissão de Admissão Temporária / Importação Direta
          const tipoNomeEfetivo =
            tpOverride?.nome ||
            proposta.tipo_proposta ||
            (dadosSnapshot?.tipo_proposta as string) ||
            (tpSnapshot?.nome as string) ||
            (equipmentItems && equipmentItems[0]?.tipo_proposta) ||
            null

          const comissaoPctEfetiva =
            tpOverride?.comissao != null
              ? Number(tpOverride.comissao)
              : tpSnapshot?.comissao != null
                ? Number(tpSnapshot.comissao)
                : proposta.percentual_comissao_servicos != null
                  ? Number(proposta.percentual_comissao_servicos)
                  : (dadosSnapshot?.percentual_comissao_servicos as number) || 0

          let baseCalculoItens = 0
          const valorFinalEfetivoPrecoEspecial =
            precoEspecial != null && precoEspecial > 0 ? precoEspecial : valorEfetivoFinal

          if (
            proposta.base_comissao_servicos != null &&
            Number(proposta.base_comissao_servicos) > 0
          ) {
            baseCalculoItens = Number(proposta.base_comissao_servicos)
          } else if (
            dadosSnapshot?.base_comissao_servicos != null &&
            Number(dadosSnapshot.base_comissao_servicos) > 0
          ) {
            baseCalculoItens = Number(dadosSnapshot.base_comissao_servicos)
          } else if (valorFinalEfetivoPrecoEspecial > 0) {
            baseCalculoItens = valorFinalEfetivoPrecoEspecial
          } else if (equipmentItems && equipmentItems.length > 0) {
            equipmentItems.forEach((it: any) => {
              const qtd = it.quantidade || 1
              const valUnit = Number(it.valor_unitario || 0)
              const descVal = Number(it.desconto_valor || 0)
              const descPct = Number(it.desconto_percentual || 0)
              const subtotal = qtd * valUnit
              const tot =
                descVal > 0 ? Math.max(0, subtotal - descVal) : subtotal * (1 - descPct / 100)
              baseCalculoItens += tot
            })
            const rawAcc = Array.isArray(proposta.acessorios_proposta)
              ? (proposta.acessorios_proposta as any[])
              : []
            rawAcc.forEach((a: any) => {
              if (
                a &&
                a.inclusao !== 'nao_exibir' &&
                (a.inclusao === 'incluir' || a.inclusao === 'preco' || a.inclusao == null)
              ) {
                const qtd = Number(a.quantidade || 1)
                const val = Number(a.valor || 0)
                const desc = Number(a.desconto_valor || 0)
                const pct = Number(a.desconto_percentual || 0)
                const sub = qtd * val
                const tot = desc > 0 ? Math.max(0, sub - desc) : sub * (1 - pct / 100)
                baseCalculoItens += tot
              }
            })
          } else {
            baseCalculoItens = valorEfetivoFinal
          }

          let valorComissaoCalculada = 0
          let comissaoAplicavel = false

          if (
            proposta.valor_comissao_servicos != null &&
            Number(proposta.valor_comissao_servicos) > 0
          ) {
            valorComissaoCalculada = Number(proposta.valor_comissao_servicos)
            comissaoAplicavel = true
          } else if (
            dadosSnapshot?.valor_comissao_servicos != null &&
            Number(dadosSnapshot.valor_comissao_servicos) > 0
          ) {
            valorComissaoCalculada = Number(dadosSnapshot.valor_comissao_servicos)
            comissaoAplicavel = true
          } else {
            const calcRes = calcComissaoServicosBener({
              tipoNome: tipoNomeEfetivo,
              comissaoPct: comissaoPctEfetiva,
              baseValor: baseCalculoItens,
            })
            if (calcRes && calcRes.valorCalculado > 0) {
              valorComissaoCalculada = calcRes.valorCalculado
              comissaoAplicavel = true
            }
          }

          const comissaoItemIndex =
            proposta.is_pacote && equipmentItems && equipmentItems.length > 0
              ? equipmentItems.length + 1
              : 2

          const comissaoRowHtml =
            comissaoAplicavel && valorComissaoCalculada > 0
              ? `<tr>
                <td style="padding:6px 8px;text-align:center;color:#64748b;font-weight:600;border-bottom:1px solid #e2e8f0;">${comissaoItemIndex}</td>
                <td style="padding:6px 8px;font-weight:bold;color:#0f172a;border-bottom:1px solid #e2e8f0;line-height:1.4;">${esc(TEXTO_COMISSAO_BENER_VERBATIM)}</td>
                <td style="padding:6px 8px;text-align:center;color:#1e293b;border-bottom:1px solid #e2e8f0;">—</td>
                <td style="padding:6px 8px;text-align:right;border-bottom:1px solid #e2e8f0;color:#64748b;">—</td>
                <td style="padding:6px 8px;text-align:right;color:#64748b;border-bottom:1px solid #e2e8f0;">—</td>
                <td style="padding:6px 8px;text-align:right;border-bottom:1px solid #e2e8f0;font-weight:bold;color:#0f172a;white-space:nowrap;">
                  ${formatCurrencyByMoeda(valorComissaoCalculada, moedaProp)}
                </td>
              </tr>`
              : ''

          // PONTO 3: Total do Fornecimento = subtotal limpo da máquina + comissão (sem soma dupla)
          const rawFinalTotal = Number(valorFinal || 0)
          let totalFornecimento = rawFinalTotal
          if (comissaoAplicavel && valorComissaoCalculada > 0) {
            if (Math.abs(rawFinalTotal - (baseCalculoItens + valorComissaoCalculada)) < 0.1) {
              totalFornecimento = rawFinalTotal
            } else {
              totalFornecimento = baseCalculoItens + valorComissaoCalculada
            }
          }

          return `
          <!-- Regra 3: Tabela de Condições Comerciais SEM coluna Tipo Fornecimento -->
          <table style="width:100%;border-collapse:collapse;margin-bottom:10px;border:1px solid #cbd5e1;font-size:10.5px;background:#ffffff;page-break-inside:avoid;break-inside:avoid;">
            <thead>
              <tr style="background:#f1f5f9;border-bottom:1px solid #cbd5e1;color:#475569;font-size:9.5px;text-transform:uppercase;letter-spacing:0.5px;">
                <th style="padding:6px 8px;text-align:center;width:35px;">Item</th>
                <th style="padding:6px 8px;text-align:left;">Descrição do Equipamento</th>
                <th style="padding:6px 8px;text-align:center;width:40px;">Qtd</th>
                <th style="padding:6px 8px;text-align:right;">Valor Unitário</th>
                <th style="padding:6px 8px;text-align:right;">Desconto</th>
                <th style="padding:6px 8px;text-align:right;">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              ${
                proposta.is_pacote && equipmentItems && equipmentItems.length > 0
                  ? equipmentItems
                      .map((item: any, idx: number) => {
                        const itemNome =
                          item.versoes?.nome || item.versoes?.nome_abreviado || `Item ${idx + 1}`
                        const itemMoeda = normalizeMoedaCode(item.versoes?.moeda || moedaProp)
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
                        const valorUnitEfetivo = qtd > 0 ? totalItem / qtd : totalItem

                        return `<tr>
                          <td style="padding:6px 8px;text-align:center;color:#64748b;font-weight:600;border-bottom:1px solid #e2e8f0;">${idx + 1}</td>
                          <td style="padding:6px 8px;font-weight:bold;color:#0f172a;border-bottom:1px solid #e2e8f0;">${esc(itemNome)}</td>
                          <td style="padding:6px 8px;text-align:center;color:#1e293b;border-bottom:1px solid #e2e8f0;">${qtd}</td>
                          <td style="padding:6px 8px;text-align:right;border-bottom:1px solid #e2e8f0;">
                            ${
                              itemHasDiscount
                                ? `<div>
                                    <span style="text-decoration:line-through;color:#94a3b8;font-size:9px;display:block;">${formatCurrencyByMoeda(valUnit, itemMoeda)}</span>
                                    <span style="font-weight:bold;color:#0f172a;">${formatCurrencyByMoeda(valorUnitEfetivo, itemMoeda)}</span>
                                   </div>`
                                : `<span style="font-weight:bold;color:#0f172a;">${formatCurrencyByMoeda(valUnit, itemMoeda)}</span>`
                            }
                          </td>
                          <td style="padding:6px 8px;text-align:right;color:#334155;border-bottom:1px solid #e2e8f0;">${descPct > 0 ? `${descPct}%` : descVal > 0 ? formatCurrencyByMoeda(descVal, itemMoeda) : '—'}</td>
                          <td style="padding:6px 8px;text-align:right;border-bottom:1px solid #e2e8f0;font-weight:bold;">
                            ${
                              itemHasDiscount
                                ? `<div>
                                    <span style="text-decoration:line-through;color:#94a3b8;font-size:9px;display:block;">${formatCurrencyByMoeda(subtotal, itemMoeda)}</span>
                                    <span style="font-weight:900;color:#0f172a;">${formatCurrencyByMoeda(totalItem, itemMoeda)}</span>
                                   </div>`
                                : `<span style="font-weight:900;color:#0f172a;">${formatCurrencyByMoeda(totalItem, itemMoeda)}</span>`
                            }
                          </td>
                        </tr>`
                      })
                      .join('')
                  : (() => {
                      // PONTO 3: A linha da máquina deve exibir VALOR UNITÁRIO e SUBTOTAL somente com o valor da máquina — SEM comissão Bener embutida.
                      const qtdUnitaria =
                        Number(proposta.quantidade || 1) > 0 ? Number(proposta.quantidade || 1) : 1

                      let subtotalMaquinaLimpo =
                        precoEspecial != null && precoEspecial > 0 ? precoEspecial : valorFinal
                      let valOrigLimpo =
                        valorOriginalTabela > 0 ? valorOriginalTabela : subtotalMaquinaLimpo

                      if (comissaoAplicavel && valorComissaoCalculada > 0) {
                        if (
                          baseCalculoItens > 0 &&
                          (Math.abs(valorFinal - (baseCalculoItens + valorComissaoCalculada)) <
                            0.1 ||
                            valorFinal === baseCalculoItens)
                        ) {
                          subtotalMaquinaLimpo =
                            precoEspecial != null && precoEspecial > 0
                              ? precoEspecial
                              : baseCalculoItens
                        } else if (valorFinal > valorComissaoCalculada) {
                          subtotalMaquinaLimpo =
                            precoEspecial != null && precoEspecial > 0
                              ? precoEspecial
                              : valorFinal - valorComissaoCalculada
                        }

                        if (valOrigLimpo > valorComissaoCalculada) {
                          if (
                            Math.abs(
                              valOrigLimpo - (subtotalMaquinaLimpo + valorComissaoCalculada),
                            ) < 0.1 ||
                            valOrigLimpo >= subtotalMaquinaLimpo + valorComissaoCalculada - 0.05
                          ) {
                            valOrigLimpo = valOrigLimpo - valorComissaoCalculada
                          }
                        }
                        if (valOrigLimpo < subtotalMaquinaLimpo) {
                          valOrigLimpo = subtotalMaquinaLimpo
                        }
                      }

                      const valUnitEfetivo =
                        qtdUnitaria > 0 ? subtotalMaquinaLimpo / qtdUnitaria : subtotalMaquinaLimpo
                      const valUnitOrig =
                        qtdUnitaria > 0 ? valOrigLimpo / qtdUnitaria : valOrigLimpo
                      const hasLineDiscount =
                        effectiveDiscountPercent > 0 ||
                        (precoEspecial != null && precoEspecial > 0) ||
                        valUnitOrig > valUnitEfetivo

                      return `<tr>
                        <td style="padding:6px 8px;text-align:center;color:#64748b;font-weight:600;border-bottom:1px solid #e2e8f0;">1</td>
                        <td style="padding:6px 8px;font-weight:bold;color:#0f172a;border-bottom:1px solid #e2e8f0;">${esc(machineTitle)}</td>
                        <td style="padding:6px 8px;text-align:center;color:#1e293b;border-bottom:1px solid #e2e8f0;">${qtdUnitaria}</td>
                        <td style="padding:6px 8px;text-align:right;border-bottom:1px solid #e2e8f0;">
                          ${
                            hasLineDiscount
                              ? `<div>
                                  <span style="text-decoration:line-through;color:#94a3b8;font-size:9px;display:block;">${formatCurrencyByMoeda(valUnitOrig, moedaProp)}</span>
                                  <span style="font-weight:bold;color:#0f172a;">${formatCurrencyByMoeda(valUnitEfetivo, moedaProp)}</span>
                                 </div>`
                              : `<span style="font-weight:bold;color:#0f172a;">${formatCurrencyByMoeda(valUnitOrig, moedaProp)}</span>`
                          }
                        </td>
                        <td style="padding:6px 8px;text-align:right;color:#334155;border-bottom:1px solid #e2e8f0;">${effectiveDiscountPercent > 0 ? `${effectiveDiscountPercent}%` : '—'}</td>
                        <td style="padding:6px 8px;text-align:right;border-bottom:1px solid #e2e8f0;font-weight:bold;">
                          ${
                            hasLineDiscount
                              ? `<div>
                                  <span style="text-decoration:line-through;color:#94a3b8;font-size:9px;display:block;">${formatCurrencyByMoeda(valOrigLimpo, moedaProp)}</span>
                                  <span style="font-weight:900;color:#0f172a;">${formatCurrencyByMoeda(subtotalMaquinaLimpo, moedaProp)}</span>
                                 </div>`
                              : `<span style="font-weight:900;color:#0f172a;">${formatCurrencyByMoeda(subtotalMaquinaLimpo, moedaProp)}</span>`
                          }
                        </td>
                      </tr>`
                    })()
              }
              ${comissaoRowHtml}
            </tbody>
          </table>

          <div style="background:#f8fafc;border:1px solid #cbd5e1;border-radius:4px;padding:8px 12px;display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;page-break-inside:avoid;break-inside:avoid;">
            <div>
              <div style="font-size:9.5px;text-transform:uppercase;font-weight:bold;letter-spacing:0.8px;color:#334155;">Valor Total do Fornecimento</div>
              <div style="font-size:9.5px;color:#64748b;">${proposta.is_pacote && equipmentItems && equipmentItems.length > 0 ? `Soma de ${equipmentItems.length} equipamento(s)` : 'Condição comercial integral'}</div>
            </div>
            <div style="text-align:right;">
              ${
                precoEspecial != null
                  ? `<div style="display:flex;flex-direction:column;align-items:flex-end;gap:2px;">
                      <div style="display:flex;align-items:center;gap:6px;">
                        <span style="text-decoration:line-through;color:#94a3b8;font-size:10px;font-weight:600;">${formatCurrencyByMoeda(totalFornecimento, moedaProp)}</span>
                        <span style="font-size:8.5px;text-transform:uppercase;letter-spacing:0.5px;color:#0f172a;background:#e2e8f0;font-weight:bold;padding:1px 4px;border-radius:2px;">Preço Especial</span>
                        ${
                          discountBadge
                            ? `<span style="font-size:8.5px;font-weight:bold;color:#0f172a;background:rgba(15,23,42,0.06);border:1px solid rgba(15,23,42,0.2);padding:1px 4px;border-radius:3px;">${discountBadge}</span>`
                            : ''
                        }
                      </div>
                      <span style="font-weight:900;color:#0f172a;font-size:14px;">${formatCurrencyByMoeda(precoEspecial, moedaProp)}</span>
                    </div>`
                  : `<span style="font-weight:900;color:#0f172a;font-size:14px;">${formatCurrencyByMoeda(totalFornecimento, moedaProp)}</span>`
              }
            </div>
          </div>
          `
        })()}

        ${
          filteredTerms.length > 0
            ? `<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:12.5pt;font-weight:bold;color:#0b3c26;text-transform:uppercase;letter-spacing:0.8px;margin:16px 0 5px 0;padding-bottom:5px;border-bottom:0.5pt solid #cbd5e1;page-break-after:avoid;break-after:avoid;-webkit-print-color-adjust:exact;print-color-adjust:exact;">
                 <div style="display:flex;align-items:center;gap:8px;">
                   <span style="display:inline-block;width:3.5pt;height:14pt;background:#0b3c26;border-radius:1px;"></span>
                   <span>Termos de Fornecimento</span>
                 </div>
                 <span style="font-size:10pt;color:#64748b;font-weight:500;text-transform:none;">Condições Gerais & Garantias</span>
               </div>
               <div class="terms-section" style="width:100%;display:block;margin-bottom:16px;">
                 ${filteredTerms
                   .map(
                     ([lbl, val]) => `
                   <div class="term-item" style="display:block;width:100%;margin-bottom:12px;page-break-inside:avoid;break-inside:avoid;">
                     <div class="term-title" style="display:block;font-size:10.5pt;font-weight:700;color:#0b3c26;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;page-break-after:avoid;break-after:avoid;">${esc(lbl)}</div>
                     <div class="term-content" style="display:block;width:100%;color:#0f172a;font-size:9.5pt;font-weight:500;line-height:1.45;word-break:break-word;">${renderMultilinhaHtml(val)}</div>
                   </div>`,
                   )
                   .join('')}
               </div>`
            : ''
        }

        ${
          validCamposAdicionais.length > 0
            ? `<div style="margin-bottom:16px;">
                 <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:12.5pt;font-weight:bold;color:#0b3c26;text-transform:uppercase;letter-spacing:0.8px;margin:16px 0 5px 0;padding-bottom:5px;border-bottom:0.5pt solid #cbd5e1;page-break-after:avoid;break-after:avoid;-webkit-print-color-adjust:exact;print-color-adjust:exact;">
                   <div style="display:flex;align-items:center;gap:8px;">
                     <span style="display:inline-block;width:3.5pt;height:14pt;background:#0b3c26;border-radius:1px;"></span>
                     <span>Informações Adicionais</span>
                   </div>
                   <span style="font-size:10pt;color:#64748b;font-weight:500;text-transform:none;">Campos Específicos da Proposta</span>
                 </div>
                 <div class="terms-section" style="width:100%;display:block;margin-bottom:16px;">
                   ${validCamposAdicionais
                     .map((field) => {
                       const fieldTitle = String(field.titulo || field.chave || '').trim()
                       const fieldVal = field.conteudo != null ? field.conteudo : field.valor
                       return `
                     <div class="term-item" style="display:block;width:100%;margin-bottom:12px;page-break-inside:avoid;break-inside:avoid;">
                       <div class="term-title" style="display:block;font-size:10.5pt;font-weight:700;color:#0b3c26;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;page-break-after:avoid;break-after:avoid;">${esc(fieldTitle)}</div>
                       <div class="term-content" style="display:block;width:100%;color:#0f172a;font-size:9.5pt;font-weight:500;line-height:1.45;word-break:break-word;">${renderMultilinhaHtml(fieldVal)}</div>
                     </div>`
                     })
                     .join('')}
                 </div>
               </div>`
            : ''
        }

        <!-- Regra 8: Texto de encerramento verbatim -->
        <div class="closing-text" style="margin-top:20px;margin-bottom:16px;font-size:11px;color:#0f172a;page-break-inside:avoid;break-inside:avoid;">
          <p style="text-align:justify;line-height:1.6;margin:0 0 12px 0;">
            Antecipadamente agradecemos vossa honrosa preferência, permanecendo ao vosso inteiro dispor, para dirimir e atender quaisquer eventuais esclarecimentos adicionais que se fizerem necessários.
          </p>
          <p style="text-align:left;margin:0;">
            Atenciosamente
          </p>
        </div>

        <div class="signatures-grid">
          <div>
            <div class="sig-line">
              <strong>${esc(proposta.nome_gerente_produto || proposta.gerente_original || '—')}</strong><br />
              Gerente de Produto
            </div>
          </div>
          <div>
            <div class="sig-line">
              <strong>${esc(proposta.nome_assessor_tecnico || '—')}</strong><br />
              Assessor Técnico
            </div>
          </div>
          <div>
            ${
              proposta.assinatura_representante
                ? `<div style="display:flex;justify-content:center;margin-bottom:4px;">
                     <img src="${esc(proposta.assinatura_representante)}" alt="Assinatura Comercial" style="max-height:48px;max-width:180px;object-fit:contain;" crossorigin="anonymous" />
                   </div>`
                : ''
            }
            <div class="sig-line" style="${proposta.assinatura_representante ? 'margin-top:4px;' : ''}">
              <strong>${esc(proposta.nome_representante_comercial || proposta.representante_original || '—')}</strong><br />
              Representante Comercial
              ${proposta.data_assinatura_representante ? `<div style="font-size:9px;color:#64748b;margin-top:2px;">Assinado em ${new Date(proposta.data_assinatura_representante).toLocaleDateString('pt-BR')}</div>` : ''}
            </div>
          </div>
        </div>
      </div>

      <div class="footer page-screen-footer">
        <p>Rua Iracema Lucas, 450 (Antiga Rua Parsch) - Distrito Industrial</p>
        <p>Vinhedo - SP - Brasil - CEP: 13280-172 - Fone / Fax: (0**19) 3826-7373</p>
        <p>E-mail: vendas@bener.com.br - Site: www.bener.com.br</p>
        <div class="page-number">${page2Number}</div>
      </div>
    </div>`
        : ''
    }
  </div>
</body>
</html>`
}
