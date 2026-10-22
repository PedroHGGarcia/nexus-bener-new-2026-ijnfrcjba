-- Migration: 20260914153000_representantes_modulo_completo.sql
-- Adiciona colunas reg, cod, celular, endereco, email, telefone na tabela representantes (com reg único)
-- Cria tabelas N:N representante_categorias e representante_regioes
-- Popula tabela regioes com os 26 estados + DF do Brasil de domínio público

-- 1. Alterar tabela representantes
ALTER TABLE public.representantes
  ADD COLUMN IF NOT EXISTS reg integer,
  ADD COLUMN IF NOT EXISTS cod text,
  ADD COLUMN IF NOT EXISTS celular text,
  ADD COLUMN IF NOT EXISTS endereco text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS telefone text;

-- Índice e restrição UNIQUE para reg (se não houver)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'representantes_reg_key'
  ) THEN
    ALTER TABLE public.representantes ADD CONSTRAINT representantes_reg_key UNIQUE (reg);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_representantes_reg ON public.representantes(reg);
CREATE INDEX IF NOT EXISTS idx_representantes_cod ON public.representantes(cod);
CREATE INDEX IF NOT EXISTS idx_representantes_razao_social ON public.representantes(razao_social);

-- 2. Tabela de vínculo representante_categorias (N:N com categorias)
CREATE TABLE IF NOT EXISTS public.representante_categorias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  representante_id uuid NOT NULL REFERENCES public.representantes(id) ON DELETE CASCADE,
  categoria_id uuid NOT NULL REFERENCES public.categorias(id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT uq_representante_categoria UNIQUE (representante_id, categoria_id)
);

CREATE INDEX IF NOT EXISTS idx_representante_categorias_rep ON public.representante_categorias(representante_id);
CREATE INDEX IF NOT EXISTS idx_representante_categorias_cat ON public.representante_categorias(categoria_id);

ALTER TABLE public.representante_categorias ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "representante_categorias_anon_select" ON public.representante_categorias;
CREATE POLICY "representante_categorias_anon_select" ON public.representante_categorias
  FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "representante_categorias_auth_all" ON public.representante_categorias;
CREATE POLICY "representante_categorias_auth_all" ON public.representante_categorias
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 3. Tabela de vínculo representante_regioes (N:N com regioes)
CREATE TABLE IF NOT EXISTS public.representante_regioes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  representante_id uuid NOT NULL REFERENCES public.representantes(id) ON DELETE CASCADE,
  regiao_id uuid NOT NULL REFERENCES public.regioes(id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT uq_representante_regiao UNIQUE (representante_id, regiao_id)
);

CREATE INDEX IF NOT EXISTS idx_representante_regioes_rep ON public.representante_regioes(representante_id);
CREATE INDEX IF NOT EXISTS idx_representante_regioes_reg ON public.representante_regioes(regiao_id);

ALTER TABLE public.representante_regioes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "representante_regioes_anon_select" ON public.representante_regioes;
CREATE POLICY "representante_regioes_anon_select" ON public.representante_regioes
  FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "representante_regioes_auth_all" ON public.representante_regioes;
CREATE POLICY "representante_regioes_auth_all" ON public.representante_regioes
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 4. Garantir que a tabela regioes tenha índice único por UF ou nome
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'regioes_uf_key'
  ) THEN
    ALTER TABLE public.regioes ADD CONSTRAINT regioes_uf_key UNIQUE (uf);
  END IF;
END $$;

-- 5. Popular lista estática e pública dos 26 estados brasileiros + DF na tabela regioes
INSERT INTO public.regioes (nome, uf, status) VALUES
  ('Acre', 'AC', 'Ativo'),
  ('Alagoas', 'AL', 'Ativo'),
  ('Amapá', 'AP', 'Ativo'),
  ('Amazonas', 'AM', 'Ativo'),
  ('Bahia', 'BA', 'Ativo'),
  ('Ceará', 'CE', 'Ativo'),
  ('Distrito Federal', 'DF', 'Ativo'),
  ('Espírito Santo', 'ES', 'Ativo'),
  ('Goiás', 'GO', 'Ativo'),
  ('Maranhão', 'MA', 'Ativo'),
  ('Mato Grosso', 'MT', 'Ativo'),
  ('Mato Grosso do Sul', 'MS', 'Ativo'),
  ('Minas Gerais', 'MG', 'Ativo'),
  ('Pará', 'PA', 'Ativo'),
  ('Paraíba', 'PB', 'Ativo'),
  ('Paraná', 'PR', 'Ativo'),
  ('Pernambuco', 'PE', 'Ativo'),
  ('Piauí', 'PI', 'Ativo'),
  ('Rio de Janeiro', 'RJ', 'Ativo'),
  ('Rio Grande do Norte', 'RN', 'Ativo'),
  ('Rio Grande do Sul', 'RS', 'Ativo'),
  ('Rondônia', 'RO', 'Ativo'),
  ('Roraima', 'RR', 'Ativo'),
  ('Santa Catarina', 'SC', 'Ativo'),
  ('São Paulo', 'SP', 'Ativo'),
  ('Sergipe', 'SE', 'Ativo'),
  ('Tocantins', 'TO', 'Ativo')
ON CONFLICT (uf) DO UPDATE SET
  nome = EXCLUDED.nome,
  status = 'Ativo';
