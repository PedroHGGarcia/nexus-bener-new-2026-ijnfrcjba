import { buildProposalPdfBytes, loadImage, type LoadedImg } from './proposal-pdf-layout.ts'

export { buildProposalPdfBytes, loadImage }
export type { LoadedImg }

interface ProposalData {
  id?: string
  numero_proposta?: string | null
  revisao?: string | null
  dt_cad?: string | null
  status?: string | null
  cliente_original?: string | null
  contato?: string | null
  telefone?: string | null
  versao_original?: string | null
  tipo_proposta?: string | null
  moeda?: string | null
  valor_sem_desconto?: number | null
  percentual_desconto?: number | null
  valor_final?: number | null
  condicoes_pagamento?: string | null
  prazo_entrega?: string | null
  validade_oferta?: string | null
  descricao_proposta?: string | null
  nome_gerente_produto?: string | null
  nome_assessor_tecnico?: string | null
  nome_representante_comercial?: string | null
  pdf_anexo?: string | null
  transporte_seguro?: string | null
  imposto_ipi?: number | null
  imposto_icms?: number | null
  cobertura_garantia?: string | null
  garantia_acessorios?: string | null
  assistencia_tecnica_detalhada?: string | null
}

interface EquipmentItem {
  quantidade?: number | null
  valor_unitario?: number | null
  desconto_percentual?: number | null
  desconto_valor?: number | null
  versoes?: {
    nome?: string | null
    cod_erp?: string | null
    nome_abreviado?: string | null
    moeda?: string | null
    imagem_preview?: string | null
    especificacoes_tecnicas?: string | null
    caracteristicas_construtivas?: string | null
    acessorios_standards?: string | null
    modelos?: {
      nome?: string | null
      marcas?: { nome?: string | null } | null
      produtos?: { nome?: string | null } | null
    } | null
  } | null
}

const BUCKET = 'propostas-pdf'

export async function generateAndUploadProposalPdf(
  adminClient: any,
  propostaId: string,
  proposal: ProposalData & Record<string, any>,
  equipmentItems: EquipmentItem[] = [],
  tipoProposta?: Record<string, unknown> | null,
  creatorInfo?: { name: string; email: string } | null,
  logoDataUrl?: string | null,
): Promise<{ pdfUrl: string; pdfBytes: Uint8Array }> {
  // Carrega logo e imagem da máquina de forma resiliente:
  // se falhar o download ou decodificação da imagem, não derruba a geração do PDF
  let logo: LoadedImg = null
  try {
    logo = await loadImage(logoDataUrl || null)
  } catch (errLogo) {
    console.warn('[pdf-generator] Falha não impeditiva ao carregar logo:', errLogo)
  }

  let machineImage: LoadedImg = null
  const machineImageUrl =
    equipmentItems[0]?.versoes?.imagem_preview || proposal.versoes?.imagem_preview || null
  if (machineImageUrl) {
    try {
      machineImage = await loadImage(machineImageUrl)
    } catch (errImg) {
      console.warn('[pdf-generator] Falha não impeditiva ao carregar imagem da máquina:', errImg)
    }
  }

  // ETAPA 1: Construção do PDF em memória
  let pdfBytes: Uint8Array
  try {
    pdfBytes = await buildProposalPdfBytes({
      proposta: proposal,
      equipmentItems,
      tipoProposta,
      creatorInfo,
      logo,
      machineImage,
    })
  } catch (errBuild: any) {
    const msg = errBuild?.message || String(errBuild)
    throw new Error(`falha ao gerar o PDF: ${msg}`)
  }

  // ETAPA 2: Gravação no Storage
  const fileName = `${propostaId}.pdf`
  let uploadError: any = null
  try {
    const uploadRes = await adminClient.storage
      .from(BUCKET)
      .upload(fileName, pdfBytes, { contentType: 'application/pdf', upsert: true })
    uploadError = uploadRes.error
  } catch (errStorage: any) {
    const msg = errStorage?.message || String(errStorage)
    throw new Error(`falha ao gravar no storage: ${msg}`)
  }

  if (uploadError) {
    throw new Error(
      `falha ao gravar no storage: ${uploadError.message || JSON.stringify(uploadError)}`,
    )
  }

  let pdfUrl: string
  try {
    const { data: urlData } = adminClient.storage.from(BUCKET).getPublicUrl(fileName)
    pdfUrl = urlData.publicUrl

    // Persist the URL on the proposal row for later retrieval
    await adminClient.from('propostas').update({ pdf_anexo: pdfUrl }).eq('id', propostaId)
  } catch (errPersist: any) {
    console.warn('[pdf-generator] Aviso: erro ao atualizar pdf_anexo na proposta:', errPersist)
    // Se o upload foi bem sucedido mas falhou apenas o update, ainda temos a publicUrl
    const { data: urlData } = adminClient.storage.from(BUCKET).getPublicUrl(fileName)
    pdfUrl = urlData.publicUrl
  }

  return { pdfUrl, pdfBytes }
}
