-- Migration: Otimização de performance para audit_logs
-- Criar índices essenciais para consultas da trilha de auditoria (created_at DESC, filtros por table_name, user_id, record_id, user_name)

-- 1. Índice primário de ordenação temporal (usado na listagem principal)
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at_desc
  ON public.audit_logs (created_at DESC);

-- 2. Índice composto para filtro por tabela ordenado por data
CREATE INDEX IF NOT EXISTS idx_audit_logs_table_created_at
  ON public.audit_logs (table_name, created_at DESC);

-- 3. Índice para busca de histórico de entidade específica (record_id + table_name)
CREATE INDEX IF NOT EXISTS idx_audit_logs_record_table
  ON public.audit_logs (record_id, table_name)
  WHERE record_id IS NOT NULL;

-- 4. Índice para busca por ator/usuário (user_id)
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id_created_at
  ON public.audit_logs (user_id, created_at DESC)
  WHERE user_id IS NOT NULL;

-- 5. Índice para busca por nome de usuário (ilike pattern matching com pg_trgm se disponível, ou btree text_pattern_ops)
-- Usamos btree com lower(user_name) para buscas insensíveis a maiúsculas/minúsculas
CREATE INDEX IF NOT EXISTS idx_audit_logs_lower_user_name
  ON public.audit_logs (lower(user_name), created_at DESC)
  WHERE user_name IS NOT NULL;
