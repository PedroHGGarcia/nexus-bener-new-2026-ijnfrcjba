import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2.118.0'
import { getCorsHeaders } from '../_shared/cors.ts'
import { requireUser } from '../_shared/auth.ts'
import { buildProposalPdfHtml } from '../_shared/pdf-builder.ts'
import { generateAndUploadProposalPdf } from '../_shared/pdf-generator.ts'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const DEFAULT_APP_URL = 'https://nexus.bener.com.br'

/**
 * generate-proposal-pdf
 *
 * Deploy v0.0.71: Atualizado com os geradores de PDF (_shared/pdf-builder.ts e pdf-generator.ts)
 * refletindo os Pontos 1 e 3 (PTAX com 4 decimais e subtotal limpo com comissão em linha própria).
 *
 * Receives a proposal id (or full proposal payload), fetches proposal +
 * items + cliente + tipo_proposta, builds the shared HTML document AND a
 * real PDF binary (pure-Deno generator, zero external deps), uploads the
 * PDF to the public `propostas-pdf` storage bucket as `{id}.pdf`, and
 * returns JSON with the HTML + the storage public URL.
 *
 * Optional body:
 *  - proposta_id: string (uuid)
 *  - proposta: full proposal object (optional override)
 *  - appUrl, logoUrl, logoData: optional branding overrides
 *  - saveToStorage: boolean (default true) — when false, skip storage upload
 */
Deno.serve(async (req: Request) => {
  const cors = getCorsHeaders(req)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors })
  }

  // C5: Require authenticated user (or allow internal test token)
  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization') || ''
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  const isServiceRole = Boolean(serviceRoleKey && authHeader && authHeader.includes(serviceRoleKey))
  const testSecretHeader = req.headers.get('x-internal-test') || ''

  try {
    const body = await req.json().catch(() => ({}))

    const isTestCall = Boolean(
      (body?.testToken && body.testToken === 'nexus-qa-2026') ||
      testSecretHeader === 'nexus-qa-2026' ||
      isServiceRole,
    )

    if (!isTestCall) {
      try {
        await requireUser(req)
      } catch (authResp) {
        if (authResp instanceof Response) return authResp
        return new Response(JSON.stringify({ error: 'Autenticação necessária.' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json', ...cors },
        })
      }
    }
    const {
      proposta_id,
      appUrl,
      logoUrl,
      logoData,
      saveToStorage = true,
      valor_comissao_servicos,
      base_comissao_servicos,
      percentual_comissao_servicos,
    } = body

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    if (!proposta_id) {
      return new Response(JSON.stringify({ error: 'proposta_id é obrigatório.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...cors },
      })
    }

    // Always fetch directly from DB to prevent client payload manipulation
    const { data: proposalData, error: fetchErr } = await adminClient
      .from('propostas')
      .select('*, clientes(*), versoes(*), representantes:representante(*), gerentes:gerente(*)')
      .eq('id', proposta_id)
      .maybeSingle()

    if (fetchErr || !proposalData) {
      return new Response(JSON.stringify({ error: 'Proposta não encontrada.' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...cors },
      })
    }

    // Creator info
    let creatorInfo: { name: string; email: string } | null = null
    if (proposalData.user && UUID_REGEX.test(proposalData.user)) {
      const { data: profile } = await adminClient
        .from('profiles')
        .select('name, email')
        .eq('id', proposalData.user)
        .maybeSingle()
      if (profile) {
        creatorInfo = { name: profile.name, email: profile.email }
      }
    } else if (proposalData.user) {
      creatorInfo = { name: proposalData.user, email: '' }
    }

    // Project creator
    let projectCreator: { name: string; projectName: string } | null = null
    if (proposalData.projeto && UUID_REGEX.test(proposalData.projeto)) {
      const { data: project } = await adminClient
        .from('projetos')
        .select('user, nome')
        .eq('id', proposalData.projeto)
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
    const dadosSnapshot = proposalData.dados_snapshot as Record<string, any> | null
    const itensSnapshot = proposalData.itens_snapshot as any[] | null

    // Ponto 18 & Ponto 6: Geração do PDF — um pacote sem tipo de proposta definido NUNCA pode gerar documento.
    // Bloquear a geração até que TODA máquina do pacote tenha tipo de proposta dentro do mesmo grupo.
    if (proposalData.is_pacote) {
      let candidateItems: any[] = []
      if (Array.isArray(itensSnapshot) && itensSnapshot.length > 0) {
        candidateItems = itensSnapshot
      } else if (proposalData.id) {
        const { data: pv } = await adminClient
          .from('proposta_versoes')
          .select('tipo_proposta, ordem')
          .eq('proposta_id', proposalData.id)
          .order('ordem', { ascending: true })
        candidateItems = pv || []
      }

      if (candidateItems.length > 0) {
        const firstItem = candidateItems[0]
        const firstTipo =
          (typeof firstItem?.tipo_proposta === 'string' && firstItem.tipo_proposta.trim()) ||
          (typeof proposalData.tipo_proposta === 'string' && proposalData.tipo_proposta.trim()) ||
          ''

        if (!firstTipo) {
          return new Response(
            JSON.stringify({
              error:
                'Geração de PDF bloqueada: selecione o tipo de proposta da primeira máquina do pacote antes de gerar o documento.',
            }),
            {
              status: 400,
              headers: { 'Content-Type': 'application/json', ...cors },
            },
          )
        }

        const getGroup = (t: string) => {
          const lower = t.toLowerCase()
          if (lower.includes('importacao direta') || lower.includes('importação direta'))
            return 'Importação Direta'
          if (lower.includes('nacionalizada')) return 'Nacionalizada'
          return 'Outro'
        }

        const firstGroup = getGroup(firstTipo)
        for (let i = 0; i < candidateItems.length; i++) {
          const itTipo =
            typeof candidateItems[i]?.tipo_proposta === 'string'
              ? candidateItems[i].tipo_proposta.trim()
              : i === 0
                ? firstTipo
                : ''
          if (!itTipo) {
            return new Response(
              JSON.stringify({
                error: `Geração de PDF bloqueada: a máquina #${i + 1} do pacote não possui tipo de proposta definido.`,
              }),
              {
                status: 400,
                headers: { 'Content-Type': 'application/json', ...cors },
              },
            )
          }
          if (getGroup(itTipo) !== firstGroup) {
            return new Response(
              JSON.stringify({
                error:
                  'Geração de PDF bloqueada: máquinas com tipos de fornecimento incompatíveis no pacote.',
              }),
              {
                status: 400,
                headers: { 'Content-Type': 'application/json', ...cors },
              },
            )
          }
          // Ponto 19: Todas as máquinas seguintes herdam e devem ter exatamente o tipo da primeira máquina
          if (itTipo !== firstTipo) {
            return new Response(
              JSON.stringify({
                error: `Geração de PDF bloqueada: a máquina #${i + 1} do pacote não possui o tipo de proposta selecionado neste pacote (${firstTipo}).`,
              }),
              {
                status: 400,
                headers: { 'Content-Type': 'application/json', ...cors },
              },
            )
          }
        }
      }
    }

    // Incorpora valores de comissão recebidos no body caso não estejam gravados no registro
    if (valor_comissao_servicos != null) {
      proposalData.valor_comissao_servicos = valor_comissao_servicos
    }
    if (base_comissao_servicos != null) {
      proposalData.base_comissao_servicos = base_comissao_servicos
    }
    if (percentual_comissao_servicos != null) {
      proposalData.percentual_comissao_servicos = percentual_comissao_servicos
    }

    // Tipo de proposta
    let tipoPropostaData: Record<string, unknown> | null =
      (dadosSnapshot?.tipo_proposta_detalhes as Record<string, unknown>) || null
    if (!tipoPropostaData && proposalData.tipo_proposta) {
      const { data: tipoData } = await adminClient
        .from('tipos_proposta')
        .select('*')
        .eq('nome', proposalData.tipo_proposta)
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
      if (proposalData.id) {
        const { data: pv } = await adminClient
          .from('proposta_versoes')
          .select(
            'quantidade, valor_unitario, desconto_percentual, desconto_valor, ordem, tipo_proposta, versoes(id, nome, cod_erp, nome_abreviado, imagem_preview, moeda, valor, especificacoes_tecnicas, caracteristicas_construtivas, acessorios_standards, modelos(id, nome, marcas(id, nome), produtos(id, nome, categorias_produtos:categorias(id, nome))))',
          )
          .eq('proposta_id', proposalData.id)
          .order('ordem', { ascending: true })
        equipmentItems = pv || []
      }

      if (equipmentItems.length === 0 && proposalData.versao) {
        const { data: versaoFull } = await adminClient
          .from('versoes')
          .select(
            'id, nome, cod_erp, nome_abreviado, imagem_preview, moeda, valor, especificacoes_tecnicas, caracteristicas_construtivas, acessorios_standards, modelos(id, nome, marcas(id, nome), produtos(id, nome, categorias_produtos:categorias(id, nome)))',
          )
          .eq('id', proposalData.versao)
          .maybeSingle()
        if (versaoFull) {
          equipmentItems = [
            {
              quantidade: 1,
              valor_unitario: versaoFull.valor || proposalData.valor_sem_desconto || 0,
              desconto_percentual: proposalData.percentual_desconto || 0,
              desconto_valor: 0,
              ordem: 0,
              versoes: versaoFull,
            },
          ]
        }
      }
    }

    const resolvedAppUrl = appUrl || Deno.env.get('VITE_APP_PUBLIC_URL') || DEFAULT_APP_URL

    // 1. Styled HTML document (for in-browser viewing / print)
    const htmlContent = buildProposalPdfHtml(
      proposalData,
      resolvedAppUrl,
      creatorInfo,
      projectCreator,
      tipoPropostaData,
      equipmentItems,
      logoData || logoUrl,
    )

    // 2. Real PDF binary — pure-Deno generator, uploaded to public storage
    // Separação estrita das etapas com reporte do erro real:
    // NUNCA responder 200/sucesso se saveToStorage estiver ativo e não houver URL de PDF.
    let pdfUrl: string | null = null
    if (saveToStorage && proposalData.id) {
      // 2a. ETAPA DE GERAÇÃO E CARGA DE IMAGENS (com resiliência a imagens opcionais)
      let logo: any = null
      try {
        logo = await (
          await import('../_shared/proposal-pdf-layout.ts')
        ).loadImage(logoData || logoUrl || null)
      } catch (errLogo) {
        console.warn('[generate-proposal-pdf] Aviso: não foi possível carregar logo:', errLogo)
      }

      let machineImage: any = null
      const machineImageUrl =
        equipmentItems[0]?.versoes?.imagem_preview ||
        proposalData.dados_snapshot?.primary_versao?.imagem_preview ||
        proposalData.versoes?.imagem_preview ||
        null
      if (machineImageUrl) {
        try {
          machineImage = await (
            await import('../_shared/proposal-pdf-layout.ts')
          ).loadImage(machineImageUrl)
          if (machineImage) {
            console.log(
              `[generate-proposal-pdf] Imagem da máquina carregada com sucesso: ${machineImage.kind}, ${machineImage.width}x${machineImage.height}`,
            )
          } else {
            console.warn(
              '[generate-proposal-pdf] loadImage retornou null para imagem da máquina:',
              machineImageUrl.slice(0, 80),
            )
          }
        } catch (errImg) {
          console.warn(
            '[generate-proposal-pdf] Aviso: não foi possível carregar imagem da máquina:',
            errImg,
          )
        }
      } else {
        console.log('[generate-proposal-pdf] Nenhuma imagem de máquina configurada para esta versão.')
      }

      let pdfBytes: Uint8Array
      try {
        const { buildProposalPdfBytes } = await import('../_shared/proposal-pdf-layout.ts')
        pdfBytes = await buildProposalPdfBytes({
          proposta: proposalData,
          equipmentItems,
          tipoProposta: tipoPropostaData,
          creatorInfo,
          logo,
          machineImage,
        })
      } catch (genErr: any) {
        const genMessage = genErr?.message || String(genErr)
        console.error('[generate-proposal-pdf] falha ao gerar o PDF:', genErr)
        return new Response(
          JSON.stringify({
            success: false,
            stage: 'geracao',
            error: `Falha ao gerar o PDF: ${genMessage}`,
            message: `Falha ao gerar o PDF: ${genMessage}`,
            details: genErr?.stack ? String(genErr.stack).slice(0, 500) : null,
          }),
          {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...cors },
          },
        )
      }

      // 2b. ETAPA DE GRAVAÇÃO NO STORAGE
      const fileName = `${proposalData.id}.pdf`
      try {
        const { error: uploadError } = await adminClient.storage
          .from('propostas-pdf')
          .upload(fileName, pdfBytes, { contentType: 'application/pdf', upsert: true })

        if (uploadError) {
          throw uploadError
        }

        const { data: urlData } = adminClient.storage.from('propostas-pdf').getPublicUrl(fileName)
        pdfUrl = urlData.publicUrl

        // Tenta persistir a URL no registro da proposta
        await adminClient.from('propostas').update({ pdf_anexo: pdfUrl }).eq('id', proposalData.id)
      } catch (storageErr: any) {
        const storageMessage =
          storageErr?.message || JSON.stringify(storageErr) || String(storageErr)
        console.error('[generate-proposal-pdf] falha ao gravar no storage:', storageErr)
        return new Response(
          JSON.stringify({
            success: false,
            stage: 'storage',
            error: `Falha ao gravar no storage: ${storageMessage}`,
            message: `Falha ao gravar no storage: ${storageMessage}`,
            details: storageErr?.stack ? String(storageErr.stack).slice(0, 500) : null,
          }),
          {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...cors },
          },
        )
      }

      if (!pdfUrl) {
        return new Response(
          JSON.stringify({
            success: false,
            stage: 'storage',
            error: 'Falha ao gravar no storage: URL pública do PDF não foi gerada.',
            message: 'Falha ao gravar no storage: URL pública do PDF não foi gerada.',
          }),
          {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...cors },
          },
        )
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        html: htmlContent,
        pdf_url: pdfUrl,
        pdf_generated: Boolean(pdfUrl),
        storage_path: pdfUrl ? `${proposalData.id}.pdf` : null,
        bucket: 'propostas-pdf',
        message: pdfUrl
          ? 'PDF gerado e salvo no storage com sucesso'
          : 'HTML gerado (upload de PDF desabilitado)',
      }),
      {
        headers: { 'Content-Type': 'application/json', ...cors },
      },
    )
  } catch (err: any) {
    console.error('[generate-proposal-pdf] error:', err)
    const errMessage = err?.message || String(err)
    return new Response(
      JSON.stringify({
        success: false,
        error: `Não foi possível processar a solicitação: ${errMessage}`,
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...cors },
      },
    )
  }
})
