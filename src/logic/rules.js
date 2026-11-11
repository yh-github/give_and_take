import { MAX_UNIQUE_ITEMS } from '../constants.js';
import { uniqueCount } from './navigation.js';

/**
 * Computes resulting inventory after consuming `consumedItems` and adding `rewardItem`,
 * and checks whether it respects the maximum unique item slot constraint.
 *
 * @param {string[]} inventory
 * @param {string[]} [consumedItems=[]]
 * @param {string|null} [rewardItem=null]
 * @param {number} [maxUnique=MAX_UNIQUE_ITEMS]
 * @returns {{ fits: boolean, nextInventory: string[] }}
 */
export function canFitInInventory(inventory, consumedItems = [], rewardItem = null, maxUnique = MAX_UNIQUE_ITEMS) {
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
 *
 * @param {string[]} inventory - Current player inventory
 * @param {Object} entity - Target puzzle entity
 * @param {string[]|null} selectedItemTypes - Selected item types in UI (or null for automatic check)
 * @param {Object} [state={}] - Extra level state ({ levelId, isTransformed, hasDeepTreasure })
 * @returns {{ canDefeat: boolean, itemsToConsume: string[], nextInventory: string[], exceedsCapacity: boolean, isFreeUnTransform: boolean }}
 */
export function evaluateEntityTrade(inventory, entity, selectedItemTypes = null, state = {}) {
  const isFreeUnTransform = Boolean(
    state.levelId === 'underwater' &&
    entity.id === 'sea_witch' &&
    state.isTransformed &&
    state.hasDeepTreasure
  );

  if (isFreeUnTransform) {
    const { fits, nextInventory } = canFitInInventory(inventory, [], entity.reward);
    return {
      canDefeat: fits,
      itemsToConsume: [],
      nextInventory,
      exceedsCapacity: !fits,
      isFreeUnTransform: true
    };
  }

  const requires = entity.requires || [];
  const availableItems = [...inventory];
  let matched = false;
  let itemsToConsume = [];

  const takeAllRequired = (reqArray) => {
    const tempAvail = [...availableItems];
    const consumed = [];
    for (const req of reqArray) {
      const idx = tempAvail.indexOf(req);
      if (idx > -1) {
        tempAvail.splice(idx, 1);
        consumed.push(req);
      } else {
        return null;
      }
    }
    return consumed;
  };

  if (entity.reqType === 'AND') {
    const isAutoPickaxeRock =
      Boolean(entity.id && entity.id.startsWith('rock_')) &&
      requires.length === 1 &&
      requires[0] === 'pickaxe';
    const selectionMatches =
      selectedItemTypes === null ||
      requires.length === 0 ||
      isAutoPickaxeRock ||
      Array.from(new Set(requires)).every(t => selectedItemTypes.includes(t));

    if (selectionMatches) {
      const consumed = takeAllRequired(requires);
      if (consumed) {
        matched = true;
        itemsToConsume = consumed;
      }
    }
  } else {
    // OR requirement: prefer an item explicitly selected by the user
    for (const req of requires) {
      const isSelected = selectedItemTypes === null || selectedItemTypes.includes(req);
      if (isSelected && availableItems.includes(req)) {
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

  const { fits, nextInventory } = canFitInInventory(inventory, itemsToConsume, entity.reward);
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
 *
 * @param {Object} entity
 * @returns {boolean} True if valid
 */
export function isValidEntityTrade(entity) {
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
 *
 * @param {Array<Object>} entities - Level entities to sanitize
 * @param {Array<Object|string>} [levelItems=[]] - Available items in the level
 * @returns {Array<Object>} Sanitized entities
 */
export function sanitizePuzzleEntities(entities, levelItems = []) {
  if (!Array.isArray(entities)) return entities;

  const standardItemIds = (levelItems || [])
    .map(i => (typeof i === 'string' ? i : i?.id))
    .filter(id => id && id !== 'pickaxe' && id !== 'key');

  return entities.map(entity => {
    if (!entity || !entity.reward || !Array.isArray(entity.requires) || entity.requires.length === 0) {
      return entity;
    }

    if (!entity.requires.includes(entity.reward)) {
      return entity;
    }

    // Violation found: entity asks for the item it guards / rewards!
    const filteredReqs = entity.requires.filter(req => req !== entity.reward);
    if (filteredReqs.length > 0) {
      return {
        ...entity,
        requires: filteredReqs
      };
    }

    // Requires became empty: select a valid replacement requirement
    const allowed = (entity.allowedReqs || []).filter(
      r => r !== entity.reward && r !== 'pickaxe' && r !== 'key'
    );
    const fallbacks = standardItemIds.filter(
      id => id !== entity.reward && id !== 'pickaxe' && id !== 'key'
    );

    const replacement = allowed.length > 0
      ? allowed[0]
      : (fallbacks.length > 0 ? fallbacks[0] : (entity.reward === 'bone' ? 'rope' : 'bone'));

    return {
      ...entity,
      requires: [replacement]
    };
  });
}

/**
 * Returns updated list of unlocked zones after defeating `entity`.
 *
 * @param {number[]} unlockedZones
 * @param {Object} entity
 * @returns {number[]}
 */
export function computeUnlockedZones(unlockedZones, entity) {
  if (!entity) return unlockedZones;
  const newZones = Array.isArray(entity.unlocksZones)
    ? entity.unlocksZones
    : (entity.unlocksZone !== undefined ? [entity.unlocksZone] : []);
  if (!entity.isGatekeeper && newZones.length === 0) return unlockedZones;
  const combined = [...unlockedZones, ...newZones];
  if (entity.zone !== undefined) combined.push(entity.zone);
  return Array.from(new Set(combined));
}
