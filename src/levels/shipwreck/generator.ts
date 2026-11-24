import { GENERATOR_MAX_ATTEMPTS, SOLVER_TIME_LIMIT_MS } from '../../constants.ts';
import { createRNG, shuffle } from '../../logic/rng.ts';
import type { SeedInput } from '../../logic/rng.ts';
import { sanitizePuzzleEntities } from '../../logic/rules.ts';
import { solvePuzzle } from '../../logic/solver.ts';
import type {
  EntityTemplate,
  LevelDefinition,
  PresetType,
  PuzzleData,
  PuzzleEntity,
  PuzzleEntityArray
} from '../../types/index.ts';

const PRESET_ITEM_MAP: Record<string, { id: string; emoji: string; name: string }> = {
  kelp: { id: 'sea_kelp', emoji: '🌿', name: 'Glowing Kelp' },
  starfish: { id: 'starfish', emoji: '⭐', name: 'Starfish' },
  doubloon: { id: 'doubloon', emoji: '🪙', name: 'Gold Doubloon' },
  spyglass: { id: 'spyglass', emoji: '🔭', name: 'Brass Spyglass' }
};

/** Genuine treasures the Sea Witch values (never random sea clutter like conch shells). */
const WITCH_TREASURE_POOL = [
  'pearl',
  'chalice',
  'trident',
  'abyssal_pearl',
  'gem',
  'compass'
] as const;

/** Intermediate/barter items used inside flooded wreck & clam trade chains. */
const BARTER_RELIC_POOL = [
  'shell',
  'pearl',
  'chalice',
  'trident',
  'abyssal_pearl',
  'gem'
] as const;

const DECOY_INPUT_POOL = ['sea_kelp', 'starfish', 'doubloon', 'spyglass', 'shell'] as const;

/**
 * Procedural Puzzle Generator for Ship Wreck (`shipwreck`):
 * - Hero starts on the seabed transformed as a Merman (`startsTransformed: true`).
 * - Flooded wreck decks & reef house free salvage presets, Giant Clams (click-to-close), Crabs, and Octopuses.
 * - Merman gathers 2–3 treasures for the Sea Witch on the seabed to become Human (`16` air),
 *   plus the key/gear needed to unlock the Captain's Treasure Chest inside the dry bow Air Pocket.
 * - Higher `targetSteps` and `numDiggers` add deeper multi-hop chains, a 2-item chest lock, and extra
 *   misdirection Giant Clams & sea creatures that are not required for the solution.
 */
export function generateShipwreckPuzzle(
  level: LevelDefinition,
  targetSteps = 5,
  numDiggers = 1,
  seed: SeedInput = null
): PuzzleData | null {
  const rng = createRNG(seed);
  const startTime = Date.now();

  const witchTpl = level.entities.find((e) => e.id === 'sea_witch');
  const clamTpl = level.entities.find((e) => e.id === 'clam') || { id: 'clam', name: 'Giant Clam', emoji: '🐚' };
  const crabTpl = level.entities.find((e) => e.id === 'crab') || { id: 'crab', name: 'Hermit Crab', emoji: '🦀' };
  const octopusTpl = level.entities.find((e) => e.id === 'octopus') || { id: 'octopus', name: 'Octopus', emoji: '🐙' };
  const chestTpl = level.entities.find((e) => e.id === 'captains_chest') || {
    id: 'captains_chest',
    name: "Captain's Treasure",
    emoji: '🧰'
  };

  const witchNode = level.mapNodes.find((n) => n.id === 'sea_witch') || { x: 11, y: 69, zone: 1 };
  const presetNodes = level.mapNodes.filter((n) => Boolean(n.isPreset));
  const clamNodes = level.mapNodes.filter((n) => Boolean(n.isClamNode));
  const creatureNodes = level.mapNodes.filter(
    (n) => !n.isPreset && !n.isClamNode && !n.isGoalNode && !n.isGatekeeper && n.id !== 'sea_witch'
  );
  const goalNode = level.mapNodes.find((n) => n.isGoalNode) || { x: 81, y: 23, zone: 5, requiresHuman: true };

  const difficultySteps = Math.max(3, Number(targetSteps) || 5);
  const misdirectionLevel = Math.max(0, Math.min(3, Number.isFinite(Number(numDiggers)) ? Number(numDiggers) : 1));
  const useTwoLockChest = difficultySteps >= 7 || misdirectionLevel >= 2;

  for (let attempt = 0; attempt < GENERATOR_MAX_ATTEMPTS; attempt++) {
    if (Date.now() - startTime > SOLVER_TIME_LIMIT_MS) break;

    const puzzleEntities: PuzzleEntityArray = [];
    const startItems: string[] = [];

    // 1. Free salvage presets inside seabed & flooded holds
    presetNodes.forEach((node, idx) => {
      const presetKey = typeof node.isPreset === 'string' ? node.isPreset : 'kelp';
      const itemMeta = PRESET_ITEM_MAP[presetKey] || PRESET_ITEM_MAP.kelp;
      puzzleEntities.push({
        id: `preset_${presetKey}_${idx}`,
        name: itemMeta.name,
        emoji: itemMeta.emoji,
        requires: [],
        reqType: 'AND',
        reward: itemMeta.id,
        x: node.x,
        y: node.y,
        zone: node.zone,
        isPreset: presetKey as PresetType,
        isGatekeeper: false
      });
    });

    // 2. Build candidate Giant Clams & Crab/Octopus traders
    const shuffledClamNodes = shuffle(clamNodes, rng);
    const shuffledCreatureNodes = shuffle(creatureNodes, rng);
    const creatureRoster: EntityTemplate[] = shuffle([crabTpl, octopusTpl, crabTpl, octopusTpl], rng);

    const clamTraders: PuzzleEntity[] = shuffledClamNodes.map((node, idx) => ({
      ...clamTpl,
      id: `clam_${idx}`,
      emoji: '🐚',
      requires: ['sea_kelp'],
      reqType: 'OR',
      reward: 'pearl',
      x: node.x,
      y: node.y,
      zone: node.zone,
      isGatekeeper: false
    }));

    const creatureTraders: PuzzleEntity[] = shuffledCreatureNodes.map((node, idx) => {
      const tpl = creatureRoster[idx % creatureRoster.length];
      return {
        ...tpl,
        id: `${tpl.id}_deck_${idx}`,
        emoji: tpl.emoji,
        requires: ['starfish'],
        reqType: 'OR',
        reward: 'trident',
        x: node.x,
        y: node.y,
        zone: node.zone,
        isGatekeeper: false
      };
    });

    // Determine how many traders are active: required chain traders + difficulty-scaled misdirections (clams first!)
    const chestReqs = useTwoLockChest ? ['anchor_key', 'compass'] : ['anchor_key'];
    const availableWitchTreasures = shuffle(
      WITCH_TREASURE_POOL.filter((id) => !chestReqs.includes(id)),
      rng
    );
    const t1 = availableWitchTreasures[0];
    const t2 = availableWitchTreasures[1];
    const t3 = availableWitchTreasures[2];

    const usedInCore = new Set<string>([t1, t2, t3, ...chestReqs]);
    const availableIntermediates = shuffle(
      BARTER_RELIC_POOL.filter((id) => !usedInCore.has(id)),
      rng
    );
    const mid1 = availableIntermediates[0] || 'shell';
    const mid2 = availableIntermediates[1] || 'gem';
    const decoyReward = availableIntermediates[2] || 'shell';

    const coreTraders = shuffle(
      [...clamTraders.slice(0, 3), ...creatureTraders.slice(0, 3)],
      rng
    );
    const extraDecoyPool = [
      ...clamTraders.slice(3),
      ...creatureTraders.slice(3)
    ];

    let requiredCount: number;
    let witchReqs: string[];

    if (difficultySteps <= 4) {
      // Easy (4-5 steps): 2 Witch treasures + 1 chest key trade
      coreTraders[0].requires = ['sea_kelp'];
      coreTraders[0].reqType = 'OR';
      coreTraders[0].reward = t1;

      coreTraders[1].requires = ['starfish'];
      coreTraders[1].reqType = 'OR';
      coreTraders[1].reward = t2;

      coreTraders[2].requires = ['doubloon'];
      coreTraders[2].reqType = 'OR';
      coreTraders[2].reward = 'anchor_key';

      witchReqs = [t1, t2];
      requiredCount = 3;
    } else if (difficultySteps === 5) {
      // 2-hop Witch treasure + 1-hop Witch treasure + 1 chest key trade
      coreTraders[0].requires = ['sea_kelp'];
      coreTraders[0].reqType = 'OR';
      coreTraders[0].reward = mid1;

      coreTraders[1].requires = [mid1];
      coreTraders[1].reqType = 'OR';
      coreTraders[1].reward = t1;

      coreTraders[2].requires = ['starfish'];
      coreTraders[2].reqType = 'OR';
      coreTraders[2].reward = t2;

      coreTraders[3].requires = ['doubloon'];
      coreTraders[3].reqType = 'OR';
      coreTraders[3].reward = 'anchor_key';

      witchReqs = [t1, t2];
      requiredCount = 4;
    } else if (difficultySteps === 6) {
      // Normal: 3 Witch treasures (1 two-hop + 2 one-hop) + chest key trade
      coreTraders[0].requires = ['sea_kelp'];
      coreTraders[0].reqType = 'OR';
      coreTraders[0].reward = mid1;

      coreTraders[1].requires = [mid1];
      coreTraders[1].reqType = 'OR';
      coreTraders[1].reward = t1;

      coreTraders[2].requires = ['starfish'];
      coreTraders[2].reqType = 'OR';
      coreTraders[2].reward = t2;

      coreTraders[3].requires = ['doubloon'];
      coreTraders[3].reqType = 'OR';
      coreTraders[3].reward = t3;

      coreTraders[4].requires = ['spyglass'];
      coreTraders[4].reqType = 'OR';
      coreTraders[4].reward = 'anchor_key';

      witchReqs = [t1, t2, t3];
      requiredCount = 5;
    } else if (difficultySteps === 7) {
      // Hard: 2 Witch treasures (2 two-hop chains) + 2 chest lock items (anchor_key + compass)
      coreTraders[0].requires = ['sea_kelp'];
      coreTraders[0].reqType = 'OR';
      coreTraders[0].reward = mid1;

      coreTraders[1].requires = [mid1];
      coreTraders[1].reqType = 'OR';
      coreTraders[1].reward = t1;

      coreTraders[2].requires = ['starfish'];
      coreTraders[2].reqType = 'OR';
      coreTraders[2].reward = mid2;

      coreTraders[3].requires = [mid2];
      coreTraders[3].reqType = 'OR';
      coreTraders[3].reward = t2;

      coreTraders[4].requires = ['doubloon'];
      coreTraders[4].reqType = 'OR';
      coreTraders[4].reward = 'anchor_key';

      coreTraders[5].requires = ['spyglass'];
      coreTraders[5].reqType = 'OR';
      coreTraders[5].reward = 'compass';

      witchReqs = [t1, t2];
      requiredCount = 6;
    } else {
      // Expert (8+ steps): 3 Witch treasures + 2 chest lock items (4 presets + 1 starting relic = 5 branches)
      startItems.push('shell');
      const allCore = [...coreTraders, ...extraDecoyPool];
      allCore[0].requires = ['sea_kelp'];
      allCore[0].reqType = 'OR';
      allCore[0].reward = mid1;

      allCore[1].requires = [mid1];
      allCore[1].reqType = 'OR';
      allCore[1].reward = mid2;

      allCore[2].requires = [mid2];
      allCore[2].reqType = 'OR';
      allCore[2].reward = t1;

      allCore[3].requires = ['starfish'];
      allCore[3].reqType = 'OR';
      allCore[3].reward = t2;

      allCore[4].requires = ['shell'];
      allCore[4].reqType = 'OR';
      allCore[4].reward = t3;

      allCore[5].requires = ['doubloon'];
      allCore[5].reqType = 'OR';
      allCore[5].reward = 'anchor_key';

      allCore[6].requires = ['spyglass'];
      allCore[6].reqType = 'OR';
      allCore[6].reward = 'compass';

      witchReqs = [t1, t2, t3];
      requiredCount = 7;

      coreTraders.splice(0, coreTraders.length, ...allCore.slice(0, 7));
      extraDecoyPool.splice(0, extraDecoyPool.length, ...allCore.slice(7));
    }

    const activeTraders: PuzzleEntity[] = coreTraders.slice(0, requiredCount);
    const unusedCoreDecoys = coreTraders.slice(requiredCount);
    // Prioritize Giant Clams among extra misdirections!
    const orderedDecoys = [
      ...unusedCoreDecoys.filter((t) => t.id.startsWith('clam')),
      ...extraDecoyPool.filter((t) => t.id.startsWith('clam')),
      ...unusedCoreDecoys.filter((t) => !t.id.startsWith('clam')),
      ...extraDecoyPool.filter((t) => !t.id.startsWith('clam'))
    ];

    // Scale number of misdirection traders with both difficultySteps and numDiggers
    const targetExtraDecoys =
      difficultySteps >= 8 || misdirectionLevel >= 3
        ? orderedDecoys.length
        : Math.min(
            orderedDecoys.length,
            Math.max(1, (difficultySteps >= 7 ? 3 : difficultySteps >= 5 ? 2 : 1) + misdirectionLevel)
          );

    const decoyInputs = shuffle([...DECOY_INPUT_POOL], rng);
    for (let i = 0; i < targetExtraDecoys; i++) {
      const decoy = orderedDecoys[i];
      const req = decoyInputs[i % decoyInputs.length];
      const altReward = i % 2 === 0 ? decoyReward : 'shell';
      decoy.requires = [req];
      decoy.reqType = 'OR';
      decoy.reward = altReward === req ? decoyReward : altReward;
      activeTraders.push(decoy);
    }

    const seaWitch: PuzzleEntity = {
      ...(witchTpl || { id: 'sea_witch', name: 'Sea Witch', emoji: '😈' }),
      id: 'sea_witch',
      emoji: '😈',
      requires: witchReqs,
      reqType: 'AND',
      reward: null,
      x: witchNode.x,
      y: witchNode.y,
      zone: witchNode.zone,
      isGatekeeper: false
    };

    const captainsChest: PuzzleEntity = {
      ...chestTpl,
      id: 'captains_chest',
      name: chestTpl.name || "Captain's Treasure",
      emoji: '🧰',
      requires: chestReqs,
      reqType: 'AND',
      reward: null,
      x: goalNode.x,
      y: goalNode.y,
      zone: goalNode.zone,
      isGatekeeper: false,
      isGoal: true,
      requiresHuman: true
    };

    puzzleEntities.push(seaWitch, ...activeTraders, captainsChest);

    const sanitizedEntities = sanitizePuzzleEntities(puzzleEntities, level.items);
    const solved = solvePuzzle(startItems, sanitizedEntities, 'captains_chest', level);
    if (solved) {
      return {
        startItems,
        puzzleEntities: sanitizedEntities,
        goalEntityId: 'captains_chest',
        solution: solved.path,
        steps: solved.steps
      };
    }
  }

  return null;
}
