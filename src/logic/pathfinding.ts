import { distToSegment, isPointInPolygon } from './geometry.ts';
import { checkCollision } from './visibility.ts';
import type {
  ObstacleSegment,
  PathfindingBounds,
  PathfindingOptions,
  Point2D
} from '../types/index.ts';

export { isPointInPolygon };

interface RockBox {
  minX: number;
  maxX: number;
  yTop: number;
  yBottom: number;
}

interface GridSpatialContext {
  rowSegs: ObstacleSegment[][];
  solidCache: Uint8Array;
  isCellBlockedBase: (gx: number, gy: number) => boolean;
  isNearWallSeg: (gx: number, gy: number) => boolean;
}

/**
 * Checks if two line segments (a-b) and (c-d) intersect.
 */
function segmentsIntersect(a: Point2D, b: Point2D, c: Point2D, d: Point2D): boolean {
  const ccw = (p1: Point2D, p2: Point2D, p3: Point2D) =>
    (p3.y - p1.y) * (p2.x - p1.x) > (p2.y - p1.y) * (p3.x - p1.x);
  return (ccw(a, c, d) !== ccw(b, c, d)) && (ccw(a, b, c) !== ccw(a, b, d));
}

function resolveBoundsDimensions(bounds: PathfindingBounds): { width: number; height: number } {
  const actualBounds = typeof bounds === 'number'
    ? { width: 100, height: bounds * 100 }
    : (bounds || { width: 100, height: 250 });
  return {
    width: actualBounds.width || 100,
    height: actualBounds.height || 250
  };
}

function hasDirectLineOfSight(
  start: Point2D,
  end: Point2D,
  segs: readonly ObstacleSegment[],
  polys: ReadonlyArray<readonly Point2D[]>,
  cornerClearance: number
): boolean {
  return (
    !checkCollision(start, end, segs) &&
    !checkPolygonCollision(start, end, polys) &&
    !hasCornerClearanceCollision(start, end, segs, cornerClearance)
  );
}

/**
 * Check if a line segment between p1 and p2 intersects any solid polygon.
 */
export function checkPolygonCollision(
  p1: Point2D,
  p2: Point2D,
  polygons: ReadonlyArray<readonly Point2D[]> | null | undefined
): boolean {
  if (!polygons || polygons.length === 0) return false;
  const rMinX = p1.x < p2.x ? p1.x : p2.x;
  const rMaxX = p1.x > p2.x ? p1.x : p2.x;
  const rMinY = p1.y < p2.y ? p1.y : p2.y;
  const rMaxY = p1.y > p2.y ? p1.y : p2.y;
  const mid: Point2D = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };

  for (const poly of polygons) {
    if (!poly || poly.length < 3) continue;
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i];
      const b = poly[(i + 1) % poly.length];
      if ((a.x < rMinX && b.x < rMinX) || (a.x > rMaxX && b.x > rMaxX)) continue;
      if ((a.y < rMinY && b.y < rMinY) || (a.y > rMaxY && b.y > rMaxY)) continue;
      if (segmentsIntersect(p1, p2, a, b)) return true;
    }
    if (isPointInPolygon(mid, poly)) return true;
  }
  return false;
}

export function smoothPath(
  path: Point2D[],
  segments: readonly ObstacleSegment[] | null | undefined,
  polygons: ReadonlyArray<readonly Point2D[]> = [],
  cornerClearance = 1.2
): Point2D[] {
  if (!path || path.length <= 1) return path;
  if (path.length === 2) {
    if (segments && segments.length > 0 && checkCollision(path[0], path[1], segments)) {
      return [];
    }
    return path;
  }
  const smoothed: Point2D[] = [path[0]];
  let current = 0;
  while (current < path.length - 1) {
    let furthest = current + 1;
    for (let next = path.length - 1; next > current + 1; next--) {
      const p1 = path[current];
      const p2 = path[next];
      const hasSegColl = Boolean(
        segments &&
        segments.length > 0 &&
        (checkCollision(p1, p2, segments) || hasCornerClearanceCollision(p1, p2, segments, cornerClearance))
      );
      const hasPolyColl = Boolean(!hasSegColl && polygons && polygons.length > 0 && checkPolygonCollision(p1, p2, polygons));
      if (!hasSegColl && !hasPolyColl) {
        furthest = next;
        break;
      }
    }
    smoothed.push(path[furthest]);
    current = furthest;
  }
  return smoothed;
}

/**
 * Checks if the interior of segment (p1 -> p2) passes too close to any obstacle vertex.
 */
function hasCornerClearanceCollision(
  p1: Point2D,
  p2: Point2D,
  segments: readonly ObstacleSegment[],
  clearance = 1.2
): boolean {
  const l2 = (p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2;
  if (l2 < 1e-6) return false;
  const c2 = clearance * clearance;
  const minX = (p1.x < p2.x ? p1.x : p2.x) - clearance;
  const maxX = (p1.x > p2.x ? p1.x : p2.x) + clearance;
  const minY = (p1.y < p2.y ? p1.y : p2.y) - clearance;
  const maxY = (p1.y > p2.y ? p1.y : p2.y) + clearance;
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;

  for (const seg of segments) {
    for (const pt of [seg.a, seg.b]) {
      if (!pt) continue;
      if (pt.x < minX || pt.x > maxX || pt.y < minY || pt.y > maxY) continue;
      const t = ((pt.x - p1.x) * dx + (pt.y - p1.y) * dy) / l2;
      if (t > 0.15 && t < 0.85) {
        const projX = p1.x + t * dx;
        const projY = p1.y + t * dy;
        const d2 = (pt.x - projX) ** 2 + (pt.y - projY) ** 2;
        if (d2 < c2) return true;
      }
    }
  }
  return false;
}

/**
 * Precomputes per-row scanline X-intercepts for polygons and row-bucketed segments/rocks
 * so A* and batch BFS evaluate grid walkability lazily in O(1) amortized time per cell.
 */
function buildGridSpatialContext(
  cols: number,
  rows: number,
  resolution: number,
  segments: readonly ObstacleSegment[],
  actualPolys: ReadonlyArray<readonly Point2D[]>,
  radius: number
): GridSpatialContext {
  const polyRowIntercepts: Array<Array<number[] | null>> = [];
  for (let p = 0; p < actualPolys.length; p++) {
    const poly = actualPolys[p];
    if (!poly || poly.length < 3) continue;
    let minY = Infinity;
    let maxY = -Infinity;
    for (let i = 0; i < poly.length; i++) {
      const py = poly[i].y;
      if (py < minY) minY = py;
      if (py > maxY) maxY = py;
    }
    const rowLists: Array<number[] | null> = new Array(rows).fill(null);
    const minGy = Math.max(0, Math.floor(minY / resolution));
    const maxGy = Math.min(rows - 1, Math.ceil(maxY / resolution));
    const n = poly.length;
    for (let gy = minGy; gy <= maxGy; gy++) {
      const y = gy * resolution;
      const xs: number[] = [];
      for (let i = 0, j = n - 1; i < n; j = i++) {
        const yi = poly[i].y;
        const yj = poly[j].y;
        if ((yi > y) !== (yj > y)) {
          xs.push((poly[j].x - poly[i].x) * (y - yi) / (yj - yi) + poly[i].x);
        }
      }
      if (xs.length > 0) rowLists[gy] = xs;
    }
    polyRowIntercepts.push(rowLists);
  }

  const rowSegs: ObstacleSegment[][] = Array.from({ length: rows }, () => []);
  const rowRocks: RockBox[][] = Array.from({ length: rows }, () => []);
  const seenRockBoxes = new Set<string>();
  const pad = Math.max(radius, resolution) + 1e-6;

  if (segments) {
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      if (
        seg.isRock &&
        seg.minX !== undefined &&
        seg.maxX !== undefined &&
        seg.yTop !== undefined &&
        seg.yBottom !== undefined
      ) {
        const rKey = `${seg.minX},${seg.maxX},${seg.yTop},${seg.yBottom}`;
        if (!seenRockBoxes.has(rKey)) {
          seenRockBoxes.add(rKey);
          const box: RockBox = {
            minX: seg.minX,
            maxX: seg.maxX,
            yTop: seg.yTop,
            yBottom: seg.yBottom
          };
          const minRGy = Math.max(0, Math.floor(seg.yTop / resolution));
          const maxRGy = Math.min(rows - 1, Math.ceil(seg.yBottom / resolution));
          for (let gy = minRGy; gy <= maxRGy; gy++) {
            rowRocks[gy].push(box);
          }
        }
      }
      const sMinY = seg.a.y < seg.b.y ? seg.a.y : seg.b.y;
      const sMaxY = seg.a.y > seg.b.y ? seg.a.y : seg.b.y;
      const minGy = Math.max(0, Math.floor((sMinY - pad) / resolution));
      const maxGy = Math.min(rows - 1, Math.ceil((sMaxY + pad) / resolution));
      for (let gy = minGy; gy <= maxGy; gy++) {
        rowSegs[gy].push(seg);
      }
    }
  }

  // 0 = uncomputed, 1 = walkable, 2 = solid
  const solidCache = new Uint8Array(cols * rows);

  const isCellBlockedBase = (gx: number, gy: number): boolean => {
    const x = gx * resolution;
    const y = gy * resolution;

    for (let p = 0; p < polyRowIntercepts.length; p++) {
      const xs = polyRowIntercepts[p][gy];
      if (!xs) continue;
      let inside = false;
      for (let k = 0; k < xs.length; k++) {
        if (x < xs[k]) inside = !inside;
      }
      if (inside) return true;
    }

    const rocks = rowRocks[gy];
    for (let r = 0; r < rocks.length; r++) {
      const box = rocks[r];
      if (x >= box.minX && x <= box.maxX && y >= box.yTop && y <= box.yBottom) {
        return true;
      }
    }
    return false;
  };

  const isNearWallSeg = (gx: number, gy: number): boolean => {
    const segs = rowSegs[gy];
    if (segs.length === 0) return false;
    const x = gx * resolution;
    const y = gy * resolution;
    for (let i = 0; i < segs.length; i++) {
      const seg = segs[i];
      const ax = seg.a.x;
      const bx = seg.b.x;
      const minX = (ax < bx ? ax : bx) - radius;
      if (x < minX) continue;
      const maxX = (ax > bx ? ax : bx) + radius;
      if (x > maxX) continue;
      const ay = seg.a.y;
      const by = seg.b.y;
      const minY = (ay < by ? ay : by) - radius;
      if (y < minY) continue;
      const maxY = (ay > by ? ay : by) + radius;
      if (y > maxY) continue;
      if (distToSegment({ x, y }, seg.a, seg.b) < radius) return true;
    }
    return false;
  };

  return { rowSegs, solidCache, isCellBlockedBase, isNearWallSeg };
}

/**
 * Finds a path from start to end using A* algorithm.
 */
export function findGlobalPath(
  start: Point2D,
  end: Point2D,
  segments: readonly ObstacleSegment[] | null | undefined,
  bounds: PathfindingBounds,
  polygons: ReadonlyArray<readonly Point2D[]> = [],
  resolution = 3,
  options: PathfindingOptions = {}
): Point2D[] {
  const actualPolys = Array.isArray(polygons) ? polygons : [];
  const segs = segments || [];
  if (segs.length === 0 && actualPolys.length === 0) return [end];

  const cornerClearance = options.cornerClearance ?? 1.2;

  if (hasDirectLineOfSight(start, end, segs, actualPolys, cornerClearance)) {
    return [end];
  }

  const { width, height } = resolveBoundsDimensions(bounds);
  const cols = Math.ceil(width / resolution);
  const rows = Math.ceil(height / resolution);
  const totalCells = cols * rows;

  const startGx = Math.max(0, Math.min(cols - 1, Math.round(start.x / resolution)));
  const startGy = Math.max(0, Math.min(rows - 1, Math.round(start.y / resolution)));
  const endGx = Math.max(0, Math.min(cols - 1, Math.round(end.x / resolution)));
  const endGy = Math.max(0, Math.min(rows - 1, Math.round(end.y / resolution)));
  const startIdx = startGy * cols + startGx;
  const endIdx = endGy * cols + endGx;

  const radius = options.radius ?? 2.0;
  const maxIters = options.maxIters ?? 15000;

  const { rowSegs, solidCache, isCellBlockedBase, isNearWallSeg } = buildGridSpatialContext(
    cols, rows, resolution, segs, actualPolys, radius
  );

  const isSolid = (gx: number, gy: number): boolean => {
    const idx = gy * cols + gx;
    const cached = solidCache[idx];
    if (cached !== 0) return cached === 2;
    const isStartOrTarget = idx === startIdx || idx === endIdx;
    const blocked = isCellBlockedBase(gx, gy) || (!isStartOrTarget && isNearWallSeg(gx, gy));
    solidCache[idx] = blocked ? 2 : 1;
    return blocked;
  };

  const openSet = [startIdx];
  const inOpen = new Uint8Array(totalCells);
  inOpen[startIdx] = 1;
  const cameFrom = new Int32Array(totalCells).fill(-1);
  const gScore = new Float64Array(totalCells).fill(Infinity);
  const fScore = new Float64Array(totalCells).fill(Infinity);

  gScore[startIdx] = 0;
  fScore[startIdx] = Math.abs(startGx - endGx) + Math.abs(startGy - endGy);

  let count = 0;
  while (openSet.length > 0 && count < maxIters) {
    count++;
    let bestIdx = 0;
    let bestF = fScore[openSet[0]];
    for (let i = 1; i < openSet.length; i++) {
      const f = fScore[openSet[i]];
      if (f < bestF) {
        bestF = f;
        bestIdx = i;
      }
    }
    const currentIdx = openSet[bestIdx];
    openSet[bestIdx] = openSet[openSet.length - 1];
    openSet.pop();
    inOpen[currentIdx] = 0;

    if (currentIdx === endIdx) {
      const path: Point2D[] = [];
      let tempIdx = currentIdx;
      while (cameFrom[tempIdx] !== -1) {
        const isGoal = tempIdx === endIdx;
        if (isGoal) {
          path.push({ x: end.x, y: end.y });
        } else {
          const tx = tempIdx % cols;
          const ty = (tempIdx - tx) / cols;
          path.push({ x: tx * resolution, y: ty * resolution });
        }
        tempIdx = cameFrom[tempIdx];
      }
      const rawPath = path.reverse();
      if (rawPath.length > 0 && segs.length > 0 && checkCollision(start, rawPath[0], segs)) {
        return [];
      }
      return smoothPath(rawPath, segs, actualPolys, cornerClearance);
    }

    const cx = currentIdx % cols;
    const cy = (currentIdx - cx) / cols;
    const targetDx = endGx - cx;
    const targetDy = endGy - cy;
    const targetDist = Math.sqrt(targetDx * targetDx + targetDy * targetDy) || 1;
    const currentG = gScore[currentIdx];
    const isCurrentStart = currentIdx === startIdx;
    const pCurrent = isCurrentStart ? start : { x: cx * resolution, y: cy * resolution };

    for (let dx = -1; dx <= 1; dx++) {
      const nx = cx + dx;
      if (nx < 0 || nx >= cols) continue;
      for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue;
        const ny = cy + dy;
        if (ny < 0 || ny >= rows) continue;

        if (isSolid(nx, ny)) continue;

        const neighborIdx = ny * cols + nx;
        const isNeighborEnd = neighborIdx === endIdx;
        const pNeighbor = isNeighborEnd ? end : { x: nx * resolution, y: ny * resolution };
        const edgeSegs = (isCurrentStart || isNeighborEnd) ? segs : rowSegs[cy];
        if (edgeSegs.length > 0 && checkCollision(pCurrent, pNeighbor, edgeSegs)) continue;

        let stepCost = dx !== 0 && dy !== 0 ? 1.414 : 1;

        const dot = (dx * targetDx + dy * targetDy) / targetDist;
        if (dot < 0) {
          stepCost += 0.5 * Math.abs(dot);
        }

        const tentativeGScore = currentG + stepCost;
        if (tentativeGScore < gScore[neighborIdx]) {
          cameFrom[neighborIdx] = currentIdx;
          gScore[neighborIdx] = tentativeGScore;
          const dxH = Math.abs(nx - endGx);
          const dyH = Math.abs(ny - endGy);
          fScore[neighborIdx] = tentativeGScore + Math.max(dxH, dyH) + 0.414 * Math.min(dxH, dyH);
          if (!inOpen[neighborIdx]) {
            openSet.push(neighborIdx);
            inOpen[neighborIdx] = 1;
          }
        }
      }
    }
  }

  return [];
}

/**
 * Checks reachability from `start` to every point in `targets` in one single
 * grid pass + BFS flood-fill using the exact same clearance & collision rules
 * as `findGlobalPath`. Returns an array of booleans matching `targets`.
 */
export function checkBatchReachability(
  start: Point2D,
  targets: readonly Point2D[] | null | undefined,
  segments: readonly ObstacleSegment[] | null | undefined,
  bounds: PathfindingBounds,
  polygons: ReadonlyArray<readonly Point2D[]> = [],
  resolution = 3,
  options: PathfindingOptions = {}
): boolean[] {
  if (!targets || targets.length === 0) return [];
  const actualPolys = Array.isArray(polygons) ? polygons : [];
  const segs = segments || [];
  if (segs.length === 0 && actualPolys.length === 0) return targets.map(() => true);

  const { width, height } = resolveBoundsDimensions(bounds);
  const cols = Math.ceil(width / resolution);
  const rows = Math.ceil(height / resolution);
  const radius = options.radius ?? 2.0;

  const { rowSegs, solidCache, isCellBlockedBase, isNearWallSeg } = buildGridSpatialContext(
    cols, rows, resolution, segs, actualPolys, radius
  );

  const isSolid = (gx: number, gy: number): boolean => {
    const idx = gy * cols + gx;
    const cached = solidCache[idx];
    if (cached !== 0) return cached === 2;
    const blocked = isCellBlockedBase(gx, gy) || isNearWallSeg(gx, gy);
    solidCache[idx] = blocked ? 2 : 1;
    return blocked;
  };

  const toGrid = (p: Point2D) => ({
    x: Math.max(0, Math.min(cols - 1, Math.round(p.x / resolution))),
    y: Math.max(0, Math.min(rows - 1, Math.round(p.y / resolution)))
  });
  const startG = toGrid(start);
  const startIdx = startG.y * cols + startG.x;
  const visited = new Uint8Array(cols * rows);
  const queueX = [startG.x];
  const queueY = [startG.y];
  visited[startIdx] = 1;

  let head = 0;
  while (head < queueX.length) {
    const cx = queueX[head];
    const cy = queueY[head];
    head++;
    const isStart = (cy * cols + cx) === startIdx;
    const pCur = isStart ? start : { x: cx * resolution, y: cy * resolution };
    const edgeSegs = isStart ? segs : rowSegs[cy];
    for (let dx = -1; dx <= 1; dx++) {
      const nx = cx + dx;
      if (nx < 0 || nx >= cols) continue;
      for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue;
        const ny = cy + dy;
        if (ny < 0 || ny >= rows) continue;
        const nIdx = ny * cols + nx;
        if (visited[nIdx] || isSolid(nx, ny)) continue;
        if (edgeSegs.length > 0 && checkCollision(pCur, { x: nx * resolution, y: ny * resolution }, edgeSegs)) continue;
        visited[nIdx] = 1;
        queueX.push(nx);
        queueY.push(ny);
      }
    }
  }

  const cornerClearance = options.cornerClearance ?? 1.2;
  return targets.map(t => {
    if (hasDirectLineOfSight(start, t, segs, actualPolys, cornerClearance)) {
      return true;
    }
    const tg = toGrid(t);
    if (visited[tg.y * cols + tg.x]) return true;
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const nx = tg.x + dx;
        const ny = tg.y + dy;
        if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) continue;
        if (!visited[ny * cols + nx]) continue;
        const pN = (nx === startG.x && ny === startG.y)
          ? start
          : { x: nx * resolution, y: ny * resolution };
        if (segs.length === 0 || !checkCollision(pN, t, segs)) return true;
      }
    }
    return false;
  });
}
