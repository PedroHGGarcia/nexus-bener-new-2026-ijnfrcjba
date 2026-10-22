CREATE TABLE IF NOT EXISTS public.area_atuacao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  representante UUID REFERENCES public.representantes(id) ON DELETE SET NULL,
  geometria JSONB,
  cor TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.area_atuacao ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "area_atuacao_select" ON public.area_atuacao;
CREATE POLICY "area_atuacao_select" ON public.area_atuacao
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "area_atuacao_insert" ON public.area_atuacao;
CREATE POLICY "area_atuacao_insert" ON public.area_atuacao
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "area_atuacao_update" ON public.area_atuacao;
CREATE POLICY "area_atuacao_update" ON public.area_atuacao
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "area_atuacao_delete" ON public.area_atuacao;
CREATE POLICY "area_atuacao_delete" ON public.area_atuacao
  FOR DELETE TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.update_area_atuacao_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS area_atuacao_updated_at ON public.area_atuacao;
CREATE TRIGGER area_atuacao_updated_at
  BEFORE UPDATE ON public.area_atuacao
  FOR EACH ROW EXECUTE FUNCTION public.update_area_atuacao_updated_at();
