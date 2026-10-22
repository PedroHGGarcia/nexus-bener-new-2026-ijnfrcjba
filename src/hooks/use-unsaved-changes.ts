import { useState, useEffect, useCallback } from 'react'
import { useBlocker } from 'react-router-dom'

export function useUnsavedChanges(initialDirty = false) {
  const [isDirty, setIsDirty] = useState(initialDirty)

  const blocker = useBlocker(
    useCallback(
      ({ currentLocation, nextLocation }) =>
        isDirty && currentLocation.pathname !== nextLocation.pathname,
      [isDirty],
    ),
  )

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [isDirty])

  const setDirty = useCallback((dirty: boolean) => setIsDirty(dirty), [])
  const proceed = useCallback(() => blocker.proceed?.(), [blocker])
  const reset = useCallback(() => blocker.reset?.(), [blocker])

  return { isDirty, setDirty, blocker, proceed, reset }
}
