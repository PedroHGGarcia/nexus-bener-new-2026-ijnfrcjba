-- Public bucket for generated proposal PDFs (real PDF binaries produced by
-- the generate-proposal-pdf edge function). Public read so n8n / external
-- systems can download the .pdf directly from the storage public URL.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'propostas-pdf') THEN
    INSERT INTO storage.buckets (id, name, public)
    VALUES ('propostas-pdf', 'propostas-pdf', true);
  END IF;
END $$;

-- Public read access (anon + authenticated) so the .pdf URL is directly fetchable
DROP POLICY IF EXISTS "public_read_propostas_pdf" ON storage.objects;
CREATE POLICY "public_read_propostas_pdf" ON storage.objects
  FOR SELECT TO public USING (bucket_id = 'propostas-pdf');

-- Service role bypasses RLS, but allow authenticated writes too for safety
DROP POLICY IF EXISTS "authenticated_write_propostas_pdf" ON storage.objects;
CREATE POLICY "authenticated_write_propostas_pdf" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'propostas-pdf');

DROP POLICY IF EXISTS "authenticated_update_propostas_pdf" ON storage.objects;
CREATE POLICY "authenticated_update_propostas_pdf" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'propostas-pdf');

DROP POLICY IF EXISTS "authenticated_delete_propostas_pdf" ON storage.objects;
CREATE POLICY "authenticated_delete_propostas_pdf" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'propostas-pdf');
