import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { getCorsHeaders } from '../_shared/cors.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { sendEmail } from '../_shared/resend.ts'
import { buildUserConfirmationEmail } from '../_shared/email-templates.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const ROLE_TEMPLATES: Record<string, string[]> = {
  Vendedor: [
    'dashboard',
    'cadastros-clientes',
    'eventos',
    'projetos',
    'propostas-emitir',
    'propostas-criadas',
    'produtos-lista',
    'notificacoes',
    'perfil',
  ],
  Representante: [
    'dashboard',
    'cadastros-clientes',
    'eventos',
    'projetos',
    'propostas-emitir',
    'propostas-criadas',
    'produtos-lista',
    'notificacoes',
    'perfil',
  ],
  Gerente: [
    'dashboard',
    'cadastros-clientes',
    'cadastros-representantes',
    'cadastros-regioes',
    'cadastros-gerentes',
    'cadastros-prepostos',
    'eventos',
    'projetos',
    'propostas-dashboard',
    'propostas-emitir',
    'propostas-criadas',
    'propostas-avancadas',
    'produtos-lista',
    'produtos-dashboard',
    'notificacoes',
    'area-atuacao',
    'perfil',
  ],
  Financeiro: [
    'dashboard',
    'cadastros-clientes',
    'propostas-dashboard',
    'propostas-criadas',
    'notificacoes',
    'perfil',
  ],
  'Admin Completo': [
    'dashboard',
    'cadastros-clientes',
    'cadastros-representantes',
    'cadastros-regioes',
    'cadastros-gerentes',
    'cadastros-prepostos',
    'eventos',
    'projetos',
    'propostas-dashboard',
    'propostas-emitir',
    'propostas-criadas',
    'propostas-avancadas',
    'propostas-tipos',
    'produtos-lista',
    'produtos-dashboard',
    'produtos-precos',
    'produtos-categorias',
    'produtos-marcas',
    'produtos-modelos',
    'produtos-versoes',
    'produtos-acessorios',
    'notificacoes',
    'importacoes',
    'importar-base',
    'area-atuacao',
    'usuarios',
    'auditoria',
    'configuracoes',
    'perfil',
  ],
}

async function verifyAdmin(authHeader: string) {
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const {
    data: { user },
    error,
  } = await userClient.auth.getUser()
  if (error || !user) return null

  // Usar adminClient (SERVICE_KEY) para ler com garantia o perfil do usuário
  const adminClient = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  let { data: profile } = await adminClient
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  // Fallback por email caso o UUID do auth.users divirja do profiles
  if (!profile && user.email) {
    const { data: profileByEmail } = await adminClient
      .from('profiles')
      .select('role')
      .ilike('email', user.email.trim())
      .maybeSingle()
    if (profileByEmail) {
      profile = profileByEmail
    }
  }

  const rawRole = (profile?.role || '').trim().toLowerCase()
  const isAdmin =
    rawRole === 'admin' ||
    rawRole === 'admin completo' ||
    rawRole === 'administrador' ||
    rawRole.startsWith('admin')

  if (!isAdmin) return null
  return user
}

/**
 * Normaliza strings para busca/comparação (remove espaços, case-insensitive).
 */
function clean(val: string | null | undefined): string {
  return (val || '').trim()
}

/**
 * Remove formatação de CPF/CNPJ para comparação por dígitos puros.
 */
function onlyDigits(val: string | null | undefined): string {
  return (val || '').replace(/\D/g, '')
}

/**
 * Sincroniza tabela `gerentes` quando o usuário tiver papel 'Gerente'.
 */
async function syncGerenteRecord(
  adminClient: any,
  params: {
    userId: string
    name: string
    email: string
    celular?: string | null
    documento?: string | null
    cargo?: string | null
    status?: string
  },
) {
  const { userId, name, email, celular, cargo, status } = params
  const cleanEmail = clean(email).toLowerCase()

  // 1. Tentar encontrar por profile_id
  let existingGerente: any = null
  const { data: byProfile } = await adminClient
    .from('gerentes')
    .select('id, nome, email, profile_id, status, celular, cargo')
    .eq('profile_id', userId)
    .maybeSingle()

  if (byProfile) {
    existingGerente = byProfile
  } else if (cleanEmail) {
    // 2. Tentar encontrar por email (case-insensitive)
    const { data: byEmail } = await adminClient
      .from('gerentes')
      .select('id, nome, email, profile_id, status, celular, cargo')
      .ilike('email', cleanEmail)
      .maybeSingle()
    if (byEmail) {
      existingGerente = byEmail
    }
  }

  const updates: Record<string, unknown> = {
    profile_id: userId,
    nome: name,
    email: cleanEmail || null,
  }
  if (celular !== undefined && celular !== null) {
    updates.celular = clean(celular) || null
  }
  if (cargo !== undefined && cargo !== null) {
    updates.cargo = clean(cargo) || null
  } else if (!existingGerente?.cargo) {
    updates.cargo = 'Gerente'
  }
  if (status) {
    updates.status = status === 'Inativo' ? 'Inativo' : 'Ativo'
  }

  if (existingGerente) {
    await adminClient.from('gerentes').update(updates).eq('id', existingGerente.id)
  } else {
    await adminClient.from('gerentes').insert({
      ...updates,
      status: updates.status || 'Ativo',
    })
  }
}

/**
 * Sincroniza tabela `representantes` quando o usuário tiver papel 'Representante'.
 */
async function syncRepresentanteRecord(
  adminClient: any,
  params: {
    userId: string
    name: string
    email: string
    celular?: string | null
    documento?: string | null
    gerente_id?: string | null
    estado_atuacao?: string | null
    status?: string
  },
) {
  const { userId, name, email, celular, documento, gerente_id, estado_atuacao, status } = params
  const cleanEmail = clean(email).toLowerCase()
  const cleanDocDigits = onlyDigits(documento)

  let existingRep: any = null

  // 1. Tentar encontrar por profile_id
  const { data: byProfile } = await adminClient
    .from('representantes')
    .select('id, fantasia, email, documento, profile_id, status, reg')
    .eq('profile_id', userId)
    .maybeSingle()

  if (byProfile) {
    existingRep = byProfile
  } else {
    // 2. Tentar encontrar por documento (se preenchido)
    if (cleanDocDigits) {
      const { data: repsWithDoc } = await adminClient
        .from('representantes')
        .select('id, fantasia, email, documento, profile_id, status, reg')
        .not('documento', 'is', null)

      if (repsWithDoc) {
        existingRep = repsWithDoc.find((r: any) => onlyDigits(r.documento) === cleanDocDigits)
      }
    }

    // 3. Tentar encontrar por email se ainda não achou
    if (!existingRep && cleanEmail) {
      const { data: byEmail } = await adminClient
        .from('representantes')
        .select('id, fantasia, email, documento, profile_id, status, reg')
        .ilike('email', cleanEmail)
        .maybeSingle()
      if (byEmail) {
        existingRep = byEmail
      }
    }
  }

  const updates: Record<string, unknown> = {
    profile_id: userId,
    fantasia: name,
    email: cleanEmail || null,
  }
  if (celular !== undefined && celular !== null) {
    updates.celular = clean(celular) || null
  }
  if (documento !== undefined && documento !== null) {
    updates.documento = clean(documento) || null
  }
  if (gerente_id !== undefined) {
    updates.gerente_id = gerente_id || null
  }
  // Suporte a múltiplos estados separados por vírgula (ex: "SP, MG, RJ")
  const estadosList: string[] = estado_atuacao
    ? Array.from(
        new Set(
          estado_atuacao
            .split(',')
            .map((s: string) => s.trim().toUpperCase())
            .filter((s: string) => s.length > 0),
        ),
      )
    : []

  if (estado_atuacao !== undefined) {
    updates.estado = estadosList.length > 0 ? estadosList.join(', ') : null
  }
  if (status) {
    updates.status = status === 'Inativo' ? 'Inativo' : 'Ativo'
  }

  let finalRepId: string | null = null

  if (existingRep) {
    finalRepId = existingRep.id
    await adminClient.from('representantes').update(updates).eq('id', existingRep.id)
  } else {
    // Para novo representante, calcula o próximo reg disponível (inteiro único)
    let nextReg = 1
    const { data: maxRegRow } = await adminClient
      .from('representantes')
      .select('reg')
      .order('reg', { ascending: false, nullsFirst: false })
      .limit(1)

    if (maxRegRow && maxRegRow.length > 0 && maxRegRow[0].reg) {
      nextReg = Number(maxRegRow[0].reg) + 1
    }

    const { data: insertedRep } = await adminClient
      .from('representantes')
      .insert({
        ...updates,
        reg: nextReg,
        status: updates.status || 'Ativo',
      })
      .select('id')
      .maybeSingle()

    if (insertedRep) {
      finalRepId = insertedRep.id
    }
  }

  // Sincronizar com representante_regioes substituindo o conjunto de regiões pelos estados informados
  if (finalRepId && estado_atuacao !== undefined) {
    // 1. Remover regiões antigas vinculadas ao representante
    await adminClient.from('representante_regioes').delete().eq('representante_id', finalRepId)

    // 2. Se houver estados informados, busca as regiões correspondentes pelas UFs
    if (estadosList.length > 0) {
      const { data: regioesRows } = await adminClient
        .from('regioes')
        .select('id, uf')
        .in('uf', estadosList)

      if (regioesRows && regioesRows.length > 0) {
        const vinculos = regioesRows.map((r: { id: string }) => ({
          representante_id: finalRepId,
          regiao_id: r.id,
        }))
        await adminClient.from('representante_regioes').insert(vinculos)
      }
    }
  }
}

/**
 * Trata o desvincular ou desativar ao alterar papel, desativar usuário ou excluir usuário.
 * Regra segura solicitada: não apagar o registro em `gerentes`/`representantes` se tiver vínculos,
 * no máximo desativá-lo e/ou limpar profile_id se for exclusão.
 */
async function handleUserDeactivationOrDelete(
  adminClient: any,
  userId: string,
  isPermanentDelete: boolean,
) {
  // 1. Localiza se há registro em gerentes com esse profile_id
  const { data: gerentesVinculados } = await adminClient
    .from('gerentes')
    .select('id, nome')
    .eq('profile_id', userId)

  for (const g of gerentesVinculados || []) {
    // Verifica se possui representantes ou vendedores vinculados ou propostas
    const [repsCount, profilesCount, propostasCount] = await Promise.all([
      adminClient
        .from('representantes')
        .select('id', { count: 'exact', head: true })
        .eq('gerente_id', g.id),
      adminClient
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('gerente_id', g.id),
      adminClient
        .from('propostas')
        .select('id', { count: 'exact', head: true })
        .eq('gerente', g.id),
    ])
    const totalVinculos =
      (repsCount.count || 0) + (profilesCount.count || 0) + (propostasCount.count || 0)

    if (isPermanentDelete) {
      // Se não tem vínculos, podemos remover; se tem, apenas desvinculamos o profile e marcamos Inativo
      if (totalVinculos === 0) {
        await adminClient.from('gerentes').delete().eq('id', g.id)
      } else {
        await adminClient
          .from('gerentes')
          .update({ profile_id: null, status: 'Inativo' })
          .eq('id', g.id)
      }
    } else {
      // Apenas desativação de usuário
      await adminClient.from('gerentes').update({ status: 'Inativo' }).eq('id', g.id)
    }
  }

  // 2. Localiza se há registro em representantes com esse profile_id
  const { data: repsVinculados } = await adminClient
    .from('representantes')
    .select('id, fantasia')
    .eq('profile_id', userId)

  for (const r of repsVinculados || []) {
    const { count: propCount } = await adminClient
      .from('propostas')
      .select('id', { count: 'exact', head: true })
      .eq('representante', r.id)

    if (isPermanentDelete) {
      if ((propCount || 0) === 0) {
        await adminClient.from('representantes').delete().eq('id', r.id)
      } else {
        await adminClient
          .from('representantes')
          .update({ profile_id: null, status: 'Inativo' })
          .eq('id', r.id)
      }
    } else {
      await adminClient.from('representantes').update({ status: 'Inativo' }).eq('id', r.id)
    }
  }
}

Deno.serve(async (req: Request) => {
  const cors = getCorsHeaders(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader)
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...cors },
      })

    const adminUser = await verifyAdmin(authHeader)
    if (!adminUser)
      return new Response(JSON.stringify({ error: 'Acesso negado. Apenas administradores.' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json', ...cors },
      })

    const adminClient = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const body = await req.json()
    const { action } = body

    if (action === 'list') {
      const { data: authData, error: listError } = await adminClient.auth.admin.listUsers()
      if (listError)
        return new Response(JSON.stringify({ error: listError.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...cors },
        })
      const { data: profiles } = await adminClient.from('profiles').select('*')
      const profileMap = new Map(
        (profiles || []).map((p: Record<string, unknown>) => [p.id as string, p]),
      )
      // Busca os gerentes ativos para resolver o nome do gerente responsável.
      const { data: gerentesRows } = await adminClient
        .from('gerentes')
        .select('id, nome')
        .eq('status', 'Ativo')
      const gerenteMap = new Map(
        (gerentesRows || []).map((g: Record<string, unknown>) => [
          g.id as string,
          g.nome as string,
        ]),
      )

      // Carrega dados de gerentes e representantes para complementar telefone/celular/documento se houver
      const { data: gerentesList } = await adminClient
        .from('gerentes')
        .select('profile_id, celular, cargo')
      const gerenteExtraMap = new Map(
        (gerentesList || []).filter((g: any) => g.profile_id).map((g: any) => [g.profile_id, g]),
      )

      const { data: repsList } = await adminClient
        .from('representantes')
        .select('profile_id, celular, telefone, documento')
      const repExtraMap = new Map(
        (repsList || []).filter((r: any) => r.profile_id).map((r: any) => [r.profile_id, r]),
      )

      const users = authData.users.map((u: Record<string, unknown>) => {
        const p = profileMap.get(u.id as string) || ({} as Record<string, unknown>)
        const gerenteId = (p.gerente_id as string | null) ?? null
        const gExtra = gerenteExtraMap.get(u.id as string)
        const rExtra = repExtraMap.get(u.id as string)

        const celular = (p.celular as string | null) || gExtra?.celular || rExtra?.celular || null
        const telefone = (p.telefone as string | null) || rExtra?.telefone || null
        const documento = (p.documento as string | null) || rExtra?.documento || null

        return {
          id: u.id,
          email: u.email || '',
          created_at: u.created_at || '',
          name: p.name || '',
          role: p.role || 'user',
          setor: p.setor || '',
          status: p.status || 'Ativo',
          menu_access: p.menu_access || [],
          avatar_url: p.avatar_url || null,
          assinatura: p.assinatura || null,
          gerente_id: gerenteId,
          gerente_nome: gerenteId ? (gerenteMap.get(gerenteId) ?? null) : null,
          estado_atuacao: (p.estado_atuacao as string | null) || null,
          celular,
          telefone,
          documento,
          last_sign_in_at: u.last_sign_in_at || null,
          last_seen_at: (p.last_seen_at as string | null) || null,
        }
      })
      return new Response(JSON.stringify({ users }), {
        headers: { 'Content-Type': 'application/json', Connection: 'keep-alive', ...cors },
      })
    }

    if (action === 'invite') {
      const {
        name,
        email,
        setor,
        role,
        password,
        gerente_id,
        estado_atuacao,
        celular,
        telefone,
        documento,
        redirectTo,
      } = body
      if (!name || !email || !role)
        return new Response(JSON.stringify({ error: 'Nome, email e perfil são obrigatórios' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...cors },
        })
      if (!password || password.length < 8)
        return new Response(
          JSON.stringify({ error: 'Senha é obrigatória e deve ter no mínimo 8 caracteres' }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...cors },
          },
        )
      const { data: inviteData, error: inviteError } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name, role },
      })
      if (inviteError) {
        const msg = inviteError.message || ''
        if (
          msg.toLowerCase().includes('already') ||
          msg.toLowerCase().includes('exists') ||
          msg.toLowerCase().includes('registered')
        )
          return new Response(JSON.stringify({ error: 'Este e-mail já está em uso.' }), {
            status: 409,
            headers: { 'Content-Type': 'application/json', ...cors },
          })
        return new Response(JSON.stringify({ error: msg }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...cors },
        })
      }

      const menuAccess = ROLE_TEMPLATES[role] || []
      const newUserId = inviteData.user.id

      const cleanEstadosInvite = estado_atuacao
        ? Array.from(
            new Set(
              estado_atuacao
                .split(',')
                .map((s: string) => s.trim().toUpperCase())
                .filter((s: string) => s.length > 0),
            ),
          ).join(', ')
        : null

      const { error: profileError } = await adminClient.from('profiles').upsert(
        {
          id: newUserId,
          name,
          email,
          role,
          setor: setor || '',
          status: 'Ativo',
          menu_access: menuAccess,
          gerente_id: gerente_id || null,
          estado_atuacao: cleanEstadosInvite || null,
          celular: celular || null,
          telefone: telefone || null,
          documento: documento || null,
        },
        { onConflict: 'id' },
      )
      void redirectTo
      if (profileError)
        return new Response(JSON.stringify({ error: profileError.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...cors },
        })

      // Sincronização automática para Gerente ou (Representante / Vendedor)
      if (role === 'Gerente') {
        await syncGerenteRecord(adminClient, {
          userId: newUserId,
          name,
          email,
          celular: celular || telefone || null,
          documento: documento || null,
          cargo: setor || 'Gerente',
          status: 'Ativo',
        })
      } else if (role === 'Representante' || role === 'Vendedor') {
        await syncRepresentanteRecord(adminClient, {
          userId: newUserId,
          name,
          email,
          celular: celular || telefone || null,
          documento: documento || null,
          gerente_id: gerente_id || null,
          estado_atuacao: estado_atuacao || null,
          status: 'Ativo',
        })
      }

      // Disparo do e-mail de confirmação ao usuário cadastrado (não-bloqueante)
      let emailSent = false
      let emailError: string | null = null
      try {
        const appOrigin = redirectTo || 'https://nexus.bener.com.br'
        const emailHtml = buildUserConfirmationEmail(name, email, role, appOrigin)
        const emailSubject = 'Cadastro Confirmado e Aprovado — Bener Nexus'

        // 1. Tentar via n8n webhook se configurado
        const N8N_EMAIL_WEBHOOK =
          Deno.env.get('N8N_RESEND_EMAIL_WEBHOOK_URL') ||
          Deno.env.get('N8N_CRITICAL_ACTION_WEBHOOK_URL') ||
          Deno.env.get('N8N_WEBHOOK_URL')

        if (N8N_EMAIL_WEBHOOK) {
          try {
            const whRes = await fetch(N8N_EMAIL_WEBHOOK, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'user_registered_confirmation',
                email,
                name,
                role,
                access_url: appOrigin,
                subject: emailSubject,
                html: emailHtml,
                recipients: [email],
              }),
            })
            if (whRes.ok) {
              emailSent = true
            } else {
              emailError = `Webhook n8n retornou status ${whRes.status}`
            }
          } catch (whErr) {
            emailError = whErr instanceof Error ? whErr.message : String(whErr)
          }
        }

        // 2. Se não enviado via webhook, tentar via Resend direto se RESEND_API_KEY existir
        if (!emailSent) {
          const resendKey = Deno.env.get('RESEND_API_KEY')
          if (resendKey) {
            const resendResult = await sendEmail(
              resendKey,
              email,
              emailSubject,
              emailHtml,
              undefined,
              'Bener Nexus <onboarding@resend.dev>',
            )
            if (resendResult.success) {
              emailSent = true
            } else {
              emailError = resendResult.error || 'Falha no envio Resend'
            }
          } else if (!N8N_EMAIL_WEBHOOK) {
            emailError = 'Nenhum provedor de e-mail (n8n ou Resend) configurado nos secrets.'
          }
        }
      } catch (mailEx) {
        emailError = mailEx instanceof Error ? mailEx.message : String(mailEx)
        console.error('[admin-user-management] Falha ao enviar e-mail de confirmação:', mailEx)
      }

      await adminClient.from('audit_logs').insert({
        user_id: adminUser.id,
        user_name: adminUser.email,
        action: 'INVITE_USER',
        table_name: 'profiles',
        record_id: newUserId,
        data_changes: {
          name,
          email,
          role,
          setor,
          gerente_id: gerente_id || null,
          celular,
          telefone,
          documento,
          confirmation_email_sent: emailSent,
          confirmation_email_error: emailError,
        },
      })
      return new Response(
        JSON.stringify({
          success: true,
          email_sent: emailSent,
          email_error: emailError,
        }),
        {
          headers: { 'Content-Type': 'application/json', Connection: 'keep-alive', ...cors },
        },
      )
    }

    if (action === 'update') {
      const {
        id,
        name,
        email,
        role,
        status,
        setor,
        gerente_id,
        estado_atuacao,
        celular,
        telefone,
        documento,
      } = body
      if (!id)
        return new Response(JSON.stringify({ error: 'ID é obrigatório' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...cors },
        })

      // Busca dados atuais do profile para detectar mudanças de papel ou status
      const { data: currentProfile } = await adminClient
        .from('profiles')
        .select('*')
        .eq('id', id)
        .single()

      if (!currentProfile) {
        return new Response(JSON.stringify({ error: 'Usuário não encontrado' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json', ...cors },
        })
      }

      const updates: Record<string, unknown> = {}
      if (name) updates.name = name
      if (role) {
        updates.role = role
        updates.menu_access = ROLE_TEMPLATES[role] || []
      }
      if (status) updates.status = status
      if (setor !== undefined) updates.setor = setor
      if (gerente_id !== undefined) updates.gerente_id = gerente_id || null
      if (estado_atuacao !== undefined) {
        const cleanEstadosUpdate = estado_atuacao
          ? Array.from(
              new Set(
                estado_atuacao
                  .split(',')
                  .map((s: string) => s.trim().toUpperCase())
                  .filter((s: string) => s.length > 0),
              ),
            ).join(', ')
          : null
        updates.estado_atuacao = cleanEstadosUpdate
      }
      if (celular !== undefined) updates.celular = celular ? clean(celular) || null : null
      if (telefone !== undefined) updates.telefone = telefone ? clean(telefone) || null : null
      if (documento !== undefined) updates.documento = documento ? clean(documento) || null : null

      const { error: updateError } = await adminClient.from('profiles').update(updates).eq('id', id)
      if (updateError)
        return new Response(JSON.stringify({ error: updateError.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...cors },
        })

      const finalRole = (role || currentProfile.role) as string
      const finalName = (name || currentProfile.name) as string
      const finalEmail = (email || currentProfile.email) as string
      const finalStatus = (status || currentProfile.status) as string
      const finalGerenteId =
        gerente_id !== undefined ? gerente_id || null : currentProfile.gerente_id

      // Se o status virou Inativo, reflete em gerentes e representantes e aplica ban no auth
      if (status && status === 'Inativo' && currentProfile.status === 'Ativo') {
        await handleUserDeactivationOrDelete(adminClient, id, false)
        try {
          await adminClient.auth.admin.updateUserById(id, { ban_duration: '876000h' })
        } catch (banErr) {
          console.warn('[admin-user-management] Falha ao banir usuário no auth:', banErr)
        }
      } else if (status && status === 'Ativo' && currentProfile.status === 'Inativo') {
        try {
          await adminClient.auth.admin.updateUserById(id, { ban_duration: 'none' })
        } catch (unbanErr) {
          console.warn('[admin-user-management] Falha ao desbanir usuário no auth:', unbanErr)
        }
      }

      if (status !== 'Inativo') {
        // Se ativou ou continua ativo:
        if (finalRole === 'Gerente') {
          await syncGerenteRecord(adminClient, {
            userId: id,
            name: finalName,
            email: finalEmail,
            celular: celular || telefone || null,
            documento: documento || null,
            cargo: setor || currentProfile.setor || 'Gerente',
            status: finalStatus,
          })
        } else if (finalRole === 'Representante' || finalRole === 'Vendedor') {
          await syncRepresentanteRecord(adminClient, {
            userId: id,
            name: finalName,
            email: finalEmail,
            celular: celular || telefone || null,
            documento: documento || null,
            gerente_id: finalGerenteId,
            estado_atuacao:
              estado_atuacao !== undefined
                ? estado_atuacao
                : (currentProfile as any).estado_atuacao,
            status: finalStatus,
          })
        }
      }

      await adminClient.from('audit_logs').insert({
        user_id: adminUser.id,
        user_name: adminUser.email,
        action: 'UPDATE_USER',
        table_name: 'profiles',
        record_id: id,
        data_changes: { ...updates, celular, telefone, documento },
      })
      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json', Connection: 'keep-alive', ...cors },
      })
    }

    if (action === 'delete') {
      const { id } = body
      if (!id)
        return new Response(JSON.stringify({ error: 'ID é obrigatório' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...cors },
        })

      if (id === adminUser.id)
        return new Response(
          JSON.stringify({ error: 'Você não pode excluir seu próprio usuário.' }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...cors } },
        )

      const { data: targetProfile } = await adminClient
        .from('profiles')
        .select('name, email')
        .eq('id', id)
        .single()

      if (!targetProfile)
        return new Response(JSON.stringify({ error: 'Usuário não encontrado.' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json', ...cors },
        })

      // Gerenciar com segurança os registros vinculados de gerentes / representantes
      await handleUserDeactivationOrDelete(adminClient, id, true)

      const { error: membroErr } = await adminClient
        .from('projeto_membros')
        .delete()
        .eq('user_id', id)
      if (membroErr)
        return new Response(
          JSON.stringify({
            error: `Não foi possível remover o vínculo do usuário em projetos (projeto_membros): ${membroErr.message}`,
          }),
          { status: 500, headers: { 'Content-Type': 'application/json', ...cors } },
        )

      const { error: prefErr } = await adminClient.from('preferencias').delete().eq('usuario', id)
      if (prefErr)
        return new Response(
          JSON.stringify({
            error: `Não foi possível remover as preferências do usuário (preferencias): ${prefErr.message}`,
          }),
          { status: 500, headers: { 'Content-Type': 'application/json', ...cors } },
        )

      const { error: notifErr } = await adminClient.from('notificacoes').delete().eq('usuario', id)
      if (notifErr)
        return new Response(
          JSON.stringify({
            error: `Não foi possível remover as notificações do usuário (notificacoes): ${notifErr.message}`,
          }),
          { status: 500, headers: { 'Content-Type': 'application/json', ...cors } },
        )

      const { error: auditErr } = await adminClient
        .from('audit_logs')
        .update({ user_id: null })
        .eq('user_id', id)
      if (auditErr)
        return new Response(
          JSON.stringify({
            error: `Não foi possível desvincular os logs de auditoria (audit_logs): ${auditErr.message}`,
          }),
          { status: 500, headers: { 'Content-Type': 'application/json', ...cors } },
        )

      const { error: deleteError } = await adminClient.auth.admin.deleteUser(id)
      if (deleteError) {
        const msg = deleteError.message || ''
        if (msg.toLowerCase().includes('not found') || msg.toLowerCase().includes('does not exist'))
          return new Response(JSON.stringify({ error: 'Usuário não encontrado.' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json', ...cors },
          })
        return new Response(JSON.stringify({ error: `Erro ao excluir usuário: ${msg}` }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...cors },
        })
      }

      await adminClient.from('audit_logs').insert({
        user_id: adminUser.id,
        user_name: adminUser.email,
        action: 'delete',
        table_name: 'profiles',
        record_id: id,
        data_changes: {
          deleted_user_name: targetProfile.name,
          deleted_user_email: targetProfile.email,
        },
      })

      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json', Connection: 'keep-alive', ...cors },
      })
    }

    return new Response(JSON.stringify({ error: 'Ação inválida' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...cors },
    })
  } catch (err) {
    console.error('admin-user-management error:', err)
    return new Response(JSON.stringify({ error: 'Erro interno ao gerenciar usuários.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...cors },
    })
  }
})
