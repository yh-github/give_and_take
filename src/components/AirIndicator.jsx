import React from 'react';
import { MAX_AIR } from '../constants.js';

export function AirIndicator({
  air,
  level,
  isTransformed,
  onSwimToSurface
}) {
  if (!level.mechanics.hasAir || isTransformed) return null;

  return (
    <div
      title="Swim back to boat"
      onClick={onSwimToSurface}
      className="absolute top-3 left-[54%] transform -translate-x-1/2 flex items-center gap-0.5 z-[150] bg-sky-950/85 px-2.5 py-1.5 rounded-full border-2 border-cyan-300/80 backdrop-blur-md shadow-[0_4px_15px_rgba(0,0,0,0.45)] cursor-pointer hover:bg-sky-900/90 hover:border-cyan-200 transition-colors select-none"
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
    </div>
  );
}

export default AirIndicator;
