/**
 * Estrutura e utilitários para tabelas técnicas de versões de produto.
 * Suporta persistência bidirecional compatível com texto legado e JSON estruturado.
 */

export interface TechnicalTableColumn {
  id: string
  label: string
}

export interface TechnicalTableRow {
  id: string
  values: Record<string, string>
  imagem?: string | null
}

export interface TechnicalTableData {
  columns: TechnicalTableColumn[]
  rows: TechnicalTableRow[]
}

export const DEFAULT_TECHNICAL_COLUMNS: TechnicalTableColumn[] = [
  { id: 'item', label: 'Item' },
  { id: 'descricao', label: 'Descrição' },
  { id: 'observacoes', label: 'Quantidade / Observações' },
]

/**
 * Gera um ID único simples para colunas e linhas
 */
export function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

/**
 * Cria uma tabela técnica vazia com as colunas padrão
 */
export function createEmptyTechnicalTable(
  columns: TechnicalTableColumn[] = DEFAULT_TECHNICAL_COLUMNS,
): TechnicalTableData {
  return {
    columns: columns.map((col) => ({ ...col })),
    rows: [],
  }
}

/**
 * Converte qualquer entrada (string legada com bullets ou texto puro, ou string JSON, ou null/undefined)
 * em uma estrutura TechnicalTableData pronta para edição e visualização.
 */
export function parseTechnicalData(raw: string | null | undefined): TechnicalTableData {
  if (!raw || typeof raw !== 'string') {
    return createEmptyTechnicalTable()
  }

  const trimmed = raw.trim()
  if (!trimmed) {
    return createEmptyTechnicalTable()
  }

  // 1. Tenta fazer parse de JSON estruturado
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed)
      if (parsed && Array.isArray(parsed.columns) && Array.isArray(parsed.rows)) {
        const columns: TechnicalTableColumn[] = parsed.columns.map(
          (col: any, idx: number): TechnicalTableColumn => ({
            id: typeof col?.id === 'string' && col.id ? col.id : `col_${idx}`,
            label: typeof col?.label === 'string' ? col.label : `Coluna ${idx + 1}`,
          }),
        )

        const rows: TechnicalTableRow[] = parsed.rows.map(
          (row: any, idx: number): TechnicalTableRow => {
            const values: Record<string, string> = {}
            if (row && typeof row === 'object' && row.values && typeof row.values === 'object') {
              for (const col of columns) {
                values[col.id] = row.values[col.id] != null ? String(row.values[col.id]) : ''
              }
            } else if (row && typeof row === 'object') {
              for (const col of columns) {
                values[col.id] = row[col.id] != null ? String(row[col.id]) : ''
              }
            }
            const imagem =
              typeof row?.imagem === 'string' && row.imagem.trim()
                ? row.imagem.trim()
                : typeof row?.image_url === 'string' && row.image_url.trim()
                  ? row.image_url.trim()
                  : null

            return {
              id: typeof row?.id === 'string' && row.id ? row.id : `row_${idx}_${generateId()}`,
              values,
              ...(imagem ? { imagem } : {}),
            }
          },
        )

        return {
          columns: columns.length > 0 ? columns : DEFAULT_TECHNICAL_COLUMNS,
          rows,
        }
      }
    } catch {
      // Não era JSON válido, segue para parse de texto puro
    }
  }

  // 2. Se for texto puro ou texto com bullets: migra automaticamente para linhas da tabela
  // Suporta bullets ('•'), quebras de linha ('\n') ou ponto-e-vírgula
  const cols = DEFAULT_TECHNICAL_COLUMNS.map((c) => ({ ...c }))
  const firstColId = cols[0].id
  const descColId = cols[1]?.id || cols[0].id

  let rawLines: string[] = []
  if (trimmed.includes('•')) {
    rawLines = trimmed
      .split('•')
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
  } else {
    rawLines = trimmed
      .split('\n')
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
  }

  const rows: TechnicalTableRow[] = rawLines.map((line, idx) => {
    // Tenta separar se a linha tiver padrão como "Item: Descrição" ou separador por tab/pipe/hífen
    let itemVal = `${idx + 1}`
    let descVal = line
    let obsVal = ''

    if (line.includes('\t')) {
      const parts = line.split('\t').map((p) => p.trim())
      if (parts.length >= 3) {
        itemVal = parts[0]
        descVal = parts[1]
        obsVal = parts.slice(2).join(' ')
      } else if (parts.length === 2) {
        itemVal = parts[0]
        descVal = parts[1]
      }
    } else if (line.includes('|')) {
      const parts = line
        .split('|')
        .map((p) => p.trim())
        .filter((p) => p.length > 0)
      if (parts.length >= 3) {
        itemVal = parts[0]
        descVal = parts[1]
        obsVal = parts.slice(2).join(' ')
      } else if (parts.length === 2) {
        itemVal = parts[0]
        descVal = parts[1]
      }
    } else {
      // Linha de texto comum: item = número sequencial, descrição = texto da linha
      itemVal = `${idx + 1}`
      descVal = line
    }

    const values: Record<string, string> = {
      [firstColId]: itemVal,
      [descColId]: descVal,
    }
    if (cols[2]) {
      values[cols[2].id] = obsVal
    }

    return {
      id: generateId(),
      values,
    }
  })

  return {
    columns: cols,
    rows,
  }
}

/**
 * Serializa a tabela técnica para JSON string para persistência no banco.
 * Se a tabela estiver vazia, retorna string vazia.
 */
export function serializeTechnicalData(data: TechnicalTableData | null | undefined): string {
  if (!data || !data.rows || data.rows.length === 0) {
    return ''
  }

  // Verifica se há pelo menos um conteúdo não vazio nas linhas (texto ou imagem)
  const hasContent = data.rows.some(
    (row) =>
      Boolean(row.imagem && row.imagem.trim().length > 0) ||
      Object.values(row.values || {}).some((v) => v && v.trim().length > 0),
  )

  if (!hasContent) {
    return ''
  }

  return JSON.stringify({
    columns: data.columns,
    rows: data.rows.map((r) => ({
      id: r.id,
      values: r.values,
      ...(r.imagem && r.imagem.trim() ? { imagem: r.imagem.trim() } : {}),
    })),
  })
}

/**
 * Formata os dados técnicos em texto com marcadores (bullet points),
 * garantindo compatibilidade quando consumido por funções puramente de texto
 * ou ao converter para exportações em texto puro.
 */
export function technicalDataToBulletText(
  data: TechnicalTableData | string | null | undefined,
): string {
  if (!data) return ''

  const table = typeof data === 'string' ? parseTechnicalData(data) : data
  if (!table || table.rows.length === 0) return ''

  const lines: string[] = []
  for (const row of table.rows) {
    const parts: string[] = []
    for (const col of table.columns) {
      const val = row.values[col.id]?.trim()
      if (val) {
        parts.push(val)
      }
    }
    if (parts.length > 0) {
      lines.push(`• ${parts.join(' - ')}`)
    }
  }

  return lines.join('\n')
}

/**
 * Detecta se uma string contém JSON estruturado de tabela técnica
 */
export function isTechnicalTableJson(raw: string | null | undefined): boolean {
  if (!raw || typeof raw !== 'string') return false
  const trimmed = raw.trim()
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) return false
  try {
    const p = JSON.parse(trimmed)
    return Boolean(p && Array.isArray(p.columns) && Array.isArray(p.rows))
  } catch {
    return false
  }
}
