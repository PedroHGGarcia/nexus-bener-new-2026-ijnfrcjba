import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { getCorsHeaders } from '../_shared/cors.ts'
import { buildPublicProposalHtml } from '../_shared/public-proposal-html.ts'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const DEFAULT_APP_URL = 'https://nexus.bener.com.br'

/**
 * PUBLIC endpoint (no auth) that returns a single proposal rendered as a
 *
 * Deploy v0.0.71: Atualizado com o gerador public-proposal-html (_shared/public-proposal-html.ts)
 * refletindo os Pontos 1 e 3 (PTAX com 4 decimais e subtotal limpo com comissão em linha própria).
 *
 * complete, standalone, styled HTML page — branded with Bener identity
 * (green #0b3c26 header, "BENER", "Máquinas que Transformam", equipment
 * items, commercial conditions, signatures, contact footer).
 *
 * Anyone (even non-clients) can open the link and view THAT specific
 * proposal. No login / JWT required — the function uses the service role
 * key server-side and only ever returns the one proposal identified by
 * the `?id=<uuid>` query parameter.
 *
 * Usage:
 *   GET /functions/v1/public-proposal-pdf?id=<proposta_uuid>
 *   GET /functions/v1/public-proposal-pdf/<proposta_uuid>
 */
Deno.serve(async (req: Request) => {
  const cors = getCorsHeaders(req)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors })
  }

  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed. Use GET.' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', ...cors },
    })
  }

  try {
    const url = new URL(req.url)

    // Accept ?token=... or ?id=... or /functions/v1/public-proposal-pdf/<token_or_uuid>
    let identifier = url.searchParams.get('token') || url.searchParams.get('id')
    if (!identifier) {
      const parts = url.pathname.split('/').filter(Boolean)
      identifier = parts[parts.length - 1] || null
    }

    if (!identifier) {
      return new Response(
        renderErrorPage('Proposta não encontrada', 'O identificador informado é inválido.'),
        {
          status: 400,
          headers: { 'Content-Type': 'text/html; charset=utf-8', ...cors },
        },
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // Match public_token first, fallback to id if valid uuid
    let query = adminClient
      .from('propostas')
      .select(
        '*, clientes(*), versoes(*), representantes:representante(id, fantasia), gerentes:gerente(id, nome)',
      )

    if (UUID_REGEX.test(identifier)) {
      query = query.or(`public_token.eq.${identifier},id.eq.${identifier}`)
    } else {
      query = query.eq('public_token', identifier)
    }

    const { data: proposal, error: propError } = await query.maybeSingle()

    if (propError || !proposal) {
      return new Response(
        renderErrorPage(
          'Proposta não encontrada',
          'Não foi localizada uma proposta com o identificador informado.',
        ),
        {
          status: 404,
          headers: { 'Content-Type': 'text/html; charset=utf-8', ...cors },
        },
      )
    }

    // Creator info
    let creatorInfo: { name: string; email: string } | null = null
    if (proposal.user && UUID_REGEX.test(proposal.user)) {
      const { data: profile } = await adminClient
        .from('profiles')
        .select('name, email')
        .eq('id', proposal.user)
        .maybeSingle()
      if (profile) {
        creatorInfo = { name: profile.name, email: profile.email }
      }
    } else if (proposal.user) {
      creatorInfo = { name: proposal.user, email: '' }
    }

    // Project creator
    let projectCreator: { name: string; projectName: string } | null = null
    if (proposal.projeto && UUID_REGEX.test(proposal.projeto)) {
      const { data: project } = await adminClient
        .from('projetos')
        .select('user, nome')
        .eq('id', proposal.projeto)
        .maybeSingle()
      if (project) {
        if (project.user && UUID_REGEX.test(project.user)) {
          const { data: projProfile } = await adminClient
            .from('profiles')
            .select('name')
            .eq('id', project.user)
            .maybeSingle()
          if (projProfile) {
            projectCreator = { name: projProfile.name, projectName: project.nome }
          }
        } else if (project.user) {
          projectCreator = { name: project.user, projectName: project.nome }
        }
      }
    }

    // Prioriza dados do snapshot congelado (se houver) para garantir imutabilidade da proposta
    const dadosSnapshot = proposal.dados_snapshot as Record<string, any> | null
    const itensSnapshot = proposal.itens_snapshot as any[] | null

    // Tipo de proposta
    let tipoPropostaData: Record<string, unknown> | null =
      (dadosSnapshot?.tipo_proposta_detalhes as Record<string, unknown>) || null
    if (!tipoPropostaData && proposal.tipo_proposta) {
      const { data: tipoData } = await adminClient
        .from('tipos_proposta')
        .select('*')
        .eq('nome', proposal.tipo_proposta)
        .maybeSingle()
      if (tipoData) tipoPropostaData = tipoData
    }

    // Equipment items (prioriza itens_snapshot congelado)
    let equipmentItems: any[] = []
    if (Array.isArray(itensSnapshot) && itensSnapshot.length > 0) {
      equipmentItems = itensSnapshot.map((it: any, idx: number) => ({
        quantidade: it.quantidade ?? 1,
        valor_unitario: it.valor_unitario ?? 0,
        desconto_percentual: it.desconto_percentual ?? 0,
        desconto_valor: it.desconto_valor ?? 0,
        ordem: it.ordem ?? idx,
        tipo_proposta: it.tipo_proposta ?? null,
        versoes: it.versoes || null,
      }))
    } else {
      if (proposal.id) {
        const { data: pv } = await adminClient
          .from('proposta_versoes')
          .select(
            'quantidade, valor_unitario, desconto_percentual, desconto_valor, ordem, tipo_proposta, versoes(id, nome, cod_erp, nome_abreviado, imagem_preview, moeda, valor, especificacoes_tecnicas, caracteristicas_construtivas, acessorios_standards, modelos(id, nome, marcas(id, nome), produtos(id, nome, categorias_produtos:categorias(id, nome))))',
          )
          .eq('proposta_id', proposal.id)
          .order('ordem', { ascending: true })
        equipmentItems = pv || []
      }

      if (equipmentItems.length === 0 && proposal.versao) {
        const { data: versaoFull } = await adminClient
          .from('versoes')
          .select(
            'id, nome, cod_erp, nome_abreviado, imagem_preview, moeda, valor, especificacoes_tecnicas, caracteristicas_construtivas, acessorios_standards, modelos(id, nome, marcas(id, nome), produtos(id, nome, categorias_produtos:categorias(id, nome)))',
          )
          .eq('id', proposal.versao)
          .maybeSingle()
        if (versaoFull) {
          equipmentItems = [
            {
              quantidade: 1,
              valor_unitario: versaoFull.valor || proposal.valor_sem_desconto || 0,
              desconto_percentual: proposal.percentual_desconto || 0,
              desconto_valor: 0,
              ordem: 0,
              versoes: versaoFull,
            },
          ]
        }
      }
    }

    const appUrl = DEFAULT_APP_URL
    const htmlContent = buildPublicProposalHtml(
      proposal,
      appUrl,
      creatorInfo,
      projectCreator,
      tipoPropostaData,
      equipmentItems,
      null,
    )

    return new Response(htmlContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'private, max-age=60',
        ...cors,
      },
    })
  } catch (err) {
    console.error('[public-proposal-pdf] fatal error:', err)
    return new Response(
      renderErrorPage(
        'Erro ao processar documento',
        'Não foi possível processar a solicitação. Tente novamente ou contate o suporte.',
      ),
      {
        status: 500,
        headers: { 'Content-Type': 'text/html; charset=utf-8', ...cors },
      },
    )
  }
})

/** Minimal branded error page returned for invalid/missing proposals. */
function renderErrorPage(title: string, message: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title} — Bener Máquinas</title>
  <style>
    body { font-family: Arial, Helvetica, sans-serif; margin: 0; padding: 0; background: #f1f5f4; color: #1e293b; }
    .page { max-width: 560px; margin: 60px auto; background: #fff; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 12px rgba(11,60,38,0.08); }
    .brand-header { background: #0b3c26; color: #fff; padding: 28px 32px; text-align: center; }
    .brand-header span { font-size: 30px; font-weight: 800; letter-spacing: 4px; }
    .brand-header p { margin: 6px 0 0 0; color: #a7d4c0; font-size: 13px; letter-spacing: 1px; }
    .body { padding: 36px 32px; text-align: center; }
    .body h1 { color: #0b3c26; font-size: 20px; margin: 0 0 12px 0; }
    .body p { color: #475569; font-size: 15px; line-height: 1.6; }
    .footer { border-top: 1px solid #e2e8f0; padding: 18px 32px; text-align: center; font-size: 12px; color: #64748b; }
  </style>
</head>
<body>
  <div class="page">
    <div class="brand-header">
      <span>BENER</span>
      <p>Máquinas que Transformam</p>
    </div>
    <div class="body">
      <h1>${title}</h1>
      <p>${message}</p>
    </div>
    <div class="footer">Bener Máquinas S.A. &bull; vendas@bener.com.br &bull; www.bener.com.br</div>
  </div>
</body>
</html>`
}
