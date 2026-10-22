-- Recreate tipos_proposta and versao_tipos_proposta tables
-- Migration timestamp: 2026-08-21 14:15:00

-- =============================================================================
-- 1. Create table public.tipos_proposta with full schema
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.tipos_proposta (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Ativo',
  aplicar_fator_nac BOOLEAN NOT NULL DEFAULT false,
  comissao NUMERIC(12,2) DEFAULT 0,
  frase_preco TEXT,
  frase_comissao TEXT,
  prazo_entrega TEXT,
  condicoes_pagamento TEXT,
  garantia TEXT,
  assistencia_tecnica TEXT,
  treinamento_tecnico TEXT,
  transporte_seguro TEXT,
  validade_oferta TEXT,
  imposto_ipi NUMERIC(12,2) DEFAULT 0,
  imposto_icms NUMERIC(12,2) DEFAULT 0,
  campos_adicionais JSONB NOT NULL DEFAULT '[]'::jsonb,
  atualizado_por TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique index on nome
CREATE UNIQUE INDEX IF NOT EXISTS idx_tipos_proposta_nome ON public.tipos_proposta(nome);

-- Enable Row Level Security
ALTER TABLE public.tipos_proposta ENABLE ROW LEVEL SECURITY;

-- Idempotent RLS Policies
DROP POLICY IF EXISTS "tipos_proposta_select" ON public.tipos_proposta;
CREATE POLICY "tipos_proposta_select" ON public.tipos_proposta
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "tipos_proposta_insert" ON public.tipos_proposta;
CREATE POLICY "tipos_proposta_insert" ON public.tipos_proposta
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "tipos_proposta_update" ON public.tipos_proposta;
CREATE POLICY "tipos_proposta_update" ON public.tipos_proposta
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "tipos_proposta_delete" ON public.tipos_proposta;
CREATE POLICY "tipos_proposta_delete" ON public.tipos_proposta
  FOR DELETE TO authenticated USING (true);

-- Updated at trigger
DROP TRIGGER IF EXISTS tipos_proposta_updated_at ON public.tipos_proposta;
CREATE TRIGGER tipos_proposta_updated_at
  BEFORE UPDATE ON public.tipos_proposta
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Seed data for standard tipos de proposta
INSERT INTO public.tipos_proposta (nome, status) VALUES
  ('Venda', 'Ativo'),
  ('Locação', 'Ativo'),
  ('Turnkey', 'Ativo'),
  ('Usado', 'Ativo')
ON CONFLICT (nome) DO NOTHING;

-- =============================================================================
-- 2. Create table public.versao_tipos_proposta join table
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.versao_tipos_proposta (
  versao_id UUID NOT NULL REFERENCES public.versoes(id) ON DELETE CASCADE,
  tipo_proposta_id UUID NOT NULL REFERENCES public.tipos_proposta(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (versao_id, tipo_proposta_id)
);

CREATE INDEX IF NOT EXISTS idx_versao_tipos_proposta_versao ON public.versao_tipos_proposta(versao_id);
CREATE INDEX IF NOT EXISTS idx_versao_tipos_proposta_tipo ON public.versao_tipos_proposta(tipo_proposta_id);

-- Enable Row Level Security
ALTER TABLE public.versao_tipos_proposta ENABLE ROW LEVEL SECURITY;

-- Idempotent RLS Policies
DROP POLICY IF EXISTS "versao_tipos_proposta_select" ON public.versao_tipos_proposta;
CREATE POLICY "versao_tipos_proposta_select" ON public.versao_tipos_proposta
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "versao_tipos_proposta_insert" ON public.versao_tipos_proposta;
CREATE POLICY "versao_tipos_proposta_insert" ON public.versao_tipos_proposta
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "versao_tipos_proposta_update" ON public.versao_tipos_proposta;
CREATE POLICY "versao_tipos_proposta_update" ON public.versao_tipos_proposta
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "versao_tipos_proposta_delete" ON public.versao_tipos_proposta;
CREATE POLICY "versao_tipos_proposta_delete" ON public.versao_tipos_proposta
  FOR DELETE TO authenticated USING (true);

-- Migrate existing JSONB data from versoes.tipos_proposta into the junction table
DO $$
DECLARE
  v_rec RECORD;
  elem JSONB;
  tipo_name TEXT;
  tipo_id UUID;
BEGIN
  FOR v_rec IN
    SELECT id, tipos_proposta FROM public.versoes
    WHERE tipos_proposta IS NOT NULL AND jsonb_typeof(tipos_proposta) = 'array'
  LOOP
    FOR elem IN SELECT * FROM jsonb_array_elements(v_rec.tipos_proposta)
    LOOP
      BEGIN
        IF jsonb_typeof(elem) = 'string' THEN
          tipo_name := elem #>> '{}';
          SELECT id INTO tipo_id FROM public.tipos_proposta WHERE nome = tipo_name LIMIT 1;
          IF tipo_id IS NOT NULL THEN
            INSERT INTO public.versao_tipos_proposta (versao_id, tipo_proposta_id)
            VALUES (v_rec.id, tipo_id)
            ON CONFLICT (versao_id, tipo_proposta_id) DO NOTHING;
          END IF;
        ELSIF jsonb_typeof(elem) = 'object' AND elem ? 'id' THEN
          tipo_id := (elem->>'id')::uuid;
          INSERT INTO public.versao_tipos_proposta (versao_id, tipo_proposta_id)
          VALUES (v_rec.id, tipo_id)
          ON CONFLICT (versao_id, tipo_proposta_id) DO NOTHING;
        ELSIF jsonb_typeof(elem) = 'object' AND elem ? 'nome' THEN
          tipo_name := elem->>'nome';
          SELECT id INTO tipo_id FROM public.tipos_proposta WHERE nome = tipo_name LIMIT 1;
          IF tipo_id IS NOT NULL THEN
            INSERT INTO public.versao_tipos_proposta (versao_id, tipo_proposta_id)
            VALUES (v_rec.id, tipo_id)
            ON CONFLICT (versao_id, tipo_proposta_id) DO NOTHING;
          END IF;
        END IF;
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END;
    END LOOP;
  END LOOP;
END $$;

-- Add to realtime publication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'versao_tipos_proposta'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.versao_tipos_proposta;
  END IF;
END $$;

-- =============================================================================
-- 3. Audit triggers for tipos_proposta and versao_tipos_proposta
-- =============================================================================
DROP TRIGGER IF EXISTS audit_trigger ON public.tipos_proposta;
CREATE TRIGGER audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.tipos_proposta
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();

DROP TRIGGER IF EXISTS audit_trigger ON public.versao_tipos_proposta;
CREATE TRIGGER audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.versao_tipos_proposta
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();
