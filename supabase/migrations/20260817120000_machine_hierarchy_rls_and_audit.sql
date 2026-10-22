-- ==========================================
-- Blindagem RLS na hierarquia de máquinas + Log de auditoria dedicado
--
-- Tabelas protegidas:
--   categorias_produtos, produtos, marcas, modelos, versoes
--
-- Item 1 — RLS:
--   - Dropa as policies *_authenticated_all
--   - _select  -> qualquer usuário autenticado
--   - _insert  -> apenas Admin (is_admin()) OU Comercial (profiles.setor = 'Comercial')
--   - _update  -> apenas Admin OU Comercial
--   - _delete  -> apenas Admin OU Comercial
--
-- Item 2 — Auditoria:
--   - Função audit_machine_changes() dedicada
--   - Triggers AFTER INSERT OR UPDATE OR DELETE com nomes *_audit
--   (Remove triggers de auditoria pré-existentes nessas 5 tabelas para
--    evitar registros duplicados no audit_logs.)
-- ==========================================

-- ==========================================
-- ITEM 1: RLS policies
-- ==========================================

-- --- categorias_produtos ---
DROP POLICY IF EXISTS "categorias_produtos_authenticated_all" ON public.categorias_produtos;

DROP POLICY IF EXISTS "categorias_produtos_select" ON public.categorias_produtos;
CREATE POLICY "categorias_produtos_select" ON public.categorias_produtos
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "categorias_produtos_insert" ON public.categorias_produtos;
CREATE POLICY "categorias_produtos_insert" ON public.categorias_produtos
  FOR INSERT TO authenticated WITH CHECK (
    public.is_admin()
    OR (SELECT setor FROM public.profiles WHERE id = auth.uid()) = 'Comercial'
  );

DROP POLICY IF EXISTS "categorias_produtos_update" ON public.categorias_produtos;
CREATE POLICY "categorias_produtos_update" ON public.categorias_produtos
  FOR UPDATE TO authenticated USING (
    public.is_admin()
    OR (SELECT setor FROM public.profiles WHERE id = auth.uid()) = 'Comercial'
  ) WITH CHECK (
    public.is_admin()
    OR (SELECT setor FROM public.profiles WHERE id = auth.uid()) = 'Comercial'
  );

DROP POLICY IF EXISTS "categorias_produtos_delete" ON public.categorias_produtos;
CREATE POLICY "categorias_produtos_delete" ON public.categorias_produtos
  FOR DELETE TO authenticated USING (
    public.is_admin()
    OR (SELECT setor FROM public.profiles WHERE id = auth.uid()) = 'Comercial'
  );

-- --- produtos ---
DROP POLICY IF EXISTS "produtos_authenticated_all" ON public.produtos;

DROP POLICY IF EXISTS "produtos_select" ON public.produtos;
CREATE POLICY "produtos_select" ON public.produtos
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "produtos_insert" ON public.produtos;
CREATE POLICY "produtos_insert" ON public.produtos
  FOR INSERT TO authenticated WITH CHECK (
    public.is_admin()
    OR (SELECT setor FROM public.profiles WHERE id = auth.uid()) = 'Comercial'
  );

DROP POLICY IF EXISTS "produtos_update" ON public.produtos;
CREATE POLICY "produtos_update" ON public.produtos
  FOR UPDATE TO authenticated USING (
    public.is_admin()
    OR (SELECT setor FROM public.profiles WHERE id = auth.uid()) = 'Comercial'
  ) WITH CHECK (
    public.is_admin()
    OR (SELECT setor FROM public.profiles WHERE id = auth.uid()) = 'Comercial'
  );

DROP POLICY IF EXISTS "produtos_delete" ON public.produtos;
CREATE POLICY "produtos_delete" ON public.produtos
  FOR DELETE TO authenticated USING (
    public.is_admin()
    OR (SELECT setor FROM public.profiles WHERE id = auth.uid()) = 'Comercial'
  );

-- --- marcas ---
DROP POLICY IF EXISTS "marcas_authenticated_all" ON public.marcas;

DROP POLICY IF EXISTS "marcas_select" ON public.marcas;
CREATE POLICY "marcas_select" ON public.marcas
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "marcas_insert" ON public.marcas;
CREATE POLICY "marcas_insert" ON public.marcas
  FOR INSERT TO authenticated WITH CHECK (
    public.is_admin()
    OR (SELECT setor FROM public.profiles WHERE id = auth.uid()) = 'Comercial'
  );

DROP POLICY IF EXISTS "marcas_update" ON public.marcas;
CREATE POLICY "marcas_update" ON public.marcas
  FOR UPDATE TO authenticated USING (
    public.is_admin()
    OR (SELECT setor FROM public.profiles WHERE id = auth.uid()) = 'Comercial'
  ) WITH CHECK (
    public.is_admin()
    OR (SELECT setor FROM public.profiles WHERE id = auth.uid()) = 'Comercial'
  );

DROP POLICY IF EXISTS "marcas_delete" ON public.marcas;
CREATE POLICY "marcas_delete" ON public.marcas
  FOR DELETE TO authenticated USING (
    public.is_admin()
    OR (SELECT setor FROM public.profiles WHERE id = auth.uid()) = 'Comercial'
  );

-- --- modelos ---
DROP POLICY IF EXISTS "modelos_authenticated_all" ON public.modelos;

DROP POLICY IF EXISTS "modelos_select" ON public.modelos;
CREATE POLICY "modelos_select" ON public.modelos
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "modelos_insert" ON public.modelos;
CREATE POLICY "modelos_insert" ON public.modelos
  FOR INSERT TO authenticated WITH CHECK (
    public.is_admin()
    OR (SELECT setor FROM public.profiles WHERE id = auth.uid()) = 'Comercial'
  );

DROP POLICY IF EXISTS "modelos_update" ON public.modelos;
CREATE POLICY "modelos_update" ON public.modelos
  FOR UPDATE TO authenticated USING (
    public.is_admin()
    OR (SELECT setor FROM public.profiles WHERE id = auth.uid()) = 'Comercial'
  ) WITH CHECK (
    public.is_admin()
    OR (SELECT setor FROM public.profiles WHERE id = auth.uid()) = 'Comercial'
  );

DROP POLICY IF EXISTS "modelos_delete" ON public.modelos;
CREATE POLICY "modelos_delete" ON public.modelos
  FOR DELETE TO authenticated USING (
    public.is_admin()
    OR (SELECT setor FROM public.profiles WHERE id = auth.uid()) = 'Comercial'
  );

-- --- versoes ---
DROP POLICY IF EXISTS "versoes_authenticated_all" ON public.versoes;

DROP POLICY IF EXISTS "versoes_select" ON public.versoes;
CREATE POLICY "versoes_select" ON public.versoes
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "versoes_insert" ON public.versoes;
CREATE POLICY "versoes_insert" ON public.versoes
  FOR INSERT TO authenticated WITH CHECK (
    public.is_admin()
    OR (SELECT setor FROM public.profiles WHERE id = auth.uid()) = 'Comercial'
  );

DROP POLICY IF EXISTS "versoes_update" ON public.versoes;
CREATE POLICY "versoes_update" ON public.versoes
  FOR UPDATE TO authenticated USING (
    public.is_admin()
    OR (SELECT setor FROM public.profiles WHERE id = auth.uid()) = 'Comercial'
  ) WITH CHECK (
    public.is_admin()
    OR (SELECT setor FROM public.profiles WHERE id = auth.uid()) = 'Comercial'
  );

DROP POLICY IF EXISTS "versoes_delete" ON public.versoes;
CREATE POLICY "versoes_delete" ON public.versoes
  FOR DELETE TO authenticated USING (
    public.is_admin()
    OR (SELECT setor FROM public.profiles WHERE id = auth.uid()) = 'Comercial'
  );

-- ==========================================
-- ITEM 2: Função de auditoria dedicada + triggers
-- ==========================================

CREATE OR REPLACE FUNCTION public.audit_machine_changes()
RETURNS trigger AS $$
DECLARE
  v_user_id UUID;
  v_user_name TEXT;
  v_changes JSONB;
  v_record_id TEXT;
BEGIN
  v_user_id := auth.uid();
  SELECT name INTO v_user_name FROM public.profiles WHERE id = v_user_id;
  v_user_name := COALESCE(v_user_name, 'Sistema');

  IF TG_OP = 'INSERT' THEN
    v_changes := to_jsonb(NEW);
    v_record_id := NEW.id::text;
  ELSIF TG_OP = 'UPDATE' THEN
    v_changes := jsonb_build_object('old', to_jsonb(OLD), 'new', to_jsonb(NEW));
    v_record_id := NEW.id::text;
  ELSIF TG_OP = 'DELETE' THEN
    v_changes := to_jsonb(OLD);
    v_record_id := OLD.id::text;
  END IF;

  INSERT INTO public.audit_logs (user_id, user_name, action, table_name, record_id, data_changes)
  VALUES (v_user_id, v_user_name, TG_OP, TG_TABLE_NAME, v_record_id, v_changes);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Remove triggers de auditoria pré-existentes nessas 5 tabelas (evita duplicação)
DROP TRIGGER IF EXISTS audit_trigger ON public.categorias_produtos;
DROP TRIGGER IF EXISTS audit_categorias_produtos ON public.categorias_produtos;
DROP TRIGGER IF EXISTS audit_trigger ON public.produtos;
DROP TRIGGER IF EXISTS audit_produtos ON public.produtos;
DROP TRIGGER IF EXISTS audit_trigger ON public.marcas;
DROP TRIGGER IF EXISTS audit_marcas ON public.marcas;
DROP TRIGGER IF EXISTS audit_trigger ON public.modelos;
DROP TRIGGER IF EXISTS audit_modelos ON public.modelos;
DROP TRIGGER IF EXISTS audit_trigger ON public.versoes;
DROP TRIGGER IF EXISTS audit_versoes ON public.versoes;

-- Cria os triggers dedicados com os nomes solicitados
DROP TRIGGER IF EXISTS categorias_produtos_audit ON public.categorias_produtos;
CREATE TRIGGER categorias_produtos_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.categorias_produtos
  FOR EACH ROW EXECUTE FUNCTION public.audit_machine_changes();

DROP TRIGGER IF EXISTS produtos_audit ON public.produtos;
CREATE TRIGGER produtos_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.produtos
  FOR EACH ROW EXECUTE FUNCTION public.audit_machine_changes();

DROP TRIGGER IF EXISTS marcas_audit ON public.marcas;
CREATE TRIGGER marcas_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.marcas
  FOR EACH ROW EXECUTE FUNCTION public.audit_machine_changes();

DROP TRIGGER IF EXISTS modelos_audit ON public.modelos;
CREATE TRIGGER modelos_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.modelos
  FOR EACH ROW EXECUTE FUNCTION public.audit_machine_changes();

DROP TRIGGER IF EXISTS versoes_audit ON public.versoes;
CREATE TRIGGER versoes_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.versoes
  FOR EACH ROW EXECUTE FUNCTION public.audit_machine_changes();
