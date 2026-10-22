-- Drop duplicate legacy trigger trg_proposta_para_n8n that caused double notifications
-- The trigger was firing net.http_post directly to n8n webhook, causing duplicate email
-- delivery and only sending to whichever single recipient n8n extracted, while the application
-- edge function `send-proposal-email` handles multi-recipient dispatch, audit logs, and status events.

DROP TRIGGER IF EXISTS trg_proposta_para_n8n ON public.propostas;
DROP FUNCTION IF EXISTS public.enviar_proposta_teste_para_n8n();
