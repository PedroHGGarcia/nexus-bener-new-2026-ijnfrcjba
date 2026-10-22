import type { ChatTableData } from '@/services/versoes-chatbot'

export interface ParsedChatSection {
  type: 'text' | 'table'
  text?: string
  table?: ChatTableData
}

/**
 * Faz o parse de uma linha com delimitador |
 */
function parsePipeLine(line: string): string[] {
  let cleaned = line.trim()
  if (cleaned.startsWith('|')) cleaned = cleaned.substring(1)
  if (cleaned.endsWith('|')) cleaned = cleaned.substring(0, cleaned.length - 1)
  return cleaned.split('|').map((c) => c.trim())
}

/**
 * Tenta extrair dados estruturados de um bloco de texto que contenha linhas separadas por pipes.
 */
export function parseTableFromText(rawText: string): ChatTableData | null {
  if (!rawText) return null

  // Remove eventuais tags delimitadoras
  const clean = rawText
    .replace(/^\[TABELA\]/im, '')
    .replace(/\[\/TABELA\]$/im, '')
    .replace(/^```(?:tabela|table)?/im, '')
    .replace(/```$/im, '')
    .trim()

  const lines = clean
    .split('\n')
    .map((l) => l.trim())
    // Descarta linhas separadoras de markdown tipo |---|---|
    .filter((l) => l.length > 0 && !/^[\s|:-]+$/.test(l))

  if (lines.length < 2) return null

  const headers = parsePipeLine(lines[0])
  if (headers.length < 2) return null

  const rows: string[][] = []
  for (let i = 1; i < lines.length; i++) {
    const row = parsePipeLine(lines[i])
    if (row.length > 0) {
      // Ajusta o tamanho da linha para corresponder aos cabeçalhos se necessário
      while (row.length < headers.length) {
        row.push('-')
      }
      rows.push(row.slice(0, headers.length))
    }
  }

  if (rows.length === 0) return null

  return { headers, rows }
}

/**
 * Divide a resposta completa da assistente em seções de texto e seções de tabela,
 * preservando a ordem do conteúdo para uma leitura natural.
 */
export function splitMessageSections(
  content: string,
  providedTable?: ChatTableData,
): ParsedChatSection[] {
  if (!content) return []

  const sections: ParsedChatSection[] = []

  // Expressão regular para encontrar blocos delimitados por [TABELA]...[/TABELA] ou ```tabela...```
  const tableRegex = /(?:\[TABELA\]|```(?:tabela|table))\s*([\s\S]*?)\s*(?:\[\/TABELA\]|```)/gi

  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = tableRegex.exec(content)) !== null) {
    const preText = content.substring(lastIndex, match.index)
    if (preText.trim()) {
      sections.push({ type: 'text', text: preText })
    }

    const tableBlock = match[1]
    const parsed = parseTableFromText(tableBlock) || providedTable

    if (parsed) {
      sections.push({ type: 'table', table: parsed })
    } else if (match[0].trim()) {
      // Se não conseguiu parsear a tabela, preserva como texto para não perder informação
      sections.push({ type: 'text', text: match[0] })
    }

    lastIndex = match.index + match[0].length
  }

  const postText = content.substring(lastIndex)
  if (postText.trim()) {
    sections.push({ type: 'text', text: postText })
  }

  // Fallback: se nenhum bloco delimitado foi encontrado, mas a Edge Function enviou uma tabela
  // estruturada separadamente no payload, verifica se o texto tem linhas no padrão "| A | B |"
  if (sections.length === 0 && providedTable) {
    sections.push({ type: 'text', text: content })
    sections.push({ type: 'table', table: providedTable })
  } else if (sections.length === 0) {
    // Caso o modelo tenha gerado linhas com pipes sem as tags delimitadoras
    const pipeLinesMatch = content.match(
      /(?:(?:^|\n)[ \t]*\|?[^\n|]+\|[^\n]+(?:\|[^\n]*)*(?:\n|$)){2,}/,
    )
    if (pipeLinesMatch && pipeLinesMatch.index !== undefined) {
      const idx = pipeLinesMatch.index
      const block = pipeLinesMatch[0]
      const preText = content.substring(0, idx)
      const postText = content.substring(idx + block.length)

      const parsed = parseTableFromText(block)
      if (parsed && parsed.rows.length >= 1) {
        if (preText.trim()) sections.push({ type: 'text', text: preText })
        sections.push({ type: 'table', table: parsed })
        if (postText.trim()) sections.push({ type: 'text', text: postText })
        return sections
      }
    }

    sections.push({ type: 'text', text: content })
  }

  return sections
}
