import { useRef, useState, useEffect, ReactNode } from 'react'

interface MapaWrapperProps {
  children: (width: number, height: number) => ReactNode
  className?: string
  minHeight?: number
}

export function MapaWrapper({ children, className = '', minHeight = 400 }: MapaWrapperProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })

  useEffect(() => {
    if (!containerRef.current) return
    const el = containerRef.current

    const updateSize = () => {
      const rect = el.getBoundingClientRect()
      setSize({
        width: rect.width,
        height: Math.max(rect.height, minHeight),
      })
    }

    updateSize()

    const resizeObserver = new ResizeObserver(updateSize)
    resizeObserver.observe(el)

    return () => resizeObserver.disconnect()
  }, [minHeight])

  return (
    <div
      ref={containerRef}
      className={`relative w-full ${className}`}
      style={{ minHeight: `${minHeight}px` }}
    >
      {size.width > 0 && size.height > 0 && children(size.width, size.height)}
    </div>
  )
}
