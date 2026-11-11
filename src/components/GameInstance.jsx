import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  MAX_AIR,
  MAX_UNIQUE_ITEMS,
  FISH_SPAWN_INTERVAL_MS,
  BOAT_SPAWN_INTERVAL_MS,
  INK_FOG_DURATION_MS,
  DIGGER_BURY_DELAY_MS,
  DIGGER_BURY_ANIM_MS,
  ACTION_ANIM_MS,
  ALERT_DURATION_MS,
  AIR_REFILL_INTERVAL_MS,
  DROWNING_ALERT_DELAY_MS
} from '../constants.js';
import STRINGS from '../strings.js';
import LEVEL_REGISTRY from '../levels/index.js';
import { generateLevelPuzzle } from '../logic/generator.js';
import { computeWaypoints, uniqueCount, inferTargetZone } from '../logic/navigation.js';
import { getVisibilityPolygon, getObstacleSegments, isPointInVisibilityPolygon, checkCollision } from '../logic/visibility.js';
import { findGlobalPath } from '../logic/pathfinding.js';
import { canFitInInventory, evaluateEntityTrade, computeUnlockedZones } from '../logic/rules.js';
import { createShuffleBag } from '../logic/rng.js';
import { CAVE_WALL_VERTICES } from '../levels/underground/components.jsx';

import { GameMenu, GeneratingScreen, GenerationFailedScreen, DEFAULT_LIGHTING } from './GameMenu.jsx';
import InventoryBar from './InventoryBar.jsx';
import AirIndicator from './AirIndicator.jsx';
import TopBar from './TopBar.jsx';
import WorldViewport from './WorldViewport.jsx';
import { MagicTransformationOverlay, VictoryCelebration } from './EffectsOverlay.jsx';
import LevelEditorOverlay from './LevelEditorOverlay.jsx';

const LEVEL_DICTIONARY = LEVEL_REGISTRY;

export function GameInstance({ level, targetSteps, numDiggers, onGenerateNew, lang, setLang }) {
  const [puzzle, setPuzzle] = useState(null);
  const [generationFailed, setGenerationFailed] = useState(false);
  const [isLevelEditor] = useState(() => new URLSearchParams(window.location.search).get('editor') === 'true');
  const [editorScrollY, setEditorScrollY] = useState(0);
  const [editorNodes, setEditorNodes] = useState([]);

  useEffect(() => {
    if (isLevelEditor && level && level.mapNodes) {
      setEditorNodes(JSON.parse(JSON.stringify(level.mapNodes)));
    }
  }, [isLevelEditor, level]);

  const [inventory, setInventory] = useState([]);
  const [unlockedZones, setUnlockedZones] = useState([1]);
  const [defeated, setDefeated] = useState([]);
  const [selectedItemTypes, setSelectedItemTypes] = useState([]);
  const [pathHistory, setPathHistory] = useState([{ ...level.campPos, zone: 1 }]);
  const [historyStack, setHistoryStack] = useState([]);
  const [air, setAir] = useState(MAX_AIR);

  const dict = STRINGS[lang] || STRINGS.en;

  const [isVictorious, setIsVictorious] = useState(false);
  const [showTrophy, setShowTrophy] = useState(false);
  const [showVictoryMsg, setShowVictoryMsg] = useState(false);
  const [isDemonstrating, setIsDemonstrating] = useState(false);
  const [isAnimatingLoot, setIsAnimatingLoot] = useState(false);
  const [alertEntityId, setAlertEntityId] = useState(null);
  const [selectedEntityId, setSelectedEntityId] = useState(null);
  const [flyingItem, setFlyingItem] = useState(null);
  const [tempPlayerPos, setTempPlayerPos] = useState(null);
  const [envItemState, setEnvItemState] = useState('active');
  const [envItemCaughtPos, setEnvItemCaughtPos] = useState({ x: 50, y: 50 });
  const [schoolsOfFish, setSchoolsOfFish] = useState([]);
  const [campItems, setCampItems] = useState([]);
  const [massFlyingTreasures, setMassFlyingTreasures] = useState([]);
  const [clickIndicator, setClickIndicator] = useState(null);
  const [heroBubbleBursts, setHeroBubbleBursts] = useState([]);
  const [moveDurationMs, setMoveDurationMs] = useState(300);

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [menuView, setMenuView] = useState('main');
  const [menuSettings, setMenuSettings] = useState({ levelId: level.id, steps: targetSteps, diggers: numDiggers });

  const [animatingEntities, setAnimatingEntities] = useState([]);
  const [buriedEntities, setBuriedEntities] = useState([]);
  const [isTransformed, setIsTransformed] = useState(false);
  const [isRefillingAir, setIsRefillingAir] = useState(false);
  const [hasDeepTreasure, setHasDeepTreasure] = useState(false);
  const [inkFogEntities, setInkFogEntities] = useState(new Set());
  const [roamingBoats, setRoamingBoats] = useState([]);
  const [gameTime, setGameTime] = useState(0);
  const [attachedEntityId, setAttachedEntityId] = useState(null);
  const [isMagicAnimating, setIsMagicAnimating] = useState(false);
  const [debugMode, setDebugMode] = useState(false);
  const [lightingSettings, setLightingSettings] = useState(DEFAULT_LIGHTING);

  const [dolphinState, setDolphinState] = useState('idle_surface');
  const [dolphinYPos, setDolphinYPos] = useState(16);
  const [breakingRockIds, setBreakingRockIds] = useState({});
  const dolphinStateRef = useRef('idle_surface');
  const dolphinYPosRef = useRef(16);
  useEffect(() => { dolphinStateRef.current = dolphinState; }, [dolphinState]);
  useEffect(() => { dolphinYPosRef.current = dolphinYPos; }, [dolphinYPos]);
  const dolphinAnimRef = useRef({ startTime: 0, startY: 16, targetY: 16, duration: 0, isDiving: false, attachPlayer: false });

  const airRef = useRef(air); airRef.current = air;
  const isDemoRef = useRef(isDemonstrating); isDemoRef.current = isDemonstrating;
  const isVicRef = useRef(isVictorious); isVicRef.current = isVictorious;
  const stateRefs = useRef({});
  const activeDigTimers = useRef({});
  const managedTimeoutsRef = useRef(new Set());
  const walkSessionRef = useRef(0);

  const scheduleTimeout = useCallback((fn, delayMs) => {
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

  const screens = level.mechanics.screens || 1;

  const obstacleSegments = useMemo(() => {
    if (!puzzle) return [];
    if (level.getObstacleSegments) return level.getObstacleSegments(puzzle.puzzleEntities, unlockedZones, defeated, level.mechanics.screens || 1);
    return getObstacleSegments(puzzle.puzzleEntities, CAVE_WALL_VERTICES, unlockedZones, defeated, level.mechanics.screens || 1);
  }, [puzzle?.puzzleEntities, unlockedZones, defeated, level.mechanics.screens, level]);

  const polyPoints = useMemo(() => {
    if (!puzzle || !level.mechanics.hasDarkness || level.mechanics.darknessType !== 'radial') return null;
    const pPos = tempPlayerPos || pathHistory[pathHistory.length - 1];
    if (!pPos) return null;
    return getVisibilityPolygon(pPos, obstacleSegments, lightingSettings?.radius || lightingSettings?.torchRadius || 50, level.mechanics.screens || 1);
  }, [puzzle, level.mechanics.hasDarkness, level.mechanics.darknessType, level.mechanics.screens, tempPlayerPos, pathHistory, obstacleSegments, lightingSettings]);

  const visibleEntitiesSet = useMemo(() => {
    if (!polyPoints || !puzzle) return null;
    const pPos = tempPlayerPos || pathHistory[pathHistory.length - 1];
    if (!pPos) return null;
    const visible = new Set();
    const torchRadius = lightingSettings?.radius || lightingSettings?.torchRadius || 50;

    puzzle.puzzleEntities.forEach(e => {
      const isRock = (e.isGatekeeper && level.mechanics.hasPickaxe && e.id !== 'final_gate') || e.isExtraRock;
      let targetPoint;
      let dist;
      if (isRock || e.isGatekeeper) {
        const facingY = pPos.y < e.y ? (e.y - 1.5) : (e.y + 1.5);
        targetPoint = { x: e.x, y: facingY * screens };
        dist = Math.sqrt(Math.pow(e.x - pPos.x, 2) + Math.pow(facingY - pPos.y, 2));
      } else {
        targetPoint = { x: e.x, y: e.y * screens };
        dist = Math.sqrt(Math.pow(e.x - pPos.x, 2) + Math.pow(e.y - pPos.y, 2));
      }

      if (dist > torchRadius) return;

      const pPosScaled = { x: pPos.x, y: pPos.y * screens };
      const otherSegments = obstacleSegments.filter(s => s.rockId !== e.id);
      const isLoSBlocked = checkCollision(pPosScaled, targetPoint, otherSegments);

      if (!isLoSBlocked) {
        visible.add(e.id);
      }
    });
    return visible;
  }, [polyPoints, puzzle, tempPlayerPos, pathHistory, obstacleSegments, screens, lightingSettings, level.mechanics.hasPickaxe]);

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
    const p = generateLevelPuzzle(level, targetSteps, numDiggers);
    if (!p) {
      setGenerationFailed(true);
      return;
    }
    setPuzzle(p);
    setInventory(p.startItems || []);
    setPathHistory([{ ...level.campPos, zone: 1 }]);
    setUnlockedZones([1]);
    setDefeated([]);
    setSelectedItemTypes([]);
    setAir(MAX_AIR);
    setIsAnimatingLoot(false);
    setTempPlayerPos(null);
    setAlertEntityId(null);
    setAttachedEntityId(null);
  }, [level, targetSteps, numDiggers]);

  const mapRef = useRef(null);
  const innerMapRef = useRef(null);
  const demoRef = useRef(false);

  const triggerVictory = useCallback(() => {
    setIsVictorious(true);
    setShowTrophy(true);
    setShowVictoryMsg(true);
  }, []);

  const navigateTo = useCallback((targetX, targetY, targetZone, targetDepth, isInteract = false, occluderType = null) => {
    if (!puzzle) return [];
    const lastPos = pathHistory[pathHistory.length - 1];
    
    if (level.mechanics.isCaveType && lastPos) {
      const dynamicObstacles = obstacleSegments;
      let finalTargetX = targetX;
      let finalTargetY = targetY;

      if (isInteract) {
        const dx = finalTargetX - lastPos.x;
        const dy = finalTargetY - lastPos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 0) {
          finalTargetX = finalTargetX - (dx / dist) * 3.5;
          finalTargetY = finalTargetY - (dy / dist) * 3.5;
        }
      }

      const startPt = { x: lastPos.x, y: lastPos.y * screens };
      const endPt = { x: finalTargetX, y: finalTargetY * screens };
      const bounds = { width: 100, height: screens * 100 };
      const rawPath = findGlobalPath(startPt, endPt, dynamicObstacles, bounds);
      
      return rawPath.map(p => ({
        x: p.x,
        y: p.y / screens,
        depth: targetDepth || 3,
        zone: targetZone
      }));
    }

    let waypoints = computeWaypoints(lastPos.zone || 1, targetZone);
    let path = [];
    waypoints.forEach(wp => {
      path.push({ x: wp.x, y: wp.y, depth: targetDepth || 3, zone: wp.zone });
    });

    let finalX = targetX;
    let finalY = targetY;
    
    if (isInteract) {
      const prevPoint = path.length > 0 ? path[path.length - 1] : lastPos;
      const dx = finalX - prevPoint.x;
      const dy = finalY - prevPoint.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 0) {
        finalX = finalX - (dx / dist) * 3.5;
        finalY = finalY - (dy / dist) * 3.5;
      }
    }
    
    return [{ x: finalX, y: finalY, depth: targetDepth || 3, zone: targetZone }];
  }, [puzzle, pathHistory, level.mechanics.isCaveType, obstacleSegments, screens]);

  const handlePostActionAir = useCallback((finalY, isVentAction = false) => {
    if (!level.mechanics.hasAir || isTransformed) return;
    if (finalY <= 20 || isVentAction) {
      setAir(MAX_AIR);
      if (level.id === 'underwater' && hasDeepTreasure && !isTransformed) {
        triggerVictory();
      }
    } else if (airRef.current <= 1) {
      setAir(0);
      scheduleTimeout(() => {
        setAlertEntityId('out_of_air');
        setIsAnimatingLoot(true);
        const returnPath = navigateTo(level.campPos.x, level.campPos.y, 1, level.campPos.depth || 3, false);
        setPathHistory(prev => [...prev, ...returnPath]);
        scheduleTimeout(() => {
          setIsAnimatingLoot(false);
          setAlertEntityId(null);
          setIsRefillingAir(true);
        }, 3000);
      }, DROWNING_ALERT_DELAY_MS);
    } else setAir(a => a - 1);
  }, [level.id, level.mechanics.hasAir, level.campPos, navigateTo, isTransformed, hasDeepTreasure, triggerVictory, scheduleTimeout]);

  const startDolphinDive = useCallback(() => {
    setAttachedEntityId('dolphin_1');
    setIsAnimatingLoot(true);
    setDolphinState('diving');
    dolphinAnimRef.current = {
      startTime: performance.now(),
      startY: dolphinYPosRef.current,
      targetY: 60,
      duration: 2000,
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
      targetY: 16,
      duration: 1800,
      isDiving: false,
      attachPlayer
    };
  }, []);

  useEffect(() => {
    if (level.id !== 'underwater') return;
    let frameId;
    const update = (time) => {
      setGameTime(time / 1000);

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
            setPathHistory(prev => [...prev, { x: 50, y: 60, zone: 2 }]);
            handlePostActionAir(60);
          } else if (state === 'rising') {
            setDolphinState('idle_surface');
            if (anim.attachPlayer) {
              setAttachedEntityId(null);
              setIsAnimatingLoot(false);
              setPathHistory(prev => [...prev, { x: 50, y: 16, zone: 1 }]);
              handlePostActionAir(16);
            }
          }
        }
      }

      frameId = requestAnimationFrame(update);
    };
    frameId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frameId);
  }, [level.id, handlePostActionAir]);

  useEffect(() => {
    if (!level.mechanics.hasSchoolsOfFish) return;
    let timeoutIds = [];
    const spawnFish = (isInitial = false) => {
      if (isDemoRef.current || isVicRef.current) return;
      const id = Date.now() + Math.random();
      const type = Math.random() > 0.6 && level.id === 'underwater' ? 'gold_fish' : 'fish';
      const depth = Math.floor(Math.random() * 3) + 1;
      const yPos = isInitial ? (15 + Math.random() * 20) : (20 + Math.random() * 70);
      const isRight = Math.random() > 0.5;
      setSchoolsOfFish(prev => [...prev, { id, type, y: yPos, depth, isRight, speed: 8 + Math.random() * 10 }]);
      const tId = setTimeout(() => { setSchoolsOfFish(prev => prev.filter(f => f.id !== id)); }, 12000);
      timeoutIds.push(tId);
    };
    if (level.id === 'underwater') {
      for (let i = 0; i < 3; i++) spawnFish(true);
    }
    const intervalId = setInterval(() => {
      spawnFish(false);
      if (Math.random() > 0.3) spawnFish(false);
    }, FISH_SPAWN_INTERVAL_MS);
    return () => { clearInterval(intervalId); timeoutIds.forEach(clearTimeout); };
  }, [level.mechanics.hasSchoolsOfFish, level.id]);

  useEffect(() => {
    if (level.id !== 'underwater') return;
    let timeoutIds = [];
    const junkBag = createShuffleBag(['comb', 'mirror', 'boot', 'locket']);
    const spawnBoat = () => {
      if (isDemoRef.current || isVicRef.current) return;
      const spawnTime = Date.now();
      const id = spawnTime + Math.random();
      const offeredItem = junkBag.next();
      const reqItem = Math.random() > 0.5 ? 'gold_fish' : 'fish';
      const isRight = Math.random() > 0.5;
      setRoamingBoats(prev => [...prev, { id, spawnTime, offeredItem, reqItem, x: isRight ? -20 : 120, isRight }]);
      const tId = setTimeout(() => { setRoamingBoats(prev => prev.filter(b => b.id !== id)); }, 20000);
      timeoutIds.push(tId);
    };
    // Spawn an initial boat shortly after entering Underwater so the player doesn't wait 12s
    const initialBoatTimer = setTimeout(spawnBoat, 1500);
    timeoutIds.push(initialBoatTimer);
    const intervalId = setInterval(spawnBoat, BOAT_SPAWN_INTERVAL_MS);
    return () => { clearInterval(intervalId); timeoutIds.forEach(clearTimeout); };
  }, [level.id]);

  useEffect(() => {
    if (!puzzle || isDemonstrating || isAnimatingLoot) return;
    const currentPos = pathHistory[pathHistory.length - 1];
    const diggersToBury = puzzle.puzzleEntities.filter(ent => {
      const isDigger = level.specialEntityTemplate && ent.id?.startsWith(level.specialEntityTemplate) && !ent.isGoal;
      const isVisibleToPlayer = level.mechanics.darknessType !== 'radial' || (visibleEntitiesSet && visibleEntitiesSet.has(ent.id));
      const isZoneAccessible = level.mechanics.hasTransformation
        ? (ent.zone <= 2 || (isTransformed && currentPos && currentPos.y >= 65))
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
    if (historyStack.length === 0 || isDemonstrating || isAnimatingLoot) return;
    clearManagedTimeouts();
    const prevState = historyStack[historyStack.length - 1];
    setInventory(prevState.inventory); setDefeated(prevState.defeated); setPathHistory(prevState.pathHistory);
    setEnvItemState(prevState.envItemState);
    setUnlockedZones(prevState.unlockedZones); setCampItems(prevState.campItems || []);
    setBuriedEntities(prevState.buriedEntities || []); setAir(prevState.air ?? MAX_AIR);
    setIsTransformed(prevState.isTransformed || false);
    setHasDeepTreasure(prevState.hasDeepTreasure || false);
    setInkFogEntities(new Set(prevState.inkFogEntities || []));
    if (prevState.dolphinState) {
      setDolphinState(prevState.dolphinState);
      setDolphinYPos(prevState.dolphinYPos ?? (prevState.dolphinState === 'idle_deep' ? 60 : 16));
    }
    setHistoryStack(prev => prev.slice(0, -1)); setSelectedItemTypes([]); setSelectedEntityId(null);
    setFlyingItem(null); setTempPlayerPos(null); setIsVictorious(false); setShowTrophy(false); setShowVictoryMsg(false); setAnimatingEntities([]);
    setMassFlyingTreasures([]);
  };

  const resetGameState = () => {
    if (!puzzle) return;
    clearManagedTimeouts();
    setInventory(puzzle.startItems || []);
    setPathHistory([{ ...level.campPos, zone: 1 }]);
    setBreakingRockIds({});
    setDolphinState('idle_surface');
    setDolphinYPos(16);
    dolphinAnimRef.current = { startTime: 0, startY: 16, targetY: 16, duration: 0, isDiving: false, attachPlayer: false };
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

  const handleReplay = () => { demoRef.current = false; resetGameState(); setIsMenuOpen(false); };

  const handleShowSolution = async () => {
    if (!puzzle || !puzzle.solution || demoRef.current || isAnimatingLoot) return;
    resetGameState();
    setIsDemonstrating(true);
    demoRef.current = true;
    setIsMenuOpen(false);

    let currentInv = [...(puzzle.startItems || [])];
    let currentDefeated = [];
    let currentPath = [{ ...level.campPos, zone: 1 }];
    let currentZoneSim = 1;
    let unlockedZonesSim = new Set([1]);
    let transformedSim = false;
    let hasTreasureSim = false;

    for (const step of puzzle.solution) {
      if (!demoRef.current) break;
      if (step.isEnvironmentAction) {
        if (step.itemId === 'fish') {
          setEnvItemState('caught');
          setEnvItemCaughtPos({ x: 50, y: 53 });
          await new Promise(r => scheduleTimeout(r, ACTION_ANIM_MS));
          if (!demoRef.current) break;
          setEnvItemState('hidden');
        } else {
          setFlyingItem({ emoji: level.items.find(i => i.id === step.itemId)?.emoji, x: 50, y: 19 });
          await new Promise(r => scheduleTimeout(r, ACTION_ANIM_MS));
          if (!demoRef.current) break;
          setFlyingItem(null);
        }
        currentInv.push(step.itemId);
        setInventory([...currentInv]);
        await new Promise(r => scheduleTimeout(r, 400));
        continue;
      }

      const entity = puzzle.puzzleEntities.find(e => e.id === step.entityId);
      if (!entity) continue;

      let waypoints = computeWaypoints(currentZoneSim, entity.zone);

      for (let wp of waypoints) {
        if (!demoRef.current) break;
        currentPath.push(wp);
        setPathHistory([...currentPath]);
        currentZoneSim = wp.zone;
        await new Promise(r => scheduleTimeout(r, 400));
      }

      await new Promise(r => scheduleTimeout(r, 600));
      if (!demoRef.current) break;

      if (step.reqType === 'AND') {
        setSelectedItemTypes(Array.from(new Set(step.usedItems || [])));
      } else if (step.itemId) {
        setSelectedItemTypes([step.itemId]);
      }

      await new Promise(r => scheduleTimeout(r, 600));
      if (!demoRef.current) break;

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
      await new Promise(r => scheduleTimeout(r, ACTION_ANIM_MS));
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
        setFlyingItem({ emoji: level.items.find(i => i.id === entity.reward)?.emoji, x: entityX, y: entity.y });
        await new Promise(r => scheduleTimeout(r, ACTION_ANIM_MS));
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
          setMassFlyingTreasures(allTreasures.map((t, idx) => ({ emoji: t.emoji, x: t.x, y: t.y, delay: idx * 150 })));
          currentDefeated.push(...allTreasures.map(t => t.id));
          setDefeated([...currentDefeated]);
          await new Promise(r => scheduleTimeout(r, ACTION_ANIM_MS));
          setMassFlyingTreasures([]);
        }
        triggerVictory();
      } else if (level.mechanics.hasTransformation && hasTreasureSim && !transformedSim && step.isReturnTrip) {
        currentPath.push({ x: level.campPos.x, y: level.campPos.y, depth: 3, zone: 1 });
        setPathHistory([...currentPath]);
        await new Promise(r => scheduleTimeout(r, ACTION_ANIM_MS));
        triggerVictory();
      }
    }
    setIsDemonstrating(false);
    demoRef.current = false;
  };

  const triggerAirLossBubbles = useCallback((x, y) => {
    if (!level.mechanics.hasAir || isTransformed) return;
    const burstId = Date.now() + Math.random();
    const bubbles = Array.from({ length: 6 }, (_, i) => ({
      id: i,
      dx: (Math.random() - 0.5) * 30,
      endDx: (Math.random() - 0.5) * 50,
      delay: i * 70,
      scale: 0.7 + Math.random() * 0.5,
      speed: 0.9 + Math.random() * 0.4
    }));
    setHeroBubbleBursts(prev => [...prev, { id: burstId, x, y, bubbles }]);
    scheduleTimeout(() => {
      setHeroBubbleBursts(prev => prev.filter(b => b.id !== burstId));
    }, 1600);
  }, [level.mechanics.hasAir, isTransformed, scheduleTimeout]);

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

  const handleCatchRiverFish = (e) => {
    e.stopPropagation();
    const { fits } = canFitInInventory(inventory, [], 'fish');
    if (envItemState !== 'active' || !fits || isDemonstrating || isAnimatingLoot || isRefillingAir) return;
    saveHistory();
    const parentRect = e.currentTarget.parentElement.getBoundingClientRect();
    setEnvItemCaughtPos({ x: ((e.clientX - parentRect.left) / parentRect.width) * 100, y: ((e.clientY - parentRect.top) / parentRect.height) * 100 });
    setEnvItemState('caught');
    scheduleTimeout(() => {
      setEnvItemState('hidden');
      setInventory(prev => [...prev, 'fish']);
      handlePostActionAir(53);
    }, ACTION_ANIM_MS);
  };

  const handleCatchSchoolFish = (e, fishObj) => {
    e.stopPropagation();
    const { fits } = canFitInInventory(inventory, [], fishObj.type);
    if (!fits || isDemonstrating || isAnimatingLoot || isRefillingAir) return;
    if (!mapRef.current) return;
    const rect = mapRef.current.getBoundingClientRect();
    saveHistory(); setIsAnimatingLoot(true);
    const currentZone = pathHistory[pathHistory.length - 1].zone || 1;
    const startPos = pathHistory[pathHistory.length - 1];
    triggerAirLossBubbles(startPos.x, startPos.y);
    const targetX = ((e.clientX - rect.left) / rect.width) * 100;
    const targetY = fishObj.y;
    setPathHistory(prev => [...prev, { x: targetX, y: targetY, depth: fishObj.depth, zone: currentZone }]);
    scheduleTimeout(() => {
      setSchoolsOfFish(currentFish => {
        if (currentFish.some(f => f.id === fishObj.id)) {
          setInventory(prev => [...prev, fishObj.type]);
          return currentFish.filter(f => f.id !== fishObj.id);
        }
        return currentFish;
      });
      setIsAnimatingLoot(false);
      handlePostActionAir(fishObj.y);
    }, 700);
  };

  const handleBoatTrade = (e, boat) => {
    e.stopPropagation();
    const tradeReq = boat.reqItem || 'fish';
    const { fits } = canFitInInventory(inventory, [tradeReq], boat.offeredItem);

    if (!inventory.includes(tradeReq) || !fits || isDemonstrating || isAnimatingLoot || isRefillingAir) {
      setAlertEntityId(boat.id);
      scheduleTimeout(() => setAlertEntityId(null), ALERT_DURATION_MS);
      return;
    }
    saveHistory(); setIsAnimatingLoot(true);
    const startPos = pathHistory[pathHistory.length - 1];
    triggerAirLossBubbles(startPos.x, startPos.y);
    const elapsed = Date.now() - (boat.spawnTime || Math.floor(boat.id));
    const progress = Math.min(1, Math.max(0, elapsed / 20000));
    const boatX = boat.isRight ? (-20 + progress * 140) : (120 - progress * 140);
    setPathHistory(prev => [...prev, { x: Math.max(10, Math.min(90, boatX)), y: 19, depth: 3, zone: 1 }]);

    scheduleTimeout(() => {
      setInventory(prev => {
        const newInv = [...prev];
        const idx = newInv.indexOf(tradeReq);
        if (idx > -1) newInv.splice(idx, 1);
        newInv.push(boat.offeredItem);
        return newInv;
      });
      setRoamingBoats(prev => prev.filter(b => b.id !== boat.id));
      setFlyingItem({ emoji: level.items.find(i => i.id === boat.offeredItem)?.emoji, x: Math.max(10, Math.min(90, boatX)), y: 19 });
      scheduleTimeout(() => {
        setFlyingItem(null);
        setIsAnimatingLoot(false);
        handlePostActionAir(19);
      }, ACTION_ANIM_MS);
    }, 700);
  };

  const handleCampClick = (e) => {
    const itemToDrop = selectedItemTypes[0];
    if (!itemToDrop && !level.mechanics.hasAir) return;

    e.stopPropagation();
    if (isVictorious || isDemonstrating || isAnimatingLoot || isRefillingAir) return;

    if (dolphinStateRef.current === 'idle_deep') {
      startDolphinReturn(false);
    }
    setAttachedEntityId(null);
    saveHistory();
    setIsAnimatingLoot(true);

    let newPath = navigateTo(level.campPos.x, level.campPos.y, 1, level.campPos.depth || 3, false);
    if (!newPath || newPath.length === 0) {
      newPath = [{ x: level.campPos.x, y: level.campPos.y, depth: level.campPos.depth || 3, zone: 1 }];
    }
    const lastPos = pathHistory[pathHistory.length - 1];
    const finalPos = newPath[newPath.length - 1];

    if (lastPos && finalPos && (lastPos.x !== finalPos.x || lastPos.y !== finalPos.y)) {
      triggerAirLossBubbles(lastPos.x, lastPos.y);
    }

    setPathHistory(prev => {
      if (lastPos && finalPos && lastPos.x === finalPos.x && lastPos.y === finalPos.y) return prev;
      return [...prev, ...newPath];
    });

    scheduleTimeout(() => {
      if (itemToDrop) {
        setInventory(prev => {
          const newInv = [...prev];
          const idx = newInv.indexOf(itemToDrop);
          if (idx > -1) newInv.splice(idx, 1);
          return newInv;
        });
        const offsetX = level.campPos.x + (Math.random() * 14 - 7);
        const offsetY = level.campPos.y + (Math.random() * 8 - 4);
        setCampItems(prev => [...prev, { id: itemToDrop, x: offsetX, y: offsetY, uid: Date.now() + Math.random() }]);
        setSelectedItemTypes([]);
      }
      setIsAnimatingLoot(false);
      if (level.mechanics.hasAir) setAir(MAX_AIR);
      if (level.id === 'underwater' && !isTransformed && hasDeepTreasure) {
        triggerVictory();
      }
    }, ACTION_ANIM_MS);
  };

  const handleCampItemClick = (e, campItem) => {
    e.stopPropagation();
    if (isVictorious || isDemonstrating || isAnimatingLoot || isRefillingAir) return;

    const { fits } = canFitInInventory(inventory, [], campItem.id);
    if (!fits) {
      setAlertEntityId(campItem.uid);
      scheduleTimeout(() => setAlertEntityId(null), ALERT_DURATION_MS);
      return;
    }

    if (dolphinStateRef.current === 'idle_deep') {
      startDolphinReturn(false);
    }
    setAttachedEntityId(null);
    saveHistory();
    setIsAnimatingLoot(true);

    let newPath = navigateTo(campItem.x, campItem.y, 1, level.campPos.depth || 3, false);
    if (!newPath || newPath.length === 0) {
      newPath = [{ x: campItem.x, y: campItem.y, depth: level.campPos.depth || 3, zone: 1 }];
    }
    const lastPos = pathHistory[pathHistory.length - 1];
    const finalPos = newPath[newPath.length - 1];

    if (lastPos && finalPos && (lastPos.x !== finalPos.x || lastPos.y !== finalPos.y)) {
      triggerAirLossBubbles(lastPos.x, lastPos.y);
    }

    setPathHistory(prev => {
      if (lastPos && finalPos && lastPos.x === finalPos.x && lastPos.y === finalPos.y) return prev;
      return [...prev, ...newPath];
    });

    scheduleTimeout(() => {
      setCampItems(prev => prev.filter(i => i.uid !== campItem.uid));
      setInventory(prev => [...prev, campItem.id]);
      setIsAnimatingLoot(false);
      if (level.mechanics.hasAir) setAir(MAX_AIR);
    }, ACTION_ANIM_MS);
  };

  const handleCellClick = async (e, targetX, targetY) => {
    e.stopPropagation();
    if (isVictorious || isDemonstrating || isAnimatingLoot || isRefillingAir) return;

    if (level.mechanics.screens > 1) {
      const sc = level.mechanics.screens || 1;
      let isValidClick = true;

      if (level.mechanics.isCaveType && polyPoints) {
        if (!isPointInVisibilityPolygon({ x: targetX, y: targetY * sc }, polyPoints)) {
          isValidClick = false;
        }
      }

      const indicatorId = Date.now();
      setClickIndicator({ x: targetX, y: targetY, isValid: isValidClick, id: indicatorId });
      scheduleTimeout(() => {
        setClickIndicator(prev => prev?.id === indicatorId ? null : prev);
      }, 750);

      if (!isValidClick) return;

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
      triggerAirLossBubbles(startP.x, startP.y);

      setIsAnimatingLoot(true);
      let lastP = pathHistory[pathHistory.length - 1];
      const sessionId = ++walkSessionRef.current;

      for (let i = 0; i < newPath.length; i++) {
        if (walkSessionRef.current !== sessionId) return;
        const wp = newPath[i];
        const dx = wp.x - lastP.x;
        const dy = wp.y - lastP.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const duration = Math.min(800, Math.max(250, Math.round(dist * 35)));

        setMoveDurationMs(duration);
        setPathHistory(prev => [...prev, wp]);
        lastP = wp;

        await new Promise(r => scheduleTimeout(r, duration));
      }

      if (walkSessionRef.current !== sessionId) return;
      setIsAnimatingLoot(false);

      if (level.mechanics.hasAir) {
        handlePostActionAir(targetY);
      }
    } else {
      if (level.mechanics.hasAir && Math.abs(targetY - level.campPos.y) < 5) {
        handlePostActionAir(targetY);
      }
    }
  };

  const toggleInventoryType = (itemId) => {
    if (isDemonstrating || isRefillingAir) return;
    if (selectedItemTypes.includes(itemId)) setSelectedItemTypes(prev => prev.filter(i => i !== itemId));
    else setSelectedItemTypes(prev => [...prev, itemId]);
  };

  const getCustomEntityMovement = (ent) => {
    if (level.id !== 'underwater') return null;
    if (ent.id === 'dolphin_1') {
      const state = dolphinStateRef.current;

      if (state === 'diving') {
        const t = gameTime * 3.2;
        const x = 50 + Math.sin(t) * 14;
        const isMovingLeft = Math.cos(t) < 0;
        const pitch = 32 + Math.sin(t * 1.5) * 8;
        const rotate = pitch * (isMovingLeft ? -1 : 1);
        return { x, y: dolphinYPos, rotate, flip: isMovingLeft };
      }

      if (state === 'rising') {
        const t = gameTime * 3.2;
        const x = 50 + Math.sin(t) * 14;
        const isMovingLeft = Math.cos(t) < 0;
        const pitch = -32 - Math.sin(t * 1.5) * 8;
        const rotate = pitch * (isMovingLeft ? -1 : 1);
        return { x, y: dolphinYPos, rotate, flip: isMovingLeft };
      }

      if (state === 'idle_deep') {
        const t = gameTime * 0.8;
        const x = 50 + Math.sin(t) * 22;
        const isMovingLeft = Math.cos(t) < 0;
        const y = 60 + Math.sin(gameTime * 1.6) * 2.5;
        const rotate = Math.sin(t * 1.5) * 10 * (isMovingLeft ? -1 : 1);
        return { x, y, rotate, flip: isMovingLeft };
      }

      const t = gameTime * 0.8;
      const x = 50 + Math.sin(t) * 28;
      const isMovingLeft = Math.cos(t) < 0;

      const diveCycle = (gameTime * 0.4) % (Math.PI * 2);
      const isDeepDiving = Math.sin(diveCycle) > 0.65;

      let y = 16 + Math.sin(gameTime * 1.8) * 3;
      let rotate = Math.sin(t * 1.5) * 12;

      if (isDeepDiving && !defeated.includes('dolphin_1')) {
        const diveProgress = (Math.sin(diveCycle) - 0.65) / 0.35;
        const diveArch = Math.sin(diveProgress * Math.PI);
        y = 16 + diveArch * 40;
        const diveSpeed = Math.cos(diveProgress * Math.PI);
        rotate = diveSpeed * 45 * (isMovingLeft ? -1 : 1);
      } else {
        const flipPhase = (gameTime * 1.5) % (Math.PI * 2);
        if (flipPhase > 4.8) {
          const flipProgress = (flipPhase - 4.8) / (Math.PI * 2 - 4.8);
          rotate = flipProgress * 360 * (isMovingLeft ? -1 : 1);
        }
      }

      return { x, y, rotate, flip: isMovingLeft };
    }
    if (ent.id.startsWith('mermaid')) {
      const idx = parseInt(ent.id.split('_')[1]) || 0;
      const t = gameTime * 0.4 + (idx * Math.PI * 2 / 3);
      return {
        x: 50 + Math.cos(t) * 25,
        y: 70 + Math.sin(t) * 12,
        rotate: Math.sin(t) * 10,
        flip: Math.cos(t) > 0
      };
    }
    return null;
  };

  const handleInteract = (entity, e) => {
    e.stopPropagation();
    if (isVictorious || isDemonstrating || isAnimatingLoot || isRefillingAir) return;

    if (attachedEntityId && attachedEntityId !== entity.id) setAttachedEntityId(null);
    if (dolphinStateRef.current === 'idle_deep' && entity.id !== 'dolphin_1') {
      startDolphinReturn(false);
    }

    const isReverseAccess = entity.isGatekeeper && entity.unlocksZones && entity.unlocksZones.some(z => unlockedZones.includes(z));
    let targetY = entity.y;

    if (level.id === 'underwater' && entity.id === 'dolphin_1' && puzzle) {
      const cm = getCustomEntityMovement(entity);
      if (cm) targetY = cm.y;
    }

    const witchEnt = level.mechanics.hasTransformation ? puzzle.puzzleEntities.find(ent => ent.id === 'sea_witch') : null;
    const isBlockedByTransformation = Boolean(witchEnt && !isTransformed && entity.zone > (witchEnt.zone || 2));

    if (isBlockedByTransformation && selectedItemTypes.length === 0) {
      setSelectedEntityId(prev => prev === entity.id ? null : entity.id);
      return;
    }

    if ((level.id !== 'underwater' && !unlockedZones.includes(entity.zone) && !isReverseAccess) || isBlockedByTransformation) {
      setSelectedItemTypes([]);
      setSelectedEntityId(prev => prev === entity.id ? null : entity.id);
      setIsAnimatingLoot(true);

      const targetAlert = isBlockedByTransformation
        ? witchEnt
        : (puzzle.puzzleEntities.filter(ent =>
            ent.isGatekeeper && !defeated.includes(ent.id) &&
            (ent.unlocksZones?.includes(entity.zone) || (ent.zone === entity.zone && ent.unlocksZones?.some(z => unlockedZones.includes(z))))
          ).sort((a, b) => Math.abs(a.y - pathHistory[pathHistory.length - 1].y) - Math.abs(b.y - pathHistory[pathHistory.length - 1].y))[0] || entity);

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
    const isRock = (entity.isGatekeeper && level.mechanics.hasPickaxe && entity.id !== 'final_gate') || entity.isExtraRock;
    const newPath = navigateTo(targetX, targetY, entity.zone, entity.depth || 3, true, isRock ? 'rock' : null);
    if (!newPath || newPath.length === 0) return;
    const lastPos = pathHistory[pathHistory.length - 1];
    const finalPos = newPath[newPath.length - 1];

    if (lastPos && finalPos && (lastPos.x !== finalPos.x || lastPos.y !== finalPos.y)) {
      triggerAirLossBubbles(lastPos.x, lastPos.y);
    }

    setPathHistory(prev => {
      if (lastPos && finalPos && lastPos.x === finalPos.x && lastPos.y === finalPos.y) return prev;
      return [...prev, ...newPath];
    });

    if (defeated.includes(entity.id)) {
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
      handlePostActionAir(targetY, entity.isVent);
      return;
    }

    if (entity.isPreset && !entity.isGatekeeper) {
      const { fits } = canFitInInventory(inventory, [], entity.reward);
      if (entity.reward && !fits) {
        setAlertEntityId(entity.id);
        scheduleTimeout(() => setAlertEntityId(null), ALERT_DURATION_MS);
        return;
      }

      setIsAnimatingLoot(true); saveHistory();

      if (level.mechanics.isCaveType && entity.isTreasure) {
        const allTreasures = puzzle.puzzleEntities.filter(t => t.isTreasure);
        setMassFlyingTreasures(allTreasures.map((t, idx) => ({ emoji: t.emoji, x: t.x, y: t.y, delay: idx * 150 })));
        setDefeated(prev => [...prev, ...allTreasures.map(t => t.id)]);
        scheduleTimeout(() => {
          triggerVictory();
          setMassFlyingTreasures([]);
          setIsAnimatingLoot(false);
          handlePostActionAir(targetY);
        }, ACTION_ANIM_MS + (allTreasures.length * 150));
        return;
      }

      setAnimatingEntities(prev => [...prev, entity.id]);
      setDefeated(prev => {
        const newDef = [...prev, entity.id];
        if (level.mechanics.isVertical && entity.isTreasure) {
          const allTreasures = puzzle.puzzleEntities.filter(t => t.isTreasure);
          if (allTreasures.every(t => newDef.includes(t.id))) triggerVictory();
        }
        return newDef;
      });

      if (entity.reward) {
        const entityX = (entity.roamClass && !entity.roamClass.includes('elevator')) ? 50 : entity.x;
        setFlyingItem({ emoji: entity.emoji, x: entityX, y: targetY, zIndex: 60 });
        scheduleTimeout(() => {
          setInventory(prev => [...prev, entity.reward]);
          setFlyingItem(null); setIsAnimatingLoot(false); setAnimatingEntities(prev => prev.filter(id => id !== entity.id));
          handlePostActionAir(targetY, entity.isVent);
        }, ACTION_ANIM_MS);
      } else {
        setIsAnimatingLoot(false);
        scheduleTimeout(() => setAnimatingEntities(prev => prev.filter(id => id !== entity.id)), ACTION_ANIM_MS);
        handlePostActionAir(targetY, entity.isVent);
      }
      return;
    }

    const tradeResult = evaluateEntityTrade(inventory, entity, selectedItemTypes, {
      levelId: level.id,
      isTransformed,
      hasDeepTreasure
    });

    if (!tradeResult.isFreeUnTransform && selectedItemTypes.length === 0 && entity.requires && entity.requires.length > 0) {
      setSelectedEntityId(prev => prev === entity.id ? null : entity.id);
      handlePostActionAir(targetY);
      setIsAnimatingLoot(false);
      return;
    }

    if (tradeResult.exceedsCapacity) {
      setAlertEntityId(entity.id);
      scheduleTimeout(() => setAlertEntityId(null), ALERT_DURATION_MS);
      return;
    }

    if (tradeResult.canDefeat) {
      const { itemsToConsume } = tradeResult;

      if (level.id === 'underwater') {
        if (entity.id === 'sea_witch') {
          if (!isTransformed) {
            setIsMagicAnimating(true);
            scheduleTimeout(() => setIsMagicAnimating(false), 1500);
            setIsTransformed(true);
          } else if (hasDeepTreasure) {
            setIsMagicAnimating(true);
            scheduleTimeout(() => setIsMagicAnimating(false), 1500);
            setIsTransformed(false);
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

      setInventory(prev => {
        let newInv = [...prev];
        itemsToConsume.forEach(itemToDel => { const idx = newInv.indexOf(itemToDel); if (idx > -1) newInv.splice(idx, 1); });
        return newInv;
      });

      if (isRock) {
        setBreakingRockIds(prev => ({ ...prev, [entity.id]: true }));
        scheduleTimeout(() => {
          setBreakingRockIds(prev => {
            const copy = { ...prev };
            delete copy[entity.id];
            return copy;
          });
        }, 1000);
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

      if (entity.reward) {
        const entityX = (entity.roamClass && !entity.roamClass.includes('elevator')) ? 50 : entity.x;
        setFlyingItem({ emoji: level.items.find(i => i.id === entity.reward)?.emoji, x: entityX, y: targetY, zIndex: 60 });
        scheduleTimeout(() => {
          setInventory(prev => [...prev, entity.reward]);
          setFlyingItem(null); setIsAnimatingLoot(false); setAnimatingEntities(prev => prev.filter(id => id !== entity.id));
          handlePostActionAir(targetY);
          if (level.id !== 'underwater' && (!level.mechanics.isVertical || !level.mechanics.hasPickaxe) && entity.id === puzzle.goalEntityId) triggerVictory();
        }, ACTION_ANIM_MS);
      } else {
        setIsAnimatingLoot(false);
        scheduleTimeout(() => setAnimatingEntities(prev => prev.filter(id => id !== entity.id)), ACTION_ANIM_MS);
        handlePostActionAir(targetY);
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
      handlePostActionAir(targetY);
    }
  };

  if (generationFailed) {
    return (
      <GenerationFailedScreen 
        dict={dict} 
        onOpenSettings={() => { setMenuView('settings'); setIsMenuOpen(true); }} 
      />
    );
  }

  if (!puzzle) {
    return <GeneratingScreen dict={dict} />;
  }

  const playerPos = pathHistory[pathHistory.length - 1];
  const displayPlayerPos = tempPlayerPos || playerPos;
  const playerDepth = displayPlayerPos.depth || 3;
  const playerScale = playerDepth === 1 ? 'scale-50' : playerDepth === 2 ? 'scale-75' : 'scale-100';
  const playerFilter = playerDepth === 1 ? 'blur-[2px] brightness-75 hue-rotate-[-15deg]' : playerDepth === 2 ? 'blur-[1px] brightness-90 hue-rotate-[-5deg]' : '';
  const playerZ = playerDepth * 10 + 5;

  const totalMapHeight = level.mechanics.isVertical ? `${level.mechanics.screens * 100}%` : '100%';

  let mapTranslateY = '0%';
  if (isLevelEditor) {
    mapTranslateY = `-${editorScrollY}%`;
  } else if (level.mechanics.isVertical) {
    const screenPct = 100 / level.mechanics.screens;
    const maxScrollPct = 100 - screenPct;
    const _attachedEnt = puzzle ? puzzle.puzzleEntities.find(e => e.id === attachedEntityId) : null;
    let _scrollY = displayPlayerPos.y;
    if (_attachedEnt) {
      if (_attachedEnt.id === 'dolphin_1') {
        _scrollY = dolphinYPos;
      } else if (_attachedEnt.roamClass?.includes('elevator')) {
        _scrollY = displayPlayerPos.y + Math.sin(gameTime * 1.5 + (_attachedEnt.id.length * 0.7)) * 20;
      }
    }
    let targetScroll = _scrollY - (screenPct / 2);
    if (targetScroll < 0) targetScroll = 0;
    if (targetScroll > maxScrollPct) targetScroll = maxScrollPct;
    mapTranslateY = `-${targetScroll}%`;
  }

  const isDrowning = alertEntityId === 'out_of_air';
  const playerTransition = attachedEntityId ? 'transition-none' : (isDrowning ? 'ease-linear' : 'ease-out');
  const playerTransitionDuration = attachedEntityId ? '0ms' : (isDrowning ? '3000ms' : `${moveDurationMs}ms`);

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
        playerRotation = custom.rotate * 0.6;
      } else if (attachedEnt.roamClass?.includes('elevator')) {
        playerVisualY += Math.sin(gameTime * 1.5 + (attachedEnt.id.length * 0.7)) * 20;
      }
    }
  }

  const isSubmerged = level.id === 'underwater' && playerVisualY > (level.campPos.y + 2);
  const heroFace = isDrowning ? '😵' : (isTransformed ? '🧜‍♂️' : (isSubmerged ? '🤿' : '🤠'));

  const handleSwimToSurface = (e) => {
    e.stopPropagation();
    if (isVictorious || isDemonstrating || isAnimatingLoot || isRefillingAir) return;
    const curY = pathHistory[pathHistory.length - 1].y;
    if (curY <= level.campPos.y + 2) return;
    if (dolphinStateRef.current === 'idle_deep') {
      startDolphinReturn(false);
    }
    const curPos = pathHistory[pathHistory.length - 1];
    triggerAirLossBubbles(curPos.x, curPos.y);
    setAttachedEntityId(null);
    saveHistory();
    setIsAnimatingLoot(true);
    const returnPath = navigateTo(level.campPos.x, level.campPos.y, 1, level.campPos.depth || 3, false);
    setPathHistory(prev => [...prev, ...returnPath]);
    scheduleTimeout(() => { setIsAnimatingLoot(false); setAir(MAX_AIR); }, ACTION_ANIM_MS);
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
          className="@container relative w-full flex-1 bg-[#dcb27b] shadow-[inset_0_0_80px_rgba(100,50,0,0.6),0_10px_30px_rgba(0,0,0,0.5)] overflow-hidden cursor-pointer"
          onWheel={(e) => {
            if (isLevelEditor) {
              setEditorScrollY(prev => {
                const screenPct = 100 / (level.mechanics.screens || 1);
                const maxScrollPct = 100 - screenPct;
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
            onSwimToSurface={handleSwimToSurface}
          />

          <WorldViewport 
            innerMapRef={innerMapRef}
            level={level}
            totalMapHeight={totalMapHeight}
            mapTranslateY={mapTranslateY}
            unlockedZones={unlockedZones}
            isTransformed={isTransformed}
            debugMode={debugMode}
            polyPoints={polyPoints}
            displayPlayerPos={displayPlayerPos}
            debugSegments={debugSegments}
            lightingSettings={lightingSettings}
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
            showTrophy={showTrophy}
            onCellClick={(e) => {
              if (!innerMapRef.current) return;
              const rect = innerMapRef.current.getBoundingClientRect();
              const clickX = ((e.clientX - rect.left) / rect.width) * 100;
              const clickY = ((e.clientY - rect.top) / rect.height) * 100;
              handleCellClick(e, clickX, clickY);
            }}
          />

          <div className="absolute inset-0 opacity-10 z-[140] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#5c3a21 1px, transparent 1px)', backgroundSize: '30px 30px' }} />
          
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
        </div>

        <InventoryBar 
          inventory={inventory}
          selectedItemTypes={selectedItemTypes}
          toggleInventoryType={toggleInventoryType}
          handleUndo={handleUndo}
          isDemonstrating={isDemonstrating}
          isAnimatingLoot={isAnimatingLoot}
          isRefillingAir={isRefillingAir}
          historyStack={historyStack}
          level={level}
          dict={dict}
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
        isVictorious={isVictorious}
        isDemonstrating={isDemonstrating}
        isAnimatingLoot={isAnimatingLoot}
        puzzle={puzzle}
        debugMode={debugMode}
        setDebugMode={setDebugMode}
        lightingSettings={lightingSettings}
        setLightingSettings={setLightingSettings}
      />
    </div>
  );
}

export default GameInstance;
