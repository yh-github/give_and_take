// === Game Balance Constants ===
export const MAX_UNIQUE_ITEMS = 4;
export const MAX_AIR = 8;
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
export const DEEP_CAVE_GENERATOR_VERSION = 3;

// === Solver Tuning ===
export const SOLVER_MAX_ITERS = 25000;
export const SOLVER_TIME_LIMIT_MS = 1200;
export const GENERATOR_MAX_ATTEMPTS = 5000;

// === Navigation & Layout ===
export const NAV_OFFSET = 6.0;
export const UNDERWATER_INSPECT_RADIUS = 22;
export const UNDERWATER_NEAR_RADIUS = 10;

// === Timing (milliseconds) ===
export const FISH_SPAWN_INTERVAL_MS = 1600;
export const BOAT_SPAWN_INTERVAL_MS = 10000;
export const INK_FOG_DURATION_MS = 8000;
export const DIGGER_BURY_DELAY_MS = 3000;
export const DIGGER_BURY_ANIM_MS = 700;
export const ACTION_ANIM_MS = 800;
export const ALERT_DURATION_MS = 600;
export const AIR_REFILL_INTERVAL_MS = 120;
export const DROWNING_ALERT_DELAY_MS = 500;
export const DROWNING_RETURN_DELAY_MS = 1400;
export const PUZZLE_GENERATION_DELAY_MS = 150;
