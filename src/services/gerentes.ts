import { supabase } from '@/lib/supabase/client'
import { Gerente, GerenteInsert, GerenteUpdate } from '@/types/gerente'
import { Representante } from '@/types/representante'

const TABLE = 'gerentes'

export interface VendedorResumo {
  id: string
  fantasia: string
  sigla: string | null
  regiao: string | null
  estado?: string | null
  totalPropostas: number
  aprovadas: number
  valorTotal: number
  ultimaProposta: string | null
  taxaConversao: number
  /** UUID do usuário (profiles.id / propostas.user) — usado p/ filtrar audit_logs por ator. */
  userId: string | null
  /** Tipo de entidade: representante comercial ou usuário vendedor */
  tipo?: 'representante' | 'usuario'
  /** ID do gerente vinculado */
  gerenteId?: string | null
  /** Nome do gerente vinculado */
  gerenteNome?: string | null
}

export interface MeusVendedoresResult {
  gerente: Gerente | null
  vendedores: VendedorResumo[]
}

export interface GrupoGerenteVendedores {
  gerente: Gerente | null
  gerenteId: string | null
  gerenteNome: string
  vendedores: VendedorResumo[]
  totals: {
    totalPropostas: number
    aprovadas: number
    valorTotal: number
    taxa: number
  }
}

export interface TodosGerentesResult {
  grupos: GrupoGerenteVendedores[]
  todosVendedores: VendedorResumo[]
  gerentesAtivos: Gerente[]
}

const STATUS_APROVADO = ['Aprovada', 'Aprovado']

export async function fetchMeusVendedores(
  email: string,
  isAdmin: boolean,
  specificGerenteId?: string,
): Promise<MeusVendedoresResult> {
  if (!email && !specificGerenteId) return { gerente: null, vendedores: [] }

  // Resolve o gerente:
  // 1. Se foi passado um specificGerenteId (Admin escolheu um gerente específico no dropdown)
  // 2. Se for Admin sem gerente especificado, pega o primeiro gerente ativo
  // 3. Caso contrário (gerente logado), busca pelo email
  let gerente: Gerente | null = null
  if (specificGerenteId) {
    const { data: g } = await supabase
      .from(TABLE)
      .select('*')
      .eq('id', specificGerenteId)
      .maybeSingle()
    gerente = (g as Gerente) ?? null
  } else if (isAdmin) {
    const { data: adminGerentes } = await supabase
      .from(TABLE)
      .select('*')
      .eq('status', 'Ativo')
      .order('created_at', { ascending: false })
      .limit(1)
    gerente = (adminGerentes?.[0] as Gerente) ?? null
  } else {
    const { data: g } = await supabase
      .from(TABLE)
      .select('*')
      .eq('email', email)
      .eq('status', 'Ativo')
      .maybeSingle()
    gerente = (g as Gerente) ?? null
  }

  if (!gerente) return { gerente: null, vendedores: [] }

  // Busca todas as propostas desse gerente com o representante vinculado.
  const { data: propostas, error } = await supabase
    .from('propostas')
    .select('id, representante, user, status, valor_final, created_at')
    .eq('gerente', gerente.id)
    .not('representante', 'is', null)

  if (error) throw new Error(error.message)
  const propostasRows = (propostas ?? []) as Array<{
    id: string
    representante: string | null
    user: string | null
    status: string
    valor_final: number | null
    created_at: string | null
  }>

  // Agrupa propostas por representante.
  const byRep = new Map<
    string,
    {
      total: number
      aprovadas: number
      valor: number
      ultima: string | null
      user: string | null
    }
  >()
  for (const p of propostasRows) {
    const repId = p.representante
    if (!repId) continue
    const entry = byRep.get(repId) ?? { total: 0, aprovadas: 0, valor: 0, ultima: null, user: null }
    entry.total += 1
    if (STATUS_APROVADO.includes(p.status)) entry.aprovadas += 1
    entry.valor += Number(p.valor_final ?? 0)
    if (p.created_at && (!entry.ultima || p.created_at > entry.ultima)) {
      entry.ultima = p.created_at
    }
    // Guarda o primeiro user (UUID do profile) encontrado para este representante,
    // usado para filtrar logs de auditoria por ator.
    if (!entry.user && p.user) entry.user = p.user
    byRep.set(repId, entry)
  }

  const repIds = Array.from(byRep.keys())

  const { data: reps, error: repErr } = await supabase
    .from('representantes')
    .select('id, fantasia, sigla, regiao, estado, status')
    .in('id', repIds.length ? repIds : ['00000000-0000-0000-0000-000000000000'])
  if (repErr) throw new Error(repErr.message)
  const repsRows = (reps ?? []) as Representante[]

  const vendedores: VendedorResumo[] = repsRows.map((r) => {
    const agg = byRep.get(r.id) ?? {
      total: 0,
      aprovadas: 0,
      valor: 0,
      ultima: null,
      user: null,
    }
    const taxaConversao = agg.total > 0 ? (agg.aprovadas / agg.total) * 100 : 0
    return {
      id: r.id,
      fantasia: r.fantasia,
      sigla: r.sigla,
      regiao: r.regiao,
      estado: r.estado,
      totalPropostas: agg.total,
      aprovadas: agg.aprovadas,
      valorTotal: agg.valor,
      ultimaProposta: agg.ultima,
      taxaConversao,
      userId: agg.user ?? null,
      tipo: 'representante',
      gerenteId: gerente.id,
      gerenteNome: gerente.nome,
    }
  })

  // ---- Rota adicional 1: representantes vinculados diretamente via representantes.gerente_id ----
  // Garante que todo representante comercial explicitamente vinculado ao gerente
  // apareça na lista de vendedores/representantes, mesmo sem propostas emitidas.
  const { data: directReps, error: dirErr } = await (supabase.from('representantes') as any)
    .select('id, fantasia, sigla, regiao, estado, status')
    .eq('gerente_id', gerente.id)
  if (!dirErr && directReps && directReps.length > 0) {
    const existingIds = new Set(vendedores.map((v) => v.id))
    for (const dr of directReps as Representante[]) {
      if (!existingIds.has(dr.id)) {
        vendedores.push({
          id: dr.id,
          fantasia: dr.fantasia,
          sigla: dr.sigla,
          regiao: dr.regiao,
          estado: dr.estado,
          totalPropostas: 0,
          aprovadas: 0,
          valorTotal: 0,
          ultimaProposta: null,
          taxaConversao: 0,
          userId: null,
          tipo: 'representante',
          gerenteId: gerente.id,
          gerenteNome: gerente.nome,
        })
        existingIds.add(dr.id)
      }
    }
  }

  // ---- Rota adicional 2: vendedores vinculados via profiles.gerente_id ----
  // Busca usuários vendedores e representantes (role = 'Vendedor' ou 'Representante') cujo gerente_id aponta para este gerente,
  // garantindo que apareçam mesmo que nunca tenham emitido proposta.
  const { data: vendedorProfiles, error: vpErr } = await supabase
    .from('profiles')
    .select('id, name, email, estado_atuacao')
    .in('role', ['Vendedor', 'Representante'])
    .eq('gerente_id', gerente.id)
  if (vpErr) throw new Error(vpErr.message)
  const profileRows = (vendedorProfiles ?? []) as Array<{
    id: string
    name: string | null
    email: string | null
  }>

  if (profileRows.length > 0) {
    const profileIds = profileRows.map((p) => p.id)
    // Busca todas as propostas criadas por esses vendedores (campo user = profile.id).
    const { data: vPropostas, error: vpPropErr } = await supabase
      .from('propostas')
      .select('id, user, representante, status, valor_final, created_at')
      .in('user', profileIds)
    if (vpPropErr) throw new Error(vpPropErr.message)
    const vPropostasRows = (vPropostas ?? []) as Array<{
      id: string
      user: string | null
      representante: string | null
      status: string
      valor_final: number | null
      created_at: string | null
    }>

    // Conjunto de representantes já cobertos pela rota antiga (para não duplicar).
    const repsJaCobertos = new Set(repIds)

    // Agrupa propostas por profile (user).
    const byProfile = new Map<
      string,
      {
        total: number
        aprovadas: number
        valor: number
        ultima: string | null
        reps: Set<string>
      }
    >()
    for (const p of vPropostasRows) {
      const pid = p.user
      if (!pid) continue
      const entry = byProfile.get(pid) ?? {
        total: 0,
        aprovadas: 0,
        valor: 0,
        ultima: null,
        reps: new Set<string>(),
      }
      entry.total += 1
      if (STATUS_APROVADO.includes(p.status)) entry.aprovadas += 1
      entry.valor += Number(p.valor_final ?? 0)
      if (p.created_at && (!entry.ultima || p.created_at > entry.ultima)) {
        entry.ultima = p.created_at
      }
      if (p.representante) entry.reps.add(p.representante)
      byProfile.set(pid, entry)
    }

    for (const prof of profileRows) {
      const agg = byProfile.get(prof.id)
      // Se o vendedor já aparece pela rota antiga (algum de seus representantes
      // está coberto em byRep), não duplica.
      const jaCoberto = agg ? Array.from(agg.reps).some((r) => repsJaCobertos.has(r)) : false
      if (jaCoberto) continue
      const total = agg?.total ?? 0
      const aprovadas = agg?.aprovadas ?? 0
      const valor = agg?.valor ?? 0
      const ultima = agg?.ultima ?? null
      const taxaConversao = total > 0 ? (aprovadas / total) * 100 : 0
      vendedores.push({
        id: prof.id,
        fantasia: prof.name || prof.email || 'Vendedor',
        sigla: null,
        regiao: null,
        totalPropostas: total,
        aprovadas,
        valorTotal: valor,
        ultimaProposta: ultima,
        taxaConversao,
        userId: prof.id,
        tipo: 'usuario',
        gerenteId: gerente.id,
        gerenteNome: gerente.nome,
      })
    }
  }

  return { gerente, vendedores }
}

/**
 * Busca todos os gerentes ativos do sistema para seleção pelo Admin.
 */
export async function fetchGerentesAtivos(): Promise<Gerente[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('status', 'Ativo')
    .order('nome', { ascending: true })

  if (error) throw new Error(error.message)
  return (data ?? []) as Gerente[]
}

/**
 * Visão consolidada "Todos os Gerentes" para o Administrador.
 * Agrupa vendedores/representantes por gerente ativo, sem duplicatas entre seções.
 * Quem não tiver vínculo nem proposta com nenhum gerente aparece na seção "Sem Gerente Vinculado".
 */
export async function fetchTodosGerentesConsolidado(): Promise<TodosGerentesResult> {
  // 1. Busca todos os gerentes ativos ordenados por nome
  const gerentesAtivos = await fetchGerentesAtivos()

  // 2. Busca todos os representantes do sistema
  const { data: repsData, error: repsErr } = await supabase
    .from('representantes')
    .select('id, fantasia, sigla, regiao, estado, status, gerente_id')
  if (repsErr) throw new Error(repsErr.message)
  const allReps = (repsData ?? []) as Array<{
    id: string
    fantasia: string
    sigla: string | null
    regiao: string | null
    estado: string | null
    status: string
    gerente_id: string | null
  }>

  // 3. Busca todos os perfis com role Vendedor ou Representante
  const { data: profilesData, error: profErr } = await supabase
    .from('profiles')
    .select('id, name, email, role, estado_atuacao, gerente_id')
    .in('role', ['Vendedor', 'Representante'])
  if (profErr) throw new Error(profErr.message)
  const allProfiles = (profilesData ?? []) as Array<{
    id: string
    name: string | null
    email: string | null
    role: string
    gerente_id: string | null
  }>

  // 4. Busca todas as propostas para agregar estatísticas
  const { data: propostasData, error: propErr } = await supabase
    .from('propostas')
    .select('id, representante, user, gerente, status, valor_final, created_at')
  if (propErr) throw new Error(propErr.message)
  const allPropostas = (propostasData ?? []) as Array<{
    id: string
    representante: string | null
    user: string | null
    gerente: string | null
    status: string
    valor_final: number | null
    created_at: string | null
  }>

  // Map de propostas agregadas por representante
  const aggByRep = new Map<
    string,
    {
      total: number
      aprovadas: number
      valor: number
      ultima: string | null
      users: Set<string>
      gerentesFromPropostas: Set<string>
    }
  >()

  // Map de propostas agregadas por usuário vendedor (user = profile.id ou profile.name)
  const aggByUser = new Map<
    string,
    {
      total: number
      aprovadas: number
      valor: number
      ultima: string | null
      reps: Set<string>
      gerentesFromPropostas: Set<string>
    }
  >()

  for (const p of allPropostas) {
    const isAprovada = STATUS_APROVADO.includes(p.status)
    const val = Number(p.valor_final ?? 0)

    if (p.representante) {
      const entry = aggByRep.get(p.representante) ?? {
        total: 0,
        aprovadas: 0,
        valor: 0,
        ultima: null,
        users: new Set<string>(),
        gerentesFromPropostas: new Set<string>(),
      }
      entry.total += 1
      if (isAprovada) entry.aprovadas += 1
      entry.valor += val
      if (p.created_at && (!entry.ultima || p.created_at > entry.ultima)) {
        entry.ultima = p.created_at
      }
      if (p.user) entry.users.add(p.user)
      if (p.gerente) entry.gerentesFromPropostas.add(p.gerente)
      aggByRep.set(p.representante, entry)
    }

    if (p.user) {
      const entry = aggByUser.get(p.user) ?? {
        total: 0,
        aprovadas: 0,
        valor: 0,
        ultima: null,
        reps: new Set<string>(),
        gerentesFromPropostas: new Set<string>(),
      }
      entry.total += 1
      if (isAprovada) entry.aprovadas += 1
      entry.valor += val
      if (p.created_at && (!entry.ultima || p.created_at > entry.ultima)) {
        entry.ultima = p.created_at
      }
      if (p.representante) entry.reps.add(p.representante)
      if (p.gerente) entry.gerentesFromPropostas.add(p.gerente)
      aggByUser.set(p.user, entry)
    }
  }

  // Mapa de gerentes ativos por ID para lookup rápido
  const gerenteMap = new Map<string, Gerente>()
  for (const g of gerentesAtivos) {
    gerenteMap.set(g.id, g)
  }

  // Grupos por gerente: Map<gerenteId | 'sem_gerente', VendedorResumo[]>
  const gruposMap = new Map<string, VendedorResumo[]>()
  for (const g of gerentesAtivos) {
    gruposMap.set(g.id, [])
  }
  gruposMap.set('sem_gerente', [])

  // Conjunto de IDs de vendedores já alocados para garantir NÃO DUPLICAÇÃO
  const alocados = new Set<string>()

  // 1º Passo: Alocar Representantes
  // Decisão de qual gerente alocar:
  // a) rep.gerente_id (se válido e ativo)
  // b) se não tiver gerente_id, se teve propostas com algum gerente ativo (pega o gerente da proposta mais recente ou mais frequente)
  // c) senão, vai para 'sem_gerente'
  for (const rep of allReps) {
    if (alocados.has(rep.id)) continue

    const agg = aggByRep.get(rep.id)
    const total = agg?.total ?? 0
    const aprovadas = agg?.aprovadas ?? 0
    const valorTotal = agg?.valor ?? 0
    const ultimaProposta = agg?.ultima ?? null
    const taxaConversao = total > 0 ? (aprovadas / total) * 100 : 0
    // Pega um userId para auditoria se houver
    const firstUser = agg?.users.values().next().value ?? null

    let targetGerenteId: string = 'sem_gerente'

    if (rep.gerente_id && gerenteMap.has(rep.gerente_id)) {
      targetGerenteId = rep.gerente_id
    } else if (agg && agg.gerentesFromPropostas.size > 0) {
      // Verifica se algum gerente das propostas está ativo
      for (const gid of agg.gerentesFromPropostas) {
        if (gerenteMap.has(gid)) {
          targetGerenteId = gid
          break
        }
      }
    }

    const gObj = gerenteMap.get(targetGerenteId) ?? null

    const vendItem: VendedorResumo = {
      id: rep.id,
      fantasia: rep.fantasia || 'Sem nome',
      sigla: rep.sigla,
      regiao: rep.regiao,
      totalPropostas: total,
      aprovadas,
      valorTotal,
      ultimaProposta,
      taxaConversao,
      userId: firstUser,
      tipo: 'representante',
      gerenteId: gObj?.id ?? null,
      gerenteNome: gObj?.nome ?? null,
    }

    gruposMap.get(targetGerenteId)?.push(vendItem)
    alocados.add(rep.id)
  }

  // 2º Passo: Alocar Usuários Vendedores (profiles)
  // Apenas se o usuário não for redundante com um representante já coberto
  const repIdsSet = new Set(allReps.map((r) => r.id))
  for (const prof of allProfiles) {
    if (alocados.has(prof.id)) continue

    const agg = aggByUser.get(prof.id)
    // Se todos os representantes com os quais emitiu proposta já foram alocados, e este profile tem nome idêntico ou já coberto,
    // mas se o usuário tem gerente_id direto ou é um vendedor cadastrado, queremos exibi-lo se ele não for duplicata de ID.
    const total = agg?.total ?? 0
    const aprovadas = agg?.aprovadas ?? 0
    const valorTotal = agg?.valor ?? 0
    const ultimaProposta = agg?.ultima ?? null
    const taxaConversao = total > 0 ? (aprovadas / total) * 100 : 0

    let targetGerenteId: string = 'sem_gerente'

    if (prof.gerente_id && gerenteMap.has(prof.gerente_id)) {
      targetGerenteId = prof.gerente_id
    } else if (agg && agg.gerentesFromPropostas.size > 0) {
      for (const gid of agg.gerentesFromPropostas) {
        if (gerenteMap.has(gid)) {
          targetGerenteId = gid
          break
        }
      }
    }

    const gObj = gerenteMap.get(targetGerenteId) ?? null

    const vendItem: VendedorResumo = {
      id: prof.id,
      fantasia: prof.name || prof.email || 'Vendedor',
      sigla: null,
      regiao: null,
      totalPropostas: total,
      aprovadas,
      valorTotal,
      ultimaProposta,
      taxaConversao,
      userId: prof.id,
      tipo: 'usuario',
      gerenteId: gObj?.id ?? null,
      gerenteNome: gObj?.nome ?? null,
    }

    gruposMap.get(targetGerenteId)?.push(vendItem)
    alocados.add(prof.id)
  }

  // Monta a lista final de grupos
  const grupos: GrupoGerenteVendedores[] = []
  const todosVendedores: VendedorResumo[] = []

  for (const g of gerentesAtivos) {
    const list = gruposMap.get(g.id) ?? []
    todosVendedores.push(...list)
    const totalPropostas = list.reduce((s, v) => s + v.totalPropostas, 0)
    const aprovadas = list.reduce((s, v) => s + v.aprovadas, 0)
    const valorTotal = list.reduce((s, v) => s + v.valorTotal, 0)
    const taxa = totalPropostas > 0 ? (aprovadas / totalPropostas) * 100 : 0

    grupos.push({
      gerente: g,
      gerenteId: g.id,
      gerenteNome: g.nome,
      vendedores: list,
      totals: { totalPropostas, aprovadas, valorTotal, taxa },
    })
  }

  // Seção final: Sem Gerente Vinculado
  const semGerenteList = gruposMap.get('sem_gerente') ?? []
  if (semGerenteList.length > 0) {
    todosVendedores.push(...semGerenteList)
    const totalPropostas = semGerenteList.reduce((s, v) => s + v.totalPropostas, 0)
    const aprovadas = semGerenteList.reduce((s, v) => s + v.aprovadas, 0)
    const valorTotal = semGerenteList.reduce((s, v) => s + v.valorTotal, 0)
    const taxa = totalPropostas > 0 ? (aprovadas / totalPropostas) * 100 : 0

    grupos.push({
      gerente: null,
      gerenteId: null,
      gerenteNome: 'Sem Gerente Vinculado',
      vendedores: semGerenteList,
      totals: { totalPropostas, aprovadas, valorTotal, taxa },
    })
  }

  return {
    grupos,
    todosVendedores,
    gerentesAtivos,
  }
}

export async function fetchGerentes(): Promise<Gerente[]> {
  const { data, error } = await (supabase.from(TABLE) as any)
    .select(`
      *,
      categoria_restrita:categorias!gerentes_categoria_restrita_id_fkey (
        id,
        nome
      ),
      representantes:representantes (
        id,
        fantasia,
        razao_social,
        email,
        telefone,
        cidade,
        estado,
        status
      )
    `)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []).map((row: any) => {
    const reps = (row.representantes || []) as Array<{
      id: string
      fantasia: string
      razao_social?: string | null
      email?: string | null
      telefone?: string | null
      cidade?: string | null
      estado?: string | null
      status?: string
    }>
    return {
      ...row,
      representantes: reps,
      total_representantes: reps.length,
    }
  }) as Gerente[]
}

export async function insertGerente(payload: GerenteInsert): Promise<Gerente> {
  const { representantes, total_representantes, ...clean } = payload as any
  const { data, error } = await supabase.from(TABLE).insert(clean).select().single()
  if (error) throw new Error(error.message)
  return data as Gerente
}

export async function updateGerente(payload: GerenteUpdate): Promise<Gerente> {
  const { id, representantes, total_representantes, ...rest } = payload as any
  const { data, error } = await supabase.from(TABLE).update(rest).eq('id', id).select().single()
  if (error) throw new Error(error.message)
  return data as Gerente
}

export async function deleteGerente(id: string): Promise<void> {
  const { error } = await supabase.from(TABLE).delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export interface RepresentanteVinculoItem {
  id: string
  fantasia: string
  razao_social: string | null
  cidade: string | null
  estado: string | null
  email?: string | null
  telefone?: string | null
  status: string
  gerente_id: string | null
  gerente_nome?: string | null
}

export interface VendedorVinculoItem {
  id: string
  name: string | null
  email: string | null
  role: string
  setor: string | null
  status: string | null
  gerente_id: string | null
  gerente_nome?: string | null
}

/**
 * Busca todos os representantes do sistema com dados do gerente atualmente vinculado,
 * para exibição no modal de gerenciamento de vínculos.
 */
export async function fetchAllRepresentantesComGerente(): Promise<RepresentanteVinculoItem[]> {
  const { data, error } = await (supabase.from('representantes') as any)
    .select(`
      id,
      fantasia,
      razao_social,
      cidade,
      estado,
      email,
      telefone,
      status,
      gerente_id,
      gerente:gerentes (id, nome)
    `)
    .order('fantasia', { ascending: true })

  if (error) throw new Error(error.message)
  return (data ?? []).map((r: any) => ({
    id: r.id,
    fantasia: r.fantasia,
    razao_social: r.razao_social,
    cidade: r.cidade,
    estado: r.estado,
    email: r.email,
    telefone: r.telefone,
    status: r.status || 'Ativo',
    gerente_id: r.gerente_id,
    gerente_nome: r.gerente?.nome || null,
  }))
}

/**
 * Busca todos os usuários vendedores (role = 'Vendedor') do sistema
 * com dados do gerente atualmente vinculado.
 */
export async function fetchAllVendedoresComGerente(): Promise<VendedorVinculoItem[]> {
  const { data, error } = await (supabase.from('profiles') as any)
    .select(`
      id,
      name,
      email,
      role,
      setor,
      status,
      gerente_id,
      gerente:gerentes (id, nome)
    `)
    .in('role', ['Vendedor', 'Representante'])
    .order('name', { ascending: true })

  if (error) throw new Error(error.message)
  return (data ?? []).map((p: any) => ({
    id: p.id,
    name: p.name,
    email: p.email,
    role: p.role,
    setor: p.setor,
    status: p.status || 'ativo',
    gerente_id: p.gerente_id,
    gerente_nome: p.gerente?.nome || null,
  }))
}

/**
 * Vincula ou desvincula um representante de um gerente.
 * Passar gerenteId = null para desvincular.
 */
export async function setRepresentanteGerente(
  representanteId: string,
  gerenteId: string | null,
): Promise<void> {
  const { error } = await (supabase.from('representantes') as any)
    .update({ gerente_id: gerenteId })
    .eq('id', representanteId)
  if (error) throw new Error(error.message)
}

/**
 * Vincula ou desvincula um usuário vendedor (profile) de um gerente.
 * Passar gerenteId = null para desvincular.
 */
export async function setVendedorGerente(
  profileId: string,
  gerenteId: string | null,
): Promise<void> {
  const { error } = await (supabase.from('profiles') as any)
    .update({ gerente_id: gerenteId })
    .eq('id', profileId)
  if (error) throw new Error(error.message)
}

/**
 * Localiza o registro de Gerente correspondente ao usuário atual (se for gerente).
 * Checa:
 * 1. Campo `profile_id` igual ao id do usuário;
 * 2. Correspondência de email (campo `email` ou `usuario`);
 * 3. `user.gerente_id` direto (se apontar para `gerentes`).
 */
export async function findGerenteByProfile(
  profileId?: string | null,
  email?: string | null,
  userGerenteId?: string | null,
): Promise<Gerente | null> {
  if (!profileId && !email && !userGerenteId) return null

  // 1. Tentar por profile_id
  if (profileId) {
    const { data: byProfile } = await supabase
      .from(TABLE)
      .select('*')
      .eq('profile_id', profileId)
      .maybeSingle()
    if (byProfile) return byProfile as Gerente
  }

  // 2. Tentar por id direto caso o profile carregue o próprio ID de gerente
  if (userGerenteId) {
    const { data: byId } = await supabase
      .from(TABLE)
      .select('*')
      .eq('id', userGerenteId)
      .maybeSingle()
    if (byId) return byId as Gerente
  }

  // 3. Tentar por email ou usuario
  if (email) {
    const normalizedEmail = email.trim().toLowerCase()
    const { data: byEmail } = await supabase
      .from(TABLE)
      .select('*')
      .or(`email.ilike.${normalizedEmail},usuario.ilike.${normalizedEmail}`)
      .limit(1)
    if (byEmail && byEmail.length > 0) {
      return byEmail[0] as Gerente
    }
  }

  return null
}

export interface RepGerenteCategoriaVinculo {
  id: string
  representante_id: string
  gerente_id: string
  categoria_id: string
}

/**
 * Busca todos os vínculos de representante_gerente_categorias para um gerente.
 */
export async function fetchGerenteCategoriasVinculos(
  gerenteId: string,
): Promise<RepGerenteCategoriaVinculo[]> {
  const { data, error } = await supabase
    .from('representante_gerente_categorias')
    .select('id, representante_id, gerente_id, categoria_id')
    .eq('gerente_id', gerenteId)

  if (error) {
    console.error('Erro ao buscar vínculos representante_gerente_categorias:', error)
    return []
  }
  return (data || []) as RepGerenteCategoriaVinculo[]
}

/**
 * Busca todos os vínculos de representante_gerente_categorias para uma lista de representantes.
 */
export async function fetchRepresentantesGerentesCategorias(
  representanteIds?: string[],
): Promise<RepGerenteCategoriaVinculo[]> {
  let q = supabase
    .from('representante_gerente_categorias')
    .select('id, representante_id, gerente_id, categoria_id')

  if (representanteIds && representanteIds.length > 0) {
    q = q.in('representante_id', representanteIds)
  }

  const { data, error } = await q
  if (error) {
    console.error('Erro ao buscar vínculos de representantes com gerentes e categorias:', error)
    return []
  }
  return (data || []) as RepGerenteCategoriaVinculo[]
}

/**
 * Vincula ou atualiza o gerente de um representante para uma categoria específica.
 */
export async function setRepresentanteGerenteCategoria(
  representanteId: string,
  gerenteId: string,
  categoriaId: string,
): Promise<void> {
  const { error } = await supabase.from('representante_gerente_categorias').upsert(
    {
      representante_id: representanteId,
      gerente_id: gerenteId,
      categoria_id: categoriaId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'representante_id,categoria_id' },
  )

  if (error) throw new Error(error.message)
}

/**
 * Remove o vínculo de um representante com um gerente em uma categoria específica.
 */
export async function removeRepresentanteGerenteCategoria(
  representanteId: string,
  categoriaId: string,
): Promise<void> {
  const { error } = await supabase
    .from('representante_gerente_categorias')
    .delete()
    .eq('representante_id', representanteId)
    .eq('categoria_id', categoriaId)

  if (error) throw new Error(error.message)
}

/**
 * Resolve o gerente de um representante com base na categoria da máquina/produto.
 * Fallback para o gerente_id legado caso não haja vínculo específico por categoria.
 */
export async function resolveGerentePorCategoria(
  representanteId: string,
  categoriaId: string | null | undefined,
  fallbackGerenteId?: string | null,
): Promise<{ gerenteId: string | null; gerenteNome: string | null }> {
  if (representanteId && categoriaId) {
    const { data: row } = await supabase
      .from('representante_gerente_categorias')
      .select('gerente_id, gerentes:gerente_id(id, nome)')
      .eq('representante_id', representanteId)
      .eq('categoria_id', categoriaId)
      .maybeSingle()

    if (row && row.gerente_id) {
      const gObj = row.gerentes as unknown as { id: string; nome: string } | null
      return {
        gerenteId: row.gerente_id,
        gerenteNome: gObj?.nome || null,
      }
    }
  }

  // Fallback para gerente legado
  const targetGId = fallbackGerenteId || null
  if (targetGId) {
    const { data: g } = await supabase
      .from('gerentes')
      .select('id, nome')
      .eq('id', targetGId)
      .maybeSingle()

    return {
      gerenteId: targetGId,
      gerenteNome: g?.nome || null,
    }
  }

  return { gerenteId: null, gerenteNome: null }
}
