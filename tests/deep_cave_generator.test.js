import { describe, it, expect } from 'vitest';
import deepCave from '../src/levels/deep_cave/index.js';
import { generateDeepCavePuzzle } from '../src/levels/deep_cave/generator.js';
import { DEEP_CAVE_PRESETS } from '../src/levels/deep_cave/presets.js';
import {
  DEEP_CAVE_GENERATOR_VERSION,
  DEEP_CAVE_HERO_RADIUS,
  DEEP_CAVE_MIN_ENTITY_DIST,
  DEEP_CAVE_MIN_WALL_MARGIN
} from '../src/constants.js';
import { validateEntitySpacing } from '../src/logic/rules.js';
import { getProceduralObstacleSegments } from '../src/logic/visibility.js';
import { findGlobalPath } from '../src/logic/pathfinding.js';
import { solvePuzzle } from '../src/logic/solver.js';

describe('Phase 3: Deep Cave Puzzle-First Generator', () => {
  it('generates deterministically from the same seed and differs across seeds', () => {
    const p1 = generateDeepCavePuzzle(deepCave, DEEP_CAVE_PRESETS.normal, null, 'det-seed-101');
    const p2 = generateDeepCavePuzzle(deepCave, DEEP_CAVE_PRESETS.normal, null, 'det-seed-101');
    const p3 = generateDeepCavePuzzle(deepCave, DEEP_CAVE_PRESETS.normal, null, 'det-seed-202');

    expect(p1.generatorVersion).toBe(DEEP_CAVE_GENERATOR_VERSION);
    expect(p1.startItems).toEqual(p2.startItems);
    expect(p1.puzzleEntities).toEqual(p2.puzzleEntities);
    expect(p1.geometry.wallPolylines).toEqual(p2.geometry.wallPolylines);

    const changed =
      JSON.stringify(p1.startItems) !== JSON.stringify(p3.startItems) ||
      JSON.stringify(p1.solution) !== JSON.stringify(p3.solution) ||
      JSON.stringify(p1.geometry.wallPolylines) !== JSON.stringify(p3.geometry.wallPolylines);
    expect(changed).toBe(true);
  });

  it('meets all solvability, spacing, navigability, and preset targets across all 4 difficulty presets (40 seeds)', () => {
    for (const [presetId, preset] of Object.entries(DEEP_CAVE_PRESETS)) {
      for (let i = 0; i < 10; i++) {
        const seed = `preset-${presetId}-${i}`;
        const p = generateDeepCavePuzzle(deepCave, preset, null, seed);

        // Step accuracy within [targetSteps, targetSteps + 1]
        expect(p.steps).toBeGreaterThanOrEqual(preset.targetSteps);
        expect(p.steps).toBeLessThanOrEqual(preset.targetSteps + 1);

        // BFS solvability check
        const sol = solvePuzzle(p.startItems, p.puzzleEntities, p.goalEntityId, deepCave, { maxStates: 6000 });
        expect(sol).not.toBeNull();
        expect(sol.steps).toBe(p.steps);

        // No self-guarded items
        for (const ent of p.puzzleEntities) {
          if (ent.reward) {
            expect(ent.requires || []).not.toContain(ent.reward);
          }
        }

        // Spatial clearance D_min >= 14.0 & M_min >= 6.5
        const spacing = validateEntitySpacing(p.puzzleEntities, {
          minEntityDistance: DEEP_CAVE_MIN_ENTITY_DIST,
          wallPolylines: p.geometry.wallPolylines,
          minWallMargin: DEEP_CAVE_MIN_WALL_MARGIN,
          checkAllPairs: true
        });
        expect(spacing.isValid).toBe(true);

        // Diggers count respects preset (up to available non-gatekeeper traders + decoys)
        const moles = p.puzzleEntities.filter(e => e.id?.startsWith('mole') && !e.isGoal);
        expect(moles.length).toBeLessThanOrEqual(preset.numDiggers);

        // A* pathfinding reachability to Goal from Camp
        const allGateIds = p.puzzleEntities.filter(e => e.isGatekeeper).map(e => e.id);
        const segs = getProceduralObstacleSegments(p.puzzleEntities, p.geometry, allGateIds);
        const goal = p.puzzleEntities.find(e => e.id === p.goalEntityId);
        const path = findGlobalPath(
          p.geometry.campPos,
          { x: goal.x, y: goal.y },
          segs,
          { width: p.geometry.worldWidth, height: p.geometry.worldHeight },
          p.geometry.obstaclePolygons,
          3,
          { radius: DEEP_CAVE_HERO_RADIUS, maxIters: 4500 }
        );
        expect(path.length).toBeGreaterThan(0);
      }
    }
  });

  it('supports custom numeric overrides via standard generateLevelPuzzle signature', () => {
    const p = deepCave.generatePuzzle(deepCave, 6, 1, 'custom-sig-seed');
    expect(p.steps).toBeGreaterThanOrEqual(6);
    expect(p.steps).toBeLessThanOrEqual(7);
    expect(p.geometry.worldWidth).toBe(100);
    expect(p.geometry.worldHeight).toBeGreaterThanOrEqual(192);
  });
});
