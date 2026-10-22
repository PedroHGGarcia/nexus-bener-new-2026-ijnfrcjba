/// <reference types="vite/client" />

declare global {
  namespace GeoJSON {
    export type GeoJsonGeometryTypes =
      | 'Point'
      | 'MultiPoint'
      | 'LineString'
      | 'MultiLineString'
      | 'Polygon'
      | 'MultiPolygon'
      | 'GeometryCollection'

    export interface Geometry {
      type: GeoJsonGeometryTypes
      coordinates?: any
      geometries?: Geometry[]
    }

    export interface Polygon extends Geometry {
      type: 'Polygon'
      coordinates: number[][][]
    }

    export interface MultiPolygon extends Geometry {
      type: 'MultiPolygon'
      coordinates: number[][][][]
    }
  }
}

export {}
