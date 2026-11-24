import type {
  CollarBounds,
  CollarOrientation,
  Point2D,
  WallPolylineObject
} from './geometry.ts';

export type { CollarOrientation };
import type { AbstractPuzzleEntity, GateType, PuzzleEntity } from './entities.ts';
import type { DeepCavePresetId, DeepCaveSettings, PuzzleData, PuzzleDifficultyReport, SolverResult } from './level.ts';

export type EncounterDirection = 'north' | 'south' | 'east' | 'west';

export interface EncounterSocket {
  colOffset?: number;
  rowOffset?: number;
  required?: boolean;
}

export interface EncounterGatekeeperDef {
  anchor: string;
  type?: GateType;
  templateId?: string;
  requires?: string[];
  reward?: string | null;
  unlocksExit?: string;
}

export interface EncounterInternalTrade {
  templateId: string;
  requires: string[];
}

export interface EncounterPuzzleFragment {
  inputs: string[];
  outputs: string[];
  internalPresetItems?: string[];
  gatekeepers: EncounterGatekeeperDef[];
  internalTrade?: EncounterInternalTrade | null;
  internalSteps?: number;
}

export interface EncounterPlacementRules {
  minDifficulty: DeepCavePresetId;
  depthRange: [number, number];
  maxPerLevel: number;
  weight: number;
}

export interface EncounterMechanicHook {
  solverTransition: (...args: any[]) => any;
  [key: string]: unknown;
}

export interface EncounterModule {
  id: string;
  footprint: { cols: number; rows: number };
  sockets: Record<EncounterDirection, EncounterSocket[]>;
  tileGrid: string[];
  puzzleFragment: EncounterPuzzleFragment;
  placement: EncounterPlacementRules;
  mechanicHook: EncounterMechanicHook | null;
}

export interface EncounterValidationResult {
  valid: boolean;
  errors: string[];
}

export type RoomArchetype =
  | 'wide_hall'
  | 'angled_left'
  | 'angled_right'
  | 'vaulted_dome'
  | 'stepped_alcove';

export type SlotRole =
  | 'empty'
  | 'camp'
  | 'vault'
  | 'main'
  | 'branch'
  | 'spur'
  | 'encounter'
  | (string & {});

export interface SlotSockets {
  N: boolean;
  S: boolean;
  E: boolean;
  W: boolean;
}

export interface SlotRecord {
  col: number;
  row: number;
  active: boolean;
  role: SlotRole;
  zone: number | null;
  archetype: RoomArchetype | null;
  encounterId: string | null;
  encounterOrigin: { col: number; row: number } | null;
  sockets: SlotSockets;
  [key: string]: any;
}

export interface WorldDimensions {
  rows: number;
  cols: number;
  totalTileCols: number;
  totalTileRows: number;
  worldWidth: number;
  worldHeight: number;
  tileWidth: number;
  tileHeight: number;
}

export interface OrientedBox extends CollarBounds {
  orientation?: CollarOrientation;
}

export interface DoorwayCollar {
  edgeKey: string;
  orientation: CollarOrientation;
  x: number;
  y: number;
  collarBounds: OrientedBox;
  lockBox: OrientedBox;
  openCols: [number, number];
  openRows: [number, number];
  flankCols?: number[];
  flankRows?: number[];
}

export interface EncounterAnchorGroup {
  x: number;
  y: number;
  bounds: OrientedBox;
}

export interface StampedEncounterAnchors {
  encounterId: string;
  originCol: number;
  originRow: number;
  G: EncounterAnchorGroup[];
  E: EncounterAnchorGroup[];
  L: EncounterAnchorGroup[];
}

export interface RasterizedSlotGrid extends WorldDimensions {
  solidGrid: number[][];
  wallPolylines: WallPolylineObject[];
  obstaclePolygons: Point2D[][];
  doorways: Record<string, DoorwayCollar>;
  encounterAnchors: StampedEncounterAnchors[];
  collarLockBoxes: OrientedBox[];
}

export interface RawTileContourLoop {
  points: Point2D[];
  signedArea: number;
}

export interface ExtractCaveContoursOptions {
  tileWidth: number;
  tileHeight: number;
  worldWidth: number;
  worldHeight: number;
  collarLockBoxes?: OrientedBox[];
  lockedTiles?: boolean[][] | null;
  bevelCut?: number;
  simplifyEpsilon?: number;
  organicSculpt?: boolean;
}

export interface ExtractedCaveContours {
  wallPolylines: WallPolylineObject[];
  obstaclePolygons: Point2D[][];
  cleanedGrid: number[][];
}

export interface DeepCaveWorkerRequest {
  requestId: number;
  seed: string | null;
  settings: DeepCaveSettings | null;
}

export type DeepCaveWorkerResponse =
  | { requestId: number; ok: true; puzzle: PuzzleData }
  | { requestId: number; ok: false; error: string };

export interface DeepCaveAsyncOptions {
  seed?: string | number | null;
  timeoutMs?: number;
  signal?: AbortSignal | null;
  WorkerClass?: any;
}

export interface DeepCaveAsyncResult {
  puzzle: PuzzleData;
  usedFallback: boolean;
  timedOut: boolean;
  presetId: DeepCavePresetId;
  durationMs: number;
}

export interface EncounterPlacement {
  encounter: EncounterModule;
  originCol: number;
  originRow: number;
  enterCol: number;
  exitCol: number;
  fromZone?: number;
  toZone?: number;
  _frontierQueued?: boolean;
}

export interface GatedEdgeSpec {
  edgeKey: string;
  colA: number;
  rowA: number;
  colB: number;
  rowB: number;
  isVaultEntry?: boolean;
  isHorizontalSpine?: boolean;
  isSpurGate?: boolean;
  gateType: GateType;
  fromZone?: number;
  toZone?: number;
}

export interface ZoneMeta {
  id: number;
  minRow: number;
  maxRow: number;
  slots: Array<{ col: number; row: number }>;
  parentZone: number | null;
  gateInfo: GatedEdgeSpec | EncounterPlacement | null;
  isVaultZone?: boolean;
  isGrottoPocket?: boolean;
}

export interface SpaceBlueprint {
  rows: number;
  slots: SlotRecord[][];
  campCol: number;
  vaultCol: number;
  vaultZoneId: number;
  zoneMeta: Map<number, ZoneMeta>;
  gatedEdges: GatedEdgeSpec[];
  encounterPlacements: EncounterPlacement[];
  maxZoneId: number;
  loopCount?: number;
}

export interface MissionEntitySpec extends AbstractPuzzleEntity {
  kind?: string;
  edgeKey?: string;
  encounter?: EncounterPlacement;
  anchorType?: 'G' | 'L' | 'E';
  anchorIndex?: number;
  isDigger?: boolean;
}

export type MissionGraphResult =
  | {
      ok: true;
      startItems: string[];
      entitySpecs: MissionEntitySpec[];
      goalEntityId: string;
      abstractSolution: SolverResult;
    }
  | {
      ok: false;
      structural?: boolean;
      reason: string;
    };

export interface PlacedEntitiesResult {
  placed: PuzzleEntity[];
  campPos: Point2D;
}

export type VerifyGeneratedLevelResult =
  | {
      valid: true;
      solution: SolverResult;
      difficulty: PuzzleDifficultyReport;
    }
  | {
      valid: false;
      reason: string;
      entityId?: string;
      violations?: unknown[];
    };
