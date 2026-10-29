// Deno Edge Runtime
import { getCorsHeaders } from '../_shared/cors.ts'

// Ponto 1: Cotação de Fechamento PTAX do Banco Central do Brasil (Olinda)
// Busca retroativa para encontrar o último dia útil de fechamento publicado (pula fins de semana e feriados)
interface PtaxResult {
  rate: number
  refDate: string // DD/MM/AAAA
  dataHoraCotacao: string
}

function formatDateForOlinda(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `'${mm}-${dd}-${yyyy}'`
}

function formatBrDate(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${dd}/${mm}/${yyyy}`
}

async function fetchBcbPtaxClosing(moeda: 'USD' | 'EUR' | 'JPY'): Promise<PtaxResult | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 4000)

  try {
    // Calculamos janela dos últimos 10 dias corridos retrocedendo a partir de ontem
    // O fechamento deve ser SEMPRE do dia útil anterior (nunca intraday de hoje)
    const end = new Date()
    end.setDate(end.getDate() - 1) // Inicia no dia útil anterior a hoje

    const start = new Date(end)
    start.setDate(start.getDate() - 10) // 10 dias retroativos para cobrir feriados longos/fins de semana

    const dataInicial = formatDateForOlinda(start)
    const dataFinalCotacao = formatDateForOlinda(end)

    // API Olinda PTAX v1: CotacaoMoedaPeriodo (funciona tanto para USD quanto EUR e outras moedas PTAX)
    // Ordena de forma decrescente para pegar o último boletim de fechamento publicado
    const url = `https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoMoedaPeriodo(moeda=@moeda,dataInicial=@dataInicial,dataFinalCotacao=@dataFinalCotacao)?@moeda='${moeda}'&@dataInicial=${dataInicial}&@dataFinalCotacao=${dataFinalCotacao}&$top=20&$orderby=dataHoraCotacao%20desc&$format=json`

    const res = await fetch(url, { signal: controller.signal })
    clearTimeout(timer)
    if (!res.ok) return null
    const json = await res.json()
    const values: any[] = json?.value || []
    if (values.length === 0) return null

    // Procura prioritariamente boletim de Fechamento ou tipoBoletim com fechamento
    // No BCB, tipoBoletim pode ser 'Fechamento' ou 'FECHAMENTO', ou pegamos o registro do dia mais recente
    const fechamentoItem =
      values.find((v) =>
        String(v.tipoBoletim || '')
          .toLowerCase()
          .includes('fecha'),
      ) || values[0]

    const rate = Number(fechamentoItem?.cotacaoVenda || fechamentoItem?.cotacaoCompra || 0)
    if (!rate || isNaN(rate)) return null

    // Extrai data de referência do registro do BCB
    let refDate = ''
    if (fechamentoItem.dataHoraCotacao) {
      const parts = String(fechamentoItem.dataHoraCotacao).split(' ')
      const datePart = parts[0] // YYYY-MM-DD
      if (datePart && datePart.includes('-')) {
        const [y, m, d] = datePart.split('-')
        refDate = `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`
      }
    }
    if (!refDate) {
      refDate = formatBrDate(end)
    }

    return {
      rate: Number(rate.toFixed(4)),
      refDate,
      dataHoraCotacao: fechamentoItem.dataHoraCotacao || new Date().toISOString(),
    }
  } catch {
    clearTimeout(timer)
    return null
  }
}

// Fallback AwesomeAPI (caso Olinda falhe completamente)
async function fetchAwesomeFallback(): Promise<{
  rates: {
    USD: { rate: number; pctChange: number; refDate: string }
    EUR: { rate: number; pctChange: number; refDate: string }
    JPY: { rate: number; pctChange: number; refDate: string }
  }
  source: string
  refDate: string
}> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 3500)
  try {
    const response = await fetch(
      'https://economia.awesomeapi.com.br/last/USD-BRL,EUR-BRL,JPY-BRL',
      {
        signal: controller.signal,
      },
    )
    clearTimeout(timer)
    if (!response.ok) {
      throw new Error(`Upstream API returned ${response.status}`)
    }
    const data = await response.json()
    const usdBid = data.USDBRL ? parseFloat(data.USDBRL.bid) : 0
    const eurBid = data.EURBRL ? parseFloat(data.EURBRL.bid) : 0
    const jpyBid = data.JPYBRL ? parseFloat(data.JPYBRL.bid) : 0
    const usdPct = data.USDBRL ? parseFloat(data.USDBRL.pctChange) : 0
    const eurPct = data.EURBRL ? parseFloat(data.EURBRL.pctChange) : 0
    const jpyPct = data.JPYBRL ? parseFloat(data.JPYBRL.pctChange) : 0

    if (!usdBid || !eurBid || !jpyBid) {
      throw new Error('Invalid rate data from upstream')
    }

    // Calcula dia útil anterior padrão
    const d = new Date()
    d.setDate(d.getDate() - 1)
    if (d.getDay() === 0) d.setDate(d.getDate() - 2) // domingo -> sexta
    if (d.getDay() === 6) d.setDate(d.getDate() - 1) // sábado -> sexta
    const fallbackDate = formatBrDate(d)

    return {
      rates: {
        USD: { rate: Number(usdBid.toFixed(4)), pctChange: usdPct, refDate: fallbackDate },
        EUR: { rate: Number(eurBid.toFixed(4)), pctChange: eurPct, refDate: fallbackDate },
        JPY: { rate: Number(jpyBid.toFixed(4)), pctChange: jpyPct, refDate: fallbackDate },
      },
      source: 'economia.awesomeapi.com.br (fallback de contingência)',
      refDate: fallbackDate,
    }
  } catch (e) {
    clearTimeout(timer)
    throw e
  }
}

Deno.serve(async (req: Request) => {
  const cors = getCorsHeaders(req)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors })
  }

  try {
    // 1. Tentar Banco Central do Brasil (Olinda) - Fechamento PTAX dia útil anterior
    const [usdPtax, eurPtax, jpyPtax] = await Promise.all([
      fetchBcbPtaxClosing('USD'),
      fetchBcbPtaxClosing('EUR'),
      fetchBcbPtaxClosing('JPY'),
    ])

    if (usdPtax && eurPtax && jpyPtax) {
      const refDate = usdPtax.refDate || eurPtax.refDate || jpyPtax.refDate
      return new Response(
        JSON.stringify({
          rates: {
            USD: { rate: usdPtax.rate, pctChange: 0, refDate: usdPtax.refDate },
            EUR: { rate: eurPtax.rate, pctChange: 0, refDate: eurPtax.refDate },
            JPY: { rate: jpyPtax.rate, pctChange: 0, refDate: jpyPtax.refDate },
          },
          refDate,
          timestamp: usdPtax.dataHoraCotacao || new Date().toISOString(),
          source: 'Banco Central do Brasil - PTAX Fechamento (Olinda)',
          isOfficialPtax: true,
        }),
        {
          headers: { 'Content-Type': 'application/json', Connection: 'keep-alive', ...cors },
        },
      )
    }

    // Se USD e EUR deram certo mas JPY falhou pontualmente, ou vice-versa, tenta complementar com AwesomeAPI
    if (usdPtax && eurPtax) {
      let jpyFallbackRate = 0.038
      let jpyRefDate = usdPtax.refDate
      try {
        const awesome = await fetchAwesomeFallback()
        jpyFallbackRate = awesome.rates.JPY.rate
        jpyRefDate = awesome.rates.JPY.refDate
      } catch {
        // mantém estimativa segura
      }
      return new Response(
        JSON.stringify({
          rates: {
            USD: { rate: usdPtax.rate, pctChange: 0, refDate: usdPtax.refDate },
            EUR: { rate: eurPtax.rate, pctChange: 0, refDate: eurPtax.refDate },
            JPY: {
              rate: jpyPtax?.rate ?? jpyFallbackRate,
              pctChange: 0,
              refDate: jpyPtax?.refDate ?? jpyRefDate,
            },
          },
          refDate: usdPtax.refDate,
          timestamp: usdPtax.dataHoraCotacao || new Date().toISOString(),
          source: 'Banco Central do Brasil - PTAX Fechamento (Olinda)',
          isOfficialPtax: true,
        }),
        {
          headers: { 'Content-Type': 'application/json', Connection: 'keep-alive', ...cors },
        },
      )
    }

    // 2. Se BCB falhar, contingência AwesomeAPI com aviso de contingência
    const fallback = await fetchAwesomeFallback()
    return new Response(
      JSON.stringify({
        rates: fallback.rates,
        refDate: fallback.refDate,
        timestamp: new Date().toISOString(),
        source: fallback.source,
        isOfficialPtax: false,
        warning: 'Cotação obtida via contingência, não foi possível contatar Olinda BCB.',
      }),
      {
        headers: { 'Content-Type': 'application/json', Connection: 'keep-alive', ...cors },
      },
    )
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Falha na cotação upstream'
    return new Response(
      JSON.stringify({
        error: 'Serviço de câmbio indisponível no momento.',
        detail: errorMsg,
      }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json', Connection: 'keep-alive', ...cors },
      },
    )
  }
})
