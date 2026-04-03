import React from 'react';

export const BridgeSVG = () => (
  <svg className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-20 h-28 -z-10" viewBox="0 0 60 100">
    <circle cx="10" cy="5" r="4" fill="#3e1c00"/><circle cx="50" cy="5" r="4" fill="#3e1c00"/>
    <circle cx="10" cy="95" r="4" fill="#3e1c00"/><circle cx="50" cy="95" r="4" fill="#3e1c00"/>
    <path d="M 10 5 Q 15 50 10 95" fill="none" stroke="#3e1c00" strokeWidth="2" />
    <path d="M 50 5 Q 45 50 50 95" fill="none" stroke="#3e1c00" strokeWidth="2" />
    {[15, 30, 45, 60, 75].map((y, i) => ( <rect key={y} x={12} y={y} width="36" height="8" fill="#8b5a2b" stroke="#4a2211" strokeWidth="1" rx="1" transform={`rotate(${i%2===0?-2:2} 30 ${y+4})`}/> ))}
  </svg>
);

export const RiverBackground = () => (
  <svg className="absolute inset-0 w-full h-full pointer-events-none z-0" viewBox="0 0 100 100" preserveAspectRatio="none">
    <path d="M -10 53 Q 25 43 50 53 T 110 53" fill="none" stroke="#1e40af" strokeWidth="10" opacity="0.3" strokeLinecap="round"/>
    <path d="M -10 53 Q 25 43 50 53 T 110 53" fill="none" stroke="#3b82f6" strokeWidth="5" opacity="0.5" strokeLinecap="round"/>
    <path d="M -10 52 Q 25 42 50 52 T 110 52" fill="none" stroke="#93c5fd" strokeWidth="1.5" opacity="0.7" strokeLinecap="round" strokeDasharray="15 25" className="animate-river-flow"/>
  </svg>
);

export const CaveEntranceProp = () => (
  <div className="relative flex justify-center items-end pointer-events-none w-56 h-48 sm:w-64 sm:h-56 drop-shadow-2xl -translate-y-6 sm:-translate-y-8">
    <svg viewBox="0 0 200 150" className="absolute bottom-0 w-full h-full">
      <path d="M10,150 L60,40 L100,60 L140,20 L190,150 Z" fill="#4b5563"/>
      <path d="M-10,150 L50,70 L90,90 L130,50 L210,150 Z" fill="#374151"/>
      <path d="M30,150 C30,80 60,30 100,30 C140,30 170,80 170,150 Z" fill="#1f2937"/>
      <path d="M60,150 C60,80 90,50 100,50 C110,50 140,80 140,150 Z" fill="#030712"/>
    </svg>
    <div className="absolute bottom-2 left-4 sm:left-6 text-3xl sm:text-4xl drop-shadow-lg -rotate-12">🪨</div>
    <div className="absolute bottom-0 right-2 sm:right-4 text-4xl sm:text-5xl drop-shadow-lg rotate-12 scale-110">🪨</div>
    <div className="absolute bottom-10 sm:bottom-14 left-0 text-2xl sm:text-3xl drop-shadow-md rotate-45 brightness-75">🪨</div>
  </div>
);

export const CampIcon = () => (
  <div className="text-6xl drop-shadow-lg -translate-y-4">🛶</div>
);
