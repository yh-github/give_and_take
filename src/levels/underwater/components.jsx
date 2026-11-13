import React from 'react';

export const UnderwaterBackground = () => (
  <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden bg-[#050814]">
    {/* === 1. Above Water: Sunny Sky & Horizon (y: 0% - 13.6%) === */}
    <div className="absolute top-0 left-0 w-full h-[13.6%] bg-gradient-to-b from-sky-400 via-sky-200 to-cyan-100 z-10">
      {/* Sun & Soft Clouds */}
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
        {/* Clouds */}
        <g fill="#ffffff" opacity="0.82">
          <path d="M 18 34 Q 22 24 32 26 Q 38 18 48 24 Q 56 24 58 32 Q 62 38 54 40 L 18 40 Q 12 38 18 34 Z" />
          <path d="M 105 26 Q 110 18 119 20 Q 125 14 134 19 Q 142 20 140 28 L 104 28 Z" opacity="0.7" />
        </g>
        {/* Distant Horizon Island Silhouette */}
        <path d="M 8 76 Q 24 65 44 76 Z" fill="#0e7490" opacity="0.35" />
        <path d="M 152 76 Q 170 67 192 76 Z" fill="#0e7490" opacity="0.3" />
      </svg>
    </div>

    {/* === 2. 2D Cross-Section Waterline & Animated Surface Waves (y: 12.2% - 15.0%) === */}
    <div className="absolute top-[12.2%] left-0 w-full h-[2.8%] z-20 overflow-hidden pointer-events-none">
      {/* Back Swell */}
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
      {/* Front Wave Crest & White Seafoam Line */}
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
          'linear-gradient(180deg, #06b6d4 0%, #0284c7 18%, #0369a1 34%, #1d4ed8 50%, #1e3a8a 64%, #172554 78%, #0b132b 90%, #050814 100%)',
      }}
    >
      {/* Sunlit Caustic Beams in Zone 1 (fade naturally by Twilight Zone 2) */}
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

      {/* Sculpted Reef Walls & Abyssal Trench Canyon (viewBox 100x300 matches 3.5-screen aspect ratio!) */}
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

        {/* Zone 2 Twilight Reef Ledges & Sea Witch Canyon Narrows (y: 90 - 205 in 0..300 space) */}
        <path
          d="M 0 95 Q 15 104 18 118 Q 14 132 19 148 Q 12 162 24 180 Q 30 190 22 205 L 0 212 Z"
          fill="url(#twilightWallGrad)"
          opacity="0.8"
        />
        <path
          d="M 100 98 Q 85 108 82 122 Q 86 136 80 152 Q 88 166 76 180 Q 70 190 78 205 L 100 212 Z"
          fill="url(#twilightWallGrad)"
          opacity="0.8"
        />

        {/* Zone 3 Abyssal Trench Cliffs (y: 195 - 300 in 0..300 space) */}
        <path
          d="M 0 195 L 24 198 Q 16 218 14 240 Q 18 262 12 285 L 0 300 Z"
          fill="url(#abyssWallGrad)"
          opacity="0.92"
        />
        <path
          d="M 100 195 L 76 198 Q 84 218 86 240 Q 82 262 88 285 L 100 300 Z"
          fill="url(#abyssWallGrad)"
          opacity="0.92"
        />
      </svg>

      {/* True-Circle Rising Ambient Bubbles (HTML nodes so they never stretch vertically) */}
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

    {/* === 4. Abyssal Seabed Dunes & Sunken Pirate Galleon SVG (y: 85% - 100%) === */}
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

      {/* Distant Abyssal Ridge */}
      <path
        d="M -10 42 Q 35 24 85 38 Q 135 50 175 28 Q 192 22 210 34 L 210 100 L -10 100 Z"
        fill="url(#deepSandBack)"
        opacity="0.9"
      />

      {/* Sunken Wooden Pirate Galleon Shipwreck resting on the left abyssal ridge */}
      <g transform="translate(8, 22) rotate(-9)">
        {/* Broken Mast & Yardarm */}
        <rect x="24" y="-6" width="2.2" height="28" fill="#451a03" rx="1" />
        <line x1="14" y1="3" x2="36" y2="0.5" stroke="#451a03" strokeWidth="1.6" strokeLinecap="round" />
        {/* Tattered Sail */}
        <path
          d="M 16 3 L 34 1 L 31 12 L 26 9 L 22 13 L 17 10 Z"
          fill="#475569"
          opacity="0.55"
        />
        {/* Galleon Hull & Stern Castle */}
        <path
          d="M 2 20 L 44 20 L 50 11 L 39 11 L 37 16 L 10 16 L 6 12 L 0 13 Z"
          fill="#451a03"
          stroke="#78350f"
          strokeWidth="0.9"
        />
        <path d="M 6 20 L 41 20 L 37 28 L 10 28 Z" fill="#271004" />
        {/* Hull Planks & Cannon Portholes */}
        <line x1="8" y1="22.5" x2="39" y2="22.5" stroke="#92400e" strokeWidth="0.8" opacity="0.65" />
        <circle cx="15" cy="21.2" r="1.2" fill="#0f172a" />
        <circle cx="23" cy="21.2" r="1.2" fill="#0f172a" />
        <circle cx="31" cy="21.2" r="1.2" fill="#0f172a" />
      </g>

      {/* Mid-ground Deep-Sea Silt Dunes */}
      <path
        d="M -10 54 Q 30 38 72 48 Q 115 58 154 40 Q 182 30 210 44 L 210 100 L -10 100 Z"
        fill="url(#deepSandMid)"
      />

      {/* Foreground Trench Seabed Floor */}
      <path
        d="M -10 66 Q 38 54 84 62 Q 132 70 172 56 Q 194 50 210 58 L 210 100 L -10 100 Z"
        fill="url(#deepSandFront)"
      />

      {/* Bioluminescent & Deep-Silt Contour Ripples */}
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

export const SeaWitchGateSVG = ({ isTransformed, hasDeepTreasure, emoji }) => {
  const badgeContent = !isTransformed
    ? '🤿 ➔ 🧜‍♂️'
    : hasDeepTreasure
      ? '🧜‍♂️ ➔ 🤠'
      : '👑 ⬇️';

  const badgeStyle = !isTransformed
    ? 'bg-purple-950/90 border-purple-400 text-purple-100 shadow-[0_0_12px_rgba(168,85,247,0.8)]'
    : hasDeepTreasure
      ? 'bg-emerald-950/95 border-amber-300 text-amber-200 shadow-[0_0_16px_rgba(52,211,153,0.95)] animate-bounce'
      : 'bg-indigo-950/90 border-cyan-400/70 text-cyan-100 shadow-[0_0_10px_rgba(34,211,238,0.5)]';

  return (
    <div className="relative flex flex-col items-center justify-center">
      {/* Trench Gate Archway & Swirling Magic Barrier */}
      <svg
        viewBox="0 0 220 110"
        className="absolute -top-8 left-1/2 -translate-x-1/2 w-[56cqw] h-[26cqw] pointer-events-none -z-10 overflow-visible"
      >
        <defs>
          <radialGradient id="witchPortalGlow" cx="50%" cy="55%" r="48%">
            <stop offset="0%" stopColor={hasDeepTreasure ? '#10b981' : '#9333ea'} stopOpacity="0.65" />
            <stop offset="65%" stopColor={hasDeepTreasure ? '#059669' : '#581c87'} stopOpacity="0.3" />
            <stop offset="100%" stopColor="#0f172a" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="barrierWave" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#a855f7" stopOpacity="0" />
            <stop offset="25%" stopColor="#c084fc" stopOpacity={isTransformed ? '0.25' : '0.75'} />
            <stop offset="50%" stopColor="#f0abfc" stopOpacity={isTransformed ? '0.35' : '0.9'} />
            <stop offset="75%" stopColor="#c084fc" stopOpacity={isTransformed ? '0.25' : '0.75'} />
            <stop offset="100%" stopColor="#a855f7" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Portal Aura */}
        <ellipse cx="110" cy="60" rx="75" ry="40" fill="url(#witchPortalGlow)" />

        {/* Left & Right Craggy Trench Gate Pillars */}
        <path
          d="M 10 95 L 22 30 L 38 18 L 52 28 L 44 95 Z"
          fill="#1e1b4b"
          stroke="#4c1d95"
          strokeWidth="2"
        />
        <path
          d="M 210 95 L 198 30 L 182 18 L 168 28 L 176 95 Z"
          fill="#1e1b4b"
          stroke="#4c1d95"
          strokeWidth="2"
        />

        {/* Horizontal Magic Trench Barrier Stream (strong when human, calm when merperson) */}
        <path
          d="M 15 64 Q 62 52 110 64 T 205 64"
          fill="none"
          stroke="url(#barrierWave)"
          strokeWidth={isTransformed ? '2.5' : '5'}
          strokeDasharray={isTransformed ? '6 8' : 'none'}
        />
        {!isTransformed && (
          <path
            d="M 25 72 Q 68 82 110 72 T 195 72"
            fill="none"
            stroke="url(#barrierWave)"
            strokeWidth="3"
          />
        )}
      </svg>

      {/* Sea Witch Character */}
      <span className="text-[11cqw] z-10 drop-shadow-[0_4px_12px_rgba(147,51,234,0.9)]">{emoji}</span>

      {/* Dynamic Zero-Text Visual Transformation Pill */}
      <div
        className={`mt-1 rounded-full px-2.5 py-0.5 whitespace-nowrap text-[3cqw] font-black border-2 z-20 transition-all ${badgeStyle}`}
      >
        {badgeContent}
      </div>
    </div>
  );
};

export const GiantClamSVG = ({
  isDefeated,
  isBuried,
  isDigger,
  isGoal,
  isAlerting,
  rewardEmoji,
  isMurkyFar,
}) => {
  const isOpen = !isBuried;
  // Color palette based on clam role: Royal Gold (Goal) | Violet Barnacle (Memory Digger) | Rose Coral (Standard)
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
      {/* Seabed Sand Mound Shadow */}
      <ellipse cx="55" cy="90" rx="44" ry="10" fill="#090d16" opacity="0.55" />
      <path d="M 14 88 Q 55 78 96 88 Q 78 96 55 96 Q 32 96 14 88 Z" fill="#78350f" opacity="0.75" />

      {isOpen ? (
        <>
          {/* Upper Scalloped Shell (Open) */}
          <path
            d="M 16 68 C 12 36 28 14 38 18 C 44 10 55 8 55 8 C 55 8 66 10 72 18 C 82 14 98 36 94 68 Z"
            fill={topShellFill}
            stroke={strokeColor}
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
          {/* Inner Pearlescent Cavity */}
          <ellipse cx="55" cy="64" rx="34" ry="15" fill={innerFill} stroke={strokeColor} strokeWidth="1.5" />
          {/* Shell Fluted Ribs */}
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

          {/* Reward Item or Murky Silhouette Inside */}
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
        /* Closed / Snapped-Shut Memory Clam State */
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
          {/* Interlocking Zigzag Clam Teeth Seam */}
          <path
            d="M 16 70 L 26 66 L 36 71 L 46 66 L 55 71 L 64 66 L 74 71 L 84 66 L 94 70"
            fill="none"
            stroke="#fef08a"
            strokeWidth="2.2"
            strokeLinejoin="round"
          />
        </>
      )}

      {/* Lower Scalloped Shell Rim */}
      <path
        d="M 14 68 C 18 86 35 92 55 92 C 75 92 92 86 96 68 Q 75 76 55 76 Q 35 76 14 68 Z"
        fill={botShellFill}
        stroke={strokeColor}
        strokeWidth="2.5"
      />
    </svg>
  );
};

export const BubbleVentSVG = () => (
  <div className="relative flex flex-col items-center justify-center group">
    {/* Rising Column of Unmistakable Air Bubbles */}
    <svg viewBox="0 0 100 120" className="w-16 h-20 sm:w-20 sm:h-24 overflow-visible drop-shadow-[0_4px_8px_rgba(0,0,0,0.6)]">
      <defs>
        <radialGradient id="ventGlow" cx="50%" cy="75%" r="45%">
          <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.65" />
          <stop offset="100%" stopColor="#0284c7" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Cyan Oxygen Aura */}
      <ellipse cx="50" cy="88" rx="38" ry="18" fill="url(#ventGlow)" />

      {/* Rising SVG Bubbles */}
      {[
        { cx: 44, cy: 66, r: 5.5, delay: '0s' },
        { cx: 56, cy: 48, r: 7, delay: '0.4s' },
        { cx: 46, cy: 28, r: 8.5, delay: '0.8s' },
        { cx: 54, cy: 10, r: 6, delay: '1.2s' },
      ].map((b, idx) => (
        <g key={idx} className="animate-vent-stream" style={{ animationDelay: b.delay }}>
          <circle
            cx={b.cx}
            cy={b.cy}
            r={b.r}
            fill="rgba(224, 242, 254, 0.35)"
            stroke="#bae6fd"
            strokeWidth="1.8"
          />
          <circle cx={b.cx - b.r * 0.3} cy={b.cy - b.r * 0.3} r={b.r * 0.25} fill="#ffffff" />
        </g>
      ))}

      {/* Hydrothermal Reef Chimney Mound */}
      <path
        d="M 18 104 L 30 74 Q 40 68 50 70 Q 60 68 70 74 L 82 104 Z"
        fill="#1e293b"
        stroke="#38bdf8"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* Glowing Vent Crater Opening */}
      <ellipse cx="50" cy="73" rx="16" ry="5.5" fill="#0284c7" stroke="#bae6fd" strokeWidth="2" />
      <ellipse cx="50" cy="73" rx="9" ry="3" fill="#e0f2fe" />
    </svg>
    <div className=" -mt-3 bg-cyan-950/90 border border-cyan-300 text-cyan-100 rounded-full px-2 py-0.5 text-[2.4cqw] font-black shadow-[0_0_8px_rgba(34,211,238,0.6)] pointer-events-none">
      +🫧
    </div>
  </div>
);

export const BoatSVG = () => (
  <svg viewBox="0 0 110 100" className="w-20 h-20 sm:w-24 sm:h-24 drop-shadow-xl animate-bob overflow-visible">
    {/* Mast & Pennant */}
    <rect x="51" y="12" width="4" height="50" fill="#78350f" rx="1.5" />
    <polygon points="55,12 70,16 55,21" fill="#ef4444" />
    {/* Main Sail & Front Jib Sail */}
    <path d="M 56 18 Q 88 34 86 56 L 56 56 Z" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1.5" />
    <path d="M 49 22 Q 24 38 26 56 L 49 56 Z" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1.5" />
    {/* Wooden Boat Hull */}
    <path
      d="M 12 60 L 98 60 L 84 82 Q 55 86 26 82 Z"
      fill="#92400e"
      stroke="#451a03"
      strokeWidth="2.5"
      strokeLinejoin="round"
    />
    <path d="M 16 65 L 94 65" stroke="#fcd34d" strokeWidth="2" opacity="0.8" />
    {/* Waterline Foam Ripple Around Hull */}
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
