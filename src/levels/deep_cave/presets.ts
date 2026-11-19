import type { DeepCavePresetId, DeepCaveSettings } from '../../types/index.ts';

/**
 * Difficulty Presets & Advanced Knobs for `deep_cave` ("The Abyssal Descent").
 */

export interface DeepCavePresetConfig extends DeepCaveSettings {
  id: Exclude<DeepCavePresetId, 'custom'>;
}

export interface DeepCaveKnobDef {
  min: number;
  max: number;
  step: number;
}

export type DeepCaveKnobKey =
  | 'targetSteps'
  | 'rows'
  | 'branchingFactor'
  | 'spurCount'
  | 'decoyCount'
  | 'pickaxeSurplus'
  | 'maxBacktracks'
  | 'maxBacktrackRows'
  | 'numDiggers'
  | 'encounterCount'
  | 'torchRadius';

export const DEEP_CAVE_PRESETS: Record<Exclude<DeepCavePresetId, 'custom'>, DeepCavePresetConfig> = {
  easy: {
    id: 'easy',
    targetSteps: 5,
    rows: 3,
    branchingFactor: 1,
    spurCount: 1,
    decoyCount: 0,
    pickaxeSurplus: 2,
    maxBacktracks: 0,
    maxBacktrackRows: 0,
    numDiggers: 0,
    encounterCount: 1,
    torchRadius: 68
  },
  normal: {
    id: 'normal',
    targetSteps: 8,
    rows: 4,
    branchingFactor: 2,
    spurCount: 2,
    decoyCount: 1,
    pickaxeSurplus: 1,
    maxBacktracks: 1,
    maxBacktrackRows: 1,
    numDiggers: 1,
    encounterCount: 2,
    torchRadius: 58
  },
  hard: {
    id: 'hard',
    targetSteps: 12,
    rows: 5,
    branchingFactor: 3,
    spurCount: 3,
    decoyCount: 2,
    pickaxeSurplus: 0,
    maxBacktracks: 2,
    maxBacktrackRows: 2,
    numDiggers: 1,
    encounterCount: 2,
    torchRadius: 52
  },
  expert: {
    id: 'expert',
    targetSteps: 16,
    rows: 6,
    branchingFactor: 3,
    spurCount: 4,
    decoyCount: 3,
    pickaxeSurplus: 0,
    maxBacktracks: 3,
    maxBacktrackRows: 4,
    numDiggers: 2,
    encounterCount: 3,
    torchRadius: 48
  }
};

export const DEEP_CAVE_KNOB_DEFS: Record<DeepCaveKnobKey, DeepCaveKnobDef> = {
  targetSteps: { min: 3, max: 20, step: 1 },
  rows: { min: 3, max: 7, step: 1 },
  branchingFactor: { min: 1, max: 3, step: 1 },
  spurCount: { min: 0, max: 5, step: 1 },
  decoyCount: { min: 0, max: 4, step: 1 },
  pickaxeSurplus: { min: 0, max: 3, step: 1 },
  maxBacktracks: { min: 0, max: 4, step: 1 },
  maxBacktrackRows: { min: 0, max: 5, step: 1 },
  numDiggers: { min: 0, max: 3, step: 1 },
  encounterCount: { min: 0, max: 3, step: 1 },
  torchRadius: { min: 42, max: 80, step: 2 }
};

export const DEFAULT_DEEP_CAVE_SETTINGS: DeepCaveSettings = { ...DEEP_CAVE_PRESETS.normal };

function clampKnob(key: DeepCaveKnobKey, value: unknown, fallback: number): number {
  const def = DEEP_CAVE_KNOB_DEFS[key];
  if (!def) return (value as number) ?? fallback;
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  const clamped = Math.max(def.min, Math.min(def.max, num));
  return def.step === 1 ? Math.round(clamped) : clamped;
}

/**
 * Checks whether a knob configuration matches one of the named presets verbatim.
 */
export function detectDeepCavePresetId(
  settings: Record<string, any> | null | undefined
): DeepCavePresetId {
  if (!settings) return 'normal';
  for (const [presetId, preset] of Object.entries(DEEP_CAVE_PRESETS)) {
    const matches = (Object.keys(DEEP_CAVE_KNOB_DEFS) as DeepCaveKnobKey[]).every(
      key => Number(settings[key]) === Number(preset[key])
    );
    if (matches) return presetId as DeepCavePresetId;
  }
  return 'custom';
}

/**
 * Resolves a preset name or partial settings object into a complete clamped configuration.
 */
export function normalizeDeepCaveSettings(
  input: any = null,
  overrides: Record<string, any> | null = null
): DeepCaveSettings & { preset: DeepCavePresetId } {
  let base: DeepCavePresetConfig = DEEP_CAVE_PRESETS.normal;
  if (typeof input === 'string' && input in DEEP_CAVE_PRESETS) {
    base = DEEP_CAVE_PRESETS[input as keyof typeof DEEP_CAVE_PRESETS];
  } else if (input && typeof input === 'object') {
    if (typeof input.preset === 'string' && input.preset in DEEP_CAVE_PRESETS) {
      base = DEEP_CAVE_PRESETS[input.preset as keyof typeof DEEP_CAVE_PRESETS];
    } else if (typeof input.id === 'string' && input.id in DEEP_CAVE_PRESETS) {
      base = DEEP_CAVE_PRESETS[input.id as keyof typeof DEEP_CAVE_PRESETS];
    }
  }

  const merged: Record<string, any> = {
    ...base,
    ...(input && typeof input === 'object' ? input : {}),
    ...(overrides && typeof overrides === 'object' ? overrides : {})
  };

  const normalized: Record<string, any> = {};
  for (const key of Object.keys(DEEP_CAVE_KNOB_DEFS) as DeepCaveKnobKey[]) {
    normalized[key] = clampKnob(key, merged[key], Number(base[key]));
  }
  normalized.preset = detectDeepCavePresetId(normalized);
  return normalized as DeepCaveSettings & { preset: DeepCavePresetId };
}
