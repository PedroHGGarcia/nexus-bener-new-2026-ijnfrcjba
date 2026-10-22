-- Migration: Add link_publico column to propostas and backfill existing rows
-- Column stores the explicit public link for the proposal: https://extranetv2.goskip.app/visualizar-proposta/<id>

-- 1. Add column if it does not exist
ALTER TABLE public.propostas
ADD COLUMN IF NOT EXISTS link_publico TEXT;

-- 2. Backfill existing proposals with the production public URL
UPDATE public.propostas
SET link_publico = 'https://extranetv2.goskip.app/visualizar-proposta/' || id::text
WHERE link_publico IS NULL OR link_publico = '';

-- 3. Ensure trigger or default behavior for new insertions if needed
-- We can also set a DEFAULT or let it be generated / updated by backend & edge function
-- Setting a trigger / default ensures any new insert without edge function also gets the standard public link
CREATE OR REPLACE FUNCTION public.set_proposta_link_publico()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.link_publico IS NULL OR NEW.link_publico = '' THEN
    NEW.link_publico := 'https://extranetv2.goskip.app/visualizar-proposta/' || NEW.id::text;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_set_proposta_link_publico ON public.propostas;
CREATE TRIGGER trg_set_proposta_link_publico
  BEFORE INSERT ON public.propostas
  FOR EACH ROW
  EXECUTE FUNCTION public.set_proposta_link_publico();

-- 4. Re-affirm RLS policies on propostas to ensure anon and authenticated can read link_publico
-- Existing policies already cover all columns (SELECT *), but we ensure propostas_anon_select and propostas_authenticated_select exist
DROP POLICY IF EXISTS "propostas_anon_select" ON public.propostas;
CREATE POLICY "propostas_anon_select" ON public.propostas
  FOR SELECT
  TO anon
  USING (true);
