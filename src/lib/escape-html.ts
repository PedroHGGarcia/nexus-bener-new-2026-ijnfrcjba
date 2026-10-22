/**
 * Central HTML sanitization and entity escaping helpers.
 * Used to prevent XSS in HTML builders, email templates and PDF views.
 */
import DOMPurify from 'dompurify'

export function escapeHtml(str: unknown): string {
  if (str === null || str === undefined) return ''
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function sanitizeHtml(dirtyHtml: string): string {
  if (!dirtyHtml) return ''
  try {
    return DOMPurify.sanitize(dirtyHtml)
  } catch {
    return dirtyHtml
  }
}
