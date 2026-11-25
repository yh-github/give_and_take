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

  it('meets all solvability, spacing, navigability, and preset targets across all 4 difficulty presets (20 seeds)', () => {
    for (const [presetId, preset] of Object.entries(DEEP_CAVE_PRESETS)) {
      for (let i = 0; i < 5; i++) {
        const seed = `preset-${presetId}-${i}`;
        const p = generateDeepCavePuzzle(deepCave, preset, null, seed);

        // Step accuracy within [targetSteps, targetSteps + 1]
        expect(p.steps).toBeGreaterThanOrEqual(preset.targetSteps);
        expect(p.steps).toBeLessThanOrEqual(preset.targetSteps + 1);

        // BFS solvability check
        const sol = solvePuzzle(p.startItems, p.puzzleEntities, p.goalEntityId, deepCave, { maxStates: 6000 });
        expect(sol).not.toBeNull();
        expect(sol.steps).toBe(p.steps);

        // No self-guarded items & gatekeepers never give rewards & anti-silliness: no creature shares a zone with a free required item
        for (const ent of p.puzzleEntities) {
          if (ent.isGatekeeper) {
            expect(ent.reward).toBeNull();
          }
          if (ent.reward) {
            expect(ent.requires || []).not.toContain(ent.reward);
          }
          if (ent.isGatekeeper && ent.gateType === 'guardian') {
            expect(ent.emoji).toBe('🧌');
          }
          if (!ent.isPreset && ent.requires?.length > 0 && ent.gateType !== 'rock' && ent.gateType !== 'chasm') {
            const sameZoneFree = p.puzzleEntities.find(
              other =>
                other.isPreset &&
                (!other.requires || other.requires.length === 0) &&
                other.reward &&
                other.zone === ent.zone &&
                ent.requires.includes(other.reward)
            );
            expect(sameZoneFree).toBeUndefined();
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

        // Every floor pickup / preset item must have non-empty name & emoji so it renders visibly
        for (const ent of p.puzzleEntities) {
          if (ent.isPreset || ent.reward) {
            expect(typeof ent.emoji).toBe('string');
            expect(ent.emoji.length).toBeGreaterThan(0);
            expect(typeof ent.name).toBe('string');
            expect(ent.name.length).toBeGreaterThan(0);
          }
        }
      }
    }
  }, 10000);

  it('supports custom numeric overrides via standard generateLevelPuzzle signature', () => {
    const p = deepCave.generatePuzzle(deepCave, 6, 1, 'custom-sig-seed');
    expect(p.steps).toBeGreaterThanOrEqual(6);
    expect(p.steps).toBeLessThanOrEqual(7);
    expect(p.geometry.worldWidth).toBe(100);
    expect(p.geometry.worldHeight).toBeGreaterThanOrEqual(192);
  });

  it('never assigns reward items to Cave Trolls or other gatekeepers across custom and regression seeds', () => {
    const regressionCases = [
      { settings: { ...DEEP_CAVE_PRESETS.hard }, seed: 'dc-1794672823851-154821' },
      { settings: { ...DEEP_CAVE_PRESETS.normal, rows: 5, branchingFactor: 2 }, seed: 'custom-gatekeeper-1' },
      { settings: { ...DEEP_CAVE_PRESETS.expert, encounterCount: 3 }, seed: 'custom-gatekeeper-2' }
    ];
    for (const { settings, seed } of regressionCases) {
      const p = generateDeepCavePuzzle(deepCave, settings, null, seed);
      for (const ent of p.puzzleEntities) {
        if (ent.isGatekeeper) {
          expect(ent.reward).toBeNull();
        }
      }
      const sol = solvePuzzle(p.startItems, p.puzzleEntities, p.goalEntityId, deepCave, { maxStates: 6000 });
      expect(sol).not.toBeNull();
    }
  });

  it('produces non-linear hard/expert puzzles with multi-item trolls, backtracking, greedy traps, and maze loops', () => {
    let totalLoops = 0;
    for (let i = 0; i < 4; i++) {
      const hardP = generateDeepCavePuzzle(deepCave, DEEP_CAVE_PRESETS.hard, null, `nonlinear-hard-${i}`);
      expect(hardP.difficulty).toBeDefined();
      expect(hardP.difficulty.greedySolvable).toBe(false);
      expect(hardP.difficulty.fatalTrapCount).toBeGreaterThanOrEqual(1);
      expect(hardP.difficulty.backtrackCount).toBeGreaterThanOrEqual(1);
      expect(hardP.difficulty.multiReqGateCount).toBeGreaterThanOrEqual(1);

      const multiReqTrolls = hardP.puzzleEntities.filter(
        e => e.isGatekeeper && e.gateType === 'guardian' && (e.requires?.length || 0) >= 2
      );
      expect(multiReqTrolls.length).toBeGreaterThanOrEqual(1);
      totalLoops += hardP.diagnostics?.loopCount || 0;
    }
    expect(totalLoops).toBeGreaterThanOrEqual(1);

    const expertP = generateDeepCavePuzzle(deepCave, DEEP_CAVE_PRESETS.expert, null, 'nonlinear-expert-check');
    expect(expertP.difficulty.greedySolvable).toBe(false);
    expect(expertP.difficulty.backtrackCount).toBeGreaterThanOrEqual(2);
    expect(expertP.difficulty.score).toBeGreaterThanOrEqual(75);
  });

  it('supports wider horizontal scrolling caves (cols=4 on hard/expert, cols=5 custom) with isotropic room dimensions', () => {
    const hardP = generateDeepCavePuzzle(deepCave, DEEP_CAVE_PRESETS.hard, null, 'wide-hard-check');
    expect(hardP.geometry.worldWidth).toBeCloseTo(400 / 3, 2);
    expect(hardP.settings.cols).toBe(4);
    const hardSol = solvePuzzle(hardP.startItems, hardP.puzzleEntities, hardP.goalEntityId, deepCave, { maxStates: 6000 });
    expect(hardSol).not.toBeNull();

    const wideCustom = generateDeepCavePuzzle(
      deepCave,
      { ...DEEP_CAVE_PRESETS.normal, cols: 5, rows: 4, branchingFactor: 3 },
      null,
      'wide-custom-5cols'
    );
    expect(wideCustom.geometry.worldWidth).toBeCloseTo(500 / 3, 2);
    const customSol = solvePuzzle(wideCustom.startItems, wideCustom.puzzleEntities, wideCustom.goalEntityId, deepCave, { maxStates: 6000 });
    expect(customSol).not.toBeNull();
  });

  it('decouples Mushroom Grotto resources from its immediate entrance vestibule', () => {
    let checkedGrottos = 0;
    for (let i = 0; i < 6; i++) {
      const p = generateDeepCavePuzzle(deepCave, DEEP_CAVE_PRESETS.hard, null, `grotto-sep-${i}`);
      const grottoRock = p.puzzleEntities.find(e => e.id?.startsWith('grotto_rock_'));
      if (!grottoRock) continue;
      checkedGrottos++;
      const mushroomPickups = p.puzzleEntities.filter(e => e.reward === 'mushroom');
      expect(mushroomPickups.length).toBeGreaterThanOrEqual(1);
      // Every creature/gate requiring 'mushroom' must be outside the rock's entrance zone and separated from it
      const consumers = p.puzzleEntities.filter(e => e.requires?.includes('mushroom'));
      expect(consumers.length).toBeGreaterThanOrEqual(1);
      for (const consumer of consumers) {
        expect(consumer.zone).not.toBe(grottoRock.zone);
        expect(Math.hypot(consumer.x - grottoRock.x, consumer.y - grottoRock.y)).toBeGreaterThan(25);
      }
    }
    expect(checkedGrottos).toBeGreaterThanOrEqual(1);
  });

  it('generates kept cave landmarks, safely spaced braziers, and keeps bats reserved (snails instead)', () => {
    const p = generateDeepCavePuzzle(deepCave, DEEP_CAVE_PRESETS.normal, null, 'landmarks-check-1');
    expect(Array.isArray(p.geometry.landmarks)).toBe(true);
    expect(p.geometry.landmarks.length).toBeGreaterThanOrEqual(2);
    expect(p.geometry.landmarks.some(l => l.kind === 'vault_sanctum')).toBe(true);
    for (const lm of p.geometry.landmarks) {
      expect(['mushroom_grove', 'ruined_arch', 'vault_sanctum']).toContain(lm.kind);
    }

    expect(p.puzzleEntities.some(e => e.id?.startsWith('bat_'))).toBe(false);

    expect(Array.isArray(p.geometry.braziers)).toBe(true);
    expect(p.geometry.braziers.length).toBeGreaterThanOrEqual(2);
    for (const brazier of p.geometry.braziers) {
      expect(brazier.zone).toBeGreaterThanOrEqual(1);
      for (const ent of p.puzzleEntities) {
        expect(Math.hypot(ent.x - brazier.x, ent.y - brazier.y)).toBeGreaterThanOrEqual(8.5);
      }
    }
  });
});
