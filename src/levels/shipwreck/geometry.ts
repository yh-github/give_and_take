import type {
  ObstacleSegment,
  Point2D,
  WallPolylineObject
} from '../../types/index.ts';

export const SHIPWRECK_SCREENS = 3;
export const SHIPWRECK_WORLD_HEIGHT = SHIPWRECK_SCREENS * 100;
export const AIR_POCKET_Y = 25;
export const AIR_POCKET_HATCH_LEFT = 42;
export const AIR_POCKET_HATCH_RIGHT = 58;

/**
 * Outer hull polyline along the upper port stern down to the top lip of the hull breach.
 * Coordinates are unscaled percentages (x: 0..100, y: 0..100).
 */
export const HULL_UPPER_LEFT: readonly Point2D[] = [
  { x: 50, y: 8 },
  { x: 34, y: 10 },
  { x: 26, y: 15 },
  { x: 26, y: 25 },
  { x: 22, y: 33 },
  { x: 24, y: 41 },
  { x: 18, y: 50 },
  { x: 22, y: 58 },
  { x: 26, y: 65 }
];

/**
 * Outer hull polyline from the lower lip of the hull breach around the buried keel
 * and up the starboard hull back to the stern crown.
 */
export const HULL_LOWER_KEEL_AND_RIGHT: readonly Point2D[] = [
  { x: 32, y: 75 },
  { x: 44, y: 82 },
  { x: 68, y: 82 },
  { x: 82, y: 76 },
  { x: 86, y: 67 },
  { x: 82, y: 58 },
  { x: 84, y: 50 },
  { x: 76, y: 41 },
  { x: 78, y: 33 },
  { x: 74, y: 25 },
  { x: 74, y: 15 },
  { x: 66, y: 10 },
  { x: 50, y: 8 }
];

/**
 * Interior wooden decks and cabin bulkheads with wide open hatchways.
 */
export const SHIPWRECK_BULKHEAD_SEGMENTS: readonly { a: Point2D; b: Point2D }[] = [
  // Air Pocket Floor (y = 25, center hatch x = 42..58)
  { a: { x: 26, y: 25 }, b: { x: 42, y: 25 } },
  { a: { x: 58, y: 25 }, b: { x: 74, y: 25 } },
  // Deck 4 Floor (y = 41, starboard hatch x = 56..72)
  { a: { x: 24, y: 41 }, b: { x: 56, y: 41 } },
  { a: { x: 72, y: 41 }, b: { x: 76, y: 41 } },
  // Deck 3 Partial Cabin Divider (leaves wide bottom passage y = 50..58)
  { a: { x: 50, y: 41 }, b: { x: 50, y: 50 } },
  // Deck 3 Floor (y = 58, port hatch x = 28..44)
  { a: { x: 22, y: 58 }, b: { x: 28, y: 58 } },
  { a: { x: 44, y: 58 }, b: { x: 82, y: 58 } }
];

/**
 * Polylines exported for spacing validation and geometry unit tests (in unscaled 0..100 coordinates).
 */
export const SHIPWRECK_WALL_POLYLINES: readonly WallPolylineObject[] = [
  { points: [...HULL_UPPER_LEFT], closed: false },
  { points: [...HULL_LOWER_KEEL_AND_RIGHT], closed: false },
  ...SHIPWRECK_BULKHEAD_SEGMENTS.map(seg => ({ points: [seg.a, seg.b], closed: false }))
];

export function isInShipwreckAirPocket(x: number, y: number): boolean {
  return y <= AIR_POCKET_Y && x >= 24 && x <= 76;
}

/**
 * Converts the Ship Wreck hull, interior bulkheads, and (while Merman) the Air Pocket hatch
 * barrier into scaled ObstacleSegments for raycasting and A* pathfinding.
 */
export function getShipwreckObstacleSegments(
  _puzzleEntities: unknown = [],
  _unlockedZones: readonly number[] | null | undefined = undefined,
  _defeated: readonly string[] = [],
  screens = SHIPWRECK_SCREENS,
  _geometry: unknown = null,
  isTransformed = true
): ObstacleSegment[] {
  const height = screens * 100;
  const segments: ObstacleSegment[] = [
    // Map boundaries
    { a: { x: 0, y: 0 }, b: { x: 100, y: 0 } },
    { a: { x: 100, y: 0 }, b: { x: 100, y: height } },
    { a: { x: 100, y: height }, b: { x: 0, y: height } },
    { a: { x: 0, y: height }, b: { x: 0, y: 0 } }
  ];

  const pushPolyline = (pts: readonly Point2D[]) => {
    for (let i = 0; i < pts.length - 1; i++) {
      segments.push({
        a: { x: pts[i].x, y: pts[i].y * screens },
        b: { x: pts[i + 1].x, y: pts[i + 1].y * screens },
        isOuterWall: true
      });
    }
  };

  pushPolyline(HULL_UPPER_LEFT);
  pushPolyline(HULL_LOWER_KEEL_AND_RIGHT);

  for (const seg of SHIPWRECK_BULKHEAD_SEGMENTS) {
    segments.push({
      a: { x: seg.a.x, y: seg.a.y * screens },
      b: { x: seg.b.x, y: seg.b.y * screens },
      isOuterWall: false
    });
  }

  // While Merman (`isTransformed = true`), the top Air Pocket hatch blocks movement
  // while remaining transparent to visibility rays (`blocksSight: false`).
  if (isTransformed) {
    segments.push({
      a: { x: AIR_POCKET_HATCH_LEFT, y: AIR_POCKET_Y * screens },
      b: { x: AIR_POCKET_HATCH_RIGHT, y: AIR_POCKET_Y * screens },
      isAirBarrier: true,
      blocksSight: false
    });
  }

  return segments;
}
