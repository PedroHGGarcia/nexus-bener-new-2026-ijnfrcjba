-- Migration: Ensure all proposal creation email triggers and functions are completely dropped
-- Version: 20260923203000
-- Guarantee that proposal dispatch is handled solely by the frontend application flow.

DO $$
BEGIN
  -- 1. Drop known triggers on propostas if they exist
  DROP TRIGGER IF EXISTS trigger_notify_proposal_created ON public.propostas;
  DROP TRIGGER IF EXISTS trg_proposta_para_n8n ON public.propostas;
  DROP TRIGGER IF EXISTS trg_notify_proposal_email ON public.propostas;
  DROP TRIGGER IF EXISTS notify_proposal_created_trigger ON public.propostas;

  -- 2. Drop functions if they exist
  DROP FUNCTION IF EXISTS public.notify_proposal_created();
  DROP FUNCTION IF EXISTS public.enviar_proposta_teste_para_n8n();
END $$;
