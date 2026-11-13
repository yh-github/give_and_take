import React, { memo, useMemo } from 'react';
import { CampIcon, RockSVG } from '../underground/components.jsx';

export { CampIcon, RockSVG };

function polylineToSvgSubpath(points) {
  if (!points || points.length < 3) return '';
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    d += ` L ${points[i].x} ${points[i].y}`;
  }
  return `${d} Z`;
}

/**
 * Dynamic procedural cavern backdrop for `deep_cave` ("The Abyssal Descent").
 * Renders extracted `wallPolylines` as rocky fill mass using SVG even-odd masking
 * plus a soft surface-light pit highlight at the starting camp.
 */
export const DeepCaveBackground = memo(({ geometry }) => {
  const worldWidth = geometry?.worldWidth || 100;
  const worldHeight = geometry?.worldHeight || 256;
  const campPos = geometry?.campPos || { x: 50, y: 24 };

  const wallPathData = useMemo(() => {
    const outerFrame = `M 0 0 L ${worldWidth} 0 L ${worldWidth} ${worldHeight} L 0 ${worldHeight} Z`;
    const polylines = geometry?.wallPolylines || [];
    if (polylines.length === 0) return outerFrame;

    // Outer frame filled; positive-area outer loop punches open cavern; negative-area pillars fill solid rock inside
    const parts = [outerFrame];
    for (const poly of polylines) {
      const pts = Array.isArray(poly) ? poly : poly?.points;
      const sub = polylineToSvgSubpath(pts);
      if (sub) parts.push(sub);
    }
    return parts.join(' ');
  }, [geometry?.wallPolylines, worldWidth, worldHeight]);

  const edgePaths = useMemo(() => {
    const polylines = geometry?.wallPolylines || [];
    return polylines
      .map((poly, idx) => {
        const pts = Array.isArray(poly) ? poly : poly?.points;
        const d = polylineToSvgSubpath(pts);
        return d ? { id: idx, d } : null;
      })
      .filter(Boolean);
  }, [geometry?.wallPolylines]);

  return (
    <div className="absolute inset-0 bg-[#2b221d] pointer-events-none z-0 overflow-hidden">
      {/* Subtle mineral pebble grain matching underground palette */}
      <div
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: 'radial-gradient(#1a1512 2px, transparent 2px)',
          backgroundSize: '36px 36px'
        }}
      />

      <svg
        className="absolute inset-0 w-full h-full pointer-events-none z-0"
        viewBox={`0 0 ${worldWidth} ${worldHeight}`}
        preserveAspectRatio="none"
      >
        <defs>
          <radialGradient id="deepCaveCampGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#93c5fd" stopOpacity="0.22" />
            <stop offset="55%" stopColor="#fde68a" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#2b221d" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="deepCaveDepthWash" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3a2e27" stopOpacity="0.18" />
            <stop offset="50%" stopColor="#231b16" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#140f12" stopOpacity="0.52" />
          </linearGradient>
        </defs>

        {/* Depth gradient wash as hero descends deeper */}
        <rect x="0" y="0" width={worldWidth} height={worldHeight} fill="url(#deepCaveDepthWash)" />

        {/* Soft surface shaft spill near camp entrance */}
        <circle cx={campPos.x} cy={campPos.y} r="28" fill="url(#deepCaveCampGlow)" />

        {/* Procedural extracted cave rock shell and pillars */}
        <path
          d={wallPathData}
          fill="#16110e"
          fillRule="evenodd"
        />

        {/* Subtle beveled stone rims along contour edges */}
        {edgePaths.map(edge => (
          <path
            key={edge.id}
            d={edge.d}
            fill="none"
            stroke="#080605"
            strokeWidth="0.9"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>
    </div>
  );
});

/**
 * Chasm / Abyssal Fissure Gatekeeper Visual.
 * Renders a dark stone chasm until bridged with a `rope`, after which it
 * displays a permanent rope-and-plank crossing bridge.
 */
export const ChasmSVG = memo(({ isDefeated, isAlerting, orientation = 'horizontal' }) => {
  const isVertical = orientation === 'vertical';

  return (
    <div className="w-full h-full relative pointer-events-none flex items-center justify-center">
      <svg
        viewBox={isVertical ? '0 0 44 160' : '0 0 160 44'}
        preserveAspectRatio="none"
        className={`w-full h-full overflow-visible drop-shadow-md ${isAlerting ? 'animate-shake' : ''}`}
      >
        <g transform={isVertical ? 'translate(44, 0) rotate(90)' : undefined}>
          {/* Jagged chasm pit */}
          <path
            d="M 2 6 L 34 3 L 78 7 L 122 2 L 158 6 L 158 38 L 120 42 L 76 37 L 32 41 L 2 38 Z"
            fill="#070607"
            stroke={isAlerting ? '#ef4444' : '#3f322a'}
            strokeWidth="2.5"
            vectorEffect="non-scaling-stroke"
          />
          <path
            d="M 8 13 L 45 10 L 84 14 L 118 11 L 152 14 L 152 31 L 114 35 L 78 30 L 40 34 L 8 30 Z"
            fill="#020203"
            opacity="0.95"
          />

          {/* Abyss highlight streaks */}
          {!isDefeated && (
            <g opacity="0.5">
              <path d="M 18 22 Q 48 18 74 23 T 142 21" stroke="#312e81" strokeWidth="2" fill="none" />
              <path d="M 26 27 Q 65 29 98 25 T 136 28" stroke="#1e1b4b" strokeWidth="1.5" fill="none" />
            </g>
          )}

          {/* Bridged state: taut anchor ropes & wooden slats */}
          {isDefeated && (
            <g>
              <line x1="2" y1="12" x2="158" y2="12" stroke="#d97706" strokeWidth="3" />
              <line x1="2" y1="32" x2="158" y2="32" stroke="#d97706" strokeWidth="3" />
              {[14, 32, 50, 68, 86, 104, 122, 140].map((px) => (
                <rect
                  key={px}
                  x={px}
                  y="9"
                  width="11"
                  height="26"
                  rx="2"
                  fill="#92400e"
                  stroke="#451a03"
                  strokeWidth="1.6"
                />
              ))}
              <circle cx="5" cy="12" r="3.5" fill="#78350f" stroke="#fbbf24" strokeWidth="1" />
              <circle cx="5" cy="32" r="3.5" fill="#78350f" stroke="#fbbf24" strokeWidth="1" />
              <circle cx="155" cy="12" r="3.5" fill="#78350f" stroke="#fbbf24" strokeWidth="1" />
              <circle cx="155" cy="32" r="3.5" fill="#78350f" stroke="#fbbf24" strokeWidth="1" />
            </g>
          )}
        </g>
      </svg>
    </div>
  );
});
