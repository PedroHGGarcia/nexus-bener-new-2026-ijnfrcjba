import { supabase } from '@/lib/supabase/client'
import type { ServiceResult } from '@/lib/utils'
import { sendProposalEmail } from '@/services/proposal-email'
import type { PropostaWithRelations } from '@/types/proposta'

export const N8N_PROPOSAL_WEBHOOK_URL_DEFAULT =
  'https://bener.app.n8n.cloud/webhook/a6c860a9-1dcd-469c-addd-1b249d627dfa'

/**
 * Retorna a URL do webhook n8n de propostas.
 * Prioriza variável de ambiente VITE_N8N_PROPOSAL_WEBHOOK_URL se definida,
 * caindo para a URL padrão já conectada ao n8n da Bener.
 */
export function getProposalWebhookUrl(): string {
  const envUrl = (import.meta.env.VITE_N8N_PROPOSAL_WEBHOOK_URL as string) || ''
  return envUrl.trim() || N8N_PROPOSAL_WEBHOOK_URL_DEFAULT
}

export interface NormalizePhoneResult {
  ok: boolean
  e164?: string
  error?: string
  ddd?: string
  numero?: string
}

/**
 * Normaliza e valida celular brasileiro para o formato internacional E.164 (ex.: 5519995175261).
 * Regras:
 * - DDI 55 (Brasil)
 * - DDD entre 11 e 99 (2 dígitos)
 * - Celular com 9 dígitos iniciando obrigatoriamente com 9
 * - Remove qualquer pontuação ou caracter não-numérico
 * - Retorna mensagens amigáveis em português claro.
 */
export function normalizePhoneToE164(raw: string | null | undefined): NormalizePhoneResult {
  if (!raw || !raw.trim()) {
    return { ok: false, error: 'Número de telefone não informado.' }
  }

  // Remove tudo que não for dígito
  let digits = raw.replace(/\D/g, '')

  // Remove zero à esquerda no DDD se houver (ex.: 019995175261 -> 19995175261)
  if (digits.startsWith('0') && digits.length >= 12) {
    digits = digits.slice(1)
  }

  // Se já vier com DDI 55
  if (digits.startsWith('55') && (digits.length === 13 || digits.length === 12)) {
    // 55 + DDD (2) + 9 dígitos = 13 dígitos
    if (digits.length === 13) {
      const ddd = digits.slice(2, 4)
      const nonoDigito = digits.slice(4, 5)
      const dddNum = parseInt(ddd, 10)
      if (dddNum < 11 || dddNum > 99) {
        return { ok: false, error: `DDD inválido (${ddd}). Deve estar entre 11 e 99.` }
      }
      if (nonoDigito !== '9') {
        return {
          ok: false,
          error: 'Número de celular inválido. O celular deve iniciar com o dígito 9.',
        }
      }
      return {
        ok: true,
        e164: digits,
        ddd,
        numero: digits.slice(4),
      }
    }
    // 55 + DDD (2) + 8 dígitos = fixo ou celular antigo sem nono dígito
    return {
      ok: false,
      error:
        'O número possui apenas 8 dígitos após o DDD. O WhatsApp exige o 9º dígito (9XXXX-XXXX).',
    }
  }

  // Se vier sem DDI: esperado 11 dígitos (DDD + 9 dígitos)
  if (digits.length === 11) {
    const ddd = digits.slice(0, 2)
    const nonoDigito = digits.slice(2, 3)
    const dddNum = parseInt(ddd, 10)
    if (dddNum < 11 || dddNum > 99) {
      return { ok: false, error: `DDD inválido (${ddd}). Deve estar entre 11 e 99.` }
    }
    if (nonoDigito !== '9') {
      return {
        ok: false,
        error: 'Número de celular inválido. O celular deve iniciar com o dígito 9.',
      }
    }
    return {
      ok: true,
      e164: `55${digits}`,
      ddd,
      numero: digits.slice(2),
    }
  }

  if (digits.length === 10) {
    return {
      ok: false,
      error:
        'Telefone fixo identificado (10 dígitos). O WhatsApp requer celular com o 9º dígito (ex.: (19) 99517-5261).',
    }
  }

  if (digits.length < 10) {
    return {
      ok: false,
      error: 'Número incompleto. Informe DDD + número do celular com 9 dígitos.',
    }
  }

  return {
    ok: false,
    error: 'Formato de número inválido. Use o padrão (DD) 9XXXX-XXXX.',
  }
}

export interface ClientPhoneCandidate {
  celular: string | null
  e164: string | null
  nomeContato: string | null
  origem:
    | 'cliente_celular'
    | 'contato_principal'
    | 'contato_adicional'
    | 'proposta_telefone'
    | 'nenhum'
  labelOrigem: string
}

/**
 * Busca o melhor número de WhatsApp/celular para uma proposta:
 * 1. public.clientes.celular
 * 2. public.cliente_contatos (is_principal = true)
 * 3. Qualquer outro contato em public.cliente_contatos com telefone de celular
 * 4. proposal.telefone (se for celular)
 */
export async function resolveProposalClientPhone(
  proposta: PropostaWithRelations,
): Promise<ClientPhoneCandidate> {
  const clienteId = proposta.cliente || (proposta.clientes as any)?.id

  // 1. Verificar celular do cliente se tiver clienteId
  if (clienteId) {
    try {
      const { data: cliente } = await supabase
        .from('clientes')
        .select('celular, telefone, contato, fantasia, razao_social')
        .eq('id', clienteId)
        .maybeSingle()

      if (cliente?.celular) {
        const norm = normalizePhoneToE164(cliente.celular)
        if (norm.ok && norm.e164) {
          return {
            celular: cliente.celular,
            e164: norm.e164,
            nomeContato: cliente.contato || cliente.fantasia || cliente.razao_social || 'Cliente',
            origem: 'cliente_celular',
            labelOrigem: 'Celular cadastrado no Cliente',
          }
        }
      }

      // 2. Buscar contatos vinculados
      const { data: contatos } = await supabase
        .from('cliente_contatos')
        .select('nome, telefone, is_principal')
        .eq('cliente_id', clienteId)
        .order('is_principal', { ascending: false })

      if (contatos && contatos.length > 0) {
        for (const c of contatos) {
          if (c.telefone) {
            const norm = normalizePhoneToE164(c.telefone)
            if (norm.ok && norm.e164) {
              return {
                celular: c.telefone,
                e164: norm.e164,
                nomeContato: c.nome,
                origem: c.is_principal ? 'contato_principal' : 'contato_adicional',
                labelOrigem: c.is_principal
                  ? `Contato Principal (${c.nome})`
                  : `Contato Adicional (${c.nome})`,
              }
            }
          }
        }
      }

      // Se cliente.telefone for celular (muitas bases salvam no campo telefone)
      if (cliente?.telefone) {
        const norm = normalizePhoneToE164(cliente.telefone)
        if (norm.ok && norm.e164) {
          return {
            celular: cliente.telefone,
            e164: norm.e164,
            nomeContato: cliente.contato || cliente.fantasia || 'Cliente',
            origem: 'cliente_celular',
            labelOrigem: 'Telefone do Cliente (celular detectado)',
          }
        }
      }
    } catch (err) {
      console.warn('[resolveProposalClientPhone] Erro ao buscar contatos do cliente:', err)
    }
  }

  // 3. Fallback: telefone registrado diretamente na proposta
  if (proposta.telefone) {
    const norm = normalizePhoneToE164(proposta.telefone)
    if (norm.ok && norm.e164) {
      return {
        celular: proposta.telefone,
        e164: norm.e164,
        nomeContato: proposta.contato || proposta.cliente_original || 'Cliente',
        origem: 'proposta_telefone',
        labelOrigem: 'Telefone da Proposta',
      }
    }
  }

  return {
    celular: null,
    e164: null,
    nomeContato: proposta.contato || proposta.cliente_original || null,
    origem: 'nenhum',
    labelOrigem: 'Nenhum celular cadastrado',
  }
}

export function buildDefaultWhatsAppMessage(params: {
  contatoNome?: string | null
  numeroProposta?: string | null
  linkProposta: string
}): string {
  const nome = (params.contatoNome || '').trim() || 'Cliente'
  const numero = (params.numeroProposta || '').trim() || 'comercial'
  const link = params.linkProposta.trim()

  return `Olá ${nome}, a proposta ${numero} da Bener Máquinas está disponível: ${link}`
}

export type NotificationChannel = 'whatsapp' | 'email' | 'ambos'

export interface SendProposalNotificationParams {
  proposta: PropostaWithRelations
  canal: NotificationChannel
  whatsapp?: {
    numero_e164: string
    contato_nome?: string
    mensagem: string
  }
  email?: {
    destinatarios: string[]
  }
}

export interface ProposalNotificationResult {
  ok: boolean
  canal: NotificationChannel
  emailResult?: {
    sent: boolean
    skipped?: boolean
    error?: string
    recipients?: string[]
  }
  whatsappResult?: {
    ok: boolean
    http_status?: number | null
    resposta?: string
    error?: string
    e164?: string
  }
  error?: string
}

/**
 * Envia notificação da proposta por E-mail, WhatsApp ou Ambos.
 * Para WhatsApp: dispara webhook n8n com payload estruturado (canal: "whatsapp" | "ambos")
 * e registra auditoria em public.proposta_email_envios com destinatarios: "WhatsApp: <e164>".
 * Para E-mail: chama a função sendProposalEmail já existente (edge function).
 */
export async function sendProposalNotification(
  params: SendProposalNotificationParams,
): Promise<ServiceResult<ProposalNotificationResult>> {
  const { proposta, canal, whatsapp, email } = params
  const webhookUrl = getProposalWebhookUrl()

  const tokenOrId = proposta.public_token || proposta.id
  const linkProposta = `${window.location.origin}/visualizar-proposta/${tokenOrId}`
  const numeroProposta = proposta.numero_proposta || proposta.id
  const clienteNome =
    proposta.clientes?.fantasia ||
    proposta.clientes?.razao_social ||
    proposta.cliente_original ||
    'Cliente'

  let emailSentOk = false
  let emailSkipped = false
  let emailErrorMsg: string | undefined
  let emailRecipients: string[] = []

  let whatsappSentOk = false
  let whatsappHttpStatus: number | null = null
  let whatsappResponseBody = ''
  let whatsappErrorMsg: string | undefined

  // 1. Processar envio por e-mail se canal for "email" ou "ambos"
  if (canal === 'email' || canal === 'ambos') {
    const emailsList =
      email?.destinatarios && email.destinatarios.length > 0
        ? email.destinatarios
        : proposta.emails_notificacao
          ? proposta.emails_notificacao
              .split(/[,;\s\n\r]+/)
              .map((e) => e.trim().toLowerCase())
              .filter((e) => e && e.includes('@'))
          : []

    if (emailsList.length === 0) {
      emailSkipped = true
      emailErrorMsg = 'Nenhum e-mail informado para envio.'
    } else {
      try {
        const res = await sendProposalEmail({
          propostaId: proposta.id,
          emails: emailsList,
          event: 'created',
        })
        if (res.ok) {
          emailSentOk = Boolean(res.data.sent)
          emailSkipped = Boolean(res.data.skipped)
          emailRecipients = res.data.recipients || emailsList
        } else if ('error' in res) {
          emailErrorMsg = res.error || 'Falha no envio de e-mail.'
        } else {
          emailErrorMsg = 'Falha no envio de e-mail.'
        }
      } catch (e) {
        emailErrorMsg = e instanceof Error ? e.message : 'Erro no envio de e-mail.'
      }
    }
  }

  // 2. Processar envio por WhatsApp se canal for "whatsapp" ou "ambos"
  if (canal === 'whatsapp' || canal === 'ambos') {
    if (!whatsapp?.numero_e164) {
      whatsappErrorMsg = 'Número de WhatsApp E.164 não informado.'
    } else {
      const e164 = whatsapp.numero_e164.trim()
      const contatoNome = (whatsapp.contato_nome || clienteNome || 'Cliente').trim()
      const mensagem = (whatsapp.mensagem || '').trim()

      const payload = {
        canal,
        event: 'proposta_notificacao',
        evento: 'proposta_notificacao',
        proposta_id: proposta.id,
        numero_proposta: numeroProposta,
        cliente_nome: clienteNome,
        link_proposta: linkProposta,
        valor_final: proposta.valor_final,
        moeda: proposta.moeda || 'BRL',
        status: proposta.status,
        whatsapp: {
          numero_e164: e164,
          contato_nome: contatoNome,
          mensagem,
        },
        dados_proposta: {
          id: proposta.id,
          numero: numeroProposta,
          revisao: proposta.revisao,
          cliente: clienteNome,
          valor: proposta.valor_final,
          moeda: proposta.moeda || 'BRL',
          link: linkProposta,
          criado_em: proposta.created_at,
          representante:
            proposta.nome_representante_comercial ||
            proposta.representantes?.fantasia ||
            proposta.representante_original ||
            null,
        },
      }

      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 15000)

        const response = await fetch(webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        })
        clearTimeout(timeoutId)

        whatsappHttpStatus = response.status
        whatsappSentOk = response.ok

        try {
          const respText = await response.text()
          whatsappResponseBody = respText.slice(0, 1000)
        } catch {
          whatsappResponseBody = ''
        }

        if (!response.ok) {
          whatsappErrorMsg = `Webhook retornou status ${response.status}.`
        }
      } catch (fetchErr) {
        whatsappSentOk = false
        whatsappErrorMsg =
          fetchErr instanceof Error
            ? fetchErr.name === 'AbortError'
              ? 'Timeout de 15s ao chamar webhook de WhatsApp.'
              : fetchErr.message
            : 'Erro ao conectar ao webhook n8n.'
        whatsappResponseBody = whatsappErrorMsg
      }

      // 3. Registrar auditoria em public.proposta_email_envios
      try {
        await supabase.from('proposta_email_envios').insert({
          proposta_id: proposta.id,
          destinatarios: `WhatsApp: ${e164}`,
          assunto: `Notificação WhatsApp — Proposta nº ${numeroProposta}`,
          webhook_url: webhookUrl,
          http_status: whatsappHttpStatus,
          ok: whatsappSentOk,
          resposta: whatsappResponseBody || (whatsappSentOk ? 'Enviado via n8n' : whatsappErrorMsg),
        })
      } catch (auditErr) {
        console.warn(
          '[sendProposalNotification] Erro ao gravar auditoria do WhatsApp em proposta_email_envios:',
          auditErr,
        )
      }
    }
  }

  // 4. Determinar sucesso global da operação
  let overallOk = false
  if (canal === 'email') {
    overallOk = emailSentOk && !emailErrorMsg
  } else if (canal === 'whatsapp') {
    overallOk = whatsappSentOk
  } else if (canal === 'ambos') {
    overallOk = emailSentOk || whatsappSentOk
  }

  const combinedError = !overallOk
    ? canal === 'ambos'
      ? `Falhas: ${emailErrorMsg || ''} ${whatsappErrorMsg || ''}`.trim() ||
        'Falha no envio por e-mail e WhatsApp.'
      : canal === 'whatsapp'
        ? whatsappErrorMsg || 'Falha no envio por WhatsApp.'
        : emailErrorMsg || 'Falha no envio por e-mail.'
    : undefined

  const resultData: ProposalNotificationResult = {
    ok: overallOk,
    canal,
    emailResult:
      canal === 'email' || canal === 'ambos'
        ? {
            sent: emailSentOk,
            skipped: emailSkipped,
            error: emailErrorMsg,
            recipients: emailRecipients,
          }
        : undefined,
    whatsappResult:
      canal === 'whatsapp' || canal === 'ambos'
        ? {
            ok: whatsappSentOk,
            http_status: whatsappHttpStatus,
            resposta: whatsappResponseBody,
            error: whatsappErrorMsg,
            e164: whatsapp?.numero_e164,
          }
        : undefined,
    error: combinedError,
  }

  if (overallOk) {
    return {
      ok: true,
      data: resultData,
    }
  }

  return {
    ok: false,
    error: combinedError || 'Falha no envio da notificação.',
  }
}
