-- Migração: Suporte a múltiplos estados de atuação para Representante/Vendedor
-- Atualiza funções de resolução de estados e políticas RLS de clientes

-- 1. Função que retorna ARRAY de textos com todos os estados (UFs) de atuação do usuário autenticado
CREATE OR REPLACE FUNCTION public.get_user_estados_atuacao()
RETURNS text[] AS $$
DECLARE
  v_estados text[] := '{}';
  v_str text;
BEGIN
  -- 1. Busca no profile do usuário autenticado (pode conter múltiplos estados separados por vírgula)
  SELECT NULLIF(TRIM(p.estado_atuacao), '') INTO v_str
  FROM public.profiles p
  WHERE p.id = auth.uid();

  IF v_str IS NOT NULL THEN
    SELECT COALESCE(array_agg(DISTINCT UPPER(TRIM(s))), '{}'::text[])
    INTO v_estados
    FROM unnest(string_to_array(v_str, ',')) AS s
    WHERE TRIM(s) <> '';
  END IF;

  -- 2. Busca pelas regiões vinculadas ao representante na tabela representante_regioes
  SELECT array_cat(v_estados, COALESCE(array_agg(DISTINCT UPPER(TRIM(r.uf))), '{}'::text[]))
  INTO v_estados
  FROM public.representantes rep
  JOIN public.representante_regioes rr ON rr.representante_id = rep.id
  JOIN public.regioes r ON r.id = rr.regiao_id
  JOIN public.profiles p ON p.id = auth.uid()
  WHERE (rep.profile_id = auth.uid()
     OR (p.email IS NOT NULL AND (
          LOWER(rep.email) = LOWER(p.email)
          OR rep.emails @> to_jsonb(LOWER(p.email))::jsonb
          OR rep.emails @> to_jsonb(p.email)::jsonb
        )))
    AND r.uf IS NOT NULL;

  -- 3. Fallback complementar: verificar campo rep.estado e rep.regiao
  FOR v_str IN
    SELECT NULLIF(TRIM(rep.estado), '')
    FROM public.representantes rep
    JOIN public.profiles p ON p.id = auth.uid()
    WHERE (rep.profile_id = auth.uid()
       OR (p.email IS NOT NULL AND (
            LOWER(rep.email) = LOWER(p.email)
            OR rep.emails @> to_jsonb(LOWER(p.email))::jsonb
            OR rep.emails @> to_jsonb(p.email)::jsonb
          )))
      AND rep.estado IS NOT NULL
    UNION
    SELECT NULLIF(TRIM(rep.regiao), '')
    FROM public.representantes rep
    JOIN public.profiles p ON p.id = auth.uid()
    WHERE (rep.profile_id = auth.uid()
       OR (p.email IS NOT NULL AND (
            LOWER(rep.email) = LOWER(p.email)
            OR rep.emails @> to_jsonb(LOWER(p.email))::jsonb
            OR rep.emails @> to_jsonb(p.email)::jsonb
          )))
      AND rep.regiao IS NOT NULL
  LOOP
    IF v_str IS NOT NULL THEN
      SELECT array_cat(v_estados, COALESCE(array_agg(DISTINCT UPPER(TRIM(s))), '{}'::text[]))
      INTO v_estados
      FROM unnest(string_to_array(v_str, ',')) AS s
      WHERE TRIM(s) <> '' AND length(TRIM(s)) = 2;
    END IF;
  END LOOP;

  -- Limpar duplicatas e vazios
  SELECT COALESCE(array_agg(DISTINCT s), '{}'::text[]) INTO v_estados
  FROM unnest(v_estados) AS s
  WHERE s IS NOT NULL AND TRIM(s) <> '';

  RETURN v_estados;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 2. Atualizar get_user_estado_atuacao() para manter compatibilidade com chamadas escalares
CREATE OR REPLACE FUNCTION public.get_user_estado_atuacao()
RETURNS text AS $$
DECLARE
  v_arr text[];
BEGIN
  v_arr := public.get_user_estados_atuacao();
  IF v_arr IS NOT NULL AND array_length(v_arr, 1) > 0 THEN
    RETURN v_arr[1];
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 3. Atualizar políticas RLS da tabela clientes para considerar array de estados
DROP POLICY IF EXISTS "clientes_select" ON public.clientes;
CREATE POLICY "clientes_select" ON public.clientes
  FOR SELECT TO authenticated
  USING (
    is_admin()
    OR (NOT is_vendedor_ou_representante())
    OR (criado_por = auth.uid())
    OR (
      estado IS NOT NULL
      AND UPPER(TRIM(estado)) = ANY(get_user_estados_atuacao())
    )
  );

DROP POLICY IF EXISTS "clientes_update" ON public.clientes;
CREATE POLICY "clientes_update" ON public.clientes
  FOR UPDATE TO authenticated
  USING (
    is_admin()
    OR (NOT is_vendedor_ou_representante())
    OR (criado_por = auth.uid())
    OR (
      estado IS NOT NULL
      AND UPPER(TRIM(estado)) = ANY(get_user_estados_atuacao())
    )
  )
  WITH CHECK (
    is_admin()
    OR (NOT is_vendedor_ou_representante())
    OR (criado_por = auth.uid())
    OR (
      estado IS NOT NULL
      AND UPPER(TRIM(estado)) = ANY(get_user_estados_atuacao())
    )
  );
