-- Migration to fix critical RLS security vulnerabilities on the propostas table
-- 1. Drop propostas_anon_update which allowed unauthenticated updates to any proposal
-- 2. Drop propostas_authenticated_all which gave blanket ALL permissions to all authenticated users
-- 3. Add properly scoped policies: SELECT/INSERT for authenticated, UPDATE/DELETE for admins only

-- Step 1: Drop anon update policy
DROP POLICY IF EXISTS propostas_anon_update ON public.propostas;

-- Step 2: Drop overly permissive authenticated ALL policy
DROP POLICY IF EXISTS propostas_authenticated_all ON public.propostas;

-- Step 3: Create separate, properly-scoped policies
DROP POLICY IF EXISTS propostas_authenticated_select ON public.propostas;
CREATE POLICY propostas_authenticated_select ON public.propostas
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS propostas_authenticated_insert ON public.propostas;
CREATE POLICY propostas_authenticated_insert ON public.propostas
  FOR INSERT TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS propostas_authenticated_update ON public.propostas;
CREATE POLICY propostas_authenticated_update ON public.propostas
  FOR UPDATE TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS propostas_authenticated_delete ON public.propostas;
CREATE POLICY propostas_authenticated_delete ON public.propostas
  FOR DELETE TO authenticated
  USING (is_admin());
