-- Adiciona tipo_proposta na tabela proposta_versoes para permitir tipo por maquina no pacote
ALTER TABLE public.proposta_versoes ADD COLUMN IF NOT EXISTS tipo_proposta TEXT;
