-- Migration: Enforce strict backend validation on manager signature for proposals
-- Date: 2026-09-24
-- Rule: Only the manager explicitly associated with the proposal can record/update
--       the manager signature (assinatura_gerente_produto).
--       If the user is not the associated manager, saving or changing the signature is rejected.

CREATE OR REPLACE FUNCTION public.validate_proposta_gerente_signature()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_user_role TEXT;
  v_user_email TEXT;
  v_user_name TEXT;
  v_profile_gerente_id UUID;
  v_associated_gerente_id UUID;
  v_target_gerente_id UUID;
  v_target_gerente_email TEXT;
  v_target_gerente_usuario TEXT;
  v_target_gerente_nome TEXT;
  v_target_gerente_profile_id UUID;
  v_user_is_gerente_role BOOLEAN;
  v_is_authorized BOOLEAN := FALSE;
BEGIN
  v_user_id := auth.uid();

  -- Se não for uma chamada autenticada de usuário (ex: trigger interno ou job sem auth.uid), permite
  IF v_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Verificar se está inserindo ou alterando a assinatura do gerente
  -- Se for INSERT e assinatura_gerente_produto foi informada
  -- OU se for UPDATE e o valor de assinatura_gerente_produto mudou e não é nulo
  IF (TG_OP = 'INSERT' AND NEW.assinatura_gerente_produto IS NOT NULL)
     OR (TG_OP = 'UPDATE' AND NEW.assinatura_gerente_produto IS DISTINCT FROM OLD.assinatura_gerente_produto AND NEW.assinatura_gerente_produto IS NOT NULL) THEN

    -- Obter informações do usuário logado em profiles
    SELECT role, email, name, gerente_id 
    INTO v_user_role, v_user_email, v_user_name, v_profile_gerente_id
    FROM public.profiles
    WHERE id = v_user_id;

    -- REGRA: O usuário DEVE possuir papel de Gerente (isGerenteRole).
    -- Administradores que não são o gerente associado, representantes e outros NÃO podem assinar.
    v_user_is_gerente_role := (
      v_user_role ILIKE '%gerente%'
    );

    IF NOT v_user_is_gerente_role THEN
      RAISE EXCEPTION 'Permissão negada: somente o gerente associado à proposta tem permissão para cadastrar a assinatura de gerente.'
        USING ERRCODE = '42501';
    END IF;

    -- Descobrir qual gerente está associado a esta proposta
    v_associated_gerente_id := COALESCE(NEW.assinante_gerente_id, NEW.gerente);

    -- Se não há ID de gerente associado, mas há nome de gerente informado na proposta
    IF v_associated_gerente_id IS NULL AND NEW.nome_gerente_produto IS NOT NULL THEN
      SELECT id INTO v_associated_gerente_id
      FROM public.gerentes
      WHERE LOWER(nome) = LOWER(TRIM(NEW.nome_gerente_produto))
      LIMIT 1;
    END IF;

    -- Se mesmo assim nenhum gerente está associado à proposta, ninguém pode assinar como gerente
    IF v_associated_gerente_id IS NULL THEN
      RAISE EXCEPTION 'Permissão negada: não há gerente de produto associado a esta proposta.'
        USING ERRCODE = '42501';
    END IF;

    -- Carregar os dados do gerente associado
    SELECT id, email, usuario, nome, profile_id
    INTO v_target_gerente_id, v_target_gerente_email, v_target_gerente_usuario, v_target_gerente_nome, v_target_gerente_profile_id
    FROM public.gerentes
    WHERE id = v_associated_gerente_id;

    -- Verificar critérios de identidade entre o usuário logado e o gerente associado:
    -- 1. profile_id do gerente bate com o user_id do usuário logado
    IF v_target_gerente_profile_id IS NOT NULL AND v_target_gerente_profile_id = v_user_id THEN
      v_is_authorized := TRUE;
    END IF;

    -- 2. gerente_id no profile do usuário logado bate com o ID do gerente associado
    IF NOT v_is_authorized AND v_profile_gerente_id IS NOT NULL AND v_profile_gerente_id = v_associated_gerente_id THEN
      v_is_authorized := TRUE;
    END IF;

    -- 3. Caso o id de profiles ou gerentes seja unificado
    IF NOT v_is_authorized AND v_associated_gerente_id = v_user_id THEN
      v_is_authorized := TRUE;
    END IF;

    -- 4. Bate por email (email do profile = email do gerente ou usuario do gerente)
    IF NOT v_is_authorized AND v_user_email IS NOT NULL THEN
      IF (v_target_gerente_email IS NOT NULL AND LOWER(TRIM(v_target_gerente_email)) = LOWER(TRIM(v_user_email)))
         OR (v_target_gerente_usuario IS NOT NULL AND LOWER(TRIM(v_target_gerente_usuario)) = LOWER(TRIM(v_user_email))) THEN
        v_is_authorized := TRUE;
      END IF;
    END IF;

    -- 5. Bate por registro de gerente onde profile_id ou email é do usuário atual
    IF NOT v_is_authorized THEN
      IF EXISTS (
        SELECT 1 FROM public.gerentes g
        WHERE g.id = v_associated_gerente_id
          AND (
            g.profile_id = v_user_id
            OR (v_user_email IS NOT NULL AND (
              LOWER(TRIM(g.email)) = LOWER(TRIM(v_user_email))
              OR LOWER(TRIM(g.usuario)) = LOWER(TRIM(v_user_email))
            ))
          )
      ) THEN
        v_is_authorized := TRUE;
      END IF;
    END IF;

    IF NOT v_is_authorized THEN
      RAISE EXCEPTION 'Permissão negada: você não é o gerente associado a esta proposta e não pode cadastrar esta assinatura.'
        USING ERRCODE = '42501';
    END IF;

  END IF;

  RETURN NEW;
END;
$$;

-- Criar trigger BEFORE INSERT OR UPDATE em public.propostas
DROP TRIGGER IF EXISTS trg_validate_proposta_gerente_signature ON public.propostas;
CREATE TRIGGER trg_validate_proposta_gerente_signature
  BEFORE INSERT OR UPDATE ON public.propostas
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_proposta_gerente_signature();
