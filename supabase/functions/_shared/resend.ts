export function uint8ToBase64(bytes: Uint8Array): string {
  let binary = ''
  const len = bytes.byteLength
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

export interface EmailAttachment {
  filename: string
  content: string
}

export interface EmailSendResult {
  success: boolean
  error?: string
}

export async function sendEmail(
  apiKey: string,
  to: string,
  subject: string,
  html: string,
  attachments?: EmailAttachment[],
  fromAddress?: string,
): Promise<EmailSendResult> {
  const from = fromAddress || 'onboarding@resend.dev'
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        html,
        attachments,
      }),
    })
    if (!res.ok) {
      let errorDetail = `Resend API ${res.status}`
      try {
        const errorBody = await res.json()
        errorDetail = errorBody?.message || errorBody?.error || JSON.stringify(errorBody)
      } catch {
        try {
          const errorText = await res.text()
          if (errorText) errorDetail += `: ${errorText}`
        } catch {
          /* ignore */
        }
      }
      console.error(`[sendEmail] Failed for ${to}: ${errorDetail}`)
      return { success: false, error: errorDetail }
    }
    return { success: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[sendEmail] Exception for ${to}:`, msg)
    return { success: false, error: msg }
  }
}
