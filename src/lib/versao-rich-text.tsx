import React from 'react'

/**
 * Utilitário de conversão e renderização de textos ricos de Versões de Produtos.
 * Atende estritamente às regras da usuária Bianca para o arquivo extrator_versoes.csv:
 *
 * 1. NEGRITO: <B> e </B>
 *    - Todo texto entre <B> e </B> renderizado como <strong>...</strong> (negrito).
 *    - NUNCA exibir as tags <B> ou </B> literais.
 *    - Se a frase inteira de um parágrafo estiver entre <B>...</B>, é um TÍTULO em negrito.
 *
 * 2. PARÁGRAFOS: quebras de linha (\n)
 *    - Cada \n dentro da célula = um parágrafo novo.
 *    - NUNCA juntar linhas que estavam separadas no original.
 *
 * 3. BULLETS: "•"
 *    - Toda linha iniciada por "•" vira <li>...</li> em <ul>...</ul>.
 *    - O caractere "•" é REMOVIDO do texto (o marcador visual substitui).
 *    - Vários "•" seguidos formam uma única lista <ul>.
 *
 * 4. SEÇÕES NUMERADAS:
 *    - "1.", "1)", "ponto 1", "ponto 2" iniciam bloco/parágrafo separado.
 *
 * 5. CAMPOS VAZIOS:
 *    - Célula vazia = não renderiza nada (nem título nem parágrafo vazio).
 */

export interface VersaoRichBlock {
  type: 'title' | 'paragraph' | 'bullet_list'
  content?: string
  items?: string[]
}

/**
 * Regex para capturar o marcador de espaçamento codificado [SPn]
 * Onde n é a quantidade de espaços em branco consecutivos (1 ou mais dígitos).
 * Ex.: [SP33], [SP11]
 */
export const SP_MARKER_REGEX = /\[SP(\d+)\]/gi

/**
 * Converte marcadores [SPn] em n repetições de espaço comum (' ') para caminhos de texto puro.
 * NUNCA exibe o marcador [SPn] como texto visível.
 */
export function convertSpMarkersToPlainText(text: string): string {
  if (!text) return ''
  return text.replace(SP_MARKER_REGEX, (_, countStr) => {
    const count = parseInt(countStr, 10)
    return Number.isFinite(count) && count > 0 ? ' '.repeat(count) : ''
  })
}

/**
 * Converte marcadores [SPn] em n repetições de &nbsp; (espaço não-quebrável) para HTML seguro.
 * Envolve o trecho em <span style="white-space:pre"> para garantir alinhamento perfeito de colunas.
 */
export function convertSpMarkersToHtml(text: string): string {
  if (!text) return ''
  return text.replace(SP_MARKER_REGEX, (_, countStr) => {
    const count = parseInt(countStr, 10)
    if (!Number.isFinite(count) || count <= 0) return ''
    return `<span style="white-space:pre;">${'&nbsp;'.repeat(count)}</span>`
  })
}

/**
 * Remove marcadores [SPn] e tags <B> e </B> de qualquer string.
 */
export function stripSpMarkers(str: string): string {
  return str.replace(SP_MARKER_REGEX, '')
}

/**
 * Remove tags <B> e </B> de qualquer string (case-insensitive)
 */
export function stripBoldTags(str: string): string {
  return str.replace(/<\/?b\b[^>]*>/gi, '')
}

/**
 * Escapa HTML para prevenir XSS ao gerar HTML em string.
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Converte trechos de <B>...</B> dentro de uma string de texto em elementos React.
 */
/**
 * Converte trechos de [SPn] dentro de uma string de texto em nós React com &nbsp; e white-space:pre.
 */
function renderSpMarkersReact(text: string, baseKey: string | number): React.ReactNode[] {
  if (!text) return []
  const parts: React.ReactNode[] = []
  const regex = /\[SP(\d+)\]/gi
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index))
    }
    const count = parseInt(match[1], 10)
    const n = Number.isFinite(count) && count > 0 ? count : 0
    if (n > 0) {
      // \u00A0 é o non-breaking space (&nbsp;). Com whiteSpace: 'pre', o navegador não colapsa
      parts.push(
        <span key={`sp-${baseKey}-${match.index}`} style={{ whiteSpace: 'pre', display: 'inline' }}>
          {'\u00A0'.repeat(n)}
        </span>,
      )
    }
    lastIndex = regex.lastIndex
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex))
  }

  return parts
}

/**
 * Converte trechos de <B>...</B> e marcadores [SPn] dentro de uma string de texto em elementos React.
 * - <B>...</B> vira <strong>...</strong>
 * - [SPn] vira n repetições de \u00A0 dentro de <span style="white-space:pre">
 * - NUNCA exibe [SPn] visível ao usuário.
 */
export function renderInlineBoldReact(text: string): React.ReactNode[] {
  if (!text) return []
  const rawParts: Array<{ type: 'text' | 'bold'; content: string; key: number }> = []
  const regex = /<b\b[^>]*>([\s\S]*?)<\/b\s*>/gi
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      rawParts.push({
        type: 'text',
        content: text.slice(lastIndex, match.index),
        key: match.index,
      })
    }
    rawParts.push({
      type: 'bold',
      content: match[1],
      key: match.index + 1,
    })
    lastIndex = regex.lastIndex
  }

  if (lastIndex < text.length) {
    rawParts.push({
      type: 'text',
      content: text.slice(lastIndex),
      key: lastIndex,
    })
  }

  const finalNodes: React.ReactNode[] = []

  rawParts.forEach((part, idx) => {
    const cleanContent = part.content.replace(/<\/?b\b[^>]*>/gi, '')
    const spExpanded = renderSpMarkersReact(cleanContent, `${idx}-${part.key}`)

    if (part.type === 'bold') {
      finalNodes.push(
        <strong key={`b-${idx}`} className="font-bold text-[#0b3c26] dark:text-emerald-400">
          {spExpanded}
        </strong>,
      )
    } else {
      finalNodes.push(<React.Fragment key={`t-${idx}`}>{spExpanded}</React.Fragment>)
    }
  })

  return finalNodes
}

/**
 * Converte trechos de <B>...</B> e marcadores [SPn] dentro de uma string em HTML seguro.
 * - [SPn] é convertido para n repetições de &nbsp; envoltas em <span style="white-space:pre;">
 * - NUNCA exibe [SPn] no HTML gerado
 * - Preserva <strong style="font-weight:700;color:#0b3c26;"> para <B>
 */
export function renderInlineBoldHtml(text: string): string {
  if (!text) return ''

  // 1. Substitui [SPn] por marcadores temporários seguros antes de escapar HTML
  const spTokens: string[] = []
  const withSpTokens = text.replace(/\[SP(\d+)\]/gi, (_, countStr) => {
    const count = parseInt(countStr, 10)
    const n = Number.isFinite(count) && count > 0 ? count : 0
    const idx = spTokens.length
    const spHtml = n > 0 ? `<span style="white-space:pre;">${'&nbsp;'.repeat(n)}</span>` : ''
    spTokens.push(spHtml)
    return `___BENER_SP_${idx}___`
  })

  // 2. Substitui <B>...</B> por marcadores temporários seguros
  const boldTokens: string[] = []
  const withPlaceholders = withSpTokens.replace(/<b\b[^>]*>([\s\S]*?)<\/b\s*>/gi, (_, inner) => {
    const idx = boldTokens.length
    boldTokens.push(inner)
    return `___BENER_BOLD_${idx}___`
  })

  // 3. Remove tags residuais que não foram fechadas
  const clean = withPlaceholders.replace(/<\/?b\b[^>]*>/gi, '')

  // 4. Escapa o texto restante (protege contra XSS)
  let escaped = escapeHtml(clean)

  // 5. Restaura os tokens de negrito com escape
  boldTokens.forEach((inner, idx) => {
    escaped = escaped.replace(
      `___BENER_BOLD_${idx}___`,
      `<strong style="font-weight:700;color:#0b3c26;">${escapeHtml(inner)}</strong>`,
    )
  })

  // 6. Restaura os tokens de [SPn] gerados com &nbsp; e white-space:pre
  spTokens.forEach((spHtml, idx) => {
    escaped = escaped.replace(`___BENER_SP_${idx}___`, spHtml)
  })

  return escaped
}

/**
 * Analisa o texto bruto de uma versão e divide em blocos estruturados:
 * - Títulos (quando a linha inteira é <B>...</B> ou inicia com seção numerada forte)
 * - Parágrafos comuns
 * - Listas de bullets (linhas que iniciam com "•")
 */
export function parseVersaoRichBlocks(raw: string | null | undefined): VersaoRichBlock[] {
  if (!raw) return []
  const text = String(raw).replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim()
  if (!text) return []

  const lines = text.split('\n')
  const blocks: VersaoRichBlock[] = []
  let currentBulletItems: string[] = []

  const flushBullets = () => {
    if (currentBulletItems.length > 0) {
      blocks.push({
        type: 'bullet_list',
        items: [...currentBulletItems],
      })
      currentBulletItems = []
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i]
    if (!rawLine.trim()) {
      flushBullets()
      continue
    }

    // REGRA 7: Preserva espaços internos intencionais para alinhamento de colunas.
    // Apenas faz trim no final da linha e checa o marcador do início sem destruir os espaços internos.
    const trimmedRight = rawLine.trimEnd()
    const leadingTrimmed = trimmedRight.trimStart()

    // REGRA 3: Bullets - começa com "•" ou "·"
    if (leadingTrimmed.startsWith('•') || leadingTrimmed.startsWith('·')) {
      // Remove apenas o bullet inicial e o primeiro espaçamento após ele,
      // preservando todos os múltiplos espaços internos intencionais
      const itemText = leadingTrimmed.replace(/^[•·][ \t]*/, '')
      if (itemText.trim()) {
        currentBulletItems.push(itemText)
      }
      continue
    }

    // Se encontramos uma linha que não é bullet, libera a lista acumulada
    flushBullets()

    // REGRA 1 & 4: Título inteiro entre <B>...</B>
    const fullBoldMatch = leadingTrimmed.match(/^<b\b[^>]*>([\s\S]*?)<\/b\s*>$/i)
    if (fullBoldMatch) {
      const titleContent = fullBoldMatch[1]
      if (titleContent.trim()) {
        blocks.push({
          type: 'title',
          content: titleContent,
        })
      }
      continue
    }

    // Linha de seção numerada pura em negrito (ex: "1. <B>Unidade de Injeção</B>")
    const numberedTitleMatch = leadingTrimmed.match(
      /^(\d{1,2}[.)\-–—]|p[oó]nto\s+\d{1,3}[:.\-–—]?)[ \t]*<b\b[^>]*>([\s\S]*?)<\/b\s*>$/i,
    )
    if (numberedTitleMatch) {
      const prefix = numberedTitleMatch[1].trim()
      const titleContent = numberedTitleMatch[2]
      blocks.push({
        type: 'title',
        content: `${prefix} ${titleContent}`,
      })
      continue
    }

    // REGRA 2 & 7: Parágrafo normal preservando espaços internos e tabulações (alinhamento de colunas)
    blocks.push({
      type: 'paragraph',
      content: trimmedRight.trimStart(),
    })
  }

  flushBullets()
  return blocks
}

/**
 * Componente React para exibir campos de versão formatados com total fidelidade visual.
 */
export function VersaoRichText({
  content,
  emptyMessage,
  className = '',
}: {
  content: string | null | undefined
  emptyMessage?: string
  className?: string
}) {
  if (!content || !content.trim()) {
    if (emptyMessage) {
      return <span className="text-xs text-muted-foreground italic">{emptyMessage}</span>
    }
    return null
  }

  const blocks = parseVersaoRichBlocks(content)
  if (blocks.length === 0) return null

  return (
    <div
      className={`space-y-2 text-xs text-foreground leading-relaxed font-mono ${className}`}
      style={{
        fontFamily: "'Courier New', Courier, monospace, 'Lucida Console'",
        whiteSpace: 'pre-wrap',
      }}
    >
      {blocks.map((block, idx) => {
        if (block.type === 'title') {
          return (
            <h4
              key={idx}
              className="text-xs font-bold text-[#0b3c26] dark:text-emerald-400 mt-2.5 mb-1 pt-1 border-b border-[#0b3c26]/15 uppercase tracking-wide flex items-center gap-1.5 font-sans"
              style={{ whiteSpace: 'pre-wrap' }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#0b3c26] dark:bg-emerald-400 inline-block shrink-0" />
              <span style={{ whiteSpace: 'pre-wrap' }}>
                {renderInlineBoldReact(block.content || '')}
              </span>
            </h4>
          )
        }

        if (block.type === 'bullet_list') {
          return (
            <ul
              key={idx}
              className="list-disc pl-5 space-y-1 my-1.5 marker:text-[#0b3c26] dark:marker:text-emerald-400 text-slate-800 dark:text-slate-200"
              style={{ whiteSpace: 'pre-wrap' }}
            >
              {block.items?.map((item, itemIdx) => (
                <li key={itemIdx} className="leading-snug" style={{ whiteSpace: 'pre-wrap' }}>
                  {renderInlineBoldReact(item)}
                </li>
              ))}
            </ul>
          )
        }

        return (
          <p
            key={idx}
            className="my-1 text-slate-800 dark:text-slate-200"
            style={{ whiteSpace: 'pre-wrap' }}
          >
            {renderInlineBoldReact(block.content || '')}
          </p>
        )
      })}
    </div>
  )
}

/**
 * Gera HTML rico formatado para exportação em PDF (ProposalDocument / proposal-pdf).
 * REGRA 7: preserva espaços internos intencionais (alinhamento de colunas) usando white-space: pre-line / pre-wrap
 * e fonte monoespaçada nas linhas de especificação e listas.
 * Nunca gera marcações cruas (<B>, </B>, •).
 */
export function renderVersaoRichHtml(
  raw: string | null | undefined,
  fallbackText: string = '',
): string {
  if (!raw || !raw.trim()) {
    return fallbackText
      ? `<div style="font-size:11px;color:#64748b;font-style:italic;padding-left:12px;">${escapeHtml(fallbackText)}</div>`
      : ''
  }

  const blocks = parseVersaoRichBlocks(raw)
  if (blocks.length === 0) {
    return fallbackText
      ? `<div style="font-size:11px;color:#64748b;font-style:italic;padding-left:12px;">${escapeHtml(fallbackText)}</div>`
      : ''
  }

  const htmlChunks = blocks.map((block) => {
    if (block.type === 'title') {
      return `<div style="font-family:'Courier New',Courier,monospace;font-size:11px;font-weight:700;color:#0b3c26;margin-top:8px;margin-bottom:3px;text-transform:uppercase;letter-spacing:0.4px;border-bottom:1px solid rgba(11,60,38,0.2);padding-bottom:2px;white-space:pre-wrap;">${renderInlineBoldHtml(block.content || '')}</div>`
    }
    if (block.type === 'bullet_list') {
      const lis = (block.items || [])
        .map(
          (item) =>
            `<li style="margin-bottom:2.5px;padding-left:2px;white-space:pre-wrap;">${renderInlineBoldHtml(item)}</li>`,
        )
        .join('')
      return `<ul style="margin:4px 0 6px 18px;padding:0;list-style-type:disc;font-family:'Courier New',Courier,monospace,'Lucida Console';font-size:10.5px;line-height:1.5;color:#1e293b;white-space:pre-wrap;">${lis}</ul>`
    }
    return `<p style="margin:3px 0;font-family:'Courier New',Courier,monospace,'Lucida Console';font-size:10.5px;line-height:1.5;color:#1e293b;padding-left:4px;white-space:pre-wrap;">${renderInlineBoldHtml(block.content || '')}</p>`
  })

  return `<div class="versao-rich-block" style="padding-left:8px;margin-top:2px;white-space:pre-wrap;font-family:'Courier New',Courier,monospace,'Lucida Console';">${htmlChunks.join('')}</div>`
}
