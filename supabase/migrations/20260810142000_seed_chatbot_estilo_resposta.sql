-- Seed default preference for chatbot response style
-- Uses ON CONFLICT DO NOTHING for idempotency
INSERT INTO public.preferencias (usuario, chave, valor)
SELECT NULL, 'chatbot_estilo_resposta', '{"estilo": "curto_direto"}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM public.preferencias
  WHERE chave = 'chatbot_estilo_resposta'
    AND usuario IS NULL
);
