-- Migration to add snapshot columns to propostas table
-- This freezes all version and machine data at the moment a proposal is created or explicitly updated.

ALTER TABLE public.propostas ADD COLUMN IF NOT EXISTS itens_snapshot JSONB DEFAULT NULL;
ALTER TABLE public.propostas ADD COLUMN IF NOT EXISTS dados_snapshot JSONB DEFAULT NULL;

COMMENT ON COLUMN public.propostas.itens_snapshot IS 'Snapshot imutável dos itens/máquinas (especificações, valores, fotos, tipos de proposta, acessórios) capturado na criação/edição';
COMMENT ON COLUMN public.propostas.dados_snapshot IS 'Snapshot consolidado contendo versão principal, itens e metadados congelados';
