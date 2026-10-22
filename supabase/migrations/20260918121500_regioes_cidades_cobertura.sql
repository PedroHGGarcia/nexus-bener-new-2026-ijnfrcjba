-- Migration: Adicionar suporte a cidades específicas e remoção da restrição de UF única em regioes
-- Permite que múltiplas regiões existam no mesmo estado (ex: Interior SP, Capital SP)
-- com seleção de cidades específicas ou cobertura de todo o estado.

-- 1. Remover a restrição UNIQUE em uf, se existir
ALTER TABLE public.regioes DROP CONSTRAINT IF EXISTS regioes_uf_key;
DROP INDEX IF EXISTS public.regioes_uf_key;

-- 2. Adicionar colunas para suporte a cidades e flag de todo o estado
ALTER TABLE public.regioes
  ADD COLUMN IF NOT EXISTS todo_o_estado BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS cidades JSONB NOT NULL DEFAULT '[]'::jsonb;

-- 3. Atualizar registros existentes: regiões antigas continuam como todo_o_estado = true
UPDATE public.regioes
SET todo_o_estado = true,
    cidades = COALESCE(cidades, '[]'::jsonb)
WHERE todo_o_estado IS NULL OR cidades IS NULL;

-- 4. Índice para busca por UF nas regiões
CREATE INDEX IF NOT EXISTS idx_regioes_uf ON public.regioes(uf);

-- 5. Garantir que as policies de RLS continuem cobrindo regioes (já existentes)
DROP POLICY IF EXISTS "regioes_authenticated_all" ON public.regioes;
CREATE POLICY "regioes_authenticated_all" ON public.regioes
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "regioes_anon_select" ON public.regioes;
CREATE POLICY "regioes_anon_select" ON public.regioes
  FOR SELECT TO anon USING (true);
