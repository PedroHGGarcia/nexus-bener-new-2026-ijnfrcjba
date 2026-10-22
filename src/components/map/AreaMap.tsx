import { useState, useEffect, useCallback } from 'react'
import { TerritoryWithRep, MapLayerConfig } from '@/types/area-atuacao'
import { MapaWrapper } from './MapaWrapper'
import { MapLayerControl } from './MapLayerControl'
import { MapaTerritoriosReps } from './MapaTerritoriosReps'
import { TerritoryPopup } from './TerritoryPopup'
import { fetchClientsByRepresentative } from '@/services/area-atuacao'
import { getBoundingBox, createProjector } from '@/lib/geo-projection'

interface AreaMapProps {
  territories: TerritoryWithRep[]
  showClients: boolean
  clientMarkers: { id: string; fantasia: string; lat: number; lng: number }[]
}

interface ClientMarker {
  id: string
  fantasia: string
  lat: number
  lng: number
}

export function AreaMap({ territories, showClients, clientMarkers }: AreaMapProps) {
  const [layerConfig, setLayerConfig] = useState<MapLayerConfig>({
    territories: true,
    clients: showClients,
    baseMap: true,
  })
  const [selectedTerritory, setSelectedTerritory] = useState<TerritoryWithRep | null>(null)
  const [popupPos, setPopupPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [clients, setClients] = useState<
    { id: string; fantasia: string; cidade: string | null; estado: string | null }[]
  >([])
  const [loadingClients, setLoadingClients] = useState(false)

  useEffect(() => {
    setLayerConfig((prev) => ({ ...prev, clients: showClients }))
  }, [showClients])

  const handleSelectTerritory = useCallback(
    (territory: TerritoryWithRep, event: React.MouseEvent<SVGPathElement>) => {
      const rect = event.currentTarget.ownerSVGElement?.getBoundingClientRect()
      if (rect) {
        setPopupPos({
          x: event.clientX - rect.left,
          y: event.clientY - rect.top,
        })
      }
      setSelectedTerritory(territory)

      if (territory.representante) {
        setLoadingClients(true)
        fetchClientsByRepresentative(territory.representante)
          .then((data) => setClients(data))
          .catch(() => setClients([]))
          .finally(() => setLoadingClients(false))
      } else {
        setClients([])
      }
    },
    [],
  )

  return (
    <div className="relative w-full h-full rounded-lg overflow-hidden border border-border bg-muted/30">
      <MapaWrapper minHeight={450}>
        {(width, height) => (
          <div className="relative" style={{ width, height }}>
            <MapLayerControl config={layerConfig} onChange={setLayerConfig} />
            <svg
              width={width}
              height={height}
              className="block"
              onClick={() => selectedTerritory && setSelectedTerritory(null)}
            >
              {layerConfig.territories && (
                <MapaTerritoriosReps
                  territories={territories}
                  width={width}
                  height={height}
                  showBaseMap={layerConfig.baseMap}
                  selectedId={selectedTerritory?.id ?? null}
                  onSelect={(t) => {
                    const svgEl = document.querySelector('svg')
                    if (svgEl) {
                      const evt = window.event as MouseEvent
                      const rect = svgEl.getBoundingClientRect()
                      setPopupPos({
                        x: evt ? evt.clientX - rect.left : width / 2,
                        y: evt ? evt.clientY - rect.top : height / 2,
                      })
                    }
                    setSelectedTerritory(t)
                    if (t.representante) {
                      setLoadingClients(true)
                      fetchClientsByRepresentative(t.representante)
                        .then((data) => setClients(data))
                        .catch(() => setClients([]))
                        .finally(() => setLoadingClients(false))
                    } else {
                      setClients([])
                    }
                  }}
                />
              )}
              {layerConfig.clients &&
                (clientMarkers as ClientMarker[]).map((marker) => {
                  const bbox = territories
                    .filter((t) => t.geometria?.type === 'Polygon')
                    .map((t) => t.geometria as GeoJSON.Polygon)
                  if (bbox.length === 0) return null
                  const box = getBoundingBox(bbox)
                  const project = createProjector(box, width, height)
                  const p = project(marker.lng, marker.lat)
                  return (
                    <g key={marker.id}>
                      <circle
                        cx={p.x}
                        cy={p.y}
                        r={4}
                        fill="hsl(var(--primary))"
                        stroke="white"
                        strokeWidth={1.5}
                        className="cursor-pointer"
                      >
                        <title>{marker.fantasia}</title>
                      </circle>
                    </g>
                  )
                })}
            </svg>

            {selectedTerritory && (
              <TerritoryPopup
                territory={selectedTerritory}
                clients={clients}
                loadingClients={loadingClients}
                onClose={() => setSelectedTerritory(null)}
                position={popupPos}
              />
            )}
          </div>
        )}
      </MapaWrapper>
    </div>
  )
}
