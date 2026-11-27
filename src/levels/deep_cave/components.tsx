import React, { memo, useMemo } from 'react';
import {
  CampIcon,
  CaveBrazierProp,
  CaveRockSVG,
  CaveSvgDefs,
  ChasmSVG,
  renderCaveLandmarkSVG,
  type CaveRockSVGProps,
  type CaveBrazierPropProps,
  type ChasmSVGProps
} from '../cave_shared/components.tsx';
import { hashSeed } from '../../logic/geometry.ts';
import type {
  Point2D,
  ProceduralGeometry,
  WallPolyline
} from '../../types/index.ts';

export { CampIcon, CaveBrazierProp, ChasmSVG, CaveRockSVG as DeepCaveRockSVG, CaveRockSVG as RockSVG };
export type { CaveRockSVGProps as RockSVGProps, CaveBrazierPropProps, ChasmSVGProps };

interface FloorPebble {
  x: string;
  y: string;
  rx: string;
  ry: string;
  rot: number;
}

interface FloorDecorations {
  strataLines: string[];
  pebbles: FloorPebble[];
}

interface EdgePathItem {
  id: number;
  d: string;
  isPillar: boolean;
}

function polylineToSvgSubpath(points: readonly Point2D[] | undefined): string {
  if (!points || points.length < 3) return '';
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    d += ` L ${points[i].x} ${points[i].y}`;
  }
  return `${d} Z`;
}

/**
 * Generates deterministic subtle interior floor contour slabs & scattered mineral pebbles
 * along open cavern spaces so floors look naturally terraced instead of flat.
 */
function buildFloorDecorations(
  polylines: readonly WallPolyline[] | undefined,
  worldWidth: number,
  worldHeight: number
): FloorDecorations {
  const outer = (polylines || []).find(p => !Array.isArray(p) ? !p?.isPillar : true);
  const pts = Array.isArray(outer) ? outer : outer?.points;
  if (!pts || pts.length < 6) return { strataLines: [], pebbles: [] };

  const strataLines: string[] = [];
  const pebbles: FloorPebble[] = [];
  const stride = Math.max(2, Math.floor(pts.length / 26));

  for (let i = 0; i < pts.length; i += stride) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const h = hashSeed(`floor_${Math.round(a.x * 10)}_${Math.round(a.y * 10)}`);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    // Inward normal into OPEN floor (boundary convention: SOLID on LEFT, OPEN on RIGHT)
    const inX = -dy / len;
    const inY = dx / len;

    const inset = 2.6 + (h % 4);
    const px = a.x + inX * inset;
    const py = a.y + inY * inset;
    if (px < 3 || px > worldWidth - 3 || py < 3 || py > worldHeight - 3) continue;

    if (h % 3 === 0) {
      pebbles.push({
        x: px.toFixed(2),
        y: py.toFixed(2),
        rx: (0.45 + (h % 5) * 0.14).toFixed(2),
        ry: (0.32 + (h % 3) * 0.11).toFixed(2),
        rot: (h % 180)
      });
    } else if (h % 4 === 1) {
      const p2x = b.x + inX * (inset + 0.6);
      const p2y = b.y + inY * (inset + 0.6);
      strataLines.push(
        `M ${px.toFixed(1)} ${py.toFixed(1)} Q ${((px + p2x) * 0.5 + inX * 0.9).toFixed(1)} ${((py + p2y) * 0.5 + inY * 0.9).toFixed(1)} ${p2x.toFixed(1)} ${p2y.toFixed(1)}`
      );
    }
  }

  return { strataLines, pebbles };
}

export interface DeepCaveBackgroundProps {
  geometry?: ProceduralGeometry | null;
}

/**
 * Dynamic procedural cavern backdrop for `deep_cave` ("The Abyssal Descent").
 * Renders organic extracted `wallPolylines` with layered sedimentary rock rims,
 * cliff drop-off shadows, cavern floor terracing, and camp shaft illumination.
 */
export const DeepCaveBackground = memo(({ geometry }: DeepCaveBackgroundProps) => {
  const worldWidth = geometry?.worldWidth || 100;
  const worldHeight = geometry?.worldHeight || 256;
  const campPos = geometry?.campPos || { x: 50, y: 24 };

  const wallPathData = useMemo(() => {
    const outerFrame = `M 0 0 L ${worldWidth} 0 L ${worldWidth} ${worldHeight} L 0 ${worldHeight} Z`;
    const polylines = geometry?.wallPolylines || [];
    if (polylines.length === 0) return outerFrame;

    const parts = [outerFrame];
    for (const poly of polylines) {
      const pts = Array.isArray(poly) ? poly : poly?.points;
      const sub = polylineToSvgSubpath(pts);
      if (sub) parts.push(sub);
    }
    return parts.join(' ');
  }, [geometry?.wallPolylines, worldWidth, worldHeight]);

  const edgePaths = useMemo<EdgePathItem[]>(() => {
    const polylines = geometry?.wallPolylines || [];
    return polylines
      .map((poly, idx) => {
        const pts = Array.isArray(poly) ? poly : poly?.points;
        const d = polylineToSvgSubpath(pts);
        const isPillar = !Array.isArray(poly) && Boolean(poly?.isPillar);
        return d ? { id: idx, d, isPillar } : null;
      })
      .filter((item): item is EdgePathItem => item !== null);
  }, [geometry?.wallPolylines]);

  const floorDecor = useMemo(
    () => buildFloorDecorations(geometry?.wallPolylines, worldWidth, worldHeight),
    [geometry?.wallPolylines, worldWidth, worldHeight]
  );

  return (
    <div className="absolute inset-0 bg-[#2b221d] pointer-events-none z-0 overflow-hidden">
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
        <CaveSvgDefs idPrefix="deepCave" />

        <rect x="0" y="0" width={worldWidth} height={worldHeight} fill="url(#deepCaveDepthWash)" />
        <circle cx={campPos.x} cy={campPos.y} r="30" fill="url(#deepCaveCampGlow)" />

        {geometry?.landmarks && geometry.landmarks.length > 0 && (
          <g>{geometry.landmarks.map(lm => renderCaveLandmarkSVG(lm, 'deepCave'))}</g>
        )}

        <g opacity="0.48">
          {floorDecor.strataLines.map((d, i) => (
            <path
              key={`fstrata-${i}`}
              d={d}
              fill="none"
              stroke="#1b1410"
              strokeWidth="0.9"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          ))}
          {floorDecor.pebbles.map((p, i) => (
            <ellipse
              key={`fpeb-${i}`}
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

        {edgePaths.map(edge => (
          <path
            key={`apron-${edge.id}`}
            d={edge.d}
            fill="none"
            stroke="#1a1310"
            strokeWidth="12"
            strokeOpacity="0.45"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {edgePaths.map(edge => (
          <path
            key={`shelf-${edge.id}`}
            d={edge.d}
            fill="none"
            stroke="#3f3027"
            strokeWidth="5.2"
            strokeOpacity="0.82"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {edgePaths.map(edge => (
          <path
            key={`lip-${edge.id}`}
            d={edge.d}
            fill="none"
            stroke="#594538"
            strokeWidth="2.1"
            strokeOpacity="0.58"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        ))}

        <path
          d={wallPathData}
          fill="url(#deepCaveRockStrata)"
          fillRule="evenodd"
        />

        {edgePaths.map(edge => (
          <path
            key={`edge-${edge.id}`}
            d={edge.d}
            fill="none"
            stroke="#080605"
            strokeWidth="1.2"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>
    </div>
  );
});
