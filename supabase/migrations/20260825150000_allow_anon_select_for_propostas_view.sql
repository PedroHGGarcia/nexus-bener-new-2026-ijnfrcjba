-- Allow anonymous SELECT for related proposal tables so public proposal viewing works
DROP POLICY IF EXISTS "clientes_anon_select" ON public.clientes;
CREATE POLICY "clientes_anon_select" ON public.clientes
  FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "versoes_anon_select" ON public.versoes;
CREATE POLICY "versoes_anon_select" ON public.versoes
  FOR SELECT TO anon USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "modelos_anon_select" ON public.modelos;
CREATE POLICY "modelos_anon_select" ON public.modelos
  FOR SELECT TO anon USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "marcas_anon_select" ON public.marcas;
CREATE POLICY "marcas_anon_select" ON public.marcas
  FOR SELECT TO anon USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "produtos_anon_select" ON public.produtos;
CREATE POLICY "produtos_anon_select" ON public.produtos
  FOR SELECT TO anon USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "categorias_produtos_anon_select" ON public.categorias_produtos;
CREATE POLICY "categorias_produtos_anon_select" ON public.categorias_produtos
  FOR SELECT TO anon USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "representantes_anon_select" ON public.representantes;
CREATE POLICY "representantes_anon_select" ON public.representantes
  FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "gerentes_anon_select" ON public.gerentes;
CREATE POLICY "gerentes_anon_select" ON public.gerentes
  FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "proposta_versoes_anon_select" ON public.proposta_versoes;
CREATE POLICY "proposta_versoes_anon_select" ON public.proposta_versoes
  FOR SELECT TO anon USING (true);
