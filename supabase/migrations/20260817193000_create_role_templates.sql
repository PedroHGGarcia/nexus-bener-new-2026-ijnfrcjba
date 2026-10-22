-- Criação da tabela role_templates para perfis customizáveis
CREATE TABLE IF NOT EXISTS public.role_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  menu_access JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_system BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Habilita RLS
ALTER TABLE public.role_templates ENABLE ROW LEVEL SECURITY;

-- SELECT para qualquer authenticated
DROP POLICY IF EXISTS "role_templates_authenticated_select" ON public.role_templates;
CREATE POLICY "role_templates_authenticated_select" ON public.role_templates
  FOR SELECT TO authenticated USING (true);

-- Helper: função para verificar se o usuário atual é Admin Completo
CREATE OR REPLACE FUNCTION public.is_admin_completo()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'Admin Completo'
  );
$$;

-- INSERT/UPDATE/DELETE apenas para Admin Completo
DROP POLICY IF EXISTS "role_templates_admin_insert" ON public.role_templates;
CREATE POLICY "role_templates_admin_insert" ON public.role_templates
  FOR INSERT TO authenticated WITH CHECK (public.is_admin_completo());

DROP POLICY IF EXISTS "role_templates_admin_update" ON public.role_templates;
CREATE POLICY "role_templates_admin_update" ON public.role_templates
  FOR UPDATE TO authenticated USING (public.is_admin_completo()) WITH CHECK (public.is_admin_completo());

DROP POLICY IF EXISTS "role_templates_admin_delete" ON public.role_templates;
CREATE POLICY "role_templates_admin_delete" ON public.role_templates
  FOR DELETE TO authenticated USING (public.is_admin_completo());

-- Trigger update_updated_at (reutiliza função existente; idempotente)
DROP TRIGGER IF EXISTS role_templates_updated_at ON public.role_templates;
CREATE TRIGGER role_templates_updated_at
  BEFORE UPDATE ON public.role_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Seed dos 4 perfis padrão (is_system = true)
INSERT INTO public.role_templates (name, menu_access, is_system) VALUES
  ('Vendedor', '["dashboard","cadastros-clientes","eventos","projetos","propostas-emitir","propostas-criadas","produtos-lista","notificacoes","perfil"]'::jsonb, true),
  ('Gerente', '["dashboard","cadastros-clientes","cadastros-representantes","cadastros-regioes","cadastros-gerentes","cadastros-prepostos","eventos","projetos","propostas-dashboard","propostas-emitir","propostas-criadas","propostas-avancadas","produtos-lista","produtos-dashboard","notificacoes","area-atuacao","perfil"]'::jsonb, true),
  ('Financeiro', '["dashboard","cadastros-clientes","propostas-dashboard","propostas-criadas","notificacoes","perfil"]'::jsonb, true),
  ('Admin Completo', '["dashboard","cadastros-clientes","cadastros-representantes","cadastros-regioes","cadastros-gerentes","cadastros-prepostos","eventos","projetos","propostas-dashboard","propostas-emitir","propostas-criadas","propostas-avancadas","propostas-tipos","produtos-lista","produtos-dashboard","produtos-precos","produtos-categorias","produtos-marcas","produtos-modelos","produtos-versoes","produtos-acessorios","notificacoes","importacoes","area-atuacao","usuarios","auditoria","configuracoes","perfil"]'::jsonb, true)
ON CONFLICT (name) DO NOTHING;

-- Habilita realtime para role_templates
ALTER PUBLICATION supabase_realtime ADD TABLE public.role_templates;
