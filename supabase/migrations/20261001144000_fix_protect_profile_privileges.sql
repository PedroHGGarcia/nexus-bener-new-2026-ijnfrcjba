-- Correção da trigger protect_profile_privileges na tabela public.profiles
-- Permite operações de service_role (current_user = 'service_role' ou auth.role() = 'service_role')
-- e garante que em updates comuns apenas Admin Completo (via is_admin_completo()) possa alterar role e menu_access.

CREATE OR REPLACE FUNCTION public.protect_profile_privileges()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Permite operações executadas pelo backend com service_role (ex: Edge Functions)
  IF current_user = 'service_role' OR auth.role() = 'service_role' THEN
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
$$;
