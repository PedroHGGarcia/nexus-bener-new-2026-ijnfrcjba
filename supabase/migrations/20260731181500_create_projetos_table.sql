CREATE TABLE IF NOT EXISTS public.projetos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  descricao TEXT,
  cliente UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'Em Andamento',
  "user" TEXT,
  ooo TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.projetos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "projetos_select" ON public.projetos;
CREATE POLICY "projetos_select" ON public.projetos
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "projetos_insert" ON public.projetos;
CREATE POLICY "projetos_insert" ON public.projetos
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "projetos_update" ON public.projetos;
CREATE POLICY "projetos_update" ON public.projetos
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "projetos_delete" ON public.projetos;
CREATE POLICY "projetos_delete" ON public.projetos
  FOR DELETE TO authenticated USING (true);

DROP TRIGGER IF EXISTS projetos_updated_at ON public.projetos;
CREATE TRIGGER projetos_updated_at
  BEFORE UPDATE ON public.projetos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'propostas'
    AND column_name = 'projeto' AND data_type = 'text'
  ) THEN
    UPDATE public.propostas SET projeto = NULL
    WHERE projeto IS NOT NULL
    AND (projeto = '' OR projeto !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$');

    ALTER TABLE public.propostas ALTER COLUMN projeto TYPE UUID USING projeto::UUID;
  END IF;
END $$;

UPDATE public.propostas AS prop
SET projeto = NULL
WHERE prop.projeto IS NOT NULL
AND NOT EXISTS (SELECT 1 FROM public.projetos WHERE id = prop.projeto);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'propostas_projeto_fkey'
    AND conrelid = 'public.propostas'::regclass
  ) THEN
    ALTER TABLE public.propostas
    ADD CONSTRAINT propostas_projeto_fkey
    FOREIGN KEY (projeto) REFERENCES public.projetos(id) ON DELETE SET NULL;
  END IF;
END $$;
