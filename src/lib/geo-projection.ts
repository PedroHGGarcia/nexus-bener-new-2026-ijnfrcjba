export interface BoundingBox {
  minLng: number
  minLat: number
  maxLng: number
  maxLat: number
}

export interface ProjectionResult {
  x: number
  y: number
}

export function getBoundingBox(geometries: GeoJSON.Geometry[]): BoundingBox {
  let minLng = Infinity
  let minLat = Infinity
  let maxLng = -Infinity
  let maxLat = -Infinity

  for (const geom of geometries) {
    if (!geom) continue
    if (geom.type === 'Polygon') {
      for (const ring of geom.coordinates) {
        for (const [lng, lat] of ring) {
          minLng = Math.min(minLng, lng)
          maxLng = Math.max(maxLng, lng)
          minLat = Math.min(minLat, lat)
          maxLat = Math.max(maxLat, lat)
        }
      }
    } else if (geom.type === 'MultiPolygon') {
      for (const polygon of geom.coordinates) {
        for (const ring of polygon) {
          for (const [lng, lat] of ring) {
            minLng = Math.min(minLng, lng)
            maxLng = Math.max(maxLng, lng)
            minLat = Math.min(minLat, lat)
            maxLat = Math.max(maxLat, lat)
          }
        }
      }
    }
  }

  if (minLng === Infinity) {
    return { minLng: -74, minLat: -34, maxLng: -34, maxLat: 5 }
  }

  const padLng = (maxLng - minLng) * 0.05 || 1
  const padLat = (maxLat - minLat) * 0.05 || 1
  return {
    minLng: minLng - padLng,
    maxLng: maxLng + padLng,
    minLat: minLat - padLat,
    maxLat: maxLat + padLat,
  }
}

export function createProjector(
  bbox: BoundingBox,
  width: number,
  height: number,
): (lng: number, lat: number) => ProjectionResult {
  const lngRange = bbox.maxLng - bbox.minLng || 1
  const latRange = bbox.maxLat - bbox.minLat || 1
  const scale = Math.min(width / lngRange, height / latRange)
  const offsetX = (width - lngRange * scale) / 2
  const offsetY = (height - latRange * scale) / 2

  return (lng: number, lat: number): ProjectionResult => ({
    x: offsetX + (lng - bbox.minLng) * scale,
    y: offsetY + (bbox.maxLat - lat) * scale,
  })
}

export function polygonToSvgPath(
  geom: GeoJSON.Polygon,
  project: (lng: number, lat: number) => ProjectionResult,
): string {
  const rings = geom.coordinates
  const paths: string[] = []

  for (const ring of rings) {
    if (ring.length === 0) continue
    const points = ring.map(([lng, lat]) => {
      const p = project(lng, lat)
      return `${p.x.toFixed(2)},${p.y.toFixed(2)}`
    })
    paths.push(`M ${points.join(' L ')} Z`)
  }

  return paths.join(' ')
}
