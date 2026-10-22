-- Ensure RLS policies allow authenticated users to read projetos and propostas
-- (needed for licitação badge detection on project list)

-- Projetos: ensure authenticated can SELECT
ALTER TABLE public.projetos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "projetos_authenticated_select_licitacao" ON public.projetos;
CREATE POLICY "projetos_authenticated_select_licitacao" ON public.projetos
  FOR SELECT TO authenticated USING (true);

-- Propostas: ensure authenticated can SELECT (for modelo_licitacao check)
ALTER TABLE public.propostas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "propostas_authenticated_select_licitacao" ON public.propostas;
CREATE POLICY "propostas_authenticated_select_licitacao" ON public.propostas
  FOR SELECT TO authenticated USING (true);
