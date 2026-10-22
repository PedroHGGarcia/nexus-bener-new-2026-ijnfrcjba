-- Migration: add touch_last_seen() RPC with SECURITY DEFINER and ensure audit_log_trigger ignores last_seen_at updates
-- This tracks user activity without bloating the audit_logs table.

-- 1. Ensure column last_seen_at exists on public.profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;

-- 2. Index for sorting by last_seen_at DESC NULLS LAST
CREATE INDEX IF NOT EXISTS idx_profiles_last_seen_at ON public.profiles (last_seen_at DESC NULLS LAST);

-- 3. Update audit_log_trigger to skip logging when the ONLY changed column is last_seen_at
-- This prevents hundreds of thousands of useless heartbeat log rows in audit_logs.
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
  -- If this is an UPDATE on profiles and ONLY last_seen_at was touched, skip logging to audit_logs
  IF TG_OP = 'UPDATE' AND TG_TABLE_NAME = 'profiles' THEN
    IF (to_jsonb(OLD) - 'last_seen_at' - 'updated_at') = (to_jsonb(NEW) - 'last_seen_at' - 'updated_at') THEN
      RETURN NEW;
    END IF;
  END IF;

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

-- 4. Create or replace touch_last_seen() RPC
-- Only works for authenticated users with valid JWT (auth.uid() NOT NULL)
-- Can ONLY update the caller's own profile (id = auth.uid()) — never other users
CREATE OR REPLACE FUNCTION public.touch_last_seen()
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid UUID;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  UPDATE public.profiles
  SET last_seen_at = v_now
  WHERE id = v_uid;

  RETURN v_now;
END;
$$;

-- Grant EXECUTE to authenticated users, revoke from anon/public
REVOKE ALL ON FUNCTION public.touch_last_seen() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.touch_last_seen() FROM anon;
GRANT EXECUTE ON FUNCTION public.touch_last_seen() TO authenticated;
