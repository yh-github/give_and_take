/**
 * Geometry & Procedural Rock Mesh Engine
 * Provides corridor boundary calculation, 3D facet mesh generation,
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
 * Generates procedural rock facets mapped to SVG local coordinates (0..150 X, 10..60 Y).
 * Also attaches map coordinates for real-time lighting calculations.
 */
export function generateProceduralRockFacets(xLeft, xRight, yCenter, height = 3.5, seed = 'rock') {
  const val = hashSeed(seed);
  const mapWidth = Math.max(10, xRight - xLeft);
  const mapYTop = yCenter - height / 2;
  const mapYBottom = yCenter + height / 2;

  const numCols = 6;
  const numRows = 3;
  const facets = [];

  const grid = [];
  for (let r = 0; r <= numRows; r++) {
    const row = [];
    const vPct = r / numRows;

    for (let c = 0; c <= numCols; c++) {
      const uPct = c / numCols;
      let localX = uPct * 150;
      let localY = 10 + vPct * 50;

      let mapX = xLeft + uPct * mapWidth;
      let mapY = mapYTop + vPct * height;

      // Add organic jitter
      if (c > 0 && c < numCols && r > 0 && r < numRows) {
        const jx = ((hashSeed(`${seed}_${r}_${c}_x`) % 100) / 100 - 0.5) * 12;
        const jy = ((hashSeed(`${seed}_${r}_${c}_y`) % 100) / 100 - 0.5) * 10;
        localX += jx;
        localY += jy;
        mapX += (jx / 150) * mapWidth;
        mapY += (jy / 50) * height;
      } else if (r === 0) {
        const jy = ((hashSeed(`${seed}_top_${c}`) % 100) / 100 - 0.5) * 8;
        localY += jy;
        mapY += (jy / 50) * height;
      } else if (r === numRows) {
        const jy = ((hashSeed(`${seed}_bot_${c}`) % 100) / 100 - 0.5) * 8;
        localY += jy;
        mapY += (jy / 50) * height;
      }

      row.push({ localX, localY, mapX, mapY });
    }
    grid.push(row);
  }

  for (let r = 0; r < numRows; r++) {
    for (let c = 0; c < numCols; c++) {
      const p1 = grid[r][c];
      const p2 = grid[r][c + 1];
      const p3 = grid[r + 1][c + 1];
      const p4 = grid[r + 1][c];

      const localCx = (p1.localX + p2.localX + p3.localX + p4.localX) / 4;
      const localCy = (p1.localY + p2.localY + p3.localY + p4.localY) / 4;

      const mapCx = (p1.mapX + p2.mapX + p3.mapX + p4.mapX) / 4;
      const mapCy = (p1.mapY + p2.mapY + p3.mapY + p4.mapY) / 4;

      const normU = (c / numCols - 0.5) * 2;
      const normV = (r / numRows - 0.5) * 2;

      let nx = normU * 0.6;
      let ny = normV * 0.8;
      let nz = Math.sqrt(Math.max(0.1, 1 - nx * nx - ny * ny));

      const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
      nx /= len; ny /= len; nz /= len;

      facets.push({
        id: `f_${r}_${c}`,
        pts: [p1, p2, p3, p4],
        localCentroid: { x: localCx, y: localCy },
        mapCentroid: { x: mapCx, y: mapCy },
        normal: { x: nx, y: ny, z: nz },
        row: r,
        col: c
      });
    }
  }

  return { xLeft, xRight, yCenter, mapWidth, height, facets };
}

/**
 * Calculates dynamic hero-relative lighting intensity and facet color.
 * Returns light intensity [0.22 to 1.0] and shaded fill color.
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
 * Maps light intensity [0.22 .. 1.0] to rich stone colors.
 */
export function getShadedColor(intensity) {
  // Deep dark shadow: #1c1612 -> Mid slate: #665a4e -> Warm highlight: #d9c4aa
  const r = Math.round(28 + intensity * (217 - 28));
  const g = Math.round(22 + intensity * (196 - 22));
  const b = Math.round(18 + intensity * (170 - 18));
  return `rgb(${r}, ${g}, ${b})`;
}
