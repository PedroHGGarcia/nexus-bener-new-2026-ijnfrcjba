import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { getCorsHeaders } from '../_shared/cors.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { requireUser } from '../_shared/auth.ts'

interface CriticalActionPayload {
  titulo?: string
  mensagem?: string
  tipo?: string
  actor_name?: string
  table_name?: string
  action?: string
  item_name?: string
}

Deno.serve(async (req: Request) => {
  const cors = getCorsHeaders(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  // C5: require JWT or internal service secret
  const internalSecret = Deno.env.get('INTERNAL_SERVICE_SECRET')
  const incomingSecret = req.headers.get('x-internal-service-secret')

  if (!internalSecret || incomingSecret !== internalSecret) {
    try {
      await requireUser(req)
    } catch (authResp) {
      if (authResp instanceof Response) return authResp
      return new Response(JSON.stringify({ error: 'Autenticação necessária.' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...cors },
      })
    }
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const N8N_CRITICAL_ACTION_WEBHOOK_URL =
      Deno.env.get('N8N_CRITICAL_ACTION_WEBHOOK_URL') || Deno.env.get('N8N_WEBHOOK_URL') || ''

    const payload: CriticalActionPayload = await req.json()
    const titulo = payload.titulo || 'Ação Crítica Detectada'

    if (!payload.mensagem) {
      return new Response(JSON.stringify({ error: 'mensagem é obrigatório.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...cors },
      })
    }

    const adminClient = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // Chave de deduplicação: mesma ação crítica (mensagem + actor + tabela + action + item)
    // dentro de 2 minutos não dispara novamente o webhook n8n.
    const dedupKey = [
      payload.mensagem || '',
      payload.actor_name || '',
      payload.table_name || '',
      payload.action || '',
      payload.item_name || '',
    ].join('||')

    // Idempotency: skip if n8n webhook was already successfully triggered for this
    // critical action within the last 2 minutes.
    const { data: recentAudits } = await adminClient
      .from('audit_logs')
      .select('id, data_changes, created_at')
      .eq('action', 'CRITICAL_ACTION_EMAIL_SENT')
      .order('created_at', { ascending: false })
      .limit(10)

    if (recentAudits && recentAudits.length > 0) {
      for (const audit of recentAudits) {
        const changes = audit.data_changes as Record<string, unknown> | null
        if (changes?.webhook_success === true && changes?.dedup_key === dedupKey) {
          const ageMs = Date.now() - new Date(audit.created_at).getTime()
          if (ageMs < 120000) {
            const recentRecipients = (changes.recipients as string[]) || []
            return new Response(
              JSON.stringify({
                data: {
                  sent: true,
                  skipped: true,
                  webhook_success: true,
                  message: 'Webhook n8n disparado recentemente para esta ação crítica.',
                  count: 0,
                  recipients: recentRecipients,
                },
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
        }
      }
    }

    // Destinatário configurado via secret CRITICAL_ACTION_RECIPIENTS ou fallback seguro
    const envRecipients = Deno.env.get('CRITICAL_ACTION_RECIPIENTS')
    const recipients = envRecipients
      ? envRecipients
          .split(',')
          .map((e) => e.trim())
          .filter(Boolean)
      : ['pedro.garcia@bener.com.br']

    // Monta o payload enviado ao webhook n8n
    const webhookPayload = {
      titulo,
      mensagem: payload.mensagem,
      tipo: payload.tipo || 'critical_action',
      actor_name: payload.actor_name || 'Sistema',
      table_name: payload.table_name || '',
      action: payload.action || '',
      item_name: payload.item_name || '',
      recipients,
    }

    let webhookSuccess = false
    let webhookMessage = ''

    if (N8N_CRITICAL_ACTION_WEBHOOK_URL) {
      try {
        const res = await fetch(N8N_CRITICAL_ACTION_WEBHOOK_URL, {
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
      }
    } else {
      webhookMessage =
        'N8N_CRITICAL_ACTION_WEBHOOK_URL (ou N8N_WEBHOOK_URL) não configurada em Supabase Secrets.'
    }

    const status = webhookSuccess ? 'success' : 'failed'

    // Registra auditoria do disparo (não bloqueante)
    try {
      await adminClient.from('audit_logs').insert({
        action: 'CRITICAL_ACTION_EMAIL_SENT',
        table_name: payload.table_name || 'notificacoes',
        data_changes: {
          titulo,
          mensagem: payload.mensagem,
          tipo: payload.tipo,
          actor_name: payload.actor_name,
          table_name: payload.table_name,
          action: payload.action,
          item_name: payload.item_name,
          dedup_key: dedupKey,
          recipients,
          dispatch_method: 'n8n_webhook',
          webhook_url: N8N_CRITICAL_ACTION_WEBHOOK_URL,
          webhook_called: Boolean(N8N_CRITICAL_ACTION_WEBHOOK_URL),
          webhook_success: webhookSuccess,
          webhook_message: webhookMessage,
          admins_targeted: recipients.length,
          status,
        },
        user_name: payload.actor_name || 'Sistema (Trigger)',
      })
    } catch (auditErr) {
      console.error(
        '[notify-critical-action-email] audit insert failed:',
        auditErr instanceof Error ? auditErr.message : String(auditErr),
      )
    }

    return new Response(
      JSON.stringify({
        data: {
          sent: webhookSuccess,
          status,
          webhook_called: Boolean(N8N_CRITICAL_ACTION_WEBHOOK_URL),
          webhook_success: webhookSuccess,
          webhook_message: webhookMessage,
          message: webhookMessage,
          count: recipients.length,
          recipients,
        },
      }),
      { headers: { 'Content-Type': 'application/json', Connection: 'keep-alive', ...cors } },
    )
  } catch (err) {
    console.error('[notify-critical-action-email] fatal:', err)
    return new Response(
      JSON.stringify({ error: 'Erro ao processar notificação de ação crítica.' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...cors },
      },
    )
  }
})
