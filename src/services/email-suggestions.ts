import { supabase } from '@/lib/supabase/client'
import type { ServiceResult } from '@/lib/utils'

export async function generateEmailSuggestion(data: {
  assunto: string
  destinatario: string
  contexto?: string
}): Promise<ServiceResult<{ suggestion: string | null }>> {
  try {
    const { data: result, error } = await supabase.functions.invoke('ai-suggestions', {
      body: {
        nome: data.assunto,
        tipo: 'email',
        valor: 0,
        moeda: 'BRL',
        contexto: data.contexto,
      },
    })
    if (error) return { ok: false, error: error.message }
    return { ok: true, data: { suggestion: result?.especificacoes ?? null } }
  } catch {
    return { ok: false, error: 'Falha ao gerar sugestão de e-mail.' }
  }
}

export async function generateNotificationEmail(data: {
  titulo: string
  mensagem: string
}): Promise<ServiceResult<{ subject: string; body: string | null }>> {
  try {
    const { data: result, error } = await supabase.functions.invoke('ai-suggestions', {
      body: {
        nome: data.titulo,
        tipo: 'notificacao',
        valor: 0,
        moeda: 'BRL',
      },
    })
    if (error) return { ok: false, error: error.message }
    return {
      ok: true,
      data: {
        subject: data.titulo,
        body: result?.especificacoes ?? data.mensagem,
      },
    }
  } catch {
    return { ok: false, error: 'Falha ao gerar e-mail de notificação.' }
  }
}
