import { supabase } from '@/lib/supabase/client'
import type { Json } from '@/lib/supabase/types'

export interface AuditLogEntry {
  id: string
  user_id: string | null
  user_name: string | null
  action: string
  table_name: string
  record_id: string | null
  data_changes: Json | null
  created_at: string
}

export interface AuditLogFilters {
  tableName?: string
  userName?: string
  userId?: string
  startDate?: string
  endDate?: string
  recordId?: string
  page?: number
  pageSize?: number
}

export interface FetchAuditLogsResult {
  data: AuditLogEntry[] | null
  error: string | null
  page: number
  pageSize: number
  hasMore: boolean
}

export const AUDITED_TABLES = [
  'profiles',
  'clientes',
  'representantes',
  'regioes',
  'gerentes',
  'produtos',
  'propostas',
  'projetos',
  'versoes',
  'marcas',
  'modelos',
  'categorias_produtos',
  'tipos_proposta',
  'eventos',
  'notificacoes',
]

export async function fetchAuditLogs(filters?: AuditLogFilters): Promise<FetchAuditLogsResult> {
  const page = Math.max(1, filters?.page ?? 1)
  const pageSize = Math.max(1, Math.min(filters?.pageSize ?? 50, 100))
  const from = (page - 1) * pageSize
  // Pedimos pageSize + 1 para saber se existe próxima página de forma instantânea sem count(*) caro
  const to = from + pageSize

  let query = supabase
    .from('audit_logs')
    .select('id, user_id, user_name, action, table_name, record_id, data_changes, created_at')
    .order('created_at', { ascending: false })
    .range(from, to)

  if (filters?.tableName) query = query.eq('table_name', filters.tableName)
  if (filters?.userName) query = query.ilike('user_name', `%${filters.userName.trim()}%`)
  if (filters?.userId) query = query.eq('user_id', filters.userId)
  if (filters?.startDate) query = query.gte('created_at', `${filters.startDate}T00:00:00Z`)
  if (filters?.endDate) query = query.lte('created_at', `${filters.endDate}T23:59:59Z`)
  if (filters?.recordId) query = query.eq('record_id', filters.recordId)

  const { data, error } = await query
  if (error) {
    return { data: null, error: error.message, page, pageSize, hasMore: false }
  }

  const rows = (data as AuditLogEntry[]) || []
  const hasMore = rows.length > pageSize
  const pagedData = hasMore ? rows.slice(0, pageSize) : rows

  return {
    data: pagedData,
    error: null,
    page,
    pageSize,
    hasMore,
  }
}

export async function insertAuditLog(entry: {
  action: string
  table_name: string
  record_id?: string
  data_changes?: Record<string, unknown>
  user_id?: string | null
  user_name?: string | null
}): Promise<void> {
  await supabase.from('audit_logs').insert({
    action: entry.action,
    table_name: entry.table_name,
    record_id: entry.record_id ?? null,
    data_changes: (entry.data_changes ?? null) as Json,
    user_id: entry.user_id ?? null,
    user_name: entry.user_name ?? null,
  })
}
