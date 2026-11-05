-- Migration: Add descricao_tamanho to versoes table
-- Options: 'pequeno' | 'padrao' | 'medio' | 'grande', default 'padrao'

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'versoes'
      AND column_name = 'descricao_tamanho'
  ) THEN
    ALTER TABLE public.versoes
    ADD COLUMN descricao_tamanho TEXT NOT NULL DEFAULT 'padrao';

    -- Adiciona constraint de validação
    ALTER TABLE public.versoes
    ADD CONSTRAINT check_versoes_descricao_tamanho
    CHECK (descricao_tamanho IN ('pequeno', 'padrao', 'medio', 'grande'));

    COMMENT ON COLUMN public.versoes.descricao_tamanho IS 'Tamanho da fonte das descrições da máquina: pequeno, padrao, medio ou grande';
  END IF;
END $$;
