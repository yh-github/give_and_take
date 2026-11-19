import { MAX_UNIQUE_ITEMS, RESERVED_TOOL_ITEMS } from '../constants.ts';
import { minDistToPolyline, normalizeWallPolyline } from './geometry.ts';
import { uniqueCount } from './navigation.ts';
import type {
  AbstractPuzzleEntity,
  InventoryFitResult,
  ItemDefinition,
  Point2D,
  PuzzleEntity,
  SpacingValidationOptions,
  SpacingValidationResult,
  SpacingViolation,
  TradeEvaluationResult,
  TradeEvaluationState
} from '../types/index.ts';

export { uniqueCount };

/**
 * Checks whether all items in `reqArray` exist in `availableItems` (with multiplicity)
 * and returns the consumed and remaining item lists, or `null` if any item is missing.
 */
export function consumeRequiredItems(
  availableItems: readonly string[],
  reqArray: readonly string[]
): { consumed: string[]; remaining: string[] } | null {
  const remaining = [...availableItems];
  const consumed: string[] = [];
  for (const req of reqArray) {
    const idx = remaining.indexOf(req);
    if (idx > -1) {
      remaining.splice(idx, 1);
      consumed.push(req);
    } else {
      return null;
    }
  }
  return { consumed, remaining };
}

/**
 * Extracts standard tradable item IDs from level items, excluding reserved tools
 * (`pickaxe`, `key`) and any caller-specified `extraExcluded` IDs.
 */
export function getStandardItemIds(
  levelItems: ReadonlyArray<ItemDefinition | string> = [],
  extraExcluded: readonly string[] = []
): string[] {
  const excluded = new Set<string>([...RESERVED_TOOL_ITEMS, ...extraExcluded]);
  return (levelItems || [])
    .map(i => (typeof i === 'string' ? i : i?.id))
    .filter((id): id is string => Boolean(id) && !excluded.has(id));
}

/**
 * Selects a valid requirement item ID that never matches `reward` and is not a reserved tool.
 */
export function pickValidReplacementReq(
  reward: string | null | undefined,
  allowedReqs: readonly string[] = [],
  candidateIds: readonly string[] = [],
  index = 0
): string {
  const reserved = new Set<string>(RESERVED_TOOL_ITEMS);
  const allowed = allowedReqs.filter(r => r !== reward && !reserved.has(r));
  if (allowed.length > 0) {
    return allowed[index % allowed.length];
  }
  const fallbacks = candidateIds.filter(id => id !== reward && !reserved.has(id));
  if (fallbacks.length > 0) {
    return fallbacks[index % fallbacks.length];
  }
  return reward === 'bone' ? 'rope' : 'bone';
}

/**
 * Computes resulting inventory after consuming `consumedItems` and adding `rewardItem`,
 * and checks whether it respects the maximum unique item slot constraint.
 */
export function canFitInInventory(
  inventory: readonly string[],
  consumedItems: readonly string[] = [],
  rewardItem: string | null = null,
  maxUnique = MAX_UNIQUE_ITEMS
): InventoryFitResult {
  const nextInventory = [...inventory];
  for (const item of consumedItems) {
    const idx = nextInventory.indexOf(item);
    if (idx > -1) nextInventory.splice(idx, 1);
  }
  if (rewardItem) {
    nextInventory.push(rewardItem);
  }
  return {
    fits: uniqueCount(nextInventory) <= maxUnique,
    nextInventory
  };
}

/**
 * Evaluates whether the player's inventory and selected items satisfy an entity's trade requirements.
 */
export function evaluateEntityTrade(
  inventory: readonly string[],
  entity: Pick<PuzzleEntity, 'id' | 'requires' | 'reqType' | 'reward'>,
  selectedItemTypes: readonly string[] | null = null,
  state: TradeEvaluationState = {}
): TradeEvaluationResult {
  const isFreeUnTransform = Boolean(
    state.levelId === 'underwater' &&
    entity.id === 'sea_witch' &&
    state.isTransformed &&
    state.hasDeepTreasure
  );

  if (isFreeUnTransform) {
    const { fits, nextInventory } = canFitInInventory(inventory, [], entity.reward ?? null);
    return {
      canDefeat: fits,
      itemsToConsume: [],
      nextInventory,
      exceedsCapacity: !fits,
      isFreeUnTransform: true
    };
  }

  const requires = entity.requires || [];
  let matched = false;
  let itemsToConsume: string[] = [];

  if (entity.reqType === 'AND') {
    const selectionMatches =
      selectedItemTypes === null ||
      requires.length === 0 ||
      Array.from(new Set(requires)).every(t => selectedItemTypes.includes(t));

    if (selectionMatches) {
      const result = consumeRequiredItems(inventory, requires);
      if (result) {
        matched = true;
        itemsToConsume = result.consumed;
      }
    }
  } else {
    // OR requirement: prefer an item explicitly selected by the user
    for (const req of requires) {
      const isSelected = selectedItemTypes === null || selectedItemTypes.includes(req);
      if (isSelected && inventory.includes(req)) {
        matched = true;
        itemsToConsume = [req];
        break;
      }
    }
  }

  if (!matched) {
    return {
      canDefeat: false,
      itemsToConsume: [],
      nextInventory: [...inventory],
      exceedsCapacity: false,
      isFreeUnTransform: false
    };
  }

  const { fits, nextInventory } = canFitInInventory(inventory, itemsToConsume, entity.reward ?? null);
  return {
    canDefeat: Boolean(fits),
    itemsToConsume,
    nextInventory,
    exceedsCapacity: !fits,
    isFreeUnTransform: false
  };
}

/**
 * Checks whether an entity adheres to universal domain trading rules:
 * An entity must NEVER ask for the item it is guarding / offering as a reward.
 */
export function isValidEntityTrade(
  entity: Pick<PuzzleEntity, 'reward' | 'requires'> | null | undefined
): boolean {
  if (!entity) return true;
  if (!entity.reward) return true;
  if (!Array.isArray(entity.requires) || entity.requires.length === 0) return true;
  return !entity.requires.includes(entity.reward);
}

/**
 * Universal Level Builder Sanitizer:
 * Enforces across all current and future levels that no entity asks for the item it guards / rewards.
 * If a violation is found, it replaces the conflicting requirement with a valid alternative
 * from the entity's allowed requirements or available items in the level.
 */
export function sanitizePuzzleEntities<T extends AbstractPuzzleEntity>(
  entities: T[],
  levelItems: ReadonlyArray<ItemDefinition | string> = []
): T[] {
  if (!Array.isArray(entities)) return entities;

  const standardItemIds = getStandardItemIds(levelItems);

  return entities.map(entity => {
    if (!entity) return entity;

    let patchedEntity: T = entity;
    if (!entity.isGoal && (!entity.emoji || !entity.name)) {
      const itemKey = typeof entity.isPreset === 'string' ? entity.isPreset : entity.reward;
      const matchedItem = itemKey
        ? (levelItems || []).find((i): i is ItemDefinition => typeof i === 'object' && i !== null && i.id === itemKey)
        : null;
      if (matchedItem) {
        patchedEntity = {
          ...entity,
          emoji: entity.emoji || matchedItem.emoji,
          name: entity.name || matchedItem.name
        };
      }
    }

    if (!patchedEntity.reward || !Array.isArray(patchedEntity.requires) || patchedEntity.requires.length === 0) {
      return patchedEntity;
    }

    if (!patchedEntity.requires.includes(patchedEntity.reward)) {
      return patchedEntity;
    }

    // Violation found: entity asks for the item it guards / rewards!
    const filteredReqs = patchedEntity.requires.filter(req => req !== patchedEntity.reward);
    if (filteredReqs.length > 0) {
      return {
        ...patchedEntity,
        requires: filteredReqs
      };
    }

    const replacement = pickValidReplacementReq(
      patchedEntity.reward,
      patchedEntity.allowedReqs || [],
      standardItemIds
    );

    return {
      ...patchedEntity,
      requires: [replacement]
    };
  });
}

/**
 * Returns updated list of unlocked zones after defeating `entity`.
 */
export function computeUnlockedZones(
  unlockedZones: readonly number[],
  entity: Pick<PuzzleEntity, 'unlocksZones' | 'unlocksZone' | 'isGatekeeper' | 'zone'> | null | undefined
): number[] {
  if (!entity) return [...unlockedZones];
  const newZones = Array.isArray(entity.unlocksZones)
    ? entity.unlocksZones
    : (entity.unlocksZone !== undefined ? [entity.unlocksZone] : []);
  if (!entity.isGatekeeper && newZones.length === 0) return [...unlockedZones];
  const combined = [...unlockedZones, ...newZones];
  if (entity.zone !== undefined) combined.push(entity.zone);
  return Array.from(new Set(combined));
}

/**
 * Validates that entities in the level maintain sufficient clearance:
 * 1. Minimum distance between distinct entities in the same zone.
 * 2. Minimum clearance from cave walls (if caveWallVertices or wallPolylines provided).
 */
export function validateEntitySpacing(
  entities: ReadonlyArray<Partial<PuzzleEntity> & Point2D> | null | undefined,
  options: SpacingValidationOptions = {}
): SpacingValidationResult {
  const {
    minEntityDistance = 8,
    caveWallVertices = null,
    wallPolylines = null,
    minWallMargin = 4.5,
    checkAllPairs = false
  } = options;
  const violations: SpacingViolation[] = [];

  if (!Array.isArray(entities)) return { isValid: true, violations: [] };

  // 1. Check pairwise entity distance within the same zone (or all pairs when checkAllPairs=true)
  for (let i = 0; i < entities.length; i++) {
    for (let j = i + 1; j < entities.length; j++) {
      const a = entities[i];
      const b = entities[j];
      if (!checkAllPairs && a.zone !== b.zone) continue;
      if (a.isGatekeeper || b.isGatekeeper) continue;
      if (a.isTreasure && b.isTreasure) continue;

      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (dist < minEntityDistance) {
        violations.push({
          type: 'ENTITY_DISTANCE',
          entityA: a.id || `${a.x}_${a.y}`,
          entityB: b.id || `${b.x}_${b.y}`,
          zone: a.zone ?? 0,
          distance: dist,
          required: minEntityDistance
        });
      }
    }
  }

  // 2. Check wall clearance if cave vertices or extracted wallPolylines are provided
  if (caveWallVertices || (Array.isArray(wallPolylines) && wallPolylines.length > 0)) {
    const polyEntries: Array<{ pts: readonly Point2D[]; closed: boolean }> = [];
    if (caveWallVertices) {
      if (caveWallVertices.leftWall) polyEntries.push({ pts: caveWallVertices.leftWall, closed: false });
      if (caveWallVertices.rightWall) polyEntries.push({ pts: caveWallVertices.rightWall, closed: false });
      if (caveWallVertices.centralPillar) polyEntries.push({ pts: caveWallVertices.centralPillar, closed: true });
    }
    if (Array.isArray(wallPolylines)) {
      for (const wp of wallPolylines) {
        const normalized = normalizeWallPolyline(wp);
        if (normalized) {
          polyEntries.push({ pts: normalized.points, closed: normalized.closed });
        }
      }
    }

    entities.forEach(ent => {
      if (ent.isGatekeeper) return;
      for (const entry of polyEntries) {
        const d = minDistToPolyline(ent, entry.pts, entry.closed);
        if (d < minWallMargin) {
          violations.push({
            type: 'WALL_CLEARANCE',
            entityId: ent.id || `${ent.x}_${ent.y}`,
            zone: ent.zone ?? 0,
            distance: d,
            required: minWallMargin
          });
          break;
        }
      }
    });
  }

  return {
    isValid: violations.length === 0,
    violations
  };
}
