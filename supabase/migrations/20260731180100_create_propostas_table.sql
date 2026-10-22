CREATE TABLE IF NOT EXISTS public.propostas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_proposta TEXT,
  revisao TEXT,
  cliente UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  modelo_licitacao BOOLEAN NOT NULL DEFAULT false,
  descricao_proposta TEXT,
  especificacoes_tecnicas TEXT,
  materiais_utilizados TEXT,
  certificacoes TEXT,
  normas_aplicaveis TEXT,
  certificacoes_seguranca TEXT,
  normas_seguranca TEXT,
  cobertura_garantia TEXT,
  assistencia_tecnica_detalhada TEXT,
  criterios_aceitacao TEXT,
  garantia_acessorios TEXT,
  validade_oferta TEXT,
  secoes_adicionais JSONB,
  contato TEXT,
  telefone TEXT,
  versao UUID REFERENCES public.versoes(id) ON DELETE SET NULL,
  representante UUID REFERENCES public.representantes(id) ON DELETE SET NULL,
  gerente UUID REFERENCES public.gerentes(id) ON DELETE SET NULL,
  moeda TEXT DEFAULT 'BRL',
  valor_sem_desconto NUMERIC(12,2) DEFAULT 0,
  percentual_desconto NUMERIC(5,2) DEFAULT 0,
  valor_atual NUMERIC(12,2) DEFAULT 0,
  valor_final NUMERIC(12,2) DEFAULT 0,
  prazo_entrega TEXT,
  condicoes_pagamento TEXT,
  acessorios_proposta JSONB,
  cliente_original TEXT,
  versao_original TEXT,
  representante_original TEXT,
  gerente_original TEXT,
  nota_rep NUMERIC(5,2),
  dt_cad TEXT,
  "user" TEXT,
  tipo_proposta TEXT,
  projeto TEXT,
  status TEXT NOT NULL DEFAULT 'Em Analise',
  data_alteracao_status TEXT,
  ultimo_usuario_status TEXT,
  assinatura_cliente TEXT,
  assinatura_representante TEXT,
  emails_notificacao TEXT,
  assinatura_gerente_produto TEXT,
  assinatura_assessor_tecnico TEXT,
  nome_gerente_produto TEXT,
  nome_assessor_tecnico TEXT,
  nome_representante_comercial TEXT,
  versoes_comparacao JSONB,
  pdf_anexo TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.propostas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "propostas_select" ON public.propostas;
CREATE POLICY "propostas_select" ON public.propostas
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "propostas_anon_select" ON public.propostas;
CREATE POLICY "propostas_anon_select" ON public.propostas
  FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "propostas_insert" ON public.propostas;
CREATE POLICY "propostas_insert" ON public.propostas
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "propostas_update" ON public.propostas;
CREATE POLICY "propostas_update" ON public.propostas
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "propostas_delete" ON public.propostas;
CREATE POLICY "propostas_delete" ON public.propostas
  FOR DELETE TO authenticated USING (true);

DROP TRIGGER IF EXISTS propostas_updated_at ON public.propostas;
CREATE TRIGGER propostas_updated_at
  BEFORE UPDATE ON public.propostas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

INSERT INTO storage.buckets (id, name, public)
VALUES ('propostas-files', 'propostas-files', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "propostas_files_select" ON storage.objects;
CREATE POLICY "propostas_files_select" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'propostas-files');

DROP POLICY IF EXISTS "propostas_files_insert" ON storage.objects;
CREATE POLICY "propostas_files_insert" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'propostas-files');

DROP POLICY IF EXISTS "propostas_files_update" ON storage.objects;
CREATE POLICY "propostas_files_update" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'propostas-files');

DROP POLICY IF EXISTS "propostas_files_delete" ON storage.objects;
CREATE POLICY "propostas_files_delete" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'propostas-files');

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.propostas LIMIT 1) THEN
    INSERT INTO public.propostas
      (numero_proposta, cliente_original, versao_original, representante_original,
       tipo_proposta, moeda, valor_sem_desconto, percentual_desconto, valor_final,
       status, condicoes_pagamento, prazo_entrega, validade_oferta,
       descricao_proposta, dt_cad, created_at)
    VALUES
      ('PROP-2026-001', 'Metalúrgica Silva Ltda', 'Torno CNC TC-45', 'Rep. Sul',
       'Venda', 'BRL', 450000.00, 5.00, 427500.00,
       'Em Analise', '30/60/90 dias', '60 dias', '30 dias',
       'Proposta comercial para fornecimento de equipamento industrial.',
       TO_CHAR(NOW(), 'DD/MM/YYYY'), NOW()),
      ('PROP-2026-002', 'Indústria Ferreira S.A.', 'Centro de Usinagem CU-20', 'Rep. Sudeste',
       'Turnkey', 'BRL', 1250000.00, 8.00, 1150000.00,
       'Aprovada', 'À vista', '90 dias', '45 dias',
       'Projeto completo turnkey incluindo máquinas e treinamento.',
       TO_CHAR(NOW() - INTERVAL '5 days', 'DD/MM/YYYY'), NOW() - INTERVAL '5 days'),
      ('PROP-2026-003', 'Auto Peças Santos', 'Laser Fibra LF-2kW', 'Rep. Sul',
       'Venda', 'BRL', 320000.00, 0.00, 320000.00,
       'Validada', '30 dias', '45 dias', '30 dias',
       'Fornecimento direto de laser de fibra.',
       TO_CHAR(NOW() - INTERVAL '10 days', 'DD/MM/YYYY'), NOW() - INTERVAL '10 days');
  END IF;
END $$;
