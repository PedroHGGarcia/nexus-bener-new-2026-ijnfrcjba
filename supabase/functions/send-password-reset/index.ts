import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { getCorsHeaders } from '../_shared/cors.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'

interface PasswordResetRequest {
  action?: 'request' | 'verify' | 'reset'
  email?: string
  token?: string
  newPassword?: string
}

async function sha256Hex(plain: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(plain)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

Deno.serve(async (req: Request) => {
  const cors = getCorsHeaders(req)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors })
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const N8N_PASSWORD_RESET_WEBHOOK_URL =
      Deno.env.get('N8N_PASSWORD_RESET_WEBHOOK_URL') ||
      Deno.env.get('N8N_RESEND_EMAIL_WEBHOOK_URL') ||
      Deno.env.get('N8N_CRITICAL_ACTION_WEBHOOK_URL') ||
      Deno.env.get('N8N_WEBHOOK_URL')

    if (!SUPABASE_URL || !SERVICE_KEY) {
      console.error('[send-password-reset] Supabase configuration missing')
      return new Response(
        JSON.stringify({ success: false, error: 'Configuração do servidor incompleta.' }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...cors },
        },
      )
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const body: PasswordResetRequest = await req.json().catch(() => ({}))
    const action =
      body.action || (body.token && body.newPassword ? 'reset' : body.token ? 'verify' : 'request')

    // ==========================================
    // ACTION: VERIFY TOKEN
    // ==========================================
    if (action === 'verify') {
      const rawToken = body.token?.trim()
      if (!rawToken) {
        return new Response(JSON.stringify({ valid: false, error: 'Token não fornecido.' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...cors },
        })
      }

      const tokenHash = await sha256Hex(rawToken)

      const { data: record, error: tokenErr } = await supabaseAdmin
        .from('password_reset_tokens')
        .select('*')
        .eq('token', tokenHash)
        .maybeSingle()

      if (tokenErr || !record) {
        return new Response(
          JSON.stringify({
            valid: false,
            error: 'Link de recuperação inválido ou não encontrado.',
          }),
          {
            status: 404,
            headers: { 'Content-Type': 'application/json', ...cors },
          },
        )
      }

      if (record.used_at) {
        return new Response(
          JSON.stringify({ valid: false, error: 'Este link de recuperação já foi utilizado.' }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...cors },
          },
        )
      }

      const now = new Date()
      const expiresAt = new Date(record.expires_at)
      if (now > expiresAt) {
        return new Response(
          JSON.stringify({
            valid: false,
            error: 'Este link de recuperação expirou (validade de 15 minutos).',
          }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...cors },
          },
        )
      }

      return new Response(
        JSON.stringify({ valid: true, email: record.email, userId: record.user_id }),
        {
          headers: { 'Content-Type': 'application/json', ...cors },
        },
      )
    }

    // ==========================================
    // ACTION: RESET PASSWORD WITH TOKEN
    // ==========================================
    if (action === 'reset') {
      const rawToken = body.token?.trim()
      const newPassword = body.newPassword

      if (!rawToken || !newPassword) {
        return new Response(
          JSON.stringify({ success: false, error: 'Token e nova senha são obrigatórios.' }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...cors },
          },
        )
      }

      // Strong password validation: 8+ chars, 1 uppercase, 1 special char
      const hasMinLength = newPassword.length >= 8
      const hasUppercase = /[A-Z]/.test(newPassword)
      const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(newPassword)

      if (!hasMinLength || !hasUppercase || !hasSpecial) {
        return new Response(
          JSON.stringify({
            success: false,
            error:
              'A senha deve ter no mínimo 8 caracteres, pelo menos 1 letra maiúscula e 1 caractere especial.',
          }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...cors },
          },
        )
      }

      const tokenHash = await sha256Hex(rawToken)

      // Find and validate token by hash
      const { data: record, error: tokenErr } = await supabaseAdmin
        .from('password_reset_tokens')
        .select('*')
        .eq('token', tokenHash)
        .maybeSingle()

      if (tokenErr || !record) {
        return new Response(
          JSON.stringify({ success: false, error: 'Link de recuperação inválido.' }),
          {
            status: 404,
            headers: { 'Content-Type': 'application/json', ...cors },
          },
        )
      }

      if (record.used_at) {
        return new Response(
          JSON.stringify({ success: false, error: 'Este link de recuperação já foi utilizado.' }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...cors },
          },
        )
      }

      const now = new Date()
      const expiresAt = new Date(record.expires_at)
      if (now > expiresAt) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Este link de recuperação expirou (validade de 15 minutos).',
          }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...cors },
          },
        )
      }

      // Update password using Supabase Auth Admin API
      const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(record.user_id, {
        password: newPassword,
      })

      if (updateErr) {
        console.error('[send-password-reset] Erro ao atualizar senha via admin API:', updateErr)
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Erro ao redefinir a senha. Tente novamente mais tarde.',
          }),
          {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...cors },
          },
        )
      }

      // Mark token as used
      await supabaseAdmin
        .from('password_reset_tokens')
        .update({ used_at: now.toISOString() })
        .eq('id', record.id)

      // Audit log
      try {
        await supabaseAdmin.from('audit_logs').insert({
          action: 'PASSWORD_RESET_COMPLETED',
          table_name: 'auth.users',
          user_id: record.user_id,
          user_name: record.email,
          data_changes: {
            email: record.email,
            method: 'sha256_hashed_token_15m',
            completed_at: now.toISOString(),
          },
        })
      } catch (auditErr) {
        console.warn('[send-password-reset] audit log failed:', auditErr)
      }

      return new Response(
        JSON.stringify({ success: true, message: 'Senha redefinida com sucesso!' }),
        {
          headers: { 'Content-Type': 'application/json', ...cors },
        },
      )
    }

    // ==========================================
    // ACTION: REQUEST PASSWORD RESET
    // ==========================================
    const email = body.email?.trim().toLowerCase()
    if (!email) {
      return new Response(JSON.stringify({ success: false, error: 'E-mail é obrigatório.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...cors },
      })
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return new Response(JSON.stringify({ success: false, error: 'E-mail inválido.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...cors },
      })
    }

    let foundUserId: string | null = null
    try {
      const { data: usersData, error: listUsersError } = await supabaseAdmin.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      })

      if (!listUsersError && usersData?.users) {
        const found = usersData.users.find((u) => u.email?.trim().toLowerCase() === email)
        if (found) {
          foundUserId = found.id
        }
      }
    } catch (checkErr) {
      console.warn('[send-password-reset] Falha na verificação de existência do usuário:', checkErr)
    }

    // If user does not exist, return generic success without generating link or triggering webhook
    if (!foundUserId) {
      return new Response(
        JSON.stringify({
          success: true,
          message:
            'Se o e-mail estiver cadastrado, você receberá o link de recuperação em instantes.',
        }),
        {
          headers: {
            'Content-Type': 'application/json',
            Connection: 'keep-alive',
            ...cors,
          },
        },
      )
    }

    // Generate secure random raw token (hex)
    const tokenBytes = new Uint8Array(32)
    crypto.getRandomValues(tokenBytes)
    const rawToken = Array.from(tokenBytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')

    // Compute SHA-256 to store in the database
    const tokenHash = await sha256Hex(rawToken)

    const now = new Date()
    const expiresAt = new Date(now.getTime() + 15 * 60 * 1000)

    // Invalidate previous unused tokens for this user
    await supabaseAdmin
      .from('password_reset_tokens')
      .update({ used_at: now.toISOString() })
      .eq('user_id', foundUserId)
      .is('used_at', null)

    // Save ONLY the hash in DB
    const { error: tokenInsertErr } = await supabaseAdmin.from('password_reset_tokens').insert({
      token: tokenHash,
      user_id: foundUserId,
      email,
      created_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
    })

    if (tokenInsertErr) {
      console.error('[send-password-reset] Erro ao salvar token:', tokenInsertErr)
      return new Response(
        JSON.stringify({ success: false, error: 'Erro ao gerar link de recuperação.' }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...cors },
        },
      )
    }

    // FIXED ALLOWLIST of origins (Security A1: ignore attacker appBaseUrl)
    const reqOrigin = req.headers.get('origin') || ''
    const reqReferer = req.headers.get('referer') || ''
    let refererOrigin = ''
    try {
      if (reqReferer) {
        refererOrigin = new URL(reqReferer).origin
      }
    } catch {
      // invalid referer url
    }

    const checkOrigin = reqOrigin || refererOrigin
    const isAllowedOrigin =
      checkOrigin === 'https://nexus.bener.com.br' ||
      /^https:\/\/.*\.goskip\.app$/.test(checkOrigin) ||
      /^http:\/\/localhost(:\d+)?$/.test(checkOrigin) ||
      /^http:\/\/127\.0\.0\.1(:\d+)?$/.test(checkOrigin)

    const baseOrigin = isAllowedOrigin ? checkOrigin : 'https://nexus.bener.com.br'
    const friendlyRecoveryLink = `${baseOrigin}/redefinir-senha?token=${rawToken}`

    // Payload for n8n webhook: DO NOT include raw token alone, only recovery_link
    const webhookPayload = {
      action: 'password_reset',
      email,
      recovery_link: friendlyRecoveryLink,
      expires_in_minutes: 15,
      expires_at: expiresAt.toISOString(),
      created_at: now.toISOString(),
      subject: 'Recuperação de Senha — Bener Nexus',
      recipients: [email],
    }

    let webhookSuccess = false
    let webhookMessage = ''

    if (N8N_PASSWORD_RESET_WEBHOOK_URL) {
      try {
        const res = await fetch(N8N_PASSWORD_RESET_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(webhookPayload),
        })
        webhookSuccess = res.ok
        webhookMessage = res.ok
          ? 'Webhook n8n disparado com sucesso.'
          : `Status ${res.status} ao chamar webhook n8n.`
      } catch (whErr) {
        webhookMessage = whErr instanceof Error ? whErr.message : 'Erro na chamada ao webhook n8n.'
        console.error('[send-password-reset] webhook error:', webhookMessage)
      }
    } else {
      // Fallback: try direct Supabase auth reset link if webhook not configured
      try {
        const { error: resetErr } = await supabaseAdmin.auth.admin.generateLink({
          type: 'recovery',
          email,
          options: {
            redirectTo: `${baseOrigin}/redefinir-senha`,
          },
        })
        if (!resetErr) {
          webhookSuccess = true
          webhookMessage = 'Link de recuperação gerado com sucesso via Supabase Auth.'
        } else {
          webhookMessage = `Supabase reset link error: ${resetErr.message}`
        }
      } catch (genErr) {
        webhookMessage =
          genErr instanceof Error ? genErr.message : 'Erro ao gerar link de recuperação.'
      }
    }

    // Audit log
    try {
      await supabaseAdmin.from('audit_logs').insert({
        action: 'PASSWORD_RESET_REQUESTED',
        table_name: 'auth.users',
        user_id: foundUserId,
        user_name: email,
        data_changes: {
          email,
          dispatch_method: 'n8n_webhook',
          webhook_called: true,
          webhook_success: webhookSuccess,
          webhook_message: webhookMessage,
          expires_at: expiresAt.toISOString(),
          status: webhookSuccess ? 'success' : 'webhook_failed',
        },
      })
    } catch (auditErr) {
      console.error('[send-password-reset] audit insert failed:', auditErr)
    }

    return new Response(
      JSON.stringify({
        success: true,
        webhook_success: webhookSuccess,
        message:
          'Se o e-mail estiver cadastrado, você receberá o link de recuperação em instantes.',
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          Connection: 'keep-alive',
          ...cors,
        },
      },
    )
  } catch (err) {
    const cors = getCorsHeaders(req)
    console.error('[send-password-reset] fatal:', err)
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Não foi possível processar a solicitação. Tente novamente ou contate o suporte.',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...cors },
      },
    )
  }
})
