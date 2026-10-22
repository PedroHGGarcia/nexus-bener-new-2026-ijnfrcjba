import { createClient } from 'npm:@supabase/supabase-js@2'
import { getCorsHeaders } from './cors.ts'

export interface AuthenticatedUser {
  id: string
  email?: string
  role?: string
}

export function escapeHtml(str: unknown): string {
  if (str === null || str === undefined) return ''
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Validates JWT in Authorization header. Returns user or throws a Response with 401.
 */
export async function requireUser(req: Request): Promise<{ user: AuthenticatedUser; client: any }> {
  const authHeader = req.headers.get('Authorization')
  const cors = getCorsHeaders(req)

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Response(JSON.stringify({ error: 'Autenticação necessária.' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', ...cors },
    })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const {
    data: { user },
    error,
  } = await userClient.auth.getUser()

  if (error || !user) {
    throw new Response(JSON.stringify({ error: 'Sessão inválida ou expirada.' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', ...cors },
    })
  }

  // Fetch role and status from profiles
  const adminClient = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: profile } = await adminClient
    .from('profiles')
    .select('role, status')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.status && profile.status !== 'Ativo') {
    throw new Response(JSON.stringify({ error: 'Usuário inativo. Acesso bloqueado.' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json', ...cors },
    })
  }

  return {
    user: {
      id: user.id,
      email: user.email,
      role: profile?.role || 'user',
    },
    client: userClient,
  }
}

/**
 * Validates that the authenticated user has one of the allowed roles.
 */
export async function requireRole(
  req: Request,
  allowedRoles: string[],
): Promise<{ user: AuthenticatedUser; client: any }> {
  const { user, client } = await requireUser(req)
  const cors = getCorsHeaders(req)

  const rawRole = (user.role || '').toLowerCase()
  const isMatch = allowedRoles.some((r) => {
    const target = r.toLowerCase()
    if (target === 'admin' || target === 'admin completo') {
      return (
        rawRole === 'admin' ||
        rawRole === 'admin completo' ||
        rawRole === 'administrador' ||
        rawRole.startsWith('admin')
      )
    }
    return rawRole === target || rawRole.includes(target)
  })

  if (!isMatch) {
    throw new Response(JSON.stringify({ error: 'Acesso negado: privilégios insuficientes.' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json', ...cors },
    })
  }

  return { user, client }
}
