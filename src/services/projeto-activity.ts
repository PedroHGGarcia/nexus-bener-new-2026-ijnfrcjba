import { supabase } from '@/lib/supabase/client'
import { formatAuditAction, formatAuditTable } from '@/lib/audit-utils'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export interface ActivityItem {
  id: string
  title: string
  description: string
  user_name: string | null
  user_avatar: string | null
  created_at: string
  type: string
}

async function fetchProfilesMap(userIds: string[]) {
  if (userIds.length === 0) return new Map()
  const { data } = await supabase
    .from('profiles')
    .select('id, name, email, avatar_url')
    .in('id', userIds)
  if (!data) return new Map()
  return new Map(data.map((p) => [p.id, p]))
}

export async function fetchProjectActivity(projetoId: string): Promise<ActivityItem[]> {
  const activities: ActivityItem[] = []
  const userIds = new Set<string>()

  const { data: projeto } = await supabase
    .from('projetos')
    .select('id, nome, created_at, updated_at, "user"')
    .eq('id', projetoId)
    .single()

  if (!projeto) return activities
  if (projeto.user && UUID_REGEX.test(projeto.user)) userIds.add(projeto.user)

  const { data: propostas } = await supabase
    .from('propostas')
    .select('id, numero_proposta, revisao, created_at, versao_original, status, "user"')
    .eq('projeto', projetoId)
    .order('created_at', { ascending: false })

  const propostaIds = (propostas ?? []).map((p) => p.id)
  for (const p of propostas ?? []) {
    if (p.user && UUID_REGEX.test(p.user)) userIds.add(p.user)
  }

  const { data: projAudit } = await supabase
    .from('audit_logs')
    .select('*')
    .eq('table_name', 'projetos')
    .eq('record_id', projetoId)
    .order('created_at', { ascending: false })

  let propostaAudit: any[] = []
  if (propostaIds.length > 0) {
    const { data } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('table_name', 'propostas')
      .in('record_id', propostaIds)
      .order('created_at', { ascending: false })
    propostaAudit = data ?? []
  }

  for (const log of [...(projAudit ?? []), ...propostaAudit]) {
    if (log.user_id && UUID_REGEX.test(log.user_id)) userIds.add(log.user_id)
  }

  const profileMap = await fetchProfilesMap(Array.from(userIds))

  const projCreator =
    projeto.user && UUID_REGEX.test(projeto.user) ? profileMap.get(projeto.user) : null
  activities.push({
    id: `proj-created-${projeto.id}`,
    title: 'Projeto criado',
    description: `O projeto "${projeto.nome}" foi criado`,
    user_name: projCreator?.name ?? projeto.user ?? 'Sistema',
    user_avatar: projCreator?.avatar_url ?? null,
    created_at: projeto.created_at ?? new Date().toISOString(),
    type: 'project_created',
  })

  for (const log of projAudit ?? []) {
    const c = log.user_id && UUID_REGEX.test(log.user_id) ? profileMap.get(log.user_id) : null
    activities.push({
      id: `audit-${log.id}`,
      title: formatAuditAction(log.action),
      description: `${formatAuditTable(log.table_name)}: ${log.action}`,
      user_name: c?.name ?? log.user_name ?? 'Sistema',
      user_avatar: c?.avatar_url ?? null,
      created_at: log.created_at,
      type: 'audit',
    })
  }

  for (const p of propostas ?? []) {
    const c = p.user && UUID_REGEX.test(p.user) ? profileMap.get(p.user) : null
    const isVersion = !!p.versao_original
    activities.push({
      id: `prop-${p.id}`,
      title: isVersion ? 'Nova versão de proposta' : 'Proposta criada',
      description: isVersion
        ? `Versão ${p.revisao} da proposta ${p.numero_proposta}`
        : `Proposta ${p.numero_proposta} (Rev. ${p.revisao})`,
      user_name: c?.name ?? p.user ?? 'Sistema',
      user_avatar: c?.avatar_url ?? null,
      created_at: p.created_at ?? new Date().toISOString(),
      type: isVersion ? 'proposal_version' : 'proposal_created',
    })
  }

  for (const log of propostaAudit) {
    const c = log.user_id && UUID_REGEX.test(log.user_id) ? profileMap.get(log.user_id) : null
    activities.push({
      id: `prop-audit-${log.id}`,
      title: formatAuditAction(log.action),
      description: `Proposta: ${log.action}`,
      user_name: c?.name ?? log.user_name ?? 'Sistema',
      user_avatar: c?.avatar_url ?? null,
      created_at: log.created_at,
      type: 'proposal_audit',
    })
  }

  activities.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  return activities
}
