import React, { useMemo } from 'react';
import { getVisibilityPolygon } from '../../logic/visibility.js';
import { CAVE_WALL_VERTICES } from './components.jsx';

const CaveVisibility = ({ heroPos, mapNodes, unlockedZones, defeated, gameTime, radius = 28, screens = 2.5 }) => {
  const polygon = useMemo(() => 
    getVisibilityPolygon(heroPos, mapNodes, CAVE_WALL_VERTICES, unlockedZones, defeated, radius, screens),
    [heroPos.x, heroPos.y, mapNodes, unlockedZones, defeated, radius, screens]
  );
  
  // Torch flicker: subtle radius and position oscillation
  const flicker = Math.sin(gameTime * 10) * 0.5 + Math.sin(gameTime * 7) * 0.3;
  const currentRadius = radius + flicker;
  
  return (
    <svg 
      className="absolute inset-0 w-full h-full pointer-events-none z-[98]" 
      viewBox={`0 0 100 ${screens * 100}`} 
      preserveAspectRatio="none"
    >
      <defs>
        <filter id="visibilityBlur">
          <feGaussianBlur stdDeviation="1.5" />
        </filter>
        
        <radialGradient id="torchGrad" cx={`${heroPos.x}%`} cy={`${heroPos.y}%`} gradientUnits="userSpaceOnUse" r={`${currentRadius}%`}>
          <stop offset="0%" stopColor="white" stopOpacity="1" />
          <stop offset="40%" stopColor="white" stopOpacity="0.9" />
          <stop offset="70%" stopColor="white" stopOpacity="0.4" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </radialGradient>

        <mask id="caveMask">
          {/* Base: hide everything */}
          <rect x="0" y="0" width="100" height={screens * 100} fill="black" />
          
          {/* Visible area: the raycasted polygon */}
          {polygon && (
            <polygon 
              points={polygon} 
              fill="url(#torchGrad)" 
              filter="url(#visibilityBlur)"
            />
          )}
        </mask>
      </defs>

      {/* The actual darkness layer */}
      <rect 
        x="0" y="0" 
        width="100" height={screens * 100} 
        fill="#000" 
        mask="url(#caveMask)"
        opacity="0.98"
      />
    </svg>
  );
};

export default CaveVisibility;
