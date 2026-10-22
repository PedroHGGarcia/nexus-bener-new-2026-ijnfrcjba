-- Add foreign key constraints for proposal signers
-- assinante_representante_id -> representantes(id)
-- assinante_gerente_id -> gerentes(id)

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'propostas_assinante_representante_fkey'
  ) THEN
    ALTER TABLE public.propostas
      ADD CONSTRAINT propostas_assinante_representante_fkey
      FOREIGN KEY (assinante_representante_id)
      REFERENCES public.representantes(id)
      ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'propostas_assinante_gerente_fkey'
  ) THEN
    ALTER TABLE public.propostas
      ADD CONSTRAINT propostas_assinante_gerente_fkey
      FOREIGN KEY (assinante_gerente_id)
      REFERENCES public.gerentes(id)
      ON DELETE SET NULL;
  END IF;
END $$;
