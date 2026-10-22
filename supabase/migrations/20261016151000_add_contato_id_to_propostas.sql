-- Migration: Add contato_id to propostas table
-- Timestamp: 20261016151000

ALTER TABLE public.propostas
  ADD COLUMN IF NOT EXISTS contato_id UUID REFERENCES public.cliente_contatos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_propostas_contato_id ON public.propostas(contato_id);
