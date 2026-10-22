-- Migration: Ensure all active managers have a corresponding entry in representantes
-- This guarantees FK integrity for propostas.representante and propostas.assinante_representante_id
-- when a manager is selected as commercial representative.

DO $$
DECLARE
  g RECORD;
  v_rep_id UUID;
  v_rep_email TEXT;
BEGIN
  FOR g IN 
    SELECT id, nome, email, profile_id 
    FROM public.gerentes 
    WHERE status = 'Ativo'
  LOOP
    v_rep_email := LOWER(TRIM(COALESCE(g.email, '')));
    
    -- Check if a representante already exists by email or matching profile_id
    SELECT id INTO v_rep_id
    FROM public.representantes
    WHERE (v_rep_email <> '' AND LOWER(TRIM(email)) = v_rep_email)
       OR (v_rep_email <> '' AND emails @> to_jsonb(v_rep_email)::jsonb)
       OR (g.profile_id IS NOT NULL AND profile_id = g.profile_id)
       OR (LOWER(TRIM(fantasia)) = LOWER(TRIM(g.nome)))
    LIMIT 1;

    IF v_rep_id IS NULL THEN
      -- Create entry in representantes for the manager
      INSERT INTO public.representantes (
        fantasia,
        razao_social,
        email,
        emails,
        status,
        profile_id,
        gerente_id
      ) VALUES (
        g.nome,
        g.nome,
        NULLIF(g.email, ''),
        CASE WHEN g.email IS NOT NULL AND g.email <> '' THEN jsonb_build_array(g.email) ELSE '[]'::jsonb END,
        'Ativo',
        g.profile_id,
        g.id
      );
    END IF;
  END LOOP;
END $$;
