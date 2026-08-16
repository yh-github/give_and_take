import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { 
  MAX_AIR, 
  NAV_OFFSET 
} from '../constants.js';
import STRINGS from '../strings.js';
import LEVEL_REGISTRY from '../levels/index.js';
import { generateLevelPuzzle } from '../logic/generator.js';
import { computeWaypoints } from '../logic/navigation.js';
import { BoatSVG } from '../levels/underwater/components.jsx';
import { CaveEntranceProp } from '../levels/river_crossing/components.jsx';
import CaveVisibility from '../levels/underground/CaveVisibility.jsx';
import { getVisibilityPolygon, getObstacleSegments, isPointInVisibilityPolygon, checkCollision } from '../logic/visibility.js';
import { findGlobalPath, checkPolygonCollision } from '../logic/pathfinding.js';
import { CAVE_WALL_VERTICES } from '../levels/underground/components.jsx';
import { getCorridorBounds } from '../logic/geometry.js';

import { GameMenu, GeneratingScreen, GenerationFailedScreen, DEFAULT_LIGHTING } from './GameMenu.jsx';
import InventoryBar from './InventoryBar.jsx';
import AirIndicator from './AirIndicator.jsx';
import TopBar from './TopBar.jsx';
import Hero from './Hero.jsx';
import GameEntity from './GameEntity.jsx';
import { 
  ClickIndicator, 
  HeroBubbleBursts, 
  MagicTransformationOverlay, 
  VictoryCelebration, 
  FogOverlay 
} from './EffectsOverlay.jsx';
import LevelEditorOverlay from './LevelEditorOverlay.jsx';
import DebugRays from './DebugRays.jsx';

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
    return getVisibilityPolygon(pPos, obstacleSegments, lightingSettings.radius, level.mechanics.screens || 1);
  }, [tempPlayerPos, pathHistory, obstacleSegments, level.mechanics.hasDarkness, level.mechanics.darknessType, level.mechanics.screens, lightingSettings.radius]);

  const visibleEntitiesSet = useMemo(() => {
    if (!puzzle || !level.mechanics.hasDarkness || level.mechanics.darknessType !== 'radial' || !polyPoints) return null;
    const set = new Set();
    const sc = level.mechanics.screens || 1;
    const pPos = tempPlayerPos || pathHistory[pathHistory.length - 1];
    puzzle.puzzleEntities.forEach(ent => {
      const eDist = Math.sqrt(Math.pow(ent.x - pPos.x, 2) + Math.pow(ent.y - pPos.y, 2));
      if (eDist > lightingSettings.radius + 3) return;
      if (isPointInVisibilityPolygon({ x: ent.x, y: ent.y * sc }, polyPoints)) {
        set.add(ent.id);
      }
    });
    return set;
  }, [polyPoints, puzzle?.puzzleEntities, tempPlayerPos, pathHistory, level.mechanics.hasDarkness, level.mechanics.darknessType, level.mechanics.screens, lightingSettings.radius]);

  const debugSegments = useMemo(() => {
    if (!debugMode || !puzzle || !level.mechanics.isCaveType) return [];
    if (level.getObstacleSegments) return level.getObstacleSegments(puzzle.puzzleEntities, unlockedZones, defeated, level.mechanics.screens || 1);
    return getObstacleSegments(puzzle.puzzleEntities, CAVE_WALL_VERTICES, unlockedZones, defeated, level.mechanics.screens || 1);
  }, [debugMode, puzzle?.puzzleEntities, unlockedZones, defeated, level.mechanics.screens, level]);

  const wallSegments = useMemo(() => {
    if (!level.mechanics.hasDarkness || level.mechanics.darknessType !== 'radial') return [];
    const segs = [];
    const sc = level.mechanics.screens || 1;
    const processPath = (vertices) => {
      for (let i = 0; i < vertices.length - 1; i++) {
        segs.push({ a: { x: vertices[i].x, y: vertices[i].y * sc }, b: { x: vertices[i+1].x, y: vertices[i+1].y * sc } });
      }
    };
    if (CAVE_WALL_VERTICES.leftWall) processPath(CAVE_WALL_VERTICES.leftWall);
    if (CAVE_WALL_VERTICES.rightWall) processPath(CAVE_WALL_VERTICES.rightWall);
    if (CAVE_WALL_VERTICES.centralPillar) {
      processPath(CAVE_WALL_VERTICES.centralPillar);
      const p = CAVE_WALL_VERTICES.centralPillar;
      segs.push({ a: { x: p[p.length-1].x, y: p[p.length-1].y * sc }, b: { x: p[0].x, y: p[0].y * sc } });
    }
    return segs;
  }, [level.mechanics.hasDarkness, level.mechanics.darknessType, level.mechanics.screens]);

  stateRefs.current = { inventory, defeated, pathHistory, envItemState, unlockedZones, campItems, buriedEntities, air, isTransformed, hasDeepTreasure, inkFogEntities, attachedEntityId, obstacleSegments, screens };

  const demoRef = useRef(false);
  const mapRef = useRef(null);
  const innerMapRef = useRef(null);
  const Background = level.BackgroundComponent;

  useEffect(() => {
    setPuzzle(null); setGenerationFailed(false);
    const timer = setTimeout(() => {
      let newPuzzle = generateLevelPuzzle(level, targetSteps, numDiggers);
      if (!newPuzzle) newPuzzle = generateLevelPuzzle(level, 3, numDiggers);
      if (!newPuzzle) { setGenerationFailed(true); return; }
      setPuzzle(newPuzzle); setInventory(newPuzzle.startItems || []);
    }, 150);
    return () => clearTimeout(timer);
  }, [level, targetSteps, numDiggers]);

  const triggerVictory = useCallback(() => { 
    setIsVictorious(true); 
    setTimeout(() => setShowTrophy(true), 800); 
    setTimeout(() => setShowVictoryMsg(true), 1000); 
  }, []);

  const navigateTo = useCallback((targetX, targetY, targetZone, targetDepth, isEntity = false, entityType = null) => {
    const lastPos = stateRefs.current.pathHistory[stateRefs.current.pathHistory.length - 1];
    const currentZone = lastPos.zone || 1;
    const sc = stateRefs.current.screens || 1;
    
    let finalX = targetX; let finalY = targetY;
    if (isEntity) {
      const dx = finalX - lastPos.x; const dy = finalY - lastPos.y; const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 0) { 
        const offset = (entityType === 'rock') ? 8 : NAV_OFFSET;
        finalX = finalX - (dx / dist) * offset; 
        finalY = finalY - (dy / dist) * offset; 
      }
    }
    
    const start = { x: lastPos.x, y: lastPos.y * sc };
    const end = { x: finalX, y: finalY * sc };
    const bounds = { width: 100, height: 100 * sc };
    const segments = stateRefs.current.obstacleSegments || [];

    const polygons = [];
    if (CAVE_WALL_VERTICES) {
      if (CAVE_WALL_VERTICES.leftWall) {
        polygons.push(CAVE_WALL_VERTICES.leftWall.map(p => ({ x: p.x, y: p.y * sc })));
      }
      if (CAVE_WALL_VERTICES.rightWall) {
        polygons.push(CAVE_WALL_VERTICES.rightWall.map(p => ({ x: p.x, y: p.y * sc })));
      }
      if (CAVE_WALL_VERTICES.centralPillar) {
        polygons.push(CAVE_WALL_VERTICES.centralPillar.map(p => ({ x: p.x, y: p.y * sc })));
      }
    }
    if (puzzle && puzzle.puzzleEntities) {
      puzzle.puzzleEntities.forEach(node => {
         if ((node.isGatekeeper || node.isExtraRock) && !stateRefs.current.defeated.includes(node.id)) {
            const sizeY = 1.5;
            const y = node.y * sc;
            let minX, maxX;
            if (node.isGatekeeper && CAVE_WALL_VERTICES) {
              const b = getCorridorBounds(node.y, CAVE_WALL_VERTICES, node.x >= 50);
              minX = b.xLeft;
              maxX = b.xRight;
            } else {
              const sizeX = 2.5;
              minX = node.x - sizeX;
              maxX = node.x + sizeX;
            }
            polygons.push([
              { x: minX, y: y - sizeY }, { x: maxX, y: y - sizeY },
              { x: maxX, y: y + sizeY }, { x: minX, y: y + sizeY }
            ]);
         }
      });
    }

    try {
      const isDirectSegBlocked = segments.length > 0 && checkCollision(start, end, segments);
      const isDirectPolyBlocked = polygons.length > 0 && checkPolygonCollision(start, end, polygons);

      if (!isDirectSegBlocked && !isDirectPolyBlocked) {
        return [{ x: finalX, y: finalY, depth: targetDepth || 3, zone: targetZone }];
      }

      const aStarPath = findGlobalPath(start, end, segments, bounds, polygons);
      if (aStarPath && aStarPath.length > 1) {
        return aStarPath.map((p, idx) => {
          if (idx === aStarPath.length - 1) {
            return { x: finalX, y: finalY, depth: targetDepth || 3, zone: targetZone };
          }
          return {
            x: p.x,
            y: p.y / sc,
            depth: targetDepth || 3,
            zone: targetZone
          };
        });
      }

      const waypoints = computeWaypoints(currentZone, targetZone, lastPos, { x: finalX, y: finalY });
      return [...waypoints, { x: finalX, y: finalY, depth: targetDepth || 3, zone: targetZone }];
    } catch (err) {
      console.error("Navigation error:", err);
    }
    
    return [{ x: finalX, y: finalY, depth: targetDepth || 3, zone: targetZone }];
  }, [puzzle]);

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

    const newPath = navigateTo(level.campPos.x, level.campPos.y, 1, level.campPos.depth || 3, false);
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

    const newPath = navigateTo(campItem.x, campItem.y, 1, level.campPos.depth || 3, false);
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

          <div 
            ref={innerMapRef}
            onClick={(e) => {
              if (!innerMapRef.current) return;
              const rect = innerMapRef.current.getBoundingClientRect();
              const clickX = ((e.clientX - rect.left) / rect.width) * 100;
              const clickY = ((e.clientY - rect.top) / rect.height) * 100;
              handleCellClick(e, clickX, clickY);
            }}
            className="absolute inset-x-0 top-0 transition-transform duration-1000 ease-in-out pointer-events-auto animate-map-appear cursor-pointer" 
            style={{ height: totalMapHeight, transform: `translateY(${mapTranslateY})` }}
          >
            <Background />

            <FogOverlay 
              level={level} 
              unlockedZones={unlockedZones} 
              isTransformed={isTransformed} 
            />

            <DebugRays 
              debugMode={debugMode}
              level={level}
              polyPoints={polyPoints}
              displayPlayerPos={displayPlayerPos}
              debugSegments={debugSegments}
            />

            {!isLevelEditor && level.mechanics.hasDarkness && level.mechanics.darknessType === 'radial' && (
              <CaveVisibility
                heroPos={displayPlayerPos}
                polygon={polyPoints}
                gameTime={gameTime}
                screens={level.mechanics.screens || 1}
                lighting={lightingSettings}
              />
            )}

            <ClickIndicator indicator={!isLevelEditor ? clickIndicator : null} />

            <HeroBubbleBursts bursts={heroBubbleBursts} />

            {level.sceneryNodes?.map((sc, i) => {
              const sDist = level.mechanics.darknessType === 'radial' ? Math.sqrt(Math.pow(sc.x - displayPlayerPos.x, 2) + Math.pow(sc.y - displayPlayerPos.y, 2)) : 100;
              const sZ = sDist < 28 ? 99 : (sc.z || (sc.depth || 3) * 10);
              return <div key={`sc-${i}`} className={`absolute transform -translate-x-1/2 -translate-y-1/2 ${sc.s} pointer-events-none`} style={{ left: `${sc.x}%`, top: `${sc.y}%`, zIndex: sZ }}>{sc.e}</div>;
            })}

            {level.mechanics.hasFish && envItemState === 'active' && (
              <div className="absolute cursor-pointer text-3xl animate-fish-swim hover:scale-125 transition-transform" style={{ zIndex: 25 }} onClick={handleCatchRiverFish}>🐟</div>
            )}
            {level.mechanics.hasFish && envItemState === 'caught' && (
              <div className="absolute flex flex-col items-center animate-loot-fly pointer-events-none drop-shadow-xl" style={{ left: `${envItemCaughtPos.x}%`, top: `${envItemCaughtPos.y}%`, zIndex: 90 }}><span className="text-3xl">🐟</span></div>
            )}

            {schoolsOfFish.map(f => {
              const fScale = f.depth === 1 ? 'scale-50' : f.depth === 2 ? 'scale-75' : 'scale-100';
              const fFilter = f.depth === 1 ? 'blur-[2px] brightness-75 hue-rotate-[-15deg]' : f.depth === 2 ? 'blur-[1px] brightness-90 hue-rotate-[-5deg]' : '';
              const animName = f.isRight ? 'swimRight' : 'swimLeft';
              const duration = f.speed ? `${f.speed}s` : '10s';
              return (
                <div key={f.id} onClick={(e) => handleCatchSchoolFish(e, f)} className="absolute cursor-pointer text-4xl transition-transform hover:brightness-150" style={{ top: `${f.y}%`, zIndex: f.depth * 10 + 5, left: '-20%', animation: `${animName} ${duration} linear forwards` }}>
                  <div className={`inline-block ${f.isRight ? 'scale-x-[-1]' : ''} ${fScale} ${fFilter}`}>{level.items.find(i => i.id === f.type)?.emoji || '🐟'}</div>
                </div>
              );
            })}

            {roamingBoats.map(b => (
              <div key={b.id} onClick={(e) => handleBoatTrade(e, b)} className={`absolute cursor-pointer z-[120] hover:scale-110 drop-shadow-xl ${b.isRight ? 'animate-boat-glide-right' : 'animate-boat-glide-left'}`} style={{ top: '11%' }}>
                <BoatSVG />
                <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-white/90 border-2 border-amber-600 rounded-full p-2 flex items-center gap-1 shadow-lg animate-bounce">
                  <span className="text-xl">🐟</span>
                  <span className="text-sm font-bold">➡️</span>
                  <span className="text-xl">{level.items.find(i => i.id === b.offeredItem)?.emoji}</span>
                </div>
                {alertEntityId === b.id && <div className="absolute inset-0 flex items-center justify-center text-4xl animate-troll-mad">🚫</div>}
              </div>
            ))}

            {!isLevelEditor && level.id !== 'underwater' && (
              <svg className="absolute inset-0 w-full h-full pointer-events-none drop-shadow-md z-[99]" preserveAspectRatio="none">
                {(!level.mechanics.screens || level.mechanics.screens === 1) && pathHistory.map((pos, i) => { if (i === 0) return null; const prev = pathHistory[i - 1]; return <line key={i} x1={`${prev.x}%`} y1={`${prev.y}%`} x2={`${pos.x}%`} y2={`${pos.y}%`} stroke="#4a2211" strokeWidth="5" strokeDasharray="12 12" className="animate-[dash_1s_linear_forwards]" style={{ strokeDashoffset: 100 }} vectorEffect="non-scaling-stroke" />; })}
                {(!level.mechanics.screens || level.mechanics.screens === 1) && tempPlayerPos && <line x1={`${playerPos.x}%`} y1={`${playerPos.y}%`} x2={`${tempPlayerPos.x}%`} y2={`${tempPlayerPos.y}%`} stroke="#4a2211" strokeWidth="5" strokeDasharray="12 12" opacity="0.5" vectorEffect="non-scaling-stroke" />}
              </svg>
            )}

            {!isLevelEditor && campItems.map(item => {
              const itemData = level.items.find(i => i.id === item.id);
              if (!itemData) return null;
              const isAlerting = alertEntityId === item.uid;
              return (
                <div key={item.uid} onClick={(e) => handleCampItemClick(e, item)} className={`absolute transform -translate-x-1/2 -translate-y-1/2 z-[15] cursor-pointer hover:scale-125 transition-transform ${isAlerting ? 'animate-troll-mad' : ''}`} style={{ left: `${item.x}%`, top: `${item.y}%` }}>
                  <div className="text-3xl drop-shadow-md">{isAlerting ? '🚫' : itemData.emoji}</div>
                </div>
              );
            })}

            {!isLevelEditor && (
              <div onClick={handleCampClick} className={`absolute transform -translate-x-1/2 -translate-y-1/2 transition-all ${selectedItemTypes.length > 0 ? 'cursor-pointer hover:scale-110 drop-shadow-[0_0_15px_rgba(255,255,255,0.8)]' : (!selectedItemTypes.length && level.mechanics.hasAir ? 'cursor-pointer hover:scale-110' : '')}`} style={{ left: `${level.campPos.x}%`, top: `${level.campPos.y}%`, zIndex: (Math.sqrt(Math.pow(level.campPos.x - displayPlayerPos.x, 2) + Math.pow(level.campPos.y - displayPlayerPos.y, 2)) < 28) ? 110 : 10 }}>
                <div className="relative">
                  {level.CampIcon ? <level.CampIcon /> : <div className="text-6xl drop-shadow-lg scale-x-[-1] animate-flicker">🔥</div>}
                  {selectedItemTypes.length > 0 && (
                    <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-white text-stone-900 text-xs font-black px-2 py-1 rounded-xl shadow-xl animate-bounce whitespace-nowrap border-2 border-stone-800">
                      {dict.dropItem || '⬇️ Drop Item'}
                    </div>
                  )}
                </div>
              </div>
            )}

            {!isLevelEditor && flyingItem && (
              <div className="absolute animate-loot-fly drop-shadow-2xl text-6xl pointer-events-none" style={{ left: `${flyingItem.x}%`, top: `${flyingItem.y}%`, zIndex: flyingItem.zIndex || 90 }}>{flyingItem.emoji}</div>
            )}

            {!isLevelEditor && massFlyingTreasures.map((item, idx) => (
              <div key={`mass-treas-${idx}`} className="absolute animate-loot-fly drop-shadow-2xl text-6xl pointer-events-none" style={{ left: `${item.x}%`, top: `${item.y}%`, zIndex: 110, animationDelay: `${item.delay}ms` }}>{item.emoji}</div>
            ))}

            {level.id === 'river_crossing' && puzzle?.puzzleEntities.some(e => e.id === puzzle.goalEntityId) && (
              <div className="absolute transform -translate-x-1/2 -translate-y-1/2 pointer-events-none z-20" style={{ left: '50%', top: '22%' }}>
                <CaveEntranceProp />
                {!defeated.includes(puzzle.goalEntityId) && !alertEntityId && (
                  <div className="absolute -top-12 left-1/2 transform -translate-x-1/2 text-purple-950 font-black tracking-widest text-lg drop-shadow-md z-30 bg-amber-100/80 px-2 rounded">{dict.exit}</div>
                )}
              </div>
            )}

            {!isLevelEditor && puzzle.puzzleEntities.map(ent => (
              <GameEntity 
                key={ent.id}
                ent={ent}
                puzzle={puzzle}
                level={level}
                defeated={defeated}
                alertEntityId={alertEntityId}
                selectedEntityId={selectedEntityId}
                animatingEntities={animatingEntities}
                buriedEntities={buriedEntities}
                inkFogEntities={inkFogEntities}
                unlockedZones={unlockedZones}
                visibleEntitiesSet={visibleEntitiesSet}
                wallSegments={wallSegments}
                displayPlayerPos={displayPlayerPos}
                breakingRockIds={breakingRockIds}
                gameTime={gameTime}
                getCustomEntityMovement={getCustomEntityMovement}
                handleInteract={handleInteract}
                dict={dict}
              />
            ))}

            <Hero 
              playerVisualX={playerVisualX}
              playerVisualY={playerVisualY}
              playerRotation={playerRotation}
              playerScale={playerScale}
              playerFilter={playerFilter}
              playerZ={playerZ}
              playerTransition={playerTransition}
              isTransformed={isTransformed}
              isSubmerged={isSubmerged}
              isDrowning={isDrowning}
              heroFace={heroFace}
              level={level}
              isAnimatingLoot={isAnimatingLoot}
            />

            {showTrophy && (
              <div className="absolute -right-8 top-0 text-4xl animate-bounce drop-shadow-[0_0_15px_rgba(251,191,36,0.8)]" style={{ animationDelay: '0.2s' }}>
                🏆
              </div>
            )}
          </div>

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
