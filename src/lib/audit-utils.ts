import type { AuditLogEntry } from '@/services/audit-logs'

export type AuditExportMode = 'summary' | 'technical'

export function formatAuditAction(action: string): string {
  if (!action) return ''
  const normalized = action.toLowerCase()
  const map: Record<string, string> = {
    create: 'Criado',
    insert: 'Criado',
    update: 'Editado',
    delete: 'Removido',
    status_change: 'Status Alterado',
  }
  return map[normalized] ?? action
}

export function formatAuditTable(tableName: string): string {
  const map: Record<string, string> = {
    clientes: 'Clientes',
    propostas: 'Propostas',
    produtos: 'Produtos',
    versoes: 'Versões',
    acessorios: 'Acessórios',
    projetos: 'Projetos',
    profiles: 'Usuários',
    representantes: 'Representantes',
    gerentes: 'Gerentes',
    regioes: 'Regiões',
    marcas: 'Marcas',
    modelos: 'Modelos',
    categorias_produtos: 'Categorias de Produtos',
    tipos_proposta: 'Tipos de Proposta',
    area_atuacao: 'Área de Atuação',
    notificacoes: 'Notificações',
    eventos: 'Eventos',
  }
  return map[tableName] ?? tableName
}

export function getActionColor(action: string): string {
  if (!action) return 'text-slate-600'
  const normalized = action.toLowerCase()
  const map: Record<string, string> = {
    create: 'text-green-600',
    insert: 'text-green-600',
    update: 'text-blue-600',
    status_change: 'text-amber-600',
    delete: 'text-red-600',
  }
  return map[normalized] ?? 'text-slate-600'
}

export function getActionBadgeVariant(action: string): {
  variant?: 'default' | 'secondary' | 'outline' | 'destructive'
  className: string
} {
  if (!action) return { className: 'bg-slate-100 text-slate-800 hover:bg-slate-100 border-none' }
  const normalized = action.toLowerCase()

  if (normalized === 'create' || normalized === 'insert') {
    return {
      className: 'bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-none font-medium',
    }
  }
  if (normalized === 'update' || normalized === 'status_change') {
    return { className: 'bg-blue-100 text-blue-800 hover:bg-blue-100 border-none font-medium' }
  }
  if (normalized === 'delete') {
    return { className: 'bg-rose-100 text-rose-800 hover:bg-rose-100 border-none font-medium' }
  }
  return { className: 'bg-slate-100 text-slate-800 hover:bg-slate-100 border-none' }
}

export function formatAuditChanges(changes: unknown): string {
  if (!changes || typeof changes !== 'object') return '—'
  try {
    return JSON.stringify(changes, null, 2)
  } catch {
    return '—'
  }
}

export function getSingularTableLabel(tableName: string): string {
  const map: Record<string, string> = {
    clientes: 'o cliente',
    propostas: 'a proposta',
    produtos: 'o produto',
    versoes: 'a versão',
    acessorios: 'o acessório',
    projetos: 'o projeto',
    profiles: 'o usuário',
    representantes: 'o representante',
    gerentes: 'o gerente',
    regioes: 'a região',
    marcas: 'a marca',
    modelos: 'o modelo',
    categorias_produtos: 'a categoria',
    tipos_proposta: 'o tipo de proposta',
    area_atuacao: 'a área de atuação',
    notificacoes: 'a notificação',
    eventos: 'o evento',
  }
  return map[tableName] ?? tableName
}

/**
 * Summarize an audit log entry into a human-friendly sentence.
 * Examples:
 * - Insert on marcas with { nome: "FCS" } => "Criou a marca 'FCS'"
 * - Update on clientes with changed fields => "Editou o cliente (nome, e-mail)"
 * - Delete on produtos => "Removeu o produto"
 */
export function summarizeAuditChanges(log: AuditLogEntry): string {
  if (!log) return ''

  const action = (log.action || '').toLowerCase()
  const singularTable = getSingularTableLabel(log.table_name || '')
  const changes = log.data_changes as Record<string, unknown> | null | undefined

  // Helper to find key display fields in record
  const getItemName = (obj: Record<string, unknown> | null | undefined): string | null => {
    if (!obj || typeof obj !== 'object') return null

    // Check nested or direct fields
    const target = (obj.new || obj.after || obj.record || obj) as Record<string, unknown>
    const nameCandidates = [
      'nome',
      'name',
      'titulo',
      'title',
      'razao_social',
      'numero_proposta',
      'codigo',
      'code',
      'email',
      'identificacao',
      'descricao',
    ]
    for (const key of nameCandidates) {
      if (target[key] && typeof target[key] === 'string' && (target[key] as string).trim()) {
        return (target[key] as string).trim()
      }
    }
    return null
  }

  // Handle INSERT / CREATE
  if (action === 'insert' || action === 'create') {
    const verb = singularTable.startsWith('a ') ? 'Criou' : 'Criou'
    const name = getItemName(changes)
    if (name) {
      return `${verb} ${singularTable} "${name}"`
    }
    return `${verb} ${singularTable}`
  }

  // Handle UPDATE
  if (action === 'update' || action === 'status_change') {
    const verb = 'Editou'
    const name = getItemName(changes)

    // Check changed fields if changes object provides old/new or key-value list
    let changedKeys: string[] = []
    if (changes && typeof changes === 'object') {
      if ('old' in changes && 'new' in changes && typeof changes.new === 'object' && changes.new) {
        // Compare keys between old and new
        const oldObj = (changes.old as Record<string, unknown>) || {}
        const newObj = (changes.new as Record<string, unknown>) || {}
        changedKeys = Object.keys(newObj).filter(
          (k) => k !== 'updated_at' && oldObj[k] !== newObj[k],
        )
      } else {
        // Just filter out standard metadata keys
        changedKeys = Object.keys(changes).filter(
          (k) => !['id', 'created_at', 'updated_at', 'user_id', 'record_id'].includes(k),
        )
      }
    }

    // Friendly field names
    const fieldMap: Record<string, string> = {
      nome: 'nome',
      name: 'nome',
      email: 'e-mail',
      status: 'status',
      telefone: 'telefone',
      valor: 'valor',
      razao_social: 'razão social',
      cnpj: 'CNPJ',
      cpf: 'CPF',
      descricao: 'descrição',
      categoria: 'categoria',
    }

    const readableFields = changedKeys
      .map((k) => fieldMap[k] || k)
      .filter((v, i, self) => self.indexOf(v) === i)

    if (name && readableFields.length > 0) {
      return `${verb} ${singularTable} "${name}" (${readableFields.slice(0, 3).join(', ')})`
    } else if (name) {
      return `${verb} ${singularTable} "${name}"`
    } else if (readableFields.length > 0) {
      return `${verb} ${singularTable} (${readableFields.slice(0, 3).join(', ')})`
    }
    return `${verb} ${singularTable}`
  }

  // Handle DELETE
  if (action === 'delete') {
    const name = getItemName(changes)
    if (name) {
      return `Removeu ${singularTable} "${name}"`
    }
    return `Removeu ${singularTable}`
  }

  // Fallback
  const actionLabel = formatAuditAction(log.action)
  return `${actionLabel} em ${singularTable}`
}

export function formatAuditEntry(entry: AuditLogEntry) {
  return {
    actionLabel: formatAuditAction(entry.action),
    tableLabel: formatAuditTable(entry.table_name),
    actionColor: getActionColor(entry.action),
    summary: summarizeAuditChanges(entry),
    changesText: formatAuditChanges(entry.data_changes),
    userLabel: entry.user_name ?? 'Sistema',
    dateLabel: new Date(entry.created_at).toLocaleString('pt-BR'),
  }
}

/**
 * Escapa um valor para CSV (RFC 4180): envolve em aspas duplas e duplica as
 * aspas internas. Retorna string vazia para null/undefined.
 */
function escapeCsvValue(value: unknown): string {
  if (value === null || value === undefined) return ''
  const str = typeof value === 'string' ? value : String(value)
  // Sempre envolve em aspas e duplica as aspas internas
  return `"${str.replace(/"/g, '""')}"`
}

/**
 * Gera e baixa um arquivo CSV com os logs de auditoria informados.
 *
 * @param logs   Logs completos (não apenas os visíveis na tela)
 * @param userName Nome do usuário (usado no nome do arquivo)
 * @param mode   'summary' (Ação resumida, Tabela, Data/Hora) ou
 *               'technical' (Ação, Tabela, Data/Hora, Alterações)
 */
export function exportAuditLogsToCSV(
  logs: AuditLogEntry[],
  userName: string,
  mode: AuditExportMode,
): void {
  const headers =
    mode === 'summary'
      ? ['Ação', 'Tabela', 'Data/Hora']
      : ['Ação', 'Tabela', 'Data/Hora', 'Alterações']

  const rows = logs.map((log) => {
    const dateLabel = log.created_at ? new Date(log.created_at).toLocaleString('pt-BR') : ''
    if (mode === 'summary') {
      return [summarizeAuditChanges(log), formatAuditTable(log.table_name), dateLabel]
        .map(escapeCsvValue)
        .join(',')
    }
    return [
      formatAuditAction(log.action),
      formatAuditTable(log.table_name),
      dateLabel,
      formatAuditChanges(log.data_changes),
    ]
      .map(escapeCsvValue)
      .join(',')
  })

  // BOM para garantir abertura correta no Excel (UTF-8)
  const csvContent = '\uFEFF' + [headers.map(escapeCsvValue).join(','), ...rows].join('\r\n')

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)

  const safeName = (userName || 'usuario').replace(/[^\w-]+/g, '_')
  const date = new Date().toISOString().slice(0, 10)
  const filename = `atividade_${safeName}_${date}.csv`

  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)

  // Libera a URL após o download
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
