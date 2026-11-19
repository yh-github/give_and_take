import React, { useMemo, memo } from 'react';
import { getCorridorBounds, generateProceduralOrganicRock, calculateFacetLighting } from '../../logic/geometry.ts';
import type {
  CaveWallVertices,
  CollarBounds,
  Point2D,
  ProceduralGeometry
} from '../../types/index.ts';

export const CAVE_WALL_VERTICES: CaveWallVertices = {
  leftWall: [
    {x:0,y:0}, {x:20,y:0}, 
    {x:18,y:4}, {x:20,y:8}, {x:18,y:12}, {x:14,y:16}, {x:16,y:20}, 
    {x:20,y:22}, {x:17,y:25}, 
    {x:20,y:30}, {x:18,y:36}, {x:21,y:42}, 
    {x:20,y:46}, {x:18,y:52}, 
    {x:22,y:60}, {x:19,y:65}, 
    {x:20,y:68}, {x:18,y:71}, {x:20,y:74}, {x:26,y:77}, {x:36,y:79.5}, {x:48,y:81}, {x:48,y:85}, {x:52,y:87}, {x:55,y:90}, {x:52,y:93}, {x:50,y:96}, {x:52,y:98}, {x:50,y:100}, {x:0,y:100}
  ],
  rightWall: [
    {x:100,y:0}, {x:80,y:0}, 
    {x:82,y:4}, {x:80,y:8}, {x:82,y:12}, {x:86,y:16}, {x:84,y:20}, 
    {x:80,y:25}, {x:83,y:28}, 
    {x:80,y:32}, {x:82,y:38}, {x:79,y:41}, 
    {x:80,y:43}, {x:82,y:50}, 
    {x:78,y:60}, {x:81,y:65}, 
    {x:80,y:71}, {x:85,y:74}, {x:87,y:77}, {x:88,y:81}, {x:88,y:85}, {x:85,y:88}, {x:88,y:91}, {x:86,y:94}, {x:88,y:97}, {x:86,y:100}, {x:100,y:100}
  ],
  centralPillar: [
    {x:50,y:20}, 
    {x:52,y:22}, {x:53,y:25}, {x:50,y:30}, {x:47,y:38}, {x:52,y:46}, {x:49,y:52}, 
    {x:53,y:60}, {x:51,y:65}, {x:55,y:68}, {x:52,y:70}, 
    {x:48,y:70}, {x:47,y:67}, {x:49,y:66}, {x:47,y:61}, 
    {x:51,y:51}, {x:48,y:43}, {x:53,y:36}, {x:50,y:31}, {x:47,y:25}, {x:48,y:22}, {x:50,y:20}
  ]
};

export const CaveBackground = () => (
  <div className="absolute inset-0 bg-[#2b221d] pointer-events-none z-0 overflow-hidden">
    <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(#1a1512 2px, transparent 2px)', backgroundSize: '40px 40px' }} />
    <svg className="absolute inset-0 w-full h-full pointer-events-none z-0 drop-shadow-2xl" preserveAspectRatio="none" viewBox="0 0 100 100">
      {/* Dynamic Cave Walls that meet the rocks */}
      <path d="
        M 0 0 L 20 0 
        L 18 4 L 20 8 L 18 12 L 14 16 L 16 20 
        L 20 22 L 17 25 
        L 20 30 L 18 36 L 21 42 
        L 20 46 L 18 52 
        L 22 60 L 19 65 
        L 20 68 L 18 71 L 20 74 L 26 77 L 36 79.5 L 48 81 L 48 85 L 52 87 L 55 90 L 52 93 L 50 96 L 52 98 L 50 100 L 0 100 Z" 
        fill="#181310" stroke="#0a0806" strokeWidth="0.5" vectorEffect="non-scaling-stroke" 
      />
      <path d="
        M 100 0 L 80 0 
        L 82 4 L 80 8 L 82 12 L 86 16 L 84 20 
        L 80 25 L 83 28 
        L 80 32 L 82 38 L 79 41 
        L 80 43 L 82 50 
        L 78 60 L 81 65 
        L 80 71 L 85 74 L 87 77 L 88 81 L 88 85 L 85 88 L 88 91 L 86 94 L 88 97 L 86 100 L 100 100 Z" 
        fill="#181310" stroke="#0a0806" strokeWidth="0.5" vectorEffect="non-scaling-stroke" 
      />
      {/* Central Pillar - Asymmetric to match paths */}
      <path d="
        M 50 20 
        L 52 22 L 53 25 L 50 30 L 47 38 L 52 46 L 49 52 
        L 53 60 L 51 65 L 55 68 L 52 70 
        L 48 70 L 47 67 L 49 66 L 47 61 
        L 51 51 L 48 43 L 53 36 L 50 31 L 47 25 L 48 22 Z" 
        fill="#181310" stroke="#0a0806" strokeWidth="0.5" vectorEffect="non-scaling-stroke" 
      />
    </svg>
  </div>
);

export interface RockSVGProps {
  isDefeated?: boolean;
  isAlerting?: boolean;
  isBreaking?: boolean;
  seed?: string | number;
  size?: string;
  heroPos?: Point2D | null;
  yNode?: number;
  nodeX?: number;
  boundsOverride?: CollarBounds | null;
  geometry?: ProceduralGeometry | null;
  yScale?: number;
}

export const RockSVG = memo(({
  isDefeated = false,
  isAlerting = false,
  isBreaking = false,
  seed = 0,
  size = 'large',
  heroPos = null,
  yNode = 50,
  nodeX = 50,
  boundsOverride = null,
  yScale = 2.5
}: RockSVGProps) => {
  const isRightChannel = nodeX >= 50;
  const isVerticalCollar = boundsOverride?.orientation === 'vertical';
  const bounds = useMemo(
    () => boundsOverride || getCorridorBounds(yNode, CAVE_WALL_VERTICES, isRightChannel),
    [boundsOverride, yNode, isRightChannel]
  );
  const mesh = useMemo(
    () => generateProceduralOrganicRock(bounds.xLeft, bounds.xRight, yNode, size === 'small' ? 2.5 : size === 'medium' ? 3.2 : 4.2, seed),
    [bounds.xLeft, bounds.xRight, yNode, size, seed]
  );

  // 1. DEBRIS STATE (Illuminated procedural ground rubble)
  if (isDefeated && !isBreaking) {
    return (
      <div className="w-full relative pointer-events-none translate-y-1 flex justify-center">
        <svg viewBox={isVerticalCollar ? '0 0 70 150' : '0 0 150 45'} className="w-full h-auto drop-shadow-md overflow-visible">
          <g transform={isVerticalCollar ? 'translate(70, 0) rotate(90)' : undefined}>
            <ellipse cx="75" cy="38" rx="68" ry="6" fill="#14100d" opacity="0.65" />
            <g>
              {mesh.boulders.map(boulder => (
                <g key={boulder.id}>
                  {boulder.facets.map((facet, idx) => {
                    const lighting = calculateFacetLighting(facet, heroPos, yScale);
                    const p = facet.pts;
                    const pointsStr = `${p[0].x},${p[0].y * 0.35 + 20} ${p[1].x},${p[1].y * 0.35 + 20} ${p[2].x},${p[2].y * 0.35 + 20} ${p[3].x},${p[3].y * 0.35 + 20}`;
                    return (
                      <polygon
                        key={facet.id || idx}
                        points={pointsStr}
                        fill={lighting.color}
                        stroke="#14110e"
                        strokeWidth="1.5"
                        vectorEffect="non-scaling-stroke"
                      />
                    );
                  })}
                </g>
              ))}
            </g>
          </g>
        </svg>
      </div>
    );
  }

  // 2. BREAKING ANIMATION STATE
  if (isBreaking) {
    return (
      <div className="w-full relative pointer-events-none flex justify-center">
        <div className="absolute -top-6 left-1/2 -translate-x-1/2 z-50 animate-pickaxe-hit">
          <span className="text-3xl sm:text-4xl drop-shadow-[0_0_10px_rgba(251,191,36,1)]">⛏️</span>
        </div>
        <div className="absolute top-1 left-1/2 -translate-x-1/2 z-40 animate-hit-spark">
          <span className="text-2xl">✨</span>
        </div>

        <svg viewBox={isVerticalCollar ? '0 0 70 150' : '0 0 150 70'} className="w-full h-auto overflow-visible">
          <g transform={isVerticalCollar ? 'translate(70, 0) rotate(90)' : undefined}>
            <g opacity="0.95" className="z-30">
              <path 
                d="M 75 12 L 75 42 M 75 12 L 45 35 M 75 12 L 105 35"
                stroke="#fef08a" 
                strokeWidth="3" 
                fill="none" 
                strokeDasharray="120"
                className="animate-crack-branch"
                style={{ filter: 'drop-shadow(0 0 6px #f59e0b)' }}
                vectorEffect="non-scaling-stroke"
              />
            </g>

            <g>
              <g className="animate-rock-split-left">
                {mesh.boulders.filter(b => b.localX < 75).map(boulder => (
                  <g key={boulder.id}>
                    {boulder.facets.map((facet, idx) => {
                      const lighting = calculateFacetLighting(facet, heroPos, yScale);
                      const p = facet.pts;
                      return (
                        <polygon
                          key={facet.id || idx}
                          points={`${p[0].x},${p[0].y} ${p[1].x},${p[1].y} ${p[2].x},${p[2].y} ${p[3].x},${p[3].y}`}
                          fill={lighting.color}
                          stroke="#14110e"
                          strokeWidth="1.5"
                          vectorEffect="non-scaling-stroke"
                        />
                      );
                    })}
                  </g>
                ))}
              </g>

              <g className="animate-rock-split-right">
                {mesh.boulders.filter(b => b.localX >= 75).map(boulder => (
                  <g key={boulder.id}>
                    {boulder.facets.map((facet, idx) => {
                      const lighting = calculateFacetLighting(facet, heroPos, yScale);
                      const p = facet.pts;
                      return (
                        <polygon
                          key={facet.id || idx}
                          points={`${p[0].x},${p[0].y} ${p[1].x},${p[1].y} ${p[2].x},${p[2].y} ${p[3].x},${p[3].y}`}
                          fill={lighting.color}
                          stroke="#14110e"
                          strokeWidth="1.5"
                          vectorEffect="non-scaling-stroke"
                        />
                      );
                    })}
                  </g>
                ))}
              </g>
            </g>
          </g>
        </svg>
      </div>
    );
  }

  // 3. INTACT PROCEDURAL ORGANIC 3D BOULDER PILE WITH DYNAMIC NORMAL LIGHTING
  return (
    <div className={`w-full relative transition-all duration-700 ${isAlerting ? 'animate-troll-mad' : ''}`}>
      <svg viewBox={isVerticalCollar ? '0 0 70 150' : '0 0 150 70'} className="w-full h-auto drop-shadow-[0_10px_20px_rgba(0,0,0,0.9)]">
        <g transform={isVerticalCollar ? 'translate(70, 0) rotate(90)' : undefined}>
          {mesh.boulders.map(boulder => (
            <g key={boulder.id}>
              {/* Dark outline contour per boulder */}
              <polygon
                points={boulder.vertices.map(v => `${v.x},${v.y}`).join(' ')}
                fill="#14110e"
                stroke="#0a0806"
                strokeWidth="2"
                vectorEffect="non-scaling-stroke"
              />
              {/* Facet polygons with dynamic hero-relative lighting */}
              {boulder.facets.map((facet, idx) => {
                const lighting = calculateFacetLighting(facet, heroPos, yScale);
                const p = facet.pts;
                const pointsStr = `${p[0].x},${p[0].y} ${p[1].x},${p[1].y} ${p[2].x},${p[2].y} ${p[3].x},${p[3].y}`;
                return (
                  <polygon
                    key={facet.id || idx}
                    points={pointsStr}
                    fill={lighting.color}
                    stroke="#14110e"
                    strokeWidth="1.5"
                    vectorEffect="non-scaling-stroke"
                  />
                );
              })}
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
});

export const CampIcon = () => (
  <div className="text-6xl drop-shadow-lg -translate-y-4">⛺</div>
);

