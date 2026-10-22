-- ==========================================
-- Quarentena de Máquinas — Soft-delete para a hierarquia
--
-- Tabelas: categorias_produtos, produtos, marcas, modelos, versoes
--
-- 1) Adiciona colunas `deleted_at` (timestamptz) e `deleted_by` (uuid FK -> auth.users)
--    em todas as 5 tabelas. Um item com status = 'Em Quarentena' (e deleted_at preenchido)
--    está oculto para usuários normais, mas ainda existe no banco — então os FKs de
--    propostas não quebram.
-- 2) Restringe a política DELETE das 5 tabelas a APENAS Admin (is_admin()).
--    O Comercial perde o poder de DELETE real — quando "exclui", a aplicação faz
--    um UPDATE (status='Em Quarentena', deleted_at=now(), deleted_by=auth.uid()).
--    UPDATE continua liberado para Admin e Comercial (mesmo comportamento de antes).
-- 3) Índices em `deleted_at` para acelerar o dashboard de quarentena.
-- ==========================================

-- ==========================================
-- ITEM 1: Colunas deleted_at / deleted_by + índices
-- ==========================================

ALTER TABLE public.categorias_produtos
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.produtos
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.marcas
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.modelos
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.versoes
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_categorias_produtos_deleted_at
  ON public.categorias_produtos (deleted_at);
CREATE INDEX IF NOT EXISTS idx_produtos_deleted_at
  ON public.produtos (deleted_at);
CREATE INDEX IF NOT EXISTS idx_marcas_deleted_at
  ON public.marcas (deleted_at);
CREATE INDEX IF NOT EXISTS idx_modelos_deleted_at
  ON public.modelos (deleted_at);
CREATE INDEX IF NOT EXISTS idx_versoes_deleted_at
  ON public.versoes (deleted_at);

-- ==========================================
-- ITEM 2: RLS DELETE — apenas Admin (remove Comercial)
-- INSERT e UPDATE permanecem Admin OU Comercial (sem alteração).
-- ==========================================

-- --- categorias_produtos ---
DROP POLICY IF EXISTS "categorias_produtos_delete" ON public.categorias_produtos;
CREATE POLICY "categorias_produtos_delete" ON public.categorias_produtos
  FOR DELETE TO authenticated USING (public.is_admin());

-- --- produtos ---
DROP POLICY IF EXISTS "produtos_delete" ON public.produtos;
CREATE POLICY "produtos_delete" ON public.produtos
  FOR DELETE TO authenticated USING (public.is_admin());

-- --- marcas ---
DROP POLICY IF EXISTS "marcas_delete" ON public.marcas;
CREATE POLICY "marcas_delete" ON public.marcas
  FOR DELETE TO authenticated USING (public.is_admin());

-- --- modelos ---
DROP POLICY IF EXISTS "modelos_delete" ON public.modelos;
CREATE POLICY "modelos_delete" ON public.modelos
  FOR DELETE TO authenticated USING (public.is_admin());

-- --- versoes ---
DROP POLICY IF EXISTS "versoes_delete" ON public.versoes;
CREATE POLICY "versoes_delete" ON public.versoes
  FOR DELETE TO authenticated USING (public.is_admin());
