/**
 * Schema & Solvability Validator for `deep_cave` Curated Encounter Modules.
 *
 * Ensures every encounter in `src/levels/deep_cave/encounters/` satisfies
 * exact `10*cols x 18*rows` dimensions, socket-to-'C'-collar alignment,
 * mechanicHook/solver parity, and internal reachability/solvability.
 */

import { solvePuzzle } from '../../../logic/solver.ts';
import {
  DOOR_EW_ROW_END,
  DOOR_EW_ROW_START,
  DOOR_NS_COL_END,
  DOOR_NS_COL_START,
  TILE_COLS_PER_SLOT,
  TILE_ROWS_PER_SLOT
} from '../slotGrid.ts';
import type {
  EncounterDirection,
  EncounterValidationResult,
  PuzzleEntity
} from '../../../types/index.ts';

const VALID_TILE_CHARS = new Set(['#', '.', 'C', 'G', 'E', 'L']);
const VALID_DIRECTIONS: EncounterDirection[] = ['north', 'south', 'east', 'west'];

interface TileCoord {
  c: number;
  r: number;
}

interface SocketTile extends TileCoord {
  dir: EncounterDirection;
  offset: number;
}

/**
 * Flood-fills open tiles from a starting tile set to verify reachability across
 * the encounter tileGrid (treating gatekeeper anchors 'G'/'L' as traversable once unlocked).
 */
function bfsReachableTiles(
  tileGrid: readonly string[],
  startTiles: readonly TileCoord[],
  blockedTiles: Set<string> = new Set()
): Set<string> {
  const rows = tileGrid.length;
  const cols = rows > 0 ? tileGrid[0].length : 0;
  const visited = new Set<string>();
  const queue: TileCoord[] = [];

  for (const t of startTiles) {
    const ch = tileGrid[t.r]?.[t.c];
    if (!ch || ch === '#' || blockedTiles.has(`${t.c},${t.r}`)) continue;
    const k = `${t.c},${t.r}`;
    if (!visited.has(k)) {
      visited.add(k);
      queue.push(t);
    }
  }

  while (queue.length > 0) {
    const cur = queue.shift()!;
    const dirs: Array<[number, number]> = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (const [dc, dr] of dirs) {
      const nc = cur.c + dc;
      const nr = cur.r + dr;
      if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
      const k = `${nc},${nr}`;
      if (visited.has(k) || blockedTiles.has(k)) continue;
      if (tileGrid[nr][nc] === '#') continue;
      visited.add(k);
      queue.push({ c: nc, r: nr });
    }
  }

  return visited;
}

/**
 * Validates an encounter module against the v2.0 contract.
 */
export function validateEncounterModule(encounter: any): EncounterValidationResult {
  const errors: string[] = [];
  if (!encounter || typeof encounter !== 'object') {
    return { valid: false, errors: ['Encounter module must be an object'] };
  }

  if (!encounter.id || typeof encounter.id !== 'string') {
    errors.push('Missing string `id`');
  }

  const fp = encounter.footprint;
  if (!fp || typeof fp.cols !== 'number' || typeof fp.rows !== 'number' || fp.cols < 1 || fp.rows < 1) {
    errors.push('Invalid `footprint` { cols, rows }');
    return { valid: false, errors };
  }

  const expectedRows = fp.rows * TILE_ROWS_PER_SLOT;
  const expectedCols = fp.cols * TILE_COLS_PER_SLOT;

  if (!Array.isArray(encounter.tileGrid) || encounter.tileGrid.length !== expectedRows) {
    errors.push(`tileGrid must have ${expectedRows} rows (got ${encounter.tileGrid?.length ?? 0})`);
    return { valid: false, errors };
  }

  for (let r = 0; r < expectedRows; r++) {
    const line = encounter.tileGrid[r];
    if (typeof line !== 'string' || line.length !== expectedCols) {
      errors.push(`tileGrid row ${r} must be a string of length ${expectedCols}`);
      return { valid: false, errors };
    }
    for (let c = 0; c < expectedCols; c++) {
      if (!VALID_TILE_CHARS.has(line[c])) {
        errors.push(`Invalid tile character '${line[c]}' at (${c},${r})`);
      }
    }
  }

  // Validate socket definitions and perimeter 'C' collar alignment
  const sockets = encounter.sockets || {};
  const socketTiles: SocketTile[] = [];
  for (const dir of VALID_DIRECTIONS) {
    if (!Array.isArray(sockets[dir])) {
      errors.push(`sockets.${dir} must be an array`);
      continue;
    }
    for (const sock of sockets[dir]) {
      if (dir === 'north' || dir === 'south') {
        if (typeof sock.colOffset !== 'number' || sock.colOffset < 0 || sock.colOffset >= fp.cols) {
          errors.push(`Invalid ${dir} socket colOffset: ${sock.colOffset}`);
          continue;
        }
        const edgeRow = dir === 'north' ? 0 : expectedRows - 1;
        const cStart = sock.colOffset * TILE_COLS_PER_SLOT + DOOR_NS_COL_START;
        const cEnd = sock.colOffset * TILE_COLS_PER_SLOT + DOOR_NS_COL_END;
        for (let c = cStart; c < cEnd; c++) {
          if (encounter.tileGrid[edgeRow][c] !== 'C') {
            errors.push(`${dir}:${sock.colOffset} perimeter tile (${c},${edgeRow}) must be 'C', found '${encounter.tileGrid[edgeRow][c]}'`);
          }
          socketTiles.push({ dir, offset: sock.colOffset, c, r: edgeRow });
        }
      } else {
        if (typeof sock.rowOffset !== 'number' || sock.rowOffset < 0 || sock.rowOffset >= fp.rows) {
          errors.push(`Invalid ${dir} socket rowOffset: ${sock.rowOffset}`);
          continue;
        }
        const edgeCol = dir === 'west' ? 0 : expectedCols - 1;
        const rStart = sock.rowOffset * TILE_ROWS_PER_SLOT + DOOR_EW_ROW_START;
        const rEnd = sock.rowOffset * TILE_ROWS_PER_SLOT + DOOR_EW_ROW_END;
        for (let r = rStart; r < rEnd; r++) {
          if (encounter.tileGrid[r][edgeCol] !== 'C') {
            errors.push(`${dir}:${sock.rowOffset} perimeter tile (${edgeCol},${r}) must be 'C', found '${encounter.tileGrid[r][edgeCol]}'`);
          }
          socketTiles.push({ dir, offset: sock.rowOffset, c: edgeCol, r });
        }
      }
    }
  }

  // Require mechanicHook solver parity if hook is provided
  if (encounter.mechanicHook != null) {
    if (typeof encounter.mechanicHook.solverTransition !== 'function') {
      errors.push('mechanicHook must provide a deterministic solverTransition function');
    }
  }

  // Validate puzzleFragment structure & internal solvability
  const frag = encounter.puzzleFragment;
  if (!frag || typeof frag !== 'object') {
    errors.push('Missing `puzzleFragment`');
  } else {
    if (!Array.isArray(frag.inputs) || !Array.isArray(frag.outputs) || !Array.isArray(frag.gatekeepers)) {
      errors.push('puzzleFragment requires inputs, outputs, and gatekeepers arrays');
    } else {
      // Check tile reachability from entry sockets when gatekeepers can open
      if (socketTiles.length > 0) {
        const reachable = bfsReachableTiles(encounter.tileGrid, socketTiles);
        for (let r = 0; r < expectedRows; r++) {
          for (let c = 0; c < expectedCols; c++) {
            const ch = encounter.tileGrid[r][c];
            if ((ch === 'G' || ch === 'E' || ch === 'L') && !reachable.has(`${c},${r}`)) {
              errors.push(`Encounter anchor '${ch}' at (${c},${r}) is unreachable from entry sockets`);
            }
          }
        }
      }

      // Verify declared gatekeepers + internalSteps solve cleanly from declared inputs
      const simEntities: PuzzleEntity[] = [];
      let curZone = 1;
      for (let i = 0; i < frag.gatekeepers.length; i++) {
        const g = frag.gatekeepers[i];
        simEntities.push({
          id: `enc_gate_${i}`,
          x: 0,
          y: 0,
          isGatekeeper: true,
          gateType: g.type || 'rock',
          requires: g.requires || [],
          reqType: 'AND',
          reward: g.reward || null,
          zone: curZone,
          unlocksZones: [curZone + 1]
        });
        curZone++;
      }

      const internalRewards = [...(frag.outputs || [])];
      if (frag.internalTrade && internalRewards.length > 0) {
        simEntities.push({
          id: 'enc_trade_0',
          x: 0,
          y: 0,
          isGatekeeper: false,
          requires: frag.internalTrade.requires || [],
          reqType: 'AND',
          reward: internalRewards[0],
          zone: frag.gatekeepers.length > 0 ? curZone : 1
        });
      }

      if (simEntities.length > 0) {
        const goalEnt: PuzzleEntity = {
          id: 'enc_goal_check',
          x: 0,
          y: 0,
          isGoal: true,
          isGatekeeper: true,
          requires: internalRewards.length > 0 ? [internalRewards[0]] : (frag.gatekeepers[frag.gatekeepers.length - 1]?.requires || []),
          reqType: 'AND',
          reward: null,
          zone: curZone
        };
        const mockLevel = { mechanics: { isVertical: true, hasPickaxe: true } };
        const simInputs: string[] = [...(frag.inputs || [])];
        const entitiesForSolve =
          internalRewards.length > 0 && !frag.internalTrade
            ? [...simEntities]
            : [...simEntities, goalEnt];
        const targetGoalId =
          internalRewards.length > 0 && !frag.internalTrade
            ? (simEntities[simEntities.length - 1]?.id ?? 'enc_goal_check')
            : 'enc_goal_check';

        const sol = solvePuzzle(
          frag.internalPresetItems ? [...simInputs, ...frag.internalPresetItems] : simInputs,
          entitiesForSolve,
          targetGoalId,
          mockLevel,
          { maxStates: 4000 }
        );
        if (!sol && simEntities.length > 0 && frag.internalTrade) {
          errors.push('Encounter internal puzzleFragment is not solvable from its declared inputs');
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
