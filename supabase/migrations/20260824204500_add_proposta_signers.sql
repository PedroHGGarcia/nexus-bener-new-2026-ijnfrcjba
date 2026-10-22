-- Migration to add proposal signature restriction columns
-- Adds signer links and audit columns for representative and manager signatures

ALTER TABLE public.propostas
  ADD COLUMN IF NOT EXISTS assinante_representante_id UUID REFERENCES public.representantes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assinante_gerente_id UUID REFERENCES public.gerentes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assinado_por_representante UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assinado_por_gerente UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS data_assinatura_representante TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS data_assinatura_gerente TIMESTAMPTZ;

-- Backfill existing proposals: set assinante_representante_id = representante and assinante_gerente_id = gerente
UPDATE public.propostas
SET
  assinante_representante_id = COALESCE(assinante_representante_id, representante),
  assinante_gerente_id = COALESCE(assinante_gerente_id, gerente)
WHERE assinante_representante_id IS NULL OR assinante_gerente_id IS NULL;

-- Indexes for signer lookups
CREATE INDEX IF NOT EXISTS idx_propostas_assinante_representante ON public.propostas(assinante_representante_id);
CREATE INDEX IF NOT EXISTS idx_propostas_assinante_gerente ON public.propostas(assinante_gerente_id);
