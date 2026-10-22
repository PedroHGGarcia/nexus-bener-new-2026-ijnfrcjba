-- ============================================================================
-- Migration: Auditoria e Histórico de Alterações do Catálogo com Reversão
-- Entidades auditadas: versoes, modelos, produtos, categorias (categorias_produtos)
-- Tabela: registro_alteracoes
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.registro_alteracoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entidade TEXT NOT NULL, -- 'versoes' | 'modelos' | 'produtos' | 'categorias_produtos'
  registro_id TEXT NOT NULL,
  registro_nome TEXT,
  acao TEXT NOT NULL, -- 'criado' | 'editado' | 'excluido' | 'revertido'
  usuario_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  usuario_nome TEXT,
  usuario_email TEXT,
  dados_anteriores JSONB,
  dados_novos JSONB,
  campos_alterados JSONB, -- array ou mapa das alterações
  detalhes TEXT,
  revertido_de_id UUID REFERENCES public.registro_alteracoes(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para busca eficiente
CREATE INDEX IF NOT EXISTS idx_registro_alteracoes_entidade ON public.registro_alteracoes(entidade);
CREATE INDEX IF NOT EXISTS idx_registro_alteracoes_registro_id ON public.registro_alteracoes(registro_id);
CREATE INDEX IF NOT EXISTS idx_registro_alteracoes_created_at ON public.registro_alteracoes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_registro_alteracoes_acao ON public.registro_alteracoes(acao);

-- RLS Policies
ALTER TABLE public.registro_alteracoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "registro_alteracoes_authenticated_select" ON public.registro_alteracoes;
CREATE POLICY "registro_alteracoes_authenticated_select" ON public.registro_alteracoes
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "registro_alteracoes_authenticated_insert" ON public.registro_alteracoes;
CREATE POLICY "registro_alteracoes_authenticated_insert" ON public.registro_alteracoes
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "registro_alteracoes_authenticated_update" ON public.registro_alteracoes;
CREATE POLICY "registro_alteracoes_authenticated_update" ON public.registro_alteracoes
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "registro_alteracoes_authenticated_delete" ON public.registro_alteracoes;
CREATE POLICY "registro_alteracoes_authenticated_delete" ON public.registro_alteracoes
  FOR DELETE TO authenticated USING (true);

-- ============================================================================
-- Trigger function para capturar automaticamente alterações no banco
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fn_registro_alteracoes_trigger()
RETURNS trigger AS $$
DECLARE
  v_user_id UUID;
  v_user_name TEXT;
  v_user_email TEXT;
  v_acao TEXT;
  v_entidade TEXT;
  v_record_id TEXT;
  v_record_nome TEXT;
  v_dados_anteriores JSONB;
  v_dados_novos JSONB;
  v_campos_alterados JSONB := '[]'::jsonb;
  v_key TEXT;
  v_old_val JSONB;
  v_new_val JSONB;
  v_is_quarantine_change BOOLEAN := false;
BEGIN
  -- Obter usuário autenticado
  v_user_id := auth.uid();
  IF v_user_id IS NOT NULL THEN
    SELECT name, email INTO v_user_name, v_user_email FROM public.profiles WHERE id = v_user_id;
  END IF;
  v_user_name := COALESCE(v_user_name, 'Sistema');
  v_user_email := COALESCE(v_user_email, '');

  -- Normalizar nome da entidade
  v_entidade := TG_TABLE_NAME;
  IF v_entidade = 'categorias' THEN
    v_entidade := 'categorias_produtos';
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_acao := 'criado';
    v_record_id := NEW.id::text;
    v_record_nome := COALESCE(NEW.nome, 'Sem nome');
    v_dados_novos := to_jsonb(NEW);
    v_dados_anteriores := NULL;

  ELSIF TG_OP = 'UPDATE' THEN
    v_record_id := NEW.id::text;
    v_record_nome := COALESCE(NEW.nome, OLD.nome, 'Sem nome');
    v_dados_anteriores := to_jsonb(OLD);
    v_dados_novos := to_jsonb(NEW);

    -- Detectar se é exclusão lógica (quarentena)
    IF (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'Em Quarentena') THEN
      v_acao := 'excluido';
      v_is_quarantine_change := true;
    ELSIF (OLD.status = 'Em Quarentena' AND NEW.status = 'Ativo') THEN
      v_acao := 'revertido';
      v_is_quarantine_change := true;
    ELSE
      v_acao := 'editado';
    END IF;

    -- Calcular campos que realmente mudaram
    SELECT jsonb_agg(
      jsonb_build_object(
        'campo', k.key,
        'de', v_dados_anteriores->k.key,
        'para', v_dados_novos->k.key
      )
    )
    INTO v_campos_alterados
    FROM jsonb_object_keys(v_dados_novos) AS k(key)
    WHERE k.key NOT IN ('updated_at')
      AND (v_dados_anteriores->k.key IS DISTINCT FROM v_dados_novos->k.key);

    -- Se apenas updated_at mudou, ignorar gravação de log desnecessário
    IF v_campos_alterados IS NULL OR jsonb_array_length(v_campos_alterados) = 0 THEN
      RETURN NEW;
    END IF;

  ELSIF TG_OP = 'DELETE' THEN
    v_acao := 'excluido';
    v_record_id := OLD.id::text;
    v_record_nome := COALESCE(OLD.nome, 'Sem nome');
    v_dados_anteriores := to_jsonb(OLD);
    v_dados_novos := NULL;
  END IF;

  -- Inserir na tabela registro_alteracoes
  INSERT INTO public.registro_alteracoes (
    entidade,
    registro_id,
    registro_nome,
    acao,
    usuario_id,
    usuario_nome,
    usuario_email,
    dados_anteriores,
    dados_novos,
    campos_alterados
  ) VALUES (
    v_entidade,
    v_record_id,
    v_record_nome,
    v_acao,
    v_user_id,
    v_user_name,
    v_user_email,
    v_dados_anteriores,
    v_dados_novos,
    COALESCE(v_campos_alterados, '[]'::jsonb)
  );

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Triggers nas 4 tabelas
DROP TRIGGER IF EXISTS trg_registro_alteracoes_versoes ON public.versoes;
CREATE TRIGGER trg_registro_alteracoes_versoes
  AFTER INSERT OR UPDATE OR DELETE ON public.versoes
  FOR EACH ROW EXECUTE FUNCTION public.fn_registro_alteracoes_trigger();

DROP TRIGGER IF EXISTS trg_registro_alteracoes_modelos ON public.modelos;
CREATE TRIGGER trg_registro_alteracoes_modelos
  AFTER INSERT OR UPDATE OR DELETE ON public.modelos
  FOR EACH ROW EXECUTE FUNCTION public.fn_registro_alteracoes_trigger();

DROP TRIGGER IF EXISTS trg_registro_alteracoes_produtos ON public.produtos;
CREATE TRIGGER trg_registro_alteracoes_produtos
  AFTER INSERT OR UPDATE OR DELETE ON public.produtos
  FOR EACH ROW EXECUTE FUNCTION public.fn_registro_alteracoes_trigger();

DROP TRIGGER IF EXISTS trg_registro_alteracoes_categorias ON public.categorias;
CREATE TRIGGER trg_registro_alteracoes_categorias
  AFTER INSERT OR UPDATE OR DELETE ON public.categorias
  FOR EACH ROW EXECUTE FUNCTION public.fn_registro_alteracoes_trigger();
