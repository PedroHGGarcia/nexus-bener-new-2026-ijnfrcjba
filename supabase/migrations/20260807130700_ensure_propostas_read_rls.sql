-- Ensure authenticated users can read all propostas fields for project detail page
ALTER TABLE public.propostas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "propostas_authenticated_all" ON public.propostas;
CREATE POLICY "propostas_authenticated_all" ON public.propostas
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "propostas_authenticated_select_licitacao" ON public.propostas;
CREATE POLICY "propostas_authenticated_select_licitacao" ON public.propostas
  FOR SELECT TO authenticated USING (true);
