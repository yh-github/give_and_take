import React from 'react';

const CaveVisibility = ({ heroPos, polygon, gameTime, screens = 2.5, lighting = {} }) => {
  const {
    radius = 45,
    blur = 1.2,
    darknessColor = '#080604',
    darknessOpacity = 0.95,
    ambientColor = '#ffaa3c',
    ambientOpacity = 0.06,
    flickerIntensity = 1.0
  } = lighting;

  // Hero Y must be scaled to match the SVG viewBox (0-250 for screens=2.5)
  const scaledHeroY = heroPos.y * screens;
  
  // Torch flicker
  const flicker = (Math.sin(gameTime * 10) * 0.8 + Math.sin(gameTime * 7) * 0.5) * flickerIntensity;
  const currentRadius = radius + flicker;
  
  const pointsString = React.useMemo(() => polygon ? polygon.map(p => `${p.x},${p.y}`).join(' ') : '', [polygon]);
  
  return (
    <svg 
      className="absolute inset-0 w-full h-full pointer-events-none z-[150] will-change-transform" 
      viewBox={`0 0 100 ${screens * 100}`} 
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
          <rect x="0" y="0" width="100" height={screens * 100} fill="white" />
          
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
        width="100" height={screens * 100} 
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
        />
      )}
    </svg>
  );
};

export default CaveVisibility;
