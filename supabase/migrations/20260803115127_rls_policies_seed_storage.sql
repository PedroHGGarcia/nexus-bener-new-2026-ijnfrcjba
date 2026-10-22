-- is_admin helper function (SECURITY DEFINER to avoid RLS recursion)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'Admin Completo'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Profiles: own row access (recreate existing for idempotency)
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT TO authenticated USING (id = auth.uid());

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

-- Profiles: admin full access
DROP POLICY IF EXISTS "profiles_admin_select" ON public.profiles;
CREATE POLICY "profiles_admin_select" ON public.profiles
  FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "profiles_admin_update" ON public.profiles;
CREATE POLICY "profiles_admin_update" ON public.profiles
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "profiles_admin_delete" ON public.profiles;
CREATE POLICY "profiles_admin_delete" ON public.profiles
  FOR DELETE TO authenticated USING (public.is_admin());

-- Audit logs: authenticated can SELECT and INSERT
DROP POLICY IF EXISTS "audit_logs_select" ON public.audit_logs;
CREATE POLICY "audit_logs_select" ON public.audit_logs
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "audit_logs_insert" ON public.audit_logs;
CREATE POLICY "audit_logs_insert" ON public.audit_logs
  FOR INSERT TO authenticated WITH CHECK (true);

-- Storage buckets for avatars and signatures
INSERT INTO storage.buckets (id, name, public) VALUES
  ('avatars', 'avatars', true),
  ('signatures', 'signatures', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: avatars
DROP POLICY IF EXISTS "storage_avatars_select" ON storage.objects;
CREATE POLICY "storage_avatars_select" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "storage_avatars_insert" ON storage.objects;
CREATE POLICY "storage_avatars_insert" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'avatars');

DROP POLICY IF EXISTS "storage_avatars_update" ON storage.objects;
CREATE POLICY "storage_avatars_update" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'avatars');

-- Storage policies: signatures
DROP POLICY IF EXISTS "storage_signatures_select" ON storage.objects;
CREATE POLICY "storage_signatures_select" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'signatures');

DROP POLICY IF EXISTS "storage_signatures_insert" ON storage.objects;
CREATE POLICY "storage_signatures_insert" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'signatures');

DROP POLICY IF EXISTS "storage_signatures_update" ON storage.objects;
CREATE POLICY "storage_signatures_update" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'signatures');

-- Update seed admin user profile with full admin role and menu access
UPDATE public.profiles SET
  role = 'Admin Completo',
  status = 'Ativo',
  menu_access = '["dashboard","cadastros-clientes","cadastros-representantes","cadastros-regioes","cadastros-gerentes","cadastros-prepostos","eventos","projetos","propostas-dashboard","propostas-emitir","propostas-criadas","propostas-avancadas","propostas-tipos","produtos-lista","produtos-dashboard","produtos-precos","produtos-categorias","produtos-marcas","produtos-modelos","produtos-versoes","produtos-acessorios","notificacoes","importacoes","area-atuacao","usuarios","auditoria","configuracoes","perfil"]'::jsonb
WHERE email = 'bianca@bener.com.br';
