-- Migration: create public bucket for logos and system assets
-- Version: 20260924123000

INSERT INTO storage.buckets (id, name, public)
VALUES ('public', 'public', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Storage policies: public bucket read and write
DROP POLICY IF EXISTS "public_read_public_bucket" ON storage.objects;
CREATE POLICY "public_read_public_bucket" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'public');

DROP POLICY IF EXISTS "authenticated_write_public_bucket" ON storage.objects;
CREATE POLICY "authenticated_write_public_bucket" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'public');

DROP POLICY IF EXISTS "authenticated_update_public_bucket" ON storage.objects;
CREATE POLICY "authenticated_update_public_bucket" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'public');

DROP POLICY IF EXISTS "authenticated_delete_public_bucket" ON storage.objects;
CREATE POLICY "authenticated_delete_public_bucket" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'public');

DROP POLICY IF EXISTS "anon_read_public_bucket" ON storage.objects;
CREATE POLICY "anon_read_public_bucket" ON storage.objects
  FOR SELECT TO anon
  USING (bucket_id = 'public');
