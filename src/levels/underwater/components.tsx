import React from 'react';
import {
  SeaWitchSVG,
  InteractiveKelpSVG,
  GiantClamSVG,
  InkCloudSVG,
  UnderwaterWaterOverlay
} from '../sea_shared/components.tsx';
import type { SeaWitchSVGProps } from '../sea_shared/components.tsx';

export { InteractiveKelpSVG, GiantClamSVG, InkCloudSVG, UnderwaterWaterOverlay };
export type { InteractiveKelpSVGProps, GiantClamSVGProps } from '../sea_shared/components.tsx';

export const UnderwaterBackground = () => (
  <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden bg-[#050814]">
    {/* === 1. Above Water: Sunny Sky & Horizon (y: 0% - 10.4%) === */}
    <div className="absolute top-0 left-0 w-full h-[10.4%] bg-gradient-to-b from-sky-400 via-sky-200 to-cyan-100 z-10">
      <svg className="w-full h-full" viewBox="0 0 200 72" preserveAspectRatio="xMidYMid slice">
        <defs>
          <radialGradient id="skySun" cx="82%" cy="30%" r="28%">
            <stop offset="0%" stopColor="#fef08a" stopOpacity="0.95" />
            <stop offset="45%" stopColor="#fde047" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#fde047" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="164" cy="20" r="30" fill="url(#skySun)" />
        <circle cx="164" cy="20" r="8.5" fill="#fef9c3" />
        <g fill="#ffffff" opacity="0.84">
          <path d="M 18 32 Q 22 22 32 24 Q 38 16 48 22 Q 56 22 58 30 Q 62 36 54 38 L 18 38 Q 12 36 18 32 Z" />
          <path d="M 105 24 Q 110 16 119 18 Q 125 12 134 17 Q 142 18 140 26 L 104 26 Z" opacity="0.72" />
        </g>
        {/* Distant horizon silhouettes resting cleanly along the sea horizon */}
        <path d="M 6 70 Q 24 58 46 70 Z" fill="#0e7490" opacity="0.38" />
        <path d="M 148 70 Q 170 60 194 70 Z" fill="#0e7490" opacity="0.32" />
      </svg>
    </div>

    {/* === 2. Slightly Isometric Ocean Surface Plane (y: 9.8% - 15.8%) === */}
    <div
      data-testid="isometric-sea-surface"
      className="absolute top-[9.8%] left-0 w-full h-[6.0%] z-15 overflow-hidden pointer-events-none"
      style={{
        background:
          'linear-gradient(180deg, #38bdf8 0%, #0ea5e9 46%, #0284c7 78%, #06b6d4 100%)'
      }}
    >
      {/* Horizon crisp highlight */}
      <div className="w-full h-[1.5px] bg-sky-100/75" />

      {/* Perspective depth-lane shimmer bands & foreshortened glints */}
      <svg className="w-full h-full" viewBox="0 0 200 60" preserveAspectRatio="none">
        {/* Far boat plane shimmer line (narrower/denser near horizon) */}
        <line x1="0" y1="15" x2="200" y2="15" stroke="#bae6fd" strokeWidth="0.9" strokeDasharray="10 14" opacity="0.55" />
        <ellipse cx="32" cy="12" rx="9" ry="1.1" fill="#e0f2fe" opacity="0.45" />
        <ellipse cx="96" cy="14" rx="11" ry="1.2" fill="#e0f2fe" opacity="0.4" />
        <ellipse cx="164" cy="11" rx="8" ry="1.0" fill="#e0f2fe" opacity="0.45" />

        {/* Mid plane shimmer (Raft anchor lane) */}
        <line x1="0" y1="30" x2="200" y2="30" stroke="#7dd3fc" strokeWidth="1.2" strokeDasharray="16 18" opacity="0.45" />
        <ellipse cx="52" cy="28" rx="14" ry="1.7" fill="#bae6fd" opacity="0.42" />
        <ellipse cx="136" cy="31" rx="16" ry="1.8" fill="#bae6fd" opacity="0.4" />

        {/* Foreground boat plane shimmer (wider near cutaway lip) */}
        <line x1="0" y1="45" x2="200" y2="45" stroke="#e0f2fe" strokeWidth="1.6" strokeDasharray="22 20" opacity="0.5" />
        <ellipse cx="26" cy="44" rx="18" ry="2.2" fill="#e0f2fe" opacity="0.48" />
        <ellipse cx="108" cy="46" rx="20" ry="2.3" fill="#e0f2fe" opacity="0.45" />
        <ellipse cx="176" cy="43" rx="15" ry="2.0" fill="#e0f2fe" opacity="0.45" />
      </svg>
    </div>

    {/* === 3. Multi-Zone Ocean Depth Gradient (y: 15.2% - 100%) === */}
    <div
      className="absolute top-[15.2%] left-0 w-full h-[84.8%] z-0"
      style={{
        background:
          'linear-gradient(180deg, #06b6d4 0%, #0284c7 17%, #0369a1 32%, #1d4ed8 47%, #1e3a8a 60%, #0f172a 72%, #070d20 84%, #030612 100%)',
      }}
    >
      {/* Sunlit Caustic Beams in Zone 1 */}
      <svg className="absolute top-0 left-0 w-full h-[45%]" viewBox="0 0 100 100" preserveAspectRatio="none">
        <defs>
          <linearGradient id="sunBeamGrad" x1="0%" y1="0%" x2="15%" y2="100%">
            <stop offset="0%" stopColor="#e0f2fe" stopOpacity="0.28" />
            <stop offset="55%" stopColor="#7dd3fc" stopOpacity="0.1" />
            <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points="8,0 26,0 42,100 14,100" fill="url(#sunBeamGrad)" />
        <polygon points="44,0 64,0 82,100 50,100" fill="url(#sunBeamGrad)" />
        <polygon points="76,0 92,0 104,100 84,100" fill="url(#sunBeamGrad)" />
      </svg>

      {/* Sculpted Reef Walls, Abyssal Cliffs & Swaying Kelp Forest Silhouettes (viewBox 100x300) */}
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 300" preserveAspectRatio="none">
        <defs>
          <linearGradient id="shallowWallGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0e7490" />
            <stop offset="100%" stopColor="#155e75" />
          </linearGradient>
          <linearGradient id="twilightWallGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#1e3a8a" />
            <stop offset="100%" stopColor="#0f172a" />
          </linearGradient>
          <linearGradient id="abyssWallGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#0f172a" />
            <stop offset="100%" stopColor="#020617" />
          </linearGradient>
          <linearGradient id="abyssRimHaze" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#020617" stopOpacity="0" />
            <stop offset="50%" stopColor="#020617" stopOpacity="0.32" />
            <stop offset="100%" stopColor="#020617" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Zone 1 Shallow Coral Shelves */}
        <path
          d="M 0 18 Q 16 22 14 34 Q 12 44 20 52 Q 16 62 8 68 L 0 75 Z"
          fill="url(#shallowWallGrad)"
          opacity="0.65"
        />
        <path
          d="M 100 20 Q 84 26 86 38 Q 88 48 80 56 Q 85 65 94 72 L 100 78 Z"
          fill="url(#shallowWallGrad)"
          opacity="0.65"
        />

        {/* Zone 2 Twilight Reef Ledges */}
        <path
          d="M 0 95 Q 15 104 18 118 Q 14 132 19 148 Q 12 162 24 180 Q 28 190 20 205 L 0 212 Z"
          fill="url(#twilightWallGrad)"
          opacity="0.82"
        />
        <path
          d="M 100 98 Q 85 108 82 122 Q 86 136 80 152 Q 88 166 76 180 Q 72 190 80 205 L 100 212 Z"
          fill="url(#twilightWallGrad)"
          opacity="0.82"
        />

        {/* Natural Abyssal Trench Dropoff Haze (y ~ 68-76% in world space, purely visual depth warning) */}
        <rect x="0" y="182" width="100" height="32" fill="url(#abyssRimHaze)" />

        {/* Zone 3 Abyssal Trench Cliffs */}
        <path
          d="M 0 195 L 22 198 Q 14 218 12 240 Q 16 262 10 285 L 0 300 Z"
          fill="url(#abyssWallGrad)"
          opacity="0.92"
        />
        <path
          d="M 100 195 L 78 198 Q 86 218 88 240 Q 84 262 90 285 L 100 300 Z"
          fill="url(#abyssWallGrad)"
          opacity="0.92"
        />

        {/* Swaying Algae & Seaweed Ribbons Along Reef Shelves */}
        <g fill="none" strokeLinecap="round" opacity="0.62">
          <path d="M 4 74 Q 7 58 3 44 Q 6 32 4 22" stroke="#10b981" strokeWidth="1.6" />
          <path d="M 8 76 Q 11 63 8 51 Q 10 40 9 30" stroke="#059669" strokeWidth="1.2" />
          <path d="M 96 76 Q 92 60 96 46 Q 93 34 95 24" stroke="#14b8a6" strokeWidth="1.6" />
          <path d="M 5 170 Q 9 148 5 128 Q 9 112 6 96" stroke="#0d9488" strokeWidth="1.7" />
          <path d="M 95 172 Q 91 150 95 130 Q 91 114 94 100" stroke="#0f766e" strokeWidth="1.7" />
          <path d="M 6 286 Q 9 266 5 248 Q 8 232 6 218" stroke="#1e293b" strokeWidth="1.8" />
          <path d="M 94 286 Q 90 266 95 246 Q 91 232 94 218" stroke="#1e293b" strokeWidth="1.8" />
        </g>
      </svg>

      {/* Lush Foreground Kelp Blades & Coral Fans (HTML-proportioned SVGs so they never stretch vertically) */}
      {[
        { left: '3%', top: '12%', w: '36px', h: '96px', fill: '#059669', delay: '0s' },
        { left: '91%', top: '16%', w: '34px', h: '90px', fill: '#0d9488', delay: '1.2s' },
        { left: '4%', top: '34%', w: '38px', h: '105px', fill: '#047857', delay: '0.6s' },
        { left: '90%', top: '42%', w: '36px', h: '102px', fill: '#0f766e', delay: '1.8s' },
        { left: '4%', top: '60%', w: '34px', h: '88px', fill: '#115e59', delay: '0.9s' },
        { left: '91%', top: '62%', w: '34px', h: '88px', fill: '#134e4a', delay: '2.1s' },
      ].map((k, idx) => (
        <svg
          key={`kelp-bg-${idx}`}
          viewBox="0 0 40 100"
          className="absolute pointer-events-none opacity-65"
          style={{ left: k.left, top: k.top, width: k.w, height: k.h }}
        >
          <g className="animate-kelp-sway" style={{ animationDelay: k.delay }}>
            <path
              d="M 18 100 Q 10 76 18 54 Q 26 34 15 10 Q 22 24 26 44 Q 20 68 23 100 Z"
              fill={k.fill}
            />
            <path
              d="M 24 100 Q 32 80 26 60 Q 20 42 30 22 Q 25 46 31 66 Q 28 84 28 100 Z"
              fill={k.fill}
              opacity="0.75"
            />
          </g>
        </svg>
      ))}

      {/* True-Circle Rising Ambient Bubbles */}
      {[12, 24, 38, 52, 67, 81, 90].map((leftPct, i) => (
        <div
          key={`amb-bub-${i}`}
          className="absolute rounded-full border border-cyan-200/40 bg-white/15 animate-bubble"
          style={{
            left: `${leftPct}%`,
            bottom: `${6 + (i * 11) % 70}%`,
            width: `${6 + (i % 3) * 4}px`,
            height: `${6 + (i % 3) * 4}px`,
            animationDelay: `${i * 1.4}s`,
            animationDuration: `${11 + (i % 4) * 3}s`,
          }}
        />
      ))}

      {/* Bioluminescent Deep-Sea Specks in Zone 2 & Zone 3 */}
      {[18, 34, 48, 63, 79, 29, 71].map((leftPct, i) => (
        <div
          key={`bio-${i}`}
          className="absolute rounded-full bg-cyan-300/30 animate-pulse"
          style={{
            left: `${leftPct}%`,
            top: `${55 + (i * 6) % 38}%`,
            width: '4px',
            height: '4px',
            boxShadow: '0 0 8px rgba(34,211,238,0.6)',
            animationDelay: `${i * 0.7}s`,
          }}
        />
      ))}
    </div>

    {/* === 4. Abyssal Seabed Dunes, Coral Spurs & Sunken Pirate Galleon SVG (y: 85% - 100%) === */}
    <svg className="absolute bottom-0 left-0 w-full h-[15%] z-10" viewBox="0 0 200 100" preserveAspectRatio="none">
      <defs>
        <linearGradient id="deepSandBack" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#0f172a" />
          <stop offset="100%" stopColor="#050814" />
        </linearGradient>
        <linearGradient id="deepSandMid" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#1e293b" />
          <stop offset="50%" stopColor="#0f172a" />
          <stop offset="100%" stopColor="#060b19" />
        </linearGradient>
        <linearGradient id="deepSandFront" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#334155" />
          <stop offset="45%" stopColor="#1e293b" />
          <stop offset="100%" stopColor="#090d16" />
        </linearGradient>
      </defs>

      <path
        d="M -10 42 Q 35 24 85 38 Q 135 50 175 28 Q 192 22 210 34 L 210 100 L -10 100 Z"
        fill="url(#deepSandBack)"
        opacity="0.9"
      />

      {/* Sunken Wooden Pirate Galleon Shipwreck resting on the left abyssal ridge */}
      <g transform="translate(8, 22) rotate(-9)">
        <rect x="24" y="-6" width="2.2" height="28" fill="#451a03" rx="1" />
        <line x1="14" y1="3" x2="36" y2="0.5" stroke="#451a03" strokeWidth="1.6" strokeLinecap="round" />
        <path
          d="M 16 3 L 34 1 L 31 12 L 26 9 L 22 13 L 17 10 Z"
          fill="#475569"
          opacity="0.55"
        />
        <path
          d="M 2 20 L 44 20 L 50 11 L 39 11 L 37 16 L 10 16 L 6 12 L 0 13 Z"
          fill="#451a03"
          stroke="#78350f"
          strokeWidth="0.9"
        />
        <path d="M 6 20 L 41 20 L 37 28 L 10 28 Z" fill="#271004" />
        <line x1="8" y1="22.5" x2="39" y2="22.5" stroke="#92400e" strokeWidth="0.8" opacity="0.65" />
        <circle cx="15" cy="21.2" r="1.2" fill="#0f172a" />
        <circle cx="23" cy="21.2" r="1.2" fill="#0f172a" />
        <circle cx="31" cy="21.2" r="1.2" fill="#0f172a" />
      </g>

      {/* Seabed Kelp Clumps & Fallen Anchor Silhouette */}
      <g opacity="0.65">
        <path d="M 166 56 L 166 40 M 162 44 L 170 44 M 161 54 Q 166 60 171 54" fill="none" stroke="#475569" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M 136 62 Q 134 50 138 42 Q 141 52 139 62 Z" fill="#065f46" />
        <path d="M 62 58 Q 60 48 64 40 Q 67 50 65 58 Z" fill="#064e3b" />
      </g>

      <path
        d="M -10 54 Q 30 38 72 48 Q 115 58 154 40 Q 182 30 210 44 L 210 100 L -10 100 Z"
        fill="url(#deepSandMid)"
      />

      <path
        d="M -10 66 Q 38 54 84 62 Q 132 70 172 56 Q 194 50 210 58 L 210 100 L -10 100 Z"
        fill="url(#deepSandFront)"
      />

      <path
        d="M 12 60 Q 45 50 82 58 Q 124 66 164 52"
        fill="none"
        stroke="#38bdf8"
        strokeWidth="0.9"
        opacity="0.3"
        strokeLinecap="round"
      />
      <path
        d="M 18 76 Q 62 68 108 74 Q 152 80 190 68"
        fill="none"
        stroke="#64748b"
        strokeWidth="1"
        opacity="0.4"
        strokeLinecap="round"
      />
    </svg>
  </div>
);

export interface SeaWitchGrottoSVGProps {
  isTransformed: boolean;
  hasDeepTreasure: boolean;
  returnRelicId?: string | null;
  returnRelicEmoji?: string | null;
  emoji?: string | null;
  spriteSrc?: string | null;
}

export const SeaWitchGrottoSVG = ({
  isTransformed,
  hasDeepTreasure,
  returnRelicId = null,
  returnRelicEmoji = '🔮',
  emoji = '😈',
  spriteSrc = null
}: SeaWitchGrottoSVGProps) => (
  <SeaWitchSVG
    variant="underwater"
    isTransformed={isTransformed}
    hasDeepTreasure={hasDeepTreasure}
    returnRelicId={returnRelicId}
    returnRelicEmoji={returnRelicEmoji}
    emoji={emoji}
    spriteSrc={spriteSrc}
  />
);

export const SeaWitchGateSVG = SeaWitchGrottoSVG;

export interface SunkenVaultSVGProps {
  reqEmojis?: string[];
  isDefeated?: boolean;
  isAlerting?: boolean;
  isMurkyFar?: boolean;
}

export const SunkenVaultSVG = ({
  reqEmojis = [],
  isDefeated = false,
  isAlerting = false,
  isMurkyFar = false
}: SunkenVaultSVGProps) => {
  const socketCount = Math.max(2, reqEmojis.length);
  const cxStart = 60 - ((socketCount - 1) * 26) / 2;

  return (
    <div
      data-testid="sunken-vault"
      className={`relative flex flex-col items-center justify-center ${isAlerting ? 'animate-troll-mad' : ''}`}
    >
      <svg viewBox="0 0 120 115" className="w-20 h-20 sm:w-24 sm:h-24 overflow-visible drop-shadow-[0_8px_14px_rgba(0,0,0,0.85)]">
        <defs>
          <radialGradient id="vaultAura" cx="50%" cy="55%" r="50%">
            <stop offset="0%" stopColor={isDefeated ? '#fde047' : '#f59e0b'} stopOpacity="0.65" />
            <stop offset="100%" stopColor="#0f172a" stopOpacity="0" />
          </radialGradient>
        </defs>

        <circle cx="60" cy="62" r="54" fill="url(#vaultAura)" />

        {/* Seabed Silhouette */}
        <ellipse cx="60" cy="100" rx="48" ry="9" fill="#020617" opacity="0.65" />

        {/* Chest Base (Ironbound Wood & Gold Straps) */}
        <rect x="16" y="54" width="88" height="44" rx="7" fill="#451a03" stroke="#fbbf24" strokeWidth="2.8" />
        <rect x="28" y="54" width="10" height="44" fill="#d97706" opacity="0.85" />
        <rect x="82" y="54" width="10" height="44" fill="#d97706" opacity="0.85" />

        {isDefeated ? (
          <>
            {/* Open Lid & Glowing Crown Inside */}
            <path d="M 14 54 L 22 24 Q 60 12 98 24 L 106 54 Z" fill="#78350f" stroke="#fde047" strokeWidth="2.5" />
            <text x="60" y="50" textAnchor="middle" fontSize="30" className="drop-shadow-lg">
              👑
            </text>
          </>
        ) : (
          <>
            {/* Domed Sealed Vault Lid */}
            <path
              d="M 15 54 Q 15 24 60 24 Q 105 24 105 54 Z"
              fill="#78350f"
              stroke="#fbbf24"
              strokeWidth="2.8"
            />
            <path d="M 28 31 L 28 54 M 92 31 L 92 54" stroke="#f59e0b" strokeWidth="6" />
            {/* Glowing Center Lock */}
            <circle cx="60" cy="54" r="9" fill="#0f172a" stroke="#fde047" strokeWidth="2.5" />
            <text x="60" y="59" textAnchor="middle" fontSize="11">
              🔒
            </text>
          </>
        )}
      </svg>
    </div>
  );
};

export const BoatSVG = () => (
  <svg viewBox="0 0 110 92" className="w-20 h-18 sm:w-24 sm:h-20 drop-shadow-xl animate-bob overflow-visible">
    <rect x="51" y="10" width="4" height="50" fill="#78350f" rx="1.5" />
    <polygon points="55,10 70,14 55,19" fill="#ef4444" />
    <path d="M 56 16 Q 88 32 86 54 L 56 54 Z" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1.5" />
    <path d="M 49 20 Q 24 36 26 54 L 49 54 Z" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1.5" />
    {/* Clean Wooden Boat Hull (no baked-in water line) */}
    <path
      d="M 12 58 L 98 58 L 84 80 Q 55 86 26 80 Z"
      fill="#92400e"
      stroke="#451a03"
      strokeWidth="2.5"
      strokeLinejoin="round"
    />
    <path d="M 16 63 L 94 63" stroke="#fcd34d" strokeWidth="2" opacity="0.82" />
    <path d="M 24 73 Q 55 78 86 73" stroke="#78350f" strokeWidth="1.5" fill="none" opacity="0.65" />
  </svg>
);

export interface BoatWakeEffectProps {
  isRight?: boolean;
  lane?: 'far' | 'near';
}

export const BoatWakeEffect = ({ isRight = false, lane = 'near' }: BoatWakeEffectProps) => (
  <svg
    data-testid="boat-wake-effect"
    viewBox="0 0 140 34"
    className={`w-28 sm:w-32 h-8 pointer-events-none overflow-visible ${
      lane === 'far' ? 'opacity-65' : 'opacity-90'
    } ${isRight ? 'scale-x-[-1]' : ''}`}
  >
    {/* Waterline hull contact ripple */}
    <ellipse cx="60" cy="17" rx="34" ry="6.5" fill="#0284c7" fillOpacity="0.28" stroke="#e0f2fe" strokeWidth="1.2" strokeOpacity="0.6" />
    {/* Trailing animated V-wake foam behind stern */}
    <g className="animate-boat-wake" style={{ transformOrigin: '60px 17px' }}>
      <path
        d="M 88 15 Q 112 9 136 5"
        fill="none"
        stroke="#e0f2fe"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeDasharray="10 5"
      />
      <path
        d="M 88 19 Q 114 25 138 29"
        fill="none"
        stroke="#bae6fd"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeDasharray="8 6"
      />
      <path
        d="M 90 17 L 130 17"
        fill="none"
        stroke="#ffffff"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeDasharray="6 6"
        opacity="0.75"
      />
    </g>
  </svg>
);

export const RaftCampSVG = () => (
  <div data-testid="player-raft-camp" className="relative flex flex-col items-center justify-center">
    {/* Stationary waterline contact ring under raft */}
    <svg
      viewBox="0 0 140 34"
      className="w-28 sm:w-32 h-7 absolute -bottom-1 left-1/2 -translate-x-1/2 -z-10 pointer-events-none overflow-visible opacity-85"
    >
      <ellipse
        cx="70"
        cy="19"
        rx="60"
        ry="10"
        fill="#0369a1"
        fillOpacity="0.24"
        stroke="#e0f2fe"
        strokeWidth="1.5"
        strokeDasharray="9 5"
        className="animate-boat-wake"
        style={{ transformOrigin: '70px 19px' }}
      />
    </svg>

    {/* Gently bobbing Log Raft with Cozy Tent pitched on right deck (Hero stands cleanly on left deck) */}
    <svg viewBox="0 0 140 96" className="w-28 h-20 sm:w-32 sm:h-24 drop-shadow-xl animate-bob overflow-visible">
      {/* Waterline underside shadow */}
      <ellipse cx="70" cy="81" rx="56" ry="8" fill="#0c4a6e" opacity="0.45" />

      {/* Skewed Isometric Log Base */}
      <g>
        <rect x="12" y="68" width="114" height="10" rx="5" fill="#78350f" stroke="#451a03" strokeWidth="1.8" />
        <rect x="16" y="61" width="110" height="10" rx="5" fill="#92400e" stroke="#451a03" strokeWidth="1.8" />
        <rect x="20" y="54" width="106" height="9.5" rx="4.5" fill="#b45309" stroke="#451a03" strokeWidth="1.8" />
        {/* Log end rings */}
        <circle cx="17" cy="73" r="4" fill="#d97706" stroke="#451a03" strokeWidth="1.2" />
        <circle cx="21" cy="66" r="4" fill="#f59e0b" stroke="#451a03" strokeWidth="1.2" />
        <circle cx="25" cy="59" r="3.6" fill="#fbbf24" stroke="#451a03" strokeWidth="1.2" />
        {/* Rope lashings holding logs together */}
        <rect x="34" y="53" width="4.5" height="26" rx="2" fill="#fcd34d" stroke="#78350f" strokeWidth="1.1" />
        <rect x="102" y="53" width="4.5" height="26" rx="2" fill="#fcd34d" stroke="#78350f" strokeWidth="1.1" />
      </g>

      {/* Wooden Oar resting on the front-left deck */}
      <line x1="22" y1="73" x2="62" y2="69" stroke="#d97706" strokeWidth="2.8" strokeLinecap="round" />
      <ellipse cx="66" cy="69" rx="7" ry="3" fill="#b45309" stroke="#451a03" strokeWidth="1.2" />

      {/* Cozy A-Frame Tent pitched on the right half of the Raft */}
      {/* Right side canvas wall */}
      <polygon points="82,16 122,53 108,58 72,58" fill="#f59e0b" stroke="#78350f" strokeWidth="1.8" strokeLinejoin="round" />
      {/* Roof awning stripe highlight */}
      <polygon points="82,16 101,53 88,56 78,22" fill="#fef3c7" opacity="0.82" />
      {/* Front A-frame gable */}
      <polygon points="82,16 66,57 98,57" fill="#fef3c7" stroke="#78350f" strokeWidth="2" strokeLinejoin="round" />
      {/* Terracotta ridge trim */}
      <line x1="82" y1="16" x2="122" y2="53" stroke="#9a3412" strokeWidth="2.4" strokeLinecap="round" />
      {/* Dark interior & warm lantern glow */}
      <polygon points="82,28 73,57 91,57" fill="#451a03" />
      <circle cx="82" cy="48" r="5" fill="#fde047" opacity="0.92" />
      <circle cx="82" cy="48" r="9" fill="#fef08a" opacity="0.35" />
      {/* Small triangular flag on tent peak */}
      <line x1="82" y1="8" x2="82" y2="17" stroke="#78350f" strokeWidth="2" strokeLinecap="round" />
      <polygon points="82,8 93,11.5 82,15" fill="#ef4444" />
    </svg>
  </div>
);

export const CampIcon = () => (
  <div className="-translate-y-4">
    <RaftCampSVG />
  </div>
);
