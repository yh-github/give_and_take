import type {
  CaveWallVertices,
  CorridorBounds,
  FacetLighting,
  NormalizedWallPolyline,
  OrganicBoulder,
  OrganicBoulderFacet,
  OrganicRockCluster,
  Point2D,
  WallPolyline
} from '../types/geometry.ts';

/**
 * Geometry & Procedural Organic Boulder Engine
 * Provides corridor boundary calculation, shared polyline/polygon primitives,
 * 3D organic boulder generation, and real-time hero-relative normal lighting.
 */

export function hashSeed(s: string | number): number {
  let h = 0;
  const str = String(s);
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h) + str.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

/**
 * Calculates the shortest Euclidean distance from point `p` to line segment `a-b`.
 */
export function distToSegment(p: Point2D, a: Point2D, b: Point2D): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l2 = dx * dx + dy * dy;
  if (l2 === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/**
 * Computes the minimum Euclidean distance from point `p` to any segment of `poly`.
 */
export function minDistToPolyline(
  p: Point2D,
  poly: readonly Point2D[] | null | undefined,
  closed = false
): number {
  if (!poly || poly.length < 2) return Infinity;
  let minD = Infinity;
  for (let i = 0; i < poly.length - 1; i++) {
    minD = Math.min(minD, distToSegment(p, poly[i], poly[i + 1]));
  }
  if (closed && poly.length > 2) {
    minD = Math.min(minD, distToSegment(p, poly[poly.length - 1], poly[0]));
  }
  return minD;
}

/**
 * Checks if point `p` is inside a polygon using the ray-casting parity test.
 */
export function isPointInPolygon(p: Point2D, poly: readonly Point2D[]): boolean {
  if (!poly || poly.length === 0) return false;
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x;
    const yi = poly[i].y;
    const xj = poly[j].x;
    const yj = poly[j].y;
    const intersect = ((yi > p.y) !== (yj > p.y))
      && (p.x < (xj - xi) * (p.y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Normalizes array-form or object-form wall polylines into a canonical shape.
 */
export function normalizeWallPolyline(
  poly: WallPolyline | null | undefined
): NormalizedWallPolyline | null {
  if (!poly) return null;
  const points = Array.isArray(poly) ? poly : poly.points;
  if (!points || points.length < 2) return null;
  return {
    points,
    closed: Array.isArray(poly) ? true : poly.closed !== false,
    isPillar: !Array.isArray(poly) && Boolean(poly.isPillar)
  };
}

/**
 * Finds all X intersection coordinates for a given polyline at targetY.
 */
function getPolylineXIntersections(polyline: readonly Point2D[] | undefined, targetY: number): number[] {
  if (!polyline || polyline.length < 2) return [];
  const results: number[] = [];
  for (let i = 0; i < polyline.length - 1; i++) {
    const p1 = polyline[i];
    const p2 = polyline[i + 1];
    const minY = Math.min(p1.y, p2.y);
    const maxY = Math.max(p1.y, p2.y);

    if (targetY >= minY && targetY <= maxY && minY !== maxY) {
      const t = (targetY - p1.y) / (p2.y - p1.y);
      const x = p1.x + t * (p2.x - p1.x);
      results.push(x);
    }
  }
  return results;
}

/**
 * Calculates exact inner corridor bounds [xLeft, xRight] at a given Y position.
 * Takes cave wall polylines (leftWall, rightWall, centralPillar).
 */
export function getCorridorBounds(
  y: number,
  caveWallVertices: CaveWallVertices | null | undefined,
  isRightChannel = false
): CorridorBounds {
  const defaultMinX = 15;
  const defaultMaxX = 85;
  if (!caveWallVertices) return { xLeft: defaultMinX, xRight: defaultMaxX };

  const leftWallXs = getPolylineXIntersections(caveWallVertices.leftWall, y);
  const rightWallXs = getPolylineXIntersections(caveWallVertices.rightWall, y);
  const pillarXs = caveWallVertices.centralPillar
    ? getPolylineXIntersections(caveWallVertices.centralPillar, y)
    : [];

  const leftWallX = leftWallXs.length > 0 ? Math.max(...leftWallXs) : defaultMinX;
  const rightWallX = rightWallXs.length > 0 ? Math.min(...rightWallXs) : defaultMaxX;

  if (pillarXs.length >= 2) {
    const pillarMinX = Math.min(...pillarXs);
    const pillarMaxX = Math.max(...pillarXs);

    if (isRightChannel) {
      return { xLeft: pillarMaxX, xRight: rightWallX };
    }
    return { xLeft: leftWallX, xRight: pillarMinX };
  }

  return { xLeft: leftWallX, xRight: rightWallX };
}

const organicRockCache = new Map<string, OrganicRockCluster>();

/**
 * Generates an organic cluster of 5-7 3D boulders spanning from xLeft to xRight.
 */
export function generateProceduralOrganicRock(
  xLeft: number,
  xRight: number,
  yCenter: number,
  height = 3.5,
  seed: string | number = 'rock'
): OrganicRockCluster {
  const cacheKey = `${xLeft},${xRight},${yCenter},${height},${seed}`;
  const cached = organicRockCache.get(cacheKey);
  if (cached) return cached;

  const val = hashSeed(seed);
  const width = Math.max(10, xRight - xLeft);

  const numBoulders = 5 + (val % 3); // 5, 6, or 7 organic boulders
  const boulders: OrganicBoulder[] = [];

  for (let i = 0; i < numBoulders; i++) {
    const bSeed = `${seed}_b_${i}`;
    const bHash = hashSeed(bSeed);

    const uRatio = (i + 0.5) / numBoulders + ((bHash % 100) / 100 - 0.5) * 0.14;
    const clampedURatio = Math.max(0.08, Math.min(0.92, uRatio));

    const bLocalX = clampedURatio * 150;
    const bLocalY = 35 + (((bHash >> 2) % 100) / 100 - 0.5) * 22;

    const rx = 18 + (bHash % 14);
    const ry = 14 + ((bHash >> 4) % 10);

    const numPts = 8;
    const vertices: Point2D[] = [];
    for (let p = 0; p < numPts; p++) {
      const angle = (p / numPts) * Math.PI * 2;
      const rJitter = 1 + ((hashSeed(`${bSeed}_pt_${p}`) % 100) / 100 - 0.5) * 0.35;
      const vx = bLocalX + Math.cos(angle) * rx * rJitter;
      const vy = bLocalY + Math.sin(angle) * ry * rJitter;

      const clampedVx = Math.max(2, Math.min(148, vx));
      vertices.push({ x: clampedVx, y: vy });
    }

    const peakOffsetJitterX = ((hashSeed(`${bSeed}_peak_x`) % 100) / 100 - 0.5) * (rx * 0.3);
    const peakOffsetJitterY = ((hashSeed(`${bSeed}_peak_y`) % 100) / 100 - 0.5) * (ry * 0.3);
    const peak: Point2D = { x: bLocalX + peakOffsetJitterX, y: bLocalY + peakOffsetJitterY };

    const facets: OrganicBoulderFacet[] = [];
    for (let f = 0; f < numPts; f += 2) {
      const p1 = vertices[f];
      const p2 = vertices[(f + 1) % numPts];
      const p3 = vertices[(f + 2) % numPts];

      const fcx = (p1.x + p2.x + p3.x + peak.x) / 4;
      const fcy = (p1.y + p2.y + p3.y + peak.y) / 4;

      const fMapX = xLeft + (fcx / 150) * width;
      const fMapY = yCenter + ((fcy - 35) / 35) * (height / 2);

      const du = (fcx - bLocalX) / rx;
      const dv = (fcy - bLocalY) / ry;

      let nx = du * 0.75;
      let ny = dv * 0.85;
      let nz = Math.sqrt(Math.max(0.15, 1 - nx * nx - ny * ny));
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
      nx /= len;
      ny /= len;
      nz /= len;

      facets.push({
        id: `f_${i}_${f}`,
        pts: [p1, p2, p3, peak],
        mapCentroid: { x: fMapX, y: fMapY },
        normal: { x: nx, y: ny, z: nz }
      });
    }

    boulders.push({
      id: `boulder_${i}`,
      localX: bLocalX,
      localY: bLocalY,
      rx,
      ry,
      vertices,
      peak,
      facets
    });
  }

  const result: OrganicRockCluster = { xLeft, xRight, yCenter, width, height, boulders };
  organicRockCache.set(cacheKey, result);
  return result;
}

/**
 * Calculates dynamic hero-relative lighting intensity and facet color.
 */
export function calculateFacetLighting(
  facet: Pick<OrganicBoulderFacet, 'mapCentroid' | 'normal'>,
  heroPos: Point2D | null | undefined,
  screens = 2.5
): FacetLighting {
  if (!heroPos || isNaN(heroPos.x) || isNaN(heroPos.y)) {
    const defaultDot = facet.normal.y < 0 ? 0.7 : 0.4;
    return { intensity: defaultDot, color: getShadedColor(defaultDot) };
  }

  const lx = heroPos.x - facet.mapCentroid.x;
  const ly = (heroPos.y - facet.mapCentroid.y) * screens;
  const lz = 15;

  const lLen = Math.sqrt(lx * lx + ly * ly + lz * lz) || 1;
  const lNormX = lx / lLen;
  const lNormY = ly / lLen;
  const lNormZ = lz / lLen;

  const dot = facet.normal.x * lNormX + facet.normal.y * lNormY + facet.normal.z * lNormZ;
  const intensity = Math.min(1.0, Math.max(0.22, 0.25 + Math.max(0, dot) * 0.75));

  return {
    intensity,
    color: getShadedColor(intensity)
  };
}

/**
 * Maps light intensity [0.22 .. 1.0] to rich natural stone colors.
 */
export function getShadedColor(intensity: number): string {
  const r = Math.round(30 + intensity * (220 - 30));
  const g = Math.round(25 + intensity * (198 - 25));
  const b = Math.round(20 + intensity * (172 - 20));
  return `rgb(${r}, ${g}, ${b})`;
}
