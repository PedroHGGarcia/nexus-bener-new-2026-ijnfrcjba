import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { getCorsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req: Request) => {
  const cors = getCorsHeaders(req)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors })
  }

  // 1. Tentar Banco Central do Brasil (Olinda) com timeout de ~2.5s
  async function fetchBcbRates(): Promise<{
    rates: { USD: { rate: number; pctChange: number }; EUR: { rate: number; pctChange: number } }
    source: string
  } | null> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 2500)
    try {
      const today = new Date()
      // Formata MM-DD-YYYY para a API Olinda
      const mm = String(today.getMonth() + 1).padStart(2, '0')
      const dd = String(today.getDate()).padStart(2, '0')
      const yyyy = today.getFullYear()
      const dataFormatada = `'${mm}-${dd}-${yyyy}'`

      // Consulta cotações de fechamento do dia (ou última cotação)
      const url = `https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoMoedaDia(moeda=@moeda,dataCotacao=@dataCotacao)?@moeda='USD'&@dataCotacao=${dataFormatada}&$top=1&$orderby=dataHoraCotacao%20desc&$format=json`
      const res = await fetch(url, { signal: controller.signal })
      clearTimeout(timer)
      if (!res.ok) return null
      const json = await res.json()
      const item = json?.value?.[0]
      if (!item || !item.cotacaoVenda) return null

      // Se USD funcionou, buscar EUR também com limite rápido
      const eurUrl = `https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoMoedaDia(moeda=@moeda,dataCotacao=@dataCotacao)?@moeda='EUR'&@dataCotacao=${dataFormatada}&$top=1&$orderby=dataHoraCotacao%20desc&$format=json`
      const eurRes = await fetch(eurUrl)
      if (!eurRes.ok) return null
      const eurJson = await eurRes.json()
      const eurItem = eurJson?.value?.[0]
      if (!eurItem || !eurItem.cotacaoVenda) return null

      return {
        rates: {
          USD: { rate: Number(item.cotacaoVenda), pctChange: 0 },
          EUR: { rate: Number(eurItem.cotacaoVenda), pctChange: 0 },
        },
        source: 'bcb.gov.br (Olinda)',
      }
    } catch {
      clearTimeout(timer)
      return null
    }
  }

  // 2. Fallback imediato: AwesomeAPI
  async function fetchAwesomeRates(): Promise<{
    rates: { USD: { rate: number; pctChange: number }; EUR: { rate: number; pctChange: number } }
    source: string
  }> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 3500)
    try {
      const response = await fetch('https://economia.awesomeapi.com.br/last/USD-BRL,EUR-BRL', {
        signal: controller.signal,
      })
      clearTimeout(timer)
      if (!response.ok) {
        throw new Error(`Upstream API returned ${response.status}`)
      }
      const data = await response.json()
      const usdBid = data.USDBRL ? parseFloat(data.USDBRL.bid) : 0
      const eurBid = data.EURBRL ? parseFloat(data.EURBRL.bid) : 0
      const usdPct = data.USDBRL ? parseFloat(data.USDBRL.pctChange) : 0
      const eurPct = data.EURBRL ? parseFloat(data.EURBRL.pctChange) : 0

      if (!usdBid || !eurBid) {
        throw new Error('Invalid rate data from upstream')
      }

      return {
        rates: {
          USD: { rate: usdBid, pctChange: usdPct },
          EUR: { rate: eurBid, pctChange: eurPct },
        },
        source: 'economia.awesomeapi.com.br',
      }
    } catch (e) {
      clearTimeout(timer)
      throw e
    }
  }

  try {
    let result = await fetchBcbRates()
    if (!result) {
      result = await fetchAwesomeRates()
    }

    return new Response(
      JSON.stringify({
        rates: result.rates,
        timestamp: new Date().toISOString(),
        source: result.source,
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
