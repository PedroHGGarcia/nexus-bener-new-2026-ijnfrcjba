-- Migration: Adicionar perfil 'Representante' ao role_templates e garantir que Gerentes não tenham gerente_id
INSERT INTO public.role_templates (name, menu_access, is_system)
VALUES (
  'Representante',
  '["dashboard","cadastros-clientes","eventos","projetos","propostas-emitir","propostas-criadas","produtos-lista","notificacoes","perfil"]'::jsonb,
  true
)
ON CONFLICT (name) DO UPDATE
SET is_system = true,
    menu_access = EXCLUDED.menu_access;

-- Garantir que nenhum perfil com papel de Gerente possua gerente_id vinculado
UPDATE public.profiles
SET gerente_id = NULL
WHERE role ILIKE '%gerente%'
  AND gerente_id IS NOT NULL;

-- Garantir que nenhum representante vinculado a um perfil/email de gerente possua gerente_id
UPDATE public.representantes
SET gerente_id = NULL
WHERE (
    profile_id IN (SELECT id FROM public.profiles WHERE role ILIKE '%gerente%')
    OR LOWER(TRIM(COALESCE(email, ''))) IN (SELECT LOWER(TRIM(email)) FROM public.gerentes WHERE email IS NOT NULL)
  )
  AND gerente_id IS NOT NULL;
