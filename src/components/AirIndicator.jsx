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
      className="absolute top-4 left-1/2 transform -translate-x-1/2 flex gap-1 z-[150] bg-blue-900/60 p-2 sm:p-3 rounded-full border-2 border-blue-400 backdrop-blur-md shadow-lg cursor-pointer hover:bg-blue-700/80 hover:border-blue-300 transition-colors select-none"
    >
      {[...Array(MAX_AIR)].map((_, i) => (
        <div 
          key={i} 
          className={`text-xl sm:text-2xl transition-all duration-300 ${
            i < air ? 'opacity-100 scale-100' : 'opacity-30 scale-75 drop-shadow-none grayscale'
          }`}
        >
          🫧
        </div>
      ))}
    </div>
  );
}

export default AirIndicator;
