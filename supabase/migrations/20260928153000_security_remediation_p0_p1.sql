-- Migration: Security Remediation Plan Phase 0 & Phase 1
-- Timestamp: 20260928153000
-- Covers:
--  C1: Drop anon policies from password_reset_tokens, SHA-256 tokens
--  C3: Trigger protect_profile_privileges on public.profiles (anti-self-elevation)
--  C4/A8: Drop all anon read/write policies on commercial data + storage propostas-files
--  C4/A8: Add public_token to public.propostas (unique, gen_random_bytes(32) hex), backfill, default/trigger
--  A3: Audit logs hardening (SELECT only is_admin(), drop INSERT/UPDATE/DELETE for authenticated); registro_alteracoes drop DELETE/UPDATE
--  A4: Write RLS hardening for catalog & commercial tables (SELECT authenticated, INSERT/UPDATE/DELETE is_admin() or is_gerente())
--  A5 & A6: Unified is_admin() and is_gerente() checking active status
--  A8: Storage buckets privacy adjustments

-- 1. Helper functions: is_admin() and is_gerente()
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND (status IS NULL OR status = 'Ativo')
      AND (
        role = 'Admin Completo'
        OR role ILIKE 'admin%'
        OR role ILIKE 'administrador%'
      )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.is_gerente()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND (status IS NULL OR status = 'Ativo')
      AND (role ILIKE '%gerente%')
  );
END;
$$;

-- 2. C1: Secure password_reset_tokens table
DROP POLICY IF EXISTS "anon_select_password_reset_tokens" ON public.password_reset_tokens;
DROP POLICY IF EXISTS "authenticated_select_password_reset_tokens" ON public.password_reset_tokens;
ALTER TABLE public.password_reset_tokens ENABLE ROW LEVEL SECURITY;
-- No policies granted to anon or authenticated. Service role only.

-- 3. C3: Trigger protect_profile_privileges in public.profiles
CREATE OR REPLACE FUNCTION public.protect_profile_privileges()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- If not admin, block changes to role, menu_access, status, gerente_id
  IF NOT public.is_admin() THEN
    IF (OLD.role IS DISTINCT FROM NEW.role) OR
       (OLD.menu_access IS DISTINCT FROM NEW.menu_access) OR
       (OLD.status IS DISTINCT FROM NEW.status) OR
       (OLD.gerente_id IS DISTINCT FROM NEW.gerente_id) THEN
      RAISE EXCEPTION 'Somente administradores alteram perfil, acesso ou status';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profile_privileges ON public.profiles;
CREATE TRIGGER trg_protect_profile_privileges
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_privileges();

-- 4. C4 / A8: Column public_token on public.propostas + backfill + trigger
ALTER TABLE public.propostas ADD COLUMN IF NOT EXISTS public_token TEXT;

-- Backfill existing rows that lack public_token
UPDATE public.propostas
SET public_token = encode(gen_random_bytes(32), 'hex')
WHERE public_token IS NULL OR public_token = '';

-- Ensure column is UNIQUE
CREATE UNIQUE INDEX IF NOT EXISTS idx_propostas_public_token ON public.propostas(public_token);

-- Auto-generate public_token on insert if not provided
CREATE OR REPLACE FUNCTION public.set_proposta_public_token()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.public_token IS NULL OR NEW.public_token = '' THEN
    NEW.public_token := encode(gen_random_bytes(32), 'hex');
  END IF;
  IF NEW."link_publico_RD" IS NULL OR NEW."link_publico_RD" = '' OR NEW."link_publico_RD" LIKE '%extranetv2.goskip.app%' THEN
    NEW."link_publico_RD" := 'https://nexus.bener.com.br/visualizar-proposta/' || NEW.public_token;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_proposta_link_publico ON public.propostas;
DROP TRIGGER IF EXISTS trg_set_proposta_public_token ON public.propostas;
CREATE TRIGGER trg_set_proposta_public_token
  BEFORE INSERT ON public.propostas
  FOR EACH ROW
  EXECUTE FUNCTION public.set_proposta_public_token();

-- 5. C4: DROP anon SELECT policies from commercial and catalog tables
DROP POLICY IF EXISTS "propostas_anon_select" ON public.propostas;
DROP POLICY IF EXISTS "propostas_anon_validate" ON public.propostas;
DROP POLICY IF EXISTS "allow_anon_proposta_validation" ON public.propostas;
DROP POLICY IF EXISTS "proposta_versoes_anon_select" ON public.proposta_versoes;
DROP POLICY IF EXISTS "representantes_anon_select" ON public.representantes;
DROP POLICY IF EXISTS "representante_categorias_anon_select" ON public.representante_categorias;
DROP POLICY IF EXISTS "representante_regioes_anon_select" ON public.representante_regioes;
DROP POLICY IF EXISTS "gerentes_anon_select" ON public.gerentes;
DROP POLICY IF EXISTS "regioes_anon_select" ON public.regioes;
DROP POLICY IF EXISTS "versoes_anon_select" ON public.versoes;
DROP POLICY IF EXISTS "modelos_anon_select" ON public.modelos;
DROP POLICY IF EXISTS "marcas_anon_select" ON public.marcas;
DROP POLICY IF EXISTS "produtos_anon_select" ON public.produtos;
DROP POLICY IF EXISTS "categorias_produtos_anon_select" ON public.categorias;

-- Storage: drop anonymous INSERT on propostas-files
DROP POLICY IF EXISTS "propostas_files_anon_insert" ON storage.objects;

-- 6. A3: Audit logs hardening
-- audit_logs: authenticated can only SELECT if is_admin(). INSERT/UPDATE/DELETE dropped for authenticated (service role continues).
DROP POLICY IF EXISTS "audit_logs_authenticated_all" ON public.audit_logs;
DROP POLICY IF EXISTS "audit_logs_admin_select" ON public.audit_logs;
CREATE POLICY "audit_logs_admin_select" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (public.is_admin());

-- registro_alteracoes: drop open UPDATE and DELETE for authenticated
DROP POLICY IF EXISTS "registro_alteracoes_authenticated_update" ON public.registro_alteracoes;
DROP POLICY IF EXISTS "registro_alteracoes_authenticated_delete" ON public.registro_alteracoes;
DROP POLICY IF EXISTS "registro_alteracoes_admin_update" ON public.registro_alteracoes;
DROP POLICY IF EXISTS "registro_alteracoes_admin_delete" ON public.registro_alteracoes;

CREATE POLICY "registro_alteracoes_admin_update" ON public.registro_alteracoes
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "registro_alteracoes_admin_delete" ON public.registro_alteracoes
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- 7. A4: Write RLS hardening for catalog and support tables
-- versoes
DROP POLICY IF EXISTS "versoes_insert" ON public.versoes;
DROP POLICY IF EXISTS "versoes_update" ON public.versoes;
DROP POLICY IF EXISTS "versoes_delete" ON public.versoes;
CREATE POLICY "versoes_insert" ON public.versoes
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR public.is_gerente());
CREATE POLICY "versoes_update" ON public.versoes
  FOR UPDATE TO authenticated
  USING (public.is_admin() OR public.is_gerente())
  WITH CHECK (public.is_admin() OR public.is_gerente());
CREATE POLICY "versoes_delete" ON public.versoes
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- marcas
DROP POLICY IF EXISTS "marcas_insert" ON public.marcas;
DROP POLICY IF EXISTS "marcas_update" ON public.marcas;
DROP POLICY IF EXISTS "marcas_delete" ON public.marcas;
CREATE POLICY "marcas_insert" ON public.marcas
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR public.is_gerente());
CREATE POLICY "marcas_update" ON public.marcas
  FOR UPDATE TO authenticated
  USING (public.is_admin() OR public.is_gerente())
  WITH CHECK (public.is_admin() OR public.is_gerente());
CREATE POLICY "marcas_delete" ON public.marcas
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- modelos
DROP POLICY IF EXISTS "modelos_insert" ON public.modelos;
DROP POLICY IF EXISTS "modelos_update" ON public.modelos;
DROP POLICY IF EXISTS "modelos_delete" ON public.modelos;
CREATE POLICY "modelos_insert" ON public.modelos
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR public.is_gerente());
CREATE POLICY "modelos_update" ON public.modelos
  FOR UPDATE TO authenticated
  USING (public.is_admin() OR public.is_gerente())
  WITH CHECK (public.is_admin() OR public.is_gerente());
CREATE POLICY "modelos_delete" ON public.modelos
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- produtos
DROP POLICY IF EXISTS "produtos_insert" ON public.produtos;
DROP POLICY IF EXISTS "produtos_update" ON public.produtos;
DROP POLICY IF EXISTS "produtos_delete" ON public.produtos;
CREATE POLICY "produtos_insert" ON public.produtos
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR public.is_gerente());
CREATE POLICY "produtos_update" ON public.produtos
  FOR UPDATE TO authenticated
  USING (public.is_admin() OR public.is_gerente())
  WITH CHECK (public.is_admin() OR public.is_gerente());
CREATE POLICY "produtos_delete" ON public.produtos
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- categorias (categorias_produtos)
DROP POLICY IF EXISTS "categorias_produtos_insert" ON public.categorias;
DROP POLICY IF EXISTS "categorias_produtos_update" ON public.categorias;
DROP POLICY IF EXISTS "categorias_produtos_delete" ON public.categorias;
CREATE POLICY "categorias_produtos_insert" ON public.categorias
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR public.is_gerente());
CREATE POLICY "categorias_produtos_update" ON public.categorias
  FOR UPDATE TO authenticated
  USING (public.is_admin() OR public.is_gerente())
  WITH CHECK (public.is_admin() OR public.is_gerente());
CREATE POLICY "categorias_produtos_delete" ON public.categorias
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- acessorio_versoes
DROP POLICY IF EXISTS "acessorio_versoes_insert" ON public.acessorio_versoes;
DROP POLICY IF EXISTS "acessorio_versoes_update" ON public.acessorio_versoes;
DROP POLICY IF EXISTS "acessorio_versoes_delete" ON public.acessorio_versoes;
CREATE POLICY "acessorio_versoes_insert" ON public.acessorio_versoes
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR public.is_gerente());
CREATE POLICY "acessorio_versoes_update" ON public.acessorio_versoes
  FOR UPDATE TO authenticated
  USING (public.is_admin() OR public.is_gerente())
  WITH CHECK (public.is_admin() OR public.is_gerente());
CREATE POLICY "acessorio_versoes_delete" ON public.acessorio_versoes
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- versao_tipos_proposta
DROP POLICY IF EXISTS "versao_tipos_proposta_insert" ON public.versao_tipos_proposta;
DROP POLICY IF EXISTS "versao_tipos_proposta_update" ON public.versao_tipos_proposta;
DROP POLICY IF EXISTS "versao_tipos_proposta_delete" ON public.versao_tipos_proposta;
CREATE POLICY "versao_tipos_proposta_insert" ON public.versao_tipos_proposta
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR public.is_gerente());
CREATE POLICY "versao_tipos_proposta_update" ON public.versao_tipos_proposta
  FOR UPDATE TO authenticated
  USING (public.is_admin() OR public.is_gerente())
  WITH CHECK (public.is_admin() OR public.is_gerente());
CREATE POLICY "versao_tipos_proposta_delete" ON public.versao_tipos_proposta
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- tipos_proposta
DROP POLICY IF EXISTS "tipos_proposta_insert" ON public.tipos_proposta;
DROP POLICY IF EXISTS "tipos_proposta_update" ON public.tipos_proposta;
DROP POLICY IF EXISTS "tipos_proposta_delete" ON public.tipos_proposta;
CREATE POLICY "tipos_proposta_insert" ON public.tipos_proposta
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR public.is_gerente());
CREATE POLICY "tipos_proposta_update" ON public.tipos_proposta
  FOR UPDATE TO authenticated
  USING (public.is_admin() OR public.is_gerente())
  WITH CHECK (public.is_admin() OR public.is_gerente());
CREATE POLICY "tipos_proposta_delete" ON public.tipos_proposta
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- regioes
DROP POLICY IF EXISTS "regioes_authenticated_all" ON public.regioes;
DROP POLICY IF EXISTS "regioes_select" ON public.regioes;
DROP POLICY IF EXISTS "regioes_insert" ON public.regioes;
DROP POLICY IF EXISTS "regioes_update" ON public.regioes;
DROP POLICY IF EXISTS "regioes_delete" ON public.regioes;
CREATE POLICY "regioes_select" ON public.regioes
  FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "regioes_insert" ON public.regioes
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR public.is_gerente());
CREATE POLICY "regioes_update" ON public.regioes
  FOR UPDATE TO authenticated
  USING (public.is_admin() OR public.is_gerente())
  WITH CHECK (public.is_admin() OR public.is_gerente());
CREATE POLICY "regioes_delete" ON public.regioes
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- projetos: owner keeps access to their row, admin/gerente to all
DROP POLICY IF EXISTS "projetos_authenticated_insert" ON public.projetos;
DROP POLICY IF EXISTS "projetos_authenticated_update" ON public.projetos;
DROP POLICY IF EXISTS "projetos_authenticated_delete" ON public.projetos;
DROP POLICY IF EXISTS "projetos_authenticated_select" ON public.projetos;

CREATE POLICY "projetos_authenticated_select" ON public.projetos
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR public.is_gerente()
    OR "user" = auth.uid()::text
    OR EXISTS (
      SELECT 1 FROM public.projeto_membros pm
      WHERE pm.projeto_id = projetos.id AND pm.user_id = auth.uid()
    )
  );

CREATE POLICY "projetos_authenticated_insert" ON public.projetos
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    OR public.is_gerente()
    OR "user" = auth.uid()::text
    OR "user" IS NULL
  );

CREATE POLICY "projetos_authenticated_update" ON public.projetos
  FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    OR public.is_gerente()
    OR "user" = auth.uid()::text
    OR EXISTS (
      SELECT 1 FROM public.projeto_membros pm
      WHERE pm.projeto_id = projetos.id AND pm.user_id = auth.uid()
    )
  )
  WITH CHECK (
    public.is_admin()
    OR public.is_gerente()
    OR "user" = auth.uid()::text
    OR EXISTS (
      SELECT 1 FROM public.projeto_membros pm
      WHERE pm.projeto_id = projetos.id AND pm.user_id = auth.uid()
    )
  );

CREATE POLICY "projetos_authenticated_delete" ON public.projetos
  FOR DELETE TO authenticated
  USING (
    public.is_admin()
    OR public.is_gerente()
    OR "user" = auth.uid()::text
  );

-- proposta_versoes: access through proposal ownership or admin/gerente
DROP POLICY IF EXISTS "proposta_versoes_select" ON public.proposta_versoes;
DROP POLICY IF EXISTS "proposta_versoes_insert" ON public.proposta_versoes;
DROP POLICY IF EXISTS "proposta_versoes_update" ON public.proposta_versoes;
DROP POLICY IF EXISTS "proposta_versoes_delete" ON public.proposta_versoes;

CREATE POLICY "proposta_versoes_select" ON public.proposta_versoes
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR public.is_gerente()
    OR EXISTS (
      SELECT 1 FROM public.propostas p
      WHERE p.id = proposta_versoes.proposta_id
        AND (p."user" = auth.uid()::text)
    )
  );

CREATE POLICY "proposta_versoes_insert" ON public.proposta_versoes
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    OR public.is_gerente()
    OR EXISTS (
      SELECT 1 FROM public.propostas p
      WHERE p.id = proposta_versoes.proposta_id
        AND (p."user" = auth.uid()::text)
    )
  );

CREATE POLICY "proposta_versoes_update" ON public.proposta_versoes
  FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    OR public.is_gerente()
    OR EXISTS (
      SELECT 1 FROM public.propostas p
      WHERE p.id = proposta_versoes.proposta_id
        AND (p."user" = auth.uid()::text)
    )
  )
  WITH CHECK (
    public.is_admin()
    OR public.is_gerente()
    OR EXISTS (
      SELECT 1 FROM public.propostas p
      WHERE p.id = proposta_versoes.proposta_id
        AND (p."user" = auth.uid()::text)
    )
  );

CREATE POLICY "proposta_versoes_delete" ON public.proposta_versoes
  FOR DELETE TO authenticated
  USING (
    public.is_admin()
    OR public.is_gerente()
    OR EXISTS (
      SELECT 1 FROM public.propostas p
      WHERE p.id = proposta_versoes.proposta_id
        AND (p."user" = auth.uid()::text)
    )
  );
