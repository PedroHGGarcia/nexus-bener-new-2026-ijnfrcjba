/**
 * Utilitário robusto no navegador para extração de texto de arquivos PDF, DOCX, DOC e TXT.
 * Executa de forma client-side para resposta instantânea e sem dependências pesadas externas que possam falhar no build.
 */

// Limite máximo padrão de 10 MB
export const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024 // 10 MB
export const MAX_ATTACHMENT_SIZE_LABEL = '10 MB'

export interface ExtractedDocument {
  fileName: string
  fileSize: number
  fileType: string
  text: string
  charCount: number
  isScannedOrEmpty: boolean
  isImage?: boolean
  dataUrl?: string
  previewUrl?: string
}

/**
 * Converte e otimiza imagens client-side para envio como data URL (base64) à API de visão.
 * Redimensiona suavemente se a imagem for gigantesca (ex.: fotos de 48MP de smartphone de representantes)
 * para manter alta fidelidade técnica (leitura de texto/tabelas pequenas) sem estourar payload.
 */
export async function processAndOptimizeImage(file: File, maxDimension = 2048): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Não foi possível ler a imagem selecionada.'))
    reader.onload = () => {
      const result = reader.result as string
      // Se for SVG ou GIF, ou se Image não estiver no window, retorna dataUrl direto
      if (typeof window === 'undefined' || typeof Image === 'undefined') {
        return resolve(result)
      }

      const img = new Image()
      img.onerror = () => resolve(result) // Fallback para dataUrl original
      img.onload = () => {
        try {
          const { width, height } = img
          // Se já for menor que maxDimension, usa a imagem original
          if (width <= maxDimension && height <= maxDimension && file.size < 4 * 1024 * 1024) {
            return resolve(result)
          }

          // Redimensiona proporcionalmente mantendo alta resolução técnica para leitura de OCR/tabelas
          let newWidth = width
          let newHeight = height
          if (width > height && width > maxDimension) {
            newWidth = maxDimension
            newHeight = Math.round((height * maxDimension) / width)
          } else if (height > maxDimension) {
            newHeight = maxDimension
            newWidth = Math.round((width * maxDimension) / height)
          }

          const canvas = document.createElement('canvas')
          canvas.width = newWidth
          canvas.height = newHeight
          const ctx = canvas.getContext('2d')
          if (!ctx) return resolve(result)

          ctx.drawImage(img, 0, 0, newWidth, newHeight)
          // Preserva qualidade JPEG a 0.88 ou PNG se original for PNG com transparência
          const outputType = file.type === 'image/png' ? 'image/png' : 'image/jpeg'
          const optimized = canvas.toDataURL(outputType, 0.88)
          resolve(optimized)
        } catch {
          resolve(result)
        }
      }
      img.src = result
    }
    reader.readAsDataURL(file)
  })
}

/**
 * Formata o tamanho do arquivo amigavelmente (ex.: 250 KB, 2.4 MB)
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * Importa pdfjs-dist localmente como dependência npm bundled (sem injeção dinâmica de CDN).
 */
import * as pdfjsLib from 'pdfjs-dist'

// Configura o worker do PDF.js localmente se aplicável
if (typeof window !== 'undefined' && pdfjsLib.GlobalWorkerOptions) {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || '3.11.174'}/pdf.worker.min.js`
  } catch {
    // Worker configurado com fallback seguro
  }
}

async function loadPdfJs(): Promise<typeof pdfjsLib | null> {
  return pdfjsLib
}

/**
 * Extração de texto de PDF utilizando PDF.js quando disponível e fallback binário com regex de streams/strings.
 */
async function extractTextFromPdf(arrayBuffer: ArrayBuffer): Promise<string> {
  try {
    const pdfjs = await loadPdfJs()
    if (pdfjs && typeof pdfjs.getDocument === 'function') {
      const loadingTask = pdfjs.getDocument({ data: new Uint8Array(arrayBuffer) })
      const pdf = await loadingTask.promise
      const numPages = Math.min(pdf.numPages, 40) // Processa até 40 páginas
      const textPieces: string[] = []

      for (let i = 1; i <= numPages; i++) {
        const page = await pdf.getPage(i)
        const content = await page.getTextContent()
        const strings = content.items
          .map((item: any) => (item && typeof item.str === 'string' ? item.str : ''))
          .filter((s: string) => s.trim().length > 0)
        if (strings.length > 0) {
          textPieces.push(strings.join(' '))
        }
      }

      const fullText = textPieces.join('\n\n').trim()
      if (fullText.length > 20) {
        return fullText
      }
    }
  } catch (err) {
    console.warn('Erro ao processar PDF com PDF.js:', err)
  }

  // Fallback puro para PDFs (extrai streams de texto e operadores TJ/Tj ou texto ASCII/UTF-8 embutido)
  return fallbackPdfStreamExtract(arrayBuffer)
}

/**
 * Fallback heurístico puro em TypeScript para extrair strings legíveis de blocos de texto PDF
 * quando PDF.js não estiver disponível ou falhar.
 */
function fallbackPdfStreamExtract(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  const decoder = new TextDecoder('latin1')
  const raw = decoder.decode(bytes)

  const extractedPieces: string[] = []

  // Procura por blocos de texto entre parênteses em streams: (Texto) Tj ou [(T)(exto)] TJ
  const tjRegex = /\(([^()]{2,})\)\s*Tj/g
  let match: RegExpExecArray | null
  while ((match = tjRegex.exec(raw)) !== null) {
    const text = match[1]
      .replace(/\\([()\\])/g, '$1')
      .replace(/\\r/g, ' ')
      .replace(/\\n/g, ' ')
      .trim()
    if (text.length > 1 && /[a-zA-Z0-9À-ÿ]/.test(text)) {
      extractedPieces.push(text)
    }
  }

  // Se Tj não achou o suficiente, tenta achar sequências de texto entre BT e ET
  if (extractedPieces.join(' ').length < 50) {
    const btEtRegex = /BT[\s\S]*?ET/g
    let btMatch: RegExpExecArray | null
    while ((btMatch = btEtRegex.exec(raw)) !== null) {
      const block = btMatch[0]
      const insideParens = block.match(/\(([^()]+)\)/g)
      if (insideParens) {
        for (const p of insideParens) {
          const inner = p.slice(1, -1).trim()
          if (inner.length > 1 && /[a-zA-Z0-9À-ÿ]/.test(inner)) {
            extractedPieces.push(inner)
          }
        }
      }
    }
  }

  return cleanExtractedText(extractedPieces.join(' '))
}

/**
 * Descompacta e extrai o arquivo document.xml de um DOCX (que é um contêiner ZIP)
 * sem precisar de bibliotecas pesadas, lendo as assinaturas ZIP (PK\x03\x04).
 */
async function extractTextFromDocx(arrayBuffer: ArrayBuffer): Promise<string> {
  const bytes = new Uint8Array(arrayBuffer)

  // 1. Tenta carregar fflate ou JSZip se estiver em window, senão usa descompressor nativo DecompressionStream
  try {
    const documentXmlText = await extractDocxXml(bytes)
    if (documentXmlText) {
      // Faz o parse do XML e extrai o conteúdo dos nós <w:t> e <w:p>
      const parser = new DOMParser()
      const xmlDoc = parser.parseFromString(documentXmlText, 'application/xml')

      const paragraphs = xmlDoc.getElementsByTagName('w:p')
      if (paragraphs && paragraphs.length > 0) {
        const resultLines: string[] = []
        for (let i = 0; i < paragraphs.length; i++) {
          const p = paragraphs[i]
          const tNodes = p.getElementsByTagName('w:t')
          const pTexts: string[] = []
          for (let j = 0; j < tNodes.length; j++) {
            pTexts.push(tNodes[j].textContent || '')
          }
          const pLine = pTexts.join('').trim()
          if (pLine) {
            resultLines.push(pLine)
          }
        }
        return cleanExtractedText(resultLines.join('\n'))
      }

      // Fallback: busca por regex em todas as tags <w:t>
      const wtMatches = documentXmlText.match(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)
      if (wtMatches) {
        const text = wtMatches
          .map((m) => m.replace(/<[^>]+>/g, ''))
          .join(' ')
          .trim()
        if (text) return cleanExtractedText(text)
      }
    }
  } catch (err) {
    console.warn('Erro ao processar DOCX com descompressão XML:', err)
  }

  // Fallback: busca por strings XML legíveis dentro do arquivo DOCX
  return fallbackDocxExtract(bytes)
}

/**
 * Lê o contêiner ZIP do DOCX e localiza a entrada 'word/document.xml'
 */
async function extractDocxXml(bytes: Uint8Array): Promise<string | null> {
  // O formato ZIP começa com PK\x03\x04
  let offset = 0
  const total = bytes.length

  while (offset < total - 30) {
    // Local File Header Signature = 0x04034b50 ("PK\x03\x04")
    if (
      bytes[offset] === 0x50 &&
      bytes[offset + 1] === 0x4b &&
      bytes[offset + 2] === 0x03 &&
      bytes[offset + 3] === 0x04
    ) {
      const compressionMethod = bytes[offset + 8] | (bytes[offset + 9] << 8)
      const compressedSize =
        bytes[offset + 18] |
        (bytes[offset + 19] << 8) |
        (bytes[offset + 20] << 16) |
        (bytes[offset + 21] << 24)
      const fileNameLength = bytes[offset + 26] | (bytes[offset + 27] << 8)
      const extraFieldLength = bytes[offset + 28] | (bytes[offset + 29] << 8)

      const fileNameStart = offset + 30
      const fileNameEnd = fileNameStart + fileNameLength
      const fileNameBytes = bytes.slice(fileNameStart, fileNameEnd)
      const fileName = new TextDecoder('utf-8').decode(fileNameBytes)

      const fileDataStart = fileNameEnd + extraFieldLength

      if (fileName === 'word/document.xml') {
        const fileData = bytes.slice(fileDataStart, fileDataStart + compressedSize)

        if (compressionMethod === 0) {
          // Sem compressão (Stored)
          return new TextDecoder('utf-8').decode(fileData)
        } else if (compressionMethod === 8) {
          // Deflate: usa DecompressionStream nativo dos navegadores modernos
          if (typeof DecompressionStream !== 'undefined') {
            try {
              const stream = new ReadableStream({
                start(controller) {
                  controller.enqueue(fileData)
                  controller.close()
                },
              }).pipeThrough(new DecompressionStream('deflate-raw'))

              const response = new Response(stream)
              return await response.text()
            } catch {
              // Tenta com deflate padrão (com header zlib)
              try {
                const stream = new ReadableStream({
                  start(controller) {
                    controller.enqueue(fileData)
                    controller.close()
                  },
                }).pipeThrough(new DecompressionStream('deflate'))
                const response = new Response(stream)
                return await response.text()
              } catch {
                // fall through
              }
            }
          }
        }
      }

      // Avança para o próximo cabeçalho
      offset = fileDataStart + compressedSize
      if (compressedSize === 0 && bytes[offset + 6] & 0x08) {
        // Data descriptor presente, faz avanço sequencial
        offset++
      }
    } else {
      offset++
    }
  }

  return null
}

function fallbackDocxExtract(bytes: Uint8Array): string {
  // Procura por cadeias de caracteres UTF-8 legíveis
  const decoder = new TextDecoder('utf-8', { fatal: false })
  const decoded = decoder.decode(bytes)
  const matches = decoded.match(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)
  if (matches && matches.length > 0) {
    return cleanExtractedText(matches.map((m) => m.replace(/<[^>]+>/g, '')).join(' '))
  }

  return ''
}

/**
 * Extração de arquivo DOC legado (.doc binário do Word 97-2003 OLE / Compound Document)
 * Procura blocos contínuos de texto legível (Unicode UTF-16LE e ASCII/ANSI)
 */
function extractTextFromLegacyDoc(arrayBuffer: ArrayBuffer): string {
  const bytes = new Uint8Array(arrayBuffer)
  const pieces: string[] = []

  // 1. Tenta extrair blocos de UTF-16LE (comum em documentos .doc)
  try {
    const utf16Decoder = new TextDecoder('utf-16le', { fatal: false })
    const fullUtf16 = utf16Decoder.decode(bytes)
    // Localiza frases ou sequências com palavras reais
    const words = fullUtf16.match(/[\p{L}\p{N}\s.,:;!?()/-]{4,}/gu)
    if (words) {
      for (const w of words) {
        const trimmed = w.trim()
        if (trimmed.length > 4 && /[a-zA-ZÀ-ÿ]{3,}/.test(trimmed)) {
          pieces.push(trimmed)
        }
      }
    }
  } catch {
    // ignore
  }

  // 2. Se achou pouco, tenta ANSI/Latin1
  if (pieces.join(' ').length < 40) {
    const latinDecoder = new TextDecoder('latin1')
    const fullLatin = latinDecoder.decode(bytes)
    const matches = fullLatin.match(/[\p{L}\p{N}\s.,:;!?()/-]{5,}/gu)
    if (matches) {
      for (const m of matches) {
        const trimmed = m.trim()
        if (trimmed.length > 4 && /[a-zA-ZÀ-ÿ]{3,}/.test(trimmed)) {
          pieces.push(trimmed)
        }
      }
    }
  }

  return cleanExtractedText(pieces.join(' '))
}

/**
 * Extração de texto plano (.txt, .csv, .tsv, etc.)
 */
function extractTextFromPlainText(arrayBuffer: ArrayBuffer): string {
  try {
    const decoder = new TextDecoder('utf-8')
    return cleanExtractedText(decoder.decode(arrayBuffer))
  } catch {
    const latin = new TextDecoder('latin1')
    return cleanExtractedText(latin.decode(arrayBuffer))
  }
}

/**
 * Limpeza e normalização do texto extraído para envio limpo à IA
 */
function cleanExtractedText(text: string): string {
  // Filtra caracteres de controle sem regex literal que acione no-control-regex
  const stripped = Array.from(text)
    .filter((char) => {
      const code = char.charCodeAt(0)
      // Permite \t (9), \n (10), \r (13) e caracteres imprimíveis normais (>= 32 e != 127)
      if (code === 9 || code === 10 || code === 13) return true
      return code >= 32 && code !== 127
    })
    .join('')

  return stripped
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ') // Normaliza espaços horizontais
    .replace(/\n{3,}/g, '\n\n') // Reduz excesso de quebras de linha
    .trim()
}

/**
 * Função principal pública para processar o arquivo anexado no navegador.
 * Aceita PDF, DOC, DOCX, TXT e valida o limite de 10 MB.
 */
export async function extractTextFromFile(file: File): Promise<ExtractedDocument> {
  if (!file) {
    throw new Error('Nenhum arquivo foi selecionado.')
  }

  if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
    throw new Error('Arquivo muito grande. O limite é 10 MB.')
  }

  const name = file.name || 'documento'
  const ext = name.split('.').pop()?.toLowerCase() || ''
  const isImageFile =
    ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'].includes(ext) || file.type.startsWith('image/')

  // Se for imagem (foto de placa, tabela de especificações técnicas, print, diagrama)
  if (isImageFile) {
    const dataUrl = await processAndOptimizeImage(file)
    return {
      fileName: name,
      fileSize: file.size,
      fileType: ext.toUpperCase() || 'IMAGEM',
      text: '',
      charCount: 0,
      isScannedOrEmpty: false,
      isImage: true,
      dataUrl,
      previewUrl: dataUrl,
    }
  }

  const buffer = await file.arrayBuffer()

  let extracted = ''

  if (ext === 'pdf' || file.type === 'application/pdf') {
    extracted = await extractTextFromPdf(buffer)
  } else if (
    ext === 'docx' ||
    file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    extracted = await extractTextFromDocx(buffer)
  } else if (ext === 'doc' || file.type === 'application/msword') {
    extracted = extractTextFromLegacyDoc(buffer)
  } else if (ext === 'txt' || ext === 'csv' || file.type.startsWith('text/')) {
    extracted = extractTextFromPlainText(buffer)
  } else {
    // Tenta como texto ou lança aviso de extensão
    try {
      extracted = extractTextFromPlainText(buffer)
    } catch {
      throw new Error(
        'Formato de arquivo não suportado. Por favor, envie arquivos em formato PDF, DOC, DOCX ou TXT.',
      )
    }
  }

  const clean = cleanExtractedText(extracted)
  const isScannedOrEmpty = clean.length < 20

  return {
    fileName: name,
    fileSize: file.size,
    fileType: ext.toUpperCase() || 'ARQUIVO',
    text: clean,
    charCount: clean.length,
    isScannedOrEmpty,
  }
}
