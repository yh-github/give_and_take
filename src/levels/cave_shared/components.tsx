import React, { memo, useMemo } from 'react';
import { calculateFacetLighting, getCorridorBounds, hashSeed } from '../../logic/geometry.ts';
import type {
  CSSCustomProperties,
  CaveBrazier,
  CaveLandmark,
  CaveWallVertices,
  CollarBounds,
  CollarOrientation,
  OrganicBoulderFacet,
  Point2D,
  ProceduralGeometry
} from '../../types/index.ts';

export const CampIcon = () => (
  <div className="text-6xl drop-shadow-lg -translate-y-4">⛺</div>
);

export interface CaveSvgDefsProps {
  idPrefix?: string;
}

/**
 * Shared SVG `<defs>` (glows, depth gradient wash, sedimentary rock strata pattern)
 * used by both `underground` and `deep_cave` backgrounds.
 */
export const CaveSvgDefs = memo(({ idPrefix = 'cave' }: CaveSvgDefsProps) => (
  <defs>
    <radialGradient id={`${idPrefix}CampGlow`} cx="50%" cy="50%" r="50%">
      <stop offset="0%" stopColor="#93c5fd" stopOpacity="0.24" />
      <stop offset="55%" stopColor="#fde68a" stopOpacity="0.09" />
      <stop offset="100%" stopColor="#2b221d" stopOpacity="0" />
    </radialGradient>
    <radialGradient id={`${idPrefix}SporeGlow`} cx="50%" cy="50%" r="50%">
      <stop offset="0%" stopColor="#2dd4bf" stopOpacity="0.26" />
      <stop offset="60%" stopColor="#0f766e" stopOpacity="0.1" />
      <stop offset="100%" stopColor="#042f2e" stopOpacity="0" />
    </radialGradient>
    <radialGradient id={`${idPrefix}VaultGlow`} cx="50%" cy="50%" r="50%">
      <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.22" />
      <stop offset="60%" stopColor="#92400e" stopOpacity="0.08" />
      <stop offset="100%" stopColor="#140f12" stopOpacity="0" />
    </radialGradient>
    <radialGradient id={`${idPrefix}AbyssExitGlow`} cx="50%" cy="50%" r="50%">
      <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.26" />
      <stop offset="55%" stopColor="#4f46e5" stopOpacity="0.14" />
      <stop offset="100%" stopColor="#090710" stopOpacity="0" />
    </radialGradient>
    <linearGradient id={`${idPrefix}DepthWash`} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor="#3c2f27" stopOpacity="0.22" />
      <stop offset="48%" stopColor="#241c17" stopOpacity="0.32" />
      <stop offset="100%" stopColor="#140f12" stopOpacity="0.58" />
    </linearGradient>
    <pattern id={`${idPrefix}RockStrata`} width="16" height="16" patternUnits="userSpaceOnUse">
      <rect width="16" height="16" fill="#130e0c" />
      <path d="M -2 4 L 6 -2 M 0 12 L 14 2 M 6 18 L 18 9" stroke="#221915" strokeWidth="0.7" opacity="0.7" />
      <path d="M 2 16 L 16 6" stroke="#090706" strokeWidth="0.5" opacity="0.8" />
      <circle cx="4" cy="7" r="0.35" fill="#3a2d25" opacity="0.65" />
      <circle cx="12" cy="12" r="0.4" fill="#2d231d" opacity="0.55" />
    </pattern>
  </defs>
));

/**
 * Renders decorative subterranean floor landmarks inside cave backgrounds.
 */
export function renderCaveLandmarkSVG(lm: CaveLandmark, idPrefix = 'cave') {
  const s = lm.scale ?? 1;
  const rot = lm.rotation ?? 0;
  const tf = `translate(${lm.x} ${lm.y}) rotate(${rot}) scale(${s})`;
  switch (lm.kind) {
    case 'mushroom_grove':
      return (
        <g key={lm.id} transform={tf}>
          <circle cx="0" cy="0" r="14" fill={`url(#${idPrefix}SporeGlow)`} />
          <ellipse cx="-3.5" cy="2.5" rx="6.2" ry="3.2" fill="#0d3b3e" opacity="0.55" />
          <ellipse cx="4.2" cy="-2" rx="5.5" ry="2.8" fill="#134e4a" opacity="0.48" />
          <g opacity="0.92">
            <rect x="-5.4" y="0.4" width="1.1" height="2.6" rx="0.4" fill="#99f6e4" opacity="0.7" />
            <path d="M -7.6 0.8 Q -4.8 -3.4 -2.0 0.8 Z" fill="#14b8a6" stroke="#042f2e" strokeWidth="0.35" />
            <circle cx="-5.6" cy="-0.4" r="0.45" fill="#ccfbf1" opacity="0.85" />
            <circle cx="-4.0" cy="-1.0" r="0.35" fill="#ccfbf1" opacity="0.8" />
            <rect x="2.8" y="-3.2" width="0.9" height="2.1" rx="0.35" fill="#a7f3d0" opacity="0.65" />
            <path d="M 1.1 -2.9 Q 3.2 -6.0 5.4 -2.9 Z" fill="#2dd4bf" stroke="#042f2e" strokeWidth="0.3" />
            <circle cx="3.1" cy="-3.9" r="0.35" fill="#ecfeff" opacity="0.85" />
            <circle cx="-0.5" cy="4.2" r="0.45" fill="#5eead4" opacity="0.7" />
            <circle cx="6.2" cy="1.8" r="0.38" fill="#5eead4" opacity="0.6" />
            <circle cx="-6.8" cy="-4.0" r="0.32" fill="#99f6e4" opacity="0.6" />
          </g>
        </g>
      );
    case 'ruined_arch':
      return (
        <g key={lm.id} transform={tf} opacity="0.8">
          <rect x="-5.8" y="-3.2" width="4.4" height="2.8" rx="0.5" fill="#3f3630" stroke="#1c1613" strokeWidth="0.35" />
          <rect x="-0.6" y="-2.2" width="5.2" height="3.0" rx="0.5" fill="#4c4139" stroke="#1c1613" strokeWidth="0.35" />
          <rect x="-3.4" y="0.6" width="4.8" height="2.6" rx="0.5" fill="#352d28" stroke="#1c1613" strokeWidth="0.35" />
          <ellipse cx="-4.2" cy="-2.2" rx="1.2" ry="0.65" fill="#15803d" opacity="0.5" />
          <ellipse cx="2.8" cy="0.2" rx="1.0" ry="0.55" fill="#166534" opacity="0.45" />
        </g>
      );
    case 'vault_sanctum':
      return (
        <g key={lm.id} transform={tf}>
          <circle cx="0" cy="0" r="15" fill={`url(#${idPrefix}VaultGlow)`} />
          <circle cx="0" cy="0" r="10.8" fill="none" stroke="#b45309" strokeWidth="0.5" strokeDasharray="1.8 1.2" opacity="0.65" />
          <circle cx="0" cy="0" r="7.4" fill="none" stroke="#f59e0b" strokeWidth="0.4" opacity="0.55" />
          <polygon points="0,-9.2 1.8,-1.8 9.2,0 1.8,1.8 0,9.2 -1.8,1.8 -9.2,0 -1.8,-1.8" fill="#d97706" opacity="0.22" />
        </g>
      );
    case 'abyss_exit_sanctum':
      return (
        <g key={lm.id} transform={tf}>
          <circle cx="0" cy="0" r="16" fill={`url(#${idPrefix}AbyssExitGlow)`} />
          <circle cx="0" cy="0" r="11.2" fill="none" stroke="#0891b2" strokeWidth="0.55" strokeDasharray="2.1 1.3" opacity="0.65" />
          <circle cx="0" cy="0" r="7.8" fill="none" stroke="#6366f1" strokeWidth="0.45" opacity="0.6" />
        </g>
      );
    default:
      return null;
  }
}

export interface CaveBrazierPropProps {
  brazier: CaveBrazier;
  isLit: boolean;
  isVisible: boolean;
  leftPct: number;
  topPct: number;
  onClick: (brazier: CaveBrazier, e: React.MouseEvent) => void;
}

/**
 * Interactive wrought-iron cave brazier landmark. Clicking walks to the brazier
 * and ignites a permanent flickering firelight beacon across nearby tunnels.
 */
export const CaveBrazierProp = memo(({
  brazier,
  isLit,
  isVisible,
  leftPct,
  topPct,
  onClick
}: CaveBrazierPropProps) => {
  const showProp = isLit || isVisible;
  return (
    <button
      type="button"
      data-testid={`brazier-${brazier.id}`}
      data-lit={isLit ? 'true' : 'false'}
      onClick={(e) => onClick(brazier, e)}
      aria-label={isLit ? `Lit brazier ${brazier.id}` : `Light brazier ${brazier.id}`}
      className={`group absolute transform -translate-x-1/2 -translate-y-1/2 focus:outline-none transition-all duration-300 ${
        showProp ? 'opacity-100 pointer-events-auto cursor-pointer hover:scale-110' : 'opacity-0 pointer-events-none'
      }`}
      style={{
        left: `${leftPct}%`,
        top: `${topPct}%`,
        zIndex: isLit ? 154 : 108
      }}
    >
      <div className="relative flex flex-col items-center justify-center w-[7cqw] h-[7cqw]">
        {isLit && (
          <div
            aria-hidden="true"
            className="absolute inset-[-35%] rounded-full bg-amber-400/25 blur-sm animate-pulse pointer-events-none"
          />
        )}
        <svg viewBox="0 0 64 64" className="w-full h-full overflow-visible drop-shadow-[0_4px_6px_rgba(0,0,0,0.85)]">
          <ellipse cx="32" cy="53" rx="18" ry="6" fill="#1c1917" stroke="#0c0a09" strokeWidth="2" />
          <path d="M 20 38 L 16 52 M 44 38 L 48 52 M 32 40 L 32 54" stroke="#44403c" strokeWidth="3.2" strokeLinecap="round" />
          <path d="M 14 31 Q 32 45 50 31 L 46 27 Q 32 33 18 27 Z" fill="#292524" stroke="#57534e" strokeWidth="2" />
          <ellipse cx="32" cy="29" rx="15" ry="4.5" fill={isLit ? '#7c2d12' : '#1c1917'} stroke="#44403c" strokeWidth="1.5" />

          {isLit ? (
            <g className="animate-flicker">
              <path
                d="M 21 29 C 19 18, 28 11, 32 5 C 37 12, 45 18, 43 29 C 38 32, 26 32, 21 29 Z"
                fill="#f97316"
              />
              <path
                d="M 25 29 C 24 21, 30 16, 32 11 C 35 16, 40 21, 39 29 Z"
                fill="#fde047"
              />
              <circle cx="24" cy="12" r="1.6" fill="#fef08a" opacity="0.85" />
              <circle cx="40" cy="14" r="1.4" fill="#fdba74" opacity="0.85" />
            </g>
          ) : (
            <g>
              <circle cx="27" cy="28" r="2.6" fill="#44403c" />
              <circle cx="33" cy="29" r="3" fill="#292524" />
              <circle cx="37" cy="28" r="2.2" fill="#57534e" />
              <circle
                cx="32"
                cy="18"
                r="6"
                fill="none"
                stroke="#f59e0b"
                strokeWidth="1.6"
                strokeDasharray="3 3"
                className="opacity-0 group-hover:opacity-75 transition-opacity"
              />
            </g>
          )}
        </svg>
        {!isLit && isVisible && (
          <span
            aria-hidden="true"
            className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs opacity-0 group-hover:opacity-100 transition-opacity bg-stone-900/90 border border-amber-500/70 rounded-full px-1.5 py-0.5 shadow-md pointer-events-none"
          >
            🔥
          </span>
        )}
      </div>
    </button>
  );
});

export interface CollarWallContext {
  cb: CollarBounds & { orientation: CollarOrientation };
  cx: number;
  cy: number;
  spanU: number;
  spanV: number;
  flareTL: number;
  flareTR: number;
  flareBL: number;
  flareBR: number;
  hasWallContext: boolean;
  contextKey: string;
}

/**
 * Samples real local `wallPolylines` points around a doorway collar (`boundsOverride`)
 * so chasm fissures and boulder barricades dynamically adapt to the corridor's actual
 * proportions and the flare/angle of flanking cave walls.
 */
export function extractCollarWallContext(
  geometry: ProceduralGeometry | null | undefined,
  boundsOverride: CollarBounds | null | undefined,
  orientation: CollarOrientation,
  yNode = 50,
  nodeX = 50
): CollarWallContext {
  const isVertical = orientation === 'vertical';
  const cb: CollarBounds & { orientation: CollarOrientation } = boundsOverride
    ? { ...boundsOverride, orientation: boundsOverride.orientation || orientation }
    : {
        orientation,
        xLeft: isVertical ? nodeX - 3 : nodeX - 10,
        xRight: isVertical ? nodeX + 3 : nodeX + 10,
        yTop: isVertical ? yNode - 10.6 : yNode - 3,
        yBottom: isVertical ? yNode + 10.6 : yNode + 3
      };

  const cx = (cb.xLeft + cb.xRight) * 0.5;
  const cy = (cb.yTop + cb.yBottom) * 0.5;
  const spanU = Math.max(8, isVertical ? (cb.yBottom - cb.yTop) : (cb.xRight - cb.xLeft));
  const spanV = Math.max(3, isVertical ? (cb.xRight - cb.xLeft) : (cb.yBottom - cb.yTop));

  let flareTL = 0.25;
  let flareTR = 0.25;
  let flareBL = 0.25;
  let flareBR = 0.25;
  let wallSampleCount = 0;

  const polylines = geometry?.wallPolylines || [];
  if (polylines.length > 0) {
    let minTL = 0, maxTR = 0, minBL = 0, maxBR = 0;
    for (const poly of polylines) {
      const pts = Array.isArray(poly) ? poly : poly?.points;
      if (!pts) continue;
      for (const p of pts) {
        const uWorld = isVertical ? (p.y - cy) : (p.x - cx);
        const vWorld = isVertical ? -(p.x - cx) : (p.y - cy);
        if (Math.abs(uWorld) > spanU * 0.95 || Math.abs(vWorld) > 12) continue;

        wallSampleCount++;
        const uHalf = spanU * 0.5;
        if (Math.abs(vWorld) >= spanV * 0.4 && Math.abs(vWorld) <= 10.5) {
          if (vWorld < 0) {
            if (uWorld < -uHalf * 0.7) minTL = Math.min(minTL, uWorld + uHalf);
            if (uWorld > uHalf * 0.7) maxTR = Math.max(maxTR, uWorld - uHalf);
          } else {
            if (uWorld < -uHalf * 0.7) minBL = Math.min(minBL, uWorld + uHalf);
            if (uWorld > uHalf * 0.7) maxBR = Math.max(maxBR, uWorld - uHalf);
          }
        }
      }
    }
    flareTL = Math.min(1, Math.max(0.08, Math.abs(minTL) / 8));
    flareTR = Math.min(1, Math.max(0.08, maxTR / 8));
    flareBL = Math.min(1, Math.max(0.08, Math.abs(minBL) / 8));
    flareBR = Math.min(1, Math.max(0.08, maxBR / 8));
  }

  return {
    cb,
    cx,
    cy,
    spanU,
    spanV,
    flareTL,
    flareTR,
    flareBL,
    flareBR,
    hasWallContext: wallSampleCount > 0,
    contextKey: `${Math.round(cb.xLeft * 10)}_${Math.round(cb.yTop * 10)}_${Math.round(spanU * 10)}`
  };
}

function pointsToClosedPath(pts: readonly Point2D[]): string {
  if (!pts || pts.length === 0) return '';
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) {
    d += ` L ${pts[i].x.toFixed(1)} ${pts[i].y.toFixed(1)}`;
  }
  return `${d} Z`;
}

function buildProceduralChasm(seedStr: string, wallCtx: CollarWallContext | null | undefined) {
  const ctxKey = wallCtx?.contextKey || 'default';
  const h0 = hashSeed(`${seedStr || 'chasm'}_${ctxKey}`);
  const randAt = (salt: string): number => ((hashSeed(`${seedStr}_${ctxKey}_${salt}`) % 1000) / 1000);

  const count = 15;
  const topRim: Point2D[] = [];
  const botRim: Point2D[] = [];
  const tier1Top: Point2D[] = [];
  const tier1Bot: Point2D[] = [];
  const tier2Top: Point2D[] = [];
  const tier2Bot: Point2D[] = [];
  const abyssTop: Point2D[] = [];
  const abyssBot: Point2D[] = [];

  const { flareTL = 0.25, flareTR = 0.25, flareBL = 0.25, flareBR = 0.25, spanU = 20, spanV = 6 } = wallCtx || {};
  const aspectBias = Math.min(1.18, Math.max(0.84, 3.0 / Math.max(1.8, spanU / Math.max(2, spanV))));

  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    const edgeTaper = Math.sin(Math.PI * (0.06 + 0.88 * t));
    const endFlareTop = (1 - t) * flareTL + t * flareTR;
    const endFlareBot = (1 - t) * flareBL + t * flareBR;
    const u = 2 + t * 156 + (i > 0 && i < count - 1 ? (randAt(`u_${i}`) - 0.5) * 4.5 : 0);

    const baseHalf = (15 + 15 * edgeTaper) * aspectBias + (randAt(`w_${i}`) - 0.5) * 4.8;
    const midV = 44 + (endFlareBot - endFlareTop) * 3.5 * (1 - edgeTaper) + (randAt(`m_${i}`) - 0.5) * 3.5 * edgeTaper;

    const topV = Math.max(7, midV - baseHalf - endFlareTop * 2.5 * (1 - edgeTaper));
    const botV = Math.min(81, midV + baseHalf + endFlareBot * 2.5 * (1 - edgeTaper));

    topRim.push({ x: u, y: topV });
    botRim.push({ x: u, y: botV });

    const inset1Top = 5.5 + randAt(`i1t_${i}`) * 3.5;
    const inset1Bot = 5.5 + randAt(`i1b_${i}`) * 3.5;
    tier1Top.push({ x: u, y: Math.min(midV - 4, topV + inset1Top) });
    tier1Bot.push({ x: u, y: Math.max(midV + 4, botV - inset1Bot) });

    const inset2Top = inset1Top + 5 + randAt(`i2t_${i}`) * 3.5;
    const inset2Bot = inset1Bot + 5 + randAt(`i2b_${i}`) * 3.5;
    tier2Top.push({ x: u, y: Math.min(midV - 2, topV + inset2Top) });
    tier2Bot.push({ x: u, y: Math.max(midV + 2, botV - inset2Bot) });

    abyssTop.push({ x: u, y: Math.min(midV - 0.8, topV + inset2Top + 4.5 + randAt(`a1_${i}`) * 2.5) });
    abyssBot.push({ x: u, y: Math.max(midV + 0.8, botV - inset2Bot - 4.5 - randAt(`a2_${i}`) * 2.5) });
  }

  const rimLoop = [...topRim, ...[...botRim].reverse()];
  const tier1Loop = [...tier1Top, ...[...tier1Bot].reverse()];
  const tier2Loop = [...tier2Top, ...[...tier2Bot].reverse()];
  const abyssLoop = [...abyssTop, ...[...abyssBot].reverse()];

  const lipTop = topRim.map((p, idx) => ({
    x: p.x,
    y: Math.max(2, p.y - (2.6 + randAt(`lt_${idx}`) * 2.1))
  }));
  const lipBot = botRim.map((p, idx) => ({
    x: p.x,
    y: Math.min(86, p.y + (2.6 + randAt(`lb_${idx}`) * 2.1))
  }));
  const lipLoop = [...lipTop, ...[...lipBot].reverse()];

  const leftAbutmentPts = `${(-5 - flareTL * 8).toFixed(1)},${Math.max(4, topRim[0].y - 6).toFixed(1)} ${topRim[0].x.toFixed(1)},${topRim[0].y.toFixed(1)} ${botRim[0].x.toFixed(1)},${botRim[0].y.toFixed(1)} ${(-5 - flareBL * 8).toFixed(1)},${Math.min(84, botRim[0].y + 6).toFixed(1)}`;
  const rightAbutmentPts = `${(165 + flareTR * 8).toFixed(1)},${Math.max(4, topRim[count - 1].y - 6).toFixed(1)} ${(165 + flareBR * 8).toFixed(1)},${Math.min(84, botRim[count - 1].y + 6).toFixed(1)} ${botRim[count - 1].x.toFixed(1)},${botRim[count - 1].y.toFixed(1)} ${topRim[count - 1].x.toFixed(1)},${topRim[count - 1].y.toFixed(1)}`;

  const cliffRibs: Array<{ topD: string; botD: string }> = [];
  for (let i = 1; i < count - 1; i += 2) {
    cliffRibs.push({
      topD: `M ${topRim[i].x.toFixed(1)} ${topRim[i].y.toFixed(1)} L ${(topRim[i].x + (randAt(`rt_${i}`) - 0.5) * 3).toFixed(1)} ${tier2Top[i].y.toFixed(1)}`,
      botD: `M ${botRim[i].x.toFixed(1)} ${botRim[i].y.toFixed(1)} L ${(botRim[i].x + (randAt(`rb_${i}`) - 0.5) * 3).toFixed(1)} ${tier2Bot[i].y.toFixed(1)}`
    });
  }

  const floorCracks = [2, 5, 9, 12].map((idx) => {
    const t = topRim[idx];
    const b = botRim[idx];
    const sideDir = idx < 7 ? -(1 + flareTL * 1.4) : (1 + flareTR * 1.4);
    const dx1 = sideDir * 3 + (randAt(`fc1_${idx}`) - 0.5) * 8;
    const dx2 = sideDir * 3 + (randAt(`fc2_${idx}`) - 0.5) * 8;
    return [
      `M ${t.x.toFixed(1)} ${t.y.toFixed(1)} L ${(t.x + dx1).toFixed(1)} ${Math.max(1, t.y - 6.5 - randAt(`fcd1_${idx}`) * 4.5).toFixed(1)}`,
      `M ${b.x.toFixed(1)} ${b.y.toFixed(1)} L ${(b.x + dx2).toFixed(1)} ${Math.min(87, b.y + 6.5 + randAt(`fcd2_${idx}`) * 4.5).toFixed(1)}`
    ];
  }).flat();

  const scree: string[] = [];
  for (let i = 0; i < 8; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const sampleIdx = 1 + Math.floor(randAt(`sc_idx_${i}`) * (count - 2));
    const anchor = side < 0 ? topRim[sampleIdx] : botRim[sampleIdx];
    const cx = anchor.x + (randAt(`scx_${i}`) - 0.5) * 6;
    const cy = anchor.y + side * (2.5 + randAt(`scy_${i}`) * 3.5);
    const rx = 1.6 + randAt(`scrx_${i}`) * 2.1;
    const ry = 1.1 + randAt(`scry_${i}`) * 1.4;
    scree.push(
      `${(cx - rx).toFixed(1)},${(cy - ry * 0.2).toFixed(1)} ${(cx - rx * 0.2).toFixed(1)},${(cy - ry).toFixed(1)} ${(cx + rx).toFixed(1)},${(cy + ry * 0.1).toFixed(1)} ${(cx + rx * 0.1).toFixed(1)},${(cy + ry).toFixed(1)}`
    );
  }

  const fissurePts: string[] = [];
  for (let i = 1; i < count - 1; i++) {
    const mid = (abyssTop[i].y + abyssBot[i].y) * 0.5 + (randAt(`fis_${i}`) - 0.5) * 3.2;
    fissurePts.push(`${abyssTop[i].x.toFixed(1)} ${mid.toFixed(1)}`);
  }
  const fissureD = `M ${fissurePts.join(' L ')}`;

  const topAnchorY = Math.max(8, topRim[7].y - 3.2);
  const botAnchorY = Math.min(80, botRim[7].y + 3.2);
  const ropeSpanY = botAnchorY - topAnchorY;
  const ropeAnchorX = 80 + (randAt('rope_ax') - 0.5) * 4;
  const ropeSagX = ropeAnchorX + (randAt('rope_sag') >= 0.5 ? 4.2 : -4.2);

  const knotCount = 5;
  const ropeKnots = Array.from({ length: knotCount }, (_, idx) => {
    const frac = (idx + 1) / (knotCount + 1);
    const inv = 1 - frac;
    const kx = inv * inv * ropeAnchorX + 2 * inv * frac * ropeSagX + frac * frac * ropeAnchorX;
    const ky = topAnchorY + frac * ropeSpanY;
    const rot = (randAt(`kr_${idx}`) - 0.5) * 26;
    return { id: idx, cx: kx, cy: ky, width: 6.2, height: 4.4, rot };
  });

  const mistWisps = [32, 62, 98, 128].map((mu, idx) => ({
    cx: mu + (randAt(`mu_${idx}`) - 0.5) * 8,
    cy: 44 + (randAt(`mv_${idx}`) - 0.5) * 10,
    rx: 12 + randAt(`mrx_${idx}`) * 8,
    ry: 5 + randAt(`mry_${idx}`) * 4,
    delay: `${(idx * 0.9).toFixed(1)}s`
  }));

  const fallingPebbles = [
    { cx: 42, cy: 19, px: '-2px', py: '18px', delay: '0ms' },
    { cx: 68, cy: 17, px: '3px', py: '22px', delay: '90ms' },
    { cx: 88, cy: 70, px: '-2px', py: '-20px', delay: '40ms' },
    { cx: 112, cy: 20, px: '2px', py: '19px', delay: '140ms' },
    { cx: 55, cy: 69, px: '1px', py: '-17px', delay: '170ms' }
  ];

  return {
    uid: `chasm_${h0}`,
    lipD: pointsToClosedPath(lipLoop),
    rimD: pointsToClosedPath(rimLoop),
    tier1D: pointsToClosedPath(tier1Loop),
    tier2D: pointsToClosedPath(tier2Loop),
    abyssD: pointsToClosedPath(abyssLoop),
    topRimD: `M ${topRim.map(p => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' L ')}`,
    botRimD: `M ${botRim.map(p => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' L ')}`,
    topWallBandD: pointsToClosedPath([...topRim, ...[...tier1Top].reverse()]),
    botWallBandD: pointsToClosedPath([...botRim, ...[...tier1Bot].reverse()]),
    leftAbutmentPts,
    rightAbutmentPts,
    cliffRibs,
    floorCracks,
    scree,
    fissureD,
    ropeAnchorX,
    ropeSagX,
    topAnchorY,
    botAnchorY,
    ropePathD: `M ${ropeAnchorX.toFixed(1)} ${topAnchorY.toFixed(1)} Q ${ropeSagX.toFixed(1)} ${((topAnchorY + botAnchorY) * 0.5).toFixed(1)} ${ropeAnchorX.toFixed(1)} ${botAnchorY.toFixed(1)}`,
    ropeShadowD: `M ${(ropeAnchorX + 3).toFixed(1)} ${(topAnchorY + 2).toFixed(1)} Q ${(ropeSagX + 5.5).toFixed(1)} ${((topAnchorY + botAnchorY) * 0.5 + 3).toFixed(1)} ${(ropeAnchorX + 3).toFixed(1)} ${(botAnchorY + 2).toFixed(1)}`,
    ropeKnots,
    mistWisps,
    fallingPebbles
  };
}

export interface ChasmSVGProps {
  isDefeated?: boolean;
  isAlerting?: boolean;
  isBridging?: boolean;
  isSelected?: boolean;
  orientation?: CollarOrientation;
  seed?: string | number;
  heroPos?: Point2D | null;
  nodeX?: number;
  yNode?: number;
  boundsOverride?: CollarBounds | null;
  fallbackWallVertices?: CaveWallVertices | null;
  geometry?: ProceduralGeometry | null;
  yScale?: number;
}

/**
 * Chasm / Abyssal Fissure Gatekeeper Visual.
 * Contextual geometry-aware canyon wedged into the flanking cave walls; consuming 1 `rope`
 * drives iron pitons into opposite cliff lips and anchors a taut knotted climbing rope across.
 * Keeps zero `<rect>` elements when unbridged (`!isDefeated`), using `<rect>` pitons & knots once roped.
 */
export const ChasmSVG = memo(({
  isDefeated = false,
  isAlerting = false,
  isBridging = false,
  isSelected = false,
  orientation = 'horizontal',
  seed = 'chasm',
  heroPos = null,
  nodeX = 50,
  yNode = 50,
  boundsOverride = null,
  fallbackWallVertices = null,
  geometry = null,
  yScale = 1
}: ChasmSVGProps) => {
  const isVertical = orientation === 'vertical';
  const effectiveBounds = useMemo<CollarBounds | null>(() => {
    if (boundsOverride) return boundsOverride;
    if (fallbackWallVertices) {
      const cb = getCorridorBounds(yNode, fallbackWallVertices, nodeX >= 50);
      return {
        orientation: 'horizontal',
        xLeft: cb.xLeft,
        xRight: cb.xRight,
        yTop: yNode - 1.5,
        yBottom: yNode + 1.5
      };
    }
    return null;
  }, [boundsOverride, fallbackWallVertices, yNode, nodeX]);

  const wallCtx = useMemo(
    () => extractCollarWallContext(geometry, effectiveBounds, orientation, yNode, nodeX),
    [geometry, effectiveBounds, orientation, yNode, nodeX]
  );
  const geom = useMemo(() => buildProceduralChasm(`${seed}_${orientation}`, wallCtx), [seed, orientation, wallCtx]);

  const heroDv = useMemo(() => {
    if (!heroPos) return -1;
    const dx = heroPos.x - nodeX;
    const dy = (heroPos.y - yNode) * yScale;
    return isVertical ? -dx : dy;
  }, [heroPos, nodeX, yNode, yScale, isVertical]);

  const heroOnTopSide = heroDv <= 0;
  const topWallFill = heroOnTopSide ? '#1c1517' : '#4a382c';
  const botWallFill = heroOnTopSide ? '#4a382c' : '#1c1517';
  const topLipGlow = isAlerting ? '#f87171' : isSelected ? '#fbbf24' : (heroOnTopSide ? '#78604c' : '#d97706');
  const botLipGlow = isAlerting ? '#f87171' : isSelected ? '#fbbf24' : (heroOnTopSide ? '#d97706' : '#78604c');

  const coilX = geom.ropeAnchorX - 8;
  const coilY = heroOnTopSide ? geom.topAnchorY - 2.5 : geom.botAnchorY + 2.5;

  return (
    <div className="w-full h-full relative pointer-events-none flex items-center justify-center">
      <svg
        viewBox={isVertical ? '0 0 88 160' : '0 0 160 88'}
        className={`${isVertical ? 'h-full w-auto max-w-none' : 'w-full h-auto'} overflow-visible select-none drop-shadow-[0_6px_14px_rgba(0,0,0,0.85)]`}
      >
        <defs>
          <radialGradient id={`${geom.uid}_abyss`} cx="50%" cy="50%" r="55%">
            <stop offset="0%" stopColor="#040206" stopOpacity="1" />
            <stop offset="70%" stopColor="#0a0710" stopOpacity="0.98" />
            <stop offset="100%" stopColor="#16101b" stopOpacity="0.95" />
          </radialGradient>
        </defs>

        <g transform={isVertical ? 'translate(88, 0) rotate(90)' : undefined}>
          <path d={geom.lipD} fill="#1f1814" opacity="0.74" />
          <polygon points={geom.leftAbutmentPts} fill="#1b1411" opacity="0.88" />
          <polygon points={geom.rightAbutmentPts} fill="#1b1411" opacity="0.88" />

          {geom.floorCracks.map((crackD, i) => (
            <path
              key={`crack-${i}`}
              d={crackD}
              stroke="#0f0b09"
              strokeWidth="1.4"
              strokeLinecap="round"
              fill="none"
              vectorEffect="non-scaling-stroke"
            />
          ))}

          <path
            d={geom.rimD}
            fill="#141012"
            stroke={isAlerting ? '#ef4444' : isSelected ? '#f59e0b' : '#4a3a30'}
            strokeWidth={isAlerting || isSelected ? '2.2' : '1.4'}
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />

          <path d={geom.topWallBandD} fill={topWallFill} opacity="0.92" />
          <path d={geom.botWallBandD} fill={botWallFill} opacity="0.92" />

          <path d={geom.tier1D} fill="#130f18" stroke="#08060a" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          <path d={geom.tier2D} fill="#0c0811" stroke="#040306" strokeWidth="1" vectorEffect="non-scaling-stroke" />

          {geom.cliffRibs.map((rib, idx) => (
            <g key={`rib-${idx}`} opacity="0.55">
              <path d={rib.topD} stroke={heroOnTopSide ? '#0a0709' : '#785a46'} strokeWidth="1.1" fill="none" vectorEffect="non-scaling-stroke" />
              <path d={rib.botD} stroke={heroOnTopSide ? '#785a46' : '#0a0709'} strokeWidth="1.1" fill="none" vectorEffect="non-scaling-stroke" />
            </g>
          ))}

          <path d={geom.abyssD} fill={`url(#${geom.uid}_abyss)`} />

          <g className="animate-chasm-fissure">
            <path d={geom.fissureD} stroke="#ea580c" strokeWidth="4.5" strokeLinecap="round" fill="none" opacity="0.28" />
            <path d={geom.fissureD} stroke="#fb923c" strokeWidth="1.8" strokeLinecap="round" fill="none" opacity="0.72" />
            <path d={geom.fissureD} stroke="#fef08a" strokeWidth="0.8" strokeLinecap="round" fill="none" opacity="0.65" />
          </g>

          {geom.mistWisps.map((m, idx) => (
            <ellipse
              key={`mist-${idx}`}
              cx={m.cx}
              cy={m.cy}
              rx={m.rx}
              ry={m.ry}
              fill={idx % 2 === 0 ? '#4c1d95' : '#7c2d12'}
              opacity="0.2"
              className="animate-chasm-mist"
              style={{ animationDelay: m.delay }}
            />
          ))}

          <path
            d={geom.topRimD}
            stroke={topLipGlow}
            strokeWidth={isAlerting || isSelected ? '2' : '1.3'}
            strokeOpacity={isAlerting || isSelected ? '0.85' : '0.55'}
            strokeLinejoin="round"
            fill="none"
            vectorEffect="non-scaling-stroke"
          />
          <path
            d={geom.botRimD}
            stroke={botLipGlow}
            strokeWidth={isAlerting || isSelected ? '2' : '1.3'}
            strokeOpacity={isAlerting || isSelected ? '0.85' : '0.55'}
            strokeLinejoin="round"
            fill="none"
            vectorEffect="non-scaling-stroke"
          />

          {geom.scree.map((pts, idx) => (
            <polygon
              key={`scree-${idx}`}
              points={pts}
              fill="#57473d"
              stroke="#1a1410"
              strokeWidth="0.9"
              vectorEffect="non-scaling-stroke"
            />
          ))}

          {isAlerting && !isDefeated && geom.fallingPebbles.map((p, idx) => (
            <polygon
              key={`peb-${idx}`}
              points={`${p.cx - 1.5},${p.cy} ${p.cx + 0.4},${p.cy - 1.6} ${p.cx + 1.8},${p.cy + 0.3} ${p.cx - 0.2},${p.cy + 1.6}`}
              fill="#a8a29e"
              stroke="#292524"
              strokeWidth="0.7"
              className="animate-pebble-fall"
              style={{ '--px': p.px, '--py': p.py, animationDelay: p.delay } as CSSCustomProperties}
            />
          ))}

          {isDefeated && (
            <g>
              <path
                d={geom.ropeShadowD}
                stroke="#030205"
                strokeWidth="5"
                strokeLinecap="round"
                fill="none"
                opacity="0.55"
              />
              <g opacity="0.92" className={isBridging ? 'animate-bridge-rope' : undefined}>
                <ellipse cx={coilX} cy={coilY} rx="5.5" ry="3.2" fill="none" stroke="#78350f" strokeWidth="2.4" />
                <ellipse cx={coilX} cy={coilY} rx="4.0" ry="2.2" fill="none" stroke="#d97706" strokeWidth="1.5" />
                <ellipse cx={coilX + 0.5} cy={coilY - 0.3} rx="2.4" ry="1.3" fill="none" stroke="#f59e0b" strokeWidth="1.1" />
                <path
                  d={`M ${(coilX + 4.5).toFixed(1)} ${coilY.toFixed(1)} Q ${((coilX + geom.ropeAnchorX) * 0.5).toFixed(1)} ${coilY.toFixed(1)} ${geom.ropeAnchorX.toFixed(1)} ${(heroOnTopSide ? geom.topAnchorY : geom.botAnchorY).toFixed(1)}`}
                  stroke="#b45309"
                  strokeWidth="2.2"
                  fill="none"
                  strokeLinecap="round"
                />
              </g>
              {[geom.topAnchorY, geom.botAnchorY].map((ay, idx) => (
                <g key={`piton-${idx}`}>
                  <ellipse cx={geom.ropeAnchorX} cy={ay + 1.1} rx="4.4" ry="2.2" fill="#090706" opacity="0.75" />
                  <rect
                    x={(geom.ropeAnchorX - 4.2).toFixed(1)}
                    y={(ay - 2.6).toFixed(1)}
                    width="8.4"
                    height="5.2"
                    rx="1.2"
                    fill="#44403c"
                    stroke="#1c1917"
                    strokeWidth="1.1"
                  />
                  <circle cx={geom.ropeAnchorX} cy={ay} r="2.0" fill="#a8a29e" stroke="#292524" strokeWidth="0.9" />
                </g>
              ))}
              <path
                d={geom.ropePathD}
                stroke="#451a03"
                strokeWidth="4.6"
                strokeLinecap="round"
                fill="none"
                className={isBridging ? 'animate-bridge-rope' : undefined}
              />
              <path
                d={geom.ropePathD}
                stroke="#b45309"
                strokeWidth="3.2"
                strokeLinecap="round"
                fill="none"
                className={isBridging ? 'animate-bridge-rope' : undefined}
              />
              <path
                d={geom.ropePathD}
                stroke="#f59e0b"
                strokeWidth="1.5"
                strokeDasharray="3.2 2.4"
                strokeLinecap="round"
                fill="none"
              />
              {geom.ropeKnots.map((knot, idx) => (
                <g
                  key={`knot-${knot.id}`}
                  transform={`rotate(${knot.rot.toFixed(1)} ${knot.cx.toFixed(1)} ${knot.cy.toFixed(1)})`}
                  className={isBridging ? 'animate-bridge-plank' : undefined}
                  style={isBridging ? { animationDelay: `${idx * 65}ms` } : undefined}
                >
                  <rect
                    x={(knot.cx - knot.width * 0.5).toFixed(1)}
                    y={(knot.cy - knot.height * 0.5).toFixed(1)}
                    width={knot.width}
                    height={knot.height}
                    rx="2.1"
                    fill="#92400e"
                    stroke="#3b1806"
                    strokeWidth="1.1"
                  />
                  <line
                    x1={(knot.cx - 1.6).toFixed(1)}
                    y1={(knot.cy - 1.1).toFixed(1)}
                    x2={(knot.cx + 1.6).toFixed(1)}
                    y2={(knot.cy + 1.1).toFixed(1)}
                    stroke="#fbbf24"
                    strokeWidth="0.9"
                    strokeLinecap="round"
                    opacity="0.85"
                  />
                </g>
              ))}
            </g>
          )}
        </g>
      </svg>
    </div>
  );
});

interface CaveBoulder {
  id: string;
  localX: number;
  vertices: Point2D[];
  facets: OrganicBoulderFacet[];
}

function buildCaveRockMesh(
  bounds: CollarBounds,
  wallCtx: CollarWallContext | null | undefined,
  isVerticalCollar: boolean,
  seedStr: string | number
): CaveBoulder[] {
  const { flareTL = 0.25, flareTR = 0.25, flareBL = 0.25, flareBR = 0.25 } = wallCtx || {};
  const xLeft = bounds.xLeft;
  const xRight = bounds.xRight;
  const yTop = bounds.yTop;
  const yBottom = bounds.yBottom;
  const widthW = Math.max(4, xRight - xLeft);
  const heightW = Math.max(1.5, yBottom - yTop);
  const ctxSeed = `${seedStr}_${wallCtx?.contextKey || 'r'}`;

  const boulders: CaveBoulder[] = [];
  const count = 6;
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    const isLeftEnd = i === 0;
    const isRightEnd = i === count - 1;
    const uLocal = isLeftEnd
      ? 11 + flareTL * 4
      : isRightEnd
        ? 139 - flareTR * 4
        : 22 + t * 106 + ((hashSeed(`${ctxSeed}_ux_${i}`) % 100) / 100 - 0.5) * 9;

    const wallYBias = (isLeftEnd ? (flareBL - flareTL) : isRightEnd ? (flareBR - flareTR) : 0) * 6;
    const vLocal = 35 + wallYBias + ((hashSeed(`${ctxSeed}_vy_${i}`) % 100) / 100 - 0.5) * 14;

    const rx = isLeftEnd || isRightEnd
      ? 19 + (isLeftEnd ? flareTL + flareBL : flareTR + flareBR) * 4.5
      : 16 + (hashSeed(`${ctxSeed}_rx_${i}`) % 9);
    const ry = 18 + (hashSeed(`${ctxSeed}_ry_${i}`) % 8);

    const numPts = 8;
    const vertices: Point2D[] = [];
    for (let p = 0; p < numPts; p++) {
      const angle = (p / numPts) * Math.PI * 2;
      const jitter = 0.82 + ((hashSeed(`${ctxSeed}_pt_${i}_${p}`) % 100) / 100) * 0.36;
      const vx = Math.max(1, Math.min(149, uLocal + Math.cos(angle) * rx * jitter));
      const vy = Math.max(5, Math.min(65, vLocal + Math.sin(angle) * ry * jitter));
      vertices.push({ x: vx, y: vy });
    }

    const peak: Point2D = {
      x: uLocal + ((hashSeed(`${ctxSeed}_pkx_${i}`) % 100) / 100 - 0.5) * rx * 0.32,
      y: vLocal + ((hashSeed(`${ctxSeed}_pky_${i}`) % 100) / 100 - 0.5) * ry * 0.32
    };

    const facets: OrganicBoulderFacet[] = [];
    for (let f = 0; f < numPts; f += 2) {
      const p1 = vertices[f];
      const p2 = vertices[(f + 1) % numPts];
      const p3 = vertices[(f + 2) % numPts];
      const fcx = (p1.x + p2.x + p3.x + peak.x) * 0.25;
      const fcy = (p1.y + p2.y + p3.y + peak.y) * 0.25;

      const mapCentroid: Point2D = isVerticalCollar
        ? {
            x: xRight - (fcy / 70) * widthW,
            y: yTop + (fcx / 150) * heightW
          }
        : {
            x: xLeft + (fcx / 150) * widthW,
            y: yTop + (fcy / 70) * heightW
          };

      const du = (fcx - uLocal) / Math.max(4, rx);
      const dv = (fcy - vLocal) / Math.max(4, ry);
      const nx = isVerticalCollar ? -dv * 0.85 : du * 0.75;
      const ny = isVerticalCollar ? du * 0.75 : dv * 0.85;
      const nz = Math.sqrt(Math.max(0.18, 1 - nx * nx - ny * ny));
      const len = Math.hypot(nx, ny, nz) || 1;
      facets.push({
        id: `dc_f_${i}_${f}`,
        pts: [p1, p2, p3, peak],
        mapCentroid,
        normal: { x: nx / len, y: ny / len, z: nz / len }
      });
    }

    boulders.push({ id: `dc_b_${i}`, localX: uLocal, vertices, facets });
  }

  return boulders;
}

export interface CaveRockSVGProps {
  isDefeated?: boolean;
  isAlerting?: boolean;
  isBreaking?: boolean;
  seed?: string | number;
  size?: string;
  heroPos?: Point2D | null;
  yNode?: number;
  nodeX?: number;
  boundsOverride?: CollarBounds | null;
  fallbackWallVertices?: CaveWallVertices | null;
  geometry?: ProceduralGeometry | null;
  yScale?: number;
}

/**
 * Unified Contextual Cave-In Boulder Barricade shared by `underground` and `deep_cave`.
 * Anchors wedged faceted boulders into corridor walls, with hero torchlight normal shading,
 * pickaxe break animation, and floor scree on defeat.
 */
export const CaveRockSVG = memo(({
  isDefeated = false,
  isAlerting = false,
  isBreaking = false,
  seed = 'rock',
  heroPos = null,
  yNode = 50,
  nodeX = 50,
  boundsOverride = null,
  fallbackWallVertices = null,
  geometry = null,
  yScale = 1
}: CaveRockSVGProps) => {
  const effectiveBounds = useMemo<CollarBounds | null>(() => {
    if (boundsOverride) return boundsOverride;
    if (fallbackWallVertices) {
      const cb = getCorridorBounds(yNode, fallbackWallVertices, nodeX >= 50);
      return {
        orientation: 'horizontal',
        xLeft: cb.xLeft,
        xRight: cb.xRight,
        yTop: yNode - 1.5,
        yBottom: yNode + 1.5
      };
    }
    return null;
  }, [boundsOverride, fallbackWallVertices, yNode, nodeX]);

  const isVerticalCollar = effectiveBounds?.orientation === 'vertical';
  const orientation: CollarOrientation = isVerticalCollar ? 'vertical' : 'horizontal';
  const wallCtx = useMemo(
    () => extractCollarWallContext(geometry, effectiveBounds, orientation, yNode, nodeX),
    [geometry, effectiveBounds, orientation, yNode, nodeX]
  );

  const boulders = useMemo(
    () => buildCaveRockMesh(wallCtx.cb, wallCtx, Boolean(isVerticalCollar), seed),
    [wallCtx, isVerticalCollar, seed]
  );

  if (isDefeated && !isBreaking) {
    return (
      <div className="w-full relative pointer-events-none flex justify-center">
        <svg viewBox={isVerticalCollar ? '0 0 70 150' : '0 0 150 45'} className="w-full h-auto drop-shadow-md overflow-visible">
          <g transform={isVerticalCollar ? 'translate(70, 0) rotate(90)' : undefined}>
            <ellipse cx="75" cy="36" rx="68" ry="6" fill="#14100d" opacity="0.6" />
            {boulders.filter((_, idx) => idx <= 1 || idx >= boulders.length - 2).map(boulder => (
              <g key={boulder.id}>
                {boulder.facets.map((facet, idx) => {
                  const lighting = calculateFacetLighting(facet, heroPos, yScale);
                  const p = facet.pts;
                  return (
                    <polygon
                      key={facet.id || idx}
                      points={`${p[0].x},${p[0].y * 0.34 + 19} ${p[1].x},${p[1].y * 0.34 + 19} ${p[2].x},${p[2].y * 0.34 + 19} ${p[3].x},${p[3].y * 0.34 + 19}`}
                      fill={lighting.color}
                      stroke="#14110e"
                      strokeWidth="1.4"
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
  }

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
            <path
              d="M 75 10 L 75 44 M 75 12 L 45 36 M 75 12 L 105 36"
              stroke="#fef08a"
              strokeWidth="3"
              fill="none"
              strokeDasharray="120"
              className="animate-crack-branch"
              style={{ filter: 'drop-shadow(0 0 6px #f59e0b)' }}
              vectorEffect="non-scaling-stroke"
            />
            <g className="animate-rock-split-left">
              {boulders.filter(b => b.localX < 75).map(boulder => (
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
              {boulders.filter(b => b.localX >= 75).map(boulder => (
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
        </svg>
      </div>
    );
  }

  return (
    <div className={`w-full relative transition-all duration-700 ${isAlerting ? 'animate-troll-mad' : ''}`}>
      <svg viewBox={isVerticalCollar ? '0 0 70 150' : '0 0 150 70'} className="w-full h-auto drop-shadow-[0_10px_20px_rgba(0,0,0,0.9)] overflow-visible">
        <g transform={isVerticalCollar ? 'translate(70, 0) rotate(90)' : undefined}>
          <ellipse cx="75" cy="40" rx="74" ry="22" fill="#0d0907" opacity="0.65" />
          {boulders.map(boulder => (
            <g key={boulder.id}>
              <polygon
                points={boulder.vertices.map(v => `${v.x},${v.y}`).join(' ')}
                fill="#14110e"
                stroke="#0a0806"
                strokeWidth="2"
                vectorEffect="non-scaling-stroke"
              />
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
      </svg>
    </div>
  );
});

export interface AbyssalExitSVGProps {
  label?: string;
  isAlerting?: boolean;
  isDefeated?: boolean;
}

/**
 * Carved stone descent shaft & glowing abyssal ladder leading deeper into `deep_cave`.
 */
export const AbyssalExitSVG = memo(({
  label = 'Deeper Cave ⬇️',
  isAlerting = false,
  isDefeated = false
}: AbyssalExitSVGProps) => (
  <div
    data-testid="abyssal-exit"
    className={`relative flex flex-col items-center justify-center w-[24cqw] h-[22cqw] select-none ${
      isAlerting ? 'animate-troll-mad' : ''
    } ${isDefeated ? 'scale-105' : ''}`}
  >
    <div
      aria-hidden="true"
      className="absolute inset-[-15%] rounded-full bg-cyan-500/20 blur-md animate-pulse pointer-events-none"
    />
    <svg viewBox="0 0 120 110" className="w-full h-full overflow-visible drop-shadow-[0_8px_16px_rgba(0,0,0,0.9)]">
      <defs>
        <radialGradient id="abyssExitPitGrad" cx="50%" cy="55%" r="55%">
          <stop offset="0%" stopColor="#0e7490" stopOpacity="0.9" />
          <stop offset="45%" stopColor="#1e1b4b" stopOpacity="0.96" />
          <stop offset="100%" stopColor="#05030a" stopOpacity="1" />
        </radialGradient>
      </defs>

      {/* Outer carved rock arch & stone coping */}
      <ellipse cx="60" cy="64" rx="52" ry="34" fill="#2b211c" stroke="#0c0907" strokeWidth="3" />
      <ellipse cx="60" cy="63" rx="46" ry="29" fill="#3f3128" stroke="#18120f" strokeWidth="2" />
      {/* Stepped stone collar descending into shadow */}
      <ellipse cx="60" cy="65" rx="39" ry="24" fill="#1c1518" stroke="#08060a" strokeWidth="1.5" />
      <ellipse cx="60" cy="67" rx="32" ry="19" fill="url(#abyssExitPitGrad)" />

      {/* Subtle carved rune rim ticks */}
      <ellipse cx="60" cy="64" rx="43" ry="26.5" fill="none" stroke="#22d3ee" strokeWidth="1.2" strokeDasharray="4 6" opacity="0.55" />

      {/* Iron piton brackets */}
      <rect x="37" y="42" width="7" height="5" rx="1.2" fill="#57534e" stroke="#1c1917" strokeWidth="1.2" />
      <rect x="76" y="42" width="7" height="5" rx="1.2" fill="#57534e" stroke="#1c1917" strokeWidth="1.2" />

      {/* Rope & timber descent ladder descending into the abyss */}
      <path d="M 42 45 L 45 92 M 78 45 L 75 92" stroke="#92400e" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M 42 45 L 45 92 M 78 45 L 75 92" stroke="#d97706" strokeWidth="1.4" strokeLinecap="round" strokeDasharray="3 2" />
      {[53, 63, 73, 83].map((ry, idx) => (
        <rect
          key={ry}
          x={43 + idx * 0.6}
          y={ry - 2}
          width={34 - idx * 1.2}
          height="4.4"
          rx="1.5"
          fill="#78350f"
          stroke="#291204"
          strokeWidth="1.2"
        />
      ))}

      {/* Rising abyssal sparkles */}
      <circle cx="52" cy="57" r="1.6" fill="#67e8f9" opacity="0.8" />
      <circle cx="67" cy="70" r="1.3" fill="#a5b4fc" opacity="0.75" />
    </svg>
    <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-stone-950/90 border-2 border-cyan-400/80 text-cyan-200 font-black tracking-wide text-[3cqw] sm:text-xs px-2.5 py-0.5 rounded-full shadow-[0_0_12px_rgba(34,211,238,0.45)] whitespace-nowrap z-30">
      {label}
    </div>
  </div>
));
