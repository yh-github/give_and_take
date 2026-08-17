import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { MAX_AIR } from '../constants.js';
import STRINGS from '../strings.js';
import LEVEL_REGISTRY from '../levels/index.js';
import { generateLevelPuzzle } from '../logic/generator.js';
import { computeWaypoints } from '../logic/navigation.js';
import { getVisibilityPolygon, getObstacleSegments, isPointInVisibilityPolygon, checkCollision } from '../logic/visibility.js';
import { findGlobalPath } from '../logic/pathfinding.js';
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
    return getVisibilityPolygon(pPos, obstacleSegments, lightingSettings.torchRadius, level.mechanics.screens || 1);
  }, [puzzle, level.mechanics.hasDarkness, level.mechanics.darknessType, level.mechanics.screens, tempPlayerPos, pathHistory, obstacleSegments, lightingSettings.torchRadius]);

  const visibleEntitiesSet = useMemo(() => {
    if (!polyPoints || !puzzle) return null;
    const pPos = tempPlayerPos || pathHistory[pathHistory.length - 1];
    const visible = new Set();
    const isRayBlockedByWalls = (p1, p2) => {
      const p1Scaled = { x: p1.x, y: p1.y * screens };
      const p2Scaled = { x: p2.x, y: p2.y * screens };
      const nonRockSegments = obstacleSegments.filter(s => !s.isRock);
      return checkCollision(p1Scaled, p2Scaled, nonRockSegments);
    };

    puzzle.puzzleEntities.forEach(e => {
      const dist = Math.sqrt(Math.pow(e.x - pPos.x, 2) + Math.pow(e.y - pPos.y, 2));
      const entPos = { x: e.x, y: e.y * screens };
      const isPhysicallyVisible = isPointInVisibilityPolygon(entPos, polyPoints);
      const isLoSBlocked = isRayBlockedByWalls(pPos, e);
      if ((isPhysicallyVisible || dist < 12) && !isLoSBlocked) {
        visible.add(e.id);
      }
    });
    return visible;
  }, [polyPoints, puzzle, tempPlayerPos, pathHistory, obstacleSegments, screens]);

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
      const startPt = { x: lastPos.x, y: lastPos.y * screens };
      const endPt = { x: targetX, y: targetY * screens };
      const rawPath = findGlobalPath(startPt, endPt, dynamicObstacles, screens, isInteract, occluderType);
      
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
      setTimeout(() => {
        setAlertEntityId('out_of_air');
        setIsAnimatingLoot(true);
        const returnPath = navigateTo(level.campPos.x, level.campPos.y, 1, level.campPos.depth || 3, false);
        setPathHistory(prev => [...prev, ...returnPath]);
        setTimeout(() => {
          setIsAnimatingLoot(false);
          setAlertEntityId(null);
          setIsRefillingAir(true);
        }, 3000);
      }, 800);
    } else setAir(a => a - 1);
  }, [level.id, level.mechanics.hasAir, level.campPos, navigateTo, isTransformed, hasDeepTreasure, triggerVictory]);

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
  }, [handlePostActionAir]);

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
    }, 1200);
    return () => { clearInterval(intervalId); timeoutIds.forEach(clearTimeout); };
  }, [level.mechanics.hasSchoolsOfFish, level.id]);

  useEffect(() => {
    if (level.id !== 'underwater') return;
    let timeoutIds = [];
    const spawnBoat = () => {
      if (isDemoRef.current || isVicRef.current) return;
      const id = Date.now() + Math.random();
      const junkItems = ['comb', 'mirror', 'boot', 'locket'];
      const offeredItem = junkItems[Math.floor(Math.random() * junkItems.length)];
      const reqItem = Math.random() > 0.5 ? 'gold_fish' : 'fish';
      const isRight = Math.random() > 0.5;
      setRoamingBoats(prev => [...prev, { id, offeredItem, reqItem, x: isRight ? -10 : 110, isRight }]);
      const tId = setTimeout(() => { setRoamingBoats(prev => prev.filter(b => b.id !== id)); }, 15000);
      timeoutIds.push(tId);
    };
    const intervalId = setInterval(spawnBoat, 12000);
    return () => { clearInterval(intervalId); timeoutIds.forEach(clearTimeout); };
  }, [level.id]);

  useEffect(() => {
    if (!puzzle || isDemonstrating || isAnimatingLoot) return;
    const diggersToBury = puzzle.puzzleEntities.filter(ent => {
      const isDigger = level.specialEntityTemplate && ent.id?.startsWith(level.specialEntityTemplate) && !ent.isGoal;
      return isDigger && unlockedZones.includes(ent.zone) && pathHistory.length > 1 && !buriedEntities.includes(ent.id) && !animatingEntities.includes(ent.id) && !defeated.includes(ent.id);
    });

    diggersToBury.forEach(ent => {
      if (!activeDigTimers.current[ent.id]) {
        activeDigTimers.current[ent.id] = setTimeout(() => {
          setAnimatingEntities(prev => [...prev, ent.id]);
          setTimeout(() => {
            setAnimatingEntities(prev => prev.filter(id => id !== ent.id));
            setBuriedEntities(prev => [...new Set([...prev, ent.id])]);
            delete activeDigTimers.current[ent.id];
          }, 700);
        }, 3000);
      }
    });
  }, [pathHistory, unlockedZones, puzzle, isDemonstrating, isAnimatingLoot, buriedEntities, animatingEntities, defeated, level]);

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
    Object.values(activeDigTimers.current).forEach(clearTimeout);
    activeDigTimers.current = {};
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

  const INITIAL_STATE = { unlockedZones: [1], air: MAX_AIR, defeated: [], selectedItemTypes: [], selectedEntityId: null, historyStack: [], isVictorious: false, showTrophy: false, showVictoryMsg: false, isDemonstrating: false, isAnimatingLoot: false, alertEntityId: null, flyingItem: null, tempPlayerPos: null, envItemState: 'active', schoolsOfFish: [], animatingEntities: [], campItems: [], buriedEntities: [], massFlyingTreasures: [], isTransformed: false, hasDeepTreasure: false, inkFogEntities: new Set(), roamingBoats: [], attachedEntityId: null, isMagicAnimating: false, heroBubbleBursts: [] };
  
  const resetGameState = () => {
    if (!puzzle) return;
    Object.values(activeDigTimers.current).forEach(clearTimeout);
    activeDigTimers.current = {};
    setInventory(puzzle.startItems || []); setPathHistory([{ ...level.campPos, zone: 1 }]); setBreakingRockIds({});
    setDolphinState('idle_surface'); setDolphinYPos(16);
    dolphinAnimRef.current = { startTime: 0, startY: 16, targetY: 16, duration: 0, isDiving: false, attachPlayer: false };
    Object.entries(INITIAL_STATE).forEach(([k, v]) => {
      if (k === 'unlockedZones') setUnlockedZones(v); else if (k === 'air') setAir(v); else if (k === 'defeated') setDefeated(v); else if (k === 'selectedItemTypes') setSelectedItemTypes(v); else if (k === 'selectedEntityId') setSelectedEntityId(v); else if (k === 'historyStack') setHistoryStack(v); else if (k === 'isVictorious') setIsVictorious(v); else if (k === 'showTrophy') setShowTrophy(v); else if (k === 'showVictoryMsg') setShowVictoryMsg(v); else if (k === 'isDemonstrating') setIsDemonstrating(v); else if (k === 'isAnimatingLoot') setIsAnimatingLoot(v); else if (k === 'alertEntityId') setAlertEntityId(v); else if (k === 'flyingItem') setFlyingItem(v); else if (k === 'tempPlayerPos') setTempPlayerPos(v); else if (k === 'envItemState') setEnvItemState(v); else if (k === 'schoolsOfFish') setSchoolsOfFish(v); else if (k === 'animatingEntities') setAnimatingEntities(v); else if (k === 'campItems') setCampItems(v); else if (k === 'buriedEntities') setBuriedEntities(v); else if (k === 'isTransformed') setIsTransformed(v); else if (k === 'hasDeepTreasure') setHasDeepTreasure(v); else if (k === 'inkFogEntities') setInkFogEntities(v); else if (k === 'roamingBoats') setRoamingBoats(v); else if (k === 'attachedEntityId') setAttachedEntityId(v); else if (k === 'isMagicAnimating') setIsMagicAnimating(v); else if (k === 'heroBubbleBursts') setHeroBubbleBursts(v);
    });
  };

  const handleReplay = () => { demoRef.current = false; resetGameState(); setIsMenuOpen(false); };

  const handleShowSolution = async () => {
    if (!puzzle || !puzzle.solution || demoRef.current || isAnimatingLoot) return;
    setIsDemonstrating(true); demoRef.current = true; resetGameState(); setIsMenuOpen(false);

    let currentInv = [...(puzzle.startItems || [])]; let currentDefeated = []; let currentPath = [{ ...level.campPos, zone: 1 }];
    let currentZoneSim = 1; let unlockedZonesSim = new Set([1]);

    for (const step of puzzle.solution) {
      if (!demoRef.current) break;
      if (step.isEnvironmentAction) {
        setEnvItemState('caught'); setEnvItemCaughtPos({ x: 50, y: 53 });
        await new Promise(r => setTimeout(r, 800));
        setEnvItemState('hidden'); currentInv.push(step.itemId); setInventory([...currentInv]);
        await new Promise(r => setTimeout(r, 400));
        continue;
      }

      const entity = puzzle.puzzleEntities.find(e => e.id === step.entityId);
      let waypoints = computeWaypoints(currentZoneSim, entity.zone);

      for (let wp of waypoints) {
        currentPath.push(wp); setPathHistory([...currentPath]); currentZoneSim = wp.zone;
        await new Promise(r => setTimeout(r, 400));
      }

      await new Promise(r => setTimeout(r, 600));
      if (step.reqType === 'AND') {
        setSelectedItemTypes(Array.from(new Set(step.usedItems)));
      } else { setSelectedItemTypes([step.itemId]); }

      await new Promise(r => setTimeout(r, 600));

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

      currentPath.push({ x: targetX, y: targetY, depth: entity.depth || 3, zone: entity.zone }); setPathHistory([...currentPath]);
      currentZoneSim = entity.zone;
      await new Promise(r => setTimeout(r, 800));

      if (step.reqType === 'AND') {
        step.usedItems.forEach(req => { const idx = currentInv.indexOf(req); if (idx > -1) currentInv.splice(idx, 1); });
      } else { currentInv.splice(currentInv.indexOf(step.itemId), 1); }

      setInventory([...currentInv]); setSelectedItemTypes([]);

      if (entity.reward) {
        const entityX = entity.roamClass ? 50 : entity.x;
        setFlyingItem({ emoji: level.items.find(i => i.id === entity.reward)?.emoji, x: entityX, y: entity.y });
        await new Promise(r => setTimeout(r, 800));
        setFlyingItem(null); currentInv.push(entity.reward);
        setInventory([...currentInv]);
      }

      currentDefeated.push(entity.id); setDefeated([...currentDefeated]); setSelectedEntityId(null);

      if (entity.isGatekeeper && entity.unlocksZones) {
        entity.unlocksZones.forEach(z => unlockedZonesSim.add(z));
        unlockedZonesSim.add(entity.zone);
        setUnlockedZones(Array.from(unlockedZonesSim));
      }
      if (!level.mechanics.isVertical && entity.id === puzzle.goalEntityId) triggerVictory();
    }
    setIsDemonstrating(false); demoRef.current = false;
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
    setTimeout(() => {
      setHeroBubbleBursts(prev => prev.filter(b => b.id !== burstId));
    }, 1600);
  }, [level.mechanics.hasAir, isTransformed]);

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
    }, 500);
    return () => clearInterval(timer);
  }, [isRefillingAir]);

  const handleCatchRiverFish = (e) => {
    e.stopPropagation();
    const uniqueInvCount = Array.from(new Set(inventory)).length;
    if (envItemState !== 'active' || (uniqueInvCount >= 4 && !inventory.includes('fish')) || isDemonstrating || isAnimatingLoot || isRefillingAir) return;
    saveHistory();
    const parentRect = e.currentTarget.parentElement.getBoundingClientRect();
    setEnvItemCaughtPos({ x: ((e.clientX - parentRect.left) / parentRect.width) * 100, y: ((e.clientY - parentRect.top) / parentRect.height) * 100 });
    setEnvItemState('caught'); setTimeout(() => { setEnvItemState('hidden'); setInventory(prev => [...prev, 'fish']); handlePostActionAir(53); }, 800);
  };

  const handleCatchSchoolFish = (e, fishObj) => {
    e.stopPropagation();
    const uniqueInvCount = Array.from(new Set(inventory)).length;
    if ((uniqueInvCount >= 4 && !inventory.includes(fishObj.type)) || isDemonstrating || isAnimatingLoot || isRefillingAir) return;
    if (!mapRef.current) return;
    const rect = mapRef.current.getBoundingClientRect();
    saveHistory(); setIsAnimatingLoot(true);
    const currentZone = pathHistory[pathHistory.length - 1].zone || 1;
    const startPos = pathHistory[pathHistory.length - 1];
    triggerAirLossBubbles(startPos.x, startPos.y);
    const targetX = ((e.clientX - rect.left) / rect.width) * 100;
    const targetY = fishObj.y;
    setPathHistory(prev => [...prev, { x: targetX, y: targetY, depth: fishObj.depth, zone: currentZone }]);
    setTimeout(() => {
      setSchoolsOfFish(currentFish => {
        if (currentFish.some(f => f.id === fishObj.id)) { setInventory(prev => [...prev, fishObj.type]); return currentFish.filter(f => f.id !== fishObj.id); }
        return currentFish;
      });
      setIsAnimatingLoot(false);
      handlePostActionAir(fishObj.y);
    }, 700);
  };

  const handleBoatTrade = (e, boat) => {
    e.stopPropagation();
    const tradeReq = boat.reqItem || 'fish';

    const futureInv = [...inventory];
    const tradeIdx = futureInv.indexOf(tradeReq);
    if (tradeIdx > -1) futureInv.splice(tradeIdx, 1);
    if (boat.offeredItem) futureInv.push(boat.offeredItem);
    const willExceed = Array.from(new Set(futureInv)).length > 4;

    if (!inventory.includes(tradeReq) || willExceed || isDemonstrating || isAnimatingLoot || isRefillingAir) {
      setAlertEntityId(boat.id);
      setTimeout(() => setAlertEntityId(null), 600);
      return;
    }
    saveHistory(); setIsAnimatingLoot(true);
    const startPos = pathHistory[pathHistory.length - 1];
    triggerAirLossBubbles(startPos.x, startPos.y);
    const boatX = boat.isRight ? ((-10 + (Date.now() - boat.id) / 15000 * 120)) : ((110 - (Date.now() - boat.id) / 15000 * 120));
    setPathHistory(prev => [...prev, { x: boatX, y: 19, depth: 3, zone: 1 }]);

    setTimeout(() => {
      setInventory(prev => {
        const newInv = [...prev];
        newInv.splice(newInv.indexOf(tradeReq), 1);
        newInv.push(boat.offeredItem);
        return newInv;
      });
      setRoamingBoats(prev => prev.filter(b => b.id !== boat.id));
      setFlyingItem({ emoji: level.items.find(i => i.id === boat.offeredItem)?.emoji, x: boatX, y: 19 });
      setTimeout(() => { setFlyingItem(null); setIsAnimatingLoot(false); handlePostActionAir(19); }, 800);
    }, 700);
  };

  const handleCampClick = (e) => {
    e.stopPropagation();
    if (isVictorious || isDemonstrating || isAnimatingLoot || isRefillingAir) return;

    const itemToDrop = selectedItemTypes[0];
    if (!itemToDrop && !level.mechanics.hasAir) return;

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

    setTimeout(() => {
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
    }, 800);
  };

  const handleCampItemClick = (e, campItem) => {
    e.stopPropagation();
    if (isVictorious || isDemonstrating || isAnimatingLoot || isRefillingAir) return;

    if (!inventory.includes(campItem.id) && Array.from(new Set(inventory)).length >= 4) {
      setAlertEntityId(campItem.uid);
      setTimeout(() => setAlertEntityId(null), 600);
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

    setTimeout(() => {
      setCampItems(prev => prev.filter(i => i.uid !== campItem.uid));
      setInventory(prev => [...prev, campItem.id]);
      setIsAnimatingLoot(false);
      if (level.mechanics.hasAir) setAir(MAX_AIR);
    }, 800);
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
      setTimeout(() => {
        setClickIndicator(prev => prev?.id === indicatorId ? null : prev);
      }, 750);

      if (!isValidClick) return;

      if (dolphinStateRef.current === 'idle_deep') {
        startDolphinReturn(false);
      }
      setAttachedEntityId(null);
      saveHistory();

      const currentZone = pathHistory[pathHistory.length - 1].zone || 1;
      let targetZone = currentZone;
      if (level.mechanics.isCaveType) {
        if (targetY < 20) targetZone = 1;
        else if (targetY < 45) targetZone = targetX < 50 ? 2 : 3;
        else if (targetY < 68) targetZone = targetX < 50 ? 4 : 5;
        else if (targetY < 80) targetZone = 6;
        else if (targetY < 88) targetZone = 7;
        else if (targetY < 95) targetZone = 8;
        else targetZone = 9;
      }

      const newPath = navigateTo(targetX, targetY, targetZone, 3, false);
      if (!newPath || newPath.length === 0) return;

      const startP = pathHistory[pathHistory.length - 1];
      triggerAirLossBubbles(startP.x, startP.y);

      setIsAnimatingLoot(true);
      let lastP = pathHistory[pathHistory.length - 1];

      for (let i = 0; i < newPath.length; i++) {
        const wp = newPath[i];
        const dx = wp.x - lastP.x;
        const dy = wp.y - lastP.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const duration = Math.min(800, Math.max(250, Math.round(dist * 35)));

        setMoveDurationMs(duration);
        setPathHistory(prev => [...prev, wp]);
        lastP = wp;

        await new Promise(r => setTimeout(r, duration));
      }

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

    if (level.id !== 'underwater' && !unlockedZones.includes(entity.zone) && !isReverseAccess) {
      setSelectedItemTypes([]); setSelectedEntityId(null); setIsAnimatingLoot(true);

      const targetAlert = puzzle.puzzleEntities.filter(ent =>
        ent.isGatekeeper && !defeated.includes(ent.id) &&
        (ent.unlocksZones?.includes(entity.zone) || (ent.zone === entity.zone && ent.unlocksZones?.some(z => unlockedZones.includes(z))))
      ).sort((a, b) => Math.abs(a.y - pathHistory[pathHistory.length - 1].y) - Math.abs(b.y - pathHistory[pathHistory.length - 1].y))[0] || entity;

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
      setTimeout(() => { setAlertEntityId(targetAlert.id); setTimeout(() => { setAlertEntityId(null); setTempPlayerPos(null); setTimeout(() => setIsAnimatingLoot(false), 700); }, 600); }, 700);
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
      if (entity.reward && !inventory.includes(entity.reward) && Array.from(new Set(inventory)).length >= 4) {
        setAlertEntityId(entity.id);
        setTimeout(() => setAlertEntityId(null), 600);
        return;
      }

      setIsAnimatingLoot(true); saveHistory();

      if (level.mechanics.isCaveType && entity.isTreasure) {
        const allTreasures = puzzle.puzzleEntities.filter(t => t.isTreasure);
        setMassFlyingTreasures(allTreasures.map((t, idx) => ({ emoji: t.emoji, x: t.x, y: t.y, delay: idx * 150 })));
        setDefeated(prev => [...prev, ...allTreasures.map(t => t.id)]);
        setTimeout(() => {
          triggerVictory();
          setMassFlyingTreasures([]);
          setIsAnimatingLoot(false);
          handlePostActionAir(targetY);
        }, 800 + (allTreasures.length * 150));
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
        setTimeout(() => {
          setInventory(prev => [...prev, entity.reward]);
          setFlyingItem(null); setIsAnimatingLoot(false); setAnimatingEntities(prev => prev.filter(id => id !== entity.id));
          handlePostActionAir(targetY);
        }, 800);
      } else {
        setIsAnimatingLoot(false);
        setTimeout(() => setAnimatingEntities(prev => prev.filter(id => id !== entity.id)), 800);
        handlePostActionAir(targetY);
      }
      return;
    }

    const isFreeUnTransform = level.id === 'underwater' && entity.id === 'sea_witch' && isTransformed && hasDeepTreasure;

    if (!isFreeUnTransform && selectedItemTypes.length === 0 && entity.requires && entity.requires.length > 0) {
      setSelectedEntityId(prev => prev === entity.id ? null : entity.id);
      handlePostActionAir(targetY);
      setIsAnimatingLoot(false);
      return;
    }

    let canDefeat = false; let itemsToConsume = [];
    const availableItems = [...inventory];
    const takeItems = (reqArray) => {
      let tempAvail = [...availableItems]; let consumed = [];
      for (const req of reqArray) { const idx = tempAvail.indexOf(req); if (idx > -1) { tempAvail.splice(idx, 1); consumed.push(req); } else { return null; } }
      return consumed;
    };

    if (entity.reqType === 'AND') {
      if (entity.requires.length === 0 || Array.from(new Set(entity.requires || [])).every(t => selectedItemTypes.includes(t))) {
        const consumed = takeItems(entity.requires || []);
        if (consumed) { canDefeat = true; itemsToConsume = consumed; }
      }
    } else {
      for (const req of (entity.requires || [])) { if (selectedItemTypes.includes(req) && availableItems.includes(req)) { canDefeat = true; itemsToConsume.push(req); break; } }
    }

    if (isFreeUnTransform) canDefeat = true;

    if (canDefeat) {
      let futureInv = [...inventory];
      itemsToConsume.forEach(itemToDel => { const idx = futureInv.indexOf(itemToDel); if (idx > -1) futureInv.splice(idx, 1); });
      if (entity.reward) futureInv.push(entity.reward);

      if (entity.reward && Array.from(new Set(futureInv)).length > 4) {
        setAlertEntityId(entity.id);
        setTimeout(() => setAlertEntityId(null), 600);
        return;
      }

      if (level.id === 'underwater') {
        if (entity.id === 'sea_witch') {
          if (!isTransformed) {
            setIsMagicAnimating(true);
            setTimeout(() => setIsMagicAnimating(false), 1500);
            setIsTransformed(true);
          } else if (hasDeepTreasure) {
            setIsMagicAnimating(true);
            setTimeout(() => setIsMagicAnimating(false), 1500);
            setIsTransformed(false);
          } else {
            setAlertEntityId(entity.id);
            setTimeout(() => setAlertEntityId(null), 600);
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
        setTimeout(() => {
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
          setUnlockedZones(uz => [...new Set([...uz, ...(entity.unlocksZones || []), entity.zone])]);
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
        setTimeout(() => {
          setInventory(prev => [...prev, entity.reward]);
          setFlyingItem(null); setIsAnimatingLoot(false); setAnimatingEntities(prev => prev.filter(id => id !== entity.id));
          handlePostActionAir(targetY);
          if (level.id !== 'underwater' && (!level.mechanics.isVertical || !level.mechanics.hasPickaxe) && entity.id === puzzle.goalEntityId) triggerVictory();
        }, 800);
      } else {
        setIsAnimatingLoot(false);
        setTimeout(() => setAnimatingEntities(prev => prev.filter(id => id !== entity.id)), 800);
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
        setTimeout(() => {
          setAlertEntityId(null);
          setTimeout(() => {
            setInkFogEntities(prev => {
              const next = new Set(prev);
              affected.forEach(e => next.delete(e.id));
              return next;
            });
          }, 8000);
        }, 600);
        setIsAnimatingLoot(false);
        setSelectedItemTypes([]);
      } else {
        setAlertEntityId(entity.id);
        setTimeout(() => setAlertEntityId(null), 600);
        setSelectedItemTypes([]);
        setIsAnimatingLoot(false);
      }
    }
    handlePostActionAir(entity.y);
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
  const playerTransition = attachedEntityId ? 'transition-none' : (isDrowning ? 'duration-[3000ms] ease-linear' : `duration-[${moveDurationMs}ms] ease-out`);

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
    setTimeout(() => { setIsAnimatingLoot(false); setAir(MAX_AIR); }, 800);
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
