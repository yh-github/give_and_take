import { MAX_AIR, DEEP_CAVE_GENERATOR_VERSION } from '../constants.js';
import { sanitizePuzzleEntities } from './rules.js';

export const AUTOSAVE_STORAGE_KEY = 'give_and_take_autosave';
export const SAVE_STATE_VERSION = 1;

/**
 * Creates a clean, serializable game state payload.
 * When `compact` is true (used for procedural autosaves), bulky puzzle geometry
 * and entities are omitted and regenerated deterministically from seed + settings.
 */
export function createSavePayload({
  levelId,
  targetSteps,
  numDiggers,
  puzzle,
  seed = null,
  settings = null,
  generatorVersion = null,
  compact = false,
  inventory = [],
  unlockedZones = [1],
  defeated = [],
  pathHistory = [],
  historyStack = [],
  campItems = [],
  buriedEntities = [],
  air = MAX_AIR,
  isTransformed = false,
  hasDeepTreasure = false,
  envItemState = 'active',
  envItemCaughtPos = { x: 50, y: 50 },
  dolphinState = 'idle_surface',
  dolphinYPos = 16,
  lightingSettings = null,
  debugMode = false,
  inkFogEntities = []
}) {
  const sanitizedHistoryStack = (historyStack || []).slice(-30).map(entry => ({
    ...entry,
    inkFogEntities: Array.isArray(entry.inkFogEntities)
      ? entry.inkFogEntities
      : entry.inkFogEntities instanceof Set
        ? Array.from(entry.inkFogEntities)
        : []
  }));

  const sanitizedInkFog = Array.isArray(inkFogEntities)
    ? inkFogEntities
    : inkFogEntities instanceof Set
      ? Array.from(inkFogEntities)
      : [];

  const resolvedSeed = seed ?? puzzle?.seed ?? null;
  const resolvedSettings = settings ?? puzzle?.settings ?? null;
  const resolvedGenVersion = generatorVersion ?? puzzle?.generatorVersion ?? (levelId === 'deep_cave' ? DEEP_CAVE_GENERATOR_VERSION : null);

  return {
    version: SAVE_STATE_VERSION,
    savedAt: new Date().toISOString(),
    levelId,
    targetSteps: Number(targetSteps) || 5,
    numDiggers: Number(numDiggers) || 0,
    ...(resolvedSeed !== null ? { seed: resolvedSeed } : {}),
    ...(resolvedSettings ? { settings: resolvedSettings } : {}),
    ...(resolvedGenVersion !== null ? { generatorVersion: resolvedGenVersion } : {}),
    puzzle: (!compact && puzzle) ? {
      puzzleEntities: puzzle.puzzleEntities || [],
      goalEntityId: puzzle.goalEntityId,
      startItems: puzzle.startItems || [],
      solution: puzzle.solution || [],
      levelId: puzzle.levelId || levelId,
      ...(puzzle.seed !== undefined ? { seed: puzzle.seed } : {}),
      ...(puzzle.settings ? { settings: puzzle.settings } : {}),
      ...(puzzle.generatorVersion !== undefined ? { generatorVersion: puzzle.generatorVersion } : {}),
      ...(puzzle.geometry ? { geometry: puzzle.geometry } : {}),
      ...(puzzle.boatOfferedItem ? { boatOfferedItem: puzzle.boatOfferedItem } : {}),
      ...(puzzle.safeBoatItems ? { safeBoatItems: puzzle.safeBoatItems } : {})
    } : null,
    inventory: Array.isArray(inventory) ? [...inventory] : [],
    unlockedZones: Array.isArray(unlockedZones) ? [...unlockedZones] : [1],
    defeated: Array.isArray(defeated) ? [...defeated] : [],
    pathHistory: Array.isArray(pathHistory) ? [...pathHistory] : [],
    historyStack: sanitizedHistoryStack,
    campItems: Array.isArray(campItems) ? [...campItems] : [],
    buriedEntities: Array.isArray(buriedEntities) ? [...buriedEntities] : [],
    air: air ?? MAX_AIR,
    isTransformed: Boolean(isTransformed),
    hasDeepTreasure: Boolean(hasDeepTreasure),
    envItemState: envItemState || 'active',
    envItemCaughtPos: envItemCaughtPos || { x: 50, y: 50 },
    dolphinState: dolphinState || 'idle_surface',
    dolphinYPos: typeof dolphinYPos === 'number' ? dolphinYPos : 16,
    lightingSettings: lightingSettings ? { ...lightingSettings } : null,
    debugMode: Boolean(debugMode),
    inkFogEntities: sanitizedInkFog
  };
}

/**
 * Validates a loaded save state object.
 */
export function validateSaveState(data, levelDictionary = null) {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'Save data is empty or invalid.' };
  }

  if (!data.levelId || typeof data.levelId !== 'string') {
    return { valid: false, error: 'Missing or invalid level identifier.' };
  }

  if (levelDictionary && !levelDictionary[data.levelId]) {
    return { valid: false, error: `Unknown realm: ${data.levelId}` };
  }

  const isCompactProceduralSave = Boolean(
    !data.puzzle &&
    data.levelId === 'deep_cave' &&
    data.seed !== undefined &&
    data.seed !== null &&
    data.settings
  );

  if (isCompactProceduralSave) {
    if (data.generatorVersion !== DEEP_CAVE_GENERATOR_VERSION) {
      return {
        valid: false,
        versionMismatch: true,
        error: `Procedural generator version mismatch (save: ${data.generatorVersion}, current: ${DEEP_CAVE_GENERATOR_VERSION}).`
      };
    }
  } else {
    if (!data.puzzle || typeof data.puzzle !== 'object') {
      return { valid: false, error: 'Missing puzzle structure in save data.' };
    }

    if (!Array.isArray(data.puzzle.puzzleEntities) || data.puzzle.puzzleEntities.length === 0) {
      return { valid: false, error: 'Save data has no puzzle entities.' };
    }

    if (!data.puzzle.goalEntityId) {
      return { valid: false, error: 'Save data is missing goal entity.' };
    }
  }

  if (!Array.isArray(data.inventory)) {
    return { valid: false, error: 'Inventory data is not an array.' };
  }

  if (!Array.isArray(data.pathHistory) || data.pathHistory.length === 0) {
    return { valid: false, error: 'Missing player path history.' };
  }

  return { valid: true };
}

/**
 * Saves payload to localStorage under the autosave key.
 */
export function saveToAutoSave(payload) {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    const json = JSON.stringify(payload);
    window.localStorage.setItem(AUTOSAVE_STORAGE_KEY, json);
    return true;
  } catch (err) {
    console.warn('Failed to write autosave to localStorage:', err);
    return false;
  }
}

/**
 * Reads and validates autosave from localStorage, returning both the parsed state
 * and whether a generator version mismatch invalidated a procedural cave save.
 */
export function getAutoSaveWithStatus(levelDictionary = null) {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return { state: null, versionMismatch: false };
    }
    const raw = window.localStorage.getItem(AUTOSAVE_STORAGE_KEY);
    if (!raw) return { state: null, versionMismatch: false };

    const parsed = JSON.parse(raw);
    const validation = validateSaveState(parsed, levelDictionary);
    if (!validation.valid) {
      console.warn('Invalid autosave in storage:', validation.error);
      return { state: null, versionMismatch: Boolean(validation.versionMismatch) };
    }
    if (parsed.puzzle && Array.isArray(parsed.puzzle.puzzleEntities)) {
      const levelItems = levelDictionary?.[parsed.levelId]?.items || [];
      parsed.puzzle.puzzleEntities = sanitizePuzzleEntities(parsed.puzzle.puzzleEntities, levelItems);
    }
    return { state: parsed, versionMismatch: false };
  } catch (err) {
    console.warn('Failed to read autosave from localStorage:', err);
    return { state: null, versionMismatch: false };
  }
}

/**
 * Reads and validates autosave from localStorage.
 */
export function getAutoSave(levelDictionary = null) {
  return getAutoSaveWithStatus(levelDictionary).state;
}

/**
 * Clears autosave from localStorage.
 */
export function clearAutoSave() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.removeItem(AUTOSAVE_STORAGE_KEY);
  } catch (err) {
    console.warn('Failed to clear autosave from localStorage:', err);
  }
}

/**
 * Converts a save payload to formatted JSON string for export.
 */
export function exportStateToString(payload) {
  return JSON.stringify(payload, null, 2);
}

/**
 * Parses and validates an exported string.
 */
export function importStateFromString(rawString, levelDictionary = null) {
  if (!rawString || typeof rawString !== 'string') {
    return { success: false, error: 'Input must be a non-empty string.' };
  }

  try {
    const parsed = JSON.parse(rawString.trim());
    const validation = validateSaveState(parsed, levelDictionary);
    if (!validation.valid) {
      return {
        success: false,
        versionMismatch: Boolean(validation.versionMismatch),
        error: validation.error
      };
    }
    if (parsed.puzzle && Array.isArray(parsed.puzzle.puzzleEntities)) {
      const levelItems = levelDictionary?.[parsed.levelId]?.items || [];
      parsed.puzzle.puzzleEntities = sanitizePuzzleEntities(parsed.puzzle.puzzleEntities, levelItems);
    }
    return { success: true, state: parsed };
  } catch (err) {
    return { success: false, error: `JSON Parse error: ${err.message}` };
  }
}
