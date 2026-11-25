import React from 'react';
import { UNDERWATER_AIR_COST_ABYSS } from '../constants.ts';
import { getMaxAir } from '../logic/underwater.ts';
import type { LevelDefinition } from '../types/index.ts';

export interface AirIndicatorProps {
  air: number;
  level: LevelDefinition;
  isTransformed: boolean;
  isHeavy?: boolean;
  isAbyssalPressure?: boolean;
  onSwimToSurface: () => void;
}

export function AirIndicator({
  air,
  level,
  isTransformed,
  isHeavy = false,
  isAbyssalPressure = false,
  onSwimToSurface
}: AirIndicatorProps) {
  if (!level.mechanics.hasAir || isTransformed) return null;

  const maxAir = getMaxAir(level);
  const isCompactGrid = maxAir > 8;
  const gridColsClass = maxAir <= 10 ? 'grid-cols-5' : 'grid-cols-8';
  const abyssCost = isHeavy ? UNDERWATER_AIR_COST_ABYSS + 1 : UNDERWATER_AIR_COST_ABYSS;

  return (
    <div
      data-testid="air-indicator"
      title={level.id === 'shipwreck' ? 'Swim back to Sea Witch' : 'Swim back to boat'}
      onClick={onSwimToSurface}
      className={`absolute top-3 left-[54%] transform -translate-x-1/2 flex items-center gap-1 z-[150] bg-sky-950/85 px-2.5 py-1.5 rounded-full border-2 backdrop-blur-md cursor-pointer hover:bg-sky-900/90 transition-colors select-none ${
        isAbyssalPressure
          ? 'border-rose-400/90 shadow-[0_4px_15px_rgba(244,63,94,0.45)] hover:border-rose-300'
          : isHeavy
            ? 'border-amber-400/90 shadow-[0_4px_15px_rgba(245,158,11,0.45)] hover:border-amber-300'
            : 'border-cyan-300/80 shadow-[0_4px_15px_rgba(0,0,0,0.45)] hover:border-cyan-200'
      }`}
    >
      <div className={isCompactGrid ? `grid ${gridColsClass} gap-x-0.5 gap-y-0` : 'flex items-center gap-0.5'}>
        {[...Array(maxAir)].map((_, i) => (
          <div
            key={i}
            className={`${isCompactGrid ? 'text-[11px]' : 'text-base'} leading-none transition-all duration-300 ${
              i < air ? 'opacity-100 scale-100' : 'opacity-25 scale-75 drop-shadow-none grayscale'
            }`}
          >
            🫧
          </div>
        ))}
      </div>
      {isCompactGrid && (
        <span
          data-testid="air-count-badge"
          className="ml-0.5 text-[10px] font-mono font-black text-cyan-200 whitespace-nowrap"
        >
          {air}/{maxAir}
        </span>
      )}
      {isAbyssalPressure ? (
        <span
          data-testid="abyss-air-badge"
          className="ml-1 px-1.5 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-black leading-none whitespace-nowrap shadow-sm"
        >
          🌊 -{abyssCost}
        </span>
      ) : isHeavy && (
        <span
          data-testid="heavy-air-badge"
          className="ml-1 px-1.5 py-0.5 rounded-full bg-amber-500 text-stone-950 text-[10px] font-black leading-none whitespace-nowrap shadow-sm"
        >
          🎒 -2
        </span>
      )}
    </div>
  );
}

export default AirIndicator;
