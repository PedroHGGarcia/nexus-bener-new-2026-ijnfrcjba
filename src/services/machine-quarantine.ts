import { supabase } from '@/lib/supabase/client'
import { clearVersoesCache } from '@/services/versoes'

/**
 * Soft-delete / quarentena para a hierarquia de máquinas.
 *
 * Regras de negócio:
 * - Qualquer usuário Comercial ou Admin pode mover um item para a quarentena
 *   (UPDATE status='Em Quarentena', deleted_at=now(), deleted_by=auth.uid()).
 *   Isso NUNCA quebra FKs de propostas — o registro continua existindo.
 * - Só Admin pode fazer DELETE real (RLS garante isso no banco).
 * - Restaurar volta o status para 'Ativo' e limpa deleted_at/deleted_by.
 * - A trigger `audit_machine_changes` registra o UPDATE (old/new), então
 *   quarentenar e restaurar já são auditados automaticamente.
 */

export const QUARANTINE_STATUS = 'Em Quarentena' as const
export const ACTIVE_STATUS = 'Ativo' as const
export const QUARANTINE_DAYS = 7

export type MachineTable =
  | 'categorias_produtos'
  | 'categorias'
  | 'produtos'
  | 'marcas'
  | 'modelos'
  | 'versoes'

export const MACHINE_TABLE_LABEL: Record<MachineTable, string> = {
  categorias_produtos: 'Categorias',
  categorias: 'Categorias',
  produtos: 'Produtos',
  marcas: 'Marcas',
  modelos: 'Modelos',
  versoes: 'Versões',
}

function resolveDbTable(table: MachineTable): string {
  if (table === 'categorias_produtos') return 'categorias'
  return table
}

/** Move um item para a quarentena (soft-delete). */
export async function quarantineMachineItem(table: MachineTable, id: string): Promise<void> {
  const dbTable = resolveDbTable(table)
  const { error } = await (supabase.from(dbTable as any) as any)
    .update({
      status: QUARANTINE_STATUS,
      deleted_at: new Date().toISOString(),
      // deleted_by é preenchido pelo RLS/auth.uid() no client via setor — o supabase
      // não expõe auth.uid() direto no update, então capturamos o user atual.
    })
    .eq('id', id)
  if (error) throw new Error(error.message)

  // Tenta gravar o deleted_by com o id do usuário autenticado. Se falhar
  // (ex: constraint), o UPDATE de status já aconteceu — não abortamos.
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (user) {
    await (supabase.from(dbTable as any) as any).update({ deleted_by: user.id }).eq('id', id)
  }

  // Invalida o cache de versões em memória sempre que a hierarquia for alterada
  clearVersoesCache()
}

/** Restaura um item da quarentena de volta para 'Ativo'. */
export async function restoreMachineItem(table: MachineTable, id: string): Promise<void> {
  const dbTable = resolveDbTable(table)
  const { error } = await (supabase.from(dbTable as any) as any)
    .update({
      status: ACTIVE_STATUS,
      deleted_at: null,
      deleted_by: null,
    })
    .eq('id', id)
  if (error) throw new Error(error.message)

  // Invalida o cache de versões em memória ao restaurar qualquer nível da hierarquia
  clearVersoesCache()
}

/** Exclui permanentemente (DELETE real). Só Admin consegue (RLS). */
export async function permanentlyDeleteMachineItem(table: MachineTable, id: string): Promise<void> {
  const dbTable = resolveDbTable(table)
  const { error } = await (supabase.from(dbTable as any) as any).delete().eq('id', id)
  if (error) throw new Error(error.message)

  clearVersoesCache()
}

export interface QuarantineItem {
  id: string
  table: MachineTable
  nome: string
  status: string
  deleted_at: string | null
  deleted_by: string | null
  deleted_by_name: string | null
  created_at: string | null
}

interface RawQuarantineRow {
  id: string
  nome: string
  status: string
  deleted_at: string | null
  deleted_by: string | null
  created_at: string | null
}

/**
 * Busca todos os itens em quarentena nas 5 tabelas, com o nome de quem excluiu
 * resolvido via profiles.
 */
export async function fetchQuarantineItems(): Promise<QuarantineItem[]> {
  const tables: MachineTable[] = ['categorias_produtos', 'produtos', 'marcas', 'modelos', 'versoes']

  const results = await Promise.all(
    tables.map(async (table) => {
      const dbTable = resolveDbTable(table)
      const { data, error } = await (supabase.from(dbTable as any) as any)
        .select('id, nome, status, deleted_at, deleted_by, created_at')
        .eq('status', QUARANTINE_STATUS)
        .order('deleted_at', { ascending: false })
      if (error) {
        console.error(`fetchQuarantineItems(${table}):`, error)
        return [] as RawQuarantineRow[]
      }
      return (data ?? []) as RawQuarantineRow[]
    }),
  )

  // Resolve nomes dos autores (deleted_by -> profiles.name)
  const userIds = Array.from(
    new Set(
      results
        .flat()
        .map((r) => r.deleted_by)
        .filter((u): u is string => !!u),
    ),
  )

  const nameMap = new Map<string, string>()
  if (userIds.length > 0) {
    const { data: profiles } = await supabase.from('profiles').select('id, name').in('id', userIds)
    for (const p of profiles ?? []) {
      nameMap.set(p.id, p.name)
    }
  }

  const items: QuarantineItem[] = []
  tables.forEach((table, idx) => {
    for (const row of results[idx]) {
      items.push({
        id: row.id,
        table,
        nome: row.nome,
        status: row.status,
        deleted_at: row.deleted_at,
        deleted_by: row.deleted_by,
        deleted_by_name: row.deleted_by ? (nameMap.get(row.deleted_by) ?? null) : null,
        created_at: row.created_at,
      })
    }
  })

  // Mais recentes primeiro
  items.sort((a, b) => {
    const ta = a.deleted_at ? new Date(a.deleted_at).getTime() : 0
    const tb = b.deleted_at ? new Date(b.deleted_at).getTime() : 0
    return tb - ta
  })

  return items
}

/** Calcula quantos dias faltam para completar QUARANTINE_DAYS. */
export function daysRemaining(deletedAt: string | null): number {
  if (!deletedAt) return QUARANTINE_DAYS
  const deleted = new Date(deletedAt).getTime()
  const elapsedMs = Date.now() - deleted
  const elapsedDays = elapsedMs / (1000 * 60 * 60 * 24)
  return Math.max(0, Math.ceil(QUARANTINE_DAYS - elapsedDays))
}

/** True quando o item já está na quarentena há QUARANTINE_DAYS ou mais. */
export function isReadyForPermanentDeletion(deletedAt: string | null): boolean {
  return daysRemaining(deletedAt) <= 0
}
