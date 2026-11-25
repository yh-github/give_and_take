import { isPointInPolygon } from '../../logic/geometry.ts';
import type {
  ObstacleSegment,
  Point2D,
  WallPolylineObject
} from '../../types/index.ts';

export const SHIPWRECK_SCREENS_X = 2.2;
export const SHIPWRECK_SCREENS_Y = 1.25;
export const SHIPWRECK_SCREENS = SHIPWRECK_SCREENS_Y;
export const SHIPWRECK_WORLD_HEIGHT = 100;

export const AIR_POCKET_Y = 33;
export const AIR_POCKET_LEFT_X = 65;
export const AIR_POCKET_RIGHT_X = 94;
export const SHIPWRECK_AIR_POCKET_RETURN_POS: Readonly<Point2D & { zone: number }> = {
  x: 80,
  y: 27,
  zone: 5
};

/**
 * Outer upper hull polyline from the shattered stern upper edge to the unbroken bow waterline.
 * Coordinates are unscaled 1:1 percentages (x: 0..100, y: 0..100).
 */
export const HULL_UPPER_ROOF: readonly Point2D[] = [
  { x: 23, y: 64 },
  { x: 34, y: 52 },
  { x: 48, y: 42 },
  { x: 64, y: 30 },
  { x: 76, y: 17 },
  { x: 86, y: 11 },
  { x: 94, y: 16 },
  { x: 95, y: 27 },
  { x: 94, y: 33 }
];

/**
 * Lower keel polyline from the shattered stern bottom edge up along the seabed & reef to the bow waterline.
 */
export const HULL_LOWER_KEEL: readonly Point2D[] = [
  { x: 31, y: 80 },
  { x: 48, y: 80 },
  { x: 66, y: 70 },
  { x: 80, y: 56 },
  { x: 91, y: 42 },
  { x: 94, y: 33 }
];

/**
 * Windowless bow Air Pocket polygon above the horizontal `y = 33` water surface.
 */
export const AIR_POCKET_POLYGON: readonly Point2D[] = [
  { x: 65, y: 33 },
  { x: 64, y: 30 },
  { x: 76, y: 17 },
  { x: 86, y: 11 },
  { x: 94, y: 16 },
  { x: 95, y: 27 },
  { x: 94, y: 33 }
];

/**
 * Closed polygon of the entire crashed Ship Wreck hull (flooded rooms + bow Air Pocket).
 */
export const SHIPWRECK_HULL_POLYGON: readonly Point2D[] = [
  ...HULL_UPPER_ROOF,
  ...HULL_LOWER_KEEL.slice(0, -1).reverse()
];

/**
 * Interior tilted bulkheads and broken deck beams (1:1 shared with SVG artwork).
 */
export const SHIPWRECK_BULKHEAD_SEGMENTS: readonly { a: Point2D; b: Point2D }[] = [
  // Midship upper bulkhead separating shattered stern from midship gun deck
  { a: { x: 52, y: 39 }, b: { x: 55, y: 53 } },
  // Tilted collapsed mid-deck floor beam with wide open gaps on both ends
  { a: { x: 60, y: 58 }, b: { x: 71, y: 51 } },
  // Watertight bow bulkhead sealing the left lip of the trapped Air Pocket down below waterline
  { a: { x: 64, y: 30 }, b: { x: 65, y: 33 } },
  { a: { x: 65, y: 33 }, b: { x: 66, y: 40 } }
];

export const SHIPWRECK_WALL_POLYLINES: readonly WallPolylineObject[] = [
  { points: [...HULL_UPPER_ROOF], closed: false },
  { points: [...HULL_LOWER_KEEL], closed: false },
  ...SHIPWRECK_BULKHEAD_SEGMENTS.map(seg => ({ points: [seg.a, seg.b], closed: false }))
];

export function isInShipwreckAirPocket(x: number, y: number): boolean {
  if (y > AIR_POCKET_Y || x < 63 || x > 96) return false;
  return isPointInPolygon({ x, y }, AIR_POCKET_POLYGON);
}

export function isInsideShipwreckHull(x: number, y: number): boolean {
  if (x < 22 || x > 96 || y < 10 || y > 82) return false;
  return isPointInPolygon({ x, y }, SHIPWRECK_HULL_POLYGON);
}

/**
 * Converts the crashed Ship Wreck hull, tilted bulkheads, and (while Merman) the horizontal
 * Air Pocket waterline barrier into ObstacleSegments in 0..100 x 0..100 isotropic space.
 */
export function getShipwreckObstacleSegments(
  _puzzleEntities: unknown = [],
  _unlockedZones: readonly number[] | null | undefined = undefined,
  _defeated: readonly string[] = [],
  _screens = SHIPWRECK_SCREENS,
  _geometry: unknown = null,
  isTransformed = true
): ObstacleSegment[] {
  const segments: ObstacleSegment[] = [
    { a: { x: 0, y: 0 }, b: { x: 100, y: 0 } },
    { a: { x: 100, y: 0 }, b: { x: 100, y: 100 } },
    { a: { x: 100, y: 100 }, b: { x: 0, y: 100 } },
    { a: { x: 0, y: 100 }, b: { x: 0, y: 0 } }
  ];

  const pushPolyline = (pts: readonly Point2D[]) => {
    for (let i = 0; i < pts.length - 1; i++) {
      segments.push({
        a: { x: pts[i].x, y: pts[i].y },
        b: { x: pts[i + 1].x, y: pts[i + 1].y },
        isOuterWall: true
      });
    }
  };

  pushPolyline(HULL_UPPER_ROOF);
  pushPolyline(HULL_LOWER_KEEL);

  for (const seg of SHIPWRECK_BULKHEAD_SEGMENTS) {
    segments.push({
      a: { x: seg.a.x, y: seg.a.y },
      b: { x: seg.b.x, y: seg.b.y },
      isOuterWall: false
    });
  }

  // While Merman (`isTransformed = true`), the trapped waterline acts as an impenetrable barrier
  // while leaving line-of-sight into the dry bow pocket completely open (`blocksSight: false`).
  if (isTransformed) {
    segments.push({
      a: { x: AIR_POCKET_LEFT_X, y: AIR_POCKET_Y },
      b: { x: AIR_POCKET_RIGHT_X, y: AIR_POCKET_Y },
      isAirBarrier: true,
      blocksSight: false
    });
  }

  return segments;
}
