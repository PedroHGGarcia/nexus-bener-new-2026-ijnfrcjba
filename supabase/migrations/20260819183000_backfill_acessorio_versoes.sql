-- Backfill the acessorio_versoes join table from the legacy `acessorios.versoes`
-- JSONB array column, then install a trigger that keeps the join table in sync
-- with any future writes to that column (so both the old and the new mechanism
-- stay consistent during the transition).
--
-- This unblocks the "accessories filtered by version" requirement in
-- PropostaAcessoriosSection, which now reads exclusively from the join table.

-- 1. Backfill existing links from the legacy JSONB array.
INSERT INTO public.acessorio_versoes (acessorio_id, versao_id)
SELECT
  a.id,
  v.value::uuid AS versao_id
FROM public.acessorios a
CROSS JOIN LATERAL jsonb_array_elements_text(a.versoes) AS v(value)
WHERE jsonb_array_length(COALESCE(a.versoes, '[]'::jsonb)) > 0
ON CONFLICT (acessorio_id, versao_id) DO NOTHING;

-- 2. Function + trigger: keep acessorio_versoes mirrored when
--    acessorios.versoes is written/updated via the legacy path.
CREATE OR REPLACE FUNCTION public.sync_acessorio_versoes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Replace the join-table rows for this acessorio with whatever the JSONB
  -- array now contains. Only touch rows for THIS acessorio.
  DELETE FROM public.acessorio_versoes WHERE acessorio_id = NEW.id;

  INSERT INTO public.acessorio_versoes (acessorio_id, versao_id)
  SELECT NEW.id, v.value::uuid
  FROM jsonb_array_elements_text(COALESCE(NEW.versoes, '[]'::jsonb)) AS v(value)
  WHERE v.value IS NOT NULL
  ON CONFLICT (acessorio_id, versao_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_acessorio_versoes ON public.acessorios;
CREATE TRIGGER trg_sync_acessorio_versoes
  AFTER INSERT OR UPDATE OF versoes ON public.acessorios
  FOR EACH ROW EXECUTE FUNCTION public.sync_acessorio_versoes();
