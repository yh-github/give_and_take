import type { DeepCavePresetId } from '../../types/index.ts';

/**
 * Difficulty Presets & Advanced Knobs for `underground` ("The Cave").
 */

export type UndergroundPresetId = DeepCavePresetId;

export type UndergroundKnobKey =
  | 'targetSteps'
  | 'numDiggers'
  | 'decoyCount'
  | 'pickaxeSurplus'
  | 'torchRadius';

export interface UndergroundSettings {
  targetSteps: number;
  numDiggers: number;
  decoyCount: number;
  pickaxeSurplus: number;
  torchRadius: number;
  [key: string]: unknown;
}

export interface UndergroundPresetConfig extends UndergroundSettings {
  id: Exclude<UndergroundPresetId, 'custom'>;
}

export interface UndergroundKnobDef {
  min: number;
  max: number;
  step: number;
}

export const UNDERGROUND_PRESETS: Record<Exclude<UndergroundPresetId, 'custom'>, UndergroundPresetConfig> = {
  easy: {
    id: 'easy',
    targetSteps: 5,
    numDiggers: 0,
    decoyCount: 0,
    pickaxeSurplus: 2,
    torchRadius: 62
  },
  normal: {
    id: 'normal',
    targetSteps: 7,
    numDiggers: 1,
    decoyCount: 1,
    pickaxeSurplus: 1,
    torchRadius: 52
  },
  hard: {
    id: 'hard',
    targetSteps: 9,
    numDiggers: 2,
    decoyCount: 2,
    pickaxeSurplus: 0,
    torchRadius: 46
  },
  expert: {
    id: 'expert',
    targetSteps: 11,
    numDiggers: 3,
    decoyCount: 3,
    pickaxeSurplus: 0,
    torchRadius: 42
  }
};

export const UNDERGROUND_KNOB_DEFS: Record<UndergroundKnobKey, UndergroundKnobDef> = {
  targetSteps: { min: 3, max: 12, step: 1 },
  numDiggers: { min: 0, max: 3, step: 1 },
  decoyCount: { min: 0, max: 3, step: 1 },
  pickaxeSurplus: { min: 0, max: 2, step: 1 },
  torchRadius: { min: 40, max: 72, step: 2 }
};

export const DEFAULT_UNDERGROUND_SETTINGS: UndergroundSettings = {
  ...UNDERGROUND_PRESETS.normal
};

function clampUndergroundKnob(key: UndergroundKnobKey, value: unknown, fallback: number): number {
  const def = UNDERGROUND_KNOB_DEFS[key];
  if (!def) return (value as number) ?? fallback;
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  const clamped = Math.max(def.min, Math.min(def.max, num));
  return def.step === 1 ? Math.round(clamped) : clamped;
}

/**
 * Checks whether an `underground` knob configuration matches one of the 4 named presets verbatim.
 */
export function detectUndergroundPresetId(
  settings: Record<string, any> | null | undefined
): UndergroundPresetId {
  if (!settings) return 'normal';
  for (const [presetId, preset] of Object.entries(UNDERGROUND_PRESETS)) {
    const matches = (Object.keys(UNDERGROUND_KNOB_DEFS) as UndergroundKnobKey[]).every(
      key => Number(settings[key]) === Number(preset[key])
    );
    if (matches) return presetId as UndergroundPresetId;
  }
  return 'custom';
}

/**
 * Resolves a preset name or partial settings object into a complete clamped configuration.
 */
export function normalizeUndergroundSettings(
  input: any = null,
  overrides: Record<string, any> | null = null
): UndergroundSettings & { preset: UndergroundPresetId } {
  let base: UndergroundPresetConfig = UNDERGROUND_PRESETS.normal;
  if (typeof input === 'string' && input in UNDERGROUND_PRESETS) {
    base = UNDERGROUND_PRESETS[input as keyof typeof UNDERGROUND_PRESETS];
  } else if (input && typeof input === 'object') {
    if (typeof input.preset === 'string' && input.preset in UNDERGROUND_PRESETS) {
      base = UNDERGROUND_PRESETS[input.preset as keyof typeof UNDERGROUND_PRESETS];
    } else if (typeof input.id === 'string' && input.id in UNDERGROUND_PRESETS) {
      base = UNDERGROUND_PRESETS[input.id as keyof typeof UNDERGROUND_PRESETS];
    }
  }

  const merged: Record<string, any> = {
    ...base,
    ...(input && typeof input === 'object' ? input : {}),
    ...(overrides && typeof overrides === 'object' ? overrides : {})
  };

  const normalized: Record<string, any> = {};
  for (const key of Object.keys(UNDERGROUND_KNOB_DEFS) as UndergroundKnobKey[]) {
    normalized[key] = clampUndergroundKnob(key, merged[key], Number(base[key]));
  }
  normalized.preset = detectUndergroundPresetId(normalized);
  return normalized as UndergroundSettings & { preset: UndergroundPresetId };
}

/**
 * Derives balanced `UndergroundSettings` when called with numeric `(targetSteps, numDiggers)`.
 */
export function deriveUndergroundSettingsFromSteps(
  targetSteps = 7,
  numDiggers: number | null = null
): UndergroundSettings & { preset: UndergroundPresetId } {
  const clampedSteps = clampUndergroundKnob('targetSteps', targetSteps, UNDERGROUND_PRESETS.normal.targetSteps);
  const basePreset: UndergroundPresetConfig =
    clampedSteps <= 5
      ? UNDERGROUND_PRESETS.easy
      : clampedSteps <= 7
        ? UNDERGROUND_PRESETS.normal
        : clampedSteps <= 9
          ? UNDERGROUND_PRESETS.hard
          : UNDERGROUND_PRESETS.expert;

  const overrides: Record<string, any> = { targetSteps: clampedSteps };
  if (numDiggers !== null && numDiggers !== undefined && Number.isFinite(Number(numDiggers))) {
    overrides.numDiggers = Number(numDiggers);
  }
  return normalizeUndergroundSettings(basePreset, overrides);
}
