-- Migration: Add signature tracking columns to public.propostas
ALTER TABLE public.propostas
  ADD COLUMN IF NOT EXISTS assinante_representante_id UUID,
  ADD COLUMN IF NOT EXISTS assinante_gerente_id UUID,
  ADD COLUMN IF NOT EXISTS assinado_por_representante UUID,
  ADD COLUMN IF NOT EXISTS assinado_por_gerente UUID,
  ADD COLUMN IF NOT EXISTS data_assinatura_representante TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS data_assinatura_gerente TIMESTAMPTZ;
