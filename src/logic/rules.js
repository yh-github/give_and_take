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
    const isAutoToolGatekeeper =
      requires.length === 1 &&
      (
        (Boolean(entity.id && entity.id.startsWith('rock_')) && requires[0] === 'pickaxe') ||
        (Boolean(entity.isGatekeeper) && (requires[0] === 'pickaxe' || requires[0] === 'rope') && entity.gateType !== 'guardian')
      );
    const selectionMatches =
      selectedItemTypes === null ||
      requires.length === 0 ||
      isAutoToolGatekeeper ||
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

/**
 * Validates that entities in the level maintain sufficient clearance:
 * 1. Minimum distance between distinct entities in the same zone.
 * 2. Minimum clearance from cave walls (if caveWallVertices provided).
 *
 * @param {Array<Object>} entities
 * @param {Object} [options]
 * @param {number} [options.minEntityDistance=8]
 * @param {Object|null} [options.caveWallVertices=null]
 * @param {number} [options.minWallMargin=4.5]
 * @returns {{ isValid: boolean, violations: Array<Object> }}
 */
export function validateEntitySpacing(entities, options = {}) {
  const {
    minEntityDistance = 8,
    caveWallVertices = null,
    wallPolylines = null,
    minWallMargin = 4.5,
    checkAllPairs = false
  } = options;
  const violations = [];

  if (!Array.isArray(entities)) return { isValid: true, violations: [] };

  // 1. Check pairwise entity distance within the same zone (or all pairs when checkAllPairs=true)
  for (let i = 0; i < entities.length; i++) {
    for (let j = i + 1; j < entities.length; j++) {
      const a = entities[i];
      const b = entities[j];
      if (!checkAllPairs && a.zone !== b.zone) continue;
      if (a.isGatekeeper || b.isGatekeeper) continue;
      if (a.isTreasure && b.isTreasure) continue; // Treasure line in goal room

      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (dist < minEntityDistance) {
        violations.push({
          type: 'ENTITY_DISTANCE',
          entityA: a.id || `${a.x}_${a.y}`,
          entityB: b.id || `${b.x}_${b.y}`,
          zone: a.zone,
          distance: dist,
          required: minEntityDistance
        });
      }
    }
  }

  // 2. Check wall clearance if cave vertices or extracted wallPolylines are provided
  if (caveWallVertices || (Array.isArray(wallPolylines) && wallPolylines.length > 0)) {
    const distToSegment = (p, p1, p2) => {
      const dx = p2.x - p1.x, dy = p2.y - p1.y;
      const len2 = dx * dx + dy * dy;
      if (len2 === 0) return Math.hypot(p.x - p1.x, p.y - p1.y);
      let t = ((p.x - p1.x) * dx + (p.y - p1.y) * dy) / len2;
      t = Math.max(0, Math.min(1, t));
      return Math.hypot(p.x - (aX(p1, t, dx)), p.y - (aY(p1, t, dy)));
    };
    function aX(p1, t, dx) { return p1.x + t * dx; }
    function aY(p1, t, dy) { return p1.y + t * dy; }

    const minDistToPoly = (p, poly, closed = false) => {
      if (!poly || poly.length < 2) return Infinity;
      let minD = Infinity;
      for (let i = 0; i < poly.length - 1; i++) {
        minD = Math.min(minD, distToSegment(p, poly[i], poly[i + 1]));
      }
      if (closed && poly.length > 2) {
        minD = Math.min(minD, distToSegment(p, poly[poly.length - 1], poly[0]));
      }
      return minD;
    };

    const polyEntries = [];
    if (caveWallVertices) {
      if (caveWallVertices.leftWall) polyEntries.push({ pts: caveWallVertices.leftWall, closed: false });
      if (caveWallVertices.rightWall) polyEntries.push({ pts: caveWallVertices.rightWall, closed: false });
      if (caveWallVertices.centralPillar) polyEntries.push({ pts: caveWallVertices.centralPillar, closed: true });
    }
    if (Array.isArray(wallPolylines)) {
      for (const wp of wallPolylines) {
        const pts = Array.isArray(wp) ? wp : wp?.points;
        const closed = Array.isArray(wp) ? true : (wp?.closed !== false);
        if (pts && pts.length >= 2) polyEntries.push({ pts, closed });
      }
    }

    entities.forEach(ent => {
      if (ent.isGatekeeper) return; // Gatekeeper rocks/chasms intentionally span wall-to-wall
      for (const entry of polyEntries) {
        const d = minDistToPoly(ent, entry.pts, entry.closed);
        if (d < minWallMargin) {
          violations.push({
            type: 'WALL_CLEARANCE',
            entityId: ent.id || `${ent.x}_${ent.y}`,
            zone: ent.zone,
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
