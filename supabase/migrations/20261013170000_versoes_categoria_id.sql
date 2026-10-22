-- Migration: Gravar categoria_id diretamente na tabela public.versoes
-- Opção (b): categoria derivada gravada na versão; fallback para derivação quando nula

-- 1. Assegurar que a view de compatibilidade public.categorias_produtos aponte para public.categorias
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'categorias_produtos' AND n.nspname = 'public') THEN
    CREATE VIEW public.categorias_produtos AS SELECT * FROM public.categorias;
  END IF;
END $$;

-- 2. Adicionar coluna categoria_id em public.versoes apontando para public.categorias(id)
ALTER TABLE public.versoes
  ADD COLUMN IF NOT EXISTS categoria_id uuid REFERENCES public.categorias(id) ON DELETE SET NULL;

-- 3. Criar índice para performance em buscas e filtros por categoria_id
CREATE INDEX IF NOT EXISTS idx_versoes_categoria_id ON public.versoes(categoria_id);

-- 4. Backfill: popular categoria_id a partir do produto do modelo atual para versões onde categoria_id ainda é nulo
UPDATE public.versoes v
SET categoria_id = p.categoria
FROM public.modelos m
JOIN public.produtos p ON p.id = m.produto
WHERE v.modelo = m.id
  AND p.categoria IS NOT NULL
  AND v.categoria_id IS NULL;

-- 5. Atualizar policy versoes_select para priorizar categoria_id gravada com fallback para a derivação modelo->produto->categoria
DROP POLICY IF EXISTS "versoes_select" ON public.versoes;
CREATE POLICY "versoes_select" ON public.versoes
  FOR SELECT TO authenticated
  USING (
    is_admin()
    OR is_gerente()
    OR (NOT is_vendedor_ou_representante())
    OR (
      COALESCE(
        versoes.categoria_id,
        (
          SELECT p.categoria
          FROM public.modelos m
          JOIN public.produtos p ON p.id = m.produto
          WHERE m.id = versoes.modelo
          LIMIT 1
        )
      ) IN (
        SELECT categoria_id FROM public.get_current_user_allowed_categoria_ids()
      )
    )
  );
