import React from 'react';
import { MAX_AIR } from '../constants.ts';
import type { LevelDefinition } from '../types/index.ts';

export interface AirIndicatorProps {
  air: number;
  level: LevelDefinition;
  isTransformed: boolean;
  isHeavy?: boolean;
  onSwimToSurface: () => void;
}

export function AirIndicator({
  air,
  level,
  isTransformed,
  isHeavy = false,
  onSwimToSurface
}: AirIndicatorProps) {
  if (!level.mechanics.hasAir || isTransformed) return null;

  return (
    <div
      title="Swim back to boat"
      onClick={onSwimToSurface}
      className={`absolute top-3 left-[54%] transform -translate-x-1/2 flex items-center gap-0.5 z-[150] bg-sky-950/85 px-2.5 py-1.5 rounded-full border-2 backdrop-blur-md cursor-pointer hover:bg-sky-900/90 transition-colors select-none ${
        isHeavy
          ? 'border-amber-400/90 shadow-[0_4px_15px_rgba(245,158,11,0.45)] hover:border-amber-300'
          : 'border-cyan-300/80 shadow-[0_4px_15px_rgba(0,0,0,0.45)] hover:border-cyan-200'
      }`}
    >
      {[...Array(MAX_AIR)].map((_, i) => (
        <div 
          key={i} 
          className={`text-base leading-none transition-all duration-300 ${
            i < air ? 'opacity-100 scale-100' : 'opacity-25 scale-75 drop-shadow-none grayscale'
          }`}
        >
          🫧
        </div>
      ))}
      {isHeavy && (
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
