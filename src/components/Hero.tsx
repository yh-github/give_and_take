import React from 'react';
import type { CSSCustomProperties, LevelDefinition } from '../types/index.ts';

export interface HeroProps {
  playerVisualX: number;
  playerVisualY: number;
  playerVisualXPct?: number | null;
  playerVisualYPct?: number | null;
  playerRotation: number;
  playerScale: string;
  playerFilter: string;
  playerZ: number;
  playerTransition: string;
  playerTransitionDuration?: string;
  isTransformed: boolean;
  isSubmerged: boolean;
  isDrowning: boolean;
  heroFace: string;
  level: LevelDefinition;
  isAnimatingLoot: boolean;
  isInventoryFullAlert?: boolean;
  isHeavy?: boolean;
  lanternfishLightCount?: number;
}

export function Hero({
  playerVisualX,
  playerVisualY,
  playerVisualXPct = null,
  playerVisualYPct = null,
  playerRotation,
  playerScale,
  playerFilter,
  playerZ,
  playerTransition,
  playerTransitionDuration,
  isTransformed,
  isSubmerged,
  isDrowning,
  heroFace,
  level,
  isAnimatingLoot,
  isInventoryFullAlert = false,
  isHeavy = false,
  lanternfishLightCount = 0
}: HeroProps) {
  return (
    <div 
      data-testid={isDrowning ? 'drowned-hero' : undefined}
      className={`absolute transform transition-all ${playerTransition} pointer-events-none flex items-center justify-center ${playerScale} ${playerFilter}`} 
      style={{ 
        left: `${playerVisualXPct ?? playerVisualX}%`, 
        top: `${playerVisualYPct ?? playerVisualY}%`,  
        zIndex: Math.max(playerZ, isDrowning ? 190 : 160), 
        transform: `translate(-50%, -50%) rotate(${playerRotation}deg)`,
        ...(playerTransitionDuration ? { transitionDuration: playerTransitionDuration } : {})
      }}
    >
      {/* Pulsing Hypoxia Ring when Drowning */}
      {isDrowning && (
        <div
          aria-hidden="true"
          className="absolute inset-[-38%] rounded-full border-2 border-rose-400/80 bg-rose-500/20 animate-ping pointer-events-none"
        />
      )}

      {/* Bioluminescent Lanternfish Halo when carrying 1-3 Lanternfish in murky waters */}
      {lanternfishLightCount > 0 && level.mechanics.hasMurkyWater && !isDrowning && (
        <div
          data-testid="hero-lantern-glow"
          data-light-stacks={lanternfishLightCount}
          aria-hidden="true"
          className="absolute rounded-full pointer-events-none transition-all duration-500 -z-10"
          style={{
            width: `${18 + lanternfishLightCount * 10}cqw`,
            height: `${18 + lanternfishLightCount * 10}cqw`,
            background:
              'radial-gradient(circle, rgba(254,240,138,0.42) 0%, rgba(34,211,238,0.22) 48%, rgba(34,211,238,0) 75%)',
            boxShadow: `0 0 ${12 + lanternfishLightCount * 8}px rgba(103,232,249,0.45)`
          }}
        />
      )}

      {/* Cartoon Thought Bubble when Inventory is Full */}
      {isInventoryFullAlert && (
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 z-[220] pointer-events-none animate-bounce flex flex-col items-center">
          <div className="bg-white border-2 border-amber-600 rounded-2xl px-2 py-0.5 flex items-center gap-1 shadow-2xl text-sm font-black whitespace-nowrap">
            <span className="text-base">🎒</span>
            <span className="text-red-600 text-xs font-black">✕</span>
          </div>
          <div className="w-2 h-2 bg-white border-b-2 border-r-2 border-amber-600 rotate-45 -mt-1" />
        </div>
      )}

      <div 
        style={isHeavy && level.mechanics.heroBobs && !isDrowning && !isTransformed ? { animationDuration: '5.5s' } : undefined}
        className={`text-white w-[10cqw] h-[10cqw] rounded-full flex items-center justify-center shadow-[0_1cqw_2cqw_rgba(0,0,0,0.8)] text-[6cqw] relative ${
          isDrowning
            ? 'bg-indigo-950 border-2 border-rose-400 shadow-[0_0_24px_rgba(244,63,94,0.95)] animate-drown-limp'
            : isTransformed 
              ? 'bg-cyan-400 border-2 border-cyan-100 shadow-[0_0_15px_rgba(34,211,238,0.8)]' 
              : isSubmerged 
                ? `bg-teal-700 border-2 border-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.9)] ${isHeavy ? 'ring-2 ring-amber-400/90' : ''}` 
                : level.mechanics.hasAir 
                  ? `bg-amber-600 border-2 border-amber-200 ${isHeavy ? 'ring-2 ring-amber-400/90' : ''}` 
                  : 'bg-blue-600 border-2 border-white'
        } ${level.mechanics.heroBobs && !isDrowning && (level.id !== 'shipwreck' || isSubmerged) ? 'animate-bob' : ''}`}
      >
        {heroFace}
        {isDrowning && (
          <div
            aria-hidden="true"
            className="absolute inset-0 pointer-events-none z-50"
            style={{ transform: `rotate(${-playerRotation}deg)` }}
          >
            {[0, 1, 2, 3].map(i => (
              <div
                key={`drown-bub-${i}`}
                className="absolute text-sm sm:text-base animate-hero-air-bubble select-none"
                style={{
                  left: '50%',
                  top: '10%',
                  '--start-dx': `${(i - 1.5) * 9}px`,
                  '--end-dx': `${(i - 1.5) * 18}px`,
                  animationDelay: `${i * 180}ms`,
                  animationIterationCount: 'infinite',
                  animationDuration: '1.4s',
                } as CSSCustomProperties}
              >
                🫧
              </div>
            ))}
          </div>
        )}
        {isHeavy && isSubmerged && !isDrowning && !isTransformed && (
          <span
            data-testid="hero-heavy-badge"
            className="absolute -left-2 -bottom-1 text-xs drop-shadow-md select-none"
          >
            🎒
          </span>
        )}
        {(level.id === 'underwater' || (level.id === 'shipwreck' && isSubmerged)) && !isTransformed && isAnimatingLoot && (
          <div className="absolute inset-0 pointer-events-none z-50">
            {[0, 1, 2].map(i => (
              <div
                key={i}
                className="absolute text-sm sm:text-base animate-hero-air-bubble select-none"
                style={{
                  left: '50%',
                  top: '0%',
                  '--start-dx': `${(i - 1) * 8}px`,
                  '--end-dx': `${(i - 1) * 16}px`,
                  animationDelay: `${i * 150}ms`,
                  animationDuration: '1.0s',
                } as CSSCustomProperties}
              >
                🫧
              </div>
            ))}
          </div>
        )}
        {level.mechanics.darknessType === 'radial' && level.id !== 'shipwreck' && (
          <div className="absolute -right-3 -bottom-2 text-xl z-50 drop-shadow-[0_0_10px_rgba(251,191,36,1)]">
            🕯️
          </div>
        )}
      </div>
    </div>
  );
}

export default Hero;
