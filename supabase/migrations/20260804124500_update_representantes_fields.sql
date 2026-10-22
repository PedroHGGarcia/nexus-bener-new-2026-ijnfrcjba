-- Add new columns to the existing representantes table (idempotent)
ALTER TABLE public.representantes ADD COLUMN IF NOT EXISTS documento TEXT;
ALTER TABLE public.representantes ADD COLUMN IF NOT EXISTS rd_station_id TEXT;
ALTER TABLE public.representantes ADD COLUMN IF NOT EXISTS razao_social TEXT;
ALTER TABLE public.representantes ADD COLUMN IF NOT EXISTS telefone_principal TEXT;
ALTER TABLE public.representantes ADD COLUMN IF NOT EXISTS telefones JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.representantes ADD COLUMN IF NOT EXISTS emails JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.representantes ADD COLUMN IF NOT EXISTS cep TEXT;
ALTER TABLE public.representantes ADD COLUMN IF NOT EXISTS estado TEXT;
ALTER TABLE public.representantes ADD COLUMN IF NOT EXISTS cidade TEXT;
ALTER TABLE public.representantes ADD COLUMN IF NOT EXISTS bairro TEXT;
ALTER TABLE public.representantes ADD COLUMN IF NOT EXISTS logradouro TEXT;
ALTER TABLE public.representantes ADD COLUMN IF NOT EXISTS numero TEXT;
ALTER TABLE public.representantes ADD COLUMN IF NOT EXISTS complementos TEXT;

-- RLS policies (idempotent — drop then create)
DROP POLICY IF EXISTS "representantes_select_policy" ON public.representantes;
CREATE POLICY "representantes_select_policy" ON public.representantes
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "representantes_insert_policy" ON public.representantes;
CREATE POLICY "representantes_insert_policy" ON public.representantes
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "representantes_update_policy" ON public.representantes;
CREATE POLICY "representantes_update_policy" ON public.representantes
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "representantes_delete_policy" ON public.representantes;
CREATE POLICY "representantes_delete_policy" ON public.representantes
  FOR DELETE TO authenticated USING (true);
