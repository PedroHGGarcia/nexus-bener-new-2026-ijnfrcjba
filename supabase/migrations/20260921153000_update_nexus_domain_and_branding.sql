-- Migration: Update proposta link_publico_RD to use https://nexus.bener.com.br
-- Renames system references from Extranet to Nexus and updates set_proposta_link_publico trigger

-- 1. Update the trigger function to produce links with https://nexus.bener.com.br
CREATE OR REPLACE FUNCTION public.set_proposta_link_publico()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW."link_publico_RD" IS NULL OR NEW."link_publico_RD" = '' OR NEW."link_publico_RD" LIKE '%extranetv2.goskip.app%' THEN
    NEW."link_publico_RD" := 'https://nexus.bener.com.br/visualizar-proposta/' || NEW.id::text;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Update existing proposals replacing extranetv2.goskip.app with nexus.bener.com.br
UPDATE public.propostas
SET "link_publico_RD" = replace("link_publico_RD", 'https://extranetv2.goskip.app', 'https://nexus.bener.com.br')
WHERE "link_publico_RD" LIKE '%extranetv2.goskip.app%';

-- Also backfill any null or empty link_publico_RD
UPDATE public.propostas
SET "link_publico_RD" = 'https://nexus.bener.com.br/visualizar-proposta/' || id::text
WHERE "link_publico_RD" IS NULL OR "link_publico_RD" = '';

-- 3. Update invite email template subject if auth.config can be accessed
DO $$
BEGIN
  BEGIN
    UPDATE auth.config
    SET
      mailer_subjects_invite = 'Convite - Bener Máquinas Nexus';
    RAISE NOTICE 'Auth invite subject updated to Nexus.';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not update auth.config directly.';
  END;
END $$;
