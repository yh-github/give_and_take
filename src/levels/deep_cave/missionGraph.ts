import { shuffle } from '../../logic/rng.ts';
import type { RNG } from '../../logic/rng.ts';
import { sanitizePuzzleEntities } from '../../logic/rules.ts';
import { assessPuzzleDifficulty, solvePuzzle } from '../../logic/solver.ts';
import { items as UNDERGROUND_ITEMS, entities as UNDERGROUND_ENTITIES } from './data.ts';
import { pickOne } from './spaceBlueprint.ts';
import type {
  DeepCaveSettings,
  EncounterPlacement,
  GatedEdgeSpec,
  LevelDefinition,
  MissionEntitySpec,
  MissionGraphResult,
  SpaceBlueprint,
  ZoneMeta
} from '../../types/index.ts';

export const ITEM_META_BY_ID: Record<string, { name?: string; emoji?: string }> = Object.fromEntries(
  UNDERGROUND_ITEMS.map((item) => [item.id, { name: item.name, emoji: item.emoji }])
);

export function getItemMeta(itemId: string, fallbackName = 'Item'): { name: string; emoji: string } {
  const found = ITEM_META_BY_ID[itemId];
  return {
    name: found?.name || fallbackName,
    emoji: found?.emoji || '📦'
  };
}

export const TRADE_ITEMS = UNDERGROUND_ITEMS
  .map(i => i.id)
  .filter(id => id !== 'pickaxe' && id !== 'rope');

export const TRADER_TEMPLATES = UNDERGROUND_ENTITIES.filter(e => e.id !== 'mole' && e.id !== 'troll');
export const MOLE_TEMPLATE = UNDERGROUND_ENTITIES.find(e => e.id === 'mole') || {
  id: 'mole',
  name: 'Giant Mole',
  emoji: '🐭'
};

export const GUARDIAN_TEMPLATES = [
  { id: 'troll', name: 'Cave Troll', emoji: '🧌' }
];

export const ROCK_GATE_TEMPLATE = { id: 'rock', name: 'Rock', emoji: '🪨' };
export const CHASM_GATE_TEMPLATE = { id: 'chasm', name: 'Chasm', emoji: '🕳️' };
export const VAULT_TREASURE_TEMPLATE = { id: 'vault_treasure', name: 'Vault Treasure', emoji: '👑' };

type TreeEdge =
  | {
      edgeId: string;
      kind: 'doorway';
      gate: GatedEdgeSpec;
      fromZone: number;
      toZone: number;
      isFinal: boolean;
    }
  | {
      edgeId: string;
      kind: 'guardian_lair' | 'chasm_enc' | 'grotto_enc';
      encounter: EncounterPlacement;
      fromZone: number;
      toZone: number;
      isFinal: boolean;
    };

interface ProgressionSegment {
  segIdx: number;
  barrier: TreeEdge;
  startZ: number;
  zones: ZoneMeta[];
  allZoneIds: Set<number>;
}

interface LiveToken {
  item: string;
  zoneId: number;
  row: number;
  /** Earliest segment index where this token was produced */
  bornSegIdx: number;
  fromEncounter?: EncounterPlacement;
  avoidZoneId?: number;
}

/**
 * Stage 1: Synthesizes a non-linear, interconnected Mission Graph matching
 * `(settings, blueprint)` with multi-item Cave Trolls, forward-carry threads,
 * cross-zone backtracking, earnable tools, and greedy-trap decoys.
 */
export function synthesizeMissionGraph(
  settings: DeepCaveSettings,
  blueprint: SpaceBlueprint,
  levelStub: Pick<LevelDefinition, 'mechanics'>,
  rng: RNG
): MissionGraphResult | null {
  const { zoneMeta, vaultZoneId, gatedEdges, encounterPlacements } = blueprint;

  const regularZones = Array.from(zoneMeta.values())
    .filter(z =>
      z.id !== vaultZoneId &&
      !z.isGrottoPocket &&
      z.slots.some(sl => !blueprint.slots[sl.row][sl.col].encounterId && blueprint.slots[sl.row][sl.col].role !== 'vault')
    )
    .sort((a, b) => a.id - b.id);
  if (regularZones.length === 0) return { ok: false, structural: true, reason: 'NULL_NO_REG_ZONES' };

  const zoneRemainingCapacity = new Map<number, number>();
  const zonePhysicalSlack = new Map<number, number>();
  for (const z of regularZones) {
    let regCount = 0;
    let campCount = 0;
    for (const sl of z.slots) {
      const slotObj = blueprint.slots[sl.row][sl.col];
      if (!slotObj.encounterId && slotObj.role !== 'vault') {
        if (slotObj.role === 'camp') campCount++;
        else regCount++;
      }
    }
    const baseCap = campCount + regCount * 2;
    zoneRemainingCapacity.set(z.id, baseCap);
    zonePhysicalSlack.set(z.id, baseCap);
  }
  const consumeZoneSlot = (zId: number) => {
    zoneRemainingCapacity.set(zId, (zoneRemainingCapacity.get(zId) ?? 0) - 1);
    zonePhysicalSlack.set(zId, (zonePhysicalSlack.get(zId) ?? 0) - 1);
  };
  const pickCapacityZone = (preferredList: readonly ZoneMeta[]): number => {
    const withSoft = preferredList.filter(z => (zoneRemainingCapacity.get(z.id) || 0) > 0);
    let chosen: ZoneMeta;
    if (withSoft.length > 0) {
      chosen = pickOne(withSoft, rng);
    } else {
      const withPhys = preferredList.filter(z => (zonePhysicalSlack.get(z.id) || 0) > 0);
      chosen = withPhys.length > 0
        ? [...withPhys].sort((a, b) => (zonePhysicalSlack.get(b.id) || 0) - (zonePhysicalSlack.get(a.id) || 0))[0]
        : [...preferredList].sort((a, b) => (zonePhysicalSlack.get(b.id) ?? -99) - (zonePhysicalSlack.get(a.id) ?? -99))[0];
    }
    consumeZoneSlot(chosen.id);
    return chosen.id;
  };

  const doorwayGates = gatedEdges.map(g => ({ ...g }));
  if (doorwayGates.some(g => g.fromZone == null || g.toZone == null)) {
    return { ok: false, structural: true, reason: 'NULL_UNZONED_DOOR' };
  }

  const grottos = encounterPlacements.filter(ep => ep.encounter.id === 'mushroom_grotto');
  const chasms = encounterPlacements.filter(ep => ep.encounter.id === 'rope_chasm_bridge');
  const guardianLairList = encounterPlacements.filter(ep => ep.encounter.id === 'guardian_lair');

  const allTreeEdges: TreeEdge[] = [];
  for (const g of doorwayGates) {
    allTreeEdges.push({
      edgeId: `door:${g.edgeKey}`,
      kind: 'doorway',
      gate: g,
      fromZone: g.fromZone!,
      toZone: g.toZone!,
      isFinal: Boolean(g.isVaultEntry)
    });
  }
  for (const ep of guardianLairList) {
    allTreeEdges.push({
      edgeId: `lair:${ep.originCol},${ep.originRow}`,
      kind: 'guardian_lair',
      encounter: ep,
      fromZone: ep.fromZone!,
      toZone: ep.toZone!,
      isFinal: ep.toZone === vaultZoneId
    });
  }
  for (const ep of chasms) {
    allTreeEdges.push({
      edgeId: `chasm_enc:${ep.originCol},${ep.originRow}`,
      kind: 'chasm_enc',
      encounter: ep,
      fromZone: ep.fromZone!,
      toZone: ep.toZone!,
      isFinal: false
    });
  }
  for (const ep of grottos) {
    allTreeEdges.push({
      edgeId: `grotto_enc:${ep.originCol},${ep.originRow}`,
      kind: 'grotto_enc',
      encounter: ep,
      fromZone: ep.fromZone!,
      toZone: ep.toZone!,
      isFinal: false
    });
  }

  const childrenByZone = new Map<number, TreeEdge[]>();
  const parentEdgeByZone = new Map<number, TreeEdge>();
  for (const edge of allTreeEdges) {
    let list = childrenByZone.get(edge.fromZone);
    if (!list) {
      list = [];
      childrenByZone.set(edge.fromZone, list);
    }
    list.push(edge);
    if (!parentEdgeByZone.has(edge.toZone)) {
      parentEdgeByZone.set(edge.toZone, edge);
    }
  }

  // Shortest-parent walk from vaultZoneId -> 1 (BFS from 1 to build clean spanning parent map in case of loops)
  const treeParentEdge = new Map<number, TreeEdge>();
  {
    const q = [1];
    const seen = new Set<number>([1]);
    while (q.length > 0) {
      const z = q.shift()!;
      for (const edge of childrenByZone.get(z) || []) {
        if (!seen.has(edge.toZone)) {
          seen.add(edge.toZone);
          treeParentEdge.set(edge.toZone, edge);
          q.push(edge.toZone);
        }
      }
    }
  }

  const spineEdgesRev: TreeEdge[] = [];
  let walkZ = vaultZoneId;
  const seenWalk = new Set([walkZ]);
  while (walkZ !== 1) {
    const pe = treeParentEdge.get(walkZ) || parentEdgeByZone.get(walkZ);
    if (!pe || seenWalk.has(pe.fromZone)) return null;
    spineEdgesRev.push(pe);
    walkZ = pe.fromZone;
    seenWalk.add(walkZ);
  }
  const spineEdges = spineEdgesRev.reverse();
  const spineEdgeIds = new Set(spineEdges.map(e => e.edgeId));

  for (const edge of allTreeEdges) {
    if (edge.kind === 'doorway' && !spineEdgeIds.has(edge.edgeId) && edge.gate.gateType === 'guardian') {
      edge.gate.gateType = 'rock';
    }
    if (edge.kind === 'guardian_lair' && !spineEdgeIds.has(edge.edgeId)) {
      return null;
    }
  }

  const grottoSteps = 0;
  const finalSpineEdge = spineEdges[spineEdges.length - 1];
  if (!finalSpineEdge) return null;
  finalSpineEdge.isFinal = true;
  if (finalSpineEdge.kind === 'doorway') {
    finalSpineEdge.gate.gateType = 'guardian';
    finalSpineEdge.gate.isVaultEntry = true;
  }

  const isBarrierEdge = (e: TreeEdge): boolean =>
    e.isFinal ||
    e.kind === 'guardian_lair' ||
    (e.kind === 'doorway' && e.gate.gateType === 'guardian');

  const buildSegmentsFromBarriers = (barrierList: readonly TreeEdge[]): ProgressionSegment[] => {
    const barrierSet = new Set(barrierList.map(b => b.edgeId));
    const segs: ProgressionSegment[] = [];
    for (let i = 0; i < barrierList.length; i++) {
      const startZ = i === 0 ? 1 : barrierList[i - 1].toZone;
      const b = barrierList[i];
      const q = [startZ];
      const visited = new Set([startZ]);
      const zones: ZoneMeta[] = [];
      const allZoneIds = new Set<number>();
      while (q.length > 0) {
        const zId = q.shift()!;
        if (zId === vaultZoneId) continue;
        allZoneIds.add(zId);
        const meta = zoneMeta.get(zId);
        if (
          meta &&
          !meta.isGrottoPocket &&
          meta.slots.some(sl => !blueprint.slots[sl.row][sl.col].encounterId && blueprint.slots[sl.row][sl.col].role !== 'vault')
        ) {
          zones.push(meta);
        }
        const outEdges = childrenByZone.get(zId) || [];
        for (const edge of outEdges) {
          if (barrierSet.has(edge.edgeId)) continue;
          if (!visited.has(edge.toZone)) {
            visited.add(edge.toZone);
            q.push(edge.toZone);
          }
        }
      }
      segs.push({ segIdx: i, barrier: b, startZ, zones, allZoneIds });
    }
    return segs;
  };

  let activeBarriers = spineEdges.filter(isBarrierEdge);
  const promotableSpineDoors = spineEdges.filter(
    (e): e is Extract<TreeEdge, { kind: 'doorway' }> =>
      !e.isFinal && e.kind === 'doorway' && e.gate.gateType !== 'guardian'
  );

  const chainItemPoolCount = TRADE_ITEMS.filter(id => id !== 'mushroom').length - (settings.decoyCount > 0 ? 1 : 0);
  const segHasEncOut = (s: ProgressionSegment): boolean =>
    chasms.some(ep => (ep.toZone != null && s.allZoneIds.has(ep.toZone)) || (ep.fromZone != null && s.allZoneIds.has(ep.fromZone))) ||
    grottos.some(ep => ep.fromZone != null && s.allZoneIds.has(ep.fromZone));
  const countNonEmptySegs = (segs: readonly ProgressionSegment[]): number =>
    segs.filter(s => s.zones.length > 0).length;
  const computeStrictCap = (segs: readonly ProgressionSegment[]): number =>
    segs.reduce((sum, s, i) => {
      if (s.zones.length === 0) return sum;
      const outPenalty = segHasEncOut(s) ? 1 : 0;
      const tokenMax = Math.min(8, Math.max(0, chainItemPoolCount - 2 - outPenalty));
      const rawPhys = s.zones.reduce((zSum, z) => zSum + (zonePhysicalSlack.get(z.id) || 0), 0);
      const reserve = i === 0
        ? (segs.length > 1 && settings.targetSteps >= 9 && rawPhys >= 5 ? 2 : 1)
        : 1;
      const physMax = Math.max(0, rawPhys - reserve);
      return sum + Math.min(tokenMax, physMax);
    }, 0);

  for (const doorEdge of promotableSpineDoors) {
    const curSegs = buildSegmentsFromBarriers(activeBarriers);
    const curNonEmpty = countNonEmptySegs(curSegs);
    const curBarter = settings.targetSteps - activeBarriers.length - grottoSteps;
    const curCap = computeStrictCap(curSegs);
    if (curCap >= curBarter) {
      break;
    }
    if (curBarter - 1 < 0) break;

    doorEdge.gate.gateType = 'guardian';
    const nextBarriers = spineEdges.filter(isBarrierEdge);
    const probeSegs = buildSegmentsFromBarriers(nextBarriers);
    const nextNonEmpty = countNonEmptySegs(probeSegs);
    const anyInvalidEmpty = probeSegs.some(s => {
      if (s.zones.length > 0) return false;
      return !segHasEncOut(s) || s.segIdx === 0;
    });
    const straddlesGrottoBadly =
      probeSegs.length >= 2 &&
      grottos.some(ep => {
        const finalSeg = probeSegs[probeSegs.length - 1];
        return ep.fromZone != null && finalSeg.allZoneIds.has(ep.fromZone) && finalSeg.zones.length <= 1;
      });

    if (!anyInvalidEmpty && !straddlesGrottoBadly && nextNonEmpty > curNonEmpty) {
      activeBarriers = nextBarriers;
    } else {
      doorEdge.gate.gateType = 'rock';
    }
  }

  let segments = buildSegmentsFromBarriers(activeBarriers);
  let changed = true;
  while (changed) {
    changed = false;
    const totalBarter = settings.targetSteps - activeBarriers.length - grottoSteps;
    const emptyIdx = segments.findIndex(s => s.zones.length === 0 && (!segHasEncOut(s) || s.segIdx === 0));
    if (emptyIdx !== -1) {
      const seg = segments[emptyIdx];
      if (emptyIdx > 0) {
        const prevBarrier = segments[emptyIdx - 1].barrier;
        if (prevBarrier.kind === 'doorway') {
          prevBarrier.gate.gateType = 'rock';
          activeBarriers = spineEdges.filter(isBarrierEdge);
          segments = buildSegmentsFromBarriers(activeBarriers);
          changed = true;
          continue;
        }
      }
      if (!seg.barrier.isFinal && seg.barrier.kind === 'doorway') {
        seg.barrier.gate.gateType = 'rock';
        activeBarriers = spineEdges.filter(isBarrierEdge);
        segments = buildSegmentsFromBarriers(activeBarriers);
        changed = true;
        continue;
      }
    }
    if (activeBarriers.length > 1 && totalBarter < 0) {
      const demoteB = activeBarriers.find(
        (b): b is Extract<TreeEdge, { kind: 'doorway' }> => !b.isFinal && b.kind === 'doorway'
      );
      if (demoteB) {
        demoteB.gate.gateType = 'rock';
        activeBarriers = spineEdges.filter(isBarrierEdge);
        segments = buildSegmentsFromBarriers(activeBarriers);
        changed = true;
      }
    }
  }

  const totalBarterSteps = settings.targetSteps - segments.length - grottoSteps;
  if (totalBarterSteps < 0) return { ok: false, structural: true, reason: 'NULL_NEG_BARTER' };

  const zoneToSegIdx = new Map<number, number>();
  for (const seg of segments) {
    for (const zId of seg.allZoneIds) {
      zoneToSegIdx.set(zId, seg.segIdx);
    }
  }

  for (const seg of segments) {
    if (seg.zones.length === 0) {
      if (!segHasEncOut(seg) || seg.segIdx === 0) {
        return { ok: false, structural: true, reason: 'NULL_EMPTY_SEG' };
      }
    }
  }

  const NON_MUSHROOM_TRADE_ITEMS = TRADE_ITEMS.filter(id => id !== 'mushroom');
  const shuffledPool = shuffle(NON_MUSHROOM_TRADE_ITEMS, rng);
  const decoySinkItem = shuffledPool[0];
  const CHAIN_ITEMS = shuffledPool.slice(1);

  // Pick startItems FIRST and reserve them in globallyUsedEver so encounters/caches never collide with startItems
  const segStartItemsPool = shuffle(CHAIN_ITEMS, rng);
  const startItems = [segStartItemsPool[0], segStartItemsPool[1]];
  const globallyUsedEver = new Set<string>(startItems);

  const entitySpecs: MissionEntitySpec[] = [];
  let entitySeq = 1;
  const toolInputs: Array<{ itemId: string; fromZone: number; toZone: number; segIdx: number; isEncounter: boolean; encounter?: EncounterPlacement }> = [];
  const segOutputsBySegIdx: Array<Array<{ item: string; zoneId: number; encounter?: EncounterPlacement; avoidZoneId?: number }>> = Array.from(
    { length: segments.length },
    () => []
  );
  const pendingChasmCaches: Array<{ ep: EncounterPlacement; segIdx: number }> = [];

  for (const ep of chasms) {
    const fromZone = ep.fromZone!;
    const toZone = ep.toZone!;
    const sIdx = zoneToSegIdx.get(fromZone) ?? 0;
    toolInputs.push({ itemId: 'rope', fromZone, toZone, segIdx: sIdx, isEncounter: true, encounter: ep });
    entitySpecs.push({
      kind: 'encounter_gate',
      encounter: ep,
      anchorType: 'L',
      anchorIndex: 0,
      id: `chasm_enc_${entitySeq++}`,
      name: CHASM_GATE_TEMPLATE.name,
      emoji: CHASM_GATE_TEMPLATE.emoji,
      requires: ['rope'],
      reqType: 'AND',
      reward: null,
      zone: fromZone,
      unlocksZones: [toZone],
      isGatekeeper: true,
      gateType: 'chasm'
    });
    const toSegIdx = zoneToSegIdx.get(toZone) ?? sIdx;
    pendingChasmCaches.push({ ep, segIdx: toSegIdx });
  }

  for (const ep of grottos) {
    const fromZone = ep.fromZone!;
    const toZone = ep.toZone!;
    const sIdx = zoneToSegIdx.get(fromZone) ?? 0;
    toolInputs.push({ itemId: 'pickaxe', fromZone, toZone, segIdx: sIdx, isEncounter: true, encounter: ep });
    entitySpecs.push({
      kind: 'encounter_gate',
      encounter: ep,
      anchorType: 'G',
      anchorIndex: 0,
      id: `grotto_rock_${entitySeq++}`,
      name: ROCK_GATE_TEMPLATE.name,
      emoji: ROCK_GATE_TEMPLATE.emoji,
      requires: ['pickaxe'],
      reqType: 'AND',
      reward: null,
      zone: fromZone,
      unlocksZones: [toZone],
      isGatekeeper: true,
      gateType: 'rock'
    });
    const mushMeta = getItemMeta('mushroom', 'Mushroom');
    entitySpecs.push({
      kind: 'encounter_item',
      encounter: ep,
      anchorType: 'E',
      anchorIndex: 0,
      id: `mushroom_enc_${entitySeq++}`,
      name: mushMeta.name,
      emoji: mushMeta.emoji,
      isPreset: 'mushroom',
      requires: [],
      reqType: 'AND',
      reward: 'mushroom',
      zone: toZone
    });
    // Route Mushroom consumption away from the Grotto's vestibule: push to a deeper segment whenever possible
    const mushroomTargetSegIdx = sIdx + 1 < segments.length ? sIdx + 1 : sIdx;
    segOutputsBySegIdx[mushroomTargetSegIdx].push({
      item: 'mushroom',
      zoneId: toZone,
      encounter: ep,
      avoidZoneId: fromZone
    });

    // Secondary find inside the sealed fungal cavern so behind the rocks feels like an actual cache,
    // either supplying an unrelated progression item or a glittering decoy trap.
    const segHasOtherZones = (segments[sIdx]?.zones.length ?? 0) >= 2;
    let grottoCacheItem: string;
    if (segHasOtherZones && segOutputsBySegIdx[sIdx].length < 2) {
      const unusedForGrotto = CHAIN_ITEMS.filter(id => !globallyUsedEver.has(id));
      grottoCacheItem = unusedForGrotto.length > 0 ? pickOne(unusedForGrotto, rng) : pickOne(CHAIN_ITEMS, rng);
      globallyUsedEver.add(grottoCacheItem);
      segOutputsBySegIdx[sIdx].push({
        item: grottoCacheItem,
        zoneId: toZone,
        encounter: ep
      });
    } else {
      grottoCacheItem = decoySinkItem;
    }
    const grottoCacheMeta = getItemMeta(grottoCacheItem, 'Cave Cache');
    entitySpecs.push({
      kind: 'encounter_cache',
      encounter: ep,
      anchorType: 'E',
      anchorIndex: 1,
      id: `grotto_cache_enc_${entitySeq++}`,
      name: grottoCacheMeta.name,
      emoji: grottoCacheMeta.emoji,
      isPreset: grottoCacheItem,
      requires: [],
      reqType: 'AND',
      reward: grottoCacheItem,
      zone: toZone
    });
  }

  for (const { ep, segIdx } of pendingChasmCaches) {
    const segBarrierInSameZone = segments[segIdx]?.barrier?.fromZone === ep.toZone;
    const segHasOtherZones = (segments[segIdx]?.zones.length ?? 0) >= 2;
    const existingOuts = segOutputsBySegIdx[segIdx];
    let bonusReward: string;
    if (!segBarrierInSameZone && segHasOtherZones && existingOuts.length < 2) {
      const brandNewChoices = CHAIN_ITEMS.filter(id => !globallyUsedEver.has(id));
      const unusedChoices = CHAIN_ITEMS.filter(id => !startItems.includes(id) && !existingOuts.some(o => o.item === id));
      bonusReward = brandNewChoices.length > 0
        ? pickOne(brandNewChoices, rng)
        : (unusedChoices.length > 0 ? pickOne(unusedChoices, rng) : pickOne(CHAIN_ITEMS, rng));
      globallyUsedEver.add(bonusReward);
      segOutputsBySegIdx[segIdx].push({ item: bonusReward, zoneId: ep.toZone!, encounter: ep });
    } else {
      bonusReward = decoySinkItem;
    }
    const cacheMeta = getItemMeta(bonusReward, 'Cache Item');
    entitySpecs.push({
      kind: 'encounter_cache',
      encounter: ep,
      anchorType: 'E',
      anchorIndex: 0,
      id: `cache_enc_${entitySeq++}`,
      name: cacheMeta.name,
      emoji: cacheMeta.emoji,
      requires: [],
      reqType: 'AND',
      isPreset: bonusReward,
      reward: bonusReward,
      zone: ep.toZone!
    });
  }

  for (const gate of doorwayGates) {
    if (gate.isVaultEntry || gate.gateType === 'guardian') continue;
    const fromZone = gate.fromZone!;
    const toZone = gate.toZone!;
    const tool = gate.gateType === 'chasm' ? 'rope' : 'pickaxe';
    const tpl = gate.gateType === 'chasm' ? CHASM_GATE_TEMPLATE : ROCK_GATE_TEMPLATE;
    toolInputs.push({
      itemId: tool,
      fromZone,
      toZone,
      segIdx: zoneToSegIdx.get(fromZone) ?? 0,
      isEncounter: false
    });
    entitySpecs.push({
      kind: 'doorway_gate',
      edgeKey: gate.edgeKey,
      id: `${gate.gateType}_${entitySeq++}`,
      name: tpl.name,
      emoji: tpl.emoji,
      requires: [tool],
      reqType: 'AND',
      reward: null,
      zone: fromZone,
      unlocksZones: [toZone],
      isGatekeeper: true,
      gateType: gate.gateType
    });
  }

  const getAncestorZoneIds = (fromZone: number): number[] => {
    const ancestors: number[] = [];
    let cur: number | null = fromZone;
    const guard = new Set<number>();
    while (cur != null && !guard.has(cur)) {
      ancestors.push(cur);
      guard.add(cur);
      if (cur === 1) break;
      const pe: TreeEdge | undefined = treeParentEdge.get(cur) || parentEdgeByZone.get(cur);
      cur = pe ? pe.fromZone : null;
    }
    return ancestors;
  };

  // Distribute barter step budget across segments
  const segPhysCaps = segments.map((seg, sIdx) => {
    const rawPhys = seg.zones.reduce((sum, z) => sum + (zonePhysicalSlack.get(z.id) || 0), 0);
    const reserve = sIdx === 0
      ? (segments.length > 1 && settings.targetSteps >= 9 && rawPhys >= 5 ? 2 : 1)
      : 1;
    const needsGrottoRelocation =
      sIdx > 0 && segOutputsBySegIdx[sIdx].some(o => o.avoidZoneId === seg.barrier.fromZone);
    return Math.max(needsGrottoRelocation ? 1 : 0, rawPhys - reserve);
  });
  const segStepCounts = Array<number>(segments.length).fill(0);
  let remSteps = totalBarterSteps;
  // Seed 1 step first on segments that must route a grotto mushroom away from its barrier zone
  for (let sIdx = 0; sIdx < segments.length && remSteps > 0; sIdx++) {
    const mustRoute =
      sIdx > 0 && segOutputsBySegIdx[sIdx].some(o => o.avoidZoneId === segments[sIdx].barrier.fromZone);
    if (mustRoute && segPhysCaps[sIdx] >= 1) {
      segStepCounts[sIdx]++;
      remSteps--;
    }
  }
  for (let pass = 0; remSteps > 0 && pass < 24; pass++) {
    let progressed = false;
    for (let sIdx = 0; sIdx < segments.length && remSteps > 0; sIdx++) {
      if (segments[sIdx].zones.length === 0) continue;
      const hasOut = segOutputsBySegIdx[sIdx].length > 0 ? 1 : 0;
      const tokenMax = Math.min(8, Math.max(0, CHAIN_ITEMS.length - 2 - hasOut));
      const strictMax = Math.min(tokenMax, segPhysCaps[sIdx]);
      if (segStepCounts[sIdx] < strictMax) {
        segStepCounts[sIdx]++;
        remSteps--;
        progressed = true;
      }
    }
    if (!progressed) break;
  }
  if (remSteps > 0) {
    return { ok: false, structural: true, reason: 'NULL_REM_STEPS' };
  }

  // Track live threads across the whole cave so later segments inherit carried items
  const liveThreads: LiveToken[] = [
    { item: startItems[0], zoneId: 1, row: 0, bornSegIdx: 0 },
    { item: startItems[1], zoneId: 1, row: 0, bornSegIdx: 0 }
  ];
  let activeCarryItem: string | null = null;

  const liveItemSet = (extraLive: readonly LiveToken[] = []): Set<string> => {
    const s = new Set<string>(liveThreads.map(t => t.item));
    if (activeCarryItem) s.add(activeCarryItem);
    for (const lt of extraLive) s.add(lt.item);
    for (const segOuts of segOutputsBySegIdx) {
      for (const eo of segOuts) s.add(eo.item);
    }
    return s;
  };

  const pickNextRewardItem = (
    exclude: readonly string[],
    segUsed: Set<string>,
    extraLive: readonly LiveToken[] = [],
    preferFresh = true
  ): string => {
    const live = liveItemSet(extraLive);
    const excl = new Set(exclude);
    if (preferFresh) {
      const brandNew = CHAIN_ITEMS.filter(
        id => !globallyUsedEver.has(id) && !segUsed.has(id) && !live.has(id) && !excl.has(id)
      );
      if (brandNew.length > 0) {
        const chosen = pickOne(brandNew, rng);
        globallyUsedEver.add(chosen);
        return chosen;
      }
    }
    const segFresh = CHAIN_ITEMS.filter(id => !segUsed.has(id) && !live.has(id) && !excl.has(id));
    if (segFresh.length > 0) {
      const chosen = pickOne(segFresh, rng);
      globallyUsedEver.add(chosen);
      return chosen;
    }
    const safeAny = CHAIN_ITEMS.filter(id => !segUsed.has(id) && !excl.has(id));
    if (safeAny.length > 0) {
      const chosen = pickOne(safeAny, rng);
      globallyUsedEver.add(chosen);
      return chosen;
    }
    const fallback = CHAIN_ITEMS.filter(id => !excl.has(id));
    const chosen = fallback.length > 0 ? pickOne(fallback, rng) : CHAIN_ITEMS[0];
    globallyUsedEver.add(chosen);
    return chosen;
  };

  // Helper: free preset items already in a zone (anti-silliness check)
  const getFreePresetsInZone = (zId: number): Set<string> =>
    new Set(
      entitySpecs
        .filter(p => p.isPreset && (!p.requires || p.requires.length === 0) && p.zone === zId && p.reward)
        .map(p => p.reward!)
    );

  // Pick up to `wantEarnableTools` toolInputs to be earned from barter trades instead of free floor pickups.
  // Never make a tool earnable if a free floor preset or surplus of that same tool exists at/before that segment!
  const wantEarnableTools = settings.targetSteps >= 12
    ? Math.min(2, toolInputs.length)
    : (settings.targetSteps >= 6 ? Math.min(1, toolInputs.length) : 0);
  const earnableToolSet = new Set<number>();
  if (wantEarnableTools > 0 && totalBarterSteps >= 3) {
    const eligibleIndices = toolInputs
      .map((t, idx) => ({ t, idx }))
      .filter(({ t }) => {
        if (t.itemId === 'pickaxe' && settings.pickaxeSurplus > 0) return false;
        // Must not share the cave up to t.segIdx with any other gate needing the same tool
        const sameToolUpToSeg = toolInputs.filter(
          other => other.itemId === t.itemId && other.segIdx <= t.segIdx
        ).length;
        if (sameToolUpToSeg > 1) return false;
        if (segStepCounts[t.segIdx] < 2) return false;
        if (t.isEncounter) {
          return segOutputsBySegIdx.some(
            (segOuts, idx) => idx >= t.segIdx && segOuts.some(o => o.encounter === t.encounter)
          );
        }
        const toZ = zoneMeta.get(t.toZone);
        const barZ = segments[t.segIdx]?.barrier?.fromZone;
        return Boolean(toZ && !toZ.isGrottoPocket && t.toZone !== barZ && regularZones.some(z => z.id === t.toZone));
      });
    for (const item of shuffle(eligibleIndices, rng)) {
      if (earnableToolSet.size >= wantEarnableTools) break;
      const alreadyInSeg = Array.from(earnableToolSet).some(i => toolInputs[i].segIdx === item.t.segIdx);
      if (alreadyInSeg && segStepCounts[item.t.segIdx] < 3) continue;
      // Avoid earning both a pickaxe and a rope in the same segment unless it has >= 4 barter steps
      if (alreadyInSeg && segStepCounts[item.t.segIdx] < 4) continue;
      earnableToolSet.add(item.idx);
    }
  }

  let backtracksUsed = 0;
  let prevBarrierSpec: MissionEntitySpec | null = null;
  const barterTradesMeta: Array<{ spec: MissionEntitySpec; segIdx: number; row: number }> = [];
  const itemsUsedInSegByIdx: Array<Set<string>> = Array.from({ length: segments.length }, () => new Set<string>());

  for (let sIdx = 0; sIdx < segments.length; sIdx++) {
    const seg = segments[sIdx];
    const segOutputs = segOutputsBySegIdx[sIdx];
    const segUsed = new Set<string>(segOutputs.map(o => o.item));
    const segZones = seg.zones;
    let stepsInSeg = segStepCounts[sIdx];

    // Sort segment zones shallow->deep for structured non-linear placement
    const zonesByDepth = [...segZones].sort((a, b) => a.minRow - b.minRow || a.id - b.id);
    const barrierZoneId = seg.barrier.fromZone;
    const barrierRow = zoneMeta.get(barrierZoneId)?.maxRow ?? 0;

    // Earlier segments' unlocked zones available for cross-segment backtracking
    const earlierSegZones = sIdx > 0
      ? regularZones.filter(z => {
          const zSeg = zoneToSegIdx.get(z.id);
          return zSeg != null && zSeg < sIdx && (zonePhysicalSlack.get(z.id) || 0) > 0;
        })
      : [];

    // Ensure segment has active threads entering it without resetting via floor cache when avoidable
    if (sIdx > 0 && liveThreads.length === 0 && segOutputs.length === 0) {
      // Only if no carried thread & no encounter output survived, place a floor cache strictly outside barrierZoneId
      const nonBarrier = zonesByDepth.filter(z => z.id !== barrierZoneId);
      if (nonBarrier.length > 0) {
        const seedItem = pickNextRewardItem([], segUsed, liveThreads);
        segUsed.add(seedItem);
        const zId = pickCapacityZone(nonBarrier);
        const meta = getItemMeta(seedItem, 'Floor Item');
        entitySpecs.push({
          kind: 'preset_seg_seed',
          id: `seg_${sIdx}_cache_${entitySeq++}`,
          name: meta.name,
          emoji: meta.emoji,
          isPreset: seedItem,
          requires: [],
          reqType: 'AND',
          reward: seedItem,
          zone: zId
        });
        liveThreads.push({
          item: seedItem,
          zoneId: zId,
          row: zoneMeta.get(zId)?.minRow ?? 0,
          bornSegIdx: sIdx
        });
      } else {
        const seedSourceRef = segZones[0]?.id ?? seg.barrier.fromZone;
        const ancZones = getAncestorZoneIds(seedSourceRef)
          .filter(zId => zId !== seedSourceRef && zId !== barrierZoneId)
          .map(zId => regularZones.find(z => z.id === zId))
          .filter((z): z is ZoneMeta => Boolean(z));
        if (ancZones.length === 0) return { ok: false, reason: 'NO_SAFE_SEG_SEED_SLOT' };
        const alreadyReq = new Set(entitySpecs.flatMap(e => e.requires || []));
        const liveNow = liveItemSet(liveThreads);
        let chosenAnc = ancZones[0].id;
        let seedItem: string | undefined;
        const orderedAncs = [...ancZones].sort(
          (a, b) => (zonePhysicalSlack.get(b.id) || 0) - (zonePhysicalSlack.get(a.id) || 0)
        );
        for (const anc of orderedAncs) {
          const freeInAnc = getFreePresetsInZone(anc.id);
          const reqInAnc = new Set(
            entitySpecs
              .filter(e => e.zone === anc.id && e.gateType !== 'rock' && e.gateType !== 'chasm')
              .flatMap(e => e.requires || [])
          );
          const cand =
            CHAIN_ITEMS.find(id => !alreadyReq.has(id) && !freeInAnc.has(id) && !reqInAnc.has(id) && !segUsed.has(id) && !liveNow.has(id)) ||
            CHAIN_ITEMS.find(id => !reqInAnc.has(id) && !freeInAnc.has(id) && !segUsed.has(id) && !liveNow.has(id)) ||
            CHAIN_ITEMS.find(id => !reqInAnc.has(id) && !freeInAnc.has(id) && !liveNow.has(id));
          if (cand) {
            chosenAnc = anc.id;
            seedItem = cand;
            break;
          }
        }
        if (!seedItem) return { ok: false, reason: 'NO_SAFE_SEG_SEED_SLOT' };
        consumeZoneSlot(chosenAnc);
        segUsed.add(seedItem);
        const meta = getItemMeta(seedItem, 'Floor Item');
        entitySpecs.push({
          kind: 'preset_seg_seed',
          id: `seg_${sIdx}_cache_${entitySeq++}`,
          name: meta.name,
          emoji: meta.emoji,
          isPreset: seedItem,
          requires: [],
          reqType: 'AND',
          reward: seedItem,
          zone: chosenAnc
        });
        liveThreads.push({
          item: seedItem,
          zoneId: chosenAnc,
          row: zoneMeta.get(chosenAnc)?.minRow ?? 0,
          bornSegIdx: sIdx
        });
      }
    }

    // Absorb encounter outputs from this segment into local segment tokens
    const localThreads: LiveToken[] = [];
    // If we have >= 2 live threads (or 1 live thread + an encounter output in this segment) and more segments remain,
    // keep 1 thread to carry forward into deeper segments!
    const isFinalSeg = sIdx === segments.length - 1;
    let carryThread: LiveToken | null = null;
    if (!isFinalSeg && (liveThreads.length >= 2 || (liveThreads.length === 1 && segOutputs.length >= 1))) {
      const nextSegHasOut = segOutputsBySegIdx[sIdx + 1]?.length > 0;
      if (!nextSegHasOut || settings.targetSteps >= 8) {
        carryThread = liveThreads.pop()!;
        activeCarryItem = carryThread.item;
        segUsed.add(carryThread.item);
      }
    } else {
      activeCarryItem = null;
    }

    while (liveThreads.length > 0) {
      const lt = liveThreads.shift()!;
      segUsed.add(lt.item);
      localThreads.push(lt);
    }
    for (const eo of segOutputs) {
      segUsed.add(eo.item);
      localThreads.push({
        item: eo.item,
        zoneId: eo.zoneId,
        row: zoneMeta.get(eo.zoneId)?.minRow ?? 0,
        bornSegIdx: sIdx,
        fromEncounter: eo.encounter,
        avoidZoneId: eo.avoidZoneId
      });
    }

    // Handle earnable tool trades scheduled for this segment (strictly preserving localThreads.length >= 1)
    const segEarnableTools = toolInputs
      .map((t, idx) => ({ t, idx }))
      .filter(({ t, idx }) => t.segIdx === sIdx && earnableToolSet.has(idx));

    for (const { t, idx: tInputIdx } of segEarnableTools) {
      if (stepsInSeg < 2) {
        earnableToolSet.delete(tInputIdx);
        continue;
      }
      if (t.isEncounter && localThreads.length < 2) {
        // Need another independent thread to spend so the encounter's own output remains
        earnableToolSet.delete(tInputIdx);
        continue;
      }
      if (!t.isEncounter && localThreads.length === 0) {
        earnableToolSet.delete(tInputIdx);
        continue;
      }

      const ancIds = getAncestorZoneIds(t.fromZone);
      const ancZoneMetas = ancIds
        .map(id => regularZones.find(z => z.id === id))
        .filter((z): z is ZoneMeta => Boolean(z));
      if (ancZoneMetas.length === 0) {
        earnableToolSet.delete(tInputIdx);
        continue;
      }

      const threadIdx = localThreads.findIndex(lt => {
        if (t.isEncounter && lt.fromEncounter === t.encounter) return false;
        // Token used to buy the tool MUST already be reachable in an ancestor zone before passing t!
        if (!ancIds.includes(lt.zoneId)) return false;
        return ancZoneMetas.some(az => !getFreePresetsInZone(az.id).has(lt.item));
      });
      if (threadIdx === -1) {
        earnableToolSet.delete(tInputIdx);
        continue;
      }
      const chosenThread = localThreads.splice(threadIdx, 1)[0];
      const safeAncs = ancZoneMetas.filter(z => !getFreePresetsInZone(z.id).has(chosenThread.item));
      const slackSafeAncs = safeAncs.filter(z => (zonePhysicalSlack.get(z.id) || 0) > 0);
      const toolTraderZone = pickCapacityZone(slackSafeAncs.length > 0 ? slackSafeAncs : safeAncs);

      const tpl = pickOne(TRADER_TEMPLATES, rng);
      const toolSpec: MissionEntitySpec = {
        kind: 'barter_trader',
        id: `${tpl.id}_tr_${entitySeq++}`,
        name: tpl.name,
        emoji: tpl.emoji,
        isDigger: false,
        requires: [chosenThread.item],
        reqType: 'AND',
        reward: t.itemId,
        zone: toolTraderZone
      };
      entitySpecs.push(toolSpec);
      barterTradesMeta.push({
        spec: toolSpec,
        segIdx: sIdx,
        row: zoneMeta.get(toolTraderZone)?.minRow ?? 0
      });
      stepsInSeg--;

      const toZoneMeta = zoneMeta.get(t.toZone);
      if (!t.isEncounter && toZoneMeta && !toZoneMeta.isGrottoPocket && regularZones.some(z => z.id === t.toZone)) {
        const unlockedReward = pickNextRewardItem([chosenThread.item], segUsed, localThreads);
        segUsed.add(unlockedReward);
        consumeZoneSlot(t.toZone);
        const uMeta = getItemMeta(unlockedReward, 'Cache Item');
        entitySpecs.push({
          kind: 'preset_branch_cache',
          id: `branch_${sIdx}_cache_${entitySeq++}`,
          name: uMeta.name,
          emoji: uMeta.emoji,
          isPreset: unlockedReward,
          requires: [],
          reqType: 'AND',
          reward: unlockedReward,
          zone: t.toZone
        });
        localThreads.push({
          item: unlockedReward,
          zoneId: t.toZone,
          row: toZoneMeta.minRow,
          bornSegIdx: sIdx
        });
      }
    }

    // If we want a 2+ item Cave Troll on this segment and only have 1 thread,
    // fork a 2nd thread from a non-barrier branch zone (or earlier segment zone for the Final Vault Troll).
    const wantMultiReqTroll =
      localThreads.length === 1 &&
      ((settings.targetSteps >= 7 && stepsInSeg >= 2) || (isFinalSeg && settings.targetSteps >= 6));
    if (wantMultiReqTroll) {
      const sameSegForks = zonesByDepth.filter(
        z => z.id !== 1 && z.id !== barrierZoneId && (zonePhysicalSlack.get(z.id) || 0) >= 1
      );
      const anySameSegNonBar = zonesByDepth.filter(
        z => z.id !== barrierZoneId && (z.slots.length >= 2 || (zonePhysicalSlack.get(z.id) || 0) >= 0)
      );
      const earlierMultiSlot = regularZones.filter(z => {
        const zSeg = zoneToSegIdx.get(z.id);
        return (
          zSeg != null &&
          zSeg < sIdx &&
          z.id !== barrierZoneId &&
          (zonePhysicalSlack.get(z.id) || 0) >= (z.slots.length >= 2 ? 0 : 1)
        );
      });
      const fallbackForks = sameSegForks.length > 0
        ? sameSegForks
        : (anySameSegNonBar.length > 0
            ? anySameSegNonBar
            : (isFinalSeg ? earlierMultiSlot : []));
      if (fallbackForks.length > 0) {
        const forkZ = pickCapacityZone(fallbackForks);
        const reqInForkZ = entitySpecs
          .filter(e => e.zone === forkZ && e.gateType !== 'rock' && e.gateType !== 'chasm')
          .flatMap(e => e.requires || []);
        const excludeForFork = [...localThreads.map(t => t.item), ...reqInForkZ];
        const forkItem = pickNextRewardItem(excludeForFork, segUsed, localThreads);
        segUsed.add(forkItem);
        const fMeta = getItemMeta(forkItem, 'Relic Cache');
        entitySpecs.push({
          kind: 'preset_branch_cache',
          id: `fork_${sIdx}_cache_${entitySeq++}`,
          name: fMeta.name,
          emoji: fMeta.emoji,
          isPreset: forkItem,
          requires: [],
          reqType: 'AND',
          reward: forkItem,
          zone: forkZ
        });
        localThreads.push({
          item: forkItem,
          zoneId: forkZ,
          row: zoneMeta.get(forkZ)?.minRow ?? 0,
          bornSegIdx: sIdx
        });
      }
    }

    // Execute remaining `stepsInSeg` barter trades across `localThreads`
    // Weaving in within-segment AND cross-segment backtracking!
    let threadCursor = 0;
    const freeInBarrierZoneNow = getFreePresetsInZone(barrierZoneId);
    for (let k = 0; k < stepsInSeg; k++) {
      if (localThreads.length === 0) break;

      const urgentIdx = localThreads.findIndex(
        lt => lt.avoidZoneId != null || freeInBarrierZoneNow.has(lt.item)
      );
      const primary = urgentIdx !== -1
        ? localThreads[urgentIdx]
        : localThreads[threadCursor % localThreads.length];
      let secondary: LiveToken | null = null;
      // Preserve >= 2 threads in the final segment so the Vault Troll demands >= 2 items
      const minThreadsToKeep = isFinalSeg && settings.targetSteps >= 7 ? 2 : 1;
      const shouldMergeTwo =
        localThreads.length > minThreadsToKeep &&
        (localThreads.length >= 3 ||
          (localThreads.length === 2 && k === stepsInSeg - 1 && settings.targetSteps >= 8 && rng() < 0.45 && !isFinalSeg));

      if (shouldMergeTwo) {
        const otherIdx = (threadCursor + 1) % localThreads.length;
        if (otherIdx !== threadCursor % localThreads.length) {
          const candSec = localThreads[otherIdx];
          const pair = [primary.item, candSec.item];
          const hasSafeForPair =
            zonesByDepth.some(z => !pair.some(c => getFreePresetsInZone(z.id).has(c))) ||
            earlierSegZones.some(z => (zonePhysicalSlack.get(z.id) || 0) > 0 && !pair.some(c => getFreePresetsInZone(z.id).has(c)));
          if (hasSafeForPair) {
            secondary = localThreads.splice(otherIdx, 1)[0];
          }
        }
      }

      const activeIdx = localThreads.indexOf(primary);
      const consumes = secondary && secondary.item !== primary.item
        ? [primary.item, secondary.item]
        : [primary.item];
      const avoidZones = new Set<number>();
      if (primary.avoidZoneId != null) avoidZones.add(primary.avoidZoneId);
      if (secondary?.avoidZoneId != null) avoidZones.add(secondary.avoidZoneId);

      // Pick trade zone: intentionally schedule backtracks when maxBacktracks allows!
      const canBacktrack = backtracksUsed < settings.maxBacktracks && settings.maxBacktrackRows > 0;
      const isBacktrackStep = canBacktrack && (k > 0 || sIdx > 0) && (k === stepsInSeg - 1 || k % 2 === 1);

      let tradeZoneId: number | null = null;

      if (isBacktrackStep) {
        const sourceRow = Math.max(primary.row, secondary?.row ?? primary.row);

        // Prefer cross-segment backtrack into an earlier segment's shallow zone when sIdx > 0
        if (sIdx > 0 && earlierSegZones.length > 0) {
          const validEarlier = earlierSegZones.filter(z => {
            const zSeg = zoneToSegIdx.get(z.id) ?? 0;
            const earlierUsed = itemsUsedInSegByIdx[zSeg];
            const rowDiff = sourceRow - z.minRow;
            const free = getFreePresetsInZone(z.id);
            return (
              !avoidZones.has(z.id) &&
              rowDiff >= 1 &&
              rowDiff <= settings.maxBacktrackRows &&
              (zoneRemainingCapacity.get(z.id) || 0) > 0 &&
              !consumes.some(c => free.has(c) || earlierUsed.has(c))
            );
          });
          if (validEarlier.length > 0) {
            tradeZoneId = pickCapacityZone(validEarlier);
            backtracksUsed++;
          }
        }

        // Otherwise within-segment backtrack (from deeper zone back up to shallower zone)
        if (tradeZoneId == null && zonesByDepth.length >= 2) {
          const validShallow = zonesByDepth.filter(z => {
            const rowDiff = sourceRow - z.minRow;
            const free = getFreePresetsInZone(z.id);
            return (
              !avoidZones.has(z.id) &&
              rowDiff >= 1 &&
              rowDiff <= settings.maxBacktrackRows &&
              (zonePhysicalSlack.get(z.id) || 0) > 0 &&
              !consumes.some(c => free.has(c))
            );
          });
          if (validShallow.length > 0) {
            tradeZoneId = pickCapacityZone(validShallow);
            backtracksUsed++;
          }
        }
      }

      if (tradeZoneId == null) {
        const safeSegZones = zonesByDepth.filter(z => {
          const free = getFreePresetsInZone(z.id);
          return !consumes.some(c => free.has(c));
        });
        const nonAvoidSegZones = safeSegZones.filter(z => !avoidZones.has(z.id));
        const validEarlierFallback = earlierSegZones.filter(z => {
          const zSeg = zoneToSegIdx.get(z.id) ?? 0;
          const earlierUsed = itemsUsedInSegByIdx[zSeg];
          const free = getFreePresetsInZone(z.id);
          return !avoidZones.has(z.id) && (zonePhysicalSlack.get(z.id) || 0) > 0 && !consumes.some(c => free.has(c) || earlierUsed.has(c));
        });
        const safePool = nonAvoidSegZones.length > 0
          ? nonAvoidSegZones
          : (validEarlierFallback.length > 0 ? validEarlierFallback : safeSegZones);
        if (safePool.length === 0) return { ok: false, reason: 'SAME_ZONE_FREE_REQUIRED_ITEM' };

        const slackSafePool = safePool.filter(z => (zonePhysicalSlack.get(z.id) || 0) > 0);
        const activePool = slackSafePool.length > 0 ? slackSafePool : safePool;

        if (canBacktrack && k < stepsInSeg - 1 && activePool.length >= 2) {
          const deepPool = activePool.slice(Math.floor(activePool.length / 2));
          tradeZoneId = pickCapacityZone(deepPool);
        } else {
          const frac = (k + 1) / Math.max(1, stepsInSeg);
          const idx = Math.min(activePool.length - 1, Math.floor(frac * activePool.length));
          const preferred = activePool[idx];
          if ((zoneRemainingCapacity.get(preferred.id) || 0) > 0) {
            consumeZoneSlot(preferred.id);
            tradeZoneId = preferred.id;
          } else {
            tradeZoneId = pickCapacityZone(activePool);
          }
        }
      }

      const reward = pickNextRewardItem(consumes, segUsed, localThreads);
      segUsed.add(reward);

      const tpl = pickOne(TRADER_TEMPLATES, rng);
      const tradeSpec: MissionEntitySpec = {
        kind: 'barter_trader',
        id: `${tpl.id}_tr_${entitySeq++}`,
        name: tpl.name,
        emoji: tpl.emoji,
        isDigger: false,
        requires: consumes,
        reqType: 'AND',
        reward,
        zone: tradeZoneId
      };
      entitySpecs.push(tradeSpec);

      const tzRow = zoneMeta.get(tradeZoneId)?.minRow ?? 0;
      barterTradesMeta.push({ spec: tradeSpec, segIdx: sIdx, row: tzRow });

      localThreads[activeIdx] = {
        item: reward,
        zoneId: tradeZoneId,
        row: tzRow,
        bornSegIdx: sIdx
      };
      threadCursor++;
    }

    // Converge localThreads into this segment's Cave Troll barrier
    const barrierReqs: string[] = [];
    for (const lt of localThreads) {
      if (!barrierReqs.includes(lt.item)) {
        barrierReqs.push(lt.item);
      }
    }
    if (barrierReqs.length === 0) return null;

    // Anti-silliness guard for barrier (cannot share zone with free preset of its own required item,
    // nor ask for an untraded encounter resource right outside that encounter's entrance zone)
    const freeAtBarrier = getFreePresetsInZone(barrierZoneId);
    if (barrierReqs.some(r => freeAtBarrier.has(r))) {
      return { ok: false, reason: 'SAME_ZONE_FREE_REQUIRED_ITEM' };
    }
    if (localThreads.some(lt => lt.avoidZoneId === barrierZoneId && lt.avoidZoneId !== null)) {
      return { ok: false, reason: 'GROTTO_CONSUMER_SAME_ZONE' };
    }

    const barrier = seg.barrier;
    let barrierSpec: MissionEntitySpec;
    if (barrier.kind === 'guardian_lair') {
      const tpl = GUARDIAN_TEMPLATES.find(t => t.id === 'troll') || GUARDIAN_TEMPLATES[0];
      barrierSpec = {
        kind: 'encounter_gate',
        encounter: barrier.encounter,
        anchorType: 'G',
        anchorIndex: 0,
        id: `guard_enc_${entitySeq++}`,
        name: tpl.name,
        emoji: tpl.emoji,
        requires: barrierReqs,
        reqType: 'AND',
        reward: null,
        zone: barrier.fromZone,
        unlocksZones: [barrier.toZone],
        isGatekeeper: true,
        gateType: 'guardian'
      };
    } else if (barrier.kind === 'doorway') {
      const tpl = pickOne(GUARDIAN_TEMPLATES, rng);
      barrierSpec = {
        kind: 'doorway_gate',
        edgeKey: barrier.gate.edgeKey,
        id: `guard_${entitySeq++}`,
        name: tpl.name,
        emoji: tpl.emoji,
        requires: barrierReqs,
        reqType: 'AND',
        reward: null,
        zone: barrier.fromZone,
        unlocksZones: [barrier.toZone],
        isGatekeeper: true,
        gateType: 'guardian'
      };
    } else {
      const tpl = pickOne(GUARDIAN_TEMPLATES, rng);
      barrierSpec = {
        kind: 'doorway_gate',
        id: `guard_${entitySeq++}`,
        name: tpl.name,
        emoji: tpl.emoji,
        requires: barrierReqs,
        reqType: 'AND',
        reward: null,
        zone: barrier.fromZone,
        unlocksZones: [barrier.toZone],
        isGatekeeper: true,
        gateType: 'guardian'
      };
    }
    entitySpecs.push(barrierSpec);
    prevBarrierSpec = barrierSpec;
    itemsUsedInSegByIdx[sIdx] = segUsed;

    // Restore carried thread (if saved) for the next segment!
    if (carryThread) {
      liveThreads.push(carryThread);
    }
    // Check if barrierRow was deeper than a trade's row (back-and-forth)
    void barrierRow;
  }

  // Place remaining non-earnable tool presets, distributed across ancestor zones (not all piled in Camp)
  const campSlotZones = new Set<number>([1]);
  for (let idx = 0; idx < toolInputs.length; idx++) {
    if (earnableToolSet.has(idx)) continue;
    const tReq = toolInputs[idx];
    const ancestorIds = getAncestorZoneIds(tReq.fromZone);
    const strictIds = ancestorIds.filter(zId => zId !== tReq.fromZone);
    const resolveZones = (ids: readonly number[]) =>
      ids.map(zId => regularZones.find(z => z.id === zId)).filter((z): z is ZoneMeta => Boolean(z));

    const sameSegNonCamp = resolveZones(
      strictIds.filter(zId => zoneToSegIdx.get(zId) === tReq.segIdx && !campSlotZones.has(zId))
    );
    const strictSameSeg = resolveZones(strictIds.filter(zId => zoneToSegIdx.get(zId) === tReq.segIdx));
    const strictAll = resolveZones(strictIds);
    const allAncestors = resolveZones(ancestorIds);
    const withSoft = (list: readonly ZoneMeta[]) => list.filter(z => (zoneRemainingCapacity.get(z.id) || 0) > 0);
    const withPhys = (list: readonly ZoneMeta[]) => list.filter(z => (zonePhysicalSlack.get(z.id) || 0) > 0);

    // Filter out zones that already contain an entity requiring this tool (keeps rock/chasm clean, avoids piling)
    const noDuplicateTool = (list: readonly ZoneMeta[]) =>
      list.filter(z => !getFreePresetsInZone(z.id).has(tReq.itemId));

    let chosenZone: number;
    const tiers = [
      withSoft(noDuplicateTool(sameSegNonCamp)),
      withSoft(noDuplicateTool(strictSameSeg)),
      withSoft(noDuplicateTool(strictAll)),
      withSoft(strictSameSeg),
      withSoft(strictAll),
      withPhys(strictSameSeg),
      withPhys(strictAll),
      withSoft(allAncestors),
      withPhys(allAncestors),
      allAncestors
    ];
    const pickedTier = tiers.find(t => t.length > 0);
    chosenZone = pickedTier ? pickCapacityZone(pickedTier) : pickCapacityZone([regularZones[0]]);

    const toolMeta = getItemMeta(tReq.itemId, 'Tool');
    entitySpecs.push({
      kind: 'preset_tool',
      id: `preset_${tReq.itemId}_${entitySeq++}`,
      name: toolMeta.name,
      emoji: toolMeta.emoji,
      isPreset: tReq.itemId,
      requires: [],
      reqType: 'AND',
      reward: tReq.itemId,
      zone: chosenZone
    });
  }

  // Spread surplus pickaxes away from Zone 1 when other zones have capacity
  for (let s = 0; s < settings.pickaxeSurplus; s++) {
    const surplusNonRoot = regularZones.filter(
      z => z.id !== 1 && (zonePhysicalSlack.get(z.id) || 0) > 0 && !getFreePresetsInZone(z.id).has('pickaxe')
    );
    const surplusAny = regularZones.filter(z => (zonePhysicalSlack.get(z.id) || 0) > 0);
    const pool = surplusNonRoot.length > 0 ? surplusNonRoot : surplusAny;
    if (pool.length === 0) break;
    const pickaxeMeta = getItemMeta('pickaxe', 'Pickaxe');
    entitySpecs.push({
      kind: 'preset_surplus',
      id: `surplus_pickaxe_${entitySeq++}`,
      name: pickaxeMeta.name,
      emoji: pickaxeMeta.emoji,
      isPreset: 'pickaxe',
      requires: [],
      reqType: 'AND',
      reward: 'pickaxe',
      zone: pickCapacityZone(pool)
    });
  }

  const goalEntityId = 'vault_treasure';
  entitySpecs.push({
    kind: 'goal_treasure',
    id: goalEntityId,
    name: VAULT_TREASURE_TEMPLATE.name,
    emoji: VAULT_TREASURE_TEMPLATE.emoji,
    isGoal: true,
    isPreset: 'treasure',
    isTreasure: true,
    requires: [],
    reqType: 'AND',
    reward: null,
    zone: vaultZoneId
  });

  // Distribute Diggers (Moles) across distinct segments/zones on trades whose inputs come from earlier/different zones
  let diggersAssigned = 0;
  if (settings.numDiggers > 0 && barterTradesMeta.length > 0) {
    const usedMoleSegs = new Set<number>();
    // Prefer trades in zones != 1 (so player doesn't trigger mole immediately on step 1) or deeper rows, spread across segments
    const sortedForMole = [...barterTradesMeta].sort((a, b) => {
      const aNonRoot = a.spec.zone !== 1 ? 0 : 1;
      const bNonRoot = b.spec.zone !== 1 ? 0 : 1;
      if (aNonRoot !== bNonRoot) return aNonRoot - bNonRoot;
      return a.segIdx - b.segIdx;
    });
    for (const candidate of sortedForMole) {
      if (diggersAssigned >= settings.numDiggers) break;
      if (usedMoleSegs.has(candidate.segIdx) && sortedForMole.some(m => !usedMoleSegs.has(m.segIdx))) {
        continue;
      }
      usedMoleSegs.add(candidate.segIdx);
      candidate.spec.isDigger = true;
      candidate.spec.name = MOLE_TEMPLATE.name;
      candidate.spec.emoji = MOLE_TEMPLATE.emoji;
      candidate.spec.id = candidate.spec.id.replace(/^[a-z]+_tr_/, 'mole_tr_');
      diggersAssigned++;
    }
  }

  // Verify core puzzle (pre-decoy) and record timeline of (unlockedZones, inv) for smart Trap Decoy placement
  const coreSanitized = sanitizePuzzleEntities(entitySpecs, UNDERGROUND_ITEMS);
  const coreSol = solvePuzzle(startItems, coreSanitized, goalEntityId, levelStub);
  if (!coreSol) {
    return { ok: false, reason: 'MISSION_UNSOLVABLE' };
  }
  if (coreSol.steps < settings.targetSteps || coreSol.steps > settings.targetSteps + 1) {
    return { ok: false, reason: `MISSION_STEPS_${coreSol.steps}_WANT_${settings.targetSteps}` };
  }

  // Place Temptation Decoys in zones where the player ACTUALLY holds the critical item,
  // creating real decisions ("trade now -> soft-lock, vs hold for the real consumer!")
  if (settings.decoyCount > 0) {
    const coreById = new Map(coreSanitized.map(e => [e.id, e]));
    const simUnlocked = new Set<number>([1]);
    let simInv = [...startItems];
    const temptationSlots: Array<{ zone: number; item: string; stepIdx: number }> = [];

    for (let s = 0; s < coreSol.path.length; s++) {
      const step = coreSol.path[s];
      const ent = step.entityId ? coreById.get(step.entityId) : undefined;
      if (!ent) continue;

      if (!ent.isPreset && ent.id !== goalEntityId && simInv.length > 0) {
        const unlockedList = Array.from(simUnlocked).filter(z => z !== vaultZoneId && regularZones.some(rz => rz.id === z));
        for (const held of Array.from(new Set(simInv))) {
          if (held === 'pickaxe' || held === 'rope' || held === 'mushroom') continue;
          for (const uz of unlockedList) {
            if (!getFreePresetsInZone(uz).has(held)) {
              temptationSlots.push({ zone: uz, item: held, stepIdx: s });
            }
          }
        }
      }

      if (ent.isGatekeeper && ent.unlocksZones) {
        ent.unlocksZones.forEach(z => simUnlocked.add(z));
      }
      for (const req of ent.requires || []) {
        const idx = simInv.indexOf(req);
        if (idx > -1) simInv.splice(idx, 1);
      }
      if (ent.reward) simInv.push(ent.reward);
    }

    const allNeededByChain = new Set(coreSanitized.flatMap(e => e.requires || []));
    const safeSinkRewards = NON_MUSHROOM_TRADE_ITEMS.filter(i => !allNeededByChain.has(i));
    const decoyTrapTargetsUsed = new Set<string>();

    for (let d = 0; d < settings.decoyCount; d++) {
      const availSlotsStrict = temptationSlots.filter(ts => (zonePhysicalSlack.get(ts.zone) || 0) > 0);
      const availSlots = availSlotsStrict.length > 0
        ? availSlotsStrict
        : temptationSlots.filter(ts => {
            const zm = zoneMeta.get(ts.zone);
            return zm && zm.slots.length >= 2 && (zonePhysicalSlack.get(ts.zone) ?? -99) >= -1;
          });
      // Prefer placing first decoy in Zone 1 / early steps where player holds carried or starting items
      const earlyPriority = availSlots.filter(
        ts => ts.zone === 1 && !decoyTrapTargetsUsed.has(`${ts.zone}:${ts.item}`)
      );
      const unusedItemSlots = availSlots.filter(ts => !decoyTrapTargetsUsed.has(`${ts.zone}:${ts.item}`));
      const orderedCandidates = shuffle(
        earlyPriority.length > 0 && d === 0 ? earlyPriority : (unusedItemSlots.length > 0 ? unusedItemSlots : availSlots),
        rng
      );

      let decoyZone: number;
      let req: string;
      const pickedSlot = orderedCandidates[0] || null;
      if (pickedSlot) {
        // Prefer a slot whose item is uniquely needed (not duplicated in start/presets) so taking the decoy is a genuine trap
        const verifiedTrapSlot = orderedCandidates.slice(0, 4).find(cand => {
          const remainingWithoutItem = startItems.filter(it => it !== cand.item);
          if (remainingWithoutItem.length === startItems.length) return true;
          const testWithout = solvePuzzle(remainingWithoutItem, coreSanitized, goalEntityId, levelStub, { maxStates: 400 });
          return !testWithout;
        }) || pickedSlot;
        decoyZone = verifiedTrapSlot.zone;
        consumeZoneSlot(decoyZone);
        req = verifiedTrapSlot.item;
        decoyTrapTargetsUsed.add(`${decoyZone}:${req}`);
      } else {
        const fallbackCandidatesStrict = regularZones.filter(z => (zonePhysicalSlack.get(z.id) || 0) > 0);
        const fallbackCandidates = fallbackCandidatesStrict.length > 0
          ? fallbackCandidatesStrict
          : regularZones.filter(z => z.slots.length >= 2 && (zonePhysicalSlack.get(z.id) ?? -99) >= -1);
        if (fallbackCandidates.length === 0) break;
        decoyZone = pickCapacityZone(fallbackCandidates);
        const freeInZone = getFreePresetsInZone(decoyZone);
        const fbReq = pickOne(CHAIN_ITEMS.filter(i => i !== decoySinkItem && !freeInZone.has(i)), rng);
        if (!fbReq) continue;
        req = fbReq;
      }

      // On multi-decoy maps, occasionally make a decoy reward a tempting real progression item
      // (as long as it doesn't shortcut the optimal step count!)
      const temptingRealItems = CHAIN_ITEMS.filter(i => i !== req && allNeededByChain.has(i));
      const candidateRew = (d % 2 === 1 && temptingRealItems.length > 0)
        ? pickOne(temptingRealItems, rng)
        : (decoySinkItem && !allNeededByChain.has(decoySinkItem)
            ? decoySinkItem
            : (safeSinkRewards.length > 0 ? pickOne(safeSinkRewards, rng) : null));
      if (!candidateRew) continue;

      const makeDigger = diggersAssigned < settings.numDiggers;
      if (makeDigger) diggersAssigned++;
      const tpl = makeDigger ? MOLE_TEMPLATE : pickOne(TRADER_TEMPLATES, rng);
      const idPrefix = makeDigger ? 'mole' : tpl.id;
      const decoySpec: MissionEntitySpec = {
        kind: 'decoy_trader',
        id: `${idPrefix}_decoy_${entitySeq++}`,
        name: tpl.name,
        emoji: tpl.emoji,
        isDigger: makeDigger,
        requires: [req],
        reqType: 'AND',
        reward: candidateRew,
        zone: decoyZone
      };
      entitySpecs.push(decoySpec);

      // Ensure a tempting real-item decoy never accidentally creates a shorter shortcut
      if (allNeededByChain.has(candidateRew)) {
        const probeSol = solvePuzzle(startItems, sanitizePuzzleEntities(entitySpecs, UNDERGROUND_ITEMS), goalEntityId, levelStub);
        if (!probeSol || probeSol.steps < settings.targetSteps || probeSol.steps > settings.targetSteps + 1) {
          decoySpec.reward = decoySinkItem && !allNeededByChain.has(decoySinkItem)
            ? decoySinkItem
            : (safeSinkRewards[0] || decoySinkItem);
        }
      }
    }
  }

  for (const ent of entitySpecs) {
    if (ent.isGatekeeper && ent.reward != null) {
      return { ok: false, reason: 'GATEKEEPER_HAS_REWARD' };
    }
    if (ent.isPreset || !ent.requires || ent.requires.length === 0) continue;
    if (ent.gateType === 'rock' || ent.gateType === 'chasm') continue;
    const sameZoneFree = entitySpecs.find(
      p =>
        p.isPreset &&
        (!p.requires || p.requires.length === 0) &&
        p.reward &&
        p.zone === ent.zone &&
        ent.requires!.includes(p.reward)
    );
    if (sameZoneFree) {
      return { ok: false, reason: 'SAME_ZONE_FREE_REQUIRED_ITEM' };
    }
  }

  const sanitized = sanitizePuzzleEntities(entitySpecs, UNDERGROUND_ITEMS);
  const sol = solvePuzzle(startItems, sanitized, goalEntityId, levelStub);
  if (!sol) {
    return { ok: false, reason: 'MISSION_UNSOLVABLE' };
  }
  if (sol.steps < settings.targetSteps || sol.steps > settings.targetSteps + 1) {
    return { ok: false, reason: `MISSION_STEPS_${sol.steps}_WANT_${settings.targetSteps}` };
  }

  // Silence unused import warning if assessPuzzleDifficulty is imported for diagnostics/checks
  void assessPuzzleDifficulty;
  void prevBarrierSpec;

  return {
    ok: true,
    startItems,
    entitySpecs: sanitized,
    goalEntityId,
    abstractSolution: sol
  };
}
