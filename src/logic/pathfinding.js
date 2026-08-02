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

export function smoothPath(path, segments, polygons = []) {
    if (!path || path.length <= 2) return path;
    const smoothed = [path[0]];
    let current = 0;
    while (current < path.length - 1) {
        let furthest = current + 1;
        for (let next = path.length - 1; next > current + 1; next--) {
            const hasSegColl = segments && segments.length > 0 && checkCollision(path[current], path[next], segments);
            const hasPolyColl = polygons && polygons.length > 0 && checkPolygonCollision(path[current], path[next], polygons);
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
 */
export function findGlobalPath(start, end, segments, bounds, polygons = [], resolution = 3) {
    if ((!segments || segments.length === 0) && (!polygons || polygons.length === 0)) return [end];

    const width = bounds.width;
    const height = bounds.height;
    const cols = Math.ceil(width / resolution);
    const rows = Math.ceil(height / resolution);

    // Grid coordinates
    const toGrid = (p) => ({
        x: Math.round(p.x / resolution),
        y: Math.round(p.y / resolution)
    });

    const startG = toGrid(start);
    const endG = toGrid(end);

    const radius = 2.0; 

    const isSolid = (gx, gy) => {
        const x = gx * resolution;
        const y = gy * resolution;

        // 1. Check if point is inside any solid polygon (volume check)
        for (const poly of polygons) {
            if (isPointInPolygon({ x, y }, poly)) return true;
        }

        // 2. Check if point is too close to any wall segment (clearance check)
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
    const openSet = [startG];
    const cameFrom = new Map();
    const gScore = new Map();
    const fScore = new Map();

    const key = (p) => `${p.x},${p.y}`;
    gScore.set(key(startG), 0);
    fScore.set(key(startG), Math.abs(startG.x - endG.x) + Math.abs(startG.y - endG.y));

    let count = 0;
    while (openSet.length > 0 && count < 10000) {
        count++;
        // Get node with lowest fScore
        openSet.sort((a, b) => (fScore.get(key(a)) || Infinity) - (fScore.get(key(b)) || Infinity));
        const current = openSet.shift();

        if (current.x === endG.x && current.y === endG.y) {
            // Reconstruct path
            const path = [];
            let temp = current;
            while (cameFrom.has(key(temp))) {
                path.push({ x: temp.x * resolution, y: temp.y * resolution });
                temp = cameFrom.get(key(temp));
            }
            const rawPath = path.reverse();
            return smoothPath(rawPath, segments, polygons);
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
                    if (!openSet.find(p => p.x === neighbor.x && p.y === neighbor.y)) {
                        openSet.push(neighbor);
                    }
                }
            }
        }
    }

    // Fallback: if A* fails or times out, return empty path (unreachable)
    return [];
}

