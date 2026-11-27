import { createRNG, shuffle, type SeedInput } from '../../logic/rng.ts';
import { pickValidReplacementReq, sanitizePuzzleEntities } from '../../logic/rules.ts';
import { assessPuzzleDifficulty, solvePuzzle } from '../../logic/solver.ts';
import { CAVE_ENTITIES, CAVE_ITEMS } from '../cave_shared/data.ts';
import {
  deriveUndergroundSettingsFromSteps,
  normalizeUndergroundSettings,
  type UndergroundSettings
} from '../cave_shared/presets.ts';
import {
  getUndergroundObstaclePolygons,
  UNDERGROUND_BRAZIERS,
  UNDERGROUND_LANDMARKS
} from './components.tsx';
import { mapNodes as DEFAULT_MAP_NODES } from './data.ts';
import type {
  ContainerType,
  EntityTemplate,
  LevelDefinition,
  MapNode,
  PuzzleData,
  PuzzleDifficultyReport,
  PuzzleEntity
} from '../../types/index.ts';

// Pure pickaxe mine: exclude rope/pickaxe/mushroom from generic barter pools
const BARTER_ITEMS = CAVE_ITEMS
  .map(i => i.id)
  .filter(id => id !== 'pickaxe' && id !== 'rope' && id !== 'mushroom');

const ORE_REWARD_CANDIDATES = ['gem', 'crystal', 'gold_nugget', 'emerald'];
const MOUND_ITEMS = new Set(['bone', 'relic', 'crystal', 'gold_nugget', 'gem', 'emerald']);

const ITEM_META = Object.fromEntries(CAVE_ITEMS.map(i => [i.id, i]));

const MINER_TEMPLATE: EntityTemplate = CAVE_ENTITIES.find(e => e.id === 'miner') || {
  id: 'miner',
  name: 'Miner',
  emoji: '👷'
};
const MOLE_TEMPLATE: EntityTemplate = CAVE_ENTITIES.find(e => e.id === 'mole') || {
  id: 'mole',
  name: 'Giant Mole',
  emoji: '🐭'
};
// Keep traders varied upper-mine denizens; exclude mole (special digger) and troll (reserved for deep_cave / river_crossing)
const TRADER_TEMPLATES: EntityTemplate[] = CAVE_ENTITIES.filter(
  e => e.id !== 'mole' && e.id !== 'troll' && e.id !== 'slime'
);

interface ActionSpec {
  kind: 'trade' | 'ore_vein';
  zone: number;
  fallbackZones: number[];
  req: string;
  reward: string;
  rewardCount: number;
  preferMiner?: boolean;
  isOnePickaxeTrapCandidate?: boolean;
}

function getContainerForFreeItem(itemId: string): ContainerType {
  return MOUND_ITEMS.has(itemId) ? 'mound' : 'crate';
}

function makeEntityFromSlot(
  slot: MapNode,
  tpl: EntityTemplate,
  id: string,
  requires: string[],
  reqType: 'AND' | 'OR',
  reward: string | null,
  rewardCount = 1,
  isDigger = false
): PuzzleEntity {
  return {
    ...tpl,
    id,
    name: tpl.name,
    emoji: tpl.emoji,
    requires,
    reqType,
    reward,
    ...(rewardCount > 1 ? { rewardCount } : {}),
    x: slot.x,
    y: slot.y,
    zone: slot.zone,
    isGatekeeper: false,
    isPreset: false,
    ...(isDigger ? { isDigger: true } : {})
  };
}

function buildOreVeinEntity(slot: MapNode, rewardItem: string, seq: number): PuzzleEntity {
  const meta = ITEM_META[rewardItem];
  return {
    id: `ore_vein_${seq}`,
    name: meta ? `${meta.name} Vein` : 'Ore Vein',
    emoji: meta?.emoji || '💎',
    requires: ['pickaxe'],
    reqType: 'AND',
    reward: rewardItem,
    x: slot.x,
    y: slot.y,
    zone: slot.zone,
    isGatekeeper: false,
    isPreset: false,
    containerType: 'ore_vein'
  };
}

function buildPresetEntity(node: MapNode): PuzzleEntity | null {
  if (node.isPreset === 'pickaxe') {
    return {
      id: `preset_pick_${node.x}_${node.y}`,
      name: 'Pickaxe Crate',
      emoji: '⛏️',
      requires: [],
      reqType: 'AND',
      reward: 'pickaxe',
      x: node.x,
      y: node.y,
      zone: node.zone,
      isGatekeeper: false,
      isPreset: 'pickaxe',
      containerType: node.containerType || 'crate'
    };
  }
  if (node.isPreset === 'mushroom') {
    return {
      id: `preset_mush_${node.x}_${node.y}`,
      name: 'Mushroom',
      emoji: '🍄',
      requires: [],
      reqType: 'AND',
      reward: 'mushroom',
      x: node.x,
      y: node.y,
      zone: node.zone,
      isGatekeeper: false,
      isPreset: 'mushroom'
    };
  }
  if (node.isPreset === 'cave_exit' || node.isExit) {
    return {
      id: node.id || 'deep_cave_exit',
      name: 'Deeper Cave',
      emoji: '🕳️',
      requires: [],
      reqType: 'AND',
      reward: null,
      x: node.x,
      y: node.y,
      zone: node.zone,
      isGatekeeper: false,
      isPreset: 'cave_exit',
      isExit: true,
      isGoal: true
    };
  }
  if (node.isPreset === 'treasure') {
    return {
      id: `preset_treas_${node.x}_${node.y}`,
      emoji: '💎',
      requires: [],
      reqType: 'AND',
      reward: null,
      x: node.x,
      y: node.y,
      zone: node.zone,
      isGatekeeper: false,
      isTreasure: true,
      isPreset: 'treasure'
    };
  }
  return null;
}

function buildContainerLootPreset(slot: MapNode, itemId: string, seq: number): PuzzleEntity {
  const meta = ITEM_META[itemId];
  const containerType = getContainerForFreeItem(itemId);
  return {
    id: `preset_${containerType}_${itemId}_${seq}`,
    name: meta?.name || itemId,
    emoji: meta?.emoji || '💎',
    requires: [],
    reqType: 'AND',
    reward: itemId,
    x: slot.x,
    y: slot.y,
    zone: slot.zone,
    isGatekeeper: false,
    isPreset: itemId,
    containerType
  };
}

function pathVisitsBothWings(
  path: PuzzleData['solution'],
  entitiesById: Map<string, PuzzleEntity>
): boolean {
  let leftTouched = false;
  let rightTouched = false;
  for (const step of path) {
    if (!step.entityId) continue;
    const ent = entitiesById.get(step.entityId);
    if (!ent) continue;
    if (ent.zone === 2 || ent.zone === 4) leftTouched = true;
    if (ent.zone === 3 || ent.zone === 5) rightTouched = true;
  }
  return leftTouched && rightTouched;
}

function meetsUndergroundDifficulty(
  diff: PuzzleDifficultyReport,
  settings: UndergroundSettings,
  visitsBothWings: boolean
): boolean {
  if (settings.targetSteps <= 5) return true;
  if (!visitsBothWings) return false;
  if (diff.multiReqGateCount < 1) return false;
  if (settings.decoyCount >= 1 && diff.fatalTrapCount < 1 && diff.greedyTrapCount < 1) {
    return false;
  }
  if (settings.targetSteps >= 8) {
    if (diff.backtrackCount < 1 && diff.remoteDepCount < 2) return false;
    if (diff.score < 40) return false;
  }
  return true;
}

/**
 * Generates an upper-mine, pure-pickaxe puzzle for `underground` ("The Cave").
 * Features multi-phase Giant Vault Boulders, peekable/cracked sight barricades,
 * pickaxe-minable Ore Veins, `⛏️ x2` Master Miner trades + 1-pickaxe temptation
 * traps, grounded crates/mounds, and randomized loop-vs-shortcut side passages.
 */
export function generateUndergroundPuzzle(
  level: LevelDefinition | null,
  targetStepsOrSettings: number | Record<string, any> | null = 7,
  numDiggers: number | null = null,
  seedInput: SeedInput = null,
  explicitSettings: Record<string, any> | null = null
): PuzzleData | null {
  const settings: UndergroundSettings = explicitSettings
    ? normalizeUndergroundSettings(explicitSettings)
    : (targetStepsOrSettings && typeof targetStepsOrSettings === 'object')
      ? normalizeUndergroundSettings(targetStepsOrSettings)
      : deriveUndergroundSettingsFromSteps(
          typeof targetStepsOrSettings === 'number' ? targetStepsOrSettings : 7,
          numDiggers
        );

  const resolvedDiggers = Math.max(0, Math.min(3, Number(settings.numDiggers) || 0));
  const targetSteps = settings.targetSteps;
  const seed = seedInput != null ? String(seedInput) : `ug-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const rng = createRNG(seed);

  const mapNodes = level?.mapNodes && level.mapNodes.length > 0 ? level.mapNodes : DEFAULT_MAP_NODES;
  const items = level?.items && level.items.length > 0 ? level.items : CAVE_ITEMS;
  const campPos = level?.campPos || { x: 50, y: 2 };
  const levelStub: Pick<LevelDefinition, 'mechanics' | 'items'> = {
    mechanics: {
      isCaveType: true,
      hasPickaxe: true,
      hasDarkness: true,
      darknessType: 'radial',
      hasFog: false,
      isVertical: true,
      screens: 2.5,
      ...(level?.mechanics || {})
    },
    items
  };

  let bestFallback: { puzzle: PuzzleData; rankScore: number } | null = null;

  for (let attempt = 0; attempt < 40; attempt++) {
    const startPool = shuffle(BARTER_ITEMS, rng);
    const startItems = startPool.slice(0, 3);
    const chainItems = startPool.slice(3); // 8 distinct barter items

    // Randomize primary wing (Left vs Right) and Loop-vs-Shortcut asymmetry per seed/attempt
    const wingA: 'left' | 'right' = (attempt % 2 === 0 ? rng() < 0.5 : rng() >= 0.5) ? 'left' : 'right';
    const wingB: 'left' | 'right' = wingA === 'left' ? 'right' : 'left';
    const routeMode: 'loop_wins' | 'shortcut_wins' =
      ((attempt >> 1) % 2 === 0 ? rng() < 0.5 : rng() >= 0.5) ? 'loop_wins' : 'shortcut_wins';

    const zA1 = wingA === 'left' ? 2 : 3;
    const zA2 = wingA === 'left' ? 4 : 5;
    const zB1 = wingB === 'left' ? 2 : 3;
    const zB2 = wingB === 'left' ? 4 : 5;

    const gA1Id = wingA === 'left' ? 'rock_left_1' : 'rock_right_1';
    const gA2Id = wingA === 'left' ? 'rock_left_2' : 'rock_right_2';
    const gA3Id = wingA === 'left' ? 'rock_left_3' : 'rock_right_3';
    const gB1Id = wingB === 'left' ? 'rock_left_1' : 'rock_right_1';
    const gB2Id = wingB === 'left' ? 'rock_left_2' : 'rock_right_2';
    const gB3Id = wingB === 'left' ? 'rock_left_3' : 'rock_right_3';

    const visitB2 = targetSteps >= 7;
    const vaultPhases = targetSteps <= 5 ? 1 : targetSteps <= 7 ? 2 : 3;
    const oreVeinCount = targetSteps <= 5 ? 0 : targetSteps >= 11 ? 2 : 1;

    // Free pickaxe crates calibrated so Wing B & Ore Veins remain strictly mandatory
    const keepZ3Crate = targetSteps <= 5 && settings.pickaxeSurplus >= 2;
    const keepZ6Crate = targetSteps <= 7 && (targetSteps <= 6 || settings.pickaxeSurplus >= 1);

    const gateNodes = mapNodes.filter(n => n.isGatekeeper);
    const presetNodes: MapNode[] = [];
    const freeTraderSlotsByZone = new Map<number, MapNode[]>();
    const addSlot = (n: MapNode) => {
      const list = freeTraderSlotsByZone.get(n.zone) || [];
      list.push(n);
      freeTraderSlotsByZone.set(n.zone, list);
    };

    for (const node of mapNodes) {
      if (node.isGatekeeper) continue;
      if (node.isExit || node.isPreset === 'cave_exit' || node.isPreset === 'treasure') {
        presetNodes.push(node);
        continue;
      }
      if (node.isPreset === 'mushroom') {
        presetNodes.push(node);
        continue;
      }
      if (node.isPreset === 'pickaxe') {
        if (node.zone === 1) {
          presetNodes.push(node);
        } else if (node.zone === 3 && keepZ3Crate) {
          presetNodes.push(node);
        } else if (node.zone === 6 && keepZ6Crate) {
          presetNodes.push(node);
        } else {
          addSlot(node);
        }
        continue;
      }
      addSlot(node);
    }

    for (const [z, list] of freeTraderSlotsByZone.entries()) {
      freeTraderSlotsByZone.set(z, shuffle(list, rng));
    }

    const popSlot = (zones: readonly number[]): MapNode | null => {
      for (const z of zones) {
        const list = freeTraderSlotsByZone.get(z);
        if (list && list.length > 0) {
          return list.shift()!;
        }
      }
      return null;
    };

    const gateById = new Map<string, PuzzleEntity>();
    for (const gn of gateNodes) {
      const id = gn.id || `gk_${gn.x}_${gn.y}`;
      gateById.set(id, {
        ...gn,
        id,
        name: id === 'vault_rock' && vaultPhases >= 2 ? 'Giant Vault Boulder' : 'Rock',
        emoji: '🪨',
        requires: ['pickaxe'],
        reqType: 'AND',
        reward: null,
        gateType: 'rock',
        maxPhases: id === 'vault_rock' ? vaultPhases : 1,
        ...(id === gB1Id || id === gB2Id ? { peekable: true } : {})
      });
    }

    // Configure Loop-vs-Shortcut asymmetry on Wing B (`gB2` vs `gB3`)
    if (visitB2) {
      const gB2 = gateById.get(gB2Id);
      const gB3 = gateById.get(gB3Id);
      if (routeMode === 'loop_wins') {
        if (gB2) {
          gB2.maxPhases = 2;
          gB2.name = 'Dense Cave-In';
        }
        if (gB3) gB3.maxPhases = 1;
      } else {
        if (gB2) gB2.maxPhases = 1;
        if (gB3) {
          gB3.maxPhases = 2;
          gB3.name = 'Dense Cave-In';
        }
      }
    }

    let itemCursor = 0;
    const allocChainItem = (preferredPool?: readonly string[]): string | null => {
      if (preferredPool) {
        const idx = chainItems.findIndex((it, i) => i >= itemCursor && preferredPool.includes(it));
        if (idx >= 0) {
          const picked = chainItems[idx];
          chainItems.splice(idx, 1);
          chainItems.splice(itemCursor, 0, picked);
          itemCursor++;
          return picked;
        }
      }
      if (itemCursor >= chainItems.length) return null;
      return chainItems[itemCursor++];
    };

    const actionSpecs: ActionSpec[] = [];
    const extraLootRequests: Array<{ zone: number; fallbackZones: number[]; itemId: string }> = [];

    // Exact rock + ore-vein sinks along the optimal path
    const z3CountedAsFree = keepZ3Crate && wingA === 'right';
    const freePickaxes = 1 + (z3CountedAsFree ? 1 : 0) + (keepZ6Crate ? 1 : 0);
    const wingBRockHits = targetSteps <= 5 ? 0 : visitB2 ? 2 : 1;
    const optimalRockHits = 3 + wingBRockHits + (2 + vaultPhases);
    const totalPickaxeSinks = optimalRockHits + oreVeinCount;
    const neededPickaxes = Math.max(2, totalPickaxeSinks - freePickaxes);
    const nActions = targetSteps - 1;
    const tAvail = Math.max(2, nActions - oreVeinCount);

    // Every mandatory Wing/Vein must net +1 pickaxe so BFS cannot skip it:
    // - zA1 (x2) -> req: startItem
    // - zB1 (x2, if targetSteps >= 6) -> req: startItem/chain
    // - zB2 (x2, if visitB2) -> req: startItem/mushroom/mound/chain (NOT ore!)
    // - each OreVein's consumer (x2, in Z6/Z7/Z8) -> req: mined ore
    const mandatoryTwoXZones: Array<{ zone: number; fb: number[]; needsOre: boolean }> = [
      { zone: zA1, fb: [zA1, 1], needsOre: false }
    ];
    if (targetSteps >= 6) {
      mandatoryTwoXZones.push({ zone: zB1, fb: [zB1, zA1], needsOre: false });
    }
    if (visitB2) {
      mandatoryTwoXZones.push({ zone: zB2, fb: [zB2, 6], needsOre: false });
    }

    const veinZones = [
      { veinZ: zA2, veinFb: [zA2, zB1, 6], consumerZ: 6, consumerFb: [6, zA2, 7] },
      { veinZ: zB1, veinFb: [zB1, zA2, 6], consumerZ: 7, consumerFb: [7, 8, 6] }
    ];
    const oreOutputs: Array<{ item: string; consumerZ: number; consumerFb: number[] }> = [];
    for (let ov = 0; ov < oreVeinCount; ov++) {
      const oreItem = allocChainItem(ORE_REWARD_CANDIDATES) || allocChainItem()!;
      const vz = veinZones[ov % veinZones.length];
      actionSpecs.push({
        kind: 'ore_vein',
        zone: vz.veinZ,
        fallbackZones: vz.veinFb,
        req: 'pickaxe',
        reward: oreItem,
        rewardCount: 1
      });
      oreOutputs.push({ item: oreItem, consumerZ: vz.consumerZ, consumerFb: vz.consumerFb });
      mandatoryTwoXZones.push({ zone: vz.consumerZ, fb: vz.consumerFb, needsOre: true });
    }

    // Remaining pickaxes & action slots beyond mandatory 2x nodes
    const mandTwoCount = mandatoryTwoXZones.length;
    const mandPicks = mandTwoCount * 2;
    const remPicks = Math.max(0, neededPickaxes - mandPicks);
    const remTradesBudget = Math.max(0, tAvail - mandTwoCount);
    const extraTwoX = remPicks > remTradesBudget ? Math.min(remTradesBudget, remPicks - remTradesBudget) : 0;
    const extraOneX = Math.max(0, remPicks - extraTwoX * 2);
    let chainBudget = Math.max(0, remTradesBudget - (extraTwoX + extraOneX));

    const toolZonePlan: Array<{ zone: number; fb: number[]; count: number; needsOre: boolean }> = mandatoryTwoXZones.map(m => ({
      zone: m.zone,
      fb: m.fb,
      count: 2,
      needsOre: m.needsOre
    }));

    const extraToolSlots =
      targetSteps <= 5
        ? [
            { z: zA2, fb: [zA2, zA1] },
            { z: 6, fb: [6, zA2] },
            { z: 7, fb: [7, 6] }
          ]
        : [
            { z: zA2, fb: [zA2, 6, zB1] },
            { z: 7, fb: [7, 6, 8] },
            { z: 6, fb: [6, zA2, 7] }
          ];
    let exIdx = 0;
    for (let e2 = 0; e2 < extraTwoX; e2++) {
      const s = extraToolSlots[exIdx++ % extraToolSlots.length];
      toolZonePlan.push({ zone: s.z, fb: s.fb, count: 2, needsOre: false });
    }
    for (let e1 = 0; e1 < extraOneX; e1++) {
      const s = extraToolSlots[exIdx++ % extraToolSlots.length];
      toolZonePlan.push({ zone: s.z, fb: s.fb, count: 1, needsOre: false });
    }

    // Assign inputs: ore traders get oreOutputs; non-ore traders get startItems / deep mushroom / mounds
    let sIdx = 0;
    let oreIdx = 0;
    let usedMushroom = false;
    const nonOreInputs: string[] = [];
    const totalNonOreNeeded = toolZonePlan.filter(t => !t.needsOre).length;
    while (nonOreInputs.length < totalNonOreNeeded) {
      if (sIdx < startItems.length) {
        nonOreInputs.push(startItems[sIdx++]);
      } else if (targetSteps >= 6 && !usedMushroom) {
        usedMushroom = true;
        nonOreInputs.push('mushroom');
      } else {
        const lootItem = startItems[nonOreInputs.length % startItems.length];
        const moundZ = nonOreInputs.length % 2 === 0 ? zA1 : zB1;
        extraLootRequests.push({
          zone: moundZ,
          fallbackZones: [zA1, zB1, 1, zA2, 6],
          itemId: lootItem
        });
        nonOreInputs.push(lootItem);
      }
    }

    let nonOreIdx = 0;
    // Keep 'mushroom' off Zone 4 & Zone 6 trades when another non-ore slot exists outside Z4/Z6
    const nonOrePlans = toolZonePlan.filter(t => !t.needsOre);
    const mushIdx = nonOreInputs.indexOf('mushroom');
    if (mushIdx >= 0 && (nonOrePlans[mushIdx]?.zone === 4 || nonOrePlans[mushIdx]?.zone === 6)) {
      const safeTargetIdx = nonOrePlans.findIndex((p, idx) => idx > 0 && p.zone !== 4 && p.zone !== 6);
      if (safeTargetIdx >= 0) {
        const tmp = nonOreInputs[safeTargetIdx];
        nonOreInputs[safeTargetIdx] = nonOreInputs[mushIdx];
        nonOreInputs[mushIdx] = tmp;
      }
    }

    for (let ti = 0; ti < toolZonePlan.length; ti++) {
      const tp = toolZonePlan[ti];
      let curReq = tp.needsOre ? oreOutputs[oreIdx++].item : nonOreInputs[nonOreIdx++];

      // Distribute chain hops across distinct tiers so no single zone runs out of slots
      const remTrades = toolZonePlan.length - ti;
      const hopsHere = chainBudget > 0 && ti > 0
        ? (ti === toolZonePlan.length - 1 ? chainBudget : Math.ceil(chainBudget / remTrades))
        : 0;
      const spreadHopZones = tp.needsOre
        ? [{ z: zA2, fb: [zA2, 6, zB1, zA1] }, { z: 6, fb: [6, zA2, 7, zB1] }, { z: 7, fb: [7, 6, zA2] }]
        : [{ z: zB1, fb: [zB1, zA1, 1] }, { z: zA1, fb: [zA1, 1, zB1] }, { z: 1, fb: [1, zA1, zB1] }];
      for (let h = 0; h < hopsHere && chainBudget > 0; h++) {
        const mid = allocChainItem();
        if (!mid) break;
        const pickedHop = spreadHopZones[(ti + h) % spreadHopZones.length];
        actionSpecs.push({
          kind: 'trade',
          zone: pickedHop.z,
          fallbackZones: pickedHop.fb,
          req: curReq,
          reward: mid,
          rewardCount: 1
        });
        curReq = mid;
        chainBudget--;
      }

      actionSpecs.push({
        kind: 'trade',
        zone: tp.zone,
        fallbackZones: tp.fb,
        req: curReq,
        reward: 'pickaxe',
        rewardCount: tp.count,
        preferMiner: tp.count >= 2,
        isOnePickaxeTrapCandidate: tp.count >= 2 && ti > 0
      });
    }

    // Optionally embed 1 glinting chain bonus gem in a 1-phase blocking rock? Keep clean and predictable via Ore Veins + actions
    const totalNeededSlots = actionSpecs.length + extraLootRequests.length;
    const totalAvailableSlots = Array.from(freeTraderSlotsByZone.values()).reduce((sum, arr) => sum + arr.length, 0);
    if (totalNeededSlots > totalAvailableSlots) {
      continue;
    }

    // Materialize core Ore Veins & Traders FIRST
    const coreActors: PuzzleEntity[] = [];
    let placementFailed = false;
    let entitySeq = 1;
    let veinSeq = 1;
    const shuffledTemplates = shuffle(TRADER_TEMPLATES, rng);

    for (let i = 0; i < actionSpecs.length; i++) {
      const spec = actionSpecs[i];
      const slot = popSlot(spec.fallbackZones);
      if (!slot) {
        placementFailed = true;
        break;
      }

      if (spec.kind === 'ore_vein') {
        coreActors.push(buildOreVeinEntity(slot, spec.reward, veinSeq++));
        continue;
      }

      let reqItem = spec.req;
      if (reqItem === 'mushroom' && (slot.zone === 4 || slot.zone === 6)) {
        reqItem = startItems.find(s => s !== reqItem) || startItems[0];
      }
      const tpl = spec.preferMiner
        ? MINER_TEMPLATE
        : shuffledTemplates[(i + attempt) % shuffledTemplates.length];
      coreActors.push(
        makeEntityFromSlot(
          slot,
          tpl,
          `${tpl.id}_core_${entitySeq++}`,
          [reqItem],
          'OR',
          spec.reward,
          spec.rewardCount
        )
      );
    }
    if (placementFailed) continue;

    // Materialize extra grounded dirt mounds / crates
    const extraContainerEntities: PuzzleEntity[] = [];
    let containerFailed = false;
    for (let i = 0; i < extraLootRequests.length; i++) {
      const req = extraLootRequests[i];
      const slot = popSlot(req.fallbackZones);
      if (!slot) {
        containerFailed = true;
        break;
      }
      extraContainerEntities.push(buildContainerLootPreset(slot, req.itemId, i + 1));
    }
    if (containerFailed) continue;

    // Assign exact number of Giant Moles (diggers) — never on ore veins or Master Miners
    let diggersAssigned = 0;
    const prioritizedForMole = coreActors
      .filter(e => !e.containerType)
      .sort((a, b) => {
        const aScore = (a.rewardCount && a.rewardCount > 1 ? 2 : 0) + (a.zone >= 2 && a.zone <= 7 ? 0 : 1);
        const bScore = (b.rewardCount && b.rewardCount > 1 ? 2 : 0) + (b.zone >= 2 && b.zone <= 7 ? 0 : 1);
        return aScore - bScore;
      });
    for (const tr of prioritizedForMole) {
      if (diggersAssigned >= resolvedDiggers) break;
      tr.isDigger = true;
      tr.name = MOLE_TEMPLATE.name;
      tr.emoji = MOLE_TEMPLATE.emoji;
      tr.id = `mole_${diggersAssigned}`;
      diggersAssigned++;
    }

    const presets = [
      ...presetNodes.map(buildPresetEntity).filter((e): e is PuzzleEntity => Boolean(e)),
      ...extraContainerEntities
    ];
    const gatekeepers = Array.from(gateById.values());

    const coreEntities = sanitizePuzzleEntities([...gatekeepers, ...presets, ...coreActors], items);
    const coreSol = solvePuzzle(startItems, coreEntities, 'vault_rock', levelStub, { maxStates: 25000 });
    if (!coreSol || coreSol.steps < targetSteps || coreSol.steps > targetSteps + 1) {
      continue;
    }

    // Place Temptation Decoys: first decoy is a 1-Pickaxe Trap competing against a ⛏️ x2 Master Miner!
    const decoyTraders: PuzzleEntity[] = [];
    if (settings.decoyCount > 0) {
      const doublePickTraders = coreActors.filter(
        e => !e.containerType && e.reward === 'pickaxe' && (e.rewardCount || 1) >= 2 && e.zone !== 1
      );
      let remainingDecoys = settings.decoyCount;

      if (doublePickTraders.length > 0 && remainingDecoys > 0) {
        const victim = doublePickTraders[0];
        const reqItem = victim.requires?.[0];
        const trapZoneOrder = [zB1, zA2, 6, zA1].filter(z => z !== victim.zone || (freeTraderSlotsByZone.get(z)?.length || 0) > 0);
        const trapSlot = reqItem ? popSlot(trapZoneOrder) : null;
        if (trapSlot && reqItem) {
          const needMole = diggersAssigned < resolvedDiggers;
          const tpl = needMole ? MOLE_TEMPLATE : shuffledTemplates[(entitySeq + 1) % shuffledTemplates.length];
          const id = needMole ? `mole_${diggersAssigned++}` : `${tpl.id}_trap_1px_${entitySeq++}`;
          decoyTraders.push(
            makeEntityFromSlot(trapSlot, tpl, id, [reqItem], 'AND', 'pickaxe', 1, needMole)
          );
          remainingDecoys--;
        }
      }

      if (remainingDecoys > 0) {
        const coreById = new Map(coreEntities.map(e => [e.id, e]));
        const simUnlocked = new Set<number>([1]);
        const simInv = [...startItems];
        const candidates: Array<{ zone: number; item: string }> = [];

        for (const step of coreSol.path) {
          const ent = step.entityId ? coreById.get(step.entityId) : undefined;
          if (!ent) continue;
          if (!ent.isPreset && ent.id !== 'vault_rock') {
            for (const held of Array.from(new Set(simInv))) {
              if (held === 'pickaxe' || held === 'rope' || held === 'mushroom') continue;
              for (const uz of simUnlocked) {
                if (uz <= 7 && (freeTraderSlotsByZone.get(uz)?.length || 0) > 0) {
                  candidates.push({ zone: uz, item: held });
                }
              }
            }
          }
          if (ent.isGatekeeper && ent.unlocksZones) {
            ent.unlocksZones.forEach(z => simUnlocked.add(z));
          }
          for (const r of ent.requires || []) {
            const idx = simInv.indexOf(r);
            if (idx > -1) simInv.splice(idx, 1);
          }
          if (ent.reward) {
            const rCount = Math.max(1, ent.rewardCount || 1);
            for (let rc = 0; rc < rCount; rc++) simInv.push(ent.reward);
          }
        }

        const allNeeded = new Set(coreEntities.flatMap(e => e.requires || []));
        const safeSinkItems = BARTER_ITEMS.filter(id => !allNeeded.has(id));
        const sinkReward = safeSinkItems[0] || chainItems[chainItems.length - 1] || 'chalice';
        const usedKeys = new Set<string>();

        for (let d = 0; d < remainingDecoys; d++) {
          const shuffledCands = shuffle(
            candidates.filter(c => !usedKeys.has(`${c.zone}:${c.item}`)),
            rng
          );
          const picked = shuffledCands[0];
          if (!picked) break;
          const slot = popSlot([picked.zone]);
          if (!slot) continue;

          usedKeys.add(`${picked.zone}:${picked.item}`);
          const needMole = diggersAssigned < resolvedDiggers;
          const tpl = needMole ? MOLE_TEMPLATE : shuffledTemplates[(entitySeq + d + 2) % shuffledTemplates.length];
          const id = needMole ? `mole_${diggersAssigned++}` : `${tpl.id}_decoy_${entitySeq++}`;
          const rew = sinkReward === picked.item
            ? (safeSinkItems.find(s => s !== picked.item) || chainItems.find(s => s !== picked.item) || 'chalice')
            : sinkReward;

          decoyTraders.push(
            makeEntityFromSlot(slot, tpl, id, [picked.item], 'AND', rew, 1, needMole)
          );
        }
      }
    }

    // Fill remaining unused slots with safe red-herring traders (never asking for used chain items, never rewarding mushroom or pickaxe)
    const allChainUsed = new Set([
      ...startItems,
      ...coreEntities.flatMap(e => [...(e.requires || []), ...(e.reward ? [e.reward] : [])]),
      ...decoyTraders.flatMap(e => [...(e.requires || []), ...(e.reward ? [e.reward] : [])])
    ]);
    const safeRedHerringRewards = BARTER_ITEMS.filter(id => !allChainUsed.has(id));
    const fallbackRedRewards = BARTER_ITEMS.filter(id => id !== 'mushroom');
    const redPool = safeRedHerringRewards.length > 0 ? safeRedHerringRewards : fallbackRedRewards;

    const redHerrings: PuzzleEntity[] = [];
    for (const [, list] of freeTraderSlotsByZone.entries()) {
      for (const slot of list) {
        const needMole = diggersAssigned < resolvedDiggers;
        const tpl = needMole ? MOLE_TEMPLATE : shuffledTemplates[(entitySeq + redHerrings.length) % shuffledTemplates.length];
        const id = needMole ? `mole_${diggersAssigned++}` : `${tpl.id}_rh_${entitySeq++}`;
        const reward = redPool[redHerrings.length % redPool.length];
        const safeReqPool = BARTER_ITEMS.filter(
          id => id !== reward && !allChainUsed.has(id)
        );
        const fallbackReqPool = BARTER_ITEMS.filter(
          id => id !== reward && !(slot.zone === 4 || slot.zone === 6 ? id === 'mushroom' : false)
        );
        const activeReqPool = safeReqPool.length > 0 ? safeReqPool : fallbackReqPool;
        const safeAllowed = (tpl.allowedReqs || []).filter(r => r !== reward && activeReqPool.includes(r));
        const req = pickValidReplacementReq(reward, safeAllowed.length > 0 ? safeAllowed : activeReqPool, activeReqPool, redHerrings.length);
        redHerrings.push(
          makeEntityFromSlot(slot, tpl, id, [req], 'OR', reward, 1, needMole)
        );
      }
    }

    const allEntities = sanitizePuzzleEntities(
      [...gatekeepers, ...presets, ...coreActors, ...decoyTraders, ...redHerrings],
      items
    );

    const sol = solvePuzzle(startItems, allEntities, 'vault_rock', levelStub, { maxStates: 25000 });
    if (!sol || sol.steps < targetSteps || sol.steps > targetSteps + 1) {
      continue;
    }

    const diff = assessPuzzleDifficulty(startItems, allEntities, 'vault_rock', levelStub, {
      solution: sol,
      campPos,
      rowHeight: 22
    });
    if (!diff.solvable) continue;

    const entMap = new Map(allEntities.map(e => [e.id, e]));
    const visitsBoth = pathVisitsBothWings(sol.path, entMap);
    const doublePickaxeTraders = allEntities.filter(e => e.reward === 'pickaxe' && (e.rewardCount || 1) >= 2).length;
    const peekableRocks = allEntities.filter(e => e.isGatekeeper && e.peekable).length;

    const candidate: PuzzleData = {
      startItems,
      puzzleEntities: allEntities,
      goalEntityId: 'vault_rock',
      solution: sol.path,
      steps: sol.steps,
      levelId: 'underground',
      seed,
      settings,
      difficulty: diff,
      geometry: {
        campPos,
        braziers: UNDERGROUND_BRAZIERS,
        landmarks: UNDERGROUND_LANDMARKS,
        obstaclePolygons: getUndergroundObstaclePolygons(2.5),
        torchRadius: settings.torchRadius
      },
      diagnostics: {
        visitsBothWings: visitsBoth,
        routeMode,
        vaultPhases,
        oreVeinCount,
        doublePickaxeTraders,
        peekableRocks,
        difficultyScore: diff.score,
        difficultyTier: diff.tier
      }
    };

    if (meetsUndergroundDifficulty(diff, settings, visitsBoth)) {
      return candidate;
    }

    const rankScore = diff.score + (visitsBoth ? 25 : 0) - Math.abs(sol.steps - targetSteps) * 5;
    if (!bestFallback || rankScore > bestFallback.rankScore) {
      bestFallback = { puzzle: candidate, rankScore };
    }
  }

  return bestFallback?.puzzle ?? null;
}