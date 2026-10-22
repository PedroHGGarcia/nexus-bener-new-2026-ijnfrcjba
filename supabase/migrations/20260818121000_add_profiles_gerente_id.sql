-- Adiciona coluna gerente_id em profiles (FK → gerentes.id), nullable.
-- Permite associar um Vendedor a um Gerente Responsável.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS gerente_id UUID REFERENCES public.gerentes(id) ON DELETE SET NULL;

-- Índice para acelerar a busca de vendedores por gerente_id.
CREATE INDEX IF NOT EXISTS idx_profiles_gerente_id ON public.profiles (gerente_id);

-- A tabela profiles já possui RLS habilitado com policies "authenticated_all",
-- que cobrem SELECT/INSERT/UPDATE/DELETE — nenhuma policy nova é necessária.
