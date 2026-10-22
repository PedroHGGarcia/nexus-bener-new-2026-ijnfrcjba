import { supabase } from '@/lib/supabase/client'
import type { ServiceResult } from '@/lib/utils'

export interface SendProposalEmailParams {
  propostaId: string
  emailTo?: string
  emails?: string[] | string
  event?: 'created' | 'status_changed'
  novoStatus?: string
  statusAnterior?: string
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function parseEmailsList(val: unknown): string[] {
  if (!val) return []
  if (Array.isArray(val)) {
    return val.flatMap((item) => parseEmailsList(item))
  }
  if (typeof val === 'string') {
    return val
      .split(/[,;\s\n\r]+/)
      .map((e) => e.trim().toLowerCase())
      .filter((e) => e.length > 0 && EMAIL_REGEX.test(e))
  }
  return []
}

export async function sendProposalEmail(params: SendProposalEmailParams): Promise<
  ServiceResult<{
    sent: boolean
    skipped?: boolean
    count?: number
    recipients?: string[]
    message?: string
    manager_copy?: {
      to: string
      gerente: string
      ok: boolean
      http_status: number | null
      resposta?: string
    } | null
    manager_copy_dispatched?: boolean
  }>
> {
  const combinedRaw: unknown[] = []
  if (params.emails) combinedRaw.push(params.emails)
  if (params.emailTo) combinedRaw.push(params.emailTo)

  const emailsArray = Array.from(new Set(parseEmailsList(combinedRaw)))
  const recipientsJoined = emailsArray.join(', ')

  const { data, error } = await supabase.functions.invoke('send-proposal-email', {
    body: {
      proposta_id: params.propostaId,
      to: recipientsJoined,
      email_to: recipientsJoined,
      emails: emailsArray,
      recipients: emailsArray,
      all_recipients: emailsArray,
      destinatarios: recipientsJoined,
      emails_notificacao: emailsArray,
      event: params.event || 'created',
      novo_status: params.novoStatus,
      status_anterior: params.statusAnterior,
    },
  })

  if (error) {
    return { ok: false, error: error.message }
  }

  if (data?.error) {
    return { ok: false, error: data.error }
  }

  const isSent = Boolean(
    data?.sent || data?.data?.sent || data?.data?.email_sent || data?.data?.webhook_success,
  )
  const isSkipped = Boolean(data?.skipped || data?.data?.skipped)

  return {
    ok: true,
    data: {
      sent: isSent,
      skipped: isSkipped,
      count: data?.data?.count ?? emailsArray.length,
      recipients: data?.data?.recipients ?? emailsArray,
      message: data?.data?.message || data?.data?.email_message,
      manager_copy: data?.data?.manager_copy ?? null,
      manager_copy_dispatched: data?.data?.manager_copy_dispatched ?? false,
    },
  }
}

export interface PropostaEmailEnvioRecord {
  id: string
  proposta_id: string | null
  destinatarios: string | null
  assunto: string | null
  webhook_url: string | null
  http_status: number | null
  ok: boolean | null
  resposta: string | null
  criado_em: string | null
}

export async function getPropostaEmailEnvios(
  propostaId: string,
): Promise<ServiceResult<PropostaEmailEnvioRecord[]>> {
  const { data, error } = await (supabase as any)
    .from('proposta_email_envios')
    .select('*')
    .eq('proposta_id', propostaId)
    .order('criado_em', { ascending: false })

  if (error) {
    return { ok: false, error: error.message }
  }

  return { ok: true, data: (data as PropostaEmailEnvioRecord[]) || [] }
}
