import { escapeHtml } from './escape-html.ts'

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

function stripBold(s: string | null | undefined): string {
  return s
    ? String(s)
        .replace(/<\/?b\b[^>]*>/gi, '')
        .trim()
    : ''
}

function renderCommercialFieldHtml(val: string | null | undefined): string {
  if (!val) return ''
  const str = String(val).trim()
  const lines = str
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
  if (lines.length <= 1 && !/<b\b/i.test(str)) {
    return escapeHtml(str)
  }

  const boldWithCloseRegex =
    /^(?:(\d{1,2}[.)\-–—]|•|p[oó]nto\s+\d{1,3}[:.\-–—]?)\s*)?<b\b[^>]*>([\s\S]*?)<\/b\s*>(.*)$/i
  return lines
    .map((line) => {
      const match = line.match(boldWithCloseRegex)
      if (match) {
        const prefix = (match[1] || '').trim()
        const rawTitle = (match[2] || '').trim()
        const rawBody = (match[3] || '').trim()
        const cleanTitle = stripBold(prefix ? `${prefix} ${rawTitle}` : rawTitle)
        const cleanBody = stripBold(rawBody)
        return `<div style="margin-bottom:4px;"><strong class="paragraph-title" style="display:block;font-weight:700;color:#0b3c26;margin-bottom:2px;-webkit-print-color-adjust:exact;print-color-adjust:exact;">${escapeHtml(cleanTitle)}</strong>${cleanBody ? `<span>${escapeHtml(cleanBody)}</span>` : ''}</div>`
      }
      return `<div style="margin-bottom:4px;">${escapeHtml(stripBold(line))}</div>`
    })
    .join('')
}

function formatLongDate(dtCad: string | null | undefined): string {
  const d = dtCad ? new Date(dtCad + (dtCad.includes('T') ? '' : 'T12:00:00')) : new Date()
  const formatted = d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
  return `Vinhedo, ${formatted}`
}

function buildEquipmentSection(items: any[], proposta: any): string {
  const fmtVal = (v: number | null | undefined) =>
    (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const itemsHtml = items
    .map((item, idx) => {
      const v = item.versoes || {}
      const modelo = v?.modelos
      const marca = modelo?.marcas
      const produto = modelo?.produtos
      const categoria = produto?.categorias_produtos

      const subtotal = (item.quantidade || 1) * (item.valor_unitario || 0)
      const total =
        (item.desconto_valor || 0) > 0
          ? Math.max(0, subtotal - (item.desconto_valor || 0))
          : subtotal * (1 - (item.desconto_percentual || 0) / 100)

      const moeda = normalizeMoedaCode(v?.moeda || proposta.moeda || 'BRL')

      // Regra 7: Acessórios com 3 estados (incluir, nao_exibir, opcional/exibir)
      const rawAcc = Array.isArray(proposta.acessorios_proposta)
        ? (proposta.acessorios_proposta as any[])
        : []
      const filteredAcc = rawAcc.filter(
        (a) => a && a.inclusao !== 'nao_exibir' && (!a.versao_id || !v?.id || a.versao_id === v.id),
      )
      const inclusosPacote = filteredAcc.filter(
        (a) =>
          a.inclusao === 'incluir' ||
          a.inclusao === 'preco' ||
          a.inclusao === undefined ||
          a.inclusao === null,
      )
      const naoInclusosPacote = filteredAcc.filter(
        (a) => a.inclusao === 'opcional' || a.inclusao === 'exibir',
      )

      let acessoriosHtml = ''
      if (inclusosPacote.length > 0) {
        acessoriosHtml += `<div class="equipment-accessories" style="margin-top:10px;padding-top:8px;border-top:1px solid #e2e8f0;page-break-inside:avoid;break-inside:avoid;">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
            <span style="display:inline-block;width:3px;height:12px;background:#0b3c26;border-radius:1px;"></span>
            <span style="font-size:10px;font-weight:bold;color:#0b3c26;text-transform:uppercase;letter-spacing:0.8px;">Acessórios Opcionais Inclusos no Preço</span>
          </div>
          <ul style="list-style:none;padding:0 0 0 9px;margin:2px 0 0 0;font-size:11px;line-height:1.55;color:#1e293b;">
            ${inclusosPacote
              .map(
                (a: any) =>
                  `<li style="display:flex;align-items:baseline;gap:6px;margin-bottom:2px;"><span style="color:#0b3c26;font-weight:bold;">•</span><span>${a.quantidade ? a.quantidade + 'x ' : ''}${escapeHtml(a.nome || '—')}</span></li>`,
              )
              .join('')}
          </ul>
        </div>`
      }
      if (naoInclusosPacote.length > 0) {
        acessoriosHtml += `<div class="equipment-accessories" style="margin-top:10px;padding-top:8px;border-top:1px solid #e2e8f0;page-break-inside:avoid;break-inside:avoid;">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
            <span style="display:inline-block;width:3px;height:12px;background:#0b3c26;border-radius:1px;"></span>
            <span style="font-size:10px;font-weight:bold;color:#0b3c26;text-transform:uppercase;letter-spacing:0.8px;">Acessórios Opcionais Não Inclusos no Preço</span>
          </div>
          <ul style="list-style:none;padding:0 0 0 9px;margin:2px 0 0 0;font-size:11px;line-height:1.55;color:#1e293b;">
            ${naoInclusosPacote
              .map((a: any) => {
                const itemMoeda = normalizeMoedaCode(a.moeda || moeda)
                const valFmt = a.valor != null ? `${itemMoeda} ${fmtVal(a.valor)}` : null
                return `<li style="display:flex;justify-content:space-between;align-items:baseline;gap:8px;margin-bottom:2px;"><div style="display:flex;align-items:baseline;gap:6px;"><span style="color:#0b3c26;font-weight:bold;">•</span><span>${a.quantidade ? a.quantidade + 'x ' : ''}${escapeHtml(a.nome || '—')}</span></div>${valFmt ? `<span style="font-weight:bold;color:#0f172a;white-space:nowrap;">${valFmt}</span>` : ''}</li>`
              })
              .join('')}
          </ul>
        </div>`
      }

      const imagemHtml = v?.imagem_preview
        ? `<img src="${v.imagem_preview}" alt="${v.nome || ''}" class="equipment-img" />`
        : ''

      const metaLines: string[] = []
      if (marca) metaLines.push(`<div><strong>Marca:</strong> ${escapeHtml(marca.nome)}</div>`)
      if (modelo) metaLines.push(`<div><strong>Modelo:</strong> ${escapeHtml(modelo.nome)}</div>`)
      if (produto)
        metaLines.push(`<div><strong>Produto:</strong> ${escapeHtml(produto.nome)}</div>`)
      if (categoria)
        metaLines.push(`<div><strong>Categoria:</strong> ${escapeHtml(categoria.nome)}</div>`)

      const techLines: string[] = []
      const itemTech =
        v?.especificacoes_tecnicas ||
        (idx === 0 ? proposta.descricao_proposta || proposta.especificacoes_tecnicas : null)
      if (itemTech)
        techLines.push(
          `<div class="equipment-tech-block">
             <div class="equipment-tech-heading">
               <span class="equipment-tech-bar"></span>
               <span>Especificações Técnicas</span>
             </div>
             <pre>${escapeHtml(itemTech)}</pre>
           </div>`,
        )
      if (v?.caracteristicas_construtivas)
        techLines.push(
          `<div class="equipment-tech-block">
             <div class="equipment-tech-heading">
               <span class="equipment-tech-bar"></span>
               <span>Características Construtivas</span>
             </div>
             <pre>${escapeHtml(v.caracteristicas_construtivas)}</pre>
           </div>`,
        )
      if (v?.acessorios_standards)
        techLines.push(
          `<div class="equipment-tech-block">
             <div class="equipment-tech-heading">
               <span class="equipment-tech-bar"></span>
               <span>Configuração Standard</span>
             </div>
             <pre>${escapeHtml(v.acessorios_standards)}</pre>
           </div>`,
        )

      const descParts: string[] = []
      if (item.desconto_percentual) descParts.push(`${item.desconto_percentual}%`)
      if (item.desconto_valor) descParts.push(`${moeda} ${fmtVal(item.desconto_valor)}`)

      const itemHasDiscount = (item.desconto_percentual || 0) > 0 || (item.desconto_valor || 0) > 0
      const qtd = item.quantidade || 1
      const valUnit = Number(item.valor_unitario || 0)
      const valorUnitEfetivo = qtd > 0 ? total / qtd : total

      const valorUnitHtml = itemHasDiscount
        ? `<div style="display:flex;flex-direction:column;">
            <span style="text-decoration:line-through;color:#94a3b8;font-size:10px;">${moeda} ${fmtVal(valUnit)}</span>
            <span style="font-weight:bold;color:#0f172a;">${moeda} ${fmtVal(valorUnitEfetivo)}</span>
           </div>`
        : `<span style="font-weight:bold;color:#0f172a;">${moeda} ${fmtVal(valUnit)}</span>`

      const totalItemHtml = itemHasDiscount
        ? `<div style="display:flex;flex-direction:column;align-items:flex-end;">
            <span style="text-decoration:line-through;color:#94a3b8;font-size:10px;">${moeda} ${fmtVal(subtotal)}</span>
            <span style="font-weight:900;color:#0b3c26;font-size:13px;">${moeda} ${fmtVal(total)}</span>
           </div>`
        : `<span style="font-weight:900;color:#0b3c26;font-size:13px;">${moeda} ${fmtVal(total)}</span>`

      // Regra 3: Sem Tipo de Fornecimento na tabela de Condições Comerciais
      return `
      <div class="equipment-item" style="border:1px solid #cbd5e1;border-radius:6px;padding:12px;margin-bottom:12px;background:#ffffff;page-break-inside:avoid;break-inside:avoid;">
        <div class="equipment-header" style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #e2e8f0;padding-bottom:8px;margin-bottom:8px;">
          <div style="display:flex;align-items:center;gap:10px;">
            ${imagemHtml}
            <div class="equipment-info">
              <span style="font-size:11px;font-weight:bold;color:#0b3c26;background:rgba(11,60,38,0.1);padding:2px 6px;border-radius:3px;margin-right:4px;">#${idx + 1}</span>
              <span class="equipment-name" style="font-weight:800;font-size:14px;color:#0f172a;">${escapeHtml(v?.nome || '-')}</span>
              ${v?.cod_erp ? `<span class="equipment-code" style="font-size:11px;color:#64748b;margin-left:8px;">Cód.: ${escapeHtml(v.cod_erp)}</span>` : ''}
              ${v?.nome_abreviado ? `<span class="equipment-abbr" style="font-size:11px;color:#64748b;margin-left:6px;">(${escapeHtml(v.nome_abreviado)})</span>` : ''}
            </div>
          </div>
        </div>
        ${metaLines.length > 0 ? `<div class="equipment-meta" style="margin-bottom:8px;">${metaLines.join('')}</div>` : ''}
        ${techLines.join('')}
        <div style="display:grid;grid-template-columns:1fr 1.5fr 1fr 1.5fr;gap:8px;font-size:11px;align-items:center;background:#f8fafc;padding:8px 10px;border-radius:4px;border:1px solid #f1f5f9;margin-top:8px;">
          <div>
            <div style="font-size:9px;text-transform:uppercase;color:#64748b;font-weight:600;letter-spacing:0.5px;">Quantidade</div>
            <div style="font-weight:bold;color:#1e293b;">${qtd} un.</div>
          </div>
          <div>
            <div style="font-size:9px;text-transform:uppercase;color:#64748b;font-weight:600;letter-spacing:0.5px;">Valor Unitário</div>
            ${valorUnitHtml}
          </div>
          <div>
            <div style="font-size:9px;text-transform:uppercase;color:#64748b;font-weight:600;letter-spacing:0.5px;">Desconto</div>
            <div style="color:#334155;font-weight:500;">${descParts.length > 0 ? descParts.join(' + ') : '—'}</div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:9px;text-transform:uppercase;color:#64748b;font-weight:600;letter-spacing:0.5px;">Subtotal</div>
            ${totalItemHtml}
          </div>
        </div>
        ${acessoriosHtml}
      </div>
    `
    })
    .join('')

  return `
  <div style="border-bottom:2px solid #0f172a;padding-bottom:6px;font-size:12px;font-weight:bold;letter-spacing:0.8px;text-transform:uppercase;margin:24px 0 10px 0;display:flex;justify-content:space-between;align-items:center;page-break-after:avoid;break-after:avoid;">
    <span>Detalhamento de Equipamentos & Condições Comerciais</span>
    <span style="font-size:10px;color:#64748b;font-weight:500;text-transform:none;">Pacote de Máquinas</span>
  </div>
  <div class="equipment-list">${itemsHtml}</div>
`
}

export function buildProposalPdfHtml(
  proposta: any,
  publicAppUrl: string = 'https://nexus.bener.com.br',
  creatorInfo?: { name: string; email: string } | null,
  projectCreator?: { name: string; projectName: string } | null,
  tipoProposta?: Record<string, unknown> | null,
  equipmentItems?: any[] | null,
  logoUrlOverride?: string | null,
): string {
  const logoUrl = logoUrlOverride || ''

  // Normalização de Moeda (Regras 1 e 2)
  const moedaProp = normalizeMoedaCode(proposta.moeda || 'BRL')
  const moedaOrig = normalizeMoedaCode(proposta.moeda_original || proposta.moeda || 'BRL')
  const hasRealConversion = moedaProp !== moedaOrig && Boolean(proposta.cotacao_moeda)

  const creatorLine = creatorInfo
    ? `<div><strong>Criado por:</strong> ${escapeHtml(creatorInfo.name)}${creatorInfo.email ? ` (${escapeHtml(creatorInfo.email)})` : ''}</div>`
    : ''

  const createdDateRaw = proposta.created_at || proposta.dt_cad
  const createdDateLine = createdDateRaw
    ? `<div><strong>Criado em:</strong> ${new Date(createdDateRaw).toLocaleDateString('pt-BR')}</div>`
    : ''

  const projectCreatorLine = projectCreator
    ? `<div><strong>Projeto criado por:</strong> ${escapeHtml(projectCreator.name)}${projectCreator.projectName ? ` (${escapeHtml(projectCreator.projectName)})` : ''}</div>`
    : ''

  const creatorSection =
    creatorLine || createdDateLine || projectCreatorLine
      ? `
  <div class="creator-info" style="display:none;">
    ${creatorLine}
    ${createdDateLine}
    ${projectCreatorLine}
  </div>
  `
      : ''

  // Snapshot congelado do tipo de proposta (Regra 9) com suporte a override local per-proposal
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

  const rawIpiEdge =
    proposta.imposto_ipi != null && !isTaxValEmpty(proposta.imposto_ipi, 'Imposto IPI')
      ? `${proposta.imposto_ipi}${String(proposta.imposto_ipi).includes('%') ? '' : '%'}`
      : tpSnapshot?.imposto_ipi != null && !isTaxValEmpty(tpSnapshot.imposto_ipi, 'Imposto IPI')
        ? `${tpSnapshot.imposto_ipi}${String(tpSnapshot.imposto_ipi).includes('%') ? '' : '%'}`
        : null

  const rawIcmsEdge =
    proposta.imposto_icms != null && !isTaxValEmpty(proposta.imposto_icms, 'Imposto ICMS')
      ? `${proposta.imposto_icms}${String(proposta.imposto_icms).includes('%') ? '' : '%'}`
      : tpSnapshot?.imposto_icms != null && !isTaxValEmpty(tpSnapshot.imposto_icms, 'Imposto ICMS')
        ? `${tpSnapshot.imposto_icms}${String(tpSnapshot.imposto_icms).includes('%') ? '' : '%'}`
        : null

  // Regra 9: Campos do Tipo de Proposta
  const termsList: Array<[string, string | null | undefined]> = [
    ['Condições de Pagamento', proposta.condicoes_pagamento || tpSnapshot?.condicoes_pagamento],
    ['Prazo de Entrega', proposta.prazo_entrega || tpSnapshot?.prazo_entrega],
    ['Validade da Oferta', proposta.validade_oferta || tpSnapshot?.validade_oferta],
    ['Cobertura de Garantia', proposta.cobertura_garantia],
    ['Garantia', proposta.garantia_acessorios || tpSnapshot?.garantia],
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
    ['Imposto IPI', rawIpiEdge],
    ['Imposto ICMS', rawIcmsEdge],
    ['Treinamento Técnico', proposta.treinamento_tecnico || tpSnapshot?.treinamento_tecnico],
    ['Frase de Preço', proposta.frase_preco || tpSnapshot?.frase_preco],
  ]

  // Campos adicionais do tipo de proposta
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
              termsList.push([lbl, val])
            }
          },
        )
      } else if (extras && typeof extras === 'object') {
        Object.entries(extras as Record<string, string | number | null | undefined>).forEach(
          ([lbl, rawVal]) => {
            const cleanLbl = (lbl || '').trim()
            if (cleanLbl && !isCommercialEmpty(rawVal)) {
              termsList.push([cleanLbl, String(rawVal).trim()])
            }
          },
        )
      }
    } catch {
      // ignore
    }
  }

  const filteredTerms = termsList.filter(([lbl, val]) => {
    if (isCommercialEmpty(val, lbl)) return false
    const lower = lbl.toLowerCase()
    if (lower.includes('ipi') || lower.includes('icms') || lower.includes('imposto')) {
      return !isTaxValEmpty(val, lbl)
    }
    return true
  }) as Array<[string, string | null | undefined]>

  const commercialSection =
    filteredTerms.length > 0
      ? `
    <div style="background:#0b3c26;color:#ffffff;padding:6px 12px;border-radius:4px;font-size:12px;font-weight:bold;letter-spacing:0.8px;text-transform:uppercase;margin:24px 0 10px 0;-webkit-print-color-adjust:exact;print-color-adjust:exact;page-break-after:avoid;break-after:avoid;">
      Termos de Fornecimento & Informações Comerciais
    </div>
    <div style="border:1px solid #e2e8f0;border-radius:4px;background:#ffffff;margin-bottom:16px;page-break-inside:avoid;break-inside:avoid;">
      ${filteredTerms
        .map(
          ([lbl, val], idx) => `
        <div style="display:grid;grid-template-columns:180px 1fr;gap:12px;padding:6px 12px;font-size:11px;align-items:baseline;${idx > 0 ? 'border-top:1px solid #f1f5f9;' : ''};page-break-inside:avoid;break-inside:avoid;">
          <div style="font-size:10px;font-weight:700;color:#0f172a;text-transform:uppercase;letter-spacing:0.5px;background:#f1f5f9;padding:3px 6px;border-radius:2px;border-left:2px solid #cbd5e1;-webkit-print-color-adjust:exact;print-color-adjust:exact;">${escapeHtml(lbl)}</div>
          <div style="color:#0f172a;font-weight:500;line-height:1.4;">${renderCommercialFieldHtml(val)}</div>
        </div>`,
        )
        .join('')}
    </div>`
      : ''

  // Informações adicionais da proposta (Regra 9)
  let camposAdicionaisSection = ''
  const snapshotCampos = dadosSnapshot?.campos_adicionais
  let camposData: any =
    Array.isArray(snapshotCampos) && snapshotCampos.length > 0
      ? snapshotCampos
      : proposta.campos_adicionais
  if (typeof camposData === 'string') {
    try {
      camposData = JSON.parse(camposData)
    } catch {
      camposData = null
    }
  }
  if (Array.isArray(camposData) && camposData.length > 0) {
    const validCampos = camposData.filter(
      (c: any) =>
        c &&
        ((c.titulo && String(c.titulo).trim() !== '') ||
          (c.chave && String(c.chave).trim() !== '')) &&
        !isCommercialEmpty(c.conteudo != null ? c.conteudo : c.valor),
    )
    if (validCampos.length > 0) {
      camposAdicionaisSection = `
      <div style="background:#0b3c26;color:#ffffff;padding:6px 12px;border-radius:4px;font-size:12px;font-weight:bold;letter-spacing:0.8px;text-transform:uppercase;margin:24px 0 10px 0;-webkit-print-color-adjust:exact;print-color-adjust:exact;page-break-after:avoid;break-after:avoid;">
        Informações Adicionais
      </div>
      <div style="border:1px solid #e2e8f0;border-radius:4px;background:#ffffff;margin-bottom:16px;page-break-inside:avoid;break-inside:avoid;">
        ${validCampos
          .map(
            (c: any, idx: number) => `
          <div style="display:grid;grid-template-columns:180px 1fr;gap:12px;padding:6px 12px;font-size:11px;align-items:baseline;${idx > 0 ? 'border-top:1px solid #f1f5f9;' : ''};page-break-inside:avoid;break-inside:avoid;">
            <div style="font-size:10px;font-weight:700;color:#0f172a;text-transform:uppercase;letter-spacing:0.5px;background:#f1f5f9;padding:3px 6px;border-radius:2px;border-left:2px solid #cbd5e1;-webkit-print-color-adjust:exact;print-color-adjust:exact;">${escapeHtml(String(c.titulo || c.chave || '').trim())}</div>
            <div style="color:#0f172a;font-weight:500;line-height:1.4;">${renderCommercialFieldHtml(c.conteudo != null ? c.conteudo : c.valor)}</div>
          </div>`,
          )
          .join('')}
      </div>`
    }
  }

  const equipmentSection =
    equipmentItems && equipmentItems.length > 0
      ? buildEquipmentSection(equipmentItems, proposta)
      : ''

  const footerCreator = creatorInfo
    ? `<div class="footer-creator">Documento gerado por ${escapeHtml(creatorInfo.name)}${creatorInfo.email ? ` — ${escapeHtml(creatorInfo.email)}` : ''}</div>`
    : ''

  // Câmbio / Cotação condicional (Regra 1)
  const cambioBanner = hasRealConversion
    ? `<div style="margin-bottom:12px;padding:8px 10px;background:#f8fafc;border:1px solid #cbd5e1;border-radius:4px;font-size:11px;color:#1e293b;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;page-break-inside:avoid;break-inside:avoid;">
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="font-weight:bold;color:#0f172a;text-transform:uppercase;font-size:10px;background:#e2e8f0;padding:2px 6px;border-radius:3px;">Câmbio / Cotação</span>
          <span>Moeda da proposta: <strong>${moedaProp}</strong> (Original: ${moedaOrig})</span>
        </div>
        <div style="display:flex;align-items:center;gap:12px;">
          <span>Taxa aplicada: <strong>1 ${moedaProp} = ${formatCurrencyByMoeda(proposta.cotacao_moeda, 'BRL')}</strong></span>
          ${proposta.data_cotacao_moeda ? `<span style="color:#64748b;">Data da cotação: <strong>${escapeHtml(proposta.data_cotacao_moeda)}</strong></span>` : ''}
        </div>
      </div>`
    : ''

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>Proposta Comercial - ${escapeHtml(proposta.numero_proposta || 'Bener')}</title>
  <style>
    body {
      font-family: Arial, Helvetica, sans-serif;
      color: #333;
      margin: 0;
      padding: 40px;
      font-size: 12px;
      line-height: 1.5;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 3px solid #0b3c26;
      padding-bottom: 20px;
      margin-bottom: 20px;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .logo-img {
      height: 52px;
      width: auto;
      max-width: 240px;
      object-fit: contain;
    }
    .proposal-title {
      text-align: right;
      max-width: 320px;
      white-space: normal;
      word-break: break-word;
    }
    .proposal-title h1 {
      font-size: 20px;
      color: #0b3c26;
      margin: 0 0 5px 0;
    }
    .proposal-number-text {
      white-space: normal;
      word-break: break-word;
    }
    .creator-info {
      display: none !important;
    }
    .creator-info div {
      margin: 2px 0;
    }
    .meta-box {
      background: #f8faf9;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 15px;
      margin-bottom: 25px;
      display: flex;
      justify-content: space-between;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .section-title {
      font-size: 14px;
      font-weight: bold;
      color: #0b3c26;
      border-left: 4px solid #0b3c26;
      padding-left: 10px;
      margin: 25px 0 15px 0;
      page-break-after: avoid;
      break-after: avoid;
    }
    .equipment-name {
      font-weight: 800;
      font-size: 16px;
      color: #0b3c26;
      margin-left: 4px;
      display: inline-block;
    }
    .equipment-list {
      margin-bottom: 20px;
    }
    .equipment-item {
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 12px;
      margin-bottom: 12px;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .equipment-header {
      display: flex;
      gap: 12px;
      align-items: flex-start;
    }
    .equipment-img {
      width: 64px;
      height: 64px;
      object-fit: cover;
      border-radius: 4px;
      border: 1px solid #e2e8f0;
    }
    .equipment-info {
      flex: 1;
    }
    .equipment-code, .equipment-abbr {
      font-size: 11px;
      color: #666;
      margin-left: 8px;
    }
    .equipment-meta {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 4px;
      font-size: 11px;
      margin-top: 8px;
    }
    .paragraph-title {
      display: block;
      font-weight: 700;
      color: #0b3c26;
      margin-bottom: 2px;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .equipment-tech-block {
      margin-top: 8px;
      padding-top: 6px;
      border-top: 1px solid #e2e8f0;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .equipment-tech-heading {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 3px;
      font-size: 10.5px;
      font-weight: bold;
      color: #0b3c26;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .equipment-tech-bar {
      display: inline-block;
      width: 3px;
      height: 12px;
      background:#0b3c26;
      border-radius: 1px;
    }
    .equipment-tech-block pre {
      font-family: inherit;
      white-space: pre-wrap;
      margin: 2px 0 0 0;
      font-size: 11px;
      line-height: 1.45;
      color: #334155;
      padding-left: 9px;
    }
    .spec-block {
      margin-bottom: 14px;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .spec-block-heading {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 6px;
      padding-bottom: 4px;
      border-bottom: 1px solid rgba(11, 60, 38, 0.25);
      font-size: 12px;
      font-weight: bold;
      color: #0b3c26;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      page-break-after: avoid;
      break-after: avoid;
    }
    .spec-block-bar {
      display: inline-block;
      width: 4px;
      height: 14px;
      background: #0b3c26;
      border-radius: 1px;
    }
    .spec-block-content {
      font-size: 11px;
      line-height: 1.5;
      color: #1e293b;
      padding-left: 12px;
      white-space: pre-wrap;
      margin: 0;
    }
    .equipment-accessories {
      font-size: 11px;
      margin-top: 8px;
      padding-top: 6px;
      border-top: 1px solid #f1f5f9;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .equipment-accessories ul {
      margin: 4px 0;
      padding-left: 16px;
    }
    .footer {
      margin-top: 50px;
      border-top: 1px solid #e2e8f0;
      padding-top: 15px;
      text-align: center;
      font-size: 10px;
      color: #888;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .footer-creator {
      margin-top: 8px;
      font-size: 10px;
      color: #666;
      text-align: center;
    }
    .page-footer {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      text-align: center;
      font-size: 9px;
      color: #666;
      line-height: 1.4;
      padding: 8px 40px 10px 40px;
      border-top: 1px solid #d1d5db;
      background: #ffffff;
      z-index: 100;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      display: block;
    }
    .page-footer p {
      margin: 0;
    }
    @media print {
      html, body {
        width: 186mm !important;
        max-width: 186mm !important;
        margin: 0 auto !important;
        padding: 0 0 40px 0 !important;
        min-height: auto !important;
        height: auto !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      body > :first-child,
      .header,
      .proposal-cover,
      [data-page="1"],
      [data-sheet-index="0"] {
        break-before: avoid !important;
        page-break-before: avoid !important;
        margin-top: 0 !important;
        padding-top: 0 !important;
      }
      [data-page="2"],
      [data-sheet-index="1"] {
        break-before: page !important;
        page-break-before: always !important;
        margin-top: 0 !important;
        padding-top: 0 !important;
      }
      .creator-info {
        display: none !important;
      }
      .page-footer {
        position: static;
        margin-top: 24px;
        border-top: 1px solid #cbd5e1;
        padding-top: 10px;
        display: block;
        page-break-inside: avoid;
        break-inside: avoid;
      }
      table {
        table-layout: fixed !important;
        width: 100% !important;
      }
    }
    @page {
      size: A4 portrait;
      margin: 10mm 12mm;
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      ${
        logoUrl
          ? `<img src="${logoUrl}" alt="BENER - MAQUINAS QUE TRANSFORMAM" class="logo-img" onerror="this.style.display='none';document.getElementById('pdf-logo-fallback').style.display='block'" />`
          : `<span style="font-size:28px;font-weight:800;color:#0b3c26;letter-spacing:3px;">BENER</span>`
      }
      <span id="pdf-logo-fallback" style="display:none;font-size:28px;font-weight:800;color:#0b3c26;letter-spacing:3px;">BENER</span>
    </div>
    <div class="proposal-title">
      <h1>${proposta.modelo_licitacao ? 'PROPOSTA DE LICITAÇÃO' : 'PROPOSTA COMERCIAL'}</h1>
      <div class="proposal-number-text">Nº <strong>${escapeHtml(proposta.numero_proposta || 'N/A')}</strong> (Rev. ${escapeHtml(proposta.revisao || '0')})</div>
      <div>${formatLongDate(proposta.dt_cad)}</div>
    </div>
  </div>

  ${creatorSection}

  <div class="meta-box">
    <div>
      <strong>Cliente:</strong> ${escapeHtml(proposta.cliente_original || proposta.cliente || 'Não informado')}<br />
      <strong>Contato:</strong> ${escapeHtml(proposta.contato || '-')}<br />
      <strong>Telefone:</strong> ${escapeHtml(proposta.telefone || '-')}
    </div>
    <div style="text-align: right;">
      <strong>Representante:</strong> ${escapeHtml(proposta.nome_representante_comercial || proposta.representante_original || '-')}<br />
      <strong>Gerente:</strong> ${escapeHtml(proposta.nome_gerente_produto || proposta.gerente_original || '-')}<br />
      <strong>Moeda:</strong> ${moedaProp}
      ${
        hasRealConversion
          ? `<br /><span style="font-size:10px;color:#475569;">Cotação: 1 ${moedaProp} = ${formatCurrencyByMoeda(proposta.cotacao_moeda, 'BRL')} ${proposta.data_cotacao_moeda ? `(${escapeHtml(proposta.data_cotacao_moeda)})` : ''} — Original: ${moedaOrig}</span>`
          : ''
      }
    </div>
  </div>

  <div class="spec-block">
    <div class="spec-block-heading">
      <span class="spec-block-bar"></span>
      <span>Especificações Técnicas</span>
    </div>
    <div class="spec-block-content">${escapeHtml(proposta.versoes?.especificacoes_tecnicas || proposta.especificacoes_tecnicas || proposta.descricao_proposta || 'Conforme especificações padrão do catálogo.')}</div>
  </div>
  ${
    proposta.versoes?.caracteristicas_construtivas
      ? `<div class="spec-block">
           <div class="spec-block-heading">
             <span class="spec-block-bar"></span>
             <span>Características Construtivas</span>
           </div>
           <div class="spec-block-content">${escapeHtml(proposta.versoes.caracteristicas_construtivas)}</div>
         </div>`
      : ''
  }
  ${
    proposta.versoes?.acessorios_standards
      ? `<div class="spec-block">
           <div class="spec-block-heading">
             <span class="spec-block-bar"></span>
             <span>Configuração Standard</span>
           </div>
           <div class="spec-block-content">${escapeHtml(proposta.versoes.acessorios_standards)}</div>
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
      out += `<div class="spec-block">
        <div class="spec-block-heading">
          <span class="spec-block-bar"></span>
          <span>Acessórios Opcionais Inclusos no Preço</span>
        </div>
        <ul style="list-style:none;padding:0 0 0 12px;margin:0;font-size:11px;line-height:1.55;color:#1e293b;">
          ${inclusos
            .map(
              (a: any) =>
                `<li style="display:flex;align-items:baseline;gap:6px;margin-bottom:2px;"><span style="color:#0b3c26;font-weight:bold;">•</span><span>${a.quantidade ? a.quantidade + 'x ' : ''}${escapeHtml(a.nome || '—')}</span></li>`,
            )
            .join('')}
        </ul>
      </div>`
    }

    if (naoInclusos.length > 0) {
      out += `<div class="spec-block">
        <div class="spec-block-heading">
          <span class="spec-block-bar"></span>
          <span>Acessórios Opcionais Não Inclusos no Preço</span>
        </div>
        <ul style="list-style:none;padding:0 0 0 12px;margin:0;font-size:11px;line-height:1.55;color:#1e293b;">
          ${naoInclusos
            .map((a: any) => {
              const itemMoeda = normalizeMoedaCode(a.moeda || moedaProp)
              const valFmt =
                a.valor != null
                  ? `${itemMoeda} ${Number(a.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                  : null
              return `<li style="display:flex;justify-content:space-between;align-items:baseline;gap:8px;margin-bottom:2px;"><div style="display:flex;align-items:baseline;gap:6px;"><span style="color:#0b3c26;font-weight:bold;">•</span><span>${a.quantidade ? a.quantidade + 'x ' : ''}${escapeHtml(a.nome || '—')}</span></div>${valFmt ? `<span style="font-weight:bold;color:#0f172a;white-space:nowrap;">${valFmt}</span>` : ''}</li>`
            })
            .join('')}
        </ul>
      </div>`
    }

    return out
  })()}

  ${cambioBanner}

  ${
    equipmentSection
      ? equipmentSection
      : (() => {
          // Modo unitário: Regra 3 - sem coluna/box Tipo Fornecimento
          const mTitle = (
            proposta.versoes?.nome ||
            proposta.versao_original ||
            proposta.descricao_proposta ||
            'Equipamento'
          ).toUpperCase()
          const valFinal = Number(proposta.valor_final ?? proposta.valor_atual ?? 0)
          const pEsp =
            proposta.preco_especial != null && Number(proposta.preco_especial) > 0
              ? Number(proposta.preco_especial)
              : null
          const valSemDesc =
            proposta.valor_sem_desconto != null && Number(proposta.valor_sem_desconto) > 0
              ? Number(proposta.valor_sem_desconto)
              : valFinal
          const dPerc = Number(proposta.percentual_desconto || 0)
          const hasDisc = dPerc > 0 || (pEsp != null && pEsp > 0) || valSemDesc > valFinal
          const valOrig = valSemDesc > 0 ? valSemDesc : valFinal > 0 ? valFinal : pEsp || 0
          const valEfetivo = pEsp != null && pEsp > 0 ? pEsp : valFinal
          const valUnitEfetivo = valFinal > 0 ? valFinal : valEfetivo
          const fmtM = (n: number) =>
            n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

          return `
          <div style="border-bottom:2px solid #0f172a;padding-bottom:6px;font-size:12px;font-weight:bold;letter-spacing:0.8px;text-transform:uppercase;margin:24px 0 10px 0;display:flex;justify-content:space-between;align-items:center;page-break-after:avoid;break-after:avoid;">
            <span>Condições Comerciais</span>
            <span style="font-size:10px;color:#64748b;font-weight:500;text-transform:none;">Fornecimento Unitário</span>
          </div>
          <table style="width:100%;border-collapse:collapse;margin-bottom:12px;border:1px solid #cbd5e1;font-size:11px;background:#ffffff;page-break-inside:avoid;break-inside:avoid;">
            <thead>
              <tr style="background:#f1f5f9;border-bottom:1px solid #cbd5e1;color:#475569;font-size:10px;text-transform:uppercase;letter-spacing:0.5px;">
                <th style="padding:8px 10px;text-align:center;width:40px;">Item</th>
                <th style="padding:8px 10px;text-align:left;">Descrição do Equipamento</th>
                <th style="padding:8px 10px;text-align:center;width:50px;">Qtd</th>
                <th style="padding:8px 10px;text-align:right;">Valor Unitário</th>
                <th style="padding:8px 10px;text-align:right;">Desconto</th>
                <th style="padding:8px 10px;text-align:right;">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="padding:8px 10px;text-align:center;color:#64748b;font-weight:600;border-bottom:1px solid #e2e8f0;">1</td>
                <td style="padding:8px 10px;font-weight:bold;color:#0f172a;border-bottom:1px solid #e2e8f0;">${escapeHtml(mTitle)}</td>
                <td style="padding:8px 10px;text-align:center;color:#1e293b;border-bottom:1px solid #e2e8f0;">1 un.</td>
                <td style="padding:8px 10px;text-align:right;border-bottom:1px solid #e2e8f0;">
                  ${
                    hasDisc
                      ? `<div style="display:flex;flex-direction:column;align-items:flex-end;">
                          <span style="text-decoration:line-through;color:#94a3b8;font-size:10px;">${moedaProp} ${fmtM(valOrig)}</span>
                          <span style="font-weight:bold;color:#0f172a;">${moedaProp} ${fmtM(valUnitEfetivo)}</span>
                         </div>`
                      : `<span style="font-weight:bold;color:#0f172a;">${moedaProp} ${fmtM(valOrig)}</span>`
                  }
                </td>
                <td style="padding:8px 10px;text-align:right;color:#334155;border-bottom:1px solid #e2e8f0;">${dPerc > 0 ? `${dPerc}%` : '—'}</td>
                <td style="padding:8px 10px;text-align:right;border-bottom:1px solid #e2e8f0;font-weight:bold;">
                  ${
                    hasDisc
                      ? `<div style="display:flex;flex-direction:column;align-items:flex-end;">
                          <span style="text-decoration:line-through;color:#94a3b8;font-size:10px;">${moedaProp} ${fmtM(valOrig)}</span>
                          <span style="font-weight:bold;color:#0f172a;font-size:12px;">${moedaProp} ${fmtM(valEfetivo)}</span>
                         </div>`
                      : `<span style="font-weight:bold;color:#0f172a;font-size:12px;">${moedaProp} ${fmtM(valEfetivo)}</span>`
                  }
                </td>
              </tr>
            </tbody>
          </table>
          `
        })()
  }

  <div style="background:#f8fafc;border:1px solid #cbd5e1;border-radius:4px;padding:10px 14px;display:flex;justify-content:space-between;align-items:center;margin:12px 0 20px 0;page-break-inside:avoid;break-inside:avoid;">
    <div>
      <div style="font-size:10px;text-transform:uppercase;font-weight:bold;letter-spacing:0.8px;color:#334155;">Valor Total do Fornecimento</div>
      <div style="font-size:10px;color:#64748b;">${equipmentItems && equipmentItems.length > 0 ? `Soma de ${equipmentItems.length} equipamento(s)` : 'Condição comercial integral'}</div>
    </div>
    <div style="text-align:right;">
      ${
        proposta.preco_especial != null && Number(proposta.preco_especial) > 0
          ? (() => {
              const valorOrig = proposta.valor_final || proposta.valor_atual || 0
              const badge = formatPrecoEspecialDiscountBadge(valorOrig, proposta.preco_especial)
              return `<div style="display:flex;flex-direction:column;align-items:flex-end;gap:2px;">
                <div style="display:flex;align-items:center;gap:6px;">
                  <span style="font-size:11px;color:#94a3b8;text-decoration:line-through;font-weight:600;">${moedaProp} ${Number(valorOrig).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  <span style="font-size:9px;text-transform:uppercase;letter-spacing:0.5px;color:#0f172a;background:#e2e8f0;font-weight:bold;padding:1px 5px;border-radius:2px;">Preço Especial</span>
                  ${
                    badge
                      ? `<span style="font-size:9px;font-weight:bold;color:#0f172a;background:rgba(15,23,42,0.06);border:1px solid rgba(15,23,42,0.2);padding:1px 5px;border-radius:4px;">${badge}</span>`
                      : ''
                  }
                </div>
                <span style="font-size:16px;font-weight:900;color:#0f172a;">${moedaProp} ${Number(proposta.preco_especial).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
              </div>`
            })()
          : `<span style="font-size:16px;font-weight:900;color:#0f172a;">${moedaProp} ${(proposta.valor_final || proposta.valor_atual || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>`
      }
    </div>
  </div>

  ${commercialSection}
  ${camposAdicionaisSection}

  <!-- Regra 8: Texto de encerramento verbatim -->
  <div style="margin-top:20px;margin-bottom:16px;font-size:11px;color:#0f172a;page-break-inside:avoid;break-inside:avoid;">
    <p style="text-align:justify;line-height:1.6;margin:0 0 12px 0;">
      Antecipadamente agradecemos vossa honrosa preferência, permanecendo ao vosso inteiro dispor, para dirimir e atender quaisquer eventuais esclarecimentos adicionais que se fizerem necessários.
    </p>
    <p style="text-align:left;margin:0;">
      Atenciosamente
    </p>
  </div>

  <div class="page-footer">
    <p>Rua Iracema Lucas, 450 (Antiga Rua Parsch) &ndash; Distrito Industrial</p>
    <p>Vinhedo - SP - Brasil - CEP: 13280-172 - Fone: (0**19) 3826-7373</p>
    <p>E-mail: vendas@bener.com.br - Site: www.bener.com.br</p>
  </div>

  <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #cbd5e1; page-break-inside:avoid; break-inside:avoid;">
    <div style="font-size: 11px; font-weight: bold; text-transform: uppercase; color: #0b3c26; margin-bottom: 12px; letter-spacing: 0.5px;">
      De Acordo e Assinaturas
    </div>
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px; text-align: center; margin-top: 16px;">
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: flex-end;">
        ${
          proposta.assinatura_cliente
            ? `<img src="${proposta.assinatura_cliente}" alt="Assinatura do Cliente" style="max-height: 50px; max-width: 180px; object-fit: contain; margin-bottom: 4px;" crossorigin="anonymous" />`
            : '<div style="height: 50px;"></div>'
        }
        <div style="border-top: 1px solid #334155; width: 85%; padding-top: 4px; font-size: 11px;">
          <strong>${escapeHtml(proposta.cliente_original || proposta.cliente || 'Cliente')}</strong><br />
          <span style="font-size: 9px; color: #64748b;">De Acordo do Cliente</span>
          ${proposta.data_assinatura_cliente ? `<br /><span style="font-size: 8px; color: #64748b;">Assinado em ${new Date(proposta.data_assinatura_cliente).toLocaleDateString('pt-BR')}</span>` : ''}
        </div>
      </div>

      <div style="display: flex; flex-direction: column; align-items: center; justify-content: flex-end;">
        ${
          proposta.assinatura_representante
            ? `<img src="${proposta.assinatura_representante}" alt="Assinatura Responsável Interno" style="max-height: 50px; max-width: 180px; object-fit: contain; margin-bottom: 4px;" crossorigin="anonymous" />`
            : '<div style="height: 50px;"></div>'
        }
        <div style="border-top: 1px solid #334155; width: 85%; padding-top: 4px; font-size: 11px;">
          <strong>${escapeHtml(proposta.nome_representante_comercial || proposta.representante_original || 'Bener Comercial')}</strong><br />
          <span style="font-size: 9px; color: #64748b;">Responsável Interno — Comercial</span>
          ${proposta.data_assinatura_representante ? `<br /><span style="font-size: 8px; color: #64748b;">Assinado em ${new Date(proposta.data_assinatura_representante).toLocaleDateString('pt-BR')}</span>` : ''}
        </div>
      </div>
    </div>
  </div>

  <div class="footer">
    Bener Maquinas S.A. &bull; Nexus - Gestao Comercial &bull; Validacao disponivel em ${publicAppUrl}/validar-proposta/${proposta.id || ''}
  </div>
  ${footerCreator}
</body>
</html>
`
}
