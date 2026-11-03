/**
 * Local verification harness (not part of the deployed bundle).
 *
 * Imports the real generator (supabase/functions/_shared/proposal-pdf-layout.ts),
 * builds a multi-page proposal PDF with deterministic sample data and asserts:
 *   1. every page's content stream contains the full header (logo draw or
 *      "BENER" text, company name, city/date, offer box labels, divider line);
 *   2. no page contains "Página 0 de 0";
 *   3. exactly one "Página X de Y" per page, correct totals;
 *   4. the assembled PDF is byte-sane (header, %%EOF, page count in /Count).
 */
import { buildProposalPdfBytes } from '../supabase/functions/_shared/proposal-pdf-layout.ts'
import { writeFileSync, mkdirSync } from 'node:fs'

// Decode the assembled PDF just enough to inspect each page's content stream:
// find "stream ... endstream" pairs (page content streams contain text operators).
function extractPageStreams(pdfBytes) {
  const text = new TextDecoder('latin1').decode(pdfBytes)
  const streams = []
  const re = /stream\n([\s\S]*?)\nendstream/g
  let m = null
  while ((m = re.exec(text)) !== null) {
    const body = m[1]
    // Page content streams contain text-show operators; image streams are binary.
    if (body.includes('Tj') || body.includes('BT')) streams.push(body)
  }
  return streams
}

const counts = (s, needle) => s.split(needle).length - 1

const specText = Array.from(
  { length: 120 },
  (_, i) => `Parágrafo técnico ${i + 1}: especificação de máquina com detalhes e medidas.`,
).join('\n')

const proposta = {
  numero_proposta: 'PROP-2026-142-A',
  revisao: '',
  dt_cad: '2026-11-03',
  moeda: 'BRL',
  valor_final: 150000,
  valor_sem_desconto: 160000,
  percentual_desconto: 6.25,
  is_pacote: false,
  especificacoes_tecnicas: specText,
  cliente_original: 'Cliente Exemplo Ltda.',
  clientes: { razao_social: 'Cliente Exemplo Ltda.', cidade: 'Campinas', estado: 'SP' },
  representantes: { sigla: 'BEN' },
}

const equipmentItems = [
  {
    quantidade: 1,
    valor_unitario: 160000,
    desconto_percentual: 6.25,
    desconto_valor: 0,
    tipo_proposta: 'Nacionalizada',
    versoes: { nome: 'Máquina Exemplo 2000', moeda: 'BRL' },
  },
]

const bytes = await buildProposalPdfBytes({
  proposta,
  equipmentItems,
  tipoProposta: null,
  creatorInfo: { name: 'Teste', email: 'teste@teste.com' },
  logo: null,
  machineImage: null,
})

// Sanity of the container
const fullText = new TextDecoder('latin1').decode(bytes)
if (!fullText.startsWith('%PDF-1.4')) throw new Error('missing %PDF header')
if (!fullText.trimEnd().endsWith('%%EOF')) throw new Error('missing %%EOF')
const countMatch = fullText.match(/\/Count (\d+)/)
const pageCount = countMatch ? Number(countMatch[1]) : 0
const kids = fullText.match(/\/Kids \[([^\]]*)\]/)
if (!kids) throw new Error('missing /Kids')
const kidCount = kids[1].split(' 0 R').filter((s) => s.trim()).length
if (pageCount !== kidCount) throw new Error(`/Count ${pageCount} != /Kids ${kidCount}`)

const pages = extractPageStreams(bytes)
if (pages.length !== pageCount)
  throw new Error(`extracted ${pages.length} content streams, /Count says ${pageCount}`)

let failures = 0
const check = (label, ok) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`)
  if (!ok) failures++
}

pages.forEach((content, i) => {
  const n = i + 1
  const hasHeader =
    content.includes('Bener Comercial Importadora Exportadora Ltda.') &&
    content.includes('Vinhedo,') &&
    content.includes('Sigla') &&
    content.includes('Oferta') &&
    content.includes('Mês') &&
    content.includes('Ano')
  const hasDivider = /1\.1 w/.test(content)
  const pageNumOccurrences = counts(content, 'Página ')
  const zeroPages = content.includes('Página 0 de 0')
  const correctNum = content.includes(`Página ${n} de ${pages.length}`)
  check(`page ${n}: full header present`, hasHeader)
  check(`page ${n}: bottom divider line present`, hasDivider)
  check(`page ${n}: no "Página 0 de 0"`, !zeroPages)
  check(
    `page ${n}: exactly one pagination marker and it is correct`,
    pageNumOccurrences === 1 && correctNum,
  )
})

const last = pages[pages.length - 1]
check(
  'last page: institutional footer lines present',
  last.includes('Rua Iracema Lucas') &&
    last.includes('Vinhedo - SP - Brasil') &&
    last.includes('vendas@bener.com.br'),
)

mkdirSync('tmp', { recursive: true })
writeFileSync('tmp/proposal-test.pdf', bytes)
console.log(`\nWrote tmp/proposal-test.pdf (${bytes.length} bytes, ${pageCount} pages)`)
if (failures > 0) {
  console.error(`${failures} check(s) FAILED`)
  process.exit(1)
}
console.log('All checks passed.')
