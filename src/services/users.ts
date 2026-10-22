import { supabase } from '@/lib/supabase/client'

export interface AdminUser {
  id: string
  email: string
  created_at: string
  name: string
  role: string
  setor: string
  status: string
  menu_access: string[]
  avatar_url: string | null
  assinatura: string | null
  gerente_id: string | null
  gerente_nome: string | null
  estado_atuacao?: string | null
  celular?: string | null
  telefone?: string | null
  documento?: string | null
  last_sign_in_at: string | null
  last_seen_at?: string | null
}

async function extractFunctionErrorMessage(
  error: unknown,
  fallbackMessage: string,
): Promise<string> {
  if (!error) return fallbackMessage

  const errObj = error as { message?: string; context?: Response }
  if (errObj.context) {
    try {
      // Clona se suportado para evitar consumir o stream da response
      const res =
        typeof errObj.context.clone === 'function' ? errObj.context.clone() : errObj.context
      const body = await res.json()
      if (body?.error && typeof body.error === 'string') {
        return body.error
      }
    } catch {
      // Response não é JSON válido
    }
  }

  if (errObj.message && !errObj.message.includes('non-2xx status code')) {
    return errObj.message
  }

  return fallbackMessage
}

export async function fetchUsers(): Promise<{ data: AdminUser[] | null; error: string | null }> {
  const { data, error } = await supabase.functions.invoke('admin-user-management', {
    body: { action: 'list' },
  })
  if (error) {
    const errorMsg = await extractFunctionErrorMessage(error, 'Erro ao carregar lista de usuários.')
    return { data: null, error: errorMsg }
  }
  return { data: data.users || [], error: null }
}

export async function inviteUser(params: {
  name: string
  email: string
  setor: string
  role: string
  password: string
  gerente_id?: string | null
  estado_atuacao?: string | null
  celular?: string | null
  telefone?: string | null
  documento?: string | null
}): Promise<{ error: string | null }> {
  const { data, error } = await supabase.functions.invoke('admin-user-management', {
    body: { action: 'invite', ...params, redirectTo: window.location.origin },
  })

  if (error) {
    const errorMsg = await extractFunctionErrorMessage(error, 'Erro ao convidar usuário.')
    return { error: errorMsg }
  }

  if (data?.error) {
    return { error: data.error }
  }

  return { error: null }
}

export async function updateUserProfile(
  id: string,
  updates: {
    name?: string
    role?: string
    status?: string
    setor?: string
    gerente_id?: string | null
    estado_atuacao?: string | null
    celular?: string | null
    telefone?: string | null
    documento?: string | null
  },
): Promise<{ error: string | null }> {
  const { data, error } = await supabase.functions.invoke('admin-user-management', {
    body: { action: 'update', id, ...updates },
  })

  if (error) {
    const errorMsg = await extractFunctionErrorMessage(error, 'Erro ao atualizar usuário.')
    return { error: errorMsg }
  }

  if (data?.error) {
    return { error: data.error }
  }

  return { error: null }
}

export async function deleteUser(id: string): Promise<{ error: string | null }> {
  const { data, error } = await supabase.functions.invoke('admin-user-management', {
    body: { action: 'delete', id },
  })

  if (error) {
    const errorMsg = await extractFunctionErrorMessage(error, 'Erro ao excluir usuário.')
    return { error: errorMsg }
  }

  if (data?.error) {
    return { error: data.error }
  }

  return { error: null }
}

/**
 * Busca os gerentes ativos para popular o select "Gerente Responsável".
 * Retorna { id, nome } ordenado por nome.
 */
export async function fetchGerentesParaSelect(): Promise<{ id: string; nome: string }[]> {
  const { data, error } = await supabase
    .from('gerentes')
    .select('id, nome')
    .eq('status', 'Ativo')
    .order('nome', { ascending: true })
  if (error) return []
  return (data ?? []).map((g) => ({ id: g.id as string, nome: g.nome as string }))
}

/**
 * Busca as categorias vinculadas a um usuário vendedor/representante (via representante_categorias).
 * Localiza o representante pelo profile_id ou email do usuário.
 */
export async function fetchUserCategoriaIds(
  profileId: string,
  email?: string | null,
): Promise<{ representanteId: string | null; categoriaIds: string[] }> {
  try {
    let query = supabase.from('representantes').select('id')
    if (email) {
      query = query.or(`profile_id.eq.${profileId},email.ilike.${email}`)
    } else {
      query = query.eq('profile_id', profileId)
    }

    const { data: rep } = await query.maybeSingle()
    if (!rep) return { representanteId: null, categoriaIds: [] }

    const { data: cats, error } = await supabase
      .from('representante_categorias')
      .select('categoria_id')
      .eq('representante_id', rep.id)

    if (error) {
      console.error('Erro ao buscar categorias do representante:', error)
      return { representanteId: rep.id, categoriaIds: [] }
    }

    return {
      representanteId: rep.id,
      categoriaIds: (cats || []).map((c: any) => c.categoria_id).filter(Boolean),
    }
  } catch (err) {
    console.error('Erro ao buscar categorias do usuário:', err)
    return { representanteId: null, categoriaIds: [] }
  }
}

/**
 * Sincroniza as categorias selecionadas para um usuário vendedor/representante na tabela public.representante_categorias.
 * Se o representante ainda não existir em 'representantes', cria um registro mínimo para ele.
 */
export async function syncUserEstadosAtuacao(
  profileId: string,
  userEmail: string,
  userName: string,
  estadosList: string[],
): Promise<void> {
  const cleanEstados = Array.from(
    new Set(estadosList.map((s) => s.trim().toUpperCase()).filter((s) => s.length > 0)),
  )
  const targetEstado = cleanEstados.length > 0 ? cleanEstados.join(', ') : null

  // 1. Atualizar profile
  await supabase.from('profiles').update({ estado_atuacao: targetEstado }).eq('id', profileId)

  // 2. Localizar ou vincular representante
  let query = supabase.from('representantes').select('id')
  if (userEmail) {
    query = query.or(`profile_id.eq.${profileId},email.ilike.${userEmail}`)
  } else {
    query = query.eq('profile_id', profileId)
  }

  const { data: rep } = await query.maybeSingle()
  let repId = rep?.id

  if (!repId && cleanEstados.length > 0) {
    const { data: newRep, error: insertErr } = await (supabase.from('representantes') as any)
      .insert({
        fantasia: userName || userEmail || 'Vendedor',
        razao_social: userName || userEmail || 'Vendedor',
        email: userEmail || null,
        profile_id: profileId,
        estado: targetEstado,
        status: 'Ativo',
      })
      .select('id')
      .single()

    if (!insertErr && newRep) {
      repId = newRep.id
    }
  } else if (repId) {
    await (supabase.from('representantes') as any)
      .update({ estado: targetEstado, profile_id: profileId })
      .eq('id', repId)
  }

  // 3. Sincronizar com representante_regioes
  if (repId) {
    await (supabase as any).from('representante_regioes').delete().eq('representante_id', repId)

    if (cleanEstados.length > 0) {
      const { data: regRows } = await supabase
        .from('regioes')
        .select('id, uf')
        .in('uf', cleanEstados)

      if (regRows && regRows.length > 0) {
        const vinculos = regRows.map((r: { id: string }) => ({
          representante_id: repId,
          regiao_id: r.id,
        }))
        await (supabase as any).from('representante_regioes').insert(vinculos)
      }
    }
  }
}

export async function syncUserCategorias(
  profileId: string,
  userEmail: string,
  userName: string,
  categoriaIds: string[],
): Promise<void> {
  // 1. Localiza ou cria o registro de representante para o usuário
  let query = supabase.from('representantes').select('id')
  if (userEmail) {
    query = query.or(`profile_id.eq.${profileId},email.ilike.${userEmail}`)
  } else {
    query = query.eq('profile_id', profileId)
  }

  const { data: rep } = await query.maybeSingle()
  let repId = rep?.id

  if (!repId) {
    const { data: newRep, error: insertErr } = await (supabase.from('representantes') as any)
      .insert({
        fantasia: userName || userEmail || 'Vendedor',
        razao_social: userName || userEmail || 'Vendedor',
        email: userEmail || null,
        profile_id: profileId,
        status: 'Ativo',
      })
      .select('id')
      .single()

    if (insertErr) {
      console.error('Erro ao criar registro de representante para usuário:', insertErr)
      throw new Error(`Falha ao registrar representante do vendedor: ${insertErr.message}`)
    }
    repId = newRep.id
  }

  // 2. Limpa e recria os vínculos em representante_categorias
  await supabase.from('representante_categorias').delete().eq('representante_id', repId)

  if (categoriaIds.length > 0) {
    const rows = categoriaIds.map((cid) => ({
      representante_id: repId,
      categoria_id: cid,
    }))
    const { error: catErr } = await supabase.from('representante_categorias').insert(rows)
    if (catErr) {
      console.error('Erro ao inserir representante_categorias:', catErr)
      throw new Error(`Falha ao vincular categorias: ${catErr.message}`)
    }
  }
}
