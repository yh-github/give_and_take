import React from 'react';
import {
  AIR_POCKET_POLYGON,
  AIR_POCKET_Y,
  HULL_LOWER_KEEL,
  HULL_UPPER_ROOF,
  SHIPWRECK_BULKHEAD_SEGMENTS
} from './geometry.ts';
import { SeaWitchSVG, ShipwreckWaterOverlay } from '../sea_shared/components.tsx';

export { ShipwreckWaterOverlay };

const buildPolylinePath = (pts: ReadonlyArray<{ x: number; y: number }>): string =>
  pts.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

const CLOSED_HULL_PATH = `${buildPolylinePath(HULL_UPPER_ROOF)} ${HULL_LOWER_KEEL
  .slice(0, -1)
  .reverse()
  .map((p) => `L ${p.x} ${p.y}`)
  .join(' ')} Z`;

const AIR_POCKET_POINTS = AIR_POCKET_POLYGON.map((p) => `${p.x},${p.y}`).join(' ');
const UPPER_HULL_PATH = buildPolylinePath(HULL_UPPER_ROOF);
const LOWER_KEEL_PATH = buildPolylinePath(HULL_LOWER_KEEL);

export interface ShipwreckBackgroundProps {
  isTransformed?: boolean;
}

export const ShipwreckBackground = ({ isTransformed = true }: ShipwreckBackgroundProps) => (
  <div
    data-testid="shipwreck-background"
    className="absolute inset-0 pointer-events-none z-0 overflow-hidden bg-[#020817]"
  >
    <svg
      className="absolute inset-0 w-full h-full"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id="swOceanBg" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#084c61" />
          <stop offset="30%" stopColor="#0b3954" />
          <stop offset="68%" stopColor="#06213e" />
          <stop offset="100%" stopColor="#030b1a" />
        </linearGradient>

        <linearGradient id="swSunBeam" x1="15%" y1="0%" x2="45%" y2="100%">
          <stop offset="0%" stopColor="#bae6fd" stopOpacity="0.22" />
          <stop offset="55%" stopColor="#38bdf8" stopOpacity="0.06" />
          <stop offset="100%" stopColor="#0284c7" stopOpacity="0" />
        </linearGradient>

        <linearGradient id="swRockCliff" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1e293b" />
          <stop offset="55%" stopColor="#0f172a" />
          <stop offset="100%" stopColor="#040814" />
        </linearGradient>

        <linearGradient id="swSandTrench" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#334155" />
          <stop offset="42%" stopColor="#1e293b" />
          <stop offset="100%" stopColor="#050914" />
        </linearGradient>

        <linearGradient id="swFloodedInterior" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#261710" />
          <stop offset="55%" stopColor="#18120e" />
          <stop offset="100%" stopColor="#0c0c12" />
        </linearGradient>

        <radialGradient id="swDryAirGlow" cx="55%" cy="54%" r="58%">
          <stop offset="0%" stopColor="#fef3c7" stopOpacity="0.96" />
          <stop offset="40%" stopColor="#f59e0b" stopOpacity="0.62" />
          <stop offset="78%" stopColor="#92400e" stopOpacity="0.82" />
          <stop offset="100%" stopColor="#451a03" stopOpacity="0.98" />
        </radialGradient>

        <linearGradient id="swTatteredSail" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#64748b" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#1e293b" stopOpacity="0.3" />
        </linearGradient>

        <clipPath id="swHullClip">
          <path d={CLOSED_HULL_PATH} />
        </clipPath>
      </defs>

      {/* 1. Ocean Depth & Sunlit Shafts */}
      <rect x="0" y="0" width="100" height="100" fill="url(#swOceanBg)" />
      <polygon points="10,0 28,0 48,78 18,78" fill="url(#swSunBeam)" />
      <polygon points="48,0 68,0 84,65 54,65" fill="url(#swSunBeam)" />

      {/* 2. Distant Underwater Ridge Silhouettes */}
      <path d="M 0 58 Q 16 48 34 56 Q 55 62 75 44 L 100 34 L 100 100 L 0 100 Z" fill="#05142b" opacity="0.72" />

      {/* 3. Jagged Abyssal Rock Cliff Propping Up the Tilted Bow on the Right */}
      <path
        d="M 62 100 L 66 72 L 75 62 L 82 54 L 89 44 L 94 34 L 100 30 L 100 100 Z"
        fill="url(#swRockCliff)"
        stroke="#334155"
        strokeWidth="0.4"
      />
      <path d="M 73 76 L 82 64 L 92 55 L 97 44" fill="none" stroke="#475569" strokeWidth="0.45" opacity="0.45" />

      {/* 4. Exterior Wreckage Behind/Attached to Hull: Snapped Mainmast, Tattered Sail & Bowsprit */}
      <g opacity="0.92">
        {/* Snapped mainmast leaning diagonally up-left */}
        <path
          d="M 48 43 L 34 15 L 36.2 14 L 51 41 Z"
          fill="#451a03"
          stroke="#78350f"
          strokeWidth="0.4"
        />
        {/* Jagged splintered mast tip */}
        <polygon points="34,15 33.4,12.5 35.2,14 36.4,12.2 36.2,14" fill="#78350f" />
        {/* Broken diagonal yardarm */}
        <line x1="26" y1="26" x2="45" y2="21" stroke="#5c2808" strokeWidth="1.2" strokeLinecap="round" />
        {/* Ragged wind-torn ghostly sailcloth */}
        <path
          d="M 27 26 Q 31 32 34 38 L 38 34 L 41 37 L 44 22 Z"
          fill="url(#swTatteredSail)"
          stroke="#64748b"
          strokeWidth="0.3"
        />
        {/* Dangling frayed rigging ropes */}
        <path d="M 27 26 Q 28 36 25 46" fill="none" stroke="#92400e" strokeWidth="0.3" opacity="0.65" />
        <path d="M 44 22 Q 49 28 57 34" fill="none" stroke="#92400e" strokeWidth="0.3" opacity="0.65" />

        {/* Broken wooden bowsprit extending off the high bow peak */}
        <path d="M 92 17 L 99.5 10 L 99.8 11.4 L 93.5 19 Z" fill="#451a03" stroke="#92400e" strokeWidth="0.35" />
      </g>

      {/* 5. Cutaway Crashed Galleon Interior */}
      <g clipPath="url(#swHullClip)">
        {/* Flooded Dark Waterlogged Wood Backdrop */}
        <rect x="20" y="10" width="78" height="72" fill="url(#swFloodedInterior)" />

        {/* Tilted Interior Deck Plank Lines (tilted ~-28 deg matching crashed hull) */}
        {[-12, -2, 8, 18, 28, 38, 48].map((offset, idx) => (
          <line
            key={`tilted-plank-${idx}`}
            x1={22}
            y1={62 + offset}
            x2={94}
            y2={20 + offset}
            stroke="#0e0907"
            strokeWidth="0.4"
            opacity="0.7"
          />
        ))}

        {/* Curved Structural Hull Ribs inside Flooded Compartments */}
        {[34, 46, 58, 70, 82].map((rx, idx) => (
          <path
            key={`rib-${idx}`}
            d={`M ${rx} ${55 - (rx - 30) * 0.55} Q ${rx + 2} ${68 - (rx - 30) * 0.45} ${rx + 5} ${80 - (rx - 30) * 0.55}`}
            fill="none"
            stroke="#3f2110"
            strokeWidth="0.7"
            opacity="0.48"
          />
        ))}

        {/* Circular Brass Portholes ONLY inside Flooded Lower Compartments */}
        {[
          { cx: 36, cy: 61 },
          { cx: 56, cy: 49 },
          { cx: 73, cy: 55 }
        ].map((ph, idx) => (
          <g key={`porthole-${idx}`} opacity="0.72">
            <circle cx={ph.cx} cy={ph.cy} r="1.9" fill="#075985" stroke="#92400e" strokeWidth="0.5" />
            <circle cx={ph.cx - 0.5} cy={ph.cy - 0.5} r="0.6" fill="#bae6fd" opacity="0.55" />
          </g>
        ))}

        {/* Flooded Room Props: Spilled Barrels, Lodged Tilted Cannon & Vertical Hanging Chains */}
        <g opacity="0.7">
          {/* Spilled oak barrels in Stern Bilge */}
          <rect x="39" y="73" width="4.5" height="5.5" rx="1" transform="rotate(-18 41 75)" fill="#5c2808" stroke="#92400e" strokeWidth="0.35" />
          <rect x="44" y="75" width="4.5" height="5" rx="1" transform="rotate(24 46 77)" fill="#451a03" stroke="#78350f" strokeWidth="0.35" />

          {/* Tilted Gun Deck Cannon */}
          <rect x="48" y="47" width="7" height="2.8" rx="1" transform="rotate(-22 51 48)" fill="#334155" stroke="#64748b" strokeWidth="0.35" />
          <circle cx="50" cy="49.8" r="1.2" fill="#451a03" stroke="#92400e" strokeWidth="0.35" />

          {/* Hanging Chains dropping straight vertically to emphasize crashed ship angle */}
          <line x1="42" y1="47" x2="42" y2="55" stroke="#64748b" strokeWidth="0.45" strokeDasharray="0.9 0.7" />
          <line x1="72" y1="33" x2="72" y2="42" stroke="#64748b" strokeWidth="0.45" strokeDasharray="0.9 0.7" />
        </g>

        {/* === WINDOWLESS DRY BOW AIR POCKET (y <= 33, ZERO WINDOWS) === */}
        <polygon points={AIR_POCKET_POINTS} fill="url(#swDryAirGlow)" />

        {/* Solid Bolted Oak Roof Ribs & Iron Straps overhead (no windows!) */}
        <path
          d="M 65 31 Q 77 18 86 13 Q 93 17 94 28"
          fill="none"
          stroke="#451a03"
          strokeWidth="1.6"
        />
        {[72, 80, 88].map((bx, idx) => (
          <line
            key={`strap-${idx}`}
            x1={bx}
            y1={idx === 1 ? 13.5 : 19}
            x2={bx + 1.5}
            y2={idx === 1 ? 18 : 23}
            stroke="#334155"
            strokeWidth="0.8"
            strokeLinecap="round"
          />
        ))}
        {/* Dry Wooden Beam Shelf under Treasure */}
        <line x1="73" y1="29.5" x2="90" y2="27" stroke="#92400e" strokeWidth="1.3" strokeLinecap="round" />

        {/* Subtle Dry Golden Dust Sparkles in Air Pocket */}
        {[
          { cx: 75, cy: 23 },
          { cx: 83, cy: 17 },
          { cx: 89, cy: 24 }
        ].map((sp, idx) => (
          <circle key={`spark-${idx}`} cx={sp.cx} cy={sp.cy} r="0.45" fill="#fef08a" opacity="0.8" />
        ))}
      </g>

      {/* 6. Thick Outer Hull Planks, Exposed Ribs at Stern Breach & Interior Broken Bulkheads */}
      {/* Exposed curved ribcage timbers along shattered stern */}
      <g stroke="#5c2808" strokeWidth="0.8" fill="none" opacity="0.85">
        <path d="M 23 64 Q 26 67 24 70" />
        <path d="M 27 72 Q 30 74 28 77" />
        <path d="M 30 57 Q 34 59 33 63" />
      </g>

      <path d={UPPER_HULL_PATH} fill="none" stroke="#451a03" strokeWidth="2.1" strokeLinejoin="round" strokeLinecap="round" />
      <path d={UPPER_HULL_PATH} fill="none" stroke="#92400e" strokeWidth="0.75" strokeLinejoin="round" strokeLinecap="round" />

      <path d={LOWER_KEEL_PATH} fill="none" stroke="#451a03" strokeWidth="2.1" strokeLinejoin="round" strokeLinecap="round" />
      <path d={LOWER_KEEL_PATH} fill="none" stroke="#92400e" strokeWidth="0.75" strokeLinejoin="round" strokeLinecap="round" />

      {/* Interior Tilted Bulkheads & Broken Deck Beams (matches geometry.ts 1:1) */}
      <g strokeLinecap="round">
        {SHIPWRECK_BULKHEAD_SEGMENTS.map((seg, idx) => (
          <React.Fragment key={`bh-${idx}`}>
            <line x1={seg.a.x} y1={seg.a.y} x2={seg.b.x} y2={seg.b.y} stroke="#451a03" strokeWidth="1.9" />
            <line x1={seg.a.x} y1={seg.a.y} x2={seg.b.x} y2={seg.b.y} stroke="#92400e" strokeWidth="0.7" />
          </React.Fragment>
        ))}
      </g>

      {/* Jagged Splintered Plank Tips on Stern Hull Breach & Broken Beams */}
      <g fill="#78350f" stroke="#b45309" strokeWidth="0.25">
        <polygon points="21.5,63 24.5,64 23,66.2" />
        <polygon points="29.5,79 32.5,80.2 30.2,82" />
        <polygon points="54.2,52.5 55.8,53.2 55.1,54.8" />
        <polygon points="59,57.8 60.8,57.4 59.8,59.4" />
      </g>

      {/* 7. Draped Seaweed & Barnacles Strictly Below Waterline (never in Air Pocket!) */}
      <g fill="none" strokeLinecap="round" opacity="0.72">
        <path d="M 31 53 Q 30 58 32 62" stroke="#0d9488" strokeWidth="0.7" />
        <path d="M 48 42 Q 47 47 49 51" stroke="#059669" strokeWidth="0.7" />
        <path d="M 67 69 Q 69 65 68 61" stroke="#10b981" strokeWidth="0.65" />
      </g>

      {/* 8. Left Sandy Seabed Trench, Fallen Mizzenmast & Sunken Anchor */}
      <path
        d="M -2 76 Q 16 70 36 79 Q 52 85 72 80 L 102 86 L 102 102 L -2 102 Z"
        fill="url(#swSandTrench)"
      />
      <path d="M 4 84 Q 24 79 44 86 Q 60 91 78 86" fill="none" stroke="#38bdf8" strokeWidth="0.35" opacity="0.26" />
      {/* Broken fallen mast & anchor resting in the sand beneath keel */}
      <g opacity="0.75">
        <line x1="34" y1="86" x2="54" y2="92" stroke="#451a03" strokeWidth="1.3" strokeLinecap="round" />
        <path d="M 55 88 L 55 82 M 53 84 L 57 84 M 52.5 87 Q 55 90 57.5 87" fill="none" stroke="#64748b" strokeWidth="0.65" strokeLinecap="round" />
      </g>
    </svg>

    {/* 9. Animated Ceiling Water Droplets Dripping Inside Dry Bow Air Pocket */}
    {[
      { left: '73%', top: '20%', delay: '0s' },
      { left: '81%', top: '14%', delay: '1.1s' },
      { left: '88%', top: '18%', delay: '2.2s' }
    ].map((drip, idx) => (
      <div
        key={`drip-${idx}`}
        className="absolute w-1.5 h-2 rounded-full bg-cyan-200/90 shadow-[0_0_6px_rgba(125,211,252,0.85)] animate-ceiling-drip"
        style={{ left: drip.left, top: drip.top, animationDelay: drip.delay }}
      />
    ))}

    {/* Crisp Pill Hint at Water-Air Boundary */}
    <div
      style={{ left: '79.5%', top: `${AIR_POCKET_Y}%` }}
      className={`absolute -translate-x-1/2 -translate-y-1/2 px-2 py-0.5 rounded-full text-[2.3cqw] font-black border shadow-lg transition-all z-10 ${
        isTransformed
          ? 'bg-sky-950/90 border-cyan-300/90 text-cyan-100'
          : 'bg-amber-950/90 border-amber-300 text-amber-200 animate-pulse'
      }`}
    >
      {isTransformed ? '💦 🤠' : '🫧 ⬆️'}
    </div>
  </div>
);

export interface ShipwreckWitchSVGProps {
  isTransformed: boolean;
  reqEmojis?: string[];
  emoji?: string | null;
}

export const ShipwreckWitchSVG = ({
  isTransformed,
  reqEmojis = [],
  emoji = '😈'
}: ShipwreckWitchSVGProps) => (
  <SeaWitchSVG
    variant="shipwreck"
    isTransformed={isTransformed}
    reqEmojis={reqEmojis}
    emoji={emoji}
  />
);

export interface CaptainsTreasureSVGProps {
  isDefeated?: boolean;
  isTransformed?: boolean;
  isAlerting?: boolean;
  reqEmojis?: string[];
}

export const CaptainsTreasureSVG = ({
  isDefeated = false,
  isTransformed = true,
  isAlerting = false,
  reqEmojis = []
}: CaptainsTreasureSVGProps) => (
  <div
    data-testid="captains-treasure"
    className={`relative flex flex-col items-center justify-center ${isAlerting ? 'animate-troll-mad' : ''}`}
  >
    <svg
      viewBox="0 0 140 124"
      className="w-20 h-18 sm:w-24 sm:h-22 overflow-visible drop-shadow-[0_10px_18px_rgba(0,0,0,0.85)]"
    >
      <defs>
        <radialGradient id="captChestAura" cx="50%" cy="54%" r="54%">
          <stop offset="0%" stopColor="#fef08a" stopOpacity={isTransformed ? '0.55' : '0.95'} />
          <stop offset="55%" stopColor="#f59e0b" stopOpacity={isTransformed ? '0.22' : '0.45'} />
          <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="captGoldTrim" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fef08a" />
          <stop offset="50%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#b45309" />
        </linearGradient>
      </defs>

      {/* Radiant treasure aura */}
      <circle cx="70" cy="60" r="62" fill="url(#captChestAura)" />
      <ellipse cx="70" cy="106" rx="54" ry="10" fill="#451a03" opacity="0.65" />

      {/* Spilling gold coin mounds around the base */}
      <g>
        <ellipse cx="26" cy="99" rx="14" ry="6" fill="#ca8a04" stroke="#fef08a" strokeWidth="1" />
        <ellipse cx="114" cy="99" rx="14" ry="6" fill="#ca8a04" stroke="#fef08a" strokeWidth="1" />
        <circle cx="22" cy="96" r="3.5" fill="#fde047" stroke="#92400e" strokeWidth="0.8" />
        <circle cx="30" cy="98" r="3.5" fill="#facc15" stroke="#92400e" strokeWidth="0.8" />
        <circle cx="110" cy="98" r="3.5" fill="#fde047" stroke="#92400e" strokeWidth="0.8" />
        <circle cx="118" cy="95" r="3.5" fill="#facc15" stroke="#92400e" strokeWidth="0.8" />
        <circle cx="48" cy="105" r="3.2" fill="#fde047" stroke="#92400e" strokeWidth="0.8" />
        <circle cx="92" cy="105" r="3.2" fill="#fde047" stroke="#92400e" strokeWidth="0.8" />
      </g>

      {/* Propped-open ornate lid revealing overflowing hoard */}
      <path d="M 20 50 L 14 20 Q 70 4 126 20 L 120 50 Z" fill="#5c2808" stroke="url(#captGoldTrim)" strokeWidth="3" />
      <path d="M 36 48 L 32 16 M 104 48 L 108 16" stroke="url(#captGoldTrim)" strokeWidth="5.5" strokeLinecap="round" />

      {/* Overflowing treasure hoard inside the open rim */}
      <g>
        <ellipse cx="70" cy="52" rx="46" ry="11" fill="#eab308" stroke="#fef08a" strokeWidth="1.2" />
        {/* Pearl strand */}
        <circle cx="36" cy="53" r="3" fill="#f8fafc" />
        <circle cx="42" cy="55" r="3" fill="#f8fafc" />
        <circle cx="48" cy="56" r="3" fill="#e2e8f0" />
        {/* Gold coins & jewels */}
        <circle cx="56" cy="49" r="4" fill="#fde047" />
        <circle cx="84" cy="49" r="4" fill="#fde047" />
        <circle cx="96" cy="53" r="3.8" fill="#facc15" />
        <text x="41" y="47" textAnchor="middle" fontSize="18">💎</text>
        <text x="99" y="47" textAnchor="middle" fontSize="18">🏆</text>
        <text x="70" y="43" textAnchor="middle" fontSize="28" className="drop-shadow-lg">👑</text>
        <text x="54" y="54" textAnchor="middle" fontSize="14">🪙</text>
        <text x="86" y="54" textAnchor="middle" fontSize="14">🪙</text>
      </g>

      {/* Heavy iron-and-gold chest base */}
      <rect x="20" y="54" width="100" height="46" rx="7" fill="#451a03" stroke="url(#captGoldTrim)" strokeWidth="3.2" />
      <line x1="22" y1="70" x2="118" y2="70" stroke="#78350f" strokeWidth="2.5" />
      <line x1="22" y1="84" x2="118" y2="84" stroke="#78350f" strokeWidth="2.5" />
      <rect x="34" y="54" width="10" height="46" fill="url(#captGoldTrim)" opacity="0.92" />
      <rect x="96" y="54" width="10" height="46" fill="url(#captGoldTrim)" opacity="0.92" />

      {/* Ornate lock plate */}
      <rect x="59" y="51" width="22" height="22" rx="5" fill="#1e293b" stroke="#fde047" strokeWidth="2.4" />
      <circle cx="70" cy="60" r="3.6" fill="#fde047" />
      <polygon points="68,62 72,62 73,69 67,69" fill="#fde047" />

      {/* Sparkle glints */}
      <text x="14" y="34" fontSize="12" opacity="0.9">✨</text>
      <text x="116" y="32" fontSize="12" opacity="0.9">✨</text>
    </svg>

    {!isDefeated && (isTransformed || reqEmojis.length > 0) && (
      <div className="-mt-1 flex items-center gap-1 bg-amber-950/95 border border-amber-300/85 text-amber-100 rounded-full px-2 py-0.5 text-[2.2cqw] font-black shadow-md whitespace-nowrap">
        {isTransformed && <span>🤠</span>}
        {reqEmojis.length > 0 && <span>{reqEmojis.join('+')}</span>}
      </div>
    )}
  </div>
);

export const ShipwreckCampIcon = () => (
  <div data-testid="shipwreck-anchor-camp" className="relative flex flex-col items-center justify-center">
    <svg viewBox="0 0 110 90" className="w-16 h-14 sm:w-20 sm:h-16 overflow-visible drop-shadow-[0_6px_12px_rgba(0,0,0,0.85)]">
      <defs>
        <radialGradient id="anchorCampGlow" cx="50%" cy="55%" r="50%">
          <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#0f172a" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="55" cy="48" r="44" fill="url(#anchorCampGlow)" />
      <ellipse cx="55" cy="76" rx="34" ry="8" fill="#0f172a" opacity="0.7" />
      <circle cx="55" cy="20" r="7" fill="none" stroke="#fbbf24" strokeWidth="4" />
      <line x1="55" y1="27" x2="55" y2="70" stroke="#d97706" strokeWidth="5.5" strokeLinecap="round" />
      <line x1="36" y1="36" x2="74" y2="36" stroke="#fbbf24" strokeWidth="4.5" strokeLinecap="round" />
      <path d="M 28 56 Q 55 82 82 56" fill="none" stroke="#d97706" strokeWidth="5.5" strokeLinecap="round" />
      <polygon points="24,52 34,55 27,63" fill="#fbbf24" />
      <polygon points="86,52 76,55 83,63" fill="#fbbf24" />
    </svg>
  </div>
);
