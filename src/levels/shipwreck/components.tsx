import React from 'react';
import {
  AIR_POCKET_HATCH_LEFT,
  AIR_POCKET_HATCH_RIGHT,
  AIR_POCKET_Y,
  HULL_LOWER_KEEL_AND_RIGHT,
  HULL_UPPER_LEFT,
  SHIPWRECK_SCREENS
} from './geometry.ts';

const sy = (y: number): number => y * SHIPWRECK_SCREENS;

const buildPolylinePath = (pts: ReadonlyArray<{ x: number; y: number }>): string =>
  pts.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${sy(p.y)}`).join(' ');

const CLOSED_HULL_INTERIOR_PATH = `${buildPolylinePath(HULL_UPPER_LEFT)} L ${HULL_LOWER_KEEL_AND_RIGHT.map(
  (p) => `${p.x} ${sy(p.y)}`
).join(' L ')} Z`;

const UPPER_LEFT_HULL_PATH = buildPolylinePath(HULL_UPPER_LEFT);
const LOWER_RIGHT_HULL_PATH = buildPolylinePath(HULL_LOWER_KEEL_AND_RIGHT);

export interface ShipwreckBackgroundProps {
  isTransformed?: boolean;
}

export const ShipwreckBackground = ({ isTransformed = true }: ShipwreckBackgroundProps) => (
  <div
    data-testid="shipwreck-background"
    className="absolute inset-0 pointer-events-none z-0 overflow-hidden bg-[#020612]"
  >
    {/* Deep-Ocean Multi-Layer Gradient */}
    <div
      className="absolute inset-0"
      style={{
        background:
          'linear-gradient(180deg, #075985 0%, #0c4a6e 14%, #0f294d 34%, #0b1b3a 58%, #060f24 80%, #030712 100%)'
      }}
    />

    {/* Subtle Distant Sunlit Shafts & Deep-Sea Ridge Silhouettes + Tall Cutaway Galleon */}
    <svg
      className="absolute inset-0 w-full h-full"
      viewBox="0 0 100 300"
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id="swSunBeam" x1="20%" y1="0%" x2="40%" y2="100%">
          <stop offset="0%" stopColor="#7dd3fc" stopOpacity="0.22" />
          <stop offset="55%" stopColor="#0ea5e9" stopOpacity="0.06" />
          <stop offset="100%" stopColor="#0284c7" stopOpacity="0" />
        </linearGradient>

        <linearGradient id="swSeafloorBack" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#0f172a" />
          <stop offset="100%" stopColor="#030712" />
        </linearGradient>
        <linearGradient id="swSeafloorFront" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#1e293b" />
          <stop offset="55%" stopColor="#0f172a" />
          <stop offset="100%" stopColor="#050814" />
        </linearGradient>

        <linearGradient id="swFloodedWood" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#2b170b" />
          <stop offset="50%" stopColor="#1e1109" />
          <stop offset="100%" stopColor="#120b07" />
        </linearGradient>

        <radialGradient id="swAirPocketGlow" cx="50%" cy="46%" r="55%">
          <stop offset="0%" stopColor="#fef3c7" stopOpacity="0.96" />
          <stop offset="38%" stopColor="#f59e0b" stopOpacity="0.62" />
          <stop offset="78%" stopColor="#92400e" stopOpacity="0.72" />
          <stop offset="100%" stopColor="#451a03" stopOpacity="0.95" />
        </radialGradient>

        <linearGradient id="swTimberOuter" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#451a03" />
          <stop offset="50%" stopColor="#78350f" />
          <stop offset="100%" stopColor="#451a03" />
        </linearGradient>

        <linearGradient id="swSailCloth" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#475569" stopOpacity="0.65" />
          <stop offset="100%" stopColor="#1e293b" stopOpacity="0.35" />
        </linearGradient>

        <clipPath id="swHullClip">
          <path d={CLOSED_HULL_INTERIOR_PATH} />
        </clipPath>
      </defs>

      {/* Sunbeams from above */}
      <polygon points="8,0 28,0 44,120 12,120" fill="url(#swSunBeam)" />
      <polygon points="48,0 72,0 88,125 54,125" fill="url(#swSunBeam)" />

      {/* Distant Abyssal Cliff Edges */}
      <path d="M 0 38 Q 10 68 6 115 Q 11 165 4 220 L 0 265 Z" fill="#041024" opacity="0.78" />
      <path d="M 100 42 Q 91 75 95 125 Q 89 175 96 225 L 100 265 Z" fill="#041024" opacity="0.78" />

      {/* Distant Seabed Ridge Behind the Ship */}
      <path
        d="M -5 248 Q 22 232 52 246 Q 82 256 105 236 L 105 300 L -5 300 Z"
        fill="url(#swSeafloorBack)"
        opacity="0.95"
      />

      {/* === EXTERIOR SHIPWRECK SILHOUETTE: Broken Mast, Tattered Sail & Bowsprit === */}
      {/* Broken Mainmast & Yardarm protruding off starboard hull */}
      <g opacity="0.92">
        {/* Mainmast trunk snapped at tip */}
        <path
          d="M 81 156 L 97 132 L 99 135 L 82 162 Z"
          fill="#451a03"
          stroke="#78350f"
          strokeWidth="0.6"
        />
        {/* Yardarm */}
        <line x1="87" y1="122" x2="96" y2="150" stroke="#5c2808" strokeWidth="1.5" strokeLinecap="round" />
        {/* Tattered Ghostly Sailcloth */}
        <path
          d="M 88 124 Q 95 130 96 146 L 87 148 Q 90 138 84 134 Z"
          fill="url(#swSailCloth)"
          stroke="#64748b"
          strokeWidth="0.4"
        />
        {/* Trailing Rigging Ropes */}
        <path d="M 76 123 Q 85 128 89 135" fill="none" stroke="#92400e" strokeWidth="0.45" opacity="0.7" />
        <path d="M 82 174 Q 90 156 95 144" fill="none" stroke="#92400e" strokeWidth="0.45" opacity="0.65" />
      </g>

      {/* Ornate Stern Taffrail / Carved Quarter-Gallery Crown at Top (sy = 14..26) */}
      <g opacity="0.95">
        <path
          d="M 33 27 L 36 18 L 43 22 L 50 15 L 57 22 L 64 18 L 67 27 Z"
          fill="#78350f"
          stroke="#d97706"
          strokeWidth="0.7"
          strokeLinejoin="round"
        />
        <circle cx="50" cy="15" r="1.4" fill="#fbbf24" />
        <circle cx="36" cy="18" r="1.1" fill="#f59e0b" />
        <circle cx="64" cy="18" r="1.1" fill="#f59e0b" />
      </g>

      {/* Buried Bowsprit & Anchor Chain plunging into Seabed Sand (bottom right of keel) */}
      <path
        d="M 67 242 L 85 262 L 82 265 L 62 246 Z"
        fill="#451a03"
        stroke="#78350f"
        strokeWidth="0.6"
      />

      {/* === CUTAWAY SUNKEN PIRATE GALLEON INTERIOR === */}
      <g clipPath="url(#swHullClip)">
        {/* Flooded Decks 2, 3, 4 Planking Backdrop */}
        <rect x="16" y="75" width="74" height="175" fill="url(#swFloodedWood)" />

        {/* Horizontal Timber Plank Grooves inside Flooded Hull */}
        {[92, 108, 138, 156, 190, 208, 226].map((py) => (
          <line
            key={`plank-${py}`}
            x1="18"
            y1={py}
            x2="86"
            y2={py}
            stroke="#0d0704"
            strokeWidth="0.5"
            opacity="0.7"
          />
        ))}

        {/* Curved Structural Hull Ribs */}
        {[28, 42, 58, 72].map((rx) => (
          <line
            key={`rib-${rx}`}
            x1={rx}
            y1="75"
            x2={rx}
            y2="246"
            stroke="#3b1d0d"
            strokeWidth="0.9"
            opacity="0.45"
          />
        ))}

        {/* Faint Circular Brass Portholes along Flooded Rooms */}
        {[
          { cx: 30, cy: 99 },
          { cx: 70, cy: 99 },
          { cx: 29, cy: 147 },
          { cx: 72, cy: 147 },
          { cx: 73, cy: 204 }
        ].map((ph, idx) => (
          <g key={`porthole-${idx}`} opacity="0.72">
            <ellipse cx={ph.cx} cy={ph.cy} rx="2.7" ry="1.35" fill="#075985" stroke="#92400e" strokeWidth="0.6" />
            <ellipse cx={ph.cx - 0.6} cy={ph.cy - 0.3} rx="0.9" ry="0.4" fill="#bae6fd" opacity="0.5" />
          </g>
        ))}

        {/* Interior Atmospheric Room Props */}
        {/* Deck 2 Cargo Barrels & Crate Silhouette */}
        <g opacity="0.68">
          <rect x="50" y="232" width="7" height="10" rx="1" fill="#5c2808" stroke="#92400e" strokeWidth="0.45" />
          <rect x="60" y="235" width="8" height="8" rx="0.8" fill="#451a03" stroke="#78350f" strokeWidth="0.45" />
        </g>

        {/* Deck 3 Cannon Silhouette & Galley Shelf */}
        <g opacity="0.65">
          <rect x="24" y="164" width="10" height="5" rx="1.5" fill="#334155" stroke="#64748b" strokeWidth="0.4" />
          <ellipse cx="27" cy="170" rx="2.2" ry="1.2" fill="#451a03" stroke="#92400e" strokeWidth="0.4" />
        </g>

        {/* === TOP CAPTAIN'S CABIN AIR POCKET (y: 8..25, sy: 24..75) === */}
        <rect x="24" y="22" width="52" height="53" fill="url(#swAirPocketGlow)" />

        {/* Warm Golden Stern Cabin Windows */}
        {[38, 50, 62].map((wx, idx) => (
          <path
            key={`win-${idx}`}
            d={`M ${wx - 3.6} 44 L ${wx - 3.6} 34 Q ${wx} 30 ${wx + 3.6} 34 L ${wx + 3.6} 44 Z`}
            fill="#0c4a6e"
            fillOpacity="0.62"
            stroke="#fbbf24"
            strokeWidth="0.55"
          />
        ))}

        {/* Captain's Wooden Dais & Glowing Dry Oak Planks */}
        <rect x="38" y="57" width="24" height="5" rx="1" fill="#78350f" stroke="#fbbf24" strokeWidth="0.5" opacity="0.85" />
        <line x1="26" y1="68" x2="74" y2="68" stroke="#b45309" strokeWidth="0.6" opacity="0.55" />

        {/* Trapped Ceiling Air Shimmer */}
        <ellipse cx="50" cy="31" rx="14" ry="2.2" fill="#fef9c3" opacity="0.42" />
      </g>

      {/* === INTERIOR TIMBER BULKHEADS & HATCH RAILS (Matches geometry.ts 1:1) === */}
      {/* Air Pocket Floor: (26, 25)-(42, 25) and (58, 25)-(74, 25) */}
      <g strokeLinecap="round">
        <line x1="26" y1={sy(25)} x2="42" y2={sy(25)} stroke="#78350f" strokeWidth="3.2" />
        <line x1="26" y1={sy(25)} x2="42" y2={sy(25)} stroke="#d97706" strokeWidth="1.2" />
        <line x1="58" y1={sy(25)} x2="74" y2={sy(25)} stroke="#78350f" strokeWidth="3.2" />
        <line x1="58" y1={sy(25)} x2="74" y2={sy(25)} stroke="#d97706" strokeWidth="1.2" />

        {/* Deck 4 Floor: (24, 41)-(56, 41) and (72, 41)-(76, 41) */}
        <line x1="24" y1={sy(41)} x2="56" y2={sy(41)} stroke="#451a03" strokeWidth="3.2" />
        <line x1="24" y1={sy(41)} x2="56" y2={sy(41)} stroke="#92400e" strokeWidth="1.2" />
        <line x1="72" y1={sy(41)} x2="76" y2={sy(41)} stroke="#451a03" strokeWidth="3.2" />
        <line x1="72" y1={sy(41)} x2="76" y2={sy(41)} stroke="#92400e" strokeWidth="1.2" />

        {/* Deck 3 Partial Divider: (50, 41)-(50, 50) */}
        <line x1="50" y1={sy(41)} x2="50" y2={sy(50)} stroke="#451a03" strokeWidth="2.4" />
        <line x1="50" y1={sy(41)} x2="50" y2={sy(50)} stroke="#78350f" strokeWidth="1.0" />

        {/* Deck 3 Floor: (22, 58)-(28, 58) and (44, 58)-(82, 58) */}
        <line x1="22" y1={sy(58)} x2="28" y2={sy(58)} stroke="#451a03" strokeWidth="3.2" />
        <line x1="22" y1={sy(58)} x2="28" y2={sy(58)} stroke="#92400e" strokeWidth="1.2" />
        <line x1="44" y1={sy(58)} x2="82" y2={sy(58)} stroke="#451a03" strokeWidth="3.2" />
        <line x1="44" y1={sy(58)} x2="82" y2={sy(58)} stroke="#92400e" strokeWidth="1.2" />
      </g>

      {/* Subtle Wooden Hatch Ladder Guides in Flooded Hatchways */}
      <g opacity="0.55" stroke="#b45309" strokeWidth="0.6">
        {/* Port hatch ladder (x = 34..38 across y = 58) */}
        <line x1="34" y1={sy(56)} x2="34" y2={sy(62)} />
        <line x1="38" y1={sy(56)} x2="38" y2={sy(62)} />
        <line x1="34" y1={sy(58)} x2="38" y2={sy(58)} />
        <line x1="34" y1={sy(60.5)} x2="38" y2={sy(60.5)} />
        {/* Starboard hatch ladder (x = 62..66 across y = 41) */}
        <line x1="62" y1={sy(39)} x2="62" y2={sy(45)} />
        <line x1="66" y1={sy(39)} x2="66" y2={sy(45)} />
        <line x1="62" y1={sy(41)} x2="66" y2={sy(41)} />
        <line x1="62" y1={sy(43.5)} x2="66" y2={sy(43.5)} />
      </g>

      {/* === AIR POCKET WATER-AIR MENISCUS ACROSS CENTER HATCH (x = 42..58, y = 25) === */}
      <g data-testid="air-pocket-meniscus">
        <path
          d={`M ${AIR_POCKET_HATCH_LEFT} ${sy(AIR_POCKET_Y)} Q 46 ${sy(AIR_POCKET_Y) - 2} 50 ${sy(AIR_POCKET_Y)} T ${AIR_POCKET_HATCH_RIGHT} ${sy(AIR_POCKET_Y)}`}
          fill="none"
          stroke={isTransformed ? '#38bdf8' : '#fde047'}
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <line
          x1={AIR_POCKET_HATCH_LEFT}
          y1={sy(AIR_POCKET_Y)}
          x2={AIR_POCKET_HATCH_RIGHT}
          y2={sy(AIR_POCKET_Y)}
          stroke={isTransformed ? '#e0f2fe' : '#fef08a'}
          strokeWidth="0.7"
          strokeDasharray="2 2"
          opacity="0.85"
        />
      </g>

      {/* === HEAVY OUTER HULL CROSS-SECTION TIMBERS (Open Breach at 26,65 -> 32,75) === */}
      <path
        d={UPPER_LEFT_HULL_PATH}
        fill="none"
        stroke="#451a03"
        strokeWidth="3.2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <path
        d={UPPER_LEFT_HULL_PATH}
        fill="none"
        stroke="#92400e"
        strokeWidth="1.2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <path
        d={LOWER_RIGHT_HULL_PATH}
        fill="none"
        stroke="#451a03"
        strokeWidth="3.2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <path
        d={LOWER_RIGHT_HULL_PATH}
        fill="none"
        stroke="#92400e"
        strokeWidth="1.2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {/* Splintered Wood Jags Framing the Hull Breach Entrance */}
      <g fill="#78350f" stroke="#d97706" strokeWidth="0.4">
        <polygon points="24,193 29,197 25,202" />
        <polygon points="30,221 35,226 30,228" />
      </g>

      {/* Seabed Foreground Sand Dunes & Anchor Silhouette */}
      <path
        d="M -5 256 Q 28 242 58 248 Q 84 252 105 244 L 105 300 L -5 300 Z"
        fill="url(#swSeafloorFront)"
      />
      <path
        d="M 6 268 Q 34 258 64 264 Q 86 268 98 260"
        fill="none"
        stroke="#38bdf8"
        strokeWidth="0.7"
        opacity="0.28"
        strokeLinecap="round"
      />
      {/* Fallen Anchor Silhouette on Seabed Right */}
      <g opacity="0.65">
        <path
          d="M 86 254 L 86 242 M 83 245 L 89 245 M 81 252 Q 86 258 91 252"
          fill="none"
          stroke="#64748b"
          strokeWidth="1.1"
          strokeLinecap="round"
        />
      </g>
    </svg>

    {/* Crisp Circular Air Pocket Meniscus Hint Pill (not stretched by SVG aspect) */}
    <div
      style={{ left: '50%', top: `${AIR_POCKET_Y}%` }}
      className={`absolute -translate-x-1/2 -translate-y-1/2 px-2 py-0.5 rounded-full text-[2.4cqw] font-black border shadow-lg transition-all ${
        isTransformed
          ? 'bg-sky-950/90 border-cyan-400/80 text-cyan-200'
          : 'bg-amber-950/90 border-amber-300 text-amber-200 animate-pulse'
      }`}
    >
      {isTransformed ? '🫧 🤠' : '🫧 ⬆️'}
    </div>

    {/* True-Circle Rising Ambient Bubbles */}
    {[14, 29, 46, 63, 81].map((leftPct, i) => (
      <div
        key={`sw-bub-${i}`}
        className="absolute rounded-full border border-cyan-200/35 bg-white/10 animate-bubble"
        style={{
          left: `${leftPct}%`,
          top: `${36 + ((i * 13) % 52)}%`,
          width: `${6 + (i % 3) * 3}px`,
          height: `${6 + (i % 3) * 3}px`,
          animationDelay: `${i * 1.3}s`,
          animationDuration: `${10 + (i % 3) * 3}s`
        }}
      />
    ))}
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
}: ShipwreckWitchSVGProps) => {
  const badgeContent = isTransformed
    ? `${reqEmojis.join(' + ') || '🔮'} ➔ 🤠`
    : '🤠 ⬆️ 🫧';

  const badgeStyle = isTransformed
    ? 'bg-purple-950/95 border-purple-400 text-purple-100 shadow-[0_0_12px_rgba(168,85,247,0.85)]'
    : 'bg-emerald-950/95 border-amber-300 text-amber-200 shadow-[0_0_14px_rgba(52,211,153,0.9)]';

  return (
    <div className="relative flex flex-col items-center justify-center">
      <svg
        viewBox="0 0 140 110"
        className="absolute -top-6 left-1/2 -translate-x-1/2 w-[36cqw] h-[28cqw] pointer-events-none -z-10 overflow-visible"
      >
        <defs>
          <radialGradient id="swWitchGlow" cx="50%" cy="55%" r="50%">
            <stop offset="0%" stopColor={isTransformed ? '#9333ea' : '#10b981'} stopOpacity="0.68" />
            <stop offset="65%" stopColor={isTransformed ? '#581c87' : '#059669'} stopOpacity="0.3" />
            <stop offset="100%" stopColor="#0f172a" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="70" cy="58" r="56" fill="url(#swWitchGlow)" />
        <path
          d="M 22 92 Q 18 46 42 26 Q 70 12 98 26 Q 122 46 118 92 Z"
          fill="#1e1b4b"
          opacity="0.72"
          stroke={isTransformed ? '#6b21a8' : '#34d399'}
          strokeWidth="2"
        />
        <ellipse cx="70" cy="84" rx="22" ry="7" fill="#0f172a" stroke="#a855f7" strokeWidth="1.6" />
        <ellipse cx="70" cy="83" rx="15" ry="4" fill={isTransformed ? '#c084fc' : '#34d399'} opacity="0.75" />
      </svg>

      <span className="text-[11cqw] z-10 drop-shadow-[0_4px_12px_rgba(147,51,234,0.9)]">{emoji}</span>

      <div
        className={`mt-1 rounded-full px-2.5 py-0.5 whitespace-nowrap text-[2.6cqw] font-black border-2 z-20 transition-all ${badgeStyle}`}
      >
        {badgeContent}
      </div>
    </div>
  );
};

export interface CaptainsTreasureSVGProps {
  isDefeated?: boolean;
  isTransformed?: boolean;
  isAlerting?: boolean;
}

export const CaptainsTreasureSVG = ({
  isDefeated = false,
  isTransformed = true,
  isAlerting = false
}: CaptainsTreasureSVGProps) => (
  <div
    data-testid="captains-treasure"
    className={`relative flex flex-col items-center justify-center ${isAlerting ? 'animate-troll-mad' : ''}`}
  >
    <svg
      viewBox="0 0 120 110"
      className="w-20 h-20 sm:w-24 sm:h-24 overflow-visible drop-shadow-[0_8px_16px_rgba(0,0,0,0.8)]"
    >
      <defs>
        <radialGradient id="captChestAura" cx="50%" cy="55%" r="52%">
          <stop offset="0%" stopColor="#fde047" stopOpacity={isTransformed ? '0.45' : '0.85'} />
          <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="60" cy="56" r="52" fill="url(#captChestAura)" />
      <ellipse cx="60" cy="94" rx="44" ry="8" fill="#451a03" opacity="0.6" />

      {/* Open Ornate Pirate Chest */}
      <path d="M 18 52 L 26 24 Q 60 12 94 24 L 102 52 Z" fill="#78350f" stroke="#fde047" strokeWidth="2.6" />
      <rect x="20" y="52" width="80" height="40" rx="6" fill="#451a03" stroke="#fbbf24" strokeWidth="2.8" />
      <rect x="32" y="52" width="9" height="40" fill="#d97706" opacity="0.9" />
      <rect x="79" y="52" width="9" height="40" fill="#d97706" opacity="0.9" />
      <circle cx="60" cy="54" r="7" fill="#0f172a" stroke="#fde047" strokeWidth="2" />

      {!isDefeated && (
        <text x="60" y="47" textAnchor="middle" fontSize="28" className="drop-shadow-lg">
          👑
        </text>
      )}
    </svg>
    {!isDefeated && isTransformed && (
      <div className=" -mt-2 bg-sky-950/90 border border-cyan-300/80 text-cyan-100 rounded-full px-2 py-0.5 text-[2.4cqw] font-black shadow-md whitespace-nowrap">
        🤠 Only
      </div>
    )}
  </div>
);

export const ShipwreckCampIcon = () => (
  <div data-testid="shipwreck-anchor-camp" className="relative flex flex-col items-center justify-center">
    <svg viewBox="0 0 110 90" className="w-20 h-16 sm:w-24 sm:h-20 overflow-visible drop-shadow-[0_6px_12px_rgba(0,0,0,0.85)]">
      <defs>
        <radialGradient id="anchorCampGlow" cx="50%" cy="55%" r="50%">
          <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#0f172a" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="55" cy="48" r="44" fill="url(#anchorCampGlow)" />
      <ellipse cx="55" cy="76" rx="34" ry="8" fill="#0f172a" opacity="0.7" />
      {/* Sunken Brass Anchor */}
      <circle cx="55" cy="20" r="7" fill="none" stroke="#fbbf24" strokeWidth="4" />
      <line x1="55" y1="27" x2="55" y2="70" stroke="#d97706" strokeWidth="5.5" strokeLinecap="round" />
      <line x1="36" y1="36" x2="74" y2="36" stroke="#fbbf24" strokeWidth="4.5" strokeLinecap="round" />
      <path d="M 28 56 Q 55 82 82 56" fill="none" stroke="#d97706" strokeWidth="5.5" strokeLinecap="round" />
      <polygon points="24,52 34,55 27,63" fill="#fbbf24" />
      <polygon points="86,52 76,55 83,63" fill="#fbbf24" />
    </svg>
  </div>
);
