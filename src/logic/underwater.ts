import {
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

export interface OutOfAirDropResolution {
  nextInventory: string[];
  droppedFloatingItems: CampItemState[];
  discardedFishCount: number;
}

export interface UnderwaterAirSolvabilityResult {
  solvable: boolean;
  maxMovesBetweenRefills: number;
  unreachableEntities: string[];
}

export function isFishItem(itemId: string): boolean {
  return (UNDERWATER_FISH_ITEM_IDS as readonly string[]).includes(itemId);
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
 * Verifies that every Zone 1 & Zone 2 entity (including bubble vents and the
 * Sea Witch) is reachable and returnable to a refill source (surface or reusable
 * bubble vent) even under the worst-case full-backpack air penalty (2 air/move).
 */
export function verifyUnderwaterAirSolvability(
  level: Pick<LevelDefinition, 'campPos' | 'mechanics'>,
  puzzle: Pick<PuzzleData, 'puzzleEntities'> | null | undefined
): UnderwaterAirSolvabilityResult {
  const maxMovesBetweenRefills = Math.floor(MAX_AIR / UNDERWATER_AIR_COST_FULL_BAG);
  if (!puzzle || !Array.isArray(puzzle.puzzleEntities)) {
    return { solvable: false, maxMovesBetweenRefills, unreachableEntities: [] };
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
    isRefill: boolean;
    zone: number;
    isEntity: boolean;
  }

  const nodes: NavNode[] = [
    {
      id: 'surface_camp',
      x: level.campPos?.x ?? 50,
      y: level.campPos?.y ?? 14,
      isRefill: true,
      zone: 1,
      isEntity: false
    }
  ];

  // Include open-water vertical swim stepping stones every ~12% Y so multi-move swims work
  for (let y = 26; y <= 66; y += 12) {
    nodes.push({
      id: `swim_wp_${y}`,
      x: 50,
      y,
      isRefill: y <= 20,
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
      isRefill: Boolean(ent.isVent) || ent.y <= 20,
      zone: ent.zone || 1,
      isEntity: !ent.isVent
    });
  }

  const canSingleMove = (from: NavNode, to: NavNode): boolean => {
    const [minY, maxY] = visibleYRangeFrom(from.y);
    return to.y >= minY - 0.5 && to.y <= maxY + 0.5;
  };

  const shortestMoves = (startIdx: number, targetPredicate: (n: NavNode) => boolean): number => {
    const dist = new Array<number>(nodes.length).fill(Infinity);
    dist[startIdx] = 0;
    const queue = [startIdx];
    while (queue.length > 0) {
      const u = queue.shift()!;
      if (u !== startIdx && targetPredicate(nodes[u])) {
        return dist[u];
      }
      if (dist[u] >= maxMovesBetweenRefills) continue;
      for (let v = 0; v < nodes.length; v++) {
        if (u === v || dist[v] !== Infinity) continue;
        if (canSingleMove(nodes[u], nodes[v])) {
          dist[v] = dist[u] + 1;
          queue.push(v);
        }
      }
    }
    return Infinity;
  };

  // BFS across refill nodes (surface + vents) within maxMovesBetweenRefills per hop
  const reachableRefills = new Set<number>([0]);
  const refillQueue = [0];
  while (refillQueue.length > 0) {
    const u = refillQueue.shift()!;
    const dist = new Array<number>(nodes.length).fill(Infinity);
    dist[u] = 0;
    const q = [u];
    while (q.length > 0) {
      const curr = q.shift()!;
      if (curr !== u && nodes[curr].isRefill && !reachableRefills.has(curr)) {
        reachableRefills.add(curr);
        refillQueue.push(curr);
      }
      if (dist[curr] >= maxMovesBetweenRefills) continue;
      for (let v = 0; v < nodes.length; v++) {
        if (curr === v || dist[v] !== Infinity) continue;
        if (canSingleMove(nodes[curr], nodes[v])) {
          dist[v] = dist[curr] + 1;
          q.push(v);
        }
      }
    }
  }

  // Verify each Zone 1 & Zone 2 entity can be reached from a reachable refill AND returned to a refill within budget
  const unreachableEntities: string[] = [];
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if (!node.isEntity) continue;

    let roundTripPossible = false;
    const minReturnMoves = shortestMoves(i, (n) => n.isRefill);
    if (minReturnMoves < maxMovesBetweenRefills) {
      for (const rIdx of reachableRefills) {
        // Compute moves from rIdx -> i
        const dist = new Array<number>(nodes.length).fill(Infinity);
        dist[rIdx] = 0;
        const q = [rIdx];
        while (q.length > 0) {
          const curr = q.shift()!;
          if (curr === i) break;
          if (dist[curr] >= maxMovesBetweenRefills) continue;
          for (let v = 0; v < nodes.length; v++) {
            if (curr === v || dist[v] !== Infinity) continue;
            if (canSingleMove(nodes[curr], nodes[v])) {
              dist[v] = dist[curr] + 1;
              q.push(v);
            }
          }
        }
        if (dist[i] + minReturnMoves <= maxMovesBetweenRefills) {
          roundTripPossible = true;
          break;
        }
      }
    }

    if (!roundTripPossible) {
      unreachableEntities.push(node.id);
    }
  }

  return {
    solvable: unreachableEntities.length === 0,
    maxMovesBetweenRefills,
    unreachableEntities
  };
}
