import { getCorridorBounds } from './geometry.js';

/**
 * Visibility Engine: Raycasting and Obstacle Management
 */

/**
 * Converts game state into a set of line segments for the raycaster.
 */
export function getObstacleSegments(mapNodes, caveWallVertices, unlockedZones, defeated, screens = 2.5) {
  const segments = [];
  const height = screens * 100;

  // 1. Map Boundaries
  segments.push({ a: { x: 0, y: 0 }, b: { x: 100, y: 0 } });
  segments.push({ a: { x: 100, y: 0 }, b: { x: 100, y: height } });
  segments.push({ a: { x: 100, y: height }, b: { x: 0, y: height } });
  segments.push({ a: { x: 0, y: height }, b: { x: 0, y: 0 } });

  // 2. Cave Walls (Scaled to fit map height)
  const processPath = (vertices, isPillar = false) => {
    for (let i = 0; i < vertices.length - 1; i++) {
        segments.push({
            a: { x: vertices[i].x, y: vertices[i].y * screens },
            b: { x: vertices[i+1].x, y: vertices[i+1].y * screens },
            isPillar,
            isOuterWall: !isPillar
        });
    }
  };

  if (caveWallVertices) {
    if (caveWallVertices.leftWall) processPath(caveWallVertices.leftWall, false);
    if (caveWallVertices.rightWall) processPath(caveWallVertices.rightWall, false);
    if (caveWallVertices.centralPillar) {
        processPath(caveWallVertices.centralPillar, true);
        const p = caveWallVertices.centralPillar;
        segments.push({
            a: { x: p[p.length-1].x, y: p[p.length-1].y * screens },
            b: { x: p[0].x, y: p[0].y * screens },
            isPillar: true,
            isOuterWall: false
        });
    }
  }

  // 3. Rocks (Gatekeepers and Extra)
  if (mapNodes) {
    mapNodes.forEach(node => {
      // gatekeeper rocks should be wide enough to block most of the corridor (wall to pillar)
      if (node.isGatekeeper && !defeated.includes(node.id)) {
          const yTop = (node.y - 1.5) * screens;
          const yBottom = (node.y + 1.5) * screens;
          let minX, maxX;
          if (caveWallVertices) {
            const bounds = getCorridorBounds(node.y, caveWallVertices, node.x >= 50);
            minX = bounds.xLeft;
            maxX = bounds.xRight;
          } else if (node.y < 72) {
            if (node.x < 50) { minX = 16; maxX = 49; }
            else { minX = 51; maxX = 82; }
          } else {
            minX = 31; maxX = 69;
          }
          segments.push({ a: { x: minX, y: yTop }, b: { x: maxX, y: yTop }, isRock: true, rockId: node.id, yNode: node.y, minX, maxX, yTop, yBottom });
          segments.push({ a: { x: maxX, y: yTop }, b: { x: maxX, y: yBottom }, isRock: true, rockId: node.id, yNode: node.y, minX, maxX, yTop, yBottom });
          segments.push({ a: { x: maxX, y: yBottom }, b: { x: minX, y: yBottom }, isRock: true, rockId: node.id, yNode: node.y, minX, maxX, yTop, yBottom });
          segments.push({ a: { x: minX, y: yBottom }, b: { x: minX, y: yTop }, isRock: true, rockId: node.id, yNode: node.y, minX, maxX, yTop, yBottom });
      } else if (node.isExtraRock && !defeated.includes(node.id)) {
          const sizeX = 2.5;
          const yTop = (node.y - 1.5) * screens;
          const yBottom = (node.y + 1.5) * screens;
          const x = node.x;
          const minX = x - sizeX;
          const maxX = x + sizeX;
          segments.push({ a: { x: minX, y: yTop }, b: { x: maxX, y: yTop }, isRock: true, rockId: node.id, yNode: node.y, minX, maxX, yTop, yBottom });
          segments.push({ a: { x: maxX, y: yTop }, b: { x: maxX, y: yBottom }, isRock: true, rockId: node.id, yNode: node.y, minX, maxX, yTop, yBottom });
          segments.push({ a: { x: maxX, y: yBottom }, b: { x: minX, y: yBottom }, isRock: true, rockId: node.id, yNode: node.y, minX, maxX, yTop, yBottom });
          segments.push({ a: { x: minX, y: yBottom }, b: { x: minX, y: yTop }, isRock: true, rockId: node.id, yNode: node.y, minX, maxX, yTop, yBottom });
      }
    });
  }

  // 4. Locked Zone Walls (Physical Barriers)
  // Zones in Cave: 1 (start), 2,3,4,5,6,7,8,9 (treasure)
  // Hardcoded positions based on data.js pattern
  const zoneWalls = [
      { zones: [2], y: 22 * screens, xStart: 0, xEnd: 100 }, // Barrier above zone 2
      { zones: [3], y: 25 * screens, xStart: 0, xEnd: 100 }, // Barrier above zone 3
      // ... we can add more if needed, but the rocks themselves are the gatekeepers
  ];

  // For simplicity, we can treat locked zones as large black rectangles later or 
  // add segments specifically where we want to block sight into dark areas.
  // Given Option A, the "rocks" are the main occluders. 
  
  return segments;
}

/**
 * Converts a procedural isotropic cave's geometry and active gatekeepers
 * into line segments for raycasting and pathfinding.
 *
 * @param {Array<Object>} mapNodes - Puzzle entities
 * @param {Object} geometry - { worldWidth, worldHeight, wallPolylines }
 * @param {string[]} defeated - Defeated entity IDs
 * @returns {Array<Object>}
 */
export function getProceduralObstacleSegments(mapNodes, geometry, defeated = []) {
  const segments = [];
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
    const pts = Array.isArray(poly) ? poly : poly?.points;
    if (!pts || pts.length < 2) continue;
    const isClosed = Array.isArray(poly) ? true : (poly.closed !== false);
    const isPillar = Boolean(!Array.isArray(poly) && poly.isPillar);

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
      if (!(node.isGatekeeper || node.isExtraRock) || defeated.includes(node.id)) continue;

      const cb = node.collarBounds;
      const minX = cb ? cb.xLeft : (node.x - 4);
      const maxX = cb ? cb.xRight : (node.x + 4);
      const yTop = cb ? cb.yTop : (node.y - 3);
      const yBottom = cb ? cb.yBottom : (node.y + 3);
      const isBlockingSight = node.gateType !== 'chasm'; // Chasms block walking, not torchlight

      const meta = {
        isRock: true, // Used by pathfinding box-check for all solid gatekeepers
        blocksSight: isBlockingSight,
        gateType: node.gateType || 'rock',
        rockId: node.id,
        yNode: node.y,
        minX,
        maxX,
        yTop,
        yBottom
      };

      segments.push({ a: { x: minX, y: yTop }, b: { x: maxX, y: yTop }, ...meta });
      segments.push({ a: { x: maxX, y: yTop }, b: { x: maxX, y: yBottom }, ...meta });
      segments.push({ a: { x: maxX, y: yBottom }, b: { x: minX, y: yBottom }, ...meta });
      segments.push({ a: { x: minX, y: yBottom }, b: { x: minX, y: yTop }, ...meta });
    }
  }

  return segments;
}

/**
 * Standard ray-segment intersection.
 */
/**
 * Standard ray-segment intersection.
 * ray = { a: origin, b: point_on_ray }
 * segment = { a: start, b: end }
 */
function getIntersection(ray, segment) {
    const r_px = ray.a.x;
    const r_py = ray.a.y;
    const r_dx = ray.b.x - ray.a.x;
    const r_dy = ray.b.y - ray.a.y;
    const s_px = segment.a.x;
    const s_py = segment.a.y;
    const s_dx = segment.b.x - segment.a.x;
    const s_dy = segment.b.y - segment.a.y;

    const det = s_dx * r_dy - s_dy * r_dx;
    if (Math.abs(det) < 1e-10) return null; // Parallel or nearly so

    const T2 = (r_dx * (s_py - r_py) + r_dy * (r_px - s_px)) / det;
    const T1 = (Math.abs(r_dx) > 1e-10) ? (s_px + s_dx * T2 - r_px) / r_dx : (s_py + s_dy * T2 - r_py) / r_dy;

    if (T1 < 0) return null;
    if (T2 < 0 || T2 > 1) return null;

    return {
        x: r_px + r_dx * T1,
        y: r_py + r_dy * T1,
        param: T1
    };
}

/**
 * Casts rays to endpoints and builds visibility polygon.
 */
export function castRays(origin, segments, radius = 30) {
    if (!origin || isNaN(origin.x) || isNaN(origin.y)) return [];
    if (!segments || segments.length === 0) return [];

    const sightSegments = segments.filter(s => s.blocksSight !== false);
    if (sightSegments.length === 0) return [];

    const points = [];
    sightSegments.forEach(s => {
        if (s.a) points.push(s.a);
        if (s.b) points.push(s.b);
    });

    const uniquePoints = (function(pts) {
        const set = new Set();
        return pts.filter(p => {
            if (!p || isNaN(p.x) || isNaN(p.y)) return false;
            const rx = Math.round(p.x * 100);
            const ry = Math.round(p.y * 100);
            const sKey = `${rx},${ry}`;
            if (set.has(sKey)) return false;
            set.add(sKey);
            return true;
        });
    })(points);

    const angles = [];
    const maxRayReachSq = (radius * 1.35) ** 2;
    uniquePoints.forEach(p => {
        const dx = p.x - origin.x;
        const dy = p.y - origin.y;
        // Skip vertices far outside torch reach to keep raycasting fast on large maps
        if (dx * dx + dy * dy > maxRayReachSq) return;
        const angle = Math.atan2(dy, dx);
        angles.push(angle - 0.0001);
        angles.push(angle + 0.0001);
    });

    // Ensure smooth circular perimeter even in wide open chambers
    const ringCount = 24;
    for (let i = 0; i < ringCount; i++) {
        angles.push(-Math.PI + (i / ringCount) * Math.PI * 2);
    }

    const intersects = [];
    angles.forEach(angle => {
        const dx = Math.cos(angle);
        const dy = Math.sin(angle);
        const ray = { a: origin, b: { x: origin.x + dx, y: origin.y + dy } };

        let closest = null;
        sightSegments.forEach(s => {
            const hit = getIntersection(ray, s);
            if (!hit) return;
            if (!closest || hit.param < closest.param) {
                closest = hit;
            }
        });

        if (closest) {
            // Clamp to radius
            if (closest.param > radius) {
                closest.x = origin.x + dx * radius;
                closest.y = origin.y + dy * radius;
                closest.param = radius;
            }
            closest.angle = angle;
            intersects.push(closest);
        } else {
            // No hit (unlikely given boundary segments), but clamp to radius
            intersects.push({
                x: origin.x + dx * radius,
                y: origin.y + dy * radius,
                angle: angle,
                param: radius
            });
        }
    });

    intersects.sort((a, b) => a.angle - b.angle);
    return intersects;
}

/**
 * Returns SVG points string for visibility polygon.
 */
export function getVisibilityPolygon(heroPos, segments, radius = 30, screens = 2.5) {
    const scaledHeroPos = { 
        x: heroPos.x, 
        y: heroPos.y * screens // HERO MUST BE SCALED TO MATCH SEGMENT SPACE
    };
    const intersects = castRays(scaledHeroPos, segments, radius);
    return intersects;
}

/**
 * Point in polygon test (Winding number or Ray-casting).
 */
export function isPointInVisibilityPolygon(point, polygonPoints) {
    if (!polygonPoints || polygonPoints.length === 0) return false;
    
    let isInside = false;
    const pts = polygonPoints;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const xi = pts[i].x, yi = pts[i].y;
        const xj = pts[j].x, yj = pts[j].y;
        
        const intersect = ((yi > point.y) !== (yj > point.y))
            && (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
        if (intersect) isInside = !isInside;
    }
    return isInside;
}

/**
 * Checks if a line segment between p1 and p2 intersects any segments.
 * Returns true if there is an intersection.
 */
export function checkCollision(p1, p2, segments) {
    if (!p1 || !p2 || !segments || segments.length === 0) return false;
    const ray = { a: p1, b: p2 };
    for (const s of segments) {
        const hit = getIntersection(ray, s);
        // hit.param is the distance multiplier. 0-1 means the intersection is between p1 and p2.
        if (hit && hit.param > 0.001 && hit.param < 0.999) {
            return true;
        }
    }
    return false;
}
