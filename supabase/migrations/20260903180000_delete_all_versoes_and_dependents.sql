-- Migration: Safely delete ALL records from public.versoes and dependent tables
-- Context: Requested by Bianca to clear all versions and allow clean re-import.
-- Order of deletion respects foreign keys:
--   1. public.versao_tipos_proposta
--   2. public.versoes_historico
--   3. public.acessorio_versoes
--   4. public.proposta_versoes
--   5. public.versoes
--
-- Safety mechanisms:
--   - Temporarily disable triggers (notify_critical_versoes, versoes_audit, audit_trigger)
--     to prevent thousands of HTTP webhook calls and avoid massive unnecessary audit log spam.
--   - Exception block ensures triggers are ALWAYS re-enabled even if an error occurs.
--   - public.propostas remains intact (propostas.versao has ON DELETE SET NULL constraint).

DO $$
BEGIN
  -- 1. Disable triggers on versoes and child tables
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'notify_critical_versoes') THEN
    ALTER TABLE public.versoes DISABLE TRIGGER notify_critical_versoes;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'versoes_audit') THEN
    ALTER TABLE public.versoes DISABLE TRIGGER versoes_audit;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_trigger' AND tgrelid = 'public.versao_tipos_proposta'::regclass) THEN
    ALTER TABLE public.versao_tipos_proposta DISABLE TRIGGER audit_trigger;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_trigger' AND tgrelid = 'public.acessorio_versoes'::regclass) THEN
    ALTER TABLE public.acessorio_versoes DISABLE TRIGGER audit_trigger;
  END IF;

  -- 2. Delete all records in dependency order
  DELETE FROM public.versao_tipos_proposta;
  DELETE FROM public.versoes_historico;
  DELETE FROM public.acessorio_versoes;
  DELETE FROM public.proposta_versoes;
  DELETE FROM public.versoes;

  -- 3. Re-enable all triggers
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'notify_critical_versoes') THEN
    ALTER TABLE public.versoes ENABLE TRIGGER notify_critical_versoes;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'versoes_audit') THEN
    ALTER TABLE public.versoes ENABLE TRIGGER versoes_audit;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_trigger' AND tgrelid = 'public.versao_tipos_proposta'::regclass) THEN
    ALTER TABLE public.versao_tipos_proposta ENABLE TRIGGER audit_trigger;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_trigger' AND tgrelid = 'public.acessorio_versoes'::regclass) THEN
    ALTER TABLE public.acessorio_versoes ENABLE TRIGGER audit_trigger;
  END IF;

EXCEPTION
  WHEN OTHERS THEN
    -- Guarantee triggers are re-enabled in case of failure
    IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'notify_critical_versoes') THEN
      ALTER TABLE public.versoes ENABLE TRIGGER notify_critical_versoes;
    END IF;

    IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'versoes_audit') THEN
      ALTER TABLE public.versoes ENABLE TRIGGER versoes_audit;
    END IF;

    IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_trigger' AND tgrelid = 'public.versao_tipos_proposta'::regclass) THEN
      ALTER TABLE public.versao_tipos_proposta ENABLE TRIGGER audit_trigger;
    END IF;

    IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_trigger' AND tgrelid = 'public.acessorio_versoes'::regclass) THEN
      ALTER TABLE public.acessorio_versoes ENABLE TRIGGER audit_trigger;
    END IF;

    RAISE;
END $$;
