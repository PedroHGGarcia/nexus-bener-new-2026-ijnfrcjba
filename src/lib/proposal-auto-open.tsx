import { toast } from '@/hooks/use-toast'

export interface PreOpenedPrintTab {
  tab: Window | null
  redirect: (propostaId: string) => boolean
  close: () => void
}

/**
 * Pre-opens a blank window synchronously inside a user gesture (e.g. click "GERAR PROPOSTA").
 * Once the asynchronous proposal generation finishes, call `redirect(propostaId)` to
 * navigate that exact tab to `/proposta/${propostaId}/imprimir`.
 *
 * If the browser popup blocker intercepted the window synchronously (tab is null / closed),
 * `redirect` returns false and shows a prominent fallback action toast so the user can
 * open the print view with a single click.
 */
export function preOpenProposalPrintTab(): PreOpenedPrintTab {
  let tab: Window | null = null

  try {
    // Open synchronously within user gesture
    tab = window.open('about:blank', '_blank')
    if (tab && !tab.closed) {
      try {
        tab.document.title = 'Gerando proposta...'
        tab.document.body.innerHTML = `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; color: #0b3c26; background: #f8fafc; text-align: center; padding: 20px; box-sizing: border-box;">
            <div style="width: 38px; height: 38px; border: 3px solid #cbd5e1; border-top-color: #0b3c26; border-radius: 50%; animation: spin 0.8s linear infinite; margin-bottom: 16px;"></div>
            <h2 style="font-size: 18px; margin: 0 0 8px 0; color: #0f172a;">Preparando documento de impressão...</h2>
            <p style="font-size: 13px; color: #64748b; margin: 0;">Aguarde, a proposta comercial está sendo carregada para impressão.</p>
            <style>@keyframes spin { to { transform: rotate(360deg); } }</style>
          </div>
        `
      } catch {
        // cross-origin / restriction safety - ignore
      }
    }
  } catch (err) {
    console.warn('[preOpenProposalPrintTab] Failed to synchronously open blank tab:', err)
    tab = null
  }

  const redirect = (propostaId: string): boolean => {
    const printUrl = `/proposta/${propostaId}/imprimir`
    let opened = false

    if (tab && !tab.closed) {
      try {
        tab.location.href = printUrl
        tab.focus()
        opened = true
      } catch (err) {
        console.warn('[preOpenProposalPrintTab] Failed to redirect pre-opened tab:', err)
        opened = false
      }
    }

    if (!opened) {
      // Tab was either blocked or closed: attempt a fresh window.open
      try {
        const fallbackTab = window.open(printUrl, '_blank')
        if (fallbackTab && !fallbackTab.closed) {
          fallbackTab.focus()
          opened = true
        }
      } catch (fallbackErr) {
        console.warn('[preOpenProposalPrintTab] Fallback window.open also blocked:', fallbackErr)
      }
    }

    if (!opened) {
      showPrintPdfBlockedFallbackToast(propostaId)
    }

    return opened
  }

  const close = () => {
    if (tab && !tab.closed) {
      try {
        tab.close()
      } catch {
        // ignore
      }
    }
    tab = null
  }

  return { tab, redirect, close }
}

/**
 * Fallback toast shown when browser pop-up blocker prevents the automatic opening.
 * Gives the user a clear, prominent 1-click button to open the print PDF view immediately.
 */
export function showPrintPdfBlockedFallbackToast(propostaId: string) {
  const printUrl = `/proposta/${propostaId}/imprimir`
  toast({
    title: 'Proposta gerada!',
    description: 'O navegador bloqueou a abertura automática do PDF. Clique abaixo para abrir.',
    action: (
      <button
        type="button"
        onClick={() => window.open(printUrl, '_blank')}
        className="inline-flex items-center justify-center px-3 py-1.5 text-xs font-bold text-white bg-[#0b3c26] hover:bg-[#082f1e] rounded shadow-sm transition-colors cursor-pointer shrink-0"
      >
        Abrir PDF de impressão
      </button>
    ) as any,
    duration: 10000,
  })
}
