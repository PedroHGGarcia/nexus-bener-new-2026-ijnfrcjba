-- Create representantes table
CREATE TABLE IF NOT EXISTS public.representantes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fantasia TEXT NOT NULL,
  sigla TEXT,
  regiao TEXT,
  status TEXT NOT NULL DEFAULT 'Ativo',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create regioes table
CREATE TABLE IF NOT EXISTS public.regioes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  uf TEXT,
  status TEXT NOT NULL DEFAULT 'Ativo',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create gerentes table
CREATE TABLE IF NOT EXISTS public.gerentes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  email TEXT,
  usuario TEXT,
  status TEXT NOT NULL DEFAULT 'Ativo',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on all three tables
ALTER TABLE public.representantes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.regioes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gerentes ENABLE ROW LEVEL SECURITY;

-- RLS policies for representantes
DROP POLICY IF EXISTS "representantes_select_policy" ON public.representantes;
CREATE POLICY "representantes_select_policy" ON public.representantes
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "representantes_insert_policy" ON public.representantes;
CREATE POLICY "representantes_insert_policy" ON public.representantes
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "representantes_update_policy" ON public.representantes;
CREATE POLICY "representantes_update_policy" ON public.representantes
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "representantes_delete_policy" ON public.representantes;
CREATE POLICY "representantes_delete_policy" ON public.representantes
  FOR DELETE TO authenticated USING (true);

-- RLS policies for regioes
DROP POLICY IF EXISTS "regioes_select_policy" ON public.regioes;
CREATE POLICY "regioes_select_policy" ON public.regioes
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "regioes_insert_policy" ON public.regioes;
CREATE POLICY "regioes_insert_policy" ON public.regioes
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "regioes_update_policy" ON public.regioes;
CREATE POLICY "regioes_update_policy" ON public.regioes
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "regioes_delete_policy" ON public.regioes;
CREATE POLICY "regioes_delete_policy" ON public.regioes
  FOR DELETE TO authenticated USING (true);

-- RLS policies for gerentes
DROP POLICY IF EXISTS "gerentes_select_policy" ON public.gerentes;
CREATE POLICY "gerentes_select_policy" ON public.gerentes
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "gerentes_insert_policy" ON public.gerentes;
CREATE POLICY "gerentes_insert_policy" ON public.gerentes
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "gerentes_update_policy" ON public.gerentes;
CREATE POLICY "gerentes_update_policy" ON public.gerentes
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "gerentes_delete_policy" ON public.gerentes;
CREATE POLICY "gerentes_delete_policy" ON public.gerentes
  FOR DELETE TO authenticated USING (true);

-- updated_at triggers for all three tables
CREATE OR REPLACE FUNCTION public.update_representantes_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS representantes_updated_at ON public.representantes;
CREATE TRIGGER representantes_updated_at
  BEFORE UPDATE ON public.representantes
  FOR EACH ROW EXECUTE FUNCTION public.update_representantes_updated_at();

CREATE OR REPLACE FUNCTION public.update_regioes_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS regioes_updated_at ON public.regioes;
CREATE TRIGGER regioes_updated_at
  BEFORE UPDATE ON public.regioes
  FOR EACH ROW EXECUTE FUNCTION public.update_regioes_updated_at();

CREATE OR REPLACE FUNCTION public.update_gerentes_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS gerentes_updated_at ON public.gerentes;
CREATE TRIGGER gerentes_updated_at
  BEFORE UPDATE ON public.gerentes
  FOR EACH ROW EXECUTE FUNCTION public.update_gerentes_updated_at();

-- Seed initial auth user (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'bianca@bener.com.br') THEN
    INSERT INTO auth.users (
      id, instance_id, email, encrypted_password, email_confirmed_at,
      created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
      is_super_admin, role, aud,
      confirmation_token, recovery_token, email_change_token_new,
      email_change, email_change_token_current,
      phone, phone_change, phone_change_token, reauthentication_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000001',
      '00000000-0000-0000-0000-000000000000',
      'bianca@bener.com.br',
      crypt('Skip@Pass', gen_salt('bf')),
      NOW(), NOW(), NOW(),
      '{"provider": "email", "providers": ["email"]}',
      '{"name": "Bianca"}',
      false, 'authenticated', 'authenticated',
      '', '', '', '', '',
      NULL, '', '', ''
    );
  END IF;
END $$;

-- Seed profile with admin role (upsert)
INSERT INTO public.profiles (id, name, email, role)
VALUES ('00000000-0000-0000-0000-000000000001', 'Bianca', 'bianca@bener.com.br', 'admin')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  email = EXCLUDED.email,
  role = EXCLUDED.role;
