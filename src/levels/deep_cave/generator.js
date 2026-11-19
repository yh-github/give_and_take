/**
 * Puzzle-First Procedural Level Generator for `deep_cave` ("The Abyssal Descent").
 *
 * Implements the 6-stage v2.0 pipeline:
 *   Stage 1: Mission Graph Synthesizer (DAG + encounter splicing + solvePuzzle check)
 *   Stage 2: Space Graph Mapper (3 x N slot grid + encounters + branches + spurs)
 *   Stage 3: Slot Fill & Tile Rasterization (procedural archetypes + encounter tileGrids)
 *   Stage 4: Contour Extraction & Collar-Preserving Simplification
 *   Stage 5: Entity Placement (rejection sampling for D_min >= 14.0, M_min >= 6.5)
 *   Stage 6: Verification Suite (solvePuzzle, findGlobalPath, collar sealing, spacing, visibility)
 */

import {
  DEEP_CAVE_CORRIDOR_MIN_WIDTH,
  DEEP_CAVE_GENERATOR_VERSION,
  DEEP_CAVE_HERO_RADIUS,
  DEEP_CAVE_MIN_ENTITY_DIST,
  DEEP_CAVE_MIN_WALL_MARGIN,
  DEEP_CAVE_SLOT_COLS
} from '../../constants.ts';
import { createRNG, shuffle } from '../../logic/rng.ts';
import { solvePuzzle } from '../../logic/solver.ts';
import { validateEntitySpacing, sanitizePuzzleEntities } from '../../logic/rules.ts';
import {
  checkCollision,
  getProceduralObstacleSegments,
  getVisibilityPolygon,
  isPointInVisibilityPolygon
} from '../../logic/visibility.ts';
import { checkBatchReachability, findGlobalPath, isPointInPolygon } from '../../logic/pathfinding.ts';
import { items as UNDERGROUND_ITEMS, entities as UNDERGROUND_ENTITIES } from './data.js';
import { ENCOUNTERS_BY_ID, DEEP_CAVE_ENCOUNTERS } from './encounters/index.js';
import { normalizeDeepCaveSettings } from './presets.js';
import {
  connectSlots,
  createEmptySlotGrid,
  getSlotCenter,
  getWorldDimensions,
  makeEdgeKey,
  rasterizeSlotGrid
} from './slotGrid.js';

const ITEM_META_BY_ID = Object.fromEntries(
  UNDERGROUND_ITEMS.map((item) => [item.id, { name: item.name, emoji: item.emoji }])
);
function getItemMeta(itemId, fallbackName = 'Item') {
  return ITEM_META_BY_ID[itemId] || { name: fallbackName, emoji: '📦' };
}

const TRADE_ITEMS = UNDERGROUND_ITEMS
  .map(i => i.id)
  .filter(id => id !== 'pickaxe' && id !== 'rope');

const TRADER_TEMPLATES = UNDERGROUND_ENTITIES.filter(e => e.id !== 'mole' && e.id !== 'troll');
const MOLE_TEMPLATE = UNDERGROUND_ENTITIES.find(e => e.id === 'mole') || {
  id: 'mole',
  name: 'Giant Mole',
  emoji: '🐭'
};

const GUARDIAN_TEMPLATES = [
  { id: 'troll', name: 'Cave Troll', emoji: '🧌' }
];

const ROCK_GATE_TEMPLATE = { id: 'rock', name: 'Rock', emoji: '🪨' };
const CHASM_GATE_TEMPLATE = { id: 'chasm', name: 'Chasm', emoji: '🕳️' };
const VAULT_TREASURE_TEMPLATE = { id: 'vault_treasure', name: 'Vault Treasure', emoji: '👑' };

const DIFFICULTY_RANK = { easy: 0, normal: 1, hard: 2, expert: 3, custom: 2 };

function pickOne(arr, rng) {
  return arr[Math.floor(rng() * arr.length)];
}

/**
 * Selects eligible curated encounters matching difficulty & grid height.
 */
function chooseEncounters(settings, rng) {
  let desiredCount = settings.encounterCount;
  // Match Table 7.2 preset encounter ranges when running standard Normal (1-2) / Expert (2-3)
  if (settings.preset === 'expert' && settings.encounterCount >= 3 && rng() < 0.45) {
    desiredCount = 2;
  } else if (settings.preset === 'normal' && settings.encounterCount >= 2 && rng() < 0.25) {
    desiredCount = 1;
  }
  const maxEncounters = Math.min(desiredCount, Math.max(0, settings.rows - 2));
  if (maxEncounters <= 0) return [];

  const diffRank = DIFFICULTY_RANK[settings.preset] ?? 2;
  const eligible = DEEP_CAVE_ENCOUNTERS.filter(enc => {
    const reqRank = DIFFICULTY_RANK[enc.placement?.minDifficulty || 'easy'] ?? 0;
    return reqRank <= diffRank;
  });

  const picked = [];
  const shuffled = shuffle(eligible, rng);
  // Keep total encounter internal steps strictly <= targetSteps - 1
  let usedInternalSteps = 0;
  for (const enc of shuffled) {
    if (picked.length >= maxEncounters) break;
    const encSteps = enc.puzzleFragment?.internalSteps || 0;
    if (usedInternalSteps + encSteps <= settings.targetSteps - 1) {
      picked.push(enc);
      usedInternalSteps += encSteps;
    }
  }
  return picked;
}

/**
 * Stage 2 Pre-Plan / Zone Layout:
 * Carves the `3 x rows` space graph first-class with Camp, Vault, encounters,
 * cross-branches, spurs, and doorway gatekeepers so every Zone knows its row tier.
 * Retried independently if an encounter or branch fails to fit.
 */
function buildSpaceBlueprint(settings, selectedEncounters, rng) {
  const rows = settings.rows;
  const slots = createEmptySlotGrid(rows);
  const encountersBySlot = new Map();

  // Place Camp at top-center (1, 0) for wide branching + surface shaft symmetry
  const campCol = 1;
  slots[0][campCol].active = true;
  slots[0][campCol].role = 'camp';
  let curCol = campCol;

  // Assign selected encounters cleanly to distinct intermediate rows [1 .. rows-2]
  const intermediateRows = [];
  for (let r = 1; r <= rows - 2; r++) intermediateRows.push(r);
  const encRowPool = shuffle(intermediateRows, rng).slice(0, selectedEncounters.length);
  const rowToEncounter = new Map();
  encRowPool.forEach((r, idx) => rowToEncounter.set(r, selectedEncounters[idx]));

  const spinePath = [{ col: curCol, row: 0 }];
  const encounterPlacements = [];

  for (let r = 1; r <= rows - 2; r++) {
    const enc = rowToEncounter.get(r);
    if (enc) {
      const fpCols = enc.footprint.cols;
      const entryOffset = enc.sockets.north[0]?.colOffset ?? 0;
      const exitOffset = enc.sockets.south[0]?.colOffset ?? 0;

      // Pick valid horizontal originCol so footprint fits [0..2] and curCol can align cleanly
      // Note: if curCol on row (r - 1) is an encounter slot (no E/W doorways), curCol CANNOT walk laterally on row (r - 1).
      const prevRowHasEncOnCur = Boolean(slots[r - 1][curCol].encounterId);
      const validOrigins = [];
      for (let oCol = 0; oCol <= DEEP_CAVE_SLOT_COLS - fpCols; oCol++) {
        const candidateEnter = oCol + entryOffset;
        if (prevRowHasEncOnCur && candidateEnter !== curCol) continue;
        // Check if curCol can reach candidateEnter without crossing an encounter on row (r - 1)
        let blocked = false;
        const step = candidateEnter > curCol ? 1 : -1;
        for (let c = curCol; c !== candidateEnter; c += step) {
          if (slots[r - 1][c].encounterId || slots[r - 1][c + step].encounterId) {
            blocked = true;
            break;
          }
        }
        if (!blocked) validOrigins.push(oCol);
      }
      if (validOrigins.length === 0) return null;

      // Avoid leaving curCol at an edge column if the next row ALSO has a multi-column encounter locked to curCol
      const nextEnc = rowToEncounter.get(r + 1);
      const fitsNextRow = (exitC) => {
        if (!nextEnc) return true;
        const nOff = nextEnc.sockets.north[0]?.colOffset ?? 0;
        const nOrig = exitC - nOff;
        return nOrig >= 0 && nOrig <= DEEP_CAVE_SLOT_COLS - nextEnc.footprint.cols;
      };
      const nextSafeOrigins = validOrigins.filter(o => fitsNextRow(o + exitOffset));
      const candidateOrigins = nextSafeOrigins.length > 0 ? nextSafeOrigins : validOrigins;

      // Prefer origin forcing a horizontal wing on Row 0 for targetSteps >= 7 (creates a clean Row-0 spine doorway)
      // while avoiding exitCol === 2 if another row remains for a 2x1 encounter
      const wantOffsetRow0 = r === 1 && settings.targetSteps >= 7;
      const offsetMatch = wantOffsetRow0
        ? candidateOrigins.find(o => o + entryOffset !== curCol && !(r < rows - 2 && o + exitOffset === 2))
        : undefined;
      const exactMatch = candidateOrigins.find(o => o + entryOffset === curCol && !(r < rows - 2 && o + exitOffset === 2));
      const chosenOrigin = offsetMatch !== undefined
        ? offsetMatch
        : (exactMatch !== undefined
          ? exactMatch
          : (candidateOrigins.includes(curCol - entryOffset) ? (curCol - entryOffset) : pickOne(candidateOrigins, rng)));
      const enterCol = chosenOrigin + entryOffset;

      while (curCol !== enterCol) {
        const nextC = enterCol > curCol ? curCol + 1 : curCol - 1;
        connectSlots(slots, curCol, r - 1, nextC, r - 1);
        spinePath.push({ col: nextC, row: r - 1 });
        curCol = nextC;
      }

      // Claim encounter footprint slots on row r
      for (let dc = 0; dc < fpCols; dc++) {
        const slot = slots[r][chosenOrigin + dc];
        slot.active = true;
        slot.role = 'encounter';
        slot.encounterId = enc.id;
        slot.encounterOrigin = { col: chosenOrigin, row: r };
      }

      connectSlots(slots, enterCol, r - 1, enterCol, r);
      const exitCol = chosenOrigin + exitOffset;
      spinePath.push({ col: enterCol, row: r, encounterId: enc.id });
      if (exitCol !== enterCol) {
        spinePath.push({ col: exitCol, row: r, encounterId: enc.id });
      }
      encounterPlacements.push({
        encounter: enc,
        originCol: chosenOrigin,
        originRow: r,
        enterCol,
        exitCol
      });
      curCol = exitCol;
    } else {
      // Pure procedural row along spine: descend straight down first, then shift horizontally on procedural row `r`
      connectSlots(slots, curCol, r - 1, curCol, r);
      spinePath.push({ col: curCol, row: r });
      let targetCol = Math.floor(rng() * DEEP_CAVE_SLOT_COLS);
      if (settings.targetSteps >= 12 && r > 0) {
        // On long chains (Hard/Expert), prefer full 2-column horizontal sweep across procedural rows (0->2 or 2->0)
        if (curCol === 0) targetCol = 2;
        else if (curCol === 2) targetCol = 0;
        else if (targetCol === curCol) targetCol = rng() < 0.5 ? 0 : 2;
      } else if (targetCol === curCol && settings.targetSteps >= 7) {
        const altCols = [0, 1, 2].filter(c => c !== curCol);
        targetCol = pickOne(altCols, rng);
      }
      while (curCol !== targetCol) {
        const nextC = targetCol > curCol ? curCol + 1 : curCol - 1;
        connectSlots(slots, curCol, r, nextC, r);
        spinePath.push({ col: nextC, row: r });
        curCol = nextC;
      }
    }
  }

  // Final descent from curCol on row (rows - 2) into Vault row (rows - 1)
  connectSlots(slots, curCol, rows - 2, curCol, rows - 1);
  const actualVaultCol = curCol;
  slots[rows - 1][actualVaultCol].role = 'vault';
  spinePath.push({ col: actualVaultCol, row: rows - 1, isVault: true });

  // Ensure Camp (Zone 1) has un-gated wing(s) on Row 0 so Camp & early trades never crowd at D_min >= 14.0
  if (settings.targetSteps >= 5) {
    const freeRow0Cols = [0, 2].filter(c => !slots[0][c].active && !slots[0][c].encounterId);
    if (freeRow0Cols.length > 0) {
      const wantWings = settings.targetSteps >= 8 ? Math.min(2, freeRow0Cols.length) : 1;
      for (const wingCol of shuffle(freeRow0Cols, rng).slice(0, wantWings)) {
        connectSlots(slots, campCol, 0, wingCol, 0);
        slots[0][wingCol].role = 'camp_wing';
      }
    }
  }

  // Carve branching channels & dead-end spurs from non-encounter active slots
  const extraEdges = [];
  const tryExpandNeighbors = (maxAdd, roleName) => {
    let added = 0;
    const candidates = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < DEEP_CAVE_SLOT_COLS; c++) {
        const s = slots[r][c];
        if (!s.active || s.encounterId || s.role === 'vault') continue;
        const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        for (const [dc, dr] of dirs) {
          const nc = c + dc;
          const nr = r + dr;
          if (nc < 0 || nc >= DEEP_CAVE_SLOT_COLS || nr < 0 || nr >= rows - 1) continue;
          const target = slots[nr][nc];
          if (target.encounterId) continue;
          if (!target.active) {
            candidates.push({ from: [c, r], to: [nc, nr] });
          }
        }
      }
    }
    // Prioritize expanding rows/zones that currently have fewer active non-encounter slots
    // so intermediate segments don't starve at 1 slot while Row 0 hoards branches.
    const rowFreeCount = Array.from({ length: rows }, (_, rr) =>
      slots[rr].filter(s => s.active && !s.encounterId && s.role !== 'vault').length
    );
    const prioritized = shuffle(candidates, rng).sort((a, b) => {
      const diff = (rowFreeCount[a.to[1]] + rowFreeCount[a.from[1]]) - (rowFreeCount[b.to[1]] + rowFreeCount[b.from[1]]);
      return diff;
    });
    for (const cand of prioritized) {
      if (added >= maxAdd) break;
      const [fc, fr] = cand.from;
      const [tc, tr] = cand.to;
      if (slots[tr][tc].active) continue;
      connectSlots(slots, fc, fr, tc, tr);
      slots[tr][tc].role = roleName;
      rowFreeCount[tr]++;
      extraEdges.push({ edgeKey: makeEdgeKey(fc, fr, tc, tr), from: [fc, fr], to: [tc, tr], role: roleName });
      added++;
    }
  };

  tryExpandNeighbors(settings.branchingFactor, 'branch');
  tryExpandNeighbors(settings.spurCount, 'spur');

  // Ensure sufficient non-encounter floor capacity so D_min >= 14.0 can always be satisfied
  let freeNonEncSlots = 0;
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < DEEP_CAVE_SLOT_COLS; c++) {
      if (slots[r][c].active && !slots[r][c].encounterId) freeNonEncSlots++;
    }
  }
  const minNeededSlots = Math.ceil((settings.targetSteps + settings.pickaxeSurplus + settings.decoyCount + 3) / 2);
  if (freeNonEncSlots < minNeededSlots) {
    tryExpandNeighbors(minNeededSlots - freeNonEncSlots, 'branch');
  }

  // Loop-erase `spinePath` so walked-back horizontal sweeps are NOT mistaken for mandatory spine edges
  const simpleSpinePath = [];
  const spineVisitedIdx = new Map();
  for (const node of spinePath) {
    const key = `${node.col},${node.row}`;
    if (spineVisitedIdx.has(key)) {
      simpleSpinePath.length = spineVisitedIdx.get(key) + 1;
      for (const [k, idx] of spineVisitedIdx.entries()) {
        if (idx > spineVisitedIdx.get(key)) spineVisitedIdx.delete(k);
      }
    } else {
      spineVisitedIdx.set(key, simpleSpinePath.length);
      simpleSpinePath.push(node);
    }
  }

  // Build exact ordered list of intermediate spine edges along simple Camp -> Vault spine
  // plus any non-vault vertical doorways on branches/spurs.
  const gatedEdges = new Map(); // edgeKey -> { edgeKey, fromZone, toZone, gateType, encounterRef }
  const spineDoorCandidates = [];
  const spineCandidateKeys = new Set();

  for (let i = 0; i < simpleSpinePath.length - 1; i++) {
    const a = simpleSpinePath[i];
    const b = simpleSpinePath[i + 1];
    if (Math.abs(a.col - b.col) + Math.abs(a.row - b.row) !== 1) continue;
    const sa = slots[a.row][a.col];
    const sb = slots[b.row][b.col];
    if (!sa.sockets[b.col > a.col ? 'E' : (b.col < a.col ? 'W' : (b.row > a.row ? 'S' : 'N'))]) continue;
    // Do not place doorway gates on guardian_lair south seam or internal 2x1 encounter seam
    if (sa.encounterId && sb.encounterId &&
        sa.encounterOrigin?.col === sb.encounterOrigin?.col &&
        sa.encounterOrigin?.row === sb.encounterOrigin?.row) continue;
    if ((sa.encounterId === 'guardian_lair' || sb.encounterId === 'guardian_lair') && a.row !== b.row) continue;

    const ek = makeEdgeKey(a.col, a.row, b.col, b.row);
    if (gatedEdges.has(ek)) continue;
    const isVaultEntry = sb.role === 'vault' || sa.role === 'vault';
    const gateObj = {
      edgeKey: ek,
      colA: Math.min(a.col, b.col),
      rowA: Math.min(a.row, b.row),
      colB: Math.max(a.col, b.col),
      rowB: Math.max(a.row, b.row),
      isVaultEntry,
      isHorizontalSpine: a.row === b.row,
      gateType: isVaultEntry ? 'guardian' : (rng() < 0.65 ? 'rock' : 'chasm')
    };
    gatedEdges.set(ek, gateObj);
    if (!isVaultEntry && !spineCandidateKeys.has(ek)) {
      spineCandidateKeys.add(ek);
      spineDoorCandidates.push(gateObj);
    }
  }

  // Also register any vertical branch/spur edges so branches can become gated side chambers if desired
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < DEEP_CAVE_SLOT_COLS; c++) {
      const top = slots[r][c];
      const bot = slots[r + 1][c];
      if (!top.active || !bot.active || !top.sockets.S) continue;
      if (bot.encounterId === 'guardian_lair' || top.encounterId === 'guardian_lair') continue;
      const key = makeEdgeKey(c, r, c, r + 1);
      if (!gatedEdges.has(key)) {
        const isVaultEntry = r + 1 === rows - 1 && c === actualVaultCol;
        gatedEdges.set(key, {
          edgeKey: key,
          colA: c,
          rowA: r,
          colB: c,
          rowB: r + 1,
          isVaultEntry,
          gateType: isVaultEntry ? 'guardian' : (rng() < 0.65 ? 'rock' : 'chasm')
        });
      }
    }
  }

  // Exact barrier subset optimizer: selects 0..3 guardian spine edges from `spineDoorCandidates`
  // so every isolated progression segment satisfies token uniqueness AND physical slot headroom.
  const grottoCount = encounterPlacements.filter(ep => ep.encounter.id === 'mushroom_grotto').length;
  const hasChasm = encounterPlacements.some(ep => ep.encounter.id === 'rope_chasm_bridge');
  const grottoSlotSet = new Set(
    encounterPlacements
      .filter(ep => ep.encounter.id === 'mushroom_grotto')
      .map(ep => `${ep.originCol},${ep.originRow}`)
  );
  const chasmRowSet = new Set(
    encounterPlacements
      .filter(ep => ep.encounter.id === 'rope_chasm_bridge')
      .map(ep => `${ep.originCol + 1},${ep.originRow}`)
  );
  const chainPoolSize = 6 - (settings.decoyCount > 0 ? 1 : 0); // Reserve 1 item when decoys active

  const evaluateGuardianSet = (guardianKeys) => {
    // Trace barriers along slots starting from (campCol, 0) stopping at guardianKeys + guardian_lair + vault
    const visited = Array.from({ length: rows }, () => Array(DEEP_CAVE_SLOT_COLS).fill(false));
    const queue = [{ c: campCol, r: 0 }];
    visited[0][campCol] = true;
    let totalSegs = 0;
    const segSummaries = [];

    const floodBarrierSeg = (startNodes, isRoot) => {
      const q = [...startNodes];
      const frontiers = [];
      let campCnt = 0;
      let regCnt = 0;
      let hasEncOut = false;
      while (q.length > 0) {
        const cur = q.shift();
        const s = slots[cur.r][cur.c];
        if (s.role === 'vault') continue;
        if (!s.encounterId) {
          if (s.role === 'camp') campCnt++;
          else regCnt++;
        }
        if (grottoSlotSet.has(`${cur.c},${cur.r}`) || chasmRowSet.has(`${cur.c},${cur.r}`)) {
          hasEncOut = true;
        }

        // Guardian_lair barrier (2x1 chamber) exits south via exitCol
        if (s.encounterId === 'guardian_lair') {
          const ep = encounterPlacements.find(p => p.encounter.id === 'guardian_lair' && p.originRow === cur.r);
          if (ep && cur.r + 1 < rows && slots[cur.r + 1][ep.exitCol]?.active && !visited[cur.r + 1][ep.exitCol]) {
            frontiers.push({ c: ep.exitCol, r: cur.r + 1 });
          }
        }
        // Rope_chasm_bridge transitions left ledge -> right ledge
        if (s.encounterId === 'rope_chasm_bridge') {
          const ep = encounterPlacements.find(p => p.encounter.id === 'rope_chasm_bridge' && p.originRow === cur.r);
          if (ep && cur.c === ep.enterCol && !visited[ep.originRow][ep.originCol + 1]) {
            visited[ep.originRow][ep.originCol + 1] = true;
            q.push({ c: ep.originCol + 1, r: ep.originRow });
          }
        }

        const dirs = [
          [cur.c + 1, cur.r, s.sockets.E],
          [cur.c - 1, cur.r, s.sockets.W],
          [cur.c, cur.r + 1, s.sockets.S],
          [cur.c, cur.r - 1, s.sockets.N]
        ];
        for (const [nc, nr, open] of dirs) {
          if (!open || nc < 0 || nc >= DEEP_CAVE_SLOT_COLS || nr < 0 || nr >= rows) continue;
          if (!slots[nr][nc].active || visited[nr][nc]) continue;
          if (s.encounterId === 'guardian_lair' && nr === cur.r + 1) continue;
          const ek = makeEdgeKey(cur.c, cur.r, nc, nr);
          const ge = gatedEdges.get(ek);
          if (guardianKeys.has(ek) || ge?.isVaultEntry) {
            frontiers.push({ c: nc, r: nr });
          } else {
            visited[nr][nc] = true;
            q.push({ c: nc, r: nr });
          }
        }
      }
      if (isRoot || frontiers.length > 0 || campCnt + regCnt > 0 || hasEncOut) {
        segSummaries.push({ campCnt, regCnt, hasEncOut, isEmpty: campCnt + regCnt === 0 });
      }
      return frontiers;
    };

    const frontierQ = [queue];
    let firstSeg = true;
    while (frontierQ.length > 0) {
      const seeds = frontierQ.shift().filter(n => !visited[n.r][n.c] && slots[n.r][n.c].role !== 'vault');
      if (seeds.length === 0 && !firstSeg) continue;
      for (const n of seeds) visited[n.r][n.c] = true;
      const nextF = floodBarrierSeg(firstSeg ? queue : seeds, firstSeg);
      firstSeg = false;
      for (const fn of nextF) {
        if (!visited[fn.r][fn.c] && slots[fn.r][fn.c].role !== 'vault') {
          frontierQ.push([fn]);
        }
      }
    }

    totalSegs = segSummaries.length;
    if (totalSegs === 0) return { feasible: false, deficit: 99, minNonEmptyPhys: 0 };
    const neededBarter = settings.targetSteps - totalSegs - grottoCount;
    if (neededBarter < 0) return { feasible: false, deficit: 99, minNonEmptyPhys: 0 };

    let totalCap = 0;
    let minCap = Infinity;
    for (let sIdx = 0; sIdx < totalSegs; sIdx++) {
      const seg = segSummaries[sIdx];
      if (seg.isEmpty) {
        if (!seg.hasEncOut || sIdx === 0) return { feasible: false, deficit: 99, minNonEmptyPhys: 0 };
        continue;
      }
      const rawPhys = seg.campCnt + seg.regCnt * 2;
      const reserve = sIdx === 0 ? (totalSegs > 1 && settings.targetSteps >= 9 && rawPhys >= 5 ? 2 : 1) : 1;
      const physMax = Math.max(0, rawPhys - reserve);
      const tokenMax = Math.max(0, chainPoolSize - (seg.hasEncOut ? 1 : 0) - (sIdx === 0 ? 2 : 1));
      const cap = Math.min(physMax, tokenMax);
      totalCap += cap;
      if (cap < minCap) minCap = cap;
    }

    return {
      feasible: totalCap >= neededBarter,
      deficit: Math.max(0, neededBarter - totalCap),
      margin: totalCap - neededBarter,
      minCap: minCap === Infinity ? 0 : minCap,
      segCount: totalSegs
    };
  };

  // Enumerate subsets of size 0..3 over `spineDoorCandidates` (at most ~100 checks, <0.2ms)
  const candCount = spineDoorCandidates.length;
  const maxPick = Math.min(3, candCount);
  const desiredSegTarget = settings.targetSteps >= 15 ? 4 : (settings.targetSteps >= 10 ? 3 : (settings.targetSteps >= 7 ? 2 : 1));
  let bestGuardianSet = new Set();
  let bestScore = -Infinity;

  const tryCombo = (keys) => {
    const ev = evaluateGuardianSet(keys);
    if (!ev.feasible) return;
    // Prefer feasible splits with healthy min segment capacity & barrier count close to desiredSegTarget
    const score =
      ev.minCap * 20 -
      Math.abs(ev.segCount - desiredSegTarget) * 12 +
      Math.min(4, ev.margin) * 3;
    if (score > bestScore) {
      bestScore = score;
      bestGuardianSet = new Set(keys);
    }
  };

  tryCombo(new Set());
  for (let a = 0; a < candCount; a++) {
    const ka = spineDoorCandidates[a].edgeKey;
    tryCombo(new Set([ka]));
    if (maxPick >= 2) {
      for (let b = a + 1; b < candCount; b++) {
        const kb = spineDoorCandidates[b].edgeKey;
        tryCombo(new Set([ka, kb]));
        if (maxPick >= 3) {
          for (let c = b + 1; c < candCount; c++) {
            tryCombo(new Set([ka, kb, spineDoorCandidates[c].edgeKey]));
          }
        }
      }
    }
  }

  if (bestScore === -Infinity) return null;

  for (const edge of spineDoorCandidates) {
    if (bestGuardianSet.has(edge.edgeKey)) {
      edge.gateType = 'guardian';
    } else if (edge.gateType === 'guardian') {
      edge.gateType = 'rock';
    }
  }

  // Keep only 1-2 extra rock/chasm doorway gates (rest remain open multi-slot passages)
  const maxSpineToolDoors = settings.targetSteps >= 12 ? 2 : 1;
  const nonGuardianDoors = shuffle(
    Array.from(gatedEdges.values()).filter(e => !e.isVaultEntry && e.gateType !== 'guardian'),
    rng
  );
  for (let i = maxSpineToolDoors; i < nonGuardianDoors.length; i++) {
    gatedEdges.delete(nonGuardianDoors[i].edgeKey);
  }

  // Optionally gate a small fraction of off-row-0 spur edges as locked tool caches
  const spurGateProb = settings.targetSteps <= 6 ? 0 : (settings.targetSteps >= 12 ? 0.12 : 0.35);
  for (const extra of extraEdges) {
    if (extra.role === 'spur' && extra.from[1] > 0 && rng() < spurGateProb && !gatedEdges.has(extra.edgeKey)) {
      gatedEdges.set(extra.edgeKey, {
        edgeKey: extra.edgeKey,
        colA: extra.from[0],
        rowA: extra.from[1],
        colB: extra.to[0],
        rowB: extra.to[1],
        isSpurGate: true,
        gateType: rng() < 0.7 ? 'rock' : 'chasm'
      });
    }
  }

  // Partition connected components into Zone IDs (1 = Camp) via BFS stopping at gated doorways
  const slotZone = Array.from({ length: rows }, () => Array(DEEP_CAVE_SLOT_COLS).fill(null));
  const zoneMeta = new Map(); // zoneId -> { id, minRow, maxRow, slots: [], parentZone, gateInfo }
  let nextZoneId = 1;

  const floodZone = (startCol, startRow, zoneId, parentZone = null, gateInfo = null) => {
    const queue = [{ col: startCol, row: startRow }];
    slotZone[startRow][startCol] = zoneId;
    slots[startRow][startCol].zone = zoneId;
    const zInfo = {
      id: zoneId,
      minRow: startRow,
      maxRow: startRow,
      slots: [{ col: startCol, row: startRow }],
      parentZone,
      gateInfo,
      isVaultZone: slots[startRow][startCol].role === 'vault'
    };
    zoneMeta.set(zoneId, zInfo);

    const frontier = [];
    while (queue.length > 0) {
      const cur = queue.shift();
      const s = slots[cur.row][cur.col];
      zInfo.minRow = Math.min(zInfo.minRow, cur.row);
      zInfo.maxRow = Math.max(zInfo.maxRow, cur.row);
      if (s.role === 'vault') zInfo.isVaultZone = true;

      // Encounter internal gating:
      // - guardian_lair gates transition from this chamber to the row below (originRow + 1)
      // - rope_chasm_bridge gates transition from left ledge (originCol) to right ledge (originCol + 1)
      if (s.encounterId === 'guardian_lair' || s.encounterId === 'rope_chasm_bridge') {
        const encInfo = encounterPlacements.find(ep =>
          ep.encounter.id === s.encounterId &&
          ep.originRow === s.encounterOrigin?.row &&
          ep.originCol === s.encounterOrigin?.col
        );
        if (encInfo && cur.col === encInfo.enterCol && !encInfo._frontierQueued) {
          encInfo._frontierQueued = true;
          const toCol = s.encounterId === 'rope_chasm_bridge' ? (encInfo.originCol + 1) : encInfo.exitCol;
          const toRow = s.encounterId === 'rope_chasm_bridge' ? encInfo.originRow : (encInfo.originRow + 1);
          if (toRow < rows && slots[toRow]?.[toCol]?.active) {
            frontier.push({
              fromCol: cur.col,
              fromRow: encInfo.originRow,
              toCol,
              toRow,
              fromZone: zoneId,
              internalEncounter: encInfo
            });
          }
        }
      }

      const neighbors = [
        [cur.col + 1, cur.row, s.sockets.E],
        [cur.col - 1, cur.row, s.sockets.W],
        [cur.col, cur.row + 1, s.sockets.S],
        [cur.col, cur.row - 1, s.sockets.N]
      ];
      for (const [nc, nr, open] of neighbors) {
        if (!open || nc < 0 || nc >= DEEP_CAVE_SLOT_COLS || nr < 0 || nr >= rows) continue;
        if (!slots[nr][nc].active || slotZone[nr][nc] !== null) continue;
        // Internal guardian_lair south exit MUST transition only via its frontier (never leak freely into next row)
        if (s.encounterId === 'guardian_lair' && nr === cur.row + 1) continue;
        const ek = makeEdgeKey(cur.col, cur.row, nc, nr);
        const gate = gatedEdges.get(ek);
        if (gate) {
          frontier.push({
            fromCol: cur.col,
            fromRow: cur.row,
            toCol: nc,
            toRow: nr,
            fromZone: zoneId,
            edgeGate: gate
          });
        } else {
          // If mushroom_grotto, slot 1 is inside the grotto pocket behind internal rock!
          // Keep grotto origin slot in parent zone and assign pocket slot dynamically during entity placement
          slotZone[nr][nc] = zoneId;
          slots[nr][nc].zone = zoneId;
          queue.push({ col: nc, row: nr });
          zInfo.slots.push({ col: nc, row: nr });
        }
      }
    }
    return frontier;
  };

  const pendingFrontiers = floodZone(campCol, 0, nextZoneId++);
  while (pendingFrontiers.length > 0) {
    const f = pendingFrontiers.shift();
    if (slotZone[f.toRow][f.toCol] !== null) continue;
    const zId = nextZoneId++;
    if (f.edgeGate) {
      f.edgeGate.fromZone = f.fromZone;
      f.edgeGate.toZone = zId;
    } else if (f.internalEncounter) {
      f.internalEncounter.fromZone = f.fromZone;
      f.internalEncounter.toZone = zId;
    }
    const more = floodZone(f.toCol, f.toRow, zId, f.fromZone, f.edgeGate || f.internalEncounter);
    pendingFrontiers.push(...more);
  }

  // Assign pocket zone IDs for mushroom_grotto encounters
  for (const ep of encounterPlacements) {
    if (ep.encounter.id === 'mushroom_grotto') {
      const mainZone = slots[ep.originRow][ep.originCol].zone;
      const pocketZoneId = nextZoneId++;
      ep.fromZone = mainZone;
      ep.toZone = pocketZoneId;
      zoneMeta.set(pocketZoneId, {
        id: pocketZoneId,
        minRow: ep.originRow,
        maxRow: ep.originRow,
        slots: [{ col: ep.originCol + 1, row: ep.originRow }],
        parentZone: mainZone,
        gateInfo: ep,
        isGrottoPocket: true
      });
    }
  }

  // Locate vault zone & depth order of non-vault zones
  let vaultZoneId = null;
  for (const z of zoneMeta.values()) {
    if (z.isVaultZone) {
      vaultZoneId = z.id;
      break;
    }
  }
  // Also protect guardian_lair south exit in case guardian_lair has to wait for its frontier
  if (!vaultZoneId || vaultZoneId === 1) return null;
  if (encounterPlacements.some(ep => ep.fromZone == null || ep.toZone == null)) return null;

  return {
    rows,
    slots,
    campCol,
    vaultCol: actualVaultCol,
    vaultZoneId,
    zoneMeta,
    gatedEdges: Array.from(gatedEdges.values()),
    encounterPlacements,
    maxZoneId: nextZoneId - 1
  };
}

/**
 * Stage 1: Synthesizes an abstract solvable Mission Graph of exact step count
 * matching `(settings, blueprint)` and validates via `solvePuzzle`.
 */
function synthesizeMissionGraph(settings, blueprint, levelStub, rng) {
  const { zoneMeta, vaultZoneId, gatedEdges, encounterPlacements } = blueprint;

  const regularZones = Array.from(zoneMeta.values())
    .filter(z =>
      z.id !== vaultZoneId &&
      !z.isGrottoPocket &&
      z.slots.some(sl => !blueprint.slots[sl.row][sl.col].encounterId && blueprint.slots[sl.row][sl.col].role !== 'vault')
    )
    .sort((a, b) => a.id - b.id);
  if (regularZones.length === 0) return { ok: false, structural: true, reason: 'NULL_NO_REG_ZONES' };

  // Track reliable floor capacity per zone: camp=1, regular slot=2 (+1 open seam bonus only if >=2 regular slots)
  const zoneRemainingCapacity = new Map();
  const zonePhysicalSlack = new Map();
  for (const z of regularZones) {
    let regCount = 0;
    let campCount = 0;
    for (const sl of z.slots) {
      const slotObj = blueprint.slots[sl.row][sl.col];
      if (!slotObj.encounterId && slotObj.role !== 'vault') {
        if (slotObj.role === 'camp') campCount++;
        else regCount++;
      }
    }
    const baseCap = campCount + regCount * 2;
    zoneRemainingCapacity.set(z.id, baseCap);
    zonePhysicalSlack.set(z.id, baseCap);
  }
  const consumeZoneSlot = (zId) => {
    zoneRemainingCapacity.set(zId, (zoneRemainingCapacity.get(zId) ?? 0) - 1);
    zonePhysicalSlack.set(zId, (zonePhysicalSlack.get(zId) ?? 0) - 1);
  };
  const pickCapacityZone = (preferredList) => {
    const withSoft = preferredList.filter(z => (zoneRemainingCapacity.get(z.id) || 0) > 0);
    let chosen;
    if (withSoft.length > 0) {
      chosen = pickOne(withSoft, rng);
    } else {
      const withPhys = preferredList.filter(z => (zonePhysicalSlack.get(z.id) || 0) > 0);
      chosen = withPhys.length > 0
        ? [...withPhys].sort((a, b) => (zonePhysicalSlack.get(b.id) || 0) - (zonePhysicalSlack.get(a.id) || 0))[0]
        : [...preferredList].sort((a, b) => (zonePhysicalSlack.get(b.id) ?? -99) - (zonePhysicalSlack.get(a.id) ?? -99))[0];
    }
    consumeZoneSlot(chosen.id);
    return chosen.id;
  };

  const doorwayGates = gatedEdges.map(g => ({ ...g }));
  if (doorwayGates.some(g => g.fromZone == null || g.toZone == null)) return { ok: false, structural: true, reason: 'NULL_UNZONED_DOOR' };

  const grottos = encounterPlacements.filter(ep => ep.encounter.id === 'mushroom_grotto');
  const chasms = encounterPlacements.filter(ep => ep.encounter.id === 'rope_chasm_bridge');
  const guardianLairList = encounterPlacements.filter(ep => ep.encounter.id === 'guardian_lair');

  // Build exact directed zone tree from Camp (Zone 1)
  const allTreeEdges = [];
  for (const g of doorwayGates) {
    allTreeEdges.push({
      edgeId: `door:${g.edgeKey}`,
      kind: 'doorway',
      gate: g,
      fromZone: g.fromZone,
      toZone: g.toZone,
      isFinal: Boolean(g.isVaultEntry)
    });
  }
  for (const ep of guardianLairList) {
    allTreeEdges.push({
      edgeId: `lair:${ep.originCol},${ep.originRow}`,
      kind: 'guardian_lair',
      encounter: ep,
      fromZone: ep.fromZone,
      toZone: ep.toZone,
      isFinal: ep.toZone === vaultZoneId
    });
  }
  for (const ep of chasms) {
    allTreeEdges.push({
      edgeId: `chasm_enc:${ep.originCol},${ep.originRow}`,
      kind: 'chasm_enc',
      encounter: ep,
      fromZone: ep.fromZone,
      toZone: ep.toZone,
      isFinal: false
    });
  }
  for (const ep of grottos) {
    allTreeEdges.push({
      edgeId: `grotto_enc:${ep.originCol},${ep.originRow}`,
      kind: 'grotto_enc',
      encounter: ep,
      fromZone: ep.fromZone,
      toZone: ep.toZone,
      isFinal: false
    });
  }

  const childrenByZone = new Map();
  const parentEdgeByZone = new Map();
  for (const edge of allTreeEdges) {
    if (!childrenByZone.has(edge.fromZone)) childrenByZone.set(edge.fromZone, []);
    childrenByZone.get(edge.fromZone).push(edge);
    parentEdgeByZone.set(edge.toZone, edge);
  }

  // Trace exact ordered spine edges from Camp (Zone 1) -> Vault (vaultZoneId)
  const spineEdgesRev = [];
  let walkZ = vaultZoneId;
  const seenWalk = new Set([walkZ]);
  while (walkZ !== 1) {
    const pe = parentEdgeByZone.get(walkZ);
    if (!pe || seenWalk.has(pe.fromZone)) return null;
    spineEdgesRev.push(pe);
    walkZ = pe.fromZone;
    seenWalk.add(walkZ);
  }
  const spineEdges = spineEdgesRev.reverse();
  const spineEdgeIds = new Set(spineEdges.map(e => e.edgeId));

  // Any off-spine doorway gate must NOT be a guardian (solver would skip it or get inconsistent steps)
  for (const edge of allTreeEdges) {
    if (edge.kind === 'doorway' && !spineEdgeIds.has(edge.edgeId) && edge.gate.gateType === 'guardian') {
      edge.gate.gateType = 'rock';
    }
    // Any off-spine guardian_lair cannot cleanly act as mandatory progression barrier
    if (edge.kind === 'guardian_lair' && !spineEdgeIds.has(edge.edgeId)) {
      return null;
    }
  }

  const grottoSteps = grottos.length;
  const finalSpineEdge = spineEdges[spineEdges.length - 1];
  if (!finalSpineEdge) return null;
  finalSpineEdge.isFinal = true;
  if (finalSpineEdge.kind === 'doorway') {
    finalSpineEdge.gate.gateType = 'guardian';
    finalSpineEdge.gate.isVaultEntry = true;
  }

  const isBarrierEdge = (e) =>
    e.isFinal ||
    e.kind === 'guardian_lair' ||
    (e.kind === 'doorway' && e.gate.gateType === 'guardian');

  // Helper: partition all zones into ordered segments between `barrierList` via graph BFS
  const buildSegmentsFromBarriers = (barrierList) => {
    const barrierSet = new Set(barrierList.map(b => b.edgeId));
    const segs = [];
    for (let i = 0; i < barrierList.length; i++) {
      const startZ = i === 0 ? 1 : barrierList[i - 1].toZone;
      const b = barrierList[i];
      const q = [startZ];
      const visited = new Set([startZ]);
      const zones = [];
      const allZoneIds = new Set();
      while (q.length > 0) {
        const zId = q.shift();
        if (zId === vaultZoneId) continue;
        allZoneIds.add(zId);
        const meta = zoneMeta.get(zId);
        if (
          meta &&
          !meta.isGrottoPocket &&
          meta.slots.some(sl => !blueprint.slots[sl.row][sl.col].encounterId && blueprint.slots[sl.row][sl.col].role !== 'vault')
        ) {
          zones.push(meta);
        }
        const outEdges = childrenByZone.get(zId) || [];
        for (const edge of outEdges) {
          if (barrierSet.has(edge.edgeId)) continue;
          if (!visited.has(edge.toZone)) {
            visited.add(edge.toZone);
            q.push(edge.toZone);
          }
        }
      }
      segs.push({ segIdx: i, barrier: b, startZ, zones, allZoneIds });
    }
    return segs;
  };

  // Promote spine doorways until non-empty segment capacity comfortably covers totalBarterSteps
  let activeBarriers = spineEdges.filter(isBarrierEdge);
  const promotableSpineDoors = spineEdges.filter(
    e => !e.isFinal && e.kind === 'doorway' && e.gate.gateType !== 'guardian'
  );

  const chainItemPoolCount = TRADE_ITEMS.filter(id => id !== 'mushroom').length - (settings.decoyCount > 0 ? 1 : 0);
  const segHasEncOut = (s) =>
    chasms.some(ep => s.allZoneIds.has(ep.toZone) || s.allZoneIds.has(ep.fromZone)) ||
    grottos.some(ep => s.allZoneIds.has(ep.fromZone));
  const countNonEmptySegs = (segs) => segs.filter(s => s.zones.length > 0).length;
  const computeStrictCap = (segs) =>
    segs.reduce((sum, s, i) => {
      if (s.zones.length === 0) return sum;
      const outPenalty = segHasEncOut(s) ? 1 : 0;
      const initPenalty = i === 0 ? 2 : 1;
      const tokenMax = Math.max(0, chainItemPoolCount - outPenalty - initPenalty);
      const rawPhys = s.zones.reduce((zSum, z) => zSum + (zonePhysicalSlack.get(z.id) || 0), 0);
      const reserve = i === 0
        ? (segs.length > 1 && settings.targetSteps >= 9 && rawPhys >= 5 ? 2 : 1)
        : 1;
      const physMax = Math.max(0, rawPhys - reserve);
      return sum + Math.min(tokenMax, physMax);
    }, 0);

  for (const doorEdge of promotableSpineDoors) {
    const curSegs = buildSegmentsFromBarriers(activeBarriers);
    const curNonEmpty = countNonEmptySegs(curSegs);
    const curBarter = settings.targetSteps - activeBarriers.length - grottoSteps;
    const curCap = computeStrictCap(curSegs);
    if (curCap >= curBarter) {
      break;
    }
    if (curBarter - 1 < 0) break;

    doorEdge.gate.gateType = 'guardian';
    const nextBarriers = spineEdges.filter(isBarrierEdge);
    const probeSegs = buildSegmentsFromBarriers(nextBarriers);
    const nextNonEmpty = countNonEmptySegs(probeSegs);
    const anyInvalidEmpty = probeSegs.some(s => {
      if (s.zones.length > 0) return false;
      return !segHasEncOut(s) || s.segIdx === 0;
    });

    if (!anyInvalidEmpty && nextNonEmpty > curNonEmpty) {
      activeBarriers = nextBarriers;
    } else {
      doorEdge.gate.gateType = 'rock';
    }
  }

  // Demote intermediate doorway guardians that leave empty segments or negative barter steps
  let segments = buildSegmentsFromBarriers(activeBarriers);
  let changed = true;
  while (changed) {
    changed = false;
    const totalBarter = settings.targetSteps - activeBarriers.length - grottoSteps;
    const emptyIdx = segments.findIndex(s => s.zones.length === 0 && (!segHasEncOut(s) || s.segIdx === 0));
    if (emptyIdx !== -1) {
      const seg = segments[emptyIdx];
      // Prefer demoting preceding doorway barrier if it isolated an empty / guardian_lair / final encounter segment
      if (emptyIdx > 0 && segments[emptyIdx - 1].barrier.kind === 'doorway') {
        segments[emptyIdx - 1].barrier.gate.gateType = 'rock';
        activeBarriers = spineEdges.filter(isBarrierEdge);
        segments = buildSegmentsFromBarriers(activeBarriers);
        changed = true;
        continue;
      }
      if (!seg.barrier.isFinal && seg.barrier.kind === 'doorway') {
        seg.barrier.gate.gateType = 'rock';
        activeBarriers = spineEdges.filter(isBarrierEdge);
        segments = buildSegmentsFromBarriers(activeBarriers);
        changed = true;
        continue;
      }
    }
    if (activeBarriers.length > 1 && totalBarter < 0) {
      const demoteB = activeBarriers.find(b => !b.isFinal && b.kind === 'doorway');
      if (demoteB) {
        demoteB.gate.gateType = 'rock';
        activeBarriers = spineEdges.filter(isBarrierEdge);
        segments = buildSegmentsFromBarriers(activeBarriers);
        changed = true;
      }
    }
  }

  const totalBarterSteps = settings.targetSteps - segments.length - grottoSteps;
  if (totalBarterSteps < 0) return { ok: false, structural: true, reason: 'NULL_NEG_BARTER' };

  // Map every zoneId cleanly to its containing segment index
  const zoneToSegIdx = new Map();
  for (const seg of segments) {
    for (const zId of seg.allZoneIds) {
      zoneToSegIdx.set(zId, seg.segIdx);
    }
  }

  // Validate any zero-slot segment has an encounter output (e.g. grotto/chasm) to feed its barrier with 0 barter trades
  for (const seg of segments) {
    if (seg.zones.length === 0) {
      const hasEncOut =
        chasms.some(ep => seg.allZoneIds.has(ep.toZone) || seg.allZoneIds.has(ep.fromZone)) ||
        grottos.some(ep => seg.allZoneIds.has(ep.fromZone));
      if (!hasEncOut || seg.segIdx === 0) return { ok: false, structural: true, reason: 'NULL_EMPTY_SEG' };
    }
  }

  // Determine per-segment grotto/chasm presence and max chain capacity
  // Always reserve 1 unused decoy/cache item so extra caches & decoys never leak or collide with chain items
  const NON_MUSHROOM_TRADE_ITEMS = TRADE_ITEMS.filter(id => id !== 'mushroom');
  const shuffledPool = shuffle(NON_MUSHROOM_TRADE_ITEMS, rng);
  const decoySinkItem = shuffledPool[0];
  const CHAIN_ITEMS = shuffledPool.slice(1); // 5 items; disjoint from decoySinkItem

  // Setup encounter internals; ensure at most 1 required encounter output per segment so bag <= 4 slots always holds!
  const entitySpecs = [];
  let entitySeq = 1;
  let diggersAssigned = 0;
  const toolInputs = [];
  const segOutputsBySegIdx = Array.from({ length: segments.length }, () => []);
  const pendingChasmCaches = [];

  for (const ep of chasms) {
    toolInputs.push({ itemId: 'rope', fromZone: ep.fromZone, segIdx: zoneToSegIdx.get(ep.fromZone) ?? 0 });
    entitySpecs.push({
      kind: 'encounter_gate',
      encounter: ep,
      anchorType: 'L',
      anchorIndex: 0,
      id: `chasm_enc_${entitySeq++}`,
      name: CHASM_GATE_TEMPLATE.name,
      emoji: CHASM_GATE_TEMPLATE.emoji,
      requires: ['rope'],
      reqType: 'AND',
      reward: null,
      zone: ep.fromZone,
      unlocksZones: [ep.toZone],
      isGatekeeper: true,
      gateType: 'chasm'
    });
    const sIdx = zoneToSegIdx.get(ep.toZone) ?? zoneToSegIdx.get(ep.fromZone) ?? (segments.length - 1);
    pendingChasmCaches.push({ ep, segIdx: sIdx });
  }

  for (const ep of grottos) {
    const sIdx = zoneToSegIdx.get(ep.fromZone) ?? 0;
    toolInputs.push({ itemId: 'pickaxe', fromZone: ep.fromZone, segIdx: sIdx });
    entitySpecs.push({
      kind: 'encounter_gate',
      encounter: ep,
      anchorType: 'G',
      anchorIndex: 0,
      id: `grotto_rock_${entitySeq++}`,
      name: ROCK_GATE_TEMPLATE.name,
      emoji: ROCK_GATE_TEMPLATE.emoji,
      requires: ['pickaxe'],
      reqType: 'AND',
      reward: null,
      zone: ep.fromZone,
      unlocksZones: [ep.toZone],
      isGatekeeper: true,
      gateType: 'rock'
    });
    const mushMeta = getItemMeta('mushroom', 'Mushroom');
    // E anchors sorted left->right: index 0 = outer hall (fromZone), index 1 = locked grotto pocket (toZone)
    entitySpecs.push({
      kind: 'encounter_item',
      encounter: ep,
      anchorType: 'E',
      anchorIndex: 1,
      id: `mushroom_enc_${entitySeq++}`,
      name: mushMeta.name,
      emoji: mushMeta.emoji,
      isPreset: 'mushroom',
      requires: [],
      reqType: 'AND',
      reward: 'mushroom',
      zone: ep.toZone
    });
    const outReward = pickOne(CHAIN_ITEMS, rng);
    const tpl = pickOne(TRADER_TEMPLATES, rng);
    entitySpecs.push({
      kind: 'encounter_trader',
      encounter: ep,
      anchorType: 'E',
      anchorIndex: 0,
      id: `${tpl.id}_enc_${entitySeq++}`,
      name: tpl.name,
      emoji: tpl.emoji,
      requires: ['mushroom'],
      reqType: 'AND',
      reward: outReward,
      zone: ep.fromZone
    });
    segOutputsBySegIdx[sIdx].push(outReward);
  }

  // Instantiate chasm caches: if a segment already has a grotto output (or if the chasm exit zone directly hosts the segment barrier),
  // make the chasm chest an un-required cache (using decoySinkItem) so total simultaneous held items NEVER exceeds 4
  // and no barrier guardian ever shares a zone with an unguarded floor pickup matching its requirement.
  for (const { ep, segIdx } of pendingChasmCaches) {
    const segAlreadyHasOutput = segOutputsBySegIdx[segIdx].length > 0;
    const segBarrierInSameZone = segments[segIdx]?.barrier?.fromZone === ep.toZone;
    let bonusReward;
    if (!segAlreadyHasOutput && !segBarrierInSameZone) {
      bonusReward = pickOne(CHAIN_ITEMS, rng);
      segOutputsBySegIdx[segIdx].push(bonusReward);
    } else {
      bonusReward = decoySinkItem;
    }
    const cacheMeta = getItemMeta(bonusReward, 'Cache Item');
    entitySpecs.push({
      kind: 'encounter_cache',
      encounter: ep,
      anchorType: 'E',
      anchorIndex: 0,
      id: `cache_enc_${entitySeq++}`,
      name: cacheMeta.name,
      emoji: cacheMeta.emoji,
      requires: [],
      reqType: 'AND',
      isPreset: bonusReward,
      reward: bonusReward,
      zone: ep.toZone
    });
  }

  // Instantiate non-barrier doorway gates (rocks and chasms)
  for (const gate of doorwayGates) {
    if (gate.isVaultEntry || gate.gateType === 'guardian') continue;
    const tool = gate.gateType === 'chasm' ? 'rope' : 'pickaxe';
    const tpl = gate.gateType === 'chasm' ? CHASM_GATE_TEMPLATE : ROCK_GATE_TEMPLATE;
    toolInputs.push({
      itemId: tool,
      fromZone: gate.fromZone,
      segIdx: zoneToSegIdx.get(gate.fromZone) ?? 0
    });
    entitySpecs.push({
      kind: 'doorway_gate',
      edgeKey: gate.edgeKey,
      id: `${gate.gateType}_${entitySeq++}`,
      name: tpl.name,
      emoji: tpl.emoji,
      requires: [tool],
      reqType: 'AND',
      reward: null,
      zone: gate.fromZone,
      unlocksZones: [gate.toZone],
      isGatekeeper: true,
      gateType: gate.gateType
    });
  }

  // Compute ancestor chain (in strict topological order from Zone 1 -> fromZone) for acyclic tool placement
  const getAncestorZoneIds = (fromZone) => {
    const ancestors = [];
    let cur = fromZone;
    const guard = new Set();
    while (cur != null && !guard.has(cur)) {
      ancestors.push(cur);
      guard.add(cur);
      if (cur === 1) break;
      const pe = parentEdgeByZone.get(cur);
      cur = pe ? pe.fromZone : null;
    }
    return ancestors; // [fromZone, ..., 1]
  };

  // Distribute `totalBarterSteps` across non-empty segments respecting BOTH token uniqueness and physical slot space
  const segPhysCaps = segments.map((seg, sIdx) => {
    const rawPhys = seg.zones.reduce((sum, z) => sum + (zonePhysicalSlack.get(z.id) || 0), 0);
    // Reserve headroom in Segment 0 for starting tools when spacious, and 1 spot in deeper segments for seg_s_cache
    const reserve = sIdx === 0
      ? (segments.length > 1 && settings.targetSteps >= 9 && rawPhys >= 5 ? 2 : 1)
      : 1;
    return Math.max(0, rawPhys - reserve);
  });
  const segStepCounts = Array(segments.length).fill(0);
  let remSteps = totalBarterSteps;
  for (let pass = 0; remSteps > 0 && pass < 20; pass++) {
    let progressed = false;
    for (let sIdx = 0; sIdx < segments.length && remSteps > 0; sIdx++) {
      if (segments[sIdx].zones.length === 0) continue;
      const hasOut = segOutputsBySegIdx[sIdx].length > 0 ? 1 : 0;
      const tokenMax = Math.max(0, CHAIN_ITEMS.length - hasOut - (sIdx === 0 ? 2 : 1));
      const strictMax = Math.min(tokenMax, segPhysCaps[sIdx]);
      if (segStepCounts[sIdx] < strictMax) {
        segStepCounts[sIdx]++;
        remSteps--;
        progressed = true;
      }
    }
    if (!progressed) break;
  }
  // If this blueprint genuinely lacks enough segments for strict non-recycling chains, reject blueprint fast
  if (remSteps > 0) {
    return { ok: false, structural: true, reason: 'NULL_REM_STEPS' };
  }

  // Build barter sub-chain inside each isolated segment BEFORE tools/decoys so critical traders claim segment floor capacity first
  const segStartItemsPool = shuffle(CHAIN_ITEMS, rng);
  const startItems = [segStartItemsPool[0], segStartItemsPool[1]];
  let backtracksUsed = 0;
  let prevBarrierSpec = null;

  for (let sIdx = 0; sIdx < segments.length; sIdx++) {
    const seg = segments[sIdx];
    const segOutputs = segOutputsBySegIdx[sIdx];
    const usedInSeg = new Set(segOutputs);
    const segZones = seg.zones;
    const stepsInSeg = segStepCounts[sIdx];

    let activeToken = null;
    let reserveToken = null;
    let segSeedZoneId = null;
    if (sIdx === 0) {
      activeToken = startItems[0];
      usedInSeg.add(startItems[0]);
      usedInSeg.add(startItems[1]);
      if (stepsInSeg > 0) {
        reserveToken = startItems[1];
      }
    } else if (segZones.length > 0) {
      const prevReqs = new Set(prevBarrierSpec?.requires || []);
      const freshPool = shuffle(CHAIN_ITEMS.filter(id => !usedInSeg.has(id) && !prevReqs.has(id)), rng);
      const fallbackPool = shuffle(CHAIN_ITEMS.filter(id => !prevReqs.has(id)), rng);
      let seedItem = freshPool[0] || fallbackPool[0] || CHAIN_ITEMS[0];

      // Anti-silliness: place preset_seg_seed in a DIFFERENT zone within segZones than its first consumer
      // (`k === 0` trader if `stepsInSeg > 0`, or `seg.barrier.fromZone` if `stepsInSeg === 0`).
      // Gatekeepers (Trolls, Rocks, Chasms) never carry reward items.
      const forbiddenZeroZone = stepsInSeg === 0 ? seg.barrier?.fromZone : null;
      const nonForbiddenSegZones = segZones.filter(z => z.id !== forbiddenZeroZone);

      const safeEncOutIdx = segOutputs.findIndex(outId =>
        !entitySpecs.some(
          p => p.isPreset && (!p.requires || p.requires.length === 0) && p.zone === segZones[0].id && p.reward === outId
        )
      );

      if (stepsInSeg === 0 && segOutputs.length > 0) {
        // Case A: 0-barter segment with an encounter output already feeds its barrier
        activeToken = null;
      } else if (stepsInSeg > 0 && segZones.length === 1 && safeEncOutIdx !== -1) {
        // Case B: 1-zone segment with an encounter output starts its barter chain from that output
        const [encOut] = segOutputs.splice(safeEncOutIdx, 1);
        usedInSeg.add(encOut);
        activeToken = encOut;
      } else if (stepsInSeg > 0 && segZones.length >= 2) {
        // Case C: Multi-zone segment places seed pickup in a separate floor zone from Trader k=0
        usedInSeg.add(seedItem);
        activeToken = seedItem;
        if ((zoneRemainingCapacity.get(segZones[0].id) || 0) > 0) {
          segSeedZoneId = segZones[0].id;
          consumeZoneSlot(segSeedZoneId);
        } else {
          segSeedZoneId = pickCapacityZone(segZones);
        }
        const seedMeta = getItemMeta(seedItem, 'Floor Item');
        entitySpecs.push({
          kind: 'preset_seg_seed',
          id: `seg_${sIdx}_cache_${entitySeq++}`,
          name: seedMeta.name,
          emoji: seedMeta.emoji,
          isPreset: seedItem,
          requires: [],
          reqType: 'AND',
          reward: seedItem,
          zone: segSeedZoneId
        });
      } else if (stepsInSeg === 0 && nonForbiddenSegZones.length > 0) {
        // Case D: 0-barter multi-zone segment places seed pickup in a zone other than barrier.fromZone
        usedInSeg.add(seedItem);
        activeToken = seedItem;
        segSeedZoneId = pickCapacityZone(nonForbiddenSegZones);
        const seedMeta = getItemMeta(seedItem, 'Floor Item');
        entitySpecs.push({
          kind: 'preset_seg_seed',
          id: `seg_${sIdx}_cache_${entitySeq++}`,
          name: seedMeta.name,
          emoji: seedMeta.emoji,
          isPreset: seedItem,
          requires: [],
          reqType: 'AND',
          reward: seedItem,
          zone: segSeedZoneId
        });
      } else {
        // Case E: Single-zone segment with no usable encounter output -> place seed in a safe ancestor zone
        const ancZones = getAncestorZoneIds(segZones[0].id)
          .filter(zId => zId !== segZones[0].id)
          .map(zId => regularZones.find(z => z.id === zId))
          .filter(Boolean);
        if (ancZones.length === 0) {
          return { ok: false, reason: 'NO_SAFE_SEG_SEED_SLOT' };
        }
        const prevBarrierZone = prevBarrierSpec
          ? ancZones.find(z => z.id === prevBarrierSpec.zone)
          : null;
        let chosenAncZoneId = null;
        if (prevBarrierZone && (zoneRemainingCapacity.get(prevBarrierZone.id) || 0) > 0) {
          chosenAncZoneId = prevBarrierZone.id;
          consumeZoneSlot(chosenAncZoneId);
        } else {
          chosenAncZoneId = pickCapacityZone(ancZones);
        }

        const alreadyRequired = new Set(entitySpecs.flatMap(e => e.requires || []));
        const requiredInSeedZone = new Set(
          entitySpecs.filter(e => e.zone === chosenAncZoneId).flatMap(e => e.requires || [])
        );
        const ancCandidates = [...freshPool, ...fallbackPool];
        seedItem =
          ancCandidates.find(id => !alreadyRequired.has(id) && !usedInSeg.has(id)) ||
          ancCandidates.find(id => !requiredInSeedZone.has(id) && !usedInSeg.has(id)) ||
          shuffle(CHAIN_ITEMS, rng).find(id => !requiredInSeedZone.has(id));
        if (!seedItem || requiredInSeedZone.has(seedItem)) {
          return { ok: false, reason: 'NO_SAFE_SEG_SEED_SLOT' };
        }
        usedInSeg.add(seedItem);
        activeToken = seedItem;

        const seedMeta = getItemMeta(seedItem, 'Floor Item');
        entitySpecs.push({
          kind: 'preset_seg_seed',
          id: `seg_${sIdx}_cache_${entitySeq++}`,
          name: seedMeta.name,
          emoji: seedMeta.emoji,
          isPreset: seedItem,
          requires: [],
          reqType: 'AND',
          reward: seedItem,
          zone: chosenAncZoneId
        });
      }
    }

    let curMaxZone = segZones[0]?.id ?? null;
    for (let k = 0; k < stepsInSeg; k++) {
      let tradeZone;
      if (k === 0) {
        const nonSeedZones = segSeedZoneId != null
          ? segZones.filter(z => z.id !== segSeedZoneId)
          : segZones;
        const k0Pool = nonSeedZones.length > 0 ? nonSeedZones : segZones;
        if (k0Pool[0] && (zoneRemainingCapacity.get(k0Pool[0].id) || 0) > 0) {
          tradeZone = k0Pool[0].id;
          consumeZoneSlot(tradeZone);
        } else {
          tradeZone = pickCapacityZone(k0Pool);
        }
      } else {
        const frac = (k + 1) / Math.max(1, stepsInSeg);
        const zIdx = Math.min(segZones.length - 1, Math.floor(frac * segZones.length));
        tradeZone = segZones[zIdx].id;

        if (backtracksUsed >= settings.maxBacktracks) {
          tradeZone = curMaxZone > tradeZone && zoneMeta.get(curMaxZone) ? curMaxZone : tradeZone;
        } else if ((zoneMeta.get(tradeZone)?.minRow ?? 0) < (zoneMeta.get(curMaxZone)?.minRow ?? 0)) {
          const rowDiff = (zoneMeta.get(curMaxZone)?.maxRow ?? 0) - (zoneMeta.get(tradeZone)?.minRow ?? 0);
          if (rowDiff > settings.maxBacktrackRows) tradeZone = curMaxZone;
          else if (rowDiff > 0) backtracksUsed++;
        }
        if ((zoneRemainingCapacity.get(tradeZone) || 0) > 0) {
          consumeZoneSlot(tradeZone);
        } else {
          tradeZone = pickCapacityZone(segZones);
        }
      }
      if ((zoneMeta.get(tradeZone)?.minRow ?? 0) >= (zoneMeta.get(curMaxZone)?.minRow ?? 0)) {
        curMaxZone = tradeZone;
      }

      // On k === 0 of Seg 0, ALWAYS consume both start items [activeToken, reserveToken] -> frees bag slot immediately!
      const consumes = reserveToken ? [activeToken, reserveToken] : [activeToken];
      reserveToken = null;

      const freshCandidates = CHAIN_ITEMS.filter(id => !usedInSeg.has(id) && !consumes.includes(id));
      const reward = freshCandidates.length > 0
        ? pickOne(freshCandidates, rng)
        : pickOne(CHAIN_ITEMS.filter(id => !consumes.includes(id)), rng);

      usedInSeg.add(reward);
      activeToken = reward;

      const makeDigger = diggersAssigned < settings.numDiggers;
      if (makeDigger) diggersAssigned++;
      const tpl = makeDigger ? MOLE_TEMPLATE : pickOne(TRADER_TEMPLATES, rng);
      const idPrefix = makeDigger ? 'mole' : tpl.id;

      entitySpecs.push({
        kind: 'barter_trader',
        id: `${idPrefix}_tr_${entitySeq++}`,
        name: tpl.name,
        emoji: tpl.emoji,
        isDigger: makeDigger,
        requires: consumes,
        reqType: 'AND',
        reward,
        zone: tradeZone
      });
    }

    // Guardian barrier consumes final activeToken + at most 1 encounter output (+ unused start reserve if 0 trades in seg 0)
    const barrierReqs = [];
    if (activeToken) barrierReqs.push(activeToken);
    if (sIdx === 0 && stepsInSeg === 0 && startItems[1] && !barrierReqs.includes(startItems[1])) {
      barrierReqs.push(startItems[1]);
    }
    for (const eo of segOutputs) {
      if (!barrierReqs.includes(eo)) {
        barrierReqs.push(eo);
      }
    }
    if (barrierReqs.length === 0) return null;

    const barrier = seg.barrier;
    let barrierSpec;
    if (barrier.kind === 'guardian_lair') {
      const tpl = GUARDIAN_TEMPLATES.find(t => t.id === 'troll') || GUARDIAN_TEMPLATES[0];
      barrierSpec = {
        kind: 'encounter_gate',
        encounter: barrier.encounter,
        anchorType: 'G',
        anchorIndex: 0,
        id: `guard_enc_${entitySeq++}`,
        name: tpl.name,
        emoji: tpl.emoji,
        requires: barrierReqs,
        reqType: 'AND',
        reward: null,
        zone: barrier.fromZone,
        unlocksZones: [barrier.toZone],
        isGatekeeper: true,
        gateType: 'guardian'
      };
    } else {
      const tpl = pickOne(GUARDIAN_TEMPLATES, rng);
      barrierSpec = {
        kind: 'doorway_gate',
        edgeKey: barrier.gate.edgeKey,
        id: `guard_${entitySeq++}`,
        name: tpl.name,
        emoji: tpl.emoji,
        requires: barrierReqs,
        reqType: 'AND',
        reward: null,
        zone: barrier.fromZone,
        unlocksZones: [barrier.toZone],
        isGatekeeper: true,
        gateType: 'guardian'
      };
    }
    entitySpecs.push(barrierSpec);
    prevBarrierSpec = barrierSpec;
  }

  // Place required tool pickups AFTER barter traders, preferring strictly earlier ancestor zones with free capacity
  for (const tReq of toolInputs) {
    const ancestorIds = getAncestorZoneIds(tReq.fromZone);
    const strictIds = ancestorIds.filter(zId => zId !== tReq.fromZone);
    const strictSameSeg = strictIds
      .filter(zId => zoneToSegIdx.get(zId) === tReq.segIdx)
      .map(zId => regularZones.find(z => z.id === zId))
      .filter(Boolean);
    const strictAll = strictIds
      .map(zId => regularZones.find(z => z.id === zId))
      .filter(Boolean);
    const sameSegAncestors = ancestorIds
      .filter(zId => zoneToSegIdx.get(zId) === tReq.segIdx)
      .map(zId => regularZones.find(z => z.id === zId))
      .filter(Boolean);
    const allAncestors = ancestorIds
      .map(zId => regularZones.find(z => z.id === zId))
      .filter(Boolean);
    const withSoft = (list) => list.filter(z => (zoneRemainingCapacity.get(z.id) || 0) > 0);
    const withPhys = (list) => list.filter(z => (zonePhysicalSlack.get(z.id) || 0) > 0);
    let chosenZone;
    if (withSoft(strictSameSeg).length > 0) {
      chosenZone = pickCapacityZone(withSoft(strictSameSeg));
    } else if (withSoft(strictAll).length > 0) {
      chosenZone = pickCapacityZone(withSoft(strictAll));
    } else if (withPhys(strictSameSeg).length > 0) {
      chosenZone = pickCapacityZone(withPhys(strictSameSeg));
    } else if (withPhys(strictAll).length > 0) {
      chosenZone = pickCapacityZone(withPhys(strictAll));
    } else if (withSoft(sameSegAncestors).length > 0) {
      chosenZone = pickCapacityZone(withSoft(sameSegAncestors));
    } else if (withSoft(allAncestors).length > 0) {
      chosenZone = pickCapacityZone(withSoft(allAncestors));
    } else if (withPhys(sameSegAncestors).length > 0) {
      chosenZone = pickCapacityZone(withPhys(sameSegAncestors));
    } else if (withPhys(allAncestors).length > 0) {
      chosenZone = pickCapacityZone(withPhys(allAncestors));
    } else if (allAncestors.length > 0) {
      chosenZone = pickCapacityZone(allAncestors);
    } else {
      chosenZone = pickCapacityZone([regularZones[0]]);
    }
    const toolMeta = getItemMeta(tReq.itemId, 'Tool');
    entitySpecs.push({
      kind: 'preset_tool',
      id: `preset_${tReq.itemId}_${entitySeq++}`,
      name: toolMeta.name,
      emoji: toolMeta.emoji,
      isPreset: tReq.itemId,
      requires: [],
      reqType: 'AND',
      reward: tReq.itemId,
      zone: chosenZone
    });
  }
  for (let s = 0; s < settings.pickaxeSurplus; s++) {
    const surplusCandidates = regularZones.filter(z => (zonePhysicalSlack.get(z.id) || 0) > 0);
    if (surplusCandidates.length === 0) break;
    const pickaxeMeta = getItemMeta('pickaxe', 'Pickaxe');
    entitySpecs.push({
      kind: 'preset_surplus',
      id: `surplus_pickaxe_${entitySeq++}`,
      name: pickaxeMeta.name,
      emoji: pickaxeMeta.emoji,
      isPreset: 'pickaxe',
      requires: [],
      reqType: 'AND',
      reward: 'pickaxe',
      zone: pickCapacityZone(surplusCandidates)
    });
  }

  // Vault Treasure chest inside Vault Zone (0 extra steps; victory trigger on click/collect)
  const goalEntityId = 'vault_treasure';
  entitySpecs.push({
    kind: 'goal_treasure',
    id: goalEntityId,
    name: VAULT_TREASURE_TEMPLATE.name,
    emoji: VAULT_TREASURE_TEMPLATE.emoji,
    isGoal: true,
    isPreset: 'treasure',
    isTreasure: true,
    requires: [],
    reqType: 'AND',
    reward: null,
    zone: vaultZoneId
  });

  // Decoys (`decoyCount`): red-herring traders rewarding `decoySinkItem` (disjoint from ALL required chain items)
  const allNeededByChain = new Set(entitySpecs.flatMap(e => e.requires || []));
  const safeDecoyRewards = NON_MUSHROOM_TRADE_ITEMS.filter(i => !allNeededByChain.has(i));
  for (let d = 0; d < settings.decoyCount; d++) {
    const decoyCandidates = regularZones.filter(z => (zonePhysicalSlack.get(z.id) || 0) > 0);
    if (decoyCandidates.length === 0) break;
    const decoyZone = pickCapacityZone(decoyCandidates);
    const freeInDecoyZone = new Set(
      entitySpecs.filter(p => p.isPreset && p.zone === decoyZone && p.reward).map(p => p.reward)
    );
    const rew = decoySinkItem && !allNeededByChain.has(decoySinkItem)
      ? decoySinkItem
      : (safeDecoyRewards.length > 0 ? pickOne(safeDecoyRewards, rng) : null);
    if (!rew) continue;
    const req = pickOne(CHAIN_ITEMS.filter(i => i !== rew && !freeInDecoyZone.has(i)), rng);
    if (!req) continue;
    const makeDigger = diggersAssigned < settings.numDiggers;
    if (makeDigger) diggersAssigned++;
    const tpl = makeDigger ? MOLE_TEMPLATE : pickOne(TRADER_TEMPLATES, rng);
    const idPrefix = makeDigger ? 'mole' : tpl.id;
    entitySpecs.push({
      kind: 'decoy_trader',
      id: `${idPrefix}_decoy_${entitySeq++}`,
      name: tpl.name,
      emoji: tpl.emoji,
      isDigger: makeDigger,
      requires: [req],
      reqType: 'AND',
      reward: rew,
      zone: decoyZone
    });
  }

  // Hard anti-silliness invariant: gatekeepers never give reward items, and no creature (trader or Troll guardian)
  // may share a zone with an unguarded free floor pickup (`isPreset` with no requirements) whose reward it requires.
  for (const ent of entitySpecs) {
    if (ent.isGatekeeper && ent.reward != null) {
      return { ok: false, reason: 'GATEKEEPER_HAS_REWARD' };
    }
    if (ent.isPreset || !ent.requires || ent.requires.length === 0) continue;
    if (ent.gateType === 'rock' || ent.gateType === 'chasm') continue;
    const sameZoneFree = entitySpecs.find(
      p =>
        p.isPreset &&
        (!p.requires || p.requires.length === 0) &&
        p.reward &&
        p.zone === ent.zone &&
        ent.requires.includes(p.reward)
    );
    if (sameZoneFree) {
      return { ok: false, reason: 'SAME_ZONE_FREE_REQUIRED_ITEM' };
    }
  }

  // Run BFS solvePuzzle on abstract entities first (cheap pre-geometry validation!)
  const sanitized = sanitizePuzzleEntities(entitySpecs, UNDERGROUND_ITEMS);
  const sol = solvePuzzle(startItems, sanitized, goalEntityId, levelStub);
  if (!sol) {
    return { ok: false, reason: 'MISSION_UNSOLVABLE' };
  }
  if (sol.steps < settings.targetSteps || sol.steps > settings.targetSteps + 1) {
    return { ok: false, reason: `MISSION_STEPS_${sol.steps}_WANT_${settings.targetSteps}` };
  }

  return {
    ok: true,
    startItems,
    entitySpecs: sanitized,
    goalEntityId,
    abstractSolution: sol
  };
}

/**
 * Stage 5: Places gatekeepers on exact doorway collars / encounter anchors,
 * and positions traders, presets, diggers, and vault treasure via seeded rejection
 * sampling respecting `D_min >= 14.0`, `M_min >= 6.5`, and doorway exclusion.
 */
function placeEntitiesInSlots(specs, blueprint, geometry, rng) {
  const { slots, campCol, vaultCol } = blueprint;
  const dims = getWorldDimensions(blueprint.rows);
  const wallSegments = getProceduralObstacleSegments([], geometry, []);

  // Build look of camp anchor position near north half of slot (1,0)
  const campCenter = getSlotCenter(campCol, 0, dims);
  const campPos = { x: campCenter.x, y: Math.max(15, campCenter.y - 16) };

  const placed = [];

  const wallClearanceThreshold = DEEP_CAVE_MIN_WALL_MARGIN + 0.1;
  const minDistToSegments = (pt, earlyExitBelow = 0) => {
    let minD = Infinity;
    for (const seg of wallSegments) {
      if (earlyExitBelow > 0) {
        const ax = seg.a.x, bx = seg.b.x;
        if ((ax < pt.x - earlyExitBelow && bx < pt.x - earlyExitBelow) ||
            (ax > pt.x + earlyExitBelow && bx > pt.x + earlyExitBelow)) continue;
        const ay = seg.a.y, by = seg.b.y;
        if ((ay < pt.y - earlyExitBelow && by < pt.y - earlyExitBelow) ||
            (ay > pt.y + earlyExitBelow && by > pt.y + earlyExitBelow)) continue;
      }
      const l2 = (seg.a.x - seg.b.x) ** 2 + (seg.a.y - seg.b.y) ** 2;
      let d;
      if (l2 === 0) d = Math.hypot(pt.x - seg.a.x, pt.y - seg.a.y);
      else {
        let t = ((pt.x - seg.a.x) * (seg.b.x - seg.a.x) + (pt.y - seg.a.y) * (seg.b.y - seg.a.y)) / l2;
        t = Math.max(0, Math.min(1, t));
        d = Math.hypot(pt.x - (seg.a.x + t * (seg.b.x - seg.a.x)), pt.y - (seg.a.y + t * (seg.b.y - seg.a.y)));
      }
      if (earlyExitBelow > 0 && d < earlyExitBelow) return d;
      if (d < minD) minD = d;
    }
    return minD;
  };

  const isInsideCollar = (pt) => {
    for (const box of geometry.collarLockBoxes || []) {
      if (
        pt.x >= box.xLeft - 2.5 &&
        pt.x <= box.xRight + 2.5 &&
        pt.y >= box.yTop - 2.5 &&
        pt.y <= box.yBottom + 2.5
      ) {
        return true;
      }
    }
    return false;
  };

  const isValidFreePos = (pt, checkExisting = placed) => {
    if (geometry.obstaclePolygons?.some(poly => isPointInPolygon(pt, poly))) return false;
    if (minDistToSegments(pt, wallClearanceThreshold) < wallClearanceThreshold) return false;
    if (isInsideCollar(pt)) return false;
    if (Math.hypot(pt.x - campPos.x, pt.y - campPos.y) < DEEP_CAVE_MIN_ENTITY_DIST) return false;

    for (const other of checkExisting) {
      if (Math.hypot(pt.x - other.x, pt.y - other.y) < DEEP_CAVE_MIN_ENTITY_DIST + 0.1) {
        return false;
      }
    }
    return true;
  };

  // Pass 1: Place deterministic doorway & encounter-anchored entities first
  const freeEntities = [];
  for (const spec of specs) {
    if (spec.kind === 'doorway_gate') {
      const dw = geometry.doorways[spec.edgeKey];
      if (!dw) return null;
      placed.push({
        ...spec,
        x: dw.x,
        y: dw.y,
        collarBounds: { ...dw.collarBounds }
      });
    } else if (spec.kind?.startsWith('encounter_')) {
      const ep = spec.encounter;
      const anchorData = geometry.encounterAnchors.find(
        a => a.encounterId === ep.encounter.id && a.originCol === ep.originCol && a.originRow === ep.originRow
      );
      const bucket = spec.anchorType === 'E' && anchorData?.E
        ? [...anchorData.E].sort((a, b) => a.x - b.x)
        : anchorData?.[spec.anchorType];
      const anchor = bucket?.[spec.anchorIndex || 0];
      if (!anchor) return null;
      const ent = {
        ...spec,
        x: anchor.x,
        y: anchor.y
      };
      if (spec.isGatekeeper && anchor.bounds) {
        ent.collarBounds = { ...anchor.bounds };
      }
      placed.push(ent);
    } else {
      freeEntities.push(spec);
    }
  }

  // Pass 2: Place goal treasure inside Vault slot center first so traders stay separated
  const vaultSpecIdx = freeEntities.findIndex(e => e.isGoal);
  if (vaultSpecIdx > -1) {
    const vaultSpec = freeEntities.splice(vaultSpecIdx, 1)[0];
    const vc = getSlotCenter(vaultCol, blueprint.rows - 1, dims);
    const candidates = [
      { x: vc.x, y: vc.y + 4 },
      { x: vc.x, y: vc.y },
      { x: vc.x - 4, y: vc.y + 4 },
      { x: vc.x + 4, y: vc.y + 4 }
    ];
    let placedVault = false;
    for (const cand of candidates) {
      if (isValidFreePos(cand)) {
        placed.push({ ...vaultSpec, x: cand.x, y: cand.y });
        placedVault = true;
        break;
      }
    }
    if (!placedVault) return null;
  }

  // Pass 3: Place traders, presets, and decoys inside slots belonging to their zone
  // Collect slot bounds per zone (and fallback to all non-vault non-encounter slots in accessible row)
  const zoneSlots = new Map();
  for (let r = 0; r < blueprint.rows; r++) {
    for (let c = 0; c < DEEP_CAVE_SLOT_COLS; c++) {
      const s = slots[r][c];
      if (!s.active || s.encounterId || s.role === 'vault' || s.zone == null) continue;
      if (!zoneSlots.has(s.zone)) zoneSlots.set(s.zone, []);
      zoneSlots.get(s.zone).push({ col: c, row: r });
    }
  }

  for (const spec of freeEntities) {
    const targetSlots = zoneSlots.get(spec.zone) || [];
    // If a zone happens to only contain an encounter slot (e.g. guardian_lair), skip or use an earlier connected zone slot if non-critical
    const searchSlots = targetSlots.length > 0 ? shuffle(targetSlots, rng) : [];
    if (searchSlots.length === 0) return null;

    let pos = null;
    for (const sl of searchSlots) {
      const center = getSlotCenter(sl.col, sl.row, dims);
      const slotW = dims.worldWidth / DEEP_CAVE_SLOT_COLS;
      const slotH = dims.worldHeight / blueprint.rows;

      // Deterministic well-spaced sample grid inside slot chamber (staggered tiers + 2D grid scan fallback)
      const offsets = [
        [0, -14.5],
        [0, 14.5],
        [0, 0],
        [-6.5, -14],
        [6.5, 14],
        [-6.5, 14],
        [6.5, -14],
        [-7, 0],
        [7, 0],
        [0, -18.5],
        [0, 18.5]
      ];
      for (let oy = -21; oy <= 21; oy += 3) {
        for (let ox = -9; ox <= 9; ox += 3) {
          offsets.push([ox, oy]);
        }
      }

      for (let idx = 0; idx < offsets.length; idx++) {
        const [ox, oy] = offsets[idx];
        const jx = idx < 11 ? (rng() - 0.5) * 0.6 : 0;
        const jy = idx < 11 ? (rng() - 0.5) * 0.5 : 0;
        const cand = {
          x: Math.round((center.x + ox + jx) * 100) / 100,
          y: Math.round((center.y + oy + jy) * 100) / 100
        };
        if (cand.x < center.x - slotW / 2 + 7 || cand.x > center.x + slotW / 2 - 7) continue;
        if (cand.y < center.y - slotH / 2 + 8 || cand.y > center.y + slotH / 2 - 8) continue;
        if (isValidFreePos(cand)) {
          pos = cand;
          break;
        }
      }
      if (pos) break;
    }

    if (!pos) return null;
    placed.push({ ...spec, x: pos.x, y: pos.y });
  }

  return { placed, campPos };
}

/**
 * Stage 6: Verification Suite (Solvability, A* Navigability, Collar Sealing,
 * Spacing/Clearance, Torch Visibility Reachability).
 */
function verifyGeneratedLevel(startItems, entities, goalEntityId, geometry, settings, levelStub) {
  const { campPos, worldWidth, worldHeight, torchRadius = settings.torchRadius } = geometry;

  // 1. Solver verification + strict step window check
  const solution = solvePuzzle(startItems, entities, goalEntityId, levelStub, { maxStates: 6000 });
  if (!solution || solution.steps < settings.targetSteps || solution.steps > settings.targetSteps + 1) {
    return { valid: false, reason: 'SOLVER_FAILED' };
  }

  // 2. Spatial separation & wall margin check (isotropic D_min = 14.0, M_min = 6.5)
  const spacingCheck = validateEntitySpacing(entities, {
    minEntityDistance: DEEP_CAVE_MIN_ENTITY_DIST,
    wallPolylines: geometry.wallPolylines,
    minWallMargin: DEEP_CAVE_MIN_WALL_MARGIN,
    checkAllPairs: true
  });
  if (!spacingCheck.isValid) {
    return { valid: false, reason: 'SPACING_FAILED', violations: spacingCheck.violations };
  }

  // 3. Doorway collar sealing & minimum width check
  const allGateIds = entities.filter(e => e.isGatekeeper).map(e => e.id);
  const wallOnlySegments = getProceduralObstacleSegments(entities, geometry, allGateIds);
  for (const gk of entities.filter(e => e.isGatekeeper)) {
    if (gk.reward != null) {
      return { valid: false, reason: 'GATEKEEPER_HAS_REWARD' };
    }
    const cb = gk.collarBounds;
    if (!cb) return { valid: false, reason: 'MISSING_COLLAR_BOUNDS' };
    if (cb.orientation === 'horizontal') {
      if (cb.xRight - cb.xLeft < DEEP_CAVE_CORRIDOR_MIN_WIDTH - 1e-3) {
        return { valid: false, reason: 'COLLAR_TOO_NARROW' };
      }
      const touchesLeft = wallOnlySegments.some(s =>
        Math.abs(s.a.x - cb.xLeft) < 0.15 && Math.abs(s.b.x - cb.xLeft) < 0.15 &&
        Math.min(s.a.y, s.b.y) <= gk.y + 0.5 && Math.max(s.a.y, s.b.y) >= gk.y - 0.5
      );
      const touchesRight = wallOnlySegments.some(s =>
        Math.abs(s.a.x - cb.xRight) < 0.15 && Math.abs(s.b.x - cb.xRight) < 0.15 &&
        Math.min(s.a.y, s.b.y) <= gk.y + 0.5 && Math.max(s.a.y, s.b.y) >= gk.y - 0.5
      );
      if (!touchesLeft || !touchesRight) return { valid: false, reason: 'COLLAR_NOT_FLUSH' };
    } else {
      if (cb.yBottom - cb.yTop < DEEP_CAVE_CORRIDOR_MIN_WIDTH - 1e-3) {
        return { valid: false, reason: 'COLLAR_TOO_NARROW' };
      }
      const touchesTop = wallOnlySegments.some(s =>
        Math.abs(s.a.y - cb.yTop) < 0.15 && Math.abs(s.b.y - cb.yTop) < 0.15 &&
        Math.min(s.a.x, s.b.x) <= gk.x + 0.5 && Math.max(s.a.x, s.b.x) >= gk.x - 0.5
      );
      const touchesBottom = wallOnlySegments.some(s =>
        Math.abs(s.a.y - cb.yBottom) < 0.15 && Math.abs(s.b.y - cb.yBottom) < 0.15 &&
        Math.min(s.a.x, s.b.x) <= gk.x + 0.5 && Math.max(s.a.x, s.b.x) >= gk.x - 0.5
      );
      if (!touchesTop || !touchesBottom) return { valid: false, reason: 'COLLAR_NOT_FLUSH' };
    }
  }

  // 4. A* / BFS Corridor Navigability across all unlocked chambers (at r_hero = 3.0)
  const reachList = checkBatchReachability(
    campPos,
    entities.map(ent => ({ x: ent.x, y: ent.y })),
    wallOnlySegments,
    { width: worldWidth, height: worldHeight },
    geometry.obstaclePolygons,
    3,
    { radius: DEEP_CAVE_HERO_RADIUS }
  );
  for (let i = 0; i < entities.length; i++) {
    if (!reachList[i]) {
      return { valid: false, reason: 'PATHFINDING_UNREACHABLE', entityId: entities[i].id };
    }
  }
  const goalEnt = entities.find(e => e.id === goalEntityId);
  if (goalEnt) {
    const vaultPath = findGlobalPath(
      campPos,
      { x: goalEnt.x, y: goalEnt.y },
      wallOnlySegments,
      { width: worldWidth, height: worldHeight },
      geometry.obstaclePolygons,
      3,
      { radius: DEEP_CAVE_HERO_RADIUS, maxIters: 4500 }
    );
    if (!vaultPath || vaultPath.length === 0) {
      return { valid: false, reason: 'PATHFINDING_UNREACHABLE', entityId: goalEnt.id };
    }
  }

  // 5. Torch Visibility Reachability from hero standing positions
  const radius = torchRadius || settings.torchRadius;
  for (const ent of entities) {
    if (ent.isGatekeeper) {
      // Check hero standing 9 units on north/west approach side can clearly see gatekeeper front
      const isVert = ent.collarBounds?.orientation === 'vertical';
      const offsets = isVert ? [{ x: -9, y: 0 }, { x: 9, y: 0 }] : [{ x: 0, y: -9 }, { x: 0, y: 9 }];
      const visibleFromApproach = offsets.some(off => {
        const vantage = { x: ent.x + off.x, y: ent.y + off.y };
        if (geometry.obstaclePolygons?.some(p => isPointInPolygon(vantage, p))) return false;
        // Front surface point just in front of gatekeeper face
        const facePt = { x: ent.x + off.x * 0.35, y: ent.y + off.y * 0.35 };
        if (Math.hypot(facePt.x - vantage.x, facePt.y - vantage.y) > radius * 0.95) return false;
        return !checkCollision(vantage, facePt, wallOnlySegments);
      });
      if (!visibleFromApproach) {
        return { valid: false, reason: 'GATEKEEPER_VISIBILITY_FAILED', entityId: ent.id };
      }
    } else {
      // Check non-gatekeeper entity is illuminated when standing nearby (8 units toward center)
      const poly = getVisibilityPolygon({ x: ent.x, y: ent.y }, wallOnlySegments, radius, 1);
      if (!poly || poly.length < 6) {
        return { valid: false, reason: 'ENTITY_VISIBILITY_FAILED', entityId: ent.id };
      }
    }
  }

  return { valid: true, solution };
}

/**
 * Generates a complete, verified `deep_cave` level payload.
 *
 * @param {Object} level - Level definition (`deep_cave`)
 * @param {number|Object} [targetStepsOrSettings=8] - Target step count or preset/settings object
 * @param {number} [numDiggers=null] - Giant Mole digger override
 * @param {string|number|null} [seedInput=null] - Deterministic seed
 * @param {Object|null} [explicitSettings=null] - Full Deep Cave difficulty settings override
 * @returns {Object} Generated puzzle payload matching Level API + `geometry`, `seed`, `settings`, `generatorVersion`
 */
export function generateDeepCavePuzzle(
  level,
  targetStepsOrSettings = 8,
  numDiggers = null,
  seedInput = null,
  explicitSettings = null
) {
  const baseInput = explicitSettings || (typeof targetStepsOrSettings === 'object' ? targetStepsOrSettings : {});
  const overrides = {};
  if (typeof targetStepsOrSettings === 'number') overrides.targetSteps = targetStepsOrSettings;
  if (typeof numDiggers === 'number') overrides.numDiggers = numDiggers;

  const settings = normalizeDeepCaveSettings(baseInput, overrides);
  const seed = seedInput != null
    ? String(seedInput)
    : `dc-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const rng = createRNG(seed);

  const levelStub = level || {
    id: 'deep_cave',
    mechanics: { isVertical: true, hasPickaxe: true, useIsotropicCoords: true },
    items: UNDERGROUND_ITEMS
  };

  let missionAttempts = 0;
  let totalFirstPass = true;
  const rejectCounts = {};
  const recordReject = (r) => { rejectCounts[r] = (rejectCounts[r] || 0) + 1; };

  for (let outerAttempt = 0; outerAttempt < 24; outerAttempt++) {
    const selectedEncounters = chooseEncounters(settings, rng);
    const blueprint = buildSpaceBlueprint(settings, selectedEncounters, rng);
    if (!blueprint) {
      recordReject('BLUEPRINT');
      continue;
    }

    // Stage 1 retries (fast abstract DAG + solvePuzzle check)
    let mission = null;
    for (let mAttempt = 0; mAttempt < 8; mAttempt++) {
      missionAttempts++;
      const res = synthesizeMissionGraph(settings, blueprint, levelStub, rng);
      if (res?.ok) {
        mission = res;
        break;
      }
      recordReject(res?.reason || 'MISSION_NULL');
      if (!res || !res.structural) totalFirstPass = false;
      // Structural null depends purely on blueprint topology; switch blueprint immediately
      if (!res || res.structural) break;
    }
    if (!mission) continue;

    // Stage 3-6 (rasterization, contouring, placement, and verification)
    for (let geoAttempt = 0; geoAttempt < 2; geoAttempt++) {
      const geo = rasterizeSlotGrid(blueprint.slots, blueprint.rows, ENCOUNTERS_BY_ID, rng);
      const placedRes = placeEntitiesInSlots(mission.entitySpecs, blueprint, geo, rng);
      if (!placedRes) {
        recordReject('PLACEMENT');
        continue;
      }

      const geometry = {
        worldWidth: geo.worldWidth,
        worldHeight: geo.worldHeight,
        rows: geo.rows,
        wallPolylines: geo.wallPolylines,
        obstaclePolygons: geo.obstaclePolygons,
        campPos: placedRes.campPos,
        torchRadius: settings.torchRadius,
        slotLayout: {
          rows: blueprint.rows,
          doorways: geo.doorways,
          encounters: selectedEncounters.map(e => e.id)
        }
      };

      const check = verifyGeneratedLevel(
        mission.startItems,
        placedRes.placed,
        mission.goalEntityId,
        geometry,
        settings,
        levelStub
      );

      if (check.valid) {
        return {
          startItems: mission.startItems,
          puzzleEntities: placedRes.placed,
          goalEntityId: mission.goalEntityId,
          solution: check.solution.path,
          steps: check.solution.steps,
          geometry,
          seed,
          settings,
          generatorVersion: DEEP_CAVE_GENERATOR_VERSION,
          diagnostics: {
            firstPassMissionSolved: totalFirstPass && missionAttempts === 1,
            missionAttempts,
            rejectCounts
          }
        };
      }
      recordReject(check.reason || 'VERIFY_OTHER');
    }
  }

  throw new Error(`Deep Cave generation failed after retries (${JSON.stringify(rejectCounts)}) for settings: ${JSON.stringify(settings)}`);
}
