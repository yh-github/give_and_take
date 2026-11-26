import React, { useEffect, useRef, type MouseEvent, type RefObject } from 'react';
import { DROWNING_RETURN_DELAY_MS, LANTERNFISH_WILD_LIGHT_RADIUS } from '../constants.ts';
import { getSchoolFishPosition, isCampItemFloating } from '../logic/underwater.ts';
import { BoatSVG, BoatWakeEffect, InteractiveKelpSVG, UnderwaterWaterOverlay } from '../levels/underwater/components.tsx';
import { ShipwreckWaterOverlay } from '../levels/shipwreck/components.tsx';
import { reefKelpHabitats, type ReefKelpHabitat } from '../levels/underwater/data.ts';
import { CaveEntranceProp } from '../levels/river_crossing/components.tsx';
import { CaveBrazierProp } from '../levels/deep_cave/components.tsx';
import CaveVisibility from '../levels/underground/CaveVisibility.tsx';
import Hero from './Hero.tsx';
import GameEntity from './GameEntity.tsx';
import { SpriteIcon } from './sprites/SpriteIcon.tsx';
import { ClickIndicator, HeroBubbleBursts, WaterSplashBursts, FogOverlay } from './EffectsOverlay.tsx';
import DebugRays from './DebugRays.tsx';
import type {
  AlertReason,
  CampItemState,
  CaveBrazier,
  ClickIndicatorState,
  CustomEntityMovement,
  ExtraLightPolygon,
  FlyingItemState,
  HeroBubbleBurst,
  LevelDefinition,
  LightingSettings,
  ObstacleSegment,
  PathHistoryPoint,
  Point2D,
  PuzzleData,
  PuzzleEntity,
  RoamingBoatState,
  SchoolFishState,
  TranslationDictionary,
  WaterSplashState
} from '../types/index.ts';

export interface WorldViewportProps {
  innerMapRef: RefObject<HTMLDivElement | null>;
  level: LevelDefinition;
  totalMapWidth?: string;
  totalMapHeight: string;
  mapTranslateX?: string;
  mapTranslateY: string;
  unlockedZones: number[];
  isTransformed: boolean;
  hasDeepTreasure: boolean;
  attachedEntityId: string | null;
  debugMode: boolean;
  polyPoints: readonly Point2D[] | null;
  extraLightPolygons?: readonly ExtraLightPolygon[];
  litBraziers?: readonly string[];
  visibleBraziersSet?: Set<string> | null;
  onLightBrazier?: (brazier: CaveBrazier, e: MouseEvent) => void;
  displayPlayerPos: Point2D;
  debugSegments: readonly ObstacleSegment[];
  lightingSettings: LightingSettings;
  gameTime: number;
  isLevelEditor: boolean;
  clickIndicator: ClickIndicatorState | null;
  heroBubbleBursts: HeroBubbleBurst[];
  waterSplashes?: WaterSplashState[];
  envItemState: string;
  envItemCaughtPos: Point2D;
  handleCatchRiverFish: (e: MouseEvent) => void;
  schoolsOfFish: SchoolFishState[];
  handleCatchSchoolFish: (e: MouseEvent, fish: SchoolFishState) => void;
  roamingBoats: RoamingBoatState[];
  handleBoatTrade: (e: MouseEvent, boat: RoamingBoatState) => void;
  alertEntityId: string | number | null;
  alertReason: AlertReason;
  isInventoryFullAlert: boolean;
  pathHistory: PathHistoryPoint[];
  tempPlayerPos: Point2D | null;
  playerPos: Point2D;
  campItems: CampItemState[];
  handleCampItemClick: (e: MouseEvent, item: CampItemState) => void;
  handleCampClick: (e: MouseEvent) => void;
  selectedItemTypes: string[];
  flyingItem: FlyingItemState | null;
  massFlyingTreasures: FlyingItemState[];
  puzzle: PuzzleData | null;
  defeated: string[];
  dict: TranslationDictionary;
  selectedEntityId: string | null;
  animatingEntities: string[];
  buriedEntities: string[];
  inkFogEntities: Set<string>;
  visibleEntitiesSet: Set<string> | null;
  wallSegments: readonly ObstacleSegment[];
  breakingRockIds: Record<string, boolean>;
  bridgingChasmIds?: Record<string, boolean>;
  inventory?: readonly string[];
  wildLightSources?: readonly Point2D[];
  lanternfishLightCount?: number;
  isMagicAnimating?: boolean;
  getCustomEntityMovement?: ((ent: PuzzleEntity) => CustomEntityMovement | null) | null;
  handleInteract: (ent: PuzzleEntity, e: MouseEvent) => void;
  playerVisualX: number;
  playerVisualY: number;
  playerRotation: number;
  playerScale: string;
  playerFilter: string;
  playerZ: number;
  playerTransition: string;
  playerTransitionDuration?: string;
  isSubmerged: boolean;
  isDrowning: boolean;
  isDrowningAscending?: boolean;
  isSwimmingToSurface?: boolean;
  heroFace: string;
  isAnimatingLoot: boolean;
  isHeavyUnderwater?: boolean;
  onFlushKelp?: (habitat: ReefKelpHabitat, e: MouseEvent) => void;
  rustlingKelpId?: string | null;
  showTrophy: boolean;
  onCellClick: (e: MouseEvent<HTMLDivElement>) => void;
}

interface SchoolFishSpriteProps {
  fish: SchoolFishState;
  emoji: string;
  onClick: (e: MouseEvent, fish: SchoolFishState) => void;
}

function SchoolFishSprite({ fish, emoji, onClick }: SchoolFishSpriteProps) {
  const spriteRef = useRef<HTMLDivElement | null>(null);
  const initPos = getSchoolFishPosition(fish, Date.now());

  useEffect(() => {
    if (typeof requestAnimationFrame !== 'function') return;
    let rafId = 0;
    let cancelled = false;
    const tick = () => {
      if (cancelled) return;
      const el = spriteRef.current;
      if (el) {
        const pos = getSchoolFishPosition(fish, Date.now());
        el.style.top = `${pos.y}%`;
        el.style.transform = `translate3d(${pos.x}cqw, -50%, 0)`;
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      if (typeof cancelAnimationFrame === 'function') {
        cancelAnimationFrame(rafId);
      }
    };
  }, [fish]);

  return (
    <div
      ref={spriteRef}
      data-testid={`school-fish-${fish.type}`}
      data-spooked={fish.isSpooked ? 'true' : 'false'}
      onClick={(e) => onClick(e, fish)}
      className="absolute cursor-pointer drop-shadow-md"
      style={{
        top: `${initPos.y}%`,
        left: '0%',
        zIndex: 45,
        transform: `translate3d(${initPos.x}cqw, -50%, 0)`
      }}
    >
      <div className="-translate-x-1/2 relative flex items-center hover:scale-125 transition-transform">
        {fish.type === 'blowfish' && (
          <div
            data-testid="lanternfish-glow"
            aria-hidden="true"
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-200/20 pointer-events-none -z-10"
            style={{
              width: `${LANTERNFISH_WILD_LIGHT_RADIUS * 2}cqw`,
              height: `${LANTERNFISH_WILD_LIGHT_RADIUS * 2}cqw`,
              background:
                'radial-gradient(circle, rgba(254,240,138,0.52) 0%, rgba(103,232,249,0.28) 48%, rgba(34,211,238,0.10) 78%, rgba(34,211,238,0) 100%)',
              boxShadow: '0 0 18px rgba(103,232,249,0.25)'
            }}
          />
        )}
        <div
          aria-hidden="true"
          className={`flex items-center gap-1 opacity-60 pointer-events-none ${
            fish.isRight ? 'order-first mr-1' : 'order-last ml-1'
          }`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-200/80 animate-ping" />
          <span className="w-1 h-1 rounded-full bg-white/70" />
        </div>

        <span className={`text-4xl inline-flex items-center justify-center ${fish.isRight ? 'scale-x-[-1]' : ''}`}>
          <SpriteIcon id={fish.type} emoji={emoji} />
        </span>

        {fish.isSpooked && (
          <div className=" -top-5 left-1/2 -translate-x-1/2 absolute flex items-center gap-0.5 text-sm font-black pointer-events-none animate-bounce whitespace-nowrap drop-shadow-md">
            <span>❗</span>
            <span>💨</span>
          </div>
        )}
      </div>
    </div>
  );
}

export function WorldViewport({
  innerMapRef,
  level,
  totalMapWidth = '100%',
  totalMapHeight,
  mapTranslateX = '0%',
  mapTranslateY,
  unlockedZones,
  isTransformed,
  hasDeepTreasure,
  attachedEntityId,
  debugMode,
  polyPoints,
  extraLightPolygons = [],
  litBraziers = [],
  visibleBraziersSet = null,
  onLightBrazier,
  displayPlayerPos,
  debugSegments,
  lightingSettings,
  gameTime,
  isLevelEditor,
  clickIndicator,
  heroBubbleBursts,
  waterSplashes = [],
  envItemState,
  envItemCaughtPos,
  handleCatchRiverFish,
  schoolsOfFish,
  handleCatchSchoolFish,
  roamingBoats,
  handleBoatTrade,
  alertEntityId,
  alertReason,
  isInventoryFullAlert,
  pathHistory,
  tempPlayerPos,
  playerPos,
  campItems,
  handleCampItemClick,
  handleCampClick,
  selectedItemTypes,
  flyingItem,
  massFlyingTreasures,
  puzzle,
  defeated,
  dict,
  selectedEntityId,
  animatingEntities,
  buriedEntities,
  inkFogEntities,
  visibleEntitiesSet,
  wallSegments,
  breakingRockIds,
  bridgingChasmIds,
  inventory = [],
  wildLightSources = [],
  lanternfishLightCount = 0,
  isMagicAnimating = false,
  getCustomEntityMovement,
  handleInteract,
  playerVisualX,
  playerVisualY,
  playerRotation,
  playerScale,
  playerFilter,
  playerZ,
  playerTransition,
  playerTransitionDuration,
  isSubmerged,
  isDrowning,
  isDrowningAscending = false,
  isSwimmingToSurface = false,
  heroFace,
  isAnimatingLoot,
  isHeavyUnderwater = false,
  onFlushKelp,
  rustlingKelpId = null,
  showTrophy,
  onCellClick,
}: WorldViewportProps) {
  const Background = level.BackgroundComponent || (() => <div className="absolute inset-0 bg-[#dcb27b]" />);
  const isCameraLocked = Boolean(attachedEntityId || isDrowningAscending);
  const viewportTransitionClass = isCameraLocked
    ? 'transition-none'
    : isDrowning
      ? 'transition-transform ease-linear'
      : isSwimmingToSurface
        ? 'transition-transform ease-in-out'
        : 'transition-transform ease-out';

  const useIsotropic = Boolean(level.mechanics.useIsotropicCoords && puzzle?.geometry);
  const worldWidth = (useIsotropic && puzzle?.geometry?.worldWidth)
    ? puzzle.geometry.worldWidth
    : 100;
  const worldHeight = (useIsotropic && puzzle?.geometry?.worldHeight)
    ? puzzle.geometry.worldHeight
    : (level.mechanics.yScaleOverride != null
        ? 100 * level.mechanics.yScaleOverride
        : (level.mechanics.screens || 1) * 100);
  const yScale = useIsotropic ? 1 : (level.mechanics.yScaleOverride ?? (level.mechanics.screens || 1));
  const toCssX = (x: number): number => (useIsotropic ? (x / worldWidth) * 100 : x);
  const toCssY = (y: number): number => (useIsotropic ? (y / worldHeight) * 100 : y);
  const effectiveCampPos = puzzle?.geometry?.campPos || level.campPos;
  const effectiveCaveLighting = (!debugMode && level.id === 'shipwreck')
    ? {
        ...lightingSettings,
        radius: 44,
        blur: 1.8,
        darknessColor: '#020b1a',
        darknessOpacity: 0.54,
        ambientColor: '#22d3ee',
        ambientOpacity: 0.07,
        flickerIntensity: 0.15
      }
    : lightingSettings;

  const caveVisibilityWorldWidth = useIsotropic ? worldWidth : null;
  const caveVisibilityWorldHeight = level.mechanics.yScaleOverride != null
    ? 100 * level.mechanics.yScaleOverride
    : (useIsotropic ? worldHeight : null);

  return (
    <div 
      ref={innerMapRef}
      onClick={onCellClick}
      className={`absolute left-0 top-0 ${viewportTransitionClass} pointer-events-auto animate-map-appear cursor-pointer`} 
      style={{
        width: totalMapWidth,
        height: totalMapHeight,
        transform: `translate3d(${mapTranslateX}, ${mapTranslateY}, 0)`,
        ...(!isCameraLocked
          ? {
              transitionDuration: isDrowning
                ? `${DROWNING_RETURN_DELAY_MS}ms`
                : isSwimmingToSurface
                  ? (playerTransitionDuration || '1600ms')
                  : isHeavyUnderwater
                    ? '1100ms'
                    : '500ms'
            }
          : {})
      }}
    >
      <Background geometry={puzzle?.geometry} isTransformed={isTransformed} />

      {level.id === 'underwater' && <UnderwaterWaterOverlay />}
      {level.id === 'shipwreck' && <ShipwreckWaterOverlay isTransformed={isTransformed} />}

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
        worldWidth={caveVisibilityWorldWidth}
        worldHeight={caveVisibilityWorldHeight}
        yScale={yScale}
      />

      {!isLevelEditor && level.mechanics.hasDarkness && level.mechanics.darknessType === 'radial' && (
        <CaveVisibility
          heroPos={displayPlayerPos}
          polygon={polyPoints}
          extraLightPolygons={extraLightPolygons}
          gameTime={gameTime}
          screens={level.mechanics.screens || 1}
          worldWidth={caveVisibilityWorldWidth}
          worldHeight={caveVisibilityWorldHeight}
          yScale={yScale}
          lighting={effectiveCaveLighting}
        />
      )}

      {!isLevelEditor && level.id === 'deep_cave' && puzzle?.geometry?.braziers?.map((brazier) => (
        <CaveBrazierProp
          key={brazier.id}
          brazier={brazier}
          isLit={litBraziers.includes(brazier.id)}
          isVisible={!visibleBraziersSet || visibleBraziersSet.has(brazier.id)}
          leftPct={toCssX(brazier.x)}
          topPct={toCssY(brazier.y)}
          onClick={(b, ev) => onLightBrazier && onLightBrazier(b, ev)}
        />
      ))}

      <ClickIndicator indicator={!isLevelEditor ? clickIndicator : null} toCssX={toCssX} toCssY={toCssY} />

      <HeroBubbleBursts bursts={heroBubbleBursts} />
      <WaterSplashBursts splashes={waterSplashes} />

      {level.sceneryNodes?.map((sc, i) => {
        const sDist = level.mechanics.darknessType === 'radial' ? Math.sqrt(Math.pow(sc.x - displayPlayerPos.x, 2) + Math.pow(sc.y - displayPlayerPos.y, 2)) : 100;
        const sZ = sDist < 28 ? 99 : (sc.z || 25);
        return <div key={`sc-${i}`} className={`absolute transform -translate-x-1/2 -translate-y-1/2 ${sc.s} pointer-events-none`} style={{ left: `${sc.x}%`, top: `${sc.y}%`, zIndex: sZ }}>{sc.e}</div>;
      })}

      {level.id === 'underwater' && !isLevelEditor && reefKelpHabitats.map((habitat) => {
        const fishItem = level.items.find(i => i.id === habitat.fishType);
        const fishEmoji = fishItem?.emoji || '🐟';
        return (
          <div
            key={habitat.id}
            data-testid={`kelp-habitat-${habitat.id}`}
            onClick={(e) => onFlushKelp && onFlushKelp(habitat, e)}
            className="absolute transform -translate-x-1/2 -translate-y-1/2 z-[42] cursor-pointer hover:scale-110 transition-transform"
            style={{ left: `${habitat.x}%`, top: `${habitat.y}%` }}
            title={fishItem?.name || fishEmoji}
          >
            <InteractiveKelpSVG
              variant="habitat"
              fishId={habitat.fishType}
              fishEmoji={fishEmoji}
              fishSpriteSrc={fishItem?.spriteSrc}
              isRustling={rustlingKelpId === habitat.id}
            />
          </div>
        );
      })}

      {level.mechanics.hasFish && envItemState === 'active' && (
        <div className="absolute cursor-pointer text-3xl animate-fish-swim hover:scale-125 transition-transform" style={{ zIndex: 25 }} onClick={handleCatchRiverFish}>
          <SpriteIcon id="fish" emoji="🐟" />
        </div>
      )}
      {level.mechanics.hasFish && envItemState === 'caught' && (
        <div className="absolute flex flex-col items-center animate-loot-fly pointer-events-none drop-shadow-xl" style={{ left: `${envItemCaughtPos.x}%`, top: `${envItemCaughtPos.y}%`, zIndex: 90 }}>
          <span className="text-3xl"><SpriteIcon id="fish" emoji="🐟" /></span>
        </div>
      )}

      {schoolsOfFish.map(f => (
        <SchoolFishSprite
          key={`${f.id}-${f.spookCount || 0}`}
          fish={f}
          emoji={level.items.find(i => i.id === f.type)?.emoji || '🐟'}
          onClick={handleCatchSchoolFish}
        />
      ))}

      {roamingBoats.map(b => {
        const lane: 'far' | 'near' = b.lane || (b.isRight ? 'near' : 'far');
        const laneTop = lane === 'far' ? '10.8%' : '13.6%';
        const laneZ = lane === 'far' ? 104 : 122;
        const laneScaleClass = lane === 'far' ? 'scale-[0.78]' : 'scale-[0.96]';
        const reqItemDef = level.items.find(i => i.id === (b.reqItem || 'fish'));
        const offeredItemDef = level.items.find(i => i.id === b.offeredItem);
        return (
          <div
            key={b.id}
            data-testid={`roaming-boat-${lane}`}
            onClick={(e) => handleBoatTrade(e, b)}
            className={`absolute cursor-pointer drop-shadow-xl ${b.isRight ? 'animate-boat-glide-right' : 'animate-boat-glide-left'}`}
            style={{ top: laneTop, left: '0%', zIndex: laneZ }}
          >
            <div className="relative -translate-x-1/2 flex flex-col items-center hover:scale-110 transition-transform">
              <div className={`relative flex flex-col items-center ${laneScaleClass}`}>
                <div className={b.isRight ? 'scale-x-[-1]' : ''}>
                  <BoatSVG />
                </div>
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1 -z-10 pointer-events-none">
                  <BoatWakeEffect isRight={b.isRight} lane={lane} />
                </div>
              </div>

              <div className="absolute -top-9 left-1/2 -translate-x-1/2 bg-white/95 border-2 border-amber-600 rounded-full px-2.5 py-1 flex items-center gap-1 shadow-lg animate-bounce whitespace-nowrap z-20">
                <span className="text-lg sm:text-xl flex items-center">
                  <SpriteIcon
                    id={reqItemDef?.spriteId || b.reqItem || 'fish'}
                    spriteSrc={reqItemDef?.spriteSrc}
                    emoji={reqItemDef?.emoji || '🐟'}
                  />
                </span>
                <span className="text-xs font-black text-stone-700">➔</span>
                <span className="text-lg sm:text-xl flex items-center">
                  <SpriteIcon
                    id={offeredItemDef?.spriteId || b.offeredItem}
                    spriteSrc={offeredItemDef?.spriteSrc}
                    emoji={offeredItemDef?.emoji}
                  />
                </span>
              </div>
              {alertEntityId === b.id && (
                <div className="absolute inset-0 flex items-center justify-center text-4xl animate-troll-mad z-30">
                  {alertReason === 'inventory_full' ? '🎒' : '🚫'}
                </div>
              )}
            </div>
          </div>
        );
      })}

      {!isLevelEditor && level.id !== 'underwater' && level.id !== 'shipwreck' && (
        <svg className="absolute inset-0 w-full h-full pointer-events-none drop-shadow-md z-[99]" preserveAspectRatio="none">
          {(!level.mechanics.screens || level.mechanics.screens === 1) && pathHistory.map((pos, i) => { if (i === 0) return null; const prev = pathHistory[i - 1]; return <line key={i} x1={`${prev.x}%`} y1={`${prev.y}%`} x2={`${pos.x}%`} y2={`${pos.y}%`} stroke="#4a2211" strokeWidth="5" strokeDasharray="12 12" className="animate-[dash_1s_linear_forwards]" style={{ strokeDashoffset: 100 }} vectorEffect="non-scaling-stroke" />; })}
          {(!level.mechanics.screens || level.mechanics.screens === 1) && tempPlayerPos && <line x1={`${playerPos.x}%`} y1={`${playerPos.y}%`} x2={`${tempPlayerPos.x}%`} y2={`${tempPlayerPos.y}%`} stroke="#4a2211" strokeWidth="5" strokeDasharray="12 12" opacity="0.5" vectorEffect="non-scaling-stroke" />}
        </svg>
      )}

      {!isLevelEditor && campItems.map(item => {
        const itemData = level.items.find(i => i.id === item.id);
        if (!itemData) return null;
        const isAlerting = alertEntityId === item.uid;
        const isUnderwaterFloating = isCampItemFloating(level, item, effectiveCampPos);
        return (
          <div key={item.uid} onClick={(e) => handleCampItemClick(e, item)} className={`absolute transform -translate-x-1/2 -translate-y-1/2 z-[115] cursor-pointer hover:scale-125 transition-transform ${isAlerting ? 'animate-troll-mad' : ''}`} style={{ left: `${toCssX(item.x)}%`, top: `${toCssY(item.y)}%` }}>
            {isUnderwaterFloating ? (
              <div
                data-testid={`floating-item-${item.id}`}
                className="animate-bob bg-sky-950/60 border border-cyan-300/70 rounded-full w-11 h-11 flex items-center justify-center shadow-[0_0_12px_rgba(34,211,238,0.55)] text-2xl"
              >
                {isAlerting ? (alertReason === 'inventory_full' ? '🎒' : '🚫') : (
                  <SpriteIcon id={itemData.spriteId || itemData.id} spriteSrc={itemData.spriteSrc} emoji={itemData.emoji} />
                )}
              </div>
            ) : (
              <div className="text-3xl drop-shadow-md flex items-center justify-center">
                {isAlerting ? (alertReason === 'inventory_full' ? '🎒' : '🚫') : (
                  <SpriteIcon id={itemData.spriteId || itemData.id} spriteSrc={itemData.spriteSrc} emoji={itemData.emoji} />
                )}
              </div>
            )}
          </div>
        );
      })}

      {!isLevelEditor && (
        <div 
          onClick={handleCampClick} 
          className={`absolute transform -translate-x-1/2 -translate-y-1/2 transition-all ${(selectedItemTypes.length > 0 || (!selectedItemTypes.length && level.mechanics.hasAir)) ? 'cursor-pointer hover:scale-110 drop-shadow-[0_0_15px_rgba(255,255,255,0.8)] pointer-events-auto' : 'pointer-events-none'}`} 
          style={{
            left: `${toCssX(effectiveCampPos.x)}%`,
            top: `${toCssY(effectiveCampPos.y)}%`,
            zIndex: level.id === 'underwater'
              ? 115
              : level.id === 'shipwreck'
                ? 112
                : (Math.hypot(effectiveCampPos.x - displayPlayerPos.x, effectiveCampPos.y - displayPlayerPos.y) < 28)
                  ? 110
                  : 30
          }}
        >
          <div className="relative">
            {level.CampIcon ? <level.CampIcon /> : <div className="text-6xl drop-shadow-lg scale-x-[-1] animate-flicker">🔥</div>}
            {selectedItemTypes.length > 0 && (
              <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-white text-stone-900 text-xs font-black px-2 py-1 rounded-xl shadow-xl animate-bounce whitespace-nowrap border-2 border-stone-800 pointer-events-auto">
                {dict.dropItem || '⬇️ Drop Item'}
              </div>
            )}
            {level.id === 'underwater' && hasDeepTreasure && !isTransformed && !selectedItemTypes.length && (
              <div className="absolute -top-10 left-1/2 transform -translate-x-1/2 bg-amber-300 text-stone-950 font-black tracking-wider text-sm px-2.5 py-0.5 rounded-full border-2 border-amber-700 shadow-[0_0_14px_rgba(251,191,36,0.9)] animate-bounce whitespace-nowrap">
                👑 {dict.exit}
              </div>
            )}
          </div>
        </div>
      )}

      {!isLevelEditor && flyingItem && (
        <div className="absolute animate-loot-fly drop-shadow-2xl text-6xl pointer-events-none" style={{ left: `${toCssX(flyingItem.x)}%`, top: `${toCssY(flyingItem.y)}%`, zIndex: flyingItem.zIndex || 90 }}>
          <SpriteIcon id={flyingItem.itemId} spriteSrc={flyingItem.spriteSrc} emoji={flyingItem.emoji} />
        </div>
      )}

      {!isLevelEditor && massFlyingTreasures.map((item, idx) => (
        <div key={`mass-treas-${idx}`} className="absolute animate-loot-fly drop-shadow-2xl text-6xl pointer-events-none" style={{ left: `${toCssX(item.x)}%`, top: `${toCssY(item.y)}%`, zIndex: 110, animationDelay: `${item.delay}ms` }}>
          <SpriteIcon id={item.itemId} spriteSrc={item.spriteSrc} emoji={item.emoji} />
        </div>
      ))}

      {level.id === 'river_crossing' && puzzle?.puzzleEntities.some(e => e.id === puzzle.goalEntityId) && (
        <div className="absolute transform -translate-x-1/2 -translate-y-1/2 pointer-events-none z-20" style={{ left: '50%', top: '22%' }}>
          <CaveEntranceProp />
          {!defeated.includes(puzzle.goalEntityId) && !alertEntityId && (
            <div className="absolute -top-12 left-1/2 transform -translate-x-1/2 text-purple-950 font-black tracking-widest text-lg drop-shadow-md z-30 bg-amber-100/80 px-2 rounded">{dict.exit}</div>
          )}
        </div>
      )}

      {!isLevelEditor && puzzle?.puzzleEntities.map(ent => (
        <GameEntity 
          key={ent.id}
          ent={ent}
          puzzle={puzzle}
          level={level}
          defeated={defeated}
          alertEntityId={alertEntityId}
          alertReason={alertReason}
          selectedEntityId={selectedEntityId}
          animatingEntities={animatingEntities}
          buriedEntities={buriedEntities}
          inkFogEntities={inkFogEntities}
          unlockedZones={unlockedZones}
          visibleEntitiesSet={visibleEntitiesSet}
          wallSegments={wallSegments}
          displayPlayerPos={displayPlayerPos}
          breakingRockIds={breakingRockIds}
          bridgingChasmIds={bridgingChasmIds}
          inventory={inventory}
          wildLightSources={wildLightSources}
          isTransformed={isTransformed}
          hasDeepTreasure={hasDeepTreasure}
          isMagicAnimating={isMagicAnimating}
          getCustomEntityMovement={getCustomEntityMovement}
          handleInteract={handleInteract}
          dict={dict}
          toCssX={toCssX}
          toCssY={toCssY}
          yScale={yScale}
        />
      ))}

      <Hero 
        playerVisualX={playerVisualX}
        playerVisualY={playerVisualY}
        playerVisualXPct={toCssX(playerVisualX)}
        playerVisualYPct={toCssY(playerVisualY)}
        playerRotation={playerRotation}
        playerScale={playerScale}
        playerFilter={playerFilter}
        playerZ={playerZ}
        playerTransition={playerTransition}
        playerTransitionDuration={playerTransitionDuration}
        isTransformed={isTransformed}
        isSubmerged={isSubmerged}
        isDrowning={isDrowning}
        isInventoryFullAlert={isInventoryFullAlert}
        heroFace={heroFace}
        level={level}
        isAnimatingLoot={isAnimatingLoot}
        isHeavy={isHeavyUnderwater}
        lanternfishLightCount={lanternfishLightCount}
      />

      {showTrophy && (
        <div className="absolute -right-8 top-0 text-4xl animate-bounce drop-shadow-[0_0_15px_rgba(251,191,36,0.8)]" style={{ animationDelay: '0.2s' }}>
          🏆
        </div>
      )}
    </div>
  );
}

export default WorldViewport;
