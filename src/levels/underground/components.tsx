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
import { SpriteIcon } from '../../components/sprites/SpriteIcon.tsx';
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

export const UNDERGROUND_BRAZIERS: CaveBrazier[] = [];

// Sparse upper-mine landmarks in SVG viewBox space (0..100 x 0..250, i.e. y * 2.5)
// Bioluminescent mushrooms, ruins, and braziers are reserved exclusively for `deep_cave`.
export const UNDERGROUND_LANDMARKS: CaveLandmark[] = [
  { id: 'ug_lm_timber_z1l', kind: 'mine_timbers', x: 35, y: 48, scale: 0.92, rotation: -3 },
  { id: 'ug_lm_timber_z1r', kind: 'mine_timbers', x: 74, y: 49, scale: 0.92, rotation: 3 },
  { id: 'ug_lm_rubble_z2', kind: 'rubble_pile', x: 25, y: 84, scale: 0.95 },
  { id: 'ug_lm_rubble_z3', kind: 'rubble_pile', x: 76, y: 98, scale: 0.9 },
  { id: 'ug_lm_timber_z6', kind: 'mine_timbers', x: 52, y: 174, scale: 1.05 },
  { id: 'ug_lm_rubble_z7', kind: 'rubble_pile', x: 59, y: 218, scale: 0.85 },
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
  <div className="absolute inset-0 bg-[#352820] pointer-events-none z-0 overflow-hidden">
    <div
      className="absolute inset-0 opacity-20"
      style={{
        backgroundImage: 'radial-gradient(#1f1712 2px, transparent 2px)',
        backgroundSize: '36px 36px'
      }}
    />
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none z-0 drop-shadow-2xl"
      preserveAspectRatio="none"
      viewBox="0 0 100 250"
    >
      <defs>
        <radialGradient id="ugMineDaylight" cx="50%" cy="0%" r="48%">
          <stop offset="0%" stopColor="#fde68a" stopOpacity="0.32" />
          <stop offset="45%" stopColor="#d97706" stopOpacity="0.14" />
          <stop offset="100%" stopColor="#352820" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="ugMineDepthWash" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6b4f39" stopOpacity="0.24" />
          <stop offset="45%" stopColor="#32251d" stopOpacity="0.34" />
          <stop offset="100%" stopColor="#141016" stopOpacity="0.68" />
        </linearGradient>
      </defs>
      <CaveSvgDefs idPrefix="ug" />

      {/* Warm upper-mine sandstone wash darkening only toward Zone 9 abyssal shaft */}
      <rect x="0" y="0" width="100" height="250" fill="url(#ugMineDepthWash)" />

      {/* Sunlit surface shaft glow around camp */}
      <circle cx="50" cy="4" r="32" fill="url(#ugMineDaylight)" />

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

export interface ContainerPropSVGProps {
  rewardId?: string;
  rewardEmoji?: string;
  rewardSpriteSrc?: string;
  isAlerting?: boolean;
  isSelected?: boolean;
  isAnimating?: boolean;
  isDefeated?: boolean;
}

/**
 * Searchable weathered wooden mining supply crate with item peek badge.
 */
export const MineCrateSVG = memo(({
  rewardId,
  rewardEmoji,
  rewardSpriteSrc,
  isAlerting = false,
  isAnimating = false
}: ContainerPropSVGProps) => (
  <div
    data-testid="mine-crate"
    className={`relative w-[10cqw] h-[10cqw] flex items-center justify-center select-none ${
      isAlerting ? 'animate-troll-mad' : ''
    } ${isAnimating ? 'animate-dog-dig' : ''}`}
  >
    <svg viewBox="0 0 64 64" className="w-full h-full overflow-visible drop-shadow-[0_4px_8px_rgba(0,0,0,0.8)]">
      <ellipse cx="32" cy="54" rx="22" ry="6" fill="#140f0b" opacity="0.65" />
      <rect x="12" y="18" width="40" height="34" rx="3" fill="#6b4423" stroke="#291709" strokeWidth="2.4" />
      <rect x="14" y="14" width="36" height="9" rx="2" fill="#855830" stroke="#291709" strokeWidth="2.2" />
      <line x1="14" y1="30" x2="50" y2="30" stroke="#3b2210" strokeWidth="2" />
      <line x1="14" y1="41" x2="50" y2="41" stroke="#3b2210" strokeWidth="2" />
      <path d="M 16 20 L 48 50 M 48 20 L 16 50" stroke="#4a2e16" strokeWidth="2.5" opacity="0.7" />
      <rect x="12" y="18" width="5" height="34" fill="#57534e" opacity="0.85" />
      <rect x="47" y="18" width="5" height="34" fill="#57534e" opacity="0.85" />
      <circle cx="14.5" cy="24" r="1.2" fill="#d6d3d1" />
      <circle cx="49.5" cy="24" r="1.2" fill="#d6d3d1" />
      <circle cx="14.5" cy="46" r="1.2" fill="#d6d3d1" />
      <circle cx="49.5" cy="46" r="1.2" fill="#d6d3d1" />
    </svg>
    {(rewardEmoji || rewardId) && (
      <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-stone-900/95 border border-amber-400/80 flex items-center justify-center text-sm shadow-md">
        <SpriteIcon id={rewardId} spriteSrc={rewardSpriteSrc} emoji={rewardEmoji} />
      </div>
    )}
  </div>
));

/**
 * Diggable loose earth & gravel mound concealing a buried cave item.
 */
export const DirtMoundSVG = memo(({
  rewardId,
  rewardEmoji,
  rewardSpriteSrc,
  isAlerting = false,
  isAnimating = false
}: ContainerPropSVGProps) => (
  <div
    data-testid="dirt-mound"
    className={`relative w-[10.5cqw] h-[9.5cqw] flex items-center justify-center select-none ${
      isAlerting ? 'animate-troll-mad' : ''
    } ${isAnimating ? 'animate-dog-dig' : ''}`}
  >
    <svg viewBox="0 0 68 56" className="w-full h-full overflow-visible drop-shadow-[0_4px_8px_rgba(0,0,0,0.75)]">
      <ellipse cx="34" cy="46" rx="26" ry="7" fill="#140f0b" opacity="0.7" />
      <path d="M 8 44 Q 18 16 34 14 Q 50 16 60 44 Z" fill="#5c432d" stroke="#291c12" strokeWidth="2.4" />
      <path d="M 16 44 Q 25 22 36 22 Q 48 24 54 44 Z" fill="#463221" opacity="0.8" />
      <circle cx="21" cy="36" r="2.2" fill="#78716c" />
      <circle cx="46" cy="38" r="2.5" fill="#78716c" />
      <circle cx="30" cy="41" r="1.8" fill="#a8a29e" />
      <path d="M 28 20 L 38 18" stroke="#92400e" strokeWidth="1.8" strokeLinecap="round" opacity="0.65" />
    </svg>
    {(rewardEmoji || rewardId) && (
      <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-amber-950/90 border border-amber-300/75 flex items-center justify-center text-sm shadow-md">
        <SpriteIcon id={rewardId} spriteSrc={rewardSpriteSrc} emoji={rewardEmoji} />
      </div>
    )}
  </div>
));

/**
 * Pickaxe-minable mineral seam / ore vein embedded in cave stone.
 */
export const OreVeinSVG = memo(({
  rewardId,
  rewardEmoji,
  rewardSpriteSrc,
  isAlerting = false,
  isAnimating = false,
  isDefeated = false
}: ContainerPropSVGProps) => {
  if (isDefeated) {
    return (
      <div data-testid="ore-vein-depleted" className="relative w-[9cqw] h-[7cqw] flex items-center justify-center opacity-55">
        <svg viewBox="0 0 64 48" className="w-full h-full overflow-visible">
          <ellipse cx="32" cy="36" rx="22" ry="7" fill="#14100d" opacity="0.7" />
          <polygon points="14,36 24,26 38,28 48,36" fill="#44403c" stroke="#1c1917" strokeWidth="2" />
          <polygon points="22,38 30,30 42,35" fill="#57534e" stroke="#1c1917" strokeWidth="1.6" />
        </svg>
      </div>
    );
  }
  return (
    <div
      data-testid="ore-vein"
      className={`relative w-[11cqw] h-[10.5cqw] flex items-center justify-center select-none ${
        isAlerting ? 'animate-troll-mad' : ''
      } ${isAnimating ? 'animate-hit-spark' : ''}`}
    >
      <svg viewBox="0 0 68 62" className="w-full h-full overflow-visible drop-shadow-[0_6px_12px_rgba(0,0,0,0.85)]">
        <ellipse cx="34" cy="52" rx="24" ry="7" fill="#0d0907" opacity="0.75" />
        <polygon points="10,48 16,22 33,10 52,20 58,48" fill="#3f3a36" stroke="#14110e" strokeWidth="2.4" />
        <polygon points="16,22 33,10 38,34 18,44" fill="#57514c" stroke="#1c1917" strokeWidth="1.6" />
        <polygon points="33,10 52,20 50,45 38,34" fill="#292524" stroke="#1c1917" strokeWidth="1.6" />
        {/* Sparkling mineral vein seam */}
        <path d="M 22 40 L 31 24 L 44 26" stroke="#fbbf24" strokeWidth="3.2" strokeLinecap="round" fill="none" opacity="0.9" />
        <path d="M 31 24 L 36 14" stroke="#fde68a" strokeWidth="2" strokeLinecap="round" fill="none" />
        <circle cx="24" cy="36" r="1.8" fill="#fef08a" />
        <circle cx="44" cy="27" r="1.8" fill="#38bdf8" />
      </svg>
      {(rewardEmoji || rewardId) && (
        <div className="absolute top-0 right-0 w-7 h-7 rounded-full bg-stone-950/90 border-2 border-amber-400 flex items-center justify-center text-base shadow-[0_0_10px_rgba(251,191,36,0.65)]">
          <SpriteIcon id={rewardId} spriteSrc={rewardSpriteSrc} emoji={rewardEmoji} />
        </div>
      )}
    </div>
  );
});

/**
 * Delicate SVG cobweb accent rendered behind Giant Spider traders in the upper mine.
 */
export const SpiderWebAccentSVG = memo(() => (
  <svg
    aria-hidden="true"
    viewBox="0 0 60 60"
    className="absolute -inset-3 w-[calc(100%+1.5rem)] h-[calc(100%+1.5rem)] pointer-events-none opacity-45 -z-10"
  >
    <path
      d="M 30 30 L 6 8 M 30 30 L 54 8 M 30 30 L 56 32 M 30 30 L 4 34 M 30 30 L 14 54 M 30 30 L 48 54"
      stroke="#e7e5e4"
      strokeWidth="0.9"
      fill="none"
    />
    <path
      d="M 18 19 Q 30 15 42 19 Q 45 31 40 42 Q 30 46 19 42 Q 14 31 18 19 Z"
      stroke="#d6d3d1"
      strokeWidth="0.8"
      fill="none"
    />
  </svg>
));
