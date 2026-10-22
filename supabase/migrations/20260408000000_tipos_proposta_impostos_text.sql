-- Alter column tipos_proposta.imposto_ipi and imposto_icms from numeric to text
-- User clarification: Imposto IPI and Imposto ICMS are long descriptive texts with decrees,
-- not purely numeric percentages, and belong directly in tipos_proposta columns.

ALTER TABLE public.tipos_proposta
  ALTER COLUMN imposto_ipi TYPE text USING (
    CASE 
      WHEN imposto_ipi IS NULL THEN NULL
      WHEN imposto_ipi = 0 THEN NULL
      ELSE imposto_ipi::text
    END
  ),
  ALTER COLUMN imposto_ipi DROP DEFAULT;

ALTER TABLE public.tipos_proposta
  ALTER COLUMN imposto_icms TYPE text USING (
    CASE 
      WHEN imposto_icms IS NULL THEN NULL
      WHEN imposto_icms = 0 THEN NULL
      ELSE imposto_icms::text
    END
  ),
  ALTER COLUMN imposto_icms DROP DEFAULT;

-- Also migrate any existing IPI/ICMS texts that were diverted into campos_adicionais back to the real columns!
DO $$
DECLARE
  r RECORD;
  ipi_text text;
  icms_text text;
  new_extras jsonb;
BEGIN
  FOR r IN 
    SELECT id, campos_adicionais, imposto_ipi, imposto_icms 
    FROM public.tipos_proposta 
    WHERE jsonb_typeof(campos_adicionais) = 'array' 
      AND jsonb_path_exists(campos_adicionais, '$[*] ? (@.titulo == "IPI" || @.titulo == "ICMS" || @.titulo == "Imposto IPI" || @.titulo == "Imposto ICMS")')
  LOOP
    -- Extract IPI from campos_adicionais if present and imposto_ipi is null
    SELECT elem->>'conteudo' INTO ipi_text
    FROM jsonb_array_elements(r.campos_adicionais) AS elem
    WHERE elem->>'titulo' IN ('IPI', 'Imposto IPI')
      AND elem->>'conteudo' IS NOT NULL AND trim(elem->>'conteudo') <> ''
    LIMIT 1;

    -- Extract ICMS from campos_adicionais if present and imposto_icms is null
    SELECT elem->>'conteudo' INTO icms_text
    FROM jsonb_array_elements(r.campos_adicionais) AS elem
    WHERE elem->>'titulo' IN ('ICMS', 'Imposto ICMS')
      AND elem->>'conteudo' IS NOT NULL AND trim(elem->>'conteudo') <> ''
    LIMIT 1;

    -- Filter out IPI and ICMS from campos_adicionais
    SELECT COALESCE(
      jsonb_agg(elem),
      '[]'::jsonb
    ) INTO new_extras
    FROM jsonb_array_elements(r.campos_adicionais) AS elem
    WHERE elem->>'titulo' NOT IN ('IPI', 'ICMS', 'Imposto IPI', 'Imposto ICMS');

    -- Update row
    UPDATE public.tipos_proposta
    SET 
      imposto_ipi = COALESCE(r.imposto_ipi, ipi_text),
      imposto_icms = COALESCE(r.imposto_icms, icms_text),
      campos_adicionais = new_extras
    WHERE id = r.id;
  END LOOP;
END $$;
