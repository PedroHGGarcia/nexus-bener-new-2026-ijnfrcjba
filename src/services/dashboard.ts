import { supabase } from '@/lib/supabase/client'
import { STATUS_LABELS } from '@/types/proposta'

/**
 * Find the representante record linked to the given user email by matching it
 * against the `emails` JSONB array column on `representantes`. Returns the
 * representante `id`, or `null` when no match is found (e.g. admin/gerente).
 */
export async function findRepresentanteIdByEmail(email?: string | null): Promise<string | null> {
  if (!email) return null
  // The `emails` column is a JSONB array of strings. Supabase/PostgREST supports
  // the `cs` (contains) operator for JSONB — `emails.cs.["x@y.com"]` matches
  // rows whose array contains the given email.
  const { data, error } = await supabase.from('representantes').select('id, emails')
  if (error || !data) return null
  const lower = email.toLowerCase()
  const match = (data as { id: string; emails?: string[] | null }[]).find(
    (r) =>
      Array.isArray(r.emails) &&
      r.emails.some((e) => typeof e === 'string' && e.toLowerCase() === lower),
  )
  return match?.id ?? null
}

function getStartOfMonth(): Date {
  const d = new Date()
  d.setDate(1)
  d.setHours(0, 0, 0, 0)
  return d
}

export interface ProposalsWidgetData {
  monthCount: number
  statusCounts: { status: string; label: string; count: number }[]
  /** Total number of proposals (all time) matching the filter. */
  totalCount: number
  /** Number of proposals with status "Aprovada". */
  approvedCount: number
  /** Approved count / total count * 100 (0 when no proposals). */
  conversionRate: number
  /** Sum of `valor_final` for approved proposals. */
  approvedValue: number
}

export interface ProjectWidgetItem {
  id: string
  nome: string
  status: string
  created_at: string | null
  clientes: { fantasia: string } | null
  proposalsCount: number
}

export interface ClientsWidgetData {
  activeCount: number
  monthCount: number
}

export interface VersionLowStock {
  id: string
  nome: string
  estoque_disponivel: number
  alerta_estoque_minimo: number | null
}

export interface VersionsWidgetData {
  activeCount: number
  lowStock: VersionLowStock[]
}

export interface RecentActivityItem {
  id: string
  usuario: string | null
  acao: string | null
  detalhes: string | null
  created_at: string | null
  versoes: { id: string; nome: string } | null
}

export interface MonthlyProposalData {
  month: string
  monthLabel: string
  count: number
  totalValue: number
}

const MONTH_NAMES = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
]

export async function fetchProposalsWidgetData(userId?: string): Promise<ProposalsWidgetData> {
  const startOfMonth = getStartOfMonth().toISOString()

  // Base query: optionally filtered to a single user (Vendedor).
  const monthQuery = supabase
    .from('propostas')
    .select('id', { count: 'exact' })
    .gte('created_at', startOfMonth)
  if (userId) monthQuery.eq('user', userId)

  let monthCount = 0
  try {
    const { count } = await monthQuery
    monthCount = count ?? 0
  } catch {
    monthCount = 0
  }

  // Fetch status + value for all matching proposals so we can compute the
  // status breakdown, the approved count and the approved value in one shot.
  const allQuery = supabase.from('propostas').select('status, valor_final')
  if (userId) allQuery.eq('user', userId)

  let rows: { status: string | null; valor_final: number | null }[] = []
  try {
    const { data } = await allQuery
    rows = (data ?? []) as { status: string | null; valor_final: number | null }[]
  } catch {
    rows = []
  }

  const statusCounts = Object.keys(STATUS_LABELS).map((s) => ({
    status: s,
    label: STATUS_LABELS[s],
    count: rows.filter((p) => p.status === s).length,
  }))

  const totalCount = rows.length
  const approvedCount = rows.filter((p) => p.status === 'Aprovada').length
  const approvedValue = rows
    .filter((p) => p.status === 'Aprovada')
    .reduce((sum, p) => sum + (p.valor_final ?? 0), 0)
  const conversionRate = totalCount > 0 ? (approvedCount / totalCount) * 100 : 0

  return { monthCount, statusCounts, totalCount, approvedCount, conversionRate, approvedValue }
}

export async function fetchProjectsWidgetData(userId?: string): Promise<ProjectWidgetItem[]> {
  // When a userId is provided, restrict to projects the user owns OR is a
  // member of (via projeto_membros). Otherwise return the global list.
  if (userId) {
    const { data: owned } = await supabase
      .from('projetos')
      .select('*, clientes(fantasia)')
      .eq('user', userId)
      .order('created_at', { ascending: false })
      .limit(5)

    const { data: memberships } = await supabase
      .from('projeto_membros')
      .select('projeto_id')
      .eq('user_id', userId)

    const ownedIds = new Set((owned ?? []).map((p) => (p as { id: string }).id))
    const memberOnlyIds = (memberships ?? [])
      .map((m) => m.projeto_id as string)
      .filter((id): id is string => !!id && !ownedIds.has(id))

    let memberProjects: Record<string, unknown>[] = []
    if (memberOnlyIds.length > 0) {
      const { data: memberData } = await supabase
        .from('projetos')
        .select('*, clientes(fantasia)')
        .in('id', memberOnlyIds)
        .order('created_at', { ascending: false })
        .limit(5)
      memberProjects = (memberData ?? []) as Record<string, unknown>[]
    }

    const projects = [...((owned ?? []) as Record<string, unknown>[]), ...memberProjects]
    projects.sort(
      (a, b) =>
        new Date((b.created_at as string) ?? 0).getTime() -
        new Date((a.created_at as string) ?? 0).getTime(),
    )
    const projectsSlice = projects.slice(0, 5)

    const projectIds = projectsSlice.map((p) => p.id as string)
    const { data: proposals } = await supabase
      .from('propostas')
      .select('projeto')
      .in('projeto', projectIds)

    const counts = new Map<string, number>()
    ;(proposals ?? []).forEach((p: { projeto: string | null }) => {
      if (p.projeto) counts.set(p.projeto, (counts.get(p.projeto) ?? 0) + 1)
    })

    return projectsSlice.map((p) => ({
      ...(p as object),
      proposalsCount: counts.get(p.id as string) ?? 0,
    })) as ProjectWidgetItem[]
  }

  const { data: projects } = await supabase
    .from('projetos')
    .select('*, clientes(fantasia)')
    .order('created_at', { ascending: false })
    .limit(5)

  const { data: proposals } = await supabase.from('propostas').select('projeto')

  const counts = new Map<string, number>()
  ;(proposals ?? []).forEach((p: { projeto: string | null }) => {
    if (p.projeto) counts.set(p.projeto, (counts.get(p.projeto) ?? 0) + 1)
  })

  return (projects ?? []).map((p: Record<string, unknown>) => ({
    ...(p as object),
    proposalsCount: counts.get(p.id as string) ?? 0,
  })) as ProjectWidgetItem[]
}

export async function fetchClientsWidgetData(): Promise<ClientsWidgetData> {
  const startOfMonth = getStartOfMonth().toISOString()
  let activeCount = 0
  let monthCount = 0
  try {
    const { count } = await supabase
      .from('clientes')
      .select('id', { count: 'exact' })
      .eq('status', 'Ativo')
    activeCount = count ?? 0
  } catch {
    activeCount = 0
  }
  try {
    const { count } = await supabase
      .from('clientes')
      .select('id', { count: 'exact' })
      .gte('created_at', startOfMonth)
    monthCount = count ?? 0
  } catch {
    monthCount = 0
  }

  return { activeCount, monthCount }
}

export async function fetchVersionsWidgetData(): Promise<VersionsWidgetData> {
  let activeCount = 0
  try {
    const { count } = await supabase
      .from('versoes')
      .select('id', { count: 'exact' })
      .eq('status', 'Ativo')
    activeCount = count ?? 0
  } catch {
    activeCount = 0
  }

  let stocked: VersionLowStock[] = []
  try {
    const { data } = await supabase
      .from('versoes')
      .select('id, nome, estoque_disponivel, alerta_estoque_minimo')
      .eq('tem_estoque', true)
    stocked = (data ?? []) as VersionLowStock[]
  } catch {
    stocked = []
  }

  const lowStock = (stocked ?? [])
    .filter(
      (v: VersionLowStock) =>
        v.alerta_estoque_minimo != null && v.estoque_disponivel <= v.alerta_estoque_minimo,
    )
    .slice(0, 5)

  return { activeCount: activeCount ?? 0, lowStock }
}

export async function fetchRecentActivityWidgetData(): Promise<RecentActivityItem[]> {
  const { data, error } = await supabase
    .from('versoes_historico')
    .select('*, versoes(id, nome)')
    .order('created_at', { ascending: false })
    .limit(10)

  if (error) throw new Error(error.message)
  return (data ?? []) as RecentActivityItem[]
}

export async function fetchMonthlyProposalsData(
  representanteId?: string,
): Promise<MonthlyProposalData[]> {
  const query = supabase
    .from('propostas')
    .select('created_at, valor_final')
    .order('created_at', { ascending: true })
  if (representanteId) query.eq('representante', representanteId)

  const { data, error } = await query

  if (error) throw new Error(error.message)

  const monthMap = new Map<string, { count: number; totalValue: number }>()

  for (const p of data ?? []) {
    if (!p.created_at) continue
    const d = new Date(p.created_at)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const existing = monthMap.get(key) ?? { count: 0, totalValue: 0 }
    existing.count++
    existing.totalValue += p.valor_final ?? 0
    monthMap.set(key, existing)
  }

  return Array.from(monthMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, val]) => {
      const [year, month] = key.split('-')
      return {
        month: key,
        monthLabel: `${MONTH_NAMES[parseInt(month, 10) - 1]}/${year}`,
        count: val.count,
        totalValue: val.totalValue,
      }
    })
}
