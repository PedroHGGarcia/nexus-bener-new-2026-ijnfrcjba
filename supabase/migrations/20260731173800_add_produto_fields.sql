-- Add new columns to produtos table
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS categoria UUID REFERENCES public.categorias_produtos(id) ON DELETE SET NULL;
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS descricao TEXT;
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS especificacoes JSONB;
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS fotos JSONB;

-- Ensure RLS is enabled
ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;

-- Recreate policies idempotently
DROP POLICY IF EXISTS "produtos_select" ON public.produtos;
CREATE POLICY "produtos_select" ON public.produtos
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "produtos_insert" ON public.produtos;
CREATE POLICY "produtos_insert" ON public.produtos
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "produtos_update" ON public.produtos;
CREATE POLICY "produtos_update" ON public.produtos
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "produtos_delete" ON public.produtos;
CREATE POLICY "produtos_delete" ON public.produtos
  FOR DELETE TO authenticated USING (true);
