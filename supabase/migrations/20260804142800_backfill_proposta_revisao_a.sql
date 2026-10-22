-- Backfill revisao = 'A' and numero_proposta '-A' suffix for existing initial proposals
-- that were created before automatic versioning was implemented.
-- Idempotent: only affects rows where revisao is NULL/empty or numero_proposta lacks a letter suffix.

-- 1. Set revisao = 'A' for original proposals (versao_original IS NULL) without a revision
UPDATE public.propostas
SET revisao = 'A'
WHERE versao_original IS NULL
  AND (revisao IS NULL OR revisao = '');

-- 2. Append '-A' suffix to numero_proposta for original proposals missing a version letter suffix
UPDATE public.propostas
SET numero_proposta = numero_proposta || '-A'
WHERE versao_original IS NULL
  AND numero_proposta IS NOT NULL
  AND numero_proposta !~* '-[A-Z]$';
