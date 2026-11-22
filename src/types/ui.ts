import type { CSSProperties, Dispatch, SetStateAction } from 'react';
import type { Point2D } from './geometry.ts';
import type { LanguageCode } from './i18n.ts';
import type { DeepCaveSettings, LevelDefinition } from './level.ts';
import type { CampItemState, PathHistoryPoint, SavePayload } from './save.ts';

export type CSSCustomProperties = CSSProperties & {
  [key: `--${string}`]: string | number | undefined;
};

export interface ActiveGameSettings {
  levelId: string;
  steps: number;
  diggers: number;
  deepCaveSettings: Partial<DeepCaveSettings> | Record<string, unknown> | null;
}

export interface GameInstanceProps {
  level: LevelDefinition;
  targetSteps: number;
  numDiggers: number;
  deepCaveSettings?: Partial<DeepCaveSettings> | Record<string, unknown> | null;
  onGenerateNew: (settings: ActiveGameSettings) => void;
  onLoadState: (state: SavePayload) => void;
  savedState?: SavePayload | null;
  saveVersionWarning?: boolean;
  onDismissSaveVersionWarning?: (() => void) | null;
  fishingMode?: 'chase' | 'timing_ring';
  lang: LanguageCode;
  setLang: Dispatch<SetStateAction<LanguageCode>>;
}

export type MenuView = 'main' | 'settings' | 'lighting' | 'export' | 'import' | 'genFailed';

export type AlertReason = 'inventory_full' | (string & {}) | null;

export interface SchoolFishState {
  id: string | number;
  y: number;
  depth?: number;
  isRight?: boolean;
  speed?: number;
  type: string;
  spawnTime?: number;
  startX?: number;
  endX?: number;
  isSpooked?: boolean;
  spookCount?: number;
  spookedAt?: number;
  [key: string]: unknown;
}

export interface RoamingBoatState {
  id: number;
  spawnTime?: number;
  x?: number;
  isRight?: boolean;
  lane?: 'far' | 'near';
  reqItem?: string;
  offeredItem: string;
  [key: string]: unknown;
}

export type GameHistoryEntry = {
  inventory: string[];
  defeated: string[];
  pathHistory: PathHistoryPoint[];
  envItemState: string;
  unlockedZones: number[];
  campItems: CampItemState[];
  buriedEntities: string[];
  air: number;
  isTransformed: boolean;
  hasDeepTreasure: boolean;
  inkFogEntities: Set<string>;
  dolphinState: string;
  dolphinYPos: number;
};

export interface FlyingItemState {
  x: number;
  y: number;
  emoji: string;
  zIndex?: number;
  delay?: number;
}

export interface CustomEntityMovement {
  x: number;
  y: number;
  rotate?: number;
  flip?: boolean;
  isActiveMotion?: boolean;
}

export interface ClickIndicatorState {
  id: number | string;
  x: number;
  y: number;
  isValid: boolean;
}

export interface BubbleParticle {
  id: number | string;
  dx: number;
  endDx: number;
  delay: number;
  speed: number;
  scale: number;
}

export interface HeroBubbleBurst {
  id: number | string;
  x: number;
  y: number;
  bubbles: BubbleParticle[];
}

export interface HeroRenderState {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  isWalking: boolean;
  facing?: number;
  isTransformed?: boolean;
  isDead?: boolean;
  [key: string]: unknown;
}

export interface SpeechBubbleState {
  id?: string | number;
  entityId?: string;
  text: string;
  x?: number;
  y?: number;
  isPlayer?: boolean;
  isWarning?: boolean;
  [key: string]: unknown;
}

export interface FloatingTextEffect {
  id: string | number;
  text: string;
  x: number;
  y: number;
  color?: string;
  isPositive?: boolean;
  [key: string]: unknown;
}

export interface ParticleEffect {
  id: string | number;
  x: number;
  y: number;
  dx: number;
  dy: number;
  rot?: number;
  color?: string;
  size?: number;
  [key: string]: unknown;
}

export interface FlyingItemEffect {
  id: string | number;
  itemId: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  tx?: number;
  ty?: number;
  [key: string]: unknown;
}

export interface DebugRaysState {
  origin?: Point2D;
  rays?: Array<{
    angle?: number;
    endX?: number;
    endY?: number;
    hitX?: number;
    hitY?: number;
    hit?: boolean;
    x?: number;
    y?: number;
    [key: string]: unknown;
  }>;
  polygon?: Point2D[];
  [key: string]: unknown;
}

export type GameStatus = 'playing' | 'won' | 'lost';

export interface ActiveDialogState {
  entityId?: string;
  title?: string;
  message?: string;
  type?: string;
  [key: string]: unknown;
}
