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
  EntityTemplate,
  LevelDefinition,
  MapNode,
  PuzzleData,
  PuzzleDifficultyReport,
  PuzzleEntity
} from '../../types/index.ts';

const BARTER_ITEMS = CAVE_ITEMS
  .map(i => i.id)
  .filter(id => id !== 'pickaxe' && id !== 'rope' && id !== 'mushroom');

const ITEM_META = Object.fromEntries(CAVE_ITEMS.map(i => [i.id, i]));

const TRADER_TEMPLATES: EntityTemplate[] = CAVE_ENTITIES.filter(
  e => e.id !== 'mole' && e.id !== 'troll'
);
const MOLE_TEMPLATE: EntityTemplate = CAVE_ENTITIES.find(e => e.id === 'mole') || {
  id: 'mole',
  name: 'Giant Mole',
  emoji: '🐭'
};
const TROLL_TEMPLATE: EntityTemplate = CAVE_ENTITIES.find(e => e.id === 'troll') || {
  id: 'troll',
  name: 'Cave Troll',
  emoji: '🧌'
};

interface HopSpec {
  zone: number;
  fallbackZones: number[];
  req: string;
  reward: string;
  isToolTrade?: boolean;
}

function makeEntityFromSlot(
  slot: MapNode,
  tpl: EntityTemplate,
  id: string,
  requires: string[],
  reqType: 'AND' | 'OR',
  reward: string | null,
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
    x: slot.x,
    y: slot.y,
    zone: slot.zone,
    isGatekeeper: false,
    isPreset: false,
    ...(isDigger ? { isDigger: true } : {})
  };
}

function buildPresetEntity(node: MapNode): PuzzleEntity | null {
  if (node.isPreset === 'pickaxe') {
    return {
      id: `preset_pick_${node.x}_${node.y}`,
      name: 'Pickaxe',
      emoji: '⛏️',
      requires: [],
      reqType: 'AND',
      reward: 'pickaxe',
      x: node.x,
      y: node.y,
      zone: node.zone,
      isGatekeeper: false,
      isPreset: 'pickaxe'
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

function buildFloorLootPreset(slot: MapNode, itemId: string, seq: number): PuzzleEntity {
  const meta = ITEM_META[itemId];
  return {
    id: `preset_loot_${itemId}_${seq}`,
    name: meta?.name || itemId,
    emoji: meta?.emoji || '💎',
    requires: [],
    reqType: 'AND',
    reward: itemId,
    x: slot.x,
    y: slot.y,
    zone: slot.zone,
    isGatekeeper: false,
    isPreset: itemId
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
    if (diff.score < 42) return false;
  }
  return true;
}

/**
 * Generates a non-linear, difficulty-respecting puzzle for `underground` ("The Cave").
 * Uses cross-corridor (Left <-> Right) weaving, Rope Chasms, multi-item Cave Troll
 * guardians, temptation decoys, and Zone 9's Abyssal Descent exit (`deep_cave_exit`).
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

  for (let attempt = 0; attempt < 36; attempt++) {
    const startPool = shuffle(BARTER_ITEMS, rng);
    const startItems = startPool.slice(0, 3);
    const chainItems = startPool.slice(3); // 8 distinct barter items

    // Randomize primary wing (Left vs Right) per attempt/seed
    const wingA: 'left' | 'right' = (attempt % 2 === 0 ? rng() < 0.5 : rng() >= 0.5) ? 'left' : 'right';
    const wingB: 'left' | 'right' = wingA === 'left' ? 'right' : 'left';
    const zA1 = wingA === 'left' ? 2 : 3;
    const zA2 = wingA === 'left' ? 4 : 5;
    const zB1 = wingB === 'left' ? 2 : 3;
    const zB2 = wingB === 'left' ? 4 : 5;

    const gA1Id = wingA === 'left' ? 'rock_left_1' : 'rock_right_1';
    const gA2Id = wingA === 'left' ? 'rock_left_2' : 'rock_right_2';
    const gA3Id = wingA === 'left' ? 'rock_left_3' : 'rock_right_3';
    const gB1Id = wingB === 'left' ? 'rock_left_1' : 'rock_right_1';
    const gB2Id = wingB === 'left' ? 'rock_left_2' : 'rock_right_2';

    const effectiveSurplus = targetSteps <= 4 ? 2 : settings.pickaxeSurplus;
    const keepZ3Pickaxe = effectiveSurplus >= 2 || (effectiveSurplus === 1 && rng() < 0.5);
    const keepZ6Pickaxe = effectiveSurplus >= 2 || (effectiveSurplus === 1 && !keepZ3Pickaxe);

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
        } else if (node.zone === 3 && keepZ3Pickaxe) {
          presetNodes.push(node);
        } else if (node.zone === 6 && keepZ6Pickaxe) {
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
      gateById.set(gn.id || '', {
        ...gn,
        id: gn.id || `gk_${gn.x}_${gn.y}`,
        name: 'Rock',
        emoji: '🪨',
        requires: ['pickaxe'],
        reqType: 'AND',
        reward: null,
        gateType: 'rock'
      });
    }

    const setAsChasm = (id: string) => {
      const g = gateById.get(id);
      if (!g) return;
      g.gateType = 'chasm';
      g.name = 'Abyssal Chasm';
      g.emoji = '🕳️';
      g.requires = ['rope'];
      g.reqType = 'AND';
    };

    const setAsGuardian = (id: string, reqs: string[]) => {
      const g = gateById.get(id);
      if (!g) return;
      g.gateType = 'guardian';
      g.name = TROLL_TEMPLATE.name;
      g.emoji = TROLL_TEMPLATE.emoji;
      g.requires = reqs;
      g.reqType = 'AND';
    };

    let itemCursor = 0;
    const allocChainItem = (): string | null => {
      if (itemCursor >= chainItems.length) return null;
      return chainItems[itemCursor++];
    };

    const hops: HopSpec[] = [];
    const extraLootRequests: Array<{ zone: number; fallbackZones: number[]; itemId: string }> = [];
    let chasmCount = 0;

    if (targetSteps <= 5) {
      // Easy / Introductory Cave (3..5 steps)
      const freeOnWingA = 1 + (wingA === 'right' && keepZ3Pickaxe ? 1 : 0) + (keepZ6Pickaxe ? 1 : 0);

      if (targetSteps === 5 && freeOnWingA >= 2) {
        const gReq = allocChainItem()!;
        setAsGuardian('vault_rock', [gReq]);
        const pCount = Math.max(1, 5 - freeOnWingA);
        const chainHops = Math.max(0, (targetSteps - 1) - pCount - 1);

        let curReq = startItems[0];
        for (let c = 0; c < chainHops; c++) {
          const mid = allocChainItem()!;
          hops.push({ zone: c === 0 ? 1 : zA1, fallbackZones: [1, zA1], req: curReq, reward: mid });
          curReq = mid;
        }
        hops.push({ zone: zA2, fallbackZones: [zA2, 6, zA1], req: curReq, reward: gReq });

        const pZones = [1, zA1, 6, 7];
        for (let p = 0; p < pCount; p++) {
          const z = pZones[p % pZones.length];
          const req = p < 2 ? startItems[p + 1] : 'mushroom';
          hops.push({
            zone: z,
            fallbackZones: z <= zA1 ? [z, 1] : [z, zA1, 6],
            req: (z === 1 || z === 4 || z === 6) && req === 'mushroom' ? startItems[2] : req,
            reward: 'pickaxe',
            isToolTrade: true
          });
        }
      } else {
        const pCount = Math.max(1, 6 - freeOnWingA);
        const chainHops = Math.max(0, (targetSteps - 1) - pCount);

        let curReq = startItems[0];
        for (let c = 0; c < chainHops; c++) {
          const mid = allocChainItem()!;
          hops.push({ zone: c === 0 ? 1 : zA1, fallbackZones: [1, zA1], req: curReq, reward: mid });
          curReq = mid;
        }
        hops.push({ zone: zA1, fallbackZones: [zA1, 1], req: curReq, reward: 'pickaxe', isToolTrade: true });

        const pZones = [zA2, 6, 7, 1];
        for (let p = 1; p < pCount; p++) {
          const z = pZones[(p - 1) % pZones.length];
          const req = p <= 2 ? startItems[p] : 'mushroom';
          hops.push({
            zone: z,
            fallbackZones: [z, zA1, 1],
            req: (z === 1 || z === 4 || z === 6) && req === 'mushroom' ? startItems[2] : req,
            reward: 'pickaxe',
            isToolTrade: true
          });
        }
      }
    } else {
      // Normal (6..7), Hard (8..9), Expert (10..12):
      // Cross-corridor weave + Rope Chasm(s) + Multi-Req Cave Troll Guardian(s)
      const useDeepGuardian = targetSteps >= 8;
      const visitB2 = targetSteps >= 10;

      setAsChasm(gA2Id);
      chasmCount++;
      if (visitB2 && rng() < 0.75) {
        setAsChasm(gB2Id);
        chasmCount++;
      } else if (!useDeepGuardian && rng() < 0.45) {
        setAsChasm('rock_final_2');
        chasmCount++;
      }

      const activeGates = [gA1Id, gA2Id, gA3Id, gB1Id, 'rock_final_1'];
      if (visitB2) activeGates.push(gB2Id);
      if (!useDeepGuardian) activeGates.push('rock_final_2');

      const chasmsNeeded = activeGates.filter(id => gateById.get(id)?.gateType === 'chasm').length;
      const rocksNeeded = activeGates.length - chasmsNeeded;
      const totalFreePickaxes = 1 + (keepZ3Pickaxe ? 1 : 0) + (keepZ6Pickaxe ? 1 : 0);
      const pickTradesNeeded = Math.max(1, rocksNeeded - totalFreePickaxes);

      const goalSteps = useDeepGuardian ? 2 : 1;
      const neededTrades = targetSteps - goalSteps;

      const vaultReqs: string[] = [];
      const midReqs: string[] = [];
      const tradedTargets: Array<{ item: string; destZone: number; fallbackZones: number[] }> = [];

      if (!useDeepGuardian) {
        const v0 = allocChainItem()!;
        const v1 = allocChainItem()!;
        vaultReqs.push(v0, v1);
        setAsGuardian('vault_rock', vaultReqs);
        tradedTargets.push(
          { item: v0, destZone: zA2, fallbackZones: [zA2, zB1, 6] },
          { item: v1, destZone: 7, fallbackZones: [7, 6, 8] }
        );
      } else if (targetSteps === 8) {
        const m0 = allocChainItem()!;
        midReqs.push(m0, 'mushroom');
        setAsGuardian('rock_final_2', midReqs);

        const v0 = allocChainItem()!;
        vaultReqs.push(v0, 'mushroom');
        setAsGuardian('vault_rock', vaultReqs);

        tradedTargets.push(
          { item: m0, destZone: zA2, fallbackZones: [zA2, 6, 7] },
          { item: v0, destZone: 8, fallbackZones: [8, 7, 6] }
        );
      } else {
        const m0 = allocChainItem()!;
        midReqs.push(m0, 'mushroom');
        setAsGuardian('rock_final_2', midReqs);

        const v0 = allocChainItem()!;
        const v1 = allocChainItem()!;
        if (targetSteps >= 10) {
          vaultReqs.push(v0, v1, 'mushroom');
        } else {
          vaultReqs.push(v0, v1);
        }
        setAsGuardian('vault_rock', vaultReqs);

        tradedTargets.push(
          { item: m0, destZone: visitB2 ? zB2 : 6, fallbackZones: visitB2 ? [zB2, 6, zA2] : [6, zA2, 7] },
          { item: v0, destZone: zA2, fallbackZones: [zA2, 6, 7] },
          { item: v1, destZone: 8, fallbackZones: [8, 7] }
        );
      }

      // Build ordered tool trades strictly in accessible tiers:
      // - 1st pickaxe in zA1 (to unlock gB1)
      // - 1st rope in zB1 (to unlock gA2 chasm!)
      // - remaining tools in zA2, zB1/zB2, 6, 7
      const toolSpecs: Array<{
        tool: 'pickaxe' | 'rope';
        zone: number;
        fallbackZones: number[];
        tierAvailZones: number[];
      }> = [];
      let picksLeft = pickTradesNeeded;
      let ropesLeft = chasmsNeeded;

      if (picksLeft > 0) {
        toolSpecs.push({ tool: 'pickaxe', zone: zA1, fallbackZones: [zA1, 1], tierAvailZones: [1, zA1] });
        picksLeft--;
      }
      if (ropesLeft > 0) {
        toolSpecs.push({ tool: 'rope', zone: zB1, fallbackZones: [zB1, 1], tierAvailZones: [zA1, zB1] });
        ropesLeft--;
      }
      const deepToolSlots = visitB2
        ? [
            { z: zA2, fb: [zA2, zB1], avail: [zA1, zB1, zA2] },
            { z: zB2, fb: [zB2, 6], avail: [zB1, zA2, zB2] },
            { z: 6, fb: [6, zA2], avail: [zA2, 6] },
            { z: 7, fb: [7, 6], avail: [6, 7] }
          ]
        : [
            { z: zA2, fb: [zA2, 6], avail: [zA1, zB1, zA2] },
            { z: 6, fb: [6, zA2], avail: [zA2, 6] },
            { z: zB1, fb: [zB1, zA2], avail: [zB1, zA2] },
            { z: 7, fb: [7, 6], avail: [6, 7] }
          ];
      let dtIdx = 0;
      while (ropesLeft > 0) {
        const s = deepToolSlots[dtIdx++ % deepToolSlots.length];
        toolSpecs.push({ tool: 'rope', zone: s.z, fallbackZones: s.fb, tierAvailZones: s.avail });
        ropesLeft--;
      }
      while (picksLeft > 0) {
        const s = deepToolSlots[dtIdx++ % deepToolSlots.length];
        toolSpecs.push({ tool: 'pickaxe', zone: s.z, fallbackZones: s.fb, tierAvailZones: s.avail });
        picksLeft--;
      }

      const terminalCount = toolSpecs.length + tradedTargets.length;
      const extraChainHops = Math.max(0, neededTrades - terminalCount);

      // Prepare exact `terminalCount` inputs: startItems (3) + unused Z1 mushroom (when <= 1 direct mushroom used) + floor loot
      const directMushroomCount =
        midReqs.filter(r => r === 'mushroom').length + vaultReqs.filter(r => r === 'mushroom').length;
      const freeInputs: Array<{ item: string; minZone?: number }> = [
        ...startItems.map(s => ({ item: s })),
        ...(directMushroomCount <= 2 ? [{ item: 'mushroom' }] : [])
      ];

      while (freeInputs.length < terminalCount) {
        // Reuse startItems as extra floor loot presets so unique inventory slots stay <= 4
        // and all 8 chainItems remain available for cross-wing bridges & multi-hop chains
        const lootIdx = extraLootRequests.length;
        const lootItem = startItems[lootIdx % startItems.length];
        const tierZones = [zB1, zA1, 1, 6];
        const chosenZ = tierZones[lootIdx % tierZones.length];
        extraLootRequests.push({
          zone: chosenZ,
          fallbackZones: [1, zA1, zB1, 6, zA2, zB2],
          itemId: lootItem
        });
        freeInputs.push({ item: lootItem, minZone: chosenZ });
      }

      let inputIdx = 0;
      let chainBudget = extraChainHops;

      // Cross-wing backbone: zA1 trades -> crossBridge, zB1 rope consumes crossBridge -> rope
      for (const ts of toolSpecs) {
        const inp = freeInputs[inputIdx++];
        if (ts.tool === 'rope' && ts.zone === zB1 && chainBudget > 0 && inp.item !== 'mushroom') {
          const crossBridge = allocChainItem();
          if (crossBridge) {
            hops.push({ zone: zA1, fallbackZones: [zA1, 1], req: inp.item, reward: crossBridge });
            hops.push({ zone: zB1, fallbackZones: ts.fallbackZones, req: crossBridge, reward: 'rope', isToolTrade: true });
            chainBudget--;
            continue;
          }
        }

        let req = inp.item;
        if (req === 'mushroom' && (ts.zone === 1 || ts.zone === 4 || ts.zone === 6)) {
          const bridge = allocChainItem();
          if (bridge) {
            hops.push({ zone: zA1, fallbackZones: [zA1, zB1], req: 'mushroom', reward: bridge });
            req = bridge;
            if (chainBudget > 0) chainBudget--;
          }
        }

        if (chainBudget > 0 && ts.zone !== 1 && ts.zone !== zA1) {
          const mid = allocChainItem();
          if (mid) {
            const prevZ = ts.zone === zB2 ? zB1 : (ts.zone === 6 ? zA2 : zA1);
            hops.push({ zone: prevZ, fallbackZones: [prevZ, zA1, zB1], req, reward: mid });
            hops.push({ zone: ts.zone, fallbackZones: ts.fallbackZones, req: mid, reward: ts.tool, isToolTrade: true });
            chainBudget--;
            continue;
          }
        }

        hops.push({ zone: ts.zone, fallbackZones: ts.fallbackZones, req, reward: ts.tool, isToolTrade: true });
      }

      // Guardian target chains
      tradedTargets.forEach((tgt, idx) => {
        const inp = freeInputs[inputIdx++];
        let curReq = inp.item;
        if (curReq === 'mushroom' && (tgt.destZone === 1 || tgt.destZone === 4 || tgt.destZone === 6)) {
          const bridge = allocChainItem();
          if (bridge) {
            hops.push({ zone: zA1, fallbackZones: [zA1, zB1], req: 'mushroom', reward: bridge });
            curReq = bridge;
          }
        }
        const extraHere = idx === 0 ? chainBudget : 0;
        if (extraHere > 0) chainBudget = 0;

        for (let c = 0; c < extraHere; c++) {
          const mid = allocChainItem();
          if (!mid) break;
          const hopZ = c % 2 === 0 ? zB1 : (visitB2 ? zB2 : zA2);
          hops.push({ zone: hopZ, fallbackZones: [hopZ, zA1, zA2, 6], req: curReq, reward: mid });
          curReq = mid;
        }
        hops.push({ zone: tgt.destZone, fallbackZones: tgt.fallbackZones, req: curReq, reward: tgt.item });
      });
    }

    const totalTradersAndLoot = hops.length + extraLootRequests.length;
    const totalAvailableSlots = Array.from(freeTraderSlotsByZone.values()).reduce((sum, arr) => sum + arr.length, 0);
    if (totalTradersAndLoot > totalAvailableSlots) {
      continue;
    }

    // Materialize core trader entities onto zone slots FIRST so every trade hits its exact tier
    const coreTraders: PuzzleEntity[] = [];
    let placementFailed = false;
    let entitySeq = 1;
    const shuffledTemplates = shuffle(TRADER_TEMPLATES, rng);

    for (let i = 0; i < hops.length; i++) {
      const h = hops[i];
      const slot = popSlot(h.fallbackZones);
      if (!slot) {
        placementFailed = true;
        break;
      }
      let reqItem = h.req;
      if (reqItem === 'mushroom' && (slot.zone === 1 || slot.zone === 4 || slot.zone === 6)) {
        // Fallback safely if mushroom landed in a mushroom zone
        const alt = startItems.find(s => s !== reqItem) || startItems[0];
        reqItem = alt;
      }
      const tpl = shuffledTemplates[(i + attempt) % shuffledTemplates.length];
      coreTraders.push(
        makeEntityFromSlot(
          slot,
          tpl,
          `${tpl.id}_core_${entitySeq++}`,
          [reqItem],
          'OR',
          h.reward
        )
      );
    }
    if (placementFailed) continue;

    // Materialize extra floor loot presets AFTER core traders into remaining early/mid slots
    const extraLootEntities: PuzzleEntity[] = [];
    let lootFailed = false;
    for (let i = 0; i < extraLootRequests.length; i++) {
      const req = extraLootRequests[i];
      const slot = popSlot(req.fallbackZones);
      if (!slot) {
        lootFailed = true;
        break;
      }
      extraLootEntities.push(buildFloorLootPreset(slot, req.itemId, i + 1));
    }
    if (lootFailed) continue;

    // Assign exact number of Giant Moles (diggers)
    let diggersAssigned = 0;
    const prioritizedForMole = [...coreTraders].sort((a, b) => {
      const aPrefer = a.zone >= 2 && a.zone <= 7 ? 0 : 1;
      const bPrefer = b.zone >= 2 && b.zone <= 7 ? 0 : 1;
      return aPrefer - bPrefer;
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
      ...extraLootEntities
    ];
    const gatekeepers = Array.from(gateById.values());

    const coreEntities = sanitizePuzzleEntities([...gatekeepers, ...presets, ...coreTraders], items);
    const coreSol = solvePuzzle(startItems, coreEntities, 'vault_rock', levelStub, { maxStates: 25000 });
    if (!coreSol || coreSol.steps < targetSteps || coreSol.steps > targetSteps + 1) {
      continue;
    }

    // Place Temptation Decoys along the player's actual inventory timeline
    const decoyTraders: PuzzleEntity[] = [];
    if (settings.decoyCount > 0) {
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
        if (ent.reward) simInv.push(ent.reward);
      }

      const allNeeded = new Set(coreEntities.flatMap(e => e.requires || []));
      const safeSinkItems = BARTER_ITEMS.filter(id => !allNeeded.has(id));
      const sinkReward = safeSinkItems[0] || chainItems[chainItems.length - 1];
      const usedKeys = new Set<string>();

      for (let d = 0; d < settings.decoyCount; d++) {
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
        const tpl = needMole ? MOLE_TEMPLATE : shuffledTemplates[(entitySeq + d) % shuffledTemplates.length];
        const id = needMole ? `mole_${diggersAssigned++}` : `${tpl.id}_decoy_${entitySeq++}`;
        const rew = sinkReward === picked.item
          ? (safeSinkItems.find(s => s !== picked.item) || chainItems.find(s => s !== picked.item) || 'emerald')
          : sinkReward;

        decoyTraders.push(
          makeEntityFromSlot(slot, tpl, id, [picked.item], 'AND', rew, needMole)
        );
      }
    }

    // Fill remaining unused slots with safe non-shortcutting red-herring traders
    const allChainUsed = new Set([
      ...startItems,
      ...coreEntities.flatMap(e => [...(e.requires || []), ...(e.reward ? [e.reward] : [])])
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
        const reqPool = BARTER_ITEMS.filter(
          id => id !== reward && !(slot.zone === 1 || slot.zone === 4 || slot.zone === 6 ? id === 'mushroom' : false)
        );
        const req = pickValidReplacementReq(reward, tpl.allowedReqs || reqPool, reqPool, redHerrings.length);
        redHerrings.push(
          makeEntityFromSlot(slot, tpl, id, [req], 'OR', reward, needMole)
        );
      }
    }

    const allEntities = sanitizePuzzleEntities(
      [...gatekeepers, ...presets, ...coreTraders, ...decoyTraders, ...redHerrings],
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
        chasmCount,
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
