import {
  FISHING_CATCH_CONFIG,
  MAX_AIR,
  MAX_UNIQUE_ITEMS,
  UNDERWATER_AIR_COST_FULL_BAG,
  UNDERWATER_AIR_COST_NORMAL,
  UNDERWATER_FISH_ITEM_IDS,
  UNDERWATER_FULL_BAG_SPEED_MULTIPLIER
} from '../constants.ts';
import type {
  CampItemState,
  LevelDefinition,
  Point2D,
  PuzzleData
} from '../types/index.ts';
import { uniqueCount } from './navigation.ts';

export type UnderwaterFishTier = 'fish' | 'gold_fish' | 'blowfish';

export const HUMAN_TRINKET_BOAT_TIERS: Record<string, UnderwaterFishTier> = {
  comb: 'fish',
  boot: 'fish',
  mirror: 'gold_fish',
  locket: 'gold_fish',
  pocket_watch: 'blowfish',
  music_box: 'blowfish'
};

export const HUMAN_TRINKET_IDS: readonly string[] = Object.keys(HUMAN_TRINKET_BOAT_TIERS);

export interface OutOfAirDropResolution {
  nextInventory: string[];
  droppedFloatingItems: CampItemState[];
  discardedFishCount: number;
}

export interface FishingCatchResult {
  caught: boolean;
  quality: 'perfect' | 'good' | 'miss';
}

export interface UnderwaterAirSolvabilityResult {
  solvable: boolean;
  maxMovesBetweenRefills: number;
  unreachableEntities: string[];
}

export function isFishItem(itemId: string): boolean {
  return (UNDERWATER_FISH_ITEM_IDS as readonly string[]).includes(itemId);
}

export function isHumanTrinket(itemId: string): boolean {
  return HUMAN_TRINKET_IDS.includes(itemId);
}

export function getBoatReqFishForTrinket(itemId: string): UnderwaterFishTier {
  return HUMAN_TRINKET_BOAT_TIERS[itemId] || 'fish';
}

export function isUnderwaterBackpackFull(inventory: readonly string[]): boolean {
  return uniqueCount(inventory) >= MAX_UNIQUE_ITEMS;
}

export function getUnderwaterAirCost(inventory: readonly string[]): number {
  return isUnderwaterBackpackFull(inventory)
    ? UNDERWATER_AIR_COST_FULL_BAG
    : UNDERWATER_AIR_COST_NORMAL;
}

export function getUnderwaterMoveDurationMs(baseDurationMs: number, isHeavy: boolean): number {
  return isHeavy
    ? Math.round(baseDurationMs * UNDERWATER_FULL_BAG_SPEED_MULTIPLIER)
    : baseDurationMs;
}

/**
 * Evaluates a tap during the 1-tap timing-ring fishing mini-game.
 * Progress `0.5` is the center of the golden target ring.
 */
export function evaluateFishingCatch(progress: number, fishType: string): FishingCatchResult {
  const cfg =
    FISHING_CATCH_CONFIG[fishType as keyof typeof FISHING_CATCH_CONFIG] ||
    FISHING_CATCH_CONFIG.fish;
  const delta = Math.abs(progress - 0.5);
  if (delta <= cfg.tolerance * 0.45) {
    return { caught: true, quality: 'perfect' };
  }
  if (delta <= cfg.tolerance) {
    return { caught: true, quality: 'good' };
  }
  return { caught: false, quality: 'miss' };
}

const clamp = (val: number, min: number, max: number): number => Math.max(min, Math.min(max, val));

/**
 * Resolves which item stays in the hero's backpack and which items are dumped
 * when running out of air underwater:
 * - If holding 0 or 1 item, nothing is dropped.
 * - If holding 2+ items, the chosen item stays in inventory, dropped fish swim away
 *   (removed from game), and remaining non-fish items float where they were dropped.
 */
export function resolveOutOfAirDrop(
  inventory: readonly string[],
  keepItemId: string | null,
  dropPos: Point2D,
  uidBase = Date.now()
): OutOfAirDropResolution {
  if (inventory.length <= 1) {
    return {
      nextInventory: [...inventory],
      droppedFloatingItems: [],
      discardedFishCount: 0
    };
  }

  let keepIndex = keepItemId ? inventory.indexOf(keepItemId) : -1;
  if (keepIndex < 0) keepIndex = 0;

  const keptItem = inventory[keepIndex];
  const nonFishDropped: string[] = [];
  let discardedFishCount = 0;

  inventory.forEach((itemId, idx) => {
    if (idx === keepIndex) return;
    if (isFishItem(itemId)) {
      discardedFishCount += 1;
    } else {
      nonFishDropped.push(itemId);
    }
  });

  const baseX = clamp(dropPos?.x ?? 50, 14, 86);
  const baseY = clamp(dropPos?.y ?? 35, 22, 68);
  const count = nonFishDropped.length;

  const droppedFloatingItems: CampItemState[] = nonFishDropped.map((itemId, idx) => {
    const spreadX = (idx - (count - 1) / 2) * 8;
    const staggerY = count > 1 ? (idx % 2 === 0 ? -2 : 2) : 0;
    return {
      uid: uidBase + idx + 1,
      id: itemId,
      x: Number(clamp(baseX + spreadX, 14, 86).toFixed(2)),
      y: Number(clamp(baseY + staggerY, 22, 68).toFixed(2)),
      isFloating: true
    };
  });

  return {
    nextInventory: [keptItem],
    droppedFloatingItems,
    discardedFishCount
  };
}

/**
 * Verifies that every Zone 1 & Zone 2 entity (without air vents) is reachable
 * from the surface even under the 2-air full-bag move budget (<= 4 moves one-way)
 * and round-trip capable on a normal 8-air tank, and enforces Underwater's
 * strict item-provenance invariants.
 */
export function verifyUnderwaterAirSolvability(
  level: Pick<LevelDefinition, 'campPos' | 'mechanics'>,
  puzzle: Pick<PuzzleData, 'puzzleEntities'> | null | undefined
): UnderwaterAirSolvabilityResult {
  const maxMovesBetweenRefills = Math.floor(MAX_AIR / UNDERWATER_AIR_COST_FULL_BAG);
  if (!puzzle || !Array.isArray(puzzle.puzzleEntities)) {
    return { solvable: false, maxMovesBetweenRefills, unreachableEntities: [] };
  }

  // Provenance & layout checks: no vents, no fish rewards, no human trinkets in Zone 3
  for (const ent of puzzle.puzzleEntities) {
    if (ent.isVent || ent.isPreset === 'bubble_vent') {
      return { solvable: false, maxMovesBetweenRefills, unreachableEntities: [ent.id] };
    }
    if (ent.reward && (isFishItem(ent.reward) || isHumanTrinket(ent.reward))) {
      return { solvable: false, maxMovesBetweenRefills, unreachableEntities: [ent.id] };
    }
    if ((ent.zone || 1) >= 3) {
      const badReq = (ent.requires || []).some((r) => isFishItem(r) || isHumanTrinket(r));
      if (badReq) {
        return { solvable: false, maxMovesBetweenRefills, unreachableEntities: [ent.id] };
      }
    }
    if (ent.id.startsWith('mermaid')) {
      const badMermaidReq = (ent.requires || []).some((r) => !isHumanTrinket(r));
      if (badMermaidReq) {
        return { solvable: false, maxMovesBetweenRefills, unreachableEntities: [ent.id] };
      }
    }
  }

  const screens = level.mechanics.screens || 3.5;
  const viewportSpanY = 100 / screens;
  const maxScrollY = Math.max(0, 100 - viewportSpanY);

  const visibleYRangeFrom = (y: number): [number, number] => {
    const top = clamp(y - viewportSpanY / 2, 0, maxScrollY);
    return [top, top + viewportSpanY];
  };

  interface NavNode {
    id: string;
    x: number;
    y: number;
    isSurface: boolean;
    zone: number;
    isEntity: boolean;
  }

  const nodes: NavNode[] = [
    {
      id: 'surface_camp',
      x: level.campPos?.x ?? 50,
      y: level.campPos?.y ?? 14,
      isSurface: true,
      zone: 1,
      isEntity: false
    }
  ];

  // Open-water vertical swim stepping stones across Zones 1 & 2
  for (let y = 20; y <= 64; y += 6) {
    nodes.push({
      id: `swim_wp_${y}`,
      x: 50,
      y,
      isSurface: y <= 20,
      zone: y < 46 ? 1 : 2,
      isEntity: false
    });
  }

  for (const ent of puzzle.puzzleEntities) {
    if ((ent.zone || 1) > 2) continue; // Zone 3 is traversed while transformed (infinite air)
    nodes.push({
      id: ent.id,
      x: ent.x,
      y: ent.y,
      isSurface: ent.y <= 20,
      zone: ent.zone || 1,
      isEntity: true
    });
  }

  const canSingleMove = (from: NavNode, to: NavNode): boolean => {
    const [minY, maxY] = visibleYRangeFrom(from.y);
    return to.y >= minY - 0.5 && to.y <= maxY + 0.5;
  };

  const shortestDistFrom = (startIdx: number): number[] => {
    const dist = new Array<number>(nodes.length).fill(Infinity);
    dist[startIdx] = 0;
    const queue = [startIdx];
    while (queue.length > 0) {
      const u = queue.shift()!;
      for (let v = 0; v < nodes.length; v++) {
        if (u === v || dist[v] !== Infinity) continue;
        if (canSingleMove(nodes[u], nodes[v])) {
          dist[v] = dist[u] + 1;
          queue.push(v);
        }
      }
    }
    return dist;
  };

  const distFromSurface = shortestDistFrom(0);
  const unreachableEntities: string[] = [];

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if (!node.isEntity) continue;

    const minOut = distFromSurface[i];
    const distFromNode = shortestDistFrom(i);
    const minBack = Math.min(...nodes.map((n, idx) => (n.isSurface ? distFromNode[idx] : Infinity)));

    const reachableOnFullBagOneWay = minOut <= maxMovesBetweenRefills;
    const roundTripOnNormalAir = minOut + minBack <= MAX_AIR;
    if (!reachableOnFullBagOneWay || !roundTripOnNormalAir) {
      unreachableEntities.push(node.id);
    }
  }

  return {
    solvable: unreachableEntities.length === 0,
    maxMovesBetweenRefills,
    unreachableEntities
  };
}
