CREATE TABLE IF NOT EXISTS public.acessorios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  tipo TEXT,
  moeda TEXT,
  valor NUMERIC(12,2),
  fator_nac NUMERIC(12,4),
  status TEXT,
  versoes JSONB,
  especificacoes_tecnicas TEXT,
  valor_anterior NUMERIC(12,2),
  data_ultimo_reajuste TEXT,
  atualizado_por TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.acessorios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "acessorios_select" ON public.acessorios;
CREATE POLICY "acessorios_select" ON public.acessorios
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "acessorios_insert" ON public.acessorios;
CREATE POLICY "acessorios_insert" ON public.acessorios
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "acessorios_update" ON public.acessorios;
CREATE POLICY "acessorios_update" ON public.acessorios
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "acessorios_delete" ON public.acessorios;
CREATE POLICY "acessorios_delete" ON public.acessorios
  FOR DELETE TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS acessorios_updated_at ON public.acessorios;
CREATE TRIGGER acessorios_updated_at
  BEFORE UPDATE ON public.acessorios
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.acessorios WHERE nome = 'Alimentador Automático de Barras') THEN
    INSERT INTO public.acessorios (nome, tipo, moeda, valor, fator_nac, status, versoes, especificacoes_tecnicas)
    VALUES ('Alimentador Automático de Barras', 'Automação', 'BRL', 45000.00, 1.0000, 'Ativo', '[]'::jsonb, 'Alimentação contínua para tornos CNC com barra de até 4m.');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.acessorios WHERE nome = 'Exaustor de Fumaça Laser 12kW') THEN
    INSERT INTO public.acessorios (nome, tipo, moeda, valor, fator_nac, status, versoes, especificacoes_tecnicas)
    VALUES ('Exaustor de Fumaça Laser 12kW', 'Acessório Ambiental', 'BRL', 28000.00, 1.0000, 'Ativo', '[]'::jsonb, 'Sistema de filtragem e conformidade ambiental para lasers de 12kW.');
  END IF;
END $$;
