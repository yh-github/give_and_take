import React, { memo } from 'react';
import {
  AbyssalExitSVG,
  CampIcon,
  CaveRockSVG,
  CaveSvgDefs,
  ChasmSVG as SharedChasmSVG,
  renderCaveLandmarkSVG,
  type CaveRockSVGProps,
  type ChasmSVGProps
} from '../cave_shared/components.tsx';
import { hashSeed } from '../../logic/geometry.ts';
import type {
  CaveBrazier,
  CaveLandmark,
  CaveWallVertices,
  Point2D
} from '../../types/index.ts';

export { AbyssalExitSVG, CampIcon };
export type { CaveRockSVGProps as RockSVGProps };

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

/**
 * Closed solid wall polygons (scaled to `screens * 100` height) used by A* pathfinding
 * so hero clicks and paths never penetrate solid rock walls or the central pillar.
 */
export function getUndergroundObstaclePolygons(screens = 2.5): Point2D[][] {
  const polys: Point2D[][] = [];
  if (CAVE_WALL_VERTICES.leftWall) {
    polys.push(CAVE_WALL_VERTICES.leftWall.map(p => ({ x: p.x, y: p.y * screens })));
  }
  if (CAVE_WALL_VERTICES.rightWall) {
    polys.push(CAVE_WALL_VERTICES.rightWall.map(p => ({ x: p.x, y: p.y * screens })));
  }
  if (CAVE_WALL_VERTICES.centralPillar) {
    polys.push(CAVE_WALL_VERTICES.centralPillar.map(p => ({ x: p.x, y: p.y * screens })));
  }
  return polys;
}

export const UNDERGROUND_BRAZIERS: CaveBrazier[] = [
  { id: 'brazier_left', x: 35, y: 30, zone: 2, radius: 44 },
  { id: 'brazier_right', x: 74, y: 41, zone: 3, radius: 44 },
  { id: 'brazier_junction', x: 52, y: 74, zone: 6, radius: 48 }
];

// Coordinates in SVG viewBox space (0..100 x 0..250, i.e. y * 2.5)
export const UNDERGROUND_LANDMARKS: CaveLandmark[] = [
  { id: 'ug_lm_mush_z1', kind: 'mushroom_grove', x: 62, y: 15, scale: 0.72 },
  { id: 'ug_lm_arch_z1', kind: 'ruined_arch', x: 50, y: 31, scale: 0.88, rotation: -6 },
  { id: 'ug_lm_mush_z4', kind: 'mushroom_grove', x: 38, y: 145, scale: 0.76 },
  { id: 'ug_lm_mush_z6', kind: 'mushroom_grove', x: 75, y: 190, scale: 0.74 },
  { id: 'ug_lm_arch_z6', kind: 'ruined_arch', x: 49, y: 185, scale: 0.84, rotation: 8 },
  { id: 'ug_lm_exit_z9', kind: 'abyss_exit_sanctum', x: 68, y: 243.75, scale: 1 }
];

function verticesToSvgPath(pts: readonly Point2D[], yScale = 2.5): string {
  if (!pts || pts.length === 0) return '';
  let d = `M ${pts[0].x} ${(pts[0].y * yScale).toFixed(2)}`;
  for (let i = 1; i < pts.length; i++) {
    d += ` L ${pts[i].x} ${(pts[i].y * yScale).toFixed(2)}`;
  }
  return `${d} Z`;
}

function buildUndergroundFloorDecor(yScale = 2.5) {
  const pebbles: Array<{ x: string; y: string; rx: string; ry: string; rot: number }> = [];
  const strataLines: string[] = [];

  const innerRuns: Array<{ pts: readonly Point2D[]; inwardSign: number }> = [
    { pts: (CAVE_WALL_VERTICES.leftWall || []).slice(1, -1), inwardSign: 1 },
    { pts: (CAVE_WALL_VERTICES.rightWall || []).slice(1, -1), inwardSign: -1 }
  ];

  for (const run of innerRuns) {
    for (let i = 0; i < run.pts.length - 1; i += 2) {
      const a = run.pts[i];
      const b = run.pts[i + 1];
      const h = hashSeed(`ug_floor_${a.x}_${a.y}`);
      const px = a.x + run.inwardSign * (2.4 + (h % 3));
      const py = a.y * yScale + (h % 5) - 2;
      if (px < 10 || px > 90 || py < 6 || py > 246) continue;

      if (h % 2 === 0) {
        pebbles.push({
          x: px.toFixed(2),
          y: py.toFixed(2),
          rx: (0.42 + (h % 4) * 0.12).toFixed(2),
          ry: (0.3 + (h % 3) * 0.1).toFixed(2),
          rot: h % 180
        });
      } else {
        const p2x = b.x + run.inwardSign * (2.8 + (h % 3));
        const p2y = b.y * yScale;
        strataLines.push(
          `M ${px.toFixed(1)} ${py.toFixed(1)} Q ${((px + p2x) * 0.5 + run.inwardSign * 0.8).toFixed(1)} ${((py + p2y) * 0.5).toFixed(1)} ${p2x.toFixed(1)} ${p2y.toFixed(1)}`
        );
      }
    }
  }

  return { pebbles, strataLines };
}

const LEFT_WALL_PATH = verticesToSvgPath(CAVE_WALL_VERTICES.leftWall || [], 2.5);
const RIGHT_WALL_PATH = verticesToSvgPath(CAVE_WALL_VERTICES.rightWall || [], 2.5);
const PILLAR_PATH = verticesToSvgPath(CAVE_WALL_VERTICES.centralPillar || [], 2.5);
const EDGE_PATHS = [LEFT_WALL_PATH, RIGHT_WALL_PATH, PILLAR_PATH];
const UNDERGROUND_FLOOR_DECOR = buildUndergroundFloorDecor(2.5);

export const CaveBackground = memo(() => (
  <div className="absolute inset-0 bg-[#2b221d] pointer-events-none z-0 overflow-hidden">
    <div
      className="absolute inset-0 opacity-20"
      style={{
        backgroundImage: 'radial-gradient(#1a1512 2px, transparent 2px)',
        backgroundSize: '36px 36px'
      }}
    />
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none z-0 drop-shadow-2xl"
      preserveAspectRatio="none"
      viewBox="0 0 100 250"
    >
      <CaveSvgDefs idPrefix="ug" />

      {/* Depth wash deepening toward the abyssal exit */}
      <rect x="0" y="0" width="100" height="250" fill="url(#ugDepthWash)" />

      {/* Surface entrance glow around camp */}
      <circle cx="50" cy="5" r="28" fill="url(#ugCampGlow)" />

      {/* Cavern landmarks */}
      <g>{UNDERGROUND_LANDMARKS.map(lm => renderCaveLandmarkSVG(lm, 'ug'))}</g>

      {/* Subtle subterranean floor shelves & pebbles */}
      <g opacity="0.48">
        {UNDERGROUND_FLOOR_DECOR.strataLines.map((d, i) => (
          <path
            key={`ug-strata-${i}`}
            d={d}
            fill="none"
            stroke="#1b1410"
            strokeWidth="0.9"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {UNDERGROUND_FLOOR_DECOR.pebbles.map((p, i) => (
          <ellipse
            key={`ug-peb-${i}`}
            cx={p.x}
            cy={p.y}
            rx={p.rx}
            ry={p.ry}
            fill="#3d2f27"
            stroke="#15100d"
            strokeWidth="0.35"
            transform={`rotate(${p.rot} ${p.x} ${p.y})`}
          />
        ))}
      </g>

      {/* Layered rock drop-off cliff talus & stepped rock shelf (covered outside cavern by rock fill) */}
      {EDGE_PATHS.map((d, idx) => (
        <path
          key={`ug-apron-${idx}`}
          d={d}
          fill="none"
          stroke="#1a1310"
          strokeWidth="12"
          strokeOpacity="0.45"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      ))}
      {EDGE_PATHS.map((d, idx) => (
        <path
          key={`ug-shelf-${idx}`}
          d={d}
          fill="none"
          stroke="#3f3027"
          strokeWidth="5.2"
          strokeOpacity="0.82"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      ))}
      {EDGE_PATHS.map((d, idx) => (
        <path
          key={`ug-lip-${idx}`}
          d={d}
          fill="none"
          stroke="#594538"
          strokeWidth="2.1"
          strokeOpacity="0.58"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      ))}

      {/* Sedimentary rock walls & central pillar */}
      <path d={LEFT_WALL_PATH} fill="url(#ugRockStrata)" />
      <path d={RIGHT_WALL_PATH} fill="url(#ugRockStrata)" />
      <path d={PILLAR_PATH} fill="url(#ugRockStrata)" />

      {/* Crisp inner cliff bevel borders */}
      {EDGE_PATHS.map((d, idx) => (
        <path
          key={`ug-edge-${idx}`}
          d={d}
          fill="none"
          stroke="#080605"
          strokeWidth="1.2"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </svg>
  </div>
));

export const RockSVG = memo((props: CaveRockSVGProps) => (
  <CaveRockSVG {...props} fallbackWallVertices={props.fallbackWallVertices ?? CAVE_WALL_VERTICES} />
));

export const ChasmSVG = memo((props: ChasmSVGProps) => (
  <SharedChasmSVG {...props} fallbackWallVertices={props.fallbackWallVertices ?? CAVE_WALL_VERTICES} />
));
