-- Corrige a perda de abas do menu lateral para usuários com menu_access antigo
-- (chaves sem prefixo, ex.: 'propostas-criadas') adicionando as chaves novas
-- equivalentes (ex.: 'controle-propostas.criadas'), preservando as existentes.
-- Idempotente: só adiciona a chave nova quando ela ainda não existe no array.
--
-- Nota: menu_access é jsonb. A maioria dos perfis tem um array JSON, mas pode
-- haver perfil com o valor duplamente codificado (string contendo JSON) —
-- tratado aqui também.

DO $$
DECLARE
  v_map jsonb := jsonb_build_object(
    'propostas-criadas',        'controle-propostas.criadas',
    'propostas-emitir',         'controle-propostas.emitir',
    'propostas-dashboard',      'controle-propostas.dashboard',
    'propostas-avancadas',      'controle-propostas.avancadas',
    'propostas-tipos',          'controle-propostas.tipos',
    'propostas-emitir-licitacao', 'controle-propostas.emitir-licitacao',
    'cadastros-clientes',           'cadastros.clientes',
    'cadastros-representantes',     'cadastros.representantes',
    'cadastros-regioes',            'cadastros.regioes',
    'cadastros-gerentes',           'cadastros.gerentes',
    'cadastros-prepostos',          'cadastros.prepostos',
    'produtos-lista',           'produtos.list'
  );
  v_legacy text;
  v_new_key text;
  v_arr jsonb;
  v_count int := 0;
BEGIN
  -- Normaliza perfis cujo menu_access ficou duplamente codificado
  -- (jsonb string contendo um array JSON)
  UPDATE public.profiles
  SET menu_access = (menu_access #>> '{}')::jsonb
  WHERE jsonb_typeof(menu_access) = 'string'
    AND (menu_access #>> '{}')::jsonb IS NOT NULL;

  FOR v_legacy, v_new_key IN
    SELECT e.key, e.value::text FROM jsonb_each_text(v_map) e
  LOOP
    UPDATE public.profiles p
    SET menu_access = (
      SELECT jsonb_agg(DISTINCT e)
      FROM jsonb_array_elements_text(p.menu_access) e
    ) || to_jsonb(v_new_key::text)
    WHERE p.role NOT IN ('Admin Completo', 'admin', 'Administrador')
      AND jsonb_typeof(p.menu_access) = 'array'
      AND p.menu_access @> to_jsonb(v_legacy::text)
      AND NOT p.menu_access @> to_jsonb(v_new_key::text);

    v_count := v_count + ROW_COUNT;
  END LOOP;

  RAISE NOTICE 'backfill_legacy_menu_access: % atualizacoes', v_count;
END $$;
