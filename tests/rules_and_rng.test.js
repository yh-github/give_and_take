import { describe, it, expect } from 'vitest';
import { createRNG, shuffle, createShuffleBag } from '../src/logic/rng.js';
import { canFitInInventory, evaluateEntityTrade, computeUnlockedZones, isValidEntityTrade, sanitizePuzzleEntities } from '../src/logic/rules.js';
import { generateLevelPuzzle } from '../src/logic/generator.js';
import { importStateFromString } from '../src/logic/saveState.js';
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

  it('evaluates AND, OR, and explicit tool trades consistently', () => {
    // Rock requires explicit pickaxe selection in UI (null allows solver auto-match)
    const rock = { id: 'rock_1', requires: ['pickaxe'], reqType: 'AND', reward: null };
    expect(evaluateEntityTrade(['pickaxe', 'apple'], rock, []).canDefeat).toBe(false);
    const rockEval = evaluateEntityTrade(['pickaxe', 'apple'], rock, ['pickaxe']);
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

  it('validates that an entity must never require the item it guards or rewards', () => {
    // Presets (e.g. pickaxe on ground) and gatekeepers (e.g. rock requiring pickaxe) are valid
    expect(isValidEntityTrade({ id: 'preset_pick', reward: 'pickaxe', requires: [] })).toBe(true);
    expect(isValidEntityTrade({ id: 'rock_1', reward: null, requires: ['pickaxe'] })).toBe(true);

    // Standard valid trade: requires rope, rewards gem
    expect(isValidEntityTrade({ id: 'trader_1', reward: 'gem', requires: ['rope'] })).toBe(true);

    // Invalid trade: ghost/scorpion requiring mushroom to give mushroom
    expect(isValidEntityTrade({ id: 'ghost_1', reward: 'mushroom', requires: ['mushroom'] })).toBe(false);
    expect(isValidEntityTrade({ id: 'trader_bad', reward: 'gold_nugget', requires: ['bone', 'gold_nugget'] })).toBe(false);
  });

  it('sanitizes entities so conflicting requirements are replaced with valid alternatives', () => {
    const rawEntities = [
      { id: 'ghost_1', name: 'Ghost', reward: 'mushroom', requires: ['mushroom'], allowedReqs: ['bone', 'crystal'] },
      { id: 'scorpion_5', name: 'Scorpion', reward: 'mushroom', requires: ['mushroom'], allowedReqs: [] },
      { id: 'normal_miner', name: 'Miner', reward: 'gem', requires: ['bone'], allowedReqs: ['bone'] }
    ];
    const levelItems = [{ id: 'emerald' }, { id: 'relic' }, { id: 'bone' }, { id: 'mushroom' }];

    const sanitized = sanitizePuzzleEntities(rawEntities, levelItems);

    // ghost_1 replacement should come from allowedReqs ('bone')
    expect(sanitized[0].requires).toEqual(['bone']);
    expect(sanitized[0].reward).toBe('mushroom');
    expect(isValidEntityTrade(sanitized[0])).toBe(true);

    // scorpion_5 has empty allowedReqs so fallback should come from levelItems (not mushroom)
    expect(sanitized[1].requires[0]).not.toBe('mushroom');
    expect(sanitized[1].reward).toBe('mushroom');
    expect(isValidEntityTrade(sanitized[1])).toBe(true);

    // normal_miner was already valid and should remain untouched
    expect(sanitized[2].requires).toEqual(['bone']);
    expect(sanitized[2].reward).toBe('gem');
  });
});

describe('Deterministic Level Generation & Underwater Fixes', () => {
  it('produces identical puzzles when given the same seed and varied puzzles for different seeds across all 4 procedural levels', () => {
    for (const levelId of ['river_crossing', 'underground', 'underwater', 'shipwreck']) {
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

  it('spawns circling mermaids, return-tribute sea witch, sunken_vault goal, and zero vents in Underwater level', () => {
    const underwater = LEVEL_REGISTRY.underwater;
    const puzzle = generateLevelPuzzle(underwater, 5, 1, 'underwater-seed');

    const vents = puzzle.puzzleEntities.filter(e => e.isVent === true);
    expect(vents.length).toBe(0);
    const mermaids = puzzle.puzzleEntities.filter(e => e.id.startsWith('mermaid_'));
    expect(mermaids.length).toBe(3);
    mermaids.forEach(m => {
      expect(m.reward).toBe('mermaid_voice');
      expect(m.orbit).toBeDefined();
    });
    const witch = puzzle.puzzleEntities.find(e => e.id === 'sea_witch');
    expect(witch.requires).toEqual(['mermaid_voice', 'mermaid_voice', 'mermaid_voice']);
    expect(witch.returnRequires.length).toBe(1);
    expect(puzzle.goalEntityId).toBe('sunken_vault');
    expect(puzzle.solution.length).toBeGreaterThan(0);
    expect(puzzle.solution.some(step => step.entityId === 'sea_witch' && !step.isReturnTrip)).toBe(true);
    expect(puzzle.solution.some(step => step.entityId === 'sea_witch' && step.isReturnTrip)).toBe(true);
    expect(puzzle.solution.some(step => step.entityId === 'sunken_vault')).toBe(true);
  });

  it('strictly enforces across all levels and seeds that no entity ever asks for the item it guards/rewards', () => {
    // Test across all registered levels and varied seeds
    for (const levelId of ['river_crossing', 'underground', 'underwater', 'shipwreck']) {
      const level = LEVEL_REGISTRY[levelId];
      for (let s = 1; s <= 15; s++) {
        const seed = `invariant-test-${levelId}-${s}`;
        const puzzle = generateLevelPuzzle(level, 5, 1, seed);

        expect(puzzle).toBeDefined();
        expect(puzzle.puzzleEntities.length).toBeGreaterThan(0);

        puzzle.puzzleEntities.forEach(ent => {
          // Rule: An entity must never ask for what it guards/rewards
          if (ent.reward && Array.isArray(ent.requires) && ent.requires.length > 0) {
            expect(ent.requires.includes(ent.reward)).toBe(false);
          }
          expect(isValidEntityTrade(ent)).toBe(true);

          // Underground specific: traders must not reward mushrooms (which grow freely as floor presets)
          if (levelId === 'underground' && !ent.isPreset && !ent.isGatekeeper && ent.reward) {
            expect(ent.reward).not.toBe('mushroom');
          }
        });
      }
    }
  });

  it('repairs/sanitizes old save states on import that had entities requiring their reward', () => {
    // Simulate user-uploaded save file with ghost_1 requiring mushroom for mushroom
    const rawLegacySave = JSON.stringify({
      version: 1,
      savedAt: new Date().toISOString(),
      levelId: 'underground',
      targetSteps: 5,
      numDiggers: 1,
      puzzle: {
        puzzleEntities: [
          {
            id: 'ghost_1',
            name: 'Miner Ghost',
            emoji: '👻',
            allowedReqs: ['gold_nugget', 'bone', 'emerald', 'rope', 'crystal'],
            requires: ['mushroom'],
            reqType: 'OR',
            reward: 'mushroom',
            x: 66,
            y: 56,
            zone: 5,
            isGatekeeper: false
          }
        ],
        goalEntityId: 'vault_rock',
        startItems: ['rope', 'bone', 'gem'],
        solution: []
      },
      inventory: ['rope', 'relic', 'crystal', 'mushroom'],
      pathHistory: [{ x: 50, y: 10 }]
    });

    const result = importStateFromString(rawLegacySave, LEVEL_REGISTRY);
    expect(result.success).toBe(true);
    const sanitizedGhost = result.state.puzzle.puzzleEntities.find(e => e.id === 'ghost_1');
    expect(sanitizedGhost).toBeDefined();
    // ghost_1 must no longer require mushroom!
    expect(sanitizedGhost.requires.includes('mushroom')).toBe(false);
    expect(isValidEntityTrade(sanitizedGhost)).toBe(true);
  });
});
