-- ==========================================
-- Create versao_tipos_proposta join table
--
-- Links Versões (machine versions) to Tipos de Proposta (proposal types) so
-- that Emitir Proposta can filter the "Tipo de Proposta" dropdown to only the
-- tipos linked to the selected version/equipment.
--
-- This complements (does not remove) the existing versoes.tipos_proposta JSONB
-- column, which keeps storing tipo names for backward compatibility. The join
-- table becomes the source of truth for the Emitir Proposta filter.
-- ==========================================

-- 1. Create the junction table (composite PK on both FK columns)
CREATE TABLE IF NOT EXISTS public.versao_tipos_proposta (
  versao_id UUID NOT NULL REFERENCES public.versoes(id) ON DELETE CASCADE,
  tipo_proposta_id UUID NOT NULL REFERENCES public.tipos_proposta(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (versao_id, tipo_proposta_id)
);

CREATE INDEX IF NOT EXISTS idx_versao_tipos_proposta_versao
  ON public.versao_tipos_proposta(versao_id);
CREATE INDEX IF NOT EXISTS idx_versao_tipos_proposta_tipo
  ON public.versao_tipos_proposta(tipo_proposta_id);

-- 2. RLS policies (mirror acessorio_versoes)
ALTER TABLE public.versao_tipos_proposta ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "versao_tipos_proposta_select" ON public.versao_tipos_proposta;
CREATE POLICY "versao_tipos_proposta_select" ON public.versao_tipos_proposta
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "versao_tipos_proposta_insert" ON public.versao_tipos_proposta;
CREATE POLICY "versao_tipos_proposta_insert" ON public.versao_tipos_proposta
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "versao_tipos_proposta_update" ON public.versao_tipos_proposta;
CREATE POLICY "versao_tipos_proposta_update" ON public.versao_tipos_proposta
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "versao_tipos_proposta_delete" ON public.versao_tipos_proposta;
CREATE POLICY "versao_tipos_proposta_delete" ON public.versao_tipos_proposta
  FOR DELETE TO authenticated USING (true);

-- 3. Migrate existing JSONB data from versoes.tipos_proposta into the junction
--    table, resolving tipo names -> tipos_proposta.id. Handles both
--    array-of-strings (names) and array-of-objects ({ "nome" | "id" }).
DO $$
DECLARE
  v_rec RECORD;
  elem JSONB;
  tipo_name TEXT;
  tipo_id UUID;
BEGIN
  FOR v_rec IN
    SELECT id, tipos_proposta FROM public.versoes
    WHERE tipos_proposta IS NOT NULL AND jsonb_typeof(tipos_proposta) = 'array'
  LOOP
    FOR elem IN SELECT * FROM jsonb_array_elements(v_rec.tipos_proposta)
    LOOP
      BEGIN
        IF jsonb_typeof(elem) = 'string' THEN
          tipo_name := elem #>> '{}';
          SELECT id INTO tipo_id FROM public.tipos_proposta WHERE nome = tipo_name LIMIT 1;
          IF tipo_id IS NOT NULL THEN
            INSERT INTO public.versao_tipos_proposta (versao_id, tipo_proposta_id)
            VALUES (v_rec.id, tipo_id)
            ON CONFLICT (versao_id, tipo_proposta_id) DO NOTHING;
          END IF;
        ELSIF jsonb_typeof(elem) = 'object' AND elem ? 'id' THEN
          tipo_id := (elem->>'id')::uuid;
          INSERT INTO public.versao_tipos_proposta (versao_id, tipo_proposta_id)
          VALUES (v_rec.id, tipo_id)
          ON CONFLICT (versao_id, tipo_proposta_id) DO NOTHING;
        ELSIF jsonb_typeof(elem) = 'object' AND elem ? 'nome' THEN
          tipo_name := elem->>'nome';
          SELECT id INTO tipo_id FROM public.tipos_proposta WHERE nome = tipo_name LIMIT 1;
          IF tipo_id IS NOT NULL THEN
            INSERT INTO public.versao_tipos_proposta (versao_id, tipo_proposta_id)
            VALUES (v_rec.id, tipo_id)
            ON CONFLICT (versao_id, tipo_proposta_id) DO NOTHING;
          END IF;
        END IF;
      EXCEPTION WHEN OTHERS THEN
        -- Skip invalid entries that cannot be resolved/cast
        NULL;
      END;
    END LOOP;
  END LOOP;
END $$;

-- 4. Audit trigger (function already created by an earlier migration)
DROP TRIGGER IF EXISTS audit_trigger ON public.versao_tipos_proposta;
CREATE TRIGGER audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.versao_tipos_proposta
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();

-- 5. Add to realtime publication (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'versao_tipos_proposta'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.versao_tipos_proposta;
  END IF;
END $$;
