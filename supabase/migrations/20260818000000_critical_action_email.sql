-- Estende notify_critical_action() para, além de inserir a notificação in-app,
-- disparar a edge function notify-critical-action-email (e-mail aos admins).
-- Não bloqueante: falhas no HTTP são silenciadas para não impactar a operação original.
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION public.notify_critical_action()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, net, extensions
AS $$
DECLARE
  v_actor_name TEXT;
  v_actor_id UUID;
  v_action TEXT;
  v_table_label TEXT;
  v_item_name TEXT;
  v_message TEXT;
  v_is_critical BOOLEAN := false;
  v_record JSONB;
  v_url TEXT := 'https://ugnhnbfogxbcptprsfot.supabase.co/functions/v1/notify-critical-action-email';
  v_anon_key TEXT := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVnbmhuYmZvZ3hiY3B0cHJzZm90Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzczOTI2NDcsImV4cCI6MjA1Mjk2ODY0N30.2g60fG3mF1C37s38r0rWJb6tJ1pYh17hYg1f7mKpNhk';
  v_headers JSONB;
  v_body JSONB;
BEGIN
  -- Identifica o usuário que executou a ação
  v_actor_id := auth.uid();
  SELECT name INTO v_actor_name FROM public.profiles WHERE id = v_actor_id;
  v_actor_name := COALESCE(v_actor_name, 'Sistema');
  v_action := TG_OP;

  -- Captura o registro (NEW para INSERT/UPDATE, OLD para DELETE)
  IF v_action = 'DELETE' THEN
    v_record := to_jsonb(OLD);
  ELSE
    v_record := to_jsonb(NEW);
  END IF;

  -- DELETE em qualquer tabela sensível é crítico
  IF v_action = 'DELETE' THEN
    v_is_critical := true;
  END IF;

  -- UPDATE em profiles que muda a role é crítico
  IF v_action = 'UPDATE' AND TG_TABLE_NAME = 'profiles' THEN
    IF (OLD.role IS DISTINCT FROM NEW.role) THEN
      v_is_critical := true;
    END IF;
  END IF;

  -- INSERT em versoes é crítico
  IF v_action = 'INSERT' AND TG_TABLE_NAME = 'versoes' THEN
    v_is_critical := true;
  END IF;

  -- Se não for crítica, não faz nada
  IF NOT v_is_critical THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Label amigável da tabela
  v_table_label := CASE TG_TABLE_NAME
    WHEN 'profiles' THEN 'o usuário'
    WHEN 'versoes' THEN 'a versão'
    WHEN 'modelos' THEN 'o modelo'
    WHEN 'marcas' THEN 'a marca'
    WHEN 'produtos' THEN 'o produto'
    WHEN 'categorias_produtos' THEN 'a categoria'
    ELSE TG_TABLE_NAME
  END;

  -- Tenta extrair um nome amigável do registro
  v_item_name := COALESCE(
    v_record->>'nome',
    v_record->>'name',
    v_record->>'titulo',
    v_record->>'razao_social',
    v_record->>'fantasia',
    v_record->>'email',
    v_record->>'numero_proposta',
    NULL
  );

  -- Constrói a mensagem
  IF v_action = 'DELETE' THEN
    IF v_item_name IS NOT NULL THEN
      v_message := format('O usuário %s excluiu %s "%s"', v_actor_name, v_table_label, v_item_name);
    ELSE
      v_message := format('O usuário %s excluiu um registro em %s', v_actor_name, TG_TABLE_NAME);
    END IF;
  ELSIF v_action = 'INSERT' THEN
    IF v_item_name IS NOT NULL THEN
      v_message := format('O usuário %s criou %s "%s"', v_actor_name, v_table_label, v_item_name);
    ELSE
      v_message := format('O usuário %s criou um registro em %s', v_actor_name, TG_TABLE_NAME);
    END IF;
  ELSE
    -- UPDATE em profiles (mudança de role)
    IF v_item_name IS NOT NULL THEN
      v_message := format('O usuário %s alterou a role de %s "%s" para "%s"',
        v_actor_name, v_table_label, v_item_name, NEW.role);
    ELSE
      v_message := format('O usuário %s alterou a role de um usuário para "%s"', v_actor_name, NEW.role);
    END IF;
  END IF;

  -- Insere uma notificação broadcast (usuario = NULL) para todos os Admins
  INSERT INTO public.notificacoes (titulo, mensagem, tipo, usuario, lida)
  VALUES ('Ação Crítica Detectada', v_message, 'critical_action', NULL, false);

  -- Dispara (não-bloqueante) a edge function que envia e-mails aos admins
  v_headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer ' || v_anon_key,
    'apikey', v_anon_key
  );
  v_body := jsonb_build_object(
    'titulo', 'Ação Crítica Detectada',
    'mensagem', v_message,
    'tipo', 'critical_action',
    'actor_name', v_actor_name,
    'table_name', TG_TABLE_NAME,
    'action', v_action,
    'item_name', COALESCE(v_item_name, '')
  );

  BEGIN
    PERFORM net.http_post(
      url := v_url,
      body := v_body,
      headers := v_headers
    );
  EXCEPTION WHEN OTHERS THEN
    BEGIN
      PERFORM extensions.http_post(
        url := v_url,
        body := v_body,
        headers := v_headers
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'notify_critical_action: falha ao invocar notify-critical-action-email: %', SQLERRM;
    END;
  END;

  RETURN COALESCE(NEW, OLD);
END;
$$;
