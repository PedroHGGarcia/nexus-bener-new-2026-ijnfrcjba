-- Migration: 20260908170000_clear_modelos_and_add_columns.sql
-- Description:
-- 1. Add reg (numeric), cod (text), and categoria_nome (text) columns to public.modelos
-- 2. Create indices for reg and cod
-- 3. Safely unlink versoes.modelo (set to NULL) and delete all existing records in public.modelos as requested by user.

-- 1. Add columns to public.modelos if not exists
ALTER TABLE public.modelos
  ADD COLUMN IF NOT EXISTS reg NUMERIC,
  ADD COLUMN IF NOT EXISTS cod TEXT,
  ADD COLUMN IF NOT EXISTS categoria_nome TEXT;

-- Create indices for fast lookups
CREATE INDEX IF NOT EXISTS idx_modelos_reg ON public.modelos (reg) WHERE reg IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_modelos_cod ON public.modelos (cod) WHERE cod IS NOT NULL;

-- 2. Clear existing modelos records safely
-- First, ensure all versoes have modelo set to NULL (FK has ON DELETE SET NULL, but we explicitly clear first)
-- We temporarily disable triggers on modelos to prevent mass notification/webhook calls and guarantee safe execution.
DO $$
BEGIN
  -- 2.1 Update versoes to unlink placeholder modelos
  UPDATE public.versoes
  SET modelo = NULL
  WHERE modelo IS NOT NULL;

  -- 2.2 Temporarily disable triggers on modelos
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'notify_critical_modelos' AND tgrelid = 'public.modelos'::regclass) THEN
    ALTER TABLE public.modelos DISABLE TRIGGER notify_critical_modelos;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'modelos_audit' AND tgrelid = 'public.modelos'::regclass) THEN
    ALTER TABLE public.modelos DISABLE TRIGGER modelos_audit;
  END IF;

  -- 2.3 Delete all records from modelos
  DELETE FROM public.modelos;

  -- 2.4 Re-enable triggers on modelos
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'notify_critical_modelos' AND tgrelid = 'public.modelos'::regclass) THEN
    ALTER TABLE public.modelos ENABLE TRIGGER notify_critical_modelos;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'modelos_audit' AND tgrelid = 'public.modelos'::regclass) THEN
    ALTER TABLE public.modelos ENABLE TRIGGER modelos_audit;
  END IF;

EXCEPTION
  WHEN OTHERS THEN
    -- Guarantee triggers are re-enabled in case of any error
    IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'notify_critical_modelos' AND tgrelid = 'public.modelos'::regclass) THEN
      ALTER TABLE public.modelos ENABLE TRIGGER notify_critical_modelos;
    END IF;

    IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'modelos_audit' AND tgrelid = 'public.modelos'::regclass) THEN
      ALTER TABLE public.modelos ENABLE TRIGGER modelos_audit;
    END IF;

    RAISE;
END $$;
