/**
 * 3 x N Room-Slot Grid & Tile Rasterizer for `deep_cave` ("The Abyssal Descent").
 *
 * Maps logical slot connectivity (plus curated encounter tile grids) onto a composite
 * isotropic tile raster (10 x 18 tiles per slot), stamps 4-tile symmetric straight
 * doorway collars (width >= 20.0 units) for zero-gap gatekeepers, and extracts
 * closed contours via `contouring.js`.
 */

import {
  DEEP_CAVE_SLOT_COLS,
  DEEP_CAVE_SLOT_HEIGHT
} from '../../constants.ts';
import { extractCaveContours } from './contouring.js';

export const TILE_COLS_PER_SLOT = 10;
export const TILE_ROWS_PER_SLOT = 18;
export const WORLD_WIDTH = 100;

export const DOOR_NS_COL_START = 2; // 6 open cols: [2..7] => 20.0 isotropic units
export const DOOR_NS_COL_END = 8;
export const DOOR_EW_ROW_START = 6; // 6 open rows: [6..11] => 21.33 isotropic units
export const DOOR_EW_ROW_END = 12;

export const ROOM_ARCHETYPES = [
  'wide_hall',
  'angled_left',
  'angled_right',
  'vaulted_dome',
  'stepped_alcove'
];

/**
 * Returns isotropic dimensions for a grid with `rows` slot rows.
 */
export function getWorldDimensions(rows) {
  const totalTileCols = DEEP_CAVE_SLOT_COLS * TILE_COLS_PER_SLOT; // 30
  const totalTileRows = rows * TILE_ROWS_PER_SLOT;
  const worldHeight = rows * DEEP_CAVE_SLOT_HEIGHT;
  return {
    rows,
    cols: DEEP_CAVE_SLOT_COLS,
    totalTileCols,
    totalTileRows,
    worldWidth: WORLD_WIDTH,
    worldHeight,
    tileWidth: WORLD_WIDTH / totalTileCols,
    tileHeight: worldHeight / totalTileRows
  };
}

/**
 * Creates a blank `rows x 3` grid of slot records.
 */
export function createEmptySlotGrid(rows) {
  const grid = [];
  for (let r = 0; r < rows; r++) {
    const rowArr = [];
    for (let c = 0; c < DEEP_CAVE_SLOT_COLS; c++) {
      rowArr.push({
        col: c,
        row: r,
        active: false,
        role: 'empty',
        zone: null,
        archetype: null,
        encounterId: null,
        encounterOrigin: null,
        sockets: { N: false, S: false, E: false, W: false }
      });
    }
    grid.push(rowArr);
  }
  return grid;
}

/**
 * Connects two cardinally adjacent slots symmetrically and marks both active.
 */
export function connectSlots(slots, colA, rowA, colB, rowB) {
  const a = slots[rowA]?.[colA];
  const b = slots[rowB]?.[colB];
  if (!a || !b) return false;
  const dc = colB - colA;
  const dr = rowB - rowA;
  if (Math.abs(dc) + Math.abs(dr) !== 1) return false;

  a.active = true;
  b.active = true;

  if (dc === 1) {
    a.sockets.E = true;
    b.sockets.W = true;
  } else if (dc === -1) {
    a.sockets.W = true;
    b.sockets.E = true;
  } else if (dr === 1) {
    a.sockets.S = true;
    b.sockets.N = true;
  } else if (dr === -1) {
    a.sockets.N = true;
    b.sockets.S = true;
  }
  return true;
}

/**
 * Canonical edge key between two slots (always ordered top->bottom / left->right).
 */
export function makeEdgeKey(colA, rowA, colB, rowB) {
  if (rowA < rowB || (rowA === rowB && colA <= colB)) {
    return `${colA},${rowA}->${colB},${rowB}`;
  }
  return `${colB},${rowB}->${colA},${rowA}`;
}

/**
 * Computes isotropic collar bounds and tile span for a seam doorway (`S` or `E`).
 */
export function computeDoorwayCollar(col, row, dir, dims) {
  const { tileWidth, tileHeight } = dims;
  if (dir === 'S') {
    const seamTileY = (row + 1) * TILE_ROWS_PER_SLOT;
    const xTileStart = col * TILE_COLS_PER_SLOT + DOOR_NS_COL_START;
    const xTileEnd = col * TILE_COLS_PER_SLOT + DOOR_NS_COL_END;
    const xLeft = Math.round(xTileStart * tileWidth * 1e6) / 1e6;
    const xRight = Math.round(xTileEnd * tileWidth * 1e6) / 1e6;
    const yMid = Math.round(seamTileY * tileHeight * 1e6) / 1e6;
    return {
      edgeKey: makeEdgeKey(col, row, col, row + 1),
      orientation: 'horizontal',
      x: (xLeft + xRight) / 2,
      y: yMid,
      collarBounds: {
        orientation: 'horizontal',
        xLeft,
        xRight,
        yTop: yMid - 3.0,
        yBottom: yMid + 3.0
      },
      lockBox: {
        orientation: 'horizontal',
        xLeft,
        xRight,
        yTop: (seamTileY - 2) * tileHeight,
        yBottom: (seamTileY + 2) * tileHeight
      },
      openCols: [xTileStart, xTileEnd - 1],
      openRows: [seamTileY - 2, seamTileY + 1],
      flankCols: [col * TILE_COLS_PER_SLOT, col * TILE_COLS_PER_SLOT + 1, col * TILE_COLS_PER_SLOT + 8, col * TILE_COLS_PER_SLOT + 9]
    };
  }

  // dir === 'E'
  const seamTileX = (col + 1) * TILE_COLS_PER_SLOT;
  const yTileStart = row * TILE_ROWS_PER_SLOT + DOOR_EW_ROW_START;
  const yTileEnd = row * TILE_ROWS_PER_SLOT + DOOR_EW_ROW_END;
  const xMid = Math.round(seamTileX * tileWidth * 1e6) / 1e6;
  const yTop = Math.round(yTileStart * tileHeight * 1e6) / 1e6;
  const yBottom = Math.round(yTileEnd * tileHeight * 1e6) / 1e6;
  return {
    edgeKey: makeEdgeKey(col, row, col + 1, row),
    orientation: 'vertical',
    x: xMid,
    y: (yTop + yBottom) / 2,
    collarBounds: {
      orientation: 'vertical',
      xLeft: xMid - 3.0,
      xRight: xMid + 3.0,
      yTop,
      yBottom
    },
    lockBox: {
      orientation: 'vertical',
      xLeft: (seamTileX - 2) * tileWidth,
      xRight: (seamTileX + 2) * tileWidth,
      yTop,
      yBottom
    },
    openCols: [seamTileX - 2, seamTileX + 1],
    openRows: [yTileStart, yTileEnd - 1],
    flankRows: [
      row * TILE_ROWS_PER_SLOT + 4,
      row * TILE_ROWS_PER_SLOT + 5,
      row * TILE_ROWS_PER_SLOT + 12,
      row * TILE_ROWS_PER_SLOT + 13
    ]
  };
}

/**
 * Computes isotropic chamber center and safe interior bounds for a slot `(col, row)`.
 */
export function getSlotCenter(col, row, dims = getWorldDimensions(row + 1)) {
  const slotOriginX = col * TILE_COLS_PER_SLOT * dims.tileWidth;
  const slotOriginY = row * TILE_ROWS_PER_SLOT * dims.tileHeight;
  return {
    x: slotOriginX + (TILE_COLS_PER_SLOT * dims.tileWidth) / 2,
    y: slotOriginY + (TILE_ROWS_PER_SLOT * dims.tileHeight) / 2
  };
}

/**
 * Stamps a procedural 1x1 chamber archetype into `solidGrid`, keeping minimum
 * clear width >= 6 tiles (20.0 units) and preserving partition walls away from sockets.
 */
function stampProceduralChamber(solidGrid, col, row, archetype, rng) {
  const c0 = col * TILE_COLS_PER_SLOT;
  const r0 = row * TILE_ROWS_PER_SLOT;

  for (let lr = 2; lr <= 15; lr++) {
    let minC = 1;
    let maxC = 8;

    if (archetype === 'angled_left') {
      if (lr <= 3) { minC = 2; maxC = 7; }
      else if (lr < 7) { minC = 2; maxC = 8; }
      else if (lr > 10 && lr < 14) { minC = 1; maxC = 7; }
      else if (lr >= 14) { minC = 2; maxC = 7; }
    } else if (archetype === 'angled_right') {
      if (lr <= 3) { minC = 2; maxC = 7; }
      else if (lr < 7) { minC = 1; maxC = 7; }
      else if (lr > 10 && lr < 14) { minC = 2; maxC = 8; }
      else if (lr >= 14) { minC = 2; maxC = 7; }
    } else if (archetype === 'vaulted_dome') {
      if (lr <= 3 || lr >= 14) { minC = 2; maxC = 7; }
      else if (lr <= 5 || lr >= 12) { minC = 1; maxC = 8; }
    } else if (archetype === 'stepped_alcove') {
      if (lr >= 6 && lr <= 11) { minC = 1; maxC = 8; }
      else { minC = 2; maxC = 7; }
    } else {
      // 'wide_hall': taper softly at north/south entrances to form an oval cavern instead of a box
      if (lr === 2 || lr === 15) { minC = 2; maxC = 7; }
    }

    // Gentle seeded edge variation on outer wall columns while keeping >= 6 tiles clear
    if (rng && rng() < 0.4 && maxC - minC >= 7 && lr >= 4 && lr <= 13) {
      if (rng() < 0.5) minC += 1;
      else maxC -= 1;
    }

    for (let lc = minC; lc <= maxC; lc++) {
      solidGrid[r0 + lr][c0 + lc] = 0;
    }
  }
}

/**
 * Stamps a curated encounter tileGrid into `solidGrid` and extracts anchor coordinates.
 */
function stampEncounter(solidGrid, lockedTiles, originSlot, encounter, dims) {
  const baseC = originSlot.col * TILE_COLS_PER_SLOT;
  const baseR = originSlot.row * TILE_ROWS_PER_SLOT;
  const rows = encounter.tileGrid.length;
  const cols = rows > 0 ? encounter.tileGrid[0].length : 0;

  const anchorTiles = {
    G: [],
    E: [],
    L: []
  };

  for (let r = 0; r < rows; r++) {
    const line = encounter.tileGrid[r];
    for (let c = 0; c < cols; c++) {
      const ch = line[c];
      const gr = baseR + r;
      const gc = baseC + c;
      if (gr <= 0 || gr >= dims.totalTileRows - 1 || gc <= 0 || gc >= dims.totalTileCols - 1) {
        solidGrid[gr][gc] = 1;
        continue;
      }

      if (ch === '#') {
        solidGrid[gr][gc] = 1;
      } else {
        solidGrid[gr][gc] = 0;
        if (ch === 'C') {
          lockedTiles[gr][gc] = true;
        } else if (ch === 'G' || ch === 'E' || ch === 'L') {
          anchorTiles[ch].push({ gc, gr });
        }
      }
    }
  }

  // Group contiguous anchor tiles (handles both single-tile entity anchors and wide chasm strips)
  const groupContiguous = (tiles) => {
    const remaining = new Set(tiles.map(t => `${t.gc},${t.gr}`));
    const groups = [];
    for (const t of tiles) {
      const k = `${t.gc},${t.gr}`;
      if (!remaining.has(k)) continue;
      const queue = [t];
      remaining.delete(k);
      const members = [];
      while (queue.length > 0) {
        const cur = queue.shift();
        members.push(cur);
        const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        for (const [dc, dr] of dirs) {
          const nk = `${cur.gc + dc},${cur.gr + dr}`;
          if (remaining.has(nk)) {
            remaining.delete(nk);
            queue.push({ gc: cur.gc + dc, gr: cur.gr + dr });
          }
        }
      }
      let minC = Infinity, maxC = -Infinity, minR = Infinity, maxR = -Infinity;
      for (const m of members) {
        if (m.gc < minC) minC = m.gc;
        if (m.gc > maxC) maxC = m.gc;
        if (m.gr < minR) minR = m.gr;
        if (m.gr > maxR) maxR = m.gr;
      }
      const xLeft = minC * dims.tileWidth;
      const xRight = (maxC + 1) * dims.tileWidth;
      const yTop = minR * dims.tileHeight;
      const yBottom = (maxR + 1) * dims.tileHeight;
      const spanW = xRight - xLeft;
      const spanH = yBottom - yTop;
      const orientation = spanW >= spanH ? 'horizontal' : 'vertical';
      groups.push({
        x: (xLeft + xRight) / 2,
        y: (yTop + yBottom) / 2,
        bounds: { orientation, xLeft, xRight, yTop, yBottom }
      });
    }
    return groups;
  };

  return {
    encounterId: encounter.id,
    originCol: originSlot.col,
    originRow: originSlot.row,
    G: groupContiguous(anchorTiles.G),
    E: groupContiguous(anchorTiles.E),
    L: groupContiguous(anchorTiles.L)
  };
}

/**
 * Stamps active doorway collar openings, flanking straight walls, and lock boxes.
 */
function stampDoorwayCollar(solidGrid, lockedTiles, collar) {
  const [cStart, cEnd] = collar.openCols;
  const [rStart, rEnd] = collar.openRows;

  for (let r = rStart; r <= rEnd; r++) {
    for (let c = cStart; c <= cEnd; c++) {
      solidGrid[r][c] = 0;
      lockedTiles[r][c] = true;
    }
  }

  if (collar.orientation === 'horizontal') {
    for (let r = rStart; r <= rEnd; r++) {
      for (const fc of collar.flankCols) {
        solidGrid[r][fc] = 1;
        lockedTiles[r][fc] = true;
      }
    }
  } else {
    for (const fr of collar.flankRows) {
      for (let c = cStart; c <= cEnd; c++) {
        solidGrid[fr][c] = 1;
        lockedTiles[fr][c] = true;
      }
    }
  }
}

/**
 * Rasterizes the `3 x rows` slot grid into a composite tile map, stamps doorway collars,
 * and extracts contour polylines & obstacle polygons.
 *
 * @param {Array<Array<Object>>} slots
 * @param {number} rows
 * @param {Object<string, Object>} [encountersById={}]
 * @param {Function} [rng=Math.random]
 * @returns {Object} Rasterized geometry payload
 */
export function rasterizeSlotGrid(slots, rows, encountersById = {}, rng = Math.random) {
  const dims = getWorldDimensions(rows);
  const solidGrid = Array.from({ length: dims.totalTileRows }, () =>
    Array(dims.totalTileCols).fill(1)
  );
  const lockedTiles = Array.from({ length: dims.totalTileRows }, () =>
    Array(dims.totalTileCols).fill(false)
  );

  const encounterAnchors = [];
  const collarLockBoxes = [];
  const stampedEncounters = new Set();

  // 1. Carve procedural rooms & encounter footprints
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < DEEP_CAVE_SLOT_COLS; c++) {
      const slot = slots[r][c];
      if (!slot.active) continue;

      if (slot.encounterId) {
        const origin = slot.encounterOrigin || { col: c, row: r };
        const originKey = `${origin.col},${origin.row}:${slot.encounterId}`;
        if (!stampedEncounters.has(originKey)) {
          stampedEncounters.add(originKey);
          const encounter = encountersById[slot.encounterId];
          if (encounter) {
            const anchors = stampEncounter(solidGrid, lockedTiles, origin, encounter, dims);
            encounterAnchors.push(anchors);
            for (const g of [...anchors.L, ...anchors.G]) {
              if (g.bounds) {
                collarLockBoxes.push(
                  g.bounds.orientation === 'horizontal'
                    ? {
                        orientation: 'horizontal',
                        xLeft: g.bounds.xLeft,
                        xRight: g.bounds.xRight,
                        yTop: g.bounds.yTop - dims.tileHeight * 1.5,
                        yBottom: g.bounds.yBottom + dims.tileHeight * 1.5
                      }
                    : {
                        orientation: 'vertical',
                        xLeft: g.bounds.xLeft - dims.tileWidth * 1.5,
                        xRight: g.bounds.xRight + dims.tileWidth * 1.5,
                        yTop: g.bounds.yTop,
                        yBottom: g.bounds.yBottom
                      }
                );
              }
            }
          }
        }
      } else {
        const archetype = slot.archetype || ROOM_ARCHETYPES[Math.floor(rng() * ROOM_ARCHETYPES.length)];
        slot.archetype = archetype;
        stampProceduralChamber(solidGrid, c, r, archetype, rng);
      }
    }
  }

  // 2. Stamp orthogonal seam doorway collars between connected slots
  const doorways = {};
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < DEEP_CAVE_SLOT_COLS; c++) {
      const slot = slots[r][c];
      if (!slot.active) continue;

      if (slot.sockets.S && r + 1 < rows && slots[r + 1][c].active) {
        // Skip internal encounter seams if both belong to the same multi-row encounter instance
        const sameEncounter = slot.encounterId &&
          slots[r + 1][c].encounterId === slot.encounterId &&
          slot.encounterOrigin?.col === slots[r + 1][c].encounterOrigin?.col &&
          slot.encounterOrigin?.row === slots[r + 1][c].encounterOrigin?.row;
        if (!sameEncounter) {
          const collar = computeDoorwayCollar(c, r, 'S', dims);
          stampDoorwayCollar(solidGrid, lockedTiles, collar);
          doorways[collar.edgeKey] = collar;
          collarLockBoxes.push(collar.lockBox);
        }
      }

      if (slot.sockets.E && c + 1 < DEEP_CAVE_SLOT_COLS && slots[r][c + 1].active) {
        const sameEncounter = slot.encounterId &&
          slots[r][c + 1].encounterId === slot.encounterId &&
          slot.encounterOrigin?.col === slots[r][c + 1].encounterOrigin?.col &&
          slot.encounterOrigin?.row === slots[r][c + 1].encounterOrigin?.row;
        if (!sameEncounter) {
          const collar = computeDoorwayCollar(c, r, 'E', dims);
          stampDoorwayCollar(solidGrid, lockedTiles, collar);
          doorways[collar.edgeKey] = collar;
          collarLockBoxes.push(collar.lockBox);
        }
      }
    }
  }

  // 3. Enforce outer 1-tile solid border around the entire world frame
  for (let c = 0; c < dims.totalTileCols; c++) {
    solidGrid[0][c] = 1;
    solidGrid[dims.totalTileRows - 1][c] = 1;
  }
  for (let r = 0; r < dims.totalTileRows; r++) {
    solidGrid[r][0] = 1;
    solidGrid[r][dims.totalTileCols - 1] = 1;
  }

  // 4. Extract closed contours & obstacle polygons
  const contours = extractCaveContours(solidGrid, {
    tileWidth: dims.tileWidth,
    tileHeight: dims.tileHeight,
    worldWidth: dims.worldWidth,
    worldHeight: dims.worldHeight,
    collarLockBoxes,
    lockedTiles,
    bevelCut: 2.35,
    simplifyEpsilon: 0.45
  });

  return {
    ...dims,
    solidGrid: contours.cleanedGrid,
    wallPolylines: contours.wallPolylines,
    obstaclePolygons: contours.obstaclePolygons,
    doorways,
    encounterAnchors,
    collarLockBoxes
  };
}

/**
 * Helper utility (for standalone Phase 2 geometry tests) that builds a valid
 * connected `3 x rows` layout with branches and spurs.
 */
export function buildTestSlotLayout(rows = 4, rng = Math.random) {
  const slots = createEmptySlotGrid(rows);
  let curCol = 1;
  slots[0][curCol].active = true;
  slots[0][curCol].role = 'camp';

  for (let r = 0; r < rows - 1; r++) {
    const nextCol = Math.floor(rng() * DEEP_CAVE_SLOT_COLS);
    while (curCol !== nextCol) {
      const step = nextCol > curCol ? 1 : -1;
      connectSlots(slots, curCol, r, curCol + step, r);
      curCol += step;
    }
    connectSlots(slots, curCol, r, curCol, r + 1);
  }
  slots[rows - 1][curCol].role = 'vault';

  // Add side branch / spur
  if (rows >= 3) {
    for (let c = 0; c < DEEP_CAVE_SLOT_COLS; c++) {
      if (slots[1][c].active && !slots[1][(c + 1) % 3].active) {
        const adj = Math.abs(c - ((c + 1) % 3)) === 1 ? (c + 1) % 3 : 1;
        if (Math.abs(c - adj) === 1) {
          connectSlots(slots, c, 1, adj, 1);
          slots[1][adj].role = 'spur';
          break;
        }
      }
    }
  }

  return slots;
}
