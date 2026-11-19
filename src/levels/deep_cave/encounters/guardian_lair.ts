import type { EncounterModule } from '../../../types/index.ts';

/**
 * Curated Encounter 2: Guardian Lair (1x1 slot)
 *
 * An ambush chamber narrowed into an orthogonal stone collar guarded by a
 * blocking Cave Troll (`guardian`). Must be cleared via barter rather than mined.
 */
const guardianLair: EncounterModule = {
  id: 'guardian_lair',
  footprint: { cols: 1, rows: 1 },
  sockets: {
    north: [{ colOffset: 0, required: true }],
    south: [{ colOffset: 0, required: true }],
    east: [],
    west: []
  },
  tileGrid: [
    '##CCCCCC##',
    '##CCCCCC##',
    '#........#',
    '#........#',
    '#........#',
    '#........#',
    '#........#',
    '#........#',
    '##CCCCCC##',
    '##GGGGGG##',
    '##CCCCCC##',
    '#........#',
    '#........#',
    '#........#',
    '#........#',
    '#........#',
    '##CCCCCC##',
    '##CCCCCC##'
  ],
  puzzleFragment: {
    inputs: ['bone'],
    outputs: [],
    gatekeepers: [
      { anchor: 'G1', type: 'guardian', templateId: 'troll', requires: ['bone'], unlocksExit: 'south:0' }
    ],
    internalTrade: null,
    internalSteps: 1
  },
  placement: {
    minDifficulty: 'easy',
    depthRange: [0.2, 0.85],
    maxPerLevel: 1,
    weight: 1.0
  },
  mechanicHook: null
};

export default guardianLair;
