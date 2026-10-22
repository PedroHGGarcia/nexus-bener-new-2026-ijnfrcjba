-- Migration: create proposta_email_envios table for persistent dispatch auditing
-- Allows diagnosing webhook/email dispatch without relying on runtime logs.

CREATE TABLE IF NOT EXISTS public.proposta_email_envios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposta_id uuid REFERENCES public.propostas(id) ON DELETE CASCADE,
  destinatarios text,
  assunto text,
  webhook_url text,
  http_status int,
  ok boolean,
  resposta text,
  criado_em timestamptz DEFAULT now()
);

-- Indexes for fast query by proposta_id and dispatch timeline
CREATE INDEX IF NOT EXISTS idx_proposta_email_envios_proposta_id ON public.proposta_email_envios(proposta_id);
CREATE INDEX IF NOT EXISTS idx_proposta_email_envios_criado_em ON public.proposta_email_envios(criado_em DESC);

-- Enable RLS
ALTER TABLE public.proposta_email_envios ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS by default in Supabase, but explicit policy guarantees access
-- Authenticated admins (or authenticated users) can read the dispatch history
DROP POLICY IF EXISTS "proposta_email_envios_service_all" ON public.proposta_email_envios;
CREATE POLICY "proposta_email_envios_service_all" ON public.proposta_email_envios
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "proposta_email_envios_admin_select" ON public.proposta_email_envios;
CREATE POLICY "proposta_email_envios_admin_select" ON public.proposta_email_envios
  FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR public.is_admin_completo()
    OR EXISTS (
      SELECT 1 FROM public.propostas p
      WHERE p.id = proposta_email_envios.proposta_id
    )
  );

DROP POLICY IF EXISTS "proposta_email_envios_auth_insert" ON public.proposta_email_envios;
CREATE POLICY "proposta_email_envios_auth_insert" ON public.proposta_email_envios
  FOR INSERT
  TO authenticated
  WITH CHECK (true);
