// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from '@testing-library/react';
import {
  DEEP_CAVE_CORRIDOR_MIN_WIDTH,
  DEEP_CAVE_HERO_RADIUS,
  DEEP_CAVE_SLOT_COLS
} from '../src/constants.js';
import { createRNG } from '../src/logic/rng.js';
import { getProceduralObstacleSegments } from '../src/logic/visibility.js';
import { findGlobalPath, isPointInPolygon } from '../src/logic/pathfinding.js';
import { extractCaveContours, computeSignedArea } from '../src/levels/deep_cave/contouring.js';
import {
  buildTestSlotLayout,
  getSlotCenter,
  getWorldDimensions,
  rasterizeSlotGrid
} from '../src/levels/deep_cave/slotGrid.js';
import { ChasmSVG, DeepCaveBackground } from '../src/levels/deep_cave/components.jsx';

describe('Phase 2: Deep Cave Slot Grid, Tile Raster & Contouring Engine', () => {
  it('cleans diagonal checkerboards, distinguishes outer shells from pillars, and preserves collar orthogonality', () => {
    // 10x12 synthetic tile grid with solid 1-tile outer frame, horizontal collar, and 2x2 internal pillar
    const grid = Array.from({ length: 12 }, (_, r) =>
      Array.from({ length: 10 }, (_, c) => {
        if (r === 0 || r === 11 || c === 0 || c === 9) return 1;
        // Horizontal pinching wall at row 5..6 except doorway cols 3..6
        if ((r === 5 || r === 6) && (c < 3 || c > 6)) return 1;
        // 2x2 internal pillar in top chamber at rows 2..3, cols 4..5
        if ((r === 2 || r === 3) && (c === 4 || c === 5)) return 1;
        // Inject a 2x2 diagonal checkerboard pinhole at rows 8..9, cols 7..8
        if (r === 8 && c === 7) return 1;
        if (r === 9 && c === 8) return 1;
        return 0;
      })
    );

    const tileWidth = 10;
    const tileHeight = 10;
    const collarLockBoxes = [
      { orientation: 'horizontal', xLeft: 30, xRight: 70, yTop: 50, yBottom: 70 }
    ];

    const res = extractCaveContours(grid, {
      tileWidth,
      tileHeight,
      worldWidth: 100,
      worldHeight: 120,
      collarLockBoxes
    });

    const outer = res.wallPolylines.filter(p => !p.isPillar);
    const pillars = res.wallPolylines.filter(p => p.isPillar);
    expect(outer).toHaveLength(1);
    expect(pillars.length).toBeGreaterThanOrEqual(1);
    expect(computeSignedArea(outer[0].points)).toBeGreaterThan(0);
    expect(computeSignedArea(pillars[0].points)).toBeLessThan(0);

    // Collar boundary vertices at x=30 and x=70 across y=[50,70] must remain exact
    const pts = outer[0].points;
    const leftEdgeVerts = pts.filter(p => Math.abs(p.x - 30) < 1e-4 && p.y >= 49.9 && p.y <= 70.1);
    const rightEdgeVerts = pts.filter(p => Math.abs(p.x - 70) < 1e-4 && p.y >= 49.9 && p.y <= 70.1);
    expect(leftEdgeVerts.length).toBeGreaterThanOrEqual(2);
    expect(rightEdgeVerts.length).toBeGreaterThanOrEqual(2);

    // Points inside the top open chamber must not fall inside any solid obstaclePolygon
    const insideOpen = { x: 20, y: 25 };
    expect(res.obstaclePolygons.some(poly => isPointInPolygon(insideOpen, poly))).toBe(false);
    // Point inside the 2x2 pillar (40..60, 20..40) must fall inside a solid obstaclePolygon
    const insidePillar = { x: 50, y: 30 };
    expect(res.obstaclePolygons.some(poly => isPointInPolygon(insidePillar, poly))).toBe(true);
  });

  it('guarantees zero-gap orthogonal doorway collars >= 20.0 wide across 3..6 row layouts', () => {
    for (let rows = 3; rows <= 6; rows++) {
      for (let s = 1; s <= 4; s++) {
        const rng = createRNG(`phase2-${rows}-${s}`);
        const slots = buildTestSlotLayout(rows, rng);
        const geo = rasterizeSlotGrid(slots, rows, {}, rng);
        const dims = getWorldDimensions(rows);

        const wallSegments = getProceduralObstacleSegments([], geo, []);

        for (const collar of Object.values(geo.doorways)) {
          const cb = collar.collarBounds;
          if (collar.orientation === 'horizontal') {
            expect(cb.xRight - cb.xLeft).toBeGreaterThanOrEqual(DEEP_CAVE_CORRIDOR_MIN_WIDTH - 1e-4);
            // Both left and right collar walls must touch cb.xLeft and cb.xRight with vertical wall segments across cb.yTop..cb.yBottom
            const touchesLeft = wallSegments.some(seg =>
              Math.abs(seg.a.x - cb.xLeft) < 1e-3 &&
              Math.abs(seg.b.x - cb.xLeft) < 1e-3 &&
              Math.min(seg.a.y, seg.b.y) <= cb.yTop + 1e-3 &&
              Math.max(seg.a.y, seg.b.y) >= cb.yBottom - 1e-3
            );
            const touchesRight = wallSegments.some(seg =>
              Math.abs(seg.a.x - cb.xRight) < 1e-3 &&
              Math.abs(seg.b.x - cb.xRight) < 1e-3 &&
              Math.min(seg.a.y, seg.b.y) <= cb.yTop + 1e-3 &&
              Math.max(seg.a.y, seg.b.y) >= cb.yBottom - 1e-3
            );
            expect(touchesLeft).toBe(true);
            expect(touchesRight).toBe(true);
          } else {
            expect(cb.yBottom - cb.yTop).toBeGreaterThanOrEqual(DEEP_CAVE_CORRIDOR_MIN_WIDTH - 1e-4);
            const touchesTop = wallSegments.some(seg =>
              Math.abs(seg.a.y - cb.yTop) < 1e-3 &&
              Math.abs(seg.b.y - cb.yTop) < 1e-3 &&
              Math.min(seg.a.x, seg.b.x) <= cb.xLeft + 1e-3 &&
              Math.max(seg.a.x, seg.b.x) >= cb.xRight - 1e-3
            );
            const touchesBottom = wallSegments.some(seg =>
              Math.abs(seg.a.y - cb.yBottom) < 1e-3 &&
              Math.abs(seg.b.y - cb.yBottom) < 1e-3 &&
              Math.min(seg.a.x, seg.b.x) <= cb.xLeft + 1e-3 &&
              Math.max(seg.a.x, seg.b.x) >= cb.xRight - 1e-3
            );
            expect(touchesTop).toBe(true);
            expect(touchesBottom).toBe(true);
          }
        }

        // Verify A* navigability from camp to every active slot center at r_hero = 3.0
        const activeCenters = [];
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < DEEP_CAVE_SLOT_COLS; c++) {
            if (slots[r][c].active) {
              activeCenters.push({ ...getSlotCenter(c, r, dims), c, r });
            }
          }
        }
        const start = activeCenters[0];
        for (let i = 1; i < activeCenters.length; i++) {
          const target = activeCenters[i];
          const path = findGlobalPath(
            start,
            target,
            wallSegments,
            { width: geo.worldWidth, height: geo.worldHeight },
            geo.obstaclePolygons,
            3,
            { radius: DEEP_CAVE_HERO_RADIUS, maxIters: 4000 }
          );
          expect(path.length).toBeGreaterThan(0);
        }
      }
    }
  }, 10000);

  it('seals gatekeeper doorways completely against A* until defeated', () => {
    const rng = createRNG('seal-check');
    const slots = buildTestSlotLayout(3, rng);
    const geo = rasterizeSlotGrid(slots, 3, {}, rng);
    const dims = getWorldDimensions(3);

    // Block all doorways simultaneously: only row 0 slots reachable before clearing seam to row 1
    const blockers = Object.values(geo.doorways).map((dw, idx) => ({
      id: `gate_${idx}`,
      x: dw.x,
      y: dw.y,
      isGatekeeper: true,
      gateType: dw.orientation === 'vertical' ? 'chasm' : 'rock',
      collarBounds: dw.collarBounds
    }));

    const blockedSegs = getProceduralObstacleSegments(blockers, geo, []);
    const start = getSlotCenter(1, 0, dims); // Camp center
    // Find an active slot in bottom row (row 2)
    let vaultSlot = null;
    for (let c = 0; c < DEEP_CAVE_SLOT_COLS; c++) {
      if (slots[2][c].active) {
        vaultSlot = getSlotCenter(c, 2, dims);
        break;
      }
    }
    expect(vaultSlot).not.toBeNull();

    const blockedPath = findGlobalPath(
      start,
      vaultSlot,
      blockedSegs,
      { width: geo.worldWidth, height: geo.worldHeight },
      geo.obstaclePolygons,
      3,
      { radius: DEEP_CAVE_HERO_RADIUS, maxIters: 4000 }
    );
    expect(blockedPath).toEqual([]);

    // Once defeated, path connects cleanly
    const openSegs = getProceduralObstacleSegments(blockers, geo, blockers.map(b => b.id));
    const openPath = findGlobalPath(
      start,
      vaultSlot,
      openSegs,
      { width: geo.worldWidth, height: geo.worldHeight },
      geo.obstaclePolygons,
      3,
      { radius: DEEP_CAVE_HERO_RADIUS, maxIters: 4000 }
    );
    expect(openPath.length).toBeGreaterThan(0);
  });

  it('renders DeepCaveBackground and ChasmSVG cleanly in intact and bridged states', () => {
    const rng = createRNG('svg-render');
    const slots = buildTestSlotLayout(3, rng);
    const geo = rasterizeSlotGrid(slots, 3, {}, rng);
    geo.campPos = { x: 50, y: 28 };

    const { container: bgContainer } = render(<DeepCaveBackground geometry={geo} />);
    const paths = bgContainer.querySelectorAll('path');
    expect(paths.length).toBeGreaterThanOrEqual(2);

    const { container: chasmIntact } = render(<ChasmSVG isDefeated={false} orientation="horizontal" />);
    expect(chasmIntact.querySelectorAll('rect').length).toBe(0);

    const { container: chasmIntactVert } = render(<ChasmSVG isDefeated={false} orientation="vertical" isAlerting={true} />);
    expect(chasmIntactVert.querySelectorAll('rect').length).toBe(0);
    expect(chasmIntactVert.querySelectorAll('.animate-shake').length).toBe(0);
    expect(chasmIntactVert.querySelectorAll('.animate-pebble-fall').length).toBeGreaterThan(0);

    const { container: chasmBridged } = render(<ChasmSVG isDefeated={true} orientation="vertical" isBridging={true} />);
    expect(chasmBridged.querySelectorAll('rect').length).toBeGreaterThan(0);
    expect(chasmBridged.querySelectorAll('.animate-bridge-plank').length).toBeGreaterThan(0);

    const { container: chasmBridgedHoriz } = render(<ChasmSVG isDefeated={true} orientation="horizontal" />);
    expect(chasmBridgedHoriz.querySelectorAll('rect').length).toBeGreaterThan(0);
  });
});
