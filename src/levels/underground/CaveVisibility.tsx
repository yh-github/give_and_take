import React from 'react';
import type { ExtraLightPolygon, LightingSettings, Point2D } from '../../types/index.ts';

export interface CaveVisibilityProps {
  heroPos: Point2D;
  polygon: readonly Point2D[] | null;
  extraLightPolygons?: readonly ExtraLightPolygon[];
  gameTime: number;
  screens?: number;
  worldWidth?: number | null;
  worldHeight?: number | null;
  yScale?: number | null;
  lighting?: Partial<LightingSettings>;
}

const CaveVisibility = ({
  heroPos,
  polygon,
  extraLightPolygons = [],
  gameTime,
  screens = 2.5,
  worldWidth = null,
  worldHeight = null,
  yScale = null,
  lighting = {}
}: CaveVisibilityProps) => {
  const {
    radius = 50,
    blur = 1.2,
    darknessColor = '#080604',
    darknessOpacity = 0.95,
    ambientColor = '#ffaa3c',
    ambientOpacity = 0.06,
    flickerIntensity = 1.0
  } = lighting;

  const effectiveWidth = worldWidth ?? 100;
  const effectiveHeight = worldHeight ?? (screens * 100);
  const effectiveYScale = yScale ?? screens;

  // Hero Y scaled to match the SVG viewBox
  const scaledHeroY = heroPos.y * effectiveYScale;
  
  // Torch flicker
  const flicker = (Math.sin(gameTime * 10) * 0.8 + Math.sin(gameTime * 7) * 0.5) * flickerIntensity;
  const currentRadius = radius + flicker;
  
  const pointsString = React.useMemo(() => polygon ? polygon.map(p => `${p.x},${p.y}`).join(' ') : '', [polygon]);
  const extraPaths = React.useMemo(
    () => extraLightPolygons.map(src => ({
      ...src,
      pointsString: src.polygon.map(p => `${p.x},${p.y}`).join(' ')
    })),
    [extraLightPolygons]
  );
  
  return (
    <svg 
      className="absolute inset-0 w-full h-full pointer-events-none z-[150] will-change-transform" 
      viewBox={`0 0 ${effectiveWidth} ${effectiveHeight}`} 
      preserveAspectRatio="none"
    >
      <defs>
        <filter id="visibilityBlur">
          <feGaussianBlur stdDeviation={blur} />
        </filter>
        
        {/* Transparent black-opacity gradients let multiple light sources overlap without dark halos */}
        <radialGradient id="torchMaskGrad" cx={heroPos.x} cy={scaledHeroY} gradientUnits="userSpaceOnUse" r={currentRadius}>
          <stop offset="0%" stopColor="black" stopOpacity="1" />
          <stop offset="70%" stopColor="black" stopOpacity="0.82" />
          <stop offset="100%" stopColor="black" stopOpacity="0" />
        </radialGradient>

        {extraPaths.map((src, idx) => (
          <radialGradient
            key={`extra-grad-${src.id}-${idx}`}
            id={`extraLightGrad_${idx}`}
            cx={src.x}
            cy={src.y * effectiveYScale}
            gradientUnits="userSpaceOnUse"
            r={Math.max(8, src.radius + flicker * 0.65)}
          >
            <stop offset="0%" stopColor="black" stopOpacity="1" />
            <stop offset="68%" stopColor="black" stopOpacity="0.8" />
            <stop offset="100%" stopColor="black" stopOpacity="0" />
          </radialGradient>
        ))}

        <mask id="caveMask">
          {/* Base: show darkness everywhere */}
          <rect x="0" y="0" width={effectiveWidth} height={effectiveHeight} fill="white" />
          
          {/* Cut holes where the hero's torch & lit braziers/campfire shine */}
          {extraPaths.map((src, idx) => (
            src.pointsString ? (
              <polygon
                key={`extra-mask-${src.id}-${idx}`}
                points={src.pointsString}
                fill={`url(#extraLightGrad_${idx})`}
                filter="url(#visibilityBlur)"
              />
            ) : null
          ))}

          {pointsString && (
            <polygon 
              points={pointsString} 
              fill="url(#torchMaskGrad)" 
              filter="url(#visibilityBlur)"
            />
          )}
        </mask>
      </defs>

      {/* Darkness layer — visible everywhere EXCEPT the lit light pools */}
      <rect 
        x="0" y="0" 
        width={effectiveWidth} height={effectiveHeight} 
        fill={darknessColor} 
        mask="url(#caveMask)"
        opacity={darknessOpacity}
      />

      {/* Warm ambient tint inside lit braziers and hero torch */}
      {extraPaths.map((src, idx) => (
        src.pointsString ? (
          <polygon
            key={`extra-glow-${src.id}-${idx}`}
            points={src.pointsString}
            fill={src.ambientColor || ambientColor}
            fillOpacity={ambientOpacity * 0.85}
          />
        ) : null
      ))}
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
