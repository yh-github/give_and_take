// === Game Balance Constants ===
export const MAX_UNIQUE_ITEMS = 4;
export const MAX_AIR = 10;
export const UNDERWATER_SURFACE_Y = 15.5;
export const RESERVED_TOOL_ITEMS = ['pickaxe', 'key'] as const;
export const NON_STANDARD_START_ITEMS = ['fish', 'pickaxe', 'key'] as const;

// === Isotropic Canonical Cave Constants (deep_cave) ===
export const CANONICAL_SCREEN_HEIGHT = 188;
export const DEEP_CAVE_SLOT_COLS = 3;
export const DEEP_CAVE_SLOT_WIDTH = 100 / 3;
export const DEEP_CAVE_SLOT_HEIGHT = 64;
export const DEEP_CAVE_HERO_RADIUS = 3.0;
export const DEEP_CAVE_CORRIDOR_MIN_WIDTH = 20.0;
export const DEEP_CAVE_MIN_ENTITY_DIST = 14.0;
export const DEEP_CAVE_MIN_WALL_MARGIN = 6.5;
export const DEEP_CAVE_GENERATOR_VERSION = 6;

// === Solver Tuning ===
export const SOLVER_MAX_ITERS = 25000;
export const SOLVER_TIME_LIMIT_MS = 1200;
export const GENERATOR_MAX_ATTEMPTS = 5000;

// === Navigation & Layout ===
export const NAV_OFFSET = 6.0;
export const UNDERWATER_INSPECT_RADIUS = 22;
export const UNDERWATER_NEAR_RADIUS = 10;
export const UNDERWATER_AIR_COST_NORMAL = 1;
export const UNDERWATER_AIR_COST_FULL_BAG = 2;
export const UNDERWATER_FULL_BAG_SPEED_MULTIPLIER = 2.1;
export const UNDERWATER_FISH_ITEM_IDS = ['fish', 'gold_fish', 'blowfish'] as const;
export const UNDERWATER_ABYSS_DROWNING_Y = 72;

// === Fishing Catch Mini-Game & Spatial Chase ===
export type FishingMode = 'chase' | 'timing_ring';
export const UNDERWATER_FISHING_MODE: FishingMode = 'chase';

export const FISH_CHASE_CONFIG = {
  fish: {
    pattern: 'cruise',
    catchRadiusX: 7,
    catchRadiusY: 5,
    directGrabDist: 12,
    fleeSpeedMultiplier: 2.3,
    fleeDodgeY: 0,
    spookBehind: 16,
    spookAhead: 4,
    spookBandY: 8
  },
  gold_fish: {
    pattern: 'dart',
    catchRadiusX: 6,
    catchRadiusY: 4.5,
    directGrabDist: 10,
    fleeSpeedMultiplier: 2.6,
    fleeDodgeY: 3.2,
    spookBehind: 18,
    spookAhead: 4,
    spookBandY: 9
  },
  blowfish: {
    pattern: 'weave',
    catchRadiusX: 5.5,
    catchRadiusY: 5,
    directGrabDist: 8,
    fleeSpeedMultiplier: 3.0,
    fleeDodgeY: 4.2,
    spookBehind: 20,
    spookAhead: 6,
    spookBandY: 12
  }
} as const;

export const FISH_PATTERN_CONFIG = {
  cruiseBobAmp: 1,
  cruiseBobPeriodMs: 2400,
  dartCycleMs: 2400,
  dartPauseFrac: 0.5,
  dartBobAmp: 0.8,
  weaveAmp: 5,
  weavePeriodMs: 4000,
  dodgeEaseMs: 300
} as const;

export const FISHING_CATCH_CONFIG = {
  fish: { durationMs: 1800, tolerance: 0.21 },
  gold_fish: { durationMs: 1500, tolerance: 0.16 },
  blowfish: { durationMs: 1250, tolerance: 0.125 }
} as const;

// === Timing (milliseconds) ===
export const FISH_SPAWN_INTERVAL_MS = 1600;
export const BOAT_SPAWN_INTERVAL_MS = 6500;
export const INK_FOG_DURATION_MS = 8000;
export const DIGGER_BURY_DELAY_MS = 3000;
export const DIGGER_BURY_ANIM_MS = 700;
export const ACTION_ANIM_MS = 800;
export const ALERT_DURATION_MS = 600;
export const AIR_REFILL_INTERVAL_MS = 120;
export const DROWNING_ALERT_DELAY_MS = 750;
export const DROWNING_RETURN_DELAY_MS = 3000;
export const PUZZLE_GENERATION_DELAY_MS = 150;
