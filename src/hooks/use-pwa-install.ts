import { useState, useEffect, useCallback } from 'react'

export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[]
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed'
    platform: string
  }>
  prompt(): Promise<void>
}

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent
  }
}

export function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isInstalled, setIsInstalled] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [isStandalone, setIsStandalone] = useState(false)

  useEffect(() => {
    // 1. Detectar se já está rodando em modo Standalone (instalado)
    const checkStandalone = () => {
      const isStandaloneMedia = window.matchMedia('(display-mode: standalone)').matches
      const isIOSStandalone =
        (window.navigator as unknown as { standalone?: boolean }).standalone === true
      return isStandaloneMedia || isIOSStandalone
    }

    const standaloneState = checkStandalone()
    setIsStandalone(standaloneState)
    setIsInstalled(standaloneState)

    // 2. Detectar se é dispositivo iOS (iPhone, iPad, iPod)
    const ua = window.navigator.userAgent.toLowerCase()
    const isIOSDevice =
      /iphone|ipad|ipod/.test(ua) ||
      (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1)
    setIsIOS(isIOSDevice)

    // 3. Ouvir evento de app instalado
    const handleAppInstalled = () => {
      setIsInstalled(true)
      setIsStandalone(true)
      setDeferredPrompt(null)
    }

    // 4. Capturar beforeinstallprompt (Chrome, Edge, Android, Desktop Chromium)
    const handleBeforeInstallPrompt = (e: BeforeInstallPromptEvent) => {
      e.preventDefault()
      setDeferredPrompt(e)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)

    const mediaQuery = window.matchMedia('(display-mode: standalone)')
    const handleMediaChange = (e: MediaQueryListEvent) => {
      if (e.matches) {
        setIsInstalled(true)
        setIsStandalone(true)
      }
    }
    mediaQuery.addEventListener('change', handleMediaChange)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
      mediaQuery.removeEventListener('change', handleMediaChange)
    }
  }, [])

  // Dispara o prompt nativo se disponível
  const installApp = useCallback(async (): Promise<'accepted' | 'dismissed' | 'manual'> => {
    if (!deferredPrompt) {
      return 'manual'
    }

    try {
      await deferredPrompt.prompt()
      const choiceResult = await deferredPrompt.userChoice
      if (choiceResult.outcome === 'accepted') {
        setIsInstalled(true)
        setDeferredPrompt(null)
      }
      return choiceResult.outcome
    } catch (err) {
      console.warn('[PWA] Erro ao disparar prompt de instalação:', err)
      return 'manual'
    }
  }, [deferredPrompt])

  return {
    isInstallable: !isInstalled && !isStandalone && (!!deferredPrompt || isIOS),
    isInstalled: isInstalled || isStandalone,
    isIOS,
    canPromptDirectly: !!deferredPrompt,
    installApp,
  }
}
