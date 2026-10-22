-- Migration: Vínculo representante<->gerente por categoria e RLS de visibilidade de máquinas por categoria
-- Data: 2026-10-02

-- 1. Assegurar tabela representante_gerente_categorias (se não existir, cria com chaves e índices)
CREATE TABLE IF NOT EXISTS public.representante_gerente_categorias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  representante_id uuid NOT NULL REFERENCES public.representantes(id) ON DELETE CASCADE,
  gerente_id uuid NOT NULL REFERENCES public.gerentes(id) ON DELETE CASCADE,
  categoria_id uuid NOT NULL REFERENCES public.categorias(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT uq_rep_cat UNIQUE (representante_id, categoria_id)
);

CREATE INDEX IF NOT EXISTS idx_rgc_rep ON public.representante_gerente_categorias(representante_id);
CREATE INDEX IF NOT EXISTS idx_rgc_ger ON public.representante_gerente_categorias(gerente_id);
CREATE INDEX IF NOT EXISTS idx_rgc_cat ON public.representante_gerente_categorias(categoria_id);

ALTER TABLE public.representante_gerente_categorias ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rgc_read_authenticated" ON public.representante_gerente_categorias;
CREATE POLICY "rgc_read_authenticated" ON public.representante_gerente_categorias
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "rgc_write_admin_gerente" ON public.representante_gerente_categorias;
CREATE POLICY "rgc_write_admin_gerente" ON public.representante_gerente_categorias
  FOR ALL TO authenticated
  USING (is_admin() OR is_gerente())
  WITH CHECK (is_admin() OR is_gerente());

-- 2. Função helper para obter IDs de categorias permitidas para o usuário atual (representante/vendedor)
CREATE OR REPLACE FUNCTION public.get_current_user_allowed_categoria_ids()
RETURNS TABLE (categoria_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT rc.categoria_id
  FROM public.representante_categorias rc
  JOIN public.representantes r ON r.id = rc.representante_id
  JOIN public.profiles p ON (p.id = r.profile_id OR lower(trim(p.email)) = lower(trim(r.email)))
  WHERE p.id = auth.uid()
  UNION
  SELECT rgc.categoria_id
  FROM public.representante_gerente_categorias rgc
  JOIN public.representantes r ON r.id = rgc.representante_id
  JOIN public.profiles p ON (p.id = r.profile_id OR lower(trim(p.email)) = lower(trim(r.email)))
  WHERE p.id = auth.uid();
$$;

-- 3. Função booleana para checar se uma categoria é permitida para o usuário atual
CREATE OR REPLACE FUNCTION public.can_user_access_categoria(cat_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Se for admin ou gerente, tem acesso total a todas as categorias
  IF is_admin() OR is_gerente() THEN
    RETURN true;
  END IF;

  -- Se for vendedor/representante, só pode ver se tiver a categoria atribuída
  IF is_vendedor_ou_representante() THEN
    -- Se cat_id for nulo em máquina legada, não expõe a representante restrito
    IF cat_id IS NULL THEN
      RETURN false;
    END IF;

    RETURN EXISTS (
      SELECT 1 FROM public.get_current_user_allowed_categoria_ids() ac
      WHERE ac.categoria_id = cat_id
    );
  END IF;

  -- Outros papéis autenticados mantêm acesso
  RETURN true;
END;
$$;

-- 4. Atualizar políticas RLS de produtos, modelos e versoes
-- Produtos:
DROP POLICY IF EXISTS "produtos_select" ON public.produtos;
CREATE POLICY "produtos_select" ON public.produtos
  FOR SELECT TO authenticated
  USING (
    is_admin()
    OR is_gerente()
    OR (NOT is_vendedor_ou_representante())
    OR (
      is_vendedor_ou_representante()
      AND categoria IS NOT NULL
      AND categoria IN (SELECT categoria_id FROM public.get_current_user_allowed_categoria_ids())
    )
  );

-- Modelos: dependem da categoria do produto vinculado
DROP POLICY IF EXISTS "modelos_select" ON public.modelos;
CREATE POLICY "modelos_select" ON public.modelos
  FOR SELECT TO authenticated
  USING (
    is_admin()
    OR is_gerente()
    OR (NOT is_vendedor_ou_representante())
    OR EXISTS (
      SELECT 1 FROM public.produtos prod
      WHERE prod.id = modelos.produto
        AND prod.categoria IS NOT NULL
        AND prod.categoria IN (SELECT categoria_id FROM public.get_current_user_allowed_categoria_ids())
    )
  );

-- Versões: dependem da categoria do produto via modelo
DROP POLICY IF EXISTS "versoes_select" ON public.versoes;
CREATE POLICY "versoes_select" ON public.versoes
  FOR SELECT TO authenticated
  USING (
    is_admin()
    OR is_gerente()
    OR (NOT is_vendedor_ou_representante())
    OR EXISTS (
      SELECT 1 FROM public.modelos m
      JOIN public.produtos prod ON prod.id = m.produto
      WHERE m.id = versoes.modelo
        AND prod.categoria IS NOT NULL
        AND prod.categoria IN (SELECT categoria_id FROM public.get_current_user_allowed_categoria_ids())
    )
  );
