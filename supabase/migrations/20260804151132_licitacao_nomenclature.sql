-- Create a race-safe function to generate the next proposal number
-- Uses LIC prefix for licitação proposals, PROP for normal proposals
CREATE OR REPLACE FUNCTION public.generate_next_proposta_numero(is_licitacao boolean)
RETURNS text AS $$
DECLARE
  v_prefix text;
  v_year_str text;
  v_max_seq int;
  v_next_seq text;
BEGIN
  v_prefix := CASE WHEN is_licitacao THEN 'LIC' ELSE 'PROP' END;
  v_year_str := EXTRACT(YEAR FROM NOW())::text;

  SELECT COALESCE(MAX(seq_num), 0) INTO v_max_seq
  FROM (
    SELECT
      (regexp_match(numero_proposta, '^' || v_prefix || '-' || v_year_str || '-(\d{3})', 'i'))[1]::int AS seq_num
    FROM public.propostas
    WHERE numero_proposta ILIKE v_prefix || '-' || v_year_str || '-%'
  ) sub;

  v_next_seq := lpad((v_max_seq + 1)::text, 3, '0');

  RETURN v_prefix || '-' || v_year_str || '-' || v_next_seq;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Backfill: Convert existing licitação proposals from PROP- to LIC- prefix
-- Only affects proposals where modelo_licitacao = true and numero_proposta starts with 'PROP-'
-- Preserves the rest of the identifier (year, sequence, version letter)
UPDATE public.propostas
SET numero_proposta = regexp_replace(numero_proposta, '^PROP-', 'LIC-')
WHERE modelo_licitacao = true
  AND numero_proposta LIKE 'PROP-%';
