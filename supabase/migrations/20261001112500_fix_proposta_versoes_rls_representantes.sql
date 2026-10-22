-- Migration: fix_proposta_versoes_rls_for_representantes
-- Permite que usuários com perfil de Representante/Vendedor ou que criaram a proposta pai (por id, email, nome ou representante_id)
-- consigam inserir, selecionar, atualizar e excluir as versões vinculadas às suas propostas.

DROP POLICY IF EXISTS "proposta_versoes_select" ON public.proposta_versoes;
DROP POLICY IF EXISTS "proposta_versoes_insert" ON public.proposta_versoes;
DROP POLICY IF EXISTS "proposta_versoes_update" ON public.proposta_versoes;
DROP POLICY IF EXISTS "proposta_versoes_delete" ON public.proposta_versoes;

CREATE POLICY "proposta_versoes_select" ON public.proposta_versoes
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR public.is_gerente()
    OR EXISTS (
      SELECT 1 FROM public.propostas p
      WHERE p.id = proposta_versoes.proposta_id
        AND (
          p."user" = auth.uid()::text
          OR p."user" = (SELECT prof.email FROM public.profiles prof WHERE prof.id = auth.uid())
          OR p."user" = (SELECT prof.name FROM public.profiles prof WHERE prof.id = auth.uid())
          OR p.representante IN (
            SELECT r.id FROM public.representantes r
            WHERE r.profile_id = auth.uid()
               OR (r.email IS NOT NULL AND LOWER(r.email) = LOWER((SELECT prof.email FROM public.profiles prof WHERE prof.id = auth.uid())))
               OR r.emails @> to_jsonb(LOWER((SELECT prof.email FROM public.profiles prof WHERE prof.id = auth.uid())))::jsonb
          )
        )
    )
  );

CREATE POLICY "proposta_versoes_insert" ON public.proposta_versoes
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    OR public.is_gerente()
    OR EXISTS (
      SELECT 1 FROM public.propostas p
      WHERE p.id = proposta_versoes.proposta_id
        AND (
          p."user" = auth.uid()::text
          OR p."user" = (SELECT prof.email FROM public.profiles prof WHERE prof.id = auth.uid())
          OR p."user" = (SELECT prof.name FROM public.profiles prof WHERE prof.id = auth.uid())
          OR p.representante IN (
            SELECT r.id FROM public.representantes r
            WHERE r.profile_id = auth.uid()
               OR (r.email IS NOT NULL AND LOWER(r.email) = LOWER((SELECT prof.email FROM public.profiles prof WHERE prof.id = auth.uid())))
               OR r.emails @> to_jsonb(LOWER((SELECT prof.email FROM public.profiles prof WHERE prof.id = auth.uid())))::jsonb
          )
        )
    )
  );

CREATE POLICY "proposta_versoes_update" ON public.proposta_versoes
  FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    OR public.is_gerente()
    OR EXISTS (
      SELECT 1 FROM public.propostas p
      WHERE p.id = proposta_versoes.proposta_id
        AND (
          p."user" = auth.uid()::text
          OR p."user" = (SELECT prof.email FROM public.profiles prof WHERE prof.id = auth.uid())
          OR p."user" = (SELECT prof.name FROM public.profiles prof WHERE prof.id = auth.uid())
          OR p.representante IN (
            SELECT r.id FROM public.representantes r
            WHERE r.profile_id = auth.uid()
               OR (r.email IS NOT NULL AND LOWER(r.email) = LOWER((SELECT prof.email FROM public.profiles prof WHERE prof.id = auth.uid())))
               OR r.emails @> to_jsonb(LOWER((SELECT prof.email FROM public.profiles prof WHERE prof.id = auth.uid())))::jsonb
          )
        )
    )
  )
  WITH CHECK (
    public.is_admin()
    OR public.is_gerente()
    OR EXISTS (
      SELECT 1 FROM public.propostas p
      WHERE p.id = proposta_versoes.proposta_id
        AND (
          p."user" = auth.uid()::text
          OR p."user" = (SELECT prof.email FROM public.profiles prof WHERE prof.id = auth.uid())
          OR p."user" = (SELECT prof.name FROM public.profiles prof WHERE prof.id = auth.uid())
          OR p.representante IN (
            SELECT r.id FROM public.representantes r
            WHERE r.profile_id = auth.uid()
               OR (r.email IS NOT NULL AND LOWER(r.email) = LOWER((SELECT prof.email FROM public.profiles prof WHERE prof.id = auth.uid())))
               OR r.emails @> to_jsonb(LOWER((SELECT prof.email FROM public.profiles prof WHERE prof.id = auth.uid())))::jsonb
          )
        )
    )
  );

CREATE POLICY "proposta_versoes_delete" ON public.proposta_versoes
  FOR DELETE TO authenticated
  USING (
    public.is_admin()
    OR public.is_gerente()
    OR EXISTS (
      SELECT 1 FROM public.propostas p
      WHERE p.id = proposta_versoes.proposta_id
        AND (
          p."user" = auth.uid()::text
          OR p."user" = (SELECT prof.email FROM public.profiles prof WHERE prof.id = auth.uid())
          OR p."user" = (SELECT prof.name FROM public.profiles prof WHERE prof.id = auth.uid())
          OR p.representante IN (
            SELECT r.id FROM public.representantes r
            WHERE r.profile_id = auth.uid()
               OR (r.email IS NOT NULL AND LOWER(r.email) = LOWER((SELECT prof.email FROM public.profiles prof WHERE prof.id = auth.uid())))
               OR r.emails @> to_jsonb(LOWER((SELECT prof.email FROM public.profiles prof WHERE prof.id = auth.uid())))::jsonb
          )
        )
    )
  );
