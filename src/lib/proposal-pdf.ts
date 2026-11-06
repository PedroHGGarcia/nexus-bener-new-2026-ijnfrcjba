import type { Json } from '@/lib/supabase/types'
import type { PropostaWithRelations } from '@/types/proposta'
import type { PropostaVersaoWithRelations } from '@/types/proposta-versao'
import { formatCurrencyByMoeda, formatBulletList, normalizeMoedaCode } from '@/lib/format'
import { formatPrecoEspecialDiscountBadge } from '@/lib/proposta-calculations'
import { isTechnicalTableJson, parseTechnicalData } from '@/lib/technical-table'
import { isHtmlContent } from '@/lib/technical-html-converter'
import { openPrintWindow } from '@/lib/pdf-builder'
import { escapeHtml, sanitizeHtml } from '@/lib/escape-html'
import { renderParagraphsHtml, isCommercialFieldEmpty, isTaxValueEmpty } from '@/lib/paragraphs'
import { renderVersaoRichHtml } from '@/lib/versao-rich-text'
import { resolveDescricaoFontSizePdf } from '@/lib/descricao-tamanho'
import { ProposalSectionCounter } from '@/lib/proposal-section-numbering'
import benerLogo from '@/assets/image-f448b.png'

const esc = escapeHtml

export function renderMultilinhaHtml(raw: string | null | undefined, extraClass = ''): string {
  return renderParagraphsHtml(raw, extraClass, esc)
}

function renderTechnicalHtml(
  raw: string | null | undefined,
  fallbackText = '',
  fontSizePt = '9.5pt',
): string {
  if (!raw || !raw.trim()) {
    return fallbackText
      ? `<div style="font-size:11px;color:#64748b;font-style:italic;">${esc(fallbackText)}</div>`
      : ''
  }

  // 1. Se for rich HTML (do RichTextEditor): sanitiza e renderiza diretamente com formatação e imagens
  if (isHtmlContent(raw)) {
    const clean = sanitizeHtml(raw)
    return `<div class="term-desc-content" style="display:block;width:100%;font-size:${fontSizePt};font-weight:500;line-height:1.45;color:#0f172a;word-break:break-word;">${clean}</div>`
  }

  // 2. Se for JSON estruturado de tabela técnica
  if (isTechnicalTableJson(raw)) {
    const table = parseTechnicalData(raw)
    if (table.rows.length === 0) {
      return fallbackText
        ? `<div style="font-size:11px;color:#64748b;font-style:italic;">${esc(fallbackText)}</div>`
        : ''
    }

    const hasAnyImage = table.rows.some((r) => Boolean(r.imagem && r.imagem.trim()))

    const ths = [
      hasAnyImage
        ? `<th style="border:1px solid #cbd5e1;padding:4px 6px;font-size:9px;text-transform:uppercase;font-weight:700;background:#f1f5f9;color:#334155;text-align:center;width:44px;">Foto</th>`
        : '',
      ...table.columns.map(
        (c, idx) =>
          `<th style="border:1px solid #cbd5e1;padding:4px 8px;font-size:9.5px;text-transform:uppercase;font-weight:700;background:#f1f5f9;color:#334155;${idx === 0 ? 'text-align:center;width:48px;' : 'text-align:left;'}">${esc(c.label)}</th>`,
      ),
    ].join('')

    const trs = table.rows
      .map((r) => {
        const imgCell = hasAnyImage
          ? `<td style="border:1px solid #cbd5e1;padding:2px 4px;text-align:center;vertical-align:middle;width:44px;">${
              r.imagem
                ? `<img src="${esc(r.imagem)}" alt="Item" style="max-height:36px;max-width:44px;object-fit:contain;display:inline-block;border-radius:2px;vertical-align:middle;" onerror="this.style.display='none'" />`
                : `<span style="color:#cbd5e1;font-size:9px;">—</span>`
            }</td>`
          : ''

        const dataCells = table.columns
          .map(
            (c, cIdx) =>
              `<td style="border:1px solid #cbd5e1;padding:3px 8px;font-size:10px;color:#0f172a;vertical-align:middle;${cIdx === 0 ? 'text-align:center;font-weight:600;' : ''}">${esc(r.values[c.id] || '—')}</td>`,
          )
          .join('')

        return `<tr style="background:#ffffff;">${imgCell}${dataCells}</tr>`
      })
      .join('')

    return `<div style="margin-top:2px;overflow-x:auto;"><table style="width:100%;border-collapse:collapse;border:1px solid #cbd5e1;border-radius:3px;"><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table></div>`
  }

  // 3. Fallback: renderização rica (atende estritamente às regras de <B>, quebras e bullets "•" sem exibir marcadores crus)
  // Estilo padronizado = mesmo padrão do bloco "Termos de Fornecimento" (título 10,5pt bold caixa alta; corpo customizável por versão, largura total, sem recuo)
  return `<div class="term-desc-content" style="display:block;width:100%;font-size:${fontSizePt};font-weight:500;line-height:1.45;color:#0f172a;word-break:break-word;">${renderVersaoRichHtml(raw, fallbackText)}</div>`
}

export function generatePropostaHtml(
  proposal: PropostaWithRelations,
  tipoProposta?: {
    treinamento_tecnico?: string | null
    frase_preco?: string | null
    frase_comissao?: string | null
    comissao?: number | null
    nome?: string | null
    prazo_entrega?: string | null
    condicoes_pagamento?: string | null
    garantia?: string | null
    assistencia_tecnica?: string | null
    transporte_seguro?: string | null
    validade_oferta?: string | null
    imposto_ipi?: string | null
    imposto_icms?: string | null
    campos_adicionais?:
      | Json
      | Array<{ titulo: string; conteudo: string }>
      | Record<string, string | number>
      | null
  } | null,
  equipmentItems?: PropostaVersaoWithRelations[] | null,
  tiposPropostaMap?: Record<
    string,
    {
      treinamento_tecnico?: string | null
      frase_preco?: string | null
      frase_comissao?: string | null
      comissao?: number | null
      nome?: string | null
      prazo_entrega?: string | null
      condicoes_pagamento?: string | null
      garantia?: string | null
      assistencia_tecnica?: string | null
      transporte_seguro?: string | null
      validade_oferta?: string | null
      imposto_ipi?: string | null
      imposto_icms?: string | null
      campos_adicionais?:
        | Json
        | Array<{ titulo: string; conteudo: string }>
        | Record<string, string | number>
        | null
    }
  > | null,
): string {
  const c = proposal.clientes
  const snapshotRoot = proposal.dados_snapshot as
    | import('@/lib/proposal-snapshot').PropostaSnapshotRoot
    | null
    | undefined
  const primaryFromSnapshot = snapshotRoot?.primary_versao
  const primaryItem = equipmentItems && equipmentItems[0] ? equipmentItems[0] : null
  const primaryVersao = primaryFromSnapshot || primaryItem?.versoes || proposal.versoes || null

  // Numeração hierárquica de títulos de seção (espelho do gerador do servidor)
  const sectionCounter = new ProposalSectionCounter()

  const machineTitle = (
    primaryVersao?.nome ||
    primaryVersao?.nome_abreviado ||
    proposal.versao_original ||
    proposal.descricao_proposta ||
    'EQUIPAMENTO INDUSTRIAL'
  ).toUpperCase()

  const machineImage = primaryVersao?.imagem_preview || proposal.versoes?.imagem_preview || ''

  const clientCompanyName = c?.razao_social || c?.fantasia || proposal.cliente_original || 'Cliente'
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

  const proposalFrasePreco =
    (proposal as { frase_preco?: string | null }).frase_preco || tipoProposta?.frase_preco

  const terms: Array<[string, string | null | undefined]> = [
    ['Condições de Pagamento', proposal.condicoes_pagamento],
    ['Prazo de Entrega', proposal.prazo_entrega],
    ['Validade da Oferta', proposal.validade_oferta],
    ['Cobertura de Garantia', proposal.cobertura_garantia],
    ['Garantia de Acessórios', proposal.garantia_acessorios],
    ['Normas Aplicáveis', proposal.normas_aplicaveis],
    ['Normas de Segurança', proposal.normas_seguranca],
    ['Certificações', proposal.certificacoes],
    ['Assistência Técnica', proposal.assistencia_tecnica_detalhada],
    ['Critérios de Aceitação', proposal.criterios_aceitacao],
    ['Materiais Utilizados', proposal.materiais_utilizados],
    ['Transporte/Seguro', proposal.transporte_seguro],
    ['Imposto IPI', rawIpiVal],
    ['Imposto ICMS', rawIcmsVal],
    [
      'Treinamento Técnico',
      (proposal as { treinamento_tecnico?: string | null }).treinamento_tecnico ||
        tipoProposta?.treinamento_tecnico,
    ],
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
      // ignore json parse error
    }
  }

  const filteredTerms = terms.filter(([lbl, val]) => {
    if (isCommercialFieldEmpty(val, lbl)) return false
    const lower = lbl.toLowerCase()
    if (lower.includes('ipi') || lower.includes('icms') || lower.includes('imposto')) {
      return !isTaxValueEmpty(val, lbl)
    }
    return true
  }) as Array<[string, string | null | undefined]>

  const moeda = normalizeMoedaCode(proposal.moeda || 'BRL')
  const valorFinal = proposal.valor_final ?? proposal.valor_atual ?? 0
  const precoEspecial =
    proposal.preco_especial != null && Number(proposal.preco_especial) > 0
      ? Number(proposal.preco_especial)
      : null
  const discountBadge = formatPrecoEspecialDiscountBadge(valorFinal, precoEspecial)
  const valorSemDesc =
    proposal.valor_sem_desconto != null && Number(proposal.valor_sem_desconto) > 0
      ? Number(proposal.valor_sem_desconto)
      : valorFinal
  const descPerc = proposal.percentual_desconto || 0

  // Point 1: Rule for strikethrough original table price
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

  const primaryDescFontSizePt = resolveDescricaoFontSizePdf(
    (primaryVersao as any)?.descricao_tamanho,
  )

  const technicalSpecsHtml = renderTechnicalHtml(
    primaryVersao?.especificacoes_tecnicas ||
      proposal.especificacoes_tecnicas ||
      proposal.descricao_proposta,
    'Conforme catálogo e especificações técnicas de fábrica.',
    primaryDescFontSizePt,
  )
  const caracteristicasHtml = primaryVersao?.caracteristicas_construtivas
    ? renderTechnicalHtml(primaryVersao.caracteristicas_construtivas, '', primaryDescFontSizePt)
    : ''
  const acessoriosStandardsHtml = primaryVersao?.acessorios_standards
    ? renderTechnicalHtml(primaryVersao.acessorios_standards, '', primaryDescFontSizePt)
    : ''

  const snapshotCampos = snapshotRoot?.campos_adicionais
  const rawCamposAdicionais =
    Array.isArray(snapshotCampos) && snapshotCampos.length > 0
      ? snapshotCampos
      : proposal.campos_adicionais

  let parsedCamposAdicionais: any[] = []
  if (Array.isArray(rawCamposAdicionais)) {
    parsedCamposAdicionais = rawCamposAdicionais
  } else if (typeof rawCamposAdicionais === 'string') {
    try {
      const parsed = JSON.parse(rawCamposAdicionais)
      if (Array.isArray(parsed)) parsedCamposAdicionais = parsed
    } catch {
      // ignore json parse error
    }
  }

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
    if (isCommercialFieldEmpty(fContent)) return false
    const fKey = normCampoKey(f.chave || f.id || f.titulo)
    if (fKey && renderedCampoKeys.has(fKey)) return false
    if (fKey) renderedCampoKeys.add(fKey)
    return true
  })

  const hasAnyPage2Content =
    Boolean(technicalSpecsHtml) ||
    Boolean(caracteristicasHtml) ||
    Boolean(acessoriosStandardsHtml) ||
    (Array.isArray(proposal.acessorios_proposta) && proposal.acessorios_proposta.length > 0) ||
    Boolean(proposal.is_pacote && equipmentItems && equipmentItems.length > 0) ||
    filteredTerms.length > 0 ||
    validCamposAdicionais.length > 0 ||
    proposal.valor_final != null

  const page1PageNumber = hasAnyPage2Content ? 'Página 1/2' : 'Página 1/1'

  return `
    <div class="proposal-page proposal-cover" data-page="1" style="margin-top: 0 !important; padding-top: 0 !important;">
      <div>
        <div style="page-break-inside:avoid;break-inside:avoid;">
          <div class="proposal-top-header">
            <div style="display:flex;flex-direction:column;align-items:flex-start;gap:8px;">
              <img src="${benerLogo}" alt="BENER - MÁQUINAS QUE TRANSFORMAM" class="bener-logo-img" />
            </div>
            <div class="proposal-number-box">
              <p class="prop-title">${proposal.numero_proposta ? `Proposta Nº ${esc(proposal.numero_proposta)}` : 'Proposta Comercial'}</p>
              ${proposal.revisao ? `<p>Revisão: ${esc(proposal.revisao)}</p>` : ''}
              <p>Data: ${esc(proposal.dt_cad || new Date().toLocaleDateString('pt-BR'))}</p>
              <p>Modalidade: ${proposal.modelo_licitacao ? 'Licitação' : 'Proposta Comercial'}</p>
            </div>
          </div>

          <div class="client-header">
            <p>À</p>
            <p class="client-name">${esc(clientCompanyName)}</p>
            ${clientAddressLine ? `<p>${esc(clientAddressLine)}</p>` : ''}
            ${clientPhone ? `<p>Telefone: ${esc(clientPhone)}</p>` : ''}
            ${clientEmail ? `<p>E-mail: ${esc(clientEmail)}</p>` : ''}
            <p style="padding-top: 8px;">A/C: <strong>${esc(contactName || 'Diretor / Gerente de Compras')}</strong></p>
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
                : `<div style="height:180px;border:1px dashed #ccc;display:flex;align-items:center;justify-content:center;color:#888;">Imagem do equipamento</div>`
            }
            <p class="image-caption">Imagem meramente ilustrativa</p>
          </div>
        </div>
      </div>

      <div class="footer">
        <p>Rua Iracema Lucas, 450 (Antiga Rua Parsch) - Distrito Industrial</p>
        <p>Vinhedo - SP - Brasil - CEP: 13280-172 - Fone / Fax: (0**19) 3826-7373</p>
        <p>E-mail: vendas@bener.com.br - Site: www.bener.com.br</p>
      </div>
    </div>

    ${
      hasAnyPage2Content
        ? `<div class="proposal-page" data-page="2" style="margin-top: 0 !important; padding-top: 0 !important;">
      <div>

        ${
          technicalSpecsHtml
            ? `<div style="margin-bottom:12px;page-break-inside:avoid;break-inside:avoid;">
                 <div style="display:block;font-size:10.5pt;font-weight:700;color:#0b3c26;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;page-break-after:avoid;break-after:avoid;">${esc(sectionCounter.nextLevel1('Especificações Técnicas'))}</div>
                 ${technicalSpecsHtml}
               </div>`
            : ''
        }

        ${
          caracteristicasHtml
            ? `<div style="margin-bottom:12px;page-break-inside:avoid;break-inside:avoid;">
                 <div style="display:block;font-size:10.5pt;font-weight:700;color:#0b3c26;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;page-break-after:avoid;break-after:avoid;">${esc(sectionCounter.nextLevel1('Características Construtivas'))}</div>
                 ${caracteristicasHtml}
               </div>`
            : ''
        }

        ${
          acessoriosStandardsHtml
            ? `<div style="margin-bottom:12px;page-break-inside:avoid;break-inside:avoid;">
                 <div style="display:block;font-size:10.5pt;font-weight:700;color:#0b3c26;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;page-break-after:avoid;break-after:avoid;">${esc(sectionCounter.nextLevel1('Configuração Standard'))}</div>
                 ${acessoriosStandardsHtml}
               </div>`
            : ''
        }

        ${(() => {
          const rawAcc = Array.isArray(proposal.acessorios_proposta)
            ? (proposal.acessorios_proposta as Array<{
                id?: string
                nome?: string
                valor?: number
                moeda?: string
                inclusao?: string
                quantidade?: number
              }>)
            : []
          const filteredAcc = rawAcc.filter((a) => a.inclusao !== 'nao_exibir')
          if (filteredAcc.length === 0) return ''

          const inclusos = filteredAcc.filter(
            (a) => a.inclusao === 'incluir' || a.inclusao === 'preco' || a.inclusao === undefined,
          )
          // Não Inclusos virou seção própria numerada após o Valor Total (espelho do servidor)
          let out = ''

          if (inclusos.length > 0) {
            out += `<div style="margin-bottom:12px;page-break-inside:avoid;break-inside:avoid;">
             <div style="display:block;font-size:10.5pt;font-weight:700;color:#0b3c26;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;page-break-after:avoid;break-after:avoid;">${esc(sectionCounter.nextLevel1('Acessórios Opcionais Inclusos no Preço abaixo'))}</div>
              <ul style="list-style:none;padding:0;margin:0;font-size:9.5pt;line-height:1.45;color:#0f172a;font-weight:500;">
                ${inclusos
                  .map(
                    (a) =>
                      `<li style="display:flex;align-items:baseline;gap:6px;margin-bottom:2px;"><span style="color:#0b3c26;font-weight:bold;">•</span><span>${a.quantidade ? `${a.quantidade}x ` : ''}${esc(a.nome || '—')}</span></li>`,
                  )
                  .join('')}
              </ul>
            </div>`
          }

          return out
        })()}

        ${
          equipmentItems && equipmentItems.length > 1
            ? `<div class="section-heading" style="page-break-inside:avoid;break-inside:avoid;break-after:avoid;">${esc(sectionCounter.nextLevel1('Equipamentos Inclusos no Pacote'))}</div>
               <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:12px;font-size:11px;page-break-inside:avoid;break-inside:avoid;">
                 ${equipmentItems
                   .map((item, idx) => {
                     const tipoDesc =
                       item.tipo_proposta || (idx === 0 ? proposal.tipo_proposta : '')
                     const itemSpecs =
                       item.versoes?.especificacoes_tecnicas ||
                       (idx === 0
                         ? proposal.descricao_proposta || proposal.especificacoes_tecnicas
                         : '')
                     const itemCaract = item.versoes?.caracteristicas_construtivas
                     const itemAcess = item.versoes?.acessorios_standards
                     const itemFontSizePt = resolveDescricaoFontSizePdf(
                       (item.versoes as any)?.descricao_tamanho,
                     )

                     return `<div style="border:1px solid #ccc;padding:6px;border-radius:4px;">
                       <div style="display:flex;justify-content:space-between;align-items:center;">
                         <strong>${idx + 1}. ${esc(item.versoes?.nome || 'Equipamento')}</strong>
                         ${tipoDesc ? `<span style="font-size:10px;background:#f1f5f9;border:1px solid #cbd5e1;padding:1px 5px;border-radius:3px;">Tipo: ${esc(tipoDesc)}</span>` : ''}
                       </div>
                       <div style="color:#333;margin-top:2px;">
                         Qtd: ${item.quantidade} | Unitário: ${formatCurrencyByMoeda(item.valor_unitario, item.versoes?.moeda || moeda)}${item.desconto_percentual ? ` | Desc: ${item.desconto_percentual}%` : ''}
                       </div>
                       ${
                         itemAcess
                           ? `<div style="margin-top:6px;padding-top:4px;border-top:1px solid #e2e8f0;">
                         <div style="display:block;font-size:10.5pt;font-weight:700;color:#0b3c26;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;page-break-after:avoid;break-after:avoid;">Configuração Standard</div>
                         ${renderTechnicalHtml(itemAcess, '', itemFontSizePt)}
                       </div>`
                           : ''
                       }
                       ${
                         itemCaract
                           ? `<div style="margin-top:6px;padding-top:4px;border-top:1px solid #e2e8f0;">
                         <div style="display:block;font-size:10.5pt;font-weight:700;color:#0b3c26;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;page-break-after:avoid;break-after:avoid;">Características Construtivas</div>
                         ${renderTechnicalHtml(itemCaract, '', itemFontSizePt)}
                       </div>`
                           : ''
                       }
                       ${
                         itemSpecs
                           ? `<div style="margin-top:6px;padding-top:4px;border-top:1px solid #e2e8f0;">
                         <div style="display:block;font-size:10.5pt;font-weight:700;color:#0b3c26;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;page-break-after:avoid;break-after:avoid;">Especificações Técnicas</div>
                         ${renderTechnicalHtml(itemSpecs, '', itemFontSizePt)}
                       </div>`
                           : ''
                       }
                     </div>`
                   })
                   .join('')}
               </div>`
            : ''
        }

        <div style="background:#0b3c26;color:#ffffff;padding:6px 10px;border-radius:3px;display:flex;justify-content:space-between;align-items:center;margin:16px 0 10px 0;">
          <span style="font-size:11px;font-weight:bold;letter-spacing:0.8px;text-transform:uppercase;">${esc(sectionCounter.nextLevel1('Condições Comerciais'))}</span>
          <span style="font-size:10px;opacity:0.9;">${proposal.is_pacote ? 'Pacote de Máquinas' : 'Fornecimento Unitário'}</span>
        </div>

        ${(() => {
          const moedaOrig = normalizeMoedaCode(proposal.moeda_original || proposal.moeda || 'BRL')
          const moedaProp = normalizeMoedaCode(proposal.moeda || 'BRL')
          const hasRealConversion = moedaProp !== moedaOrig && Boolean(proposal.cotacao_moeda)

          if (!hasRealConversion) return ''

          const fmtPtax4 = (n: any) =>
            (Number(n) || 0).toLocaleString('pt-BR', {
              minimumFractionDigits: 4,
              maximumFractionDigits: 4,
            })
          const rawDataCot =
            proposal.data_cotacao_moeda || (proposal as any)?.dados_snapshot?.data_cotacao_moeda
          let dataCotFmt = ''
          if (rawDataCot) {
            const s = String(rawDataCot).trim()
            if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) dataCotFmt = s
            else if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
              const [y, m, d] = s.split('T')[0].split('-')
              if (y && m && d) dataCotFmt = `${d}/${m}/${y}`
            } else {
              dataCotFmt = s
            }
          }

          return `<div style="margin-bottom:12px;padding:8px 10px;background:#f8fafc;border:1px solid #cbd5e1;border-radius:4px;font-size:11px;color:#1e293b;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
            <div style="display:flex;align-items:center;gap:8px;">
              <span style="font-weight:bold;color:#0f172a;text-transform:uppercase;font-size:10px;background:#e2e8f0;padding:2px 6px;border-radius:3px;">Câmbio / Cotação</span>
              <span>Moeda da proposta: <strong>${moedaProp}</strong> (Original: ${moedaOrig})</span>
            </div>
            <div style="display:flex;align-items:center;gap:12px;">
              <span>Taxa aplicada: <strong>1 ${moedaProp} = R$ ${fmtPtax4(proposal.cotacao_moeda)}</strong></span>
              ${dataCotFmt ? `<span style="color:#475569;"><strong>Cotação de fechamento de ${esc(dataCotFmt)}</strong></span>` : ''}
            </div>
          </div>`
        })()}

        <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:12px;">
          ${
            proposal.is_pacote && equipmentItems && equipmentItems.length > 0
              ? equipmentItems
                  .map((item, idx) => {
                    const itemNome =
                      item.versoes?.nome || item.versoes?.nome_abreviado || `Item ${idx + 1}`
                    const itemMoeda = normalizeMoedaCode(item.versoes?.moeda || moeda)
                    const qtd = item.quantidade || 1
                    const valUnit = Number(item.valor_unitario || 0)
                    const descPct = Number(item.desconto_percentual || 0)
                    const descVal = Number(item.desconto_valor || 0)
                    const subtotal = qtd * valUnit
                    const totalItem =
                      descVal > 0 ? Math.max(0, subtotal - descVal) : subtotal * (1 - descPct / 100)
                    const itemHasDiscount = descPct > 0 || descVal > 0
                    const valorUnitEfetivo = qtd > 0 ? totalItem / qtd : totalItem
                    const tipoDesc = item.tipo_proposta || (idx === 0 ? proposal.tipo_proposta : '')

                    return `<div style="border:1px solid #cbd5e1;border-radius:4px;padding:8px 10px;background:#f8fafc;">
                      <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #e2e8f0;padding-bottom:6px;margin-bottom:6px;">
                        <div style="display:flex;align-items:center;gap:6px;">
                          <span style="font-size:10px;font-weight:bold;color:#0b3c26;background:rgba(11,60,38,0.1);padding:1px 5px;border-radius:3px;">#${idx + 1}</span>
                          <strong style="font-size:12px;color:#0f172a;">${esc(itemNome)}</strong>
                        </div>
                        ${tipoDesc ? `<span style="font-size:10px;font-weight:bold;background:#0b3c26;color:#ffffff;padding:2px 7px;border-radius:3px;">${esc(tipoDesc)}</span>` : ''}
                      </div>
                      <div style="display:grid;grid-template-columns:1fr 1.5fr 1fr 1.5fr;gap:8px;font-size:11px;align-items:center;">
                        <div>
                          <div style="font-size:9px;text-transform:uppercase;color:#64748b;font-weight:600;letter-spacing:0.5px;">Quantidade</div>
                          <div style="font-weight:bold;color:#1e293b;">${qtd} un.</div>
                        </div>
                        <div>
                          <div style="font-size:9px;text-transform:uppercase;color:#64748b;font-weight:600;letter-spacing:0.5px;">Valor Unitário</div>
                          ${
                            itemHasDiscount
                              ? `<div style="display:flex;flex-direction:column;">
                                  <span style="text-decoration:line-through;color:#94a3b8;font-size:10px;">${formatCurrencyByMoeda(valUnit, itemMoeda)}</span>
                                  <span style="font-weight:bold;color:#0f172a;">${formatCurrencyByMoeda(valorUnitEfetivo, itemMoeda)}</span>
                                </div>`
                              : `<span style="font-weight:bold;color:#0f172a;">${formatCurrencyByMoeda(valUnit, itemMoeda)}</span>`
                          }
                        </div>
                        <div>
                          <div style="font-size:9px;text-transform:uppercase;color:#64748b;font-weight:600;letter-spacing:0.5px;">Desconto</div>
                          <div style="color:#334155;font-weight:500;">${descPct > 0 ? `${descPct}%` : descVal > 0 ? formatCurrencyByMoeda(descVal, itemMoeda) : '—'}</div>
                        </div>
                        <div style="text-align:right;">
                          <div style="font-size:9px;text-transform:uppercase;color:#64748b;font-weight:600;letter-spacing:0.5px;">Subtotal</div>
                          ${
                            itemHasDiscount
                              ? `<div style="display:flex;flex-direction:column;align-items:flex-end;">
                                  <span style="text-decoration:line-through;color:#94a3b8;font-size:10px;">${formatCurrencyByMoeda(subtotal, itemMoeda)}</span>
                                  <span style="font-weight:900;color:#0b3c26;font-size:12px;">${formatCurrencyByMoeda(totalItem, itemMoeda)}</span>
                                </div>`
                              : `<span style="font-weight:900;color:#0b3c26;font-size:12px;">${formatCurrencyByMoeda(totalItem, itemMoeda)}</span>`
                          }
                        </div>
                      </div>
                    </div>`
                  })
                  .join('')
              : `<div style="border:1px solid #cbd5e1;border-radius:4px;padding:8px 10px;background:#f8fafc;">
                  <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #e2e8f0;padding-bottom:6px;margin-bottom:6px;">
                    <div style="display:flex;align-items:center;gap:6px;">
                      <span style="font-size:10px;font-weight:bold;color:#0b3c26;background:rgba(11,60,38,0.1);padding:1px 5px;border-radius:3px;">#1</span>
                      <strong style="font-size:12px;color:#0f172a;">${esc(machineTitle)}</strong>
                    </div>
                    ${proposal.tipo_proposta ? `<span style="font-size:10px;font-weight:bold;background:#0b3c26;color:#ffffff;padding:2px 7px;border-radius:3px;">${esc(proposal.tipo_proposta)}</span>` : ''}
                  </div>
                  <div style="display:grid;grid-template-columns:1fr 1.5fr 1fr 1.5fr;gap:8px;font-size:11px;align-items:center;">
                    <div>
                      <div style="font-size:9px;text-transform:uppercase;color:#64748b;font-weight:600;letter-spacing:0.5px;">Quantidade</div>
                      <div style="font-weight:bold;color:#1e293b;">1 un.</div>
                    </div>
                    <div>
                      <div style="font-size:9px;text-transform:uppercase;color:#64748b;font-weight:600;letter-spacing:0.5px;">Valor Unitário</div>
                      ${
                        hasItemDiscount
                          ? `<div style="display:flex;flex-direction:column;">
                              <span style="text-decoration:line-through;color:#94a3b8;font-size:10px;">${formatCurrencyByMoeda(valorOriginalTabela, moeda)}</span>
                              <span style="font-weight:bold;color:#0f172a;">${formatCurrencyByMoeda(valorUnitarioEfetivo, moeda)}</span>
                            </div>`
                          : `<span style="font-weight:bold;color:#0f172a;">${formatCurrencyByMoeda(valorOriginalTabela, moeda)}</span>`
                      }
                    </div>
                    <div>
                      <div style="font-size:9px;text-transform:uppercase;color:#64748b;font-weight:600;letter-spacing:0.5px;">Desconto</div>
                      <div style="color:#334155;font-weight:500;">${effectiveDiscountPercent > 0 ? `${effectiveDiscountPercent}%` : '—'}</div>
                    </div>
                    <div style="text-align:right;">
                      <div style="font-size:9px;text-transform:uppercase;color:#64748b;font-weight:600;letter-spacing:0.5px;">Subtotal</div>
                      ${
                        hasItemDiscount
                          ? `<div style="display:flex;flex-direction:column;align-items:flex-end;">
                              <span style="text-decoration:line-through;color:#94a3b8;font-size:10px;">${formatCurrencyByMoeda(valorOriginalTabela, moeda)}</span>
                              <span style="font-weight:900;color:#0b3c26;font-size:12px;">${formatCurrencyByMoeda(valorEfetivoFinal, moeda)}</span>
                            </div>`
                          : `<span style="font-weight:900;color:#0b3c26;font-size:12px;">${formatCurrencyByMoeda(valorEfetivoFinal, moeda)}</span>`
                      }
                    </div>
                  </div>
                </div>`
          }
        </div>

        <div style="background:#f1f5f9;border:1px solid #cbd5e1;border-radius:4px;padding:10px 14px;display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <div>
            <div style="font-size:10px;text-transform:uppercase;font-weight:bold;letter-spacing:0.8px;color:#475569;">Valor Total do Fornecimento</div>
            <div style="font-size:10px;color:#64748b;">${proposal.is_pacote && equipmentItems && equipmentItems.length > 0 ? `Soma de ${equipmentItems.length} equipamento(s)` : 'Condição comercial integral'}</div>
          </div>
          <div style="text-align:right;">
            ${
              precoEspecial != null
                ? `<div style="display:flex;flex-direction:column;align-items:flex-end;gap:2px;">
                    <div style="display:flex;align-items:center;gap:6px;">
                      <span style="text-decoration:line-through;color:#94a3b8;font-size:11px;font-weight:600;">${formatCurrencyByMoeda(valorFinal, moeda)}</span>
                      <span style="font-size:9px;text-transform:uppercase;letter-spacing:0.5px;color:#ffffff;background:#0b3c26;font-weight:bold;padding:1px 5px;border-radius:2px;">Preço Especial</span>
                      ${
                        discountBadge
                          ? `<span style="font-size:9px;font-weight:bold;color:#0b3c26;background:rgba(11,60,38,0.1);border:1px solid rgba(11,60,38,0.3);padding:1px 5px;border-radius:8px;">${discountBadge}</span>`
                          : ''
                      }
                    </div>
                    <span style="font-weight:900;color:#0b3c26;font-size:15px;">${formatCurrencyByMoeda(precoEspecial, moeda)}</span>
                  </div>`
                : `<span style="font-weight:900;color:#0b3c26;font-size:15px;">${formatCurrencyByMoeda(valorFinal, moeda)}</span>`
            }
          </div>
        </div>
        ${
          proposalFrasePreco && String(proposalFrasePreco).trim() !== ''
            ? `<div style="margin-top:4px;margin-bottom:12px;font-size:10px;font-weight:600;color:#0f172a;text-transform:uppercase;letter-spacing:0.5px;">${esc(String(proposalFrasePreco).trim())}</div>`
            : ''
        }

        ${(() => {
          // Acessórios Opcionais Não Inclusos no Preço Acima: seção própria numerada,
          // imediatamente após Valor Total / Condições Comerciais (espelho do servidor)
          const rawAcc = Array.isArray(proposal.acessorios_proposta)
            ? (proposal.acessorios_proposta as Array<{
                id?: string
                nome?: string
                valor?: number
                moeda?: string
                inclusao?: string
                quantidade?: number
              }>)
            : []
          const naoInclusos = rawAcc.filter(
            (a) =>
              a &&
              a.inclusao !== 'nao_exibir' &&
              (a.inclusao === 'opcional' || a.inclusao === 'exibir'),
          )
          if (naoInclusos.length === 0) return ''
          const propMoeda = normalizeMoedaCode(proposal.moeda || 'BRL')

          return `<div style="margin-bottom:16px;page-break-inside:avoid;break-inside:avoid;">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:12.5pt;font-weight:bold;color:#0b3c26;text-transform:uppercase;letter-spacing:0.8px;margin:16px 0 5px 0;padding-bottom:5px;border-bottom:0.5pt solid #cbd5e1;page-break-after:avoid;break-after:avoid;-webkit-print-color-adjust:exact;print-color-adjust:exact;">
              <div style="display:flex;align-items:center;gap:8px;">
                <span style="display:inline-block;width:3.5pt;height:14pt;background:#0b3c26;border-radius:1px;"></span>
                <span>${esc(sectionCounter.nextLevel1('Acessórios Opcionais Não Inclusos no Preço Acima'))}</span>
              </div>
            </div>
            <ul style="list-style:none;padding:0;margin:0;font-size:9.5pt;line-height:1.45;color:#0f172a;font-weight:500;">
              ${naoInclusos
                .map((a) => {
                  const itemMoeda = a.moeda || propMoeda
                  const valFmt = a.valor != null ? formatCurrencyByMoeda(a.valor, itemMoeda) : null
                  return `<li style="display:flex;justify-content:space-between;align-items:baseline;gap:8px;margin-bottom:2px;"><div style="display:flex;align-items:baseline;gap:6px;"><span style="color:#0b3c26;font-weight:bold;">•</span><span>${a.quantidade ? `${a.quantidade}x ` : ''}${esc(a.nome || '—')}</span></div>${valFmt ? `<span style="font-weight:bold;color:#0f172a;white-space:nowrap;">${valFmt}</span>` : ''}</li>`
                })
                .join('')}
            </ul>
          </div>`
        })()}

        ${
          filteredTerms.length > 0
            ? `<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:12.5pt;font-weight:bold;color:#0b3c26;text-transform:uppercase;letter-spacing:0.8px;margin:16px 0 5px 0;padding-bottom:5px;border-bottom:0.5pt solid #cbd5e1;page-break-after:avoid;break-after:avoid;-webkit-print-color-adjust:exact;print-color-adjust:exact;">
                 <div style="display:flex;align-items:center;gap:8px;">
                   <span style="display:inline-block;width:3.5pt;height:14pt;background:#0b3c26;border-radius:1px;"></span>
                   <span>${esc(sectionCounter.nextLevel1('Termos de Fornecimento'))}</span>
                 </div>
                 <span style="font-size:10pt;color:#64748b;font-weight:500;text-transform:none;">Condições Gerais & Garantias</span>
               </div>
               <div class="terms-section" style="width:100%;display:block;margin-bottom:16px;">
                 ${filteredTerms
                   .map(
                     ([lbl, val]) => `
                   <div class="term-item" style="display:block;width:100%;margin-bottom:12px;page-break-inside:avoid;break-inside:avoid;">
                    <div class="term-title" style="display:block;font-size:10.5pt;font-weight:700;color:#0b3c26;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;page-break-after:avoid;break-after:avoid;">${esc(sectionCounter.nextLevel2(lbl))}</div>
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
                     <span>${esc(sectionCounter.nextLevel1('Informações Adicionais'))}</span>
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
                       <div class="term-title" style="display:block;font-size:10.5pt;font-weight:700;color:#0b3c26;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;page-break-after:avoid;break-after:avoid;">${esc(sectionCounter.nextLevel2(fieldTitle))}</div>
                       <div class="term-content" style="display:block;width:100%;color:#0f172a;font-size:9.5pt;font-weight:500;line-height:1.45;word-break:break-word;">${renderMultilinhaHtml(fieldVal)}</div>
                     </div>`
                     })
                     .join('')}
                 </div>
               </div>`
            : ''
        }

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
              <strong>${esc(proposal.nome_gerente_produto || proposal.gerentes?.nome || proposal.gerente_original || '—')}</strong><br />
              Gerente de Produto
            </div>
          </div>
          <div>
            <div class="sig-line">
              <strong>${esc(proposal.nome_assessor_tecnico || '—')}</strong><br />
              Assessor Técnico
            </div>
          </div>
          <div>
            <div class="sig-line">
              <strong>${esc(proposal.nome_representante_comercial || proposal.representantes?.fantasia || proposal.representante_original || '—')}</strong><br />
              Representante Comercial
            </div>
          </div>
        </div>
      </div>

      <div class="footer">
        <p>Rua Iracema Lucas, 450 (Antiga Rua Parsch) - Distrito Industrial</p>
        <p>Vinhedo - SP - Brasil - CEP: 13280-172 - Fone / Fax: (0**19) 3826-7373</p>
        <p>E-mail: vendas@bener.com.br - Site: www.bener.com.br</p>
      </div>
    </div>`
        : ''
    }
  `
}

export function printProposta(
  proposal: PropostaWithRelations,
  tipoProposta?: {
    treinamento_tecnico?: string | null
    frase_preco?: string | null
    frase_comissao?: string | null
    comissao?: number | null
    nome?: string | null
    prazo_entrega?: string | null
    condicoes_pagamento?: string | null
    garantia?: string | null
    assistencia_tecnica?: string | null
    transporte_seguro?: string | null
    validade_oferta?: string | null
    imposto_ipi?: string | null
    imposto_icms?: string | null
    campos_adicionais?:
      | Json
      | Array<{ titulo: string; conteudo: string }>
      | Record<string, string | number>
      | null
  } | null,
  equipmentItems?: PropostaVersaoWithRelations[] | null,
  tiposPropostaMap?: Record<
    string,
    {
      treinamento_tecnico?: string | null
      frase_preco?: string | null
      frase_comissao?: string | null
      comissao?: number | null
      nome?: string | null
      prazo_entrega?: string | null
      condicoes_pagamento?: string | null
      garantia?: string | null
      assistencia_tecnica?: string | null
      transporte_seguro?: string | null
      validade_oferta?: string | null
      imposto_ipi?: string | null
      imposto_icms?: string | null
      campos_adicionais?:
        | Json
        | Array<{ titulo: string; conteudo: string }>
        | Record<string, string | number>
        | null
    }
  > | null,
): void {
  const html = generatePropostaHtml(proposal, tipoProposta, equipmentItems, tiposPropostaMap)
  openPrintWindow(html)
}
