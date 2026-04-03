import React from 'react';

export const CaveBackground = () => (
  <div className="absolute inset-0 bg-[#2b221d] pointer-events-none z-0 overflow-hidden">
    <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(#1a1512 2px, transparent 2px)', backgroundSize: '40px 40px' }} />
    <svg className="absolute inset-0 w-full h-full pointer-events-none z-0 drop-shadow-2xl" preserveAspectRatio="none" viewBox="0 0 100 100">
      <path d="M 0 0 L 35 0 L 32 5 L 36 10 L 35 15 L 25 18 L 12 22 L 15 30 L 10 40 L 14 50 L 9 60 L 13 70 L 12 75 L 20 78 L 35 82 L 32 85 L 35 88 L 25 90 L 10 92 L 12 96 L 10 100 L 0 100 Z" fill="#181310" stroke="#0a0806" strokeWidth="0.5" vectorEffect="non-scaling-stroke" />
      <path d="M 100 0 L 65 0 L 68 5 L 64 10 L 65 15 L 75 18 L 88 22 L 85 30 L 90 40 L 86 50 L 91 60 L 87 70 L 88 75 L 80 78 L 65 82 L 68 85 L 65 88 L 75 90 L 90 92 L 88 96 L 90 100 L 100 100 Z" fill="#181310" stroke="#0a0806" strokeWidth="0.5" vectorEffect="non-scaling-stroke" />
      <path d="M 50 18 L 45 22 L 40 28 L 38 35 L 42 45 L 40 52 L 46 60 L 48 70 L 50 78 L 52 70 L 54 60 L 60 52 L 58 45 L 62 35 L 60 28 L 55 22 Z" fill="#181310" stroke="#0a0806" strokeWidth="0.5" vectorEffect="non-scaling-stroke" />
    </svg>
  </div>
);

export const CampIcon = () => (
  <div className="text-6xl drop-shadow-lg -translate-y-4">⛺</div>
);
