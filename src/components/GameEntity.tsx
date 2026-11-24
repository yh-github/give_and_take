import React, { Fragment, type CSSProperties, type MouseEvent } from 'react';
import { UNDERWATER_INSPECT_RADIUS } from '../constants.ts';
import {
  GiantClamSVG,
  SeaWitchGrottoSVG,
  SunkenVaultSVG,
  InteractiveKelpSVG,
  InkCloudSVG
} from '../levels/underwater/components.tsx';
import {
  ShipwreckWitchSVG,
  CaptainsTreasureSVG
} from '../levels/shipwreck/components.tsx';
import { getCorridorBounds } from '../logic/geometry.ts';
import { CAVE_WALL_VERTICES } from '../levels/underground/components.tsx';
import type {
  AlertReason,
  CSSCustomProperties,
  CollarBounds,
  CorridorBounds,
  CustomEntityMovement,
  LevelDefinition,
  ObstacleSegment,
  Point2D,
  PuzzleData,
  PuzzleEntity,
  TranslationDictionary
} from '../types/index.ts';

export interface GameEntityProps {
  ent: PuzzleEntity;
  puzzle: PuzzleData;
  level: LevelDefinition;
  defeated: string[];
  alertEntityId: string | number | null;
  alertReason: AlertReason;
  selectedEntityId: string | null;
  animatingEntities: string[];
  buriedEntities: string[];
  inkFogEntities: Set<string>;
  unlockedZones: number[];
  visibleEntitiesSet: Set<string> | null;
  wallSegments: readonly ObstacleSegment[];
  displayPlayerPos: Point2D | null;
  breakingRockIds: Record<string, boolean>;
  bridgingChasmIds?: Record<string, boolean>;
  isTransformed: boolean;
  hasDeepTreasure: boolean;
  getCustomEntityMovement?: ((ent: PuzzleEntity) => CustomEntityMovement | null) | null;
  handleInteract: (ent: PuzzleEntity, e: MouseEvent) => void;
  dict: TranslationDictionary;
  toCssX?: (x: number) => number;
  toCssY?: (y: number) => number;
  yScale?: number | null;
}

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
  wallSegments: _wallSegments,
  displayPlayerPos,
  breakingRockIds,
  bridgingChasmIds = {},
  isTransformed,
  hasDeepTreasure,
  getCustomEntityMovement,
  handleInteract,
  dict,
  toCssX = (x) => x,
  toCssY = (y) => y,
  yScale = null
}: GameEntityProps) {
  const isDefeated = defeated.includes(ent.id);
  if (ent.isPreset && !ent.isVent && isDefeated) return null;

  const isGoal = ent.id === puzzle.goalEntityId;
  const rewardItem = ent.reward ? level.items.find(i => i.id === ent.reward) : null;
  const isAlerting = alertEntityId === ent.id;
  const isSelected = selectedEntityId === ent.id;
  const isAnimating = animatingEntities.includes(ent.id);

  const isDigger = Boolean(level.specialEntityTemplate && ent.id?.startsWith(level.specialEntityTemplate) && !ent.isGoal);
  const isClam = Boolean(ent.id?.startsWith('clam') || ent.id?.startsWith('giant_clam'));
  const isAquaticLevel = level.id === 'underwater' || level.id === 'shipwreck';
  const isChasm = Boolean(ent.isGatekeeper && ent.gateType === 'chasm');
  const isGuardian = Boolean(ent.isGatekeeper && ent.gateType === 'guardian');
  const isRock = (ent.isGatekeeper && level.mechanics.hasPickaxe && ent.id !== 'final_gate' && !isChasm && !isGuardian) || ent.isExtraRock;
  const isCurrent = ent.id === 'current' || (ent.isGatekeeper && ent.id?.startsWith('current_'));
  const effectiveYScale = yScale ?? (level.mechanics.useIsotropicCoords ? 1 : (level.mechanics.screens || 2.5));

  const inZoneFog = level.mechanics.hasFog && level.id !== 'deep_cave' && !unlockedZones.includes(ent.zone) && !(ent.isGatekeeper && ent.unlocksZones && ent.unlocksZones.some(z => unlockedZones.includes(z)));
  const inInkFog = inkFogEntities.has(ent.id);

  const isVisible = level.mechanics.darknessType !== 'radial' || (visibleEntitiesSet && visibleEntitiesSet.has(ent.id));
  const inDarkness = !isVisible;

  const entZ = isSelected ? 200 : ((isRock || isChasm || ent.isGatekeeper || ent.id === 'sea_witch') ? 110 : ((isVisible && !inZoneFog) ? 105 : 35));
  const isInteractable = !inZoneFog && !inDarkness && !inInkFog;

  const interactableHover = (inDarkness || inZoneFog)
    ? `pointer-events-none cursor-default opacity-0 invisible ${(isRock || isChasm) ? '' : 'scale-0'} transition-opacity duration-1000`
    : inInkFog
      ? 'pointer-events-none cursor-default'
      : !isInteractable
        ? (isRock || isChasm || ent.isGatekeeper) ? 'pointer-events-none cursor-default' : 'pointer-events-none cursor-default opacity-0 invisible scale-0 transition-opacity duration-1000'
        : (isDefeated && !ent.isGatekeeper && ent.id !== 'dolphin_1' && ent.id !== 'sea_witch' && !ent.isVent) || (isRock && isDefeated) || (isChasm && isDefeated) || (isCurrent && isDefeated)
          ? 'cursor-default'
          : (isRock || isChasm) ? 'cursor-pointer' : 'hover:scale-110 cursor-pointer';

  const hasCustomCollar = Boolean((isRock || isChasm || ent.isExtraRock) && ent.collarBounds);
  const isGatekeeperRock = hasCustomCollar || ((isRock || ent.isExtraRock) && level.id === 'underground' && CAVE_WALL_VERTICES);
  let rockBounds: (CorridorBounds & Partial<CollarBounds>) | null | undefined = null;
  if (hasCustomCollar) {
    rockBounds = ent.collarBounds;
  } else if (isGatekeeperRock) {
    rockBounds = getCorridorBounds(ent.y, CAVE_WALL_VERTICES, ent.x >= 50);
  }

  const isBuried = (isDigger || isClam) && buriedEntities.includes(ent.id);
  const effectiveTooltipReqs =
    level.id === 'underwater' && ent.id === 'sea_witch' && isTransformed
      ? (ent.returnRequires || [])
      : (ent.requires || []);
  const effectiveTooltipReqType =
    level.id === 'underwater' && ent.id === 'sea_witch' && isTransformed
      ? 'AND'
      : ent.reqType;
  const groupedReqs = effectiveTooltipReqs.reduce<Record<string, number>>((acc, reqId) => {
    acc[reqId] = (acc[reqId] || 0) + 1;
    return acc;
  }, {});
  const customMove = getCustomEntityMovement ? getCustomEntityMovement(ent) : null;
  const isCustomEntity = Boolean(customMove && customMove.isActiveMotion);
  const wrapperClasses = `absolute transform flex flex-col items-center ${isCustomEntity ? 'transition-none' : 'transition-all duration-300'} ${(ent.roamClass && !ent.roamClass.includes('elevator')) ? ent.roamClass : ''} ${interactableHover}`;

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
    ent.id !== 'captains_chest' &&
    heroDist > UNDERWATER_INSPECT_RADIUS
  );

  const worldWidth = puzzle?.geometry?.worldWidth || 100;
  const isNearLeft = !ent.roamClass && visualX <= 22;
  const isNearRight = !ent.roamClass && visualX >= worldWidth - 22;
  const isNearTop = toCssY(visualY) <= 14;
  const tooltipAlign = isNearLeft ? "left-0" : isNearRight ? "right-0" : "left-1/2 -translate-x-1/2";
  const tooltipY = isNearTop ? "top-full mt-2" : "bottom-full mb-2";
  const arrowAlign = isNearLeft ? "left-4" : isNearRight ? "right-4" : "left-1/2 -translate-x-1/2";
  const arrowY = isNearTop ? "-top-[7px] border-t-2 border-l-2" : "-bottom-[7px] border-b-2 border-r-2";

  const isElevator = ent.roamClass?.includes('elevator');
  const isMermaid = Boolean(level.id === 'underwater' && ent.id.startsWith('mermaid'));
  const isWitch = ent.id === 'sea_witch';
  const returnRelicEmoji =
    (ent.returnRequires && ent.returnRequires[0]
      ? level.items.find(i => i.id === ent.returnRequires![0])?.emoji
      : null) || '🔮';
  const vaultReqEmojis = (ent.requires || []).map(
    id => level.items.find(i => i.id === id)?.emoji || '❓'
  );
  const isVerticalCollar = rockBounds?.orientation === 'vertical';
  const worldHeight = puzzle?.geometry?.worldHeight;

  const rockWidthPct = rockBounds ? (toCssX(rockBounds.xRight) - toCssX(rockBounds.xLeft)) : 0;
  const entityStyle: CSSProperties = (isGatekeeperRock && rockBounds) ? (
    isVerticalCollar && worldHeight && rockBounds.yTop != null && rockBounds.yBottom != null ? {
      left: `${toCssX(rockBounds.xLeft)}%`,
      top: `${toCssY(rockBounds.yTop)}%`,
      width: `${Math.max(toCssX(4), rockWidthPct)}%`,
      height: `${((rockBounds.yBottom - rockBounds.yTop) / worldHeight) * 100}%`,
      zIndex: entZ,
      transform: `rotate(${visualRotation}deg)`
    } : {
      left: `${toCssX(rockBounds.xLeft)}%`,
      top: `${toCssY(visualY)}%`,
      width: `${rockWidthPct}%`,
      zIndex: entZ,
      transform: `translate(0%, -50%) rotate(${visualRotation}deg)`
    }
  ) : {
    left: `${toCssX(visualX)}%`,
    top: `${toCssY(visualY)}%`,
    zIndex: entZ,
    transform: `translate(-50%, -50%) rotate(${visualRotation}deg)`
  };

  const GatekeeperProp = level.GatekeeperPropComponent;

  // Orient floating reward item outward toward the cave interior or away from walls so rewards never collide
  const rewardOffsetSelected = visualX > worldWidth / 2 ? '-translate-x-11' : 'translate-x-11';
  const rewardOffsetIdle = visualX > worldWidth / 2 ? '-translate-x-9' : 'translate-x-9';

  return (
    <div data-testid={`entity-${ent.id}`} onClick={(e) => handleInteract(ent, e)} className={wrapperClasses} style={entityStyle}>
      <div className={`relative ${isGatekeeperRock ? 'w-full h-full flex items-center justify-center' : ''}`}>
        {inInkFog && (
          <div className="absolute inset-0 -top-4 left-1/2 -translate-x-1/2 z-[180] flex items-center justify-center pointer-events-none">
            <InkCloudSVG />
          </div>
        )}

        {!isDefeated && isSelected && !ent.isPreset && !inInkFog && (
          <div className={`absolute ${tooltipY} ${tooltipAlign} z-[100]`}>
            <div dir="ltr" className="relative bg-white border-2 border-stone-800 rounded-2xl px-3 py-1.5 flex items-center shadow-xl text-lg font-bold whitespace-nowrap animate-bounce gap-1">
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
                <>
                  {level.id === 'underwater' && isWitch && isTransformed && !hasDeepTreasure && (
                    <span className="emoji-shadow mr-1" title={dict.items?.crown || 'Sunken Crown'}>👑 +</span>
                  )}
                  {Object.entries(groupedReqs).map(([reqId, count], i, arr) => (
                    <Fragment key={reqId}>
                      <span className="flex items-center gap-1 emoji-shadow" title={dict.items?.[reqId] || reqId}>
                        {count > 1 && <span className="text-sm font-black text-amber-600" style={{ textShadow: 'none' }}>{count}x</span>}
                        {level.items.find(item => item.id === reqId)?.emoji || '❓'}
                      </span>
                      {i < arr.length - 1 && <span className="text-sm mx-1 text-stone-500 font-black">{effectiveTooltipReqType === 'AND' ? '&' : dict.or}</span>}
                    </Fragment>
                  ))}
                  {level.id === 'underwater' && isWitch && isTransformed && (
                    <span className="text-sm font-black text-emerald-700 ml-1" style={{ textShadow: 'none' }}>➔ 🤠</span>
                  )}
                  {level.id === 'underwater' && !isGoal && !isWitch && ent.id === 'dolphin_1' && (
                    <span className="flex items-center gap-1 ml-1 text-sm font-black text-sky-900" style={{ textShadow: 'none' }}>
                      <span>➔</span>
                      <span className="text-base">{visualY > 40 ? '⬆️' : '⬇️'}</span>
                    </span>
                  )}
                  {isAquaticLevel && !isGoal && !isWitch && rewardItem && (
                    <span className="flex items-center gap-1 ml-1 text-sm font-black text-sky-900" style={{ textShadow: 'none' }}>
                      <span>➔</span>
                      <span className="emoji-shadow text-lg">{isBuried ? '❓' : rewardItem.emoji}</span>
                    </span>
                  )}
                </>
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

        <div className={`relative ${isGatekeeperRock ? 'w-full h-full flex items-center justify-center' : ''} ${inInkFog ? 'opacity-20 blur-[2px]' : ''}`}>
          {ent.isGatekeeper && !isRock && !isChasm && !isCurrent && GatekeeperProp && <GatekeeperProp />}

          <div className={`relative ${isGatekeeperRock ? 'w-full h-full flex items-center justify-center' : ''} transition-all duration-700 ease-in-out ${
            (!isRock && !isChasm && !isCurrent && ent.isGatekeeper && isDefeated) 
              ? 'translate-x-12 translate-y-6 rotate-12 opacity-60 grayscale' 
              : (!isRock && !isChasm && !isCurrent && isDefeated && ent.id !== 'dolphin_1' && ent.id !== 'sea_witch') 
                ? 'opacity-50 grayscale' 
                : ''
          }`}>

            {!isAquaticLevel && !isGoal && !ent.isRepeatable && !ent.isPreset && (
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
                    <level.ChasmComponent
                      isDefeated={isDefeated}
                      isAlerting={isAlerting}
                      isBridging={Boolean(bridgingChasmIds?.[ent.id])}
                      isSelected={isSelected}
                      orientation={rockBounds?.orientation || 'horizontal'}
                      seed={ent.id}
                      heroPos={displayPlayerPos}
                      yNode={ent.y}
                      nodeX={ent.x}
                      boundsOverride={ent.collarBounds || null}
                      geometry={puzzle?.geometry || null}
                      yScale={effectiveYScale}
                    />
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
                      geometry={puzzle?.geometry || null}
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
                      <SeaWitchGrottoSVG
                        isTransformed={isTransformed}
                        hasDeepTreasure={hasDeepTreasure}
                        returnRelicEmoji={returnRelicEmoji}
                        emoji={ent.emoji}
                      />
                    ) : ent.id === 'sunken_vault' ? (
                      <SunkenVaultSVG
                        reqEmojis={vaultReqEmojis}
                        isDefeated={isDefeated}
                        isAlerting={isAlerting}
                        isMurkyFar={isMurkyFar}
                      />
                    ) : ent.isPreset === 'kelp' ? (
                      <InteractiveKelpSVG variant="harvest" />
                    ) : ent.isPreset ? (
                      <div className="w-11 h-11 rounded-full bg-amber-950/75 border-2 border-amber-300/70 flex items-center justify-center text-2xl shadow-[0_0_12px_rgba(251,191,36,0.5)] animate-bob">
                        {ent.emoji || rewardItem?.emoji}
                      </div>
                    ) : isElevator ? (
                      <div className="relative flex flex-col items-center">
                        <div
                          data-testid="dolphin-sprite"
                          style={!isCustomEntity && !isAnimating ? { animationPlayState: isSelected ? 'paused' : 'running' } : undefined}
                          className={`relative w-[18cqw] h-[18cqw] flex items-center justify-center text-[12cqw] font-sans drop-shadow-2xl ${!isCustomEntity && !isAnimating ? 'animate-dolphin-playful' : ''} ${isAlerting ? 'animate-troll-mad' : ''}`}
                        >
                          {ent.emoji}
                          {!isCustomEntity && (
                            <span
                              aria-hidden="true"
                              className="absolute -top-1 -right-1 text-[4.5cqw] opacity-85 animate-pulse pointer-events-none"
                            >
                              💦
                            </span>
                          )}
                        </div>
                        <div className="-mt-2 bg-sky-950/90 border border-cyan-300 text-cyan-100 rounded-full px-2 py-0.5 text-[2.4cqw] font-black shadow-md pointer-events-none flex items-center gap-1">
                          <span>🐟</span>
                          <span>➔</span>
                          <span>{visualY > 40 ? '⬆️' : '⬇️'}</span>
                        </div>
                      </div>
                    ) : isMermaid ? (
                      <div
                        data-testid={`mermaid-orbit-${ent.id}`}
                        className={ent.orbit ? 'animate-mermaid-orbit-x' : ''}
                        style={{
                          '--orbit-rx': `${(ent.orbit?.rx ?? 18) * 0.72}cqw`,
                          '--orbit-dur': `${ent.orbit?.duration ?? 8}s`,
                          '--orbit-delay': `${ent.orbit?.delay ?? 0}s`,
                          animationPlayState: (isSelected || isDefeated) ? 'paused' : 'running'
                        } as CSSCustomProperties}
                      >
                        <div
                          className={ent.orbit ? 'animate-mermaid-orbit-y' : ''}
                          style={{
                            '--orbit-ry': `${(ent.orbit?.ry ?? 8) * 0.65}cqw`,
                            '--orbit-dur': `${ent.orbit?.duration ?? 8}s`,
                            '--orbit-delay': `${ent.orbit?.delay ?? 0}s`,
                            animationPlayState: (isSelected || isDefeated) ? 'paused' : 'running'
                          } as CSSCustomProperties}
                        >
                          <div className={`flex items-center justify-center text-[11cqw] drop-shadow-xl ${!isAnimating ? 'animate-mermaid-swim' : ''}`}>
                            {ent.emoji}
                          </div>
                        </div>
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
                    ) : (
                      ent.emoji
                    )
                  ) : level.id === 'shipwreck' ? (
                    ent.id === 'sea_witch' ? (
                      <ShipwreckWitchSVG
                        isTransformed={isTransformed}
                        reqEmojis={vaultReqEmojis}
                        emoji={ent.emoji}
                      />
                    ) : ent.id === 'captains_chest' ? (
                      <CaptainsTreasureSVG
                        isDefeated={isDefeated}
                        isTransformed={isTransformed}
                        isAlerting={isAlerting}
                        reqEmojis={vaultReqEmojis}
                      />
                    ) : ent.isPreset === 'kelp' ? (
                      <InteractiveKelpSVG variant="harvest" />
                    ) : ent.isPreset ? (
                      <div className="w-11 h-11 rounded-full bg-amber-950/75 border-2 border-amber-300/70 flex items-center justify-center text-2xl shadow-[0_0_12px_rgba(251,191,36,0.5)] animate-bob">
                        {ent.emoji || rewardItem?.emoji}
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
                    ) : (
                      ent.emoji
                    )
                  ) : (
                    ent.emoji || rewardItem?.emoji
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
        {isGoal && !isDefeated && !isAlerting && level.id !== 'river_crossing' && !isAquaticLevel && (
          <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 text-purple-950 font-black tracking-widest text-lg drop-shadow-md z-30 bg-amber-100/80 px-2 rounded">
            {dict.exit}
          </div>
        )}
      </div>
    </div>
  );
}

export default GameEntity;
