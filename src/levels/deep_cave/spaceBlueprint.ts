import { DEEP_CAVE_SLOT_COLS } from '../../constants.ts';
import { shuffle } from '../../logic/rng.ts';
import type { RNG } from '../../logic/rng.ts';
import { items as UNDERGROUND_ITEMS } from './data.ts';
import { DEEP_CAVE_ENCOUNTERS } from './encounters/index.ts';
import { connectSlots, createEmptySlotGrid, makeEdgeKey } from './slotGrid.ts';
import type {
  DeepCaveSettings,
  EncounterModule,
  EncounterPlacement,
  GatedEdgeSpec,
  SlotRecord,
  SpaceBlueprint,
  ZoneMeta
} from '../../types/index.ts';

export const DIFFICULTY_RANK: Record<string, number> = {
  easy: 0,
  normal: 1,
  hard: 2,
  expert: 3,
  custom: 2
};

export function pickOne<T>(arr: readonly T[], rng: RNG): T {
  return arr[Math.floor(rng() * arr.length)];
}

/**
 * Selects eligible curated encounters matching difficulty & grid height.
 */
export function chooseEncounters(
  settings: DeepCaveSettings,
  rng: RNG
): EncounterModule[] {
  let desiredCount = settings.encounterCount;
  if (settings.preset === 'expert' && settings.encounterCount >= 3 && rng() < 0.45) {
    desiredCount = 2;
  } else if (settings.preset === 'normal' && settings.encounterCount >= 2 && rng() < 0.25) {
    desiredCount = 1;
  }
  const maxEncounters = Math.min(desiredCount, Math.max(0, settings.rows - 2));
  if (maxEncounters <= 0) return [];

  const diffRank = DIFFICULTY_RANK[String(settings.preset || 'custom')] ?? 2;
  const eligible = DEEP_CAVE_ENCOUNTERS.filter(enc => {
    const reqRank = DIFFICULTY_RANK[enc.placement?.minDifficulty || 'easy'] ?? 0;
    return reqRank <= diffRank;
  });

  const picked: EncounterModule[] = [];
  const shuffled = shuffle(eligible, rng);
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

interface SpineNode {
  col: number;
  row: number;
  encounterId?: string;
  isVault?: boolean;
}

interface ExtraEdge {
  edgeKey: string;
  from: [number, number];
  to: [number, number];
  role: string;
}

interface PendingFrontier {
  fromCol: number;
  fromRow: number;
  toCol: number;
  toRow: number;
  fromZone: number;
  edgeGate?: GatedEdgeSpec;
  internalEncounter?: EncounterPlacement;
}

type GuardianEvalResult =
  | { feasible: false; deficit: number }
  | { feasible: true; deficit: number; margin: number; minCap: number; segCount: number };

/**
 * Stage 2 Pre-Plan / Zone Layout:
 * Carves the `3 x rows` space graph first-class with Camp, Vault, encounters,
 * cross-branches, spurs, and doorway gatekeepers so every Zone knows its row tier.
 * Retried independently if an encounter or branch fails to fit.
 */
export function buildSpaceBlueprint(
  settings: DeepCaveSettings,
  selectedEncounters: readonly EncounterModule[],
  rng: RNG
): SpaceBlueprint | null {
  const rows = settings.rows;
  const cols = settings.cols ?? DEEP_CAVE_SLOT_COLS;
  const slots: SlotRecord[][] = createEmptySlotGrid(rows, cols);

  const campCol = cols === 3 ? 1 : Math.floor(cols / 2);
  slots[0][campCol].active = true;
  slots[0][campCol].role = 'camp';
  let curCol = campCol;

  const intermediateRows: number[] = [];
  for (let r = 1; r <= rows - 2; r++) intermediateRows.push(r);
  const encRowPool = shuffle(intermediateRows, rng);
  // Keep mushroom_grotto off the bottommost row above Vault when shallower intermediate rows exist
  const orderedEncs = [...selectedEncounters].sort((a, b) =>
    Number(b.id === 'mushroom_grotto') - Number(a.id === 'mushroom_grotto')
  );
  const rowToEncounter = new Map<number, EncounterModule>();
  const usedEncRows = new Set<number>();
  for (const enc of orderedEncs) {
    const preferredRow = enc.id === 'mushroom_grotto' && rows >= 5
      ? (encRowPool.find(r => !usedEncRows.has(r) && r <= rows - 3) ?? encRowPool.find(r => !usedEncRows.has(r)))
      : encRowPool.find(r => !usedEncRows.has(r));
    if (preferredRow === undefined) break;
    usedEncRows.add(preferredRow);
    rowToEncounter.set(preferredRow, enc);
  }

  const spinePath: SpineNode[] = [{ col: curCol, row: 0 }];
  const encounterPlacements: EncounterPlacement[] = [];

  for (let r = 1; r <= rows - 2; r++) {
    const enc = rowToEncounter.get(r);
    if (enc) {
      const fpCols = enc.footprint.cols;
      const entryOffset = enc.sockets.north[0]?.colOffset ?? 0;
      const exitOffset = enc.sockets.south[0]?.colOffset ?? 0;

      const prevRowHasEncOnCur = Boolean(slots[r - 1][curCol].encounterId);
      const validOrigins: number[] = [];
      for (let oCol = 0; oCol <= cols - fpCols; oCol++) {
        const candidateEnter = oCol + entryOffset;
        if (prevRowHasEncOnCur && candidateEnter !== curCol) continue;
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

      const nextEnc = rowToEncounter.get(r + 1);
      const fitsNextRow = (exitC: number): boolean => {
        if (!nextEnc) return true;
        const nOff = nextEnc.sockets.north[0]?.colOffset ?? 0;
        const nOrig = exitC - nOff;
        return nOrig >= 0 && nOrig <= cols - nextEnc.footprint.cols;
      };
      const nextSafeOrigins = validOrigins.filter(o => fitsNextRow(o + exitOffset));
      const candidateOrigins = nextSafeOrigins.length > 0 ? nextSafeOrigins : validOrigins;

      const wantOffsetRow0 = r === 1 && settings.targetSteps >= 7;
      const offsetMatch = wantOffsetRow0
        ? candidateOrigins.find(o => o + entryOffset !== curCol && !(r < rows - 2 && o + exitOffset === cols - 1))
        : undefined;
      const exactMatch = candidateOrigins.find(
        o => o + entryOffset === curCol && !(r < rows - 2 && o + exitOffset === cols - 1)
      );
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
      connectSlots(slots, curCol, r - 1, curCol, r);
      spinePath.push({ col: curCol, row: r });
      let targetCol = Math.floor(rng() * cols);
      if (settings.targetSteps >= 12 && r > 0) {
        if (curCol === 0) targetCol = cols - 1;
        else if (curCol === cols - 1) targetCol = 0;
        else {
          const edgeCols = [0, cols - 1].filter(c => Math.abs(c - curCol) >= 1);
          targetCol = edgeCols.length > 0 ? pickOne(edgeCols, rng) : targetCol;
        }
      } else if (targetCol === curCol && settings.targetSteps >= 7) {
        const altCols = Array.from({ length: cols }, (_, c) => c).filter(c => c !== curCol);
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

  connectSlots(slots, curCol, rows - 2, curCol, rows - 1);
  const actualVaultCol = curCol;
  slots[rows - 1][actualVaultCol].role = 'vault';
  spinePath.push({ col: actualVaultCol, row: rows - 1, isVault: true });

  if (settings.targetSteps >= 5) {
    const freeRow0Cols = [campCol - 1, campCol + 1].filter(
      c => c >= 0 && c < cols && !slots[0][c].active && !slots[0][c].encounterId
    );
    if (freeRow0Cols.length > 0) {
      const wantWings = settings.targetSteps >= 8 ? Math.min(2, freeRow0Cols.length) : 1;
      for (const wingCol of shuffle(freeRow0Cols, rng).slice(0, wantWings)) {
        connectSlots(slots, campCol, 0, wingCol, 0);
        slots[0][wingCol].role = 'camp_wing';
      }
    }
  }

  const extraEdges: ExtraEdge[] = [];
  const tryExpandNeighbors = (maxAdd: number, roleName: string) => {
    let added = 0;
    const candidates: Array<{ from: [number, number]; to: [number, number] }> = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const s = slots[r][c];
        if (!s.active || s.encounterId || s.role === 'vault') continue;
        const dirs: Array<[number, number]> = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        for (const [dc, dr] of dirs) {
          const nc = c + dc;
          const nr = r + dr;
          if (nc < 0 || nc >= cols || nr < 0 || nr >= rows - 1) continue;
          const target = slots[nr][nc];
          if (target.encounterId) continue;
          if (!target.active) {
            candidates.push({ from: [c, r], to: [nc, nr] });
          }
        }
      }
    }
    const rowFreeCount = Array.from({ length: rows }, (_, rr) =>
      slots[rr].filter(s => s.active && !s.encounterId && s.role !== 'vault').length
    );
    const prioritized = shuffle(candidates, rng).sort((a, b) =>
      (rowFreeCount[a.to[1]] + rowFreeCount[a.from[1]]) - (rowFreeCount[b.to[1]] + rowFreeCount[b.from[1]])
    );
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

  let freeNonEncSlots = 0;
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols; c++) {
      if (slots[r][c].active && !slots[r][c].encounterId) freeNonEncSlots++;
    }
  }
  const minNeededSlots = Math.ceil((settings.targetSteps + settings.pickaxeSurplus + settings.decoyCount + 3) / 2);
  if (freeNonEncSlots < minNeededSlots) {
    tryExpandNeighbors(minNeededSlots - freeNonEncSlots, 'branch');
  }

  // Loop-erase `spinePath` so walked-back horizontal sweeps are NOT mistaken for mandatory spine edges
  const simpleSpinePath: SpineNode[] = [];
  const spineVisitedIdx = new Map<string, number>();
  for (const node of spinePath) {
    const key = `${node.col},${node.row}`;
    const existingIdx = spineVisitedIdx.get(key);
    if (existingIdx !== undefined) {
      simpleSpinePath.length = existingIdx + 1;
      for (const [k, idx] of spineVisitedIdx.entries()) {
        if (idx > existingIdx) spineVisitedIdx.delete(k);
      }
    } else {
      spineVisitedIdx.set(key, simpleSpinePath.length);
      simpleSpinePath.push(node);
    }
  }

  const gatedEdges = new Map<string, GatedEdgeSpec>();
  const spineDoorCandidates: GatedEdgeSpec[] = [];
  const spineCandidateKeys = new Set<string>();

  for (let i = 0; i < simpleSpinePath.length - 1; i++) {
    const a = simpleSpinePath[i];
    const b = simpleSpinePath[i + 1];
    if (Math.abs(a.col - b.col) + Math.abs(a.row - b.row) !== 1) continue;
    const sa = slots[a.row][a.col];
    const sb = slots[b.row][b.col];
    const dirKey: 'E' | 'W' | 'S' | 'N' =
      b.col > a.col ? 'E' : (b.col < a.col ? 'W' : (b.row > a.row ? 'S' : 'N'));
    if (!sa.sockets[dirKey]) continue;
    if (
      sa.encounterId &&
      sb.encounterId &&
      sa.encounterOrigin?.col === sb.encounterOrigin?.col &&
      sa.encounterOrigin?.row === sb.encounterOrigin?.row
    ) {
      continue;
    }
    if ((sa.encounterId === 'guardian_lair' || sb.encounterId === 'guardian_lair') && a.row !== b.row) continue;

    const ek = makeEdgeKey(a.col, a.row, b.col, b.row);
    if (gatedEdges.has(ek)) continue;
    const isVaultEntry = sb.role === 'vault' || sa.role === 'vault';
    const gateObj: GatedEdgeSpec = {
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

  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols; c++) {
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

  const grottoCount = encounterPlacements.filter(ep => ep.encounter.id === 'mushroom_grotto').length;
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
  const tradeItemPoolCount = UNDERGROUND_ITEMS.filter(
    i => i.id !== 'pickaxe' && i.id !== 'rope' && i.id !== 'mushroom'
  ).length;
  const chainPoolSize = tradeItemPoolCount - (settings.decoyCount > 0 ? 1 : 0);

  const evaluateGuardianSet = (guardianKeys: Set<string>): GuardianEvalResult => {
    const visited = Array.from({ length: rows }, () => Array<boolean>(cols).fill(false));
    const queue = [{ c: campCol, r: 0 }];
    visited[0][campCol] = true;
    const segSummaries: Array<{ campCnt: number; regCnt: number; hasEncOut: boolean; isEmpty: boolean }> = [];

    const floodBarrierSeg = (startNodes: Array<{ c: number; r: number }>, isRoot: boolean) => {
      const q = [...startNodes];
      const frontiers: Array<{ c: number; r: number }> = [];
      let campCnt = 0;
      let regCnt = 0;
      let hasEncOut = false;
      while (q.length > 0) {
        const cur = q.shift()!;
        const s = slots[cur.r][cur.c];
        if (s.role === 'vault') continue;
        if (!s.encounterId) {
          if (s.role === 'camp') campCnt++;
          else regCnt++;
        }
        if (grottoSlotSet.has(`${cur.c},${cur.r}`) || chasmRowSet.has(`${cur.c},${cur.r}`)) {
          hasEncOut = true;
        }

        if (s.encounterId === 'guardian_lair') {
          const ep = encounterPlacements.find(p => p.encounter.id === 'guardian_lair' && p.originRow === cur.r);
          if (ep && cur.r + 1 < rows && slots[cur.r + 1][ep.exitCol]?.active && !visited[cur.r + 1][ep.exitCol]) {
            frontiers.push({ c: ep.exitCol, r: cur.r + 1 });
          }
        }
        if (s.encounterId === 'rope_chasm_bridge') {
          const ep = encounterPlacements.find(p => p.encounter.id === 'rope_chasm_bridge' && p.originRow === cur.r);
          if (ep && cur.c === ep.enterCol && !visited[ep.originRow][ep.originCol + 1]) {
            visited[ep.originRow][ep.originCol + 1] = true;
            q.push({ c: ep.originCol + 1, r: ep.originRow });
          }
        }

        const dirs: Array<[number, number, boolean]> = [
          [cur.c + 1, cur.r, s.sockets.E],
          [cur.c - 1, cur.r, s.sockets.W],
          [cur.c, cur.r + 1, s.sockets.S],
          [cur.c, cur.r - 1, s.sockets.N]
        ];
        for (const [nc, nr, open] of dirs) {
          if (!open || nc < 0 || nc >= cols || nr < 0 || nr >= rows) continue;
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

    const frontierQ: Array<Array<{ c: number; r: number }>> = [queue];
    let firstSeg = true;
    while (frontierQ.length > 0) {
      const seeds = frontierQ.shift()!.filter(n => !visited[n.r][n.c] && slots[n.r][n.c].role !== 'vault');
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

    const totalSegs = segSummaries.length;
    if (totalSegs === 0) return { feasible: false, deficit: 99 };
    const neededBarter = settings.targetSteps - totalSegs - grottoCount;
    if (neededBarter < 0) return { feasible: false, deficit: 99 };

    let totalCap = 0;
    let minCap = Infinity;
    for (let sIdx = 0; sIdx < totalSegs; sIdx++) {
      const seg = segSummaries[sIdx];
      if (seg.isEmpty) {
        if (!seg.hasEncOut || sIdx === 0) return { feasible: false, deficit: 99 };
        continue;
      }
      const rawPhys = seg.campCnt + seg.regCnt * 2;
      const reserve = sIdx === 0 ? (totalSegs > 1 && settings.targetSteps >= 9 && rawPhys >= 5 ? 2 : 1) : 1;
      const physMax = Math.max(0, rawPhys - reserve);
      const tokenMax = Math.min(6, Math.max(0, chainPoolSize - 2 - (seg.hasEncOut ? 1 : 0)));
      const cap = Math.min(physMax, tokenMax);
      totalCap += cap;
      if (cap < minCap) minCap = cap;
    }

    if (totalCap < neededBarter) {
      return { feasible: false, deficit: Math.max(0, neededBarter - totalCap) };
    }

    return {
      feasible: true,
      deficit: 0,
      margin: totalCap - neededBarter,
      minCap: minCap === Infinity ? 0 : minCap,
      segCount: totalSegs
    };
  };

  const candCount = spineDoorCandidates.length;
  const maxPick = Math.min(3, candCount);
  const desiredSegTarget = settings.targetSteps >= 12
    ? 3
    : (settings.targetSteps >= 7 ? 2 : 1);
  let bestGuardianSet = new Set<string>();
  let bestScore = -Infinity;

  const row0ExitKeys = new Set(
    spineDoorCandidates.filter(e => e.rowA === 0 && e.rowB === 1).map(e => e.edgeKey)
  );
  const tryCombo = (keys: Set<string>) => {
    const ev = evaluateGuardianSet(keys);
    if (!ev.feasible) return;
    // Prefer guardian barriers deeper than row 0->1 when rows >= 4 so Segment 0 spans multiple rows for loops/backtracks
    const hasRow0Barrier = Array.from(keys).some(k => row0ExitKeys.has(k));
    const shallowPenalty = rows >= 4 && hasRow0Barrier ? 35 : 0;
    const score =
      ev.minCap * 20 -
      Math.abs(ev.segCount - desiredSegTarget) * 12 +
      Math.min(4, ev.margin) * 3 -
      shallowPenalty;
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

  const maxSpineToolDoors = settings.targetSteps >= 12 ? 2 : 1;
  const nonGuardianDoors = shuffle(
    Array.from(gatedEdges.values()).filter(e => !e.isVaultEntry && e.gateType !== 'guardian'),
    rng
  );
  for (let i = maxSpineToolDoors; i < nonGuardianDoors.length; i++) {
    gatedEdges.delete(nonGuardianDoors[i].edgeKey);
  }

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

  // Add open maze loops within ungated components (direct cycle edges + 2x2 corner rings around pillars)
  let loopCount = 0;
  const targetLoops = settings.branchingFactor <= 1
    ? (settings.targetSteps >= 6 ? 1 : 0)
    : Math.min(3, settings.branchingFactor);

  if (targetLoops > 0) {
    const compGrid: number[][] = Array.from({ length: rows }, () =>
      Array<number>(cols).fill(-1)
    );
    let nextComp = 0;
    for (let sr = 0; sr < rows - 1; sr++) {
      for (let sc = 0; sc < cols; sc++) {
        const startSlot = slots[sr][sc];
        if (!startSlot.active || startSlot.encounterId || startSlot.role === 'vault' || compGrid[sr][sc] !== -1) {
          continue;
        }
        const cId = nextComp++;
        const q: Array<[number, number]> = [[sc, sr]];
        compGrid[sr][sc] = cId;
        while (q.length > 0) {
          const [cc, cr] = q.shift()!;
          const curSlot = slots[cr][cc];
          const dirs: Array<[number, number, boolean]> = [
            [cc + 1, cr, curSlot.sockets.E],
            [cc - 1, cr, curSlot.sockets.W],
            [cc, cr + 1, curSlot.sockets.S],
            [cc, cr - 1, curSlot.sockets.N]
          ];
          for (const [nc, nr, open] of dirs) {
            if (!open || nc < 0 || nc >= cols || nr < 0 || nr >= rows - 1) continue;
            const ns = slots[nr][nc];
            if (!ns.active || ns.encounterId || ns.role === 'vault' || compGrid[nr][nc] !== -1) continue;
            if (gatedEdges.has(makeEdgeKey(cc, cr, nc, nr))) continue;
            compGrid[nr][nc] = cId;
            q.push([nc, nr]);
          }
        }
      }
    }

    // 1. Direct cycle edges between adjacent active slots in the same ungated component
    const directLoopCandidates: Array<{ c1: number; r1: number; c2: number; r2: number; vert: boolean }> = [];
    for (let r = 0; r < rows - 1; r++) {
      for (let c = 0; c < cols; c++) {
        const s = slots[r][c];
        if (!s.active || s.encounterId || s.role === 'vault' || compGrid[r][c] === -1) continue;
        if (c + 1 < cols && !s.sockets.E && compGrid[r][c + 1] === compGrid[r][c]) {
          directLoopCandidates.push({ c1: c, r1: r, c2: c + 1, r2: r, vert: false });
        }
        if (r + 1 < rows - 1 && !s.sockets.S && compGrid[r + 1][c] === compGrid[r][c]) {
          directLoopCandidates.push({ c1: c, r1: r, c2: c, r2: r + 1, vert: true });
        }
      }
    }
    const sortedDirect = shuffle(directLoopCandidates, rng).sort((a, b) => Number(b.vert) - Number(a.vert));
    for (const cand of sortedDirect) {
      if (loopCount >= targetLoops) break;
      const ek = makeEdgeKey(cand.c1, cand.r1, cand.c2, cand.r2);
      if (gatedEdges.has(ek)) continue;
      connectSlots(slots, cand.c1, cand.r1, cand.c2, cand.r2);
      loopCount++;
    }

    // 2. 2x2 L-corner completions to carve ring loops around rock pillars
    if (loopCount < targetLoops) {
      const cornerCandidates: Array<{
        c: number;
        r: number;
        n1: [number, number];
        n2: [number, number];
        compId: number;
      }> = [];
      for (let r = 0; r < rows - 1; r++) {
        for (let c = 0; c < cols; c++) {
          if (slots[r][c].active || slots[r][c].encounterId) continue;
          const pairs: Array<[[number, number], [number, number]]> = [
            [[c + 1, r], [c, r + 1]],
            [[c - 1, r], [c, r + 1]],
            [[c + 1, r], [c, r - 1]],
            [[c - 1, r], [c, r - 1]]
          ];
          for (const [[c1, r1], [c2, r2]] of pairs) {
            if (
              c1 < 0 || c1 >= cols || r1 < 0 || r1 >= rows - 1 ||
              c2 < 0 || c2 >= cols || r2 < 0 || r2 >= rows - 1
            ) continue;
            const comp1 = compGrid[r1][c1];
            const comp2 = compGrid[r2][c2];
            if (comp1 !== -1 && comp1 === comp2) {
              cornerCandidates.push({ c, r, n1: [c1, r1], n2: [c2, r2], compId: comp1 });
              break;
            }
          }
        }
      }
      for (const cc of shuffle(cornerCandidates, rng)) {
        if (loopCount >= targetLoops) break;
        if (slots[cc.r][cc.c].active) continue;
        // Verify both neighbors are still in the same component and haven't changed
        if (compGrid[cc.n1[1]][cc.n1[0]] !== cc.compId || compGrid[cc.n2[1]][cc.n2[0]] !== cc.compId) continue;
        connectSlots(slots, cc.c, cc.r, cc.n1[0], cc.n1[1]);
        connectSlots(slots, cc.c, cc.r, cc.n2[0], cc.n2[1]);
        slots[cc.r][cc.c].role = 'loop';
        compGrid[cc.r][cc.c] = cc.compId;
        loopCount++;
      }
    }

    // 3. 2-slot ring extension off an existing open horizontal/vertical edge when still below targetLoops
    if (loopCount < targetLoops) {
      const ringCandidates: Array<{ a: [number, number]; b: [number, number]; na: [number, number]; nb: [number, number]; compId: number }> = [];
      for (let r = 0; r < rows - 1; r++) {
        for (let c = 0; c < cols; c++) {
          const s = slots[r][c];
          if (!s.active || s.encounterId || s.role === 'vault' || compGrid[r][c] === -1) continue;
          if (c + 1 < cols && s.sockets.E && compGrid[r][c + 1] === compGrid[r][c] && !gatedEdges.has(makeEdgeKey(c, r, c + 1, r))) {
            for (const dr of [1, -1]) {
              const nr = r + dr;
              if (nr < 0 || nr >= rows - 1) continue;
              if (!slots[nr][c].active && !slots[nr][c].encounterId && !slots[nr][c + 1].active && !slots[nr][c + 1].encounterId) {
                ringCandidates.push({ a: [c, r], b: [c + 1, r], na: [c, nr], nb: [c + 1, nr], compId: compGrid[r][c] });
              }
            }
          }
          if (r + 1 < rows - 1 && s.sockets.S && compGrid[r + 1][c] === compGrid[r][c] && !gatedEdges.has(makeEdgeKey(c, r, c, r + 1))) {
            for (const dc of [1, -1]) {
              const nc = c + dc;
              if (nc < 0 || nc >= cols) continue;
              if (!slots[r][nc].active && !slots[r][nc].encounterId && !slots[r + 1][nc].active && !slots[r + 1][nc].encounterId) {
                ringCandidates.push({ a: [c, r], b: [c, r + 1], na: [nc, r], nb: [nc, r + 1], compId: compGrid[r][c] });
              }
            }
          }
        }
      }
      for (const rc of shuffle(ringCandidates, rng)) {
        if (loopCount >= targetLoops) break;
        if (slots[rc.na[1]][rc.na[0]].active || slots[rc.nb[1]][rc.nb[0]].active) continue;
        connectSlots(slots, rc.a[0], rc.a[1], rc.na[0], rc.na[1]);
        connectSlots(slots, rc.b[0], rc.b[1], rc.nb[0], rc.nb[1]);
        connectSlots(slots, rc.na[0], rc.na[1], rc.nb[0], rc.nb[1]);
        slots[rc.na[1]][rc.na[0]].role = 'loop';
        slots[rc.nb[1]][rc.nb[0]].role = 'loop';
        compGrid[rc.na[1]][rc.na[0]] = rc.compId;
        compGrid[rc.nb[1]][rc.nb[0]] = rc.compId;
        loopCount++;
      }
    }

    // 4. If still 0 loops, connect two adjacent active slots within the same barrier segment
    // (promoting a gated spur into a navigable loop when an adjacent active neighbor exists)
    if (loopCount === 0 && targetLoops > 0) {
      const segGrid: number[][] = Array.from({ length: rows }, () =>
        Array<number>(cols).fill(-1)
      );
      let nextSeg = 0;
      for (let sr = 0; sr < rows - 1; sr++) {
        for (let sc = 0; sc < cols; sc++) {
          const st = slots[sr][sc];
          if (!st.active || st.encounterId || st.role === 'vault' || segGrid[sr][sc] !== -1) continue;
          const sId = nextSeg++;
          const q: Array<[number, number]> = [[sc, sr]];
          segGrid[sr][sc] = sId;
          while (q.length > 0) {
            const [cc, cr] = q.shift()!;
            const cs = slots[cr][cc];
            const dirs: Array<[number, number, boolean]> = [
              [cc + 1, cr, cs.sockets.E],
              [cc - 1, cr, cs.sockets.W],
              [cc, cr + 1, cs.sockets.S],
              [cc, cr - 1, cs.sockets.N]
            ];
            for (const [nc, nr, open] of dirs) {
              if (!open || nc < 0 || nc >= cols || nr < 0 || nr >= rows - 1) continue;
              const ns = slots[nr][nc];
              if (!ns.active || ns.encounterId || ns.role === 'vault' || segGrid[nr][nc] !== -1) continue;
              const ge = gatedEdges.get(makeEdgeKey(cc, cr, nc, nr));
              if (ge && (ge.gateType === 'guardian' || ge.isVaultEntry)) continue;
              segGrid[nr][nc] = sId;
              q.push([nc, nr]);
            }
          }
        }
      }

      const segLoopCands: Array<{ c1: number; r1: number; c2: number; r2: number }> = [];
      for (let r = 0; r < rows - 1; r++) {
        for (let c = 0; c < cols; c++) {
          const s = slots[r][c];
          if (!s.active || s.encounterId || s.role === 'vault' || segGrid[r][c] === -1) continue;
          if (c + 1 < cols && !s.sockets.E && segGrid[r][c + 1] === segGrid[r][c]) {
            segLoopCands.push({ c1: c, r1: r, c2: c + 1, r2: r });
          }
          if (r + 1 < rows - 1 && !s.sockets.S && segGrid[r + 1][c] === segGrid[r][c]) {
            segLoopCands.push({ c1: c, r1: r, c2: c, r2: r + 1 });
          }
        }
      }
      if (segLoopCands.length > 0) {
        const picked = pickOne(segLoopCands, rng);
        connectSlots(slots, picked.c1, picked.r1, picked.c2, picked.r2);
        loopCount++;
      }
    }
  }

  const slotZone: Array<Array<number | null>> = Array.from({ length: rows }, () =>
    Array<number | null>(cols).fill(null)
  );
  const zoneMeta = new Map<number, ZoneMeta>();
  let nextZoneId = 1;

  const floodZone = (
    startCol: number,
    startRow: number,
    zoneId: number,
    parentZone: number | null = null,
    gateInfo: GatedEdgeSpec | EncounterPlacement | null = null
  ): PendingFrontier[] => {
    const queue = [{ col: startCol, row: startRow }];
    slotZone[startRow][startCol] = zoneId;
    slots[startRow][startCol].zone = zoneId;
    const zInfo: ZoneMeta = {
      id: zoneId,
      minRow: startRow,
      maxRow: startRow,
      slots: [{ col: startCol, row: startRow }],
      parentZone,
      gateInfo,
      isVaultZone: slots[startRow][startCol].role === 'vault'
    };
    zoneMeta.set(zoneId, zInfo);

    const frontier: PendingFrontier[] = [];
    while (queue.length > 0) {
      const cur = queue.shift()!;
      const s = slots[cur.row][cur.col];
      zInfo.minRow = Math.min(zInfo.minRow, cur.row);
      zInfo.maxRow = Math.max(zInfo.maxRow, cur.row);
      if (s.role === 'vault') zInfo.isVaultZone = true;

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

      const neighbors: Array<[number, number, boolean]> = [
        [cur.col + 1, cur.row, s.sockets.E],
        [cur.col - 1, cur.row, s.sockets.W],
        [cur.col, cur.row + 1, s.sockets.S],
        [cur.col, cur.row - 1, s.sockets.N]
      ];
      for (const [nc, nr, open] of neighbors) {
        if (!open || nc < 0 || nc >= cols || nr < 0 || nr >= rows) continue;
        if (!slots[nr][nc].active) continue;
        if (s.encounterId === 'guardian_lair' && nr === cur.row + 1) continue;
        const ek = makeEdgeKey(cur.col, cur.row, nc, nr);
        const gate = gatedEdges.get(ek);
        if (slotZone[nr][nc] !== null) {
          if (gate && gate.fromZone == null) {
            const existingZ = slotZone[nr][nc]!;
            if (existingZ === zoneId) {
              gatedEdges.delete(ek);
            } else {
              gate.fromZone = Math.min(zoneId, existingZ);
              gate.toZone = Math.max(zoneId, existingZ);
            }
          }
          continue;
        }
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
    const f = pendingFrontiers.shift()!;
    const existingToZone = slotZone[f.toRow][f.toCol];
    if (existingToZone !== null) {
      if (f.edgeGate) {
        if (existingToZone === f.fromZone) {
          gatedEdges.delete(f.edgeGate.edgeKey);
        } else {
          f.edgeGate.fromZone = f.fromZone;
          f.edgeGate.toZone = existingToZone;
        }
      }
      continue;
    }
    const zId = nextZoneId++;
    if (f.edgeGate) {
      f.edgeGate.fromZone = f.fromZone;
      f.edgeGate.toZone = zId;
    } else if (f.internalEncounter) {
      f.internalEncounter.fromZone = f.fromZone;
      f.internalEncounter.toZone = zId;
    }
    const more = floodZone(f.toCol, f.toRow, zId, f.fromZone, f.edgeGate || f.internalEncounter || null);
    pendingFrontiers.push(...more);
  }

  for (const ep of encounterPlacements) {
    if (ep.encounter.id === 'mushroom_grotto') {
      const mainZone = slots[ep.originRow][ep.originCol].zone ?? undefined;
      const pocketZoneId = nextZoneId++;
      ep.fromZone = mainZone;
      ep.toZone = pocketZoneId;
      zoneMeta.set(pocketZoneId, {
        id: pocketZoneId,
        minRow: ep.originRow,
        maxRow: ep.originRow,
        slots: [{ col: ep.originCol + 1, row: ep.originRow }],
        parentZone: mainZone ?? null,
        gateInfo: ep,
        isGrottoPocket: true
      });
    }
  }

  let vaultZoneId: number | null = null;
  for (const z of zoneMeta.values()) {
    if (z.isVaultZone) {
      vaultZoneId = z.id;
      break;
    }
  }
  if (!vaultZoneId || vaultZoneId === 1) return null;
  if (encounterPlacements.some(ep => ep.fromZone == null || ep.toZone == null)) return null;

  return {
    rows,
    cols,
    slots,
    campCol,
    vaultCol: actualVaultCol,
    vaultZoneId,
    zoneMeta,
    gatedEdges: Array.from(gatedEdges.values()),
    encounterPlacements,
    maxZoneId: nextZoneId - 1,
    loopCount
  };
}
