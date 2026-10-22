-- Create clientes table
CREATE TABLE IF NOT EXISTS public.clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fantasia TEXT NOT NULL,
  razao_social TEXT,
  documento TEXT,
  status TEXT NOT NULL DEFAULT 'Ativo',
  contato TEXT,
  telefone TEXT,
  telefone_2 TEXT,
  telefone_3 TEXT,
  celular TEXT,
  email TEXT,
  email_fiscal TEXT,
  cep TEXT,
  estado TEXT,
  cidade TEXT,
  bairro TEXT,
  logradouro TEXT,
  numero TEXT,
  complementos TEXT,
  contatos_adicionais JSONB,
  limite_credito NUMERIC(12,2),
  dt_cad TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;

-- Policies (idempotent)
DROP POLICY IF EXISTS "clientes_select_policy" ON public.clientes;
CREATE POLICY "clientes_select_policy" ON public.clientes
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "clientes_insert_policy" ON public.clientes;
CREATE POLICY "clientes_insert_policy" ON public.clientes
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "clientes_update_policy" ON public.clientes;
CREATE POLICY "clientes_update_policy" ON public.clientes
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "clientes_delete_policy" ON public.clientes;
CREATE POLICY "clientes_delete_policy" ON public.clientes
  FOR DELETE TO authenticated USING (true);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_clientes_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS clientes_updated_at ON public.clientes;
CREATE TRIGGER clientes_updated_at
  BEFORE UPDATE ON public.clientes
  FOR EACH ROW EXECUTE FUNCTION public.update_clientes_updated_at();

-- Index for document duplicate detection
CREATE INDEX IF NOT EXISTS idx_clientes_documento ON public.clientes(documento);
