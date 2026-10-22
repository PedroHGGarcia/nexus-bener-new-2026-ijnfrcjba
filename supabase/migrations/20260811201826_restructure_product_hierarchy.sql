-- ==========================================
-- Restructure product hierarchy: Categoria → Marca → Modelo → Versão → Acessório
-- - Add categoria FK to marcas
-- - Create acessorio_versoes junction table (replacing JSONB link)
-- - Migrate existing acessorios.versoes JSONB data into junction table
-- - Preserve existing FKs: versoes.modelo → modelos(id), modelos.marca → marcas(id)
-- - produtos table remains untouched
-- ==========================================

-- 1. Add categoria FK column to marcas
ALTER TABLE public.marcas
  ADD COLUMN IF NOT EXISTS categoria UUID REFERENCES public.categorias_produtos(id) ON DELETE SET NULL;

-- 2. Create acessorio_versoes junction table
CREATE TABLE IF NOT EXISTS public.acessorio_versoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  acessorio_id UUID NOT NULL REFERENCES public.acessorios(id) ON DELETE CASCADE,
  versao_id UUID NOT NULL REFERENCES public.versoes(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(acessorio_id, versao_id)
);

CREATE INDEX IF NOT EXISTS idx_acessorio_versoes_acessorio ON public.acessorio_versoes(acessorio_id);
CREATE INDEX IF NOT EXISTS idx_acessorio_versoes_versao ON public.acessorio_versoes(versao_id);

-- 3. RLS policies for acessorio_versoes
ALTER TABLE public.acessorio_versoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "acessorio_versoes_select" ON public.acessorio_versoes;
CREATE POLICY "acessorio_versoes_select" ON public.acessorio_versoes
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "acessorio_versoes_insert" ON public.acessorio_versoes;
CREATE POLICY "acessorio_versoes_insert" ON public.acessorio_versoes
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "acessorio_versoes_update" ON public.acessorio_versoes;
CREATE POLICY "acessorio_versoes_update" ON public.acessorio_versoes
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "acessorio_versoes_delete" ON public.acessorio_versoes;
CREATE POLICY "acessorio_versoes_delete" ON public.acessorio_versoes
  FOR DELETE TO authenticated USING (true);

-- 4. Migrate existing JSONB data from acessorios.versoes into junction table
--    Handles both array-of-strings (UUIDs) and array-of-objects ({ "versao_id": "..." })
DO $$
DECLARE
  accessorio_record RECORD;
  elem JSONB;
  versao_uuid UUID;
BEGIN
  FOR accessorio_record IN
    SELECT id, versoes FROM public.acessorios
    WHERE versoes IS NOT NULL AND jsonb_typeof(versoes) = 'array'
  LOOP
    FOR elem IN SELECT * FROM jsonb_array_elements(accessorio_record.versoes)
    LOOP
      BEGIN
        IF jsonb_typeof(elem) = 'string' THEN
          versao_uuid := elem::text::uuid;
          INSERT INTO public.acessorio_versoes (acessorio_id, versao_id)
          VALUES (accessorio_record.id, versao_uuid)
          ON CONFLICT (acessorio_id, versao_id) DO NOTHING;
        ELSIF jsonb_typeof(elem) = 'object' AND elem ? 'versao_id' THEN
          versao_uuid := (elem->>'versao_id')::uuid;
          INSERT INTO public.acessorio_versoes (acessorio_id, versao_id)
          VALUES (accessorio_record.id, versao_uuid)
          ON CONFLICT (acessorio_id, versao_id) DO NOTHING;
        ELSIF jsonb_typeof(elem) = 'object' AND elem ? 'id' THEN
          versao_uuid := (elem->>'id')::uuid;
          INSERT INTO public.acessorio_versoes (acessorio_id, versao_id)
          VALUES (accessorio_record.id, versao_uuid)
          ON CONFLICT (acessorio_id, versao_id) DO NOTHING;
        END IF;
      EXCEPTION WHEN OTHERS THEN
        -- Skip invalid entries that cannot be cast to UUID
        NULL;
      END;
    END LOOP;
  END LOOP;
END $$;

-- 5. Add audit trigger to acessorio_versoes (function already created by earlier migration)
DROP TRIGGER IF EXISTS audit_trigger ON public.acessorio_versoes;
CREATE TRIGGER audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.acessorio_versoes
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();

-- 6. Add acessorio_versoes to realtime publication (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'acessorio_versoes'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.acessorio_versoes;
  END IF;
END $$;
