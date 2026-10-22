DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'avatars') THEN
    INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'signatures') THEN
    INSERT INTO storage.buckets (id, name, public) VALUES ('signatures', 'signatures', true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'versao-images') THEN
    INSERT INTO storage.buckets (id, name, public) VALUES ('versao-images', 'versao-images', true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'proposal-pdfs') THEN
    INSERT INTO storage.buckets (id, name, public) VALUES ('proposal-pdfs', 'proposal-pdfs', true);
  END IF;
END $$;

DROP POLICY IF EXISTS "public_read_avatars" ON storage.objects;
CREATE POLICY "public_read_avatars" ON storage.objects
  FOR SELECT TO public USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "authenticated_write_avatars" ON storage.objects;
CREATE POLICY "authenticated_write_avatars" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'avatars');

DROP POLICY IF EXISTS "authenticated_update_avatars" ON storage.objects;
CREATE POLICY "authenticated_update_avatars" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "public_read_signatures" ON storage.objects;
CREATE POLICY "public_read_signatures" ON storage.objects
  FOR SELECT TO public USING (bucket_id = 'signatures');

DROP POLICY IF EXISTS "authenticated_write_signatures" ON storage.objects;
CREATE POLICY "authenticated_write_signatures" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'signatures');

DROP POLICY IF EXISTS "authenticated_update_signatures" ON storage.objects;
CREATE POLICY "authenticated_update_signatures" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'signatures');

DROP POLICY IF EXISTS "public_read_versao_images" ON storage.objects;
CREATE POLICY "public_read_versao_images" ON storage.objects
  FOR SELECT TO public USING (bucket_id = 'versao-images');

DROP POLICY IF EXISTS "authenticated_write_versao_images" ON storage.objects;
CREATE POLICY "authenticated_write_versao_images" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'versao-images');

DROP POLICY IF EXISTS "authenticated_update_versao_images" ON storage.objects;
CREATE POLICY "authenticated_update_versao_images" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'versao-images');

DROP POLICY IF EXISTS "public_read_proposal_pdfs" ON storage.objects;
CREATE POLICY "public_read_proposal_pdfs" ON storage.objects
  FOR SELECT TO public USING (bucket_id = 'proposal-pdfs');

DROP POLICY IF EXISTS "authenticated_write_proposal_pdfs" ON storage.objects;
CREATE POLICY "authenticated_write_proposal_pdfs" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'proposal-pdfs');

DROP POLICY IF EXISTS "authenticated_update_proposal_pdfs" ON storage.objects;
CREATE POLICY "authenticated_update_proposal_pdfs" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'proposal-pdfs');
