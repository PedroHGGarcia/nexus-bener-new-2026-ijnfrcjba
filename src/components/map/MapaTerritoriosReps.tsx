import { TerritoryWithRep } from '@/types/area-atuacao'
import {
  BoundingBox,
  getBoundingBox,
  createProjector,
  polygonToSvgPath,
} from '@/lib/geo-projection'

interface MapaTerritoriosRepsProps {
  territories: TerritoryWithRep[]
  width: number
  height: number
  showBaseMap: boolean
  selectedId: string | null
  onSelect: (territory: TerritoryWithRep) => void
}

export function MapaTerritoriosReps({
  territories,
  width,
  height,
  showBaseMap,
  selectedId,
  onSelect,
}: MapaTerritoriosRepsProps) {
  const validGeoms = territories
    .filter((t) => t.geometria && t.geometria.type === 'Polygon')
    .map((t) => t.geometria as GeoJSON.Polygon)

  if (validGeoms.length === 0) return null

  const bbox = getBoundingBox(validGeoms as unknown as GeoJSON.Geometry[])
  const project = createProjector(bbox, width, height)

  return (
    <>
      {showBaseMap && (
        <defs>
          <pattern id="grid-pattern" width="40" height="40" patternUnits="userSpaceOnUse">
            <rect width="40" height="40" fill="hsl(var(--muted) / 0.3)" />
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="hsl(var(--border))" strokeWidth="0.5" />
          </pattern>
        </defs>
      )}
      {showBaseMap && <rect width={width} height={height} fill="url(#grid-pattern)" />}

      {territories.map((territory) => {
        if (!territory.geometria || territory.geometria.type !== 'Polygon') return null
        const path = polygonToSvgPath(territory.geometria as unknown as GeoJSON.Polygon, project)
        const color = territory.cor || '#3b82f6'
        const isSelected = selectedId === territory.id
        return (
          <path
            key={territory.id}
            d={path}
            fill={color}
            fillOpacity={isSelected ? 0.5 : 0.25}
            stroke={color}
            strokeWidth={isSelected ? 3 : 1.5}
            className="cursor-pointer transition-all duration-200 hover:fill-opacity-50"
            onClick={() => onSelect(territory)}
          />
        )
      })}
    </>
  )
}
