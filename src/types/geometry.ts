/**
 * 2D/3D geometry, visibility, and pathfinding domain types.
 */

export interface Point2D {
  x: number;
  y: number;
}

export interface Vector3D {
  x: number;
  y: number;
  z: number;
}

export interface Segment2D {
  a: Point2D;
  b: Point2D;
}

export interface ObstacleSegment extends Segment2D {
  isPillar?: boolean;
  isOuterWall?: boolean;
  isRock?: boolean;
  blocksSight?: boolean;
  gateType?: string;
  rockId?: string;
  yNode?: number;
  minX?: number;
  maxX?: number;
  yTop?: number;
  yBottom?: number;
}

export interface RayIntersection {
  x: number;
  y: number;
  param: number;
  angle?: number;
}

export interface CorridorBounds {
  xLeft: number;
  xRight: number;
}

export interface CollarBounds {
  xLeft: number;
  xRight: number;
  yTop: number;
  yBottom: number;
}

export interface CaveWallVertices {
  leftWall?: Point2D[];
  rightWall?: Point2D[];
  centralPillar?: Point2D[];
}

export interface WallPolylineObject {
  points: Point2D[];
  closed?: boolean;
  isPillar?: boolean;
}

export type WallPolyline = Point2D[] | WallPolylineObject;

export interface NormalizedWallPolyline {
  points: Point2D[];
  closed: boolean;
  isPillar: boolean;
}

export interface ProceduralGeometry {
  worldWidth?: number;
  worldHeight?: number;
  campPos?: Point2D;
  wallPolylines?: WallPolyline[];
  [key: string]: unknown;
}

export interface OrganicBoulderFacet {
  id: string;
  pts: [Point2D, Point2D, Point2D, Point2D];
  mapCentroid: Point2D;
  normal: Vector3D;
}

export interface OrganicBoulder {
  id: string;
  localX: number;
  localY: number;
  rx: number;
  ry: number;
  vertices: Point2D[];
  peak: Point2D;
  facets: OrganicBoulderFacet[];
}

export interface OrganicRockCluster {
  xLeft: number;
  xRight: number;
  yCenter: number;
  width: number;
  height: number;
  boulders: OrganicBoulder[];
}

export interface FacetLighting {
  intensity: number;
  color: string;
}

export type PathfindingBounds =
  | { width?: number; height?: number }
  | number
  | null
  | undefined;

export interface PathfindingOptions {
  radius?: number;
  maxIters?: number;
  cornerClearance?: number;
}

export interface Waypoint {
  x: number;
  y: number;
  depth: number;
  zone: number;
}
