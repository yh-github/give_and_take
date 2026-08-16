import React, { Fragment } from 'react';
import { GiantClamSVG, BubbleVentSVG } from '../levels/underwater/components.jsx';
import { getCorridorBounds } from '../logic/geometry.js';
import { checkCollision } from '../logic/visibility.js';
import { CAVE_WALL_VERTICES } from '../levels/underground/components.jsx';

export function GameEntity({
  ent,
  puzzle,
  level,
  defeated,
  alertEntityId,
  selectedEntityId,
  animatingEntities,
  buriedEntities,
  inkFogEntities,
  unlockedZones,
  visibleEntitiesSet,
  wallSegments,
  displayPlayerPos,
  breakingRockIds,
  gameTime,
  getCustomEntityMovement,
  handleInteract,
  dict
}) {
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
  const inLightRadius = eDist < 28;
  const isVisible = level.mechanics.darknessType !== 'radial' || (visibleEntitiesSet && visibleEntitiesSet.has(ent.id));
  const inDarkness = !isVisible;

  const isBlockedByWall = inLightRadius && wallSegments.length > 0 &&
    checkCollision(
      { x: displayPlayerPos.x, y: displayPlayerPos.y * (level.mechanics.screens || 1) },
      { x: ent.x, y: ent.y * (level.mechanics.screens || 1) },
      wallSegments
    );

  const isRockVisible = (isRock || ent.isGatekeeper) && inLightRadius && !isBlockedByWall;
  const hideInDarkness = (inDarkness || isBlockedByWall) && !isRock && !ent.isGatekeeper;
  const hideRockBehindWall = (isRock || ent.isGatekeeper) && isBlockedByWall;

  const entZ = isSelected ? 200 : ((isRock || ent.isGatekeeper) ? (isRockVisible ? 165 : 110) : ((inLightRadius && !inFog && !inDarkness && !isBlockedByWall) ? 170 : ((ent.depth || 3) * 10 + 5)));
  const isInteractable = !inFog && (!inDarkness || (inLightRadius && !isBlockedByWall));

  const interactableHover = ((hideInDarkness && !inLightRadius) || hideRockBehindWall)
    ? 'pointer-events-none cursor-default opacity-0 invisible scale-0 transition-opacity duration-1000'
    : !isInteractable
      ? (isRock || ent.isGatekeeper) ? 'pointer-events-none cursor-default' : 'pointer-events-none cursor-default opacity-0 invisible scale-0 transition-opacity duration-1000'
      : inDarkness
        ? 'cursor-pointer opacity-60 grayscale'
        : (isDefeated && !ent.isGatekeeper && ent.id !== 'dolphin_1') || (isRock && isDefeated) || (isCurrent && isDefeated) ? 'cursor-default' : 'hover:scale-110 cursor-pointer';

  const isGatekeeperRock = (isRock || ent.isExtraRock) && level.id === 'underground' && CAVE_WALL_VERTICES;
  let rockBounds = null;
  if (isGatekeeperRock) {
    rockBounds = getCorridorBounds(ent.y, CAVE_WALL_VERTICES, ent.x >= 50);
  }

  const isBuried = isDigger && buriedEntities.includes(ent.id);
  const groupedReqs = (ent.requires || []).reduce((acc, reqId) => { acc[reqId] = (acc[reqId] || 0) + 1; return acc; }, {});
  const customMove = getCustomEntityMovement ? getCustomEntityMovement(ent) : null;
  const isCustomEntity = !!customMove;
  const wrapperClasses = `absolute flex flex-col items-center ${isCustomEntity ? 'transition-none' : 'transition-all duration-300'} ${isGatekeeperRock ? 'transform -translate-y-1/2' : (ent.roamClass && !ent.roamClass.includes('elevator')) ? ent.roamClass : 'transform -translate-x-1/2 -translate-y-1/2'} ${interactableHover}`;

  const isNearLeft = !ent.roamClass && ent.x <= 20;
  const isNearRight = !ent.roamClass && ent.x >= 80;
  const isNearTop = ent.y <= 25;
  const tooltipAlign = isNearLeft ? "left-0" : isNearRight ? "right-0" : "left-1/2 -translate-x-1/2";
  const tooltipY = isNearTop ? "top-full mt-2" : "bottom-full mb-2";
  const arrowAlign = isNearLeft ? "left-4" : isNearRight ? "right-4" : "left-1/2 -translate-x-1/2";
  const arrowY = isNearTop ? "-top-[7px] border-t-2 border-l-2" : "-bottom-[7px] border-b-2 border-r-2";

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
    visualY += Math.sin(gameTime * 1.5 + (ent.id.length * 0.7)) * 20;
  }

  const entityStyle = isGatekeeperRock ? { 
    left: `${rockBounds.xLeft}%`, 
    top: `${visualY}%`, 
    width: `${rockBounds.xRight - rockBounds.xLeft}%`,
    zIndex: entZ, 
    transform: `translate(0%, -50%) rotate(${visualRotation}deg)` 
  } : {
    left: `${visualX}%`, 
    top: `${visualY}%`, 
    zIndex: entZ, 
    transform: `translate(-50%, -50%) rotate(${visualRotation}deg)` 
  };

  const GatekeeperProp = level.GatekeeperPropComponent;

  return (
    <div onClick={(e) => handleInteract(ent, e)} className={wrapperClasses} style={entityStyle}>
      <div className={`relative ${depthScale} ${depthFilter}`}>
        {!isDefeated && isSelected && !ent.isPreset && (
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

        <div className="relative">
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

            <div className={`drop-shadow-xl relative z-10 ${
              ent.emoji === '🧌' 
                ? 'text-[18cqw]' 
                : (isRock || ent.isExtraRock) 
                  ? (rockBounds ? 'w-full' : ((ent.size || (ent.isGatekeeper ? 'large' : 'small')) === 'small' ? 'w-[20cqw] text-[20cqw]' : (ent.size || (ent.isGatekeeper ? 'large' : 'small')) === 'medium' ? 'w-[28cqw] text-[28cqw]' : 'w-[36cqw] text-[36cqw]')) 
                  : ent.isGatekeeper || isGoal 
                    ? 'text-[15cqw]' 
                    : 'text-[9cqw]'
            }`}>
              {(isRock || ent.isExtraRock) ? (
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
        {ent.isGatekeeper && isAlerting && (
          <div className="absolute -bottom-5 bg-red-700 text-white text-xs font-bold px-2 py-0.5 rounded border border-red-900 shadow-md scale-110 z-30">
            {dict.blocked}
          </div>
        )}
        {isGoal && !isDefeated && !isAlerting && level.id !== 'river_crossing' && (
          <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 text-purple-950 font-black tracking-widest text-lg drop-shadow-md z-30 bg-amber-100/80 px-2 rounded">
            {dict.exit}
          </div>
        )}
      </div>
    </div>
  );
}

export default GameEntity;
