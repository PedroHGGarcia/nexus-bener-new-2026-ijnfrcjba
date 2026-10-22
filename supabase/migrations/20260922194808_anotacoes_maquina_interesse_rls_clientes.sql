-- Migração: Anotações por representante, máquina de interesse no cliente e RLS de clientes por criador
-- Data: 2026-09-22 19:48:08

-- ============================================================================
-- 1. RECURSO 2: Coluna maquina_interesse e criado_por na tabela clientes
-- ============================================================================
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS maquina_interesse TEXT;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS criado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_clientes_criado_por ON public.clientes(criado_por);

-- Trigger para definir automaticamente criado_por no INSERT caso não venha informado
CREATE OR REPLACE FUNCTION public.set_cliente_criado_por()
RETURNS trigger AS $$
BEGIN
  IF NEW.criado_por IS NULL THEN
    NEW.criado_por := auth.uid();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_set_cliente_criado_por ON public.clientes;
CREATE TRIGGER trg_set_cliente_criado_por
  BEFORE INSERT ON public.clientes
  FOR EACH ROW
  EXECUTE FUNCTION public.set_cliente_criado_por();

-- ============================================================================
-- 2. RECURSO 1: Tabela representante_anotacoes (plano da região no ano)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.representante_anotacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  representante_id UUID NOT NULL REFERENCES public.representantes(id) ON DELETE CASCADE,
  ano_referencia INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER,
  titulo TEXT NOT NULL,
  texto TEXT NOT NULL,
  autor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  autor_nome TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rep_anotacoes_rep_id ON public.representante_anotacoes(representante_id);
CREATE INDEX IF NOT EXISTS idx_rep_anotacoes_ano ON public.representante_anotacoes(ano_referencia);

-- Trigger de updated_at para representante_anotacoes
DROP TRIGGER IF EXISTS trg_rep_anotacoes_updated_at ON public.representante_anotacoes;
CREATE TRIGGER trg_rep_anotacoes_updated_at
  BEFORE UPDATE ON public.representante_anotacoes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- Trigger de auditoria para representante_anotacoes
DROP TRIGGER IF EXISTS audit_rep_anotacoes ON public.representante_anotacoes;
CREATE TRIGGER audit_rep_anotacoes
  AFTER INSERT OR DELETE OR UPDATE ON public.representante_anotacoes
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_log_trigger();

-- RLS de representante_anotacoes:
-- Admin e Gerente gerenciam (SELECT, INSERT, UPDATE, DELETE).
-- Vendedor / Representante não gerenciam.
ALTER TABLE public.representante_anotacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rep_anotacoes_select" ON public.representante_anotacoes;
CREATE POLICY "rep_anotacoes_select" ON public.representante_anotacoes
  FOR SELECT TO authenticated
  USING (
    is_admin()
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) ILIKE '%gerente%'
  );

DROP POLICY IF EXISTS "rep_anotacoes_insert" ON public.representante_anotacoes;
CREATE POLICY "rep_anotacoes_insert" ON public.representante_anotacoes
  FOR INSERT TO authenticated
  WITH CHECK (
    is_admin()
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) ILIKE '%gerente%'
  );

DROP POLICY IF EXISTS "rep_anotacoes_update" ON public.representante_anotacoes;
CREATE POLICY "rep_anotacoes_update" ON public.representante_anotacoes
  FOR UPDATE TO authenticated
  USING (
    is_admin()
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) ILIKE '%gerente%'
  )
  WITH CHECK (
    is_admin()
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) ILIKE '%gerente%'
  );

DROP POLICY IF EXISTS "rep_anotacoes_delete" ON public.representante_anotacoes;
CREATE POLICY "rep_anotacoes_delete" ON public.representante_anotacoes
  FOR DELETE TO authenticated
  USING (
    is_admin()
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) ILIKE '%gerente%'
  );

-- ============================================================================
-- 3. RECURSO 3: RLS de clientes
-- Admin e Gerente mantêm visão global / total.
-- Vendedor / Representante só vê clientes criados por ele (criado_por = auth.uid()).
-- Vendedor / Representante só UPDATE em clientes que ele criou.
-- Vendedor / Representante pode INSERT onde criado_por = auth.uid() (ou default).
-- ============================================================================
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;

-- Remover políticas antigas
DROP POLICY IF EXISTS "clientes_authenticated_all" ON public.clientes;
DROP POLICY IF EXISTS "clientes_anon_select" ON public.clientes;
DROP POLICY IF EXISTS "clientes_select" ON public.clientes;
DROP POLICY IF EXISTS "clientes_insert" ON public.clientes;
DROP POLICY IF EXISTS "clientes_update" ON public.clientes;
DROP POLICY IF EXISTS "clientes_delete" ON public.clientes;

-- Permitir anon select apenas se necessário (ex: validação externa), ou manter restrito
CREATE POLICY "clientes_anon_select" ON public.clientes
  FOR SELECT TO anon
  USING (false);

-- SELECT para autenticados
CREATE POLICY "clientes_select" ON public.clientes
  FOR SELECT TO authenticated
  USING (
    is_admin()
    OR (NOT is_vendedor_ou_representante())
    OR (criado_por = auth.uid())
  );

-- INSERT para autenticados
CREATE POLICY "clientes_insert" ON public.clientes
  FOR INSERT TO authenticated
  WITH CHECK (
    is_admin()
    OR (NOT is_vendedor_ou_representante())
    OR (criado_por IS NULL OR criado_por = auth.uid())
  );

-- UPDATE para autenticados
CREATE POLICY "clientes_update" ON public.clientes
  FOR UPDATE TO authenticated
  USING (
    is_admin()
    OR (NOT is_vendedor_ou_representante())
    OR (criado_por = auth.uid())
  )
  WITH CHECK (
    is_admin()
    OR (NOT is_vendedor_ou_representante())
    OR (criado_por = auth.uid())
  );

-- DELETE para autenticados: Admin/Gerente podem; Vendedor só os próprios
CREATE POLICY "clientes_delete" ON public.clientes
  FOR DELETE TO authenticated
  USING (
    is_admin()
    OR (NOT is_vendedor_ou_representante())
    OR (criado_por = auth.uid())
  );
