import React from 'react';
import type { SvgSpriteProps } from '../types.ts';

/**
 * Bioluminescent Deep-Sea Lanternfish (replaces the pufferfish / blowfish emoji).
 * Faces LEFT by default so `scale-x-[-1]` when `fish.isRight` points forward cleanly.
 */
export function LanternfishSprite({ className = 'w-full h-full', title }: SvgSpriteProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      role={title ? 'img' : undefined}
      aria-label={title}
      overflow="visible"
    >
      <defs>
        <linearGradient id="lanternBodyGrad" x1="0%" y1="15%" x2="100%" y2="85%">
          <stop offset="0%" stopColor="#a855f7" />
          <stop offset="50%" stopColor="#ec4899" />
          <stop offset="100%" stopColor="#4338ca" />
        </linearGradient>
        <linearGradient id="lanternFinGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#67e8f9" />
          <stop offset="100%" stopColor="#0284c7" />
        </linearGradient>
        <radialGradient id="lanternLureGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fef9c3" stopOpacity="1" />
          <stop offset="45%" stopColor="#fde047" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Top dorsal fin */}
      <path
        d="M 28 21 C 32 10, 42 10, 44 21 Z"
        fill="url(#lanternFinGrad)"
        stroke="#0f172a"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      {/* Bottom ventral fin */}
      <path
        d="M 32 45 C 35 53, 42 52, 43 44 Z"
        fill="url(#lanternFinGrad)"
        stroke="#0f172a"
        strokeWidth="2"
        strokeLinejoin="round"
      />

      {/* Forked tail fin */}
      <path
        d="M 46 34 L 59 22 C 57 29, 56 32, 54 34 C 56 36, 57 39, 59 46 Z"
        fill="url(#lanternFinGrad)"
        stroke="#0f172a"
        strokeWidth="2.4"
        strokeLinejoin="round"
      />

      {/* Sleek jewel-fish body */}
      <path
        d="M 14 34 C 15 21, 30 18, 43 24 C 48 27, 50 31, 50 34 C 50 37, 48 41, 43 44 C 30 50, 15 47, 14 34 Z"
        fill="url(#lanternBodyGrad)"
        stroke="#0f172a"
        strokeWidth="2.6"
        strokeLinejoin="round"
      />

      {/* Shimmering belly highlight */}
      <path
        d="M 18 39 C 24 44, 34 45, 42 40"
        fill="none"
        stroke="#f9a8d4"
        strokeWidth="2.4"
        strokeLinecap="round"
        opacity="0.8"
      />

      {/* Bioluminescent flank spots */}
      <circle cx="30" cy="36" r="2.2" fill="#67e8f9" />
      <circle cx="36" cy="34" r="2" fill="#fde047" />
      <circle cx="41.5" cy="36" r="1.8" fill="#67e8f9" />

      {/* Pectoral fin */}
      <path
        d="M 27 36 C 31 33, 35 37, 32 42 C 29 43, 26 40, 27 36 Z"
        fill="#38bdf8"
        stroke="#0f172a"
        strokeWidth="1.8"
        opacity="0.95"
      />

      {/* Big expressive eye */}
      <circle cx="22" cy="31" r="4.6" fill="#fef9c3" stroke="#0f172a" strokeWidth="1.8" />
      <circle cx="21" cy="31" r="2.4" fill="#0f172a" />
      <circle cx="20" cy="29.8" r="0.9" fill="#ffffff" />

      {/* Cute smirk */}
      <path
        d="M 15.5 36.5 Q 18.5 38.5 21 36.5"
        fill="none"
        stroke="#0f172a"
        strokeWidth="1.8"
        strokeLinecap="round"
      />

      {/* Glowing angler/lantern esca stalk arcing over brow */}
      <path
        d="M 22 23 C 18 11, 7 12, 7 24"
        fill="none"
        stroke="#0f172a"
        strokeWidth="3.2"
        strokeLinecap="round"
      />
      <path
        d="M 22 23 C 18 11, 7 12, 7 24"
        fill="none"
        stroke="#67e8f9"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <circle cx="7" cy="26" r="7.5" fill="url(#lanternLureGlow)" />
      <circle cx="7" cy="26" r="3.2" fill="#fef08a" stroke="#f59e0b" strokeWidth="1.2" />
    </svg>
  );
}

export default LanternfishSprite;
