import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import { touchLastSeen } from '@/services/activity-tracker'

/**
 * Hook global de rastreio de atividade.
 *
 * 1. Dispara ao carregar/logar o usuário no app (com touch inicial).
 * 2. Dispara ao navegar entre páginas (com throttle interno de 5 min do touchLastSeen).
 * 3. Dispara em eventos de interação de usuário (click, keydown) com throttle — não dispara se inativo.
 * 4. Mantém um intervalo de 5 minutos enquanto o usuário interage e a aba está visível.
 */
export function useActivityTracker() {
  const { user } = useAuth()
  const location = useLocation()

  // 1. Touch ao logar/carregar usuário
  useEffect(() => {
    if (!user?.id) return
    touchLastSeen(false)
  }, [user?.id])

  // 2. Touch em mudança de rota
  useEffect(() => {
    if (!user?.id) return
    touchLastSeen(false)
  }, [location.pathname, user?.id])

  // 3. Touch em interações humanas enquanto a janela está focada/visível
  useEffect(() => {
    if (!user?.id) return

    let isDocumentVisible = !document.hidden

    const onVisibilityChange = () => {
      isDocumentVisible = !document.hidden
      if (isDocumentVisible) {
        touchLastSeen(false)
      }
    }

    const onUserAction = () => {
      if (isDocumentVisible) {
        touchLastSeen(false)
      }
    }

    // Intervalo de verificação a cada 5 minutos
    const intervalId = setInterval(
      () => {
        if (!document.hidden) {
          touchLastSeen(false)
        }
      },
      5 * 60 * 1000,
    )

    window.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('click', onUserAction, { passive: true })
    window.addEventListener('keydown', onUserAction, { passive: true })

    return () => {
      clearInterval(intervalId)
      window.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('click', onUserAction)
      window.removeEventListener('keydown', onUserAction)
    }
  }, [user?.id])
}
