ALTER TABLE public.propostas ADD COLUMN IF NOT EXISTS estado_faturamento TEXT;
ALTER TABLE public.propostas ADD COLUMN IF NOT EXISTS regime_preco TEXT DEFAULT 'embutido';
ALTER TABLE public.propostas ADD COLUMN IF NOT EXISTS cambio_estimado NUMERIC;
ALTER TABLE public.propostas ADD COLUMN IF NOT EXISTS cambio_estimado_data TEXT;
ALTER TABLE public.propostas ADD COLUMN IF NOT EXISTS cambio_estimado_base TEXT;
