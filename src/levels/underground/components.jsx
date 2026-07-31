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
    {x:51,y:51}, {x:48,y:43}, {x:53,y:36}, {x:50,y:31}, {x:47,y:25}, {x:48,y:22}, {x:50,y:20}
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
  // Remove overall rotation to keep the barricade horizontal
  const rotation = (val % 10) - 5; 
  
  // Stretch horizontally to fill the corridor better, compress vertically
  const scaleX = (size === 'small' ? 0.8 : 1.4) + (val % 10) / 30; 
  const scaleY = (size === 'small' ? 0.6 : 0.8) + (val % 8) / 40; 
  const variant = val % 4; 
  
  // Custom wider paths representing a pile/barricade of rocks
  const paths = [
    // A wide blockade
    "M 5 45 L 2 30 L 15 15 L 45 10 L 80 12 L 110 5 L 135 15 L 145 35 L 140 55 L 110 65 L 75 60 L 35 65 Z",
    "M 10 50 L 5 35 L 20 12 L 55 8 L 90 10 L 125 15 L 140 30 L 135 55 L 105 62 L 65 58 L 25 65 Z",
    "M 8 40 L 15 20 L 35 8 L 70 5 L 100 12 L 135 18 L 145 40 L 130 60 L 95 55 L 50 65 L 15 58 Z",
    "M 15 55 L 5 35 L 25 15 L 60 10 L 95 8 L 130 15 L 142 45 L 125 65 L 85 58 L 45 62 Z"
  ];
  
  if (isDefeated) {
      // Rubble state based on size
      const rubbleScale = size === 'small' ? 0.5 : 0.9;
      return (
          <div className="relative pointer-events-none opacity-80 translate-y-4" style={{ transform: `scale(${rubbleScale})` }}>
              <svg viewBox="0 0 150 70" className="w-[38cqw] h-auto drop-shadow-lg">
                  <path d="M 20 50 L 45 40 L 60 55 L 35 65 Z" fill="#635d57" stroke="#3d3832" />
                  <path d="M 65 55 L 90 45 L 110 60 L 80 65 Z" fill="#4d4842" stroke="#3d3832" />
                  <path d="M 100 45 L 125 35 L 140 50 L 115 60 Z" fill="#6a645d" stroke="#3d3832" />
                  <path d="M 45 62 L 70 55 L 95 65 L 65 70 Z" fill="#3d3832" stroke="#2a2520" />
              </svg>
          </div>
      );
  }

  return (
    <div className={`relative transition-all duration-700 ${isAlerting ? 'animate-troll-mad' : ''}`} style={{ transform: `rotate(${rotation}deg) scale(${scaleX}, ${scaleY})` }}>
      <svg viewBox="0 0 150 70" className="w-full h-auto drop-shadow-[0_10px_20px_rgba(0,0,0,0.9)]">
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
