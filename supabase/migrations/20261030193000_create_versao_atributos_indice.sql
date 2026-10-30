-- Migration: 20261030193000_create_versao_atributos_indice.sql
-- Ponto 21: Tabela de índice estruturado de atributos técnicos das versões + triggers de sincronização imediata

CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE TABLE IF NOT EXISTS public.versao_atributos_indice (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  versao_id UUID NOT NULL REFERENCES public.versoes(id) ON DELETE CASCADE,
  atributo TEXT NOT NULL,
  valor_texto TEXT NOT NULL,
  valor_numerico NUMERIC,
  unidade TEXT,
  forma_normalizada TEXT NOT NULL,
  origem TEXT DEFAULT 'especificacoes_tecnicas',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices otimizados para busca rápida e filtros combináveis
CREATE INDEX IF NOT EXISTS idx_vai_versao_id ON public.versao_atributos_indice(versao_id);
CREATE INDEX IF NOT EXISTS idx_vai_forma_normalizada ON public.versao_atributos_indice(forma_normalizada);
CREATE INDEX IF NOT EXISTS idx_vai_atributo ON public.versao_atributos_indice(atributo);
CREATE INDEX IF NOT EXISTS idx_vai_valor_numerico ON public.versao_atributos_indice(valor_numerico);
CREATE INDEX IF NOT EXISTS idx_vai_unidade ON public.versao_atributos_indice(unidade);
CREATE INDEX IF NOT EXISTS idx_vai_attr_val_num ON public.versao_atributos_indice(atributo, valor_numerico);

-- RLS policies para leitura pública / authenticated e inserção por triggers/serviço
ALTER TABLE public.versao_atributos_indice ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "versao_atributos_indice_select" ON public.versao_atributos_indice;
CREATE POLICY "versao_atributos_indice_select" ON public.versao_atributos_indice
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "versao_atributos_indice_all_service" ON public.versao_atributos_indice;
CREATE POLICY "versao_atributos_indice_all_service" ON public.versao_atributos_indice
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Função de normalização de texto (remove acentos, pontuação, múltiplos espaços e lowercase)
CREATE OR REPLACE FUNCTION public.fn_normalizar_termo(input_text TEXT)
RETURNS TEXT AS $$
DECLARE
  clean TEXT;
BEGIN
  IF input_text IS NULL OR TRIM(input_text) = '' THEN
    RETURN '';
  END IF;
  
  -- Substitui caracteres com acentos com translate nativo caso unaccent falhe
  clean := LOWER(translate(
    input_text,
    'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
    'aaaaaeeeeiiiiooooouuuucnAAAAAEEEEIIIIOOOOOUUUUCN'
  ));
  -- Substitui caracteres não alfanuméricos por espaço
  clean := regexp_replace(clean, '[^a-z0-9\.]', ' ', 'g');
  -- Remove espaços repetidos
  clean := TRIM(regexp_replace(clean, '\s+', ' ', 'g'));
  RETURN clean;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Função que reindexa uma versão específica
CREATE OR REPLACE FUNCTION public.fn_reindexar_versao_atributos(p_versao_id UUID)
RETURNS VOID AS $$
DECLARE
  v_rec RECORD;
  v_raw_text TEXT;
  v_lines TEXT[];
  v_line TEXT;
  v_cleaned_line TEXT;
  v_attr TEXT;
  v_val TEXT;
  v_num NUMERIC;
  v_unit TEXT;
  v_norm TEXT;
  v_num_match TEXT;
BEGIN
  -- 1. Busca os dados da versão
  SELECT v.id, v.nome, v.cod_erp, v.especificacoes_tecnicas, v.caracteristicas_construtivas,
         m.nome AS modelo_nome, ma.nome AS marca_nome, c.nome AS cat_nome
  INTO v_rec
  FROM public.versoes v
  LEFT JOIN public.modelos m ON m.id = v.modelo
  LEFT JOIN public.marcas ma ON ma.id = m.marca
  LEFT JOIN public.categorias c ON c.id = v.categoria_id
  WHERE v.id = p_versao_id;

  IF NOT FOUND THEN
    DELETE FROM public.versao_atributos_indice WHERE versao_id = p_versao_id;
    RETURN;
  END IF;

  -- 2. Limpa índice atual da versão
  DELETE FROM public.versao_atributos_indice WHERE versao_id = p_versao_id;

  -- 3. Entradas-base de identificação da máquina
  -- Nome da versão
  IF v_rec.nome IS NOT NULL AND TRIM(v_rec.nome) <> '' THEN
    INSERT INTO public.versao_atributos_indice (versao_id, atributo, valor_texto, valor_numerico, unidade, forma_normalizada, origem)
    VALUES (p_versao_id, 'nome_versao', v_rec.nome, NULL, NULL, public.fn_normalizar_termo(v_rec.nome), 'identificacao');
  END IF;

  -- Código ERP
  IF v_rec.cod_erp IS NOT NULL AND TRIM(v_rec.cod_erp) <> '' THEN
    INSERT INTO public.versao_atributos_indice (versao_id, atributo, valor_texto, valor_numerico, unidade, forma_normalizada, origem)
    VALUES (p_versao_id, 'cod_erp', v_rec.cod_erp, NULL, NULL, public.fn_normalizar_termo(v_rec.cod_erp), 'identificacao');
  END IF;

  -- Marca
  IF v_rec.marca_nome IS NOT NULL AND TRIM(v_rec.marca_nome) <> '' THEN
    INSERT INTO public.versao_atributos_indice (versao_id, atributo, valor_texto, valor_numerico, unidade, forma_normalizada, origem)
    VALUES (p_versao_id, 'marca', v_rec.marca_nome, NULL, NULL, public.fn_normalizar_termo(v_rec.marca_nome), 'identificacao');
  END IF;

  -- Modelo
  IF v_rec.modelo_nome IS NOT NULL AND TRIM(v_rec.modelo_nome) <> '' THEN
    INSERT INTO public.versao_atributos_indice (versao_id, atributo, valor_texto, valor_numerico, unidade, forma_normalizada, origem)
    VALUES (p_versao_id, 'modelo', v_rec.modelo_nome, NULL, NULL, public.fn_normalizar_termo(v_rec.modelo_nome), 'identificacao');
  END IF;

  -- Categoria
  IF v_rec.cat_nome IS NOT NULL AND TRIM(v_rec.cat_nome) <> '' THEN
    INSERT INTO public.versao_atributos_indice (versao_id, atributo, valor_texto, valor_numerico, unidade, forma_normalizada, origem)
    VALUES (p_versao_id, 'categoria', v_rec.cat_nome, NULL, NULL, public.fn_normalizar_termo(v_rec.cat_nome), 'identificacao');
  END IF;

  -- 4. Extração de padrões em especificações técnicas e características construtivas
  v_raw_text := COALESCE(v_rec.especificacoes_tecnicas, '') || ' ' || COALESCE(v_rec.caracteristicas_construtivas, '') || ' ' || COALESCE(v_rec.nome, '');

  -- A. Potência em Watts / kW (ex: 30W, 30 W, 30 watts, 20 kW, etc)
  FOR v_line IN
    SELECT unnest(regexp_matches(v_raw_text, '([0-9]+(?:\.[0-9]+)?)\s*(?:w|watts|kw|quilowatts|cv|hp)\b', 'gi'))
  LOOP
    BEGIN
      v_num := v_line::NUMERIC;
      INSERT INTO public.versao_atributos_indice (versao_id, atributo, valor_texto, valor_numerico, unidade, forma_normalizada, origem)
      VALUES (p_versao_id, 'potencia', v_line || ' W', v_num, 'W', 'potencia ' || v_line || 'w', 'especificacoes_tecnicas');
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END LOOP;

  -- B. Força de Fechamento / Toneladas (ex: 750 toneladas, 750 t, 750 ton, 750toneladas)
  FOR v_line IN
    SELECT unnest(regexp_matches(v_raw_text, '([0-9]+(?:\.[0-9]+)?)\s*(?:t|ton|tons|tonelada|toneladas|tonelada-forca)\b', 'gi'))
  LOOP
    BEGIN
      v_num := v_line::NUMERIC;
      INSERT INTO public.versao_atributos_indice (versao_id, atributo, valor_texto, valor_numerico, unidade, forma_normalizada, origem)
      VALUES (p_versao_id, 'forca_fechamento', v_line || ' t', v_num, 't', 'fechamento ' || v_line || 't', 'especificacoes_tecnicas');
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END LOOP;

  -- Também captura números perto de "fechamento" ou "molde"
  FOR v_line IN
    SELECT unnest(regexp_matches(v_raw_text, 'fechamento[^\.\n•]{0,30}?([0-9]{2,5})', 'gi'))
  LOOP
    BEGIN
      v_num := v_line::NUMERIC;
      INSERT INTO public.versao_atributos_indice (versao_id, atributo, valor_texto, valor_numerico, unidade, forma_normalizada, origem)
      VALUES (p_versao_id, 'forca_fechamento', v_line || ' t', v_num, 't', 'fechamento ' || v_line || 't', 'especificacoes_tecnicas');
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END LOOP;

  -- C. Cursos e dimensões em mm
  FOR v_line IN
    SELECT unnest(regexp_matches(v_raw_text, '(curso[^\.\n•]{0,25}?)([0-9]{2,5})\s*mm', 'gi'))
  LOOP
    BEGIN
      v_num_match := (regexp_matches(v_line, '([0-9]{2,5})'))[1];
      IF v_num_match IS NOT NULL THEN
        v_num := v_num_match::NUMERIC;
        INSERT INTO public.versao_atributos_indice (versao_id, atributo, valor_texto, valor_numerico, unidade, forma_normalizada, origem)
        VALUES (p_versao_id, 'curso', v_num_match || ' mm', v_num, 'mm', 'curso ' || v_num_match || 'mm', 'especificacoes_tecnicas');
      END IF;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END LOOP;

  -- D. Termos chave técnicos (Laser, Fibra Óptica, Fanuc, Siemens, Smart Plus, Injetora, Torno, Centro de Usinagem)
  IF v_raw_text ~* 'laser' THEN
    INSERT INTO public.versao_atributos_indice (versao_id, atributo, valor_texto, valor_numerico, unidade, forma_normalizada, origem)
    VALUES (p_versao_id, 'tecnologia', 'Gravação / Marcação / Solda a Laser', NULL, NULL, 'gravacao marcacao solda laser', 'especificacoes_tecnicas');
  END IF;

  IF v_raw_text ~* 'fibra' THEN
    INSERT INTO public.versao_atributos_indice (versao_id, atributo, valor_texto, valor_numerico, unidade, forma_normalizada, origem)
    VALUES (p_versao_id, 'fonte_laser', 'Fibra Óptica', NULL, NULL, 'fonte fibra optica laser', 'especificacoes_tecnicas');
  END IF;

  IF v_raw_text ~* 'fanuc' THEN
    INSERT INTO public.versao_atributos_indice (versao_id, atributo, valor_texto, valor_numerico, unidade, forma_normalizada, origem)
    VALUES (p_versao_id, 'controle_cnc', 'Fanuc', NULL, NULL, 'controle cnc plataforma fanuc', 'especificacoes_tecnicas');
  END IF;

  IF v_raw_text ~* 'smart plus' THEN
    INSERT INTO public.versao_atributos_indice (versao_id, atributo, valor_texto, valor_numerico, unidade, forma_normalizada, origem)
    VALUES (p_versao_id, 'plataforma', 'Smart Plus', NULL, NULL, 'plataforma smart plus fanuc', 'especificacoes_tecnicas');
  END IF;

  IF v_raw_text ~* 'injetor' THEN
    INSERT INTO public.versao_atributos_indice (versao_id, atributo, valor_texto, valor_numerico, unidade, forma_normalizada, origem)
    VALUES (p_versao_id, 'tipo_maquina', 'Injetora', NULL, NULL, 'maquina injetora termoplasticos fcs', 'especificacoes_tecnicas');
  END IF;

  -- 5. Extração linha a linha de especificações técnicas (pares chave/valor)
  IF v_rec.especificacoes_tecnicas IS NOT NULL THEN
    v_lines := regexp_split_to_array(v_rec.especificacoes_tecnicas, '[•\n\r]+');
    FOREACH v_line IN ARRAY v_lines LOOP
      v_cleaned_line := regexp_replace(v_line, '<[^>]+>', ' ', 'g');
      v_cleaned_line := regexp_replace(v_cleaned_line, '\[SP[0-9]+\]', ' ', 'g');
      v_cleaned_line := TRIM(regexp_replace(v_cleaned_line, '\s+', ' ', 'g'));

      IF LENGTH(v_cleaned_line) > 5 AND LENGTH(v_cleaned_line) < 250 THEN
        v_num_match := (regexp_matches(v_cleaned_line, '([0-9]+(?:\.[0-9]+)?)'))[1];
        IF v_num_match IS NOT NULL THEN
          BEGIN
            v_num := v_num_match::NUMERIC;
          EXCEPTION WHEN OTHERS THEN
            v_num := NULL;
          END;
        ELSE
          v_num := NULL;
        END IF;

        IF v_cleaned_line ~* '\b(mm|cm|m|kg|t|ton|w|kw|hp|cv|bar|kn|rpm|v|hz|kva)\b' THEN
          v_unit := (regexp_matches(v_cleaned_line, '\b(mm|cm|m|kg|t|ton|w|kw|hp|cv|bar|kn|rpm|v|hz|kva)\b', 'i'))[1];
        ELSE
          v_unit := NULL;
        END IF;

        v_norm := public.fn_normalizar_termo(v_cleaned_line);
        IF LENGTH(v_norm) > 3 THEN
          INSERT INTO public.versao_atributos_indice (versao_id, atributo, valor_texto, valor_numerico, unidade, forma_normalizada, origem)
          VALUES (p_versao_id, 'especificacao', v_cleaned_line, v_num, v_unit, v_norm, 'especificacoes_tecnicas');
        END IF;
      END IF;
    END LOOP;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para reindexar automaticamente na inserção ou atualização de versão
CREATE OR REPLACE FUNCTION public.trg_fn_reindexar_versao()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.versao_atributos_indice WHERE versao_id = OLD.id;
    RETURN OLD;
  END IF;

  PERFORM public.fn_reindexar_versao_atributos(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_reindexar_versao ON public.versoes;
CREATE TRIGGER trg_reindexar_versao
  AFTER INSERT OR UPDATE ON public.versoes
  FOR EACH ROW EXECUTE FUNCTION public.trg_fn_reindexar_versao();

-- Backfill inicial de todas as versões existentes
DO $$
DECLARE
  v_id UUID;
BEGIN
  FOR v_id IN SELECT id FROM public.versoes WHERE deleted_at IS NULL LOOP
    PERFORM public.fn_reindexar_versao_atributos(v_id);
  END LOOP;
END $$;
