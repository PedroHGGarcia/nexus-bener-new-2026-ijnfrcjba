-- ==========================================
-- Adiciona coluna `produto` (FK -> produtos.id, nullable) na tabela `marcas`
-- Permite vincular diretamente uma marca a um produto na Gestão de Máquinas.
-- ==========================================

ALTER TABLE public.marcas
  ADD COLUMN IF NOT EXISTS produto UUID REFERENCES public.produtos(id) ON DELETE SET NULL;

-- Índice para acelerar buscas por produto vinculado à marca
CREATE INDEX IF NOT EXISTS idx_marcas_produto ON public.marcas USING btree (produto);
