import { MAX_UNIQUE_ITEMS, SOLVER_TIME_LIMIT_MS, GENERATOR_MAX_ATTEMPTS } from '../constants.js';
import { solvePuzzle } from './solver.js';
import { uniqueCount } from './navigation.js';

/**
 * Generate a puzzle for a given level. If the level provides a custom
 * generator (e.g., underwater), delegate to it. Otherwise, use the
 * shared procedural generation framework.
 *
 * @param {Object} level - Level definition
 * @param {number} targetSteps - Minimum solution steps desired
 * @param {number} numDiggers - Number of "digger" (memory) entities
 * @returns {Object|null} Generated puzzle or null if generation failed
 */
export function generateLevelPuzzle(level, targetSteps, numDiggers) {
  // Delegate to custom generator if the level provides one
  if (level.generatePuzzle) return level.generatePuzzle(level);

  let bestPuzzle = null;
  let maxSteps = 0;
  const startTime = Date.now();

  for (let attempt = 0; attempt < GENERATOR_MAX_ATTEMPTS; attempt++) {
    if (Date.now() - startTime > SOLVER_TIME_LIMIT_MS) break;

    let activeGatekeepers = [];
    let presetEntities = [];

    if (level.mechanics.gatekeeperId) {
      const gkEnt = level.entities.find(e => e.id === level.mechanics.gatekeeperId);
      const gkNode = level.mapNodes.find(n => n.isGatekeeper);
      const reqs = [...gkEnt.allowedReqs].sort(() => Math.random() - 0.5).slice(0, 2);
      activeGatekeepers = [{ ...gkEnt, ...gkNode, requires: reqs, reqType: 'AND', reward: null, id: gkEnt.id }];
    } else {
      level.mapNodes.forEach((n, idx) => {
        if (n.isGatekeeper) {
          if (level.mechanics.hasPickaxe) activeGatekeepers.push({ ...n, name: 'Rock', requires: ['pickaxe'], reqType: 'AND', id: n.id || `gk_${idx}` });
          else activeGatekeepers.push({ ...n, name: 'Giant Clam', requires: ['pearl', 'shell', 'starfish'].sort(() => Math.random() - 0.5).slice(0, 1), reqType: 'AND', reward: null, id: n.id || `gk_${idx}` });
        } else if (n.isPreset === 'pickaxe') {
          presetEntities.push({ id: `preset_pick_${n.x}_${n.y}`, emoji: '⛏️', requires: [], reqType: 'AND', reward: 'pickaxe', x: n.x, y: n.y, zone: n.zone, isGatekeeper: false, isPreset: true });
        } else if (n.isPreset === 'mushroom') {
          presetEntities.push({ id: `preset_mush_${n.x}_${n.y}`, emoji: '🍄', requires: [], reqType: 'AND', reward: 'mushroom', x: n.x, y: n.y, zone: n.zone, isGatekeeper: false, isPreset: true });
        } else if (n.isPreset === 'bubble_vent') {
          presetEntities.push({ id: `preset_vent_${n.x}_${n.y}`, emoji: '🫧', requires: [], reqType: 'AND', reward: null, x: n.x, y: n.y, zone: n.zone, isGatekeeper: false, isPreset: true, isVent: true });
        } else if (n.isPreset === 'treasure') {
          presetEntities.push({ id: `preset_treas_${n.x}_${n.y}`, emoji: '💎', requires: [], reqType: 'AND', reward: null, x: n.x, y: n.y, zone: n.zone, isGatekeeper: false, isTreasure: true, isPreset: true });
        }
      });
    }

    if (level.mechanics.hasTransformation) {
        // Sea Witch is mandatory for transformation levels
        const witchEnt = level.entities.find(e => e.id === 'sea_witch');
        const witchNode = level.mapNodes.find(n => n.id === 'sea_witch');
        const reqs = ['pearl', 'locket', 'trident'].sort(() => Math.random() - 0.5).slice(0, 2);
        activeGatekeepers.push({ ...witchEnt, ...witchNode, requires: reqs, reqType: 'AND', reward: null, id: 'sea_witch' });
    }

    const availableNodes = level.mapNodes.filter(n => !n.isGatekeeper && !n.isGoal && !n.isPreset && n.id !== 'sea_witch');
    let goalTemplate = { id: 'vault_rock' }; 
    if (!level.mechanics.isVertical || !level.mechanics.hasPickaxe) {
      if (level.id === 'river_crossing') {
         const baseTroll = level.entities.find(e => e.id === 'troll');
         goalTemplate = { ...baseTroll, id: 'cave_troll_exit', name: 'Cave Boss' };
      } else {
         goalTemplate = level.entities.filter(e => e.id !== level.mechanics.gatekeeperId && e.id !== level.specialEntityTemplate).sort(() => Math.random() - 0.5)[0];
      }
      
      const goalNode = level.mapNodes.find(n => n.isGoal);
      if (goalNode) {
        const availableReqs = goalTemplate.allowedReqs.filter(req => req !== 'pickaxe');
        const numReqs = level.id === 'river_crossing' ? 2 : 1;
        const reqs = [...availableReqs].sort(() => Math.random() - 0.5).slice(0, numReqs);
        activeGatekeepers.push({ ...goalTemplate, requires: reqs, reqType: (level.mechanics.hasTransformation ? 'OR' : 'AND'), reward: null, x: goalNode.x, y: goalNode.y, zone: goalNode.zone, isGatekeeper: false, isGoal: true, id: goalTemplate.id });
      }
    }
    
    const diggerTemplate = level.entities.find(e => e.id === level.specialEntityTemplate);
    const otherTemplates = level.entities.filter(e => e.id !== level.mechanics.gatekeeperId && e.id !== level.specialEntityTemplate);
    
    let selectedOthers = Array.from({length: numDiggers}).map((_, i) => ({...diggerTemplate, id: `${level.specialEntityTemplate}_${i}`}));
    let pool = [...otherTemplates].sort(() => Math.random() - 0.5);
    while (pool.length < availableNodes.length) { pool = [...pool, ...otherTemplates].sort(() => Math.random() - 0.5); }
    selectedOthers = [...selectedOthers, ...pool].slice(0, availableNodes.length).map((e, idx) => ({...e, id: `${e.id}_${idx}`})).sort(() => Math.random() - 0.5);
    
    let puzzleEntities = [...activeGatekeepers, ...presetEntities];
    

    
    const standardItems = level.items.filter(i => i.id !== 'fish' && i.id !== 'pickaxe' && i.id !== 'key');
    const startItems = [ standardItems[Math.floor(Math.random() * standardItems.length)].id, standardItems[Math.floor(Math.random() * standardItems.length)].id, standardItems[Math.floor(Math.random() * standardItems.length)].id ];
    
    selectedOthers.forEach((e, idx) => {
      const pos = availableNodes[idx]; 
      let reward = standardItems[Math.floor(Math.random() * standardItems.length)].id;
      const availableReqs = e.allowedReqs.filter(req => req !== reward && req !== 'pickaxe' && req !== 'key');
      const numReqs = Math.random() > 0.4 && availableReqs.length >= 2 ? 2 : 1; 
      const reqs = [...availableReqs].sort(() => Math.random() - 0.5).slice(0, numReqs);
      
      // Mermaid color variation
      let color = e.color || "#2dd4bf";
      if (e.id.startsWith('mermaid')) {
          if (!e.color) {
            const colors = ["#2dd4bf", "#f43f5e", "#f59e0b", "#a855f7"];
            color = colors[Math.floor(Math.random() * colors.length)];
          }
      }

      puzzleEntities.push({ ...e, requires: reqs, reqType: 'OR', reward, x: pos.x, y: pos.y, zone: pos.zone, isGatekeeper: false, color });
    });

    const firstStepEnt = puzzleEntities.find(e => e.zone === 1 && !e.isGatekeeper && !e.isPreset);
    if (firstStepEnt) {
       firstStepEnt.requires = [startItems[0]];
       firstStepEnt.reqType = 'OR';
       if (level.mechanics.hasPickaxe) firstStepEnt.reward = 'pickaxe'; 
    }

    if (level.mechanics.isVertical && level.mechanics.hasPickaxe) {
      const nonGoalNodes = puzzleEntities.filter(e => !e.isGatekeeper && !e.isTreasure && !e.isPreset && e.reward !== 'pickaxe');
      const shuffled = [...nonGoalNodes].sort(() => Math.random() - 0.5);
      for(let i=0; i<5; i++) { if(shuffled[i]) shuffled[i].reward = 'pickaxe'; }
    } else if (level.mechanics.hasPickaxe) {
      const z1NonGoal = puzzleEntities.find(e => e.zone === 1 && !e.isGatekeeper && e.id !== goalTemplate.id && e.id !== firstStepEnt?.id);
      if (z1NonGoal) z1NonGoal.reward = 'pickaxe';
    }

    const targetGoalId = (level.mechanics.isVertical && level.mechanics.hasPickaxe) ? 'vault_rock' : goalTemplate.id;
    const currentState = solvePuzzle(startItems, puzzleEntities, targetGoalId, level);
    if (currentState) {
      const solutionPath = currentState.path;
      const solutionSteps = currentState.steps;

      // Ensure all gatekeepers from zone 1 are always included for visual symmetry in vertical levels
      if (level.mechanics.isVertical) {
          level.mapNodes.forEach(n => {
              if (n.isGatekeeper && n.zone === 1 && !puzzleEntities.find(p => p.id === n.id)) {
                  puzzleEntities.push({ ...n, name: 'Rock', requires: ['pickaxe'], reqType: 'AND', id: n.id });
              }
          });
      }

      if (solutionSteps >= targetSteps) return { startItems, puzzleEntities, goalEntityId: targetGoalId, solution: solutionPath, steps: solutionSteps };
      if (solutionSteps > maxSteps) { bestPuzzle = { startItems, puzzleEntities, goalEntityId: targetGoalId, solution: solutionPath, steps: solutionSteps }; maxSteps = solutionSteps; }
    }
  }
  return bestPuzzle;
}
