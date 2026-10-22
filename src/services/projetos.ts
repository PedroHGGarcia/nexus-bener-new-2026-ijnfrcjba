import { supabase } from '@/lib/supabase/client'
import { Projeto, ProjetoInsert, ProjetoWithRelations, ProjectCreator } from '@/types/projeto'
import { PropostaWithRelations } from '@/types/proposta'

const TABLE = 'projetos'
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const PROPOSTA_SELECT =
  '*, clientes(fantasia), versoes(nome, status, deleted_at), representantes:representante(id, fantasia), gerentes:gerente(id, nome), projetos:projeto(id, nome)'

async function fetchCreators(userIds: string[]): Promise<Map<string, ProjectCreator>> {
  if (userIds.length === 0) return new Map()
  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, email, avatar_url, role, setor, gerentes:gerente_id(cargo)')
    .in('id', userIds)
  if (error || !data) return new Map()
  return new Map(
    data.map((p) => {
      const g = p.gerentes as { cargo?: string | null } | { cargo?: string | null }[] | null
      const gerenteCargo = Array.isArray(g) ? g[0]?.cargo : g?.cargo
      const cargo =
        gerenteCargo || (p.role === 'Admin Completo' ? 'Admin' : p.role) || p.setor || null

      return [
        p.id,
        {
          id: p.id,
          name: p.name,
          email: p.email,
          avatar_url: p.avatar_url,
          role: p.role,
          cargo,
        },
      ]
    }),
  )
}

function extractCreator(
  user: string | null,
  creatorMap: Map<string, ProjectCreator>,
): ProjectCreator | null {
  if (!user || !UUID_REGEX.test(user)) return null
  return creatorMap.get(user) ?? null
}

async function fetchLicitacaoProjectIds(projectIds: string[]): Promise<Set<string>> {
  if (projectIds.length === 0) return new Set()
  const { data, error } = await supabase
    .from('propostas')
    .select('projeto')
    .eq('modelo_licitacao', true)
    .in('projeto', projectIds)
    .not('projeto', 'is', null)
  if (error || !data) return new Set()
  return new Set(data.map((r) => r.projeto as string | null).filter((p): p is string => !!p))
}

export async function fetchProjetos(options?: {
  userId?: string
  isVendedorOuRep?: boolean
}): Promise<ProjetoWithRelations[]> {
  // Se for vendedor ou representante, filtramos na consulta projetos próprios ou onde é membro
  if (options?.isVendedorOuRep && options?.userId) {
    return fetchProjetosForUser(options.userId)
  }

  const { data, error } = await supabase
    .from(TABLE)
    .select('*, clientes(fantasia)')
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)

  const projects = (data ?? []) as ProjetoWithRelations[]
  return enrichProjetos(projects)
}

/**
 * Fetch only the projects the given user can see in a "vincular projeto
 * existente" dropdown: projects where they are the owner (`user` column) OR
 * where they are listed as a member in `projeto_membros`.
 */
export async function fetchProjetosForUser(userId: string): Promise<ProjetoWithRelations[]> {
  if (!userId) return []

  // 1. Projects owned by the user.
  const { data: owned, error: ownedErr } = await supabase
    .from(TABLE)
    .select('*, clientes(fantasia)')
    .eq('user', userId)
    .order('created_at', { ascending: false })
  if (ownedErr) throw new Error(ownedErr.message)

  // 2. Project ids where the user is a member.
  const { data: memberships, error: memberErr } = await supabase
    .from('projeto_membros')
    .select('projeto_id')
    .eq('user_id', userId)
  if (memberErr) throw new Error(memberErr.message)

  const memberProjectIds = (memberships ?? [])
    .map((m) => m.projeto_id as string)
    .filter((id): id is string => !!id)

  // 3. Projects the user is a member of but does NOT own (avoid duplicates).
  const ownedIds = new Set((owned ?? []).map((p) => p.id))
  const memberOnlyIds = memberProjectIds.filter((id) => !ownedIds.has(id))

  let memberProjects: ProjetoWithRelations[] = []
  if (memberOnlyIds.length > 0) {
    const { data: memberData, error: memberDataErr } = await supabase
      .from(TABLE)
      .select('*, clientes(fantasia)')
      .in('id', memberOnlyIds)
      .order('created_at', { ascending: false })
    if (memberDataErr) throw new Error(memberDataErr.message)
    memberProjects = (memberData ?? []) as ProjetoWithRelations[]
  }

  const projects = [...((owned ?? []) as ProjetoWithRelations[]), ...memberProjects]
  // Keep a stable order: newest first across the merged set.
  projects.sort(
    (a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime(),
  )
  return enrichProjetos(projects)
}

/** Shared enrichment: attach creator profile and `has_licitacao` flag. */
async function enrichProjetos(projects: ProjetoWithRelations[]): Promise<ProjetoWithRelations[]> {
  const userIds = [
    ...new Set(projects.map((p) => p.user).filter((u): u is string => !!u && UUID_REGEX.test(u))),
  ]
  const creatorMap = await fetchCreators(userIds)
  const licitacaoIds = await fetchLicitacaoProjectIds(projects.map((p) => p.id))

  return projects.map((p) => ({
    ...p,
    creator: extractCreator(p.user, creatorMap),
    has_licitacao: licitacaoIds.has(p.id),
  }))
}

export async function fetchProjetoById(id: string): Promise<ProjetoWithRelations | null> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*, clientes(fantasia)')
    .eq('id', id)
    .single()
  if (error) return null

  const project = data as ProjetoWithRelations
  if (project.user && UUID_REGEX.test(project.user)) {
    const creatorMap = await fetchCreators([project.user])
    project.creator = creatorMap.get(project.user) ?? null
  } else {
    project.creator = null
  }
  return project
}

export async function insertProjeto(payload: ProjetoInsert): Promise<Projeto> {
  const { data, error } = await supabase.from(TABLE).insert(payload).select().single()
  if (error) throw new Error(error.message)

  if (data.user) {
    supabase
      .from('projeto_membros')
      .insert({ projeto_id: data.id, user_id: data.user, papel: 'Criador' })
      .then(({ error: e }) => {
        if (e && e.code !== '23505') console.warn(e.message)
      })
  }

  return data as Projeto
}

export async function updateProjeto(id: string, payload: Partial<ProjetoInsert>): Promise<Projeto> {
  const { data, error } = await supabase.from(TABLE).update(payload).eq('id', id).select().single()
  if (error) throw new Error(error.message)
  return data as Projeto
}

export async function deleteProjeto(id: string): Promise<void> {
  const { error } = await supabase.from(TABLE).delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export async function fetchPropostasByProjeto(projetoId: string): Promise<PropostaWithRelations[]> {
  const { data, error } = await supabase
    .from('propostas')
    .select(PROPOSTA_SELECT)
    .eq('projeto', projetoId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as PropostaWithRelations[]
}

export async function fetchEligiblePropostas(): Promise<PropostaWithRelations[]> {
  const { data, error } = await supabase
    .from('propostas')
    .select(PROPOSTA_SELECT)
    .is('projeto', null)
    .neq('status', 'Excluida')
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as PropostaWithRelations[]
}

export async function linkPropostasToProject(
  projetoId: string,
  propostaIds: string[],
): Promise<void> {
  const { error } = await supabase
    .from('propostas')
    .update({ projeto: projetoId })
    .in('id', propostaIds)
  if (error) throw new Error(error.message)
}
