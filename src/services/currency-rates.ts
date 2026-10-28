import { supabase } from '@/lib/supabase/client'

export interface CurrencyRates {
  usdRate: number
  eurRate: number
  usdPctChange: number
  eurPctChange: number
  timestamp: string
  source: string
  refDate?: string // Data de referência da cotação de fechamento PTAX (ex.: "27/10/2026")
  isOutdated?: boolean // Indicador explícito de cotação desatualizada/fallback
}

const CACHE_TTL = 15 * 60 * 1000 // 15 minutos (fechamento não muda a cada segundo)
const STORAGE_KEY = 'nexus_currency_rates_cache_v2'

function computePreviousWorkdayBrDate(): string {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  if (d.getDay() === 0) d.setDate(d.getDate() - 2) // Domingo -> Sexta
  if (d.getDay() === 6) d.setDate(d.getDate() - 1) // Sábado -> Sexta
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${dd}/${mm}/${yyyy}`
}

export const SAFE_DEFAULT_RATES: CurrencyRates = {
  usdRate: 5.4998,
  eurRate: 5.9254,
  usdPctChange: 0,
  eurPctChange: 0,
  timestamp: new Date().toISOString(),
  source: 'padrao-seguro',
  refDate: computePreviousWorkdayBrDate(),
  isOutdated: true,
}

let cachedRates: CurrencyRates | null = null
let cacheTime = 0

function loadStoredRates(): CurrencyRates | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed.usdRate === 'number' && typeof parsed.eurRate === 'number') {
      return parsed as CurrencyRates
    }
  } catch {
    // ignore
  }
  return null
}

function saveStoredRates(rates: CurrencyRates) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rates))
  } catch {
    // ignore
  }
}

// Fallback direto do navegador chamando Olinda BCB se a edge function falhar
async function fetchClientOlindaFallback(): Promise<CurrencyRates | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 3500)
  try {
    const end = new Date()
    end.setDate(end.getDate() - 1)
    const start = new Date(end)
    start.setDate(start.getDate() - 10)

    const formatOlinda = (d: Date) =>
      `'${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}-${d.getFullYear()}'`

    const urlUsd = `https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoMoedaPeriodo(moeda=@moeda,dataInicial=@dataInicial,dataFinalCotacao=@dataFinalCotacao)?@moeda='USD'&@dataInicial=${formatOlinda(start)}&@dataFinalCotacao=${formatOlinda(end)}&$top=10&$orderby=dataHoraCotacao%20desc&$format=json`
    const urlEur = `https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoMoedaPeriodo(moeda=@moeda,dataInicial=@dataInicial,dataFinalCotacao=@dataFinalCotacao)?@moeda='EUR'&@dataInicial=${formatOlinda(start)}&@dataFinalCotacao=${formatOlinda(end)}&$top=10&$orderby=dataHoraCotacao%20desc&$format=json`

    const [resUsd, resEur] = await Promise.all([
      fetch(urlUsd, { signal: controller.signal }),
      fetch(urlEur, { signal: controller.signal }),
    ])
    clearTimeout(timer)

    if (!resUsd.ok || !resEur.ok) return null
    const jsonUsd = await resUsd.json()
    const jsonEur = await resEur.json()

    const itemUsd =
      jsonUsd?.value?.find((v: any) =>
        String(v.tipoBoletim || '')
          .toLowerCase()
          .includes('fecha'),
      ) || jsonUsd?.value?.[0]
    const itemEur =
      jsonEur?.value?.find((v: any) =>
        String(v.tipoBoletim || '')
          .toLowerCase()
          .includes('fecha'),
      ) || jsonEur?.value?.[0]

    const usdVal = Number(itemUsd?.cotacaoVenda || itemUsd?.cotacaoCompra)
    const eurVal = Number(itemEur?.cotacaoVenda || itemEur?.cotacaoCompra)

    if (!usdVal || !eurVal) return null

    let refDate = ''
    if (itemUsd?.dataHoraCotacao) {
      const parts = String(itemUsd.dataHoraCotacao).split(' ')
      const [y, m, d] = (parts[0] || '').split('-')
      if (y && m && d) refDate = `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`
    }
    if (!refDate) refDate = computePreviousWorkdayBrDate()

    return {
      usdRate: Number(usdVal.toFixed(4)),
      eurRate: Number(eurVal.toFixed(4)),
      usdPctChange: 0,
      eurPctChange: 0,
      timestamp: itemUsd.dataHoraCotacao || new Date().toISOString(),
      source: 'Banco Central do Brasil - PTAX Fechamento (Direto)',
      refDate,
      isOutdated: false,
    }
  } catch {
    clearTimeout(timer)
    return null
  }
}

export async function fetchCurrencyRates(forceRefresh = false): Promise<CurrencyRates | null> {
  const now = Date.now()

  if (!forceRefresh && cachedRates && now - cacheTime < CACHE_TTL && !cachedRates.isOutdated) {
    return cachedRates
  }

  // 1. Tenta invocar edge function oficial
  try {
    const invokePromise = supabase.functions.invoke('currency-rates')
    const timeoutPromise = new Promise<{ data: any; error: any }>((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), 4500),
    )

    const res = await Promise.race([invokePromise, timeoutPromise])
    const data = res.data
    const error = res.error

    if (!error && data?.rates?.USD?.rate && data?.rates?.EUR?.rate) {
      const refDate =
        data.refDate ||
        data.rates.USD.refDate ||
        data.rates.EUR.refDate ||
        computePreviousWorkdayBrDate()

      cachedRates = {
        usdRate: Number(Number(data.rates.USD.rate).toFixed(4)),
        eurRate: Number(Number(data.rates.EUR.rate).toFixed(4)),
        usdPctChange: Number(data.rates.USD.pctChange ?? 0),
        eurPctChange: Number(data.rates.EUR.pctChange ?? 0),
        timestamp: data.timestamp ?? new Date().toISOString(),
        source: data.source ?? 'Banco Central do Brasil - PTAX (edge-function)',
        refDate,
        isOutdated: data.isOfficialPtax === false,
      }
      cacheTime = now
      saveStoredRates(cachedRates)
      return cachedRates
    }
  } catch {
    // Falha ou timeout na edge function — tenta fallback direto no client
  }

  // 2. Fallback direto Olinda no client
  const clientOlinda = await fetchClientOlindaFallback()
  if (clientOlinda) {
    cachedRates = clientOlinda
    cacheTime = now
    saveStoredRates(cachedRates)
    return cachedRates
  }

  // 3. Fallback: cache anterior salvo no localStorage (marcado como desatualizado se for antigo)
  const stored = loadStoredRates()
  if (stored) {
    cachedRates = {
      ...stored,
      isOutdated: true,
      source: `${stored.source} (cache local)`,
    }
    cacheTime = now
    return cachedRates
  }

  // 4. Fallback padrão seguro com aviso explícito
  cachedRates = {
    ...SAFE_DEFAULT_RATES,
    timestamp: new Date().toISOString(),
    refDate: computePreviousWorkdayBrDate(),
    isOutdated: true,
  }
  cacheTime = now

  return cachedRates
}

export function getCachedRates(): CurrencyRates {
  const now = Date.now()
  if (cachedRates && now - cacheTime < CACHE_TTL) {
    return cachedRates
  }
  const stored = loadStoredRates()
  if (stored) {
    cachedRates = stored
    cacheTime = now
    return stored
  }
  return SAFE_DEFAULT_RATES
}

export function convertToBrl(
  value: number | null | undefined,
  moeda: string | null | undefined,
  rates: CurrencyRates | null,
): number | null {
  if (!rates || !value || !moeda || moeda === 'BRL') return null
  if (moeda === 'USD') return value * rates.usdRate
  if (moeda === 'EUR') return value * rates.eurRate
  return null
}

export function formatBrlEquivalent(
  value: number | null | undefined,
  moeda: string | null | undefined,
  rates: CurrencyRates | null,
): string | null {
  const brlValue = convertToBrl(value, moeda, rates)
  if (brlValue == null) return null
  return `≈ R$ ${brlValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function formatPtaxRate(rate: number): string {
  return rate.toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 })
}
