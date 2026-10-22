-- Migration: Safely delete all records from public.versoes
-- 1. Disable the notify_critical_versoes trigger to prevent sending ~1,700 notification/HTTP emails
-- 2. Execute DELETE FROM public.versoes
--    - Cascade deletes:
--      * versao_tipos_proposta (ON DELETE CASCADE)
--      * acessorio_versoes (ON DELETE CASCADE)
--      * proposta_versoes (ON DELETE CASCADE)
--      * versoes_historico (ON DELETE CASCADE)
--    - Set null:
--      * propostas.versao (ON DELETE SET NULL)
-- 3. Re-enable the notify_critical_versoes trigger

DO $$
BEGIN
  -- Disable notify trigger on versoes
  ALTER TABLE public.versoes DISABLE TRIGGER notify_critical_versoes;

  -- Delete all versoes (cascade cleans children, propostas.versao becomes NULL)
  DELETE FROM public.versoes;

  -- Re-enable notify trigger on versoes
  ALTER TABLE public.versoes ENABLE TRIGGER notify_critical_versoes;
EXCEPTION
  WHEN OTHERS THEN
    -- Always guarantee trigger is re-enabled if any error occurs
    ALTER TABLE public.versoes ENABLE TRIGGER notify_critical_versoes;
    RAISE;
END $$;
