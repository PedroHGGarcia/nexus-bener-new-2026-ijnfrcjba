CREATE TABLE IF NOT EXISTS public.proposta_versoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposta_id UUID NOT NULL REFERENCES public.propostas(id) ON DELETE CASCADE,
  versao_id UUID NOT NULL REFERENCES public.versoes(id) ON DELETE CASCADE,
  quantidade INTEGER NOT NULL DEFAULT 1,
  valor_unitario NUMERIC(14,2) NOT NULL DEFAULT 0,
  ordem INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_proposta_versoes_proposta
  ON public.proposta_versoes(proposta_id);
CREATE INDEX IF NOT EXISTS idx_proposta_versoes_versao
  ON public.proposta_versoes(versao_id);

ALTER TABLE public.proposta_versoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "proposta_versoes_select" ON public.proposta_versoes;
CREATE POLICY "proposta_versoes_select" ON public.proposta_versoes
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "proposta_versoes_insert" ON public.proposta_versoes;
CREATE POLICY "proposta_versoes_insert" ON public.proposta_versoes
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "proposta_versoes_update" ON public.proposta_versoes;
CREATE POLICY "proposta_versoes_update" ON public.proposta_versoes
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "proposta_versoes_delete" ON public.proposta_versoes;
CREATE POLICY "proposta_versoes_delete" ON public.proposta_versoes
  FOR DELETE TO authenticated USING (true);

DROP TRIGGER IF EXISTS proposta_versoes_updated_at ON public.proposta_versoes;
CREATE TRIGGER proposta_versoes_updated_at
  BEFORE UPDATE ON public.proposta_versoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
