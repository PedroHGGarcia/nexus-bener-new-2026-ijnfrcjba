-- Add preco_especial column to public.propostas
ALTER TABLE public.propostas
ADD COLUMN IF NOT EXISTS preco_especial NUMERIC NULL;
