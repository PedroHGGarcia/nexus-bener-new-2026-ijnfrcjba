/**
 * Registra o Service Worker em produção e escuta novas versões
 */
export function registerServiceWorker() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return
  }

  navigator.serviceWorker.getRegistrations().then((regs) => {
    for (const r of regs) {
      if (!r.active || !r.active.scriptURL.endsWith('/sw.js')) r.unregister()
    }
  })

  // Registrar após o carregamento da página para não disputar banda com a renderização inicial
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((registration) => {
        // Checar por atualizações em segundo plano
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing
          if (!newWorker) return

          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // Notificar opcionalmente que há nova versão
              window.dispatchEvent(new CustomEvent('pwa-update-available'))
              registration.waiting?.postMessage({ type: 'SKIP_WAITING' })
            }
          })
        })
      })
      .catch((err) => {
        console.warn('[PWA] Service Worker registration failed:', err)
      })
  })
}
