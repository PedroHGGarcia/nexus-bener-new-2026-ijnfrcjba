-- Migration: Filtrar propostas por representante usando o vínculo via gerente
-- 1. Drop existing authenticated SELECT policies on propostas
-- 2. Create new propostas_authenticated_select allowing:
--    - Admins (is_admin()) to see all proposals
--    - Authenticated users with profiles.gerente_id matching propostas.gerente to see their manager's proposals
-- 3. Maintain existing INSERT, UPDATE, DELETE and anon SELECT policies

DROP POLICY IF EXISTS "propostas_authenticated_select_licitacao" ON public.propostas;
DROP POLICY IF EXISTS "propostas_authenticated_select" ON public.propostas;

CREATE POLICY "propostas_authenticated_select" ON public.propostas
  FOR SELECT
  TO authenticated
  USING (
    is_admin()
    OR gerente = (SELECT gerente_id FROM public.profiles WHERE id = auth.uid())
  );

-- Garantir que as demais políticas continuem válidas e idempotentes
DROP POLICY IF EXISTS "propostas_authenticated_insert" ON public.propostas;
CREATE POLICY "propostas_authenticated_insert" ON public.propostas
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "propostas_authenticated_update" ON public.propostas;
CREATE POLICY "propostas_authenticated_update" ON public.propostas
  FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "propostas_authenticated_delete" ON public.propostas;
CREATE POLICY "propostas_authenticated_delete" ON public.propostas
  FOR DELETE
  TO authenticated
  USING (is_admin());

-- Anon select policy mantida para visualização pública (/visualizar-proposta/:id)
DROP POLICY IF EXISTS "propostas_anon_select" ON public.propostas;
CREATE POLICY "propostas_anon_select" ON public.propostas
  FOR SELECT
  TO anon
  USING (true);
