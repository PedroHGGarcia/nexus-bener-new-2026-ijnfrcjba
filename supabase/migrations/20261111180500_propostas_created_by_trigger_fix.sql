-- Migration follow-up: trigger criado somente com auth.uid() — valor enviado pelo cliente é sempre ignorado;
-- admins podem definir created_by manualmente (importações), representante/vendedor nunca.
CREATE OR REPLACE FUNCTION public.set_proposta_created_by()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.created_by IS NULL OR NOT public.is_admin() THEN
    NEW.created_by := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;
