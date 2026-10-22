export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${dd}/${mm}/${yyyy}`
}

export function formatCurrency(value: number | null | undefined): string {
  if (value == null) return '—'
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

export function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  const hh = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`
}

export type MoedaCode = 'BRL' | 'USD' | 'EUR' | 'CHF'

/**
 * Normaliza textos livres de moedas (ex.: 'DOLAR', 'REAIS', 'EURO', 'FRANCO SUÍÇO')
 * gravados no banco para o código padrão de 3 letras.
 */
export function normalizeMoedaCode(raw?: string | null): MoedaCode {
  if (!raw) return 'BRL'
  const cleaned = raw.trim().toUpperCase()

  if (cleaned === 'USD' || cleaned === 'DOLAR' || cleaned === 'DÓLAR') {
    return 'USD'
  }
  if (cleaned === 'EUR' || cleaned === 'EURO') {
    return 'EUR'
  }
  if (
    cleaned === 'CHF' ||
    cleaned === 'FRANCO SUÍÇO' ||
    cleaned === 'FRANCO SUICO' ||
    cleaned === 'FRANCO'
  ) {
    return 'CHF'
  }
  if (cleaned === 'BRL' || cleaned === 'REAIS' || cleaned === 'REAL') {
    return 'BRL'
  }

  return 'BRL'
}

export function formatCurrencyByMoeda(
  value: number | null | undefined,
  moeda?: string | null,
): string {
  if (value == null) return '—'
  const currency = normalizeMoedaCode(moeda)
  const formatted = value.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  if (currency === 'USD') return `US$ ${formatted}`
  if (currency === 'EUR') return `€ ${formatted}`
  if (currency === 'CHF') return `CHF ${formatted}`
  return `R$ ${formatted}`
}

export function formatNumber(value: number | null | undefined, decimals: number = 2): string {
  if (value == null) return '—'
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

/**
 * Formata um texto de ficha técnica que contém bullets ('•').
 * Garante que cada item iniciado por '•' comece em uma nova linha,
 * preservando o caractere '•' e limpando espaços desnecessários.
 */
export function formatBulletList(text: string | null | undefined): string {
  if (!text) return ''
  const trimmed = text.trim()
  if (!trimmed) return ''

  // Se o texto não contém o caractere '•', retorna as linhas limpas
  if (!trimmed.includes('•')) {
    return trimmed
  }

  // Se contém '•', dividimos por '•'
  // O primeiro trecho antes do primeiro '•' pode ser um cabeçalho/preâmbulo ou vazio.
  const parts = trimmed.split('•')
  const resultLines: string[] = []

  parts.forEach((part, index) => {
    const item = part.trim()
    if (!item) return
    if (index === 0) {
      // Se a string original não começava com '•', o primeiro pedaço é texto preâmbulo
      if (!trimmed.startsWith('•')) {
        resultLines.push(item)
      } else {
        resultLines.push(`• ${item}`)
      }
    } else {
      resultLines.push(`• ${item}`)
    }
  })

  return resultLines.join('\n')
}
