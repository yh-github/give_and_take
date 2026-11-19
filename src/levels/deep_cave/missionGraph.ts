import { shuffle } from '../../logic/rng.ts';
import type { RNG } from '../../logic/rng.ts';
import { sanitizePuzzleEntities } from '../../logic/rules.ts';
import { solvePuzzle } from '../../logic/solver.ts';
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

/**
 * Stage 1: Synthesizes an abstract solvable Mission Graph of exact step count
 * matching `(settings, blueprint)` and validates via `solvePuzzle`.
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
    parentEdgeByZone.set(edge.toZone, edge);
  }

  const spineEdgesRev: TreeEdge[] = [];
  let walkZ = vaultZoneId;
  const seenWalk = new Set([walkZ]);
  while (walkZ !== 1) {
    const pe = parentEdgeByZone.get(walkZ);
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

  const grottoSteps = grottos.length;
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
      const initPenalty = i === 0 ? 2 : 1;
      const tokenMax = Math.max(0, chainItemPoolCount - outPenalty - initPenalty);
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

    if (!anyInvalidEmpty && nextNonEmpty > curNonEmpty) {
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

  const entitySpecs: MissionEntitySpec[] = [];
  let entitySeq = 1;
  let diggersAssigned = 0;
  const toolInputs: Array<{ itemId: string; fromZone: number; segIdx: number }> = [];
  const segOutputsBySegIdx: string[][] = Array.from({ length: segments.length }, () => []);
  const pendingChasmCaches: Array<{ ep: EncounterPlacement; segIdx: number }> = [];

  for (const ep of chasms) {
    const fromZone = ep.fromZone!;
    const toZone = ep.toZone!;
    toolInputs.push({ itemId: 'rope', fromZone, segIdx: zoneToSegIdx.get(fromZone) ?? 0 });
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
    const sIdx = zoneToSegIdx.get(toZone) ?? zoneToSegIdx.get(fromZone) ?? (segments.length - 1);
    pendingChasmCaches.push({ ep, segIdx: sIdx });
  }

  for (const ep of grottos) {
    const fromZone = ep.fromZone!;
    const toZone = ep.toZone!;
    const sIdx = zoneToSegIdx.get(fromZone) ?? 0;
    toolInputs.push({ itemId: 'pickaxe', fromZone, segIdx: sIdx });
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
      anchorIndex: 1,
      id: `mushroom_enc_${entitySeq++}`,
      name: mushMeta.name,
      emoji: mushMeta.emoji,
      isPreset: 'mushroom',
      requires: [],
      reqType: 'AND',
      reward: 'mushroom',
      zone: toZone
    });
    const outReward = pickOne(CHAIN_ITEMS, rng);
    const tpl = pickOne(TRADER_TEMPLATES, rng);
    entitySpecs.push({
      kind: 'encounter_trader',
      encounter: ep,
      anchorType: 'E',
      anchorIndex: 0,
      id: `${tpl.id}_enc_${entitySeq++}`,
      name: tpl.name,
      emoji: tpl.emoji,
      requires: ['mushroom'],
      reqType: 'AND',
      reward: outReward,
      zone: fromZone
    });
    segOutputsBySegIdx[sIdx].push(outReward);
  }

  for (const { ep, segIdx } of pendingChasmCaches) {
    const segAlreadyHasOutput = segOutputsBySegIdx[segIdx].length > 0;
    const segBarrierInSameZone = segments[segIdx]?.barrier?.fromZone === ep.toZone;
    let bonusReward: string;
    if (!segAlreadyHasOutput && !segBarrierInSameZone) {
      bonusReward = pickOne(CHAIN_ITEMS, rng);
      segOutputsBySegIdx[segIdx].push(bonusReward);
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
      segIdx: zoneToSegIdx.get(fromZone) ?? 0
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
      const pe = parentEdgeByZone.get(cur);
      cur = pe ? pe.fromZone : null;
    }
    return ancestors;
  };

  const segPhysCaps = segments.map((seg, sIdx) => {
    const rawPhys = seg.zones.reduce((sum, z) => sum + (zonePhysicalSlack.get(z.id) || 0), 0);
    const reserve = sIdx === 0
      ? (segments.length > 1 && settings.targetSteps >= 9 && rawPhys >= 5 ? 2 : 1)
      : 1;
    return Math.max(0, rawPhys - reserve);
  });
  const segStepCounts = Array<number>(segments.length).fill(0);
  let remSteps = totalBarterSteps;
  for (let pass = 0; remSteps > 0 && pass < 20; pass++) {
    let progressed = false;
    for (let sIdx = 0; sIdx < segments.length && remSteps > 0; sIdx++) {
      if (segments[sIdx].zones.length === 0) continue;
      const hasOut = segOutputsBySegIdx[sIdx].length > 0 ? 1 : 0;
      const tokenMax = Math.max(0, CHAIN_ITEMS.length - hasOut - (sIdx === 0 ? 2 : 1));
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

  const segStartItemsPool = shuffle(CHAIN_ITEMS, rng);
  const startItems = [segStartItemsPool[0], segStartItemsPool[1]];
  let backtracksUsed = 0;
  let prevBarrierSpec: MissionEntitySpec | null = null;

  for (let sIdx = 0; sIdx < segments.length; sIdx++) {
    const seg = segments[sIdx];
    const segOutputs = segOutputsBySegIdx[sIdx];
    const usedInSeg = new Set(segOutputs);
    const segZones = seg.zones;
    const stepsInSeg = segStepCounts[sIdx];

    let activeToken: string | null = null;
    let reserveToken: string | null = null;
    let segSeedZoneId: number | null = null;
    if (sIdx === 0) {
      activeToken = startItems[0];
      usedInSeg.add(startItems[0]);
      usedInSeg.add(startItems[1]);
      if (stepsInSeg > 0) {
        reserveToken = startItems[1];
      }
    } else if (segZones.length > 0) {
      const prevReqs = new Set(prevBarrierSpec?.requires || []);
      const freshPool = shuffle(CHAIN_ITEMS.filter(id => !usedInSeg.has(id) && !prevReqs.has(id)), rng);
      const fallbackPool = shuffle(CHAIN_ITEMS.filter(id => !prevReqs.has(id)), rng);
      let seedItem: string | undefined = freshPool[0] || fallbackPool[0] || CHAIN_ITEMS[0];

      const forbiddenZeroZone = stepsInSeg === 0 ? seg.barrier?.fromZone : null;
      const nonForbiddenSegZones = segZones.filter(z => z.id !== forbiddenZeroZone);

      const safeEncOutIdx = segOutputs.findIndex(outId =>
        !entitySpecs.some(
          p => p.isPreset && (!p.requires || p.requires.length === 0) && p.zone === segZones[0].id && p.reward === outId
        )
      );

      if (stepsInSeg === 0 && segOutputs.length > 0) {
        activeToken = null;
      } else if (stepsInSeg > 0 && segZones.length === 1 && safeEncOutIdx !== -1) {
        const [encOut] = segOutputs.splice(safeEncOutIdx, 1);
        usedInSeg.add(encOut);
        activeToken = encOut;
      } else if (stepsInSeg > 0 && segZones.length >= 2) {
        usedInSeg.add(seedItem);
        activeToken = seedItem;
        if ((zoneRemainingCapacity.get(segZones[0].id) || 0) > 0) {
          segSeedZoneId = segZones[0].id;
          consumeZoneSlot(segSeedZoneId);
        } else {
          segSeedZoneId = pickCapacityZone(segZones);
        }
        const seedMeta = getItemMeta(seedItem, 'Floor Item');
        entitySpecs.push({
          kind: 'preset_seg_seed',
          id: `seg_${sIdx}_cache_${entitySeq++}`,
          name: seedMeta.name,
          emoji: seedMeta.emoji,
          isPreset: seedItem,
          requires: [],
          reqType: 'AND',
          reward: seedItem,
          zone: segSeedZoneId
        });
      } else if (stepsInSeg === 0 && nonForbiddenSegZones.length > 0) {
        usedInSeg.add(seedItem);
        activeToken = seedItem;
        segSeedZoneId = pickCapacityZone(nonForbiddenSegZones);
        const seedMeta = getItemMeta(seedItem, 'Floor Item');
        entitySpecs.push({
          kind: 'preset_seg_seed',
          id: `seg_${sIdx}_cache_${entitySeq++}`,
          name: seedMeta.name,
          emoji: seedMeta.emoji,
          isPreset: seedItem,
          requires: [],
          reqType: 'AND',
          reward: seedItem,
          zone: segSeedZoneId
        });
      } else {
        const ancZones = getAncestorZoneIds(segZones[0].id)
          .filter(zId => zId !== segZones[0].id)
          .map(zId => regularZones.find(z => z.id === zId))
          .filter((z): z is ZoneMeta => Boolean(z));
        if (ancZones.length === 0) {
          return { ok: false, reason: 'NO_SAFE_SEG_SEED_SLOT' };
        }
        const prevBarrierZone = prevBarrierSpec
          ? ancZones.find(z => z.id === prevBarrierSpec!.zone)
          : null;
        let chosenAncZoneId: number;
        if (prevBarrierZone && (zoneRemainingCapacity.get(prevBarrierZone.id) || 0) > 0) {
          chosenAncZoneId = prevBarrierZone.id;
          consumeZoneSlot(chosenAncZoneId);
        } else {
          chosenAncZoneId = pickCapacityZone(ancZones);
        }

        const alreadyRequired = new Set(entitySpecs.flatMap(e => e.requires || []));
        const requiredInSeedZone = new Set(
          entitySpecs.filter(e => e.zone === chosenAncZoneId).flatMap(e => e.requires || [])
        );
        const ancCandidates = [...freshPool, ...fallbackPool];
        seedItem =
          ancCandidates.find(id => !alreadyRequired.has(id) && !usedInSeg.has(id)) ||
          ancCandidates.find(id => !requiredInSeedZone.has(id) && !usedInSeg.has(id)) ||
          shuffle(CHAIN_ITEMS, rng).find(id => !requiredInSeedZone.has(id));
        if (!seedItem || requiredInSeedZone.has(seedItem)) {
          return { ok: false, reason: 'NO_SAFE_SEG_SEED_SLOT' };
        }
        usedInSeg.add(seedItem);
        activeToken = seedItem;

        const seedMeta = getItemMeta(seedItem, 'Floor Item');
        entitySpecs.push({
          kind: 'preset_seg_seed',
          id: `seg_${sIdx}_cache_${entitySeq++}`,
          name: seedMeta.name,
          emoji: seedMeta.emoji,
          isPreset: seedItem,
          requires: [],
          reqType: 'AND',
          reward: seedItem,
          zone: chosenAncZoneId
        });
      }
    }

    let curMaxZone = segZones[0]?.id ?? 0;
    for (let k = 0; k < stepsInSeg; k++) {
      let tradeZone: number;
      if (k === 0) {
        const nonSeedZones = segSeedZoneId != null
          ? segZones.filter(z => z.id !== segSeedZoneId)
          : segZones;
        const k0Pool = nonSeedZones.length > 0 ? nonSeedZones : segZones;
        if (k0Pool[0] && (zoneRemainingCapacity.get(k0Pool[0].id) || 0) > 0) {
          tradeZone = k0Pool[0].id;
          consumeZoneSlot(tradeZone);
        } else {
          tradeZone = pickCapacityZone(k0Pool);
        }
      } else {
        const frac = (k + 1) / Math.max(1, stepsInSeg);
        const zIdx = Math.min(segZones.length - 1, Math.floor(frac * segZones.length));
        tradeZone = segZones[zIdx].id;

        if (backtracksUsed >= settings.maxBacktracks) {
          tradeZone = curMaxZone > tradeZone && zoneMeta.get(curMaxZone) ? curMaxZone : tradeZone;
        } else if ((zoneMeta.get(tradeZone)?.minRow ?? 0) < (zoneMeta.get(curMaxZone)?.minRow ?? 0)) {
          const rowDiff = (zoneMeta.get(curMaxZone)?.maxRow ?? 0) - (zoneMeta.get(tradeZone)?.minRow ?? 0);
          if (rowDiff > settings.maxBacktrackRows) tradeZone = curMaxZone;
          else if (rowDiff > 0) backtracksUsed++;
        }
        if ((zoneRemainingCapacity.get(tradeZone) || 0) > 0) {
          consumeZoneSlot(tradeZone);
        } else {
          tradeZone = pickCapacityZone(segZones);
        }
      }
      if ((zoneMeta.get(tradeZone)?.minRow ?? 0) >= (zoneMeta.get(curMaxZone)?.minRow ?? 0)) {
        curMaxZone = tradeZone;
      }

      const consumes = reserveToken
        ? [activeToken!, reserveToken]
        : [activeToken!];
      reserveToken = null;

      const freshCandidates = CHAIN_ITEMS.filter(id => !usedInSeg.has(id) && !consumes.includes(id));
      const reward = freshCandidates.length > 0
        ? pickOne(freshCandidates, rng)
        : pickOne(CHAIN_ITEMS.filter(id => !consumes.includes(id)), rng);

      usedInSeg.add(reward);
      activeToken = reward;

      const makeDigger = diggersAssigned < settings.numDiggers;
      if (makeDigger) diggersAssigned++;
      const tpl = makeDigger ? MOLE_TEMPLATE : pickOne(TRADER_TEMPLATES, rng);
      const idPrefix = makeDigger ? 'mole' : tpl.id;

      entitySpecs.push({
        kind: 'barter_trader',
        id: `${idPrefix}_tr_${entitySeq++}`,
        name: tpl.name,
        emoji: tpl.emoji,
        isDigger: makeDigger,
        requires: consumes,
        reqType: 'AND',
        reward,
        zone: tradeZone
      });
    }

    const barrierReqs: string[] = [];
    if (activeToken) barrierReqs.push(activeToken);
    if (sIdx === 0 && stepsInSeg === 0 && startItems[1] && !barrierReqs.includes(startItems[1])) {
      barrierReqs.push(startItems[1]);
    }
    for (const eo of segOutputs) {
      if (!barrierReqs.includes(eo)) {
        barrierReqs.push(eo);
      }
    }
    if (barrierReqs.length === 0) return null;

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
  }

  for (const tReq of toolInputs) {
    const ancestorIds = getAncestorZoneIds(tReq.fromZone);
    const strictIds = ancestorIds.filter(zId => zId !== tReq.fromZone);
    const resolveZones = (ids: readonly number[]) =>
      ids.map(zId => regularZones.find(z => z.id === zId)).filter((z): z is ZoneMeta => Boolean(z));
    const strictSameSeg = resolveZones(strictIds.filter(zId => zoneToSegIdx.get(zId) === tReq.segIdx));
    const strictAll = resolveZones(strictIds);
    const sameSegAncestors = resolveZones(ancestorIds.filter(zId => zoneToSegIdx.get(zId) === tReq.segIdx));
    const allAncestors = resolveZones(ancestorIds);
    const withSoft = (list: readonly ZoneMeta[]) => list.filter(z => (zoneRemainingCapacity.get(z.id) || 0) > 0);
    const withPhys = (list: readonly ZoneMeta[]) => list.filter(z => (zonePhysicalSlack.get(z.id) || 0) > 0);

    let chosenZone: number;
    if (withSoft(strictSameSeg).length > 0) {
      chosenZone = pickCapacityZone(withSoft(strictSameSeg));
    } else if (withSoft(strictAll).length > 0) {
      chosenZone = pickCapacityZone(withSoft(strictAll));
    } else if (withPhys(strictSameSeg).length > 0) {
      chosenZone = pickCapacityZone(withPhys(strictSameSeg));
    } else if (withPhys(strictAll).length > 0) {
      chosenZone = pickCapacityZone(withPhys(strictAll));
    } else if (withSoft(sameSegAncestors).length > 0) {
      chosenZone = pickCapacityZone(withSoft(sameSegAncestors));
    } else if (withSoft(allAncestors).length > 0) {
      chosenZone = pickCapacityZone(withSoft(allAncestors));
    } else if (withPhys(sameSegAncestors).length > 0) {
      chosenZone = pickCapacityZone(withPhys(sameSegAncestors));
    } else if (withPhys(allAncestors).length > 0) {
      chosenZone = pickCapacityZone(withPhys(allAncestors));
    } else if (allAncestors.length > 0) {
      chosenZone = pickCapacityZone(allAncestors);
    } else {
      chosenZone = pickCapacityZone([regularZones[0]]);
    }
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

  for (let s = 0; s < settings.pickaxeSurplus; s++) {
    const surplusCandidates = regularZones.filter(z => (zonePhysicalSlack.get(z.id) || 0) > 0);
    if (surplusCandidates.length === 0) break;
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
      zone: pickCapacityZone(surplusCandidates)
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

  const allNeededByChain = new Set(entitySpecs.flatMap(e => e.requires || []));
  const safeDecoyRewards = NON_MUSHROOM_TRADE_ITEMS.filter(i => !allNeededByChain.has(i));
  for (let d = 0; d < settings.decoyCount; d++) {
    const decoyCandidates = regularZones.filter(z => (zonePhysicalSlack.get(z.id) || 0) > 0);
    if (decoyCandidates.length === 0) break;
    const decoyZone = pickCapacityZone(decoyCandidates);
    const freeInDecoyZone = new Set(
      entitySpecs
        .filter(p => p.isPreset && p.zone === decoyZone && p.reward)
        .map(p => p.reward!)
    );
    const rew = decoySinkItem && !allNeededByChain.has(decoySinkItem)
      ? decoySinkItem
      : (safeDecoyRewards.length > 0 ? pickOne(safeDecoyRewards, rng) : null);
    if (!rew) continue;
    const req = pickOne(CHAIN_ITEMS.filter(i => i !== rew && !freeInDecoyZone.has(i)), rng);
    if (!req) continue;
    const makeDigger = diggersAssigned < settings.numDiggers;
    if (makeDigger) diggersAssigned++;
    const tpl = makeDigger ? MOLE_TEMPLATE : pickOne(TRADER_TEMPLATES, rng);
    const idPrefix = makeDigger ? 'mole' : tpl.id;
    entitySpecs.push({
      kind: 'decoy_trader',
      id: `${idPrefix}_decoy_${entitySeq++}`,
      name: tpl.name,
      emoji: tpl.emoji,
      isDigger: makeDigger,
      requires: [req],
      reqType: 'AND',
      reward: rew,
      zone: decoyZone
    });
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

  return {
    ok: true,
    startItems,
    entitySpecs: sanitized,
    goalEntityId,
    abstractSolution: sol
  };
}
