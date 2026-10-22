-- Migration: Create clientes_antigos table and indexes
CREATE TABLE IF NOT EXISTS public.clientes_antigos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT,
  cnpj TEXT UNIQUE,
  email TEXT,
  telefone TEXT,
  contato TEXT,
  endereco TEXT,
  cidade TEXT,
  uf VARCHAR(2),
  cep TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for fast lookup
CREATE INDEX IF NOT EXISTS idx_clientes_antigos_cnpj ON public.clientes_antigos(cnpj);
CREATE INDEX IF NOT EXISTS idx_clientes_antigos_cep ON public.clientes_antigos(cep);

-- Enable RLS
ALTER TABLE public.clientes_antigos ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "clientes_antigos_authenticated_select" ON public.clientes_antigos;
CREATE POLICY "clientes_antigos_authenticated_select" ON public.clientes_antigos
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "clientes_antigos_authenticated_all" ON public.clientes_antigos;
CREATE POLICY "clientes_antigos_authenticated_all" ON public.clientes_antigos
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
