import { describe, it, expect } from 'vitest';
import deepCave from '../src/levels/deep_cave/index.js';
import { generateDeepCavePuzzle } from '../src/levels/deep_cave/generator.js';
import { DEEP_CAVE_PRESETS } from '../src/levels/deep_cave/presets.js';
import {
  DEEP_CAVE_HERO_RADIUS,
  DEEP_CAVE_MIN_ENTITY_DIST,
  DEEP_CAVE_MIN_WALL_MARGIN
} from '../src/constants.js';
import LEVEL_REGISTRY from '../src/levels/index.js';
import { generateLevelPuzzle } from '../src/logic/generator.js';
import { isValidEntityTrade, validateEntitySpacing } from '../src/logic/rules.js';
import { getProceduralObstacleSegments } from '../src/logic/visibility.js';
import { findGlobalPath } from '../src/logic/pathfinding.js';
import { solvePuzzle } from '../src/logic/solver.js';

describe('Extended Multi-Seed Generator Fuzz Suite', () => {
  it('verifies Deep Cave solvability, spacing, navigability, and preset targets across all 4 difficulty presets (20 seeds)', () => {
    for (const [presetId, preset] of Object.entries(DEEP_CAVE_PRESETS)) {
      for (let i = 0; i < 5; i++) {
        const seed = `preset-${presetId}-${i}`;
        const p = generateDeepCavePuzzle(deepCave, preset, null, seed);

        expect(p.steps).toBeGreaterThanOrEqual(preset.targetSteps);
        expect(p.steps).toBeLessThanOrEqual(preset.targetSteps + 1);

        const sol = solvePuzzle(p.startItems, p.puzzleEntities, p.goalEntityId, deepCave, { maxStates: 6000 });
        expect(sol).not.toBeNull();
        expect(sol.steps).toBe(p.steps);

        const spacing = validateEntitySpacing(p.puzzleEntities, {
          minEntityDistance: DEEP_CAVE_MIN_ENTITY_DIST,
          wallPolylines: p.geometry.wallPolylines,
          minWallMargin: DEEP_CAVE_MIN_WALL_MARGIN,
          checkAllPairs: true
        });
        expect(spacing.isValid).toBe(true);

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
  }, 15000);

  it('strictly enforces across all registered levels and 15 seeds that no entity ever asks for the item it guards/rewards', () => {
    for (const levelId of ['river_crossing', 'underground', 'underwater', 'shipwreck']) {
      const level = LEVEL_REGISTRY[levelId];
      for (let s = 1; s <= 15; s++) {
        const seed = `invariant-test-${levelId}-${s}`;
        const puzzle = generateLevelPuzzle(level, 5, 1, seed);

        expect(puzzle).toBeDefined();
        expect(puzzle.puzzleEntities.length).toBeGreaterThan(0);

        puzzle.puzzleEntities.forEach(ent => {
          if (ent.reward && Array.isArray(ent.requires) && ent.requires.length > 0) {
            expect(ent.requires.includes(ent.reward)).toBe(false);
          }
          expect(isValidEntityTrade(ent)).toBe(true);
          if (levelId === 'underground' && !ent.isPreset && !ent.isGatekeeper && ent.reward) {
            expect(ent.reward).not.toBe('mushroom');
          }
        });
      }
    }
  }, 15000);
});
