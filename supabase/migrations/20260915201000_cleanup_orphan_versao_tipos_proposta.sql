-- Limpeza idempotente de vínculos órfãos na tabela versao_tipos_proposta
-- Vínculos cujo versao_id aponta para versão que não existe mais, foi soft-deleted ou está com status inativo.
-- Não remove nenhum vínculo de versão ativa.

DO $$
DECLARE
  deleted_count integer := 0;
BEGIN
  WITH deleted_rows AS (
    DELETE FROM public.versao_tipos_proposta vtp
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.versoes v
      WHERE v.id = vtp.versao_id
        AND (v.status = 'Ativo' OR v.status = 'ativo')
        AND v.deleted_at IS NULL
    )
    RETURNING *
  )
  SELECT count(*) INTO deleted_count FROM deleted_rows;

  RAISE NOTICE 'Limpeza de versao_tipos_proposta concluida: % vinculos orfaos removidos.', deleted_count;
END $$;
