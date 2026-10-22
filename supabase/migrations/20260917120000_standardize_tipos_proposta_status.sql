-- Migration: Standardize status in tipos_proposta
-- 1. 'A' -> 'Ativo'
-- 2. 'I' -> 'Inativo'
-- 3. Empty / whitespace / NULL -> 'Ativo' (consistent with default and UI assumptions)

UPDATE public.tipos_proposta
SET status = 'Ativo',
    updated_at = NOW()
WHERE status = 'A';

UPDATE public.tipos_proposta
SET status = 'Inativo',
    updated_at = NOW()
WHERE status = 'I';

UPDATE public.tipos_proposta
SET status = 'Ativo',
    updated_at = NOW()
WHERE status IS NULL OR TRIM(status) = '';
