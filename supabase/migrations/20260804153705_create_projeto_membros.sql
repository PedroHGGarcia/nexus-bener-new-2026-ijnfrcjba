CREATE TABLE IF NOT EXISTS public.projeto_membros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id UUID NOT NULL REFERENCES public.projetos(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  papel TEXT NOT NULL DEFAULT 'Colaborador',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_projeto_membros_projeto_user
  ON public.projeto_membros (projeto_id, user_id);

ALTER TABLE public.projeto_membros ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "projeto_membros_select" ON public.projeto_membros;
CREATE POLICY "projeto_membros_select" ON public.projeto_membros
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "projeto_membros_insert" ON public.projeto_membros;
CREATE POLICY "projeto_membros_insert" ON public.projeto_membros
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "projeto_membros_update" ON public.projeto_membros;
CREATE POLICY "projeto_membros_update" ON public.projeto_membros
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "projeto_membros_delete" ON public.projeto_membros;
CREATE POLICY "projeto_membros_delete" ON public.projeto_membros
  FOR DELETE TO authenticated USING (true);

INSERT INTO public.projeto_membros (projeto_id, user_id, papel)
SELECT p.id, p."user"::uuid, 'Criador'
FROM public.projetos p
WHERE p."user" IS NOT NULL
  AND p."user" ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND EXISTS (SELECT 1 FROM public.profiles WHERE id = p."user"::uuid)
ON CONFLICT (projeto_id, user_id) DO NOTHING;
