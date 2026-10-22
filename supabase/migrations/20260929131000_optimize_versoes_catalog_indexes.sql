-- Migration: Optimize machine catalog queries (indexes on versoes, modelos, produtos)
-- Created for instant proposal catalog loading and version selector performance.

-- 1. Index on versoes: status and deleted_at composite filter, plus foreign key to modelo
CREATE INDEX IF NOT EXISTS idx_versoes_status_deleted_at_nome 
  ON public.versoes USING btree (status, deleted_at, nome);

CREATE INDEX IF NOT EXISTS idx_versoes_modelo 
  ON public.versoes USING btree (modelo);

-- 2. Index on modelos: foreign keys to produto and marca, plus deleted_at
CREATE INDEX IF NOT EXISTS idx_modelos_produto 
  ON public.modelos USING btree (produto);

CREATE INDEX IF NOT EXISTS idx_modelos_marca 
  ON public.modelos USING btree (marca);

-- 3. Index on produtos: foreign key to categoria, plus deleted_at
CREATE INDEX IF NOT EXISTS idx_produtos_categoria 
  ON public.produtos USING btree (categoria);
