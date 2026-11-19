import React from 'react';

/** @param {{ heroPos: { x: number, y: number }, polygon: ReadonlyArray<{ x: number, y: number }> | null, gameTime: number, screens?: number, worldHeight?: number | null, yScale?: number | null, lighting?: Record<string, unknown> }} props */
const CaveVisibility = ({ heroPos, polygon, gameTime, screens = 2.5, worldHeight = null, yScale = null, lighting = {} }) => {
  const {
    radius = 50,
    blur = 1.2,
    darknessColor = '#080604',
    darknessOpacity = 0.95,
    ambientColor = '#ffaa3c',
    ambientOpacity = 0.06,
    flickerIntensity = 1.0
  } = lighting;

  const effectiveHeight = worldHeight ?? (screens * 100);
  const effectiveYScale = yScale ?? screens;

  // Hero Y scaled to match the SVG viewBox
  const scaledHeroY = heroPos.y * effectiveYScale;
  
  // Torch flicker
  const flicker = (Math.sin(gameTime * 10) * 0.8 + Math.sin(gameTime * 7) * 0.5) * flickerIntensity;
  const currentRadius = radius + flicker;
  
  const pointsString = React.useMemo(() => polygon ? polygon.map(p => `${p.x},${p.y}`).join(' ') : '', [polygon]);
  
  return (
    <svg 
      className="absolute inset-0 w-full h-full pointer-events-none z-[150] will-change-transform" 
      viewBox={`0 0 100 ${effectiveHeight}`} 
      preserveAspectRatio="none"
    >
      <defs>
        <filter id="visibilityBlur">
          <feGaussianBlur stdDeviation={blur} />
        </filter>
        
        {/* Simplified Gradient: BLACK at center = LIT, fading to WHITE at edges = DARK */}
        <radialGradient id="torchMaskGrad" cx={heroPos.x} cy={scaledHeroY} gradientUnits="userSpaceOnUse" r={currentRadius}>
          <stop offset="0%" stopColor="black" />
          <stop offset="70%" stopColor="black" stopOpacity="0.8" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </radialGradient>

        <mask id="caveMask">
          {/* Base: show darkness everywhere */}
          <rect x="0" y="0" width="100" height={effectiveHeight} fill="white" />
          
          {/* Cut a hole where the hero's torch lights up — raycasted polygon */}
          {pointsString && (
            <polygon 
              points={pointsString} 
              fill="url(#torchMaskGrad)" 
              filter="url(#visibilityBlur)"
            />
          )}
        </mask>
      </defs>

      {/* Darkness layer — visible everywhere EXCEPT the torch hole */}
      <rect 
        x="0" y="0" 
        width="100" height={effectiveHeight} 
        fill={darknessColor} 
        mask="url(#caveMask)"
        opacity={darknessOpacity}
      />

      {/* Warm ambient tint inside the lit area — very subtle golden torch glow */}
      {pointsString && (
        <polygon 
          points={pointsString} 
          fill={ambientColor}
          fillOpacity={ambientOpacity}
          className={flickerIntensity > 0 ? 'animate-torch-flicker' : ''}
        />
      )}
    </svg>
  );
};

export default CaveVisibility;
