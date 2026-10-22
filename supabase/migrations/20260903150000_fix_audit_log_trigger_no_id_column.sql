-- Migration: Fix audit_log_trigger to safely extract record_id for tables without 'id' column
-- (e.g., composite PK tables like versao_tipos_proposta)

CREATE OR REPLACE FUNCTION public.audit_log_trigger()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $$
DECLARE
  current_user_name TEXT;
  current_user_id UUID;
  v_rec_json JSONB;
  v_record_id TEXT;
BEGIN
  current_user_id := auth.uid();
  SELECT name INTO current_user_name FROM public.profiles WHERE id = current_user_id;
  current_user_name := COALESCE(current_user_name, 'Sistema');

  IF TG_OP = 'DELETE' THEN
    v_rec_json := to_jsonb(OLD);
  ELSE
    v_rec_json := to_jsonb(NEW);
  END IF;

  -- Extract id safely without referencing OLD.id or NEW.id directly,
  -- which would raise error 42703 if table does not have an 'id' column.
  v_record_id := v_rec_json->>'id';

  -- If no 'id' column exists, try composite keys or fallback to NULL
  IF v_record_id IS NULL AND TG_TABLE_NAME = 'versao_tipos_proposta' THEN
    v_record_id := COALESCE(v_rec_json->>'versao_id', '') || '_' || COALESCE(v_rec_json->>'tipo_proposta_id', '');
  END IF;

  INSERT INTO public.audit_logs (action, table_name, record_id, data_changes, user_id, user_name)
  VALUES (
    TG_OP,
    TG_TABLE_NAME,
    v_record_id,
    v_rec_json,
    current_user_id,
    current_user_name
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;
