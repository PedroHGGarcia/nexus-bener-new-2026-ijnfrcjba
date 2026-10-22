import { supabase } from '@/lib/supabase/client'

interface BulkPriceUpdate {
  id: string
  valor: number
  valor_anterior: number
}

export async function applyBulkPriceChanges(
  updates: BulkPriceUpdate[],
  userId: string,
  userName: string,
): Promise<{ updated: number; error: string | null }> {
  let count = 0
  const today = new Date().toISOString()

  for (const update of updates) {
    const { error: updateError } = await supabase
      .from('versoes')
      .update({
        valor: update.valor,
        valor_anterior: update.valor_anterior,
        data_ultimo_reajuste: today,
        atualizado_por: userName,
      })
      .eq('id', update.id)

    if (updateError) continue

    await supabase.from('audit_logs').insert({
      action: 'update',
      table_name: 'versoes',
      record_id: update.id,
      user_id: userId,
      user_name: userName,
      data_changes: {
        valor: { before: update.valor_anterior, after: update.valor },
      },
    })

    // Registrar no registro_alteracoes de catálogo com identificação do usuário
    await supabase.from('registro_alteracoes').insert({
      entidade: 'versoes',
      registro_id: update.id,
      registro_nome: `Versão ID ${update.id.slice(0, 8)}`,
      acao: 'editado',
      usuario_id: userId,
      usuario_nome: userName,
      dados_anteriores: { valor: update.valor_anterior },
      dados_novos: { valor: update.valor },
      campos_alterados: [
        {
          campo: 'valor',
          de: update.valor_anterior,
          para: update.valor,
        },
      ],
      detalhes: 'Reajuste de preço em lote',
    })

    count++
  }

  return { updated: count, error: null }
}
