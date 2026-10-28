-- Migration: Atualizar a senha dos 4 gerentes ativos para @bener2026
-- Contas afetadas exclusivamente:
--   - ario@bener.com.br
--   - elvis.pretto@bener.com.br
--   - francesco@bener.com.br
--   - wanderley@bener.com.br

UPDATE auth.users
SET
  encrypted_password = extensions.crypt('@bener2026', extensions.gen_salt('bf')),
  updated_at = NOW(),
  email_confirmed_at = COALESCE(email_confirmed_at, NOW())
WHERE LOWER(email) IN (
  'ario@bener.com.br',
  'elvis.pretto@bener.com.br',
  'francesco@bener.com.br',
  'wanderley@bener.com.br'
);
