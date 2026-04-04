import React from 'react';

export const UnderwaterBackground = () => (
  <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
    {/* Sky section */}
    <div className="absolute top-0 left-0 w-full h-[12%] bg-gradient-to-b from-sky-400 via-sky-200 to-sky-100 z-0" />
    
    {/* === Isometric Water Surface === */}
    <div className="absolute top-[12%] left-0 w-full h-[8%] z-10 overflow-visible animate-tide-surface">
      {/* Base water fill underneath */}
      <div className="absolute inset-0 bg-cyan-500" />
      {/* Isometric top-face of water — a wide diamond/parallelogram stretching off-screen */}
      <svg className="absolute w-full overflow-visible" style={{ top: '-60%', height: '200%' }} viewBox="0 0 100 60" preserveAspectRatio="none">
        <defs>
          <linearGradient id="waterTopGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#7dd3fc" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.7" />
          </linearGradient>
          {/* Animated ripple pattern */}
          <pattern id="ripple" x="0" y="0" width="20" height="6" patternUnits="userSpaceOnUse">
            <ellipse cx="10" cy="3" rx="8" ry="1.2" fill="none" stroke="#bae6fd" strokeWidth="0.4" opacity="0.5"/>
          </pattern>
        </defs>
        {/* The isometric top face — parallelogram with perspective tilt */}
        <path d="M -10 45 L 50 25 L 110 45 L 50 65 Z" fill="url(#waterTopGrad)" />
        {/* Ripples on the top face */}
        <path d="M -10 45 L 50 25 L 110 45 L 50 65 Z" fill="url(#ripple)" opacity="0.6" />
        {/* Foam/highlight at top edge */}
        <path d="M -10 45 L 50 25 L 110 45" fill="none" stroke="#e0f2fe" strokeWidth="0.8" opacity="0.8" />
        {/* Animated wave glints */}
        {[10, 28, 46, 64, 82].map((x, i) => (
          <ellipse key={i} cx={x} cy={35 + (i % 2) * 4} rx="4" ry="0.6"
            fill="none" stroke="#bae6fd" strokeWidth="0.5" opacity="0.6"
            style={{ animation: `waveGlint ${2 + i * 0.4}s ease-in-out infinite`, animationDelay: `${i * 0.3}s` }}
          />
        ))}
      </svg>
      {/* Layered animated waves flowing across the water face */}
      {[...Array(3)].map((_, i) => (
        <svg key={`wave-${i}`} className="absolute w-[300%] h-full -translate-x-1/3 animate-river-flow" style={{ animationDuration: `${8 + i * 4}s`, opacity: 0.25 - i * 0.05, top: `${i * 20}%` }} preserveAspectRatio="none" viewBox="0 0 1000 100">
          <path d="M 0 50 Q 250 30 500 50 T 1000 50 L 1000 100 L 0 100 Z" fill="#38bdf8" />
        </svg>
      ))}
    </div>

    {/* Deep Sea Gradient */}
    <div className="absolute top-[20%] left-0 w-full h-[80%] bg-gradient-to-b from-cyan-500 via-blue-700 to-blue-950 z-0">
      <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.2) 0%, transparent 50%)' }} />
      {/* Sunlight Beams & Bubbles */}
      <svg style={{ width: '100%', height: '100%', position: 'absolute' }} viewBox="0 0 100 100" preserveAspectRatio="none">
        <defs>
            <linearGradient id="beamGrad" x1="0%" y1="0%" x2="40%" y2="100%">
                <stop offset="0%" style={{ stopColor: '#fff', stopOpacity: 0.12 }} />
                <stop offset="100%" style={{ stopColor: '#fff', stopOpacity: 0 }} />
            </linearGradient>
        </defs>
        <polygon points="10,-10 40,110 0,110" fill="url(#beamGrad)" />
        <polygon points="50,-10 90,110 40,110" fill="url(#beamGrad)" />
        <polygon points="80,-10 110,110 80,110" fill="url(#beamGrad)" />
        {[...Array(28)].map((_, i) => {
            const cx = (i * 37 + 13) % 100;
            return (
                <circle key={i} cx={cx} cy="100" r={0.2 + (i % 5) * 0.2} fill="white" opacity="0.3" className="animate-bubble" style={{ animationDelay: `${i*0.6}s`, animationDuration: `${12 + (i % 5) * 2}s` }} />
            );
        })}
      </svg>
      {/* Deep Sea Sharks */}
      <svg style={{ width: '100%', height: '100%', position: 'absolute' }} viewBox="0 0 100 100" preserveAspectRatio="none">
        {[...Array(3)].map((_, i) => (
            <svg key={`shark-${i}`} viewBox="0 0 100 100" className="absolute animate-[swimRight_25s_linear_infinite]" style={{ 
              top: `${40 + i * 15}%`, left: '-20%', width: '15%', height: '15%', animationDelay: `${i*7}s`, opacity: 0.6 
            }}>
              <path d="M 10 50 Q 30 30 50 50 T 90 50 L 95 45 L 85 55 L 95 65 L 90 60 Q 70 70 50 50 T 10 50 Z" fill="#475569" />
              <path d="M 40 45 L 35 30 L 50 45 Z" fill="#334155" />
              <path d="M 45 60 L 40 75 L 55 60 Z" fill="#334155" />
              <circle cx="25" cy="48" r="1.5" fill="black" />
            </svg>
        ))}
      </svg>
    </div>

    {/* === Sandy Seabed — rounded dunes, no boxes === */}
    <svg className="absolute bottom-0 w-full h-[32%] z-20" preserveAspectRatio="none" viewBox="0 0 200 100">
      <defs>
        <linearGradient id="sandDuneGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#fcd34d" />
          <stop offset="50%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#d97706" />
        </linearGradient>
        <linearGradient id="sandRippleGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#fde68a" stopOpacity="0.7"/>
          <stop offset="100%" stopColor="#fcd34d" stopOpacity="0"/>
        </linearGradient>
        <filter id="duneShadow">
          <feGaussianBlur in="SourceAlpha" stdDeviation="1.5"/>
          <feOffset dx="0" dy="2"/>
          <feComposite in2="SourceGraphic"/>
        </filter>
      </defs>

      {/* Back dune —  wide gentle hill */}
      <path d="M -10 70 Q 30 45 70 55 Q 110 65 150 48 Q 180 38 210 55 L 210 110 L -10 110 Z"
        fill="#d97706" opacity="0.5" />

      {/* Main sand floor — large smooth dunes */}
      <path d="M -10 80 Q 20 60 55 68 Q 90 75 120 58 Q 150 44 180 62 Q 195 70 210 65 L 210 110 L -10 110 Z"
        fill="url(#sandDuneGrad)" />

      {/* Surface highlight ripples baked on top */}
      <path d="M 10 68 Q 40 60 75 67 Q 110 73 140 60 Q 165 50 195 64"
        fill="none" stroke="#fde68a" strokeWidth="1.2" opacity="0.5" strokeLinecap="round"/>
      <path d="M 5 75 Q 35 68 65 73 Q 100 79 130 67 Q 160 56 200 70"
        fill="none" stroke="#fde68a" strokeWidth="0.8" opacity="0.35" strokeLinecap="round"/>

      {/* Foreground smaller ripple dune (bottom) */}
      <path d="M -10 88 Q 25 78 60 83 Q 95 88 130 78 Q 160 70 210 80 L 210 110 L -10 110 Z"
        fill="#e8a020" opacity="0.6" />

      {/* Sandy surface shimmer dots */}
      {[12, 35, 58, 82, 110, 140, 168].map((x, i) => (
        <ellipse key={i} cx={x} cy={68 + (i % 3) * 4} rx={2 + (i % 2)} ry="0.7"
          fill="#fde68a" opacity="0.35" />
      ))}
    </svg>
  </div>
);

export const CrabSVG = ({ isAlerting }) => (
  <svg viewBox="0 0 100 100" className={`w-12 h-12 sm:w-16 sm:h-16 drop-shadow-lg ${isAlerting ? 'animate-troll-mad' : 'animate-sway'}`}>
    <circle cx="50" cy="65" r="15" fill="#ef4444" />
    <path d="M30,65 Q 20,50 25,40" stroke="#ef4444" strokeWidth="4" fill="none" />
    <path d="M70,65 Q 80,50 75,40" stroke="#ef4444" strokeWidth="4" fill="none" />
    <circle cx="25" cy="40" r="5" fill="#ef4444" className="animate-pulse" />
    <circle cx="75" cy="40" r="5" fill="#ef4444" className="animate-pulse" />
    <circle cx="45" cy="58" r="2" fill="white" />
    <circle cx="55" cy="58" r="2" fill="white" />
  </svg>
);

export const OctopusSVG = ({ isAlerting }) => (
  <svg viewBox="0 0 100 100" className={`w-16 h-16 sm:w-24 sm:h-24 drop-shadow-2xl ${isAlerting ? 'animate-troll-mad' : 'animate-bob'}`}>
    <path d="M30,60 Q 50,20 70,60" fill="#a855f7" />
    {[20, 35, 50, 65, 80].map((x, i) => (
      <path key={i} d={`M${x},60 Q ${x + (Math.sin(i)*10)},85 ${x + (Math.cos(i)*5)},95`} stroke="#a855f7" strokeWidth="6" fill="none" strokeLinecap="round" className="animate-sway" style={{ animationDelay: `${i*0.2}s` }} />
    ))}
    <circle cx="43" cy="50" r="3" fill="white" />
    <circle cx="57" cy="50" r="3" fill="white" />
  </svg>
);

export const GiantClamSVG = ({ isDefeated, isAlerting, rewardEmoji }) => (
  <svg viewBox="0 0 100 100" className={`w-16 h-16 sm:w-20 sm:h-20 drop-shadow-xl ${isAlerting ? 'animate-troll-mad' : ''}`}>
    <path d="M10,70 C15,85 30,95 50,95 C70,95 85,85 90,70 L 85,75 C70,90 30,90 15,75 Z" fill="#f9a8d4" stroke="#db2777" strokeWidth="2" />
    {isDefeated ? (
      <path d="M10,70 C15,30 30,10 50,10 C70,10 85,30 90,70 Q 70,60 50,60 T 10,70" fill="#fce7f3" stroke="#db2777" strokeWidth="2" />
    ) : (
      <path d="M10,70 C15,55 30,50 50,50 C70,50 85,55 90,70 Q 70,75 50,75 T 10,70" fill="#f9a8d4" stroke="#db2777" strokeWidth="2" />
    )}
    {[25, 40, 50, 60, 75].map(x => (
      <path key={x} d={`M${x},${isDefeated?10:50} Q 50,${isDefeated?40:65} ${x},70`} stroke="#f472b6" strokeWidth="1" fill="none" opacity="0.5" />
    ))}
    {isDefeated && rewardEmoji ? (
      <g>
        <circle cx="50" cy="55" r="14" fill="#fff" opacity="0.4" className="animate-pulse" />
        <text x="50" y="58" textAnchor="middle" fontSize="26" className="drop-shadow-sm">{rewardEmoji}</text>
      </g>
    ) : (
      !isDefeated && <circle cx="50" cy="65" r="3" fill="white" className="animate-pulse" opacity="0.8" />
    )}
  </svg>
);

export const BubbleVentSVG = () => (
  <svg viewBox="0 0 100 100" className="w-12 h-12 sm:w-16 sm:h-16">
    <path d="M30,90 Q 50,70 70,90" fill="#3b82f6" opacity="0.4" />
    {[1, 2, 3].map(i => (
      <circle key={i} cx={40 + i*5} cy={80 - i*15} r={2 + i} fill="white" opacity="0.6" className="animate-bubble" style={{ animationDelay: `${i*0.5}s` }} />
    ))}
  </svg>
);

export const BoatSVG = () => (
  <svg viewBox="0 0 100 100" className="w-20 h-20 sm:w-24 sm:h-24 drop-shadow-xl animate-bob">
    <path d="M10,60 L90,60 L80,85 L20,85 Z" fill="#78350f" stroke="#451a03" strokeWidth="2" />
    <rect x="48" y="20" width="4" height="40" fill="#92400e" />
    <path d="M52,20 L85,45 L52,55 Z" fill="#fff" stroke="#cbd5e1" strokeWidth="1" />
    <path d="M15,65 Q 50,75 85,65" fill="none" stroke="#451a03" strokeWidth="1.5" opacity="0.4" />
  </svg>
);

export const SeahorseSVG = ({ isAlerting }) => (
  <svg viewBox="0 0 100 100" className={`w-10 h-10 sm:w-12 sm:h-12 drop-shadow-md ${isAlerting ? 'animate-troll-mad' : 'animate-bob'}`}>
    <path d="M40,20 Q 60,10 70,30 Q 50,40 40,30" fill="#fbbf24" />
    <path d="M40,30 Q 30,50 40,70 Q 50,90 40,95" fill="#fbbf24" stroke="#d97706" strokeWidth="2" />
    <path d="M40,70 Q 60,60 50,50" fill="#f59e0b" />
    <circle cx="55" cy="25" r="2" fill="white" />
  </svg>
);

export const CampIcon = () => (
  <div className="-translate-y-1"><BoatSVG /></div>
);
