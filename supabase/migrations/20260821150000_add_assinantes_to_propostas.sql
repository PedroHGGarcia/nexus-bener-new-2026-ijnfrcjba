-- Adicionar colunas assinante_representante_id e assinante_gerente_id na tabela propostas
ALTER TABLE public.propostas 
ADD COLUMN IF NOT EXISTS assinante_representante_id uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS assinante_gerente_id uuid REFERENCES auth.users(id);
