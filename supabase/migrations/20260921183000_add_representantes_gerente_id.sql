-- Migration: add gerente_id to representantes table
-- Permite vincular cada representante comercial / vendedor a um gerente responsável.

ALTER TABLE public.representantes
  ADD COLUMN IF NOT EXISTS gerente_id uuid REFERENCES public.gerentes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_representantes_gerente_id
  ON public.representantes (gerente_id);

COMMENT ON COLUMN public.representantes.gerente_id IS 'Gerente de contas / produto responsável por este representante';
