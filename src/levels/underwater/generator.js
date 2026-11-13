import { SOLVER_TIME_LIMIT_MS, GENERATOR_MAX_ATTEMPTS } from '../../constants.js';
import { solvePuzzle } from '../../logic/solver.js';
import { createRNG, shuffle } from '../../logic/rng.js';
import { sanitizePuzzleEntities } from '../../logic/rules.js';

/**
 * Procedural, solver-verified puzzle generator for the Underwater level.
 * Respects `targetSteps` (quest chain difficulty) and `numDiggers` (memory clams
 * that snap shut after 3 seconds), while preserving Underwater's unique mechanics:
 * - Dolphin transport elevator (`dolphin_1`)
 * - Bubble vents (`isVent: true`) for air management
 * - Reef traders (Mermaids, Octopus, Crab) in Zones 1 & 2
 * - Sea Witch transformation gate (`sea_witch`) requiring 2 items
 * - Deep Trench (Zone 3) Clams and Crabs guarding the Glowing Crown (`clam_3`)
 *
 * @param {Object} level - The underwater level definition
 * @param {number} [targetSteps=5] - Minimum quest chain steps (3..8)
 * @param {number} [numDiggers=1] - Number of memory clams that close after 3s (0..3)
 * @param {number|string|null} [seed=null] - Optional deterministic PRNG seed
 * @returns {Object} Generated puzzle
 */
export function generateUnderwaterPuzzle(level, targetSteps = 5, numDiggers = 1, seed = null) {
  const rng = createRNG(seed);
  const startTime = Date.now();
  let bestPuzzle = null;
  let bestScore = Infinity;

  const tradableItemIds = level.items
    .map(i => i.id)
    .filter(id => id !== 'crown' && id !== 'fish' && id !== 'gold_fish');

  const z1Nodes = level.mapNodes.filter(n => n.zone === 1 && !n.isGatekeeper && !n.isPreset);
  const z2Nodes = level.mapNodes.filter(n => n.zone === 2 && !n.isGatekeeper && !n.isPreset && n.id !== 'sea_witch');
  const z3Nodes = level.mapNodes.filter(n => n.zone === 3 && !n.isGatekeeper && !n.isPreset);
  const witchNode = level.mapNodes.find(n => n.id === 'sea_witch');

  const dolphinTpl = level.entities.find(e => e.id === 'dolphin');
  const witchEnt = level.entities.find(e => e.id === 'sea_witch');
  const clamTpl = level.entities.find(e => e.id === 'clam');
  const crabTpl = level.entities.find(e => e.id === 'crab');
  const octopusTpl = level.entities.find(e => e.id === 'octopus');
  const mermaidTemplates = level.entities.filter(e => e.id.startsWith('mermaid'));
  const mermaidEmojis = ['🧜‍♀️', '🧜🏻‍♀️', '🧜🏼‍♀️', '🧜🏽‍♀️', '🧜🏾‍♀️'];

  for (let attempt = 0; attempt < GENERATOR_MAX_ATTEMPTS; attempt++) {
    if (Date.now() - startTime > SOLVER_TIME_LIMIT_MS && bestPuzzle) break;

    const puzzleEntities = [];

    // 1. Include preset bubble vents from mapNodes
    level.mapNodes.forEach(n => {
      if (n.isPreset === 'bubble_vent') {
        puzzleEntities.push({
          id: `preset_vent_${n.x}_${n.y}`,
          emoji: '🫧',
          requires: [],
          reqType: 'AND',
          reward: null,
          x: n.x,
          y: n.y,
          zone: n.zone,
          isGatekeeper: false,
          isPreset: true,
          isVent: true
        });
      }
    });

    // 2. Select a Roaming Boat trade item + 2 starting inventory items
    const boatPool = ['comb', 'mirror', 'boot', 'locket'].filter(id => tradableItemIds.includes(id));
    const boatOfferedItem = shuffle(boatPool, rng)[0] || 'boot';
    const remainingTradable = shuffle(tradableItemIds.filter(id => id !== boatOfferedItem), rng);
    const startItems = [remainingTradable[0], remainingTradable[1]];
    const chainPool = remainingTradable.slice(2);

    // 3. Dolphin transport elevator in Zone 1
    const dolphinPos = z1Nodes[2] || z1Nodes[0];
    if (dolphinTpl && dolphinPos) {
      puzzleEntities.push({
        ...dolphinTpl,
        id: 'dolphin_1',
        emoji: '🐬',
        requires: ['fish', 'gold_fish'],
        reqType: 'OR',
        reward: null,
        x: dolphinPos.x,
        y: dolphinPos.y,
        zone: dolphinPos.zone,
        isGatekeeper: false
      });
    }

    // 4. Reef Traders in Zone 1 (2 nodes) & Zone 2 (3 nodes)
    const reefTraders = [];
    const z1TraderNodes = z1Nodes.slice(0, 2);
    const z1Templates = shuffle([octopusTpl, crabTpl].filter(Boolean), rng);
    z1TraderNodes.forEach((node, idx) => {
      const tpl = z1Templates[idx % z1Templates.length] || crabTpl;
      reefTraders.push({
        ...tpl,
        id: `${tpl.id}_z1_${idx}`,
        emoji: tpl.emoji,
        requires: [startItems[0]],
        reqType: 'OR',
        reward: chainPool[0],
        x: node.x,
        y: node.y,
        zone: node.zone,
        isGatekeeper: false
      });
    });

    const shuffledMermaidEmojis = shuffle(mermaidEmojis, rng);
    const shuffledMermaidTpls = shuffle(mermaidTemplates, rng);
    const shuffledZ2Nodes = shuffle(z2Nodes, rng);
    shuffledZ2Nodes.slice(0, 3).forEach((node, idx) => {
      const mTpl = shuffledMermaidTpls[idx % shuffledMermaidTpls.length] || mermaidTemplates[0];
      reefTraders.push({
        ...mTpl,
        id: `mermaid_${idx + 1}`,
        emoji: shuffledMermaidEmojis[idx % shuffledMermaidEmojis.length],
        requires: [startItems[0]],
        reqType: 'OR',
        reward: chainPool[1],
        x: node.x,
        y: node.y,
        zone: node.zone,
        isGatekeeper: false
      });
    });

    // 5. Deep Trench (Zone 3): Goal Clam (`clam_3`) + 5 Seabed Traders (3 Clams + 2 Crabs/Octopus)
    const goalPos = z3Nodes.find(n => n.isGoalNode) || z3Nodes[4] || z3Nodes[z3Nodes.length - 1];
    const nonGoalZ3 = z3Nodes.filter(n => n !== goalPos);
    const clamNodes = shuffle(nonGoalZ3.filter(n => n.isClamNode), rng);
    const creatureNodes = shuffle(nonGoalZ3.filter(n => !n.isClamNode), rng);
    const orderedZ3Nodes = [...clamNodes, ...creatureNodes];

    const clampedDiggers = Math.max(0, Math.min(3, numDiggers ?? 1));
    const deepTraders = [];

    for (let i = 0; i < Math.min(5, orderedZ3Nodes.length); i++) {
      const node = orderedZ3Nodes[i];
      if (i < 3) {
        // First `clampedDiggers` clams use ID prefix `clam_` (triggers isDigger memory closing);
        // remaining non-goal clams use `giant_clam_` (stays open).
        const isMemoryClam = i < clampedDiggers;
        const clamId = isMemoryClam ? `clam_${i}` : `giant_clam_${i}`;
        deepTraders.push({
          ...clamTpl,
          id: clamId,
          emoji: '🐚',
          requires: [boatOfferedItem],
          reqType: 'OR',
          reward: chainPool[2],
          x: node.x,
          y: node.y,
          zone: node.zone,
          isGatekeeper: false
        });
      } else {
        const useOctopus = i === 4 && octopusTpl && rng() > 0.4;
        const tpl = useOctopus ? octopusTpl : crabTpl;
        deepTraders.push({
          ...tpl,
          id: `${tpl.id}_z3_${i}`,
          emoji: tpl.emoji,
          requires: ['fish'],
          reqType: 'OR',
          reward: 'gold_fish',
          x: node.x,
          y: node.y,
          zone: node.zone,
          isGatekeeper: false
        });
      }
    }

    // 6. Wire the procedural quest chain to match `targetSteps`
    // Total solver steps = kReef + kDeep + 3 (sea_witch transform + clam_3 goal + sea_witch return)
    const neededTraders = Math.max(1, Math.min(6, (targetSteps || 5) - 3));
    const kReef = Math.max(1, Math.min(3, Math.ceil(neededTraders * 0.6)));
    const kDeep = Math.max(0, Math.min(3, neededTraders - kReef));

    const shuffledReef = shuffle(reefTraders, rng);
    const shuffledDeep = shuffle(deepTraders, rng);

    let chainCursor = 0;
    const nextChainItem = () => chainPool[chainCursor++ % chainPool.length];
    const usedChainRewards = new Set();

    let prevReef = startItems[0];
    for (let i = 0; i < kReef; i++) {
      const reward = nextChainItem();
      usedChainRewards.add(reward);
      shuffledReef[i].requires = [prevReef];
      shuffledReef[i].reqType = 'OR';
      shuffledReef[i].reward = reward;
      prevReef = reward;
    }

    const witchReqs = [prevReef, startItems[1]];
    if (witchEnt && witchNode) {
      puzzleEntities.push({
        ...witchEnt,
        ...witchNode,
        emoji: '😈',
        requires: witchReqs,
        reqType: 'AND',
        reward: null,
        id: 'sea_witch',
        isGatekeeper: false
      });
    }

    let prevDeep = boatOfferedItem;
    for (let i = 0; i < kDeep; i++) {
      const reward = nextChainItem();
      usedChainRewards.add(reward);
      shuffledDeep[i].requires = [prevDeep];
      shuffledDeep[i].reqType = 'OR';
      shuffledDeep[i].reward = reward;
      prevDeep = reward;
    }

    const goalReqs = (targetSteps >= 8 && kDeep >= 2) ? [prevDeep, 'fish'] : [prevDeep];
    const goalReqType = goalReqs.length > 1 ? 'AND' : 'OR';
    const goalClam = {
      ...clamTpl,
      id: 'clam_3',
      emoji: '🐚',
      requires: goalReqs,
      reqType: goalReqType,
      reward: 'crown',
      x: goalPos.x,
      y: goalPos.y,
      zone: goalPos.zone,
      isGatekeeper: false,
      isGoal: true
    };

    // Configure remaining Reef & Deep traders as red herrings that don't short-circuit the chain
    const safeRewards = tradableItemIds.filter(id => !usedChainRewards.has(id) && id !== prevReef && id !== prevDeep && id !== boatOfferedItem);
    const remainingTraders = [...shuffledReef.slice(kReef), ...shuffledDeep.slice(kDeep)];
    remainingTraders.forEach((t, idx) => {
      if (idx === remainingTraders.length - 1) {
        t.requires = ['fish'];
        t.reqType = 'OR';
        t.reward = 'gold_fish';
      } else {
        const reward = safeRewards[idx % safeRewards.length] || startItems[0];
        let req = chainPool[(chainCursor + idx) % chainPool.length] || 'gold_fish';
        if (req === reward) {
          req = reward === 'fish' ? 'shell' : 'fish';
        }
        t.requires = [req];
        t.reqType = 'OR';
        t.reward = reward;
      }
    });

    puzzleEntities.push(...reefTraders, ...deepTraders, goalClam);
    const sanitizedEntities = sanitizePuzzleEntities(puzzleEntities, level.items);
    puzzleEntities.length = 0;
    puzzleEntities.push(...sanitizedEntities);
    puzzleEntities.boatOfferedItem = boatOfferedItem;

    const solved = solvePuzzle(startItems, puzzleEntities, 'clam_3', level, { boatOfferedItem });
    if (solved) {
      const safeBoatItems = boatPool.filter(id => !usedChainRewards.has(id) && id !== prevReef && id !== prevDeep);
      const sanitizedCandidateEntities = sanitizePuzzleEntities(puzzleEntities, level.items);
      sanitizedCandidateEntities.boatOfferedItem = boatOfferedItem;
      const candidate = {
        startItems,
        boatOfferedItem,
        safeBoatItems: safeBoatItems.length > 0 ? safeBoatItems : [boatOfferedItem],
        puzzleEntities: sanitizedCandidateEntities,
        goalEntityId: 'clam_3',
        solution: solved.path,
        steps: solved.steps
      };

      if (solved.steps >= targetSteps && solved.steps <= targetSteps + 1) {
        return candidate;
      }

      const score = solved.steps >= targetSteps
        ? (solved.steps - targetSteps)
        : (targetSteps - solved.steps) * 10;

      if (score < bestScore) {
        bestScore = score;
        bestPuzzle = candidate;
      }
    }
  }

  if (bestPuzzle && bestPuzzle.puzzleEntities) {
    const sanitized = sanitizePuzzleEntities(bestPuzzle.puzzleEntities, level.items);
    if (bestPuzzle.boatOfferedItem) sanitized.boatOfferedItem = bestPuzzle.boatOfferedItem;
    bestPuzzle.puzzleEntities = sanitized;
  }
  return bestPuzzle;
}
