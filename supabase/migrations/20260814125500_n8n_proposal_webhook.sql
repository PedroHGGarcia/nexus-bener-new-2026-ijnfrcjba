-- Ensure pg_net extension is available
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Function to trigger send-proposal-email edge function asynchronously on proposal creation
CREATE OR REPLACE FUNCTION public.notify_proposal_created()
RETURNS trigger AS $$
DECLARE
  v_url text := 'https://ugnhnbfogxbcptprsfot.supabase.co/functions/v1/send-proposal-email';
  v_anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVnbmhuYmZvZ3hiY3B0cHJzZm90Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzczOTI2NDcsImV4cCI6MjA1Mjk2ODY0N30.2g60fG3mF1C37s38r0rWJb6tJ1pYh17hYg16xYp2zZs';
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

-- Ensure trigger exists for inserting new proposals
DROP TRIGGER IF EXISTS trigger_notify_proposal_created ON public.propostas;
CREATE TRIGGER trigger_notify_proposal_created
  AFTER INSERT ON public.propostas
  FOR EACH ROW EXECUTE FUNCTION public.notify_proposal_created();
