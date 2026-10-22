-- Adiciona colunas celular, telefone e documento em public.profiles se não existirem
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS celular TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS telefone TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS documento TEXT;

-- Tabela public.cliente_contatos (R8)
CREATE TABLE IF NOT EXISTS public.cliente_contatos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  email TEXT,
  telefone TEXT,
  cargo TEXT,
  is_principal BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cliente_contatos_cliente_id ON public.cliente_contatos(cliente_id);

-- RLS para public.cliente_contatos (coerente com clientes)
ALTER TABLE public.cliente_contatos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cliente_contatos_authenticated_all" ON public.cliente_contatos;
CREATE POLICY "cliente_contatos_authenticated_all" ON public.cliente_contatos
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "cliente_contatos_anon_select" ON public.cliente_contatos;
CREATE POLICY "cliente_contatos_anon_select" ON public.cliente_contatos
  FOR SELECT TO anon
  USING (true);

-- Migrar contato/email/telefone existentes de clientes para um contato principal inicial
INSERT INTO public.cliente_contatos (cliente_id, nome, email, telefone, is_principal)
SELECT 
  c.id,
  COALESCE(NULLIF(TRIM(c.contato), ''), NULLIF(TRIM(c.fantasia), ''), 'Contato Principal'),
  NULLIF(TRIM(c.email), ''),
  COALESCE(NULLIF(TRIM(c.celular), ''), NULLIF(TRIM(c.telefone), '')),
  true
FROM public.clientes c
WHERE NOT EXISTS (
  SELECT 1 FROM public.cliente_contatos cc WHERE cc.cliente_id = c.id
)
AND (
  (c.contato IS NOT NULL AND TRIM(c.contato) <> '')
  OR (c.email IS NOT NULL AND TRIM(c.email) <> '')
  OR (c.telefone IS NOT NULL AND TRIM(c.telefone) <> '')
  OR (c.celular IS NOT NULL AND TRIM(c.celular) <> '')
)
ON CONFLICT DO NOTHING;
