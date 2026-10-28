-- Migration: Criar tabelas para isolamento de conversas do chatbot e visão de admin com auditoria
-- Data: 2026-10-28
-- Tabelas:
--   - chatbot_conversas: agrupador de sessões/conversas vinculado estritamente ao user_id
--   - chatbot_mensagens: histórico das mensagens de cada conversa
--   - chatbot_admin_audit: log de auditoria quando um admin visualiza a conversa de outro usuário

-- 1. chatbot_conversas
CREATE TABLE IF NOT EXISTS public.chatbot_conversas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL DEFAULT 'Nova conversa',
  ativa BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chatbot_conversas_user_id ON public.chatbot_conversas(user_id);
CREATE INDEX IF NOT EXISTS idx_chatbot_conversas_user_ativa ON public.chatbot_conversas(user_id, ativa);
CREATE INDEX IF NOT EXISTS idx_chatbot_conversas_updated_at ON public.chatbot_conversas(updated_at DESC);

-- 2. chatbot_mensagens
CREATE TABLE IF NOT EXISTS public.chatbot_mensagens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversa_id UUID NOT NULL REFERENCES public.chatbot_conversas(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  is_error BOOLEAN NOT NULL DEFAULT false,
  table_data JSONB,
  attachment JSONB,
  feedback TEXT CHECK (feedback IS NULL OR feedback IN ('like', 'dislike')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chatbot_mensagens_conversa_id ON public.chatbot_mensagens(conversa_id);
CREATE INDEX IF NOT EXISTS idx_chatbot_mensagens_user_id ON public.chatbot_mensagens(user_id);
CREATE INDEX IF NOT EXISTS idx_chatbot_mensagens_created_at ON public.chatbot_mensagens(created_at ASC);

-- 3. chatbot_admin_audit
CREATE TABLE IF NOT EXISTS public.chatbot_admin_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  admin_email TEXT NOT NULL,
  target_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_user_email TEXT,
  conversa_id UUID REFERENCES public.chatbot_conversas(id) ON DELETE SET NULL,
  motivo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chatbot_admin_audit_admin ON public.chatbot_admin_audit(admin_id);
CREATE INDEX IF NOT EXISTS idx_chatbot_admin_audit_target ON public.chatbot_admin_audit(target_user_id);
CREATE INDEX IF NOT EXISTS idx_chatbot_admin_audit_created ON public.chatbot_admin_audit(created_at DESC);

-- Habilita RLS em todas as tabelas
ALTER TABLE public.chatbot_conversas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chatbot_mensagens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chatbot_admin_audit ENABLE ROW LEVEL SECURITY;

-- 4. POLICIES para chatbot_conversas
-- SELECT: Usuário dono da conversa OU administrador
DROP POLICY IF EXISTS "chatbot_conversas_select" ON public.chatbot_conversas;
CREATE POLICY "chatbot_conversas_select" ON public.chatbot_conversas
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_admin()
  );

-- INSERT: Apenas o próprio usuário autenticado pode criar conversas para si
DROP POLICY IF EXISTS "chatbot_conversas_insert" ON public.chatbot_conversas;
CREATE POLICY "chatbot_conversas_insert" ON public.chatbot_conversas
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
  );

-- UPDATE: Apenas o próprio usuário pode modificar sua própria conversa (ex: título, ativa)
-- Admins têm acesso somente leitura às conversas de terceiros
DROP POLICY IF EXISTS "chatbot_conversas_update" ON public.chatbot_conversas;
CREATE POLICY "chatbot_conversas_update" ON public.chatbot_conversas
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- DELETE: Apenas o próprio usuário pode apagar sua própria conversa
DROP POLICY IF EXISTS "chatbot_conversas_delete" ON public.chatbot_conversas;
CREATE POLICY "chatbot_conversas_delete" ON public.chatbot_conversas
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- 5. POLICIES para chatbot_mensagens
-- SELECT: Usuário dono OU administrador
DROP POLICY IF EXISTS "chatbot_mensagens_select" ON public.chatbot_mensagens;
CREATE POLICY "chatbot_mensagens_select" ON public.chatbot_mensagens
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_admin()
  );

-- INSERT: Apenas para a própria conversa do usuário
DROP POLICY IF EXISTS "chatbot_mensagens_insert" ON public.chatbot_mensagens;
CREATE POLICY "chatbot_mensagens_insert" ON public.chatbot_mensagens
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.chatbot_conversas c
      WHERE c.id = conversa_id AND c.user_id = auth.uid()
    )
  );

-- UPDATE: Apenas o próprio usuário pode atualizar mensagem própria (ex: registrar feedback 👍/👎)
-- Admins têm acesso somente leitura
DROP POLICY IF EXISTS "chatbot_mensagens_update" ON public.chatbot_mensagens;
CREATE POLICY "chatbot_mensagens_update" ON public.chatbot_mensagens
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- DELETE: Apenas o próprio usuário pode apagar mensagem da sua conversa
DROP POLICY IF EXISTS "chatbot_mensagens_delete" ON public.chatbot_mensagens;
CREATE POLICY "chatbot_mensagens_delete" ON public.chatbot_mensagens
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- 6. POLICIES para chatbot_admin_audit
-- SELECT: Apenas administradores podem consultar logs de auditoria
DROP POLICY IF EXISTS "chatbot_admin_audit_select" ON public.chatbot_admin_audit;
CREATE POLICY "chatbot_admin_audit_select" ON public.chatbot_admin_audit
  FOR SELECT TO authenticated
  USING (public.is_admin());

-- INSERT: Administradores logados ao auditar (ou service role)
DROP POLICY IF EXISTS "chatbot_admin_audit_insert" ON public.chatbot_admin_audit;
CREATE POLICY "chatbot_admin_audit_insert" ON public.chatbot_admin_audit
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() AND admin_id = auth.uid());
