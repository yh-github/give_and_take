import type {
  CaveWallVertices,
  CollarBounds,
  WallPolyline
} from './geometry.ts';

/**
 * Item, entity, trade evaluation, and spatial validation types.
 */

export type RequirementType = 'AND' | 'OR';
export type GateType = 'rock' | 'chasm' | 'guardian' | (string & {});
export type PresetType = 'pickaxe' | 'mushroom' | 'bubble_vent' | 'treasure';

export interface ItemDefinition {
  id: string;
  name?: string;
  emoji?: string;
  [key: string]: unknown;
}

export interface EntityTemplate {
  id: string;
  name?: string;
  emoji?: string;
  color?: string;
  allowedReqs?: string[];
  [key: string]: unknown;
}

export interface MapNode {
  id?: string;
  x: number;
  y: number;
  zone: number;
  emoji?: string;
  size?: 'small' | 'medium' | 'large' | (string & {});
  gateType?: GateType;
  isGatekeeper?: boolean;
  isExtraRock?: boolean;
  isGoal?: boolean;
  isGoalNode?: boolean;
  isClamNode?: boolean;
  isVent?: boolean;
  isPreset?: PresetType | boolean | (string & {});
  gkIdx?: number;
  unlocksZone?: number;
  unlocksZones?: number[];
  [key: string]: unknown;
}

export interface SceneryNode {
  x: number;
  y: number;
  z?: number;
  s?: string;
  e?: string;
  type?: string;
  [key: string]: unknown;
}

export interface AbstractPuzzleEntity {
  id: string;
  name?: string;
  emoji?: string;
  color?: string;
  x?: number;
  y?: number;
  zone: number;
  depth?: number;
  requires?: string[];
  reqType?: RequirementType;
  reward?: string | null;
  allowedReqs?: string[];
  isGatekeeper?: boolean;
  isExtraRock?: boolean;
  isGoal?: boolean;
  isPreset?: PresetType | boolean | (string & {});
  isRepeatable?: boolean;
  isVent?: boolean;
  isTreasure?: boolean;
  isChasmGate?: boolean;
  roamClass?: string;
  isRight?: boolean;
  size?: 'small' | 'medium' | 'large' | (string & {});
  filterClass?: string;
  gateType?: GateType;
  unlocksZone?: number;
  unlocksZones?: number[];
  collarBounds?: CollarBounds;
  [key: string]: unknown;
}

export interface PuzzleEntity extends AbstractPuzzleEntity {
  x: number;
  y: number;
}

export type PuzzleEntityArray = PuzzleEntity[] & {
  boatOfferedItem?: string | null;
};

export interface InventoryFitResult {
  fits: boolean;
  nextInventory: string[];
}

export interface TradeEvaluationState {
  levelId?: string;
  isTransformed?: boolean;
  hasDeepTreasure?: boolean;
}

export interface TradeEvaluationResult {
  canDefeat: boolean;
  itemsToConsume: string[];
  nextInventory: string[];
  exceedsCapacity: boolean;
  isFreeUnTransform: boolean;
}

export interface EntityDistanceViolation {
  type: 'ENTITY_DISTANCE';
  entityA: string;
  entityB: string;
  zone: number;
  distance: number;
  required: number;
}

export interface WallClearanceViolation {
  type: 'WALL_CLEARANCE';
  entityId: string;
  zone: number;
  distance: number;
  required: number;
}

export type SpacingViolation = EntityDistanceViolation | WallClearanceViolation;

export interface SpacingValidationOptions {
  minEntityDistance?: number;
  caveWallVertices?: CaveWallVertices | null;
  wallPolylines?: WallPolyline[] | null;
  minWallMargin?: number;
  checkAllPairs?: boolean;
}

export interface SpacingValidationResult {
  isValid: boolean;
  violations: SpacingViolation[];
}
