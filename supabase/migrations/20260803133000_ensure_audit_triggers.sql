CREATE OR REPLACE FUNCTION public.audit_log_trigger()
RETURNS trigger AS $$
DECLARE
  current_user_name TEXT;
  current_user_id UUID;
BEGIN
  current_user_id := auth.uid();
  SELECT name INTO current_user_name FROM public.profiles WHERE id = current_user_id;
  current_user_name := COALESCE(current_user_name, 'Sistema');

  INSERT INTO public.audit_logs (action, table_name, record_id, data_changes, user_id, user_name)
  VALUES (
    TG_OP,
    TG_TABLE_NAME,
    COALESCE((CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END)::text, NULL),
    CASE
      WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD)
      WHEN TG_OP = 'UPDATE' THEN to_jsonb(NEW)
      ELSE to_jsonb(NEW)
    END,
    current_user_id,
    current_user_name
  );

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DO $$
DECLARE
  tbl TEXT;
  tables TEXT[] := ARRAY[
    'clientes', 'representantes', 'regioes', 'gerentes',
    'produtos', 'propostas', 'projetos', 'versoes',
    'marcas', 'modelos', 'categorias_produtos', 'tipos_proposta',
    'eventos', 'acessorios', 'area_atuacao'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS audit_trigger ON public.%I', tbl);
    EXECUTE format(
      'CREATE TRIGGER audit_trigger AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger()',
      tbl
    );
  END LOOP;
END $$;
