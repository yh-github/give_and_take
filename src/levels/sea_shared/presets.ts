import type { DeepCavePresetId } from '../../types/index.ts';

/**
 * Shared Difficulty Presets & Exposed Knobs for both Sea levels (`underwater` & `shipwreck`).
 */

export type SeaPresetId = DeepCavePresetId;

export type SeaKnobKey = 'targetSteps' | 'numDiggers';

export interface SeaSettings {
  targetSteps: number;
  numDiggers: number;
}

export interface SeaPresetConfig extends SeaSettings {
  id: Exclude<SeaPresetId, 'custom'>;
}

export interface SeaKnobDef {
  min: number;
  max: number;
  step: number;
}

export const SEA_PRESETS: Record<Exclude<SeaPresetId, 'custom'>, SeaPresetConfig> = {
  easy: {
    id: 'easy',
    targetSteps: 4,
    numDiggers: 0
  },
  normal: {
    id: 'normal',
    targetSteps: 6,
    numDiggers: 1
  },
  hard: {
    id: 'hard',
    targetSteps: 7,
    numDiggers: 2
  },
  expert: {
    id: 'expert',
    targetSteps: 8,
    numDiggers: 3
  }
};

export const SEA_KNOB_DEFS: Record<SeaKnobKey, SeaKnobDef> = {
  targetSteps: { min: 3, max: 8, step: 1 },
  numDiggers: { min: 0, max: 3, step: 1 }
};

export const DEFAULT_SEA_SETTINGS: SeaSettings = {
  targetSteps: SEA_PRESETS.normal.targetSteps,
  numDiggers: SEA_PRESETS.normal.numDiggers
};

function clampSeaKnob(key: SeaKnobKey, value: unknown, fallback: number): number {
  const def = SEA_KNOB_DEFS[key];
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.round(Math.max(def.min, Math.min(def.max, num)));
}

/**
 * Checks whether a Sea knob configuration matches one of the 4 named presets verbatim.
 */
export function detectSeaPresetId(
  settings: Partial<SeaSettings> | null | undefined
): SeaPresetId {
  if (!settings) return 'normal';
  for (const [presetId, preset] of Object.entries(SEA_PRESETS)) {
    const matches = (Object.keys(SEA_KNOB_DEFS) as SeaKnobKey[]).every(
      (key) => Number(settings[key]) === Number(preset[key])
    );
    if (matches) return presetId as SeaPresetId;
  }
  return 'custom';
}

/**
 * Resolves a preset name or partial settings object into clamped Sea level settings.
 */
export function normalizeSeaSettings(
  input: string | Partial<SeaSettings> | null | undefined = null,
  overrides: Partial<SeaSettings> | null = null
): SeaSettings & { preset: SeaPresetId } {
  let base: SeaPresetConfig = SEA_PRESETS.normal;
  if (typeof input === 'string' && input in SEA_PRESETS) {
    base = SEA_PRESETS[input as keyof typeof SEA_PRESETS];
  } else if (input && typeof input === 'object') {
    const maybePreset = (input as { preset?: string; id?: string }).preset || (input as { id?: string }).id;
    if (typeof maybePreset === 'string' && maybePreset in SEA_PRESETS) {
      base = SEA_PRESETS[maybePreset as keyof typeof SEA_PRESETS];
    }
  }

  const merged = {
    ...base,
    ...(input && typeof input === 'object' ? input : {}),
    ...(overrides && typeof overrides === 'object' ? overrides : {})
  };

  const targetSteps = clampSeaKnob('targetSteps', merged.targetSteps, base.targetSteps);
  const numDiggers = clampSeaKnob('numDiggers', merged.numDiggers, base.numDiggers);
  const preset = detectSeaPresetId({ targetSteps, numDiggers });
  return { targetSteps, numDiggers, preset };
}
