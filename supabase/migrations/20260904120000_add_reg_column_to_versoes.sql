-- Migration: 20260904120000_add_reg_column_to_versoes.sql
-- Description: Add reg column to public.versoes and backfill with existing cod_erp data

-- 1. Add column reg if not exists
ALTER TABLE public.versoes ADD COLUMN IF NOT EXISTS reg TEXT;

-- 2. Backfill existing records: populate reg with cod_erp if cod_erp is present
UPDATE public.versoes
SET reg = cod_erp
WHERE reg IS NULL AND cod_erp IS NOT NULL;

-- 3. Create index for fast lookups by reg
CREATE INDEX IF NOT EXISTS idx_versoes_reg ON public.versoes(reg);
