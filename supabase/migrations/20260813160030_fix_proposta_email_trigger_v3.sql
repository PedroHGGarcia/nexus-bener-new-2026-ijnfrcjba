-- Ensure pg_net extension is available
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Fix the trigger function with correct schema resolution and apikey header
CREATE OR REPLACE FUNCTION public.notify_proposal_created()
RETURNS trigger AS $$
DECLARE
  v_url text := 'https://ugnhnbfogxbcptprsfot.supabase.co/functions/v1/send-proposal-email';
  v_anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVnbmhuYmZvZ3hiY3B0cHJzZm90Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU1MDg3NTMsImV4cCI6MjEwMTA4NDc1M30.jDTzF5Ni8ks6IHri7jpYXUg9icbdJM5-vYHBhMaHjR0';
  v_headers jsonb;
  v_body jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_anon_key,
      'apikey', v_anon_key
    );
    v_body := jsonb_build_object(
      'proposta_id', NEW.id::text,
      'auto_triggered', true
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
        RAISE WARNING 'notify_proposal_created: Failed to invoke send-proposal-email edge function: %', SQLERRM;
      END;
    END;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, net, extensions;

DROP TRIGGER IF EXISTS trigger_notify_proposal_created ON public.propostas;
CREATE TRIGGER trigger_notify_proposal_created
  AFTER INSERT ON public.propostas
  FOR EACH ROW EXECUTE FUNCTION public.notify_proposal_created();
