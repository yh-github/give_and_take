/**
 * Puzzle-First Procedural Level Generator for `deep_cave` ("The Abyssal Descent").
 *
 * Orchestrates the 6-stage v2.0 pipeline across focused stage modules:
 *   - Stage 1: `missionGraph.ts` (`synthesizeMissionGraph`)
 *   - Stage 2: `spaceBlueprint.ts` (`chooseEncounters`, `buildSpaceBlueprint`)
 *   - Stage 3 & 4: `slotGrid.ts` & `contouring.ts` (`rasterizeSlotGrid`)
 *   - Stage 5 & 6: `placementAndVerify.ts` (`placeEntitiesInSlots`, `verifyGeneratedLevel`)
 */

import { DEEP_CAVE_GENERATOR_VERSION } from '../../constants.ts';
import { createRNG } from '../../logic/rng.ts';
import type { SeedInput } from '../../logic/rng.ts';
import { items as UNDERGROUND_ITEMS } from './data.ts';
import { ENCOUNTERS_BY_ID } from './encounters/index.ts';
import { synthesizeMissionGraph } from './missionGraph.ts';
import { placeEntitiesInSlots, verifyGeneratedLevel } from './placementAndVerify.ts';
import { normalizeDeepCaveSettings } from './presets.ts';
import { rasterizeSlotGrid } from './slotGrid.ts';
import { buildSpaceBlueprint, chooseEncounters } from './spaceBlueprint.ts';
import type { LevelDefinition, ProceduralGeometry, PuzzleData } from '../../types/index.ts';

export {
  chooseEncounters,
  buildSpaceBlueprint,
  synthesizeMissionGraph,
  placeEntitiesInSlots,
  verifyGeneratedLevel
};

/**
 * Generates a complete, verified `deep_cave` level payload.
 */
export function generateDeepCavePuzzle(
  level: LevelDefinition | null,
  targetStepsOrSettings: number | Record<string, any> | null = 8,
  numDiggers: number | null = null,
  seedInput: SeedInput = null,
  explicitSettings: Record<string, any> | null = null
): PuzzleData {
  const baseInput = explicitSettings || (targetStepsOrSettings && typeof targetStepsOrSettings === 'object' ? targetStepsOrSettings : {});
  const overrides: Record<string, any> = {};
  if (typeof targetStepsOrSettings === 'number') overrides.targetSteps = targetStepsOrSettings;
  if (typeof numDiggers === 'number') overrides.numDiggers = numDiggers;

  const settings = normalizeDeepCaveSettings(baseInput, overrides);
  const seed = seedInput != null
    ? String(seedInput)
    : `dc-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const rng = createRNG(seed);

  const levelStub: Pick<LevelDefinition, 'id' | 'mechanics' | 'items'> = level || {
    id: 'deep_cave',
    mechanics: { isVertical: true, hasPickaxe: true, useIsotropicCoords: true },
    items: UNDERGROUND_ITEMS
  };

  let missionAttempts = 0;
  let totalFirstPass = true;
  const rejectCounts: Record<string, number> = {};
  const recordReject = (r: string) => {
    rejectCounts[r] = (rejectCounts[r] || 0) + 1;
  };

  for (let outerAttempt = 0; outerAttempt < 24; outerAttempt++) {
    const selectedEncounters = chooseEncounters(settings, rng);
    const blueprint = buildSpaceBlueprint(settings, selectedEncounters, rng);
    if (!blueprint) {
      recordReject('BLUEPRINT');
      continue;
    }

    // Stage 1 retries (fast abstract DAG + solvePuzzle check)
    let mission: Extract<ReturnType<typeof synthesizeMissionGraph>, { ok: true }> | null = null;
    for (let mAttempt = 0; mAttempt < 8; mAttempt++) {
      missionAttempts++;
      const res = synthesizeMissionGraph(settings, blueprint, levelStub, rng);
      if (res?.ok) {
        mission = res;
        break;
      }
      recordReject(res?.reason || 'MISSION_NULL');
      if (!res || !res.structural) totalFirstPass = false;
      // Structural null depends purely on blueprint topology; switch blueprint immediately
      if (!res || res.structural) break;
    }
    if (!mission) continue;

    // Stage 3-6 (rasterization, contouring, placement, and verification)
    for (let geoAttempt = 0; geoAttempt < 2; geoAttempt++) {
      const geo = rasterizeSlotGrid(blueprint.slots, blueprint.rows, ENCOUNTERS_BY_ID, rng);
      const placedRes = placeEntitiesInSlots(mission.entitySpecs, blueprint, geo, rng);
      if (!placedRes) {
        recordReject('PLACEMENT');
        continue;
      }

      const geometry: ProceduralGeometry & { torchRadius: number } = {
        worldWidth: geo.worldWidth,
        worldHeight: geo.worldHeight,
        rows: geo.rows,
        wallPolylines: geo.wallPolylines,
        obstaclePolygons: geo.obstaclePolygons,
        campPos: placedRes.campPos,
        torchRadius: settings.torchRadius,
        slotLayout: {
          rows: blueprint.rows,
          doorways: geo.doorways,
          encounters: selectedEncounters.map(e => e.id)
        }
      };

      const check = verifyGeneratedLevel(
        mission.startItems,
        placedRes.placed,
        mission.goalEntityId,
        geometry,
        settings,
        levelStub
      );

      if (check.valid) {
        return {
          startItems: mission.startItems,
          puzzleEntities: placedRes.placed,
          goalEntityId: mission.goalEntityId,
          solution: check.solution.path,
          steps: check.solution.steps,
          geometry,
          seed,
          settings,
          generatorVersion: DEEP_CAVE_GENERATOR_VERSION,
          diagnostics: {
            firstPassMissionSolved: totalFirstPass && missionAttempts === 1,
            missionAttempts,
            rejectCounts
          }
        };
      }
      recordReject(check.reason || 'VERIFY_OTHER');
    }
  }

  throw new Error(
    `Deep Cave generation failed after retries (${JSON.stringify(rejectCounts)}) for settings: ${JSON.stringify(settings)}`
  );
}
