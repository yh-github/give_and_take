import ropeChasmBridge from './rope_chasm_bridge.js';
import guardianLair from './guardian_lair.js';
import mushroomGrotto from './mushroom_grotto.js';

export const DEEP_CAVE_ENCOUNTERS = [
  ropeChasmBridge,
  guardianLair,
  mushroomGrotto
];

export const ENCOUNTERS_BY_ID = Object.fromEntries(
  DEEP_CAVE_ENCOUNTERS.map(enc => [enc.id, enc])
);

export default DEEP_CAVE_ENCOUNTERS;
