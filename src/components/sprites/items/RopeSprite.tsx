import React from 'react';
import type { SvgSpriteProps } from '../types.ts';

/**
 * Classic coiled hemp adventurer's rope (replaces the modern knot emoji).
 */
export function RopeSprite({ className = 'w-full h-full', title }: SvgSpriteProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      role={title ? 'img' : undefined}
      aria-label={title}
      overflow="visible"
    >
      <defs>
        <linearGradient id="ropeBodyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fde68a" />
          <stop offset="45%" stopColor="#d97706" />
          <stop offset="100%" stopColor="#92400e" />
        </linearGradient>
        <linearGradient id="ropeInnerGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#b45309" />
          <stop offset="100%" stopColor="#78350f" />
        </linearGradient>
      </defs>

      {/* Soft ground shadow */}
      <ellipse cx="32" cy="54" rx="22" ry="5.5" fill="#1c1917" opacity="0.35" />

      {/* Trailing loose rope tail (top-right loop & frayed tip) */}
      <path
        d="M 46 21 C 56 14, 59 27, 51 35 C 46 40, 48 48, 55 51"
        fill="none"
        stroke="#451a03"
        strokeWidth="8.5"
        strokeLinecap="round"
      />
      <path
        d="M 46 21 C 56 14, 59 27, 51 35 C 46 40, 48 48, 55 51"
        fill="none"
        stroke="url(#ropeBodyGrad)"
        strokeWidth="5.2"
        strokeLinecap="round"
      />
      {/* Frayed tail fibers */}
      <path
        d="M 55 51 L 60 51 M 55 51 L 58 55 M 55 51 L 54 56"
        stroke="#b45309"
        strokeWidth="1.6"
        strokeLinecap="round"
      />

      {/* Back / outer coil loop */}
      <ellipse
        cx="30"
        cy="33"
        rx="21"
        ry="15"
        fill="none"
        stroke="#451a03"
        strokeWidth="11"
      />
      <ellipse
        cx="30"
        cy="33"
        rx="21"
        ry="15"
        fill="none"
        stroke="url(#ropeInnerGrad)"
        strokeWidth="7.5"
      />

      {/* Middle coil loop */}
      <ellipse
        cx="30"
        cy="32"
        rx="16"
        ry="11"
        fill="none"
        stroke="#451a03"
        strokeWidth="10"
      />
      <ellipse
        cx="30"
        cy="32"
        rx="16"
        ry="11"
        fill="none"
        stroke="url(#ropeBodyGrad)"
        strokeWidth="6.8"
      />

      {/* Front highlight coil */}
      <ellipse
        cx="30"
        cy="31"
        rx="11"
        ry="7.5"
        fill="none"
        stroke="#451a03"
        strokeWidth="8.5"
      />
      <ellipse
        cx="30"
        cy="31"
        rx="11"
        ry="7.5"
        fill="none"
        stroke="#fcd34d"
        strokeWidth="5"
      />

      {/* Diagonal rope-strand twist grooves around the coil */}
      <g stroke="#78350f" strokeWidth="1.7" strokeLinecap="round" opacity="0.8">
        <path d="M 13 24 L 18 28" />
        <path d="M 10 34 L 15 36" />
        <path d="M 18 44 L 22 40" />
        <path d="M 41 21 L 45 25" />
        <path d="M 45 36 L 49 32" />
        <path d="M 38 44 L 42 40" />
      </g>

      {/* Center lashing strap holding the coil together */}
      <rect
        x="25.5"
        y="33"
        width="9"
        height="17"
        rx="3.5"
        fill="#f59e0b"
        stroke="#451a03"
        strokeWidth="2.4"
      />
      <line x1="26.5" y1="38.5" x2="33.5" y2="38.5" stroke="#78350f" strokeWidth="1.8" />
      <line x1="26.5" y1="43.5" x2="33.5" y2="43.5" stroke="#78350f" strokeWidth="1.8" />
    </svg>
  );
}

export default RopeSprite;
