import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { getCorsHeaders } from '../_shared/cors.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { requireUser } from '../_shared/auth.ts'
import {
  buildProposalNotificationEmail,
  buildManagerCopyNotificationEmail,
} from '../_shared/email-templates.ts'
import {
  OFFICIAL_NEXUS_LOGO_BASE64,
  OFFICIAL_BENER_LOGO_BASE64,
} from '../_shared/official-logos.ts'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function splitAndValidateEmails(val: unknown): string[] {
  if (!val) return []
  if (Array.isArray(val)) {
    return val.flatMap((item) => splitAndValidateEmails(item))
  }
  if (typeof val === 'string') {
    return val
      .split(/[,;\s\n\r]+/)
      .map((e) => e.trim().toLowerCase())
      .filter((e) => e.length > 0 && EMAIL_REGEX.test(e))
  }
  return []
}

Deno.serve(async (req: Request) => {
  const cors = getCorsHeaders(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  // C5: Authenticate caller: require JWT or internal service secret
  const internalSecret = Deno.env.get('INTERNAL_SERVICE_SECRET')
  const incomingSecret = req.headers.get('x-internal-service-secret')

  let callerUserId: string | null = null
  let callerEmail: string | null = null

  if (internalSecret && incomingSecret === internalSecret) {
    callerEmail = 'internal_service'
  } else {
    try {
      const { user } = await requireUser(req)
      callerUserId = user.id
      callerEmail = user.email || null
    } catch (authResp) {
      if (authResp instanceof Response) return authResp
      return new Response(JSON.stringify({ error: 'Autenticação necessária.' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...cors },
      })
    }
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  const N8N_PROPOSAL_WEBHOOK_URL =
    Deno.env.get('N8N_PROPOSAL_WEBHOOK_URL') || Deno.env.get('N8N_WEBHOOK_URL')

  if (!N8N_PROPOSAL_WEBHOOK_URL) {
    console.error('[send-proposal-email] N8N_PROPOSAL_WEBHOOK_URL secret missing')
    return new Response(
      JSON.stringify({
        error: 'Serviço de envio de e-mails não configurado (N8N_PROPOSAL_WEBHOOK_URL ausente).',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...cors },
      },
    )
  }

  let adminClient: any = null
  if (SUPABASE_URL && SERVICE_KEY) {
    try {
      adminClient = createClient(SUPABASE_URL, SERVICE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
    } catch (clientErr) {
      console.warn('[send-proposal-email] Failed to initialize adminClient:', clientErr)
    }
  }

  // Parse body safely
  let body: Record<string, any> = {}
  try {
    body = await req.json()
  } catch {
    body = {}
  }

  const {
    proposta_id,
    email_to,
    to,
    emails,
    all_recipients,
    auto_triggered,
    destinatarios,
    emails_notificacao,
    recipients: bodyRecipients,
    event = 'created',
    evento,
    novo_status,
    status_anterior,
  } = body

  if (!proposta_id) {
    return new Response(JSON.stringify({ error: 'proposta_id é obrigatório.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...cors },
    })
  }

  const resolvedEvent =
    evento === 'mudanca_status' || evento === 'status_changed' || event === 'status_changed'
      ? 'status_changed'
      : 'created'
  const eventName = resolvedEvent

  // 1. Idempotency: skip if n8n webhook was already successfully triggered for this proposal + event within last 60s
  const actionName =
    eventName === 'status_changed' ? 'PROPOSAL_STATUS_EMAIL_SENT' : 'PROPOSAL_EMAIL_SENT'

  if (adminClient) {
    try {
      const { data: recentAudits } = await adminClient
        .from('audit_logs')
        .select('id, data_changes, created_at, action')
        .eq('action', actionName)
        .eq('record_id', String(proposta_id))
        .order('created_at', { ascending: false })
        .limit(5)

      if (recentAudits && recentAudits.length > 0) {
        const matched = recentAudits.find((audit: any) => {
          const changes = (audit.data_changes || {}) as Record<string, unknown>
          const isSuccess =
            changes.webhook_success === true ||
            changes.status === 'success' ||
            changes.sent === true
          if (!isSuccess) return false

          const ageMs = Date.now() - new Date(audit.created_at).getTime()
          if (ageMs < 0 || ageMs > 60000) return false

          if (eventName === 'status_changed') {
            return changes.novo_status === novo_status
          }
          return true
        })

        if (matched) {
          return new Response(
            JSON.stringify({
              sent: true,
              skipped: true,
              data: {
                sent: true,
                skipped: true,
                webhook_success: true,
                message: `Notificação (${eventName}) disparada recentemente para esta proposta (idempotência 60s).`,
                count: 0,
                recipients: [],
              },
            }),
            {
              headers: {
                'Content-Type': 'application/json',
                Connection: 'keep-alive',
                ...cors,
              },
            },
          )
        }
      }
    } catch (idempErr) {
      console.warn('[send-proposal-email] Idempotency check error (continuing send):', idempErr)
    }
  }

  // 2. Fetch proposal data
  let proposal: any = null
  if (adminClient) {
    try {
      // Small sleep if pdf_anexo is not yet saved to give generate-proposal-pdf a split second
      // when both promises fire closely
      const { data, error } = await adminClient
        .from('propostas')
        .select(
          'id, numero_proposta, revisao, cliente, contato_id, modelo_licitacao, descricao_proposta, especificacoes_tecnicas, materiais_utilizados, certificacoes, normas_aplicaveis, certificacoes_seguranca, normas_seguranca, cobertura_garantia, assistencia_tecnica_detalhada, criterios_aceitacao, garantia_acessorios, validade_oferta, secoes_adicionais, contato, telefone, versao, representante, gerente, moeda, valor_sem_desconto, percentual_desconto, valor_atual, valor_final, prazo_entrega, condicoes_pagamento, acessorios_proposta, cliente_original, versao_original, representante_original, gerente_original, nota_rep, dt_cad, user, tipo_proposta, projeto, status, data_alteracao_status, ultimo_usuario_status, assinatura_cliente, assinatura_representante, emails_notificacao, assinatura_gerente_produto, assinatura_assessor_tecnico, nome_gerente_produto, nome_assessor_tecnico, nome_representante_comercial, versoes_comparacao, pdf_anexo, created_at, updated_at, transporte_seguro, imposto_ipi, imposto_icms, campos_adicionais, is_pacote, estado_faturamento, regime_preco, cambio_estimado, cambio_estimado_data, cambio_estimado_base, assinante_representante_id, assinante_gerente_id, assinado_por_representante, assinado_por_gerente, data_assinatura_representante, data_assinatura_gerente, clientes:cliente(fantasia, razao_social, documento, contato, email, telefone, cep, estado, cidade, bairro, logradouro, numero, complementos), cliente_contatos:contato_id(id, nome, cargo, email, telefone, is_principal), versoes:versao(id, nome, cod_erp, nome_abreviado, imagem_preview, moeda, valor, especificacoes_tecnicas, caracteristicas_construtivas, acessorios_standards, modelos(id, nome, marcas(id, nome), produtos(id, nome, categorias_produtos:categorias(id, nome)))), representantes:representante(id, fantasia, razao_social, documento, telefone_principal, telefones, emails), gerentes:gerente(id, nome, email, cargo, celular)',
        )
        .eq('id', proposta_id)
        .maybeSingle()

      if (error) {
        console.warn('[send-proposal-email] Proposal fetch error:', error)
      } else {
        proposal = data
      }
    } catch (fetchErr) {
      console.warn('[send-proposal-email] Exception fetching proposal:', fetchErr)
    }
  }

  // If proposal record couldn't be loaded, build minimal synthetic object from request
  if (!proposal) {
    proposal = {
      id: proposta_id,
      numero_proposta: body.numero_proposta || String(proposta_id),
      valor_final: body.valor_final || 0,
      moeda: body.moeda || 'BRL',
      status: body.novo_status || 'Em Analise',
      emails_notificacao: body.emails_notificacao || '',
    }
  }

  // 3. Fetch proposal items (multi-version) safely
  let proposalItems: any[] = []
  if (adminClient) {
    try {
      const { data: pvItems, error: pvErr } = await adminClient
        .from('proposta_versoes')
        .select(
          'id, quantidade, valor_unitario, desconto_percentual, desconto_valor, ordem, versoes(id, nome, cod_erp, nome_abreviado, imagem_preview, moeda, valor, especificacoes_tecnicas, caracteristicas_construtivas, acessorios_standards, modelos(id, nome, marcas(id, nome), produtos(id, nome, categorias_produtos:categorias(id, nome))))',
        )
        .eq('proposta_id', proposta_id)
        .order('ordem', { ascending: true })

      if (!pvErr && pvItems && pvItems.length > 0) {
        proposalItems = pvItems.map((item: any) => {
          const v = item.versoes
          const subtotal = (item.quantidade || 1) * (item.valor_unitario || 0)
          let total = subtotal
          if ((item.desconto_valor || 0) > 0) {
            total = Math.max(0, subtotal - (item.desconto_valor || 0))
          } else if ((item.desconto_percentual || 0) > 0) {
            total = subtotal * (1 - (item.desconto_percentual || 0) / 100)
          }
          return {
            id: item.id,
            versao_id: v?.id || null,
            nome: v?.nome || v?.nome_abreviado || 'Equipamento',
            cod_erp: v?.cod_erp || '',
            nome_abreviado: v?.nome_abreviado || '',
            imagem_preview: v?.imagem_preview || '',
            quantidade: item.quantidade || 1,
            valor_unitario: item.valor_unitario || 0,
            desconto_percentual: item.desconto_percentual || 0,
            desconto_valor: item.desconto_valor || 0,
            valor_total: total,
            especificacoes_tecnicas: v?.especificacoes_tecnicas || '',
            caracteristicas_construtivas: v?.caracteristicas_construtivas || '',
            acessorios_standards: v?.acessorios_standards || '',
            marca: v?.modelos?.marcas?.nome || '',
            modelo: v?.modelos?.nome || '',
            produto: v?.modelos?.produtos?.nome || '',
            categoria: v?.modelos?.produtos?.categorias_produtos?.nome || '',
          }
        })
      }
    } catch (pvCatch) {
      console.warn('[send-proposal-email] Error fetching proposta_versoes:', pvCatch)
    }
  }

  if (proposalItems.length === 0) {
    if (proposal.versoes?.nome || proposal.versao_original) {
      proposalItems = [
        {
          id: null,
          versao_id: proposal.versao || null,
          nome: proposal.versoes?.nome || proposal.versao_original,
          cod_erp: proposal.versoes?.cod_erp || '',
          nome_abreviado: proposal.versoes?.nome_abreviado || '',
          imagem_preview: proposal.versoes?.imagem_preview || '',
          quantidade: 1,
          valor_unitario: proposal.valor_sem_desconto || proposal.valor_final || 0,
          desconto_percentual: proposal.percentual_desconto || 0,
          desconto_valor: 0,
          valor_total: proposal.valor_final || 0,
          especificacoes_tecnicas:
            proposal.versoes?.especificacoes_tecnicas || proposal.especificacoes_tecnicas || '',
          caracteristicas_construtivas: proposal.versoes?.caracteristicas_construtivas || '',
          acessorios_standards: proposal.versoes?.acessorios_standards || '',
          marca: proposal.versoes?.modelos?.marcas?.nome || '',
          modelo: proposal.versoes?.modelos?.nome || '',
          produto: proposal.versoes?.modelos?.produtos?.nome || '',
          categoria: proposal.versoes?.modelos?.produtos?.categorias_produtos?.nome || '',
        },
      ]
    }
  }

  // 4. Resolve client / seller / gerente fields safely
  let clientName = 'Não informado'
  if (proposal.clientes && (proposal.clientes.razao_social || proposal.clientes.fantasia)) {
    clientName = proposal.clientes.razao_social || proposal.clientes.fantasia
  } else if (proposal.cliente_original) {
    clientName = proposal.cliente_original
  }

  const linkedContact = proposal.cliente_contatos || null
  const contactName = linkedContact?.nome || proposal.contato || proposal.clientes?.contato || ''
  const contactCargo = linkedContact?.cargo || ''
  const contactEmail = linkedContact?.email || proposal.clientes?.email || ''
  const contactPhone =
    linkedContact?.telefone || proposal.telefone || proposal.clientes?.telefone || ''

  const clientContact = contactName
  const clientEmail = proposal.clientes?.email || ''
  const clientPhone = proposal.clientes?.telefone || proposal.telefone || ''
  const clientDoc = proposal.clientes?.documento || ''
  const clientAddress = [
    proposal.clientes?.logradouro,
    proposal.clientes?.numero,
    proposal.clientes?.complementos,
    proposal.clientes?.bairro,
    proposal.clientes?.cidade,
    proposal.clientes?.estado,
  ]
    .filter(Boolean)
    .join(', ')
  const clientCep = proposal.clientes?.cep || ''

  const repName =
    proposal.nome_representante_comercial ||
    proposal.representantes?.fantasia ||
    proposal.representantes?.razao_social ||
    proposal.representante_original ||
    ''
  const repEmail = Array.isArray(proposal.representantes?.emails)
    ? proposal.representantes?.emails[0]
    : ''
  const repPhone =
    proposal.representantes?.telefone_principal ||
    (Array.isArray(proposal.representantes?.telefones) ? proposal.representantes?.telefones[0] : '')

  const gerenteName =
    proposal.nome_gerente_produto || proposal.gerentes?.nome || proposal.gerente_original || ''
  const gerenteEmail = proposal.gerentes?.email || ''
  const gerentePhone = proposal.gerentes?.celular || ''

  // 5. Gather recipients strictly from explicitly provided notification emails.
  // Rule: O cliente NUNCA recebe automaticamente o envio da proposta.
  // Apenas e-mails explicitamente preenchidos no campo de notificação da proposta recebem o envio.
  // Se esse campo estiver vazio, NENHUM e-mail de proposta é disparado (não há fallback para o e-mail do cliente).
  const candidateInputs = [
    bodyRecipients,
    emails,
    destinatarios,
    emails_notificacao,
    all_recipients,
    to,
    email_to,
    proposal.emails_notificacao,
  ]

  const rawRecipients: string[] = []
  for (const input of candidateInputs) {
    const parsed = splitAndValidateEmails(input)
    if (parsed.length > 0) {
      rawRecipients.push(...parsed)
    }
  }

  // NOTE: clientEmail fallback has been completely removed per user requirement:
  // "O cliente nunca recebe automaticamente o envio da proposta, somente se eu especificar o e-mail no campo de notificação que já existe. Remova o envio automatico para o cliente."
  const recipients = Array.from(new Set(rawRecipients))
  const recipientsJoined = recipients.join(', ')
  const firstRecipient = recipients[0] || ''

  const proposalNum = proposal.numero_proposta || String(proposta_id)
  const valorFinal = proposal.valor_final || 0
  const moeda = proposal.moeda || 'BRL'

  // 6. Load official logo bytes (never throws, always falls back to bundled base64)
  let nexusLogoBase64 = OFFICIAL_NEXUS_LOGO_BASE64
  let benerLogoBase64 = OFFICIAL_BENER_LOGO_BASE64

  try {
    if (adminClient?.storage) {
      const { data: existingLogos } = await adminClient.storage
        .from('public')
        .list('logos', { limit: 10 })
      const hasNexus = existingLogos?.some(
        (obj: any) =>
          obj.name === 'nexus-logo.png' && (obj.metadata as any)?.mimetype === 'image/png',
      )
      const hasBener = existingLogos?.some(
        (obj: any) =>
          obj.name === 'bener-logo.png' && (obj.metadata as any)?.mimetype === 'image/png',
      )

      if (hasNexus && hasBener) {
        try {
          const [nexusBlobRes, benerBlobRes] = await Promise.all([
            adminClient.storage.from('public').download('logos/nexus-logo.png'),
            adminClient.storage.from('public').download('logos/bener-logo.png'),
          ])
          if (nexusBlobRes.data && benerBlobRes.data) {
            const nexusBuf = new Uint8Array(await nexusBlobRes.data.arrayBuffer())
            const benerBuf = new Uint8Array(await benerBlobRes.data.arrayBuffer())
            if (nexusBuf.length > 500 && benerBuf.length > 500) {
              const toBase64 = (u8: Uint8Array) => {
                let binary = ''
                const len = u8.byteLength
                for (let i = 0; i < len; i++) {
                  binary += String.fromCharCode(u8[i])
                }
                return btoa(binary)
              }
              nexusLogoBase64 = toBase64(nexusBuf)
              benerLogoBase64 = toBase64(benerBuf)
            }
          }
        } catch (dlErr) {
          console.warn('[send-proposal-email] Fallback to official-logos.ts constant:', dlErr)
        }
      }
    }
  } catch (seedErr) {
    console.warn(
      '[send-proposal-email] Logo auto-seed check warning (using bundled logos):',
      seedErr,
    )
  }

  const appBaseUrl =
    Deno.env.get('APP_BASE_URL') || Deno.env.get('PUBLIC_APP_URL') || 'https://nexus.bener.com.br'
  const createdAt = proposal.created_at || proposal.dt_cad || new Date().toISOString()
  const effectiveToken = proposal.public_token || proposta_id
  const publicProposalUrl = `${appBaseUrl}/visualizar-proposta/${effectiveToken}`
  const appProposalUrl = `${appBaseUrl}/controle-propostas/proposta-pdf/${proposta_id}`

  // Ensure link_publico_RD is stored / updated on the proposal record (non-blocking)
  if (adminClient) {
    try {
      await adminClient
        .from('propostas')
        .update({ link_publico_RD: publicProposalUrl })
        .eq('id', proposta_id)
    } catch (updateErr) {
      console.warn(
        '[send-proposal-email] Failed to update link_publico_RD on propostas (non-fatal):',
        updateErr,
      )
    }
  }

  const finalNovoStatus = novo_status || proposal.status || 'Em Analise'
  const finalOldStatus = status_anterior || undefined

  const primaryEquipment = proposalItems[0] || {}
  const machineImage = primaryEquipment.imagem_preview || proposal.versoes?.imagem_preview || ''
  const machineTitle =
    primaryEquipment.nome || proposal.versoes?.nome || proposal.versao_original || ''

  const emailSubject =
    eventName === 'status_changed'
      ? `Atualização da Proposta nº ${proposalNum} — ${finalNovoStatus}`
      : `Nova proposta recebida — Proposta nº ${proposalNum}`

  // Build email HTML safely
  let emailHtml = ''
  let emailHtmlRemote = ''
  try {
    emailHtml =
      buildProposalNotificationEmail(
        proposalNum,
        clientName,
        valorFinal,
        moeda,
        publicProposalUrl,
        Boolean(proposal.modelo_licitacao),
        eventName,
        finalNovoStatus,
        finalOldStatus,
        repName,
        repEmail,
        machineTitle,
        true, // inlineCid
      ) ?? ''
    emailHtmlRemote =
      buildProposalNotificationEmail(
        proposalNum,
        clientName,
        valorFinal,
        moeda,
        publicProposalUrl,
        Boolean(proposal.modelo_licitacao),
        eventName,
        finalNovoStatus,
        finalOldStatus,
        repName,
        repEmail,
        machineTitle,
        false, // remote URLs
      ) ?? ''
  } catch (htmlErr) {
    console.warn('[send-proposal-email] Error building email HTML, using simple fallback:', htmlErr)
    const fallbackText = `Proposta nº ${proposalNum} - Cliente: ${clientName} - Valor: ${moeda} ${valorFinal}`
    emailHtml = `<div><h2>${emailSubject}</h2><p>${fallbackText}</p><p><a href="${publicProposalUrl}">Visualizar Proposta</a></p></div>`
    emailHtmlRemote = emailHtml
  }

  // Garantir que emailHtml NUNCA seja nulo ou undefined
  emailHtml = (emailHtml || emailHtmlRemote || '').trim()
  if (!emailHtml) {
    emailHtml = `<div><h2>${emailSubject}</h2><p>Proposta nº ${proposalNum}</p><p><a href="${publicProposalUrl}">Visualizar Proposta</a></p></div>`
  }
  if (!emailHtmlRemote) {
    emailHtmlRemote = emailHtml
  }

  const inlineAttachments = [
    {
      filename: 'nexus-logo.png',
      name: 'nexus-logo.png',
      contentType: 'image/png',
      mimeType: 'image/png',
      content: nexusLogoBase64,
      base64: nexusLogoBase64,
      cid: 'logo-nexus',
      contentId: 'logo-nexus',
      disposition: 'inline',
      encoding: 'base64',
    },
    {
      filename: 'bener-logo.png',
      name: 'bener-logo.png',
      contentType: 'image/png',
      mimeType: 'image/png',
      content: benerLogoBase64,
      base64: benerLogoBase64,
      cid: 'logo-bener',
      contentId: 'logo-bener',
      disposition: 'inline',
      encoding: 'base64',
    },
  ]

  // Assemble full payload
  const payload = {
    // Recipients in multiple shapes (array de e-mails prioritário conforme solicitação, mais variantes)
    to: recipients,
    email_to: recipientsJoined,
    all_recipients: recipients,
    all_recipients_str: recipientsJoined,
    recipients,
    emails: recipients,
    email: recipientsJoined,
    destinatarios: recipientsJoined,
    first_recipient: firstRecipient,
    total_recipients: recipients.length,

    // Subject variations
    subject: emailSubject,
    assunto: emailSubject,
    email_subject: emailSubject,
    title: emailSubject,
    titulo: emailSubject,

    // Event metadata
    event: eventName,
    evento: eventName === 'status_changed' ? 'mudanca_status' : 'proposta_criada',
    novo_status: finalNovoStatus,
    status_anterior: finalOldStatus || null,

    proposta: proposal,
    proposta_id: proposal.id || proposta_id,
    id: proposal.id || proposta_id,
    numero_proposta: proposalNum,
    numero: proposalNum,
    revisao: proposal.revisao || 'A',
    data_emissao: proposal.dt_cad || createdAt,
    created_at: createdAt,
    status: finalNovoStatus,
    tipo_proposta: proposal.tipo_proposta || '',
    modelo_licitacao: Boolean(proposal.modelo_licitacao),

    // Client
    cliente: {
      id: proposal.cliente || null,
      razao_social: proposal.clientes?.razao_social || clientName,
      fantasia: proposal.clientes?.fantasia || clientName,
      nome: clientName,
      documento: clientDoc,
      contato: clientContact,
      email: clientEmail,
      telefone: clientPhone,
      endereco: clientAddress,
      cep: clientCep,
      cidade: proposal.clientes?.cidade || '',
      estado: proposal.clientes?.estado || '',
      bairro: proposal.clientes?.bairro || '',
      logradouro: proposal.clientes?.logradouro || '',
      numero: proposal.clientes?.numero || '',
    },
    cliente_nome: clientName,
    cliente_razao_social: proposal.clientes?.razao_social || clientName,
    cliente_fantasia: proposal.clientes?.fantasia || clientName,
    cliente_contato: clientContact,
    cliente_email: clientEmail,
    cliente_documento: clientDoc,
    cliente_telefone: clientPhone,
    cliente_endereco: clientAddress,
    cliente_cep: clientCep,

    // Destinatário / Contato vinculado do cliente (prioriza contato_id -> cliente_contatos)
    contato_destinatario: {
      id: linkedContact?.id || proposal.contato_id || null,
      nome: contactName,
      cargo: contactCargo,
      email: contactEmail,
      telefone: contactPhone,
      is_principal: Boolean(linkedContact?.is_principal),
    },
    contato_nome: contactName,
    contato_cargo: contactCargo,
    contato_email: contactEmail,
    contato_telefone: contactPhone,

    // Representante
    representante: {
      id: proposal.representante || null,
      nome: repName,
      fantasia: proposal.representantes?.fantasia || repName,
      razao_social: proposal.representantes?.razao_social || '',
      email: repEmail,
      telefone: repPhone,
      documento: proposal.representantes?.documento || '',
    },
    representante_nome: repName,
    representante_email: repEmail,
    representante_telefone: repPhone,

    // Gerente
    gerente: {
      id: proposal.gerente || null,
      nome: gerenteName,
      email: gerenteEmail,
      cargo: proposal.gerentes?.cargo || '',
      celular: gerentePhone,
    },
    gerente_nome: gerenteName,
    gerente_email: gerenteEmail,

    // Machine / Equipment
    maquina: {
      titulo: machineTitle,
      nome: machineTitle,
      imagem: machineImage,
      imagem_preview: machineImage,
      cod_erp: primaryEquipment.cod_erp || proposal.versoes?.cod_erp || '',
      marca: primaryEquipment.marca || '',
      modelo: primaryEquipment.modelo || '',
      produto: primaryEquipment.produto || '',
      categoria: primaryEquipment.categoria || '',
      especificacoes_tecnicas:
        primaryEquipment.especificacoes_tecnicas || proposal.especificacoes_tecnicas || '',
      caracteristicas_construtivas: primaryEquipment.caracteristicas_construtivas || '',
      acessorios_standards: primaryEquipment.acessorios_standards || '',
    },
    equipamento_nome: machineTitle,
    maquina_titulo: machineTitle,
    maquina_imagem: machineImage,

    // Items
    itens: proposalItems,
    produtos_e_acessorios: proposalItems,
    acessorios_proposta: proposal.acessorios_proposta || [],

    // Commercial values
    moeda,
    valor_sem_desconto: proposal.valor_sem_desconto || valorFinal,
    percentual_desconto: proposal.percentual_desconto || 0,
    valor_desconto: (proposal.valor_sem_desconto || valorFinal) - valorFinal,
    valor_atual: proposal.valor_atual || valorFinal,
    valor_final: valorFinal,
    valor_total: valorFinal,

    // Terms
    prazo_entrega: proposal.prazo_entrega || '',
    condicoes_pagamento: proposal.condicoes_pagamento || '',
    validade_oferta: proposal.validade_oferta || '',
    garantia_acessorios: proposal.garantia_acessorios || '',
    cobertura_garantia: proposal.cobertura_garantia || '',
    assistencia_tecnica_detalhada: proposal.assistencia_tecnica_detalhada || '',
    criterios_aceitacao: proposal.criterios_aceitacao || '',
    normas_aplicaveis: proposal.normas_aplicaveis || '',
    normas_seguranca: proposal.normas_seguranca || '',
    certificacoes: proposal.certificacoes || '',
    certificacoes_seguranca: proposal.certificacoes_seguranca || '',
    transporte_seguro: proposal.transporte_seguro || '',
    imposto_ipi: proposal.imposto_ipi || 0,
    imposto_icms: proposal.imposto_icms || 0,
    campos_adicionais: proposal.campos_adicionais || [],

    // Public links and HTML (sempre string preenchida, nunca undefined/nulo)
    pdf_generated: false,
    link_proposta: publicProposalUrl ?? '',
    link_impressao: `${appBaseUrl}/proposta/${proposta_id}/imprimir`,
    pdf_url: publicProposalUrl ?? '',
    app_link: appProposalUrl ?? '',
    email_html: emailHtml ?? '',
    html: emailHtml ?? '',
    body: emailHtml ?? '',
    body_html: emailHtml ?? '',
    text: `Proposta Comercial nº ${proposalNum}\nCliente: ${clientName}\nValor: ${moeda} ${valorFinal}\nLink da Proposta: ${publicProposalUrl}`,
    email_body: emailHtml ?? '',
    content: emailHtml ?? '',
    message_html: emailHtml ?? '',
    email_html_remote: emailHtmlRemote ?? '',
    html_remote: emailHtmlRemote ?? '',

    // Nested "payload.body" dictionary: if an n8n node accesses {{ $json.body.html }} or {{ $json.body.link_proposta }}
    // when $json itself is the top-level payload object (e.g. {{ $json.body.html }} vs {{ $json.html }})
    body_data: {
      to: recipients,
      email_to: recipientsJoined,
      subject: emailSubject ?? '',
      assunto: emailSubject ?? '',
      link_proposta: publicProposalUrl ?? '',
      link_pdf: publicProposalUrl ?? '',
      pdf_url: publicProposalUrl ?? '',
      html: emailHtml ?? '',
      body: emailHtml ?? '',
      text: `Proposta Comercial nº ${proposalNum}\nCliente: ${clientName}\nValor: ${moeda} ${valorFinal}\nLink da Proposta: ${publicProposalUrl}`,
      email_body: emailHtml ?? '',
      content: emailHtml ?? '',
      email_html: emailHtml ?? '',
      body_html: emailHtml ?? '',
      numero_proposta: proposalNum ?? '',
      cliente_nome: clientName ?? '',
      valor_final: valorFinal ?? 0,
      moeda: moeda ?? 'BRL',
    },

    // Inline attachments and logos
    attachments: inlineAttachments,
    inline_attachments: inlineAttachments,
    anexos: inlineAttachments,
    logos: {
      nexus: {
        cid: 'logo-nexus',
        filename: 'nexus-logo.png',
        contentType: 'image/png',
        base64: nexusLogoBase64,
      },
      bener: {
        cid: 'logo-bener',
        filename: 'bener-logo.png',
        contentType: 'image/png',
        base64: benerLogoBase64,
      },
    },
  }

  // 7. Execute webhook POST with timeout and capture response
  // If there are no recipients specified in the notification field, SKIP sending the proposal email entirely.
  let webhookSuccess = false
  let webhookHttpStatus: number | null = null
  let webhookMessage = ''
  let webhookResponseBody = ''
  let proposalEmailSkipped = false

  if (recipients.length === 0) {
    proposalEmailSkipped = true
    webhookMessage =
      'Nenhum e-mail de notificação informado para a proposta. Envio automático para o cliente desativado.'
  } else if (N8N_PROPOSAL_WEBHOOK_URL) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 15000)

      const res = await fetch(N8N_PROPOSAL_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      })
      clearTimeout(timeoutId)

      webhookHttpStatus = res.status
      webhookSuccess = res.ok

      try {
        const textResp = await res.text()
        webhookResponseBody = textResp.slice(0, 1000)
      } catch {
        webhookResponseBody = ''
      }

      webhookMessage = res.ok
        ? 'Webhook n8n disparado com sucesso.'
        : `Status ${res.status} ao chamar webhook n8n.`

      if (!res.ok) {
        console.warn(
          `[send-proposal-email] n8n webhook returned status ${res.status}: ${webhookMessage} | body: ${webhookResponseBody}`,
        )
      }
    } catch (whErr) {
      webhookSuccess = false
      webhookMessage =
        whErr instanceof Error
          ? whErr.name === 'AbortError'
            ? 'Timeout de 15s ao chamar webhook n8n'
            : whErr.message
          : 'Erro na chamada ao webhook n8n.'
      webhookResponseBody = webhookMessage
      console.error('[send-proposal-email] Erro ao chamar webhook n8n:', whErr)
    }
  } else {
    webhookMessage = 'N8N_PROPOSAL_WEBHOOK_URL não configurada em Supabase Secrets.'
    webhookResponseBody = webhookMessage
  }

  const status = proposalEmailSkipped ? 'skipped' : webhookSuccess ? 'success' : 'failed'

  // 8. Persistent dispatch audit: record in public.proposta_email_envios
  if (adminClient) {
    try {
      await adminClient.from('proposta_email_envios').insert({
        proposta_id,
        destinatarios: recipientsJoined || 'Nenhum (campo vazio - envio não disparado)',
        assunto: emailSubject,
        webhook_url: proposalEmailSkipped ? null : N8N_PROPOSAL_WEBHOOK_URL || null,
        http_status: webhookHttpStatus,
        ok: proposalEmailSkipped ? true : webhookSuccess,
        resposta: webhookResponseBody || webhookMessage,
      })
    } catch (auditEnviosErr) {
      console.warn(
        '[send-proposal-email] Error recording in proposta_email_envios:',
        auditEnviosErr,
      )
    }

    // Also record in existing public.audit_logs for backwards compatibility and 60s idempotency
    try {
      await adminClient.from('audit_logs').insert({
        action:
          eventName === 'status_changed' ? 'PROPOSAL_STATUS_EMAIL_SENT' : 'PROPOSAL_EMAIL_SENT',
        table_name: 'propostas',
        record_id: String(proposta_id),
        data_changes: {
          event: eventName,
          subject: emailSubject,
          numero_proposta: proposalNum,
          cliente_nome: clientName,
          cliente_email: clientEmail,
          valor_final: valorFinal,
          itens: proposalItems,
          recipients,
          novo_status: finalNovoStatus,
          status_anterior: finalOldStatus || null,
          link_proposta: publicProposalUrl,
          dispatch_method: 'public_link_n8n_webhook',
          webhook_url: proposalEmailSkipped ? null : N8N_PROPOSAL_WEBHOOK_URL,
          webhook_called: !proposalEmailSkipped && Boolean(N8N_PROPOSAL_WEBHOOK_URL),
          webhook_http_status: webhookHttpStatus,
          webhook_success: proposalEmailSkipped ? false : webhookSuccess,
          webhook_message: webhookMessage,
          webhook_response: webhookResponseBody,
          auto_triggered: Boolean(auto_triggered),
          skipped: proposalEmailSkipped,
          skip_reason: proposalEmailSkipped
            ? 'Campo de e-mails de notificação vazio. Envio ao cliente desativado por regra.'
            : undefined,
          status,
        },
        user_name: auto_triggered ? 'Sistema (Trigger n8n)' : 'Sistema / n8n',
      })
    } catch (auditLogsErr) {
      console.warn('[send-proposal-email] Error recording in audit_logs:', auditLogsErr)
    }
  }

  // 9. Separate Manager Copy dispatch for Gilberto Baksa (created event only)
  // Requirement: "sempre que uma proposta for criada e o gerente ser o 'Gilberto Baksa'
  // Ele envia uma cópia da proposta para o gerente por e-mail, informando qual representante
  // que criou, o horário o valor e um link para acessar o PDF da proposta.
  // Destinatário do envio da cópia de gerência: pedro.garcia@bener.com.br"
  let managerCopyDispatched = false
  let managerCopyResult: Record<string, any> | null = null

  const TARGET_MANAGER_NAME = 'Gilberto Baksa'
  // Destinatário da cópia de gerência: alterado para pedro.garcia@bener.com.br
  const TARGET_MANAGER_EMAIL = 'pedro.garcia@bener.com.br'

  // Robust matching for manager Gilberto Baksa:
  // 1. gerente record id matches Gilberto Baksa's database id
  // 2. gerente name or proposal.nome_gerente_produto matches 'Gilberto Baksa' (case-insensitive)
  // 3. gerente email matches 'gilberto@bener.com.br' (identificação do registro no banco)
  const isGilbertoBaksa =
    (gerenteName && gerenteName.trim().toLowerCase().includes('gilberto baksa')) ||
    (gerenteEmail && gerenteEmail.trim().toLowerCase().includes('gilberto@bener.com.br')) ||
    (proposal.nome_gerente_produto &&
      proposal.nome_gerente_produto.trim().toLowerCase().includes('gilberto baksa')) ||
    (proposal.gerente_original &&
      proposal.gerente_original.trim().toLowerCase().includes('gilberto baksa')) ||
    proposal.gerente === '8e3fb89a-04b9-4604-afc5-e6348584a237' ||
    proposal.assinante_gerente_id === '8e3fb89a-04b9-4604-afc5-e6348584a237'

  if (eventName === 'created' && isGilbertoBaksa && N8N_PROPOSAL_WEBHOOK_URL) {
    try {
      // O e-mail de destino da cópia é fixo/padrão para pedro.garcia@bener.com.br
      const managerEmailTarget = TARGET_MANAGER_EMAIL
      const managerActualName = gerenteName || TARGET_MANAGER_NAME

      // Format creation time in America/Sao_Paulo (Horário de Brasília)
      const creationDateObj = new Date(createdAt)
      let formattedCreationTime = ''
      try {
        formattedCreationTime =
          creationDateObj.toLocaleString('pt-BR', {
            timeZone: 'America/Sao_Paulo',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          }) + ' (horário de Brasília)'
      } catch {
        formattedCreationTime = creationDateObj.toISOString()
      }

      // PDF link: preference for direct storage PDF link (pdf_anexo), fallback to viewer URL
      const storagePdfUrl =
        proposal.pdf_anexo ||
        `${SUPABASE_URL}/storage/v1/object/public/propostas-pdf/${proposta_id}.pdf`
      const effectivePdfUrl = storagePdfUrl || publicProposalUrl

      const managerSubject = `Cópia da Proposta nº ${proposalNum} — criada por ${repName || 'Representante'}`

      let managerEmailHtml = ''
      let managerEmailHtmlRemote = ''
      try {
        managerEmailHtml = buildManagerCopyNotificationEmail({
          proposalNum,
          clientName,
          valorFinal,
          moeda,
          pdfUrl: effectivePdfUrl,
          nexusUrl: publicProposalUrl,
          repName: repName || 'Representante Bener',
          repEmail,
          gerenteName: managerActualName,
          creationTimeFormatted: formattedCreationTime,
          equipmentName: machineTitle,
          isLicitacao: Boolean(proposal.modelo_licitacao),
          inlineCid: true,
        })
        managerEmailHtmlRemote = buildManagerCopyNotificationEmail({
          proposalNum,
          clientName,
          valorFinal,
          moeda,
          pdfUrl: effectivePdfUrl,
          nexusUrl: publicProposalUrl,
          repName: repName || 'Representante Bener',
          repEmail,
          gerenteName: managerActualName,
          creationTimeFormatted: formattedCreationTime,
          equipmentName: machineTitle,
          isLicitacao: Boolean(proposal.modelo_licitacao),
          inlineCid: false,
        })
      } catch (copyHtmlErr) {
        console.warn('[send-proposal-email] Erro ao montar HTML de cópia do gerente:', copyHtmlErr)
        managerEmailHtml = `<div><h2>${managerSubject}</h2><p>Representante: ${repName}</p><p>Horário: ${formattedCreationTime}</p><p>Valor: ${moeda} ${valorFinal}</p><p><a href="${effectivePdfUrl}">Acessar PDF da Proposta</a></p></div>`
        managerEmailHtmlRemote = managerEmailHtml
      }

      // Build independent payload for the manager copy dispatch
      const managerPayload = {
        // Destination matching user's n8n workflow expecting recipient array in body.to
        to: [managerEmailTarget],
        email_to: managerEmailTarget,
        all_recipients: [managerEmailTarget],
        all_recipients_str: managerEmailTarget,
        recipients: [managerEmailTarget],
        emails: [managerEmailTarget],
        email: managerEmailTarget,
        destinatarios: managerEmailTarget,
        first_recipient: managerEmailTarget,
        total_recipients: 1,

        subject: managerSubject,
        assunto: managerSubject,
        email_subject: managerSubject,
        title: managerSubject,
        titulo: managerSubject,

        event: 'manager_copy',
        evento: 'copia_gerente_proposta_criada',
        is_manager_copy: true,
        tipo_notificacao: 'copia_gerente',

        proposta: proposal,
        proposta_id: proposal.id || proposta_id,
        id: proposal.id || proposta_id,
        numero_proposta: proposalNum,
        numero: proposalNum,
        created_at: createdAt,
        horario_criacao: formattedCreationTime,

        // Specific fields requested
        representante_nome: repName || 'Representante Bener',
        representante_email: repEmail || '',
        representante_telefone: repPhone || '',
        representante: {
          id: proposal.representante || null,
          nome: repName || '',
          email: repEmail || '',
          telefone: repPhone || '',
        },

        gerente_nome: managerActualName,
        gerente_email: managerEmailTarget,
        gerente: {
          id: proposal.gerente || null,
          nome: managerActualName,
          email: managerEmailTarget,
        },

        cliente_nome: clientName,
        cliente: {
          id: proposal.cliente || null,
          nome: clientName,
          razao_social: proposal.clientes?.razao_social || clientName,
          fantasia: proposal.clientes?.fantasia || clientName,
        },

        equipamento_nome: machineTitle,
        maquina_titulo: machineTitle,

        moeda,
        valor_final: valorFinal,
        valor_total: valorFinal,

        pdf_url: effectivePdfUrl,
        link_pdf: effectivePdfUrl,
        link_proposta: publicProposalUrl,
        app_link: appProposalUrl,

        email_html: managerEmailHtml,
        html: managerEmailHtml,
        body: managerEmailHtml,
        body_html: managerEmailHtml,
        text: `Cópia da Proposta nº ${proposalNum}\nCliente: ${clientName}\nValor: ${moeda} ${valorFinal}\nLink da Proposta: ${publicProposalUrl}`,
        email_body: managerEmailHtml,
        content: managerEmailHtml,
        message_html: managerEmailHtml,
        email_html_remote: managerEmailHtmlRemote,
        html_remote: managerEmailHtmlRemote,

        body_data: {
          to: [managerEmailTarget],
          email_to: managerEmailTarget,
          subject: managerSubject,
          assunto: managerSubject,
          link_proposta: publicProposalUrl,
          link_pdf: effectivePdfUrl,
          pdf_url: effectivePdfUrl,
          html: managerEmailHtml,
          body: managerEmailHtml,
          text: `Cópia da Proposta nº ${proposalNum}\nCliente: ${clientName}\nValor: ${moeda} ${valorFinal}\nLink da Proposta: ${publicProposalUrl}`,
          email_body: managerEmailHtml,
          content: managerEmailHtml,
          email_html: managerEmailHtml,
          body_html: managerEmailHtml,
          numero_proposta: proposalNum,
          cliente_nome: clientName,
          valor_final: valorFinal,
          moeda,
        },

        attachments: inlineAttachments,
        inline_attachments: inlineAttachments,
        anexos: inlineAttachments,
        logos: {
          nexus: {
            cid: 'logo-nexus',
            filename: 'nexus-logo.png',
            contentType: 'image/png',
            base64: nexusLogoBase64,
          },
          bener: {
            cid: 'logo-bener',
            filename: 'bener-logo.png',
            contentType: 'image/png',
            base64: benerLogoBase64,
          },
        },
      }

      // Execute manager copy webhook POST
      let mgrWebhookSuccess = false
      let mgrHttpStatus: number | null = null
      let mgrResponseBody = ''

      try {
        const mgrController = new AbortController()
        const mgrTimeoutId = setTimeout(() => mgrController.abort(), 15000)

        const mgrRes = await fetch(N8N_PROPOSAL_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(managerPayload),
          signal: mgrController.signal,
        })
        clearTimeout(mgrTimeoutId)

        mgrHttpStatus = mgrRes.status
        mgrWebhookSuccess = mgrRes.ok

        try {
          const mgrText = await mgrRes.text()
          mgrResponseBody = mgrText.slice(0, 1000)
        } catch {
          mgrResponseBody = ''
        }
      } catch (mgrFetchErr) {
        mgrWebhookSuccess = false
        mgrResponseBody =
          mgrFetchErr instanceof Error
            ? mgrFetchErr.message
            : 'Erro ao chamar webhook n8n para gerente'
        console.error(
          '[send-proposal-email] Erro ao chamar webhook n8n para cópia do gerente:',
          mgrFetchErr,
        )
      }

      managerCopyDispatched = mgrWebhookSuccess
      managerCopyResult = {
        to: managerEmailTarget,
        gerente: managerActualName,
        http_status: mgrHttpStatus,
        ok: mgrWebhookSuccess,
        resposta: mgrResponseBody,
      }

      // Audit log for Manager Copy in proposta_email_envios
      if (adminClient) {
        try {
          await adminClient.from('proposta_email_envios').insert({
            proposta_id,
            destinatarios: managerEmailTarget,
            assunto: managerSubject,
            webhook_url: N8N_PROPOSAL_WEBHOOK_URL || null,
            http_status: mgrHttpStatus,
            ok: mgrWebhookSuccess,
            resposta:
              mgrResponseBody ||
              (mgrWebhookSuccess ? 'Cópia enviada ao gerente' : 'Falha no webhook n8n do gerente'),
          })
        } catch (mgrAuditEnvioErr) {
          console.warn(
            '[send-proposal-email] Erro ao gravar cópia do gerente em proposta_email_envios:',
            mgrAuditEnvioErr,
          )
        }

        try {
          await adminClient.from('audit_logs').insert({
            action: 'PROPOSAL_MANAGER_COPY_SENT',
            table_name: 'propostas',
            record_id: String(proposta_id),
            data_changes: {
              event: 'manager_copy',
              subject: managerSubject,
              numero_proposta: proposalNum,
              gerente_nome: managerActualName,
              gerente_email: managerEmailTarget,
              representante_nome: repName,
              horario_criacao: formattedCreationTime,
              valor_final: valorFinal,
              pdf_url: effectivePdfUrl,
              webhook_http_status: mgrHttpStatus,
              webhook_success: mgrWebhookSuccess,
              webhook_response: mgrResponseBody,
            },
            user_name: 'Sistema / n8n (Cópia Gerente)',
          })
        } catch (mgrAuditLogErr) {
          console.warn(
            '[send-proposal-email] Erro ao gravar cópia do gerente em audit_logs:',
            mgrAuditLogErr,
          )
        }
      }
    } catch (globalMgrErr) {
      console.warn(
        '[send-proposal-email] Exceção no fluxo de cópia do gerente (não-fatal):',
        globalMgrErr,
      )
    }
  }

  return new Response(
    JSON.stringify({
      sent: webhookSuccess,
      skipped: proposalEmailSkipped,
      data: {
        sent: webhookSuccess,
        skipped: proposalEmailSkipped,
        status,
        http_status: webhookHttpStatus,
        webhook_called: !proposalEmailSkipped && Boolean(N8N_PROPOSAL_WEBHOOK_URL),
        webhook_success: webhookSuccess,
        webhook_message: webhookMessage,
        link_proposta: publicProposalUrl,
        message: webhookMessage,
        count: recipients.length,
        recipients,
        numero_proposta: proposalNum,
        manager_copy: managerCopyResult,
        manager_copy_dispatched: managerCopyDispatched,
      },
    }),
    { headers: { 'Content-Type': 'application/json', Connection: 'keep-alive', ...cors } },
  )
})
