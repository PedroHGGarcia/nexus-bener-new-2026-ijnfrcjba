-- Adicionar coluna profile_id às tabelas gerentes e representantes para vincular ao auth.users/profiles
ALTER TABLE public.gerentes
  ADD COLUMN IF NOT EXISTS profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_gerentes_profile_id ON public.gerentes (profile_id);

ALTER TABLE public.representantes
  ADD COLUMN IF NOT EXISTS profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_representantes_profile_id ON public.representantes (profile_id);

-- Backfill / sincronização inicial: vincular usuário existente Eduardo Almeida (se houver perfil de Gerente)
DO $$
DECLARE
  v_eduardo_profile RECORD;
  v_gerente_id UUID;
BEGIN
  -- Procura profile com papel Gerente e email do Eduardo
  SELECT id, name, email INTO v_eduardo_profile
  FROM public.profiles
  WHERE role = 'Gerente' AND email ILIKE '%eduardo.almeida%'
  LIMIT 1;

  IF FOUND THEN
    -- Verifica se já existe registro em gerentes com esse email
    SELECT id INTO v_gerente_id
    FROM public.gerentes
    WHERE email ILIKE v_eduardo_profile.email
    LIMIT 1;

    IF v_gerente_id IS NOT NULL THEN
      UPDATE public.gerentes
      SET profile_id = v_eduardo_profile.id,
          nome = COALESCE(NULLIF(nome, ''), v_eduardo_profile.name),
          status = 'Ativo'
      WHERE id = v_gerente_id;
    ELSE
      INSERT INTO public.gerentes (nome, email, status, cargo, profile_id)
      VALUES (v_eduardo_profile.name, v_eduardo_profile.email, 'Ativo', 'Gerente', v_eduardo_profile.id);
    END IF;
  END IF;
END $$;
