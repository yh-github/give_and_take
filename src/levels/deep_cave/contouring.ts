import type {
  ExtractCaveContoursOptions,
  ExtractedCaveContours,
  OrientedBox,
  Point2D,
  RawTileContourLoop,
  WallPolylineObject
} from '../../types/index.ts';

/**
 * Contour Extraction & Collar-Preserving Simplification for `deep_cave`.
 *
 * Converts a boolean tile occupancy raster (`1` = solid rock, `0` = open floor)
 * into closed isotropic wall polylines (`wallPolylines`) and solid obstacle
 * polygons (`obstaclePolygons`) while keeping 3-tile doorway collars strictly
 * axis-aligned for zero-gap gatekeeper sealing.
 */

/**
 * Computes signed polygon area via Shoelace formula in screen coordinates (+x right, +y down).
 * Positive area => clockwise winding in screen space (open interior surrounded by solid).
 * Negative area => counter-clockwise winding in screen space (solid island surrounded by open).
 */
export function computeSignedArea(pts: readonly Point2D[] | null | undefined): number {
  if (!pts || pts.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return sum * 0.5;
}

/**
 * Eliminates isolated 2x2 diagonal checkerboard pinholes (`[[1,0],[0,1]]` or `[[0,1],[1,0]]`)
 * by sealing one unlocked open corner tile. Guarantees manifold degree-2 contour loops.
 */
export function cleanCheckerboards(
  solidGrid: number[][],
  lockedTiles: boolean[][] | null = null
): void {
  const rows = solidGrid.length;
  const cols = rows > 0 ? solidGrid[0].length : 0;
  if (rows < 2 || cols < 2) return;

  let changed = true;
  let guard = 0;
  while (changed && guard < rows * cols) {
    changed = false;
    guard++;
    for (let r = 0; r < rows - 1; r++) {
      for (let c = 0; c < cols - 1; c++) {
        const tl = solidGrid[r][c];
        const tr = solidGrid[r][c + 1];
        const bl = solidGrid[r + 1][c];
        const br = solidGrid[r + 1][c + 1];

        const isDiagA = tl === 1 && tr === 0 && bl === 0 && br === 1;
        const isDiagB = tl === 0 && tr === 1 && bl === 1 && br === 0;
        if (!isDiagA && !isDiagB) continue;

        const candidates: Array<[number, number]> = isDiagA
          ? [[r, c + 1], [r + 1, c]]
          : [[r, c], [r + 1, c + 1]];

        let filled = false;
        for (const [cr, cc] of candidates) {
          if (!lockedTiles || !lockedTiles[cr]?.[cc]) {
            solidGrid[cr][cc] = 1;
            filled = true;
            changed = true;
            break;
          }
        }
        if (!filled) {
          const [cr, cc] = candidates[0];
          solidGrid[cr][cc] = 1;
          changed = true;
        }
      }
    }
  }
}

/**
 * Traces exact boundary contours between solid (1) and open (0) tiles in grid space.
 * Directed edges follow the convention: SOLID is on the LEFT, OPEN is on the RIGHT.
 */
export function extractRawTileContours(
  solidGrid: ReadonlyArray<readonly number[]>,
  tileWidth: number,
  tileHeight: number
): RawTileContourLoop[] {
  const rows = solidGrid.length;
  const cols = rows > 0 ? solidGrid[0].length : 0;
  if (rows === 0 || cols === 0) return [];

  const isSolid = (tx: number, ty: number): boolean => {
    if (tx < 0 || tx >= cols || ty < 0 || ty >= rows) return true;
    return solidGrid[ty][tx] !== 0;
  };

  const outgoing = new Map<string, Point2D[]>();
  const addEdge = (x1: number, y1: number, x2: number, y2: number) => {
    const k = `${x1},${y1}`;
    let list = outgoing.get(k);
    if (!list) {
      list = [];
      outgoing.set(k, list);
    }
    list.push({ x: x2, y: y2 });
  };

  for (let ty = 0; ty < rows; ty++) {
    for (let tx = 0; tx < cols; tx++) {
      if (isSolid(tx, ty)) continue;
      if (isSolid(tx, ty - 1)) addEdge(tx, ty, tx + 1, ty);
      if (isSolid(tx + 1, ty)) addEdge(tx + 1, ty, tx + 1, ty + 1);
      if (isSolid(tx, ty + 1)) addEdge(tx + 1, ty + 1, tx, ty + 1);
      if (isSolid(tx - 1, ty)) addEdge(tx, ty + 1, tx, ty);
    }
  }

  const loops: RawTileContourLoop[] = [];
  for (const [startKey, startTargets] of outgoing.entries()) {
    while (startTargets.length > 0) {
      const [sx, sy] = startKey.split(',').map(Number);
      const firstTarget = startTargets.pop()!;
      const gridLoop: Point2D[] = [{ x: sx, y: sy }];
      let curr = firstTarget;
      let steps = 0;
      const maxSteps = (rows + 2) * (cols + 2) * 4;

      while ((curr.x !== sx || curr.y !== sy) && steps < maxSteps) {
        steps++;
        gridLoop.push(curr);
        const nextList = outgoing.get(`${curr.x},${curr.y}`);
        if (!nextList || nextList.length === 0) break;
        curr = nextList.pop()!;
      }

      if (gridLoop.length >= 4 && curr.x === sx && curr.y === sy) {
        const worldPts: Point2D[] = gridLoop.map(p => ({
          x: Math.round(p.x * tileWidth * 1e6) / 1e6,
          y: Math.round(p.y * tileHeight * 1e6) / 1e6
        }));
        const area = computeSignedArea(worldPts);
        if (Math.abs(area) > 1e-3) {
          loops.push({ points: worldPts, signedArea: area });
        }
      }
    }
  }

  return loops;
}

/**
 * Checks whether a world-space vertex lies on a doorway collar flank that must stay locked.
 */
function isCollarLockedVertex(
  pt: Point2D,
  collarLockBoxes: readonly OrientedBox[] | null | undefined,
  eps = 0.25
): boolean {
  if (!collarLockBoxes || collarLockBoxes.length === 0) return false;
  for (const box of collarLockBoxes) {
    if (box.orientation === 'horizontal') {
      const onFlankX = Math.abs(pt.x - box.xLeft) <= eps || Math.abs(pt.x - box.xRight) <= eps;
      const inSpanY = pt.y >= box.yTop - eps && pt.y <= box.yBottom + eps;
      if (onFlankX && inSpanY) return true;
    } else if (box.orientation === 'vertical') {
      const onFlankY = Math.abs(pt.y - box.yTop) <= eps || Math.abs(pt.y - box.yBottom) <= eps;
      const inSpanX = pt.x >= box.xLeft - eps && pt.x <= box.xRight + eps;
      if (onFlankY && inSpanX) return true;
    }
  }
  return false;
}

/**
 * Removes collinear interior points along straight horizontal/vertical chains while
 * keeping any locked collar vertices intact.
 */
function collapseCollinear(
  pts: Point2D[],
  lockedFlags: boolean[]
): { pts: Point2D[]; locked: boolean[] } {
  if (pts.length < 3) return { pts, locked: lockedFlags };
  const outPts: Point2D[] = [];
  const outLocked: boolean[] = [];
  const n = pts.length;
  const eps = 1e-4;

  for (let i = 0; i < n; i++) {
    const prevIdx = (i - 1 + n) % n;
    const nextIdx = (i + 1) % n;
    const prev = pts[prevIdx];
    const curr = pts[i];
    const next = pts[nextIdx];
    const cross = (curr.x - prev.x) * (next.y - curr.y) - (curr.y - prev.y) * (next.x - curr.x);
    const isCollinear = Math.abs(cross) <= eps;

    const bothNeighborsLocked = lockedFlags[prevIdx] && lockedFlags[nextIdx];
    if (isCollinear && (!lockedFlags[i] || bothNeighborsLocked)) {
      continue;
    }

    outPts.push(curr);
    outLocked.push(Boolean(lockedFlags[i]));
  }

  return { pts: outPts, locked: outLocked };
}

/**
 * Bevels sharp unlocked 90-degree tile staircase corners (analogous to Marching Squares
 * diagonal smoothing) while preserving collar edges strictly orthogonal.
 */
function bevelUnlockedCorners(
  pts: Point2D[],
  lockedFlags: boolean[],
  collarLockBoxes: readonly OrientedBox[],
  cutLimit = 1.25
): { pts: Point2D[]; locked: boolean[] } {
  const n = pts.length;
  if (n < 4) return { pts, locked: lockedFlags };

  const outPts: Point2D[] = [];
  const outLocked: boolean[] = [];

  for (let i = 0; i < n; i++) {
    const curr = pts[i];
    const prev = pts[(i - 1 + n) % n];
    const next = pts[(i + 1) % n];

    const touchesLock =
      lockedFlags[i] ||
      (isCollarLockedVertex(prev, collarLockBoxes, 0.3) && isCollarLockedVertex(curr, collarLockBoxes, 0.3)) ||
      (isCollarLockedVertex(curr, collarLockBoxes, 0.3) && isCollarLockedVertex(next, collarLockBoxes, 0.3));

    if (touchesLock) {
      outPts.push(curr);
      outLocked.push(Boolean(lockedFlags[i]));
      continue;
    }

    const dx1 = prev.x - curr.x;
    const dy1 = prev.y - curr.y;
    const len1 = Math.hypot(dx1, dy1);
    const dx2 = next.x - curr.x;
    const dy2 = next.y - curr.y;
    const len2 = Math.hypot(dx2, dy2);

    if (len1 < 0.8 || len2 < 0.8) {
      outPts.push(curr);
      outLocked.push(false);
      continue;
    }

    const dot = (dx1 * dx2 + dy1 * dy2) / (len1 * len2);
    if (Math.abs(dot) < 0.35) {
      const cut = Math.min(cutLimit, len1 * 0.32, len2 * 0.32);
      outPts.push({
        x: Math.round((curr.x + (dx1 / len1) * cut) * 1e4) / 1e4,
        y: Math.round((curr.y + (dy1 / len1) * cut) * 1e4) / 1e4
      });
      outLocked.push(false);
      outPts.push({
        x: Math.round((curr.x + (dx2 / len2) * cut) * 1e4) / 1e4,
        y: Math.round((curr.y + (dy2 / len2) * cut) * 1e4) / 1e4
      });
      outLocked.push(false);
    } else {
      outPts.push(curr);
      outLocked.push(false);
    }
  }

  return { pts: outPts, locked: outLocked };
}

function perpDistance(pt: Point2D, a: Point2D, b: Point2D): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 1e-12) return Math.hypot(pt.x - a.x, pt.y - a.y);
  return Math.abs(dy * pt.x - dx * pt.y + b.x * a.y - b.y * a.x) / Math.sqrt(lenSq);
}

/**
 * Ramer-Douglas-Peucker simplification on an open point slice [start..end].
 */
function rdpSlice(slice: Point2D[], epsilon: number): Point2D[] {
  if (slice.length <= 2) return slice;
  let maxDist = -1;
  let splitIdx = 0;
  const first = slice[0];
  const last = slice[slice.length - 1];
  for (let i = 1; i < slice.length - 1; i++) {
    const d = perpDistance(slice[i], first, last);
    if (d > maxDist) {
      maxDist = d;
      splitIdx = i;
    }
  }
  if (maxDist > epsilon) {
    const left = rdpSlice(slice.slice(0, splitIdx + 1), epsilon);
    const right = rdpSlice(slice.slice(splitIdx), epsilon);
    return [...left.slice(0, -1), ...right];
  }
  return [first, last];
}

/**
 * Simplifies a closed contour loop while pinning all locked collar vertices.
 */
function simplifyCollarPreservingLoop(
  pts: Point2D[],
  lockedFlags: readonly boolean[],
  epsilon = 0.55
): Point2D[] {
  const n = pts.length;
  if (n <= 4 || epsilon <= 0) return pts;

  const lockIndices: number[] = [];
  for (let i = 0; i < n; i++) {
    if (lockedFlags[i]) lockIndices.push(i);
  }

  if (lockIndices.length === 0) {
    let minIdx = 0;
    for (let i = 1; i < n; i++) {
      if (pts[i].y < pts[minIdx].y || (pts[i].y === pts[minIdx].y && pts[i].x < pts[minIdx].x)) {
        minIdx = i;
      }
    }
    const rotated = [...pts.slice(minIdx), ...pts.slice(0, minIdx), pts[minIdx]];
    const simplified = rdpSlice(rotated, epsilon);
    return simplified.slice(0, -1);
  }

  const out: Point2D[] = [];
  for (let k = 0; k < lockIndices.length; k++) {
    const startIdx = lockIndices[k];
    const endIdx = lockIndices[(k + 1) % lockIndices.length];
    const span: Point2D[] = [];
    let cur = startIdx;
    let safety = 0;
    while (safety <= n) {
      span.push(pts[cur]);
      if (cur === endIdx && safety > 0) break;
      cur = (cur + 1) % n;
      safety++;
    }
    const isDirectLockedSegment = span.length === 2;
    const reduced = isDirectLockedSegment ? span : rdpSlice(span, epsilon);
    for (let j = 0; j < reduced.length - 1; j++) {
      out.push(reduced[j]);
    }
  }

  return out.length >= 3 ? out : pts;
}

/**
 * Splits `[0..worldWidth, 0..worldHeight] \ Interior(outerOpenPoly)` into two
 * non-overlapping simple polygons representing the solid rock framing the cave.
 */
export function buildOuterRockPolygons(
  outerOpenPoly: readonly Point2D[] | null | undefined,
  worldWidth: number,
  worldHeight: number
): Point2D[][] {
  const n = outerOpenPoly?.length || 0;
  if (n < 3 || !outerOpenPoly) return [];

  let iTop = 0;
  let iBot = 0;
  for (let i = 1; i < n; i++) {
    if (outerOpenPoly[i].y < outerOpenPoly[iTop].y) iTop = i;
    if (outerOpenPoly[i].y > outerOpenPoly[iBot].y) iBot = i;
  }
  if (iTop === iBot) return [];

  const arcTopToBot: Point2D[] = [];
  let idx = iTop;
  let steps = 0;
  while (steps <= n) {
    arcTopToBot.push(outerOpenPoly[idx]);
    if (idx === iBot) break;
    idx = (idx + 1) % n;
    steps++;
  }

  const arcBotToTop: Point2D[] = [];
  idx = iBot;
  steps = 0;
  while (steps <= n) {
    arcBotToTop.push(outerOpenPoly[idx]);
    if (idx === iTop) break;
    idx = (idx + 1) % n;
    steps++;
  }

  const rightSolid: Point2D[] = [
    { x: outerOpenPoly[iBot].x, y: worldHeight },
    { x: worldWidth, y: worldHeight },
    { x: worldWidth, y: 0 },
    { x: outerOpenPoly[iTop].x, y: 0 },
    ...arcTopToBot
  ];

  const leftSolid: Point2D[] = [
    { x: outerOpenPoly[iTop].x, y: 0 },
    { x: 0, y: 0 },
    { x: 0, y: worldHeight },
    { x: outerOpenPoly[iBot].x, y: worldHeight },
    ...arcBotToTop
  ];

  return [leftSolid, rightSolid];
}

/**
 * Returns true if segment `a -> b` runs directly along a locked orthogonal collar flank
 * (the exact doorway boundary walls that gatekeepers must seal seamlessly).
 */
function isLockedCollarEdge(
  a: Point2D,
  b: Point2D,
  collarLockBoxes: readonly OrientedBox[] | null | undefined,
  eps = 0.28
): boolean {
  if (!collarLockBoxes || collarLockBoxes.length === 0) return false;
  for (const box of collarLockBoxes) {
    if (box.orientation === 'horizontal') {
      const bothOnLeft =
        Math.abs(a.x - box.xLeft) <= eps &&
        Math.abs(b.x - box.xLeft) <= eps &&
        a.y >= box.yTop - eps && a.y <= box.yBottom + eps &&
        b.y >= box.yTop - eps && b.y <= box.yBottom + eps;
      const bothOnRight =
        Math.abs(a.x - box.xRight) <= eps &&
        Math.abs(b.x - box.xRight) <= eps &&
        a.y >= box.yTop - eps && a.y <= box.yBottom + eps &&
        b.y >= box.yTop - eps && b.y <= box.yBottom + eps;
      if (bothOnLeft || bothOnRight) return true;
    } else if (box.orientation === 'vertical') {
      const bothOnTop =
        Math.abs(a.y - box.yTop) <= eps &&
        Math.abs(b.y - box.yTop) <= eps &&
        a.x >= box.xLeft - eps && a.x <= box.xRight + eps &&
        b.x >= box.xLeft - eps && b.x <= box.xRight + eps;
      const bothOnBot =
        Math.abs(a.y - box.yBottom) <= eps &&
        Math.abs(b.y - box.yBottom) <= eps &&
        a.x >= box.xLeft - eps && a.x <= box.xRight + eps &&
        b.x >= box.xLeft - eps && b.x <= box.xRight + eps;
      if (bothOnTop || bothOnBot) return true;
    }
  }
  return false;
}

/**
 * Checks if a candidate point lies inside any collar lock box (with margin).
 */
function isPointInAnyLockBox(
  pt: Point2D,
  collarLockBoxes: readonly OrientedBox[] | null | undefined,
  pad = 0.35
): boolean {
  if (!collarLockBoxes || collarLockBoxes.length === 0) return false;
  for (const box of collarLockBoxes) {
    if (
      pt.x >= box.xLeft - pad &&
      pt.x <= box.xRight + pad &&
      pt.y >= box.yTop - pad &&
      pt.y <= box.yBottom + pad
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Transforms an orthogonal/beveled contour into natural winding cave stone walls
 * by subdividing unlocked walls with outward-biased rock crags and smoothing unlocked
 * corners, while keeping every doorway collar flank vertex and segment 100% locked.
 */
function sculptOrganicCaveLoop(
  pts: Point2D[],
  collarLockBoxes: readonly OrientedBox[],
  worldWidth: number,
  worldHeight: number
): Point2D[] {
  const n = pts.length;
  if (n < 4) return pts;

  const isVertexLocked = (pt: Point2D) => isCollarLockedVertex(pt, collarLockBoxes, 0.32);

  const subdivided: Point2D[] = [];
  const subLocked: boolean[] = [];

  for (let i = 0; i < n; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % n];
    const aLocked = isVertexLocked(a);
    const edgeLocked = isLockedCollarEdge(a, b, collarLockBoxes);

    subdivided.push(a);
    subLocked.push(aLocked);

    if (edgeLocked) continue;

    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    if (len <= 6.2) continue;

    const nx = dy / len;
    const ny = -dx / len;
    const steps = Math.max(2, Math.round(len / 5.5));

    for (let s = 1; s < steps; s++) {
      const t = s / steps;
      const bx = a.x + dx * t;
      const by = a.y + dy * t;
      const distFromEnd = Math.min(t * len, (1 - t) * len);
      const fade = Math.min(1, distFromEnd / 2.8);

      const wave =
        Math.sin(bx * 0.27 + by * 0.19) * 0.65 +
        Math.cos(bx * 0.53 - by * 0.41) * 0.42 +
        Math.sin((bx - by) * 0.89) * 0.22;
      const disp = Math.max(0, Math.min(1.3, (0.58 + wave * 0.72) * fade));

      const cand: Point2D = {
        x: Math.max(1.2, Math.min(worldWidth - 1.2, bx + nx * disp)),
        y: Math.max(1.2, Math.min(worldHeight - 1.2, by + ny * disp))
      };

      if (isPointInAnyLockBox(cand, collarLockBoxes, 0.4)) {
        subdivided.push({ x: bx, y: by });
        subLocked.push(true);
      } else {
        subdivided.push({
          x: Math.round(cand.x * 1e4) / 1e4,
          y: Math.round(cand.y * 1e4) / 1e4
        });
        subLocked.push(false);
      }
    }
  }

  const m = subdivided.length;
  if (m < 5) return subdivided;
  const origArea = computeSignedArea(pts);
  const smoothed = new Array<Point2D>(m);

  for (let i = 0; i < m; i++) {
    const curr = subdivided[i];
    if (subLocked[i]) {
      smoothed[i] = curr;
      continue;
    }
    const prev = subdivided[(i - 1 + m) % m];
    const next = subdivided[(i + 1) % m];
    const cand: Point2D = {
      x: Math.round((curr.x * 0.56 + prev.x * 0.22 + next.x * 0.22) * 1e4) / 1e4,
      y: Math.round((curr.y * 0.56 + prev.y * 0.22 + next.y * 0.22) * 1e4) / 1e4
    };
    if (
      cand.x < 1.2 || cand.x > worldWidth - 1.2 ||
      cand.y < 1.2 || cand.y > worldHeight - 1.2 ||
      isPointInAnyLockBox(cand, collarLockBoxes, 0.35)
    ) {
      smoothed[i] = curr;
    } else {
      smoothed[i] = cand;
    }
  }

  const newArea = computeSignedArea(smoothed);
  if (Math.sign(newArea) !== Math.sign(origArea) || Math.abs(newArea) < 1e-2) {
    return subdivided;
  }
  return smoothed;
}

/**
 * Extracts simplified cave wall polylines and solid obstacle polygons from a tile raster.
 */
export function extractCaveContours(
  solidGrid: ReadonlyArray<readonly number[]>,
  {
    tileWidth,
    tileHeight,
    worldWidth,
    worldHeight,
    collarLockBoxes = [],
    lockedTiles = null,
    bevelCut = 1.25,
    simplifyEpsilon = 0.55,
    organicSculpt = worldHeight > 130
  }: ExtractCaveContoursOptions
): ExtractedCaveContours {
  const workingGrid = solidGrid.map(row => row.slice());
  cleanCheckerboards(workingGrid, lockedTiles);

  const rawLoops = extractRawTileContours(workingGrid, tileWidth, tileHeight);
  const wallPolylines: WallPolylineObject[] = [];
  const obstaclePolygons: Point2D[][] = [];

  let primaryOuterPts: Point2D[] | null = null;
  let maxPositiveArea = -1;

  for (const loop of rawLoops) {
    const isPillar = loop.signedArea < 0;
    const rawLocked = loop.points.map(pt => isCollarLockedVertex(pt, collarLockBoxes));
    const collapsed = collapseCollinear(loop.points, rawLocked);
    const beveled = bevelCut > 0
      ? bevelUnlockedCorners(collapsed.pts, collapsed.locked, collarLockBoxes, bevelCut)
      : collapsed;
    const simplifiedPts = simplifyCollarPreservingLoop(beveled.pts, beveled.locked, simplifyEpsilon);
    const finalPts = organicSculpt
      ? sculptOrganicCaveLoop(simplifiedPts, collarLockBoxes, worldWidth, worldHeight)
      : simplifiedPts;

    wallPolylines.push({
      points: finalPts,
      closed: true,
      isPillar
    });

    if (isPillar) {
      obstaclePolygons.push(finalPts);
    } else if (loop.signedArea > maxPositiveArea) {
      maxPositiveArea = loop.signedArea;
      primaryOuterPts = finalPts;
    }
  }

  if (primaryOuterPts) {
    const outerSolids = buildOuterRockPolygons(primaryOuterPts, worldWidth, worldHeight);
    obstaclePolygons.push(...outerSolids);
  }

  return {
    wallPolylines,
    obstaclePolygons,
    cleanedGrid: workingGrid
  };
}
