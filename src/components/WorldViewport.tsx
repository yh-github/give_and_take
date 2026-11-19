import React, { type MouseEvent, type RefObject } from 'react';
import { BoatSVG } from '../levels/underwater/components.tsx';
import { CaveEntranceProp } from '../levels/river_crossing/components.tsx';
import CaveVisibility from '../levels/underground/CaveVisibility.tsx';
import Hero from './Hero.tsx';
import GameEntity from './GameEntity.tsx';
import { ClickIndicator, HeroBubbleBursts, FogOverlay } from './EffectsOverlay.tsx';
import DebugRays from './DebugRays.tsx';
import type {
  AlertReason,
  CampItemState,
  ClickIndicatorState,
  CustomEntityMovement,
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
  TranslationDictionary
} from '../types/index.ts';

export interface WorldViewportProps {
  innerMapRef: RefObject<HTMLDivElement | null>;
  level: LevelDefinition;
  totalMapHeight: string;
  mapTranslateY: string;
  unlockedZones: number[];
  isTransformed: boolean;
  hasDeepTreasure: boolean;
  attachedEntityId: string | null;
  debugMode: boolean;
  polyPoints: readonly Point2D[] | null;
  displayPlayerPos: Point2D;
  debugSegments: readonly ObstacleSegment[];
  lightingSettings: LightingSettings;
  gameTime: number;
  isLevelEditor: boolean;
  clickIndicator: ClickIndicatorState | null;
  heroBubbleBursts: HeroBubbleBurst[];
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
  heroFace: string;
  isAnimatingLoot: boolean;
  showTrophy: boolean;
  onCellClick: (e: MouseEvent<HTMLDivElement>) => void;
}

export function WorldViewport({
  innerMapRef,
  level,
  totalMapHeight,
  mapTranslateY,
  unlockedZones,
  isTransformed,
  hasDeepTreasure,
  attachedEntityId,
  debugMode,
  polyPoints,
  displayPlayerPos,
  debugSegments,
  lightingSettings,
  gameTime,
  isLevelEditor,
  clickIndicator,
  heroBubbleBursts,
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
  heroFace,
  isAnimatingLoot,
  showTrophy,
  onCellClick,
}: WorldViewportProps) {
  const Background = level.BackgroundComponent || (() => <div className="absolute inset-0 bg-[#dcb27b]" />);
  const viewportTransitionClass = attachedEntityId
    ? 'transition-none'
    : 'transition-transform duration-500 ease-out';

  const useIsotropic = Boolean(level.mechanics.useIsotropicCoords && puzzle?.geometry);
  const worldHeight = (useIsotropic && puzzle?.geometry?.worldHeight) ? puzzle.geometry.worldHeight : (level.mechanics.screens || 1) * 100;
  const yScale = useIsotropic ? 1 : (level.mechanics.screens || 1);
  const toCssY = (y: number): number => (useIsotropic ? (y / worldHeight) * 100 : y);
  const effectiveCampPos = puzzle?.geometry?.campPos || level.campPos;

  return (
    <div 
      ref={innerMapRef}
      onClick={onCellClick}
      className={`absolute inset-x-0 top-0 ${viewportTransitionClass} pointer-events-auto animate-map-appear cursor-pointer`} 
      style={{ height: totalMapHeight, transform: `translateY(${mapTranslateY})` }}
    >
      <Background geometry={puzzle?.geometry} />

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
        worldHeight={useIsotropic ? worldHeight : null}
        yScale={yScale}
      />

      {!isLevelEditor && level.mechanics.hasDarkness && level.mechanics.darknessType === 'radial' && (
        <CaveVisibility
          heroPos={displayPlayerPos}
          polygon={polyPoints}
          gameTime={gameTime}
          screens={level.mechanics.screens || 1}
          worldHeight={useIsotropic ? worldHeight : null}
          yScale={yScale}
          lighting={lightingSettings}
        />
      )}

      <ClickIndicator indicator={!isLevelEditor ? clickIndicator : null} toCssY={toCssY} />

      <HeroBubbleBursts bursts={heroBubbleBursts} />

      {level.sceneryNodes?.map((sc, i) => {
        const sDist = level.mechanics.darknessType === 'radial' ? Math.sqrt(Math.pow(sc.x - displayPlayerPos.x, 2) + Math.pow(sc.y - displayPlayerPos.y, 2)) : 100;
        const sZ = sDist < 28 ? 99 : (sc.z || 25);
        return <div key={`sc-${i}`} className={`absolute transform -translate-x-1/2 -translate-y-1/2 ${sc.s} pointer-events-none`} style={{ left: `${sc.x}%`, top: `${sc.y}%`, zIndex: sZ }}>{sc.e}</div>;
      })}

      {level.mechanics.hasFish && envItemState === 'active' && (
        <div className="absolute cursor-pointer text-3xl animate-fish-swim hover:scale-125 transition-transform" style={{ zIndex: 25 }} onClick={handleCatchRiverFish}>🐟</div>
      )}
      {level.mechanics.hasFish && envItemState === 'caught' && (
        <div className="absolute flex flex-col items-center animate-loot-fly pointer-events-none drop-shadow-xl" style={{ left: `${envItemCaughtPos.x}%`, top: `${envItemCaughtPos.y}%`, zIndex: 90 }}><span className="text-3xl">🐟</span></div>
      )}

      {schoolsOfFish.map(f => {
        const animName = f.isRight ? 'swimRight' : 'swimLeft';
        const duration = f.speed ? `${f.speed}s` : '10s';
        return (
          <div
            key={f.id}
            onClick={(e) => handleCatchSchoolFish(e, f)}
            className="absolute cursor-pointer text-4xl drop-shadow-md transition-transform hover:scale-125"
            style={{ top: `${f.y}%`, left: '0%', zIndex: 45, animation: `${animName} ${duration} linear forwards` }}
          >
            <div className={`inline-block ${f.isRight ? 'scale-x-[-1]' : ''}`}>
              {level.items.find(i => i.id === f.type)?.emoji || '🐟'}
            </div>
          </div>
        );
      })}

      {roamingBoats.map(b => (
        <div
          key={b.id}
          onClick={(e) => handleBoatTrade(e, b)}
          className={`absolute cursor-pointer z-[120] hover:scale-110 drop-shadow-xl ${b.isRight ? 'animate-boat-glide-right' : 'animate-boat-glide-left'}`}
          style={{ top: '13.8%', left: '0%' }}
        >
          <BoatSVG />
          <div className={`absolute -top-9 left-1/2 -translate-x-1/2 bg-white/95 border-2 border-amber-600 rounded-full px-2.5 py-1 flex items-center gap-1 shadow-lg animate-bounce whitespace-nowrap ${b.isRight ? 'scale-x-[-1]' : ''}`}>
            <span className="text-lg sm:text-xl">{level.items.find(i => i.id === (b.reqItem || 'fish'))?.emoji || '🐟'}</span>
            <span className="text-xs font-black text-stone-700">➔</span>
            <span className="text-lg sm:text-xl">{level.items.find(i => i.id === b.offeredItem)?.emoji}</span>
          </div>
          {alertEntityId === b.id && (
            <div className={`absolute inset-0 flex items-center justify-center text-4xl animate-troll-mad ${b.isRight ? 'scale-x-[-1]' : ''}`}>
              {alertReason === 'inventory_full' ? '🎒' : '🚫'}
            </div>
          )}
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
          <div key={item.uid} onClick={(e) => handleCampItemClick(e, item)} className={`absolute transform -translate-x-1/2 -translate-y-1/2 z-[115] cursor-pointer hover:scale-125 transition-transform ${isAlerting ? 'animate-troll-mad' : ''}`} style={{ left: `${item.x}%`, top: `${toCssY(item.y)}%` }}>
            <div className="text-3xl drop-shadow-md">{isAlerting ? (alertReason === 'inventory_full' ? '🎒' : '🚫') : itemData.emoji}</div>
          </div>
        );
      })}

      {!isLevelEditor && (
        <div 
          onClick={handleCampClick} 
          className={`absolute transform -translate-x-1/2 -translate-y-1/2 transition-all ${(selectedItemTypes.length > 0 || (!selectedItemTypes.length && level.mechanics.hasAir)) ? 'cursor-pointer hover:scale-110 drop-shadow-[0_0_15px_rgba(255,255,255,0.8)] pointer-events-auto' : 'pointer-events-none'}`} 
          style={{ left: `${effectiveCampPos.x}%`, top: `${toCssY(effectiveCampPos.y)}%`, zIndex: (Math.hypot(effectiveCampPos.x - displayPlayerPos.x, effectiveCampPos.y - displayPlayerPos.y) < 28) ? 110 : 30 }}
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
        <div className="absolute animate-loot-fly drop-shadow-2xl text-6xl pointer-events-none" style={{ left: `${flyingItem.x}%`, top: `${toCssY(flyingItem.y)}%`, zIndex: flyingItem.zIndex || 90 }}>{flyingItem.emoji}</div>
      )}

      {!isLevelEditor && massFlyingTreasures.map((item, idx) => (
        <div key={`mass-treas-${idx}`} className="absolute animate-loot-fly drop-shadow-2xl text-6xl pointer-events-none" style={{ left: `${item.x}%`, top: `${toCssY(item.y)}%`, zIndex: 110, animationDelay: `${item.delay}ms` }}>{item.emoji}</div>
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
          isTransformed={isTransformed}
          hasDeepTreasure={hasDeepTreasure}
          getCustomEntityMovement={getCustomEntityMovement}
          handleInteract={handleInteract}
          dict={dict}
          toCssY={toCssY}
          yScale={yScale}
        />
      ))}

      <Hero 
        playerVisualX={playerVisualX}
        playerVisualY={playerVisualY}
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
