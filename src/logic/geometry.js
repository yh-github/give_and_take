/**
 * Geometry & Procedural Organic Boulder Engine
 * Provides corridor boundary calculation, 3D organic boulder generation,
 * and real-time hero-relative normal lighting.
 */

// Simple deterministic hash helper
export function hashSeed(s) {
  let h = 0;
  const str = String(s);
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h) + str.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

/**
 * Finds all X intersection coordinates for a given polyline at targetY.
 */
function getPolylineXIntersections(polyline, targetY) {
  if (!polyline || polyline.length < 2) return [];
  const results = [];
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
export function getCorridorBounds(y, caveWallVertices, isRightChannel = false) {
  const defaultMinX = 15;
  const defaultMaxX = 85;
  if (!caveWallVertices) return { xLeft: defaultMinX, xRight: defaultMaxX };

  const leftWallXs = getPolylineXIntersections(caveWallVertices.leftWall, y);
  const rightWallXs = getPolylineXIntersections(caveWallVertices.rightWall, y);
  const pillarXs = caveWallVertices.centralPillar ? getPolylineXIntersections(caveWallVertices.centralPillar, y) : [];

  const leftWallX = leftWallXs.length > 0 ? Math.max(...leftWallXs) : defaultMinX;
  const rightWallX = rightWallXs.length > 0 ? Math.min(...rightWallXs) : defaultMaxX;

  // If central pillar exists at this Y level
  if (pillarXs.length >= 2) {
    const pillarMinX = Math.min(...pillarXs);
    const pillarMaxX = Math.max(...pillarXs);

    if (isRightChannel) {
      // Right channel: between central pillar right edge and right wall
      return { xLeft: pillarMaxX, xRight: rightWallX };
    } else {
      // Left channel: between left wall and central pillar left edge
      return { xLeft: leftWallX, xRight: pillarMinX };
    }
  }

  // Single main corridor (above or below central pillar)
  return { xLeft: leftWallX, xRight: rightWallX };
}

/**
 * Generates an organic cluster of 5-7 3D boulders spanning from xLeft to xRight.
 */
export function generateProceduralOrganicRock(xLeft, xRight, yCenter, height = 3.5, seed = 'rock') {
  const val = hashSeed(seed);
  const width = Math.max(10, xRight - xLeft);

  const numBoulders = 5 + (val % 3); // 5, 6, or 7 organic boulders
  const boulders = [];

  for (let i = 0; i < numBoulders; i++) {
    const bSeed = `${seed}_b_${i}`;
    const bHash = hashSeed(bSeed);

    // Spread centers along corridor width
    const uRatio = (i + 0.5) / numBoulders + ((bHash % 100) / 100 - 0.5) * 0.14;
    const clampedURatio = Math.max(0.08, Math.min(0.92, uRatio));

    const bLocalX = clampedURatio * 150;
    const bLocalY = 35 + (((bHash >> 2) % 100) / 100 - 0.5) * 22;

    const rx = 18 + (bHash % 14); // 18..32 SVG units radius
    const ry = 14 + ((bHash >> 4) % 10); // 14..24 SVG units radius

    const numPts = 8;
    const vertices = [];
    for (let p = 0; p < numPts; p++) {
      const angle = (p / numPts) * Math.PI * 2;
      const rJitter = 1 + ((hashSeed(`${bSeed}_pt_${p}`) % 100) / 100 - 0.5) * 0.35;
      const vx = bLocalX + Math.cos(angle) * rx * rJitter;
      const vy = bLocalY + Math.sin(angle) * ry * rJitter;

      // Clamp X strictly inside SVG canvas [2, 148] to guarantee zero wall overlap!
      const clampedVx = Math.max(2, Math.min(148, vx));
      vertices.push({ x: clampedVx, y: vy });
    }

    const peakOffsetJitterX = ((hashSeed(`${bSeed}_peak_x`) % 100) / 100 - 0.5) * (rx * 0.3);
    const peakOffsetJitterY = ((hashSeed(`${bSeed}_peak_y`) % 100) / 100 - 0.5) * (ry * 0.3);
    const peak = { x: bLocalX + peakOffsetJitterX, y: bLocalY + peakOffsetJitterY };

    const facets = [];
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
      nx /= len; ny /= len; nz /= len;

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
      rx, ry,
      vertices,
      peak,
      facets
    });
  }

  return { xLeft, xRight, yCenter, width, height, boulders };
}

/**
 * Calculates dynamic hero-relative lighting intensity and facet color.
 */
export function calculateFacetLighting(facet, heroPos, screens = 2.5) {
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
export function getShadedColor(intensity) {
  const r = Math.round(30 + intensity * (220 - 30));
  const g = Math.round(25 + intensity * (198 - 25));
  const b = Math.round(20 + intensity * (172 - 20));
  return `rgb(${r}, ${g}, ${b})`;
}
