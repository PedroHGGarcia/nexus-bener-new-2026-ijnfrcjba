-- Migração: Permitir que Representante/Vendedor veja clientes criados por ele OU de sua região/estado de atuação
-- Data: 2026-09-23 16:45:00

-- 1. Helper function para obter o estado de atuação do usuário autenticado
-- Busca primeiro em profiles.estado_atuacao, com fallback no estado do representante vinculado ao profile
CREATE OR REPLACE FUNCTION public.get_user_estado_atuacao()
RETURNS TEXT AS $$
DECLARE
  v_estado TEXT;
BEGIN
  -- 1. Busca no profile do usuário autenticado
  SELECT NULLIF(TRIM(p.estado_atuacao), '') INTO v_estado
  FROM public.profiles p
  WHERE p.id = auth.uid();

  IF v_estado IS NOT NULL THEN
    RETURN UPPER(v_estado);
  END IF;

  -- 2. Fallback: buscar no cadastro de representante vinculado ao profile ou pelo email
  SELECT NULLIF(TRIM(r.estado), '') INTO v_estado
  FROM public.representantes r
  JOIN public.profiles p ON p.id = auth.uid()
  WHERE (r.profile_id = auth.uid()
     OR (p.email IS NOT NULL AND (
          LOWER(r.email) = LOWER(p.email)
          OR r.emails @> to_jsonb(LOWER(p.email))::jsonb
          OR r.emails @> to_jsonb(p.email)::jsonb
        )))
    AND r.estado IS NOT NULL
    AND TRIM(r.estado) <> ''
  ORDER BY (r.profile_id = auth.uid()) DESC
  LIMIT 1;

  IF v_estado IS NOT NULL THEN
    RETURN UPPER(v_estado);
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 2. Atualizar políticas RLS da tabela clientes
-- Clientes agora visíveis para Vendedor/Representante se:
--   - Criados por ele: criado_por = auth.uid()
--   - OU pertencentes ao estado de atuação dele: get_user_estado_atuacao() IS NOT NULL AND UPPER(TRIM(clientes.estado)) = get_user_estado_atuacao()
-- Admin e Gerente mantêm visão total (is_admin() OR NOT is_vendedor_ou_representante()).

DROP POLICY IF EXISTS "clientes_select" ON public.clientes;
CREATE POLICY "clientes_select" ON public.clientes
  FOR SELECT TO authenticated
  USING (
    is_admin()
    OR (NOT is_vendedor_ou_representante())
    OR (criado_por = auth.uid())
    OR (
      get_user_estado_atuacao() IS NOT NULL
      AND estado IS NOT NULL
      AND UPPER(TRIM(estado)) = get_user_estado_atuacao()
    )
  );

-- Atualização: representante/vendedor pode atualizar clientes que criou OU clientes da sua região
DROP POLICY IF EXISTS "clientes_update" ON public.clientes;
CREATE POLICY "clientes_update" ON public.clientes
  FOR UPDATE TO authenticated
  USING (
    is_admin()
    OR (NOT is_vendedor_ou_representante())
    OR (criado_por = auth.uid())
    OR (
      get_user_estado_atuacao() IS NOT NULL
      AND estado IS NOT NULL
      AND UPPER(TRIM(estado)) = get_user_estado_atuacao()
    )
  )
  WITH CHECK (
    is_admin()
    OR (NOT is_vendedor_ou_representante())
    OR (criado_por = auth.uid())
    OR (
      get_user_estado_atuacao() IS NOT NULL
      AND estado IS NOT NULL
      AND UPPER(TRIM(estado)) = get_user_estado_atuacao()
    )
  );

-- Exclusão: representante/vendedor só pode excluir se criado por ele (ou admin/outros)
DROP POLICY IF EXISTS "clientes_delete" ON public.clientes;
CREATE POLICY "clientes_delete" ON public.clientes
  FOR DELETE TO authenticated
  USING (
    is_admin()
    OR (NOT is_vendedor_ou_representante())
    OR (criado_por = auth.uid())
  );
