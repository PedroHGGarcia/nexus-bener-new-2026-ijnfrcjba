import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { getCorsHeaders } from '../_shared/cors.ts'

/**
 * PUBLIC Edge Function: public-proposal
 *
 * Receives a public_token (or query param / path param), validates it,
 * and returns ONLY the minimal required data to render the public proposal
 * view and validation pages (/visualizar-proposta/:token and /validar-proposta/:token).
 *
 * Does NOT expose full representative/gerente directory, employee lists, or internal notification emails.
 */
Deno.serve(async (req: Request) => {
  const cors = getCorsHeaders(req)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors })
  }

  try {
    const url = new URL(req.url)
    let token = url.searchParams.get('token')
    let action = url.searchParams.get('action') || 'view'

    if (!token) {
      const parts = url.pathname.split('/').filter(Boolean)
      token = parts[parts.length - 1] || null
    }

    if (req.method === 'POST') {
      try {
        const body = await req.json()
        if (body.token) token = body.token
        if (body.action) action = body.action
      } catch {
        // body not json, continue
      }
    }

    token = token?.trim() || null

    if (!token) {
      return new Response(JSON.stringify({ error: 'Token público não fornecido.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...cors },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // 1. Fetch proposal by public_token or fallback to id (uuid)
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(token)
    let query = adminClient.from('propostas').select(`
        id,
        numero_proposta,
        revisao,
        public_token,
        status,
        dt_cad,
        created_at,
        moeda,
        valor_final,
        valor_sem_desconto,
        percentual_desconto,
        prazo_entrega,
        condicoes_pagamento,
        validade_oferta,
        cobertura_garantia,
        assistencia_tecnica_detalhada,
        criterios_aceitacao,
        garantia_acessorios,
        normas_aplicaveis,
        normas_seguranca,
        certificacoes,
        certificacoes_seguranca,
        transporte_seguro,
        imposto_ipi,
        imposto_icms,
        is_pacote,
        preco_especial,
        acessorios_proposta,
        campos_adicionais,
        tipo_proposta,
        cotacao_moeda,
        data_cotacao_moeda,
        moeda_original,
        frase_preco,
        frase_comissao,
        treinamento_tecnico,
        modelo_licitacao,
        descricao_proposta,
        especificacoes_tecnicas,
        assinatura_cliente,
        assinatura_representante,
        assinatura_gerente_produto,
        nome_representante_comercial,
        nome_gerente_produto,
        pdf_anexo,
        cliente_original,
        versao_original,
        itens_snapshot,
        dados_snapshot,
        cliente:clientes(
          id,
          razao_social,
          fantasia,
          documento,
          contato,
          telefone,
          cidade,
          estado,
          logradouro,
          numero,
          complementos,
          bairro,
          cep
        ),
        versao_rel:versoes(
          id,
          nome,
          nome_abreviado,
          cod_erp,
          imagem_preview,
          especificacoes_tecnicas,
          caracteristicas_construtivas,
          acessorios_standards,
          modelos(
            id,
            nome,
            marcas(id, nome),
            produtos(id, nome, categorias_produtos:categorias(id, nome))
          )
        )
      `)
    if (isUuid) {
      query = query.or(`public_token.eq.${token},id.eq.${token}`)
    } else {
      query = query.eq('public_token', token)
    }

    const { data: proposal, error: propErr } = await query.maybeSingle()

    if (propErr || !proposal) {
      return new Response(JSON.stringify({ error: 'Proposta não encontrada ou link expirado.' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...cors },
      })
    }

    // 2. Fetch items (proposta_versoes)
    const { data: items } = await adminClient
      .from('proposta_versoes')
      .select(`
        id,
        quantidade,
        valor_unitario,
        desconto_percentual,
        desconto_valor,
        ordem,
        tipo_proposta,
        versao_id,
        versoes(
          id,
          nome,
          nome_abreviado,
          cod_erp,
          imagem_preview,
          moeda,
          valor,
          especificacoes_tecnicas,
          caracteristicas_construtivas,
          acessorios_standards,
          tem_estoque,
          estoque_disponivel,
          modelos(
            id,
            nome,
            marcas(id, nome),
            produtos(id, nome, categorias_produtos:categorias(id, nome))
          )
        )
      `)
      .eq('proposta_id', proposal.id)
      .order('ordem', { ascending: true })

    // Handle action === 'validate' to allow clients to sign publicly via token
    if (action === 'validate' && req.method === 'POST') {
      const body = await req.json().catch(() => ({}))
      const signatureDataUrl = body.signature_data_url || body.signatureUrl
      if (!signatureDataUrl) {
        return new Response(JSON.stringify({ error: 'Assinatura não fornecida.' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...cors },
        })
      }

      let signatureUrl = signatureDataUrl
      // If client sent base64 image data url, upload to storage via service role
      if (typeof signatureDataUrl === 'string' && signatureDataUrl.startsWith('data:image/')) {
        const matches = signatureDataUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/)
        if (matches && matches[2]) {
          const mimeType = matches[1] || 'image/png'
          const rawBinary = atob(matches[2])
          const u8 = new Uint8Array(rawBinary.length)
          for (let i = 0; i < rawBinary.length; i++) {
            u8[i] = rawBinary.charCodeAt(i)
          }
          const fileName = `assinatura-cliente-${proposal.id}-${Date.now()}.png`
          const { error: uploadErr } = await adminClient.storage
            .from('propostas-files')
            .upload(fileName, u8, { contentType: mimeType, upsert: true })

          if (!uploadErr) {
            const { data: pubData } = adminClient.storage
              .from('propostas-files')
              .getPublicUrl(fileName)
            signatureUrl = pubData.publicUrl
          }
        }
      }

      const nowIso = new Date().toISOString()
      const { error: updateErr } = await adminClient
        .from('propostas')
        .update({
          assinatura_cliente: signatureUrl,
          status: 'Validada',
          data_alteracao_status: nowIso,
          ultimo_usuario_status: 'Cliente (Portal Público)',
        })
        .eq('id', proposal.id)

      if (updateErr) {
        return new Response(JSON.stringify({ error: 'Falha ao salvar assinatura da proposta.' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...cors },
        })
      }

      // Record audit log
      try {
        await adminClient.from('audit_logs').insert({
          action: 'PROPOSAL_PUBLIC_VALIDATED',
          table_name: 'propostas',
          record_id: proposal.id,
          user_name: 'Cliente (Assinatura Pública)',
          data_changes: {
            public_token: proposal.public_token,
            numero_proposta: proposal.numero_proposta,
            validated_at: nowIso,
          },
        })
      } catch (auditErr) {
        console.warn('[public-proposal] audit log failed:', auditErr)
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Proposta validada e assinada com sucesso!',
          signature_url: signatureUrl,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...cors },
        },
      )
    }

    // Minimal sanitized response payload
    const safeProposal = {
      id: proposal.id,
      public_token: proposal.public_token,
      numero_proposta: proposal.numero_proposta,
      revisao: proposal.revisao || 'A',
      status: proposal.status,
      dt_cad: proposal.dt_cad,
      created_at: proposal.created_at,
      moeda: proposal.moeda || 'BRL',
      valor_final: proposal.valor_final || 0,
      valor_sem_desconto: proposal.valor_sem_desconto || 0,
      percentual_desconto: proposal.percentual_desconto || 0,
      prazo_entrega: proposal.prazo_entrega,
      condicoes_pagamento: proposal.condicoes_pagamento,
      validade_oferta: proposal.validade_oferta,
      cobertura_garantia: proposal.cobertura_garantia,
      assistencia_tecnica_detalhada: proposal.assistencia_tecnica_detalhada,
      criterios_aceitacao: proposal.criterios_aceitacao,
      garantia_acessorios: proposal.garantia_acessorios,
      normas_aplicaveis: proposal.normas_aplicaveis,
      normas_seguranca: proposal.normas_seguranca,
      certificacoes: proposal.certificacoes,
      certificacoes_seguranca: proposal.certificacoes_seguranca,
      transporte_seguro: proposal.transporte_seguro,
      imposto_ipi: proposal.imposto_ipi || 0,
      imposto_icms: proposal.imposto_icms || 0,
      is_pacote: Boolean(proposal.is_pacote),
      preco_especial: proposal.preco_especial ?? null,
      acessorios_proposta: proposal.acessorios_proposta ?? [],
      campos_adicionais: proposal.campos_adicionais ?? [],
      tipo_proposta: proposal.tipo_proposta ?? null,
      cotacao_moeda: proposal.cotacao_moeda ?? null,
      data_cotacao_moeda: proposal.data_cotacao_moeda ?? null,
      moeda_original: proposal.moeda_original ?? null,
      frase_preco: proposal.frase_preco ?? null,
      frase_comissao: proposal.frase_comissao ?? null,
      treinamento_tecnico: proposal.treinamento_tecnico ?? null,
      modelo_licitacao: Boolean(proposal.modelo_licitacao),
      descricao_proposta: proposal.descricao_proposta,
      especificacoes_tecnicas: proposal.especificacoes_tecnicas,
      assinatura_cliente: proposal.assinatura_cliente,
      assinatura_representante: proposal.assinatura_representante,
      assinatura_gerente_produto: proposal.assinatura_gerente_produto,
      nome_representante_comercial: proposal.nome_representante_comercial,
      nome_gerente_produto: proposal.nome_gerente_produto,
      pdf_anexo: proposal.pdf_anexo,
      cliente_original: proposal.cliente_original,
      versao_original: proposal.versao_original,
      clientes: proposal.cliente,
      versoes: (proposal.dados_snapshot as any)?.primary_versao || proposal.versao_rel,
      proposta_versoes: items || [],
      items: items || [],
      itens_snapshot: proposal.itens_snapshot || null,
      dados_snapshot: proposal.dados_snapshot || null,
    }

    return new Response(JSON.stringify({ success: true, data: safeProposal }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...cors },
    })
  } catch (err) {
    const cors = getCorsHeaders(req)
    const requestId = crypto.randomUUID()
    console.error(`[public-proposal] [request_id:${requestId}] internal error:`, err)
    return new Response(
      JSON.stringify({
        error: 'Ocorreu um erro interno ao processar a requisição. Tente novamente mais tarde.',
        request_id: requestId,
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...cors },
      },
    )
  }
})
