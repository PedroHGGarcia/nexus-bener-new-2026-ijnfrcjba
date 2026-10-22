-- Migração: Adicionar estado_atuacao em profiles, sincronizar com representantes e representante_regioes, e reforçar RLS para Vendedor/Representante
-- Data: 2026-09-22 17:00:00

-- 1. Coluna estado_atuacao em profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS estado_atuacao TEXT;

-- 2. Backfill inicial a partir de representantes já existentes vinculados a profiles
UPDATE public.profiles p
SET estado_atuacao = r.estado
FROM public.representantes r
WHERE r.profile_id = p.id
  AND r.estado IS NOT NULL
  AND r.estado <> ''
  AND (p.estado_atuacao IS NULL OR p.estado_atuacao = '');

-- 3. Função e trigger para manter profiles.estado_atuacao sincronizado com representantes.estado e representante_regioes
CREATE OR REPLACE FUNCTION public.sync_profile_estado_atuacao()
RETURNS trigger AS $$
DECLARE
  v_rep_id UUID;
  v_regiao_id UUID;
BEGIN
  -- Apenas quando for vendedor ou representante e houver estado_atuacao informado
  IF (NEW.role ILIKE '%vendedor%' OR NEW.role ILIKE '%representante%') AND NEW.estado_atuacao IS NOT NULL AND NEW.estado_atuacao <> '' THEN
    -- Localiza representante vinculado a este profile
    SELECT id INTO v_rep_id
    FROM public.representantes
    WHERE profile_id = NEW.id
       OR (NEW.email IS NOT NULL AND (
            LOWER(email) = LOWER(NEW.email)
            OR emails @> to_jsonb(LOWER(NEW.email))::jsonb
            OR emails @> to_jsonb(NEW.email)::jsonb
          ))
    LIMIT 1;

    IF v_rep_id IS NOT NULL THEN
      -- Atualiza estado do representante
      UPDATE public.representantes
      SET estado = UPPER(NEW.estado_atuacao)
      WHERE id = v_rep_id
        AND (estado IS NULL OR estado <> UPPER(NEW.estado_atuacao));

      -- Localiza a região correspondente à UF na tabela regioes
      SELECT id INTO v_regiao_id
      FROM public.regioes
      WHERE uf = UPPER(NEW.estado_atuacao)
      LIMIT 1;

      IF v_regiao_id IS NOT NULL THEN
        -- Insere na tabela representante_regioes se ainda não existir
        INSERT INTO public.representante_regioes (representante_id, regiao_id)
        VALUES (v_rep_id, v_regiao_id)
        ON CONFLICT (representante_id, regiao_id) DO NOTHING;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_profile_estado_atuacao ON public.profiles;
CREATE TRIGGER trg_sync_profile_estado_atuacao
AFTER INSERT OR UPDATE OF estado_atuacao, role ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.sync_profile_estado_atuacao();

-- 4. Função auxiliar para verificar se usuário logado é Vendedor / Representante
CREATE OR REPLACE FUNCTION public.is_vendedor_ou_representante()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND (role ILIKE '%vendedor%' OR role ILIKE '%representante%')
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 5. Atualizar RLS de Projetos
-- Admin e Gerente mantêm visão global / total.
-- Vendedor / Representante vê apenas projetos criados por ele (projetos.user = auth.uid()::text) OU onde é membro (projeto_membros)
DROP POLICY IF EXISTS "projetos_authenticated_select" ON public.projetos;
DROP POLICY IF EXISTS "projetos_authenticated_select_licitacao" ON public.projetos;
DROP POLICY IF EXISTS "projetos_authenticated_all" ON public.projetos;
DROP POLICY IF EXISTS "projetos_authenticated_update" ON public.projetos;
DROP POLICY IF EXISTS "projetos_authenticated_delete" ON public.projetos;

CREATE POLICY "projetos_authenticated_select" ON public.projetos
FOR SELECT TO authenticated
USING (
  is_admin()
  OR (NOT is_vendedor_ou_representante())
  OR ("user" = auth.uid()::text)
  OR EXISTS (
    SELECT 1 FROM public.projeto_membros pm
    WHERE pm.projeto_id = projetos.id
      AND pm.user_id = auth.uid()
  )
);

CREATE POLICY "projetos_authenticated_update" ON public.projetos
FOR UPDATE TO authenticated
USING (
  is_admin()
  OR (NOT is_vendedor_ou_representante())
  OR ("user" = auth.uid()::text)
  OR EXISTS (
    SELECT 1 FROM public.projeto_membros pm
    WHERE pm.projeto_id = projetos.id
      AND pm.user_id = auth.uid()
  )
)
WITH CHECK (
  is_admin()
  OR (NOT is_vendedor_ou_representante())
  OR ("user" = auth.uid()::text)
  OR EXISTS (
    SELECT 1 FROM public.projeto_membros pm
    WHERE pm.projeto_id = projetos.id
      AND pm.user_id = auth.uid()
  )
);

CREATE POLICY "projetos_authenticated_delete" ON public.projetos
FOR DELETE TO authenticated
USING (
  is_admin()
  OR (NOT is_vendedor_ou_representante())
  OR ("user" = auth.uid()::text)
);

-- 6. Atualizar RLS de Propostas
-- Admin vê tudo.
-- Gerente vê propostas onde gerente = seu gerente_id ou visão padrão.
-- Se competitividade_ativada, usuários com competitividade veem.
-- Vendedor / Representante vê SOMENTE propostas criadas por ele (user = email ou auth.uid()) OU emitidas em nome do seu cadastro de representante (representante = seu rep id).
DROP POLICY IF EXISTS "propostas_authenticated_select" ON public.propostas;

CREATE POLICY "propostas_authenticated_select" ON public.propostas
FOR SELECT TO authenticated
USING (
  is_admin()
  OR (
    NOT is_vendedor_ou_representante()
    AND (
      is_competitividade_ativada()
      OR gerente = (SELECT p.gerente_id FROM public.profiles p WHERE p.id = auth.uid())
      OR (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid()) ILIKE '%gerente%'
      OR true -- outros perfis não-vendedores/não-representantes mantêm visão
    )
  )
  OR (
    is_vendedor_ou_representante()
    AND (
      "user" = auth.uid()::text
      OR "user" = (SELECT p.email FROM public.profiles p WHERE p.id = auth.uid())
      OR "user" = (SELECT p.name FROM public.profiles p WHERE p.id = auth.uid())
      OR representante IN (
        SELECT r.id FROM public.representantes r
        WHERE r.profile_id = auth.uid()
           OR (r.email IS NOT NULL AND LOWER(r.email) = LOWER((SELECT p.email FROM public.profiles p WHERE p.id = auth.uid())))
           OR r.emails @> to_jsonb(LOWER((SELECT p.email FROM public.profiles p WHERE p.id = auth.uid())))::jsonb
      )
    )
  )
);
