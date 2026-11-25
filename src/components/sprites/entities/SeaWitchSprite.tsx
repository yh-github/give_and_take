import React from 'react';
import type { SvgSpriteProps } from '../types.ts';

/**
 * Custom Sea Witch character sprite (replaces the `😈` emoji inside SeaWitchSVG).
 */
export function SeaWitchSprite({ className = 'w-full h-full', title }: SvgSpriteProps) {
  return (
    <svg
      viewBox="0 0 80 80"
      className={className}
      role={title ? 'img' : undefined}
      aria-label={title}
      overflow="visible"
    >
      <defs>
        <linearGradient id="witchCloakGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#581c87" />
          <stop offset="100%" stopColor="#1e1b4b" />
        </linearGradient>
        <linearGradient id="witchHairGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#e9d5ff" />
          <stop offset="50%" stopColor="#c084fc" />
          <stop offset="100%" stopColor="#6b21a8" />
        </linearGradient>
        <radialGradient id="witchOrbGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#a7f3d0" />
          <stop offset="50%" stopColor="#10b981" />
          <stop offset="100%" stopColor="#059669" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Flowing back sea-witch hair & curling tentacles */}
      <path
        d="M 20 34 C 12 22, 16 10, 40 10 C 64 10, 68 22, 60 34 C 67 44, 65 58, 56 62 L 24 62 C 15 58, 13 44, 20 34 Z"
        fill="url(#witchHairGrad)"
        stroke="#0f172a"
        strokeWidth="2.4"
        strokeLinejoin="round"
      />

      {/* Curling lower tentacles */}
      <path
        d="M 24 58 C 14 63, 11 72, 19 74 C 24 75, 26 70, 24 66"
        fill="#4c1d95"
        stroke="#0f172a"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <path
        d="M 56 58 C 66 63, 69 72, 61 74 C 56 75, 54 70, 56 66"
        fill="#4c1d95"
        stroke="#0f172a"
        strokeWidth="2.2"
        strokeLinecap="round"
      />

      {/* High-collared witch cloak */}
      <path
        d="M 22 46 L 16 36 L 29 44 L 51 44 L 64 36 L 58 46 L 60 68 C 52 74, 28 74, 20 68 Z"
        fill="url(#witchCloakGrad)"
        stroke="#0f172a"
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
      {/* Gold collar trim */}
      <path
        d="M 27 46 Q 40 53 53 46"
        fill="none"
        stroke="#fbbf24"
        strokeWidth="2"
        strokeLinecap="round"
      />

      {/* Glowing golden conch pendant */}
      <circle cx="40" cy="54" r="4.2" fill="#34d399" stroke="#fbbf24" strokeWidth="1.6" />

      {/* Face (pale sea-lavender) */}
      <ellipse
        cx="40"
        cy="32"
        rx="13.5"
        ry="14"
        fill="#ddd6fe"
        stroke="#0f172a"
        strokeWidth="2.3"
      />

      {/* Fin-ears */}
      <path d="M 26 30 L 18 26 L 23 36 Z" fill="#a78bfa" stroke="#0f172a" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M 54 30 L 62 26 L 57 36 Z" fill="#a78bfa" stroke="#0f172a" strokeWidth="1.8" strokeLinejoin="round" />

      {/* Swooping front bangs */}
      <path
        d="M 26 26 Q 35 16 44 21 Q 50 18 54 27 Q 45 22 39 25 Q 32 21 26 26 Z"
        fill="#f3e8ff"
        stroke="#0f172a"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />

      {/* Crooked sea-coral crown */}
      <path
        d="M 31 18 L 33 9 L 38 14 L 41 6 L 45 14 L 50 10 L 49 18 Z"
        fill="#f59e0b"
        stroke="#0f172a"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <circle cx="40.5" cy="14" r="2" fill="#22d3ee" />

      {/* Expressive arched brows & glowing amber eyes */}
      <path d="M 31 28 L 37 30" stroke="#1e1b4b" strokeWidth="2.1" strokeLinecap="round" />
      <path d="M 49 28 L 43 30" stroke="#1e1b4b" strokeWidth="2.1" strokeLinecap="round" />

      <ellipse cx="34.5" cy="32.5" rx="3" ry="2.4" fill="#fef08a" stroke="#0f172a" strokeWidth="1.2" />
      <ellipse cx="45.5" cy="32.5" rx="3" ry="2.4" fill="#fef08a" stroke="#0f172a" strokeWidth="1.2" />
      <circle cx="34.8" cy="32.5" r="1.3" fill="#0f172a" />
      <circle cx="45.2" cy="32.5" r="1.3" fill="#0f172a" />

      {/* Sly witch grin */}
      <path
        d="M 34 39 Q 40 43.5 46 38.5"
        fill="none"
        stroke="#3b0764"
        strokeWidth="2.1"
        strokeLinecap="round"
      />

      {/* Floating potion orb */}
      <circle cx="64" cy="54" r="9.5" fill="url(#witchOrbGlow)" opacity="0.85" />
      <circle cx="64" cy="54" r="5" fill="#6ee7b7" stroke="#064e3b" strokeWidth="1.6" />
      <circle cx="62.5" cy="52.3" r="1.5" fill="#ffffff" opacity="0.9" />
    </svg>
  );
}

export default SeaWitchSprite;
