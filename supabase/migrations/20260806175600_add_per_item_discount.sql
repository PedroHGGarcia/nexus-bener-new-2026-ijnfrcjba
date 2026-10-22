ALTER TABLE public.proposta_versoes
  ADD COLUMN IF NOT EXISTS desconto_percentual NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS desconto_valor NUMERIC(12,2) DEFAULT 0;
