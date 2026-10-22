import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { getCorsHeaders } from '../_shared/cors.ts'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Callback endpoint that n8n calls AFTER it attempts to send the proposal
 * email. It records the delivery outcome in audit_logs (action
 * PROPOSAL_EMAIL_SENT) so the Bener Nexus audit trail reflects whether the
 * email was actually sent by n8n.
 *
 * Request body (JSON):
 *   {
 *     "proposta_id": "<uuid>",
 *     "status": "sent" | "failed",
 *     "message": "optional detail (provider id, error, etc.)",
 *     "provider_message_id": "optional",
 *     "recipients": ["..."]   // optional
 *   }
 *
 * Optionally accepts an `x-callback-token` header matching the
 * N8N_CALLBACK_TOKEN secret, when that secret is configured.
 */
Deno.serve(async (req: Request) => {
  const cors = getCorsHeaders(req)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed. Use POST.' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', ...cors },
    })
  }

  try {
    // M7: Mandatory N8N_CALLBACK_TOKEN secret protection
    const expectedToken = Deno.env.get('N8N_CALLBACK_TOKEN')
    if (!expectedToken) {
      console.error('[confirm-email-delivery] N8N_CALLBACK_TOKEN secret missing on server')
      return new Response(
        JSON.stringify({
          error: 'Servidor não configurado para aceitar callbacks (secret ausente).',
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...cors },
        },
      )
    }

    const sentToken = req.headers.get('x-callback-token')
    if (!sentToken || sentToken !== expectedToken) {
      return new Response(JSON.stringify({ error: 'Token de callback inválido ou ausente.' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...cors },
      })
    }

    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return new Response(
        JSON.stringify({ error: 'Corpo da requisição inválido (JSON esperado).' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...cors },
        },
      )
    }

    const { proposta_id, status, message, provider_message_id, recipients } = body as {
      proposta_id?: string
      status?: string
      message?: string
      provider_message_id?: string
      recipients?: string[]
    }

    if (!proposta_id || !UUID_REGEX.test(proposta_id)) {
      return new Response(JSON.stringify({ error: 'proposta_id inválido ou ausente.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...cors },
      })
    }

    const normalizedStatus = status === 'sent' ? 'sent' : status === 'failed' ? 'failed' : 'failed'
    const success = normalizedStatus === 'sent'

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // Fetch the proposal for context (best-effort)
    const { data: proposal } = await adminClient
      .from('propostas')
      .select('numero_proposta, cliente_original, valor_final, moeda')
      .eq('id', proposta_id)
      .maybeSingle()

    const numeroProposta = proposal?.numero_proposta || proposta_id
    const clienteNome = proposal?.cliente_original || null
    const valorFinal = proposal?.valor_final ?? null
    const moeda = proposal?.moeda || null

    // Insert an audit log entry recording the n8n delivery outcome
    const { error: insertError } = await adminClient.from('audit_logs').insert({
      action: 'PROPOSAL_EMAIL_SENT',
      table_name: 'propostas',
      record_id: proposta_id,
      user_name: 'n8n (confirmação de envio)',
      data_changes: {
        source: 'n8n_callback',
        status: normalizedStatus,
        delivered: success,
        message: message ?? null,
        provider_message_id: provider_message_id ?? null,
        recipients: Array.isArray(recipients) ? recipients : [],
        numero_proposta: numeroProposta,
        cliente_nome: clienteNome,
        valor_final: valorFinal,
        moeda,
        confirmed_at: new Date().toISOString(),
      },
    })

    if (insertError) {
      return new Response(
        JSON.stringify({
          error: 'Falha ao registrar confirmação de envio.',
          detail: insertError.message,
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...cors },
        },
      )
    }

    return new Response(
      JSON.stringify({
        success: true,
        proposta_id,
        status: normalizedStatus,
        message: `Confirmação de ${normalizedStatus === 'sent' ? 'envio' : 'falha'} registrada no audit_logs.`,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', Connection: 'keep-alive', ...cors },
      },
    )
  } catch (err) {
    console.error('confirm-email-delivery error:', err)
    return new Response(JSON.stringify({ error: 'Erro ao processar confirmação de envio.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...cors },
    })
  }
})
