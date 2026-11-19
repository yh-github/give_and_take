import ropeChasmBridge from './rope_chasm_bridge.ts';
import guardianLair from './guardian_lair.ts';
import mushroomGrotto from './mushroom_grotto.ts';
import type { EncounterModule } from '../../../types/index.ts';

export const DEEP_CAVE_ENCOUNTERS: EncounterModule[] = [
  ropeChasmBridge,
  guardianLair,
  mushroomGrotto
];

export const ENCOUNTERS_BY_ID: Record<string, EncounterModule> = Object.fromEntries(
  DEEP_CAVE_ENCOUNTERS.map(enc => [enc.id, enc])
);

export default DEEP_CAVE_ENCOUNTERS;
