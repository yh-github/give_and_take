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
  UNDERWATER_INSPECT_RADIUS,
  UNDERWATER_AIR_COST_NORMAL,
  UNDERWATER_AIR_COST_FULL_BAG,
  UNDERWATER_ABYSS_DROWNING_Y,
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
  getBoatReqFishForTrinket,
  isUnderwaterBackpackFull,
  getUnderwaterMoveDurationMs,
  resolveOutOfAirDrop
} from '../logic/underwater.ts';
import type { ReefKelpHabitat } from '../levels/underwater/data.ts';
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
import AirIndicator from './AirIndicator.tsx';
import TopBar from './TopBar.tsx';
import WorldViewport from './WorldViewport.tsx';
import OutOfAirModal from './OutOfAirModal.tsx';
import FishingCatchOverlay from './FishingCatchOverlay.tsx';
import { MagicTransformationOverlay, VictoryCelebration } from './EffectsOverlay.tsx';
import LevelEditorOverlay from './LevelEditorOverlay.tsx';
import type {
  ActiveGameSettings,
  AlertReason,
  CampItemState,
  ClickIndicatorState,
  CollarBounds,
  CustomEntityMovement,
  DeepCaveSettings,
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
  air: number;
  isTransformed: boolean;
  hasDeepTreasure: boolean;
  inkFogEntities: Set<string>;
  dolphinState: string;
  dolphinYPos: number;
}

const hydrateHistoryStack = (stack: SerializedHistoryEntry[] | undefined): GameHistoryEntry[] =>
  (stack || []).map((entry) => ({
    inventory: entry.inventory || [],
    defeated: entry.defeated || [],
    pathHistory: entry.pathHistory || [],
    envItemState: entry.envItemState || 'active',
    unlockedZones: entry.unlockedZones || [1],
    campItems: entry.campItems || [],
    buriedEntities: entry.buriedEntities || [],
    air: entry.air ?? MAX_AIR,
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
  lang,
  setLang
}: GameInstanceProps) {
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
  const [selectedItemTypes, setSelectedItemTypes] = useState<string[]>([]);
  const [pathHistory, setPathHistory] = useState<PathHistoryPoint[]>(() => savedState?.pathHistory || [{ ...level.campPos, zone: 1 }]);
  const [historyStack, setHistoryStack] = useState<GameHistoryEntry[]>(() => hydrateHistoryStack(savedState?.historyStack));
  const [air, setAir] = useState<number>(() => savedState?.air ?? MAX_AIR);

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
  const [campItems, setCampItems] = useState<CampItemState[]>(() => savedState?.campItems || []);
  const [massFlyingTreasures, setMassFlyingTreasures] = useState<FlyingItemState[]>([]);
  const [clickIndicator, setClickIndicator] = useState<ClickIndicatorState | null>(null);
  const [heroBubbleBursts, setHeroBubbleBursts] = useState<HeroBubbleBurst[]>([]);
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
  const [isTransformed, setIsTransformed] = useState(() => Boolean(savedState?.isTransformed));
  const [isRefillingAir, setIsRefillingAir] = useState(false);
  const [hasDeepTreasure, setHasDeepTreasure] = useState(() => Boolean(savedState?.hasDeepTreasure));
  const [inkFogEntities, setInkFogEntities] = useState<Set<string>>(() => new Set(savedState?.inkFogEntities || []));
  const [roamingBoats, setRoamingBoats] = useState<RoamingBoatState[]>([]);
  const [outOfAirModal, setOutOfAirModal] = useState<{ items: string[]; dropPos: Point2D } | null>(null);
  const [fishingCatch, setFishingCatch] = useState<{
    fish: SchoolFishState;
    wasFullBeforeMove: boolean;
    targetPos: Point2D;
  } | null>(null);
  const [rustlingKelpId, setRustlingKelpId] = useState<string | null>(null);
  const kelpCooldownsRef = useRef<Record<string, number>>({});
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
    walkSessionRef.current += 1;
  }, []);

  useEffect(() => {
    return () => clearManagedTimeouts();
  }, [clearManagedTimeouts]);

  const useIsotropic = Boolean(level.mechanics.useIsotropicCoords);
  const worldHeight = useIsotropic
    ? (puzzle?.geometry?.worldHeight || CANONICAL_SCREEN_HEIGHT)
    : ((level.mechanics.screens || 1) * 100);
  const screens = useIsotropic
    ? (worldHeight / CANONICAL_SCREEN_HEIGHT)
    : (level.mechanics.screens || 1);
  const yScale = useIsotropic ? 1 : screens;
  const effectiveCampPos = puzzle?.geometry?.campPos || level.campPos;

  const activeTorchRadius = useMemo(() => {
    const customTorchRadius =
      puzzle?.settings && typeof puzzle.settings.torchRadius === 'number'
        ? puzzle.settings.torchRadius
        : null;
    if (useIsotropic && !debugMode && customTorchRadius) {
      return customTorchRadius;
    }
    return lightingSettings?.radius || lightingSettings?.torchRadius || 50;
  }, [useIsotropic, debugMode, puzzle?.settings, lightingSettings]);

  const effectiveLighting = useMemo(() => ({
    ...lightingSettings,
    radius: activeTorchRadius
  }), [lightingSettings, activeTorchRadius]);

  const obstacleSegments = useMemo(() => {
    if (!puzzle) return [];
    if (level.getObstacleSegments) return level.getObstacleSegments(puzzle.puzzleEntities, unlockedZones, defeated, screens, puzzle.geometry);
    if (useIsotropic && puzzle.geometry) return getProceduralObstacleSegments(puzzle.puzzleEntities, puzzle.geometry, defeated);
    return getObstacleSegments(puzzle.puzzleEntities, CAVE_WALL_VERTICES, unlockedZones, defeated, screens);
  }, [puzzle?.puzzleEntities, puzzle?.geometry, unlockedZones, defeated, screens, level, useIsotropic]);

  const obstaclePolygons = useMemo(() => {
    return (useIsotropic && puzzle?.geometry?.obstaclePolygons) ? puzzle.geometry.obstaclePolygons : [];
  }, [useIsotropic, puzzle?.geometry]);

  const polyPoints = useMemo(() => {
    if (!puzzle || !level.mechanics.hasDarkness || level.mechanics.darknessType !== 'radial') return null;
    const pPos = tempPlayerPos || pathHistory[pathHistory.length - 1];
    if (!pPos) return null;
    return getVisibilityPolygon(pPos, obstacleSegments, activeTorchRadius, yScale);
  }, [puzzle, level.mechanics.hasDarkness, level.mechanics.darknessType, tempPlayerPos, pathHistory, obstacleSegments, activeTorchRadius, yScale]);

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
      caveWallVertices: CAVE_WALL_VERTICES
    });
  }, [polyPoints, puzzle, tempPlayerPos, pathHistory, obstacleSegments, yScale, activeTorchRadius, level.mechanics.hasPickaxe, level.id]);

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
      campItems, buriedEntities, air, isTransformed, hasDeepTreasure,
      inkFogEntities, dolphinState, dolphinYPos
    };
  }, [inventory, defeated, pathHistory, envItemState, unlockedZones, campItems, buriedEntities, air, isTransformed, hasDeepTreasure, inkFogEntities, dolphinState, dolphinYPos]);

  useEffect(() => {
    setGenerationFailed(false);
    setGenerationFailureHint(null);

    const applySavedProgress = (saved: SavePayload, loadedPuzzle: PuzzleData) => {
      const fallbackCamp = loadedPuzzle?.geometry?.campPos || level.campPos;
      setPuzzle(loadedPuzzle);
      setInventory(saved.inventory || loadedPuzzle?.startItems || []);
      setPathHistory(saved.pathHistory || [{ ...fallbackCamp, zone: 1 }]);
      setUnlockedZones(saved.unlockedZones || [1]);
      setDefeated(saved.defeated || []);
      setHistoryStack(hydrateHistoryStack(saved.historyStack));
      setCampItems(saved.campItems || []);
      setBuriedEntities(saved.buriedEntities || []);
      setAir(saved.air ?? MAX_AIR);
      setIsTransformed(Boolean(saved.isTransformed));
      setHasDeepTreasure(Boolean(saved.hasDeepTreasure));
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
      setHistoryStack([]);
      setCampItems([]);
      setBuriedEntities([]);
      setSelectedItemTypes([]);
      setAir(MAX_AIR);
      setIsAnimatingLoot(false);
      setTempPlayerPos(null);
      setAlertEntityId(null);
      setAttachedEntityId(null);
      setOutOfAirModal(null);
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
      isCaveType: Boolean(level.mechanics.isCaveType),
      useIsotropic,
      worldHeight,
      yScale,
      obstacleSegments,
      obstaclePolygons,
      caveWallVertices: CAVE_WALL_VERTICES
    });
  }, [puzzle, pathHistory, level.mechanics.isCaveType, obstacleSegments, obstaclePolygons, useIsotropic, worldHeight, yScale]);

  const handlePostActionAir = useCallback((
    finalY: number,
    isVentAction = false,
    options?: { nextInventory?: string[]; wasFullBeforeMove?: boolean; dropPos?: Point2D }
  ) => {
    if (!level.mechanics.hasAir || isTransformedRef.current) return;
    const effectiveInv = options?.nextInventory ?? inventoryRef.current;

    if (finalY <= 20 || isVentAction) {
      airRef.current = MAX_AIR;
      setAir(MAX_AIR);
      if (level.id === 'underwater' && finalY <= 20 && hasDeepTreasure && !isTransformedRef.current && effectiveInv.includes('crown')) {
        triggerVictory();
      }
      return;
    }

    const isHeavyCost = options?.wasFullBeforeMove !== undefined
      ? options.wasFullBeforeMove
      : isUnderwaterBackpackFull(effectiveInv);
    const airCost = isHeavyCost ? UNDERWATER_AIR_COST_FULL_BAG : UNDERWATER_AIR_COST_NORMAL;
    const nextAir = Math.max(0, airRef.current - airCost);

    if (nextAir <= 0) {
      airRef.current = 0;
      setAir(0);
      const fallbackPos = stateRefs.current.pathHistory[stateRefs.current.pathHistory.length - 1] || level.campPos;
      const dropPos = options?.dropPos || { x: fallbackPos.x, y: fallbackPos.y };
      setAlertEntityId('out_of_air');
      scheduleTimeout(() => {
        setOutOfAirModal({
          items: [...effectiveInv],
          dropPos
        });
      }, DROWNING_ALERT_DELAY_MS);
    } else {
      airRef.current = nextAir;
      setAir(nextAir);
    }
  }, [level.id, level.mechanics.hasAir, level.campPos, hasDeepTreasure, triggerVictory, scheduleTimeout]);

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
    const update = () => {
      const anim = dolphinAnimRef.current;
      const state = dolphinStateRef.current;

      if (state === 'diving' || state === 'rising') {
        const elapsed = performance.now() - anim.startTime;
        const progress = Math.min(1, Math.max(0, elapsed / anim.duration));
        const ease = progress < 0.5
          ? 4 * progress * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 3) / 2;
        const currentY = anim.startY + (anim.targetY - anim.startY) * ease;
        setDolphinYPos(currentY);

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
      const id = Date.now() + Math.random();
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
              : 44 + Math.random() * 18;
      const speed =
        type === 'fish'
          ? 10 + Math.random() * 5
          : type === 'gold_fish'
            ? 8 + Math.random() * 4
            : 6.5 + Math.random() * 3.5;
      const isRight = forceRight !== undefined ? forceRight : Math.random() > 0.5;
      setSchoolsOfFish(prev => {
        const next = [...prev.slice(-11), { id, type, y: yPos, depth: 3, isRight, speed }];
        schoolsOfFishRef.current = next;
        return next;
      });
      const tId = setTimeout(() => {
        setSchoolsOfFish(prev => {
          const next = prev.filter(f => f.id !== id);
          schoolsOfFishRef.current = next;
          return next;
        });
      }, 12000);
      timeoutIds.push(tId);
    };
    if (level.id === 'underwater') {
      spawnFish('fish');
      spawnFish('fish');
      spawnFish('gold_fish');
      spawnFish('blowfish');
    }
    const intervalId = setInterval(() => {
      spawnFish();
    }, FISH_SPAWN_INTERVAL_MS);
    return () => { clearInterval(intervalId); timeoutIds.forEach(clearTimeout); };
  }, [level.mechanics.hasSchoolsOfFish, level.id]);

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
      setRoamingBoats(prev => [...prev.slice(-3), { id, spawnTime, offeredItem, reqItem, x: isRight ? -20 : 120, isRight }]);
      const tId = setTimeout(() => { setRoamingBoats(prev => prev.filter(b => b.id !== id)); }, 20000);
      timeoutIds.push(tId);
    };
    const initialBoatTimer = setTimeout(spawnBoat, 400);
    timeoutIds.push(initialBoatTimer);
    const intervalId = setInterval(spawnBoat, BOAT_SPAWN_INTERVAL_MS);
    return () => { clearInterval(intervalId); timeoutIds.forEach(clearTimeout); };
  }, [level.id, puzzle]);

  useEffect(() => {
    if (!puzzle || isDemonstrating || isAnimatingLoot) return;
    const currentPos = pathHistory[pathHistory.length - 1];
    const diggersToBury = puzzle.puzzleEntities.filter(ent => {
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
    setFishingCatch(null);
    setRustlingKelpId(null);
    setAlertEntityId(null);
    setAlertReason(null);
    setIsInventoryFullAlert(false);
    const prevState = historyStack[historyStack.length - 1];
    inventoryRef.current = prevState.inventory;
    isTransformedRef.current = prevState.isTransformed || false;
    setInventory(prevState.inventory); setDefeated(prevState.defeated); setPathHistory(prevState.pathHistory);
    setEnvItemState(prevState.envItemState);
    setUnlockedZones(prevState.unlockedZones); setCampItems(prevState.campItems || []);
    setBuriedEntities(prevState.buriedEntities || []); setAir(prevState.air ?? MAX_AIR);
    setIsTransformed(prevState.isTransformed || false);
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
    setFishingCatch(null);
    setRustlingKelpId(null);
    kelpCooldownsRef.current = {};
    inventoryRef.current = puzzle.startItems || [];
    isTransformedRef.current = false;
    setInventory(puzzle.startItems || []);
    setPathHistory([{ ...effectiveCampPos, zone: 1 }]);
    setBreakingRockIds({});
    setBridgingChasmIds({});
    setDolphinState('idle_surface');
    setDolphinYPos(22);
    dolphinAnimRef.current = { startTime: 0, startY: 22, targetY: 22, duration: 0, isDiving: false, attachPlayer: false };
    setUnlockedZones([1]);
    setAir(MAX_AIR);
    setDefeated([]);
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
    setIsTransformed(false);
    setHasDeepTreasure(false);
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
    pathHistory, historyStack, campItems, buriedEntities, air, isTransformed,
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
      air < MAX_AIR ||
      isTransformed ||
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
    campItems, buriedEntities, air, isTransformed, hasDeepTreasure,
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
    let transformedSim = false;
    let hasTreasureSim = false;

    for (const step of puzzle.solution) {
      if (!demoRef.current) break;
      if (step.isEnvironmentAction) {
        if (step.isBoatTrade) {
          currentPath.push({ x: 50, y: 18, depth: 3, zone: 1 });
          setPathHistory([...currentPath]);
          setFlyingItem({ emoji: level.items.find(i => i.id === step.itemId)?.emoji || '', x: 50, y: 16 });
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
          setFlyingItem({ emoji: level.items.find(i => i.id === step.itemId)?.emoji || '', x: 50, y: 19 });
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
        transformedSim = !transformedSim;
        setIsTransformed(transformedSim);
      }
      if (entity.isGoal && level.mechanics.hasTransformation) {
        hasTreasureSim = true;
        setHasDeepTreasure(true);
      }

      if (entity.reward) {
        const entityX = entity.roamClass ? 50 : entity.x;
        setFlyingItem({ emoji: level.items.find(i => i.id === entity.reward)?.emoji || '', x: entityX, y: entity.y });
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

      if (entity.id === puzzle.goalEntityId && !level.mechanics.hasTransformation) {
        if (level.mechanics.isCaveType) {
          const allTreasures = puzzle.puzzleEntities.filter(t => t.isTreasure);
          setMassFlyingTreasures(allTreasures.map((t, idx) => ({ emoji: t.emoji || '💎', x: t.x, y: t.y, delay: idx * 150 })));
          currentDefeated.push(...allTreasures.map(t => t.id));
          setDefeated([...currentDefeated]);
          await new Promise<void>(r => scheduleTimeout(r, ACTION_ANIM_MS));
          setMassFlyingTreasures([]);
        }
        triggerVictory();
      } else if (level.mechanics.hasTransformation && hasTreasureSim && !transformedSim && step.isReturnTrip) {
        currentPath.push({ x: level.campPos.x, y: level.campPos.y, depth: 3, zone: 1 });
        setPathHistory([...currentPath]);
        await new Promise<void>(r => scheduleTimeout(r, ACTION_ANIM_MS));
        triggerVictory();
      }
    }
    setIsDemonstrating(false);
    demoRef.current = false;
  };

  const triggerAirLossBubbles = useCallback((x: number, y: number, isHeavy = false) => {
    if (!level.mechanics.hasAir || isTransformedRef.current) return;
    const burstId = Date.now() + Math.random();
    const bubbleCount = isHeavy ? 12 : 6;
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
  }, [level.mechanics.hasAir, scheduleTimeout]);

  const handleConfirmOutOfAir = useCallback((keepItemId: string | null) => {
    if (!outOfAirModal) return;
    const { nextInventory, droppedFloatingItems } = resolveOutOfAirDrop(
      outOfAirModal.items,
      keepItemId,
      outOfAirModal.dropPos
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
    setMoveDurationMs(DROWNING_RETURN_DELAY_MS);
    const returnPath = navigateTo(level.campPos.x, level.campPos.y, 1, 3, false);
    setPathHistory(prev => [...prev, ...returnPath]);

    scheduleTimeout(() => {
      setIsAnimatingLoot(false);
      setAlertEntityId(null);
      setIsRefillingAir(true);
    }, DROWNING_RETURN_DELAY_MS);
  }, [outOfAirModal, startDolphinReturn, navigateTo, level.campPos, scheduleTimeout]);

  const triggerAbyssalDrowning = useCallback((
    targetX: number,
    targetY: number,
    wasFullBeforeMove: boolean
  ) => {
    if (dolphinStateRef.current === 'idle_deep') {
      startDolphinReturn(false);
    }
    setAttachedEntityId(null);
    saveHistory();

    const clampedDropX = Math.max(18, Math.min(82, targetX));
    const drownY = Math.max(74, Math.min(80, targetY));
    const swimDuration = getUnderwaterMoveDurationMs(650, wasFullBeforeMove);
    setMoveDurationMs(swimDuration);
    setIsAnimatingLoot(true);

    const lastP = pathHistory[pathHistory.length - 1] || level.campPos;
    triggerAirLossBubbles(lastP.x, lastP.y, true);
    setPathHistory(prev => [...prev, { x: clampedDropX, y: drownY, depth: 3, zone: 2 }]);

    scheduleTimeout(() => {
      airRef.current = 0;
      setAir(0);
      setIsAnimatingLoot(false);
      setAlertEntityId('out_of_air');
      scheduleTimeout(() => {
        setOutOfAirModal({
          items: [...inventoryRef.current],
          dropPos: { x: clampedDropX, y: 66 }
        });
      }, DROWNING_ALERT_DELAY_MS);
    }, swimDuration);
  }, [pathHistory, level.campPos, startDolphinReturn, saveHistory, triggerAirLossBubbles, scheduleTimeout]);

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

    const id = now + Math.random();
    const speed = habitat.fishType === 'fish' ? 12 : habitat.fishType === 'gold_fish' ? 9.5 : 7.5;
    const isRight = habitat.x < 50;
    const yPos = Math.max(18, Math.min(62, habitat.y));

    setSchoolsOfFish(prev => {
      const next = [...prev.slice(-11), { id, type: habitat.fishType, y: yPos, depth: 3, isRight, speed }];
      schoolsOfFishRef.current = next;
      return next;
    });
    scheduleTimeout(() => {
      setSchoolsOfFish(prev => {
        const next = prev.filter(f => f.id !== id);
        schoolsOfFishRef.current = next;
        return next;
      });
    }, 12000);
  }, [isVictorious, isDemonstrating, isAnimatingLoot, isRefillingAir, alertEntityId, outOfAirModal, fishingCatch, scheduleTimeout]);

  useEffect(() => {
    if (!isRefillingAir) return;
    const timer = setInterval(() => {
      setAir(prev => {
        if (prev >= MAX_AIR - 1) {
          clearInterval(timer);
          setIsRefillingAir(false);
          return MAX_AIR;
        }
        return prev + 1;
      });
    }, AIR_REFILL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [isRefillingAir]);

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
    const rect = mapRef.current.getBoundingClientRect();
    const wasFullBeforeMove = level.id === 'underwater' && !isTransformedRef.current && isUnderwaterBackpackFull(inventoryRef.current);
    const swimDuration = level.id === 'underwater' ? getUnderwaterMoveDurationMs(650, wasFullBeforeMove) : 700;
    setMoveDurationMs(swimDuration);

    saveHistory(); setIsAnimatingLoot(true);
    const currentZone = pathHistory[pathHistory.length - 1].zone || 1;
    const startPos = pathHistory[pathHistory.length - 1];
    triggerAirLossBubbles(startPos.x, startPos.y, wasFullBeforeMove);
    const rawTargetX = ((e.clientX - rect.left) / rect.width) * 100;
    const targetX = Math.max(10, Math.min(90, rawTargetX));
    const targetY = fishObj.y;
    setPathHistory(prev => [...prev, { x: targetX, y: targetY, depth: fishObj.depth, zone: currentZone }]);
    scheduleTimeout(() => {
      setFishingCatch({
        fish: fishObj,
        wasFullBeforeMove,
        targetPos: { x: targetX, y: targetY }
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
    const wasFullBeforeMove = level.id === 'underwater' && !isTransformedRef.current && isUnderwaterBackpackFull(inventoryRef.current);
    const swimDuration = level.id === 'underwater' ? getUnderwaterMoveDurationMs(650, wasFullBeforeMove) : 700;
    setMoveDurationMs(swimDuration);

    saveHistory(); setIsAnimatingLoot(true);
    const startPos = pathHistory[pathHistory.length - 1];
    triggerAirLossBubbles(startPos.x, startPos.y, wasFullBeforeMove);
    const elapsed = Date.now() - (boat.spawnTime || Math.floor(boat.id));
    const progress = Math.min(1, Math.max(0, elapsed / 20000));
    const boatX = boat.isRight ? (-20 + progress * 140) : (120 - progress * 140);
    const clampedBoatX = Math.max(10, Math.min(90, boatX));
    setPathHistory(prev => [...prev, { x: clampedBoatX, y: 19, depth: 3, zone: 1 }]);

    scheduleTimeout(() => {
      const nextInv = [...inventoryRef.current];
      const idx = nextInv.indexOf(tradeReq);
      if (idx > -1) nextInv.splice(idx, 1);
      nextInv.push(boat.offeredItem);
      inventoryRef.current = nextInv;
      setInventory(nextInv);

      setRoamingBoats(prev => prev.filter(b => b.id !== boat.id));
      setFlyingItem({ emoji: level.items.find(i => i.id === boat.offeredItem)?.emoji || '', x: clampedBoatX, y: 19 });
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

    const wasFullBeforeMove = level.id === 'underwater' && !isTransformedRef.current && isUnderwaterBackpackFull(inventoryRef.current);
    const swimDuration = level.id === 'underwater' ? getUnderwaterMoveDurationMs(650, wasFullBeforeMove) : ACTION_ANIM_MS;
    if (level.id === 'underwater') setMoveDurationMs(swimDuration);

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
        airRef.current = MAX_AIR;
        setAir(MAX_AIR);
      }
      if (level.id === 'underwater' && !isTransformedRef.current && hasDeepTreasure && nextInv.includes('crown')) {
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

    const wasFullBeforeMove = level.id === 'underwater' && !isTransformedRef.current && isUnderwaterBackpackFull(inventoryRef.current);
    const swimDuration = level.id === 'underwater' ? getUnderwaterMoveDurationMs(650, wasFullBeforeMove) : ACTION_ANIM_MS;
    if (level.id === 'underwater') setMoveDurationMs(swimDuration);

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

  const handleCellClick = async (e: MouseEvent, targetX: number, targetY: number) => {
    e.stopPropagation();
    if (isVictorious || isDemonstrating || isAnimatingLoot || isRefillingAir || alertEntityId === 'out_of_air' || outOfAirModal || fishingCatch) return;

    if (screens > 1 || useIsotropic) {
      let isValidClick = true;

      if (level.mechanics.isCaveType && polyPoints) {
        if (!isPointInVisibilityPolygon({ x: targetX, y: targetY * yScale }, polyPoints)) {
          isValidClick = false;
        }
      }

      const indicatorId = Date.now();
      setClickIndicator({ x: targetX, y: targetY, isValid: isValidClick, id: indicatorId });
      scheduleTimeout(() => {
        setClickIndicator(prev => prev?.id === indicatorId ? null : prev);
      }, 750);

      if (!isValidClick) return;

      const wasFullBeforeMove = level.id === 'underwater' && !isTransformedRef.current && isUnderwaterBackpackFull(inventoryRef.current);

      if (level.id === 'underwater' && !isTransformedRef.current && targetY > UNDERWATER_ABYSS_DROWNING_Y) {
        triggerAbyssalDrowning(targetX, targetY, wasFullBeforeMove);
        return;
      }

      if (dolphinStateRef.current === 'idle_deep') {
        startDolphinReturn(false);
      }
      setAttachedEntityId(null);
      saveHistory();

      const currentZone = pathHistory[pathHistory.length - 1].zone || 1;
      const targetZone = inferTargetZone(level, targetX, targetY, currentZone);

      const newPath = navigateTo(targetX, targetY, targetZone, 3, false);
      if (!newPath || newPath.length === 0) return;

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
        const duration = (level.id === 'underwater' && !isTransformedRef.current)
          ? getUnderwaterMoveDurationMs(baseDuration, wasFullBeforeMove)
          : baseDuration;

        setMoveDurationMs(duration);
        setPathHistory(prev => [...prev, wp]);
        lastP = wp;

        await new Promise<void>(r => scheduleTimeout(r, duration));
      }

      if (walkSessionRef.current !== sessionId) return;
      setIsAnimatingLoot(false);

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
        const waveX = 50 + Math.sin(dolphinYPos * 0.22) * 8;
        const isMovingLeft = Math.cos(dolphinYPos * 0.22) < 0;
        const rotate = 26 * (isMovingLeft ? -1 : 1);
        return { x: waveX, y: dolphinYPos, rotate, flip: isMovingLeft, isActiveMotion: true };
      }

      if (state === 'rising') {
        const waveX = 50 + Math.sin(dolphinYPos * 0.22) * 8;
        const isMovingLeft = Math.cos(dolphinYPos * 0.22) < 0;
        const rotate = -26 * (isMovingLeft ? -1 : 1);
        return { x: waveX, y: dolphinYPos, rotate, flip: isMovingLeft, isActiveMotion: true };
      }

      if (state === 'idle_deep') {
        return { x: 50, y: 58, rotate: 0, flip: false, isActiveMotion: false };
      }

      return { x: ent.x || 50, y: ent.y || 22, rotate: 0, flip: false, isActiveMotion: false };
    }
    return null;
  };

  const handleInteract = (entity: PuzzleEntity, e: MouseEvent) => {
    e.stopPropagation();
    if (isVictorious || isDemonstrating || isAnimatingLoot || isRefillingAir || alertEntityId === 'out_of_air' || outOfAirModal || fishingCatch) return;
    if (!puzzle) return;

    const wasFullBeforeMove = level.id === 'underwater' && !isTransformedRef.current && isUnderwaterBackpackFull(inventoryRef.current);
    const interactSwimDuration = level.id === 'underwater' ? getUnderwaterMoveDurationMs(500, wasFullBeforeMove) : ACTION_ANIM_MS;

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

    if (level.id === 'underwater' && !isTransformedRef.current && (entity.zone > 2 || targetY > UNDERWATER_ABYSS_DROWNING_Y)) {
      triggerAbyssalDrowning(entity.x, targetY, wasFullBeforeMove);
      return;
    }

    const witchEnt = level.mechanics.hasTransformation ? puzzle.puzzleEntities.find(ent => ent.id === 'sea_witch') : null;
    const isBlockedByTransformation = Boolean(level.id !== 'underwater' && witchEnt && !isTransformed && entity.zone > (witchEnt.zone || 2));

    if (isBlockedByTransformation && selectedItemTypes.length === 0) {
      setSelectedEntityId(prev => prev === entity.id ? null : entity.id);
      return;
    }

    if ((level.id !== 'underwater' && !unlockedZones.includes(entity.zone) && !isReverseAccess) || isBlockedByTransformation) {
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

    if (isInspectOnly && distToEntity <= UNDERWATER_INSPECT_RADIUS) {
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

    if (level.id === 'underwater' && entity.id !== 'dolphin_1') {
      setMoveDurationMs(interactSwimDuration);
    }

    if (lastPos && finalPos && (lastPos.x !== finalPos.x || lastPos.y !== finalPos.y)) {
      triggerAirLossBubbles(lastPos.x, lastPos.y, wasFullBeforeMove);
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
        const rewardEmoji = entity.emoji || level.items.find(i => i.id === rewardId)?.emoji || '';
        setFlyingItem({ emoji: rewardEmoji, x: entityX, y: targetY, zIndex: 60 });
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
      if (level.id === 'underwater') {
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
          } else if (hasDeepTreasure) {
            setIsMagicAnimating(true);
            scheduleTimeout(() => setIsMagicAnimating(false), 1500);
            isTransformedRef.current = false;
            setIsTransformed(false);
            airRef.current = MAX_AIR;
            setAir(MAX_AIR);
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
      }

      setIsAnimatingLoot(true); saveHistory();
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
        if (entity.id === 'sea_witch') return prev;
        if (entity.id === 'dolphin_1') return [...prev, entity.id];
        const newDef = [...prev, entity.id];
        if (entity.isGatekeeper && entity.unlocksZones) {
          setUnlockedZones(uz => computeUnlockedZones(uz, entity));
        }
        return newDef;
      });

      if (entity.id === 'dolphin_1') {
        startDolphinDive();
        setSelectedItemTypes([]); setSelectedEntityId(null);
        return;
      } else if (entity.roamClass?.includes('elevator')) {
        setAttachedEntityId(entity.id);
      }

      setSelectedItemTypes([]); setSelectedEntityId(null);

      const postActionDelay = level.id === 'underwater' ? Math.max(ACTION_ANIM_MS, interactSwimDuration) : ACTION_ANIM_MS;

      if (entity.reward) {
        const rewardId = entity.reward;
        const entityX = (entity.roamClass && !entity.roamClass.includes('elevator')) ? 50 : entity.x;
        setFlyingItem({ emoji: level.items.find(i => i.id === rewardId)?.emoji || '', x: entityX, y: targetY, zIndex: 60 });
        scheduleTimeout(() => {
          const nextInv = [...inventoryRef.current, rewardId];
          inventoryRef.current = nextInv;
          setInventory(nextInv);
          setFlyingItem(null); setIsAnimatingLoot(false); setAnimatingEntities(prev => prev.filter(id => id !== entity.id));
          if (!transformedJustEnded) {
            handlePostActionAir(targetY, false, { nextInventory: nextInv, wasFullBeforeMove, dropPos: finalPos });
          }
          if (level.id !== 'underwater' && (!level.mechanics.isVertical || !level.mechanics.hasPickaxe) && entity.id === puzzle.goalEntityId) triggerVictory();
        }, postActionDelay);
      } else {
        setIsAnimatingLoot(false);
        scheduleTimeout(() => setAnimatingEntities(prev => prev.filter(id => id !== entity.id)), ACTION_ANIM_MS);
        if (!transformedJustEnded) {
          handlePostActionAir(targetY, false, { nextInventory: postConsumeInv, wasFullBeforeMove, dropPos: finalPos });
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

  const totalMapHeight = (level.mechanics.isVertical || useIsotropic) ? `${screens * 100}%` : '100%';

  let mapTranslateY = '0%';
  if (isLevelEditor) {
    mapTranslateY = `-${editorScrollY}%`;
  } else if (level.mechanics.isVertical || useIsotropic) {
    const screenPct = 100 / screens;
    const maxScrollPct = Math.max(0, 100 - screenPct);
    const _attachedEnt = puzzle ? puzzle.puzzleEntities.find(e => e.id === attachedEntityId) : null;
    let _scrollY = displayPlayerPos.y;
    if (_attachedEnt && _attachedEnt.id === 'dolphin_1') {
      _scrollY = dolphinYPos;
    }
    const scrollYAsPct = useIsotropic ? (_scrollY / worldHeight) * 100 : _scrollY;
    let targetScroll = scrollYAsPct - (screenPct / 2);
    if (targetScroll < 0) targetScroll = 0;
    if (targetScroll > maxScrollPct) targetScroll = maxScrollPct;
    mapTranslateY = `-${targetScroll}%`;
  }

  const isDrowning = alertEntityId === 'out_of_air';
  const playerTransition = attachedEntityId ? 'transition-none' : (isDrowning ? 'ease-linear' : 'ease-out');
  const playerTransitionDuration = attachedEntityId ? '0ms' : (isDrowning ? `${DROWNING_RETURN_DELAY_MS}ms` : `${moveDurationMs}ms`);

  let playerVisualX = displayPlayerPos.x;
  let playerVisualY = displayPlayerPos.y;
  let playerRotation = 0;

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

  const isHeavyUnderwater = level.id === 'underwater' && !isTransformed && isUnderwaterBackpackFull(inventory);
  const isSubmerged = level.id === 'underwater' && playerVisualY > (level.campPos.y + 2);
  const heroFace = isDrowning ? '😵' : (isTransformed ? '🧜‍♂️' : (isInventoryFullAlert ? '😥' : (isSubmerged ? '🤿' : '🤠')));

  const handleSwimToSurface = (e?: MouseEvent) => {
    e?.stopPropagation();
    if (isVictorious || isDemonstrating || isAnimatingLoot || isRefillingAir || alertEntityId === 'out_of_air' || outOfAirModal || fishingCatch) return;
    const curY = pathHistory[pathHistory.length - 1].y;
    if (curY <= level.campPos.y + 2) return;
    const wasFullBeforeMove = level.id === 'underwater' && !isTransformedRef.current && isUnderwaterBackpackFull(inventoryRef.current);
    const swimDuration = getUnderwaterMoveDurationMs(650, wasFullBeforeMove);
    setMoveDurationMs(swimDuration);
    if (dolphinStateRef.current === 'idle_deep') {
      startDolphinReturn(false);
    }
    const curPos = pathHistory[pathHistory.length - 1];
    triggerAirLossBubbles(curPos.x, curPos.y, wasFullBeforeMove);
    setAttachedEntityId(null);
    saveHistory();
    setIsAnimatingLoot(true);
    const returnPath = navigateTo(level.campPos.x, level.campPos.y, 1, level.campPos.depth || 3, false);
    setPathHistory(prev => [...prev, ...returnPath]);
    scheduleTimeout(() => {
      setIsAnimatingLoot(false);
      airRef.current = MAX_AIR;
      setAir(MAX_AIR);
      if (hasDeepTreasure && !isTransformedRef.current && inventoryRef.current.includes('crown')) {
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
              : level.id === 'underwater'
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
              totalMapHeight={totalMapHeight}
              mapTranslateY={mapTranslateY}
              unlockedZones={unlockedZones}
              isTransformed={isTransformed}
              hasDeepTreasure={hasDeepTreasure}
              attachedEntityId={attachedEntityId}
              debugMode={debugMode}
              polyPoints={polyPoints}
              displayPlayerPos={displayPlayerPos}
              debugSegments={debugSegments}
              lightingSettings={effectiveLighting}
              gameTime={gameTime}
              isLevelEditor={isLevelEditor}
              clickIndicator={clickIndicator}
              heroBubbleBursts={heroBubbleBursts}
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
              heroFace={heroFace}
              isAnimatingLoot={isAnimatingLoot}
              isHeavyUnderwater={isHeavyUnderwater}
              onFlushKelp={handleFlushKelp}
              rustlingKelpId={rustlingKelpId}
              showTrophy={showTrophy}
              onCellClick={(e) => {
                if (!innerMapRef.current) return;
                const rect = innerMapRef.current.getBoundingClientRect();
                const clickX = ((e.clientX - rect.left) / rect.width) * 100;
                const clickY = ((e.clientY - rect.top) / rect.height) * (useIsotropic ? worldHeight : 100);
                handleCellClick(e, clickX, clickY);
              }}
            />
          </div>

          {level.id !== 'underwater' && (
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

          {isDrowning && level.id === 'underwater' && !isTransformed && playerVisualY > UNDERWATER_ABYSS_DROWNING_Y && !outOfAirModal && (
            <div
              data-testid="abyss-drowning-banner"
              dir={lang === 'he' ? 'rtl' : 'ltr'}
              className="absolute top-16 inset-x-4 z-[245] mx-auto max-w-xs bg-rose-950/95 border-2 border-rose-400 text-rose-100 px-3 py-2 rounded-2xl shadow-2xl text-center text-xs sm:text-sm font-bold font-sans animate-bounce"
            >
              ⚠️ {dict.abyssTooDeep}
            </div>
          )}

          {fishingCatch && (
            <FishingCatchOverlay
              fishType={fishingCatch.fish.type}
              fishEmoji={level.items.find(i => i.id === fishingCatch.fish.type)?.emoji || '🐟'}
              fishName={dict.items?.[fishingCatch.fish.type] || fishingCatch.fish.type}
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
              onConfirmKeep={handleConfirmOutOfAir}
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
