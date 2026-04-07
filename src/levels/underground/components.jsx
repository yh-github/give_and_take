import React from 'react';

export const CaveBackground = () => (
  <div className="absolute inset-0 bg-[#2b221d] pointer-events-none z-0 overflow-hidden">
    <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(#1a1512 2px, transparent 2px)', backgroundSize: '40px 40px' }} />
    <svg className="absolute inset-0 w-full h-full pointer-events-none z-0 drop-shadow-2xl" preserveAspectRatio="none" viewBox="0 0 100 100">
      {/* Dynamic Cave Walls that meet the rocks */}
      <path d="
        M 0 0 L 20 0 
        L 18 4 L 20 8 L 18 12 L 14 16 L 16 20 
        L 20 22 L 17 25 
        L 20 30 L 18 36 L 21 42 
        L 20 46 L 18 52 
        L 22 60 L 19 65 
        L 20 68 L 17 72 L 20 76 L 18 80 L 20 84 L 14 88 L 12 92 L 14 96 L 12 100 L 0 100 Z" 
        fill="#181310" stroke="#0a0806" strokeWidth="0.5" vectorEffect="non-scaling-stroke" 
      />
      <path d="
        M 100 0 L 80 0 
        L 82 4 L 80 8 L 82 12 L 86 16 L 84 20 
        L 80 22 L 83 25 
        L 80 30 L 82 36 L 79 42 
        L 80 46 L 82 52 
        L 78 60 L 81 65 
        L 80 68 L 83 72 L 80 76 L 82 80 L 80 84 L 86 88 L 88 92 L 85 96 L 88 100 L 100 100 Z" 
        fill="#181310" stroke="#0a0806" strokeWidth="0.5" vectorEffect="non-scaling-stroke" 
      />
      {/* Central Pillar */}
      <path d="
        M 50 20 
        L 52 22 L 53 25 L 50 30 L 47 38 L 52 46 L 49 52 
        L 53 60 L 51 65 L 55 68 L 52 75 
        L 48 75 L 45 68 L 49 65 L 47 60 
        L 51 52 L 48 46 L 53 38 L 50 30 L 47 25 L 48 22 Z" 
        fill="#181310" stroke="#0a0806" strokeWidth="0.5" vectorEffect="non-scaling-stroke" 
      />
    </svg>
  </div>
);

export const RockSVG = ({ isDefeated, isAlerting, seed = 0 }) => {
  // Simple deterministic random from seed
  const hash = (s) => {
    let h = 0;
    const str = String(s);
    for (let i = 0; i < str.length; i++) {
        h = ((h << 5) - h) + str.charCodeAt(i);
        h |= 0;
    }
    return Math.abs(h);
  };
  
  const val = hash(seed);
  const rotation = (val % 20) - 10; // -10 to 10 deg
  const scaleX = 1 + (val % 10) / 40; // 1.0 to 1.25
  const scaleY = 1 + (val % 8) / 40; // 1.0 to 1.2
  const variant = val % 3;
  
  // Three different jagged path variants
  const paths = [
    "M 10 45 L 8 30 L 15 15 L 35 8 L 60 5 L 85 10 L 110 20 L 115 35 L 112 50 L 95 58 L 65 55 L 35 58 L 12 52 Z",
    "M 15 50 L 5 35 L 12 20 L 30 10 L 55 5 L 80 8 L 105 15 L 118 30 L 110 50 L 90 60 L 60 55 L 30 58 L 18 55 Z",
    "M 12 55 L 8 40 L 10 25 L 25 12 L 50 8 L 75 10 L 100 12 L 115 25 L 112 45 L 98 55 L 70 60 L 40 58 L 20 60 Z"
  ];
  
  if (isDefeated) {
      // Rubble state: smaller jagged pieces
      return (
          <div className="relative pointer-events-none opacity-80 scale-90 translate-y-4">
              <svg viewBox="0 0 120 60" className="w-[32cqw] h-auto drop-shadow-lg">
                  <path d="M 20 50 L 35 45 L 45 52 L 30 55 Z" fill="#635d57" stroke="#3d3832" />
                  <path d="M 55 52 L 70 48 L 85 55 L 65 58 Z" fill="#4d4842" stroke="#3d3832" />
                  <path d="M 80 45 L 100 40 L 110 48 L 90 52 Z" fill="#6a645d" stroke="#3d3832" />
                  <path d="M 40 58 L 55 55 L 60 60 L 45 62 Z" fill="#3d3832" stroke="#2a2520" />
              </svg>
          </div>
      );
  }

  return (
    <div className={`relative transition-all duration-700 ${isAlerting ? 'animate-troll-mad' : ''}`} style={{ transform: `rotate(${rotation}deg) scale(${scaleX}, ${scaleY})` }}>
      <svg viewBox="0 0 120 60" className="w-[32cqw] h-auto drop-shadow-[0_6px_12px_rgba(0,0,0,0.8)]">
        <defs>
          <linearGradient id={`rockGrad-${variant}`} x1={`${variant * 10}%`} y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#8a847e" />
            <stop offset="50%" stopColor="#635d57" />
            <stop offset="100%" stopColor="#3d3832" />
          </linearGradient>
          <filter id="rockRoughness">
            <feTurbulence type="fractalNoise" baseFrequency="0.6" numOctaves="4" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="3" />
          </filter>
        </defs>
        <path 
          d={paths[variant]} 
          fill={`url(#rockGrad-${variant})`} 
          stroke="#2a2520" 
          strokeWidth="2"
          filter="url(#rockRoughness)"
        />
        {/* Cracks and jagged highlights */}
        <path d="M 30 20 L 40 18 L 45 25 M 70 15 L 78 12 L 85 22 M 20 40 L 32 38 L 40 45" stroke="rgba(255,255,255,0.15)" strokeWidth="1" fill="none" />
        <path d="M 50 55 L 60 50 L 70 52 M 90 40 L 98 38 L 105 45" stroke="rgba(0,0,0,0.4)" strokeWidth="1.5" fill="none" />
      </svg>
    </div>
  );
};

export const CampIcon = () => (
  <div className="text-6xl drop-shadow-lg -translate-y-4">⛺</div>
);
