-- Migration: Trigger de auto-preenchimento e garantia de categoria_id em versoes
-- Assegura que, ao inserir ou atualizar uma versão:
-- 1. Se categoria_id for NULL e o modelo tiver produto com categoria, preenche automaticamente.
-- 2. Se o modelo mudar e categoria_id não tiver sido explicitamente modificado na mesma transação, mantém a consistência.
-- 3. Se modelo não tiver produto, categoria_id permanece NULL ou pode ser informada manualmente.

-- 1. Criar função da trigger
CREATE OR REPLACE FUNCTION public.fn_versoes_auto_categoria()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_cat_id uuid;
BEGIN
  -- Se categoria_id não foi preenchida ou modelo mudou e categoria_id continua igual à anterior
  IF NEW.categoria_id IS NULL OR (TG_OP = 'UPDATE' AND NEW.modelo IS DISTINCT FROM OLD.modelo AND NEW.categoria_id IS NOT DISTINCT FROM OLD.categoria_id) THEN
    IF NEW.modelo IS NOT NULL THEN
      SELECT p.categoria
      INTO v_cat_id
      FROM public.modelos m
      JOIN public.produtos p ON p.id = m.produto
      WHERE m.id = NEW.modelo
        AND p.categoria IS NOT NULL
      LIMIT 1;

      IF v_cat_id IS NOT NULL THEN
        NEW.categoria_id := v_cat_id;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- 2. Criar trigger BEFORE INSERT OR UPDATE na tabela versoes
DROP TRIGGER IF EXISTS trg_versoes_auto_categoria ON public.versoes;
CREATE TRIGGER trg_versoes_auto_categoria
  BEFORE INSERT OR UPDATE OF modelo, categoria_id ON public.versoes
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_versoes_auto_categoria();

-- 3. Reforço de backfill para garantir que qualquer versão com modelo->produto preenchido tenha categoria_id
UPDATE public.versoes v
SET categoria_id = p.categoria
FROM public.modelos m
JOIN public.produtos p ON p.id = m.produto
WHERE v.modelo = m.id
  AND p.categoria IS NOT NULL
  AND v.categoria_id IS NULL;
