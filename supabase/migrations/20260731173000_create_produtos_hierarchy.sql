-- Ensure generic updated_at function exists
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- categorias_produtos
-- ==========================================
CREATE TABLE IF NOT EXISTS public.categorias_produtos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  logo TEXT,
  status TEXT NOT NULL DEFAULT 'Ativo',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_categorias_produtos_nome ON public.categorias_produtos(nome);

ALTER TABLE public.categorias_produtos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "categorias_produtos_select" ON public.categorias_produtos;
CREATE POLICY "categorias_produtos_select" ON public.categorias_produtos
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "categorias_produtos_insert" ON public.categorias_produtos;
CREATE POLICY "categorias_produtos_insert" ON public.categorias_produtos
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "categorias_produtos_update" ON public.categorias_produtos;
CREATE POLICY "categorias_produtos_update" ON public.categorias_produtos
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "categorias_produtos_delete" ON public.categorias_produtos;
CREATE POLICY "categorias_produtos_delete" ON public.categorias_produtos
  FOR DELETE TO authenticated USING (true);

DROP TRIGGER IF EXISTS categorias_produtos_updated_at ON public.categorias_produtos;
CREATE TRIGGER categorias_produtos_updated_at
  BEFORE UPDATE ON public.categorias_produtos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

INSERT INTO public.categorias_produtos (nome, logo, status) VALUES
  ('Tornos CNC', NULL, 'Ativo'),
  ('Centros de Usinagem', NULL, 'Ativo'),
  ('Corte a Laser', NULL, 'Ativo'),
  ('Prensas e Dobradeiras', NULL, 'Ativo')
ON CONFLICT (nome) DO NOTHING;

-- ==========================================
-- marcas
-- ==========================================
CREATE TABLE IF NOT EXISTS public.marcas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Ativo',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_marcas_nome ON public.marcas(nome);

ALTER TABLE public.marcas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "marcas_select" ON public.marcas;
CREATE POLICY "marcas_select" ON public.marcas
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "marcas_insert" ON public.marcas;
CREATE POLICY "marcas_insert" ON public.marcas
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "marcas_update" ON public.marcas;
CREATE POLICY "marcas_update" ON public.marcas
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "marcas_delete" ON public.marcas;
CREATE POLICY "marcas_delete" ON public.marcas
  FOR DELETE TO authenticated USING (true);

DROP TRIGGER IF EXISTS marcas_updated_at ON public.marcas;
CREATE TRIGGER marcas_updated_at
  BEFORE UPDATE ON public.marcas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

INSERT INTO public.marcas (nome, status) VALUES
  ('Bener HighTech', 'Ativo'),
  ('Bener FiberCut', 'Ativo')
ON CONFLICT (nome) DO NOTHING;

-- ==========================================
-- produtos (minimal prerequisite table)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.produtos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Ativo',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;

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

DROP TRIGGER IF EXISTS produtos_updated_at ON public.produtos;
CREATE TRIGGER produtos_updated_at
  BEFORE UPDATE ON public.produtos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

INSERT INTO public.produtos (id, nome, status) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'Torno CNC Heavy Duty V8', 'Ativo'),
  ('a0000000-0000-0000-0000-000000000002', 'Centro de Usinagem MCU 5X', 'Ativo'),
  ('a0000000-0000-0000-0000-000000000003', 'Laser de Fibra Bener LCF', 'Ativo')
ON CONFLICT (id) DO NOTHING;

-- ==========================================
-- modelos
-- ==========================================
CREATE TABLE IF NOT EXISTS public.modelos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  produto UUID REFERENCES public.produtos(id) ON DELETE SET NULL,
  marca UUID REFERENCES public.marcas(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'Ativo',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.modelos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "modelos_select" ON public.modelos;
CREATE POLICY "modelos_select" ON public.modelos
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "modelos_insert" ON public.modelos;
CREATE POLICY "modelos_insert" ON public.modelos
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "modelos_update" ON public.modelos;
CREATE POLICY "modelos_update" ON public.modelos
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "modelos_delete" ON public.modelos;
CREATE POLICY "modelos_delete" ON public.modelos
  FOR DELETE TO authenticated USING (true);

DROP TRIGGER IF EXISTS modelos_updated_at ON public.modelos;
CREATE TRIGGER modelos_updated_at
  BEFORE UPDATE ON public.modelos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

INSERT INTO public.modelos (id, nome, produto, marca, status) VALUES
  ('b0000000-0000-0000-0000-000000000001', 'HD-V8 Standard', 'a0000000-0000-0000-0000-000000000001'::uuid, (SELECT id FROM public.marcas WHERE nome = 'Bener HighTech'), 'Ativo'),
  ('b0000000-0000-0000-0000-000000000002', 'MCU-5X Pro', 'a0000000-0000-0000-0000-000000000002'::uuid, (SELECT id FROM public.marcas WHERE nome = 'Bener HighTech'), 'Ativo'),
  ('b0000000-0000-0000-0000-000000000003', 'LCF-3015', 'a0000000-0000-0000-0000-000000000003'::uuid, (SELECT id FROM public.marcas WHERE nome = 'Bener FiberCut'), 'Ativo')
ON CONFLICT (id) DO NOTHING;
