import React, { useState, useEffect, useRef, useMemo, useCallback, type MouseEvent } from 'react';
import {
  MAX_AIR,
  FISH_SPAWN_INTERVAL_MS,
  BOAT_SPAWN_INTERVAL_MS,
  INK_FOG_DURATION_MS,
  DIGGER_BURY_DELAY_MS,
  DIGGER_BURY_ANIM_MS,
  ACTION_ANIM_MS,
  ALERT_DURATION_MS,
  AIR_REFILL_INTERVAL_MS,
  DROWNING_ALERT_DELAY_MS,
  DROWNING_RETURN_DELAY_MS,
  UNDERWATER_FISHING_MODE,
  UNDERWATER_INSPECT_RADIUS,
  UNDERWATER_INSPECT_MOVES_HERO,
  LANTERNFISH_WILD_LIGHT_RADIUS,
  CANONICAL_SCREEN_HEIGHT,
  DEEP_CAVE_HERO_RADIUS
} from '../constants.ts';
import STRINGS from '../strings.ts';
import LEVEL_REGISTRY from '../levels/index.ts';
import { generateLevelPuzzle } from '../logic/generator.ts';
import { generateDeepCaveAsync } from '../levels/deep_cave/workerClient.ts';
import { DEFAULT_DEEP_CAVE_SETTINGS, normalizeDeepCaveSettings } from '../levels/deep_cave/presets.ts';
import { computeNavigationPath, computeWaypoints, inferTargetZone } from '../logic/navigation.ts';
import {
  computeVisibleEntitiesSet,
  getVisibilityPolygon,
  getObstacleSegments,
  getProceduralObstacleSegments,
  isPointInVisibilityPolygon
} from '../logic/visibility.ts';
import { findGlobalPath } from '../logic/pathfinding.ts';
import { canFitInInventory, evaluateEntityTrade, computeUnlockedZones } from '../logic/rules.ts';
import {
  canDirectGrabFish,
  createSpookedFishState,
  findInterceptedFish,
  getAquaticHeroFace,
  getBoatReqFishForTrinket,
  getHeldLanternfishLightCount,
  getUnderwaterInspectRadius,
  getDivingAirCost,
  getDivingMoveDurationMs,
  getMaxAir,
  getOutOfAirDropBounds,
  getSchoolFishPosition,
  getUnderwaterMoveDurationMs,
  getWaterlineSplashPoint,
  isAtAirRefillZone,
  isDivingLevel,
  isHeavyDivingLoad,
  isHeroSubmerged,
  isUnderwaterBackpackFull,
  resolveOutOfAirDrop,
  resolveShipwreckDrowningTarget,
  shouldRefillAirOnTrade,
  shouldSpookFishFromPoint
} from '../logic/underwater.ts';
import type { ReefKelpHabitat } from '../levels/underwater/data.ts';
import { AIR_POCKET_Y, isInShipwreckAirPocket } from '../levels/shipwreck/geometry.ts';
import { createShuffleBag } from '../logic/rng.ts';
import { CAVE_WALL_VERTICES } from '../levels/underground/components.tsx';
import {
  createSavePayload,
  saveToAutoSave,
  clearAutoSave,
  exportStateToString,
  importStateFromString
} from '../logic/saveState.ts';

import { GameMenu, GeneratingScreen, GenerationFailedScreen, DEFAULT_LIGHTING } from './GameMenu.tsx';
import InventoryBar from './InventoryBar.tsx';
import { SpriteIcon } from './sprites/SpriteIcon.tsx';
import AirIndicator from './AirIndicator.tsx';
import TopBar from './TopBar.tsx';
import WorldViewport from './WorldViewport.tsx';
import OutOfAirModal from './OutOfAirModal.tsx';
import FishingCatchOverlay from './FishingCatchOverlay.tsx';
import { DrowningVignetteOverlay, MagicTransformationOverlay, VictoryCelebration } from './EffectsOverlay.tsx';
import LevelEditorOverlay from './LevelEditorOverlay.tsx';
import type {
  ActiveGameSettings,
  AlertReason,
  CampItemState,
  CaveBrazier,
  ClickIndicatorState,
  CollarBounds,
  CustomEntityMovement,
  DeepCaveSettings,
  ExtraLightPolygon,
  FlyingItemState,
  GameHistoryEntry,
  GameInstanceProps,
  HeroBubbleBurst,
  ImportStateResult,
  LevelRegistry,
  LightingSettings,
  MapNode,
  MenuView,
  PathHistoryPoint,
  Point2D,
  PuzzleData,
  PuzzleEntity,
  RoamingBoatState,
  SavePayload,
  SchoolFishState,
  SerializedHistoryEntry,
  WaterSplashState,
  Waypoint
} from '../types/index.ts';

const LEVEL_DICTIONARY: LevelRegistry = LEVEL_REGISTRY;

interface GameStateSnapshotRef {
  inventory: string[];
  defeated: string[];
  pathHistory: PathHistoryPoint[];
  envItemState: string;
  unlockedZones: number[];
  campItems: CampItemState[];
  buriedEntities: string[];
  litBraziers: string[];
  air: number;
  isTransformed: boolean;
  hasDeepTreasure: boolean;
  inkFogEntities: Set<string>;
  dolphinState: string;
  dolphinYPos: number;
}

const hydrateHistoryStack = (
  stack: SerializedHistoryEntry[] | undefined,
  defaultMaxAir = MAX_AIR
): GameHistoryEntry[] =>
  (stack || []).map((entry) => ({
    inventory: entry.inventory || [],
    defeated: entry.defeated || [],
    pathHistory: entry.pathHistory || [],
    envItemState: entry.envItemState || 'active',
    unlockedZones: entry.unlockedZones || [1],
    campItems: entry.campItems || [],
    buriedEntities: entry.buriedEntities || [],
    litBraziers: entry.litBraziers || [],
    air: entry.air ?? defaultMaxAir,
    isTransformed: Boolean(entry.isTransformed),
    hasDeepTreasure: Boolean(entry.hasDeepTreasure),
    inkFogEntities: new Set(entry.inkFogEntities || []),
    dolphinState: entry.dolphinState || 'idle_surface',
    dolphinYPos: typeof entry.dolphinYPos === 'number' ? entry.dolphinYPos : 22
  }));

export function GameInstance({
  level,
  targetSteps,
  numDiggers,
  deepCaveSettings = null,
  onGenerateNew,
  onLoadState,
  savedState,
  saveVersionWarning = false,
  onDismissSaveVersionWarning = null,
  fishingMode = UNDERWATER_FISHING_MODE,
  lang,
  setLang
}: GameInstanceProps) {
  const maxAir = getMaxAir(level);
  const defaultTransformed = Boolean(level.mechanics.startsTransformed);

  const [puzzle, setPuzzle] = useState<PuzzleData | null>(() => savedState?.puzzle || null);
  const [generationFailed, setGenerationFailed] = useState(false);
  const [generationFailureHint, setGenerationFailureHint] = useState<string | null>(null);
  const [isLevelEditor] = useState(() => new URLSearchParams(window.location.search).get('editor') === 'true');
  const [editorScrollY, setEditorScrollY] = useState(0);
  const [editorNodes, setEditorNodes] = useState<MapNode[]>([]);

  useEffect(() => {
    if (isLevelEditor && level && level.mapNodes) {
      setEditorNodes(JSON.parse(JSON.stringify(level.mapNodes)));
    }
  }, [isLevelEditor, level]);

  const [inventory, setInventory] = useState<string[]>(() => savedState?.inventory || savedState?.puzzle?.startItems || []);
  const [unlockedZones, setUnlockedZones] = useState<number[]>(() => savedState?.unlockedZones || [1]);
  const [defeated, setDefeated] = useState<string[]>(() => savedState?.defeated || []);
  const [litBraziers, setLitBraziers] = useState<string[]>(() => savedState?.litBraziers || []);
  const [selectedItemTypes, setSelectedItemTypes] = useState<string[]>([]);
  const [pathHistory, setPathHistory] = useState<PathHistoryPoint[]>(() => savedState?.pathHistory || [{ ...level.campPos, zone: 1 }]);
  const [historyStack, setHistoryStack] = useState<GameHistoryEntry[]>(() => hydrateHistoryStack(savedState?.historyStack, maxAir));
  const [air, setAir] = useState<number>(() => savedState?.air ?? maxAir);

  const dict = STRINGS[lang] || STRINGS.en;

  const [isVictorious, setIsVictorious] = useState(false);
  const [showTrophy, setShowTrophy] = useState(false);
  const [showVictoryMsg, setShowVictoryMsg] = useState(false);
  const [isDemonstrating, setIsDemonstrating] = useState(false);
  const [isAnimatingLoot, setIsAnimatingLoot] = useState(false);
  const [alertEntityId, setAlertEntityId] = useState<string | number | null>(null);
  const [alertReason, setAlertReason] = useState<AlertReason>(null);
  const [isInventoryFullAlert, setIsInventoryFullAlert] = useState(false);
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [flyingItem, setFlyingItem] = useState<FlyingItemState | null>(null);
  const [tempPlayerPos, setTempPlayerPos] = useState<PathHistoryPoint | null>(null);
  const [envItemState, setEnvItemState] = useState<string>(() => savedState?.envItemState || 'active');
  const [envItemCaughtPos, setEnvItemCaughtPos] = useState(() => savedState?.envItemCaughtPos || { x: 50, y: 50 });
  const [schoolsOfFish, setSchoolsOfFish] = useState<SchoolFishState[]>([]);
  const [wildLightSources, setWildLightSources] = useState<Point2D[]>([]);
  const [campItems, setCampItems] = useState<CampItemState[]>(() => savedState?.campItems || []);
  const [massFlyingTreasures, setMassFlyingTreasures] = useState<FlyingItemState[]>([]);
  const [clickIndicator, setClickIndicator] = useState<ClickIndicatorState | null>(null);
  const [heroBubbleBursts, setHeroBubbleBursts] = useState<HeroBubbleBurst[]>([]);
  const [waterSplashes, setWaterSplashes] = useState<WaterSplashState[]>([]);
  const [moveDurationMs, setMoveDurationMs] = useState(300);

  const resolvedDeepCaveSettings: DeepCaveSettings = useMemo(() => {
    if (level.id !== 'deep_cave') return DEFAULT_DEEP_CAVE_SETTINGS;
    if (savedState?.settings) return normalizeDeepCaveSettings(savedState.settings);
    if (deepCaveSettings) return normalizeDeepCaveSettings(deepCaveSettings);
    return normalizeDeepCaveSettings(DEFAULT_DEEP_CAVE_SETTINGS, { targetSteps, numDiggers });
  }, [level.id, savedState?.settings, deepCaveSettings, targetSteps, numDiggers]);

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [menuView, setMenuView] = useState<MenuView>('main');
  const [menuSettings, setMenuSettings] = useState<ActiveGameSettings>({
    levelId: level.id,
    steps: targetSteps,
    diggers: numDiggers,
    deepCaveSettings: resolvedDeepCaveSettings
  });

  const [animatingEntities, setAnimatingEntities] = useState<string[]>([]);
  const [buriedEntities, setBuriedEntities] = useState<string[]>(() => savedState?.buriedEntities || []);
  const [isTransformed, setIsTransformed] = useState(() =>
    savedState && savedState.isTransformed !== undefined
      ? Boolean(savedState.isTransformed)
      : defaultTransformed
  );
  const [isRefillingAir, setIsRefillingAir] = useState(false);
  const [hasDeepTreasure, setHasDeepTreasure] = useState(() => Boolean(savedState?.hasDeepTreasure));
  const hasTransformedOnceRef = useRef(Boolean(savedState?.isTransformed || savedState?.hasDeepTreasure || defaultTransformed));
  const [inkFogEntities, setInkFogEntities] = useState<Set<string>>(() => new Set(savedState?.inkFogEntities || []));
  const [roamingBoats, setRoamingBoats] = useState<RoamingBoatState[]>([]);
  const [outOfAirModal, setOutOfAirModal] = useState<{ items: string[]; dropPos: Point2D; lostAtSea?: boolean } | null>(null);
  const [drowningFloatPos, setDrowningFloatPos] = useState<Point2D | null>(null);
  const [fishingCatch, setFishingCatch] = useState<{
    fish: SchoolFishState;
    wasFullBeforeMove: boolean;
    targetPos: Point2D;
  } | null>(null);
  const [rustlingKelpId, setRustlingKelpId] = useState<string | null>(null);
  const kelpCooldownsRef = useRef<Record<string, number>>({});
  const drowningRafRef = useRef<number>(0);
  const fishUidRef = useRef(1);
  const fishCleanupTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const [gameTime, setGameTime] = useState(0);
  const [attachedEntityId, setAttachedEntityId] = useState<string | null>(null);
  const [isMagicAnimating, setIsMagicAnimating] = useState(false);
  const [debugMode, setDebugMode] = useState(() => Boolean(savedState?.debugMode));
  const [lightingSettings, setLightingSettings] = useState<LightingSettings>(() => savedState?.lightingSettings || DEFAULT_LIGHTING);

  const [dolphinState, setDolphinState] = useState<string>(() => savedState?.dolphinState || 'idle_surface');
  const [dolphinYPos, setDolphinYPos] = useState<number>(() => typeof savedState?.dolphinYPos === 'number' ? savedState.dolphinYPos : 22);
  const [breakingRockIds, setBreakingRockIds] = useState<Record<string, boolean>>({});
  const [bridgingChasmIds, setBridgingChasmIds] = useState<Record<string, boolean>>({});
  const dolphinStateRef = useRef('idle_surface');
  const dolphinYPosRef = useRef(22);
  useEffect(() => { dolphinStateRef.current = dolphinState; }, [dolphinState]);
  useEffect(() => { dolphinYPosRef.current = dolphinYPos; }, [dolphinYPos]);
  const dolphinAnimRef = useRef({ startTime: 0, startY: 22, targetY: 22, duration: 0, isDiving: false, attachPlayer: false });

  const airRef = useRef(air); airRef.current = air;
  const inventoryRef = useRef(inventory); inventoryRef.current = inventory;
  const isTransformedRef = useRef(isTransformed); isTransformedRef.current = isTransformed;
  const schoolsOfFishRef = useRef(schoolsOfFish); schoolsOfFishRef.current = schoolsOfFish;
  const isDemoRef = useRef(isDemonstrating); isDemoRef.current = isDemonstrating;
  const isVicRef = useRef(isVictorious); isVicRef.current = isVictorious;
  const stateRefs = useRef<GameStateSnapshotRef>({
    inventory,
    defeated,
    pathHistory,
    envItemState,
    unlockedZones,
    campItems,
    buriedEntities,
    litBraziers,
    air,
    isTransformed,
    hasDeepTreasure,
    inkFogEntities,
    dolphinState,
    dolphinYPos
  });
  const activeDigTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const managedTimeoutsRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  const walkSessionRef = useRef(0);

  const scheduleTimeout = useCallback((fn: () => void, delayMs: number) => {
    const id = setTimeout(() => {
      managedTimeoutsRef.current.delete(id);
      fn();
    }, delayMs);
    managedTimeoutsRef.current.add(id);
    return id;
  }, []);

  const clearManagedTimeouts = useCallback(() => {
    managedTimeoutsRef.current.forEach(clearTimeout);
    managedTimeoutsRef.current.clear();
    Object.values(activeDigTimers.current).forEach(clearTimeout);
    activeDigTimers.current = {};
    Object.values(fishCleanupTimersRef.current).forEach(clearTimeout);
    fishCleanupTimersRef.current = {};
    if (drowningRafRef.current) {
      cancelAnimationFrame(drowningRafRef.current);
      drowningRafRef.current = 0;
    }
    walkSessionRef.current += 1;
  }, []);

  useEffect(() => {
    return () => clearManagedTimeouts();
  }, [clearManagedTimeouts]);

  const useIsotropic = Boolean(level.mechanics.useIsotropicCoords);
  const worldWidth = useIsotropic
    ? (puzzle?.geometry?.worldWidth || 100)
    : 100;
  const screensX = useIsotropic
    ? (worldWidth / 100)
    : (level.mechanics.screensX || 1);
  const screens = useIsotropic
    ? ((puzzle?.geometry?.worldHeight || CANONICAL_SCREEN_HEIGHT) / CANONICAL_SCREEN_HEIGHT)
    : (level.mechanics.screens || 1);
  const yScale = useIsotropic ? 1 : (level.mechanics.yScaleOverride ?? screens);
  const worldHeight = useIsotropic
    ? (puzzle?.geometry?.worldHeight || CANONICAL_SCREEN_HEIGHT)
    : (100 * yScale);
  const effectiveCampPos = puzzle?.geometry?.campPos || level.campPos;

  const activeTorchRadius = useMemo(() => {
    const customTorchRadius =
      puzzle?.settings && typeof puzzle.settings.torchRadius === 'number'
        ? puzzle.settings.torchRadius
        : null;
    if (useIsotropic && !debugMode && customTorchRadius) {
      return customTorchRadius;
    }
    if (level.id === 'shipwreck' && !debugMode) {
      return 44;
    }
    return lightingSettings?.radius || lightingSettings?.torchRadius || 50;
  }, [useIsotropic, debugMode, puzzle?.settings, lightingSettings, level.id]);

  const effectiveLighting = useMemo(() => ({
    ...lightingSettings,
    radius: activeTorchRadius
  }), [lightingSettings, activeTorchRadius]);

  const obstacleSegments = useMemo(() => {
    if (!puzzle) return [];
    if (level.getObstacleSegments) return level.getObstacleSegments(puzzle.puzzleEntities, unlockedZones, defeated, screens, puzzle.geometry, isTransformed);
    if (useIsotropic && puzzle.geometry) return getProceduralObstacleSegments(puzzle.puzzleEntities, puzzle.geometry, defeated);
    return getObstacleSegments(puzzle.puzzleEntities, CAVE_WALL_VERTICES, unlockedZones, defeated, screens);
  }, [puzzle?.puzzleEntities, puzzle?.geometry, unlockedZones, defeated, screens, level, useIsotropic, isTransformed]);

  const obstaclePolygons = useMemo(() => {
    return (useIsotropic && puzzle?.geometry?.obstaclePolygons) ? puzzle.geometry.obstaclePolygons : [];
  }, [useIsotropic, puzzle?.geometry]);

  const polyPoints = useMemo(() => {
    if (!puzzle || !level.mechanics.hasDarkness || level.mechanics.darknessType !== 'radial') return null;
    const pPos = tempPlayerPos || pathHistory[pathHistory.length - 1];
    if (!pPos) return null;
    return getVisibilityPolygon(pPos, obstacleSegments, activeTorchRadius, yScale);
  }, [puzzle, level.mechanics.hasDarkness, level.mechanics.darknessType, tempPlayerPos, pathHistory, obstacleSegments, activeTorchRadius, yScale]);

  const extraLightSources = useMemo(() => {
    if (!puzzle || !level.mechanics.hasDarkness || level.mechanics.darknessType !== 'radial') return [];
    const sources: Array<{ id: string; x: number; y: number; radius: number; ambientColor?: string }> = [];
    if (level.id === 'deep_cave') {
      sources.push({
        id: 'camp_fire',
        x: effectiveCampPos.x,
        y: effectiveCampPos.y,
        radius: 28,
        ambientColor: '#fde68a'
      });
    }
    const braziers = puzzle.geometry?.braziers || [];
    for (const b of braziers) {
      if (litBraziers.includes(b.id)) {
        sources.push({
          id: b.id,
          x: b.x,
          y: b.y,
          radius: b.radius || 46,
          ambientColor: '#fbbf24'
        });
      }
    }
    return sources;
  }, [puzzle, level.mechanics.hasDarkness, level.mechanics.darknessType, level.id, effectiveCampPos, litBraziers]);

  const extraLightPolygons: ExtraLightPolygon[] = useMemo(() => {
    if (!polyPoints || extraLightSources.length === 0) return [];
    return extraLightSources.map(src => ({
      id: src.id,
      x: src.x,
      y: src.y,
      radius: src.radius,
      ambientColor: src.ambientColor,
      polygon: getVisibilityPolygon({ x: src.x, y: src.y }, obstacleSegments, src.radius, yScale)
    }));
  }, [polyPoints, extraLightSources, obstacleSegments, yScale]);

  const visibleEntitiesSet = useMemo(() => {
    if (!polyPoints || !puzzle) return null;
    const pPos = tempPlayerPos || pathHistory[pathHistory.length - 1];
    if (!pPos) return null;
    return computeVisibleEntitiesSet({
      puzzleEntities: puzzle.puzzleEntities,
      playerPos: pPos,
      obstacleSegments,
      torchRadius: activeTorchRadius,
      yScale,
      levelId: level.id,
      hasPickaxe: Boolean(level.mechanics.hasPickaxe),
      caveWallVertices: CAVE_WALL_VERTICES,
      extraLightSources
    });
  }, [polyPoints, puzzle, tempPlayerPos, pathHistory, obstacleSegments, yScale, activeTorchRadius, level.mechanics.hasPickaxe, level.id, extraLightSources]);

  const visibleBraziersSet = useMemo(() => {
    const braziers = puzzle?.geometry?.braziers;
    if (!polyPoints || !puzzle || !braziers || braziers.length === 0) return null;
    const pPos = tempPlayerPos || pathHistory[pathHistory.length - 1];
    if (!pPos) return null;
    const asEntities = braziers.map(b => ({
      id: b.id,
      x: b.x,
      y: b.y,
      zone: b.zone,
      requires: [] as string[],
      reqType: 'AND' as const,
      reward: null
    }));
    return computeVisibleEntitiesSet({
      puzzleEntities: asEntities,
      playerPos: pPos,
      obstacleSegments,
      torchRadius: activeTorchRadius,
      yScale,
      levelId: level.id,
      hasPickaxe: false,
      caveWallVertices: CAVE_WALL_VERTICES,
      extraLightSources
    });
  }, [polyPoints, puzzle, tempPlayerPos, pathHistory, obstacleSegments, yScale, activeTorchRadius, level.id, extraLightSources]);

  const debugSegments = useMemo(() => {
    if (!debugMode || !obstacleSegments) return [];
    return obstacleSegments;
  }, [debugMode, obstacleSegments]);

  const wallSegments = useMemo(() => {
    return obstacleSegments.filter(s => !s.isRock);
  }, [obstacleSegments]);

  useEffect(() => {
    stateRefs.current = {
      inventory, defeated, pathHistory, envItemState, unlockedZones,
      campItems, buriedEntities, litBraziers, air, isTransformed, hasDeepTreasure,
      inkFogEntities, dolphinState, dolphinYPos
    };
  }, [inventory, defeated, pathHistory, envItemState, unlockedZones, campItems, buriedEntities, litBraziers, air, isTransformed, hasDeepTreasure, inkFogEntities, dolphinState, dolphinYPos]);

  useEffect(() => {
    setGenerationFailed(false);
    setGenerationFailureHint(null);

    const applySavedProgress = (saved: SavePayload, loadedPuzzle: PuzzleData) => {
      const fallbackCamp = loadedPuzzle?.geometry?.campPos || level.campPos;
      setPuzzle(loadedPuzzle);
      setInventory(saved.inventory || loadedPuzzle?.startItems || []);
      setPathHistory(
        saved.pathHistory && saved.pathHistory.length > 0
          ? saved.pathHistory
          : [{ ...fallbackCamp, zone: 1 }]
      );
      setUnlockedZones(saved.unlockedZones || [1]);
      setDefeated(saved.defeated || []);
      setLitBraziers(saved.litBraziers || []);
      setHistoryStack(hydrateHistoryStack(saved.historyStack, maxAir));
      setCampItems(saved.campItems || []);
      setBuriedEntities(saved.buriedEntities || []);
      const restoredAir = saved.air ?? maxAir;
      airRef.current = restoredAir;
      setAir(restoredAir);
      const restoredTransformed = saved.isTransformed !== undefined ? Boolean(saved.isTransformed) : defaultTransformed;
      isTransformedRef.current = restoredTransformed;
      setIsTransformed(restoredTransformed);
      setHasDeepTreasure(Boolean(saved.hasDeepTreasure));
      hasTransformedOnceRef.current = Boolean(restoredTransformed || saved.hasDeepTreasure || defaultTransformed);
      setEnvItemState(saved.envItemState || 'active');
      setEnvItemCaughtPos(saved.envItemCaughtPos || { x: 50, y: 50 });
      setDolphinState(saved.dolphinState || 'idle_surface');
      setDolphinYPos(typeof saved.dolphinYPos === 'number' ? saved.dolphinYPos : 22);
      if (saved.lightingSettings) setLightingSettings(saved.lightingSettings);
      if (saved.debugMode !== undefined) setDebugMode(saved.debugMode);
      if (saved.inkFogEntities) setInkFogEntities(new Set(saved.inkFogEntities));
      setSelectedItemTypes([]);
      setIsAnimatingLoot(false);
      setTempPlayerPos(null);
      setAlertEntityId(null);
      setAttachedEntityId(null);
      setOutOfAirModal(null);
      setDrowningFloatPos(null);
      setFishingCatch(null);
      setRustlingKelpId(null);
    };

    const applyFreshPuzzle = (generated: PuzzleData) => {
      const startCamp = generated.geometry?.campPos || level.campPos;
      setPuzzle(generated);
      setInventory(generated.startItems || []);
      setPathHistory([{ ...startCamp, zone: 1 }]);
      setUnlockedZones([1]);
      setDefeated([]);
      setLitBraziers([]);
      setHistoryStack([]);
      setCampItems([]);
      setBuriedEntities([]);
      setSelectedItemTypes([]);
      airRef.current = maxAir;
      setAir(maxAir);
      isTransformedRef.current = defaultTransformed;
      setIsTransformed(defaultTransformed);
      setHasDeepTreasure(false);
      hasTransformedOnceRef.current = defaultTransformed;
      setIsAnimatingLoot(false);
      setTempPlayerPos(null);
      setAlertEntityId(null);
      setAttachedEntityId(null);
      setOutOfAirModal(null);
      setDrowningFloatPos(null);
      setFishingCatch(null);
      setRustlingKelpId(null);
      kelpCooldownsRef.current = {};
    };

    if (savedState && savedState.puzzle) {
      applySavedProgress(savedState, savedState.puzzle);
      return;
    }

    if (level.id === 'deep_cave') {
      let cancelled = false;
      const controller = new AbortController();
      const compactSavedState = (savedState && !savedState.puzzle && savedState.seed != null)
        ? savedState
        : null;
      const hydrateSettings = normalizeDeepCaveSettings(
        compactSavedState ? (compactSavedState.settings || resolvedDeepCaveSettings) : resolvedDeepCaveSettings
      );

      setPuzzle(null);
      generateDeepCaveAsync(hydrateSettings, {
        seed: compactSavedState ? compactSavedState.seed : null,
        signal: controller.signal
      })
        .then((result) => {
          if (cancelled || !result?.puzzle) return;
          if (compactSavedState) {
            applySavedProgress(compactSavedState, result.puzzle);
          } else {
            applyFreshPuzzle(result.puzzle);
          }
        })
        .catch((err: unknown) => {
          const workerErr = err as { isCancelled?: boolean; isCustomTimeout?: boolean; message?: string } | null;
          if (cancelled || workerErr?.isCancelled) return;
          if (workerErr?.isCustomTimeout) {
            setGenerationFailureHint(dict.deepCaveTimeoutHint || workerErr.message || null);
          }
          setGenerationFailed(true);
        });

      return () => {
        cancelled = true;
        controller.abort();
      };
    }

    const p = generateLevelPuzzle(level, targetSteps, numDiggers);
    if (!p) {
      setGenerationFailed(true);
      return;
    }
    applyFreshPuzzle(p);
  }, [level, targetSteps, numDiggers, savedState, resolvedDeepCaveSettings, dict.deepCaveTimeoutHint]);

  const mapRef = useRef<HTMLDivElement | null>(null);
  const innerMapRef = useRef<HTMLDivElement | null>(null);
  const demoRef = useRef(false);

  const triggerVictory = useCallback(() => {
    setIsVictorious(true);
    setShowTrophy(true);
    setShowVictoryMsg(true);
  }, []);

  const navigateTo = useCallback((
    targetX: number,
    targetY: number,
    targetZone: number,
    targetDepth?: number,
    isInteract = false,
    occluderType: string | null = null,
    collarBounds: CollarBounds | null = null
  ): Waypoint[] => {
    if (!puzzle) return [];
    const lastPos = pathHistory[pathHistory.length - 1];
    return computeNavigationPath({
      lastPos,
      targetX,
      targetY,
      targetZone,
      targetDepth,
      isInteract,
      occluderType,
      collarBounds,
      isCaveType: Boolean(level.mechanics.isCaveType || level.mechanics.hasWalls),
      useIsotropic,
      worldHeight,
      yScale,
      obstacleSegments,
      obstaclePolygons,
      caveWallVertices: CAVE_WALL_VERTICES
    });
  }, [puzzle, pathHistory, level.mechanics.isCaveType, level.mechanics.hasWalls, obstacleSegments, obstaclePolygons, useIsotropic, worldHeight, yScale]);

  const triggerAirLossBubbles = useCallback((x: number, y: number, isHeavy = false, countOverride?: number) => {
    if (!isDivingLevel(level) || isTransformedRef.current) return;
    if (!isHeroSubmerged(level, { x, y })) return;
    const burstId = Date.now() + Math.random();
    const bubbleCount = countOverride ?? (isHeavy ? 12 : 6);
    const bubbles = Array.from({ length: bubbleCount }, (_, i) => ({
      id: i,
      dx: (Math.random() - 0.5) * 30,
      endDx: (Math.random() - 0.5) * 50,
      delay: i * (isHeavy ? 45 : 70),
      scale: 0.7 + Math.random() * 0.5,
      speed: 0.9 + Math.random() * 0.4
    }));
    setHeroBubbleBursts(prev => [...prev, { id: burstId, x, y, bubbles }]);
    scheduleTimeout(() => {
      setHeroBubbleBursts(prev => prev.filter(b => b.id !== burstId));
    }, 1600);
  }, [level, scheduleTimeout]);

  const triggerWaterSplash = useCallback((x: number, y: number, intensity: 'normal' | 'bounce' = 'normal') => {
    const splashId = Date.now() + Math.random();
    setWaterSplashes(prev => [...prev, { id: splashId, x, y, intensity }]);
    scheduleTimeout(() => {
      setWaterSplashes(prev => prev.filter(s => s.id !== splashId));
    }, 850);
  }, [scheduleTimeout]);

  const maybeTriggerWaterSplash = useCallback((fromPos: Point2D | null | undefined, toPos: Point2D | null | undefined) => {
    if (level.id === 'shipwreck' && isTransformedRef.current) return;
    const splashPt = getWaterlineSplashPoint(level, fromPos, toPos);
    if (splashPt) {
      triggerWaterSplash(splashPt.x, splashPt.y, 'normal');
    }
  }, [level, triggerWaterSplash]);

  const handlePostActionAir = useCallback((
    finalY: number,
    isVentAction = false,
    options?: { nextInventory?: string[]; wasFullBeforeMove?: boolean; dropPos?: Point2D }
  ) => {
    if (!isDivingLevel(level) || isTransformedRef.current) return;
    const effectiveInv = options?.nextInventory ?? inventoryRef.current;

    const checkX = options?.dropPos?.x ?? effectiveCampPos.x;
    const isAtRefill = isAtAirRefillZone(level, { x: checkX, y: finalY }, effectiveCampPos);

    if (isAtRefill || isVentAction) {
      airRef.current = maxAir;
      setAir(maxAir);
      if (level.id === 'underwater' && finalY <= 20 && hasDeepTreasure && hasTransformedOnceRef.current && !isTransformedRef.current && effectiveInv.includes('crown')) {
        triggerVictory();
      }
      return;
    }

    const airCost = getDivingAirCost(level, effectiveInv, isTransformedRef.current, options?.wasFullBeforeMove);
    const nextAir = Math.max(0, airRef.current - airCost);

    if (nextAir <= 0) {
      airRef.current = 0;
      setAir(0);
      const fallbackPos = stateRefs.current.pathHistory[stateRefs.current.pathHistory.length - 1] || level.campPos;
      const dropPos = options?.dropPos || { x: fallbackPos.x, y: fallbackPos.y };
      const lostAtSea = level.id === 'shipwreck' && resolveShipwreckDrowningTarget(dropPos).mode === 'lost_at_sea';
      triggerAirLossBubbles(dropPos.x, dropPos.y, true, 18);
      setAlertEntityId('out_of_air');
      scheduleTimeout(() => {
        setOutOfAirModal({
          items: [...effectiveInv],
          dropPos,
          lostAtSea
        });
      }, DROWNING_ALERT_DELAY_MS);
    } else {
      airRef.current = nextAir;
      setAir(nextAir);
    }
  }, [level, effectiveCampPos, maxAir, hasDeepTreasure, triggerVictory, scheduleTimeout, triggerAirLossBubbles]);

  const startDolphinDive = useCallback(() => {
    setAttachedEntityId('dolphin_1');
    setIsAnimatingLoot(true);
    setDolphinState('diving');
    dolphinAnimRef.current = {
      startTime: performance.now(),
      startY: dolphinYPosRef.current,
      targetY: 58,
      duration: 1500,
      isDiving: true,
      attachPlayer: true
    };
  }, []);

  const startDolphinReturn = useCallback((attachPlayer = false) => {
    if (attachPlayer) {
      setAttachedEntityId('dolphin_1');
      setIsAnimatingLoot(true);
    }
    setDolphinState('rising');
    dolphinAnimRef.current = {
      startTime: performance.now(),
      startY: dolphinYPosRef.current,
      targetY: 22,
      duration: 1400,
      isDiving: false,
      attachPlayer
    };
  }, []);

  useEffect(() => {
    if (level.id !== 'underwater') return;
    if (dolphinState !== 'diving' && dolphinState !== 'rising') return;

    let frameId = 0;
    let lastRenderTime = 0;
    const update = () => {
      const anim = dolphinAnimRef.current;
      const state = dolphinStateRef.current;

      if (state === 'diving' || state === 'rising') {
        const now = performance.now();
        const elapsed = now - anim.startTime;
        const progress = Math.min(1, Math.max(0, elapsed / anim.duration));
        const shouldUpdate = now - lastRenderTime >= 40 || progress >= 1;
        if (shouldUpdate) {
          lastRenderTime = now;
          const ease = progress < 0.5
            ? 4 * progress * progress * progress
            : 1 - Math.pow(-2 * progress + 2, 3) / 2;
          const currentY = anim.startY + (anim.targetY - anim.startY) * ease;
          setDolphinYPos(currentY);
        }

        if (progress >= 1) {
          if (state === 'diving') {
            setDolphinState('idle_deep');
            setAttachedEntityId(null);
            setIsAnimatingLoot(false);
            setPathHistory(prev => [...prev, { x: 50, y: 58, zone: 2 }]);
          } else if (state === 'rising') {
            setDolphinState('idle_surface');
            if (anim.attachPlayer) {
              setAttachedEntityId(null);
              setIsAnimatingLoot(false);
              setPathHistory(prev => [...prev, { x: 50, y: 20, zone: 1 }]);
              handlePostActionAir(20);
            }
          }
          return;
        }
        frameId = requestAnimationFrame(update);
      }
    };
    frameId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frameId);
  }, [level.id, dolphinState, handlePostActionAir]);

  useEffect(() => {
    if (!level.mechanics.hasSchoolsOfFish) return;
    const timeoutIds: Array<ReturnType<typeof setTimeout>> = [];
    const spawnFish = (tierOverride?: 'fish' | 'gold_fish' | 'blowfish', customY?: number, forceRight?: boolean) => {
      if (isDemoRef.current || isVicRef.current) return;
      const now = Date.now();
      const id = `fish_${fishUidRef.current++}`;
      let type: 'fish' | 'gold_fish' | 'blowfish' = tierOverride || 'fish';
      if (!tierOverride && level.id === 'underwater') {
        const roll = Math.random();
        type = roll < 0.48 ? 'fish' : roll < 0.80 ? 'gold_fish' : 'blowfish';
      }
      const yPos =
        customY !== undefined
          ? customY
          : type === 'fish'
            ? 18 + Math.random() * 16
            : type === 'gold_fish'
              ? 30 + Math.random() * 22
              : 46 + Math.random() * 44;
      const speed =
        type === 'fish'
          ? 10 + Math.random() * 5
          : type === 'gold_fish'
            ? 9 + Math.random() * 3
            : 11 + Math.random() * 3;
      const isRight = forceRight !== undefined ? forceRight : Math.random() > 0.5;
      const startX = isRight ? -12 : 112;
      const endX = isRight ? 115 : -15;
      const fishObj: SchoolFishState = {
        id,
        type,
        y: yPos,
        depth: 3,
        isRight,
        speed,
        spawnTime: now,
        startX,
        endX,
        isSpooked: false,
        spookCount: 0
      };
      setSchoolsOfFish(prev => {
        const next = [...prev.slice(-11), fishObj];
        schoolsOfFishRef.current = next;
        return next;
      });
      const tId = setTimeout(() => {
        delete fishCleanupTimersRef.current[String(id)];
        setSchoolsOfFish(prev => {
          const next = prev.filter(f => f.id !== id);
          schoolsOfFishRef.current = next;
          return next;
        });
      }, Math.round(speed * 1000) + 400);
      fishCleanupTimersRef.current[String(id)] = tId;
      timeoutIds.push(tId);
    };
    if (level.id === 'underwater') {
      spawnFish('fish');
      spawnFish('fish');
      spawnFish('gold_fish');
      spawnFish('blowfish');
      spawnFish('blowfish', 80);
    }
    const intervalId = setInterval(() => {
      spawnFish();
    }, FISH_SPAWN_INTERVAL_MS);
    return () => { clearInterval(intervalId); timeoutIds.forEach(clearTimeout); };
  }, [level.mechanics.hasSchoolsOfFish, level.id]);

  const hasActiveLanternfish =
    Boolean(level.mechanics.hasMurkyWater) &&
    schoolsOfFish.some((f) => f.type === 'blowfish');

  useEffect(() => {
    if (!hasActiveLanternfish) {
      setWildLightSources((prev) => (prev.length === 0 ? prev : []));
      return;
    }
    const updateLights = () => {
      const now = Date.now();
      const next = schoolsOfFishRef.current
        .filter((f) => f.type === 'blowfish')
        .map((f) => getSchoolFishPosition(f, now));
      setWildLightSources((prev) => {
        if (
          prev.length === next.length &&
          prev.every((p, idx) => Math.hypot(p.x - next[idx].x, p.y - next[idx].y) < 1.5)
        ) {
          return prev;
        }
        return next;
      });
    };
    updateLights();
    const timer = setInterval(updateLights, 400);
    return () => clearInterval(timer);
  }, [hasActiveLanternfish]);

  useEffect(() => {
    if (level.id !== 'underwater' || !puzzle) return;
    const timeoutIds: Array<ReturnType<typeof setTimeout>> = [];
    const requiredBoatItems = (
      Array.isArray(puzzle.boatOfferedItems) && puzzle.boatOfferedItems.length > 0
        ? puzzle.boatOfferedItems
        : [puzzle.boatOfferedItem || 'comb']
    );
    const safePool = Array.isArray(puzzle.safeBoatItems) && puzzle.safeBoatItems.length > 0
      ? puzzle.safeBoatItems.filter(id => !requiredBoatItems.includes(id))
      : [];
    const boatTradeMap = puzzle.boatTradeMap || {};
    const requiredBag = createShuffleBag(requiredBoatItems);
    const junkBag = safePool.length > 0 ? createShuffleBag(safePool) : null;
    const cycleLen = requiredBoatItems.length + (junkBag ? 1 : 0);
    let boatSpawnCount = 0;

    const spawnBoat = () => {
      if (isDemoRef.current || isVicRef.current) return;
      const spawnTime = Date.now();
      const id = spawnTime + Math.random();
      const posInCycle = boatSpawnCount % cycleLen;
      const isPrimary = !junkBag || posInCycle < requiredBoatItems.length;
      boatSpawnCount++;
      const offeredItem = isPrimary ? requiredBag.next() : junkBag!.next();
      const reqItem = boatTradeMap[offeredItem] || getBoatReqFishForTrinket(offeredItem);
      const isRight = boatSpawnCount % 2 === 1;
      const lane: 'far' | 'near' = isRight ? 'near' : 'far';
      setRoamingBoats(prev => [...prev.slice(-3), { id, spawnTime, offeredItem, reqItem, lane, x: isRight ? -20 : 120, isRight }]);
      const tId = setTimeout(() => { setRoamingBoats(prev => prev.filter(b => b.id !== id)); }, 20000);
      timeoutIds.push(tId);
    };
    const initialBoatTimer = setTimeout(spawnBoat, 400);
    timeoutIds.push(initialBoatTimer);
    const intervalId = setInterval(spawnBoat, BOAT_SPAWN_INTERVAL_MS);
    return () => { clearInterval(intervalId); timeoutIds.forEach(clearTimeout); };
  }, [level.id, puzzle]);

  const isClamEntity = (ent: Pick<PuzzleEntity, 'id'>) =>
    Boolean(ent.id?.startsWith('clam') || ent.id?.startsWith('giant_clam'));

  useEffect(() => {
    if (!puzzle || isDemonstrating || isAnimatingLoot) return;
    const currentPos = pathHistory[pathHistory.length - 1];
    const diggersToBury = puzzle.puzzleEntities.filter(ent => {
      if (isClamEntity(ent)) return false;
      const isDigger = level.specialEntityTemplate && ent.id?.startsWith(level.specialEntityTemplate) && !ent.isGoal;
      const isVisibleToPlayer = level.mechanics.darknessType !== 'radial' || (visibleEntitiesSet && visibleEntitiesSet.has(ent.id));
      const isZoneAccessible = level.mechanics.hasTransformation
        ? (ent.zone <= 2 || (isTransformed && currentPos && currentPos.y >= 70))
        : unlockedZones.includes(ent.zone);
      return isDigger && isVisibleToPlayer && isZoneAccessible && pathHistory.length > 1 && !buriedEntities.includes(ent.id) && !animatingEntities.includes(ent.id) && !defeated.includes(ent.id);
    });

    diggersToBury.forEach(ent => {
      if (!activeDigTimers.current[ent.id]) {
        activeDigTimers.current[ent.id] = setTimeout(() => {
          setAnimatingEntities(prev => [...prev, ent.id]);
          activeDigTimers.current[`${ent.id}_anim`] = setTimeout(() => {
            setAnimatingEntities(prev => prev.filter(id => id !== ent.id));
            setBuriedEntities(prev => [...new Set([...prev, ent.id])]);
            delete activeDigTimers.current[ent.id];
            delete activeDigTimers.current[`${ent.id}_anim`];
          }, DIGGER_BURY_ANIM_MS);
        }, DIGGER_BURY_DELAY_MS);
      }
    });
  }, [pathHistory, unlockedZones, puzzle, isDemonstrating, isAnimatingLoot, buriedEntities, animatingEntities, defeated, level, visibleEntitiesSet]);

  const saveHistory = useCallback(() => {
    setHistoryStack(prev => [...prev, {
      inventory: [...stateRefs.current.inventory],
      defeated: [...stateRefs.current.defeated],
      pathHistory: [...stateRefs.current.pathHistory],
      envItemState: stateRefs.current.envItemState,
      unlockedZones: [...stateRefs.current.unlockedZones],
      campItems: [...stateRefs.current.campItems],
      buriedEntities: [...stateRefs.current.buriedEntities],
      litBraziers: [...stateRefs.current.litBraziers],
      air: stateRefs.current.air,
      isTransformed: stateRefs.current.isTransformed,
      hasDeepTreasure: stateRefs.current.hasDeepTreasure,
      inkFogEntities: new Set(stateRefs.current.inkFogEntities),
      dolphinState: dolphinStateRef.current,
      dolphinYPos: dolphinYPosRef.current
    }]);
  }, []);

  const handleUndo = () => {
    if (historyStack.length === 0 || isDemonstrating || isAnimatingLoot || Boolean(outOfAirModal) || Boolean(fishingCatch)) return;
    clearManagedTimeouts();
    setOutOfAirModal(null);
    setDrowningFloatPos(null);
    setFishingCatch(null);
    setRustlingKelpId(null);
    setAlertEntityId(null);
    setAlertReason(null);
    setIsInventoryFullAlert(false);
    const prevState = historyStack[historyStack.length - 1];
    inventoryRef.current = prevState.inventory;
    const restoredAir = prevState.air ?? maxAir;
    airRef.current = restoredAir;
    isTransformedRef.current = prevState.isTransformed ?? defaultTransformed;
    setInventory(prevState.inventory); setDefeated(prevState.defeated); setPathHistory(prevState.pathHistory);
    setEnvItemState(prevState.envItemState);
    setUnlockedZones(prevState.unlockedZones); setCampItems(prevState.campItems || []);
    setBuriedEntities(prevState.buriedEntities || []); setLitBraziers(prevState.litBraziers || []); setAir(restoredAir);
    setIsTransformed(prevState.isTransformed ?? defaultTransformed);
    setHasDeepTreasure(prevState.hasDeepTreasure || false);
    setInkFogEntities(new Set(prevState.inkFogEntities || []));
    if (prevState.dolphinState) {
      setDolphinState(prevState.dolphinState);
      setDolphinYPos(prevState.dolphinYPos ?? (prevState.dolphinState === 'idle_deep' ? 58 : 22));
    }
    setHistoryStack(prev => prev.slice(0, -1)); setSelectedItemTypes([]); setSelectedEntityId(null);
    setFlyingItem(null); setTempPlayerPos(null); setIsVictorious(false); setShowTrophy(false); setShowVictoryMsg(false); setAnimatingEntities([]);
    setMassFlyingTreasures([]);
  };

  const resetGameState = () => {
    if (!puzzle) return;
    clearManagedTimeouts();
    setOutOfAirModal(null);
    setDrowningFloatPos(null);
    setFishingCatch(null);
    setRustlingKelpId(null);
    kelpCooldownsRef.current = {};
    inventoryRef.current = puzzle.startItems || [];
    isTransformedRef.current = defaultTransformed;
    setInventory(puzzle.startItems || []);
    setPathHistory([{ ...effectiveCampPos, zone: 1 }]);
    setBreakingRockIds({});
    setBridgingChasmIds({});
    setDolphinState('idle_surface');
    setDolphinYPos(22);
    dolphinAnimRef.current = { startTime: 0, startY: 22, targetY: 22, duration: 0, isDiving: false, attachPlayer: false };
    setUnlockedZones([1]);
    airRef.current = maxAir;
    setAir(maxAir);
    setDefeated([]);
    setLitBraziers([]);
    setSelectedItemTypes([]);
    setSelectedEntityId(null);
    setHistoryStack([]);
    setIsVictorious(false);
    setShowTrophy(false);
    setShowVictoryMsg(false);
    setIsDemonstrating(false);
    setIsAnimatingLoot(false);
    setAlertEntityId(null);
    setAlertReason(null);
    setIsInventoryFullAlert(false);
    setFlyingItem(null);
    setTempPlayerPos(null);
    setEnvItemState('active');
    setSchoolsOfFish([]);
    setAnimatingEntities([]);
    setCampItems([]);
    setBuriedEntities([]);
    setMassFlyingTreasures([]);
    setIsTransformed(defaultTransformed);
    setHasDeepTreasure(false);
    hasTransformedOnceRef.current = defaultTransformed;
    setInkFogEntities(new Set());
    setRoamingBoats([]);
    setAttachedEntityId(null);
    setIsMagicAnimating(false);
    setHeroBubbleBursts([]);
  };

  const triggerInventoryFullAlert = useCallback((targetId: string | number) => {
    setAlertEntityId(targetId);
    setAlertReason('inventory_full');
    setIsInventoryFullAlert(true);
    scheduleTimeout(() => {
      setAlertEntityId(null);
      setAlertReason(null);
      setIsInventoryFullAlert(false);
    }, 1800);
  }, [scheduleTimeout]);

  const getGameStatePayload = useCallback((compact = false) => {
    if (!puzzle) return null;
    return createSavePayload({
      levelId: level.id,
      targetSteps,
      numDiggers,
      puzzle,
      seed: puzzle?.seed ?? savedState?.seed ?? null,
      settings: level.id === 'deep_cave' ? (puzzle?.settings || resolvedDeepCaveSettings) : (puzzle?.settings || null),
      generatorVersion: puzzle?.generatorVersion ?? savedState?.generatorVersion ?? null,
      compact,
      inventory,
      unlockedZones,
      defeated,
      pathHistory,
      historyStack,
      campItems,
      buriedEntities,
      litBraziers,
      air,
      isTransformed,
      hasDeepTreasure,
      envItemState,
      envItemCaughtPos,
      dolphinState,
      dolphinYPos,
      lightingSettings,
      debugMode,
      inkFogEntities
    });
  }, [
    level.id, targetSteps, numDiggers, puzzle, inventory, unlockedZones, defeated,
    pathHistory, historyStack, campItems, buriedEntities, litBraziers, air, isTransformed,
    hasDeepTreasure, envItemState, envItemCaughtPos, dolphinState, dolphinYPos,
    lightingSettings, debugMode, inkFogEntities
  ]);

  // Auto-save whenever game state updates
  useEffect(() => {
    if (!puzzle || isVictorious || isDemonstrating || generationFailed) return;
    const hasProgress = Boolean(
      savedState ||
      historyStack.length > 0 ||
      pathHistory.length > 1 ||
      defeated.length > 0 ||
      campItems.length > 0 ||
      buriedEntities.length > 0 ||
      litBraziers.length > 0 ||
      air < maxAir ||
      isTransformed !== defaultTransformed ||
      hasDeepTreasure ||
      envItemState !== 'active' ||
      dolphinState !== 'idle_surface' ||
      (puzzle && JSON.stringify(inventory) !== JSON.stringify(puzzle.startItems))
    );
    if (!hasProgress) return;

    const payload = getGameStatePayload(level.id === 'deep_cave');
    if (payload) {
      saveToAutoSave(payload);
    }
  }, [
    level.id, puzzle, inventory, unlockedZones, defeated, pathHistory, historyStack,
    campItems, buriedEntities, litBraziers, air, isTransformed, hasDeepTreasure,
    envItemState, dolphinState, dolphinYPos, lightingSettings, debugMode,
    isVictorious, isDemonstrating, generationFailed, getGameStatePayload,
    savedState
  ]);

  // Clear auto-save when quest is successfully completed
  useEffect(() => {
    if (isVictorious) {
      clearAutoSave();
    }
  }, [isVictorious]);

  const handleExportStateString = useCallback(() => {
    const payload = getGameStatePayload(false);
    return payload ? exportStateToString(payload) : '';
  }, [getGameStatePayload]);

  const handleImportStateString = useCallback((jsonString: string): ImportStateResult => {
    const res = importStateFromString(jsonString, LEVEL_DICTIONARY);
    if (!res.success) {
      if (res.versionMismatch) {
        return {
          ...res,
          error: dict.saveVersionMismatch || res.error
        };
      }
      return res;
    }
    if (onLoadState && res.state) {
      onLoadState(res.state);
    }
    return { success: true };
  }, [onLoadState, dict.saveVersionMismatch]);

  const handleReplay = () => { demoRef.current = false; resetGameState(); setIsMenuOpen(false); };

  const handleShowSolution = async () => {
    if (!puzzle || !puzzle.solution || demoRef.current || isAnimatingLoot) return;
    resetGameState();
    setIsDemonstrating(true);
    demoRef.current = true;
    setIsMenuOpen(false);

    const currentInv = [...(puzzle.startItems || [])];
    const currentDefeated: string[] = [];
    const currentPath: PathHistoryPoint[] = [{ ...effectiveCampPos, zone: 1 }];
    let currentZoneSim = 1;
    const unlockedZonesSim = new Set<number>([1]);
    let transformedSim = defaultTransformed;
    let hasTreasureSim = false;

    for (const step of puzzle.solution) {
      if (!demoRef.current) break;
      if (step.isEnvironmentAction) {
        if (step.isBoatTrade) {
          currentPath.push({ x: 50, y: 18, depth: 3, zone: 1 });
          setPathHistory([...currentPath]);
          setFlyingItem({ itemId: step.itemId, emoji: level.items.find(i => i.id === step.itemId)?.emoji || '', x: 50, y: 16 });
          await new Promise<void>(r => scheduleTimeout(r, ACTION_ANIM_MS));
          if (!demoRef.current) break;
          setFlyingItem(null);
          if (step.reqItem && currentInv.length >= 4 && currentInv.includes(step.reqItem)) {
            currentInv.splice(currentInv.indexOf(step.reqItem), 1);
          }
        } else if (step.itemId === 'fish') {
          setEnvItemState('caught');
          setEnvItemCaughtPos({ x: 50, y: 53 });
          await new Promise<void>(r => scheduleTimeout(r, ACTION_ANIM_MS));
          if (!demoRef.current) break;
          setEnvItemState('hidden');
        } else {
          setFlyingItem({ itemId: step.itemId, emoji: level.items.find(i => i.id === step.itemId)?.emoji || '', x: 50, y: 19 });
          await new Promise<void>(r => scheduleTimeout(r, ACTION_ANIM_MS));
          if (!demoRef.current) break;
          setFlyingItem(null);
        }
        if (step.itemId) {
          currentInv.push(step.itemId);
        }
        setInventory([...currentInv]);
        await new Promise<void>(r => scheduleTimeout(r, 400));
        continue;
      }

      const entity = puzzle.puzzleEntities.find(e => e.id === step.entityId);
      if (!entity) continue;

      let waypoints: Waypoint[] = [];
      let demoWalkPath: Point2D[] | null = null;
      if (useIsotropic && puzzle.geometry) {
        const simSegs = getProceduralObstacleSegments(puzzle.puzzleEntities, puzzle.geometry, currentDefeated);
        const startPos = currentPath[currentPath.length - 1];
        let goalX = entity.x;
        let goalY = entity.y;
        if (entity.collarBounds) {
          const cb = entity.collarBounds;
          if (cb.orientation === 'vertical') {
            goalY = (cb.yTop + cb.yBottom) / 2;
            goalX = startPos.x <= entity.x ? (cb.xLeft - 4.0) : (cb.xRight + 4.0);
          } else {
            goalX = (cb.xLeft + cb.xRight) / 2;
            goalY = startPos.y <= entity.y ? (cb.yTop - 4.0) : (cb.yBottom + 4.0);
          }
        } else {
          const dx = goalX - startPos.x;
          const dy = goalY - startPos.y;
          const d = Math.hypot(dx, dy);
          if (d > DEEP_CAVE_HERO_RADIUS + 1.5) {
            goalX -= (dx / d) * (DEEP_CAVE_HERO_RADIUS + 1.5);
            goalY -= (dy / d) * (DEEP_CAVE_HERO_RADIUS + 1.5);
          }
        }
        demoWalkPath = findGlobalPath(
          startPos,
          { x: goalX, y: goalY },
          simSegs,
          { width: 100, height: worldHeight },
          puzzle.geometry.obstaclePolygons || [],
          2.5,
          { radius: DEEP_CAVE_HERO_RADIUS, maxIters: 25000, cornerClearance: 1.5 }
        );
      } else if (level.mechanics.hasWalls && level.getObstacleSegments) {
        const simSegs = level.getObstacleSegments(
          puzzle.puzzleEntities,
          Array.from(unlockedZonesSim),
          currentDefeated,
          screens,
          puzzle.geometry,
          transformedSim
        );
        const startPos = currentPath[currentPath.length - 1];
        const dx = entity.x - startPos.x;
        const dy = entity.y - startPos.y;
        const d = Math.hypot(dx, dy);
        let goalX = entity.x;
        let goalY = entity.y;
        if (d > 3.5) {
          goalX -= (dx / d) * 3.5;
          goalY -= (dy / d) * 3.5;
        }
        const isCompact2DWorld = !useIsotropic && worldHeight <= 120;
        const rawDemoPath = findGlobalPath(
          { x: startPos.x, y: startPos.y * yScale },
          { x: goalX, y: goalY * yScale },
          simSegs,
          { width: 100, height: worldHeight },
          [],
          isCompact2DWorld ? 1.5 : 3,
          isCompact2DWorld ? { radius: 1.4, maxIters: 20000, cornerClearance: 0.9 } : {}
        );
        demoWalkPath = rawDemoPath.map(p => ({ x: p.x, y: p.y / yScale }));
      } else {
        waypoints = computeWaypoints(currentZoneSim, entity.zone);
      }

      for (const wp of waypoints) {
        if (!demoRef.current) break;
        currentPath.push(wp);
        setPathHistory([...currentPath]);
        currentZoneSim = wp.zone;
        await new Promise<void>(r => scheduleTimeout(r, 400));
      }

      if (demoWalkPath && demoWalkPath.length > 0) {
        for (const wp of demoWalkPath) {
          if (!demoRef.current) break;
          currentPath.push({ x: wp.x, y: wp.y, depth: entity.depth || 3, zone: entity.zone });
          setPathHistory([...currentPath]);
          await new Promise<void>(r => scheduleTimeout(r, 280));
        }
        currentZoneSim = entity.zone;
      }

      await new Promise<void>(r => scheduleTimeout(r, 600));
      if (!demoRef.current) break;

      if (step.reqType === 'AND') {
        setSelectedItemTypes(Array.from(new Set(step.usedItems || [])));
      } else if (step.itemId) {
        setSelectedItemTypes([step.itemId]);
      }

      await new Promise<void>(r => scheduleTimeout(r, 600));
      if (!demoRef.current) break;

      if (!demoWalkPath) {
        const lastSimPos = currentPath[currentPath.length - 1];
        const prevPoint = waypoints.length > 0 ? waypoints[waypoints.length - 1] : lastSimPos;
        let targetX = (entity.roamClass && !entity.roamClass.includes('elevator')) ? 50 : entity.x;
        let targetY = entity.y;

        if (!entity.roamClass) {
          const dx = targetX - prevPoint.x;
          const dy = targetY - prevPoint.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > 0) {
            targetX = targetX - (dx / dist) * 3.5;
            targetY = targetY - (dy / dist) * 3.5;
          }
        }

        currentPath.push({ x: targetX, y: targetY, depth: entity.depth || 3, zone: entity.zone });
        setPathHistory([...currentPath]);
        currentZoneSim = entity.zone;
      }
      await new Promise<void>(r => scheduleTimeout(r, ACTION_ANIM_MS));
      if (!demoRef.current) break;

      if (step.reqType === 'AND') {
        (step.usedItems || []).forEach(req => {
          const idx = currentInv.indexOf(req);
          if (idx > -1) currentInv.splice(idx, 1);
        });
      } else if (step.itemId) {
        const idx = currentInv.indexOf(step.itemId);
        if (idx > -1) currentInv.splice(idx, 1);
      }

      setInventory([...currentInv]);
      setSelectedItemTypes([]);

      if (entity.id === 'sea_witch') {
        transformedSim = level.id === 'shipwreck' ? false : !transformedSim;
        setIsTransformed(transformedSim);
      }
      if (entity.isGoal && level.mechanics.hasTransformation) {
        hasTreasureSim = true;
        setHasDeepTreasure(true);
      }

      if (entity.reward) {
        const entityX = entity.roamClass ? 50 : entity.x;
        const rewardDef = level.items.find(i => i.id === entity.reward);
        setFlyingItem({ itemId: rewardDef?.spriteId || entity.reward, spriteSrc: rewardDef?.spriteSrc, emoji: rewardDef?.emoji || '', x: entityX, y: entity.y });
        await new Promise<void>(r => scheduleTimeout(r, ACTION_ANIM_MS));
        if (!demoRef.current) break;
        setFlyingItem(null);
        currentInv.push(entity.reward);
        setInventory([...currentInv]);
      }

      if (entity.id !== 'sea_witch') {
        currentDefeated.push(entity.id);
        setDefeated([...currentDefeated]);
      }
      setSelectedEntityId(null);

      if (entity.isGatekeeper && entity.unlocksZones) {
        entity.unlocksZones.forEach(z => unlockedZonesSim.add(z));
        unlockedZonesSim.add(entity.zone);
        setUnlockedZones(Array.from(unlockedZonesSim));
      }

      if (entity.id === puzzle.goalEntityId && (!level.mechanics.hasTransformation || level.mechanics.startsTransformed)) {
        if (level.mechanics.isCaveType) {
          const allTreasures = puzzle.puzzleEntities.filter(t => t.isTreasure);
          setMassFlyingTreasures(allTreasures.map((t, idx) => ({ itemId: t.reward || t.id, spriteSrc: t.spriteSrc, emoji: t.emoji || '💎', x: t.x, y: t.y, delay: idx * 150 })));
          currentDefeated.push(...allTreasures.map(t => t.id));
          setDefeated([...currentDefeated]);
          await new Promise<void>(r => scheduleTimeout(r, ACTION_ANIM_MS));
          setMassFlyingTreasures([]);
        }
        triggerVictory();
      } else if (level.mechanics.hasTransformation && !level.mechanics.startsTransformed && hasTreasureSim && !transformedSim && step.isReturnTrip) {
        currentPath.push({ x: level.campPos.x, y: level.campPos.y, depth: 3, zone: 1 });
        setPathHistory([...currentPath]);
        await new Promise<void>(r => scheduleTimeout(r, ACTION_ANIM_MS));
        triggerVictory();
      }
    }
    setIsDemonstrating(false);
    demoRef.current = false;
  };

  const spookFishById = useCallback((fishId: string | number) => {
    const now = Date.now();
    let nextSpookedDuration = 4000;
    const nextList = schoolsOfFishRef.current.map(f => {
      if (f.id !== fishId) return f;
      const spooked = createSpookedFishState(f, now);
      nextSpookedDuration = ((spooked.speed || 3) * 1000) + 400;
      return spooked;
    });
    schoolsOfFishRef.current = nextList;
    setSchoolsOfFish(nextList);

    const key = String(fishId);
    if (fishCleanupTimersRef.current[key]) {
      clearTimeout(fishCleanupTimersRef.current[key]);
    }
    fishCleanupTimersRef.current[key] = scheduleTimeout(() => {
      delete fishCleanupTimersRef.current[key];
      setSchoolsOfFish(prev => {
        const filtered = prev.filter(f => f.id !== fishId);
        schoolsOfFishRef.current = filtered;
        return filtered;
      });
    }, nextSpookedDuration);
  }, [scheduleTimeout]);

  const handleConfirmOutOfAir = useCallback((keepItemId: string | null) => {
    if (!outOfAirModal) return;
    if (outOfAirModal.lostAtSea) {
      setOutOfAirModal(null);
      resetGameState();
      return;
    }
    const { nextInventory, droppedFloatingItems } = resolveOutOfAirDrop(
      outOfAirModal.items,
      keepItemId,
      outOfAirModal.dropPos,
      Date.now(),
      getOutOfAirDropBounds(level)
    );

    inventoryRef.current = nextInventory;
    setInventory(nextInventory);
    if (droppedFloatingItems.length > 0) {
      setCampItems(prev => [...prev, ...droppedFloatingItems]);
    }
    setSelectedItemTypes([]);
    setOutOfAirModal(null);

    if (dolphinStateRef.current === 'idle_deep') {
      startDolphinReturn(false);
    }
    setAttachedEntityId(null);
    setIsAnimatingLoot(true);

    const curPos = stateRefs.current.pathHistory[stateRefs.current.pathHistory.length - 1] || level.campPos;
    const startPos: Point2D = { x: curPos.x, y: curPos.y };
    const shipwreckResolution = level.id === 'shipwreck'
      ? resolveShipwreckDrowningTarget(outOfAirModal.dropPos)
      : null;
    const targetNode = shipwreckResolution?.targetPos || { ...level.campPos, zone: 1 };
    const precomputedReturnPath = level.id === 'shipwreck'
      ? navigateTo(targetNode.x, targetNode.y, targetNode.zone, 3, false)
      : [];
    const floatWaypoints: Point2D[] = [
      startPos,
      ...(precomputedReturnPath.length > 0 ? precomputedReturnPath : [targetNode])
    ];
    const segLengths = floatWaypoints.slice(1).map((pt, idx) =>
      Math.hypot(pt.x - floatWaypoints[idx].x, pt.y - floatWaypoints[idx].y)
    );
    const totalLen = segLengths.reduce((sum, d) => sum + d, 0);

    const startTime = performance.now();
    let lastRenderTime = 0;
    let lastBubbleStep = -1;
    let splashFired = false;

    if (drowningRafRef.current) {
      cancelAnimationFrame(drowningRafRef.current);
      drowningRafRef.current = 0;
    }
    setDrowningFloatPos(startPos);

    const stepAscent = () => {
      const now = performance.now();
      const elapsed = now - startTime;
      const progress = Math.min(1, Math.max(0, elapsed / DROWNING_RETURN_DELAY_MS));
      const ease = 0.5 - Math.cos(Math.PI * progress) / 2;

      const shouldCommitFrame = now - lastRenderTime >= 40 || progress >= 1;
      if (shouldCommitFrame) {
        lastRenderTime = now;
        let curX: number;
        let curY: number;
        if (level.id === 'shipwreck' && totalLen > 0) {
          let remaining = ease * totalLen;
          let segIdx = 0;
          while (segIdx < segLengths.length - 1 && remaining > segLengths[segIdx]) {
            remaining -= segLengths[segIdx];
            segIdx++;
          }
          const segD = Math.max(0.0001, segLengths[segIdx] || 1);
          const t = Math.min(1, Math.max(0, remaining / segD));
          const a = floatWaypoints[segIdx];
          const b = floatWaypoints[segIdx + 1] || a;
          curX = a.x + (b.x - a.x) * t;
          curY = a.y + (b.y - a.y) * t;
          if (!splashFired && isInShipwreckAirPocket(curX, curY)) {
            splashFired = true;
            triggerWaterSplash(Math.max(68, Math.min(91, curX)), AIR_POCKET_Y, 'normal');
          }
        } else {
          const swayX = Math.sin(progress * Math.PI * 3.5) * 4.5 * Math.sin(progress * Math.PI);
          curX = Math.max(10, Math.min(90, startPos.x + (targetNode.x - startPos.x) * ease + swayX));
          curY = startPos.y + (targetNode.y - startPos.y) * ease;
          if (!splashFired && !isHeroSubmerged(level, { x: curX, y: curY })) {
            splashFired = true;
            maybeTriggerWaterSplash(startPos, { x: curX, y: curY });
          }
        }

        setDrowningFloatPos({ x: curX, y: curY });

        const bubbleStep = Math.floor(progress * 5);
        if (bubbleStep > lastBubbleStep && progress < 0.92) {
          lastBubbleStep = bubbleStep;
          triggerAirLossBubbles(curX, curY, true, 6);
        }
      }

      if (progress < 1) {
        drowningRafRef.current = requestAnimationFrame(stepAscent);
      } else {
        drowningRafRef.current = 0;
      }
    };

    if (typeof requestAnimationFrame === 'function') {
      drowningRafRef.current = requestAnimationFrame(stepAscent);
    }

    scheduleTimeout(() => {
      if (drowningRafRef.current) {
        cancelAnimationFrame(drowningRafRef.current);
        drowningRafRef.current = 0;
      }
      setDrowningFloatPos(null);
      const returnPath = level.id === 'shipwreck'
        ? precomputedReturnPath
        : navigateTo(targetNode.x, targetNode.y, targetNode.zone, 3, false);
      const nextCampPoint = returnPath.length > 0
        ? returnPath
        : [{ x: targetNode.x, y: targetNode.y, depth: 3, zone: targetNode.zone }];
      setPathHistory(prev => [...prev, ...nextCampPoint]);
      setIsAnimatingLoot(false);
      setAlertEntityId(null);
      setIsRefillingAir(true);
    }, DROWNING_RETURN_DELAY_MS);
  }, [outOfAirModal, startDolphinReturn, navigateTo, level, scheduleTimeout, triggerAirLossBubbles, triggerWaterSplash, maybeTriggerWaterSplash]);

  const handleResolveFishingCatch = useCallback((caught: boolean) => {
    const active = fishingCatch;
    setFishingCatch(null);
    if (!active) {
      setIsAnimatingLoot(false);
      return;
    }

    const updatedFish = schoolsOfFishRef.current.filter(f => f.id !== active.fish.id);
    schoolsOfFishRef.current = updatedFish;
    setSchoolsOfFish(updatedFish);

    let nextInv = inventoryRef.current;
    if (caught) {
      nextInv = [...inventoryRef.current, active.fish.type];
      inventoryRef.current = nextInv;
      setInventory(nextInv);
    }

    setIsAnimatingLoot(false);
    handlePostActionAir(active.targetPos.y, false, {
      nextInventory: nextInv,
      wasFullBeforeMove: active.wasFullBeforeMove,
      dropPos: active.targetPos
    });
  }, [fishingCatch, handlePostActionAir]);

  const handleFlushKelp = useCallback((habitat: ReefKelpHabitat, e: MouseEvent) => {
    e.stopPropagation();
    if (isVictorious || isDemonstrating || isAnimatingLoot || isRefillingAir || alertEntityId === 'out_of_air' || outOfAirModal || fishingCatch) {
      return;
    }
    const now = Date.now();
    if (now - (kelpCooldownsRef.current[habitat.id] || 0) < 2500) return;
    kelpCooldownsRef.current[habitat.id] = now;

    setRustlingKelpId(habitat.id);
    scheduleTimeout(() => {
      setRustlingKelpId(prev => (prev === habitat.id ? null : prev));
    }, 600);

    const id = `kelp_fish_${fishUidRef.current++}`;
    const speed = habitat.fishType === 'fish' ? 12 : habitat.fishType === 'gold_fish' ? 10 : 12;
    const isRight = habitat.x < 50;
    const startX = habitat.x;
    const endX = isRight ? 115 : -15;
    const yPos = Math.max(18, Math.min(habitat.fishType === 'blowfish' ? 92 : 62, habitat.y));

    const flushedFish: SchoolFishState = {
      id,
      type: habitat.fishType,
      y: yPos,
      depth: 3,
      isRight,
      speed,
      spawnTime: now,
      startX,
      endX,
      isSpooked: false,
      spookCount: 0
    };

    setSchoolsOfFish(prev => {
      const next = [...prev.slice(-11), flushedFish];
      schoolsOfFishRef.current = next;
      return next;
    });
    fishCleanupTimersRef.current[String(id)] = scheduleTimeout(() => {
      delete fishCleanupTimersRef.current[String(id)];
      setSchoolsOfFish(prev => {
        const next = prev.filter(f => f.id !== id);
        schoolsOfFishRef.current = next;
        return next;
      });
    }, Math.round(speed * 1000) + 400);
  }, [isVictorious, isDemonstrating, isAnimatingLoot, isRefillingAir, alertEntityId, outOfAirModal, fishingCatch, scheduleTimeout]);

  useEffect(() => {
    if (!isRefillingAir) return;
    const timer = setInterval(() => {
      setAir(prev => {
        if (prev >= maxAir - 1) {
          clearInterval(timer);
          setIsRefillingAir(false);
          airRef.current = maxAir;
          return maxAir;
        }
        const nextVal = prev + 1;
        airRef.current = nextVal;
        return nextVal;
      });
    }, AIR_REFILL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [isRefillingAir, maxAir]);

  const handleCatchRiverFish = (e: MouseEvent) => {
    e.stopPropagation();
    if (outOfAirModal || alertEntityId === 'out_of_air') return;
    const { fits } = canFitInInventory(inventoryRef.current, [], 'fish');
    if (!fits) {
      triggerInventoryFullAlert('river_fish');
      return;
    }
    if (envItemState !== 'active' || isDemonstrating || isAnimatingLoot || isRefillingAir) return;
    const parentRect = e.currentTarget.parentElement?.getBoundingClientRect();
    if (!parentRect) return;
    saveHistory();
    setEnvItemCaughtPos({ x: ((e.clientX - parentRect.left) / parentRect.width) * 100, y: ((e.clientY - parentRect.top) / parentRect.height) * 100 });
    setEnvItemState('caught');
    scheduleTimeout(() => {
      setEnvItemState('hidden');
      const nextInv = [...inventoryRef.current, 'fish'];
      inventoryRef.current = nextInv;
      setInventory(nextInv);
      handlePostActionAir(53, false, { nextInventory: nextInv });
    }, ACTION_ANIM_MS);
  };

  const handleCatchSchoolFish = (e: MouseEvent, fishObj: SchoolFishState) => {
    e.stopPropagation();
    if (outOfAirModal || fishingCatch || alertEntityId === 'out_of_air') return;
    const { fits } = canFitInInventory(inventoryRef.current, [], fishObj.type);
    if (!fits) {
      triggerInventoryFullAlert('school_fish');
      return;
    }
    if (isDemonstrating || isAnimatingLoot || isRefillingAir) return;
    if (!mapRef.current) return;

    if (fishingMode === 'timing_ring') {
      const rect = mapRef.current.getBoundingClientRect();
      const wasFullBeforeMove = isHeavyDivingLoad(level, inventoryRef.current, isTransformedRef.current);
      const swimDuration = isDivingLevel(level)
        ? getDivingMoveDurationMs(level, 650, inventoryRef.current, isTransformedRef.current, wasFullBeforeMove)
        : 700;
      setMoveDurationMs(swimDuration);

      saveHistory(); setIsAnimatingLoot(true);
      const currentZone = pathHistory[pathHistory.length - 1].zone || 1;
      const startPos = pathHistory[pathHistory.length - 1];
      triggerAirLossBubbles(startPos.x, startPos.y, wasFullBeforeMove);
      const rawTargetX = ((e.clientX - rect.left) / rect.width) * 100;
      const targetX = Math.max(10, Math.min(90, rawTargetX));
      const targetY = fishObj.y;
      maybeTriggerWaterSplash(startPos, { x: targetX, y: targetY });
      setPathHistory(prev => [...prev, { x: targetX, y: targetY, depth: fishObj.depth, zone: currentZone }]);
      scheduleTimeout(() => {
        setFishingCatch({
          fish: fishObj,
          wasFullBeforeMove,
          targetPos: { x: targetX, y: targetY }
        });
      }, swimDuration);
      return;
    }

    // Spatial Chase Mode ('chase'):
    // Clicking a distant fish startles it into a guaranteed miss; swim ahead into its path and grab it up close!
    const clickRefEl = innerMapRef.current || mapRef.current;
    const rect = clickRefEl.getBoundingClientRect();
    const wasFullBeforeMove = isHeavyDivingLoad(level, inventoryRef.current, isTransformedRef.current);
    const startPos = pathHistory[pathHistory.length - 1];
    const currentZone = startPos.zone || 1;
    const now = Date.now();
    const liveFishPos = getSchoolFishPosition(fishObj, now);
    const rawTargetX = rect.width > 0
      ? ((e.clientX - rect.left) / rect.width) * 100
      : liveFishPos.x;
    const targetX = Math.max(10, Math.min(90, Number.isFinite(rawTargetX) ? rawTargetX : 50));
    const maxFishY = fishObj.type === 'blowfish' ? 94 : 66;
    const targetY = Math.max(14, Math.min(maxFishY, liveFishPos.y));

    const dist = Math.hypot(targetX - startPos.x, targetY - startPos.y);
    const baseDuration = Math.min(800, Math.max(250, Math.round(dist * 35)));
    const swimDuration = getDivingMoveDurationMs(level, baseDuration, inventoryRef.current, isTransformedRef.current, wasFullBeforeMove);
    setMoveDurationMs(swimDuration);

    const targetPos = { x: targetX, y: targetY };
    const isMerman = isTransformedRef.current;
    const canGrab = canDirectGrabFish(fishObj, startPos, now, isMerman);

    if (!canGrab) {
      spookFishById(fishObj.id);
    }

    saveHistory();
    setIsAnimatingLoot(true);
    triggerAirLossBubbles(startPos.x, startPos.y, wasFullBeforeMove);
    maybeTriggerWaterSplash(startPos, targetPos);
    setPathHistory(prev => [...prev, { x: targetX, y: targetY, depth: fishObj.depth || 3, zone: currentZone }]);

    scheduleTimeout(() => {
      const arrivalNow = Date.now();
      let caughtFish: SchoolFishState | null = null;
      if (canGrab) {
        const live = schoolsOfFishRef.current.find(f => f.id === fishObj.id);
        caughtFish = live ? findInterceptedFish([live], targetPos, arrivalNow, isMerman) : null;
      }
      let nextInv = inventoryRef.current;

      if (caughtFish) {
        const catchFit = canFitInInventory(inventoryRef.current, [], caughtFish.type);
        if (!catchFit.fits) {
          setIsAnimatingLoot(false);
          triggerInventoryFullAlert('school_fish');
          handlePostActionAir(targetY, false, { wasFullBeforeMove, dropPos: targetPos });
          return;
        }

        const cKey = String(caughtFish.id);
        if (fishCleanupTimersRef.current[cKey]) {
          clearTimeout(fishCleanupTimersRef.current[cKey]);
          delete fishCleanupTimersRef.current[cKey];
        }
        const remainingFish = schoolsOfFishRef.current.filter(f => f.id !== caughtFish.id);
        schoolsOfFishRef.current = remainingFish;
        setSchoolsOfFish(remainingFish);

        nextInv = [...inventoryRef.current, caughtFish.type];
        inventoryRef.current = nextInv;
        setInventory(nextInv);

        const fishDef = level.items.find(i => i.id === caughtFish.type);
        const fishEmoji = fishDef?.emoji || '🐟';
        setFlyingItem({ itemId: fishDef?.spriteId || caughtFish.type, spriteSrc: fishDef?.spriteSrc, emoji: fishEmoji, x: targetX, y: targetY, zIndex: 90 });
        scheduleTimeout(() => setFlyingItem(null), Math.round(ACTION_ANIM_MS * 0.6));
      } else {
        const missId = Date.now();
        setClickIndicator({ x: targetX, y: targetY, isValid: false, id: missId });
        scheduleTimeout(() => setClickIndicator(prev => prev?.id === missId ? null : prev), 550);
      }

      setIsAnimatingLoot(false);
      handlePostActionAir(targetY, false, {
        nextInventory: nextInv,
        wasFullBeforeMove,
        dropPos: targetPos
      });
    }, swimDuration);
  };

  const handleBoatTrade = (e: MouseEvent, boat: RoamingBoatState) => {
    e.stopPropagation();
    if (outOfAirModal || fishingCatch || alertEntityId === 'out_of_air') return;
    const tradeReq = boat.reqItem || 'fish';
    const { fits } = canFitInInventory(inventoryRef.current, [tradeReq], boat.offeredItem);

    if (inventoryRef.current.includes(tradeReq) && !fits) {
      triggerInventoryFullAlert(boat.id);
      return;
    }

    if (!inventoryRef.current.includes(tradeReq) || !fits || isDemonstrating || isAnimatingLoot || isRefillingAir) {
      setAlertEntityId(boat.id);
      scheduleTimeout(() => setAlertEntityId(null), ALERT_DURATION_MS);
      return;
    }
    const wasFullBeforeMove = isHeavyDivingLoad(level, inventoryRef.current, isTransformedRef.current);
    const swimDuration = isDivingLevel(level)
      ? getDivingMoveDurationMs(level, 650, inventoryRef.current, isTransformedRef.current, wasFullBeforeMove)
      : 700;
    setMoveDurationMs(swimDuration);

    saveHistory(); setIsAnimatingLoot(true);
    const startPos = pathHistory[pathHistory.length - 1];
    triggerAirLossBubbles(startPos.x, startPos.y, wasFullBeforeMove);
    const elapsed = Date.now() - (boat.spawnTime || Math.floor(boat.id));
    const progress = Math.min(1, Math.max(0, elapsed / 20000));
    const boatX = boat.isRight ? (-20 + progress * 140) : (120 - progress * 140);
    const clampedBoatX = Math.max(10, Math.min(90, boatX));
    maybeTriggerWaterSplash(startPos, { x: clampedBoatX, y: 19 });
    setPathHistory(prev => [...prev, { x: clampedBoatX, y: 19, depth: 3, zone: 1 }]);

    scheduleTimeout(() => {
      const nextInv = [...inventoryRef.current];
      const idx = nextInv.indexOf(tradeReq);
      if (idx > -1) nextInv.splice(idx, 1);
      nextInv.push(boat.offeredItem);
      inventoryRef.current = nextInv;
      setInventory(nextInv);

      setRoamingBoats(prev => prev.filter(b => b.id !== boat.id));
      const offeredDef = level.items.find(i => i.id === boat.offeredItem);
      setFlyingItem({ itemId: offeredDef?.spriteId || boat.offeredItem, spriteSrc: offeredDef?.spriteSrc, emoji: offeredDef?.emoji || '', x: clampedBoatX, y: 19 });
      scheduleTimeout(() => {
        setFlyingItem(null);
        setIsAnimatingLoot(false);
        handlePostActionAir(19, false, { nextInventory: nextInv, wasFullBeforeMove });
      }, ACTION_ANIM_MS);
    }, swimDuration);
  };

  const handleCampClick = (e: MouseEvent) => {
    if (outOfAirModal || fishingCatch || alertEntityId === 'out_of_air') return;
    const itemToDrop = selectedItemTypes[0];
    if (!itemToDrop && !level.mechanics.hasAir) return;

    e.stopPropagation();
    if (isVictorious || isDemonstrating || isAnimatingLoot || isRefillingAir) return;

    const wasFullBeforeMove = isHeavyDivingLoad(level, inventoryRef.current, isTransformedRef.current);
    const swimDuration = isDivingLevel(level)
      ? getDivingMoveDurationMs(level, 650, inventoryRef.current, isTransformedRef.current, wasFullBeforeMove)
      : ACTION_ANIM_MS;
    if (isDivingLevel(level)) setMoveDurationMs(swimDuration);

    if (dolphinStateRef.current === 'idle_deep') {
      startDolphinReturn(false);
    }
    setAttachedEntityId(null);
    saveHistory();
    setIsAnimatingLoot(true);

    let newPath = navigateTo(effectiveCampPos.x, effectiveCampPos.y, 1, effectiveCampPos.depth || 3, false);
    if (!newPath || newPath.length === 0) {
      newPath = [{ x: effectiveCampPos.x, y: effectiveCampPos.y, depth: effectiveCampPos.depth || 3, zone: 1 }];
    }
    const lastPos = pathHistory[pathHistory.length - 1];
    const finalPos = newPath[newPath.length - 1];

    if (lastPos && finalPos && (lastPos.x !== finalPos.x || lastPos.y !== finalPos.y)) {
      triggerAirLossBubbles(lastPos.x, lastPos.y, wasFullBeforeMove);
      maybeTriggerWaterSplash(lastPos, finalPos);
    }

    setPathHistory(prev => {
      if (lastPos && finalPos && lastPos.x === finalPos.x && lastPos.y === finalPos.y) return prev;
      return [...prev, ...newPath];
    });

    scheduleTimeout(() => {
      let nextInv = inventoryRef.current;
      if (itemToDrop) {
        nextInv = [...inventoryRef.current];
        const idx = nextInv.indexOf(itemToDrop);
        if (idx > -1) nextInv.splice(idx, 1);
        inventoryRef.current = nextInv;
        setInventory(nextInv);
        const offsetX = effectiveCampPos.x + (Math.random() * 14 - 7);
        const offsetY = effectiveCampPos.y + (useIsotropic ? (Math.random() * 8 + 4) : (Math.random() * 8 - 4));
        setCampItems(prev => [...prev, { id: itemToDrop, x: offsetX, y: offsetY, uid: Date.now() + Math.random() }]);
        setSelectedItemTypes([]);
      }
      setIsAnimatingLoot(false);
      if (level.mechanics.hasAir) {
        airRef.current = maxAir;
        setAir(maxAir);
      }
      if (level.id === 'underwater' && !isTransformedRef.current && hasDeepTreasure && hasTransformedOnceRef.current && nextInv.includes('crown')) {
        triggerVictory();
      }
    }, swimDuration);
  };

  const handleCampItemClick = (e: MouseEvent, campItem: CampItemState) => {
    e.stopPropagation();
    if (isVictorious || isDemonstrating || isAnimatingLoot || isRefillingAir || alertEntityId === 'out_of_air' || outOfAirModal || fishingCatch) return;

    const { fits } = canFitInInventory(inventoryRef.current, [], campItem.id);
    if (!fits) {
      triggerInventoryFullAlert(campItem.uid);
      return;
    }

    const wasFullBeforeMove = isHeavyDivingLoad(level, inventoryRef.current, isTransformedRef.current);
    const swimDuration = isDivingLevel(level)
      ? getDivingMoveDurationMs(level, 650, inventoryRef.current, isTransformedRef.current, wasFullBeforeMove)
      : ACTION_ANIM_MS;
    if (isDivingLevel(level)) setMoveDurationMs(swimDuration);

    if (dolphinStateRef.current === 'idle_deep') {
      startDolphinReturn(false);
    }
    setAttachedEntityId(null);
    saveHistory();
    setIsAnimatingLoot(true);

    const currentZone = pathHistory[pathHistory.length - 1]?.zone || 1;
    const targetZone = inferTargetZone(level, campItem.x, campItem.y, currentZone);
    let newPath = navigateTo(campItem.x, campItem.y, targetZone, level.campPos.depth || 3, false);
    if (!newPath || newPath.length === 0) {
      newPath = [{ x: campItem.x, y: campItem.y, depth: level.campPos.depth || 3, zone: targetZone }];
    }
    const lastPos = pathHistory[pathHistory.length - 1];
    const finalPos = newPath[newPath.length - 1];

    if (lastPos && finalPos && (lastPos.x !== finalPos.x || lastPos.y !== finalPos.y)) {
      triggerAirLossBubbles(lastPos.x, lastPos.y, wasFullBeforeMove);
      maybeTriggerWaterSplash(lastPos, finalPos);
    }

    setPathHistory(prev => {
      if (lastPos && finalPos && lastPos.x === finalPos.x && lastPos.y === finalPos.y) return prev;
      return [...prev, ...newPath];
    });

    scheduleTimeout(() => {
      setCampItems(prev => prev.filter(i => i.uid !== campItem.uid));
      const nextInv = [...inventoryRef.current, campItem.id];
      inventoryRef.current = nextInv;
      setInventory(nextInv);
      setIsAnimatingLoot(false);
      if (level.mechanics.hasAir) {
        handlePostActionAir(campItem.y, false, {
          nextInventory: nextInv,
          wasFullBeforeMove,
          dropPos: { x: finalPos.x, y: finalPos.y }
        });
      }
    }, swimDuration);
  };

  const triggerAirPocketBlocked = useCallback(() => {
    setSelectedItemTypes([]);
    setSelectedEntityId(null);
    const curPos = pathHistory[pathHistory.length - 1];
    if (curPos && curPos.y > AIR_POCKET_Y + 1) {
      const approachPath = navigateTo(80, 37, 4, 3, false);
      if (approachPath && approachPath.length > 0) {
        setPathHistory(prev => [...prev, ...approachPath]);
      }
    }
    triggerWaterSplash(80, AIR_POCKET_Y, 'bounce');
    setAlertEntityId('air_pocket_blocked');
    scheduleTimeout(() => {
      setAlertEntityId(prev => (prev === 'air_pocket_blocked' ? null : prev));
    }, 1800);
  }, [pathHistory, navigateTo, scheduleTimeout, triggerWaterSplash]);

  const handleCellClick = async (e: MouseEvent, targetX: number, targetY: number) => {
    e.stopPropagation();
    if (isVictorious || isDemonstrating || isAnimatingLoot || isRefillingAir || alertEntityId === 'out_of_air' || outOfAirModal || fishingCatch) return;

    if (screens > 1 || screensX > 1 || useIsotropic) {
      let isValidClick = true;

      if (level.mechanics.isCaveType && polyPoints) {
        const testPt = { x: targetX, y: targetY * yScale };
        const inLight =
          isPointInVisibilityPolygon(testPt, polyPoints) ||
          extraLightPolygons.some(lp => isPointInVisibilityPolygon(testPt, lp.polygon));
        if (!inLight) {
          isValidClick = false;
        }
      }

      const indicatorId = Date.now();
      setClickIndicator({ x: targetX, y: targetY, isValid: isValidClick, id: indicatorId });
      scheduleTimeout(() => {
        setClickIndicator(prev => prev?.id === indicatorId ? null : prev);
      }, 750);

      if (!isValidClick) return;

      if (level.id === 'shipwreck' && isTransformedRef.current && isInShipwreckAirPocket(targetX, targetY)) {
        triggerAirPocketBlocked();
        return;
      }

      const wasFullBeforeMove = isHeavyDivingLoad(level, inventoryRef.current, isTransformedRef.current);

      if (dolphinStateRef.current === 'idle_deep') {
        startDolphinReturn(false);
      }
      setAttachedEntityId(null);

      const currentZone = pathHistory[pathHistory.length - 1].zone || 1;
      const targetZone = inferTargetZone(level, targetX, targetY, currentZone);

      const newPath = navigateTo(targetX, targetY, targetZone, 3, false);
      if (!newPath || newPath.length === 0) {
        if (level.mechanics.hasWalls) {
          setClickIndicator({ x: targetX, y: targetY, isValid: false, id: indicatorId });
        }
        return;
      }

      saveHistory();

      const startP = pathHistory[pathHistory.length - 1];
      triggerAirLossBubbles(startP.x, startP.y, wasFullBeforeMove);

      setIsAnimatingLoot(true);
      let lastP: Point2D = pathHistory[pathHistory.length - 1];
      const sessionId = ++walkSessionRef.current;

      for (let i = 0; i < newPath.length; i++) {
        if (walkSessionRef.current !== sessionId) return;
        const wp = newPath[i];
        const dx = wp.x - lastP.x;
        const dy = wp.y - lastP.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const baseDuration = Math.min(800, Math.max(useIsotropic ? 180 : 250, Math.round(dist * (useIsotropic ? 14 : 35))));
        const duration = getDivingMoveDurationMs(level, baseDuration, inventoryRef.current, isTransformedRef.current, wasFullBeforeMove);

        maybeTriggerWaterSplash(lastP, wp);

        setMoveDurationMs(duration);
        setPathHistory(prev => [...prev, wp]);
        lastP = wp;

        await new Promise<void>(r => scheduleTimeout(r, duration));
      }

      if (walkSessionRef.current !== sessionId) return;
      setIsAnimatingLoot(false);

      if (level.id === 'underwater' && fishingMode === 'chase') {
        const arrivalNow = Date.now();
        const fishToSpook = schoolsOfFishRef.current.filter(f =>
          shouldSpookFishFromPoint(f, lastP, arrivalNow, isTransformedRef.current)
        );
        fishToSpook.forEach(f => spookFishById(f.id));
      }

      if (level.mechanics.hasAir) {
        handlePostActionAir(targetY, false, { wasFullBeforeMove, dropPos: lastP });
      }
    } else {
      if (level.mechanics.hasAir && Math.abs(targetY - level.campPos.y) < 5) {
        handlePostActionAir(targetY);
      }
    }
  };

  const toggleInventoryType = (itemId: string) => {
    if (isDemonstrating || isRefillingAir || outOfAirModal || fishingCatch) return;
    if (selectedItemTypes.includes(itemId)) setSelectedItemTypes(prev => prev.filter(i => i !== itemId));
    else setSelectedItemTypes(prev => [...prev, itemId]);
  };

  const getCustomEntityMovement = (ent: PuzzleEntity): CustomEntityMovement | null => {
    if (level.id !== 'underwater') return null;
    if (ent.id === 'dolphin_1') {
      const state = dolphinStateRef.current;

      if (state === 'diving') {
        const startY = dolphinAnimRef.current.startY || 22;
        const targetY = dolphinAnimRef.current.targetY || 58;
        const rawProg = Math.min(1, Math.max(0, (dolphinYPos - startY) / Math.max(1, targetY - startY)));
        const waveX = 50 + Math.sin(rawProg * Math.PI * 2.5) * 14;
        const isMovingLeft = Math.cos(rawProg * Math.PI * 2.5) < 0;
        const diveTilt = 28 * (isMovingLeft ? -1 : 1);
        return { x: waveX, y: dolphinYPos, rotate: diveTilt, flip: !isMovingLeft, isActiveMotion: true };
      }

      if (state === 'rising') {
        const startY = dolphinAnimRef.current.startY || 58;
        const targetY = dolphinAnimRef.current.targetY || 22;
        const rawProg = Math.min(1, Math.max(0, (startY - dolphinYPos) / Math.max(1, startY - targetY)));
        const waveX = 50 + Math.sin(rawProg * Math.PI * 2.5) * 14;
        const isMovingLeft = Math.cos(rawProg * Math.PI * 2.5) < 0;
        const riseTilt = -28 * (isMovingLeft ? -1 : 1);
        return { x: waveX, y: dolphinYPos, rotate: riseTilt, flip: !isMovingLeft, isActiveMotion: true };
      }

      if (state === 'idle_deep') {
        return { x: 50, y: 58, rotate: 0, flip: false, isActiveMotion: false };
      }

      return { x: ent.x || 50, y: ent.y || 22, rotate: 0, flip: false, isActiveMotion: false };
    }
    return null;
  };

  const handleLightBrazier = (brazier: CaveBrazier, e: MouseEvent) => {
    e.stopPropagation();
    if (isVictorious || isDemonstrating || isAnimatingLoot || isRefillingAir || alertEntityId === 'out_of_air' || outOfAirModal || fishingCatch) return;
    if (!puzzle) return;

    if (!unlockedZones.includes(brazier.zone)) {
      const blockingGate = puzzle.puzzleEntities.find(
        ent => ent.isGatekeeper && !defeated.includes(ent.id) && ent.unlocksZones?.includes(brazier.zone)
      );
      setAlertEntityId(blockingGate?.id ?? null);
      scheduleTimeout(() => setAlertEntityId(null), ALERT_DURATION_MS);
      return;
    }

    const newPath = navigateTo(brazier.x, brazier.y, brazier.zone, 3, false);
    if (!newPath || newPath.length === 0) return;

    saveHistory();
    const lastPos = pathHistory[pathHistory.length - 1];
    const finalPos = newPath[newPath.length - 1];
    const moveDist = lastPos && finalPos ? Math.hypot(finalPos.x - lastPos.x, finalPos.y - lastPos.y) : 0;
    setMoveDurationMs(Math.min(700, Math.max(180, Math.round(moveDist * 14))));
    setPathHistory(prev => {
      if (lastPos && finalPos && lastPos.x === finalPos.x && lastPos.y === finalPos.y) return prev;
      return [...prev, ...newPath];
    });
    setLitBraziers(prev => (prev.includes(brazier.id) ? prev : [...prev, brazier.id]));
  };

  const handleInteract = (entity: PuzzleEntity, e: MouseEvent) => {
    e.stopPropagation();
    if (isVictorious || isDemonstrating || isAnimatingLoot || isRefillingAir || alertEntityId === 'out_of_air' || outOfAirModal || fishingCatch) return;
    if (!puzzle) return;

    const wasFullBeforeMove = isHeavyDivingLoad(level, inventoryRef.current, isTransformedRef.current);
    const interactSwimDuration = isDivingLevel(level)
      ? getDivingMoveDurationMs(level, 500, inventoryRef.current, isTransformedRef.current, wasFullBeforeMove)
      : ACTION_ANIM_MS;

    if (attachedEntityId && attachedEntityId !== entity.id) setAttachedEntityId(null);
    if (dolphinStateRef.current === 'idle_deep' && entity.id !== 'dolphin_1') {
      startDolphinReturn(false);
    }

    const isReverseAccess = entity.isGatekeeper && entity.unlocksZones && entity.unlocksZones.some(z => unlockedZones.includes(z));
    let targetY = entity.y;

    if (level.id === 'underwater' && entity.id === 'dolphin_1') {
      const cm = getCustomEntityMovement(entity);
      if (cm) targetY = cm.y;
    }

    if (level.id === 'shipwreck' && isTransformedRef.current && (entity.requiresHuman || isInShipwreckAirPocket(entity.x, targetY))) {
      triggerAirPocketBlocked();
      return;
    }

    const witchEnt = level.mechanics.hasTransformation ? puzzle.puzzleEntities.find(ent => ent.id === 'sea_witch') : null;
    const isBlockedByTransformation = Boolean(level.id !== 'underwater' && !level.mechanics.startsTransformed && witchEnt && !isTransformed && entity.zone > (witchEnt.zone || 2));

    if (isBlockedByTransformation && selectedItemTypes.length === 0) {
      setSelectedEntityId(prev => prev === entity.id ? null : entity.id);
      return;
    }

    if ((level.id !== 'underwater' && level.id !== 'shipwreck' && !unlockedZones.includes(entity.zone) && !isReverseAccess) || isBlockedByTransformation) {
      setSelectedItemTypes([]);
      setSelectedEntityId(prev => prev === entity.id ? null : entity.id);

      const targetAlert = (isBlockedByTransformation && witchEnt)
        ? witchEnt
        : (puzzle.puzzleEntities.filter(ent =>
            ent.isGatekeeper && !defeated.includes(ent.id) &&
            (ent.unlocksZones?.includes(entity.zone) || (ent.zone === entity.zone && ent.unlocksZones?.some(z => unlockedZones.includes(z))))
          ).sort((a, b) => Math.abs(a.y - pathHistory[pathHistory.length - 1].y) - Math.abs(b.y - pathHistory[pathHistory.length - 1].y))[0] || entity);

      if (useIsotropic && !isBlockedByTransformation) {
        setAlertEntityId(targetAlert.id);
        scheduleTimeout(() => {
          setAlertEntityId(null);
        }, ALERT_DURATION_MS);
        return;
      }

      setIsAnimatingLoot(true);

      const prevPoint = pathHistory[pathHistory.length - 1];
      let alertX = (targetAlert.roamClass && !targetAlert.roamClass.includes('elevator')) ? 50 : targetAlert.x;
      let alertY = targetAlert.roamClass?.includes('elevator') ? targetY : targetAlert.y;

      if (!targetAlert.roamClass) {
        const dx = alertX - prevPoint.x;
        const dy = alertY - prevPoint.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 0) {
          alertX = alertX - (dx / dist) * 3.5;
          alertY = alertY - (dy / dist) * 3.5;
        }
      }

      setTempPlayerPos({ x: alertX, y: alertY, depth: 3 });
      scheduleTimeout(() => {
        setAlertEntityId(targetAlert.id);
        scheduleTimeout(() => {
          setAlertEntityId(null);
          setTempPlayerPos(null);
          scheduleTimeout(() => setIsAnimatingLoot(false), 700);
        }, ALERT_DURATION_MS);
      }, 700);
      return;
    }

    const targetX = entity.x;
    const lastPos = pathHistory[pathHistory.length - 1];
    const distToEntity = lastPos ? Math.hypot(targetX - lastPos.x, targetY - lastPos.y) : Infinity;

    const tradeResult = evaluateEntityTrade(inventoryRef.current, entity, selectedItemTypes, {
      levelId: level.id,
      isTransformed: isTransformedRef.current,
      hasDeepTreasure
    });

    // If tapping an entity with no item selected to inspect its requirement bubble, toggle/walk-up to show requirement (no auto-use)
    const isInspectOnly =
      !defeated.includes(entity.id) &&
      !entity.isPreset &&
      !tradeResult.isFreeUnTransform &&
      selectedItemTypes.length === 0 &&
      entity.requires &&
      entity.requires.length > 0;

    const effectiveInspectRadius = getUnderwaterInspectRadius(inventoryRef.current);
    const isWildLit = wildLightSources.some(
      (lp) => Math.hypot(entity.x - lp.x, entity.y - lp.y) <= LANTERNFISH_WILD_LIGHT_RADIUS
    );

    const shouldAllowFreeInspect =
      selectedEntityId === entity.id ||
      ((!isDivingLevel(level) || !UNDERWATER_INSPECT_MOVES_HERO) &&
        (distToEntity <= effectiveInspectRadius || isWildLit));

    if (isInspectOnly && shouldAllowFreeInspect) {
      if (isClamEntity(entity) && selectedEntityId !== entity.id && !buriedEntities.includes(entity.id)) {
        saveHistory();
        setBuriedEntities(prev => (prev.includes(entity.id) ? prev : [...prev, entity.id]));
      }
      setSelectedEntityId(prev => prev === entity.id ? null : entity.id);
      return;
    }

    const isChasm = Boolean(entity.isGatekeeper && entity.gateType === 'chasm');
    const isGuardian = Boolean(entity.isGatekeeper && entity.gateType === 'guardian');
    const isRock = (entity.isGatekeeper && level.mechanics.hasPickaxe && entity.id !== 'final_gate' && !isChasm && !isGuardian) || entity.isExtraRock;
    const occluderType = isRock ? 'rock' : isChasm ? 'chasm' : isGuardian ? 'guardian' : null;
    const newPath = navigateTo(targetX, targetY, entity.zone, 3, true, occluderType, entity.collarBounds || null);
    if (!newPath || newPath.length === 0) return;
    const finalPos = newPath[newPath.length - 1];

    if (isDivingLevel(level) && entity.id !== 'dolphin_1') {
      setMoveDurationMs(interactSwimDuration);
    }

    if (lastPos && finalPos && (lastPos.x !== finalPos.x || lastPos.y !== finalPos.y)) {
      triggerAirLossBubbles(lastPos.x, lastPos.y, wasFullBeforeMove);
      maybeTriggerWaterSplash(lastPos, finalPos);
    }

    setPathHistory(prev => {
      if (lastPos && finalPos && lastPos.x === finalPos.x && lastPos.y === finalPos.y) return prev;
      return [...prev, ...newPath];
    });

    if (defeated.includes(entity.id) || (entity.isVent && selectedItemTypes.length === 0)) {
      if (entity.id === 'dolphin_1') {
        if (dolphinStateRef.current === 'idle_deep' || dolphinYPosRef.current > 40) {
          startDolphinReturn(true);
        } else {
          startDolphinDive();
        }
        return;
      }
      if (entity.roamClass?.includes('elevator')) {
        setAttachedEntityId(entity.id);
      }
      if (level.id === 'underwater' && entity.isVent) {
        setIsAnimatingLoot(true);
        setAnimatingEntities(prev => [...prev, entity.id]);
        scheduleTimeout(() => {
          setIsAnimatingLoot(false);
          setAnimatingEntities(prev => prev.filter(id => id !== entity.id));
          handlePostActionAir(targetY, true, { wasFullBeforeMove, dropPos: finalPos });
        }, interactSwimDuration);
      } else {
        handlePostActionAir(targetY, Boolean(entity.isVent), { wasFullBeforeMove, dropPos: finalPos });
      }
      return;
    }

    if (entity.isPreset && !entity.isGatekeeper) {
      const { fits } = canFitInInventory(inventoryRef.current, [], entity.reward);
      if (entity.reward && !fits) {
        triggerInventoryFullAlert(entity.id);
        return;
      }

      setIsAnimatingLoot(true); saveHistory();

      if (level.mechanics.isCaveType && entity.isTreasure) {
        const allTreasures = puzzle.puzzleEntities.filter(t => t.isTreasure);
        setMassFlyingTreasures(allTreasures.map((t, idx) => ({ emoji: t.emoji || '💎', x: t.x, y: t.y, delay: idx * 150 })));
        setDefeated(prev => [...prev, ...allTreasures.map(t => t.id)]);
        scheduleTimeout(() => {
          triggerVictory();
          setMassFlyingTreasures([]);
          setIsAnimatingLoot(false);
          handlePostActionAir(targetY, false, { wasFullBeforeMove, dropPos: finalPos });
        }, ACTION_ANIM_MS + (allTreasures.length * 150));
        return;
      }

      setAnimatingEntities(prev => [...prev, entity.id]);
      if (!entity.isVent) {
        setDefeated(prev => {
          const newDef = [...prev, entity.id];
          if (level.mechanics.isVertical && entity.isTreasure) {
            const allTreasures = puzzle.puzzleEntities.filter(t => t.isTreasure);
            if (allTreasures.every(t => newDef.includes(t.id))) triggerVictory();
          }
          return newDef;
        });
      }

      if (entity.reward) {
        const rewardId = entity.reward;
        const entityX = (entity.roamClass && !entity.roamClass.includes('elevator')) ? 50 : entity.x;
        const rewardDef = level.items.find(i => i.id === rewardId);
        const rewardEmoji = entity.emoji || rewardDef?.emoji || '';
        setFlyingItem({ itemId: rewardDef?.spriteId || rewardId, spriteSrc: rewardDef?.spriteSrc, emoji: rewardEmoji, x: entityX, y: targetY, zIndex: 60 });
        scheduleTimeout(() => {
          const nextInv = [...inventoryRef.current, rewardId];
          inventoryRef.current = nextInv;
          setInventory(nextInv);
          setFlyingItem(null); setIsAnimatingLoot(false); setAnimatingEntities(prev => prev.filter(id => id !== entity.id));
          handlePostActionAir(targetY, Boolean(entity.isVent), {
            nextInventory: nextInv,
            wasFullBeforeMove,
            dropPos: finalPos
          });
        }, ACTION_ANIM_MS);
      } else {
        setIsAnimatingLoot(false);
        scheduleTimeout(() => setAnimatingEntities(prev => prev.filter(id => id !== entity.id)), ACTION_ANIM_MS);
        handlePostActionAir(targetY, Boolean(entity.isVent), { wasFullBeforeMove, dropPos: finalPos });
      }
      return;
    }

    if (isInspectOnly) {
      saveHistory();
      setSelectedEntityId(entity.id);
      if (isClamEntity(entity) && !buriedEntities.includes(entity.id)) {
        setBuriedEntities(prev => (prev.includes(entity.id) ? prev : [...prev, entity.id]));
      }
      if (isDivingLevel(level)) {
        setIsAnimatingLoot(true);
        scheduleTimeout(() => {
          setIsAnimatingLoot(false);
          handlePostActionAir(targetY, false, { wasFullBeforeMove, dropPos: finalPos });
        }, interactSwimDuration);
      } else {
        handlePostActionAir(targetY, false, { wasFullBeforeMove, dropPos: finalPos });
        setIsAnimatingLoot(false);
      }
      return;
    }

    if (tradeResult.exceedsCapacity) {
      triggerInventoryFullAlert(entity.id);
      return;
    }

    if (tradeResult.canDefeat) {
      const { itemsToConsume } = tradeResult;
      let transformedJustEnded = false;

      if (level.id === 'underwater') {
        if (entity.id === 'sea_witch') {
          if (!isTransformedRef.current) {
            setIsMagicAnimating(true);
            scheduleTimeout(() => setIsMagicAnimating(false), 1500);
            isTransformedRef.current = true;
            setIsTransformed(true);
            hasTransformedOnceRef.current = true;
          } else if (hasDeepTreasure) {
            setIsMagicAnimating(true);
            scheduleTimeout(() => setIsMagicAnimating(false), 1500);
            isTransformedRef.current = false;
            setIsTransformed(false);
            airRef.current = maxAir;
            setAir(maxAir);
            transformedJustEnded = true;
          } else {
            setAlertEntityId(entity.id);
            scheduleTimeout(() => setAlertEntityId(null), ALERT_DURATION_MS);
            return;
          }
        }
        if (entity.isGoal) {
          setHasDeepTreasure(true);
        }
      } else if (level.id === 'shipwreck' && entity.id === 'sea_witch') {
        setIsMagicAnimating(true);
        scheduleTimeout(() => setIsMagicAnimating(false), 1500);
        isTransformedRef.current = false;
        setIsTransformed(false);
        airRef.current = maxAir;
        setAir(maxAir);
        transformedJustEnded = true;
      }

      setIsAnimatingLoot(true); saveHistory();
      if (isClamEntity(entity)) {
        setBuriedEntities(prev => prev.filter(id => id !== entity.id));
      }
      if (!entity.roamClass?.includes('elevator')) {
        setAnimatingEntities(prev => [...prev, entity.id]);
      }

      const postConsumeInv = [...inventoryRef.current];
      itemsToConsume.forEach(itemToDel => {
        const idx = postConsumeInv.indexOf(itemToDel);
        if (idx > -1) postConsumeInv.splice(idx, 1);
      });
      inventoryRef.current = postConsumeInv;
      setInventory(postConsumeInv);

      if (isRock) {
        setBreakingRockIds(prev => ({ ...prev, [entity.id]: true }));
        scheduleTimeout(() => {
          setBreakingRockIds(prev => {
            const copy = { ...prev };
            delete copy[entity.id];
            return copy;
          });
        }, 1000);
      } else if (isChasm) {
        setBridgingChasmIds(prev => ({ ...prev, [entity.id]: true }));
        scheduleTimeout(() => {
          setBridgingChasmIds(prev => {
            const copy = { ...prev };
            delete copy[entity.id];
            return copy;
          });
        }, 900);
      }

      setDefeated(prev => {
        if ((entity.id === 'sea_witch' && level.id === 'underwater') || entity.id === 'dolphin_1') return prev;
        const newDef = [...prev, entity.id];
        if (entity.isGatekeeper && entity.unlocksZones) {
          setUnlockedZones(uz => computeUnlockedZones(uz, entity));
        }
        return newDef;
      });

      if (entity.id === 'dolphin_1') {
        if (dolphinStateRef.current === 'idle_deep' || dolphinYPosRef.current > 40) {
          startDolphinReturn(true);
        } else {
          startDolphinDive();
        }
        setSelectedItemTypes([]); setSelectedEntityId(null);
        return;
      } else if (entity.roamClass?.includes('elevator')) {
        setAttachedEntityId(entity.id);
      }

      setSelectedItemTypes([]); setSelectedEntityId(null);

      const postActionDelay = isDivingLevel(level) ? Math.max(ACTION_ANIM_MS, interactSwimDuration) : ACTION_ANIM_MS;
      const refillsMaxAir = shouldRefillAirOnTrade(entity, transformedJustEnded);

      if (entity.reward) {
        const rewardId = entity.reward;
        const entityX = (entity.roamClass && !entity.roamClass.includes('elevator')) ? 50 : entity.x;
        const rewardDef = level.items.find(i => i.id === rewardId);
        setFlyingItem({ itemId: rewardDef?.spriteId || rewardId, spriteSrc: rewardDef?.spriteSrc, emoji: rewardDef?.emoji || '', x: entityX, y: targetY, zIndex: 60 });
        scheduleTimeout(() => {
          const nextInv = [...inventoryRef.current, rewardId];
          inventoryRef.current = nextInv;
          setInventory(nextInv);
          setFlyingItem(null); setIsAnimatingLoot(false); setAnimatingEntities(prev => prev.filter(id => id !== entity.id));
          if (refillsMaxAir && isDivingLevel(level)) {
            airRef.current = maxAir;
            setAir(maxAir);
          } else {
            handlePostActionAir(targetY, false, { nextInventory: nextInv, wasFullBeforeMove, dropPos: finalPos });
          }
          if (level.id !== 'underwater' && (!level.mechanics.isVertical || !level.mechanics.hasPickaxe) && entity.id === puzzle.goalEntityId) triggerVictory();
        }, postActionDelay);
      } else {
        setIsAnimatingLoot(false);
        scheduleTimeout(() => setAnimatingEntities(prev => prev.filter(id => id !== entity.id)), ACTION_ANIM_MS);
        if (refillsMaxAir && isDivingLevel(level)) {
          airRef.current = maxAir;
          setAir(maxAir);
        } else {
          handlePostActionAir(targetY, false, { nextInventory: postConsumeInv, wasFullBeforeMove, dropPos: finalPos });
        }
        if (level.id === 'shipwreck' && entity.id === puzzle.goalEntityId) {
          setFlyingItem({ itemId: 'crown', emoji: '👑', x: entity.x, y: targetY, zIndex: 120 });
          scheduleTimeout(() => setFlyingItem(null), ACTION_ANIM_MS);
        }
        if (level.id !== 'underwater' && (!level.mechanics.isVertical || !level.mechanics.hasPickaxe) && entity.id === puzzle.goalEntityId) triggerVictory();
      }

    } else {
      if (entity.id.startsWith('octopus') && !defeated.includes(entity.id)) {
        const sprayRadius = 25;
        const affected = puzzle.puzzleEntities.filter(e => {
          const dist = Math.sqrt(Math.pow(e.x - entity.x, 2) + Math.pow(e.y - entity.y, 2));
          return dist < sprayRadius && e.id !== entity.id;
        });
        setInkFogEntities(prev => {
          const next = new Set(prev);
          affected.forEach(e => next.add(e.id));
          return next;
        });
        setAlertEntityId(`ink_${entity.id}`);
        scheduleTimeout(() => {
          setAlertEntityId(null);
          scheduleTimeout(() => {
            setInkFogEntities(prev => {
              const next = new Set(prev);
              affected.forEach(e => next.delete(e.id));
              return next;
            });
          }, INK_FOG_DURATION_MS);
        }, ALERT_DURATION_MS);
        setIsAnimatingLoot(false);
        setSelectedItemTypes([]);
      } else {
        setAlertEntityId(entity.id);
        scheduleTimeout(() => setAlertEntityId(null), ALERT_DURATION_MS);
        setSelectedItemTypes([]);
        setIsAnimatingLoot(false);
      }
      handlePostActionAir(targetY, false, { wasFullBeforeMove, dropPos: finalPos });
    }
  };

  if (generationFailed) {
    return (
      <div className="relative min-h-screen bg-stone-900">
        <GenerationFailedScreen 
          dict={dict} 
          failureHint={generationFailureHint}
          onOpenSettings={() => { setMenuView('settings'); setIsMenuOpen(true); }} 
        />
        <GameMenu 
          isOpen={isMenuOpen}
          onClose={() => setIsMenuOpen(false)}
          menuView={menuView}
          setMenuView={setMenuView}
          dict={dict}
          lang={lang}
          levelDictionary={LEVEL_DICTIONARY}
          menuSettings={menuSettings}
          setMenuSettings={setMenuSettings}
          onReplay={handleReplay}
          onShowSolution={handleShowSolution}
          onGenerateNew={(newSettings) => { setIsMenuOpen(false); onGenerateNew(newSettings); }}
          onExportState={handleExportStateString}
          onImportState={handleImportStateString}
          isVictorious={isVictorious}
          isDemonstrating={isDemonstrating}
          isAnimatingLoot={isAnimatingLoot}
          puzzle={puzzle}
          debugMode={debugMode}
          setDebugMode={setDebugMode}
          lightingSettings={lightingSettings}
          setLightingSettings={setLightingSettings}
          currentLevelId={level.id}
        />
      </div>
    );
  }

  if (!puzzle) {
    return <GeneratingScreen dict={dict} isDeepCave={level.id === 'deep_cave'} />;
  }

  const playerPos = pathHistory[pathHistory.length - 1];
  const displayPlayerPos = tempPlayerPos || playerPos;
  const playerScale = 'scale-100';
  const playerFilter = '';
  const playerZ = 35;

  const totalMapWidth = screensX > 1 ? `${screensX * 100}%` : '100%';
  const totalMapHeight = (level.mechanics.isVertical || useIsotropic) ? `${screens * 100}%` : '100%';
  const isDrowning = alertEntityId === 'out_of_air';
  const isDrowningAscending = Boolean(drowningFloatPos);

  let mapTranslateX = '0%';
  if (!isLevelEditor && screensX > 1) {
    const screenPctX = 100 / screensX;
    const maxScrollPctX = Math.max(0, 100 - screenPctX);
    const _scrollX = drowningFloatPos ? drowningFloatPos.x : displayPlayerPos.x;
    const scrollXAsPct = useIsotropic ? (_scrollX / worldWidth) * 100 : _scrollX;
    let targetScrollX = scrollXAsPct - (screenPctX / 2);
    if (targetScrollX < 0) targetScrollX = 0;
    if (targetScrollX > maxScrollPctX) targetScrollX = maxScrollPctX;
    mapTranslateX = `-${targetScrollX}%`;
  }

  let mapTranslateY = '0%';
  if (isLevelEditor) {
    mapTranslateY = `-${editorScrollY}%`;
  } else if (level.mechanics.isVertical || useIsotropic) {
    const screenPct = 100 / screens;
    const maxScrollPct = Math.max(0, 100 - screenPct);
    const _attachedEnt = puzzle ? puzzle.puzzleEntities.find(e => e.id === attachedEntityId) : null;
    let _scrollY = drowningFloatPos ? drowningFloatPos.y : displayPlayerPos.y;
    if (_attachedEnt && _attachedEnt.id === 'dolphin_1') {
      _scrollY = dolphinYPos;
    }
    const scrollYAsPct = useIsotropic ? (_scrollY / worldHeight) * 100 : _scrollY;
    let targetScroll = scrollYAsPct - (screenPct / 2);
    if (targetScroll < 0) targetScroll = 0;
    if (targetScroll > maxScrollPct) targetScroll = maxScrollPct;
    mapTranslateY = `-${targetScroll}%`;
  }

  const playerTransition = (attachedEntityId || isDrowningAscending) ? 'transition-none' : 'ease-out';
  const playerTransitionDuration = (attachedEntityId || isDrowningAscending) ? '0ms' : `${moveDurationMs}ms`;

  let playerVisualX = drowningFloatPos ? drowningFloatPos.x : displayPlayerPos.x;
  let playerVisualY = drowningFloatPos ? drowningFloatPos.y : displayPlayerPos.y;
  let playerRotation = isDrowning ? 180 : 0;

  if (attachedEntityId) {
    const attachedEnt = puzzle.puzzleEntities.find(e => e.id === attachedEntityId);
    if (attachedEnt) {
      const custom = getCustomEntityMovement(attachedEnt);
      if (custom) {
        const xOffset = custom.flip ? 2 : -2;
        playerVisualX = custom.x + xOffset;
        playerVisualY = custom.y - 4.5;
        playerRotation = (custom.rotate || 0) * 0.6;
      }
    }
  }

  const isHeavyUnderwater = isHeavyDivingLoad(level, inventory, isTransformed);
  const isSubmerged = isHeroSubmerged(level, { x: playerVisualX, y: playerVisualY });
  const heroFace = getAquaticHeroFace({
    isDrowning,
    isTransformed,
    isInventoryFullAlert,
    isSubmerged
  });

  const handleSwimToSurface = (e?: MouseEvent) => {
    e?.stopPropagation();
    if (isVictorious || isDemonstrating || isAnimatingLoot || isRefillingAir || alertEntityId === 'out_of_air' || outOfAirModal || fishingCatch) return;
    const curPos = pathHistory[pathHistory.length - 1];
    if (level.id === 'shipwreck') {
      if (Math.hypot(curPos.x - level.campPos.x, curPos.y - level.campPos.y) <= 6) return;
    } else if (curPos.y <= level.campPos.y + 2) {
      return;
    }
    const wasFullBeforeMove = isHeavyDivingLoad(level, inventoryRef.current, isTransformedRef.current);
    const swimDuration = getDivingMoveDurationMs(level, 650, inventoryRef.current, isTransformedRef.current, wasFullBeforeMove);
    setMoveDurationMs(swimDuration);
    if (dolphinStateRef.current === 'idle_deep') {
      startDolphinReturn(false);
    }
    triggerAirLossBubbles(curPos.x, curPos.y, wasFullBeforeMove);
    setAttachedEntityId(null);
    saveHistory();
    setIsAnimatingLoot(true);
    const returnPath = navigateTo(level.campPos.x, level.campPos.y, 1, level.campPos.depth || 3, false);
    const resolvedReturnPath = returnPath.length > 0
      ? returnPath
      : [{ x: level.campPos.x, y: level.campPos.y, depth: level.campPos.depth || 3, zone: 1 }];
    maybeTriggerWaterSplash(curPos, resolvedReturnPath[resolvedReturnPath.length - 1]);
    setPathHistory(prev => [...prev, ...resolvedReturnPath]);
    scheduleTimeout(() => {
      setIsAnimatingLoot(false);
      airRef.current = maxAir;
      setAir(maxAir);
      if (level.id === 'underwater' && hasDeepTreasure && hasTransformedOnceRef.current && !isTransformedRef.current && inventoryRef.current.includes('crown')) {
        triggerVictory();
      }
    }, swimDuration);
  };

  return (
    <div className="h-[100dvh] w-full bg-stone-900 flex flex-col items-center justify-center p-0 sm:p-4 font-serif select-none overflow-hidden relative">
      <LevelEditorOverlay 
        isLevelEditor={isLevelEditor}
        editorNodes={editorNodes}
        setEditorNodes={setEditorNodes}
        level={level}
        innerMapRef={innerMapRef}
      />

      <MagicTransformationOverlay 
        isMagicAnimating={isMagicAnimating}
        playerVisualX={playerVisualX}
        playerVisualY={playerVisualY}
      />

      <div 
        className="flex flex-col w-full h-[100dvh] sm:w-auto sm:h-[95dvh] sm:aspect-[9/19.5] sm:max-w-[45dvh] sm:rounded-3xl shadow-2xl relative ring-0 sm:ring-8 ring-stone-950 overflow-hidden mx-auto" 
        style={{ containerType: 'inline-size', containerName: 'game' }}
      >
        <div 
          ref={mapRef} 
          className={`@container relative w-full flex-1 ${
            useIsotropic
              ? 'bg-stone-950 flex items-center justify-center'
              : (level.id === 'underwater' || level.id === 'shipwreck')
                ? 'bg-slate-950 shadow-[inset_0_0_60px_rgba(2,6,23,0.75),0_10px_30px_rgba(0,0,0,0.5)]'
                : 'bg-[#dcb27b] shadow-[inset_0_0_80px_rgba(100,50,0,0.6),0_10px_30px_rgba(0,0,0,0.5)]'
          } overflow-hidden cursor-pointer`}
          style={useIsotropic ? { containerType: 'size' } : undefined}
          onWheel={(e) => {
            if (isLevelEditor) {
              setEditorScrollY(prev => {
                const screenPct = 100 / (screens || 1);
                const maxScrollPct = Math.max(0, 100 - screenPct);
                let newScroll = prev + (e.deltaY > 0 ? 5 : -5);
                if (newScroll < 0) newScroll = 0;
                if (newScroll > maxScrollPct) newScroll = maxScrollPct;
                return newScroll;
              });
            }
          }}
        >
          <AirIndicator 
            air={air}
            level={level}
            isTransformed={isTransformed}
            isHeavy={isHeavyUnderwater}
            onSwimToSurface={handleSwimToSurface}
          />

          <div
            className={useIsotropic ? 'relative overflow-hidden bg-[#181310]' : 'contents'}
            style={useIsotropic ? {
              width: `min(100cqw, calc(100cqh * 100 / ${CANONICAL_SCREEN_HEIGHT}))`,
              height: `min(100cqh, calc(100cqw * ${CANONICAL_SCREEN_HEIGHT} / 100))`,
              containerType: 'inline-size'
            } : undefined}
          >
            <WorldViewport 
              innerMapRef={innerMapRef}
              level={level}
              totalMapWidth={totalMapWidth}
              totalMapHeight={totalMapHeight}
              mapTranslateX={mapTranslateX}
              mapTranslateY={mapTranslateY}
              unlockedZones={unlockedZones}
              isTransformed={isTransformed}
              hasDeepTreasure={hasDeepTreasure}
              attachedEntityId={attachedEntityId}
              debugMode={debugMode}
              polyPoints={polyPoints}
              extraLightPolygons={extraLightPolygons}
              litBraziers={litBraziers}
              visibleBraziersSet={visibleBraziersSet}
              onLightBrazier={handleLightBrazier}
              displayPlayerPos={displayPlayerPos}
              debugSegments={debugSegments}
              lightingSettings={effectiveLighting}
              gameTime={gameTime}
              isLevelEditor={isLevelEditor}
              clickIndicator={clickIndicator}
              heroBubbleBursts={heroBubbleBursts}
              waterSplashes={waterSplashes}
              envItemState={envItemState}
              envItemCaughtPos={envItemCaughtPos}
              handleCatchRiverFish={handleCatchRiverFish}
              schoolsOfFish={schoolsOfFish}
              handleCatchSchoolFish={handleCatchSchoolFish}
              roamingBoats={roamingBoats}
              handleBoatTrade={handleBoatTrade}
              alertEntityId={alertEntityId}
              alertReason={alertReason}
              isInventoryFullAlert={isInventoryFullAlert}
              pathHistory={pathHistory}
              tempPlayerPos={tempPlayerPos}
              playerPos={playerPos}
              campItems={campItems}
              handleCampItemClick={handleCampItemClick}
              handleCampClick={handleCampClick}
              selectedItemTypes={selectedItemTypes}
              flyingItem={flyingItem}
              massFlyingTreasures={massFlyingTreasures}
              puzzle={puzzle}
              defeated={defeated}
              dict={dict}
              selectedEntityId={selectedEntityId}
              animatingEntities={animatingEntities}
              buriedEntities={buriedEntities}
              inkFogEntities={inkFogEntities}
              visibleEntitiesSet={visibleEntitiesSet}
              wallSegments={wallSegments}
              breakingRockIds={breakingRockIds}
              bridgingChasmIds={bridgingChasmIds}
              inventory={inventory}
              wildLightSources={wildLightSources}
              lanternfishLightCount={getHeldLanternfishLightCount(inventory)}
              isMagicAnimating={isMagicAnimating}
              getCustomEntityMovement={getCustomEntityMovement}
              handleInteract={handleInteract}
              playerVisualX={playerVisualX}
              playerVisualY={playerVisualY}
              playerRotation={playerRotation}
              playerScale={playerScale}
              playerFilter={playerFilter}
              playerZ={playerZ}
              playerTransition={playerTransition}
              playerTransitionDuration={playerTransitionDuration}
              isSubmerged={isSubmerged}
              isDrowning={isDrowning}
              isDrowningAscending={isDrowningAscending}
              heroFace={heroFace}
              isAnimatingLoot={isAnimatingLoot}
              isHeavyUnderwater={isHeavyUnderwater}
              onFlushKelp={handleFlushKelp}
              rustlingKelpId={rustlingKelpId}
              showTrophy={showTrophy}
              onCellClick={(e) => {
                if (!innerMapRef.current) return;
                const rect = innerMapRef.current.getBoundingClientRect();
                const clickX = ((e.clientX - rect.left) / rect.width) * (useIsotropic ? worldWidth : 100);
                const clickY = ((e.clientY - rect.top) / rect.height) * (useIsotropic ? worldHeight : 100);
                handleCellClick(e, clickX, clickY);
              }}
            />
          </div>

          {level.id !== 'underwater' && level.id !== 'shipwreck' && (
            <div className="absolute inset-0 opacity-10 z-[140] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#5c3a21 1px, transparent 1px)', backgroundSize: '30px 30px' }} />
          )}
          
          <TopBar 
            lang={lang}
            setLang={setLang}
            levelId={level.id}
            isMenuOpen={isMenuOpen}
            menuView={menuView}
            onOpenMenu={() => { setMenuView('main'); setIsMenuOpen(true); }}
            onOpenLighting={() => { setMenuView('lighting'); setIsMenuOpen(true); }}
          />

          <VictoryCelebration showVictoryMsg={showVictoryMsg} dict={dict} />

          <DrowningVignetteOverlay
            isDrowning={isDrowning && (level.id === 'underwater' || level.id === 'shipwreck')}
            isAscending={isDrowningAscending}
            dict={dict}
          />

          {level.id === 'shipwreck' && alertEntityId === 'air_pocket_blocked' && (
            <div
              data-testid="air-pocket-blocked-banner"
              dir={lang === 'he' ? 'rtl' : 'ltr'}
              className="absolute top-16 inset-x-4 z-[245] mx-auto max-w-xs bg-sky-950/95 border-2 border-cyan-300 text-cyan-100 px-3 py-2 rounded-2xl shadow-2xl text-center font-sans animate-bounce flex flex-col items-center gap-0.5"
            >
              <span className="text-base tracking-widest inline-flex items-center gap-1">
                <span>🧜‍♂️ 💦 🚫 ➔</span>
                <SpriteIcon id="sea_witch" emoji="😈" />
              </span>
              <span className="text-xs sm:text-sm font-bold">{dict.airPocketBlocked}</span>
            </div>
          )}

          {fishingCatch && (
            <FishingCatchOverlay
              fishType={fishingCatch.fish.type}
              fishEmoji={level.items.find(i => i.id === fishingCatch.fish.type)?.emoji || '🐟'}
              fishName={dict.items?.[fishingCatch.fish.type] || fishingCatch.fish.type}
              isTransformed={isTransformed}
              dict={dict}
              lang={lang}
              onResolve={handleResolveFishingCatch}
            />
          )}

          {outOfAirModal && (
            <OutOfAirModal
              items={outOfAirModal.items}
              level={level}
              dict={dict}
              lang={lang}
              lostAtSea={Boolean(outOfAirModal.lostAtSea)}
              onConfirmKeep={handleConfirmOutOfAir}
              onRestartLevel={handleReplay}
            />
          )}

          {saveVersionWarning && dict.saveVersionMismatch && (
            <div
              data-testid="save-version-warning"
              className="absolute top-16 inset-x-4 z-[220] mx-auto max-w-md bg-amber-950/95 border-2 border-amber-500 text-amber-100 px-4 py-3 rounded-xl shadow-2xl flex items-center justify-between gap-3 text-xs sm:text-sm font-sans"
              dir={lang === 'he' ? 'rtl' : 'ltr'}
            >
              <span>⚠️ {dict.saveVersionMismatch}</span>
              {onDismissSaveVersionWarning && (
                <button
                  type="button"
                  onClick={onDismissSaveVersionWarning}
                  className="shrink-0 bg-amber-800 hover:bg-amber-700 px-2.5 py-1 rounded-lg font-bold text-white"
                >
                  ✕
                </button>
              )}
            </div>
          )}
        </div>

        <InventoryBar 
          inventory={inventory}
          selectedItemTypes={selectedItemTypes}
          toggleInventoryType={toggleInventoryType}
          handleUndo={handleUndo}
          isDemonstrating={isDemonstrating}
          isAnimatingLoot={isAnimatingLoot}
          isRefillingAir={isRefillingAir || Boolean(outOfAirModal) || Boolean(fishingCatch)}
          historyStack={historyStack}
          level={level}
          dict={dict}
          isInventoryFullAlert={isInventoryFullAlert}
        />
      </div>

      <GameMenu 
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        menuView={menuView}
        setMenuView={setMenuView}
        dict={dict}
        lang={lang}
        levelDictionary={LEVEL_DICTIONARY}
        menuSettings={menuSettings}
        setMenuSettings={setMenuSettings}
        onReplay={handleReplay}
        onShowSolution={handleShowSolution}
        onGenerateNew={(newSettings) => { setIsMenuOpen(false); onGenerateNew(newSettings); }}
        onExportState={handleExportStateString}
        onImportState={handleImportStateString}
        isVictorious={isVictorious}
        isDemonstrating={isDemonstrating}
        isAnimatingLoot={isAnimatingLoot}
        puzzle={puzzle}
        debugMode={debugMode}
        setDebugMode={setDebugMode}
        lightingSettings={lightingSettings}
        setLightingSettings={setLightingSettings}
        currentLevelId={level.id}
      />
    </div>
  );
}

export default GameInstance;
