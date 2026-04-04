import React from 'react';

export const CaveBackground = () => (
  <div className="absolute inset-0 bg-[#2b221d] pointer-events-none z-0 overflow-hidden">
    <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(#1a1512 2px, transparent 2px)', backgroundSize: '40px 40px' }} />
    <svg className="absolute inset-0 w-full h-full pointer-events-none z-0 drop-shadow-2xl" preserveAspectRatio="none" viewBox="0 0 100 100">
      <path d="M 0 0 L 20 0 L 18 4 L 20 8 L 18 12 L 14 16 L 6 20 L 8 28 L 4 36 L 7 44 L 4 52 L 6 60 L 5 66 L 10 72 L 20 76 L 18 80 L 20 84 L 14 88 L 5 92 L 7 96 L 5 100 L 0 100 Z" fill="#181310" stroke="#0a0806" strokeWidth="0.5" vectorEffect="non-scaling-stroke" />
      <path d="M 100 0 L 80 0 L 82 4 L 80 8 L 82 12 L 86 16 L 94 20 L 92 28 L 96 36 L 93 44 L 96 52 L 94 60 L 95 66 L 90 72 L 80 76 L 82 80 L 80 84 L 86 88 L 95 92 L 93 96 L 95 100 L 100 100 Z" fill="#181310" stroke="#0a0806" strokeWidth="0.5" vectorEffect="non-scaling-stroke" />
      <path d="M 50 20 L 48 24 L 46 30 L 45 38 L 47 46 L 46 52 L 48 60 L 49 68 L 50 75 L 51 68 L 52 60 L 54 52 L 53 46 L 55 38 L 54 30 L 52 24 Z" fill="#181310" stroke="#0a0806" strokeWidth="0.5" vectorEffect="non-scaling-stroke" />
    </svg>
  </div>
);

export const CampIcon = () => (
  <div className="text-6xl drop-shadow-lg -translate-y-4">⛺</div>
);
