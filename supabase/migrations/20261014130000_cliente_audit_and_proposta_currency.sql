-- Migration: Auditoria de clientes e campos de moeda da proposta (R9 e R4)
-- Data: 2026-10-14 13:00:00

-- ============================================================================
-- 1. R9: Auditoria de cadastro e máquina de interesse em public.clientes
-- ============================================================================
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS maquina_interesse_adicionada_por UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS maquina_interesse_adicionada_em TIMESTAMPTZ;

-- Backfill para clientes sem criado_por: atribuir admin Bianca (00000000-0000-0000-0000-000000000001) como padrão
UPDATE public.clientes
SET criado_por = '00000000-0000-0000-0000-000000000001'::uuid
WHERE criado_por IS NULL;

-- Backfill de máquina de interesse: se maquina_interesse preenchida, usar criado_por ou autor do log
UPDATE public.clientes
SET 
  maquina_interesse_adicionada_por = COALESCE(criado_por, '00000000-0000-0000-0000-000000000001'::uuid),
  maquina_interesse_adicionada_em = COALESCE(updated_at, created_at, NOW())
WHERE maquina_interesse IS NOT NULL 
  AND TRIM(maquina_interesse) <> ''
  AND maquina_interesse_adicionada_por IS NULL;

-- Trigger para registrar automaticamente quem adicionou / alterou a maquina_interesse
CREATE OR REPLACE FUNCTION public.fn_audit_maquina_interesse()
RETURNS trigger AS $$
BEGIN
  IF NEW.maquina_interesse IS NOT NULL AND TRIM(NEW.maquina_interesse) <> '' THEN
    IF OLD.maquina_interesse IS NULL OR OLD.maquina_interesse <> NEW.maquina_interesse THEN
      IF NEW.maquina_interesse_adicionada_por IS NULL OR NEW.maquina_interesse_adicionada_por = OLD.maquina_interesse_adicionada_por THEN
        NEW.maquina_interesse_adicionada_por := COALESCE(auth.uid(), NEW.criado_por, '00000000-0000-0000-0000-000000000001'::uuid);
      END IF;
      NEW.maquina_interesse_adicionada_em := NOW();
    END IF;
  ELSIF NEW.maquina_interesse IS NULL OR TRIM(NEW.maquina_interesse) = '' THEN
    NEW.maquina_interesse_adicionada_por := NULL;
    NEW.maquina_interesse_adicionada_em := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_audit_maquina_interesse ON public.clientes;
CREATE TRIGGER trg_audit_maquina_interesse
  BEFORE INSERT OR UPDATE ON public.clientes
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_audit_maquina_interesse();

-- ============================================================================
-- 2. R4: Colunas de moeda original e cotação detalhada em public.propostas
-- ============================================================================
ALTER TABLE public.propostas ADD COLUMN IF NOT EXISTS cotacao_moeda NUMERIC;
ALTER TABLE public.propostas ADD COLUMN IF NOT EXISTS data_cotacao_moeda TEXT;
ALTER TABLE public.propostas ADD COLUMN IF NOT EXISTS moeda_original TEXT DEFAULT 'BRL';

CREATE INDEX IF NOT EXISTS idx_propostas_moeda ON public.propostas(moeda);
