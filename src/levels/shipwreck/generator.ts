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

const RELIC_POOL = [
  'pearl',
  'shell',
  'anchor_key',
  'compass',
  'chalice',
  'trident',
  'abyssal_pearl',
  'gem'
] as const;

/**
 * Procedural Puzzle Generator for Ship Wreck (`shipwreck`):
 * - Hero starts on the seabed transformed as a Merman (`startsTransformed: true`).
 * - Flooded wreck decks house free salvage presets, Giant Clams (click-to-close), Crabs, and Octopuses.
 * - Merman gathers 2–3 treasures for the Sea Witch on the seabed to become Human (`16` air).
 * - Human swims back up through the flooded decks into the top dry Air Pocket (`y <= 25`)
 *   to claim the Captain's Treasure (`captains_chest`).
 */
export function generateShipwreckPuzzle(
  level: LevelDefinition,
  targetSteps = 5,
  _numDiggers = 1,
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

  const witchNode = level.mapNodes.find((n) => n.id === 'sea_witch') || { x: 18, y: 88, zone: 1 };
  const presetNodes = level.mapNodes.filter((n) => Boolean(n.isPreset));
  const clamNodes = level.mapNodes.filter((n) => Boolean(n.isClamNode));
  const creatureNodes = level.mapNodes.filter(
    (n) => !n.isPreset && !n.isClamNode && !n.isGoalNode && !n.isGatekeeper && n.id !== 'sea_witch'
  );
  const goalNode = level.mapNodes.find((n) => n.isGoalNode) || { x: 50, y: 16, zone: 5, requiresHuman: true };

  const difficultySteps = Number(targetSteps) || 5;

  for (let attempt = 0; attempt < GENERATOR_MAX_ATTEMPTS; attempt++) {
    if (Date.now() - startTime > SOLVER_TIME_LIMIT_MS) break;

    const puzzleEntities: PuzzleEntityArray = [];
    const startItems: string[] = [];

    // 1. Free salvage presets inside seabed & flooded holds
    const activePresets = difficultySteps >= 6 ? presetNodes : presetNodes.slice(0, 3);
    activePresets.forEach((node, idx) => {
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

    // 2. Build 3 Giant Clams + 3 Crab/Octopus traders in flooded ship rooms
    const shuffledClamNodes = shuffle(clamNodes, rng);
    const traders: PuzzleEntity[] = [];

    shuffledClamNodes.forEach((node, idx) => {
      traders.push({
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
      });
    });

    const creatureRoster: EntityTemplate[] = shuffle([crabTpl, octopusTpl, crabTpl], rng);
    creatureNodes.forEach((node, idx) => {
      const tpl = creatureRoster[idx % creatureRoster.length];
      traders.push({
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
      });
    });

    const orderedTraders = shuffle(traders, rng);
    const relics = shuffle([...RELIC_POOL], rng);
    const t1 = relics[0];
    const t2 = relics[1];
    const t3 = relics[2];
    const mid1 = relics[3];
    const mid2 = relics[4];
    const mid3 = relics[5];
    const decoyReq = relics[6];
    const decoyReward = relics[7];

    let witchReqs: string[];

    if (difficultySteps <= 4) {
      // 4 steps: 2 direct trades + Witch + Captain's Treasure
      orderedTraders[0].requires = ['sea_kelp'];
      orderedTraders[0].reqType = 'OR';
      orderedTraders[0].reward = t1;

      orderedTraders[1].requires = ['starfish'];
      orderedTraders[1].reqType = 'OR';
      orderedTraders[1].reward = t2;

      witchReqs = [t1, t2];

      for (let i = 2; i < orderedTraders.length; i++) {
        orderedTraders[i].requires = [decoyReq];
        orderedTraders[i].reqType = 'OR';
        orderedTraders[i].reward = decoyReward;
      }
    } else if (difficultySteps === 5) {
      // 5 steps: 2-hop chain (sea_kelp -> mid1 -> t1) + 1-hop (starfish -> t2) + Witch + Chest
      orderedTraders[0].requires = ['sea_kelp'];
      orderedTraders[0].reqType = 'OR';
      orderedTraders[0].reward = mid1;

      orderedTraders[1].requires = [mid1];
      orderedTraders[1].reqType = 'OR';
      orderedTraders[1].reward = t1;

      orderedTraders[2].requires = ['starfish'];
      orderedTraders[2].reqType = 'OR';
      orderedTraders[2].reward = t2;

      witchReqs = [t1, t2];

      for (let i = 3; i < orderedTraders.length; i++) {
        orderedTraders[i].requires = [decoyReq];
        orderedTraders[i].reqType = 'OR';
        orderedTraders[i].reward = decoyReward;
      }
    } else if (difficultySteps === 6) {
      // 6 steps: 3 treasures (1 two-hop chain + 2 one-hop trades) + Witch + Chest
      orderedTraders[0].requires = ['sea_kelp'];
      orderedTraders[0].reqType = 'OR';
      orderedTraders[0].reward = mid1;

      orderedTraders[1].requires = [mid1];
      orderedTraders[1].reqType = 'OR';
      orderedTraders[1].reward = t1;

      orderedTraders[2].requires = ['starfish'];
      orderedTraders[2].reqType = 'OR';
      orderedTraders[2].reward = t2;

      orderedTraders[3].requires = ['doubloon'];
      orderedTraders[3].reqType = 'OR';
      orderedTraders[3].reward = t3;

      witchReqs = [t1, t2, t3];

      for (let i = 4; i < orderedTraders.length; i++) {
        orderedTraders[i].requires = [decoyReq];
        orderedTraders[i].reqType = 'OR';
        orderedTraders[i].reward = decoyReward;
      }
    } else if (difficultySteps === 7) {
      // 7 steps: 3 treasures (2 two-hop chains + 1 one-hop trade) + Witch + Chest
      orderedTraders[0].requires = ['sea_kelp'];
      orderedTraders[0].reqType = 'OR';
      orderedTraders[0].reward = mid1;

      orderedTraders[1].requires = [mid1];
      orderedTraders[1].reqType = 'OR';
      orderedTraders[1].reward = t1;

      orderedTraders[2].requires = ['starfish'];
      orderedTraders[2].reqType = 'OR';
      orderedTraders[2].reward = mid2;

      orderedTraders[3].requires = [mid2];
      orderedTraders[3].reqType = 'OR';
      orderedTraders[3].reward = t2;

      orderedTraders[4].requires = ['doubloon'];
      orderedTraders[4].reqType = 'OR';
      orderedTraders[4].reward = t3;

      witchReqs = [t1, t2, t3];

      for (let i = 5; i < orderedTraders.length; i++) {
        orderedTraders[i].requires = [decoyReq];
        orderedTraders[i].reqType = 'OR';
        orderedTraders[i].reward = decoyReward;
      }
    } else {
      // 8 steps: 3 treasures using all 6 traders (3-hop chain + 2-hop chain + AND trade) + Witch + Chest
      orderedTraders[0].requires = ['sea_kelp'];
      orderedTraders[0].reqType = 'OR';
      orderedTraders[0].reward = mid1;

      orderedTraders[1].requires = [mid1];
      orderedTraders[1].reqType = 'OR';
      orderedTraders[1].reward = mid2;

      orderedTraders[2].requires = [mid2];
      orderedTraders[2].reqType = 'OR';
      orderedTraders[2].reward = t1;

      orderedTraders[3].requires = ['starfish'];
      orderedTraders[3].reqType = 'OR';
      orderedTraders[3].reward = mid3;

      orderedTraders[4].requires = [mid3];
      orderedTraders[4].reqType = 'OR';
      orderedTraders[4].reward = t2;

      orderedTraders[5].requires = ['doubloon', 'spyglass'];
      orderedTraders[5].reqType = 'AND';
      orderedTraders[5].reward = t3;

      witchReqs = [t1, t2, t3];
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
      requires: [],
      reqType: 'AND',
      reward: null,
      x: goalNode.x,
      y: goalNode.y,
      zone: goalNode.zone,
      isGatekeeper: false,
      isGoal: true,
      requiresHuman: true
    };

    puzzleEntities.push(seaWitch, ...traders, captainsChest);

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
