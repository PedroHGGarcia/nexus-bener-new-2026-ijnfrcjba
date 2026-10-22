CREATE EXTENSION IF NOT EXISTS pg_net SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.notify_proposal_created()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM net.http_post(
      url := 'https://ugnhnbfogxbcptprsfot.supabase.co/functions/v1/send-proposal-email',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVnbmhuYmZvZ3hiY3B0cHJzZm90Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU1MDg3NTMsImV4cCI6MjEwMTA4NDc1M30.jDTzF5Ni8ks6IHri7jpYXUg9icbdJM5-vYHBhMaHjR0'
      ),
      body := jsonb_build_object(
        'proposta_id', NEW.id::text,
        'auto_triggered', true
      )::text
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_notify_proposal_created ON public.propostas;
CREATE TRIGGER trigger_notify_proposal_created
  AFTER INSERT ON public.propostas
  FOR EACH ROW EXECUTE FUNCTION public.notify_proposal_created();
