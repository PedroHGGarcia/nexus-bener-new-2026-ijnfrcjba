-- Migration: add columns to marcas for brand imports
-- Adds reg (numeric, unique), cod (numeric), site (text), pais (text)
-- Idempotent migration following project guidelines

ALTER TABLE public.marcas
  ADD COLUMN IF NOT EXISTS reg NUMERIC,
  ADD COLUMN IF NOT EXISTS cod NUMERIC,
  ADD COLUMN IF NOT EXISTS site TEXT,
  ADD COLUMN IF NOT EXISTS pais TEXT;

-- Create unique index on reg (when not null and not deleted)
CREATE UNIQUE INDEX IF NOT EXISTS idx_marcas_reg ON public.marcas USING btree (reg) WHERE (deleted_at IS NULL);

-- Create index on cod
CREATE INDEX IF NOT EXISTS idx_marcas_cod ON public.marcas USING btree (cod);

-- Notify schema update
COMMENT ON COLUMN public.marcas.reg IS 'ID numérico de cruzamento (ERP/origem)';
COMMENT ON COLUMN public.marcas.cod IS 'Código numérico da marca';
COMMENT ON COLUMN public.marcas.site IS 'Site / URL do fabricante ou marca';
COMMENT ON COLUMN public.marcas.pais IS 'País de origem do fabricante ou marca';
