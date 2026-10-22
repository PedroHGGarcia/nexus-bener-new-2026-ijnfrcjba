-- Add campos_adicionais and atualizado_por to public.tipos_proposta
-- Current timestamp: 2026-08-04 20:31:37

ALTER TABLE public.tipos_proposta
  ADD COLUMN IF NOT EXISTS campos_adicionais JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS atualizado_por TEXT;

-- Ensure seed user bianca@bener.com.br exists in auth.users idempotently
DO $$
DECLARE
  new_user_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'bianca@bener.com.br') THEN
    new_user_id := gen_random_uuid();
    INSERT INTO auth.users (
      id, instance_id, email, encrypted_password, email_confirmed_at,
      created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
      is_super_admin, role, aud,
      confirmation_token, recovery_token, email_change_token_new,
      email_change, email_change_token_current,
      phone, phone_change, phone_change_token, reauthentication_token
    ) VALUES (
      new_user_id,
      '00000000-0000-0000-0000-000000000000',
      'bianca@bener.com.br',
      crypt('Skip@Pass', gen_salt('bf')),
      NOW(), NOW(), NOW(),
      '{"provider": "email", "providers": ["email"]}',
      '{"name": "Bianca Bener"}',
      false, 'authenticated', 'authenticated',
      '', '', '', '', '',
      NULL,
      '', '', ''
    );

    INSERT INTO public.profiles (id, email, name, role, status)
    VALUES (new_user_id, 'bianca@bener.com.br', 'Bianca Bener', 'Admin Completo', 'ativo')
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;
