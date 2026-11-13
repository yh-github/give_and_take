import React from 'react';

export function DebugRays({
  debugMode,
  level,
  polyPoints,
  displayPlayerPos,
  debugSegments,
  worldHeight = null,
  yScale = null
}) {
  if (!debugMode || !level.mechanics.hasDarkness) return null;

  const screens = level.mechanics.screens || 1;
  const effectiveHeight = worldHeight ?? (100 * screens);
  const effectiveYScale = yScale ?? (level.mechanics.useIsotropicCoords ? 1 : screens);

  return (
    <div className="absolute inset-0 pointer-events-none z-[160]">
      <svg 
        className="w-full h-full" 
        viewBox={`0 0 100 ${effectiveHeight}`} 
        preserveAspectRatio="none"
      >
        {/* Draw the polygon */}
        {polyPoints && (
          <polygon
            points={polyPoints.map(p => `${p.x},${p.y}`).join(' ')}
            fill="rgba(255, 0, 255, 0.15)"
            stroke="#ff00ff"
            strokeWidth="0.4"
          />
        )}
        {/* Draw the light origin */}
        {displayPlayerPos && (
          <circle
            cx={displayPlayerPos.x}
            cy={displayPlayerPos.y * effectiveYScale}
            r="1.2"
            fill="#ff00ff"
            className="animate-pulse"
          />
        )}
        {/* Draw the rays */}
        {polyPoints && displayPlayerPos && polyPoints.map((p, i) => (
          <line
            key={`ray_${i}`}
            x1={displayPlayerPos.x}
            y1={displayPlayerPos.y * effectiveYScale}
            x2={p.x}
            y2={p.y}
            stroke="#ff00ff"
            strokeWidth="0.1"
            opacity="0.4"
          />
        ))}
        {/* Draw hit points */}
        {polyPoints && polyPoints.map((p, i) => (
          <circle
            key={`hit_${i}`}
            cx={p.x}
            cy={p.y}
            r="0.35"
            fill="#ff00ff"
          />
        ))}
        {/* Draw the obstacles (segments) */}
        {debugSegments && debugSegments.map((s, i) => (
          <line
            key={i}
            x1={s.a.x} 
            y1={s.a.y}
            x2={s.b.x} 
            y2={s.b.y}
            stroke="#ff00ff"
            strokeWidth="0.75"
            strokeDasharray="2,1"
            opacity="0.8"
          />
        ))}
      </svg>
    </div>
  );
}

export default DebugRays;
