-- Migration: Remove trigger_notify_proposal_created and notify_proposal_created
-- The notification email dispatch is handled cleanly from the frontend callback (EmitirPropostaPage)
-- with the full list of recipients and idempotency safeguards.
-- The database trigger was creating redundant HTTP calls via pg_net to the edge function.

DROP TRIGGER IF EXISTS trigger_notify_proposal_created ON public.propostas;
DROP FUNCTION IF EXISTS public.notify_proposal_created();
