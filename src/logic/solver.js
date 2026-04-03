import { MAX_UNIQUE_ITEMS, SOLVER_MAX_ITERS } from '../constants.js';
import { uniqueCount } from './navigation.js';

/**
 * BFS puzzle solver. Finds the shortest path from starting inventory
 * to the goal, respecting zone gating, inventory limits, and
 * level-specific mechanics (transformation, treasure, etc.).
 *
 * @param {string[]} startItems - Starting inventory item IDs
 * @param {Object[]} puzzleEntities - All entities in the puzzle
 * @param {string} goalEntityId - ID of the goal entity
 * @param {Object} level - Level definition (uses mechanics flags + solver hooks)
 * @returns {Object|null} Solution state with path, or null if unsolvable
 */
export function solvePuzzle(startItems, puzzleEntities, goalEntityId, level) {
  const hasTransformation = level.mechanics.hasTransformation;
  const queue = [{ inv: [...startItems].sort(), def: [], path: [], steps: 0, transformed: false, hasTreasure: false }];
  const visited = new Set();
  let iters = 0;

  while (queue.length > 0) {
    iters++;
    if (iters > SOLVER_MAX_ITERS) return null;

    const curr = queue.shift();

    // Victory condition: use level hook if provided, otherwise default
    if (hasTransformation) {
      if (curr.hasTreasure && !curr.transformed && curr.def.includes('untransformed_exit')) return curr;
    } else {
      if (curr.def.includes(goalEntityId)) return curr;
    }

    const stateKey = curr.inv.join(',') + '|' + [...curr.def].sort().join(',') + '|' + curr.transformed + '|' + curr.hasTreasure;
    if (visited.has(stateKey)) continue;
    visited.add(stateKey);

    const canHoldMore = uniqueCount(curr.inv) < MAX_UNIQUE_ITEMS;

    if (level.mechanics.hasFish && !curr.def.includes(`fish_node`) && canHoldMore) {
      queue.push({ inv: [...curr.inv, 'fish'].sort(), def: [...curr.def, 'fish_node'], path: [...curr.path, { isEnvironmentAction: true, itemId: 'fish' }], steps: curr.steps });
    }

    let simUnlockedZones = new Set([1]);
    if (hasTransformation) simUnlockedZones.add(2); // Soft boundary: zones accessible but movement restricted by transformation
    
    puzzleEntities.forEach(e => {
        if (e.isGatekeeper && curr.def.includes(e.id) && e.unlocksZones) {
            e.unlocksZones.forEach(z => simUnlockedZones.add(z));
        }
    });

    let forcedMoves = [];

    for (const entity of puzzleEntities) {
      if (curr.def.includes(entity.id) && !(entity.id === 'sea_witch' && curr.transformed && curr.hasTreasure)) continue;
      
      const isReverseAccess = entity.isGatekeeper && entity.unlocksZones && entity.unlocksZones.some(z => simUnlockedZones.has(z));
      if (!simUnlockedZones.has(entity.zone) && !isReverseAccess) continue;

      // Transformation zone gating
      if (hasTransformation) {
          if (entity.zone === 2 && !curr.transformed) continue;
      }

      if (entity.isPreset && entity.reqType === 'AND' && (!entity.requires || entity.requires.length === 0)) {
         let newInv = [...curr.inv];
         if (entity.reward) newInv.push(entity.reward);
         if (uniqueCount(newInv) <= MAX_UNIQUE_ITEMS) {
            forcedMoves.push({ inv: newInv.sort(), def: [...curr.def, entity.id], path: [...curr.path, { entityId: entity.id, usedItems: [], reqType: 'AND' }], steps: curr.steps });
         }
         continue;
      }

      if (entity.reqType === 'AND') {
        let hasAll = true; let tempInv = [...curr.inv];
        for (const req of (entity.requires || [])) {
           const idx = tempInv.indexOf(req);
           if (idx > -1) tempInv.splice(idx, 1); else { hasAll = false; break; }
        }

        let isReturnTrip = false;
        if (entity.id === 'sea_witch' && curr.transformed && curr.hasTreasure) {
            isReturnTrip = true;
        }

        if (hasAll || isReturnTrip) {
          let nextInv = isReturnTrip ? [...curr.inv] : tempInv;
          let nextTransformed = curr.transformed;
          let nextHasTreasure = curr.hasTreasure;
          let nextDef = [...curr.def, entity.id];

          if (entity.id === 'sea_witch') {
              if (!curr.transformed) nextTransformed = true;
              else if (curr.hasTreasure) {
                  nextTransformed = false;
                  nextDef.push('untransformed_exit');
              } else if (!isReturnTrip) continue;
          }
          if (entity.isGoal && hasTransformation) nextHasTreasure = true;
          if (entity.reward) nextInv.push(entity.reward);
          
          if (uniqueCount(nextInv) <= MAX_UNIQUE_ITEMS) {
            queue.push({ inv: nextInv.sort(), def: nextDef, path: [...curr.path, { entityId: entity.id, usedItems: isReturnTrip ? [] : entity.requires, reqType: 'AND', isReturnTrip }], steps: curr.steps + 1, transformed: nextTransformed, hasTreasure: nextHasTreasure });
          }
        }
      } else { 
        const uniqueInv = Array.from(new Set(curr.inv));
        for (let i = 0; i < uniqueInv.length; i++) {
          const itemId = uniqueInv[i];
          if ((entity.requires || []).includes(itemId)) {
            const newInv = [...curr.inv]; 
            newInv.splice(newInv.indexOf(itemId), 1);
            let nextTransformed = curr.transformed;
            let nextHasTreasure = curr.hasTreasure;
            let nextDef = [...curr.def, entity.id];

            if (entity.id === 'sea_witch') {
                if (!curr.transformed) nextTransformed = true;
                else if (curr.hasTreasure) {
                    nextTransformed = false;
                    nextDef.push('untransformed_exit');
                } else continue;
            }
            if (entity.isGoal && hasTransformation) nextHasTreasure = true;
            if (entity.reward) newInv.push(entity.reward);
            
            if (uniqueCount(newInv) <= MAX_UNIQUE_ITEMS) {
              queue.push({ inv: newInv.sort(), def: nextDef, path: [...curr.path, { entityId: entity.id, itemId: itemId, reqType: 'OR' }], steps: curr.steps + 1, transformed: nextTransformed, hasTreasure: nextHasTreasure });
            }
          }
        }
        
        // Special case: Sea Witch un-transform is FREE in the solver too
        if (entity.id === 'sea_witch' && curr.transformed && curr.hasTreasure) {
            let nextDef = [...curr.def, entity.id, 'untransformed_exit'];
            queue.push({ inv: [...curr.inv].sort(), def: nextDef, path: [...curr.path, { entityId: entity.id, usedItems: [], reqType: 'AND', isReturnTrip: true }], steps: curr.steps + 1, transformed: false, hasTreasure: true });
        }
      }
    }
    
    if (forcedMoves.length > 0) {
        queue.unshift(...forcedMoves);
    }
  }
  return null;
}
