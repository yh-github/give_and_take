/**
 * Difficulty Presets & Advanced Knobs for `deep_cave` ("The Abyssal Descent").
 */

export const DEEP_CAVE_PRESETS = {
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

export const DEEP_CAVE_KNOB_DEFS = {
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

export const DEFAULT_DEEP_CAVE_SETTINGS = { ...DEEP_CAVE_PRESETS.normal };

function clampKnob(key, value, fallback) {
  const def = DEEP_CAVE_KNOB_DEFS[key];
  if (!def) return value ?? fallback;
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  const clamped = Math.max(def.min, Math.min(def.max, num));
  return def.step === 1 ? Math.round(clamped) : clamped;
}

/**
 * Checks whether a knob configuration matches one of the named presets verbatim.
 */
export function detectDeepCavePresetId(settings) {
  if (!settings) return 'normal';
  for (const [presetId, preset] of Object.entries(DEEP_CAVE_PRESETS)) {
    const matches = Object.keys(DEEP_CAVE_KNOB_DEFS).every(
      key => Number(settings[key]) === Number(preset[key])
    );
    if (matches) return presetId;
  }
  return 'custom';
}

/**
 * Resolves a preset name or partial settings object into a complete clamped configuration.
 */
export function normalizeDeepCaveSettings(input = null, overrides = null) {
  let base = DEEP_CAVE_PRESETS.normal;
  if (typeof input === 'string' && DEEP_CAVE_PRESETS[input]) {
    base = DEEP_CAVE_PRESETS[input];
  } else if (input && typeof input === 'object') {
    if (typeof input.preset === 'string' && DEEP_CAVE_PRESETS[input.preset]) {
      base = DEEP_CAVE_PRESETS[input.preset];
    } else if (typeof input.id === 'string' && DEEP_CAVE_PRESETS[input.id]) {
      base = DEEP_CAVE_PRESETS[input.id];
    }
  }

  const merged = {
    ...base,
    ...(input && typeof input === 'object' ? input : {}),
    ...(overrides && typeof overrides === 'object' ? overrides : {})
  };

  const normalized = {};
  for (const key of Object.keys(DEEP_CAVE_KNOB_DEFS)) {
    normalized[key] = clampKnob(key, merged[key], base[key]);
  }
  normalized.preset = detectDeepCavePresetId(normalized);
  return normalized;
}
