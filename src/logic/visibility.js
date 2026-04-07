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
  const processPath = (vertices) => {
    for (let i = 0; i < vertices.length - 1; i++) {
        segments.push({
            a: { x: vertices[i].x, y: vertices[i].y * screens },
            b: { x: vertices[i+1].x, y: vertices[i+1].y * screens }
        });
    }
    // Close the loop for paths that should be closed (like central pillar)
    // Actually our wall paths aren't necessarily closed loops in the segment sense
    // but the vertices define the "border".
  };

  if (caveWallVertices) {
    if (caveWallVertices.leftWall) processPath(caveWallVertices.leftWall);
    if (caveWallVertices.rightWall) processPath(caveWallVertices.rightWall);
    if (caveWallVertices.centralPillar) {
        processPath(caveWallVertices.centralPillar);
        // Pillar is definitely a loop
        const p = caveWallVertices.centralPillar;
        segments.push({
            a: { x: p[p.length-1].x, y: p[p.length-1].y * screens },
            b: { x: p[0].x, y: p[0].y * screens }
        });
    }
  }

  // 3. Rocks (Gatekeepers and Extra)
  if (mapNodes) {
    mapNodes.forEach(node => {
      if ((node.isGatekeeper || node.isExtraRock) && !defeated.includes(node.id)) {
          const sizeX = node.isExtraRock ? 2.5 : 4;
          const sizeY = node.isExtraRock ? 1.5 : 2;
          const x = node.x;
          const y = node.y * screens; // Scale rock y to match wall space

          // Rectangle around rock (approx 8x4 relative to screens)
          segments.push({ a: { x: x - sizeX, y: y - sizeY }, b: { x: x + sizeX, y: y - sizeY } });
          segments.push({ a: { x: x + sizeX, y: y - sizeY }, b: { x: x + sizeX, y: y + sizeY } });
          segments.push({ a: { x: x + sizeX, y: y + sizeY }, b: { x: x - sizeX, y: y + sizeY } });
          segments.push({ a: { x: x - sizeX, y: y + sizeY }, b: { x: x - sizeX, y: y - sizeY } });
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
  // For the plan's "Zone boundary walls", we add horizontal lines for locked paths.
  if (!unlockedZones.includes(2)) segments.push({ a: { x: 20, y: 20 * screens }, b: { x: 45, y: 20 * screens } });
  if (!unlockedZones.includes(3)) segments.push({ a: { x: 50, y: 23 * screens }, b: { x: 80, y: 23 * screens } });

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

    // Solve for T2 (segment parameter)
    // r_px + r_dx * T1 = s_px + s_dx * T2
    // r_py + r_dy * T1 = s_py + s_dy * T2
    
    const det = s_dx * r_dy - s_dy * r_dx;
    if (Math.abs(det) < 1e-6) return null; // Parallel

    const T2 = (r_dx * (s_py - r_py) + r_dy * (r_px - s_px)) / det;
    
    // Solve for T1 (ray parameter)
    // If r_dx is non-zero, use it. Otherwise use r_dy (it won't both be zero for a ray).
    let T1;
    if (Math.abs(r_dx) > 1e-6) {
        T1 = (s_px + s_dx * T2 - r_px) / r_dx;
    } else {
        T1 = (s_py + s_dy * T2 - r_py) / r_dy;
    }

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

    const points = [];
    segments.forEach(s => {
        if (s.a) points.push(s.a);
        if (s.b) points.push(s.b);
    });

    const uniquePoints = (function(pts) {
        const set = new Set();
        return pts.filter(p => {
            if (!p || isNaN(p.x) || isNaN(p.y)) return false;
            const key = `${Math.round(p.x * 1000) / 1000},${Math.round(p.y * 1000) / 1000}`;
            if (set.has(key)) return false;
            set.add(key);
            return true;
        });
    })(points);

    const angles = [];
    uniquePoints.forEach(p => {
        const angle = Math.atan2(p.y - origin.y, p.x - origin.x);
        angles.push(angle - 0.0001);
        angles.push(angle);
        angles.push(angle + 0.0001);
    });

    const intersects = [];
    angles.forEach(angle => {
        const dx = Math.cos(angle);
        const dy = Math.sin(angle);
        const ray = { a: origin, b: { x: origin.x + dx, y: origin.y + dy } };

        let closest = null;
        segments.forEach(s => {
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
export function getVisibilityPolygon(heroPos, mapNodes, caveWallVertices, unlockedZones, defeated, radius = 30, screens = 2.5) {
    const scaledHeroPos = { 
        x: heroPos.x, 
        y: heroPos.y * screens // HERO MUST BE SCALED TO MATCH SEGMENT SPACE
    };
    const segments = getObstacleSegments(mapNodes, caveWallVertices, unlockedZones, defeated, screens);
    const intersects = castRays(scaledHeroPos, segments, radius);
    return intersects.map(p => `${p.x},${p.y}`).join(' ');
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
