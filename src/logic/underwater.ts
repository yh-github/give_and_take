import {
  FISH_CHASE_CONFIG,
  FISH_PATTERN_CONFIG,
  FISHING_CATCH_CONFIG,
  LANTERNFISH_HELD_RADIUS_STEP,
  LANTERNFISH_MAX_LIGHT_STACKS,
  LANTERNFISH_WILD_LIGHT_RADIUS,
  MAX_AIR,
  MAX_UNIQUE_ITEMS,
  MERMAN_CATCH_RADIUS_MULT,
  MERMAN_DIRECT_GRAB_MULT,
  MERMAN_SPOOK_MULT,
  MERMAN_TIMING_TOLERANCE_MULT,
  SURFACE_SWIM_HEAVY_CAP_MS,
  SURFACE_SWIM_MAX_MS,
  SURFACE_SWIM_MIN_MS,
  UNDERWATER_AIR_COST_FULL_BAG,
  UNDERWATER_AIR_COST_NORMAL,
  UNDERWATER_FISH_ITEM_IDS,
  UNDERWATER_FULL_BAG_SPEED_MULTIPLIER,
  UNDERWATER_INSPECT_RADIUS,
  UNDERWATER_LIGHT_Y_ASPECT,
  UNDERWATER_SURFACE_Y
} from '../constants.ts';
import {
  AIR_POCKET_Y,
  SHIPWRECK_AIR_POCKET_RETURN_POS,
  isInShipwreckAirPocket,
  isInsideShipwreckHull
} from '../levels/shipwreck/geometry.ts';
import type {
  CampItemState,
  LevelDefinition,
  Point2D,
  PuzzleData,
  PuzzleEntity,
  SchoolFishState
} from '../types/index.ts';
import { uniqueCount } from './navigation.ts';

export type UnderwaterFishTier = 'fish' | 'gold_fish' | 'blowfish';

export const HUMAN_TRINKET_BOAT_TIERS: Record<string, UnderwaterFishTier> = {
  comb: 'fish',
  boot: 'fish',
  mirror: 'gold_fish',
  locket: 'gold_fish',
  pocket_watch: 'blowfish',
  music_box: 'blowfish'
};

export const HUMAN_TRINKET_IDS: readonly string[] = Object.keys(HUMAN_TRINKET_BOAT_TIERS);

export interface OutOfAirDropResolution {
  nextInventory: string[];
  droppedFloatingItems: CampItemState[];
  discardedFishCount: number;
}

export interface FishingCatchResult {
  caught: boolean;
  quality: 'perfect' | 'good' | 'miss';
}

export interface UnderwaterAirSolvabilityResult {
  solvable: boolean;
  maxMovesBetweenRefills: number;
  unreachableEntities: string[];
}

export function isFishItem(itemId: string): boolean {
  return (UNDERWATER_FISH_ITEM_IDS as readonly string[]).includes(itemId);
}

export function isHumanTrinket(itemId: string): boolean {
  return HUMAN_TRINKET_IDS.includes(itemId);
}

export function getBoatReqFishForTrinket(itemId: string): UnderwaterFishTier {
  return HUMAN_TRINKET_BOAT_TIERS[itemId] || 'fish';
}

export function isUnderwaterBackpackFull(inventory: readonly string[]): boolean {
  return uniqueCount(inventory) >= MAX_UNIQUE_ITEMS;
}

export function getUnderwaterAirCost(inventory: readonly string[]): number {
  return isUnderwaterBackpackFull(inventory)
    ? UNDERWATER_AIR_COST_FULL_BAG
    : UNDERWATER_AIR_COST_NORMAL;
}

export function getUnderwaterMoveDurationMs(baseDurationMs: number, isHeavy: boolean): number {
  return isHeavy
    ? Math.round(baseDurationMs * UNDERWATER_FULL_BAG_SPEED_MULTIPLIER)
    : baseDurationMs;
}

export function isDivingLevel(level: Pick<LevelDefinition, 'mechanics'> | null | undefined): boolean {
  return Boolean(level?.mechanics?.hasAir);
}

export function getMaxAir(level: Pick<LevelDefinition, 'mechanics'> | null | undefined): number {
  return level?.mechanics?.maxAir ?? MAX_AIR;
}

export function isHeroSubmerged(
  level: Pick<LevelDefinition, 'id' | 'campPos' | 'mechanics'> | null | undefined,
  pos: Point2D
): boolean {
  if (!level?.mechanics?.hasAir) return false;
  if (level.id === 'shipwreck') {
    return !isInShipwreckAirPocket(pos.x, pos.y);
  }
  return pos.y > ((level.campPos?.y ?? 14) + 2);
}

export function isAtAirRefillZone(
  level: Pick<LevelDefinition, 'id' | 'campPos' | 'mechanics'> | null | undefined,
  pos: Point2D,
  campPos?: Point2D | null
): boolean {
  if (!level?.mechanics?.hasAir) return false;
  if (level.id === 'shipwreck') {
    const anchor = campPos || level.campPos;
    return isInShipwreckAirPocket(pos.x, pos.y) || Math.hypot(pos.x - anchor.x, pos.y - anchor.y) <= 10;
  }
  return pos.y <= 20;
}

export function isHeavyDivingLoad(
  level: Pick<LevelDefinition, 'mechanics'> | null | undefined,
  inventory: readonly string[],
  isTransformed: boolean
): boolean {
  return Boolean(level?.mechanics?.hasAir && !isTransformed && isUnderwaterBackpackFull(inventory));
}

export function getDivingAirCost(
  level: Pick<LevelDefinition, 'id' | 'mechanics'> | null | undefined,
  inventory: readonly string[],
  isTransformed: boolean,
  wasFullBeforeMove?: boolean
): number {
  if (!level?.mechanics?.hasAir || isTransformed) return 0;
  const isHeavy = wasFullBeforeMove !== undefined ? wasFullBeforeMove : isUnderwaterBackpackFull(inventory);
  return isHeavy ? UNDERWATER_AIR_COST_FULL_BAG : UNDERWATER_AIR_COST_NORMAL;
}

export function getDivingMoveDurationMs(
  level: Pick<LevelDefinition, 'mechanics'> | null | undefined,
  baseDurationMs: number,
  inventory: readonly string[],
  isTransformed: boolean,
  wasFullBeforeMove?: boolean
): number {
  if (!level?.mechanics?.hasAir || isTransformed) return baseDurationMs;
  const isHeavy = wasFullBeforeMove !== undefined ? wasFullBeforeMove : isUnderwaterBackpackFull(inventory);
  return getUnderwaterMoveDurationMs(baseDurationMs, isHeavy);
}

/**
 * Computes a calm, distance-scaled swim duration when ascending to the air source
 * via the air indicator, clamped between SURFACE_SWIM_MIN_MS and SURFACE_SWIM_MAX_MS
 * (and capped at SURFACE_SWIM_HEAVY_CAP_MS when carrying a full heavy backpack).
 */
export function getSurfaceSwimDurationMs(
  level: Pick<LevelDefinition, 'mechanics'> | null | undefined,
  curPos: Point2D,
  campPos: Point2D,
  inventory: readonly string[],
  isTransformed: boolean,
  wasFullBeforeMove?: boolean
): number {
  const dist = Math.hypot(campPos.x - curPos.x, campPos.y - curPos.y);
  const baseMs = Math.round(clamp(700 + dist * 28, SURFACE_SWIM_MIN_MS, SURFACE_SWIM_MAX_MS));
  return Math.min(
    SURFACE_SWIM_HEAVY_CAP_MS,
    getDivingMoveDurationMs(level, baseMs, inventory, isTransformed, wasFullBeforeMove)
  );
}

export function getOutOfAirDropBounds(
  level: Pick<LevelDefinition, 'id'> | null | undefined
): { min: number; max: number } {
  return level?.id === 'shipwreck' ? { min: 36, max: 92 } : { min: 22, max: 68 };
}

export interface ShipwreckDrowningResolution {
  mode: 'air_pocket' | 'lost_at_sea';
  targetPos?: Point2D & { zone: number };
}

export function resolveShipwreckDrowningTarget(dropPos: Point2D): ShipwreckDrowningResolution {
  if (isInsideShipwreckHull(dropPos.x, dropPos.y)) {
    return {
      mode: 'air_pocket',
      targetPos: { ...SHIPWRECK_AIR_POCKET_RETURN_POS }
    };
  }
  return { mode: 'lost_at_sea' };
}

export function getWaterlineSplashPoint(
  level: Pick<LevelDefinition, 'id' | 'campPos' | 'mechanics'> | null | undefined,
  fromPos: Point2D | null | undefined,
  toPos: Point2D | null | undefined
): Point2D | null {
  if (!level?.mechanics?.hasAir || !fromPos || !toPos) return null;
  if (level.id === 'shipwreck') {
    if (isInShipwreckAirPocket(fromPos.x, fromPos.y) !== isInShipwreckAirPocket(toPos.x, toPos.y)) {
      return {
        x: Math.max(68, Math.min(91, (fromPos.x + toPos.x) / 2)),
        y: AIR_POCKET_Y
      };
    }
    return null;
  }
  if (level.id === 'underwater') {
    if (isHeroSubmerged(level, fromPos) !== isHeroSubmerged(level, toPos)) {
      return {
        x: Math.max(12, Math.min(88, (fromPos.x + toPos.x) / 2)),
        y: UNDERWATER_SURFACE_Y
      };
    }
  }
  return null;
}

export function isCampItemFloating(
  level: Pick<LevelDefinition, 'id'> | null | undefined,
  item: Pick<CampItemState, 'x' | 'y' | 'isFloating'>,
  campPos: Point2D
): boolean {
  if (item.isFloating) return true;
  if (level?.id === 'underwater') {
    return item.y > campPos.y + 4;
  }
  if (level?.id === 'shipwreck') {
    return !isInShipwreckAirPocket(item.x, item.y);
  }
  return false;
}

export interface MurkyVisibilityOptions {
  inventory?: readonly string[];
  wildLightSources?: readonly Point2D[];
}

export function getHeldLanternfishLightCount(inventory: readonly string[] = []): number {
  let count = 0;
  for (const id of inventory) {
    if (id === 'blowfish') count++;
  }
  return Math.min(LANTERNFISH_MAX_LIGHT_STACKS, count);
}

export function getUnderwaterInspectRadius(inventory: readonly string[] = []): number {
  return UNDERWATER_INSPECT_RADIUS + getHeldLanternfishLightCount(inventory) * LANTERNFISH_HELD_RADIUS_STEP;
}

function getLightYScale(
  level: Pick<LevelDefinition, 'mechanics'> | null | undefined
): number {
  if (level?.mechanics?.yScaleOverride != null) {
    return level.mechanics.yScaleOverride;
  }
  return (level?.mechanics?.screens || 1) * UNDERWATER_LIGHT_Y_ASPECT;
}

export function isPointIlluminatedByWildLight(
  level: Pick<LevelDefinition, 'mechanics'> | null | undefined,
  pos: Point2D,
  wildLightSources: readonly Point2D[] = []
): boolean {
  if (!wildLightSources.length) return false;
  const yScale = getLightYScale(level);
  for (const lightPos of wildLightSources) {
    if (Math.hypot(pos.x - lightPos.x, (pos.y - lightPos.y) * yScale) <= LANTERNFISH_WILD_LIGHT_RADIUS) {
      return true;
    }
  }
  return false;
}

export function isEntityMurkyFar(
  level: Pick<LevelDefinition, 'mechanics'> | null | undefined,
  ent: Pick<PuzzleEntity, 'id' | 'isPreset' | 'isGatekeeper'>,
  visualPos: Point2D,
  heroPos: Point2D | null | undefined,
  options?: MurkyVisibilityOptions
): boolean {
  if (!level?.mechanics?.hasMurkyWater || !heroPos) return false;
  if (
    ent.isPreset ||
    ent.isGatekeeper ||
    ent.id === 'dolphin_1'
  ) {
    return false;
  }
  const inspectRadius = getUnderwaterInspectRadius(options?.inventory);
  if (Math.hypot(visualPos.x - heroPos.x, visualPos.y - heroPos.y) <= inspectRadius) {
    return false;
  }
  if (isPointIlluminatedByWildLight(level, visualPos, options?.wildLightSources)) {
    return false;
  }
  return true;
}

export function shouldRefillAirOnTrade(
  entity: Pick<PuzzleEntity, 'id'>,
  transformedJustEnded: boolean
): boolean {
  return transformedJustEnded || entity.id.startsWith('mermaid');
}

export function getAquaticHeroFace({
  isDrowning,
  isRefillingAir = false,
  isTransformed,
  isInventoryFullAlert,
  isSubmerged
}: {
  isDrowning: boolean;
  isRefillingAir?: boolean;
  isTransformed: boolean;
  isInventoryFullAlert: boolean;
  isSubmerged: boolean;
}): string {
  if (isDrowning) return '😵';
  if (isRefillingAir) return '😮‍💨';
  if (isTransformed) return '🧜‍♂️';
  if (isInventoryFullAlert) return '😥';
  if (isSubmerged) return '🤿';
  return '🤠';
}

/**
 * Evaluates a tap during the 1-tap timing-ring fishing mini-game.
 * Progress `0.5` is the center of the golden target ring.
 */
export function evaluateFishingCatch(
  progress: number,
  fishType: string,
  isTransformed = false
): FishingCatchResult {
  const cfg =
    FISHING_CATCH_CONFIG[fishType as keyof typeof FISHING_CATCH_CONFIG] ||
    FISHING_CATCH_CONFIG.fish;
  const effectiveTolerance = isTransformed
    ? cfg.tolerance * MERMAN_TIMING_TOLERANCE_MULT
    : cfg.tolerance;
  const delta = Math.abs(progress - 0.5);
  if (delta <= effectiveTolerance * 0.45) {
    return { caught: true, quality: 'perfect' };
  }
  if (delta <= effectiveTolerance) {
    return { caught: true, quality: 'good' };
  }
  return { caught: false, quality: 'miss' };
}

const clamp = (val: number, min: number, max: number): number => Math.max(min, Math.min(max, val));

const getFishChaseConfig = (fishType: string) =>
  FISH_CHASE_CONFIG[fishType as keyof typeof FISH_CHASE_CONFIG] || FISH_CHASE_CONFIG.fish;

/**
 * Computes the live `(x, y)` percentage position of a roaming school fish at `nowMs`,
 * applying per-species swim patterns (`cruise`, `dart`, `weave`) or linear spook sprint.
 */
export function getSchoolFishPosition(fish: SchoolFishState, nowMs: number): Point2D {
  const startX = fish.startX ?? (fish.isRight ? -12 : 112);
  const endX = fish.endX ?? (fish.isRight ? 115 : -15);
  const durationMs = Math.max(250, (fish.speed || 10) * 1000);
  const spawnTime = fish.spawnTime ?? (nowMs - durationMs * 0.5);
  const elapsed = Math.max(0, nowMs - spawnTime);
  const p = clamp((nowMs - spawnTime) / durationMs, 0, 1);
  const cfg = getFishChaseConfig(fish.type);

  const maxSwimY = fish.type === 'blowfish' ? 96 : 66;

  if (fish.isSpooked) {
    const spookStart = fish.spookedAt ?? spawnTime;
    const easeT = clamp((nowMs - spookStart) / FISH_PATTERN_CONFIG.dodgeEaseMs, 0, 1);
    const eased = 1 - Math.pow(1 - easeT, 2);
    const fromY = fish.dodgeFromY ?? fish.y;
    return {
      x: startX + (endX - startX) * p,
      y: clamp(fromY + (fish.y - fromY) * eased, 14, maxSwimY)
    };
  }

  let xProgress = p;
  let yOffset = 0;

  if (cfg.pattern === 'dart') {
    const cycles = Math.max(2, Math.round(durationMs / FISH_PATTERN_CONFIG.dartCycleMs));
    if (p >= 1) {
      xProgress = 1;
    } else {
      const cyclePos = p * cycles;
      const cycleIdx = Math.floor(cyclePos);
      const u = cyclePos - cycleIdx;
      const pauseFrac = FISH_PATTERN_CONFIG.dartPauseFrac;
      let moveU = 0;
      if (u >= pauseFrac) {
        const s = (u - pauseFrac) / (1 - pauseFrac);
        moveU = s * s * (3 - 2 * s);
      }
      xProgress = (cycleIdx + moveU) / cycles;
    }
    yOffset =
      FISH_PATTERN_CONFIG.dartBobAmp *
      Math.sin((2 * Math.PI * elapsed) / FISH_PATTERN_CONFIG.dartCycleMs);
  } else if (cfg.pattern === 'weave') {
    yOffset =
      FISH_PATTERN_CONFIG.weaveAmp *
      Math.sin((2 * Math.PI * elapsed) / FISH_PATTERN_CONFIG.weavePeriodMs);
  } else {
    yOffset =
      FISH_PATTERN_CONFIG.cruiseBobAmp *
      Math.sin((2 * Math.PI * elapsed) / FISH_PATTERN_CONFIG.cruiseBobPeriodMs);
  }

  return {
    x: startX + (endX - startX) * xProgress,
    y: clamp(fish.y + yOffset, 14, maxSwimY)
  };
}

/**
 * Transitions a fish into a startled escape sprint from its current coordinates,
 * boosting horizontal speed and dodging vertically for higher-tier fish.
 */
export function createSpookedFishState(fish: SchoolFishState, nowMs: number): SchoolFishState {
  const curPos = getSchoolFishPosition(fish, nowMs);
  const cfg = getFishChaseConfig(fish.type);
  const prevStartX = fish.startX ?? (fish.isRight ? -12 : 112);
  const prevEndX = fish.endX ?? (fish.isRight ? 115 : -15);
  const endX = fish.isRight ? 118 : -18;
  const origVel = Math.max(4, Math.abs(prevEndX - prevStartX) / Math.max(0.5, fish.speed || 10));
  const boost = fish.isSpooked ? 1.2 : cfg.fleeSpeedMultiplier;
  const remainingDist = Math.max(1, Math.abs(endX - curPos.x));
  const nextSpeed = Math.max(1.2, Number((remainingDist / (origVel * boost)).toFixed(2)));

  const prevCount = fish.spookCount || 0;
  let dodgeDir = prevCount % 2 === 0 ? -1 : 1;
  const maxSpookY = fish.type === 'blowfish' ? 95 : 62;
  if (curPos.y < 24) dodgeDir = 1;
  else if (curPos.y > maxSpookY - 6) dodgeDir = -1;
  const nextY = Number(clamp(curPos.y + dodgeDir * cfg.fleeDodgeY, 18, maxSpookY).toFixed(2));

  return {
    ...fish,
    y: nextY,
    dodgeFromY: Number(curPos.y.toFixed(2)),
    startX: Number(curPos.x.toFixed(2)),
    endX,
    spawnTime: nowMs,
    speed: nextSpeed,
    isSpooked: true,
    spookCount: prevCount + 1,
    spookedAt: nowMs
  };
}

/**
 * Returns true if the hero is already close enough to attempt a direct grab on `fish`.
 */
export function canDirectGrabFish(
  fish: SchoolFishState,
  heroPos: Point2D,
  nowMs: number,
  isTransformed = false
): boolean {
  const cfg = getFishChaseConfig(fish.type);
  const curPos = getSchoolFishPosition(fish, nowMs);
  const grabDist = isTransformed ? cfg.directGrabDist * MERMAN_DIRECT_GRAB_MULT : cfg.directGrabDist;
  return Math.hypot(curPos.x - heroPos.x, curPos.y - heroPos.y) <= grabDist;
}

/**
 * Checks whether any active school fish intercepts `targetPos` around `arrivalTimeMs`.
 */
export function findInterceptedFish(
  fishes: readonly SchoolFishState[],
  targetPos: Point2D,
  arrivalTimeMs: number,
  isTransformed = false
): SchoolFishState | null {
  const sampleOffsets = [-180, 0, 220];
  let bestFish: SchoolFishState | null = null;
  let bestScore = Infinity;

  for (const fish of fishes) {
    const durationMs = Math.max(250, (fish.speed || 10) * 1000);
    if (fish.spawnTime !== undefined && arrivalTimeMs - fish.spawnTime > durationMs + 220) {
      continue;
    }
    const cfg = getFishChaseConfig(fish.type);
    const radiusX = isTransformed ? cfg.catchRadiusX * MERMAN_CATCH_RADIUS_MULT : cfg.catchRadiusX;
    const radiusY = isTransformed ? cfg.catchRadiusY * MERMAN_CATCH_RADIUS_MULT : cfg.catchRadiusY;

    for (const offset of sampleOffsets) {
      const pos = getSchoolFishPosition(fish, arrivalTimeMs + offset);
      const dx = Math.abs(pos.x - targetPos.x);
      const dy = Math.abs(pos.y - targetPos.y);
      if (dx <= radiusX && dy <= radiusY) {
        const score = dx + dy * 1.5;
        if (score < bestScore) {
          bestScore = score;
          bestFish = fish;
        }
      }
    }
  }

  return bestFish;
}

/**
 * Returns true if clicking `clickPos` chases an unspooked fish from behind or directly on top
 * rather than leading safely ahead in its swim path, causing it to spook and dart away.
 */
export function shouldSpookFishFromPoint(
  fish: SchoolFishState,
  clickPos: Point2D,
  nowMs: number,
  isTransformed = false
): boolean {
  if (fish.isSpooked) return false;
  const cfg = getFishChaseConfig(fish.type);
  const curPos = getSchoolFishPosition(fish, nowMs);
  const spookBandY = isTransformed ? cfg.spookBandY * MERMAN_SPOOK_MULT : cfg.spookBandY;
  const spookBehind = isTransformed ? cfg.spookBehind * MERMAN_SPOOK_MULT : cfg.spookBehind;
  const spookAhead = isTransformed ? cfg.spookAhead * MERMAN_SPOOK_MULT : cfg.spookAhead;
  if (Math.abs(clickPos.y - curPos.y) > spookBandY) return false;
  const forwardDelta = fish.isRight ? (clickPos.x - curPos.x) : (curPos.x - clickPos.x);
  return forwardDelta >= -spookBehind && forwardDelta <= spookAhead;
}

/**
 * Resolves which item stays in the hero's backpack and which items are dumped
 * when running out of air underwater:
 * - If holding 0 or 1 item, nothing is dropped.
 * - If holding 2+ items, the chosen item stays in inventory, dropped fish swim away
 *   (removed from game), and remaining non-fish items float where they were dropped.
 */
export function resolveOutOfAirDrop(
  inventory: readonly string[],
  keepItemId: string | null,
  dropPos: Point2D,
  uidBase = Date.now(),
  yBounds: { min: number; max: number } = { min: 22, max: 68 }
): OutOfAirDropResolution {
  if (inventory.length <= 1) {
    return {
      nextInventory: [...inventory],
      droppedFloatingItems: [],
      discardedFishCount: 0
    };
  }

  let keepIndex = keepItemId ? inventory.indexOf(keepItemId) : -1;
  if (keepIndex < 0) keepIndex = 0;

  const keptItem = inventory[keepIndex];
  const nonFishDropped: string[] = [];
  let discardedFishCount = 0;

  inventory.forEach((itemId, idx) => {
    if (idx === keepIndex) return;
    if (isFishItem(itemId)) {
      discardedFishCount += 1;
    } else {
      nonFishDropped.push(itemId);
    }
  });

  const baseX = clamp(dropPos?.x ?? 50, 14, 86);
  const baseY = clamp(dropPos?.y ?? 35, yBounds.min, yBounds.max);
  const count = nonFishDropped.length;

  const droppedFloatingItems: CampItemState[] = nonFishDropped.map((itemId, idx) => {
    const spreadX = (idx - (count - 1) / 2) * 8;
    const staggerY = count > 1 ? (idx % 2 === 0 ? -2 : 2) : 0;
    return {
      uid: uidBase + idx + 1,
      id: itemId,
      x: Number(clamp(baseX + spreadX, 14, 86).toFixed(2)),
      y: Number(clamp(baseY + staggerY, yBounds.min, yBounds.max).toFixed(2)),
      isFloating: true
    };
  });

  return {
    nextInventory: [keptItem],
    droppedFloatingItems,
    discardedFishCount
  };
}

/**
 * Verifies that every Zone 1 & Zone 2 entity (without air vents) is reachable
 * from the surface even under the 2-air full-bag move budget (<= 4 moves one-way)
 * and round-trip capable on a normal 8-air tank, and enforces Underwater's
 * strict item-provenance invariants.
 */
export function verifyUnderwaterAirSolvability(
  level: Pick<LevelDefinition, 'campPos' | 'mechanics'>,
  puzzle: Pick<PuzzleData, 'puzzleEntities'> | null | undefined
): UnderwaterAirSolvabilityResult {
  const effectiveMaxAir = getMaxAir(level);
  const maxMovesBetweenRefills = Math.floor(effectiveMaxAir / UNDERWATER_AIR_COST_FULL_BAG);
  if (!puzzle || !Array.isArray(puzzle.puzzleEntities)) {
    return { solvable: false, maxMovesBetweenRefills, unreachableEntities: [] };
  }

  // Provenance & layout checks: no vents, no fish rewards, no human trinkets in Zone 3
  for (const ent of puzzle.puzzleEntities) {
    if (ent.isVent || ent.isPreset === 'bubble_vent') {
      return { solvable: false, maxMovesBetweenRefills, unreachableEntities: [ent.id] };
    }
    if (ent.reward && (isFishItem(ent.reward) || isHumanTrinket(ent.reward))) {
      return { solvable: false, maxMovesBetweenRefills, unreachableEntities: [ent.id] };
    }
    if ((ent.zone || 1) >= 3) {
      const badReq = (ent.requires || []).some((r) => isFishItem(r) || isHumanTrinket(r));
      if (badReq) {
        return { solvable: false, maxMovesBetweenRefills, unreachableEntities: [ent.id] };
      }
    }
    if (ent.id.startsWith('mermaid')) {
      const badMermaidReq = (ent.requires || []).some((r) => !isHumanTrinket(r));
      if (badMermaidReq) {
        return { solvable: false, maxMovesBetweenRefills, unreachableEntities: [ent.id] };
      }
    }
  }

  const screens = level.mechanics.screens || 3.5;
  const viewportSpanY = 100 / screens;
  const maxScrollY = Math.max(0, 100 - viewportSpanY);

  const visibleYRangeFrom = (y: number): [number, number] => {
    const top = clamp(y - viewportSpanY / 2, 0, maxScrollY);
    return [top, top + viewportSpanY];
  };

  interface NavNode {
    id: string;
    x: number;
    y: number;
    isSurface: boolean;
    zone: number;
    isEntity: boolean;
  }

  const nodes: NavNode[] = [
    {
      id: 'surface_camp',
      x: level.campPos?.x ?? 50,
      y: level.campPos?.y ?? 14,
      isSurface: true,
      zone: 1,
      isEntity: false
    }
  ];

  // Open-water vertical swim stepping stones across Zones 1 & 2
  for (let y = 20; y <= 64; y += 6) {
    nodes.push({
      id: `swim_wp_${y}`,
      x: 50,
      y,
      isSurface: y <= 20,
      zone: y < 46 ? 1 : 2,
      isEntity: false
    });
  }

  for (const ent of puzzle.puzzleEntities) {
    if ((ent.zone || 1) > 2) continue; // Zone 3 is traversed while transformed (infinite air)
    nodes.push({
      id: ent.id,
      x: ent.x,
      y: ent.y,
      isSurface: ent.y <= 20,
      zone: ent.zone || 1,
      isEntity: true
    });
  }

  const canSingleMove = (from: NavNode, to: NavNode): boolean => {
    const [minY, maxY] = visibleYRangeFrom(from.y);
    return to.y >= minY - 0.5 && to.y <= maxY + 0.5;
  };

  const shortestDistFrom = (startIdx: number): number[] => {
    const dist = new Array<number>(nodes.length).fill(Infinity);
    dist[startIdx] = 0;
    const queue = [startIdx];
    while (queue.length > 0) {
      const u = queue.shift()!;
      for (let v = 0; v < nodes.length; v++) {
        if (u === v || dist[v] !== Infinity) continue;
        if (canSingleMove(nodes[u], nodes[v])) {
          dist[v] = dist[u] + 1;
          queue.push(v);
        }
      }
    }
    return dist;
  };

  const distFromSurface = shortestDistFrom(0);
  const unreachableEntities: string[] = [];

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if (!node.isEntity) continue;

    const minOut = distFromSurface[i];
    const distFromNode = shortestDistFrom(i);
    const minBack = Math.min(...nodes.map((n, idx) => (n.isSurface ? distFromNode[idx] : Infinity)));

    const reachableOnFullBagOneWay = minOut <= maxMovesBetweenRefills;
    const roundTripOnNormalAir = minOut + minBack <= effectiveMaxAir;
    if (!reachableOnFullBagOneWay || !roundTripOnNormalAir) {
      unreachableEntities.push(node.id);
    }
  }

  return {
    solvable: unreachableEntities.length === 0,
    maxMovesBetweenRefills,
    unreachableEntities
  };
}
