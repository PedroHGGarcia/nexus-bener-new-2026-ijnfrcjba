/**
 * Old-system-style file naming for proposal PDF exports:
 * `Proposta-<numero>[-<revisao>].pdf` (e.g. "Proposta-42134-A.pdf").
 * Falls back to the raw number when no revision letter is present.
 */
export function buildProposalFileName(
  numeroProposta: string | null | undefined,
  revisao?: string | null,
): string {
  const numero = (numeroProposta || '').trim()
  if (!numero) return 'Proposta-Bener.pdf'
  const numeroLimpo = numero.replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, '')
  const rev = (revisao || '').trim().toUpperCase()

  // If numeroLimpo already ends with the revision letter (e.g. "-A" or ends with matches /-[A-Z]$/i),
  // do not duplicate it.
  const hasRevisionSuffix = /-[A-Za-z]$/.test(numeroLimpo)
  if (rev && !hasRevisionSuffix && !numeroLimpo.toUpperCase().endsWith(`-${rev}`)) {
    return `Proposta-${numeroLimpo}-${rev}.pdf`
  }
  return `Proposta-${numeroLimpo}.pdf`
}
