-- Migration: Add tipo_proposta_override column to propostas table
-- Stores a per-proposal snapshot/override of the proposal type commercial terms and fields,
-- ensuring edits made inside quote creation flow never mutate the master tipo_proposta catalog.

ALTER TABLE public.propostas
ADD COLUMN IF NOT EXISTS tipo_proposta_override jsonb DEFAULT NULL;

COMMENT ON COLUMN public.propostas.tipo_proposta_override IS 'Snapshot local dos campos comerciais e customizados do tipo de proposta para esta proposta específica.';
