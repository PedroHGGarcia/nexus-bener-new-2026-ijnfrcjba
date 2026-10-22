-- Migration: 20261002120000_representante_gerente_categorias.sql
-- Objetivo: Vincular representantes a gerentes por categoria de produto
-- e assegurar RLS adequado em representante_categorias e representante_gerente_categorias.

-- 1. Criar tabela de relacionamento representante_gerente_categorias
CREATE TABLE IF NOT EXISTS public.representante_gerente_categorias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  representante_id uuid NOT NULL REFERENCES public.representantes(id) ON DELETE CASCADE,
  gerente_id uuid NOT NULL REFERENCES public.gerentes(id) ON DELETE CASCADE,
  categoria_id uuid NOT NULL REFERENCES public.categorias(id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT uq_rep_cat UNIQUE (representante_id, categoria_id)
);

CREATE INDEX IF NOT EXISTS idx_rgc_rep ON public.representante_gerente_categorias (representante_id);
CREATE INDEX IF NOT EXISTS idx_rgc_ger ON public.representante_gerente_categorias (gerente_id);
CREATE INDEX IF NOT EXISTS idx_rgc_cat ON public.representante_gerente_categorias (categoria_id);

-- 2. Habilitar RLS
ALTER TABLE public.representante_gerente_categorias ENABLE ROW LEVEL SECURITY;

-- 3. Políticas para representante_gerente_categorias:
-- Leitura: qualquer authenticated pode ler (necessário para emissão e listagens)
DROP POLICY IF EXISTS rgc_read_authenticated ON public.representante_gerente_categorias;
CREATE POLICY rgc_read_authenticated
  ON public.representante_gerente_categorias
  FOR SELECT
  TO authenticated
  USING (true);

-- Escrita: apenas Admin ou Gerência pode criar/editar/remover vínculos
DROP POLICY IF EXISTS rgc_write_admin_gerente ON public.representante_gerente_categorias;
CREATE POLICY rgc_write_admin_gerente
  ON public.representante_gerente_categorias
  FOR ALL
  TO authenticated
  USING (public.is_admin() OR public.is_gerente())
  WITH CHECK (public.is_admin() OR public.is_gerente());

-- 4. Garantir RLS em representante_categorias
ALTER TABLE public.representante_categorias ENABLE ROW LEVEL SECURITY;

-- Leitura: authenticated pode ler (incluindo o próprio representante e gerentes)
DROP POLICY IF EXISTS rep_cat_read ON public.representante_categorias;
CREATE POLICY rep_cat_read
  ON public.representante_categorias
  FOR SELECT
  TO authenticated
  USING (true);

-- Escrita: apenas Admin ou Gerente pode gerenciar vínculos de categorias dos representantes
DROP POLICY IF EXISTS rep_cat_write ON public.representante_categorias;
CREATE POLICY rep_cat_write
  ON public.representante_categorias
  FOR ALL
  TO authenticated
  USING (public.is_admin() OR public.is_gerente())
  WITH CHECK (public.is_admin() OR public.is_gerente());
