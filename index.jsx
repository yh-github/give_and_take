import React, { useState, useEffect, useRef, Fragment, useMemo, useCallback } from 'react';
import { MAX_UNIQUE_ITEMS, MAX_AIR, NAV_OFFSET, FISH_SPAWN_INTERVAL_MS, BOAT_SPAWN_INTERVAL_MS, INK_FOG_DURATION_MS, DIGGER_BURY_DELAY_MS, DIGGER_BURY_ANIM_MS, ACTION_ANIM_MS, ALERT_DURATION_MS, AIR_REFILL_INTERVAL_MS, DROWNING_ALERT_DELAY_MS, DROWNING_RETURN_DELAY_MS, PUZZLE_GENERATION_DELAY_MS } from './src/constants.js';
import STRINGS from './src/strings.js';
import LEVEL_REGISTRY from './src/levels/index.js';
import { solvePuzzle } from './src/logic/solver.js';
import { generateLevelPuzzle } from './src/logic/generator.js';
import { computeWaypoints, uniqueCount } from './src/logic/navigation.js';
import ErrorBoundary from './src/components/ErrorBoundary.jsx';
import { BoatSVG, GiantClamSVG, BubbleVentSVG, CrabSVG, OctopusSVG, SeahorseSVG } from './src/levels/underwater/components.jsx';
import { CaveEntranceProp } from './src/levels/river_crossing/components.jsx';


const LEVEL_DICTIONARY = LEVEL_REGISTRY;



// --- SUB-COMPONENT: ISOLATED GAME INSTANCE ---
function GameInstance({ level, targetSteps, numDiggers, onGenerateNew, lang, setLang }) {
  const [puzzle, setPuzzle] = useState(null);
  const [generationFailed, setGenerationFailed] = useState(false);
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

  const [dolphinZone, setDolphinZone] = useState(1);
  const [dolphinYPos, setDolphinYPos] = useState(16);
  const dolphinZoneRef = useRef(1);
  useEffect(() => { dolphinZoneRef.current = dolphinZone; }, [dolphinZone]);

  const airRef = useRef(air); airRef.current = air;
  const isDemoRef = useRef(isDemonstrating); isDemoRef.current = isDemonstrating;
  const isVicRef = useRef(isVictorious); isVicRef.current = isVictorious;
  const stateRefs = useRef({});
  stateRefs.current = { inventory, defeated, pathHistory, envItemState, unlockedZones, campItems, buriedEntities, air, isTransformed, hasDeepTreasure, inkFogEntities, attachedEntityId };
  const activeDigTimers = useRef({});

  const demoRef = useRef(false);
  const mapRef = useRef(null);
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

  useEffect(() => {
    let frameId;
    const update = (time) => {
      setGameTime(time / 1000);
      setDolphinYPos(prev => {
        const target = dolphinZoneRef.current === 1 ? 16 : 60;
        if (Math.abs(prev - target) < 0.1) return target;
        return prev + (target - prev) * 0.04;
      });
      frameId = requestAnimationFrame(update);
    };
    frameId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frameId);
  }, []);

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
      inkFogEntities: new Set(stateRefs.current.inkFogEntities)
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
    setHistoryStack(prev => prev.slice(0, -1)); setSelectedItemTypes([]); setSelectedEntityId(null);
    setFlyingItem(null); setTempPlayerPos(null); setIsVictorious(false); setShowTrophy(false); setShowVictoryMsg(false); setAnimatingEntities([]);
    setMassFlyingTreasures([]);
  };

  const INITIAL_STATE = { unlockedZones: [1], air: MAX_AIR, defeated: [], selectedItemTypes: [], selectedEntityId: null, historyStack: [], isVictorious: false, showTrophy: false, showVictoryMsg: false, isDemonstrating: false, isAnimatingLoot: false, alertEntityId: null, flyingItem: null, tempPlayerPos: null, envItemState: 'active', schoolsOfFish: [], animatingEntities: [], campItems: [], buriedEntities: [], massFlyingTreasures: [], isTransformed: false, hasDeepTreasure: false, inkFogEntities: new Set(), roamingBoats: [], attachedEntityId: null, isMagicAnimating: false };
  const resetGameState = () => {
    if (!puzzle) return;
    Object.values(activeDigTimers.current).forEach(clearTimeout);
    activeDigTimers.current = {};
    setInventory(puzzle.startItems || []); setPathHistory([{ ...level.campPos, zone: 1 }]);
    Object.entries(INITIAL_STATE).forEach(([k, v]) => {
      if (k === 'unlockedZones') setUnlockedZones(v); else if (k === 'air') setAir(v); else if (k === 'defeated') setDefeated(v); else if (k === 'selectedItemTypes') setSelectedItemTypes(v); else if (k === 'selectedEntityId') setSelectedEntityId(v); else if (k === 'historyStack') setHistoryStack(v); else if (k === 'isVictorious') setIsVictorious(v); else if (k === 'showTrophy') setShowTrophy(v); else if (k === 'showVictoryMsg') setShowVictoryMsg(v); else if (k === 'isDemonstrating') setIsDemonstrating(v); else if (k === 'isAnimatingLoot') setIsAnimatingLoot(v); else if (k === 'alertEntityId') setAlertEntityId(v); else if (k === 'flyingItem') setFlyingItem(v); else if (k === 'tempPlayerPos') setTempPlayerPos(v); else if (k === 'envItemState') setEnvItemState(v); else if (k === 'schoolsOfFish') setSchoolsOfFish(v); else if (k === 'animatingEntities') setAnimatingEntities(v); else if (k === 'campItems') setCampItems(v); else if (k === 'buriedEntities') setBuriedEntities(v); else if (k === 'isTransformed') setIsTransformed(v); else if (k === 'hasDeepTreasure') setHasDeepTreasure(v); else if (k === 'inkFogEntities') setInkFogEntities(v); else if (k === 'roamingBoats') setRoamingBoats(v); else if (k === 'attachedEntityId') setAttachedEntityId(v); else if (k === 'isMagicAnimating') setIsMagicAnimating(v);
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

  const triggerVictory = () => { setIsVictorious(true); setTimeout(() => setShowTrophy(true), 800); setTimeout(() => setShowVictoryMsg(true), 1000); };

  const navigateTo = useCallback((targetX, targetY, targetZone, targetDepth, isEntity = false) => {
    const currentZone = stateRefs.current.pathHistory[stateRefs.current.pathHistory.length - 1].zone || 1;
    let waypoints = computeWaypoints(currentZone, targetZone);
    const lastPos = stateRefs.current.pathHistory[stateRefs.current.pathHistory.length - 1];
    const prevPoint = waypoints.length > 0 ? waypoints[waypoints.length - 1] : lastPos;
    let finalX = targetX; let finalY = targetY;
    if (isEntity) {
      const dx = finalX - prevPoint.x; const dy = finalY - prevPoint.y; const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 0) { finalX = finalX - (dx / dist) * NAV_OFFSET; finalY = finalY - (dy / dist) * NAV_OFFSET; }
    }
    return [...waypoints, { x: finalX, y: finalY, depth: targetDepth || 3, zone: targetZone }];
  }, []);

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
        }, 3000); // 3000ms to match the CSS ascent animation duration
      }, 800);
    } else setAir(a => a - 1);
  }, [level.id, level.mechanics.hasAir, level.campPos, navigateTo, isTransformed]);

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
    const rect = mapRef.current.getBoundingClientRect();
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

    setAttachedEntityId(null);
    saveHistory();
    setIsAnimatingLoot(true);

    const newPath = navigateTo(level.campPos.x, level.campPos.y, 1, level.campPos.depth || 3, false);
    const lastPos = pathHistory[pathHistory.length - 1];
    const finalPos = newPath[newPath.length - 1];

    setPathHistory(prev => {
      if (lastPos.x === finalPos.x && lastPos.y === finalPos.y) return prev;
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

    setAttachedEntityId(null);
    saveHistory();
    setIsAnimatingLoot(true);

    const newPath = navigateTo(campItem.x, campItem.y, 1, level.campPos.depth || 3, false);
    const lastPos = pathHistory[pathHistory.length - 1];
    const finalPos = newPath[newPath.length - 1];

    setPathHistory(prev => {
      if (lastPos.x === finalPos.x && lastPos.y === finalPos.y) return prev;
      return [...prev, ...newPath];
    });

    setTimeout(() => {
      setCampItems(prev => prev.filter(i => i.uid !== campItem.uid));
      setInventory(prev => [...prev, campItem.id]);
      setIsAnimatingLoot(false);
      if (level.mechanics.hasAir) setAir(MAX_AIR);
    }, 800);
  };

  const handleCellClick = (e, targetX, targetY) => {
    e.stopPropagation();
    if (isVictorious || isDemonstrating || isAnimatingLoot || isRefillingAir) return;

    saveHistory();
    setIsAnimatingLoot(true);
    const currentZone = pathHistory[pathHistory.length - 1].zone || 1;
    setAttachedEntityId(null);
    setPathHistory(prev => [...prev, { x: targetX, y: targetY, depth: 3, zone: currentZone }]);
    setTimeout(() => { setIsAnimatingLoot(false); handlePostActionAir(targetY); }, 800);
  };

  const toggleInventoryType = (itemId) => {
    if (isDemonstrating || isRefillingAir) return;
    // Allow selection even if a small loot animation is playing, to make it feel more responsive
    if (selectedItemTypes.includes(itemId)) setSelectedItemTypes(prev => prev.filter(i => i !== itemId));
    else setSelectedItemTypes(prev => [...prev, itemId]);
  };

  const handleInteract = (entity, e) => {
    e.stopPropagation();
    if (isVictorious || isDemonstrating || isAnimatingLoot || isRefillingAir) return;

    if (attachedEntityId && attachedEntityId !== entity.id) setAttachedEntityId(null);

    const isReverseAccess = entity.isGatekeeper && entity.unlocksZones && entity.unlocksZones.some(z => unlockedZones.includes(z));

    const isElevator = entity.roamClass?.includes('elevator');
    let targetY = entity.y;

    // For the dolphin (custom-movement entity), use its current visual Y so navigation
    // places the hero at the dolphin's actual on-screen location.
    if (level.id === 'underwater' && entity.id === 'dolphin_1' && puzzle) {
      const cm = (() => {
        const t = (Date.now() / 1000) * 0.9;
        const n = 6;
        const cosT = Math.cos(t); const sinT = Math.sin(t);
        const normX = Math.sign(cosT) * Math.pow(Math.abs(cosT), 2 / n);
        const normY = Math.sign(sinT) * Math.pow(Math.abs(sinT), 2 / n);
        return { x: 50 + normX * 12, y: dolphinYPos + normY * (dolphinZone === 1 ? 5 : 3) };
      })();
      targetY = cm.y;
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
    const newPath = navigateTo(targetX, targetY, entity.zone, entity.depth || 3, true);
    const lastPos = pathHistory[pathHistory.length - 1];
    const finalPos = newPath[newPath.length - 1];

    setPathHistory(prev => {
      if (lastPos.x === finalPos.x && lastPos.y === finalPos.y) return prev;
      return [...prev, ...newPath];
    });

    if (defeated.includes(entity.id)) {
      // If it's a tamed elevator/dolphin, re-attach so it carries the hero
      if (entity.roamClass?.includes('elevator')) {
        setAttachedEntityId(entity.id);
        if (entity.id === 'dolphin_1') {
          const newDolphinZone = dolphinZone === 1 ? 2 : 1;
          setDolphinZone(newDolphinZone);
          // Dolphin: dive or rise to the new zone
          setTimeout(() => {
            const finalDst = { x: 50, y: newDolphinZone === 1 ? 16 : 60, zone: newDolphinZone };
            setPathHistory(prev => [...prev, finalDst]);
            setAttachedEntityId(null);
            setIsAnimatingLoot(false);
          }, 1800);
          setIsAnimatingLoot(true);
          return;
        }
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

      if (level.id === 'underground' && entity.isTreasure) {
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

    // Special case: Underwater "free" un-transformation
    const isFreeUnTransform = level.id === 'underwater' && entity.id === 'sea_witch' && isTransformed && hasDeepTreasure;

    if (!isFreeUnTransform && selectedItemTypes.length === 0 && entity.requires && entity.requires.length > 0) {
      setSelectedEntityId(prev => prev === entity.id ? null : entity.id);
      handlePostActionAir(targetY);
      setIsAnimatingLoot(false); // Safety clear
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

      // New: Underwater transformation / treasure logic
      if (level.id === 'underwater') {
        if (entity.id === 'sea_witch') {
          if (!isTransformed) {
            // Transform to Merman
            setIsMagicAnimating(true);
            setTimeout(() => setIsMagicAnimating(false), 1500);
            setIsTransformed(true);
            // The items are consumed below as usual
          } else if (hasDeepTreasure) {
            // Transform back to Human
            setIsMagicAnimating(true);
            setTimeout(() => setIsMagicAnimating(false), 1500);
            setIsTransformed(false);
            // No items needed for return trip, but we can consume items if the puzzle requires it
            // Actually, the solver says any req item can be used to trigger.
          } else {
            // Already transformed, no treasure yet. Just block or ignore.
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

      setDefeated(prev => {
        if (entity.id === 'sea_witch') return prev; // Witch doesn't disappear
        if (entity.id === 'dolphin_1') return [...prev, entity.id]; // record taming but keep it alive
        const newDef = [...prev, entity.id];
        if (entity.isGatekeeper && entity.unlocksZones) {
          setUnlockedZones(uz => [...new Set([...uz, ...(entity.unlocksZones || []), entity.zone])]);
        }
        return newDef;
      });

      // When dolphin is tamed with fish: show the dive animation then deposit hero into zone 2
      if (entity.id === 'dolphin_1') {
        setAttachedEntityId('dolphin_1');

        const newDolphinZone = dolphinZone === 1 ? 2 : 1;
        setDolphinZone(newDolphinZone);

        // After showing the ride, release at the new zone
        setTimeout(() => {
          const finalDst = { x: 50, y: newDolphinZone === 1 ? 16 : 60, zone: newDolphinZone };
          setPathHistory(prev => [...prev, finalDst]);
          setAttachedEntityId(null);
          setIsAnimatingLoot(false);
        }, 1800);
        // Don't fall through to the normal reward/isAnimatingLoot clear below
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
        // SPRAY INK (Defensive mechanic)
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
          }, 8000); // Fog lasts 8 seconds
        }, 600);
        setIsAnimatingLoot(false);
        setSelectedItemTypes([]);
      } else {
        // WRONG ITEMS OR ALREADY DEFEATED
        setAlertEntityId(entity.id);
        setTimeout(() => setAlertEntityId(null), 600);
        setSelectedItemTypes([]);
        setIsAnimatingLoot(false);
      }
    }
    handlePostActionAir(entity.y);
  };

  const renderMenu = () => {
    if (!isMenuOpen) return null;
    return (
      <div className="absolute inset-0 z-[300] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 font-serif" dir={lang === 'he' ? 'rtl' : 'ltr'}>
        <div className="bg-stone-800 border-4 border-stone-600 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl flex flex-col gap-6 text-stone-200">
          {menuView === 'main' ? (
            <>
              <h2 className="text-3xl font-black text-amber-500 text-center border-b-2 border-stone-600 pb-4">{dict.menu}</h2>
              <button onClick={handleReplay} className="w-full bg-stone-600 py-4 rounded-xl font-bold text-xl hover:bg-stone-500 shadow-lg border-b-4 border-stone-800 active:border-b-0 active:translate-y-1">{dict.restart}</button>
              <button onClick={handleShowSolution} disabled={isVictorious || isDemonstrating || isAnimatingLoot || !puzzle} className="w-full bg-indigo-600 py-4 rounded-xl font-bold text-xl hover:indigo-500 shadow-lg border-b-4 border-indigo-800 active:border-b-0 active:translate-y-1 disabled:opacity-50">{dict.showSolution}</button>
              <button onClick={() => setMenuView('settings')} className="w-full bg-amber-600 py-4 rounded-xl font-bold text-xl hover:bg-amber-500 shadow-lg border-b-4 border-amber-800 active:border-b-0 active:translate-y-1">{dict.generateMap}</button>
              <button onClick={() => setIsMenuOpen(false)} className="mt-4 text-stone-400 hover:text-white font-bold tracking-widest uppercase transition-colors">{dict.resume}</button>
            </>
          ) : (
            <>
              <h2 className="text-3xl font-black text-amber-500 text-center border-b-2 border-stone-600 pb-4">{dict.settings}</h2>
              <div className="space-y-4">
                <label className="flex flex-col gap-2 font-bold text-lg pt-2">
                  <span>{dict.level}</span>
                  <select className="w-full bg-stone-900 border-2 border-stone-600 rounded-lg p-3 outline-none focus:border-amber-500 text-amber-400" value={menuSettings.levelId} onChange={(e) => setMenuSettings({ ...menuSettings, levelId: e.target.value })}>{Object.values(LEVEL_DICTIONARY).map(lvl => <option key={lvl.id} value={lvl.id}>{dict.levels[lvl.id] || lvl.name}</option>)}</select>
                </label>
                <label className="flex flex-col gap-2 font-bold text-lg pt-2"><span className="flex justify-between"><span>{dict.minQuestChain}</span> <span className="text-amber-400">{menuSettings.steps}</span></span><input type="range" min="3" max="8" value={menuSettings.steps} onChange={(e) => setMenuSettings({ ...menuSettings, steps: parseInt(e.target.value) })} className="w-full accent-amber-500 h-2 bg-stone-900 rounded-lg appearance-none cursor-pointer" /></label>
                <label className="flex flex-col gap-2 font-bold text-lg"><span className="flex justify-between"><span>{dict.diggersMemory}</span> <span className="text-amber-400">{menuSettings.diggers}</span></span><input type="range" min="0" max="3" value={menuSettings.diggers} onChange={(e) => setMenuSettings({ ...menuSettings, diggers: parseInt(e.target.value) })} className="w-full accent-amber-500 h-2 bg-stone-900 rounded-lg appearance-none cursor-pointer" /></label>
                <button onClick={() => onGenerateNew(menuSettings)} className="w-full bg-amber-600 py-4 mt-2 rounded-xl font-bold text-xl hover:bg-amber-500 shadow-lg border-b-4 border-amber-800 active:border-b-0 active:translate-y-1">{dict.genMap}</button>
              </div>
              <button onClick={() => setMenuView('main')} className="mt-4 text-stone-400 hover:text-white font-bold tracking-widest uppercase transition-colors">{dict.back}</button>
            </>
          )}
        </div>
      </div>
    );
  };

  if (generationFailed) return (
    <div className="min-h-screen bg-stone-900 flex flex-col items-center justify-center font-serif relative p-4 text-center">
      <div className="text-red-500 text-3xl font-black mb-4">{dict.genFailedTitle}</div>
      <div className="text-stone-300 max-w-md">{dict.genFailedDesc}</div>
      <button onClick={() => { setMenuView('settings'); setIsMenuOpen(true); }} className="mt-8 bg-stone-700 p-4 rounded-xl text-white font-bold hover:bg-stone-600 transition-colors z-[100] relative">{dict.openSettings}</button>
      {renderMenu()}
    </div>
  );

  if (!puzzle) return <div className="min-h-screen bg-stone-900 flex flex-col items-center justify-center font-serif relative">
    <div className="absolute inset-0 bg-stone-900 opacity-80 z-40 backdrop-blur" />
    <div className="text-amber-500 text-3xl font-black z-50 animate-pulse tracking-widest uppercase shadow-black drop-shadow-lg border-y-2 border-amber-500 py-4 px-12">{dict.generating}</div>
  </div>;

  const playerPos = pathHistory[pathHistory.length - 1];
  const displayPlayerPos = tempPlayerPos || playerPos;
  const playerDepth = displayPlayerPos.depth || 3;
  const playerScale = playerDepth === 1 ? 'scale-50' : playerDepth === 2 ? 'scale-75' : 'scale-100';
  const playerFilter = playerDepth === 1 ? 'blur-[2px] brightness-75 hue-rotate-[-15deg]' : playerDepth === 2 ? 'blur-[1px] brightness-90 hue-rotate-[-5deg]' : '';
  const playerZ = playerDepth * 10 + 5;
  const uniqueInventoryItems = Array.from(new Set(inventory));

  const totalMapHeight = level.mechanics.isVertical ? `${level.mechanics.screens * 100}%` : '100%';

  let mapTranslateY = '0%';
  if (level.mechanics.isVertical) {
    const screenPct = 100 / level.mechanics.screens;
    const maxScrollPct = 100 - screenPct;
    // Use playerVisualY (which tracks attached entity) for camera so camera follows dolphin/drowning correctly.
    // We compute it early here for the camera, then recompute for rendering below.
    const _attachedEnt = puzzle ? puzzle.puzzleEntities.find(e => e.id === attachedEntityId) : null;
    let _scrollY = displayPlayerPos.y;
    if (_attachedEnt) {
      // Mirror the squircle y so camera tracks the dolphin
      if (_attachedEnt.id === 'dolphin_1') {
        const _t = gameTime * 0.8;
        const _n = 6;
        const _sinT = Math.sin(_t);
        const _normY = Math.sign(_sinT) * Math.pow(Math.abs(_sinT), 2 / _n);
        const yRange = dolphinZone === 1 ? 7 : 3;
        _scrollY = dolphinYPos + _normY * yRange;
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
  const heroFace = isDrowning ? '😵' : (isTransformed ? '🧜‍♂️' : '🤠');
  const playerTransition = isDrowning ? 'duration-[3000ms] ease-linear' : 'duration-700 ease-in-out';
  const GatekeeperProp = level.GatekeeperPropComponent;

  const getCustomEntityMovement = (ent) => {
    if (level.id !== 'underwater') return null;
    if (ent.id === 'dolphin_1') {
      // Dolphin patrols surface or deep zone, toggling on interact
      const t = gameTime * 0.9;
      const n = 6;
      const cosT = Math.cos(t);
      const sinT = Math.sin(t);
      const normX = Math.sign(cosT) * Math.pow(Math.abs(cosT), 2 / n);
      const normY = Math.sign(sinT) * Math.pow(Math.abs(sinT), 2 / n);
      const x = 50 + normX * 12; // narrow side-to-side
      const yRange = dolphinZoneRef.current === 1 ? 7 : 3;
      const y = dolphinYPos + normY * yRange;
      const flip = cosT < 0;
      return { x, y, rotate: 0, flip };
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

  let playerVisualX = displayPlayerPos.x;
  let playerVisualY = displayPlayerPos.y;
  let playerRotation = 0;

  if (attachedEntityId) {
    const attachedEnt = puzzle.puzzleEntities.find(e => e.id === attachedEntityId);
    if (attachedEnt) {
      const custom = getCustomEntityMovement(attachedEnt);
      if (custom) {
        playerVisualX = custom.x;
        playerVisualY = custom.y;
        playerRotation = custom.rotate;
      } else if (attachedEnt.roamClass?.includes('elevator')) {
        playerVisualY += Math.sin(gameTime * 1.5 + (attachedEnt.id.length * 0.7)) * 20;
      }
    }
  }

  return (
    <div className="h-[100dvh] w-full bg-stone-900 flex flex-col items-center justify-center p-0 sm:p-4 font-serif select-none overflow-hidden relative">
      {isMagicAnimating && (
        <div className="fixed inset-0 z-[500] pointer-events-none flex items-center justify-center">
          <div className="absolute inset-0 bg-white/20 backdrop-blur-[2px] animate-pulse" />
          <div className="relative w-full h-full">
            {[...Array(40)].map((_, i) => (
              <div key={i} className="absolute text-4xl animate-magic-particle" style={{
                left: `${playerVisualX}%`,
                top: `${playerVisualY}%`,
                '--dx': `${(Math.random() - 0.5) * 600}px`,
                '--dy': `${(Math.random() - 0.5) * 600}px`,
                '--rot': `${Math.random() * 360}deg`,
                animationDelay: `${Math.random() * 0.5}s`
              }}>
                {['✨', '🌟', '💫', '🟣', '💎'][Math.floor(Math.random() * 5)]}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col w-full h-[100dvh] sm:w-auto sm:h-[95dvh] sm:aspect-[9/19.5] sm:max-w-[45dvh] sm:rounded-3xl shadow-2xl relative ring-0 sm:ring-8 ring-stone-950 overflow-hidden mx-auto" style={{ containerType: 'inline-size', containerName: 'game' }}>
        <div ref={mapRef} className="@container relative w-full flex-1 bg-[#dcb27b] shadow-[inset_0_0_80px_rgba(100,50,0,0.6),0_10px_30px_rgba(0,0,0,0.5)] overflow-hidden">

          {level.mechanics.hasAir && !isTransformed && (
            <div
              title="Swim back to boat"
              onClick={(e) => {
                e.stopPropagation();
                if (isVictorious || isDemonstrating || isAnimatingLoot || isRefillingAir) return;
                // Only useful if hero is not already at surface
                const curY = pathHistory[pathHistory.length - 1].y;
                if (curY <= level.campPos.y + 2) return;
                setAttachedEntityId(null);
                saveHistory();
                setIsAnimatingLoot(true);
                const returnPath = navigateTo(level.campPos.x, level.campPos.y, 1, level.campPos.depth || 3, false);
                setPathHistory(prev => [...prev, ...returnPath]);
                setTimeout(() => { setIsAnimatingLoot(false); setAir(MAX_AIR); }, 800);
              }}
              className="absolute top-4 left-1/2 transform -translate-x-1/2 flex gap-1 z-[150] bg-blue-900/60 p-2 sm:p-3 rounded-full border-2 border-blue-400 backdrop-blur-md shadow-lg cursor-pointer hover:bg-blue-700/80 hover:border-blue-300 transition-colors select-none"
            >
              {[...Array(MAX_AIR)].map((_, i) => (
                <div key={i} className={`text-xl sm:text-2xl transition-all duration-300 ${i < air ? 'opacity-100 scale-100' : 'opacity-30 scale-75 drop-shadow-none grayscale'}`}>🫧</div>
              ))}
            </div>
          )}


          <div className="absolute inset-x-0 top-0 transition-transform duration-1000 ease-in-out pointer-events-auto animate-map-appear" style={{ height: totalMapHeight, transform: `translateY(${mapTranslateY})` }}>
            <Background />

            {level.mechanics.hasDarkness && level.mechanics.darknessType === 'horizontal' && (
              <>
                <div className={`absolute inset-y-0 left-0 w-1/2 bg-black transition-all duration-1000 z-[90] pointer-events-none ${unlockedZones.includes(1) ? 'opacity-0' : 'opacity-100 pointer-events-auto'}`} />
                <div className={`absolute inset-y-0 right-0 w-1/2 bg-black transition-all duration-1000 z-[90] pointer-events-none ${unlockedZones.includes(2) ? 'opacity-0' : 'opacity-100 pointer-events-auto'}`} />
              </>
            )}

            {level.id === 'underground' && level.mechanics.hasFog && (
              <div className="absolute inset-0 pointer-events-none z-[150]">
                {!unlockedZones.includes(2) && <div className="absolute left-0 w-[55%] bg-gradient-radial from-[#110c08]/80 via-[#110c08] to-[#110c08] backdrop-blur-md transition-opacity duration-1000 shadow-[inset_0_0_40px_rgba(0,0,0,0.8)]" style={{ top: '22%', height: '24%' }} />}
                {!unlockedZones.includes(3) && <div className="absolute right-0 w-[55%] bg-gradient-radial from-[#110c08]/80 via-[#110c08] to-[#110c08] backdrop-blur-md transition-opacity duration-1000 shadow-[inset_0_0_40px_rgba(0,0,0,0.8)]" style={{ top: '25%', height: '18%' }} />}
                {!unlockedZones.includes(4) && <div className="absolute left-0 w-[55%] bg-[#110c08] transition-opacity duration-1000 shadow-2xl" style={{ top: '46%', height: '22%' }} />}
                {!unlockedZones.includes(5) && <div className="absolute right-0 w-[55%] bg-[#110c08] transition-opacity duration-1000 shadow-2xl" style={{ top: '43%', height: '28%' }} />}
                {!unlockedZones.includes(6) && <div className="absolute left-0 right-0 w-full bg-[#110c08] transition-opacity duration-1000 shadow-2xl" style={{ top: '68%', height: '10%' }} />}
                {!unlockedZones.includes(7) && <div className="absolute left-0 right-0 w-full bg-[#110c08] transition-opacity duration-1000 shadow-2xl" style={{ top: '78%', height: '10%' }} />}
                {!unlockedZones.includes(8) && <div className="absolute left-0 right-0 w-full bg-[#110c08] transition-opacity duration-1000 shadow-2xl" style={{ top: '88%', height: '7%' }} />}
                {!unlockedZones.includes(9) && <div className="absolute left-0 right-0 w-full bg-[#110c08] transition-opacity duration-1000 shadow-2xl" style={{ top: '95%', height: '5%' }} />}
              </div>
            )}
            {level.id !== 'underground' && level.mechanics.hasFog && (
              <div className="absolute inset-0 pointer-events-none z-[120]">
                {!unlockedZones.includes(2) && <div className="absolute left-0 w-[50%] bg-[#110c08] transition-opacity duration-1000" style={{ top: '21%', height: '22%' }} />}
                {!unlockedZones.includes(3) && <div className="absolute right-0 w-[50%] bg-[#110c08] transition-opacity duration-1000" style={{ top: '21%', height: '22%' }} />}
                {!unlockedZones.includes(4) && <div className="absolute left-0 w-[50%] bg-[#110c08] transition-opacity duration-1000" style={{ top: '45%', height: '20%' }} />}
                {!unlockedZones.includes(5) && <div className="absolute right-0 w-[50%] bg-[#110c08] transition-opacity duration-1000" style={{ top: '45%', height: '20%' }} />}
                {!unlockedZones.includes(6) && <div className="absolute left-0 right-0 w-full bg-[#110c08] transition-opacity duration-1000" style={{ top: '65%', height: '12%' }} />}
                {!unlockedZones.includes(7) && <div className="absolute left-0 right-0 w-full bg-[#110c08] transition-opacity duration-1000" style={{ top: '77%', height: '10%' }} />}
                {!unlockedZones.includes(8) && <div className="absolute left-0 right-0 w-full bg-[#110c08] transition-opacity duration-1000" style={{ top: '87%', height: '8%' }} />}
                {!unlockedZones.includes(9) && <div className="absolute left-0 right-0 w-full bg-[#110c08] transition-opacity duration-1000" style={{ top: '95%', height: '5%' }} />}
              </div>
            )}

            {level.mechanics.hasDarkness && level.mechanics.darknessType === 'radial' && (
              <div className="absolute inset-0 pointer-events-none z-[98] transition-all duration-300 ease-linear animate-torch-flicker" style={{ background: `radial-gradient(ellipse 80vw 100vh at ${displayPlayerPos.x}% ${displayPlayerPos.y}%, transparent 0%, transparent 30%, rgba(0,0,0,0.4) 50%, rgba(0,0,0,0.95) 80%, #000 100%)` }} />
            )}

            {level.sceneryNodes?.map((sc, i) => {
              const sDist = level.mechanics.darknessType === 'radial' ? Math.sqrt(Math.pow(sc.x - displayPlayerPos.x, 2) + Math.pow(sc.y - displayPlayerPos.y, 2)) : 100;
              const sZ = sDist < 28 ? 99 : (sc.z || (sc.depth || 3) * 10);
              return <div key={`sc-${i}`} className={`absolute transform -translate-x-1/2 -translate-y-1/2 ${sc.s} pointer-events-none`} style={{ left: `${sc.x}%`, top: `${sc.y}%`, zIndex: sZ }}>{sc.e}</div>;
            })}

            {level.mechanics.hasFish && envItemState === 'active' && (<div className="absolute cursor-pointer text-3xl animate-fish-swim hover:scale-125 transition-transform" style={{ zIndex: 25 }} onClick={handleCatchRiverFish}>🐟</div>)}
            {level.mechanics.hasFish && envItemState === 'caught' && (<div className="absolute flex flex-col items-center animate-loot-fly pointer-events-none drop-shadow-xl" style={{ left: `${envItemCaughtPos.x}%`, top: `${envItemCaughtPos.y}%`, zIndex: 90 }}><span className="text-3xl">🐟</span></div>)}

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



            {roamingBoats.map(b => {
              return (
                <div key={b.id} onClick={(e) => handleBoatTrade(e, b)} className={`absolute cursor-pointer z-[120] hover:scale-110 drop-shadow-xl ${b.isRight ? 'animate-boat-glide-right' : 'animate-boat-glide-left'}`} style={{ top: '11%' }}>
                  <BoatSVG />
                  <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-white/90 border-2 border-amber-600 rounded-full p-2 flex items-center gap-1 shadow-lg animate-bounce">
                    <span className="text-xl">🐟</span>
                    <span className="text-sm font-bold">➡️</span>
                    <span className="text-xl">{level.items.find(i => i.id === b.offeredItem)?.emoji}</span>
                  </div>
                  {alertEntityId === b.id && <div className="absolute inset-0 flex items-center justify-center text-4xl animate-troll-mad">🚫</div>}
                </div>
              );
            })}

            {level.id !== 'underwater' && (
              <svg className="absolute inset-0 w-full h-full pointer-events-none drop-shadow-md z-[99]" preserveAspectRatio="none">
                {pathHistory.map((pos, i) => { if (i === 0) return null; const prev = pathHistory[i - 1]; return <line key={i} x1={`${prev.x}%`} y1={`${prev.y}%`} x2={`${pos.x}%`} y2={`${pos.y}%`} stroke="#4a2211" strokeWidth="5" strokeDasharray="12 12" className="animate-[dash_1s_linear_forwards]" style={{ strokeDashoffset: 100 }} vectorEffect="non-scaling-stroke" />; })}
                {tempPlayerPos && <line x1={`${playerPos.x}%`} y1={`${playerPos.y}%`} x2={`${tempPlayerPos.x}%`} y2={`${tempPlayerPos.y}%`} stroke="#4a2211" strokeWidth="5" strokeDasharray="12 12" opacity="0.5" vectorEffect="non-scaling-stroke" />}
              </svg>
            )}

            {campItems.map(item => {
              const itemData = level.items.find(i => i.id === item.id);
              if (!itemData) return null;
              const isAlerting = alertEntityId === item.uid;
              return (
                <div key={item.uid} onClick={(e) => handleCampItemClick(e, item)} className={`absolute transform -translate-x-1/2 -translate-y-1/2 z-[15] cursor-pointer hover:scale-125 transition-transform ${isAlerting ? 'animate-troll-mad' : ''}`} style={{ left: `${item.x}%`, top: `${item.y}%` }}>
                  <div className="text-3xl drop-shadow-md">{isAlerting ? '🚫' : itemData.emoji}</div>
                </div>
              );
            })}

            <div onClick={handleCampClick} className={`absolute transform -translate-x-1/2 -translate-y-1/2 transition-all ${selectedItemTypes.length > 0 ? 'cursor-pointer hover:scale-110 drop-shadow-[0_0_15px_rgba(255,255,255,0.8)]' : (!selectedItemTypes.length && level.mechanics.hasAir ? 'cursor-pointer hover:scale-110' : '')}`} style={{ left: `${level.campPos.x}%`, top: `${level.campPos.y}%`, zIndex: (Math.sqrt(Math.pow(level.campPos.x - displayPlayerPos.x, 2) + Math.pow(level.campPos.y - displayPlayerPos.y, 2)) < 28) ? 110 : 10 }}>
              <div className="relative">
                {level.CampIcon ? <level.CampIcon /> : <div className="text-6xl drop-shadow-lg scale-x-[-1] animate-flicker">🔥</div>}
                {selectedItemTypes.length > 0 && (
                  <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-white text-stone-900 text-xs font-black px-2 py-1 rounded-xl shadow-xl animate-bounce whitespace-nowrap border-2 border-stone-800">
                    ⬇️ Drop Item
                  </div>
                )}
              </div>
            </div>

            {flyingItem && (<div className="absolute animate-loot-fly drop-shadow-2xl text-6xl pointer-events-none" style={{ left: `${flyingItem.x}%`, top: `${flyingItem.y}%`, zIndex: flyingItem.zIndex || 90 }}>{flyingItem.emoji}</div>)}

            {massFlyingTreasures.map((item, idx) => (
              <div key={`mass-treas-${idx}`} className="absolute animate-loot-fly drop-shadow-2xl text-6xl pointer-events-none" style={{ left: `${item.x}%`, top: `${item.y}%`, zIndex: 110, animationDelay: `${item.delay}ms` }}>{item.emoji}</div>
            ))}

            {level.id === 'river_crossing' && puzzle?.puzzleEntities.some(e => e.id === puzzle.goalEntityId) && (
              <div className="absolute transform -translate-x-1/2 -translate-y-1/2 pointer-events-none z-20" style={{ left: '50%', top: '22%' }}>
                <CaveEntranceProp />
              </div>
            )}

            {console.log('Rendering puzzleEntities:', puzzle.puzzleEntities.map(p => p.id))}
            {puzzle.puzzleEntities.map(ent => {
              const isDefeated = defeated.includes(ent.id);
              if (ent.isPreset && isDefeated) return null;

              const isGoal = ent.id === puzzle.goalEntityId;
              const rewardItem = ent.reward ? level.items.find(i => i.id === ent.reward) : null;
              const isAlerting = alertEntityId === ent.id;
              const isSelected = selectedEntityId === ent.id;
              const depthScale = (ent.depth === 1) ? 'scale-50' : (ent.depth === 2) ? 'scale-75' : 'scale-100';
              const depthFilter = (ent.depth === 1) ? 'blur-[2px] brightness-75 hue-rotate-[-15deg]' : (ent.depth === 2) ? 'blur-[1px] brightness-90 hue-rotate-[-5deg]' : '';
              const isAnimating = animatingEntities.includes(ent.id);

              const isDigger = Boolean(level.specialEntityTemplate && ent.id?.startsWith(level.specialEntityTemplate) && !ent.isGoal);
              const isRock = ent.isGatekeeper && level.mechanics.hasPickaxe && ent.id !== 'final_gate';
              const isCurrent = ent.id === 'current' || (ent.isGatekeeper && ent.id?.startsWith('current_'));

              const inFog = (level.mechanics.hasFog && !unlockedZones.includes(ent.zone) && !(ent.isGatekeeper && ent.unlocksZones && ent.unlocksZones.some(z => unlockedZones.includes(z)))) || inkFogEntities.has(ent.id);

              const eDist = level.mechanics.darknessType === 'radial' ? Math.sqrt(Math.pow(ent.x - displayPlayerPos.x, 2) + Math.pow(ent.y - displayPlayerPos.y, 2)) : 100;
              const inLight = eDist < 28;
              const entZ = isSelected ? 200 : ((inLight && !inFog) ? 140 : (isRock ? 130 : (ent.isGatekeeper ? 110 : (ent.depth || 3) * 10 + 5)));

              const interactableHover = inFog ? 'pointer-events-none cursor-default opacity-0 invisible scale-0 transition-opacity duration-1000' : (isDefeated && !ent.isGatekeeper && ent.id !== 'dolphin_1') || (isRock && isDefeated) || (isCurrent && isDefeated) ? 'cursor-default' : 'hover:scale-110 cursor-pointer';
              const wrapperClasses = `absolute flex flex-col items-center transition-all duration-300 ${(ent.roamClass && !ent.roamClass.includes('elevator')) ? ent.roamClass : 'transform -translate-x-1/2 -translate-y-1/2'} ${interactableHover}`;

              const isNearLeft = !ent.roamClass && ent.x <= 20;
              const isNearRight = !ent.roamClass && ent.x >= 80;
              const isNearTop = ent.y <= 25;
              const tooltipAlign = isNearLeft ? "left-0" : isNearRight ? "right-0" : "left-1/2 -translate-x-1/2";
              const tooltipY = isNearTop ? "top-full mt-2" : "bottom-full mb-2";
              const arrowAlign = isNearLeft ? "left-4" : isNearRight ? "right-4" : "left-1/2 -translate-x-1/2";
              const arrowY = isNearTop ? "-top-[7px] border-t-2 border-l-2" : "-bottom-[7px] border-b-2 border-r-2";

              const isBuried = isDigger && buriedEntities.includes(ent.id);
              const groupedReqs = (ent.requires || []).reduce((acc, reqId) => { acc[reqId] = (acc[reqId] || 0) + 1; return acc; }, {});
              const customMove = getCustomEntityMovement(ent);
              const isElevator = ent.roamClass?.includes('elevator');
              let visualX = ent.x;
              let visualY = ent.y;
              let visualRotation = 0;
              let isFlipped = ent.isRight;

              if (customMove) {
                visualX = customMove.x;
                visualY = customMove.y;
                visualRotation = customMove.rotate;
                isFlipped = customMove.flip;
              } else if (isElevator) {
                // Large vertical swim range for "elevators"
                visualY += Math.sin(gameTime * 1.5 + (ent.id.length * 0.7)) * 20;
              }
              const entityStyle = { left: `${visualX}%`, top: `${visualY}%`, zIndex: entZ, transform: `translate(-50%, -50%) rotate(${visualRotation}deg)` };

              return (
                <div key={ent.id} onClick={(e) => handleInteract(ent, e)} className={wrapperClasses} style={entityStyle}>
                  <div className={`relative ${depthScale} ${depthFilter}`}>
                    {!isDefeated && isSelected && !ent.isPreset && (
                      <div className={`absolute ${tooltipY} ${tooltipAlign} z-[100]`}>
                        <div className="relative bg-white border-2 border-stone-800 rounded-2xl px-3 py-1.5 flex items-center shadow-xl text-lg font-bold whitespace-nowrap animate-bounce gap-1">
                          {ent.id === 'final_gate' ? (
                            <>
                              <span className="emoji-shadow">🔑</span><span className="text-sm font-black text-amber-600 shadow-none ml-1">x3</span>
                            </>
                          ) : isRock ? (
                            <>
                              <span className="emoji-shadow">⛏️</span><span className="text-sm font-black text-amber-600 shadow-none ml-1">x1</span>
                            </>
                          ) : (
                            Object.entries(groupedReqs).map(([reqId, count], i, arr) => (
                              <Fragment key={reqId}>
                                <span className="flex items-center gap-1 emoji-shadow" title={dict.items[reqId] || reqId}>
                                  {count > 1 && <span className="text-sm font-black text-amber-600" style={{ textShadow: 'none' }}>{count}x</span>}
                                  {level.items.find(item => item.id === reqId)?.emoji || '❓'}
                                </span>
                                {i < arr.length - 1 && <span className="text-sm mx-1 text-stone-500 font-black">{ent.reqType === 'AND' ? '&' : dict.or}</span>}
                              </Fragment>
                            ))
                          )}
                          <div className={`absolute ${arrowY} ${arrowAlign} w-3 h-3 bg-white border-stone-800 rotate-45`}></div>
                        </div>
                      </div>
                    )}

                    <div className="relative">
                      {ent.isGatekeeper && !isRock && !isCurrent && GatekeeperProp && <GatekeeperProp />}

                      <div className={`relative transition-all duration-700 ease-in-out ${(!isRock && !isCurrent && ent.isGatekeeper && isDefeated) ? 'translate-x-12 translate-y-6 rotate-12 opacity-60 grayscale' : (!isRock && !isCurrent && ent.isGatekeeper && isSelected) ? 'translate-x-8 translate-y-2 rotate-3' : (!isRock && !isCurrent && isDefeated && ent.id !== 'dolphin_1') ? 'opacity-50 grayscale' : ''}`}>

                        {!isGoal && !ent.isRepeatable && !ent.isPreset && (
                          level.id === 'underwater' ? (
                            null
                          ) : (!isDefeated && rewardItem && isBuried) ? (
                            <>
                              <div className={`absolute top-0 left-0 text-[9cqw] drop-shadow-md pointer-events-none transition-all duration-500 ease-out ${ent.x > 50 ? '-translate-x-12' : 'translate-x-12'} translate-y-2 scale-90 opacity-90 -z-20`}>🕳️</div>
                              <div className={`absolute top-0 left-0 text-[9cqw] drop-shadow-md pointer-events-none transition-all duration-500 ease-out ${isSelected ? `${ent.x > 50 ? '-translate-x-16' : 'translate-x-16'} -translate-y-4 rotate-12 scale-110 z-0 opacity-100` : `${ent.x > 50 ? '-translate-x-12' : 'translate-x-12'} translate-y-2 scale-0 opacity-0 -z-10`}`}>❓</div>
                            </>
                          ) : (!isDefeated && rewardItem && !isBuried) ? (
                            <div className={`absolute top-0 left-0 text-[9cqw] drop-shadow-md pointer-events-none transition-all duration-500 ease-out ${isSelected ? `${ent.x > 50 ? '-translate-x-10' : 'translate-x-10'} -translate-y-4 rotate-12 scale-110 z-0` : `${ent.x > 50 ? '-translate-x-8' : 'translate-x-8'} translate-y-0 rotate-0 scale-90 opacity-90 -z-10 animate-bob`}`}>{rewardItem.emoji}</div>
                          ) : null
                        )}

                        <div className={`drop-shadow-xl relative z-10 ${ent.isGatekeeper || isGoal ? 'text-[15cqw]' : 'text-[9cqw]'}`}>
                          {(isRock || ent.isExtraRock) && !isDefeated ? (
                            <div className={`flex justify-center items-center transition-transform ${isRock ? 'cursor-pointer' : 'pointer-events-none'}`}>
                              {level.RockComponent ? <level.RockComponent isDefeated={false} isAlerting={isAlerting} seed={ent.id} size={ent.size || 'large'} /> : <span className="text-[1.2em] drop-shadow-md">🪨</span>}
                            </div>
                          ) : (isRock || ent.isExtraRock) && isDefeated ? (
                            <div className="relative group text-[0.8em] flex justify-center cursor-pointer z-50 animate-rock-shatter">
                              {level.RockComponent ? <level.RockComponent isDefeated={true} isAlerting={false} seed={ent.id} size={ent.size || 'large'} /> : <span className="text-[1.2em] drop-shadow-md">🪨</span>}
                            </div>
                          ) : isCurrent && isDefeated ? (
                            <div className="text-[9cqw] opacity-0 scale-0 transition-all duration-500">🌀</div>
                          ) : isCurrent && !isDefeated ? (
                            <div className={`text-[12cqw] animate-spin-slow ${isAlerting ? 'animate-troll-mad text-red-500' : 'text-cyan-400'}`}>🌀</div>
                          ) : (
                            <div className={`${ent.filterClass || ''} ${isFlipped ? 'scale-x-[-1]' : ''} ${isAnimating ? 'animate-dog-dig' : ''}`}>
                              {isAlerting && !ent.isPreset ? (ent.id.startsWith('mermaid') ? '🥺' : '😡') :
                                isAlerting ? '🚫' :
                                  level.id === 'underwater' ? (
                                    ent.id === 'sea_witch' ? (
                                      <div className="relative flex flex-col items-center">
                                        <div className="absolute inset-0 bg-purple-600 blur-2xl opacity-60 rounded-full scale-150 animate-pulse -z-10" />
                                        <span className="text-[10cqw] z-10">{ent.emoji}</span>
                                        <div className="absolute -bottom-8 bg-black/60 rounded px-2 whitespace-nowrap text-[2.5cqw] border border-purple-500 shadow-[0_0_10px_purple] z-20">🧑 ➡️ 🧜‍♂️</div>
                                      </div>
                                    ) :
                                      isElevator ? (
                                        <div className={`w-[24cqw] h-[24cqw] flex items-center justify-center text-[15cqw] font-sans drop-shadow-2xl ${!isAnimating ? 'animate-mermaid-swim' : ''} ${isAlerting ? 'animate-troll-mad' : ''}`}>
                                          {ent.emoji}
                                        </div>
                                      ) :
                                        ent.id.startsWith('clam') ? <GiantClamSVG isDefeated={isCurrent} isAlerting={isAlerting} rewardEmoji={isCurrent ? rewardItem?.emoji : null} /> :
                                          isDigger ? <GiantClamSVG isDefeated={!isBuried} isAlerting={isAlerting} rewardEmoji={isDefeated ? null : rewardItem?.emoji} /> :
                                            ent.isVent ? <BubbleVentSVG /> :
                                              ent.emoji
                                  ) : ent.emoji}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    {ent.isGatekeeper && isAlerting && <div className="absolute -bottom-5 bg-red-700 text-white text-xs font-bold px-2 py-0.5 rounded border border-red-900 shadow-md scale-110 z-30">{dict.blocked}</div>}
                    {isGoal && !isDefeated && !isAlerting && <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 text-purple-950 font-black tracking-widest text-lg drop-shadow-md z-30 bg-amber-100/80 px-2 rounded">{dict.exit}</div>}
                  </div>
                </div>
              );
            })}

            <div className={`absolute transform -translate-x-1/2 -translate-y-1/2 transition-all ${playerTransition} pointer-events-none flex items-center justify-center ${playerScale} ${playerFilter}`} style={{ left: `${playerVisualX}%`, top: `${playerVisualY}%`, zIndex: Math.max(playerZ, 130), transform: `translate(-50%, -50%) rotate(${playerRotation}deg)` }}>
              <div className={`text-white w-[10cqw] h-[10cqw] rounded-full flex items-center justify-center shadow-[0_1cqw_2cqw_rgba(0,0,0,0.8)] text-[6cqw] relative ${isTransformed ? 'bg-cyan-400 border-2 border-cyan-100 shadow-[0_0_15px_rgba(34,211,238,0.8)]' : (level.mechanics.hasAir ? 'bg-cyan-600 border-2 border-cyan-200' : 'bg-blue-600 border-2 border-white')} ${level.mechanics.heroBobs && !isDrowning ? 'animate-bob' : ''}`}>
                {heroFace}
                {level.mechanics.darknessType === 'radial' && <div className="absolute -right-3 -bottom-2 text-xl z-50 drop-shadow-[0_0_10px_rgba(251,191,36,1)]">🕯️</div>}
              </div>
              {showTrophy && <div className="absolute -right-8 top-0 text-4xl animate-bounce drop-shadow-[0_0_15px_rgba(251,191,36,0.8)]" style={{ animationDelay: '0.2s' }}>🏆</div>}
            </div>

          </div>

          <div className="absolute inset-0 opacity-10 z-[140] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#5c3a21 1px, transparent 1px)', backgroundSize: '30px 30px' }} />
          <div className="absolute top-4 left-4 z-[150] flex gap-2">
            <button onClick={(e) => { e.stopPropagation(); setLang('he'); }} className={`w-10 h-10 rounded-full border-2 ${lang === 'he' ? 'border-amber-400 scale-110 shadow-lg' : 'border-stone-600 opacity-50'} flex items-center justify-center bg-stone-800`}>🇮🇱</button>
            <button onClick={(e) => { e.stopPropagation(); setLang('en'); }} className={`w-10 h-10 rounded-full border-2 ${lang === 'en' ? 'border-amber-400 scale-110 shadow-lg' : 'border-stone-600 opacity-50'} flex items-center justify-center bg-stone-800`}>🇺🇸</button>
          </div>
          <button onClick={(e) => { e.stopPropagation(); setMenuView('main'); setIsMenuOpen(true); }} className="absolute top-4 right-4 z-[150] bg-stone-800 text-stone-200 w-12 h-12 flex items-center justify-center rounded-full border-2 border-stone-600 shadow-lg hover:bg-stone-700 transition-colors"><span className="text-xl pt-0.5">⚙️</span></button>

          {showVictoryMsg && (
            <div className="absolute inset-0 z-[100] pointer-events-none overflow-hidden">
              {[...Array(30)].map((_, i) => (<div key={i} className="absolute text-3xl animate-star-burst-infinite" style={{ left: `${10 + Math.random() * 80}%`, top: `${10 + Math.random() * 80}%`, '--tx': `${(Math.random() - 0.5) * 200}px`, '--ty': `${(Math.random() - 0.5) * 200}px`, animationDelay: `${Math.random() * 3}s` }}>{['⭐', '🌟', '✨'][Math.floor(Math.random() * 3)]}</div>))}
              <div className="absolute top-1/2 left-1/2 z-50 pointer-events-none animate-fade-out-up"><div className="bg-amber-100 p-6 rounded-3xl border-8 border-amber-600 text-center shadow-[0_0_80px_rgba(251,191,36,0.6)] whitespace-nowrap"><h2 className="text-3xl sm:text-4xl text-amber-900 font-black uppercase tracking-wider">{dict.questComplete}</h2></div></div>
            </div>
          )}
        </div>
        <div className="w-full shrink-0 bg-stone-800 border-t-2 border-stone-700 sm:border-0 shadow-[0_-10px_30px_rgba(0,0,0,0.5)] z-[150] h-[12dvh] flex items-center justify-center relative px-[2cqw]">
          <button onClick={handleUndo} disabled={isDemonstrating || isAnimatingLoot || isRefillingAir || historyStack.length === 0} className="bg-rose-700 p-[1.5cqw] rounded-[2cqw] text-[6cqw] hover:bg-rose-600 border-[0.5cqw] border-rose-600 hover:border-rose-500 transition-all shadow-lg text-white disabled:opacity-50 mr-[2cqw]">↩️</button>
          <div className="flex gap-[2cqw] bg-stone-900/50 p-[1.5cqw] rounded-[3cqw] border-[0.5cqw] border-stone-900">
            {[0, 1, 2, 3].map((slotIdx) => {
              const itemId = uniqueInventoryItems[slotIdx];
              let item = itemId ? level.items.find(x => x.id === itemId) : null;
              if (itemId === 'fish' && !item) {
                item = { id: 'fish', name: dict.items.fish, emoji: '🐟' };
              }
              const count = itemId ? inventory.filter(i => i === itemId).length : 0;
              const isSelected = item && selectedItemTypes.includes(itemId);
              return (
                <button key={`slot-${slotIdx}`} onClick={() => item && toggleInventoryType(itemId)} disabled={!item} className={`w-[14cqw] h-[14cqw] rounded-[2.5cqw] relative flex flex-col items-center justify-center transition-all ${isSelected ? 'bg-amber-400 border-[0.8cqw] border-amber-200 scale-105 shadow-[0_0_15px_rgba(251,191,36,0.6)] z-10' : item ? 'bg-stone-600 border-[0.8cqw] border-stone-500 hover:bg-stone-500 cursor-pointer' : 'bg-stone-700/50 border-[0.8cqw] border-stone-700 border-dashed cursor-default'} ${isDemonstrating || isAnimatingLoot ? 'cursor-default' : ''}`}>
                  <span className="text-[7cqw] drop-shadow-md emoji-shadow">{item ? item.emoji : ''}</span>
                  {count > 1 && <div className="absolute -bottom-[1cqw] -right-[1cqw] bg-blue-700 text-white text-[3cqw] font-black rounded-full px-[1.5cqw] py-0 border-[0.4cqw] border-blue-400 shadow-md">{count}</div>}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {renderMenu()}
    </div>
  );
}



const App = () => {
  const [activeSettings, setActiveSettings] = useState({ levelId: 'underground', steps: 5, diggers: 1 });
  const [gameKey, setGameKey] = useState(0);
  const [lang, setLang] = useState('he');

  const applyAndGenerate = (newSettings) => {
    setActiveSettings(newSettings);
    setGameKey(k => k + 1);
  };

  return (
    <>
      <ErrorBoundary>
        <GameInstance key={`${activeSettings.levelId}-${gameKey}`} level={LEVEL_DICTIONARY[activeSettings.levelId]} targetSteps={activeSettings.steps} numDiggers={activeSettings.diggers} onGenerateNew={applyAndGenerate} lang={lang} setLang={setLang} />
      </ErrorBoundary>
    </>
  );
};

export default App;
