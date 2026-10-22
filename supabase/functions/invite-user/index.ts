import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { sendEmail } from '../_shared/resend.ts'

function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%'
  let pwd = ''
  for (let i = 0; i < 12; i++) {
    pwd += chars[Math.floor(Math.random() * chars.length)]
  }
  return pwd
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const { email, role, name } = await req.json()
    if (!email || !role || !name) {
      return new Response(JSON.stringify({ error: 'Email, nome e perfil sao obrigatorios.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    const adminClient = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const tempPassword = generateTempPassword()

    const { data: userData, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { name, role },
    })

    if (createError) {
      return new Response(JSON.stringify({ error: createError.message }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    await adminClient.from('profiles').upsert(
      {
        id: userData.user.id,
        name,
        email,
        role,
        status: 'Ativo',
      },
      { onConflict: 'id' },
    )

    const resendKey = Deno.env.get('RESEND_API_KEY')
    if (resendKey) {
      await sendEmail(
        resendKey,
        email,
        'Bem-vindo ao Bener Extranet',
        `<p>Ola <strong>${name}</strong>,</p><p>Sua conta foi criada no sistema Bener Extranet.</p><p>Senha temporaria: <strong>${tempPassword}</strong></p><p>Acesse o sistema e altere sua senha.</p>`,
      )
    }

    await adminClient.from('audit_logs').insert({
      action: 'INVITE_USER',
      table_name: 'profiles',
      record_id: userData.user.id,
      data_changes: { name, email, role },
      user_name: email,
    })

    return new Response(JSON.stringify({ data: { id: userData.user.id, email } }), {
      headers: { 'Content-Type': 'application/json', Connection: 'keep-alive', ...corsHeaders },
    })
  } catch {
    return new Response(JSON.stringify({ error: 'Erro interno ao convidar usuario.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }
})
