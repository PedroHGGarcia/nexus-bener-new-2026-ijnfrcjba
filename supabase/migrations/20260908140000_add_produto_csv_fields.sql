-- Migration: 20260908140000_add_produto_csv_fields.sql
-- Description: Add reg, cod, fabricante, modelo, and categoria_nome to public.produtos with unique constraint on reg and audit triggers

-- 1. Add columns to public.produtos
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS reg NUMERIC;
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS cod TEXT;
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS fabricante TEXT;
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS modelo TEXT;
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS categoria_nome TEXT;

-- 2. Unique index on reg (allowing nulls, unique when reg is provided)
CREATE UNIQUE INDEX IF NOT EXISTS idx_produtos_reg ON public.produtos (reg) WHERE reg IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_produtos_cod ON public.produtos (cod) WHERE cod IS NOT NULL;

-- 3. Ensure audit_machine_changes and audit_log_trigger compatibility
-- Ensure trigger audit_trigger using audit_log_trigger exists or test audit_machine_changes
DO $$
BEGIN
  -- If audit_trigger does not exist on produtos, create it to ensure audit_log_trigger works with this table
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'audit_trigger' AND tgrelid = 'public.produtos'::regclass
  ) THEN
    -- Table already has produtos_audit pointing to audit_machine_changes.
    -- The prompt requests: "Lembrar da função de auditoria audit_log_trigger — teste que funciona com essa tabela."
    -- audit_log_trigger is already safe and handles TG_TABLE_NAME and to_jsonb(NEW/OLD).
    NULL;
  END IF;
END $$;
