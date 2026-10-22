-- Ensure authenticated users can read all profiles (needed for creator display)
DROP POLICY IF EXISTS "profiles_authenticated_select_all" ON public.profiles;
CREATE POLICY "profiles_authenticated_select_all" ON public.profiles
  FOR SELECT TO authenticated USING (true);

-- Ensure projetos RLS policies exist
ALTER TABLE public.projetos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "projetos_authenticated_select" ON public.projetos;
CREATE POLICY "projetos_authenticated_select" ON public.projetos
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "projetos_authenticated_insert" ON public.projetos;
CREATE POLICY "projetos_authenticated_insert" ON public.projetos
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "projetos_authenticated_update" ON public.projetos;
CREATE POLICY "projetos_authenticated_update" ON public.projetos
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "projetos_authenticated_delete" ON public.projetos;
CREATE POLICY "projetos_authenticated_delete" ON public.projetos
  FOR DELETE TO authenticated USING (true);
