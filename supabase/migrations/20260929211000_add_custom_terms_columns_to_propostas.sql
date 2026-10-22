-- Migration: add terms columns to public.propostas (frase_preco, frase_comissao, treinamento_tecnico)
-- This allows proposals to store customized terms independently without modifying tipos_proposta

ALTER TABLE public.propostas
  ADD COLUMN IF NOT EXISTS frase_preco TEXT,
  ADD COLUMN IF NOT EXISTS frase_comissao TEXT,
  ADD COLUMN IF NOT EXISTS treinamento_tecnico TEXT;
