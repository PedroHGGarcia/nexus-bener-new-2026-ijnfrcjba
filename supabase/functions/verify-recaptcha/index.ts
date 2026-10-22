import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { getCorsHeaders } from '../_shared/cors.ts'

const SCORE_THRESHOLD = 0.5

Deno.serve(async (req: Request) => {
  const cors = getCorsHeaders(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const { token, action } = await req.json()
    if (!token) {
      return new Response(JSON.stringify({ error: 'Token do captcha não fornecido.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...cors },
      })
    }

    // M10: If action is provided, validate it matches expected authentication/recovery flows
    const ALLOWED_ACTIONS = ['login', 'password_reset', 'recovery']
    if (action && !ALLOWED_ACTIONS.includes(action)) {
      return new Response(JSON.stringify({ error: 'Ação do captcha inválida.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...cors },
      })
    }

    const recaptchaSecret = Deno.env.get('RECAPTCHA_SECRET_KEY')
    const turnstileSecret = Deno.env.get('TURNSTILE_SECRET_KEY')

    if (recaptchaSecret) {
      const resp = await fetch('https://www.google.com/recaptcha/api/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `secret=${recaptchaSecret}&response=${token}`,
      })
      const data = await resp.json()

      if (!data.success) {
        return new Response(JSON.stringify({ error: 'Verificação do reCAPTCHA falhou.' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...cors },
        })
      }

      // For reCAPTCHA v3/enterprise, if the token returned an action and client specified action, verify they match
      if (action && data.action && data.action !== action) {
        return new Response(JSON.stringify({ error: 'Ação do captcha não confere.' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...cors },
        })
      }

      if (typeof data.score === 'number' && data.score < SCORE_THRESHOLD) {
        return new Response(
          JSON.stringify({ error: 'Pontuação do captcha abaixo do limite de segurança.' }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...cors },
          },
        )
      }

      return new Response(JSON.stringify({ data: { success: true } }), {
        headers: {
          'Content-Type': 'application/json',
          Connection: 'keep-alive',
          ...cors,
        },
      })
    }

    if (turnstileSecret) {
      const resp = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret: turnstileSecret, response: token }),
      })
      const data = await resp.json()
      if (!data.success) {
        return new Response(JSON.stringify({ error: 'Verificação do Turnstile falhou.' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...cors },
        })
      }
      return new Response(JSON.stringify({ data: { success: true } }), {
        headers: {
          'Content-Type': 'application/json',
          Connection: 'keep-alive',
          ...cors,
        },
      })
    }

    return new Response(
      JSON.stringify({ error: 'Nenhuma chave secreta de captcha configurada no servidor.' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...cors },
      },
    )
  } catch {
    return new Response(JSON.stringify({ error: 'Erro interno ao verificar captcha.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...cors },
    })
  }
})
