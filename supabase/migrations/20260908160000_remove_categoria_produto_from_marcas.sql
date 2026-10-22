-- ============================================================================
-- Migração: Remover colunas categoria e produto da tabela marcas
-- 
-- A tabela marcas possuía as colunas obsoletas `categoria` e `produto` (FKs para
-- categorias_produtos e produtos), que não pertencem ao desenho acordado:
-- categorias_produtos → produtos → modelos ← marcas, e modelos → versoes.
-- Marcas só se ligam ao ecossistema através de modelos.
-- ============================================================================

-- 1. Dropar índice antes de remover a coluna
DROP INDEX IF EXISTS idx_marcas_produto;

-- 2. Dropar constraints de chave estrangeira caso ainda persistam
ALTER TABLE public.marcas
  DROP CONSTRAINT IF EXISTS marcas_categoria_fkey,
  DROP CONSTRAINT IF EXISTS marcas_produto_fkey;

-- 3. Dropar as colunas obsoletas
ALTER TABLE public.marcas
  DROP COLUMN IF EXISTS categoria,
  DROP COLUMN IF EXISTS produto;
