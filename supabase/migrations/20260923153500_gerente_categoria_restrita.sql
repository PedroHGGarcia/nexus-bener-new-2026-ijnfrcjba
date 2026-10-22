-- Migration: Add categoria_restrita_id to gerentes, set for Gilberto Baksa and enforce category restrictions in proposals
-- Migration date: 2026-09-23

-- 1. Add categoria_restrita_id to gerentes
ALTER TABLE public.gerentes
  ADD COLUMN IF NOT EXISTS categoria_restrita_id UUID REFERENCES public.categorias(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_gerentes_categoria_restrita ON public.gerentes(categoria_restrita_id);

-- 2. Update Gilberto Baksa (id 8e3fb89a-04b9-4604-afc5-e6348584a237) with Injetoras category (b1183624-faa9-4b15-b178-77d2b511dad9)
UPDATE public.gerentes
SET categoria_restrita_id = 'b1183624-faa9-4b15-b178-77d2b511dad9'::uuid
WHERE id = '8e3fb89a-04b9-4604-afc5-e6348584a237'::uuid
   OR nome ILIKE '%Gilberto Baksa%';

-- 3. Create or replace validation function for propostas
-- Integrates existing validate_proposta_representante logic with categoria_restrita check
CREATE OR REPLACE FUNCTION public.validate_proposta_representante()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $$
DECLARE
  v_user_role TEXT;
  v_user_email TEXT;
  v_user_id UUID;
  v_user_rep_id UUID;
  v_rep_gerente_id UUID;
  v_profile_gerente_id UUID;
  v_gerente_id UUID;
  v_cat_restrita_id UUID;
  v_versao_cat_id UUID;
  v_cat_nome TEXT;
BEGIN
  v_user_id := auth.uid();

  -- Se chamada não autenticada (ex: serviço interno / trigger sem contexto auth), permite
  IF v_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Buscar role, email e gerente_id do usuário no profiles
  SELECT role, email, gerente_id INTO v_user_role, v_user_email, v_profile_gerente_id
  FROM public.profiles
  WHERE id = v_user_id;

  -- Se for admin ('Admin Completo' ou 'admin'), não há restrição de representante nem de categoria
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

    -- Localizar o representante vinculado a este usuário e seu gerente_id:
    SELECT id, gerente_id INTO v_user_rep_id, v_rep_gerente_id
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

    -- Determinar o gerente vinculado (prioridade: representantes.gerente_id, fallback: profiles.gerente_id)
    v_gerente_id := COALESCE(v_rep_gerente_id, v_profile_gerente_id);

    IF v_gerente_id IS NOT NULL THEN
      -- Verificar se o gerente possui categoria_restrita_id configurada
      SELECT categoria_restrita_id INTO v_cat_restrita_id
      FROM public.gerentes
      WHERE id = v_gerente_id;

      IF v_cat_restrita_id IS NOT NULL THEN
        -- Se a proposta tiver versao preenchida (versão principal)
        IF NEW.versao IS NOT NULL THEN
          SELECT p.categoria INTO v_versao_cat_id
          FROM public.versoes v
          JOIN public.modelos m ON v.modelo = m.id
          JOIN public.produtos p ON m.produto = p.id
          WHERE v.id = NEW.versao;

          IF v_versao_cat_id IS NULL OR v_versao_cat_id <> v_cat_restrita_id THEN
            SELECT nome INTO v_cat_nome FROM public.categorias WHERE id = v_cat_restrita_id;
            RAISE EXCEPTION 'Permissão negada: você só pode emitir propostas com máquinas da sua categoria de atuação (%)', COALESCE(v_cat_nome, 'restrita')
              USING ERRCODE = 'P0001';
          END IF;
        END IF;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- 4. Criar trigger de validação para proposta_versoes (caso de propostas pacote / múltiplas versões)
CREATE OR REPLACE FUNCTION public.validate_proposta_versoes_categoria_restrita()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $$
DECLARE
  v_user_role TEXT;
  v_user_email TEXT;
  v_user_id UUID;
  v_user_rep_id UUID;
  v_rep_gerente_id UUID;
  v_profile_gerente_id UUID;
  v_gerente_id UUID;
  v_cat_restrita_id UUID;
  v_versao_cat_id UUID;
  v_cat_nome TEXT;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT role, email, gerente_id INTO v_user_role, v_user_email, v_profile_gerente_id
  FROM public.profiles
  WHERE id = v_user_id;

  IF v_user_role ILIKE '%admin%' THEN
    RETURN NEW;
  END IF;

  IF v_user_role ILIKE '%vendedor%' OR v_user_role ILIKE '%representante%' OR v_user_role = 'vendedor' THEN
    SELECT id, gerente_id INTO v_user_rep_id, v_rep_gerente_id
    FROM public.representantes
    WHERE profile_id = v_user_id
       OR (v_user_email IS NOT NULL AND (
            LOWER(email) = LOWER(v_user_email)
            OR emails @> to_jsonb(LOWER(v_user_email))::jsonb
            OR emails @> to_jsonb(v_user_email)::jsonb
          ))
    LIMIT 1;

    v_gerente_id := COALESCE(v_rep_gerente_id, v_profile_gerente_id);

    IF v_gerente_id IS NOT NULL THEN
      SELECT categoria_restrita_id INTO v_cat_restrita_id
      FROM public.gerentes
      WHERE id = v_gerente_id;

      IF v_cat_restrita_id IS NOT NULL THEN
        SELECT p.categoria INTO v_versao_cat_id
        FROM public.versoes v
        JOIN public.modelos m ON v.modelo = m.id
        JOIN public.produtos p ON m.produto = p.id
        WHERE v.id = NEW.versao_id;

        IF v_versao_cat_id IS NULL OR v_versao_cat_id <> v_cat_restrita_id THEN
          SELECT nome INTO v_cat_nome FROM public.categorias WHERE id = v_cat_restrita_id;
          RAISE EXCEPTION 'Permissão negada: você só pode emitir propostas com máquinas da sua categoria de atuação (%)', COALESCE(v_cat_nome, 'restrita')
            USING ERRCODE = 'P0001';
        END IF;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_proposta_versoes_categoria_restrita ON public.proposta_versoes;
CREATE TRIGGER trg_validate_proposta_versoes_categoria_restrita
  BEFORE INSERT OR UPDATE ON public.proposta_versoes
  FOR EACH ROW EXECUTE FUNCTION public.validate_proposta_versoes_categoria_restrita();
