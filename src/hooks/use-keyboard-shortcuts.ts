import { useEffect, useCallback } from 'react'

export interface ShortcutHandlers {
  [combo: string]: () => void
}

function isMac() {
  return typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform)
}

function matchCombo(e: KeyboardEvent, combo: string): boolean {
  const parts = combo.toLowerCase().split('+')
  const key = parts[parts.length - 1]
  const wantMod = parts.includes('mod') || parts.includes('ctrl') || parts.includes('cmd')
  const wantShift = parts.includes('shift')
  const wantAlt = parts.includes('alt')
  const mod = isMac() ? e.metaKey : e.ctrlKey
  return (
    e.key.toLowerCase() === key &&
    mod === wantMod &&
    e.shiftKey === wantShift &&
    e.altKey === wantAlt
  )
}

export function useKeyboardShortcuts(handlers: ShortcutHandlers) {
  const handlerRef = useCallback(
    (e: KeyboardEvent) => {
      for (const combo of Object.keys(handlers)) {
        if (matchCombo(e, combo)) {
          e.preventDefault()
          handlers[combo]()
          return
        }
      }
    },
    [handlers],
  )

  useEffect(() => {
    window.addEventListener('keydown', handlerRef)
    return () => window.removeEventListener('keydown', handlerRef)
  }, [handlerRef])
}
