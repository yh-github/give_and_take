import React from 'react';
import { BoatSVG } from '../levels/underwater/components.jsx';
import { CaveEntranceProp } from '../levels/river_crossing/components.jsx';
import CaveVisibility from '../levels/underground/CaveVisibility.jsx';
import Hero from './Hero.jsx';
import GameEntity from './GameEntity.jsx';
import { ClickIndicator, HeroBubbleBursts, FogOverlay } from './EffectsOverlay.jsx';
import DebugRays from './DebugRays.jsx';

export function WorldViewport({
  innerMapRef,
  level,
  totalMapHeight,
  mapTranslateY,
  unlockedZones,
  isTransformed,
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
  getCustomEntityMovement,
  handleInteract,
  playerVisualX,
  playerVisualY,
  playerRotation,
  playerScale,
  playerFilter,
  playerZ,
  playerTransition,
  isSubmerged,
  isDrowning,
  heroFace,
  isAnimatingLoot,
  showTrophy,
  onCellClick,
}) {
  const Background = level.BackgroundComponent || (() => <div className="absolute inset-0 bg-[#dcb27b]" />);

  return (
    <div 
      ref={innerMapRef}
      onClick={onCellClick}
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

      {!isLevelEditor && puzzle?.puzzleEntities.map(ent => (
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
  );
}

export default WorldViewport;
