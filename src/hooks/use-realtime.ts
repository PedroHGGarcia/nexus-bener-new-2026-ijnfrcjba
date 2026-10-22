import { useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase/client'

export function useRealtime(tables: string[], callback: () => void) {
  const callbackRef = useRef(callback)
  callbackRef.current = callback

  const tablesKey = tables.join(',')

  useEffect(() => {
    const channel = supabase.channel(`realtime-${tablesKey}`)

    tables.forEach((table) => {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, () =>
        callbackRef.current(),
      )
    })

    channel.subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [tablesKey])
}
