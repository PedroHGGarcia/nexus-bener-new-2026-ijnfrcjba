-- Migration: 20260915121100_backfill_produtos_categoria_fk.sql
-- Description: Resolve e preenche a chave estrangeira (FK) categoria em public.produtos
-- para os produtos existentes que possuem apenas categoria_nome preenchido em texto,
-- utilizando matching tolerante (sem distinção de maiúsculas/minúsculas, espaços e variações).
-- NÃO cria novas categorias. NÃO apaga dados existentes. Idempotente.

DO $$
DECLARE
  v_rec RECORD;
  v_cat_id UUID;
  v_updated_count INT := 0;
BEGIN
  -- Percorrer todos os produtos que possuem categoria_nome mas ainda estão sem FK categoria
  FOR v_rec IN
    SELECT p.id, p.nome, p.categoria_nome
    FROM public.produtos p
    WHERE p.categoria IS NULL
      AND p.categoria_nome IS NOT NULL
      AND trim(p.categoria_nome) <> ''
  LOOP
    v_cat_id := NULL;

    -- 1. Tentativa por igualdade exata (case-insensitive e sem espaços periféricos)
    SELECT c.id INTO v_cat_id
    FROM public.categorias c
    WHERE lower(trim(c.nome)) = lower(trim(v_rec.categoria_nome))
    LIMIT 1;

    -- 2. Tentativa por correspondência com 'High Tech%' (ex.: 'High Tech 2' -> 'High Tech')
    IF v_cat_id IS NULL THEN
      SELECT c.id INTO v_cat_id
      FROM public.categorias c
      WHERE lower(trim(c.nome)) = 'high tech'
        AND lower(trim(v_rec.categoria_nome)) LIKE 'high tech%'
      LIMIT 1;
    END IF;

    -- 3. Tentativa mais ampla: prefixo do nome da categoria (caso de variações)
    IF v_cat_id IS NULL THEN
      SELECT c.id INTO v_cat_id
      FROM public.categorias c
      WHERE lower(trim(v_rec.categoria_nome)) LIKE lower(trim(c.nome)) || '%'
         OR lower(trim(c.nome)) LIKE lower(trim(v_rec.categoria_nome)) || '%'
      ORDER BY length(c.nome) DESC
      LIMIT 1;
    END IF;

    -- Se encontrou uma categoria correspondente, atualiza o produto com a FK
    IF v_cat_id IS NOT NULL THEN
      UPDATE public.produtos
      SET categoria = v_cat_id,
          updated_at = NOW()
      WHERE id = v_rec.id;

      v_updated_count := v_updated_count + 1;
    END IF;
  END LOOP;

  RAISE NOTICE 'Produtos atualizados com FK de categoria: %', v_updated_count;
END $$;
