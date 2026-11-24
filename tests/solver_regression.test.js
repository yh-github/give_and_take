import { describe, it, expect } from 'vitest';
import { assessPuzzleDifficulty, solvePuzzle } from '../src/logic/solver.js';

describe('Solver Comprehensive Regression Suite', () => {
  const dummyLevel = {
    mechanics: { hasTransformation: false }
  };

  it('solves simple 1-step direct requirement', () => {
    const startItems = ['apple'];
    const entities = [
      { id: 'troll', requires: ['apple'], reqType: 'AND', reward: 'key', zone: 1, isGatekeeper: false }
    ];
    const solution = solvePuzzle(startItems, entities, 'troll', dummyLevel);
    expect(solution).not.toBeNull();
    expect(solution.path).toHaveLength(1);
    expect(solution.path[0].entityId).toBe('troll');
    expect(solution.path[0].usedItems).toEqual(['apple']);
  });

  it('solves multi-step chain with intermediate rewards', () => {
    const startItems = ['apple'];
    const entities = [
      { id: 'baker', requires: ['apple'], reqType: 'AND', reward: 'bread', zone: 1, isGatekeeper: false },
      { id: 'knight', requires: ['bread'], reqType: 'AND', reward: 'shield', zone: 1, isGatekeeper: false },
      { id: 'dragon', requires: ['shield'], reqType: 'AND', reward: 'treasure', zone: 1, isGatekeeper: false }
    ];
    const solution = solvePuzzle(startItems, entities, 'dragon', dummyLevel);
    expect(solution).not.toBeNull();
    expect(solution.path).toHaveLength(3);
    expect(solution.path.map(p => p.entityId)).toEqual(['baker', 'knight', 'dragon']);
  });

  it('handles OR requirements properly', () => {
    const startItems = ['gem'];
    const entities = [
      { id: 'wizard', requires: ['wand', 'gem'], reqType: 'OR', reward: 'potion', zone: 1, isGatekeeper: false }
    ];
    const solution = solvePuzzle(startItems, entities, 'wizard', dummyLevel);
    expect(solution).not.toBeNull();
    expect(solution.path).toHaveLength(1);
    expect(solution.path[0].itemId).toBe('gem');
  });

  it('handles AND requirements with multiple required items', () => {
    const startItems = ['key1', 'key2'];
    const entities = [
      { id: 'vault', requires: ['key1', 'key2'], reqType: 'AND', reward: 'gold', zone: 1, isGatekeeper: false }
    ];
    const solution = solvePuzzle(startItems, entities, 'vault', dummyLevel);
    expect(solution).not.toBeNull();
    expect(solution.path).toHaveLength(1);
    expect(solution.path[0].usedItems).toEqual(expect.arrayContaining(['key1', 'key2']));
  });

  it('respects zone locking by gatekeepers', () => {
    const startItems = ['apple'];
    const entities = [
      { id: 'gate', requires: ['apple'], reqType: 'AND', reward: null, zone: 1, unlocksZones: [2], isGatekeeper: true },
      { id: 'miner', requires: ['bread'], reqType: 'AND', reward: 'gold', zone: 2, isGatekeeper: false }
    ];
    // Cannot reach zone 2 without unlocking gatekeeper first
    const solutionNoGate = solvePuzzle(['bread'], entities, 'miner', dummyLevel);
    expect(solutionNoGate).toBeNull();

    // With apple + bread, can unlock gate then trade with miner
    const solutionWithBoth = solvePuzzle(['apple', 'bread'], entities, 'miner', dummyLevel);
    expect(solutionWithBoth).not.toBeNull();
    expect(solutionWithBoth.path).toHaveLength(2);
    expect(solutionWithBoth.path[0].entityId).toBe('gate');
    expect(solutionWithBoth.path[1].entityId).toBe('miner');
  });

  it('respects inventory limit of 4 unique items', () => {
    // Start with 4 items; trading for a new 5th unique item without consuming is disallowed
    const startItems = ['item1', 'item2', 'item3', 'item4'];
    const entities = [
      { id: 'freebie', requires: [], reqType: 'AND', reward: 'item5', zone: 1, isGatekeeper: false }
    ];
    const solution = solvePuzzle(startItems, entities, 'freebie', dummyLevel);
    // Cannot collect item5 because inventory is full (4 items) and none consumed
    expect(solution).toBeNull();
  });

  it('solves transformation puzzle in underwater realm', () => {
    const levelWithTransform = {
      mechanics: { hasTransformation: true }
    };
    const startItems = ['fish', 'gold'];
    const entities = [
      { id: 'sea_witch', requires: ['fish'], reqType: 'AND', reward: null, zone: 1, isGatekeeper: false },
      { id: 'deep_clam', requires: ['gold'], reqType: 'AND', reward: null, zone: 2, isGoal: true, isGatekeeper: false }
    ];

    const solution = solvePuzzle(startItems, entities, 'deep_clam', levelWithTransform);
    expect(solution).not.toBeNull();
    expect(solution.path.map(p => p.entityId)).toContain('sea_witch');
    expect(solution.path.map(p => p.entityId)).toContain('deep_clam');
  });

  it('returns null for impossible cycles or missing requirements', () => {
    const startItems = ['rock'];
    const entities = [
      { id: 'e1', requires: ['sword'], reqType: 'AND', reward: 'shield', zone: 1, isGatekeeper: false },
      { id: 'e2', requires: ['shield'], reqType: 'AND', reward: 'sword', zone: 1, isGatekeeper: false }
    ];
    const solution = solvePuzzle(startItems, entities, 'e2', dummyLevel);
    expect(solution).toBeNull();
  });

  it('does not prune valid solutions when a non-pickaxe preset would prematurely fill the 4th inventory slot', () => {
    // Player starts with 3 items: a, b, c.
    // Zone 1 has a mushroom preset (reward: 'mushroom') AND an entity e1 that requires ['a'] and rewards ['d', 'e'] via chain,
    // or e1 requires ['a'] -> rewards 'd', e2 requires ['b'] -> rewards 'e', goal requires ['d', 'e', 'mushroom'].
    // Specifically: if mushroom is forced first, inventory becomes [a, b, c, mushroom] (4 unique items).
    // Now suppose entity 'miner' requires [] (free pickup or trade that needs an empty slot) -> rewards 'key',
    // and goal requires ['a', 'b', 'c', 'key']!
    // If mushroom is forced into slot 4, 'miner' cannot give 'key' because inventory has 4 unique items [a, b, c, mushroom].
    // Delaying or skipping mushroom allows picking up 'key' and solving 'goal'.
    const startItems = ['a', 'b', 'c'];
    const entities = [
      { id: 'preset_mush', isPreset: 'mushroom', requires: [], reqType: 'AND', reward: 'mushroom', zone: 1, isGatekeeper: false },
      { id: 'free_key', requires: [], reqType: 'AND', reward: 'key', zone: 1, isGatekeeper: false },
      { id: 'vault', requires: ['a', 'b', 'c', 'key'], reqType: 'AND', reward: 'treasure', zone: 1, isGatekeeper: false }
    ];
    const solution = solvePuzzle(startItems, entities, 'vault', dummyLevel);
    expect(solution).not.toBeNull();
    expect(solution.path.map(p => p.entityId)).toContain('vault');
  });

  it('ignores non-reward presets like bubble vents and preserves transformation state across preset pickups', () => {
    const levelWithTransform = {
      mechanics: { hasTransformation: true }
    };
    const startItems = ['fish'];
    const entities = [
      { id: 'vent_1', isPreset: 'bubble_vent', requires: [], reqType: 'AND', reward: null, zone: 1, isGatekeeper: false },
      { id: 'sea_witch', requires: ['fish'], reqType: 'AND', reward: null, zone: 1, isGatekeeper: false },
      { id: 'preset_pick', isPreset: 'pickaxe', requires: [], reqType: 'AND', reward: 'pickaxe', zone: 2, isGatekeeper: false },
      { id: 'deep_clam', requires: ['pickaxe'], reqType: 'AND', reward: null, zone: 2, isGoal: true, isGatekeeper: false }
    ];
    const solution = solvePuzzle(startItems, entities, 'deep_clam', levelWithTransform);
    expect(solution).not.toBeNull();
    expect(solution.path.map(p => p.entityId)).not.toContain('vent_1');
    expect(solution.path.map(p => p.entityId)).toEqual(['sea_witch', 'preset_pick', 'deep_clam', 'sea_witch']);
  });

  it('integrates O(1) roaming boat trade (fish -> boatOfferedItem) in underwater level', () => {
    const underwaterLevel = {
      mechanics: {
        hasTransformation: true,
        hasSchoolsOfFish: true
      }
    };
    const startItems = ['comb', 'shell'];
    const entities = [
      { id: 'sea_witch', requires: ['comb', 'shell'], reqType: 'AND', reward: null, zone: 2, isGatekeeper: false },
      { id: 'clam_3', requires: ['locket'], reqType: 'OR', reward: 'crown', zone: 3, isGoal: true, isGatekeeper: false }
    ];
    // Without boatOfferedItem, locket is unobtainable
    expect(solvePuzzle(startItems, entities, 'clam_3', underwaterLevel)).toBeNull();

    // With boatOfferedItem: 'locket', solver uses roaming_boat to trade fish -> locket
    const solution = solvePuzzle(startItems, entities, 'clam_3', underwaterLevel, { boatOfferedItem: 'locket' });
    expect(solution).not.toBeNull();
    const boatStep = solution.path.find(p => p.isBoatTrade);
    expect(boatStep).toBeDefined();
    expect(boatStep.isEnvironmentAction).toBe(true);
    expect(boatStep.itemId).toBe('locket');
  });

  it('requires Sea Witch returnRequires tribute before untransforming after vault victory', () => {
    const underwaterLevel = {
      mechanics: {
        hasTransformation: true,
        hasSchoolsOfFish: true
      }
    };
    const entitiesWithoutTributeSource = [
      { id: 'mermaid_1', requires: ['comb'], reqType: 'OR', reward: 'mermaid_voice', zone: 1 },
      { id: 'mermaid_2', requires: ['boot'], reqType: 'OR', reward: 'mermaid_voice', zone: 2 },
      { id: 'mermaid_3', requires: ['mirror'], reqType: 'OR', reward: 'mermaid_voice', zone: 2 },
      {
        id: 'sea_witch',
        requires: ['mermaid_voice', 'mermaid_voice', 'mermaid_voice'],
        returnRequires: ['abyssal_pearl'],
        reqType: 'AND',
        reward: null,
        zone: 2
      },
      { id: 'sunken_vault', requires: ['starfish'], reqType: 'AND', reward: 'crown', zone: 3, isGoal: true }
    ];

    // Impossible without source for 'abyssal_pearl'
    expect(
      solvePuzzle(['starfish'], entitiesWithoutTributeSource, 'sunken_vault', underwaterLevel, {
        boatOfferedItems: ['comb', 'boot', 'mirror']
      })
    ).toBeNull();

    const fullEntities = [
      ...entitiesWithoutTributeSource,
      { id: 'preset_kelp_0', isPreset: 'kelp', requires: [], reqType: 'AND', reward: 'sea_kelp', zone: 3 },
      { id: 'clam_0', requires: ['sea_kelp'], reqType: 'OR', reward: 'abyssal_pearl', zone: 3 }
    ];

    const sol = solvePuzzle(['starfish'], fullEntities, 'sunken_vault', underwaterLevel, {
      boatOfferedItems: ['comb', 'boot', 'mirror'],
      boatTradeMap: { comb: 'fish', boot: 'fish', mirror: 'gold_fish' }
    });
    expect(sol).not.toBeNull();
    const returnStep = sol.path.find(p => p.entityId === 'sea_witch' && p.isReturnTrip);
    expect(returnStep).toBeDefined();
    expect(returnStep.usedItems).toEqual(['abyssal_pearl']);
    const mirrorTrade = sol.path.find(p => p.isBoatTrade && p.itemId === 'mirror');
    expect(mirrorTrade.reqItem).toBe('gold_fish');
  });

  it('unlocks gatekeeper source zone on reverse access across loops (matching computeUnlockedZones)', () => {
    // Zone 1 has an open connection to Zone 3; Zone 2 is behind a gate between Zone 2 <-> Zone 3.
    // Approaching from Zone 3 (reverse access) unlocks Zone 2!
    const entities = [
      { id: 'bridge_to_3', requires: ['rope'], reqType: 'AND', reward: null, zone: 1, unlocksZones: [3], isGatekeeper: true },
      { id: 'reverse_gate', requires: ['pickaxe'], reqType: 'AND', reward: null, zone: 2, unlocksZones: [3], isGatekeeper: true },
      { id: 'goal_in_2', requires: ['gem'], reqType: 'AND', reward: null, zone: 2, isGoal: true }
    ];
    const sol = solvePuzzle(['rope', 'pickaxe', 'gem'], entities, 'goal_in_2', dummyLevel);
    expect(sol).not.toBeNull();
    expect(sol.path.map(p => p.entityId)).toEqual(['bridge_to_3', 'reverse_gate', 'goal_in_2']);
  });

  it('assessPuzzleDifficulty scores linear forward chains lower than trap/backtrack/multi-req puzzles', () => {
    const linearEntities = [
      { id: 't1', requires: ['a'], reqType: 'AND', reward: 'b', zone: 1, x: 50, y: 20 },
      { id: 't2', requires: ['b'], reqType: 'AND', reward: 'c', zone: 1, x: 50, y: 50 },
      { id: 'gate', requires: ['c'], reqType: 'AND', reward: null, zone: 1, unlocksZones: [2], isGatekeeper: true, gateType: 'guardian', x: 50, y: 80 },
      { id: 'goal', requires: [], reqType: 'AND', reward: null, zone: 2, isPreset: 'treasure', isGoal: true, x: 50, y: 120 }
    ];
    const linearReport = assessPuzzleDifficulty(['a'], linearEntities, 'goal', dummyLevel, { campPos: { x: 50, y: 10 } });
    expect(linearReport.solvable).toBe(true);
    expect(linearReport.greedySolvable).toBe(true);
    expect(linearReport.fatalTrapCount).toBe(0);
    expect(linearReport.multiReqGateCount).toBe(0);

    // Non-linear puzzle: Zone 1 has a fatal decoy stealing 'a' AND a shallow trader requiring 'd' obtained deep in Zone 2,
    // plus a 2-item Cave Troll requiring ['c', 'e'].
    const richEntities = [
      { id: 'trap_decoy', requires: ['a'], reqType: 'AND', reward: 'junk', zone: 1, x: 40, y: 20 },
      { id: 'deep_fetch', requires: ['a'], reqType: 'AND', reward: 'd', zone: 1, x: 50, y: 110 },
      { id: 'backtrack_hub', requires: ['d'], reqType: 'AND', reward: 'e', zone: 1, x: 50, y: 25 },
      { id: 'troll', requires: ['b', 'e'], reqType: 'AND', reward: null, zone: 1, unlocksZones: [2], isGatekeeper: true, gateType: 'guardian', x: 50, y: 130 },
      { id: 'goal', requires: [], reqType: 'AND', reward: null, zone: 2, isPreset: 'treasure', isGoal: true, x: 50, y: 170 }
    ];
    const richReport = assessPuzzleDifficulty(['a', 'b'], richEntities, 'goal', dummyLevel, { campPos: { x: 50, y: 10 } });
    expect(richReport.solvable).toBe(true);
    expect(richReport.greedySolvable).toBe(false);
    expect(richReport.greedyTrapCount).toBeGreaterThanOrEqual(1);
    expect(richReport.fatalTrapCount).toBeGreaterThanOrEqual(1);
    expect(richReport.backtrackCount).toBeGreaterThanOrEqual(1);
    expect(richReport.multiReqGateCount).toBe(1);
    expect(richReport.score).toBeGreaterThan(linearReport.score + 30);
  });
});
