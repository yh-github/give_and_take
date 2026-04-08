/**
 * Generic A* pathfinding on a 2D grid derived from obstacle segments.
 */

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
 * Finds a path from start to end using A* algorithm.
 * @param {Object} start {x, y}
 * @param {Object} end {x, y}
 * @param {Array} segments Array of {a: {x,y}, b: {x,y}}
 * @param {Object} bounds {width: 100, height: screens*100}
 * @param {number} resolution Density of the grid (lower is more precise)
 */
export function findGlobalPath(start, end, segments, bounds, resolution = 3) {
    if (!segments || segments.length === 0) return [end];

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

    // Check if end is reachable at all (if start is blocked, we're in trouble, but let's try)
    // Radius for "solid" check. Higher = safer clearance from walls.
    const radius = 4.5; 

    const isSolid = (gx, gy) => {
        const x = gx * resolution;
        const y = gy * resolution;
        // Optimization: don't check segments far away
        for (const seg of segments) {
            // Fast bounding box check
            const minX = Math.min(seg.a.x, seg.b.x) - radius;
            const maxX = Math.max(seg.a.x, seg.b.x) + radius;
            const minY = Math.min(seg.a.y, seg.b.y) - radius;
            const maxY = Math.max(seg.a.y, seg.b.y) + radius;
            if (x < minX || x > maxX || y < minY || y > maxY) continue;

            if (distToSegment({ x, y }, seg.a, seg.b) < radius) return true;
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
    while (openSet.length > 0 && count < 2000) {
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
            return path.reverse();
        }

        // Neighbors (8-way)
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                if (dx === 0 && dy === 0) continue;
                const neighbor = { x: current.x + dx, y: current.y + dy };
                if (neighbor.x < 0 || neighbor.x >= cols || neighbor.y < 0 || neighbor.y >= rows) continue;
                
                // Skip if blocked
                if (isSolid(neighbor.x, neighbor.y)) continue;

                const tentativeGScore = (gScore.get(key(current)) || 0) + (dx !== 0 && dy !== 0 ? 1.414 : 1);
                const neighborKey = key(neighbor);
                if (tentativeGScore < (gScore.get(neighborKey) || Infinity)) {
                    cameFrom.set(neighborKey, current);
                    gScore.set(neighborKey, tentativeGScore);
                    fScore.set(neighborKey, tentativeGScore + Math.abs(neighbor.x - endG.x) + Math.abs(neighbor.y - endG.y));
                    if (!openSet.find(p => p.x === neighbor.x && p.y === neighbor.y)) {
                        openSet.push(neighbor);
                    }
                }
            }
        }
    }

    // Fallback: if A* fails or times out, return a direct path (better than nothing)
    return [end];
}
