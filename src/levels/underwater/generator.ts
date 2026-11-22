import { GENERATOR_MAX_ATTEMPTS, SOLVER_TIME_LIMIT_MS } from '../../constants.ts';
import { createRNG, shuffle } from '../../logic/rng.ts';
import type { SeedInput } from '../../logic/rng.ts';
import { sanitizePuzzleEntities } from '../../logic/rules.ts';
import { solvePuzzle } from '../../logic/solver.ts';
import { HUMAN_TRINKET_BOAT_TIERS, HUMAN_TRINKET_IDS } from '../../logic/underwater.ts';
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
  doubloon: { id: 'doubloon', emoji: '🪙', name: 'Gold Doubloon' }
};

/**
 * Procedural 2-Act Puzzle Generator for Under the Sea (`underwater`):
 * - Act 1: Player starts with 0 items, catches depth-tiered fish to trade with
 *   surface boats for human trinkets, trades trinkets to 3 circling Mermaids
 *   for 3× Mermaid Song (`mermaid_voice`), and pays the Sea Witch (`sea_witch`)
 *   to transform into a Merman (infinite air).
 * - Act 2: In the Abyssal Trench (y > 72), player gathers seabed catalysts
 *   (`sea_kelp`, `starfish`, `doubloon`) and trades with Giant Clams, Hermit Crab,
 *   and Shipwreck Octopus to forge seals for the Sunken Galleon Vault (`sunken_vault`)
 *   AND obtain the Sea Witch's deep-sea Return Tribute relic (`returnRequires`).
 */
export function generateUnderwaterPuzzle(
  level: LevelDefinition,
  targetSteps = 5,
  numDiggers = 1,
  seed: SeedInput = null
): PuzzleData | null {
  const rng = createRNG(seed);
  const startTime = Date.now();
  let bestPuzzle: PuzzleData | null = null;

  const dolphinTpl = level.entities.find((e) => e.id === 'dolphin');
  const witchEnt = level.entities.find((e) => e.id === 'sea_witch');
  const clamTpl = level.entities.find((e) => e.id === 'clam') || { id: 'clam', name: 'Giant Clam', emoji: '🐚' };
  const crabTpl = level.entities.find((e) => e.id === 'crab') || { id: 'crab', name: 'Hermit Crab', emoji: '🦀' };
  const octopusTpl = level.entities.find((e) => e.id === 'octopus') || { id: 'octopus', name: 'Octopus', emoji: '🐙' };
  const vaultTpl = level.entities.find((e) => e.id === 'sunken_vault') || {
    id: 'sunken_vault',
    name: 'Sunken Galleon Vault',
    emoji: '🧰'
  };

  const mermaidTemplates = level.entities.filter((e) => e.id.startsWith('mermaid'));
  const mermaidEmojis = ['🧜‍♀️', '🧜🏻‍♀️', '🧜🏼‍♀️', '🧜🏽‍♀️', '🧜🏾‍♀️'];

  const z1Nodes = level.mapNodes.filter((n) => n.zone === 1 && !n.isGatekeeper && !n.isPreset);
  const z2MermaidNodes = level.mapNodes.filter(
    (n) => n.zone === 2 && !n.isGatekeeper && !n.isPreset && n.id !== 'sea_witch'
  );
  const witchNode = level.mapNodes.find((n) => n.id === 'sea_witch');
  const z3PresetNodes = level.mapNodes.filter((n) => n.zone === 3 && Boolean(n.isPreset));
  const z3ClamNodes = level.mapNodes.filter((n) => n.zone === 3 && Boolean(n.isClamNode));
  const z3CreatureNodes = level.mapNodes.filter(
    (n) => n.zone === 3 && !n.isPreset && !n.isClamNode && !n.isGoalNode && !n.isGatekeeper
  );
  const goalPos = level.mapNodes.find((n) => n.isGoalNode) || { x: 50, y: 95, zone: 3 };

  const difficultySteps = Number(targetSteps) || 5;
  const isEasy = difficultySteps <= 4;
  const isHard = difficultySteps >= 7;

  const tier1Trinkets = HUMAN_TRINKET_IDS.filter((id) => HUMAN_TRINKET_BOAT_TIERS[id] === 'fish');
  const tier2Trinkets = HUMAN_TRINKET_IDS.filter((id) => HUMAN_TRINKET_BOAT_TIERS[id] === 'gold_fish');
  const tier3Trinkets = HUMAN_TRINKET_IDS.filter((id) => HUMAN_TRINKET_BOAT_TIERS[id] === 'blowfish');

  const seabedRelicPool = ['pearl', 'anchor_key', 'shell', 'trident', 'gem', 'abyssal_pearl'];

  for (let attempt = 0; attempt < GENERATOR_MAX_ATTEMPTS; attempt++) {
    if (Date.now() - startTime > SOLVER_TIME_LIMIT_MS && bestPuzzle) break;

    const puzzleEntities: PuzzleEntityArray = [];
    const startItems: string[] = [];

    // 1. Dolphin shuttle elevator in Zone 1 (repeatable, requires any fish per ride)
    const dolphinPos = z1Nodes.find((n) => !n.orbit) || z1Nodes[0];
    if (dolphinTpl && dolphinPos) {
      puzzleEntities.push({
        ...dolphinTpl,
        id: 'dolphin_1',
        emoji: '🐬',
        requires: ['fish', 'gold_fish', 'blowfish'],
        reqType: 'OR',
        reward: null,
        isRepeatable: true,
        x: dolphinPos.x,
        y: dolphinPos.y,
        zone: dolphinPos.zone,
        isGatekeeper: false
      });
    }

    // 2. Act 1: Human trinkets (only from Surface Boats) -> 3 Circling Mermaids -> 3x mermaid_voice
    const t1 = shuffle(tier1Trinkets, rng);
    const t2 = shuffle(tier2Trinkets, rng);
    const t3 = shuffle(tier3Trinkets, rng);

    const mermaidReqsList: string[][] = isEasy
      ? [[t1[0]], [t1[1]], [t2[0]]]
      : isHard
        ? [[t1[0]], [t2[0]], [t3[0], t1[1]]]
        : [[t1[0]], [t2[0]], [t3[0]]];

    const shuffledMermaidReqs = shuffle(mermaidReqsList, rng);
    const boatOfferedItems = Array.from(new Set(shuffledMermaidReqs.flat()));
    const boatTradeMap: Record<string, string> = {};
    HUMAN_TRINKET_IDS.forEach((trinketId) => {
      boatTradeMap[trinketId] = HUMAN_TRINKET_BOAT_TIERS[trinketId];
    });
    const safeBoatItems = HUMAN_TRINKET_IDS.filter((id) => !boatOfferedItems.includes(id));

    const mermaidPositions = [
      z1Nodes.find((n) => Boolean(n.orbit)) || { x: 30, y: 31, zone: 1, orbit: { rx: 22, ry: 9, duration: 7.5 } },
      ...z2MermaidNodes
    ].slice(0, 3);

    const shuffledMermaidEmojis = shuffle(mermaidEmojis, rng);
    const shuffledMermaidTpls = shuffle(mermaidTemplates, rng);

    mermaidPositions.forEach((node, idx) => {
      const mTpl = shuffledMermaidTpls[idx % shuffledMermaidTpls.length] || mermaidTemplates[0];
      const reqs = shuffledMermaidReqs[idx] || [boatOfferedItems[0]];
      puzzleEntities.push({
        ...mTpl,
        id: `mermaid_${idx + 1}`,
        emoji: shuffledMermaidEmojis[idx % shuffledMermaidEmojis.length],
        requires: reqs,
        reqType: reqs.length > 1 ? 'AND' : 'OR',
        reward: 'mermaid_voice',
        x: node.x,
        y: node.y,
        zone: node.zone,
        orbit: node.orbit,
        isGatekeeper: false
      });
    });

    // 3. Act 2: Seabed Catalysts, Clams/Crab/Octopus, Return Tribute & Sunken Vault
    const activePresetNodes = isHard ? z3PresetNodes.slice(0, 4) : z3PresetNodes.slice(0, 3);
    activePresetNodes.forEach((node, idx) => {
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

    const relics = shuffle(seabedRelicPool, rng);
    const returnRelic = relics[0];
    const midRelic = relics[1];
    const seal1 = relics[2];
    const seal2 = relics[3];
    const seal3 = relics[4];
    const unusedDecoyReward = relics[5];

    if (witchEnt && witchNode) {
      puzzleEntities.push({
        ...witchEnt,
        ...witchNode,
        emoji: '😈',
        requires: ['mermaid_voice', 'mermaid_voice', 'mermaid_voice'],
        reqType: 'AND',
        returnRequires: [returnRelic],
        reward: null,
        id: 'sea_witch',
        isGatekeeper: false
      });
    }

    const clampedDiggers = Math.max(0, Math.min(3, numDiggers ?? 1));
    const shuffledClamNodes = shuffle(z3ClamNodes, rng);
    const deepTraders: PuzzleEntity[] = [];

    for (let i = 0; i < Math.min(3, shuffledClamNodes.length); i++) {
      const node = shuffledClamNodes[i];
      const isMemoryClam = i < clampedDiggers;
      deepTraders.push({
        ...clamTpl,
        id: isMemoryClam ? `clam_${i}` : `giant_clam_${i}`,
        emoji: '🐚',
        requires: ['sea_kelp'],
        reqType: 'OR',
        reward: unusedDecoyReward,
        x: node.x,
        y: node.y,
        zone: node.zone,
        isGatekeeper: false
      });
    }

    const creatureTemplates: EntityTemplate[] = shuffle([octopusTpl, crabTpl], rng);
    z3CreatureNodes.slice(0, 2).forEach((node, idx) => {
      const tpl = creatureTemplates[idx % creatureTemplates.length];
      deepTraders.push({
        ...tpl,
        id: `${tpl.id}_z3_${idx}`,
        emoji: tpl.emoji,
        requires: ['doubloon'],
        reqType: 'OR',
        reward: unusedDecoyReward,
        x: node.x,
        y: node.y,
        zone: node.zone,
        isGatekeeper: false
      });
    });

    const orderedDeepTraders = shuffle(deepTraders, rng);
    let vaultReqs: string[];

    if (isEasy) {
      orderedDeepTraders[0].requires = ['sea_kelp'];
      orderedDeepTraders[0].reqType = 'OR';
      orderedDeepTraders[0].reward = seal1;

      orderedDeepTraders[1].requires = ['doubloon'];
      orderedDeepTraders[1].reqType = 'OR';
      orderedDeepTraders[1].reward = returnRelic;

      vaultReqs = [seal1, 'starfish'];

      const safeDecoyReqs = [seal2, seal3, midRelic];
      for (let i = 2; i < orderedDeepTraders.length; i++) {
        orderedDeepTraders[i].requires = [safeDecoyReqs[(i - 2) % safeDecoyReqs.length]];
        orderedDeepTraders[i].reqType = 'OR';
        orderedDeepTraders[i].reward = unusedDecoyReward;
      }
    } else if (!isHard) {
      orderedDeepTraders[0].requires = ['sea_kelp'];
      orderedDeepTraders[0].reqType = 'OR';
      orderedDeepTraders[0].reward = midRelic;

      orderedDeepTraders[1].requires = [midRelic];
      orderedDeepTraders[1].reqType = 'OR';
      orderedDeepTraders[1].reward = seal1;

      orderedDeepTraders[2].requires = ['starfish'];
      orderedDeepTraders[2].reqType = 'OR';
      orderedDeepTraders[2].reward = seal2;

      orderedDeepTraders[3].requires = ['doubloon'];
      orderedDeepTraders[3].reqType = 'OR';
      orderedDeepTraders[3].reward = returnRelic;

      vaultReqs = [seal1, seal2];

      orderedDeepTraders[4].requires = [seal3];
      orderedDeepTraders[4].reqType = 'OR';
      orderedDeepTraders[4].reward = unusedDecoyReward;
    } else {
      orderedDeepTraders[0].requires = ['sea_kelp'];
      orderedDeepTraders[0].reqType = 'OR';
      orderedDeepTraders[0].reward = midRelic;

      orderedDeepTraders[1].requires = [midRelic];
      orderedDeepTraders[1].reqType = 'OR';
      orderedDeepTraders[1].reward = seal1;

      orderedDeepTraders[2].requires = ['starfish'];
      orderedDeepTraders[2].reqType = 'OR';
      orderedDeepTraders[2].reward = seal2;

      orderedDeepTraders[3].requires = ['doubloon'];
      orderedDeepTraders[3].reqType = 'OR';
      orderedDeepTraders[3].reward = seal3;

      orderedDeepTraders[4].requires = ['sea_kelp'];
      orderedDeepTraders[4].reqType = 'OR';
      orderedDeepTraders[4].reward = returnRelic;

      vaultReqs = [seal1, seal2, seal3];
    }

    const sunkenVault: PuzzleEntity = {
      ...vaultTpl,
      id: 'sunken_vault',
      name: vaultTpl.name || 'Sunken Galleon Vault',
      emoji: '🧰',
      requires: vaultReqs,
      reqType: 'AND',
      reward: 'crown',
      x: goalPos.x,
      y: goalPos.y,
      zone: 3,
      isGatekeeper: false,
      isGoal: true
    };

    puzzleEntities.push(...deepTraders, sunkenVault);

    const sanitizedEntities: PuzzleEntityArray = sanitizePuzzleEntities(puzzleEntities, level.items);
    sanitizedEntities.boatOfferedItem = boatOfferedItems[0];
    sanitizedEntities.boatOfferedItems = boatOfferedItems;
    sanitizedEntities.boatTradeMap = boatTradeMap;

    const solved = solvePuzzle(startItems, sanitizedEntities, 'sunken_vault', level, {
      boatOfferedItems,
      boatTradeMap
    });

    if (solved) {
      const candidate: PuzzleData = {
        startItems,
        boatOfferedItem: boatOfferedItems[0],
        boatOfferedItems,
        boatTradeMap,
        safeBoatItems: safeBoatItems.length > 0 ? safeBoatItems : [boatOfferedItems[0]],
        puzzleEntities: sanitizedEntities,
        goalEntityId: 'sunken_vault',
        solution: solved.path,
        steps: solved.steps
      };
      return candidate;
    }
  }

  return bestPuzzle;
}
