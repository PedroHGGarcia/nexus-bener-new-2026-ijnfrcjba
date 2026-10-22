/**
 * Funções utilitárias para formatar datas relativas de forma natural e amigável
 * para público em geral (incluindo usuários mais velhos, evitando termos em inglês ou jargão técnico).
 */

export function formatFriendlyLastSeen(iso: string | null | undefined): string {
  if (!iso) {
    return 'Nunca detectado'
  }

  const date = new Date(iso)
  if (isNaN(date.getTime())) {
    return 'Nunca detectado'
  }

  const now = new Date()
  const diffMs = now.getTime() - date.getTime()

  // Se a data for no futuro (pequeno descompasso de relógio)
  if (diffMs < 0 && diffMs > -60000) {
    return 'Agora mesmo'
  }

  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHours = Math.floor(diffMin / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMin < 2) {
    return 'Agora mesmo'
  }

  if (diffMin < 60) {
    return `Há ${diffMin} minutos`
  }

  if (diffHours === 1) {
    return 'Há 1 hora'
  }

  // Verifica se foi hoje
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear()

  // Verifica se foi ontem
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear()

  const timeStr = date.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })

  if (isToday) {
    return `Hoje às ${timeStr}`
  }

  if (isYesterday) {
    return `Ontem às ${timeStr}`
  }

  if (diffDays <= 7) {
    return `Há ${diffDays} dias às ${timeStr}`
  }

  return (
    date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }) + ` às ${timeStr}`
  )
}

/**
 * Retorna se o usuário esteve ativo nos últimos X minutos (padrão 15 minutos).
 */
export function isUserRecentlyActive(iso: string | null | undefined, windowMinutes = 15): boolean {
  if (!iso) return false
  const date = new Date(iso)
  if (isNaN(date.getTime())) return false
  const diffMs = Date.now() - date.getTime()
  return diffMs >= 0 && diffMs <= windowMinutes * 60 * 1000
}
