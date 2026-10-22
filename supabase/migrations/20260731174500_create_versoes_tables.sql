-- Ensure update_updated_at function exists
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- tipos_proposta
-- ==========================================
CREATE TABLE IF NOT EXISTS public.tipos_proposta (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Ativo',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tipos_proposta_nome ON public.tipos_proposta(nome);

ALTER TABLE public.tipos_proposta ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tipos_proposta_select" ON public.tipos_proposta;
CREATE POLICY "tipos_proposta_select" ON public.tipos_proposta
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "tipos_proposta_insert" ON public.tipos_proposta;
CREATE POLICY "tipos_proposta_insert" ON public.tipos_proposta
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "tipos_proposta_update" ON public.tipos_proposta;
CREATE POLICY "tipos_proposta_update" ON public.tipos_proposta
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "tipos_proposta_delete" ON public.tipos_proposta;
CREATE POLICY "tipos_proposta_delete" ON public.tipos_proposta
  FOR DELETE TO authenticated USING (true);

DROP TRIGGER IF EXISTS tipos_proposta_updated_at ON public.tipos_proposta;
CREATE TRIGGER tipos_proposta_updated_at
  BEFORE UPDATE ON public.tipos_proposta
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

INSERT INTO public.tipos_proposta (nome, status) VALUES
  ('Venda', 'Ativo'),
  ('Locação', 'Ativo'),
  ('Turnkey', 'Ativo'),
  ('Usado', 'Ativo')
ON CONFLICT (nome) DO NOTHING;

-- ==========================================
-- versoes
-- ==========================================
CREATE TABLE IF NOT EXISTS public.versoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  modelo UUID REFERENCES public.modelos(id) ON DELETE SET NULL,
  nome TEXT NOT NULL,
  cod_erp TEXT,
  imagem_preview TEXT,
  moeda TEXT NOT NULL DEFAULT 'BRL',
  valor NUMERIC(12,2) NOT NULL DEFAULT 0,
  tem_fator BOOLEAN NOT NULL DEFAULT false,
  fator_nac NUMERIC(12,4) NOT NULL DEFAULT 1,
  valor_anterior NUMERIC(12,2),
  data_ultimo_reajuste TEXT,
  nome_abreviado TEXT,
  tem_estoque BOOLEAN NOT NULL DEFAULT false,
  desconto_max_representante NUMERIC(12,2) NOT NULL DEFAULT 0,
  desconto_max_bener NUMERIC(12,2) NOT NULL DEFAULT 0,
  estoque_total NUMERIC(12,2) NOT NULL DEFAULT 0,
  estoque_bloqueado NUMERIC(12,2) NOT NULL DEFAULT 0,
  estoque_reservado NUMERIC(12,2) NOT NULL DEFAULT 0,
  estoque_disponivel NUMERIC(12,2) NOT NULL DEFAULT 0,
  acessorios_standards TEXT,
  caracteristicas_construtivas TEXT,
  especificacoes_tecnicas TEXT,
  tipos_proposta JSONB NOT NULL DEFAULT '[]'::jsonb,
  atualizado_por TEXT,
  status TEXT NOT NULL DEFAULT 'Ativo',
  galeria JSONB,
  alerta_estoque_minimo NUMERIC(12,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.versoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "versoes_select" ON public.versoes;
CREATE POLICY "versoes_select" ON public.versoes
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "versoes_insert" ON public.versoes;
CREATE POLICY "versoes_insert" ON public.versoes
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "versoes_update" ON public.versoes;
CREATE POLICY "versoes_update" ON public.versoes
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "versoes_delete" ON public.versoes;
CREATE POLICY "versoes_delete" ON public.versoes
  FOR DELETE TO authenticated USING (true);

DROP TRIGGER IF EXISTS versoes_updated_at ON public.versoes;
CREATE TRIGGER versoes_updated_at
  BEFORE UPDATE ON public.versoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ==========================================
-- versoes_historico
-- ==========================================
CREATE TABLE IF NOT EXISTS public.versoes_historico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  versao_id UUID REFERENCES public.versoes(id) ON DELETE CASCADE,
  usuario TEXT,
  acao TEXT,
  detalhes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.versoes_historico ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "versoes_historico_select" ON public.versoes_historico;
CREATE POLICY "versoes_historico_select" ON public.versoes_historico
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "versoes_historico_insert" ON public.versoes_historico;
CREATE POLICY "versoes_historico_insert" ON public.versoes_historico
  FOR INSERT TO authenticated WITH CHECK (true);

-- ==========================================
-- Storage bucket for versoes images
-- ==========================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('versoes-images', 'versoes-images', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "versoes_images_select" ON storage.objects;
CREATE POLICY "versoes_images_select" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'versoes-images');

DROP POLICY IF EXISTS "versoes_images_insert" ON storage.objects;
CREATE POLICY "versoes_images_insert" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'versoes-images');

DROP POLICY IF EXISTS "versoes_images_update" ON storage.objects;
CREATE POLICY "versoes_images_update" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'versoes-images');

DROP POLICY IF EXISTS "versoes_images_delete" ON storage.objects;
CREATE POLICY "versoes_images_delete" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'versoes-images');
