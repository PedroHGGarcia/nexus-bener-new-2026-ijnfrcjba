-- Ensure all columns required for Licitação proposals exist on public.propostas
ALTER TABLE public.propostas ADD COLUMN IF NOT EXISTS modelo_licitacao BOOLEAN DEFAULT false;
ALTER TABLE public.propostas ADD COLUMN IF NOT EXISTS criterios_aceitacao TEXT;
ALTER TABLE public.propostas ADD COLUMN IF NOT EXISTS normas_aplicaveis TEXT;
ALTER TABLE public.propostas ADD COLUMN IF NOT EXISTS normas_seguranca TEXT;
ALTER TABLE public.propostas ADD COLUMN IF NOT EXISTS certificacoes TEXT;
ALTER TABLE public.propostas ADD COLUMN IF NOT EXISTS certificacoes_seguranca TEXT;
ALTER TABLE public.propostas ADD COLUMN IF NOT EXISTS cobertura_garantia TEXT;
ALTER TABLE public.propostas ADD COLUMN IF NOT EXISTS assistencia_tecnica_detalhada TEXT;
ALTER TABLE public.propostas ADD COLUMN IF NOT EXISTS materiais_utilizados TEXT;
ALTER TABLE public.propostas ADD COLUMN IF NOT EXISTS garantia_acessorios TEXT;
ALTER TABLE public.propostas ADD COLUMN IF NOT EXISTS secoes_adicionais JSONB;
ALTER TABLE public.propostas ADD COLUMN IF NOT EXISTS acessorios_proposta JSONB;
ALTER TABLE public.propostas ADD COLUMN IF NOT EXISTS emails_notificacao TEXT;
ALTER TABLE public.propostas ADD COLUMN IF NOT EXISTS nota_rep NUMERIC;

-- Enable RLS and idempotent policies for propostas
ALTER TABLE public.propostas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "propostas_authenticated_all" ON public.propostas;
CREATE POLICY "propostas_authenticated_all" ON public.propostas
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "propostas_anon_select" ON public.propostas;
CREATE POLICY "propostas_anon_select" ON public.propostas
  FOR SELECT TO anon USING (true);
