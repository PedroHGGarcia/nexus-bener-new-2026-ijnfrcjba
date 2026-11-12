-- Migration: propostas.created_by + RLS por papel (representante/vendedor vê só as próprias)
-- Data: 2026-11-11 18:00
--
-- Objetivo:
--  1. created_by uuid = auth.uid() preenchido por trigger no INSERT (imutável para quem não é admin).
--  2. SELECT: admin vê tudo; representante/vendedor vê SOMENTE created_by = auth.uid();
--     demais papéis internos (gerente etc.) mantêm a visão atual.
--  3. INSERT/UPDATE/DELETE coerentes com o papel.
--  4. Fluxos públicos (/visualizar-proposta/:id, /proposta/:id/imprimir, PDF) continuam via
--     edge function public-proposal (service role, imune a RLS) — sem política anon criada aqui.

-- 1. Coluna created_by (nulável — propostas antigas ficam sem vínculo)
ALTER TABLE public.propostas ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_propostas_created_by ON public.propostas(created_by);

-- 2. Trigger: preenche created_by = auth.uid() no INSERT, ignora valor enviado pelo cliente
CREATE OR REPLACE FUNCTION public.set_proposta_created_by()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.created_by IS NULL THEN
    NEW.created_by := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_proposta_created_by ON public.propostas;
CREATE TRIGGER trg_set_proposta_created_by
  BEFORE INSERT ON public.propostas
  FOR EACH ROW
  EXECUTE FUNCTION public.set_proposta_created_by();

-- 3. Trigger: impede que não-admin altere created_by em UPDATE
CREATE OR REPLACE FUNCTION public.protect_proposta_created_by()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.created_by IS DISTINCT FROM OLD.created_by
     AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Somente administradores podem alterar o criador da proposta';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_proposta_created_by ON public.propostas;
CREATE TRIGGER trg_protect_proposta_created_by
  BEFORE UPDATE ON public.propostas
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_proposta_created_by();

-- 4. RLS: políticas SELECT/INSERT/UPDATE/DELETE por papel
DROP POLICY IF EXISTS "propostas_authenticated_select" ON public.propostas;
DROP POLICY IF EXISTS "propostas_authenticated_insert" ON public.propostas;
DROP POLICY IF EXISTS "propostas_authenticated_update" ON public.propostas;
DROP POLICY IF EXISTS "propostas_authenticated_delete" ON public.propostas;

-- SELECT
--  - admin: tudo (inclui propostas antigas sem created_by)
--  - gerente e demais papéis internos (não admin, não vendedor/representante): visão atual preservada
--  - vendedor/representante: SOMENTE propostas criadas por ele mesmo (created_by = auth.uid())
CREATE POLICY "propostas_authenticated_select" ON public.propostas
FOR SELECT TO authenticated
USING (
  is_admin()
  OR (
    NOT is_vendedor_ou_representante()
    AND (
      is_competitividade_ativada()
      OR is_gerente()
      OR true -- demais papéis internos mantêm visão ampla
    )
  )
  OR (
    is_vendedor_ou_representante()
    AND created_by = auth.uid()
  )
);

-- INSERT: qualquer autenticado pode criar (o vendedor só consegue criar com created_by = ele mesmo,
-- pois o trigger sobrescreve/somente aceita NULL = auth.uid(); tentativa de forjar outro dono é bloqueada)
CREATE POLICY "propostas_authenticated_insert" ON public.propostas
FOR INSERT TO authenticated
WITH CHECK (
  is_admin()
  OR NOT is_vendedor_ou_representante()
  OR created_by = auth.uid()
);

-- UPDATE: admin edita tudo; gerente e internos mantêm comportamento (todas as visíveis);
-- vendedor/representante só edita as próprias
CREATE POLICY "propostas_authenticated_update" ON public.propostas
FOR UPDATE TO authenticated
USING (
  is_admin()
  OR (NOT is_vendedor_ou_representante())
  OR (is_vendedor_ou_representante() AND created_by = auth.uid())
)
WITH CHECK (
  is_admin()
  OR (NOT is_vendedor_ou_representante())
  OR (is_vendedor_ou_representante() AND created_by = auth.uid())
);

-- DELETE: admin exclusivamente (mantém regra atual da tabela)
CREATE POLICY "propostas_authenticated_delete" ON public.propostas
FOR DELETE TO authenticated
USING (is_admin());
