-- Expand tipos_proposta with full proposal type fields
ALTER TABLE public.tipos_proposta
  ADD COLUMN IF NOT EXISTS aplicar_fator_nac BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS comissao NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS frase_preco TEXT,
  ADD COLUMN IF NOT EXISTS frase_comissao TEXT,
  ADD COLUMN IF NOT EXISTS prazo_entrega TEXT,
  ADD COLUMN IF NOT EXISTS condicoes_pagamento TEXT,
  ADD COLUMN IF NOT EXISTS garantia TEXT,
  ADD COLUMN IF NOT EXISTS assistencia_tecnica TEXT,
  ADD COLUMN IF NOT EXISTS treinamento_tecnico TEXT,
  ADD COLUMN IF NOT EXISTS transporte_seguro TEXT,
  ADD COLUMN IF NOT EXISTS validade_oferta TEXT,
  ADD COLUMN IF NOT EXISTS imposto_ipi NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS imposto_icms NUMERIC(12,2) DEFAULT 0;
