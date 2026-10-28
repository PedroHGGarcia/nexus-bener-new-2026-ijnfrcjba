-- Migration: Fix protect_profile_privileges to allow migrations/superuser context
-- and Seed dos usuários para os 4 gerentes ativos sem login

CREATE OR REPLACE FUNCTION public.protect_profile_privileges()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  -- Permite operações executadas pelo backend com service_role, superusuário de migration (postgres, supabase_admin) ou quando não há auth.uid() (execução direta de migration/seed)
  IF current_user IN ('service_role', 'postgres', 'supabase_admin') OR auth.role() = 'service_role' OR auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- Se for usuário autenticado comum, apenas Admin Completo pode alterar role ou menu_access
  IF (OLD.role IS DISTINCT FROM NEW.role) OR
     (OLD.menu_access IS DISTINCT FROM NEW.menu_access) THEN
    IF NOT (public.is_admin_completo() OR public.is_admin()) THEN
      RAISE EXCEPTION 'Somente administradores alteram perfil ou acesso';
    END IF;
  END IF;

  -- Apenas admin pode alterar status ou gerente_id
  IF (OLD.status IS DISTINCT FROM NEW.status) OR
     (OLD.gerente_id IS DISTINCT FROM NEW.gerente_id) THEN
    IF NOT public.is_admin() THEN
      RAISE EXCEPTION 'Somente administradores alteram status ou gerente vinculado';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

DO $$
DECLARE
  v_menu_access jsonb;
  v_new_id uuid;
  v_ario_ger_id uuid := 'f802f107-426f-4fb1-bd38-6ce9398e83ce'::uuid;
  v_elvis_ger_id uuid := '26aca0a0-d897-4569-9a47-8aac016cf11a'::uuid;
  v_francesco_ger_id uuid := '7652bada-ffbf-4af6-9069-7612610a68fd'::uuid;
  v_wanderley_ger_id uuid := '4f630891-6dfb-4405-a764-13886f36bf66'::uuid;
  v_gilberto_ger_id uuid := '8e3fb89a-04b9-4604-afc5-e6348584a237'::uuid;
BEGIN
  -- Busca permissões padrão da role Gerente
  SELECT menu_access INTO v_menu_access
  FROM public.role_templates
  WHERE name = 'Gerente'
  LIMIT 1;

  IF v_menu_access IS NULL THEN
    v_menu_access := '["dashboard","cadastros-clientes","cadastros-representantes","cadastros-regioes","cadastros-gerentes","cadastros-prepostos","eventos","projetos","propostas-dashboard","propostas-emitir","propostas-criadas","produtos-lista","notificacoes","area-atuacao","perfil"]'::jsonb;
  END IF;

  -- 1. Ario Grandisoli
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE LOWER(email) = 'ario@bener.com.br') THEN
    v_new_id := gen_random_uuid();
    INSERT INTO auth.users (
      id, instance_id, email, encrypted_password, email_confirmed_at,
      created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
      is_super_admin, role, aud,
      confirmation_token, recovery_token, email_change_token_new,
      email_change, email_change_token_current,
      phone, phone_change, phone_change_token, reauthentication_token
    ) VALUES (
      v_new_id,
      '00000000-0000-0000-0000-000000000000'::uuid,
      'ario@bener.com.br',
      crypt('Bener@2026', gen_salt('bf')),
      NOW(), NOW(), NOW(),
      '{"provider": "email", "providers": ["email"]}'::jsonb,
      '{"name": "Ario Grandisoli", "role": "Gerente", "email_verified": true}'::jsonb,
      false, 'authenticated', 'authenticated',
      '', '', '', '', '',
      NULL, '', '', ''
    );

    INSERT INTO public.profiles (
      id, name, email, role, setor, status, menu_access, gerente_id, celular
    ) VALUES (
      v_new_id,
      'Ario Grandisoli',
      'ario@bener.com.br',
      'Gerente',
      'Gerente de Produto',
      'Ativo',
      v_menu_access,
      v_ario_ger_id,
      '(19) 99833-7181'
    )
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      email = EXCLUDED.email,
      role = EXCLUDED.role,
      setor = EXCLUDED.setor,
      status = 'Ativo',
      menu_access = EXCLUDED.menu_access,
      gerente_id = EXCLUDED.gerente_id,
      celular = EXCLUDED.celular;

    UPDATE public.gerentes
    SET profile_id = v_new_id,
        email = 'ario@bener.com.br',
        usuario = 'Ario Grandisoli'
    WHERE id = v_ario_ger_id;
  END IF;

  -- 2. Elvis Pretto
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE LOWER(email) = 'elvis.pretto@bener.com.br') THEN
    v_new_id := gen_random_uuid();
    INSERT INTO auth.users (
      id, instance_id, email, encrypted_password, email_confirmed_at,
      created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
      is_super_admin, role, aud,
      confirmation_token, recovery_token, email_change_token_new,
      email_change, email_change_token_current,
      phone, phone_change, phone_change_token, reauthentication_token
    ) VALUES (
      v_new_id,
      '00000000-0000-0000-0000-000000000000'::uuid,
      'elvis.pretto@bener.com.br',
      crypt('Bener@2026', gen_salt('bf')),
      NOW(), NOW(), NOW(),
      '{"provider": "email", "providers": ["email"]}'::jsonb,
      '{"name": "Elvis Pretto", "role": "Gerente", "email_verified": true}'::jsonb,
      false, 'authenticated', 'authenticated',
      '', '', '', '', '',
      NULL, '', '', ''
    );

    INSERT INTO public.profiles (
      id, name, email, role, setor, status, menu_access, gerente_id, celular
    ) VALUES (
      v_new_id,
      'Elvis Pretto',
      'elvis.pretto@bener.com.br',
      'Gerente',
      'Gerente de Produto',
      'Ativo',
      v_menu_access,
      v_elvis_ger_id,
      '(19) 99887-0632'
    )
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      email = EXCLUDED.email,
      role = EXCLUDED.role,
      setor = EXCLUDED.setor,
      status = 'Ativo',
      menu_access = EXCLUDED.menu_access,
      gerente_id = EXCLUDED.gerente_id,
      celular = EXCLUDED.celular;

    UPDATE public.gerentes
    SET profile_id = v_new_id,
        email = 'elvis.pretto@bener.com.br',
        usuario = 'Elvis Pretto'
    WHERE id = v_elvis_ger_id;
  END IF;

  -- 3. Francesco Isola
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE LOWER(email) = 'francesco@bener.com.br') THEN
    v_new_id := gen_random_uuid();
    INSERT INTO auth.users (
      id, instance_id, email, encrypted_password, email_confirmed_at,
      created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
      is_super_admin, role, aud,
      confirmation_token, recovery_token, email_change_token_new,
      email_change, email_change_token_current,
      phone, phone_change, phone_change_token, reauthentication_token
    ) VALUES (
      v_new_id,
      '00000000-0000-0000-0000-000000000000'::uuid,
      'francesco@bener.com.br',
      crypt('Bener@2026', gen_salt('bf')),
      NOW(), NOW(), NOW(),
      '{"provider": "email", "providers": ["email"]}'::jsonb,
      '{"name": "Francesco Isola", "role": "Gerente", "email_verified": true}'::jsonb,
      false, 'authenticated', 'authenticated',
      '', '', '', '', '',
      NULL, '', '', ''
    );

    INSERT INTO public.profiles (
      id, name, email, role, setor, status, menu_access, gerente_id, celular
    ) VALUES (
      v_new_id,
      'Francesco Isola',
      'francesco@bener.com.br',
      'Gerente',
      'Gerente de Vendas',
      'Ativo',
      v_menu_access,
      v_francesco_ger_id,
      '(19) 99937-0931'
    )
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      email = EXCLUDED.email,
      role = EXCLUDED.role,
      setor = EXCLUDED.setor,
      status = 'Ativo',
      menu_access = EXCLUDED.menu_access,
      gerente_id = EXCLUDED.gerente_id,
      celular = EXCLUDED.celular;

    UPDATE public.gerentes
    SET profile_id = v_new_id,
        email = 'francesco@bener.com.br',
        usuario = 'Francesco Isola'
    WHERE id = v_francesco_ger_id;
  END IF;

  -- 4. Wanderley Goya
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE LOWER(email) = 'wanderley@bener.com.br') THEN
    v_new_id := gen_random_uuid();
    INSERT INTO auth.users (
      id, instance_id, email, encrypted_password, email_confirmed_at,
      created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
      is_super_admin, role, aud,
      confirmation_token, recovery_token, email_change_token_new,
      email_change, email_change_token_current,
      phone, phone_change, phone_change_token, reauthentication_token
    ) VALUES (
      v_new_id,
      '00000000-0000-0000-0000-000000000000'::uuid,
      'wanderley@bener.com.br',
      crypt('Bener@2026', gen_salt('bf')),
      NOW(), NOW(), NOW(),
      '{"provider": "email", "providers": ["email"]}'::jsonb,
      '{"name": "Wanderley Goya", "role": "Gerente", "email_verified": true}'::jsonb,
      false, 'authenticated', 'authenticated',
      '', '', '', '', '',
      NULL, '', '', ''
    );

    INSERT INTO public.profiles (
      id, name, email, role, setor, status, menu_access, gerente_id, celular
    ) VALUES (
      v_new_id,
      'Wanderley Goya',
      'wanderley@bener.com.br',
      'Gerente',
      'Gerente de Vendas',
      'Ativo',
      v_menu_access,
      v_wanderley_ger_id,
      '(19) 99937-1076'
    )
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      email = EXCLUDED.email,
      role = EXCLUDED.role,
      setor = EXCLUDED.setor,
      status = 'Ativo',
      menu_access = EXCLUDED.menu_access,
      gerente_id = EXCLUDED.gerente_id,
      celular = EXCLUDED.celular;

    UPDATE public.gerentes
    SET profile_id = v_new_id,
        email = 'wanderley@bener.com.br',
        usuario = 'Wanderley Goya'
    WHERE id = v_wanderley_ger_id;
  END IF;

  -- 5. Vincular o profile de Gilberto Baksa ao seu próprio gerente_id
  UPDATE public.profiles
  SET gerente_id = v_gilberto_ger_id
  WHERE id = '7aace8ba-8dd0-404c-9d86-c72ffcd55106'::uuid
    AND (gerente_id IS NULL OR gerente_id <> v_gilberto_ger_id);

  UPDATE public.gerentes
  SET usuario = 'Gilberto Baksa'
  WHERE id = v_gilberto_ger_id
    AND (usuario IS NULL OR usuario = '');

END $$;
