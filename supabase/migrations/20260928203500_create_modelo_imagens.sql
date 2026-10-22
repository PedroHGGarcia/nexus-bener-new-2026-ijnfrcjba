-- 20260928203500_create_modelo_imagens.sql
-- Tabela para biblioteca de imagens técnicas vinculadas a modelos (plaqueta, especificações, tabelas de injeção, diagramas hidráulicos, etc.)

CREATE TABLE IF NOT EXISTS public.modelo_imagens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  modelo_id UUID NOT NULL REFERENCES public.modelos(id) ON DELETE CASCADE,
  nome_arquivo TEXT,
  url TEXT NOT NULL,
  descricao TEXT,
  tipo_documento TEXT DEFAULT 'plaqueta',
  tamanho_bytes BIGINT,
  criado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices de consulta rápida
CREATE INDEX IF NOT EXISTS idx_modelo_imagens_modelo ON public.modelo_imagens(modelo_id);
CREATE INDEX IF NOT EXISTS idx_modelo_imagens_created_at ON public.modelo_imagens(created_at DESC);

-- Trigger para updated_at automático
DROP TRIGGER IF EXISTS trg_modelo_imagens_updated_at ON public.modelo_imagens;
CREATE TRIGGER trg_modelo_imagens_updated_at
  BEFORE UPDATE ON public.modelo_imagens
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- RLS: Habilita segurança na tabela
ALTER TABLE public.modelo_imagens ENABLE ROW LEVEL SECURITY;

-- SELECT: Usuários autenticados podem ler as imagens técnicas dos modelos
DROP POLICY IF EXISTS "modelo_imagens_select" ON public.modelo_imagens;
CREATE POLICY "modelo_imagens_select" ON public.modelo_imagens
  FOR SELECT TO authenticated
  USING (true);

-- INSERT: Admin ou Gerente podem cadastrar imagens técnicas
DROP POLICY IF EXISTS "modelo_imagens_insert" ON public.modelo_imagens;
CREATE POLICY "modelo_imagens_insert" ON public.modelo_imagens
  FOR INSERT TO authenticated
  WITH CHECK (is_admin() OR is_gerente());

-- UPDATE: Admin ou Gerente podem atualizar dados da imagem
DROP POLICY IF EXISTS "modelo_imagens_update" ON public.modelo_imagens;
CREATE POLICY "modelo_imagens_update" ON public.modelo_imagens
  FOR UPDATE TO authenticated
  USING (is_admin() OR is_gerente())
  WITH CHECK (is_admin() OR is_gerente());

-- DELETE: Admin ou Gerente podem excluir imagens da biblioteca
DROP POLICY IF EXISTS "modelo_imagens_delete" ON public.modelo_imagens;
CREATE POLICY "modelo_imagens_delete" ON public.modelo_imagens
  FOR DELETE TO authenticated
  USING (is_admin() OR is_gerente());
