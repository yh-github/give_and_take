import { checkCollision } from './visibility.js';

/**
 * Checks if two line segments (a-b) and (c-d) intersect.
 */
function segmentsIntersect(a, b, c, d) {
    const ccw = (p1, p2, p3) => (p3.y - p1.y) * (p2.x - p1.x) > (p2.y - p1.y) * (p3.x - p1.x);
    return (ccw(a, c, d) !== ccw(b, c, d)) && (ccw(a, b, c) !== ccw(a, b, d));
}

/**
 * Check if a line segment between p1 and p2 intersects any solid polygon.
 */
export function checkPolygonCollision(p1, p2, polygons) {
    if (!polygons || polygons.length === 0) return false;
    for (const poly of polygons) {
        if (!poly || poly.length < 3) continue;
        // 1. Check if segment intersects any edge of the polygon
        for (let i = 0; i < poly.length; i++) {
            const a = poly[i];
            const b = poly[(i + 1) % poly.length];
            if (segmentsIntersect(p1, p2, a, b)) return true;
        }
        // 2. Check if midpoint of segment is inside polygon
        const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
        if (isPointInPolygon(mid, poly)) return true;
    }
    return false;
}

export function smoothPath(path, segments, polygons = [], cornerClearance = 1.2) {
    if (!path || path.length <= 1) return path;
    if (path.length === 2) {
        if (segments && segments.length > 0 && checkCollision(path[0], path[1], segments)) {
            return [];
        }
        return path;
    }
    const smoothed = [path[0]];
    let current = 0;
    while (current < path.length - 1) {
        let furthest = current + 1;
        for (let next = path.length - 1; next > current + 1; next--) {
            const p1 = path[current];
            const p2 = path[next];
            const hasSegColl = segments && segments.length > 0 && (
                checkCollision(p1, p2, segments) ||
                hasCornerClearanceCollision(p1, p2, segments, cornerClearance)
            );
            const hasPolyColl = polygons && polygons.length > 0 && checkPolygonCollision(p1, p2, polygons);
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
function hasCornerClearanceCollision(p1, p2, segments, clearance = 1.2) {
    const l2 = (p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2;
    if (l2 < 1e-6) return false;
    const c2 = clearance * clearance;

    for (const seg of segments) {
        for (const pt of [seg.a, seg.b]) {
            if (!pt) continue;
            const t = ((pt.x - p1.x) * (p2.x - p1.x) + (pt.y - p1.y) * (p2.y - p1.y)) / l2;
            if (t > 0.15 && t < 0.85) {
                const projX = p1.x + t * (p2.x - p1.x);
                const projY = p1.y + t * (p2.y - p1.y);
                const d2 = (pt.x - projX) ** 2 + (pt.y - projY) ** 2;
                if (d2 < c2) return true;
            }
        }
    }
    return false;
}

/**
 * Calculates the shortest distance from a point to a line segment.
 */
function distToSegment(p, a, b) {
    const l2 = (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
    if (l2 === 0) return Math.sqrt((p.x - a.x) ** 2 + (p.y - a.y) ** 2);
    let t = ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.sqrt((p.x - (a.x + t * (b.x - a.x))) ** 2 + (p.y - (a.y + t * (b.y - a.y))) ** 2);
}

/**
 * Check if a point is inside a polygon using ray-casting.
 */
export function isPointInPolygon(p, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const xi = poly[i].x, yi = poly[i].y;
        const xj = poly[j].x, yj = poly[j].y;
        const intersect = ((yi > p.y) !== (yj > p.y))
            && (p.x < (xj - xi) * (p.y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}

/**
 * Finds a path from start to end using A* algorithm.
 * @param {Object} start {x, y}
 * @param {Object} end {x, y}
 * @param {Array} segments Array of {a: {x,y}, b: {x,y}}
 * @param {Object} bounds {width: 100, height: screens*100}
 * @param {Array} polygons Array of polygon vertices [{x,y}, ...]
 * @param {number} resolution Density of the grid (lower is more precise)
 * @param {Object} [options] Optional tuning ({ radius, maxIters, cornerClearance })
 */
export function findGlobalPath(start, end, segments, bounds, polygons = [], resolution = 3, options = {}) {
    const actualPolys = Array.isArray(polygons) ? polygons : [];
    if ((!segments || segments.length === 0) && actualPolys.length === 0) return [end];

    const cornerClearance = options.cornerClearance ?? 1.2;

    // Direct line-of-sight fast path: if no wall obstacles intersect start->end, go directly
    if (
        !checkCollision(start, end, segments || []) &&
        !checkPolygonCollision(start, end, actualPolys) &&
        !hasCornerClearanceCollision(start, end, segments || [], cornerClearance)
    ) {
        return [end];
    }

    const actualBounds = typeof bounds === 'number'
        ? { width: 100, height: bounds * 100 }
        : (bounds || { width: 100, height: 250 });
    const width = actualBounds.width || 100;
    const height = actualBounds.height || 250;
    const cols = Math.ceil(width / resolution);
    const rows = Math.ceil(height / resolution);

    // Grid coordinates (clamped to valid grid bounds)
    const toGrid = (p) => ({
        x: Math.max(0, Math.min(cols - 1, Math.round(p.x / resolution))),
        y: Math.max(0, Math.min(rows - 1, Math.round(p.y / resolution)))
    });

    const startG = toGrid(start);
    const endG = toGrid(end);

    const radius = options.radius ?? 2.0;
    const maxIters = options.maxIters ?? 15000;

    const isSolid = (gx, gy) => {
        const x = gx * resolution;
        const y = gy * resolution;

        // 1. Check if point is inside any solid polygon (volume check)
        for (const poly of polygons) {
            if (isPointInPolygon({ x, y }, poly)) return true;
        }

        // 2. Check if point is inside any intact rock bounding box (volume check)
        if (segments) {
            for (const seg of segments) {
                if (seg.isRock && seg.minX !== undefined) {
                    if (x >= seg.minX && x <= seg.maxX && y >= seg.yTop && y <= seg.yBottom) {
                        return true;
                    }
                }
            }
        }

        // 3. Check if point is too close to any wall segment (clearance check)
        // Skip clearance check for start and target points so we can path close to walls/destinations
        const isStartOrTarget = (gx === startG.x && gy === startG.y) || (gx === endG.x && gy === endG.y);
        if (!isStartOrTarget) {
            for (const seg of segments) {
                const minX = Math.min(seg.a.x, seg.b.x) - radius;
                const maxX = Math.max(seg.a.x, seg.b.x) + radius;
                const minY = Math.min(seg.a.y, seg.b.y) - radius;
                const maxY = Math.max(seg.a.y, seg.b.y) + radius;
                if (x < minX || x > maxX || y < minY || y > maxY) continue;

                if (distToSegment({ x, y }, seg.a, seg.b) < radius) return true;
            }
        }
        return false;
    };

    // A* State
    const key = (p) => `${p.x},${p.y}`;
    const openSet = [startG];
    const openSetKeys = new Set([key(startG)]);
    const cameFrom = new Map();
    const gScore = new Map();
    const fScore = new Map();

    gScore.set(key(startG), 0);
    fScore.set(key(startG), Math.abs(startG.x - endG.x) + Math.abs(startG.y - endG.y));

    let count = 0;
    while (openSet.length > 0 && count < maxIters) {
        count++;
        // Find node in openSet with lowest fScore in O(N) instead of O(N log N) sort
        let bestIdx = 0;
        let bestF = fScore.get(key(openSet[0])) ?? Infinity;
        for (let i = 1; i < openSet.length; i++) {
            const f = fScore.get(key(openSet[i])) ?? Infinity;
            if (f < bestF) {
                bestF = f;
                bestIdx = i;
            }
        }
        const current = openSet[bestIdx];
        openSet[bestIdx] = openSet[openSet.length - 1];
        openSet.pop();
        openSetKeys.delete(key(current));

        if (current.x === endG.x && current.y === endG.y) {
            // Reconstruct path
            const path = [];
            let temp = current;
            while (cameFrom.has(key(temp))) {
                const isGoal = temp.x === endG.x && temp.y === endG.y;
                path.push(isGoal ? { x: end.x, y: end.y } : { x: temp.x * resolution, y: temp.y * resolution });
                temp = cameFrom.get(key(temp));
            }
            const rawPath = path.reverse();
            if (rawPath.length > 0 && segments && segments.length > 0 && checkCollision(start, rawPath[0], segments)) {
                return [];
            }
            return smoothPath(rawPath, segments, polygons, cornerClearance);
        }

        const targetDx = endG.x - current.x;
        const targetDy = endG.y - current.y;
        const targetDist = Math.sqrt(targetDx * targetDx + targetDy * targetDy) || 1;

        // Neighbors (8-way)
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                if (dx === 0 && dy === 0) continue;
                const neighbor = { x: current.x + dx, y: current.y + dy };
                if (neighbor.x < 0 || neighbor.x >= cols || neighbor.y < 0 || neighbor.y >= rows) continue;
                
                // Skip if blocked
                if (isSolid(neighbor.x, neighbor.y)) continue;

                // Check collision between current and neighbor positions to prevent stepping across obstacle segments
                const pCurrent = (current.x === startG.x && current.y === startG.y)
                    ? start
                    : { x: current.x * resolution, y: current.y * resolution };
                const pNeighbor = (neighbor.x === endG.x && neighbor.y === endG.y)
                    ? end
                    : { x: neighbor.x * resolution, y: neighbor.y * resolution };

                if (segments && segments.length > 0 && checkCollision(pCurrent, pNeighbor, segments)) continue;

                // Step cost: diagonal is 1.414, straight is 1.0
                let stepCost = (dx !== 0 && dy !== 0 ? 1.414 : 1);
                
                // Directional penalty: penalize steps moving opposite/away from target direction
                const dot = (dx * targetDx + dy * targetDy) / targetDist;
                if (dot < 0) {
                    stepCost += 0.5 * Math.abs(dot); // Penalty for stepping backwards
                }

                const tentativeGScore = (gScore.get(key(current)) || 0) + stepCost;
                const neighborKey = key(neighbor);
                const currentNeighborG = gScore.has(neighborKey) ? gScore.get(neighborKey) : Infinity;
                if (tentativeGScore < currentNeighborG) {
                    cameFrom.set(neighborKey, current);
                    gScore.set(neighborKey, tentativeGScore);
                    const dxH = Math.abs(neighbor.x - endG.x);
                    const dyH = Math.abs(neighbor.y - endG.y);
                    fScore.set(neighborKey, tentativeGScore + Math.max(dxH, dyH) + 0.414 * Math.min(dxH, dyH));
                    if (!openSetKeys.has(neighborKey)) {
                        openSet.push(neighbor);
                        openSetKeys.add(neighborKey);
                    }
                }
            }
        }
    }

    // Fallback: if A* fails or times out, return empty path (unreachable)
    return [];
}

/**
 * Checks reachability from `start` to every point in `targets` in one single
 * grid pass + BFS flood-fill using the exact same clearance & collision rules
 * as `findGlobalPath`. Returns an array of booleans matching `targets`.
 */
export function checkBatchReachability(start, targets, segments, bounds, polygons = [], resolution = 3, options = {}) {
    if (!targets || targets.length === 0) return [];
    const actualPolys = Array.isArray(polygons) ? polygons : [];
    const segs = segments || [];
    if (segs.length === 0 && actualPolys.length === 0) return targets.map(() => true);

    const actualBounds = typeof bounds === 'number'
        ? { width: 100, height: bounds * 100 }
        : (bounds || { width: 100, height: 250 });
    const width = actualBounds.width || 100;
    const height = actualBounds.height || 250;
    const cols = Math.ceil(width / resolution);
    const rows = Math.ceil(height / resolution);
    const radius = options.radius ?? 2.0;

    // Precompute solid grid ONCE across all targets
    const solid = new Uint8Array(cols * rows);
    for (let gy = 0; gy < rows; gy++) {
        const y = gy * resolution;
        for (let gx = 0; gx < cols; gx++) {
            const x = gx * resolution;
            let blocked = false;
            for (let p = 0; p < actualPolys.length; p++) {
                if (isPointInPolygon({ x, y }, actualPolys[p])) {
                    blocked = true;
                    break;
                }
            }
            if (!blocked && segs.length > 0) {
                for (let i = 0; i < segs.length; i++) {
                    const seg = segs[i];
                    if (seg.isRock && seg.minX !== undefined) {
                        if (x >= seg.minX && x <= seg.maxX && y >= seg.yTop && y <= seg.yBottom) {
                            blocked = true;
                            break;
                        }
                    }
                    const minX = Math.min(seg.a.x, seg.b.x) - radius;
                    const maxX = Math.max(seg.a.x, seg.b.x) + radius;
                    const minY = Math.min(seg.a.y, seg.b.y) - radius;
                    const maxY = Math.max(seg.a.y, seg.b.y) + radius;
                    if (x < minX || x > maxX || y < minY || y > maxY) continue;
                    if (distToSegment({ x, y }, seg.a, seg.b) < radius) {
                        blocked = true;
                        break;
                    }
                }
            }
            if (blocked) solid[gy * cols + gx] = 1;
        }
    }

    const toGrid = (p) => ({
        x: Math.max(0, Math.min(cols - 1, Math.round(p.x / resolution))),
        y: Math.max(0, Math.min(rows - 1, Math.round(p.y / resolution)))
    });
    const startG = toGrid(start);
    const visited = new Uint8Array(cols * rows);
    const queueX = [startG.x];
    const queueY = [startG.y];
    visited[startG.y * cols + startG.x] = 1;

    let head = 0;
    while (head < queueX.length) {
        const cx = queueX[head];
        const cy = queueY[head];
        head++;
        const pCur = (cx === startG.x && cy === startG.y)
            ? start
            : { x: cx * resolution, y: cy * resolution };
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                if (dx === 0 && dy === 0) continue;
                const nx = cx + dx;
                const ny = cy + dy;
                if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) continue;
                const nIdx = ny * cols + nx;
                if (visited[nIdx] || solid[nIdx]) continue;
                if (segs.length > 0 && checkCollision(pCur, { x: nx * resolution, y: ny * resolution }, segs)) continue;
                visited[nIdx] = 1;
                queueX.push(nx);
                queueY.push(ny);
            }
        }
    }

    const cornerClearance = options.cornerClearance ?? 1.2;
    return targets.map(t => {
        if (
            !checkCollision(start, t, segs) &&
            !checkPolygonCollision(start, t, actualPolys) &&
            !hasCornerClearanceCollision(start, t, segs, cornerClearance)
        ) {
            return true;
        }
        const tg = toGrid(t);
        if (visited[tg.y * cols + tg.x]) return true;
        // Exact same "skip clearance check for endG" semantics as findGlobalPath: check any reachable neighbor connecting cleanly to t
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


