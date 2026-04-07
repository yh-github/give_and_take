import React from 'react';

export const CAVE_WALL_VERTICES = {
  leftWall: [
    {x:0,y:0}, {x:20,y:0}, 
    {x:18,y:4}, {x:20,y:8}, {x:18,y:12}, {x:14,y:16}, {x:16,y:20}, 
    {x:20,y:22}, {x:17,y:25}, 
    {x:20,y:30}, {x:18,y:36}, {x:21,y:42}, 
    {x:20,y:46}, {x:18,y:52}, 
    {x:22,y:60}, {x:19,y:65}, 
    {x:20,y:68}, {x:17,y:72}, {x:20,y:76}, {x:18,y:80}, {x:20,y:84}, {x:14,y:88}, {x:12,y:92}, {x:14,y:96}, {x:12,y:100}, {x:0,y:100}
  ],
  rightWall: [
    {x:100,y:0}, {x:80,y:0}, 
    {x:82,y:4}, {x:80,y:8}, {x:82,y:12}, {x:86,y:16}, {x:84,y:20}, 
    {x:80,y:25}, {x:83,y:28}, 
    {x:80,y:32}, {x:82,y:38}, {x:79,y:41}, 
    {x:80,y:43}, {x:82,y:50}, 
    {x:78,y:60}, {x:81,y:65}, 
    {x:80,y:71}, {x:83,y:75}, {x:80,y:79}, {x:82,y:83}, {x:80,y:86}, {x:86,y:90}, {x:88,y:94}, {x:85,y:97}, {x:88,y:100}, {x:100,y:100}
  ],
  centralPillar: [
    {x:50,y:20}, 
    {x:52,y:22}, {x:53,y:25}, {x:50,y:30}, {x:47,y:38}, {x:52,y:46}, {x:49,y:52}, 
    {x:53,y:60}, {x:51,y:65}, {x:55,y:68}, {x:52,y:75}, 
    {x:48,y:76}, {x:45,y:71}, {x:49,y:66}, {x:47,y:61}, 
    {x:51,y:51}, {x:48,y:43}, {x:53,y:36}, {x:50,y:31}, {x:47,y:25}, {x:48,y:22}
  ]
};

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
        L 80 25 L 83 28 
        L 80 32 L 82 38 L 79 41 
        L 80 43 L 82 50 
        L 78 60 L 81 65 
        L 80 71 L 83 75 L 80 79 L 82 83 L 80 86 L 86 90 L 88 94 L 85 97 L 88 100 L 100 100 Z" 
        fill="#181310" stroke="#0a0806" strokeWidth="0.5" vectorEffect="non-scaling-stroke" 
      />
      {/* Central Pillar - Asymmetric to match paths */}
      <path d="
        M 50 20 
        L 52 22 L 53 25 L 50 30 L 47 38 L 52 46 L 49 52 
        L 53 60 L 51 65 L 55 68 L 52 75 
        L 48 76 L 45 71 L 49 66 L 47 61 
        L 51 51 L 48 43 L 53 36 L 50 31 L 47 25 L 48 22 Z" 
        fill="#181310" stroke="#0a0806" strokeWidth="0.5" vectorEffect="non-scaling-stroke" 
      />
    </svg>
  </div>
);

export const RockSVG = ({ isDefeated, isAlerting, seed = 0, size = 'large' }) => {
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
  const rotation = (val % 40) - 20; // more rotation
  const scaleX = (size === 'small' ? 0.6 : 1.1) + (val % 10) / 40; 
  const scaleY = (size === 'small' ? 0.6 : 1.1) + (val % 8) / 40; 
  const variant = val % 4; // Added a 4th variant
  
  // Custom jagged paths with "bulges"
  const paths = [
    "M 10 45 L 5 35 L 12 15 L 35 12 L 60 5 L 85 8 L 105 10 L 115 25 L 118 45 L 105 55 L 80 58 L 45 60 L 15 55 Z",
    "M 15 50 L 2 40 L 10 20 L 35 5 L 70 8 L 95 12 L 120 25 L 115 45 L 95 60 L 60 58 L 30 62 L 10 55 Z",
    "M 8 40 L 12 25 L 25 10 L 55 5 L 90 12 L 115 20 L 118 40 L 105 55 L 75 62 L 45 58 L 20 60 L 5 50 Z",
    "M 20 55 L 5 45 L 8 25 L 30 10 L 65 5 L 95 8 L 115 15 L 110 40 L 95 55 L 60 62 L 35 58 L 15 60 Z"
  ];
  
  if (isDefeated) {
      // Rubble state based on size
      const rubbleScale = size === 'small' ? 0.5 : 0.9;
      return (
          <div className="relative pointer-events-none opacity-80 translate-y-4" style={{ transform: `scale(${rubbleScale})` }}>
              <svg viewBox="0 0 120 60" className="w-[32cqw] h-auto drop-shadow-lg">
                  <path d="M 20 50 L 35 45 L 45 52 L 30 55 Z" fill="#635d57" stroke="#3d3832" />
                  <path d="M 55 52 L 70 48 L 85 55 L 65 58 Z" fill="#4d4842" stroke="#3d3832" />
                  <path d="M 80 45 L 100 40 L 110 48 L 90 52 Z" fill="#6a645d" stroke="#3d3832" />
                  <path d="M 35 58 L 50 55 L 65 60 L 40 62 Z" fill="#3d3832" stroke="#2a2520" />
              </svg>
          </div>
      );
  }

  return (
    <div className={`relative transition-all duration-700 ${isAlerting ? 'animate-troll-mad' : ''}`} style={{ transform: `rotate(${rotation}deg) scale(${scaleX}, ${scaleY})` }}>
      <svg viewBox="0 0 120 70" className="w-[40cqw] h-auto drop-shadow-[0_10px_20px_rgba(0,0,0,0.9)]">
        <defs>
          <linearGradient id={`rockGrad-${variant}-${size}`} x1={`${variant * 20}%`} y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#8a847e" />
            <stop offset="30%" stopColor="#635d57" />
            <stop offset="75%" stopColor="#3d3832" />
            <stop offset="100%" stopColor="#1a1815" />
          </linearGradient>
          <filter id="rockRoughness">
            <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="5" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="4" result="displaced" />
            <feGaussianBlur in="displaced" stdDeviation="0.6" />
          </filter>
          <filter id="innerShadow">
            <feOffset dx="1" dy="3" />
            <feGaussianBlur stdDeviation="2" result="offset-blur" />
            <feComposite operator="out" in="SourceGraphic" in2="offset-blur" result="inverse" />
            <feFlood floodColor="black" floodOpacity="0.5" result="color" />
            <feComposite operator="in" in="color" in2="inverse" result="shadow" />
            <feComposite operator="over" in="shadow" in2="SourceGraphic" />
          </filter>
        </defs>
        <path 
          d={paths[variant].replace('Z', ' L 60 65 L 15 62 Z')} 
          fill={`url(#rockGrad-${variant}-${size})`} 
          stroke="#121110" 
          strokeWidth="3"
          filter="url(#rockRoughness)"
        />
        <path 
          d={paths[variant]} 
          fill="none"
          filter="url(#innerShadow)"
          pointerEvents="none"
        />
        {/* Jagged Facets and Highlights */}
        <g opacity="0.45">
          <path d="M 25 15 L 40 12 L 50 25 M 75 10 L 85 8 L 92 25" stroke="white" strokeWidth="1.5" fill="none" />
          <path d="M 50 55 L 70 50 L 85 55" stroke="black" strokeWidth="3" fill="none" />
          <path d="M 15 40 L 30 45 L 45 42" stroke="black" strokeWidth="2.5" fill="none" opacity="0.7"/>
          <path d="M 90 20 L 105 25 L 110 15" stroke="white" strokeWidth="1" fill="none" />
        </g>
      </svg>
    </div>
  );
};

export const CampIcon = () => (
  <div className="text-6xl drop-shadow-lg -translate-y-4">⛺</div>
);
