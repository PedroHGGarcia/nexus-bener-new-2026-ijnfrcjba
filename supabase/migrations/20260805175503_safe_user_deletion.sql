-- Fix FK constraints to allow safe user deletion
-- These tables reference auth.users directly and need proper ON DELETE behavior

DO $$
DECLARE
  c text;
BEGIN
  -- audit_logs.user_id → SET NULL on delete (keep audit trail)
  SELECT conname INTO c FROM pg_constraint con
  WHERE con.conrelid = 'public.audit_logs'::regclass
    AND con.contype = 'f'
    AND EXISTS (
      SELECT 1 FROM pg_attribute a
      WHERE a.attrelid = con.conrelid
        AND a.attnum = ANY(con.conkey)
        AND a.attname = 'user_id'
    );
  IF c IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.audit_logs DROP CONSTRAINT %I', c);
  END IF;

  -- notificacoes.usuario → CASCADE on delete
  SELECT conname INTO c FROM pg_constraint con
  WHERE con.conrelid = 'public.notificacoes'::regclass
    AND con.contype = 'f'
    AND EXISTS (
      SELECT 1 FROM pg_attribute a
      WHERE a.attrelid = con.conrelid
        AND a.attnum = ANY(con.conkey)
        AND a.attname = 'usuario'
    );
  IF c IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.notificacoes DROP CONSTRAINT %I', c);
  END IF;

  -- preferencias.usuario → CASCADE on delete
  SELECT conname INTO c FROM pg_constraint con
  WHERE con.conrelid = 'public.preferencias'::regclass
    AND con.contype = 'f'
    AND EXISTS (
      SELECT 1 FROM pg_attribute a
      WHERE a.attrelid = con.conrelid
        AND a.attnum = ANY(con.conkey)
        AND a.attname = 'usuario'
    );
  IF c IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.preferencias DROP CONSTRAINT %I', c);
  END IF;

  -- projeto_membros.user_id → CASCADE on delete (ensure, may already exist)
  SELECT conname INTO c FROM pg_constraint con
  WHERE con.conrelid = 'public.projeto_membros'::regclass
    AND con.contype = 'f'
    AND EXISTS (
      SELECT 1 FROM pg_attribute a
      WHERE a.attrelid = con.conrelid
        AND a.attnum = ANY(con.conkey)
        AND a.attname = 'user_id'
    );
  IF c IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.projeto_membros DROP CONSTRAINT %I', c);
  END IF;
END $$;

-- Clean up orphaned references before adding constraints
UPDATE public.audit_logs SET user_id = NULL
  WHERE user_id IS NOT NULL
    AND user_id NOT IN (SELECT id FROM auth.users);

DELETE FROM public.notificacoes
  WHERE usuario IS NOT NULL
    AND usuario NOT IN (SELECT id FROM auth.users);

DELETE FROM public.preferencias
  WHERE usuario IS NOT NULL
    AND usuario NOT IN (SELECT id FROM auth.users);

-- Add constraints with proper ON DELETE behavior
ALTER TABLE public.audit_logs ADD CONSTRAINT audit_logs_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.notificacoes ADD CONSTRAINT notificacoes_usuario_fkey
  FOREIGN KEY (usuario) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.preferencias ADD CONSTRAINT preferencias_usuario_fkey
  FOREIGN KEY (usuario) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.projeto_membros ADD CONSTRAINT projeto_membros_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
