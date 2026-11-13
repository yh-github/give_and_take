/**
 * Curated Encounter 1: Rope Chasm Bridge (2x1 slots)
 *
 * A wide subterranean fissure splits an upper arrival ledge from a lower chamber.
 * Consuming 1 `rope` at the chasm anchor strings a permanent crossing bridge to
 * unlock the treasure cache (`outputs`) and the south descent.
 */
export default {
  id: 'rope_chasm_bridge',
  footprint: { cols: 2, rows: 1 },
  sockets: {
    north: [{ colOffset: 0, required: true }],
    south: [{ colOffset: 1, required: true }],
    east: [],
    west: []
  },
  tileGrid: [
    '##CCCCCC############',
    '##CCCCCC############',
    '#.......####.......#',
    '#.......####.......#',
    '#.......####...E...#',
    '#.......####.......#',
    '#.......CLLC.......#',
    '#.......CLLC.......#',
    '#.......CLLC.......#',
    '#.......CLLC.......#',
    '#.......CLLC.......#',
    '#.......CLLC.......#',
    '#.......####.......#',
    '#.......####.......#',
    '#.......####.......#',
    '#.......####.......#',
    '############CCCCCC##',
    '############CCCCCC##'
  ],
  puzzleFragment: {
    inputs: ['rope'],
    outputs: ['crystal'],
    gatekeepers: [
      { anchor: 'L1', type: 'chasm', requires: ['rope'], unlocksExit: 'south:1' }
    ],
    internalTrade: null,
    internalSteps: 0
  },
  placement: {
    minDifficulty: 'easy',
    depthRange: [0.2, 0.8],
    maxPerLevel: 1,
    weight: 1.0
  },
  mechanicHook: null
};
