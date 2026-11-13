import { describe, it, expect } from 'vitest';
import { DEEP_CAVE_ENCOUNTERS, ENCOUNTERS_BY_ID } from '../src/levels/deep_cave/encounters/index.js';
import { validateEncounterModule } from '../src/levels/deep_cave/encounters/schema.js';
import {
  connectSlots,
  createEmptySlotGrid,
  getSlotCenter,
  getWorldDimensions,
  rasterizeSlotGrid
} from '../src/levels/deep_cave/slotGrid.js';
import { getProceduralObstacleSegments } from '../src/logic/visibility.js';
import { findGlobalPath } from '../src/logic/pathfinding.js';
import { DEEP_CAVE_HERO_RADIUS } from '../src/constants.js';

describe('Phase 3: Curated Encounter Schema & Geometry', () => {
  it('validates all v1 encounter modules strictly', () => {
    expect(DEEP_CAVE_ENCOUNTERS).toHaveLength(3);
    for (const enc of DEEP_CAVE_ENCOUNTERS) {
      const res = validateEncounterModule(enc);
      expect(res.errors).toEqual([]);
      expect(res.valid).toBe(true);
    }
  });

  it('rejects encounters with missing mechanicHook.solverTransition, misaligned sockets, or unreachable anchors', () => {
    const base = ENCOUNTERS_BY_ID.guardian_lair;

    // 1. Missing solverTransition
    const noSolverHook = {
      ...base,
      mechanicHook: { onInteract: () => {} }
    };
    const res1 = validateEncounterModule(noSolverHook);
    expect(res1.valid).toBe(false);
    expect(res1.errors.some(e => e.includes('solverTransition'))).toBe(true);

    // 2. Misaligned socket ('#' on perimeter instead of 'C')
    const badSocket = {
      ...base,
      tileGrid: ['##########', ...base.tileGrid.slice(1)]
    };
    const res2 = validateEncounterModule(badSocket);
    expect(res2.valid).toBe(false);
    expect(res2.errors.some(e => e.includes("must be 'C'"))).toBe(true);

    // 3. Unreachable anchor isolated in solid wall
    const trappedGrid = base.tileGrid.slice();
    trappedGrid[4] = '#........E'.slice(0, 10); // Col 9 perimeter solid border isn't reachable if walled off
    const trapped = {
      ...ENCOUNTERS_BY_ID.mushroom_grotto,
      tileGrid: ENCOUNTERS_BY_ID.mushroom_grotto.tileGrid.map((row, idx) =>
        idx >= 5 && idx <= 11 ? row.replaceAll('G', '#').replaceAll('C', idx === 6 ? '#' : 'C') : row
      )
    };
    // Make row 6..11 all '#' between left and right rooms
    trapped.tileGrid = trapped.tileGrid.map((row, idx) => {
      if (idx >= 6 && idx <= 11) {
        return row.slice(0, 8) + '####' + row.slice(12);
      }
      return row;
    });
    const res3 = validateEncounterModule(trapped);
    expect(res3.valid).toBe(false);
    expect(res3.errors.some(e => e.includes('unreachable'))).toBe(true);
  });

  it('rasterizes each encounter in a 3-row cave with navigable anchors and seamless exit collars', () => {
    const dims = getWorldDimensions(3);

    for (const enc of DEEP_CAVE_ENCOUNTERS) {
      const slots = createEmptySlotGrid(3);
      slots[0][0].active = true;
      slots[2][0].active = true;
      slots[2][1].active = true;

      const fpCols = enc.footprint.cols;
      for (let dc = 0; dc < fpCols; dc++) {
        slots[1][dc].active = true;
        slots[1][dc].encounterId = enc.id;
        slots[1][dc].encounterOrigin = { col: 0, row: 1 };
      }

      const entryCol = enc.sockets.north[0]?.colOffset ?? 0;
      const exitCol = enc.sockets.south[0]?.colOffset ?? 0;
      connectSlots(slots, entryCol, 0, entryCol, 1);
      connectSlots(slots, exitCol, 1, exitCol, 2);

      const geo = rasterizeSlotGrid(slots, 3, ENCOUNTERS_BY_ID);
      const segs = getProceduralObstacleSegments([], geo, []);

      const start = getSlotCenter(entryCol, 0, dims);
      const exitTarget = getSlotCenter(exitCol, 2, dims);
      const pathThrough = findGlobalPath(
        start,
        exitTarget,
        segs,
        { width: geo.worldWidth, height: geo.worldHeight },
        geo.obstaclePolygons,
        3,
        { radius: DEEP_CAVE_HERO_RADIUS, maxIters: 4000 }
      );
      expect(pathThrough.length).toBeGreaterThan(0);

      // Every encounter anchor must also be directly reachable from start
      const encAnchors = geo.encounterAnchors.find(a => a.encounterId === enc.id);
      expect(encAnchors).toBeDefined();
      for (const group of [...encAnchors.E, ...encAnchors.G, ...encAnchors.L]) {
        const p = findGlobalPath(
          start,
          { x: group.x, y: group.y },
          segs,
          { width: geo.worldWidth, height: geo.worldHeight },
          geo.obstaclePolygons,
          3,
          { radius: DEEP_CAVE_HERO_RADIUS, maxIters: 4000 }
        );
        expect(p.length).toBeGreaterThan(0);
      }
    }
  });
});
