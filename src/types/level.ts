import type {
  ObstacleSegment,
  Point2D,
  ProceduralGeometry
} from './geometry.ts';
import type {
  EntityTemplate,
  ItemDefinition,
  MapNode,
  PuzzleEntityArray,
  RequirementType,
  SceneryNode
} from './entities.ts';

/**
 * Level configuration, solver, and puzzle generation types.
 */

export type LevelId =
  | 'river_crossing'
  | 'underground'
  | 'underwater'
  | 'deep_cave'
  | (string & {});

export type DarknessType = 'horizontal' | 'radial';

export interface LevelMechanics {
  hasFish?: boolean;
  hasSchoolsOfFish?: boolean;
  gatekeeperId?: string;
  darknessType?: DarknessType;
  isCaveType?: boolean;
  hasPickaxe?: boolean;
  hasDarkness?: boolean;
  hasFog?: boolean;
  isVertical?: boolean;
  useIsotropicCoords?: boolean;
  supportsProceduralWorker?: boolean;
  hasTransformation?: boolean;
  hasAir?: boolean;
  hasMurkyWater?: boolean;
  heroBobs?: boolean;
  screens?: number;
  [key: string]: unknown;
}

export type DeepCavePresetId = 'easy' | 'normal' | 'hard' | 'expert' | 'custom';

export interface DeepCaveSettings {
  targetSteps: number;
  rows: number;
  branchingFactor: number;
  spurCount: number;
  decoyCount: number;
  pickaxeSurplus: number;
  maxBacktracks: number;
  maxBacktrackRows: number;
  numDiggers: number;
  encounterCount: number;
  torchRadius: number;
  [key: string]: unknown;
}

export interface SolutionStep {
  entityId?: string;
  itemId?: string;
  usedItems?: string[];
  reqType?: RequirementType;
  isReturnTrip?: boolean;
  isEnvironmentAction?: boolean;
  isBoatTrade?: boolean;
  reqItem?: string;
}

export interface SolverResult {
  inv: string[];
  def: string[];
  path: SolutionStep[];
  steps: number;
  transformed: boolean;
  hasTreasure: boolean;
}

export interface SolverOptions {
  boatOfferedItem?: string | null;
  boatOfferedItems?: string[];
  boatTradeMap?: Record<string, string>;
  maxStates?: number;
  initialDef?: string[];
  initialTransformed?: boolean;
  initialHasTreasure?: boolean;
}

export type PuzzleDifficultyTier =
  | 'unsolvable'
  | 'trivial'
  | 'easy'
  | 'moderate'
  | 'challenging'
  | 'hard';

export interface PuzzleDifficultyReport {
  solvable: boolean;
  steps: number;
  score: number;
  tier: PuzzleDifficultyTier;
  greedySolvable: boolean;
  greedyTrapCount: number;
  fatalTrapCount: number;
  suboptimalTrapCount: number;
  choiceForkCount: number;
  backtrackCount: number;
  maxBacktrackRows: number;
  remoteDepCount: number;
  multiReqGateCount: number;
  peakInventory: number;
}

export interface AssessDifficultyOptions extends SolverOptions {
  solution?: SolverResult | null;
  campPos?: Point2D;
  rowHeight?: number;
  maxProbeStates?: number;
  skipTrapProbes?: boolean;
}

export interface PuzzleData {
  startItems: string[];
  puzzleEntities: PuzzleEntityArray;
  goalEntityId: string;
  solution: SolutionStep[];
  steps?: number;
  levelId?: string;
  seed?: string | number | null;
  settings?: DeepCaveSettings | Record<string, unknown> | null;
  generatorVersion?: number | null;
  geometry?: ProceduralGeometry | null;
  boatOfferedItem?: string | null;
  boatOfferedItems?: string[];
  boatTradeMap?: Record<string, string>;
  safeBoatItems?: string[];
  difficulty?: PuzzleDifficultyReport;
  diagnostics?: Record<string, unknown>;
}

export interface LevelDefinition {
  id: LevelId;
  name: string;
  items: ItemDefinition[];
  entities: EntityTemplate[];
  mapNodes: MapNode[];
  sceneryNodes?: SceneryNode[];
  campPos: Point2D & { depth?: number };
  mechanics: LevelMechanics;
  specialEntityTemplate?: string;
  presets?: Record<string, DeepCaveSettings>;
  defaultSettings?: DeepCaveSettings;
  generatePuzzle?: (
    level: LevelDefinition,
    targetSteps?: any,
    numDiggers?: any,
    seed?: any
  ) => PuzzleData | null;
  getObstacleSegments?: (...args: any[]) => ObstacleSegment[];
  BackgroundComponent?: any;
  RockComponent?: any;
  ChasmComponent?: any;
  GatekeeperPropComponent?: any;
  CampIcon?: any;
  [key: string]: unknown;
}

export type LevelRegistry = Record<string, LevelDefinition>;
