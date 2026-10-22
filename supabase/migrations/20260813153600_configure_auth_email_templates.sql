DO $$
BEGIN
  BEGIN
    UPDATE auth.config
    SET
      mailer_templated = true,
      mailer_templates_confirmation_content = 'BENER',
      mailer_templates_recovery_content = 'BENER',
      mailer_subjects_confirmation = 'Confirme sua conta - Bener Máquinas',
      mailer_subjects_recovery = 'Recuperação de senha - Bener Máquinas',
      mailer_subjects_invite = 'Convite - Bener Máquinas Extranet',
      mailer_subjects_magic_link = 'Link de acesso - Bener Máquinas',
      mailer_subjects_email_change = 'Confirmação de alteração de e-mail - Bener Máquinas';
    RAISE NOTICE 'Auth email subjects updated successfully.';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not update auth.config directly. Configure email templates via Supabase Dashboard > Authentication > Email Templates.';
  END;
END $$;
