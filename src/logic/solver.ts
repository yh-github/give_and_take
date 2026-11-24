import { DEEP_CAVE_SLOT_HEIGHT, MAX_UNIQUE_ITEMS, SOLVER_MAX_ITERS } from '../constants.ts';
import { uniqueCount } from './navigation.ts';
import { canFitInInventory, consumeRequiredItems, evaluateEntityTrade } from './rules.ts';
import type {
  AbstractPuzzleEntity,
  AssessDifficultyOptions,
  LevelDefinition,
  PuzzleDifficultyReport,
  PuzzleDifficultyTier,
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
    if (e.isGatekeeper && defeatedIds.includes(e.id)) {
      if (e.unlocksZones) {
        e.unlocksZones.forEach(z => simUnlockedZones.add(z));
      }
      if (e.zone !== undefined) {
        simUnlockedZones.add(e.zone);
      }
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
  puzzleEntities: ReadonlyArray<AbstractPuzzleEntity> & {
    boatOfferedItem?: string | null;
    boatOfferedItems?: string[];
    boatTradeMap?: Record<string, string>;
  },
  goalEntityId: string,
  level: Pick<LevelDefinition, 'mechanics'> | null | undefined,
  options: SolverOptions = {}
): SolverResult | null {
  const hasTransformation = Boolean(level?.mechanics?.hasTransformation);
  const startsTransformed = Boolean(level?.mechanics?.startsTransformed);
  const witchEntity = hasTransformation ? puzzleEntities.find(e => e.id === 'sea_witch') : null;
  const witchZone = witchEntity ? (witchEntity.zone || 1) : 1;
  const singleBoatItem = options?.boatOfferedItem || puzzleEntities?.boatOfferedItem || null;
  const boatOfferedItems: string[] = Array.from(
    new Set(
      [
        ...(options?.boatOfferedItems || []),
        ...(puzzleEntities?.boatOfferedItems || []),
        ...(singleBoatItem ? [singleBoatItem] : [])
      ].filter((id): id is string => Boolean(id))
    )
  );
  const boatTradeMap: Record<string, string> = {
    ...(puzzleEntities?.boatTradeMap || {}),
    ...(options?.boatTradeMap || {})
  };
  const maxIters = options?.maxStates ?? SOLVER_MAX_ITERS;

  const allRequiredItems = new Set<string>();
  puzzleEntities.forEach(e => {
    (e.requires || []).forEach(req => allRequiredItems.add(req));
    (e.returnRequires || []).forEach(req => allRequiredItems.add(req));
  });

  const queue: SolverResult[] = [
    {
      inv: [...startItems].sort(),
      def: [...(options?.initialDef || [])],
      path: [],
      steps: 0,
      transformed: options?.initialTransformed !== undefined ? Boolean(options.initialTransformed) : startsTransformed,
      hasTreasure: Boolean(options?.initialHasTreasure)
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
      if (startsTransformed) {
        if (curr.def.includes(goalEntityId)) return curr;
      } else if (curr.hasTreasure && !curr.transformed && curr.def.includes('untransformed_exit')) {
        return curr;
      }
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

    for (const bItem of boatOfferedItems) {
      const boatDefKey = `roaming_boat_${bItem}`;
      if (!allRequiredItems.has(bItem) || curr.def.includes(boatDefKey) || curr.inv.includes(bItem)) continue;
      const reqFish = boatTradeMap[bItem] || 'fish';

      if (canHoldMore) {
        queue.push({
          inv: [...curr.inv, bItem].sort(),
          def: [...curr.def, boatDefKey],
          path: [...curr.path, { isEnvironmentAction: true, isBoatTrade: true, itemId: bItem, reqItem: reqFish }],
          steps: curr.steps,
          transformed: curr.transformed,
          hasTreasure: curr.hasTreasure
        });
      } else if (curr.inv.includes(reqFish)) {
        const { fits, nextInventory } = canFitInInventory(curr.inv, [reqFish], bItem);
        if (fits) {
          queue.push({
            inv: nextInventory.sort(),
            def: [...curr.def, boatDefKey],
            path: [...curr.path, { isEnvironmentAction: true, isBoatTrade: true, itemId: bItem, reqItem: reqFish }],
            steps: curr.steps,
            transformed: curr.transformed,
            hasTreasure: curr.hasTreasure
          });
        }
      }
    }

    const simUnlockedZones = computeSimulatedUnlockedZones(puzzleEntities, curr.def, hasTransformation);
    const forcedMoves: SolverResult[] = [];

    for (const entity of puzzleEntities) {
      if (curr.def.includes(entity.id) && !(entity.id === 'sea_witch' && curr.transformed && curr.hasTreasure)) continue;

      const isReverseAccess = Boolean(entity.isGatekeeper && entity.unlocksZones && entity.unlocksZones.some(z => simUnlockedZones.has(z)));
      if (!simUnlockedZones.has(entity.zone) && !isReverseAccess) continue;

      if (hasTransformation) {
        if (startsTransformed) {
          if (entity.requiresHuman && curr.transformed) continue;
        } else if (entity.zone > witchZone && !curr.transformed) {
          continue;
        }
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
        if (entity.id === 'sea_witch' && curr.transformed && !startsTransformed) {
          if (curr.hasTreasure) {
            const retReqs = Array.isArray(entity.returnRequires) && entity.returnRequires.length > 0
              ? entity.returnRequires
              : [];
            const retConsumed = consumeRequiredItems(curr.inv, retReqs);
            if (retConsumed) {
              const nextInv = retConsumed.remaining;
              if (uniqueCount(nextInv) <= MAX_UNIQUE_ITEMS) {
                queue.push({
                  inv: nextInv.sort(),
                  def: [...curr.def, entity.id, 'untransformed_exit'],
                  path: [...curr.path, { entityId: entity.id, usedItems: retReqs, reqType: 'AND', isReturnTrip: true }],
                  steps: curr.steps + stepDelta,
                  transformed: false,
                  hasTreasure: true
                });
              }
            }
          }
          continue;
        }
        if (entity.id === 'sea_witch' && !curr.transformed && startsTransformed) {
          continue;
        }

        const consumedResult = consumeRequiredItems(curr.inv, entity.requires || []);
        const hasAll = consumedResult !== null;
        const tempInv = consumedResult ? consumedResult.remaining : [...curr.inv];

        if (hasAll) {
          const nextInv = [...tempInv];
          let nextTransformed = curr.transformed;
          let nextHasTreasure = curr.hasTreasure;
          const nextDef = [...curr.def, entity.id];

          if (entity.id === 'sea_witch') {
            nextTransformed = !startsTransformed;
          }
          if ((entity.isGoal || entity.id === goalEntityId) && hasTransformation) nextHasTreasure = true;
          if (entity.reward) nextInv.push(entity.reward);

          if (uniqueCount(nextInv) <= MAX_UNIQUE_ITEMS) {
            const step: SolutionStep = {
              entityId: entity.id,
              usedItems: entity.requires,
              reqType: 'AND',
              isReturnTrip: entity.id === 'sea_witch' && startsTransformed
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
        if (entity.id === 'sea_witch' && curr.transformed && !startsTransformed) {
          if (curr.hasTreasure) {
            const retReqs = Array.isArray(entity.returnRequires) && entity.returnRequires.length > 0
              ? entity.returnRequires
              : [];
            const retConsumed = consumeRequiredItems(curr.inv, retReqs);
            if (retConsumed) {
              const nextInv = retConsumed.remaining;
              if (uniqueCount(nextInv) <= MAX_UNIQUE_ITEMS) {
                queue.push({
                  inv: nextInv.sort(),
                  def: [...curr.def, entity.id, 'untransformed_exit'],
                  path: [...curr.path, { entityId: entity.id, usedItems: retReqs, reqType: 'AND', isReturnTrip: true }],
                  steps: curr.steps + 1,
                  transformed: false,
                  hasTreasure: true
                });
              }
            }
          }
          continue;
        }
        if (entity.id === 'sea_witch' && !curr.transformed && startsTransformed) {
          continue;
        }

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
              nextTransformed = !startsTransformed;
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
      }
    }

    if (forcedMoves.length > 0) {
      queue.unshift(...forcedMoves);
    }
  }
  return null;
}

type GreedyPolicy = 'nearest' | 'shallow' | 'traders_first';

function isEntityAccessibleInSim(
  ent: AbstractPuzzleEntity,
  unlockedZones: Set<number>,
  hasTransformation: boolean,
  witchZone: number,
  transformed: boolean
): boolean {
  const isReverseAccess = Boolean(
    ent.isGatekeeper &&
    ent.unlocksZones &&
    ent.unlocksZones.some(z => unlockedZones.has(z))
  );
  if (!unlockedZones.has(ent.zone) && !isReverseAccess) return false;
  if (hasTransformation && ent.zone > witchZone && !transformed) return false;
  return true;
}

function getActionStepDelta(
  ent: AbstractPuzzleEntity,
  goalEntityId: string,
  level: Pick<LevelDefinition, 'mechanics'> | null | undefined
): number {
  if (ent.isPreset && (!ent.requires || ent.requires.length === 0)) return 0;
  const isIntermediatePickaxeRock = Boolean(
    level?.mechanics?.isVertical &&
    level?.mechanics?.hasPickaxe &&
    ent.isGatekeeper &&
    ent.id !== goalEntityId &&
    ent.gateType !== 'guardian'
  );
  return isIntermediatePickaxeRock ? 0 : 1;
}

function simulateGreedyPlay(
  startItems: readonly string[],
  puzzleEntities: ReadonlyArray<AbstractPuzzleEntity>,
  goalEntityId: string,
  level: Pick<LevelDefinition, 'mechanics'> | null | undefined,
  policy: GreedyPolicy,
  startPos: { x: number; y: number }
): boolean {
  const hasTransformation = Boolean(level?.mechanics?.hasTransformation);
  const witchEntity = hasTransformation ? puzzleEntities.find(e => e.id === 'sea_witch') : null;
  const witchZone = witchEntity ? (witchEntity.zone || 1) : 1;

  let inv = [...startItems];
  const def: string[] = [];
  let transformed = false;
  let hasTreasure = false;
  let curX = startPos.x;
  let curY = startPos.y;
  const maxSteps = puzzleEntities.length + 8;

  for (let iter = 0; iter < maxSteps; iter++) {
    const unlockedZones = computeSimulatedUnlockedZones(puzzleEntities, def, hasTransformation);
    const evalState = {
      levelId: hasTransformation ? 'underwater' : undefined,
      isTransformed: transformed,
      hasDeepTreasure: hasTreasure
    };

    // Check immediate win condition
    const goalEnt = puzzleEntities.find(e => e.id === goalEntityId);
    if (hasTransformation) {
      if (
        hasTreasure &&
        transformed &&
        witchEntity &&
        isEntityAccessibleInSim(witchEntity, unlockedZones, true, witchZone, true) &&
        evaluateEntityTrade(inv, witchEntity, null, evalState).canDefeat
      ) {
        return true;
      }
      if (hasTreasure && !transformed) return true;
    } else if (
      goalEnt &&
      !def.includes(goalEnt.id) &&
      isEntityAccessibleInSim(goalEnt, unlockedZones, false, witchZone, false) &&
      evaluateEntityTrade(inv, goalEnt, null, evalState).canDefeat
    ) {
      return true;
    }

    const candidates: Array<{
      ent: AbstractPuzzleEntity;
      nextInv: string[];
      dist: number;
    }> = [];

    for (const ent of puzzleEntities) {
      if (ent.id === goalEntityId && !hasTransformation) continue;
      if (!ent.reward && !ent.isGatekeeper && !ent.isGoal && ent.id !== 'sea_witch') continue;
      const isWitchReturn = hasTransformation && ent.id === 'sea_witch' && transformed && hasTreasure;
      if (def.includes(ent.id) && !isWitchReturn) continue;
      if (!isEntityAccessibleInSim(ent, unlockedZones, hasTransformation, witchZone, transformed)) continue;

      const trade = evaluateEntityTrade(inv, ent, null, evalState);
      if (!trade.canDefeat) continue;

      const ex = typeof ent.x === 'number' ? ent.x : curX;
      const ey = typeof ent.y === 'number' ? ent.y : ent.zone * 50;
      const dist = Math.hypot(ex - curX, ey - curY);
      candidates.push({ ent, nextInv: trade.nextInventory, dist });
    }

    if (candidates.length === 0) return false;

    candidates.sort((a, b) => {
      if (policy === 'shallow') {
        const ay = typeof a.ent.y === 'number' ? a.ent.y : a.ent.zone * 50;
        const by = typeof b.ent.y === 'number' ? b.ent.y : b.ent.zone * 50;
        if (Math.abs(ay - by) > 1e-3) return ay - by;
        return a.dist - b.dist;
      }
      if (policy === 'traders_first') {
        const aIsTrader = !a.ent.isGatekeeper && !a.ent.isPreset ? 0 : (a.ent.isPreset ? 1 : 2);
        const bIsTrader = !b.ent.isGatekeeper && !b.ent.isPreset ? 0 : (b.ent.isPreset ? 1 : 2);
        if (aIsTrader !== bIsTrader) return aIsTrader - bIsTrader;
        return a.dist - b.dist;
      }
      // nearest
      return a.dist - b.dist;
    });

    const chosen = candidates[0];
    const ent = chosen.ent;
    inv = chosen.nextInv;
    if (ent.id === 'sea_witch' && hasTransformation) {
      if (transformed && hasTreasure) {
        transformed = false;
        return true;
      }
      transformed = true;
    }
    if ((ent.isGoal || ent.id === goalEntityId) && hasTransformation) {
      hasTreasure = true;
    }
    if (!def.includes(ent.id)) def.push(ent.id);
    if (typeof ent.x === 'number') curX = ent.x;
    if (typeof ent.y === 'number') curY = ent.y;
  }

  return false;
}

/**
 * Assesses puzzle difficulty beyond raw step count by measuring decision forks,
 * fatal/suboptimal greedy traps, backtracking depth, cross-zone dependencies,
 * multi-requirement gatekeepers, and inventory pressure.
 */
export function assessPuzzleDifficulty(
  startItems: readonly string[],
  puzzleEntities: ReadonlyArray<AbstractPuzzleEntity>,
  goalEntityId: string,
  level: Pick<LevelDefinition, 'mechanics'> | null | undefined,
  options: AssessDifficultyOptions = {}
): PuzzleDifficultyReport {
  const sol = options.solution ?? solvePuzzle(startItems, puzzleEntities, goalEntityId, level, options);
  if (!sol) {
    return {
      solvable: false,
      steps: 0,
      score: 0,
      tier: 'unsolvable',
      greedySolvable: false,
      greedyTrapCount: 3,
      fatalTrapCount: 0,
      suboptimalTrapCount: 0,
      choiceForkCount: 0,
      backtrackCount: 0,
      maxBacktrackRows: 0,
      remoteDepCount: 0,
      multiReqGateCount: 0,
      peakInventory: uniqueCount(startItems)
    };
  }

  const hasTransformation = Boolean(level?.mechanics?.hasTransformation);
  const witchEntity = hasTransformation ? puzzleEntities.find(e => e.id === 'sea_witch') : null;
  const witchZone = witchEntity ? (witchEntity.zone || 1) : 1;
  const rowHeight = options.rowHeight || DEEP_CAVE_SLOT_HEIGHT;
  const startPos = options.campPos || { x: 50, y: 16 };
  const maxProbeStates = options.maxProbeStates ?? 500;
  const entityById = new Map(puzzleEntities.map(e => [e.id, e]));

  let inv = [...startItems];
  const def: string[] = [];
  let transformed = false;
  let hasTreasure = false;

  let peakInventory = uniqueCount(inv);
  let fatalTrapCount = 0;
  let suboptimalTrapCount = 0;
  let choiceForkCount = 0;
  let backtrackCount = 0;
  let maxBacktrackRows = 0;
  let remoteDepCount = 0;

  let lastZone = 1;
  const visitedZones = new Set<number>([1]);
  let maxYReached = typeof startPos.y === 'number' ? startPos.y : 0;
  let hasMoved = false;

  // Track where each item instance in inventory came from for remote-dependency measurement
  const itemSources = new Map<string, Array<{ zone: number; y: number }>>();
  for (const itemId of startItems) {
    const arr = itemSources.get(itemId) || [];
    arr.push({ zone: 1, y: startPos.y });
    itemSources.set(itemId, arr);
  }

  // Remaining optimal steps from step i onward
  const stepDeltas = sol.path.map(step => {
    if (step.isEnvironmentAction || !step.entityId) return 0;
    const e = entityById.get(step.entityId);
    return e ? getActionStepDelta(e, goalEntityId, level) : 1;
  });
  const remainingStepsFrom = new Array<number>(sol.path.length + 1).fill(0);
  for (let i = sol.path.length - 1; i >= 0; i--) {
    remainingStepsFrom[i] = remainingStepsFrom[i + 1] + stepDeltas[i];
  }

  for (let i = 0; i < sol.path.length; i++) {
    const step = sol.path[i];
    if (step.isEnvironmentAction) {
      if (step.reqItem) {
        const idx = inv.indexOf(step.reqItem);
        if (idx > -1) inv.splice(idx, 1);
      }
      if (step.itemId) {
        inv.push(step.itemId);
        peakInventory = Math.max(peakInventory, uniqueCount(inv));
      }
      continue;
    }

    const ent = step.entityId ? entityById.get(step.entityId) : undefined;
    if (!ent) continue;

    const unlockedZones = computeSimulatedUnlockedZones(puzzleEntities, def, hasTransformation);
    const evalState = {
      levelId: hasTransformation ? 'underwater' : undefined,
      isTransformed: transformed,
      hasDeepTreasure: hasTreasure
    };

    const isNonPresetStep = !(ent.isPreset && (!ent.requires || ent.requires.length === 0));
    if (isNonPresetStep && ent.id !== goalEntityId) {
      // Inspect all currently affordable non-preset alternatives (including decoys!)
      const affordableAlts: AbstractPuzzleEntity[] = [];
      for (const cand of puzzleEntities) {
        if (cand.id === goalEntityId && !hasTransformation) continue;
        if (cand.isPreset && (!cand.requires || cand.requires.length === 0)) continue;
        if (!cand.reward && !cand.isGatekeeper && !cand.isGoal && cand.id !== 'sea_witch') continue;
        const isCandWitchReturn = hasTransformation && cand.id === 'sea_witch' && transformed && hasTreasure;
        if (def.includes(cand.id) && !isCandWitchReturn) continue;
        if (!isEntityAccessibleInSim(cand, unlockedZones, hasTransformation, witchZone, transformed)) continue;
        if (evaluateEntityTrade(inv, cand, null, evalState).canDefeat) {
          affordableAlts.push(cand);
        }
      }

      if (affordableAlts.length >= 2) {
        choiceForkCount++;
      }

      if (!options.skipTrapProbes) {
        const altCandidates = affordableAlts.filter(c => c.id !== ent.id).slice(0, 4);
        for (const alt of altCandidates) {
          const altTrade = evaluateEntityTrade(inv, alt, null, evalState);
          if (!altTrade.canDefeat) continue;

          const altDef = def.includes(alt.id) ? [...def] : [...def, alt.id];
          const altTransformed = alt.id === 'sea_witch' && hasTransformation
            ? !(transformed && hasTreasure)
            : transformed;
          const altHasTreasure = ((alt.isGoal || alt.id === goalEntityId) && hasTransformation)
            ? true
            : hasTreasure;

          const probe = solvePuzzle(altTrade.nextInventory, puzzleEntities, goalEntityId, level, {
            ...options,
            initialDef: altDef,
            initialTransformed: altTransformed,
            initialHasTreasure: altHasTreasure,
            maxStates: maxProbeStates
          });

          if (!probe) {
            fatalTrapCount++;
          } else {
            const altStepDelta = getActionStepDelta(alt, goalEntityId, level);
            if (altStepDelta + probe.steps > remainingStepsFrom[i]) {
              suboptimalTrapCount++;
            }
          }
        }
      }
    }

    // Apply the actual solution step
    const selectedForStep = step.itemId ? [step.itemId] : null;
    const trade = evaluateEntityTrade(inv, ent, selectedForStep, evalState);
    const consumedItems = trade.canDefeat ? trade.itemsToConsume : (step.usedItems || (step.itemId ? [step.itemId] : []));

    const entY = typeof ent.y === 'number' ? ent.y : ent.zone * rowHeight * 0.5;
    for (const cItem of consumedItems) {
      const srcs = itemSources.get(cItem);
      const src = srcs && srcs.length > 0 ? srcs.shift() : undefined;
      if (src) {
        const crossZone = src.zone !== ent.zone;
        const farY = Math.abs(src.y - entY) >= rowHeight * 0.85;
        if (crossZone || farY) {
          remoteDepCount++;
        }
      }
    }

    if (ent.reward) {
      const arr = itemSources.get(ent.reward) || [];
      arr.push({ zone: ent.zone, y: entY });
      itemSources.set(ent.reward, arr);
    }

    if (trade.canDefeat) {
      inv = trade.nextInventory;
    } else {
      const fallback = canFitInInventory(inv, consumedItems, ent.reward ?? null);
      inv = fallback.nextInventory;
    }
    peakInventory = Math.max(peakInventory, uniqueCount(inv));

    if (ent.id === 'sea_witch' && hasTransformation) {
      transformed = !(transformed && hasTreasure);
    }
    if ((ent.isGoal || ent.id === goalEntityId) && hasTransformation) {
      hasTreasure = true;
    }
    if (!def.includes(ent.id)) def.push(ent.id);

    // Measure physical & zone backtracking
    if (ent.id !== goalEntityId) {
      if (hasMoved) {
        const yBack = maxYReached - entY;
        if (yBack >= rowHeight * 0.75) {
          backtrackCount++;
          maxBacktrackRows = Math.max(maxBacktrackRows, Math.round((yBack / rowHeight) * 10) / 10);
        } else if (ent.zone !== lastZone && visitedZones.has(ent.zone)) {
          backtrackCount++;
        }
      }
      hasMoved = true;
      lastZone = ent.zone;
      visitedZones.add(ent.zone);
      if (entY > maxYReached) maxYReached = entY;
    }
  }

  const multiReqGateCount = puzzleEntities.filter(
    e => e.isGatekeeper && (e.requires?.length || 0) >= 2
  ).length;

  const policies: GreedyPolicy[] = ['nearest', 'shallow', 'traders_first'];
  let greedyTrapCount = 0;
  for (const policy of policies) {
    if (!simulateGreedyPlay(startItems, puzzleEntities, goalEntityId, level, policy, startPos)) {
      greedyTrapCount++;
    }
  }
  const greedySolvable = greedyTrapCount === 0;

  const score = Math.round(
    Math.min(28, sol.steps * 1.6) +
    Math.min(45, fatalTrapCount * 15) +
    Math.min(30, greedyTrapCount * 10) +
    Math.min(20, choiceForkCount * 5) +
    Math.min(12, suboptimalTrapCount * 4) +
    Math.min(24, backtrackCount * 8) +
    Math.min(12, maxBacktrackRows * 4) +
    Math.min(18, multiReqGateCount * 6) +
    Math.min(12, remoteDepCount * 2) +
    (peakInventory >= 4 ? 5 : (peakInventory === 3 ? 2 : 0))
  );

  let tier: PuzzleDifficultyTier = 'trivial';
  if (score >= 75) tier = 'hard';
  else if (score >= 52) tier = 'challenging';
  else if (score >= 32) tier = 'moderate';
  else if (score >= 16) tier = 'easy';

  return {
    solvable: true,
    steps: sol.steps,
    score,
    tier,
    greedySolvable,
    greedyTrapCount,
    fatalTrapCount,
    suboptimalTrapCount,
    choiceForkCount,
    backtrackCount,
    maxBacktrackRows,
    remoteDepCount,
    multiReqGateCount,
    peakInventory
  };
}
