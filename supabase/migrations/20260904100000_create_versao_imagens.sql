-- Migration: 20260904100000_create_versao_imagens.sql
-- Description: Create versao_imagens table, bucket verification, indexes, and RLS policies

-- 1. Create versao_imagens table
CREATE TABLE IF NOT EXISTS public.versao_imagens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  versao_id UUID NOT NULL REFERENCES public.versoes(id) ON DELETE CASCADE,
  nome_arquivo TEXT,
  url TEXT NOT NULL,
  criada_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT versao_imagens_versao_id_key UNIQUE (versao_id)
);

-- 2. Indexes
CREATE INDEX IF NOT EXISTS idx_versao_imagens_versao ON public.versao_imagens(versao_id);

-- 3. Enable RLS
ALTER TABLE public.versao_imagens ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies:
-- Leitura liberada para anon + authenticated (telas de proposta públicas e internas)
DROP POLICY IF EXISTS "versao_imagens_select" ON public.versao_imagens;
CREATE POLICY "versao_imagens_select" ON public.versao_imagens
  FOR SELECT TO public USING (true);

-- Escrita (INSERT, UPDATE, DELETE) para Admin (usando helper is_admin())
DROP POLICY IF EXISTS "versao_imagens_admin_insert" ON public.versao_imagens;
CREATE POLICY "versao_imagens_admin_insert" ON public.versao_imagens
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "versao_imagens_admin_update" ON public.versao_imagens;
CREATE POLICY "versao_imagens_admin_update" ON public.versao_imagens
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "versao_imagens_admin_delete" ON public.versao_imagens;
CREATE POLICY "versao_imagens_admin_delete" ON public.versao_imagens
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- 5. Ensure Storage Bucket for version images (versao-images)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'versao-images') THEN
    INSERT INTO storage.buckets (id, name, public) VALUES ('versao-images', 'versao-images', true);
  END IF;
END $$;

-- 6. Storage Policies for versao-images
DROP POLICY IF EXISTS "public_read_versao_images" ON storage.objects;
CREATE POLICY "public_read_versao_images" ON storage.objects
  FOR SELECT TO public USING (bucket_id = 'versao-images');

DROP POLICY IF EXISTS "authenticated_write_versao_images" ON storage.objects;
CREATE POLICY "authenticated_write_versao_images" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'versao-images');

DROP POLICY IF EXISTS "authenticated_update_versao_images" ON storage.objects;
CREATE POLICY "authenticated_update_versao_images" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'versao-images');

DROP POLICY IF EXISTS "authenticated_delete_versao_images" ON storage.objects;
CREATE POLICY "authenticated_delete_versao_images" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'versao-images');
