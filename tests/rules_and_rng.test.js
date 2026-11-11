import { describe, it, expect } from 'vitest';
import { createRNG, shuffle, createShuffleBag } from '../src/logic/rng.js';
import { canFitInInventory, evaluateEntityTrade, computeUnlockedZones } from '../src/logic/rules.js';
import { generateLevelPuzzle } from '../src/logic/generator.js';
import LEVEL_REGISTRY from '../src/levels/index.js';

describe('RNG & Shuffle Bag Unit Suite', () => {
  it('generates identical deterministic sequences for identical seeds', () => {
    const rngA = createRNG('seed-alpha-42');
    const rngB = createRNG('seed-alpha-42');
    const rngC = createRNG('seed-beta-99');

    const seqA = Array.from({ length: 10 }, () => rngA());
    const seqB = Array.from({ length: 10 }, () => rngB());
    const seqC = Array.from({ length: 10 }, () => rngC());

    expect(seqA).toEqual(seqB);
    expect(seqA).not.toEqual(seqC);
    seqA.forEach(v => {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    });
  });

  it('shuffles arrays deterministically without mutating the input array', () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8];
    const copy = [...input];
    const out1 = shuffle(input, createRNG(12345));
    const out2 = shuffle(input, createRNG(12345));

    expect(input).toEqual(copy);
    expect(out1).toEqual(out2);
    expect(out1.slice().sort()).toEqual(input);
  });

  it('cycles through all items in a shuffle bag without drought before refilling', () => {
    const items = ['rope', 'torch', 'key'];
    const bag = createShuffleBag(items, createRNG(777));

    const firstCycle = [bag.next(), bag.next(), bag.next()];
    const secondCycle = [bag.next(), bag.next(), bag.next()];

    expect(firstCycle.slice().sort()).toEqual(['key', 'rope', 'torch']);
    expect(secondCycle.slice().sort()).toEqual(['key', 'rope', 'torch']);
  });
});

describe('Domain Rules (Single Source of Truth) Suite', () => {
  it('validates 4-unique-slot inventory capacity rules accurately', () => {
    const inv = ['apple', 'bread', 'coin', 'key'];

    // Adding a 5th unique item without freeing a slot is blocked
    expect(canFitInInventory(inv, [], 'sword').fits).toBe(false);

    // Stacking an already-held item is allowed even at 4 unique slots
    expect(canFitInInventory(inv, [], 'apple').fits).toBe(true);

    // Consuming a unique item frees a slot for a new unique reward
    expect(canFitInInventory(inv, ['apple'], 'sword').fits).toBe(true);

    // Consuming only 1 of 2 duplicate items does NOT free a unique slot
    const invWithDup = ['apple', 'apple', 'bread', 'coin', 'key'];
    expect(canFitInInventory(invWithDup, ['apple'], 'sword').fits).toBe(false);
  });

  it('evaluates AND, OR, preset, and rock auto-pickaxe trades consistently', () => {
    // Rock auto-pickaxe without manual selection
    const rock = { id: 'rock_1', requires: ['pickaxe'], reqType: 'AND', reward: null };
    const rockEval = evaluateEntityTrade(['pickaxe', 'apple'], rock, []);
    expect(rockEval.canDefeat).toBe(true);
    expect(rockEval.itemsToConsume).toEqual(['pickaxe']);

    // OR trade with explicit selection
    const wizard = { id: 'wizard', requires: ['wand', 'gem'], reqType: 'OR', reward: 'potion' };
    const orEval = evaluateEntityTrade(['gem', 'apple'], wizard, ['gem']);
    expect(orEval.canDefeat).toBe(true);
    expect(orEval.itemsToConsume).toEqual(['gem']);
    expect(orEval.nextInventory).toEqual(['apple', 'potion']);

    // OR trade fails if wrong item is selected
    const wrongOrEval = evaluateEntityTrade(['gem', 'apple'], wizard, ['apple']);
    expect(wrongOrEval.canDefeat).toBe(false);

    // AND trade requires all items selected
    const vault = { id: 'vault', requires: ['key1', 'key2'], reqType: 'AND', reward: 'gold' };
    expect(evaluateEntityTrade(['key1', 'key2'], vault, ['key1']).canDefeat).toBe(false);
    const andEval = evaluateEntityTrade(['key1', 'key2'], vault, ['key1', 'key2']);
    expect(andEval.canDefeat).toBe(true);
    expect(andEval.nextInventory).toEqual(['gold']);
  });

  it('computes unlocked zones from both unlocksZones arrays and legacy unlocksZone properties', () => {
    expect(computeUnlockedZones([1], { unlocksZones: [2, 3] })).toEqual([1, 2, 3]);
    expect(computeUnlockedZones([1, 2], { unlocksZone: 4 })).toEqual([1, 2, 4]);
  });
});

describe('Deterministic Level Generation & Underwater Fixes', () => {
  it('produces identical puzzles when given the same seed and varied puzzles for different seeds across all 3 levels', () => {
    for (const levelId of ['river_crossing', 'underground', 'underwater']) {
      const level = LEVEL_REGISTRY[levelId];
      const p1 = generateLevelPuzzle(level, 5, 1, 'fixed-seed-2026');
      const p2 = generateLevelPuzzle(level, 5, 1, 'fixed-seed-2026');
      const pDiff = generateLevelPuzzle(level, 5, 1, 'different-seed-9999');

      expect(p1.goalEntityId).toBe(p2.goalEntityId);
      expect(p1.startItems).toEqual(p2.startItems);
      expect(p1.solution).toEqual(p2.solution);

      // Different seeds should produce different starting items or solution steps
      const isDifferent =
        JSON.stringify(p1.startItems) !== JSON.stringify(pDiff.startItems) ||
        JSON.stringify(p1.solution) !== JSON.stringify(pDiff.solution);
      expect(isDifferent).toBe(true);
    }
  });

  it('scales quest chain length with targetSteps (3, 5, 8) and respects numDiggers (0..3) across all 3 levels', () => {
    for (const levelId of ['river_crossing', 'underground', 'underwater']) {
      const level = LEVEL_REGISTRY[levelId];
      const easy = generateLevelPuzzle(level, 3, 0, 'scale-seed');
      const medium = generateLevelPuzzle(level, 5, 2, 'scale-seed');
      const hard = generateLevelPuzzle(level, 8, 3, 'scale-seed');

      expect(easy.steps).toBeGreaterThanOrEqual(3);
      expect(medium.steps).toBeGreaterThanOrEqual(5);
      expect(hard.steps).toBeGreaterThanOrEqual(7);
      expect(hard.steps).toBeGreaterThan(easy.steps);

      // Verify digger counts match numDiggers setting (0, 2, 3)
      const countDiggers = (p) =>
        p.puzzleEntities.filter(
          e => level.specialEntityTemplate && e.id?.startsWith(level.specialEntityTemplate) && !e.isGoal
        ).length;

      expect(countDiggers(easy)).toBe(0);
      expect(countDiggers(medium)).toBe(2);
      expect(countDiggers(hard)).toBe(3);
    }
  });

  it('spawns bubble_vent presets and a valid solution path in Underwater level', () => {
    const underwater = LEVEL_REGISTRY.underwater;
    const puzzle = generateLevelPuzzle(underwater, 5, 1, 'underwater-seed');

    const vents = puzzle.puzzleEntities.filter(e => e.isVent === true);
    expect(vents.length).toBeGreaterThanOrEqual(2);
    expect(puzzle.solution.length).toBeGreaterThan(0);
    expect(puzzle.solution.some(step => step.entityId === 'sea_witch')).toBe(true);
    expect(puzzle.solution.some(step => step.entityId === 'clam_3')).toBe(true);
  });
});
