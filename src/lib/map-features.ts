import { getBoundingBox, createProjector, polygonToSvgPath } from '@/lib/geo-projection'

export interface MapFeature {
  id: string
  path: string
  color: string
  label: string
  centroid: { x: number; y: number }
}

const COLOR_PALETTE = [
  '#3b82f6',
  '#ef4444',
  '#10b981',
  '#f59e0b',
  '#8b5cf6',
  '#ec4899',
  '#06b6d4',
  '#84cc16',
  '#f97316',
  '#6366f1',
]

export function colorForRepresentative(repId: string, index: number): string {
  return COLOR_PALETTE[index % COLOR_PALETTE.length]
}

export function createMapFeatures(
  territories: Array<{
    id: string
    geometria: GeoJSON.Geometry | null
    cor: string | null
    label?: string | null
  }>,
  width: number,
  height: number,
): MapFeature[] {
  const geometries = territories
    .filter((t) => t.geometria)
    .map((t) => t.geometria as GeoJSON.Geometry)
  if (geometries.length === 0) return []

  const bbox = getBoundingBox(geometries)
  const project = createProjector(bbox, width, height)

  return territories
    .filter((t) => t.geometria && t.geometria.type === 'Polygon')
    .map((t, idx) => {
      const geom = t.geometria as GeoJSON.Polygon
      const path = polygonToSvgPath(geom, project)
      const ring = geom.coordinates[0]
      const centerLng = ring.reduce((s, c) => s + c[0], 0) / ring.length
      const centerLat = ring.reduce((s, c) => s + c[1], 0) / ring.length
      const centroid = project(centerLng, centerLat)
      return {
        id: t.id,
        path,
        color: t.cor ?? colorForRepresentative(t.id, idx),
        label: t.label ?? '',
        centroid,
      }
    })
}

export function formatCoordinates(lng: number, lat: number): string {
  return `${lat.toFixed(4)}°, ${lng.toFixed(4)}°`
}
