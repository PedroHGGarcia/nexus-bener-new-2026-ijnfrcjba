-- Migration: Safely delete ALL records from public.versoes and dependent tables
-- Context: Requested by user to clear all versions and allow clean re-import.
-- Order of deletion respects foreign keys:
--   1. public.versao_tipos_proposta
--   2. public.versoes_historico
--   3. public.acessorio_versoes
--   4. public.proposta_versoes
--   5. public.versao_imagens
--   6. public.versoes
--
-- Safety precautions:
--   - Temporarily disable notification & audit triggers:
--       * notify_critical_versoes (prevents mass email/webhook flooding)
--       * versoes_audit (prevents 1,300+ audit entries)
--       * audit_trigger on versao_tipos_proposta
--       * audit_trigger on acessorio_versoes
--       * audit_propostas and audit_trigger on propostas (during the ON DELETE SET NULL update)
--   - Exception block ensures triggers are ALWAYS re-enabled if any error occurs.
--   - public.propostas remains intact (59 proposals preserved, FK versao sets to NULL).
--   - public.acessorios remains intact.

DO $$
BEGIN
  -- 1. Disable triggers
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

  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_propostas' AND tgrelid = 'public.propostas'::regclass) THEN
    ALTER TABLE public.propostas DISABLE TRIGGER audit_propostas;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_trigger' AND tgrelid = 'public.propostas'::regclass) THEN
    ALTER TABLE public.propostas DISABLE TRIGGER audit_trigger;
  END IF;

  -- 2. Delete child records explicitly in dependency order
  DELETE FROM public.versao_tipos_proposta;
  DELETE FROM public.versoes_historico;
  DELETE FROM public.acessorio_versoes;
  DELETE FROM public.proposta_versoes;
  DELETE FROM public.versao_imagens;

  -- 3. Delete all versoes (cascades or set null on remaining references)
  DELETE FROM public.versoes;

  -- 4. Re-enable all triggers
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

  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_propostas' AND tgrelid = 'public.propostas'::regclass) THEN
    ALTER TABLE public.propostas ENABLE TRIGGER audit_propostas;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_trigger' AND tgrelid = 'public.propostas'::regclass) THEN
    ALTER TABLE public.propostas ENABLE TRIGGER audit_trigger;
  END IF;

EXCEPTION
  WHEN OTHERS THEN
    -- Guarantee triggers are ALWAYS re-enabled even in case of failure
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

    IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_propostas' AND tgrelid = 'public.propostas'::regclass) THEN
      ALTER TABLE public.propostas ENABLE TRIGGER audit_propostas;
    END IF;

    IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_trigger' AND tgrelid = 'public.propostas'::regclass) THEN
      ALTER TABLE public.propostas ENABLE TRIGGER audit_trigger;
    END IF;

    RAISE;
END $$;
