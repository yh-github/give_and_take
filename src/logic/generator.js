import { SOLVER_TIME_LIMIT_MS, GENERATOR_MAX_ATTEMPTS } from '../constants.js';
import { solvePuzzle } from './solver.js';
import { createRNG, shuffle } from './rng.js';

export function generateLevelPuzzle(level, targetSteps = 5, numDiggers = 1, seed = null) {
  if (level.generatePuzzle) return level.generatePuzzle(level, targetSteps, numDiggers, seed);

  const rng = createRNG(seed);
  let bestPuzzle = null;
  let bestScore = Infinity;
  const startTime = Date.now();

  for (let attempt = 0; attempt < GENERATOR_MAX_ATTEMPTS; attempt++) {
    if (Date.now() - startTime > SOLVER_TIME_LIMIT_MS) break;

    let activeGatekeepers = [];
    let presetEntities = [];

    // 1. Gather gatekeepers and preset entities
    if (level.mechanics.gatekeeperId) {
      const gkEnt = level.entities.find(e => e.id === level.mechanics.gatekeeperId);
      const gkNode = level.mapNodes.find(n => n.isGatekeeper);
      const reqs = shuffle(gkEnt.allowedReqs, rng).slice(0, 2);
      activeGatekeepers = [{ ...gkEnt, ...gkNode, requires: reqs, reqType: 'AND', reward: null, id: gkEnt.id }];
    } else {
      level.mapNodes.forEach((n, idx) => {
        if (n.isGatekeeper) {
          if (level.mechanics.hasPickaxe) {
            activeGatekeepers.push({ ...n, name: 'Rock', requires: ['pickaxe'], reqType: 'AND', id: n.id || `gk_${idx}` });
          } else {
            activeGatekeepers.push({
              ...n,
              name: 'Giant Clam',
              requires: shuffle(['pearl', 'shell', 'starfish'], rng).slice(0, 1),
              reqType: 'AND',
              reward: null,
              id: n.id || `gk_${idx}`
            });
          }
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
      const witchEnt = level.entities.find(e => e.id === 'sea_witch');
      const witchNode = level.mapNodes.find(n => n.id === 'sea_witch');
      const reqs = shuffle(['pearl', 'locket', 'trident'], rng).slice(0, 2);
      activeGatekeepers.push({ ...witchEnt, ...witchNode, requires: reqs, reqType: 'AND', reward: null, id: 'sea_witch' });
    }

    const hardcodedLayout = [...activeGatekeepers, ...presetEntities].map(e => ({ ...e }));

    const availableNodes = level.mapNodes.filter(n => !n.isGatekeeper && !n.isGoal && !n.isPreset && n.id !== 'sea_witch');
    let goalTemplate = { id: 'vault_rock' };
    let goalEntity = null;

    if (!level.mechanics.isVertical || !level.mechanics.hasPickaxe) {
      if (level.id === 'river_crossing') {
        const baseTroll = level.entities.find(e => e.id === 'troll');
        goalTemplate = { ...baseTroll, id: 'cave_troll_exit', name: 'Cave Boss' };
      } else {
        goalTemplate = shuffle(level.entities.filter(e => e.id !== level.mechanics.gatekeeperId && e.id !== level.specialEntityTemplate), rng)[0] || level.entities[0];
      }

      const goalNode = level.mapNodes.find(n => n.isGoal);
      if (goalNode) {
        const availableReqs = (goalTemplate.allowedReqs || []).filter(req => req !== 'pickaxe');
        const numReqs = level.id === 'river_crossing' ? 2 : 1;
        const reqs = shuffle(availableReqs, rng).slice(0, numReqs);
        goalEntity = {
          ...goalTemplate,
          requires: reqs,
          reqType: (level.mechanics.hasTransformation ? 'OR' : 'AND'),
          reward: null,
          x: goalNode.x,
          y: goalNode.y,
          zone: goalNode.zone,
          isGatekeeper: false,
          isGoal: true,
          id: goalTemplate.id
        };
        activeGatekeepers.push(goalEntity);
      }
    }

    const diggerTemplate = level.entities.find(e => e.id === level.specialEntityTemplate);
    const otherTemplates = level.entities.filter(e => e.id !== level.mechanics.gatekeeperId && e.id !== level.specialEntityTemplate);

    const clampedDiggers = Math.max(0, Math.min(numDiggers || 0, availableNodes.length));
    let selectedOthers = diggerTemplate
      ? Array.from({ length: clampedDiggers }).map((_, i) => ({ ...diggerTemplate, id: `${level.specialEntityTemplate}_${i}` }))
      : [];

    let pool = shuffle(otherTemplates.length > 0 ? otherTemplates : level.entities, rng);
    while (selectedOthers.length + pool.length < availableNodes.length) {
      pool = [...pool, ...shuffle(otherTemplates.length > 0 ? otherTemplates : level.entities, rng)];
    }
    const filler = pool.slice(0, Math.max(0, availableNodes.length - selectedOthers.length)).map((e, idx) => ({
      ...e,
      id: `${e.id}_${idx + clampedDiggers}`
    }));
    selectedOthers = shuffle([...selectedOthers, ...filler], rng);

    const standardItems = level.items.filter(i => i.id !== 'fish' && i.id !== 'pickaxe' && i.id !== 'key');
    const shuffledStartPool = shuffle(standardItems, rng);
    const startItems = shuffledStartPool.length >= 3
      ? [shuffledStartPool[0].id, shuffledStartPool[1].id, shuffledStartPool[2].id]
      : [
          standardItems[Math.floor(rng() * standardItems.length)].id,
          standardItems[Math.floor(rng() * standardItems.length)].id,
          standardItems[Math.floor(rng() * standardItems.length)].id
        ];

    const traderEntities = selectedOthers.map((e, idx) => {
      const pos = availableNodes[idx];
      const reward = standardItems[Math.floor(rng() * standardItems.length)].id;
      const availableReqs = (e.allowedReqs || []).filter(req => req !== reward && req !== 'pickaxe' && req !== 'key');
      const reqs = availableReqs.length > 0
        ? shuffle(availableReqs, rng).slice(0, 1)
        : [standardItems[0].id];

      let color = e.color || '#2dd4bf';
      if (e.id.startsWith('mermaid') && !e.color) {
        const colors = ['#2dd4bf', '#f43f5e', '#f59e0b', '#a855f7'];
        color = colors[Math.floor(rng() * colors.length)];
      }

      return { ...e, requires: reqs, reqType: 'OR', reward, x: pos.x, y: pos.y, zone: pos.zone, isGatekeeper: false, color };
    });

    // 2. Guided Procedural Chain Construction to match targetSteps
    if (level.id === 'river_crossing' && traderEntities.length >= 6 && goalEntity && activeGatekeepers[0]) {
      const bridgeGate = activeGatekeepers[0];
      const z1Traders = shuffle(traderEntities.filter(t => t.zone === 1), rng);
      const z2Traders = shuffle(traderEntities.filter(t => t.zone === 2), rng);

      const neededTraders = Math.max(1, Math.min(6, (targetSteps || 5) - 2));
      const k2 = Math.min(z2Traders.length, neededTraders >= 5 ? 2 : (neededTraders >= 3 ? 1 : 0));
      const k1 = Math.min(z1Traders.length, Math.max(1, neededTraders - k2));

      const nonStartItems = shuffle(
        standardItems.map(i => i.id).filter(id => !startItems.includes(id)),
        rng
      );

      let itemCursor = 0;
      const nextChainItem = () => nonStartItems[itemCursor++ % nonStartItems.length];

      const lenA = Math.ceil(k1 / 2);
      const lenB = k1 - lenA;

      let prevA = startItems[0];
      for (let i = 0; i < lenA; i++) {
        const reward = nextChainItem();
        z1Traders[i].requires = [prevA];
        z1Traders[i].reqType = 'OR';
        z1Traders[i].reward = reward;
        prevA = reward;
      }

      let prevB = startItems[1];
      for (let i = 0; i < lenB; i++) {
        const trader = z1Traders[lenA + i];
        const reward = nextChainItem();
        trader.requires = [prevB];
        trader.reqType = 'OR';
        trader.reward = reward;
        prevB = reward;
      }

      bridgeGate.requires = [prevA, prevB];
      bridgeGate.reqType = 'AND';

      let prevZ2 = startItems[2];
      for (let i = 0; i < k2; i++) {
        const reward = nextChainItem();
        z2Traders[i].requires = [prevZ2];
        z2Traders[i].reqType = 'OR';
        z2Traders[i].reward = reward;
        prevZ2 = reward;
      }

      const secondGoalReq = level.mechanics.hasFish ? 'fish' : startItems[1];
      goalEntity.requires = [prevZ2, secondGoalReq];
      goalEntity.reqType = 'AND';

      // Configure remaining traders as non-shortcutting red herrings
      const chainRewardsUsed = new Set(nonStartItems.slice(0, itemCursor));
      const safeRedHerringPool = standardItems.map(i => i.id).filter(id => !chainRewardsUsed.has(id));
      const unusedTraders = [...z1Traders.slice(k1), ...z2Traders.slice(k2)];
      unusedTraders.forEach((t, i) => {
        const rhReward = safeRedHerringPool[i % safeRedHerringPool.length] || startItems[0];
        const rhReq = nonStartItems[(itemCursor + i) % nonStartItems.length] || startItems[2];
        t.requires = [rhReq];
        t.reqType = 'OR';
        t.reward = rhReward;
      });
    } else if (level.mechanics.isVertical && level.mechanics.hasPickaxe) {
      // Underground Cave: 9 rocks total, 3 preset pickaxes (Z1, Z3, Z6) + 6 trader pickaxes = 9 pickaxes.
      // Main right-branch path to Zone 9 needs 3 trader pickaxes (P1, P2, P3) + vault_rock (1 step) = 4 base steps.
      // Adding itemChainLen = max(0, targetSteps - 4) item-to-item trades before P3 yields exact targetSteps!
      const nonMushroomStartPool = shuffle(
        standardItems.map(i => i.id).filter(id => id !== 'mushroom'),
        rng
      );
      startItems[0] = nonMushroomStartPool[0];
      startItems[1] = nonMushroomStartPool[1];
      startItems[2] = nonMushroomStartPool[2];

      const chainPool = nonMushroomStartPool.slice(3);
      const itemChainLen = Math.max(0, Math.min(4, (targetSteps || 5) - 4));

      const byZone = (zones) => shuffle(traderEntities.filter(t => zones.includes(t.zone)), rng);
      const z1 = byZone([1]);
      const z3 = byZone([3]);
      const z5 = byZone([5]);
      const z6 = byZone([6]);
      const z7 = byZone([7]);
      const z8 = byZone([8]);
      const z2 = byZone([2]);
      const z4 = byZone([4]);

      const assigned = new Set();
      const takeFrom = (list) => {
        const found = list.find(t => !assigned.has(t.id));
        if (found) assigned.add(found.id);
        return found;
      };

      // Main-path pickaxe traders placed in zones guaranteed unlocked before the rock they open:
      // - Zone 1 preset opens rock_right_1 (Zone 3)
      // - Zone 3 preset opens rock_right_2 (Zone 5)
      // - p1 (in Zone 1, 3, or 5) opens rock_right_3 (Zone 6)
      // - Zone 6 preset opens rock_final_1 (Zone 7)
      // - p2 (in Zone 6 or 7) opens rock_final_2 (Zone 8)
      // - p3 (in Zone 6, 7, or 8) opens vault_rock (Zone 9)
      const p1 = takeFrom([...z5, ...z3, ...z1]);
      const p2 = takeFrom([...z7, ...z6]);
      const p3 = takeFrom([...z8, ...z7, ...z6]);

      // Build itemChainLen item traders in Zones 1, 3, 5, 6, 7 (never Zone 8) ordered by zone
      const chainCandidates = [...z1, ...z3, ...z5, ...z6, ...z7].filter(t => !assigned.has(t.id));
      const chainTraders = chainCandidates.slice(0, itemChainLen);
      chainTraders.forEach(t => assigned.add(t.id));
      chainTraders.sort((a, b) => a.zone - b.zone);

      let prevItem = startItems[0];
      const usedChainRewards = new Set();
      chainTraders.forEach((t, idx) => {
        const reward = chainPool[idx % chainPool.length];
        usedChainRewards.add(reward);
        t.requires = [prevItem];
        t.reqType = 'OR';
        t.reward = reward;
        prevItem = reward;
      });

      if (p1) {
        p1.requires = [startItems[1]];
        p1.reqType = 'OR';
        p1.reward = 'pickaxe';
      }
      if (p2) {
        p2.requires = [startItems[2]];
        p2.reqType = 'OR';
        p2.reward = 'pickaxe';
      }
      if (p3) {
        p3.requires = [itemChainLen > 0 ? prevItem : startItems[0]];
        p3.reqType = 'OR';
        p3.reward = 'pickaxe';
      }

      // Left-branch pickaxe reimbursement traders (Z1/Z2 -> Z2 -> Z4) so Left branch never soft-locks
      const leftPick1 = takeFrom([...z1, ...z2]);
      const leftPick2 = takeFrom([...z2]);
      const leftPick3 = takeFrom([...z4, ...z2]);
      const leftItemTrader = takeFrom([...z2, ...z4]);
      const leftBridgeItem = chainPool[(itemChainLen + 1) % chainPool.length];

      if (leftItemTrader) {
        leftItemTrader.requires = ['mushroom'];
        leftItemTrader.reqType = 'OR';
        leftItemTrader.reward = leftBridgeItem;
      }
      [leftPick1, leftPick2, leftPick3].filter(Boolean).forEach(t => {
        t.requires = [leftItemTrader ? leftBridgeItem : 'mushroom'];
        t.reqType = 'OR';
        t.reward = 'pickaxe';
      });

      // Remaining traders act as red herrings whose rewards do not short-circuit the main chain
      const forbiddenRewards = new Set([...usedChainRewards, startItems[0], startItems[1], startItems[2], prevItem]);
      const safeRewards = standardItems.map(i => i.id).filter(id => !forbiddenRewards.has(id));
      traderEntities.forEach((t, i) => {
        if (!assigned.has(t.id)) {
          const reward = safeRewards[i % safeRewards.length] || 'mushroom';
          t.reward = reward;
          t.requires = ['mushroom'];
          t.reqType = 'OR';
        }
      });
    } else {
      const firstStepEnt = traderEntities.find(e => e.zone === 1 && !e.isGatekeeper && !e.isPreset);
      if (firstStepEnt) {
        firstStepEnt.requires = [startItems[0]];
        firstStepEnt.reqType = 'OR';
        if (level.mechanics.hasPickaxe) firstStepEnt.reward = 'pickaxe';
      }
      if (level.mechanics.hasPickaxe) {
        const z1NonGoal = traderEntities.find(e => e.zone === 1 && !e.isGatekeeper && e.id !== goalTemplate.id && e.id !== firstStepEnt?.id);
        if (z1NonGoal) z1NonGoal.reward = 'pickaxe';
      }
    }

    const puzzleEntities = [...activeGatekeepers, ...presetEntities, ...traderEntities];
    const targetGoalId = (level.mechanics.isVertical && level.mechanics.hasPickaxe) ? 'vault_rock' : goalTemplate.id;

    // 3. Verify solvability and shortest-path step count with BFS Solver
    const currentState = solvePuzzle(startItems, puzzleEntities, targetGoalId, level);

    if (currentState) {
      const solutionPath = currentState.path;
      const solutionSteps = currentState.steps;

      hardcodedLayout.forEach(originalEntity => {
        if (!puzzleEntities.find(p => p.id === originalEntity.id)) {
          puzzleEntities.push(originalEntity);
        }
      });

      const candidate = { startItems, puzzleEntities, goalEntityId: targetGoalId, solution: solutionPath, steps: solutionSteps };

      if (solutionSteps >= targetSteps && solutionSteps <= targetSteps + 1) {
        return candidate;
      }

      const score = solutionSteps >= targetSteps
        ? (solutionSteps - targetSteps)
        : (targetSteps - solutionSteps) * 10;

      if (score < bestScore) {
        bestScore = score;
        bestPuzzle = candidate;
      }
    }
  }
  return bestPuzzle;
}
