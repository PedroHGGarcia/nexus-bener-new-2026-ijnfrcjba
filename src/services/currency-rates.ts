import { supabase } from '@/lib/supabase/client'

export interface CurrencyRates {
  usdRate: number
  eurRate: number
  usdPctChange: number
  eurPctChange: number
  timestamp: string
  source: string
}

const CACHE_TTL = 5 * 60 * 1000
const STORAGE_KEY = 'nexus_currency_rates_cache_v1'

export const SAFE_DEFAULT_RATES: CurrencyRates = {
  usdRate: 5.4,
  eurRate: 5.9,
  usdPctChange: 0,
  eurPctChange: 0,
  timestamp: new Date().toISOString(),
  source: 'padrao-seguro',
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

// Fallback direto do navegador caso a edge function falhe ou demore
async function fetchAwesomeFallback(): Promise<CurrencyRates | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 2500)
  try {
    const res = await fetch('https://economia.awesomeapi.com.br/last/USD-BRL,EUR-BRL', {
      signal: controller.signal,
    })
    clearTimeout(timer)
    if (!res.ok) return null
    const data = await res.json()
    const usdBid = data.USDBRL ? parseFloat(data.USDBRL.bid) : 0
    const eurBid = data.EURBRL ? parseFloat(data.EURBRL.bid) : 0
    if (!usdBid || !eurBid) return null
    return {
      usdRate: usdBid,
      eurRate: eurBid,
      usdPctChange: data.USDBRL ? parseFloat(data.USDBRL.pctChange) : 0,
      eurPctChange: data.EURBRL ? parseFloat(data.EURBRL.pctChange) : 0,
      timestamp: new Date().toISOString(),
      source: 'economia.awesomeapi.com.br (direto)',
    }
  } catch {
    clearTimeout(timer)
    return null
  }
}

export async function fetchCurrencyRates(forceRefresh = false): Promise<CurrencyRates | null> {
  const now = Date.now()

  if (!forceRefresh && cachedRates && now - cacheTime < CACHE_TTL) {
    return cachedRates
  }

  // Tenta invocar edge function (com timeout curto de 3.5s)
  try {
    const invokePromise = supabase.functions.invoke('currency-rates')
    const timeoutPromise = new Promise<{ data: any; error: any }>((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), 3000),
    )

    const res = await Promise.race([invokePromise, timeoutPromise])
    const data = res.data
    const error = res.error

    if (!error && data?.rates?.USD?.rate && data?.rates?.EUR?.rate) {
      cachedRates = {
        usdRate: Number(data.rates.USD.rate),
        eurRate: Number(data.rates.EUR.rate),
        usdPctChange: Number(data.rates.USD.pctChange ?? 0),
        eurPctChange: Number(data.rates.EUR.pctChange ?? 0),
        timestamp: data.timestamp ?? new Date().toISOString(),
        source: data.source ?? 'edge-function',
      }
      cacheTime = now
      saveStoredRates(cachedRates)
      return cachedRates
    }
  } catch {
    // Falha ou timeout na edge function — fallback imediato no client
  }

  // Fallback 1: AwesomeAPI diretamente pelo client
  const fallbackAwesome = await fetchAwesomeFallback()
  if (fallbackAwesome) {
    cachedRates = fallbackAwesome
    cacheTime = now
    saveStoredRates(cachedRates)
    return cachedRates
  }

  // Fallback 2: cache do localStorage
  const stored = loadStoredRates()
  if (stored) {
    cachedRates = stored
    cacheTime = now
    return cachedRates
  }

  // Fallback 3: cotação padrão de segurança
  if (!cachedRates) {
    cachedRates = {
      ...SAFE_DEFAULT_RATES,
      timestamp: new Date().toISOString(),
    }
    cacheTime = now
  }

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
