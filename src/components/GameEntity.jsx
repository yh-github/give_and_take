import React, { Fragment } from 'react';
import { UNDERWATER_INSPECT_RADIUS } from '../constants.js';
import { GiantClamSVG, BubbleVentSVG, SeaWitchGateSVG, InkCloudSVG } from '../levels/underwater/components.jsx';
import { getCorridorBounds } from '../logic/geometry.js';
import { CAVE_WALL_VERTICES } from '../levels/underground/components.jsx';

export function GameEntity({
  ent,
  puzzle,
  level,
  defeated,
  alertEntityId,
  alertReason,
  selectedEntityId,
  animatingEntities,
  buriedEntities,
  inkFogEntities,
  unlockedZones,
  visibleEntitiesSet,
  wallSegments,
  displayPlayerPos,
  breakingRockIds,
  isTransformed,
  hasDeepTreasure,
  getCustomEntityMovement,
  handleInteract,
  dict,
  toCssY = (y) => y,
  yScale = null
}) {
  const isDefeated = defeated.includes(ent.id);
  if (ent.isPreset && isDefeated) return null;

  const isGoal = ent.id === puzzle.goalEntityId;
  const rewardItem = ent.reward ? level.items.find(i => i.id === ent.reward) : null;
  const isAlerting = alertEntityId === ent.id;
  const isSelected = selectedEntityId === ent.id;
  const isAnimating = animatingEntities.includes(ent.id);

  const isDigger = Boolean(level.specialEntityTemplate && ent.id?.startsWith(level.specialEntityTemplate) && !ent.isGoal);
  const isChasm = Boolean(ent.isGatekeeper && ent.gateType === 'chasm');
  const isGuardian = Boolean(ent.isGatekeeper && ent.gateType === 'guardian');
  const isRock = (ent.isGatekeeper && level.mechanics.hasPickaxe && ent.id !== 'final_gate' && !isChasm && !isGuardian) || ent.isExtraRock;
  const isCurrent = ent.id === 'current' || (ent.isGatekeeper && ent.id?.startsWith('current_'));
  const effectiveYScale = yScale ?? (level.mechanics.useIsotropicCoords ? 1 : (level.mechanics.screens || 2.5));

  const inZoneFog = level.mechanics.hasFog && !unlockedZones.includes(ent.zone) && !(ent.isGatekeeper && ent.unlocksZones && ent.unlocksZones.some(z => unlockedZones.includes(z)));
  const inInkFog = inkFogEntities.has(ent.id);

  const isVisible = level.mechanics.darknessType !== 'radial' || (visibleEntitiesSet && visibleEntitiesSet.has(ent.id));
  const inDarkness = !isVisible;

  const entZ = isSelected ? 200 : ((isRock || isChasm || ent.isGatekeeper || ent.id === 'sea_witch') ? 110 : ((isVisible && !inZoneFog) ? 105 : 35));
  const isInteractable = !inZoneFog && !inDarkness && !inInkFog;

  const interactableHover = (inDarkness || inZoneFog)
    ? 'pointer-events-none cursor-default opacity-0 invisible scale-0 transition-opacity duration-1000'
    : inInkFog
      ? 'pointer-events-none cursor-default'
      : !isInteractable
        ? (isRock || isChasm || ent.isGatekeeper) ? 'pointer-events-none cursor-default' : 'pointer-events-none cursor-default opacity-0 invisible scale-0 transition-opacity duration-1000'
        : (isDefeated && !ent.isGatekeeper && ent.id !== 'dolphin_1' && ent.id !== 'sea_witch') || (isRock && isDefeated) || (isChasm && isDefeated) || (isCurrent && isDefeated)
          ? 'cursor-default'
          : 'hover:scale-110 cursor-pointer';

  const hasCustomCollar = Boolean((isRock || isChasm || ent.isExtraRock) && ent.collarBounds);
  const isGatekeeperRock = hasCustomCollar || ((isRock || ent.isExtraRock) && level.id === 'underground' && CAVE_WALL_VERTICES);
  let rockBounds = null;
  if (hasCustomCollar) {
    rockBounds = ent.collarBounds;
  } else if (isGatekeeperRock) {
    rockBounds = getCorridorBounds(ent.y, CAVE_WALL_VERTICES, ent.x >= 50);
  }

  const isBuried = isDigger && buriedEntities.includes(ent.id);
  const groupedReqs = (ent.requires || []).reduce((acc, reqId) => { acc[reqId] = (acc[reqId] || 0) + 1; return acc; }, {});
  const customMove = getCustomEntityMovement ? getCustomEntityMovement(ent) : null;
  const isCustomEntity = Boolean(customMove && customMove.isActiveMotion);
  const wrapperClasses = `absolute flex flex-col items-center ${isCustomEntity ? 'transition-none' : 'transition-all duration-300'} ${isGatekeeperRock ? 'transform -translate-y-1/2' : (ent.roamClass && !ent.roamClass.includes('elevator')) ? ent.roamClass : 'transform -translate-x-1/2 -translate-y-1/2'} ${interactableHover}`;

  let visualX = ent.x;
  let visualY = ent.y;
  let visualRotation = 0;
  let isFlipped = ent.isRight;

  if (customMove) {
    visualX = customMove.x;
    visualY = customMove.y;
    visualRotation = customMove.rotate || 0;
    isFlipped = Boolean(customMove.flip);
  }

  const heroDist = displayPlayerPos
    ? Math.hypot(visualX - displayPlayerPos.x, visualY - displayPlayerPos.y)
    : 0;
  const isMurkyFar = Boolean(
    level.mechanics.hasMurkyWater &&
    !ent.isPreset &&
    !ent.isGatekeeper &&
    ent.id !== 'sea_witch' &&
    ent.id !== 'dolphin_1' &&
    heroDist > UNDERWATER_INSPECT_RADIUS
  );

  const isNearLeft = !ent.roamClass && visualX <= 22;
  const isNearRight = !ent.roamClass && visualX >= 78;
  const isNearTop = toCssY(visualY) <= 14;
  const tooltipAlign = isNearLeft ? "left-0" : isNearRight ? "right-0" : "left-1/2 -translate-x-1/2";
  const tooltipY = isNearTop ? "top-full mt-2" : "bottom-full mb-2";
  const arrowAlign = isNearLeft ? "left-4" : isNearRight ? "right-4" : "left-1/2 -translate-x-1/2";
  const arrowY = isNearTop ? "-top-[7px] border-t-2 border-l-2" : "-bottom-[7px] border-b-2 border-r-2";

  const isElevator = ent.roamClass?.includes('elevator');
  const isClam = Boolean(ent.id?.startsWith('clam') || ent.id?.startsWith('giant_clam'));
  const isVerticalCollar = rockBounds?.orientation === 'vertical';
  const worldHeight = puzzle?.geometry?.worldHeight;

  const entityStyle = isGatekeeperRock ? (
    isVerticalCollar && worldHeight ? {
      left: `${rockBounds.xLeft}%`,
      top: `${toCssY(rockBounds.yTop)}%`,
      width: `${Math.max(4, rockBounds.xRight - rockBounds.xLeft)}%`,
      height: `${((rockBounds.yBottom - rockBounds.yTop) / worldHeight) * 100}%`,
      zIndex: entZ,
      transform: `rotate(${visualRotation}deg)`
    } : {
      left: `${rockBounds.xLeft}%`,
      top: `${toCssY(visualY)}%`,
      width: `${rockBounds.xRight - rockBounds.xLeft}%`,
      zIndex: entZ,
      transform: `translate(0%, -50%) rotate(${visualRotation}deg)`
    }
  ) : {
    left: `${visualX}%`,
    top: `${toCssY(visualY)}%`,
    zIndex: entZ,
    transform: `translate(-50%, -50%) rotate(${visualRotation}deg)`
  };

  const GatekeeperProp = level.GatekeeperPropComponent;

  // Orient floating reward item outward toward the screen center or away from walls so rewards never collide
  const rewardOffsetSelected = visualX > 50 ? '-translate-x-11' : 'translate-x-11';
  const rewardOffsetIdle = visualX > 50 ? '-translate-x-9' : 'translate-x-9';

  return (
    <div onClick={(e) => handleInteract(ent, e)} className={wrapperClasses} style={entityStyle}>
      <div className="relative">
        {inInkFog && (
          <div className="absolute inset-0 -top-4 left-1/2 -translate-x-1/2 z-[180] flex items-center justify-center pointer-events-none">
            <InkCloudSVG />
          </div>
        )}

        {!isDefeated && isSelected && !ent.isPreset && !inInkFog && (
          <div className={`absolute ${tooltipY} ${tooltipAlign} z-[100]`}>
            <div className="relative bg-white border-2 border-stone-800 rounded-2xl px-3 py-1.5 flex items-center shadow-xl text-lg font-bold whitespace-nowrap animate-bounce gap-1">
              {ent.id === 'final_gate' ? (
                <>
                  <span className="emoji-shadow">🔑</span>
                  <span className="text-sm font-black text-amber-600 shadow-none ml-1">x3</span>
                </>
              ) : isRock ? (
                <>
                  <span className="emoji-shadow">⛏️</span>
                  <span className="text-sm font-black text-amber-600 shadow-none ml-1">x1</span>
                </>
              ) : isChasm ? (
                <>
                  <span className="emoji-shadow">🪢</span>
                  <span className="text-sm font-black text-amber-600 shadow-none ml-1">x1</span>
                </>
              ) : isMurkyFar ? (
                <span className="flex items-center gap-1 text-sky-900 text-base font-black">
                  <span>🤿</span>
                  <span>❓</span>
                </span>
              ) : (
                Object.entries(groupedReqs).map(([reqId, count], i, arr) => (
                  <Fragment key={reqId}>
                    <span className="flex items-center gap-1 emoji-shadow" title={dict.items?.[reqId] || reqId}>
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

        {isAlerting && alertReason === 'inventory_full' && (
          <div className="absolute -top-12 left-1/2 -translate-x-1/2 z-[200] pointer-events-none animate-bounce flex flex-col items-center">
            <div className="bg-amber-500 text-stone-900 border-2 border-amber-200 rounded-full px-2.5 py-0.5 shadow-2xl flex items-center gap-1 text-sm font-black whitespace-nowrap">
              <span>🎒</span>
              <span className="text-red-700 text-xs font-black">✕</span>
            </div>
            <div className="w-2 h-2 bg-amber-500 border-b-2 border-r-2 border-amber-200 rotate-45 -mt-1" />
          </div>
        )}

        <div className={`relative ${inInkFog ? 'opacity-20 blur-[2px]' : ''}`}>
          {ent.isGatekeeper && !isRock && !isCurrent && GatekeeperProp && <GatekeeperProp />}

          <div className={`relative transition-all duration-700 ease-in-out ${
            (!isRock && !isCurrent && ent.isGatekeeper && isDefeated) 
              ? 'translate-x-12 translate-y-6 rotate-12 opacity-60 grayscale' 
              : (!isRock && !isCurrent && ent.isGatekeeper && isSelected) 
                ? 'translate-x-8 translate-y-2 rotate-3' 
                : (!isRock && !isCurrent && isDefeated && ent.id !== 'dolphin_1') 
                  ? 'opacity-50 grayscale' 
                  : ''
          }`}>

            {!isGoal && !ent.isRepeatable && !ent.isPreset && (
              isClam ? (
                (!isDefeated && rewardItem && isBuried && isSelected) ? (
                  <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[7cqw] drop-shadow-md pointer-events-none z-20 animate-bounce">❓</div>
                ) : null
              ) : (!isDefeated && rewardItem && isBuried) ? (
                <>
                  <div className={`absolute top-0 left-0 text-[9cqw] drop-shadow-md pointer-events-none transition-all duration-500 ease-out ${visualX > 50 ? '-translate-x-12' : 'translate-x-12'} translate-y-2 scale-90 opacity-90 -z-20`}>🕳️</div>
                  <div className={`absolute top-0 left-0 text-[9cqw] drop-shadow-md pointer-events-none transition-all duration-500 ease-out ${isSelected ? `${visualX > 50 ? '-translate-x-16' : 'translate-x-16'} -translate-y-4 rotate-12 scale-110 z-0 opacity-100` : `${visualX > 50 ? '-translate-x-12' : 'translate-x-12'} translate-y-2 scale-0 opacity-0 -z-10`}`}>❓</div>
                </>
              ) : (!isDefeated && rewardItem && !isBuried) ? (
                <div className={`absolute top-0 left-0 drop-shadow-md pointer-events-none transition-all duration-500 ease-out ${isSelected ? `${rewardOffsetSelected} -translate-y-4 rotate-12 scale-110 z-0` : `${rewardOffsetIdle} translate-y-0 rotate-0 scale-90 opacity-95 -z-10 animate-bob`}`}>
                  {isMurkyFar ? (
                    <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-sky-950/80 border border-cyan-400/50 flex items-center justify-center text-sm sm:text-base text-cyan-200 shadow-md">
                      ❓
                    </div>
                  ) : (
                    <span className="text-[8.5cqw]">{rewardItem.emoji}</span>
                  )}
                </div>
              ) : null
            )}

            <div className={`drop-shadow-xl relative z-10 ${
              ent.emoji === '🧌' 
                ? 'text-[18cqw]' 
                : (isRock || isChasm || ent.isExtraRock) 
                  ? (rockBounds ? 'w-full h-full' : ((ent.size || (ent.isGatekeeper ? 'large' : 'small')) === 'small' ? 'w-[20cqw] text-[20cqw]' : (ent.size || (ent.isGatekeeper ? 'large' : 'small')) === 'medium' ? 'w-[28cqw] text-[28cqw]' : 'w-[36cqw] text-[36cqw]')) 
                  : ent.isGatekeeper || isGoal 
                    ? 'text-[15cqw]' 
                    : 'text-[9.5cqw]'
            }`}>
              {isChasm ? (
                <div className={`flex justify-center items-center w-full h-full ${!isDefeated ? 'cursor-pointer' : 'pointer-events-none'}`}>
                  {level.ChasmComponent ? (
                    <level.ChasmComponent isDefeated={isDefeated} isAlerting={isAlerting} orientation={rockBounds?.orientation || 'horizontal'} />
                  ) : (
                    <div className={`w-full h-4 rounded border border-stone-900 ${isDefeated ? 'bg-amber-700/90' : 'bg-black/95'}`} />
                  )}
                </div>
              ) : (isRock || ent.isExtraRock) ? (
                <div className={`flex justify-center items-center transition-transform w-full ${isRock && !isDefeated ? 'cursor-pointer' : 'pointer-events-none'}`}>
                  {level.RockComponent ? (
                    <level.RockComponent 
                      isDefeated={isDefeated} 
                      isAlerting={isAlerting} 
                      isBreaking={Boolean(breakingRockIds[ent.id])} 
                      seed={ent.id} 
                      size={ent.size || (ent.isGatekeeper ? 'large' : 'small')} 
                      heroPos={displayPlayerPos}
                      yNode={ent.y}
                      nodeX={ent.x}
                      boundsOverride={ent.collarBounds || null}
                      yScale={effectiveYScale}
                    />
                  ) : (
                    <span className="text-[1.2em] drop-shadow-md">🪨</span>
                  )}
                </div>
              ) : isCurrent && isDefeated ? (
                <div className="text-[9cqw] opacity-0 scale-0 transition-all duration-500">🌀</div>
              ) : isCurrent && !isDefeated ? (
                <div className={`text-[12cqw] animate-spin-slow ${isAlerting ? 'animate-troll-mad text-red-500' : 'text-cyan-400'}`}>🌀</div>
              ) : (
                <div className={`${ent.filterClass || ''} ${isFlipped ? 'scale-x-[-1]' : ''} ${isAnimating ? 'animate-dog-dig' : ''}`}>
                  {isAlerting && !ent.isPreset ? (
                    alertReason === 'inventory_full' ? '🎒' :
                    (ent.id.startsWith('mermaid') ? '🥺' : '😡')
                  ) : isAlerting ? (
                    alertReason === 'inventory_full' ? '🎒' : '🚫'
                  ) : level.id === 'underwater' ? (
                    ent.id === 'sea_witch' ? (
                      <SeaWitchGateSVG
                        isTransformed={isTransformed}
                        hasDeepTreasure={hasDeepTreasure}
                        emoji={ent.emoji}
                      />
                    ) : isElevator ? (
                      <div className="relative flex flex-col items-center">
                        <div className={`w-[18cqw] h-[18cqw] flex items-center justify-center text-[12cqw] font-sans drop-shadow-2xl ${!isCustomEntity && !isAnimating ? 'animate-dolphin-idle' : ''} ${isAlerting ? 'animate-troll-mad' : ''}`}>
                          {ent.emoji}
                        </div>
                        {isDefeated && (
                          <div className=" -mt-2 bg-sky-950/90 border border-cyan-300 text-cyan-100 rounded-full px-2 py-0.5 text-[2.4cqw] font-black shadow-md pointer-events-none">
                            {visualY > 40 ? '⬆️' : '⬇️'}
                          </div>
                        )}
                      </div>
                    ) : ent.id.startsWith('mermaid') ? (
                      <div className={`flex items-center justify-center text-[11cqw] drop-shadow-xl ${!isAnimating ? 'animate-mermaid-swim' : ''}`}>
                        {ent.emoji}
                      </div>
                    ) : isClam ? (
                      <GiantClamSVG
                        isDefeated={isDefeated}
                        isBuried={isBuried}
                        isDigger={isDigger}
                        isGoal={isGoal}
                        isAlerting={isAlerting}
                        rewardEmoji={!isDefeated && !isBuried ? rewardItem?.emoji : null}
                        isMurkyFar={isMurkyFar}
                      />
                    ) : ent.isVent ? (
                      <BubbleVentSVG />
                    ) : (
                      ent.emoji
                    )
                  ) : (
                    ent.emoji
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
        {ent.isGatekeeper && isAlerting && (
          <div className="absolute -bottom-5 bg-red-700 text-white text-xs font-bold px-2 py-0.5 rounded border border-red-900 shadow-md scale-110 z-30">
            {dict.blocked}
          </div>
        )}
        {isGoal && !isDefeated && !isAlerting && level.id !== 'river_crossing' && level.id !== 'underwater' && (
          <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 text-purple-950 font-black tracking-widest text-lg drop-shadow-md z-30 bg-amber-100/80 px-2 rounded">
            {dict.exit}
          </div>
        )}
      </div>
    </div>
  );
}

export default GameEntity;
