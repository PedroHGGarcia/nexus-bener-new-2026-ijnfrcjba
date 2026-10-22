-- Allow anon users to update propostas (for public validation page)
DROP POLICY IF EXISTS "propostas_anon_update" ON public.propostas;
CREATE POLICY "propostas_anon_update" ON public.propostas
  FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- Allow anon users to upload signature files (for public validation page)
DROP POLICY IF EXISTS "propostas_files_anon_insert" ON storage.objects;
CREATE POLICY "propostas_files_anon_insert" ON storage.objects
  FOR INSERT TO anon WITH CHECK (bucket_id = 'propostas-files');
