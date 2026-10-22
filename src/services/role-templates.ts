import { supabase } from '@/lib/supabase/client'

/**
 * Templates hardcoded — usados como fallback quando a tabela `role_templates`
 * está vazia ou inacessível, e como fonte canônica das chaves de menu padrão.
 */
export const ROLE_TEMPLATES: Record<string, string[]> = {
  Vendedor: [
    'dashboard',
    'cadastros-clientes',
    'eventos',
    'projetos',
    'propostas-emitir',
    'propostas-criadas',
    'produtos-lista',
    'notificacoes',
    'perfil',
  ],
  Representante: [
    'dashboard',
    'cadastros-clientes',
    'eventos',
    'projetos',
    'propostas-emitir',
    'propostas-criadas',
    'produtos-lista',
    'notificacoes',
    'perfil',
  ],
  Gerente: [
    'dashboard',
    'cadastros-clientes',
    'cadastros-representantes',
    'cadastros-regioes',
    'cadastros-gerentes',
    'cadastros-prepostos',
    'eventos',
    'projetos',
    'propostas-dashboard',
    'propostas-emitir',
    'propostas-criadas',
    'propostas-avancadas',
    'produtos-lista',
    'produtos-dashboard',
    'notificacoes',
    'area-atuacao',
    'perfil',
  ],
  Financeiro: [
    'dashboard',
    'cadastros-clientes',
    'propostas-dashboard',
    'propostas-criadas',
    'notificacoes',
    'perfil',
  ],
  'Admin Completo': [
    'dashboard',
    'cadastros-clientes',
    'cadastros-representantes',
    'cadastros-regioes',
    'cadastros-gerentes',
    'cadastros-prepostos',
    'eventos',
    'projetos',
    'propostas-dashboard',
    'propostas-emitir',
    'propostas-criadas',
    'propostas-avancadas',
    'propostas-tipos',
    'produtos-lista',
    'produtos-dashboard',
    'produtos-precos',
    'produtos-categorias',
    'produtos-marcas',
    'produtos-modelos',
    'produtos-versoes',
    'produtos-acessorios',
    'notificacoes',
    'importacoes',
    'importar-base',
    'importar-base-antiga',
    'area-atuacao',
    'usuarios',
    'auditoria',
    'configuracoes',
    'perfil',
  ],
}

/**
 * Lista de todas as chaves de menu disponíveis (derivada do Admin Completo),
 * usada no checklist de permissões ao criar/editar perfis.
 */
export const ALL_MENU_KEYS: string[] = ROLE_TEMPLATES['Admin Completo']

/** Fallback estático derivado dos templates hardcoded. */
export const ROLE_OPTIONS: string[] = Object.keys(ROLE_TEMPLATES)

export interface RoleTemplate {
  id: string
  name: string
  menu_access: string[]
  is_system: boolean
}

interface RoleTemplateRow {
  id: string
  name: string
  menu_access: string[] | null
  is_system: boolean | null
}

function toRoleTemplate(row: RoleTemplateRow): RoleTemplate {
  return {
    id: row.id,
    name: row.name,
    menu_access: Array.isArray(row.menu_access) ? row.menu_access : [],
    is_system: row.is_system ?? false,
  }
}

function hardcodedFallback(): RoleTemplate[] {
  return Object.entries(ROLE_TEMPLATES).map(([name, menu_access], idx) => ({
    id: `fallback-${idx}`,
    name,
    menu_access,
    is_system: true,
  }))
}

/**
 * Busca os templates de perfil do banco (tabela `role_templates`).
 * Em caso de erro ou tabela vazia, retorna o fallback hardcoded.
 */
export async function fetchRoleTemplates(): Promise<RoleTemplate[]> {
  try {
    const { data, error } = await supabase
      .from('role_templates')
      .select('id, name, menu_access, is_system')
      .order('created_at', { ascending: true })

    if (error) throw error
    if (!data || data.length === 0) return hardcodedFallback()
    return data.map(toRoleTemplate)
  } catch {
    return hardcodedFallback()
  }
}

/**
 * Busca apenas a lista de nomes de perfis — útil para popular selects.
 * Sempre retorna algo (fallback em caso de falha).
 */
export async function fetchRoleOptions(): Promise<string[]> {
  const templates = await fetchRoleTemplates()
  return templates.map((t) => t.name)
}

export async function createRoleTemplate(
  name: string,
  menu_access: string[],
): Promise<{ data: RoleTemplate | null; error: string | null }> {
  const { data, error } = await supabase
    .from('role_templates')
    .insert({ name, menu_access, is_system: false })
    .select('id, name, menu_access, is_system')
    .single()
  if (error) return { data: null, error: error.message }
  return { data: toRoleTemplate(data as RoleTemplateRow), error: null }
}

export async function updateRoleTemplate(
  id: string,
  data: { name?: string; menu_access?: string[] },
): Promise<{ data: RoleTemplate | null; error: string | null }> {
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (data.name !== undefined) update.name = data.name
  if (data.menu_access !== undefined) update.menu_access = data.menu_access

  const { data: row, error } = await supabase
    .from('role_templates')
    .update(
      update as import('@/lib/supabase/types').Database['public']['Tables']['role_templates']['Update'],
    )
    .eq('id', id)
    .select('id, name, menu_access, is_system')
    .single()
  if (error) return { data: null, error: error.message }
  return { data: toRoleTemplate(row as RoleTemplateRow), error: null }
}

export async function deleteRoleTemplate(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('role_templates').delete().eq('id', id)
  return { error: error?.message ?? null }
}
