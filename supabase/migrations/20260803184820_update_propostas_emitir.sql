-- Ensure all columns required by Emitir Proposta page exist on public.propostas
ALTER TABLE public.propostas ADD COLUMN IF NOT EXISTS emails_notificacao TEXT;
ALTER TABLE public.propostas ADD COLUMN IF NOT EXISTS versoes_comparacao JSONB;
ALTER TABLE public.propostas ADD COLUMN IF NOT EXISTS moeda TEXT DEFAULT 'BRL';
ALTER TABLE public.propostas ADD COLUMN IF NOT EXISTS nome_gerente_produto TEXT;
ALTER TABLE public.propostas ADD COLUMN IF NOT EXISTS nome_representante_comercial TEXT;
ALTER TABLE public.propostas ADD COLUMN IF NOT EXISTS assinatura_representante TEXT;
ALTER TABLE public.propostas ADD COLUMN IF NOT EXISTS acessorios_proposta JSONB;

-- Ensure RLS is active and policies exist
ALTER TABLE public.propostas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "propostas_authenticated_all" ON public.propostas;
CREATE POLICY "propostas_authenticated_all" ON public.propostas
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "propostas_anon_select" ON public.propostas;
CREATE POLICY "propostas_anon_select" ON public.propostas
  FOR SELECT TO anon USING (true);
