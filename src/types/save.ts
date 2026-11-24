import type { Point2D, ProceduralGeometry } from './geometry.ts';
import type { PuzzleEntity } from './entities.ts';
import type { DeepCaveSettings, PuzzleData, SolutionStep } from './level.ts';

/**
 * Persistence, autosave, and export/import domain types.
 */

export interface CampItemState {
  uid: string | number;
  id: string;
  x: number;
  y: number;
  isFloating?: boolean;
}

export interface LightingSettings {
  radius: number;
  blur: number;
  darknessColor: string;
  darknessOpacity: number;
  ambientColor: string;
  ambientOpacity: number;
  flicker?: number;
  flickerIntensity?: number;
  torchRadius?: number;
  [key: string]: unknown;
}

export interface PathHistoryPoint extends Point2D {
  zone?: number;
  depth?: number;
}

export interface HistoryEntryInput {
  inventory?: string[];
  defeated?: string[];
  pathHistory?: PathHistoryPoint[];
  envItemState?: string;
  unlockedZones?: number[];
  campItems?: CampItemState[];
  buriedEntities?: string[];
  litBraziers?: string[];
  air?: number;
  isTransformed?: boolean;
  hasDeepTreasure?: boolean;
  inkFogEntities?: Set<string> | string[];
  dolphinState?: string;
  dolphinYPos?: number;
  [key: string]: unknown;
}

export interface SerializedHistoryEntry {
  inventory?: string[];
  defeated?: string[];
  pathHistory?: PathHistoryPoint[];
  envItemState?: string;
  unlockedZones?: number[];
  campItems?: CampItemState[];
  buriedEntities?: string[];
  litBraziers?: string[];
  air?: number;
  isTransformed?: boolean;
  hasDeepTreasure?: boolean;
  inkFogEntities: string[];
  dolphinState?: string;
  dolphinYPos?: number;
  [key: string]: unknown;
}

export interface SerializedPuzzleSnapshot {
  puzzleEntities: PuzzleEntity[];
  goalEntityId: string;
  startItems: string[];
  solution: SolutionStep[];
  levelId: string;
  seed?: string | number | null;
  settings?: DeepCaveSettings | Record<string, unknown> | null;
  generatorVersion?: number | null;
  geometry?: ProceduralGeometry;
  boatOfferedItem?: string;
  boatOfferedItems?: string[];
  boatTradeMap?: Record<string, string>;
  safeBoatItems?: string[];
}

export interface CreateSavePayloadInput {
  levelId: string;
  targetSteps?: number;
  numDiggers?: number;
  puzzle?: PuzzleData | null;
  seed?: string | number | null;
  settings?: DeepCaveSettings | Record<string, unknown> | null;
  generatorVersion?: number | null;
  compact?: boolean;
  inventory?: string[];
  unlockedZones?: number[];
  defeated?: string[];
  pathHistory?: PathHistoryPoint[];
  historyStack?: HistoryEntryInput[];
  campItems?: CampItemState[];
  buriedEntities?: string[];
  litBraziers?: string[];
  air?: number;
  isTransformed?: boolean;
  hasDeepTreasure?: boolean;
  envItemState?: string;
  envItemCaughtPos?: Point2D;
  dolphinState?: string;
  dolphinYPos?: number;
  lightingSettings?: LightingSettings | null;
  debugMode?: boolean;
  inkFogEntities?: string[] | Set<string>;
}

export interface SavePayload {
  version: number;
  savedAt: string;
  levelId: string;
  targetSteps: number;
  numDiggers: number;
  seed?: string | number;
  settings?: DeepCaveSettings | Record<string, unknown>;
  generatorVersion?: number;
  puzzle: SerializedPuzzleSnapshot | null;
  inventory: string[];
  unlockedZones: number[];
  defeated: string[];
  pathHistory: PathHistoryPoint[];
  historyStack: SerializedHistoryEntry[];
  campItems: CampItemState[];
  buriedEntities: string[];
  litBraziers?: string[];
  air: number;
  isTransformed: boolean;
  hasDeepTreasure: boolean;
  envItemState: string;
  envItemCaughtPos: Point2D;
  dolphinState: string;
  dolphinYPos: number;
  lightingSettings: LightingSettings | null;
  debugMode: boolean;
  inkFogEntities: string[];
}

export interface SaveValidationResult {
  valid: boolean;
  error?: string;
  versionMismatch?: boolean;
}

export interface AutoSaveStatus {
  state: SavePayload | null;
  versionMismatch: boolean;
}

export interface ImportStateResult {
  success: boolean;
  state?: SavePayload;
  error?: string;
  versionMismatch?: boolean;
}
