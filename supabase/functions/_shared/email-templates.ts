// Public, highly-available logo assets for transactional email clients (Outlook, Gmail, Apple Mail, Webmail).
// Using direct Supabase Storage public objects from bucket 'public/logos/'
export const EMAIL_LOGOS = {
  nexus:
    'https://ugnhnbfogxbcptprsfot.supabase.co/storage/v1/object/public/public/logos/nexus-logo.png',
  bener:
    'https://ugnhnbfogxbcptprsfot.supabase.co/storage/v1/object/public/public/logos/bener-logo.png',
}

// Content-IDs for inline embedded email images (RFC 2392)
export const EMAIL_LOGO_CIDS = {
  nexus: 'cid:logo-nexus',
  bener: 'cid:logo-bener',
}

export interface ProposalNotificationEmailOptions {
  proposalNum: string
  clientName: string
  valorFinal: number
  moeda: string
  proposalUrl: string
  isLicitacao?: boolean
  event?: 'created' | 'status_changed'
  newStatus?: string
  oldStatus?: string
  sellerName?: string
  sellerEmail?: string
  equipmentName?: string
}

export interface ManagerCopyNotificationEmailOptions {
  proposalNum: string
  clientName: string
  valorFinal: number
  moeda: string
  pdfUrl: string
  nexusUrl: string
  repName: string
  repEmail?: string
  gerenteName?: string
  creationTimeFormatted: string
  equipmentName?: string
  isLicitacao?: boolean
  inlineCid?: boolean
}

import { escapeHtml } from './escape-html.ts'

export function buildUserConfirmationEmail(
  name: string,
  email: string,
  role: string,
  accessUrl: string,
): string {
  const safeName = escapeHtml(name || 'Usuário')
  const safeRole = escapeHtml(role || 'Usuário')
  const safeEmail = escapeHtml(email)
  const safeUrl = escapeHtml(accessUrl || 'https://nexus.bener.com.br')
  const resetUrl = `${safeUrl.replace(/\/$/, '')}/esqueci-senha`

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Cadastro Confirmado e Aprovado — Bener Nexus</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1f2937; margin: 0; padding: 0; background-color: #f3f4f6;">
  <div style="max-width: 620px; margin: 24px auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 16px rgba(0,0,0,0.06); border: 1px solid #e5e7eb;">
    <!-- Modern clean header with both Nexus and Bener logos (no dark green banner) -->
    <div style="background-color: #ffffff; padding: 24px 32px; border-bottom: 2px solid #10b981; text-align: center;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td align="center" style="vertical-align: middle;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 0 auto;">
              <tr>
                <td style="vertical-align: middle; padding-right: 18px;">
                  <img src="${EMAIL_LOGOS.nexus}" alt="Nexus — Extranet Bener Máquinas" width="160" height="40" border="0" style="display: block; border: 0; outline: none; text-decoration: none; width: 160px; max-width: 170px; height: 40px; object-fit: contain; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; font-weight: 700; color: #0b3c26; text-align: left;" />
                </td>
                <td style="width: 1px; height: 32px; background-color: #d1d5db; vertical-align: middle;" width="1"></td>
                <td style="vertical-align: middle; padding-left: 18px;">
                  <img src="${EMAIL_LOGOS.bener}" alt="Bener Máquinas — Máquinas que Transformam" width="130" height="30" border="0" style="display: block; border: 0; outline: none; text-decoration: none; width: 130px; max-width: 140px; height: 30px; object-fit: contain; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 13px; font-weight: 700; color: #0b3c26; text-align: left;" />
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </div>

    <!-- Body content -->
    <div style="padding: 32px 32px 24px 32px;">
      <h2 style="color: #0f172a; margin-top: 0; margin-bottom: 12px; font-size: 20px; font-weight: 700; letter-spacing: -0.3px;">
        Cadastro Confirmado e Aprovado
      </h2>
      <p style="font-size: 15px; line-height: 1.6; color: #475569; margin-bottom: 16px;">
        Olá, <strong>${safeName}</strong>,
      </p>
      <p style="font-size: 15px; line-height: 1.6; color: #475569; margin-bottom: 20px;">
        Seu cadastro no portal <strong>Bener Nexus</strong> foi aprovado com sucesso pela administração da Bener.
      </p>
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #10b981; padding: 18px 20px; margin-bottom: 24px; border-radius: 8px;">
        <p style="margin: 4px 0; font-size: 14px; color: #334155;"><strong>E-mail de acesso:</strong> ${safeEmail}</p>
        <p style="margin: 4px 0; font-size: 14px; color: #334155;"><strong>Perfil atribuído:</strong> ${safeRole}</p>
        <p style="margin: 4px 0; font-size: 14px; color: #334155;"><strong>Status:</strong> <span style="color: #059669; font-weight: 600;">Ativo</span></p>
      </div>
      <p style="font-size: 14px; line-height: 1.6; margin-bottom: 24px; color: #64748b;">
        Por segurança, utilize a senha cadastrada ou utilize o link abaixo para criar/redefinir sua credencial de acesso.
      </p>
      <div style="text-align: center; margin: 28px 0;">
        <a href="${safeUrl}" style="display: inline-block; background: #0b3c26; color: #ffffff; padding: 14px 36px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px; box-shadow: 0 2px 4px rgba(11,60,38,0.2);">Acessar o Bener Nexus</a>
      </div>
      <p style="font-size: 13px; line-height: 1.5; color: #94a3b8; text-align: center; margin: 0;">
        Primeiro acesso ou esqueceu sua senha? <a href="${resetUrl}" style="color: #0b3c26; font-weight: 600; text-decoration: underline;">Clique aqui para redefinir</a>
      </p>
    </div>

    <!-- Footer -->
    <div style="background-color: #f8fafc; border-top: 1px solid #e5e7eb; padding: 20px 24px; text-align: center; font-size: 12px; color: #64748b; line-height: 1.6;">
      <p style="margin: 2px 0; font-weight: 600; color: #334155;">Bener Máquinas S.A. &bull; Nexus Gestão Comercial</p>
      <p style="margin: 2px 0;">Rua Iracema Lucas, 450 &ndash; Distrito Industrial &bull; Vinhedo/SP &bull; Fone: (19) 3826-7373</p>
      <p style="margin: 2px 0;">vendas@bener.com.br &bull; <a href="https://www.bener.com.br" style="color: #0b3c26; text-decoration: none;">www.bener.com.br</a></p>
    </div>
  </div>
</body>
</html>`
}

export function buildProposalNotificationEmail(
  proposalNum: string,
  clientName: string,
  valorFinal: number,
  moeda: string,
  proposalUrl: string,
  isLicitacao: boolean = false,
  event: 'created' | 'status_changed' = 'created',
  newStatus?: string,
  oldStatus?: string,
  sellerName?: string,
  sellerEmail?: string,
  equipmentName?: string,
  inlineCid: boolean = true,
): string {
  const nexusLogoSrc = (inlineCid ? EMAIL_LOGO_CIDS.nexus : EMAIL_LOGOS.nexus) ?? ''
  const benerLogoSrc = (inlineCid ? EMAIL_LOGO_CIDS.bener : EMAIL_LOGOS.bener) ?? ''
  const fmtVal = (val: number) =>
    (val ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const isStatusChange = event === 'status_changed'
  const propType = isLicitacao ? 'Proposta de Licitação' : 'Proposta Comercial'
  const safePropNum = escapeHtml(proposalNum ?? '')
  const safeClient = escapeHtml(clientName ?? '')
  const safePropUrl = escapeHtml(proposalUrl ?? '')
  const safeMoeda = escapeHtml(moeda ?? 'BRL')

  const headingText = isStatusChange
    ? `Atualização de Status da Proposta`
    : `Nova Proposta Recebida`

  const subtitleText = isStatusChange
    ? `O status da proposta foi alterado no sistema Nexus.`
    : `Uma nova proposta comercial foi emitida no sistema Nexus e está disponível para consulta.`

  const statusBadge = newStatus
    ? `<span style="display: inline-block; background-color: #ecfdf5; color: #065f46; font-weight: 700; font-size: 13px; padding: 4px 10px; border-radius: 6px; border: 1px solid #a7f3d0;">${escapeHtml(newStatus ?? '')}</span>`
    : ''

  const oldStatusText = oldStatus
    ? `<span style="color: #64748b; font-size: 13px; margin-left: 6px;">(anterior: <strike>${escapeHtml(oldStatus ?? '')}</strike>)</span>`
    : ''

  const equipmentRow = equipmentName
    ? `<tr>
        <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; font-weight: 600; color: #475569; width: 34%; font-size: 13px;">Equipamento:</td>
        <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; color: #0f172a; font-weight: 600; font-size: 14px;">${escapeHtml(equipmentName ?? '')}</td>
      </tr>`
    : ''

  const sellerRow = sellerName
    ? `<tr>
        <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; font-weight: 600; color: #475569; font-size: 13px;">Vendedor / Representante:</td>
        <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; color: #1e293b; font-size: 14px;">
          ${escapeHtml(sellerName ?? '')}${sellerEmail ? ` <span style="color: #64748b; font-size: 12px;">(${escapeHtml(sellerEmail ?? '')})</span>` : ''}
        </td>
      </tr>`
    : ''

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${headingText ?? ''} — Proposta nº ${safePropNum ?? ''}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1f2937; margin: 0; padding: 0; background-color: #f1f5f9;">
  <div style="max-width: 620px; margin: 24px auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 16px rgba(0,0,0,0.06); border: 1px solid #e2e8f0;">

    <!-- Modern clean header with both Nexus and Bener logos (removes old dark green text banner) -->
    <div style="background-color: #ffffff; padding: 26px 32px; border-bottom: 2px solid #10b981; text-align: center;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td align="center" style="vertical-align: middle;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 0 auto;">
              <tr>
                <td style="vertical-align: middle; padding-right: 20px;">
                  <img src="${nexusLogoSrc ?? ''}" alt="Nexus — Extranet Bener Máquinas" width="168" height="42" border="0" style="display: block; border: 0; outline: none; text-decoration: none; width: 168px; max-width: 180px; height: 42px; object-fit: contain; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; font-weight: 700; color: #0b3c26; text-align: left;" />
                </td>
                <td style="width: 1px; height: 34px; background-color: #d1d5db; vertical-align: middle;" width="1"></td>
                <td style="vertical-align: middle; padding-left: 20px;">
                  <img src="${benerLogoSrc ?? ''}" alt="Bener Máquinas — Máquinas que Transformam" width="135" height="32" border="0" style="display: block; border: 0; outline: none; text-decoration: none; width: 135px; max-width: 145px; height: 32px; object-fit: contain; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 13px; font-weight: 700; color: #0b3c26; text-align: left;" />
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </div>

    <!-- Notification Hero / Intro -->
    <div style="padding: 32px 32px 20px 32px;">
      <div style="display: inline-block; background-color: #eff6ff; color: #1d4ed8; font-weight: 700; font-size: 11px; letter-spacing: 0.8px; text-transform: uppercase; padding: 4px 10px; border-radius: 4px; margin-bottom: 12px;">
        ${propType ?? ''}
      </div>
      <h2 style="color: #0f172a; margin: 0 0 10px 0; font-size: 22px; font-weight: 700; letter-spacing: -0.4px;">
        ${headingText ?? ''}
      </h2>
      <p style="font-size: 15px; line-height: 1.6; color: #475569; margin: 0 0 24px 0;">
        ${subtitleText ?? ''}
      </p>

      <!-- Key proposal details card -->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; margin-bottom: 24px;">
        <tr>
          <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; font-weight: 600; color: #475569; width: 34%; font-size: 13px;">Nº da Proposta:</td>
          <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; color: #0b3c26; font-weight: 700; font-size: 16px;">
            ${safePropNum ?? ''}
          </td>
        </tr>
        <tr>
          <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; font-weight: 600; color: #475569; font-size: 13px;">Cliente:</td>
          <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; color: #0f172a; font-weight: 600; font-size: 14px;">
            ${safeClient ?? ''}
          </td>
        </tr>
        ${equipmentRow ?? ''}
        ${sellerRow ?? ''}
        <tr>
          <td style="padding: 10px 14px; ${isStatusChange && newStatus ? 'border-bottom: 1px solid #e2e8f0;' : ''} font-weight: 600; color: #475569; font-size: 13px;">Valor da Proposta:</td>
          <td style="padding: 10px 14px; ${isStatusChange && newStatus ? 'border-bottom: 1px solid #e2e8f0;' : ''} color: #0b3c26; font-weight: 800; font-size: 16px;">
            ${safeMoeda ?? 'BRL'} ${fmtVal(valorFinal)}
          </td>
        </tr>
        ${
          isStatusChange && newStatus
            ? `<tr>
                <td style="padding: 10px 14px; font-weight: 600; color: #475569; font-size: 13px;">Status Atual:</td>
                <td style="padding: 10px 14px;">
                  ${statusBadge ?? ''} ${oldStatusText ?? ''}
                </td>
              </tr>`
            : ''
        }
      </table>

      <!-- Call to Action -->
      <div style="text-align: center; margin: 32px 0 24px 0;">
        <a href="${safePropUrl ?? ''}" style="display: inline-block; background-color: #0b3c26; color: #ffffff; padding: 15px 38px; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 15px; letter-spacing: 0.3px; box-shadow: 0 3px 6px rgba(11,60,38,0.25);">
          Abrir Proposta no Nexus &rarr;
        </a>
      </div>

      <p style="font-size: 12px; line-height: 1.5; color: #94a3b8; text-align: center; margin: 0 0 12px 0;">
        Caso não consiga clicar no botão, copie e cole o link a seguir no seu navegador:<br>
        <a href="${safePropUrl ?? ''}" style="color: #0b3c26; word-break: break-all; text-decoration: underline;">${safePropUrl ?? ''}</a>
      </p>
    </div>

    <!-- Clean Corporate Footer -->
    <div style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 22px 28px; text-align: center; font-size: 12px; color: #64748b; line-height: 1.6;">
      <p style="margin: 2px 0; font-weight: 700; color: #334155;">
        Bener Máquinas S.A. &bull; Nexus Gestão de Propostas
      </p>
      <p style="margin: 2px 0;">
        Rua Iracema Lucas, 450 (Antiga Rua Parsch) &ndash; Distrito Industrial &bull; Vinhedo/SP &bull; CEP: 13280-172
      </p>
      <p style="margin: 2px 0;">
        Fone: (19) 3826-7373 &bull; vendas@bener.com.br &bull; <a href="https://www.bener.com.br" style="color: #0b3c26; text-decoration: none; font-weight: 600;">www.bener.com.br</a>
      </p>
    </div>
  </div>
</body>
</html>`
}

/**
 * Builds the dedicated Manager Copy notification email HTML.
 * Includes:
 *  - Official Nexus + Bener branding and green corporate style (#0b3c26)
 *  - Greeting to the manager (Gilberto Baksa)
 *  - Representative who created the proposal
 *  - Creation timestamp
 *  - Total commercial value
 *  - Client name & equipment name
 *  - Prominent button / link to download/view the proposal PDF
 *  - Direct link to access the proposal inside the Nexus platform
 */
export function buildManagerCopyNotificationEmail(
  options: ManagerCopyNotificationEmailOptions,
): string {
  const {
    proposalNum,
    clientName,
    valorFinal,
    moeda,
    pdfUrl,
    nexusUrl,
    repName,
    repEmail,
    gerenteName = 'Gilberto Baksa',
    creationTimeFormatted,
    equipmentName,
    isLicitacao = false,
    inlineCid = true,
  } = options

  const nexusLogoSrc = inlineCid ? EMAIL_LOGO_CIDS.nexus : EMAIL_LOGOS.nexus
  const benerLogoSrc = inlineCid ? EMAIL_LOGO_CIDS.bener : EMAIL_LOGOS.bener

  const fmtVal = (val: number) =>
    val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const propType = isLicitacao ? 'Proposta de Licitação' : 'Proposta Comercial'
  const safeRep = repName || 'Representante não informado'
  const safeClient = clientName || 'Cliente não informado'

  const equipmentRow = equipmentName
    ? `<tr>
        <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; font-weight: 600; color: #475569; width: 34%; font-size: 13px;">Equipamento:</td>
        <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; color: #0f172a; font-weight: 600; font-size: 14px;">${equipmentName}</td>
      </tr>`
    : ''

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Cópia de Proposta — Gerência Comercial — Proposta nº ${proposalNum}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1f2937; margin: 0; padding: 0; background-color: #f1f5f9;">
  <div style="max-width: 620px; margin: 24px auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 16px rgba(0,0,0,0.06); border: 1px solid #e2e8f0;">

    <!-- Modern clean header with both Nexus and Bener logos -->
    <div style="background-color: #ffffff; padding: 26px 32px; border-bottom: 2px solid #10b981; text-align: center;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td align="center" style="vertical-align: middle;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 0 auto;">
              <tr>
                <td style="vertical-align: middle; padding-right: 20px;">
                  <img src="${nexusLogoSrc}" alt="Nexus — Extranet Bener Máquinas" width="168" height="42" border="0" style="display: block; border: 0; outline: none; text-decoration: none; width: 168px; max-width: 180px; height: 42px; object-fit: contain; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; font-weight: 700; color: #0b3c26; text-align: left;" />
                </td>
                <td style="width: 1px; height: 34px; background-color: #d1d5db; vertical-align: middle;" width="1"></td>
                <td style="vertical-align: middle; padding-left: 20px;">
                  <img src="${benerLogoSrc}" alt="Bener Máquinas — Máquinas que Transformam" width="135" height="32" border="0" style="display: block; border: 0; outline: none; text-decoration: none; width: 135px; max-width: 145px; height: 32px; object-fit: contain; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 13px; font-weight: 700; color: #0b3c26; text-align: left;" />
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </div>

    <!-- Notification Hero / Intro -->
    <div style="padding: 32px 32px 20px 32px;">
      <div style="display: inline-block; background-color: #ecfdf5; color: #065f46; font-weight: 700; font-size: 11px; letter-spacing: 0.8px; text-transform: uppercase; padding: 4px 10px; border-radius: 4px; margin-bottom: 12px; border: 1px solid #a7f3d0;">
        Notificação de Gerência &bull; ${propType}
      </div>
      <h2 style="color: #0f172a; margin: 0 0 10px 0; font-size: 22px; font-weight: 700; letter-spacing: -0.4px;">
        Nova Proposta Emitida sob sua Gerência
      </h2>
      <p style="font-size: 15px; line-height: 1.6; color: #475569; margin: 0 0 20px 0;">
        Olá, <strong>${gerenteName}</strong>! Uma nova proposta comercial foi criada no sistema Nexus e está vinculada à sua gerência. Abaixo estão os dados principais e o link para acessar o PDF completo:
      </p>

      <!-- Key proposal details card -->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; margin-bottom: 24px;">
        <tr>
          <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; font-weight: 600; color: #475569; width: 34%; font-size: 13px;">Nº da Proposta:</td>
          <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; color: #0b3c26; font-weight: 700; font-size: 16px;">
            ${proposalNum}
          </td>
        </tr>
        <tr>
          <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; font-weight: 600; color: #475569; font-size: 13px;">Representante que Criou:</td>
          <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; color: #1e293b; font-weight: 700; font-size: 14px;">
            ${safeRep}${repEmail ? ` <span style="color: #64748b; font-size: 12px; font-weight: normal;">(${repEmail})</span>` : ''}
          </td>
        </tr>
        <tr>
          <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; font-weight: 600; color: #475569; font-size: 13px;">Data e Horário:</td>
          <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; color: #1e293b; font-size: 14px;">
            ${creationTimeFormatted}
          </td>
        </tr>
        <tr>
          <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; font-weight: 600; color: #475569; font-size: 13px;">Cliente:</td>
          <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; color: #0f172a; font-weight: 600; font-size: 14px;">
            ${safeClient}
          </td>
        </tr>
        ${equipmentRow}
        <tr>
          <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; font-weight: 600; color: #475569; font-size: 13px;">Valor da Proposta:</td>
          <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; color: #0b3c26; font-weight: 800; font-size: 17px;">
            ${moeda} ${fmtVal(valorFinal)}
          </td>
        </tr>
        <tr>
          <td style="padding: 10px 14px; font-weight: 600; color: #475569; font-size: 13px;">Gerente Responsável:</td>
          <td style="padding: 10px 14px; color: #1e293b; font-size: 14px;">
            ${gerenteName}
          </td>
        </tr>
      </table>

      <!-- Prominent Call to Action Buttons -->
      <div style="text-align: center; margin: 28px 0 20px 0;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 0 auto;">
          <tr>
            <td align="center" style="padding: 6px;">
              <a href="${pdfUrl}" target="_blank" style="display: inline-block; background-color: #0b3c26; color: #ffffff; padding: 15px 32px; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 15px; letter-spacing: 0.3px; box-shadow: 0 3px 6px rgba(11,60,38,0.25);">
                &darr; Acessar PDF da Proposta
              </a>
            </td>
            <td align="center" style="padding: 6px;">
              <a href="${nexusUrl}" target="_blank" style="display: inline-block; background-color: #ffffff; color: #0b3c26; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 14px; letter-spacing: 0.3px; border: 2px solid #0b3c26;">
                Abrir no Nexus &rarr;
              </a>
            </td>
          </tr>
        </table>
      </div>

      <p style="font-size: 12px; line-height: 1.5; color: #94a3b8; text-align: center; margin: 0 0 12px 0;">
        Link direto para o PDF:<br>
        <a href="${pdfUrl}" style="color: #0b3c26; word-break: break-all; text-decoration: underline;">${pdfUrl}</a>
      </p>
    </div>

    <!-- Clean Corporate Footer -->
    <div style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 22px 28px; text-align: center; font-size: 12px; color: #64748b; line-height: 1.6;">
      <p style="margin: 2px 0; font-weight: 700; color: #334155;">
        Bener Máquinas S.A. &bull; Nexus Gestão Comercial
      </p>
      <p style="margin: 2px 0;">
        Rua Iracema Lucas, 450 (Antiga Rua Parsch) &ndash; Distrito Industrial &bull; Vinhedo/SP &bull; CEP: 13280-172
      </p>
      <p style="margin: 2px 0;">
        Fone: (19) 3826-7373 &bull; vendas@bener.com.br &bull; <a href="https://www.bener.com.br" style="color: #0b3c26; text-decoration: none; font-weight: 600;">www.bener.com.br</a>
      </p>
    </div>
  </div>
</body>
</html>`
}
