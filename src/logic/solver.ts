import { MAX_UNIQUE_ITEMS, SOLVER_MAX_ITERS } from '../constants.ts';
import { uniqueCount } from './navigation.ts';
import { canFitInInventory, consumeRequiredItems } from './rules.ts';
import type {
  AbstractPuzzleEntity,
  LevelDefinition,
  SolutionStep,
  SolverOptions,
  SolverResult
} from '../types/index.ts';

function computeSimulatedUnlockedZones(
  puzzleEntities: readonly AbstractPuzzleEntity[],
  defeatedIds: readonly string[],
  hasTransformation: boolean
): Set<number> {
  const simUnlockedZones = new Set<number>([1]);
  if (hasTransformation) {
    puzzleEntities.forEach(e => {
      if (e.zone) simUnlockedZones.add(e.zone);
    });
    simUnlockedZones.add(2);
  }

  puzzleEntities.forEach(e => {
    if (e.isGatekeeper && defeatedIds.includes(e.id) && e.unlocksZones) {
      e.unlocksZones.forEach(z => simUnlockedZones.add(z));
    }
  });

  return simUnlockedZones;
}

/**
 * BFS puzzle solver. Finds the shortest path from starting inventory
 * to the goal, respecting zone gating, inventory limits, and
 * level-specific mechanics (transformation, treasure, etc.).
 */
export function solvePuzzle(
  startItems: readonly string[],
  puzzleEntities: ReadonlyArray<AbstractPuzzleEntity> & { boatOfferedItem?: string | null },
  goalEntityId: string,
  level: Pick<LevelDefinition, 'mechanics'> | null | undefined,
  options: SolverOptions = {}
): SolverResult | null {
  const hasTransformation = Boolean(level?.mechanics?.hasTransformation);
  const witchEntity = hasTransformation ? puzzleEntities.find(e => e.id === 'sea_witch') : null;
  const witchZone = witchEntity ? (witchEntity.zone || 1) : 1;
  const boatOfferedItem = options?.boatOfferedItem || puzzleEntities?.boatOfferedItem || null;
  const maxIters = options?.maxStates ?? SOLVER_MAX_ITERS;

  const allRequiredItems = new Set<string>();
  puzzleEntities.forEach(e => {
    (e.requires || []).forEach(req => allRequiredItems.add(req));
  });

  const queue: SolverResult[] = [
    {
      inv: [...startItems].sort(),
      def: [],
      path: [],
      steps: 0,
      transformed: false,
      hasTreasure: false
    }
  ];
  const visited = new Set<string>();
  let iters = 0;

  while (queue.length > 0) {
    iters++;
    if (iters > maxIters) return null;

    const curr = queue.shift()!;

    // Victory condition
    if (hasTransformation) {
      if (curr.hasTreasure && !curr.transformed && curr.def.includes('untransformed_exit')) return curr;
    } else {
      if (curr.def.includes(goalEntityId)) return curr;
    }

    const stateKey = curr.inv.join(',') + '|' + [...curr.def].sort().join(',') + '|' + curr.transformed + '|' + curr.hasTreasure;
    if (visited.has(stateKey)) continue;
    visited.add(stateKey);

    const canHoldMore = uniqueCount(curr.inv) < MAX_UNIQUE_ITEMS;

    if ((level?.mechanics?.hasFish || level?.mechanics?.hasSchoolsOfFish) && allRequiredItems.has('fish') && !curr.def.includes('fish_node') && canHoldMore) {
      queue.push({
        inv: [...curr.inv, 'fish'].sort(),
        def: [...curr.def, 'fish_node'],
        path: [...curr.path, { isEnvironmentAction: true, itemId: 'fish' }],
        steps: curr.steps,
        transformed: curr.transformed,
        hasTreasure: curr.hasTreasure
      });
    }

    if (boatOfferedItem && allRequiredItems.has(boatOfferedItem) && !curr.def.includes('roaming_boat') && (canHoldMore || curr.inv.includes(boatOfferedItem))) {
      queue.push({
        inv: [...curr.inv, boatOfferedItem].sort(),
        def: [...curr.def, 'roaming_boat'],
        path: [...curr.path, { isEnvironmentAction: true, isBoatTrade: true, itemId: boatOfferedItem, reqItem: 'fish' }],
        steps: curr.steps,
        transformed: curr.transformed,
        hasTreasure: curr.hasTreasure
      });
    }

    const simUnlockedZones = computeSimulatedUnlockedZones(puzzleEntities, curr.def, hasTransformation);
    const forcedMoves: SolverResult[] = [];

    for (const entity of puzzleEntities) {
      if (curr.def.includes(entity.id) && !(entity.id === 'sea_witch' && curr.transformed && curr.hasTreasure)) continue;

      const isReverseAccess = Boolean(entity.isGatekeeper && entity.unlocksZones && entity.unlocksZones.some(z => simUnlockedZones.has(z)));
      if (!simUnlockedZones.has(entity.zone) && !isReverseAccess) continue;

      if (hasTransformation) {
        if (entity.zone > witchZone && !curr.transformed) continue;
      }

      if (entity.isPreset && entity.reqType === 'AND' && (!entity.requires || entity.requires.length === 0)) {
        if (!entity.reward && !entity.isGoal) continue;
        if (entity.reward && !entity.isGoal && !allRequiredItems.has(entity.reward)) continue;
        const { fits, nextInventory } = canFitInInventory(curr.inv, [], entity.reward ?? null);
        if (fits) {
          const nextState: SolverResult = {
            inv: nextInventory.sort(),
            def: [...curr.def, entity.id],
            path: [...curr.path, { entityId: entity.id, usedItems: [], reqType: 'AND' }],
            steps: curr.steps,
            transformed: curr.transformed,
            hasTreasure: curr.hasTreasure
          };
          if (entity.reward === 'pickaxe' || (entity.reward && curr.inv.includes(entity.reward))) {
            forcedMoves.push(nextState);
          } else {
            queue.push(nextState);
          }
        }
        continue;
      }

      // Skip transport-only elevators or pure red-herring traders whose reward is never required by any entity
      if (!entity.isGatekeeper && !entity.isGoal && entity.id !== goalEntityId && entity.id !== 'sea_witch') {
        if (!entity.reward || !allRequiredItems.has(entity.reward)) {
          continue;
        }
      }

      const isIntermediatePickaxeRock = Boolean(
        level?.mechanics?.isVertical &&
        level?.mechanics?.hasPickaxe &&
        entity.isGatekeeper &&
        entity.id !== goalEntityId &&
        entity.gateType !== 'guardian'
      );
      const stepDelta = isIntermediatePickaxeRock ? 0 : 1;

      if (entity.reqType === 'AND') {
        const consumedResult = consumeRequiredItems(curr.inv, entity.requires || []);
        const hasAll = consumedResult !== null;
        const tempInv = consumedResult ? consumedResult.remaining : [...curr.inv];

        const isReturnTrip = entity.id === 'sea_witch' && curr.transformed && curr.hasTreasure;

        if (hasAll || isReturnTrip) {
          const nextInv = isReturnTrip ? [...curr.inv] : tempInv;
          let nextTransformed = curr.transformed;
          let nextHasTreasure = curr.hasTreasure;
          const nextDef = [...curr.def, entity.id];

          if (entity.id === 'sea_witch') {
            if (!curr.transformed) nextTransformed = true;
            else if (curr.hasTreasure) {
              nextTransformed = false;
              nextDef.push('untransformed_exit');
            } else if (!isReturnTrip) continue;
          }
          if ((entity.isGoal || entity.id === goalEntityId) && hasTransformation) nextHasTreasure = true;
          if (entity.reward && !isReturnTrip) nextInv.push(entity.reward);

          if (uniqueCount(nextInv) <= MAX_UNIQUE_ITEMS) {
            const step: SolutionStep = {
              entityId: entity.id,
              usedItems: isReturnTrip ? [] : entity.requires,
              reqType: 'AND',
              isReturnTrip
            };
            queue.push({
              inv: nextInv.sort(),
              def: nextDef,
              path: [...curr.path, step],
              steps: curr.steps + stepDelta,
              transformed: nextTransformed,
              hasTreasure: nextHasTreasure
            });
          }
        }
      } else {
        const uniqueInv = Array.from(new Set(curr.inv));
        for (let i = 0; i < uniqueInv.length; i++) {
          const itemId = uniqueInv[i];
          if ((entity.requires || []).includes(itemId)) {
            const newInv = [...curr.inv];
            newInv.splice(newInv.indexOf(itemId), 1);
            let nextTransformed = curr.transformed;
            let nextHasTreasure = curr.hasTreasure;
            const nextDef = [...curr.def, entity.id];

            if (entity.id === 'sea_witch') {
              if (!curr.transformed) nextTransformed = true;
              else if (curr.hasTreasure) {
                nextTransformed = false;
                nextDef.push('untransformed_exit');
              } else continue;
            }
            if ((entity.isGoal || entity.id === goalEntityId) && hasTransformation) nextHasTreasure = true;
            if (entity.reward) newInv.push(entity.reward);

            if (uniqueCount(newInv) <= MAX_UNIQUE_ITEMS) {
              queue.push({
                inv: newInv.sort(),
                def: nextDef,
                path: [...curr.path, { entityId: entity.id, itemId, reqType: 'OR' }],
                steps: curr.steps + stepDelta,
                transformed: nextTransformed,
                hasTreasure: nextHasTreasure
              });
            }
          }
        }

        // Special case: Sea Witch un-transform is FREE in the solver too
        if (entity.id === 'sea_witch' && curr.transformed && curr.hasTreasure) {
          const nextDef = [...curr.def, entity.id, 'untransformed_exit'];
          queue.push({
            inv: [...curr.inv].sort(),
            def: nextDef,
            path: [...curr.path, { entityId: entity.id, usedItems: [], reqType: 'AND', isReturnTrip: true }],
            steps: curr.steps + 1,
            transformed: false,
            hasTreasure: true
          });
        }
      }
    }

    if (forcedMoves.length > 0) {
      queue.unshift(...forcedMoves);
    }
  }
  return null;
}
