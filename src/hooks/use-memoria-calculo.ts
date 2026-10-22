import { useState, useCallback, useEffect, useMemo } from 'react'

export interface MemoriaItem {
  id: string
  descricao: string
  quantidade: number
  valorUnitario: number
  descontoPct: number
}

function loadItems(): MemoriaItem[] {
  try {
    const raw = localStorage.getItem('bener_memoria_calculo')
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function useMemoriaCalculo() {
  const [items, setItems] = useState<MemoriaItem[]>(loadItems)

  useEffect(() => {
    localStorage.setItem('bener_memoria_calculo', JSON.stringify(items))
  }, [items])

  const addItem = useCallback((item: Omit<MemoriaItem, 'id'>) => {
    const newItem: MemoriaItem = { ...item, id: `mem-${Date.now()}` }
    setItems((prev) => [...prev, newItem])
    return newItem
  }, [])

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id))
  }, [])

  const updateItem = useCallback((id: string, updates: Partial<MemoriaItem>) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...updates } : i)))
  }, [])

  const clear = useCallback(() => setItems([]), [])

  const total = useMemo(() => {
    return items.reduce((sum, item) => {
      const subtotal = item.quantidade * item.valorUnitario
      const desconto = subtotal * (item.descontoPct / 100)
      return sum + (subtotal - desconto)
    }, 0)
  }, [items])

  return { items, total, addItem, removeItem, updateItem, clear }
}
