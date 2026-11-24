import type { EncounterModule } from '../../../types/index.ts';

/**
 * Curated Encounter 3: Mushroom Grotto (2x1 slots)
 *
 * A hidden fungal pocket behind an interior rock doorway (`pickaxe`). Inside sits
 * wild Mushroom forage plus a secondary deep-grotto cache — decoupled from its
 * distant cave consumers so players explore and carry mushrooms across zones.
 */
const mushroomGrotto: EncounterModule = {
  id: 'mushroom_grotto',
  footprint: { cols: 2, rows: 1 },
  sockets: {
    north: [{ colOffset: 0, required: true }],
    south: [{ colOffset: 0, required: true }],
    east: [],
    west: []
  },
  tileGrid: [
    '##CCCCCC############',
    '##CCCCCC############',
    '#.......####.......#',
    '#.......####.......#',
    '#.......####..E....#',
    '#.......####.......#',
    '#.......CGGC.......#',
    '#.......CGGC.......#',
    '#.......CGGC.......#',
    '#.......CGGC.......#',
    '#.......CGGC.......#',
    '#.......CGGC.......#',
    '#.......####.......#',
    '#.......####....E..#',
    '#.......####.......#',
    '#.......####.......#',
    '##CCCCCC############',
    '##CCCCCC############'
  ],
  puzzleFragment: {
    inputs: ['pickaxe'],
    outputs: ['mushroom'],
    internalPresetItems: [],
    gatekeepers: [
      { anchor: 'G1', type: 'rock', requires: ['pickaxe'] }
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

export default mushroomGrotto;
