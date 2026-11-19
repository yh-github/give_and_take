import type { EncounterModule } from '../../../types/index.ts';

/**
 * Curated Encounter 3: Mushroom Grotto (2x1 slots)
 *
 * A hidden fungal pocket behind an interior rock doorway (`pickaxe`). Inside sits
 * a wild Mushroom resource plus an exchange hermit holding an essential progression item.
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
    '#.......####.......#',
    '#.......####.......#',
    '#.......CGGC.......#',
    '#.......CGGC.......#',
    '#.......CGGC...E...#',
    '#.......CGGC.......#',
    '#.......CGGC.......#',
    '#.......CGGC.......#',
    '#...E...####.......#',
    '#.......####.......#',
    '#.......####.......#',
    '#.......####.......#',
    '##CCCCCC############',
    '##CCCCCC############'
  ],
  puzzleFragment: {
    inputs: ['pickaxe'],
    outputs: ['emerald'],
    internalPresetItems: ['mushroom'],
    gatekeepers: [
      { anchor: 'G1', type: 'rock', requires: ['pickaxe'] }
    ],
    internalTrade: {
      templateId: 'goblin',
      requires: ['mushroom']
    },
    internalSteps: 1
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
