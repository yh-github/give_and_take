import React from 'react';

export const UnderwaterBackground = () => (
  <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden bg-[#050814]">
    {/* === 1. Above Water: Sunny Sky & Horizon (y: 0% - 13.6%) === */}
    <div className="absolute top-0 left-0 w-full h-[13.6%] bg-gradient-to-b from-sky-400 via-sky-200 to-cyan-100 z-10">
      <svg className="w-full h-full" viewBox="0 0 200 80" preserveAspectRatio="xMidYMid slice">
        <defs>
          <radialGradient id="skySun" cx="82%" cy="28%" r="25%">
            <stop offset="0%" stopColor="#fef08a" stopOpacity="0.95" />
            <stop offset="45%" stopColor="#fde047" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#fde047" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="164" cy="22" r="32" fill="url(#skySun)" />
        <circle cx="164" cy="22" r="9" fill="#fef9c3" />
        <g fill="#ffffff" opacity="0.82">
          <path d="M 18 34 Q 22 24 32 26 Q 38 18 48 24 Q 56 24 58 32 Q 62 38 54 40 L 18 40 Q 12 38 18 34 Z" />
          <path d="M 105 26 Q 110 18 119 20 Q 125 14 134 19 Q 142 20 140 28 L 104 28 Z" opacity="0.7" />
        </g>
        <path d="M 8 76 Q 24 65 44 76 Z" fill="#0e7490" opacity="0.35" />
        <path d="M 152 76 Q 170 67 192 76 Z" fill="#0e7490" opacity="0.3" />
      </svg>
    </div>

    {/* === 2. 2D Cross-Section Waterline & Animated Surface Waves (y: 12.2% - 15.0%) === */}
    <div className="absolute top-[12.2%] left-0 w-full h-[2.8%] z-20 overflow-hidden pointer-events-none">
      <svg
        className="absolute inset-0 w-[200%] h-full animate-surface-wave-slow"
        viewBox="0 0 400 32"
        preserveAspectRatio="none"
      >
        <path
          d="M 0 13 Q 25 4 50 13 T 100 13 T 150 13 T 200 13 T 250 13 T 300 13 T 350 13 T 400 13 L 400 32 L 0 32 Z"
          fill="#0284c7"
          opacity="0.78"
        />
      </svg>
      <svg
        className="absolute inset-0 w-[200%] h-full animate-surface-wave-fast"
        viewBox="0 0 400 32"
        preserveAspectRatio="none"
      >
        <path
          d="M 0 16 Q 25 8 50 16 T 100 16 T 150 16 T 200 16 T 250 16 T 300 16 T 350 16 T 400 16 L 400 32 L 0 32 Z"
          fill="#06b6d4"
          opacity="0.94"
        />
        <path
          d="M 0 16 Q 25 8 50 16 T 100 16 T 150 16 T 200 16 T 250 16 T 300 16 T 350 16 T 400 16"
          fill="none"
          stroke="#e0f2fe"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
      </svg>
    </div>

    {/* === 3. Multi-Zone Ocean Depth Gradient (y: 13.5% - 100%) === */}
    <div
      className="absolute top-[13.5%] left-0 w-full h-[86.5%] z-0"
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
  returnRelicEmoji?: string | null;
  emoji?: string | null;
}

export const SeaWitchGrottoSVG = ({
  isTransformed,
  hasDeepTreasure,
  returnRelicEmoji = '🔮',
  emoji = '😈'
}: SeaWitchGrottoSVGProps) => {
  const badgeContent = !isTransformed
    ? '3×🎵 ➔ 🧜‍♂️'
    : hasDeepTreasure
      ? `${returnRelicEmoji || '🔮'} ➔ 🤠`
      : '👑 ⬇️';

  const badgeStyle = !isTransformed
    ? 'bg-purple-950/90 border-purple-400 text-purple-100 shadow-[0_0_12px_rgba(168,85,247,0.8)]'
    : hasDeepTreasure
      ? 'bg-emerald-950/95 border-amber-300 text-amber-200 shadow-[0_0_16px_rgba(52,211,153,0.95)] animate-bounce'
      : 'bg-indigo-950/90 border-cyan-400/70 text-cyan-100 shadow-[0_0_10px_rgba(34,211,238,0.5)]';

  return (
    <div className="relative flex flex-col items-center justify-center">
      {/* Glowing Grotto Alcove & Spell Cauldron (No Barrier!) */}
      <svg
        viewBox="0 0 140 110"
        className="absolute -top-6 left-1/2 -translate-x-1/2 w-[36cqw] h-[28cqw] pointer-events-none -z-10 overflow-visible"
      >
        <defs>
          <radialGradient id="witchGrottoGlow" cx="50%" cy="55%" r="50%">
            <stop offset="0%" stopColor={hasDeepTreasure ? '#10b981' : '#9333ea'} stopOpacity="0.65" />
            <stop offset="65%" stopColor={hasDeepTreasure ? '#059669' : '#581c87'} stopOpacity="0.3" />
            <stop offset="100%" stopColor="#0f172a" stopOpacity="0" />
          </radialGradient>
        </defs>

        <circle cx="70" cy="58" r="56" fill="url(#witchGrottoGlow)" />

        {/* Dark Rocky Grotto Frame behind the Witch */}
        <path
          d="M 22 92 Q 18 46 42 26 Q 70 12 98 26 Q 122 46 118 92 Z"
          fill="#1e1b4b"
          opacity="0.72"
          stroke="#6b21a8"
          strokeWidth="2"
        />

        {/* Swirling Purple Spell Cauldron */}
        <ellipse cx="70" cy="84" rx="22" ry="7" fill="#0f172a" stroke="#a855f7" strokeWidth="1.6" />
        <ellipse cx="70" cy="83" rx="15" ry="4" fill={hasDeepTreasure ? '#34d399' : '#c084fc'} opacity="0.75" />
      </svg>

      <span className="text-[11cqw] z-10 drop-shadow-[0_4px_12px_rgba(147,51,234,0.9)]">{emoji}</span>

      <div
        className={`mt-1 rounded-full px-2.5 py-0.5 whitespace-nowrap text-[2.8cqw] font-black border-2 z-20 transition-all ${badgeStyle}`}
      >
        {badgeContent}
      </div>
    </div>
  );
};

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

            {/* Seal Socket Medallions */}
            {Array.from({ length: socketCount }).map((_, idx) => {
              const cx = cxStart + idx * 26;
              const cy = 78;
              const emoji = reqEmojis[idx];
              return (
                <g key={`seal-${idx}`}>
                  <circle
                    cx={cx}
                    cy={cy}
                    r="11.5"
                    fill="#0f172a"
                    stroke={isMurkyFar ? '#38bdf8' : '#fde047'}
                    strokeWidth="2"
                  />
                  <text
                    x={cx}
                    y={cy + 4.5}
                    textAnchor="middle"
                    fontSize="13"
                    fill={isMurkyFar ? '#7dd3fc' : '#ffffff'}
                  >
                    {isMurkyFar || !emoji ? '❓' : emoji}
                  </text>
                </g>
              );
            })}
          </>
        )}
      </svg>
    </div>
  );
};

export interface InteractiveKelpSVGProps {
  variant?: 'harvest' | 'habitat';
  fishEmoji?: string;
  isRustling?: boolean;
}

export const InteractiveKelpSVG = ({
  variant = 'habitat',
  fishEmoji = '🐟',
  isRustling = false
}: InteractiveKelpSVGProps) => {
  const isHarvest = variant === 'harvest';
  return (
    <div
      className={`relative flex flex-col items-center justify-center ${
        isRustling ? 'animate-kelp-rustle' : ''
      }`}
    >
      <svg
        viewBox="0 0 80 96"
        className={`${isHarvest ? 'w-14 h-16' : 'w-16 h-20'} overflow-visible drop-shadow-[0_4px_10px_rgba(0,0,0,0.6)]`}
      >
        <defs>
          <radialGradient id={isHarvest ? 'kelpHarvestGlow' : 'kelpHabGlow'} cx="50%" cy="65%" r="48%">
            <stop offset="0%" stopColor={isHarvest ? '#4ade80' : '#2dd4bf'} stopOpacity="0.55" />
            <stop offset="100%" stopColor="#0f172a" stopOpacity="0" />
          </radialGradient>
        </defs>

        <circle cx="40" cy="60" r="34" fill={`url(#${isHarvest ? 'kelpHarvestGlow' : 'kelpHabGlow'})`} />

        <g className="animate-kelp-sway">
          <path
            d="M 32 88 Q 20 64 28 42 Q 36 22 24 8 Q 34 20 38 40 Q 32 62 36 88 Z"
            fill={isHarvest ? '#22c55e' : '#10b981'}
            stroke="#a7f3d0"
            strokeWidth="1.2"
          />
          <path
            d="M 44 88 Q 56 64 48 40 Q 40 22 52 10 Q 46 28 54 48 Q 50 68 48 88 Z"
            fill={isHarvest ? '#16a34a' : '#059669'}
            stroke="#6ee7b7"
            strokeWidth="1.2"
          />
          <path
            d="M 38 88 Q 34 60 40 34 Q 44 18 40 6 Q 48 22 44 46 Q 42 68 42 88 Z"
            fill="#34d399"
            opacity="0.85"
          />
        </g>

        {/* Seabed anchor pebbles */}
        <ellipse cx="40" cy="88" rx="18" ry="5" fill="#1e293b" stroke="#0f172a" strokeWidth="1.2" />
      </svg>

      {variant === 'habitat' ? (
        <div className=" -mt-6 bg-sky-950/85 border border-emerald-400/70 rounded-full px-1.5 py-0.5 text-sm shadow-md flex items-center gap-0.5">
          <span>{fishEmoji}</span>
        </div>
      ) : (
        <div className="-mt-5 bg-emerald-950/90 border border-emerald-300 rounded-full px-1.5 py-0.5 text-base shadow-[0_0_8px_rgba(52,211,153,0.7)]">
          🌿
        </div>
      )}
    </div>
  );
};

export interface GiantClamSVGProps {
  isDefeated?: boolean;
  isBuried?: boolean;
  isDigger?: boolean;
  isGoal?: boolean;
  isAlerting?: boolean;
  rewardEmoji?: string | null;
  isMurkyFar?: boolean;
}

export const GiantClamSVG = ({
  isDefeated = false,
  isBuried = false,
  isDigger = false,
  isGoal = false,
  isAlerting = false,
  rewardEmoji,
  isMurkyFar = false,
}: GiantClamSVGProps) => {
  const isOpen = !isBuried;
  const topShellFill = isGoal ? '#f59e0b' : isDigger ? '#9333ea' : '#e11d48';
  const botShellFill = isGoal ? '#d97706' : isDigger ? '#7e22ce' : '#be123c';
  const strokeColor = isGoal ? '#fef08a' : isDigger ? '#d8b4fe' : '#fda4af';
  const innerFill = isGoal ? '#fef3c7' : isDigger ? '#f3e8ff' : '#ffe4e6';

  return (
    <svg
      viewBox="0 0 110 105"
      className={`w-16 h-16 sm:w-20 sm:h-20 drop-shadow-[0_6px_10px_rgba(0,0,0,0.7)] overflow-visible ${
        isAlerting ? 'animate-troll-mad' : ''
      }`}
    >
      <ellipse cx="55" cy="90" rx="44" ry="10" fill="#090d16" opacity="0.55" />
      <path d="M 14 88 Q 55 78 96 88 Q 78 96 55 96 Q 32 96 14 88 Z" fill="#78350f" opacity="0.75" />

      {isOpen ? (
        <>
          <path
            d="M 16 68 C 12 36 28 14 38 18 C 44 10 55 8 55 8 C 55 8 66 10 72 18 C 82 14 98 36 94 68 Z"
            fill={topShellFill}
            stroke={strokeColor}
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
          <ellipse cx="55" cy="64" rx="34" ry="15" fill={innerFill} stroke={strokeColor} strokeWidth="1.5" />
          {[32, 43, 55, 67, 78].map((x, idx) => (
            <line
              key={idx}
              x1={x}
              y1={16 + Math.abs(idx - 2) * 3}
              x2={55 + (x - 55) * 0.65}
              y2="56"
              stroke={strokeColor}
              strokeWidth="1.4"
              opacity="0.55"
              strokeLinecap="round"
            />
          ))}

          {!isDefeated && rewardEmoji && (
            <g>
              {isMurkyFar && !isGoal ? (
                <>
                  <circle
                    cx="55"
                    cy="52"
                    r="16"
                    fill="#0f172a"
                    fillOpacity="0.88"
                    stroke="#38bdf8"
                    strokeWidth="2.2"
                  />
                  <text x="55" y="59" textAnchor="middle" fontSize="20" fill="#7dd3fc" fontWeight="bold">
                    ❓
                  </text>
                </>
              ) : (
                <>
                  <circle
                    cx="55"
                    cy="54"
                    r="16"
                    fill={isGoal ? '#fde047' : '#ffffff'}
                    opacity="0.5"
                  />
                  <text x="55" y="62" textAnchor="middle" fontSize="28" className="drop-shadow-md">
                    {rewardEmoji}
                  </text>
                </>
              )}
            </g>
          )}
        </>
      ) : (
        <>
          <path
            d="M 14 70 C 16 42 32 34 55 34 C 78 34 94 42 96 70 Z"
            fill={topShellFill}
            stroke={strokeColor}
            strokeWidth="2.5"
          />
          {[30, 42, 55, 68, 80].map((x, idx) => (
            <path
              key={idx}
              d={`M ${x} 38 Q 55 52 ${x} 68`}
              stroke={strokeColor}
              strokeWidth="1.5"
              fill="none"
              opacity="0.6"
            />
          ))}
          <path
            d="M 16 70 L 26 66 L 36 71 L 46 66 L 55 71 L 64 66 L 74 71 L 84 66 L 94 70"
            fill="none"
            stroke="#fef08a"
            strokeWidth="2.2"
            strokeLinejoin="round"
          />
        </>
      )}

      <path
        d="M 14 68 C 18 86 35 92 55 92 C 75 92 92 86 96 68 Q 75 76 55 76 Q 35 76 14 68 Z"
        fill={botShellFill}
        stroke={strokeColor}
        strokeWidth="2.5"
      />
    </svg>
  );
};

export const BoatSVG = () => (
  <svg viewBox="0 0 110 100" className="w-20 h-20 sm:w-24 sm:h-24 drop-shadow-xl animate-bob overflow-visible">
    <rect x="51" y="12" width="4" height="50" fill="#78350f" rx="1.5" />
    <polygon points="55,12 70,16 55,21" fill="#ef4444" />
    <path d="M 56 18 Q 88 34 86 56 L 56 56 Z" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1.5" />
    <path d="M 49 22 Q 24 38 26 56 L 49 56 Z" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1.5" />
    <path
      d="M 12 60 L 98 60 L 84 82 Q 55 86 26 82 Z"
      fill="#92400e"
      stroke="#451a03"
      strokeWidth="2.5"
      strokeLinejoin="round"
    />
    <path d="M 16 65 L 94 65" stroke="#fcd34d" strokeWidth="2" opacity="0.8" />
    <path
      d="M 8 78 Q 22 73 36 78 T 64 78 T 92 78 T 104 78"
      fill="none"
      stroke="#e0f2fe"
      strokeWidth="3"
      strokeLinecap="round"
      opacity="0.9"
    />
  </svg>
);

export const InkCloudSVG = () => (
  <svg viewBox="0 0 100 100" className="w-20 h-20 sm:w-24 sm:h-24 animate-pulse drop-shadow-[0_0_14px_rgba(15,23,42,0.95)]">
    <circle cx="50" cy="52" r="28" fill="#0f172a" opacity="0.92" />
    <circle cx="32" cy="48" r="20" fill="#1e1b4b" opacity="0.9" />
    <circle cx="68" cy="46" r="22" fill="#1e1b4b" opacity="0.9" />
    <circle cx="44" cy="34" r="18" fill="#311042" opacity="0.85" />
    <circle cx="60" cy="66" r="18" fill="#090d16" opacity="0.9" />
    <text x="50" y="58" textAnchor="middle" fontSize="22">
      🦑
    </text>
  </svg>
);

export const CampIcon = () => (
  <div className="-translate-y-1">
    <BoatSVG />
  </div>
);
