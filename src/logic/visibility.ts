import {
  getCorridorBounds,
  isPointInPolygon,
  normalizeWallPolyline
} from './geometry.ts';
import type {
  CaveWallVertices,
  MapNode,
  ObstacleSegment,
  Point2D,
  ProceduralGeometry,
  PuzzleEntity,
  RayIntersection,
  Segment2D
} from '../types/index.ts';

/**
 * Visibility Engine: Raycasting and Obstacle Management
 */

type RockBoxMeta = Omit<ObstacleSegment, 'a' | 'b'>;

function pushBoxSegments(
  segments: ObstacleSegment[],
  minX: number,
  maxX: number,
  yTop: number,
  yBottom: number,
  meta: RockBoxMeta
): void {
  segments.push({ a: { x: minX, y: yTop }, b: { x: maxX, y: yTop }, ...meta });
  segments.push({ a: { x: maxX, y: yTop }, b: { x: maxX, y: yBottom }, ...meta });
  segments.push({ a: { x: maxX, y: yBottom }, b: { x: minX, y: yBottom }, ...meta });
  segments.push({ a: { x: minX, y: yBottom }, b: { x: minX, y: yTop }, ...meta });
}

/**
 * Converts game state into a set of line segments for the raycaster.
 */
export function getObstacleSegments(
  mapNodes: ReadonlyArray<MapNode | PuzzleEntity> | null | undefined,
  caveWallVertices: CaveWallVertices | null | undefined,
  _unlockedZones: readonly number[] | null | undefined = undefined,
  defeated: readonly string[] = [],
  screens = 2.5
): ObstacleSegment[] {
  const segments: ObstacleSegment[] = [];
  const height = screens * 100;

  // 1. Map Boundaries
  segments.push({ a: { x: 0, y: 0 }, b: { x: 100, y: 0 } });
  segments.push({ a: { x: 100, y: 0 }, b: { x: 100, y: height } });
  segments.push({ a: { x: 100, y: height }, b: { x: 0, y: height } });
  segments.push({ a: { x: 0, y: height }, b: { x: 0, y: 0 } });

  // 2. Cave Walls (Scaled to fit map height)
  const processPath = (vertices: readonly Point2D[], isPillar = false) => {
    for (let i = 0; i < vertices.length - 1; i++) {
      segments.push({
        a: { x: vertices[i].x, y: vertices[i].y * screens },
        b: { x: vertices[i + 1].x, y: vertices[i + 1].y * screens },
        isPillar,
        isOuterWall: !isPillar
      });
    }
  };

  if (caveWallVertices) {
    if (caveWallVertices.leftWall) processPath(caveWallVertices.leftWall, false);
    if (caveWallVertices.rightWall) processPath(caveWallVertices.rightWall, false);
    if (caveWallVertices.centralPillar && caveWallVertices.centralPillar.length > 0) {
      processPath(caveWallVertices.centralPillar, true);
      const p = caveWallVertices.centralPillar;
      segments.push({
        a: { x: p[p.length - 1].x, y: p[p.length - 1].y * screens },
        b: { x: p[0].x, y: p[0].y * screens },
        isPillar: true,
        isOuterWall: false
      });
    }
  }

  // 3. Rocks (Gatekeepers and Extra)
  if (mapNodes) {
    mapNodes.forEach(node => {
      const nodeId = node.id ?? '';
      if (node.isGatekeeper && !defeated.includes(nodeId)) {
        const yTop = (node.y - 1.5) * screens;
        const yBottom = (node.y + 1.5) * screens;
        let minX: number;
        let maxX: number;
        if (caveWallVertices) {
          const bounds = getCorridorBounds(node.y, caveWallVertices, node.x >= 50);
          minX = bounds.xLeft;
          maxX = bounds.xRight;
        } else if (node.y < 72) {
          if (node.x < 50) {
            minX = 16;
            maxX = 49;
          } else {
            minX = 51;
            maxX = 82;
          }
        } else {
          minX = 31;
          maxX = 69;
        }
        pushBoxSegments(segments, minX, maxX, yTop, yBottom, {
          isRock: true,
          rockId: node.id,
          yNode: node.y,
          minX,
          maxX,
          yTop,
          yBottom
        });
      } else if (node.isExtraRock && !defeated.includes(nodeId)) {
        const sizeX = 2.5;
        const yTop = (node.y - 1.5) * screens;
        const yBottom = (node.y + 1.5) * screens;
        const minX = node.x - sizeX;
        const maxX = node.x + sizeX;
        pushBoxSegments(segments, minX, maxX, yTop, yBottom, {
          isRock: true,
          rockId: node.id,
          yNode: node.y,
          minX,
          maxX,
          yTop,
          yBottom
        });
      }
    });
  }

  return segments;
}

/**
 * Converts a procedural isotropic cave's geometry and active gatekeepers
 * into line segments for raycasting and pathfinding.
 */
export function getProceduralObstacleSegments(
  mapNodes: ReadonlyArray<MapNode | PuzzleEntity> | null | undefined,
  geometry: Pick<ProceduralGeometry, 'worldWidth' | 'worldHeight' | 'wallPolylines'> | null | undefined,
  defeated: readonly string[] = []
): ObstacleSegment[] {
  const segments: ObstacleSegment[] = [];
  const width = geometry?.worldWidth || 100;
  const height = geometry?.worldHeight || 256;

  // 1. World boundaries
  segments.push({ a: { x: 0, y: 0 }, b: { x: width, y: 0 } });
  segments.push({ a: { x: width, y: 0 }, b: { x: width, y: height } });
  segments.push({ a: { x: width, y: height }, b: { x: 0, y: height } });
  segments.push({ a: { x: 0, y: height }, b: { x: 0, y: 0 } });

  // 2. Extracted contour polylines (already in isotropic world coordinates)
  const wallPolylines = geometry?.wallPolylines || [];
  for (const poly of wallPolylines) {
    const normalized = normalizeWallPolyline(poly);
    if (!normalized) continue;
    const { points: pts, closed: isClosed, isPillar } = normalized;

    for (let i = 0; i < pts.length - 1; i++) {
      segments.push({
        a: { x: pts[i].x, y: pts[i].y },
        b: { x: pts[i + 1].x, y: pts[i + 1].y },
        isPillar,
        isOuterWall: !isPillar
      });
    }
    if (isClosed && pts.length > 2) {
      const first = pts[0];
      const last = pts[pts.length - 1];
      if (first.x !== last.x || first.y !== last.y) {
        segments.push({
          a: { x: last.x, y: last.y },
          b: { x: first.x, y: first.y },
          isPillar,
          isOuterWall: !isPillar
        });
      }
    }
  }

  // 3. Active gatekeeper obstacles (rocks, chasms, guardians)
  if (Array.isArray(mapNodes)) {
    for (const node of mapNodes) {
      const nodeId = node.id ?? '';
      if (!(node.isGatekeeper || node.isExtraRock) || defeated.includes(nodeId)) continue;

      const cb = (node as PuzzleEntity).collarBounds;
      const minX = cb ? cb.xLeft : (node.x - 4);
      const maxX = cb ? cb.xRight : (node.x + 4);
      const yTop = cb ? cb.yTop : (node.y - 3);
      const yBottom = cb ? cb.yBottom : (node.y + 3);
      const gateType = (node as PuzzleEntity).gateType;
      // Chasms and creature guardians block walking, not torchlight like solid rocks
      const isBlockingSight = gateType !== 'chasm' && gateType !== 'guardian';

      pushBoxSegments(segments, minX, maxX, yTop, yBottom, {
        isRock: true,
        blocksSight: isBlockingSight,
        gateType: gateType || 'rock',
        rockId: node.id,
        yNode: node.y,
        minX,
        maxX,
        yTop,
        yBottom
      });
    }
  }

  return segments;
}

/**
 * Ray-segment intersection from ray origin (r_px, r_py) and direction (r_dx, r_dy).
 * Uses a tiny segment-parameter epsilon so shared wall vertices do not leak rays.
 */
function getRaySegmentIntersection(
  r_px: number,
  r_py: number,
  r_dx: number,
  r_dy: number,
  segment: Segment2D
): RayIntersection | null {
  const s_px = segment.a.x;
  const s_py = segment.a.y;
  const s_dx = segment.b.x - segment.a.x;
  const s_dy = segment.b.y - segment.a.y;

  const det = s_dx * r_dy - s_dy * r_dx;
  if (Math.abs(det) < 1e-10) return null; // Parallel or nearly so

  const T2 = (r_dx * (s_py - r_py) + r_dy * (r_px - s_px)) / det;
  const T1 = (Math.abs(r_dx) > 1e-10)
    ? (s_px + s_dx * T2 - r_px) / r_dx
    : (s_py + s_dy * T2 - r_py) / r_dy;

  const T2_EPS = 1e-9;
  if (T1 < 0) return null;
  if (T2 < -T2_EPS || T2 > 1 + T2_EPS) return null;

  return {
    x: r_px + r_dx * T1,
    y: r_py + r_dy * T1,
    param: T1
  };
}

/**
 * Standard ray-segment intersection.
 * ray = { a: origin, b: point_on_ray }
 * segment = { a: start, b: end }
 */
function getIntersection(ray: Segment2D, segment: Segment2D): RayIntersection | null {
  return getRaySegmentIntersection(
    ray.a.x,
    ray.a.y,
    ray.b.x - ray.a.x,
    ray.b.y - ray.a.y,
    segment
  );
}

/**
 * Normalizes an angle in radians into [-Math.PI, Math.PI).
 */
function normalizeAngle(a: number): number {
  let wrapped = (a + Math.PI) % (Math.PI * 2);
  if (wrapped < 0) wrapped += Math.PI * 2;
  return wrapped - Math.PI;
}

/**
 * Casts rays to endpoints and builds visibility polygon.
 */
export function castRays(
  origin: Point2D | null | undefined,
  segments: readonly ObstacleSegment[] | null | undefined,
  radius = 30
): RayIntersection[] {
  if (!origin || isNaN(origin.x) || isNaN(origin.y)) return [];
  if (!segments || segments.length === 0) return [];

  const sightSegments = segments.filter(s => s.blocksSight !== false);
  if (sightSegments.length === 0) return [];

  const reach = radius * 1.35;
  const minRx = origin.x - reach;
  const maxRx = origin.x + reach;
  const minRy = origin.y - reach;
  const maxRy = origin.y + reach;
  const localSightSegments = sightSegments.filter(s => {
    const ax = s.a.x;
    const bx = s.b.x;
    if ((ax < minRx && bx < minRx) || (ax > maxRx && bx > maxRx)) return false;
    const ay = s.a.y;
    const by = s.b.y;
    if ((ay < minRy && by < minRy) || (ay > maxRy && by > maxRy)) return false;
    return true;
  });

  const points: Point2D[] = [];
  localSightSegments.forEach(s => {
    if (s.a) points.push(s.a);
    if (s.b) points.push(s.b);
  });

  const seenKeys = new Set<string>();
  const uniquePoints = points.filter(p => {
    if (!p || isNaN(p.x) || isNaN(p.y)) return false;
    const rx = Math.round(p.x * 100);
    const ry = Math.round(p.y * 100);
    const sKey = `${rx},${ry}`;
    if (seenKeys.has(sKey)) return false;
    seenKeys.add(sKey);
    return true;
  });

  const angles: number[] = [];
  const maxRayReachSq = (radius * 1.35) ** 2;
  uniquePoints.forEach(p => {
    const dx = p.x - origin.x;
    const dy = p.y - origin.y;
    if (dx * dx + dy * dy > maxRayReachSq) return;
    const angle = Math.atan2(dy, dx);
    angles.push(normalizeAngle(angle - 0.0001));
    angles.push(normalizeAngle(angle + 0.0001));
  });

  // Ensure smooth circular perimeter even in wide open chambers
  const ringCount = 24;
  for (let i = 0; i < ringCount; i++) {
    angles.push(normalizeAngle(-Math.PI + (i / ringCount) * Math.PI * 2));
  }

  const intersects: Array<RayIntersection & { angle: number }> = [];
  angles.forEach(angle => {
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);

    let closest: RayIntersection | null = null;
    for (let i = 0; i < localSightSegments.length; i++) {
      const hit = getRaySegmentIntersection(origin.x, origin.y, dx, dy, localSightSegments[i]);
      if (!hit) continue;
      if (!closest || hit.param < closest.param) {
        closest = hit;
      }
    }

    if (closest) {
      if (closest.param > radius) {
        closest.x = origin.x + dx * radius;
        closest.y = origin.y + dy * radius;
        closest.param = radius;
      }
      intersects.push({ ...closest, angle });
    } else {
      intersects.push({
        x: origin.x + dx * radius,
        y: origin.y + dy * radius,
        angle,
        param: radius
      });
    }
  });

  intersects.sort((a, b) => a.angle - b.angle);
  return intersects;
}

/**
 * Returns visibility polygon vertices for `heroPos`.
 */
export function getVisibilityPolygon(
  heroPos: Point2D,
  segments: readonly ObstacleSegment[],
  radius = 30,
  screens = 2.5
): RayIntersection[] {
  const scaledHeroPos: Point2D = {
    x: heroPos.x,
    y: heroPos.y * screens // HERO MUST BE SCALED TO MATCH SEGMENT SPACE
  };
  return castRays(scaledHeroPos, segments, radius);
}

/**
 * Point in polygon test for raycast visibility polygons.
 */
export function isPointInVisibilityPolygon(
  point: Point2D,
  polygonPoints: readonly Point2D[] | null | undefined
): boolean {
  if (!polygonPoints || polygonPoints.length === 0) return false;
  return isPointInPolygon(point, polygonPoints);
}

/**
 * Checks if a line segment between p1 and p2 intersects any segments.
 * Returns true if there is an intersection.
 */
export function checkCollision(
  p1: Point2D | null | undefined,
  p2: Point2D | null | undefined,
  segments: readonly Segment2D[] | null | undefined
): boolean {
  if (!p1 || !p2 || !segments || segments.length === 0) return false;
  const minX = p1.x < p2.x ? p1.x : p2.x;
  const maxX = p1.x > p2.x ? p1.x : p2.x;
  const minY = p1.y < p2.y ? p1.y : p2.y;
  const maxY = p1.y > p2.y ? p1.y : p2.y;
  const ray: Segment2D = { a: p1, b: p2 };
  for (const s of segments) {
    const ax = s.a.x;
    const bx = s.b.x;
    if ((ax < minX && bx < minX) || (ax > maxX && bx > maxX)) continue;
    const ay = s.a.y;
    const by = s.b.y;
    if ((ay < minY && by < minY) || (ay > maxY && by > maxY)) continue;
    const hit = getIntersection(ray, s);
    if (hit && hit.param > 1e-6 && hit.param < 1 - 1e-6) {
      return true;
    }
  }
  return false;
}

export interface ExtraLightSource {
  x: number;
  y: number;
  radius: number;
}

export interface ComputeVisibleEntitiesParams {
  puzzleEntities: readonly PuzzleEntity[];
  playerPos: Point2D;
  obstacleSegments: readonly ObstacleSegment[];
  torchRadius: number;
  yScale: number;
  levelId: string;
  hasPickaxe: boolean;
  caveWallVertices?: CaveWallVertices | null;
  extraLightSources?: readonly ExtraLightSource[];
}

/**
 * Computes the set of entity IDs visible from `playerPos` (within `torchRadius`)
 * or any illuminated secondary light source (e.g. lit cave braziers)
 * after checking line-of-sight against sight-blocking obstacle segments.
 */
export function computeVisibleEntitiesSet({
  puzzleEntities,
  playerPos,
  obstacleSegments,
  torchRadius,
  yScale,
  levelId,
  hasPickaxe,
  caveWallVertices,
  extraLightSources = []
}: ComputeVisibleEntitiesParams): Set<string> {
  const visible = new Set<string>();
  const sightSegments = obstacleSegments.filter((s) => s.blocksSight !== false);
  const lightSources: ExtraLightSource[] = [
    { x: playerPos.x, y: playerPos.y, radius: torchRadius },
    ...extraLightSources
  ];

  puzzleEntities.forEach((e) => {
    if (levelId === 'shipwreck' && (e.id === 'sea_witch' || e.isGoal)) {
      visible.add(e.id);
      return;
    }

    const isChasm = Boolean(e.isGatekeeper && e.gateType === 'chasm');
    const isRock =
      Boolean(
        e.isGatekeeper &&
          hasPickaxe &&
          e.id !== 'final_gate' &&
          !isChasm &&
          e.gateType !== 'guardian'
      ) || Boolean(e.isExtraRock);

    const otherSegments = sightSegments.filter((s) => s.rockId !== e.id);

    for (const src of lightSources) {
      const srcScaled: Point2D = { x: src.x, y: src.y * yScale };
      let targetPoint: Point2D;
      let dist: number;

      if (isRock || isChasm || e.isGatekeeper) {
        if (e.collarBounds) {
          const cb = e.collarBounds;
          if (cb.orientation === 'vertical') {
            const rockY = Math.max(cb.yTop + 2, Math.min(cb.yBottom - 2, src.y));
            const facingX = src.x < e.x ? cb.xLeft : cb.xRight;
            targetPoint = { x: facingX, y: rockY * yScale };
            dist = Math.hypot(facingX - src.x, rockY - src.y);
          } else {
            const rockX = Math.max(cb.xLeft + 2, Math.min(cb.xRight - 2, src.x));
            const facingY = src.y < e.y ? cb.yTop : cb.yBottom;
            targetPoint = { x: rockX, y: facingY * yScale };
            dist = Math.hypot(rockX - src.x, facingY - src.y);
          }
        } else {
          let rockX = e.x;
          if (levelId === 'underground' && caveWallVertices) {
            const bounds = getCorridorBounds(e.y, caveWallVertices, e.x >= 50);
            rockX = Math.max(bounds.xLeft + 2, Math.min(bounds.xRight - 2, src.x));
          }
          const facingY = src.y < e.y ? e.y - 1.5 : e.y + 1.5;
          targetPoint = { x: rockX, y: facingY * yScale };
          dist = Math.hypot(rockX - src.x, facingY - src.y);
        }
      } else {
        targetPoint = { x: e.x, y: e.y * yScale };
        dist = Math.hypot(e.x - src.x, e.y - src.y);
      }

      if (dist > src.radius) continue;
      if (!checkCollision(srcScaled, targetPoint, otherSegments)) {
        visible.add(e.id);
        break;
      }
    }
  });

  return visible;
}
