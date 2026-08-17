import { describe, it, expect } from 'vitest';
import { solvePuzzle } from '../src/logic/solver.js';

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
});
