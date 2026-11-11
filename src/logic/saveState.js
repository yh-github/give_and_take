import { MAX_AIR } from '../constants.js';
import { sanitizePuzzleEntities } from './rules.js';

export const AUTOSAVE_STORAGE_KEY = 'give_and_take_autosave';
export const SAVE_STATE_VERSION = 1;

/**
 * Creates a clean, serializable game state payload.
 */
export function createSavePayload({
  levelId,
  targetSteps,
  numDiggers,
  puzzle,
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

  return {
    version: SAVE_STATE_VERSION,
    savedAt: new Date().toISOString(),
    levelId,
    targetSteps: Number(targetSteps) || 5,
    numDiggers: Number(numDiggers) || 0,
    puzzle: puzzle ? {
      puzzleEntities: puzzle.puzzleEntities || [],
      goalEntityId: puzzle.goalEntityId,
      startItems: puzzle.startItems || [],
      solution: puzzle.solution || [],
      levelId: puzzle.levelId || levelId
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

  if (!data.puzzle || typeof data.puzzle !== 'object') {
    return { valid: false, error: 'Missing puzzle structure in save data.' };
  }

  if (!Array.isArray(data.puzzle.puzzleEntities) || data.puzzle.puzzleEntities.length === 0) {
    return { valid: false, error: 'Save data has no puzzle entities.' };
  }

  if (!data.puzzle.goalEntityId) {
    return { valid: false, error: 'Save data is missing goal entity.' };
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
 * Reads and validates autosave from localStorage.
 */
export function getAutoSave(levelDictionary = null) {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const raw = window.localStorage.getItem(AUTOSAVE_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    const validation = validateSaveState(parsed, levelDictionary);
    if (!validation.valid) {
      console.warn('Invalid autosave in storage:', validation.error);
      return null;
    }
    if (parsed.puzzle && Array.isArray(parsed.puzzle.puzzleEntities)) {
      const levelItems = levelDictionary?.[parsed.levelId]?.items || [];
      parsed.puzzle.puzzleEntities = sanitizePuzzleEntities(parsed.puzzle.puzzleEntities, levelItems);
    }
    return parsed;
  } catch (err) {
    console.warn('Failed to read autosave from localStorage:', err);
    return null;
  }
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
      return { success: false, error: validation.error };
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
