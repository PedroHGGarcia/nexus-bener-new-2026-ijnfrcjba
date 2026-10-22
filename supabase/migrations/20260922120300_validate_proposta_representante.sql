-- Validação server-side de representante em propostas
-- Regra: usuários com papel representante/vendedor só podem salvar propostas vinculadas a seu próprio cadastro de representante.
-- Administradores (Admin Completo / admin) podem emitir/editar para qualquer representante.

CREATE OR REPLACE FUNCTION public.validate_proposta_representante()
RETURNS TRIGGER AS $$
DECLARE
  v_user_role TEXT;
  v_user_email TEXT;
  v_user_id UUID;
  v_user_rep_id UUID;
BEGIN
  v_user_id := auth.uid();

  -- Se chamada não autenticada (ex: serviço interno / trigger sem contexto auth), permite
  IF v_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Buscar role e email do usuário no profiles
  SELECT role, email INTO v_user_role, v_user_email
  FROM public.profiles
  WHERE id = v_user_id;

  -- Se for admin ('Admin Completo' ou 'admin'), não há restrição de representante
  IF v_user_role ILIKE '%admin%' THEN
    RETURN NEW;
  END IF;

  -- Se o papel for Vendedor ou Representante (qualquer variação)
  IF v_user_role ILIKE '%vendedor%' OR v_user_role ILIKE '%representante%' OR v_user_role = 'vendedor' THEN
    -- A proposta DEVE ter um representante informado
    IF NEW.representante IS NULL THEN
      RAISE EXCEPTION 'Usuário com papel de representante deve emitir proposta vinculada ao seu registro de representante.'
        USING ERRCODE = 'P0001';
    END IF;

    -- Localizar o representante vinculado a este usuário:
    -- 1) por profile_id
    -- 2) por email direto
    -- 3) pelo array JSONB emails
    SELECT id INTO v_user_rep_id
    FROM public.representantes
    WHERE profile_id = v_user_id
       OR (v_user_email IS NOT NULL AND (
            LOWER(email) = LOWER(v_user_email)
            OR emails @> to_jsonb(LOWER(v_user_email))::jsonb
            OR emails @> to_jsonb(v_user_email)::jsonb
          ))
    LIMIT 1;

    IF v_user_rep_id IS NULL THEN
      RAISE EXCEPTION 'Seu usuário (%) não possui um cadastro de representante vinculado. Entre em contato com o suporte ou administrador.', COALESCE(v_user_email, v_user_id::text)
        USING ERRCODE = 'P0001';
    END IF;

    IF NEW.representante <> v_user_rep_id THEN
      RAISE EXCEPTION 'Permissão negada: você só pode emitir ou salvar propostas em nome do seu próprio cadastro de representante.'
        USING ERRCODE = 'P0001';
    END IF;

    -- Garante que assinante_representante_id também esteja com o representante correto
    IF NEW.assinante_representante_id IS NULL OR NEW.assinante_representante_id <> v_user_rep_id THEN
      NEW.assinante_representante_id := v_user_rep_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para INSERT e UPDATE em public.propostas
DROP TRIGGER IF EXISTS trg_validate_proposta_representante ON public.propostas;
CREATE TRIGGER trg_validate_proposta_representante
  BEFORE INSERT OR UPDATE ON public.propostas
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_proposta_representante();
