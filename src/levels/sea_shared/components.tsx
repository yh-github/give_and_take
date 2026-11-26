import React from 'react';
import { SpriteIcon, SvgEmbeddedSprite } from '../../components/sprites/SpriteIcon.tsx';
import {
  AIR_POCKET_LEFT_X,
  AIR_POCKET_POLYGON,
  AIR_POCKET_RIGHT_X,
  AIR_POCKET_Y
} from '../shipwreck/geometry.ts';

const AIR_POCKET_POINTS = AIR_POCKET_POLYGON.map((p) => `${p.x},${p.y}`).join(' ');

export interface SeaWitchSVGProps {
  variant?: 'underwater' | 'shipwreck';
  isTransformed: boolean;
  hasDeepTreasure?: boolean;
  returnRelicId?: string | null;
  returnRelicEmoji?: string | null;
  reqEmojis?: string[];
  emoji?: string | null;
  spriteSrc?: string | null;
  isCastingMagic?: boolean;
}

const WITCH_SPARKLES = [
  { left: '12%', top: '18%', size: 10, delay: '0s', dur: '3.1s' },
  { left: '84%', top: '20%', size: 12, delay: '0.6s', dur: '3.4s' },
  { left: '6%', top: '58%', size: 9, delay: '1.3s', dur: '2.9s' },
  { left: '90%', top: '55%', size: 10, delay: '1.9s', dur: '3.3s' },
  { left: '24%', top: '86%', size: 8, delay: '0.9s', dur: '3.6s' },
  { left: '76%', top: '84%', size: 9, delay: '2.4s', dur: '3.0s' }
] as const;

/**
 * Shared Sea Witch aura, ambient sparkles, and cast magic effects used across all Sea levels.
 * Renders the Sea Witch floating directly in the water without a cauldron or backdrop arch.
 */
export const SeaWitchSVG = ({
  variant = 'underwater',
  isTransformed,
  hasDeepTreasure = false,
  returnRelicId: _returnRelicId = null,
  returnRelicEmoji: _returnRelicEmoji = '🔮',
  reqEmojis: _reqEmojis = [],
  emoji = '😈',
  spriteSrc = null,
  isCastingMagic = false
}: SeaWitchSVGProps) => {
  const isEmeraldReady =
    variant === 'shipwreck' ? !isTransformed : Boolean(isTransformed && hasDeepTreasure);

  const sizeClass = variant === 'shipwreck' ? 'w-[30cqw] h-[30cqw]' : 'w-[34cqw] h-[34cqw]';
  const emojiSizeClass = variant === 'shipwreck' ? 'text-[11cqw]' : 'text-[12cqw]';
  const glowId = `seaWitchGlow-${variant}`;
  const sparkleFill = isEmeraldReady ? '#6ee7b7' : '#e9d5ff';
  const sparkleAccent = isEmeraldReady ? '#fde68a' : '#67e8f9';

  return (
    <div data-testid="sea-witch-grotto" className="relative flex flex-col items-center justify-center">
      {/* Soft ambient magical glow in the water (no cauldron or arch backdrop) */}
      <svg
        viewBox="0 0 120 120"
        aria-hidden="true"
        className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 ${sizeClass} pointer-events-none -z-10 overflow-visible`}
      >
        <defs>
          <radialGradient id={glowId} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={isEmeraldReady ? '#34d399' : '#a855f7'} stopOpacity="0.62" />
            <stop offset="48%" stopColor={isEmeraldReady ? '#059669' : '#6b21a8'} stopOpacity="0.32" />
            <stop offset="100%" stopColor="#0f172a" stopOpacity="0" />
          </radialGradient>
        </defs>

        <circle
          cx="60"
          cy="60"
          r="56"
          fill={`url(#${glowId})`}
          className="animate-witch-aura"
          style={{ transformOrigin: '60px 60px' }}
        />
      </svg>

      {/* Ambient magical star sparkles drifting around the witch */}
      <div
        data-testid="sea-witch-sparkles"
        aria-hidden="true"
        className="absolute -inset-4 pointer-events-none z-20"
      >
        {WITCH_SPARKLES.map((s, idx) => (
          <svg
            key={idx}
            viewBox="0 0 24 24"
            width={s.size}
            height={s.size}
            className="absolute animate-witch-sparkle"
            style={{
              left: s.left,
              top: s.top,
              animationDelay: s.delay,
              animationDuration: s.dur,
              filter: `drop-shadow(0 0 4px ${isEmeraldReady ? 'rgba(52,211,153,0.9)' : 'rgba(192,132,252,0.9)'})`
            }}
          >
            <path
              d="M 12 1 L 14.8 9.2 L 23 12 L 14.8 14.8 L 12 23 L 9.2 14.8 L 1 12 L 9.2 9.2 Z"
              fill={idx % 2 === 0 ? sparkleFill : sparkleAccent}
            />
          </svg>
        ))}
      </div>

      {isCastingMagic && (
        <div
          data-testid="witch-cast-fx"
          aria-hidden="true"
          className="absolute left-1/2 top-1/2 w-[18cqw] h-[18cqw] rounded-full border-2 border-emerald-300/80 shadow-[0_0_24px_rgba(52,211,153,0.95)] pointer-events-none z-20 animate-witch-cast-ring"
        >
          {[0, 60, 120, 180, 240, 300].map((deg) => (
            <span
              key={deg}
              className="absolute left-1/2 top-1/2 w-2 h-2 rounded-full bg-emerald-200 shadow-[0_0_8px_#a855f7]"
              style={{
                transform: `translate(-50%, -50%) rotate(${deg}deg) translateY(-9cqw)`
              }}
            />
          ))}
        </div>
      )}

      <div className={isCastingMagic ? 'z-10' : 'z-10 animate-witch-bob'}>
        <SpriteIcon
          id="sea_witch"
          spriteSrc={spriteSrc}
          emoji={emoji}
          alt="Sea Witch"
          className={`${emojiSizeClass} ${
            isCastingMagic
              ? 'animate-witch-cast'
              : isEmeraldReady
                ? 'drop-shadow-[0_0_16px_rgba(52,211,153,0.95)]'
                : 'drop-shadow-[0_0_14px_rgba(168,85,247,0.85)]'
          }`}
        />
      </div>
    </div>
  );
};

export interface InteractiveKelpSVGProps {
  variant?: 'harvest' | 'habitat';
  fishId?: string;
  fishEmoji?: string;
  fishSpriteSrc?: string | null;
  isRustling?: boolean;
}

export const InteractiveKelpSVG = ({
  variant = 'habitat',
  fishId = 'fish',
  fishEmoji = '🐟',
  fishSpriteSrc = null,
  isRustling = false
}: InteractiveKelpSVGProps) => {
  const isHarvest = variant === 'harvest';
  return (
    <div
      className={`relative flex flex-col items-center justify-center ${
        isRustling ? 'animate-kelp-rustle' : ''
      }`}
    >
      <svg
        viewBox="0 0 80 96"
        className={`${isHarvest ? 'w-14 h-16' : 'w-16 h-20'} overflow-visible drop-shadow-[0_4px_10px_rgba(0,0,0,0.6)]`}
      >
        <defs>
          <radialGradient id={isHarvest ? 'kelpHarvestGlow' : 'kelpHabGlow'} cx="50%" cy="65%" r="48%">
            <stop offset="0%" stopColor={isHarvest ? '#4ade80' : '#2dd4bf'} stopOpacity="0.55" />
            <stop offset="100%" stopColor="#0f172a" stopOpacity="0" />
          </radialGradient>
        </defs>

        <circle cx="40" cy="60" r="34" fill={`url(#${isHarvest ? 'kelpHarvestGlow' : 'kelpHabGlow'})`} />

        <g className="animate-kelp-sway">
          <path
            d="M 32 88 Q 20 64 28 42 Q 36 22 24 8 Q 34 20 38 40 Q 32 62 36 88 Z"
            fill={isHarvest ? '#22c55e' : '#10b981'}
            stroke="#a7f3d0"
            strokeWidth="1.2"
          />
          <path
            d="M 44 88 Q 56 64 48 40 Q 40 22 52 10 Q 46 28 54 48 Q 50 68 48 88 Z"
            fill={isHarvest ? '#16a34a' : '#059669'}
            stroke="#6ee7b7"
            strokeWidth="1.2"
          />
          <path
            d="M 38 88 Q 34 60 40 34 Q 44 18 40 6 Q 48 22 44 46 Q 42 68 42 88 Z"
            fill="#34d399"
            opacity="0.85"
          />
        </g>

        <ellipse cx="40" cy="88" rx="18" ry="5" fill="#1e293b" stroke="#0f172a" strokeWidth="1.2" />
      </svg>

      {variant === 'habitat' ? (
        <div className=" -mt-6 bg-sky-950/85 border border-emerald-400/70 rounded-full px-1.5 py-0.5 text-sm shadow-md flex items-center gap-0.5">
          <SpriteIcon id={fishId} spriteSrc={fishSpriteSrc} emoji={fishEmoji} />
        </div>
      ) : (
        <div className="-mt-5 bg-emerald-950/90 border border-emerald-300 rounded-full px-1.5 py-0.5 text-base shadow-[0_0_8px_rgba(52,211,153,0.7)]">
          <SpriteIcon id="sea_kelp" emoji="🌿" />
        </div>
      )}
    </div>
  );
};

export interface GiantClamSVGProps {
  isDefeated?: boolean;
  isBuried?: boolean;
  isDigger?: boolean;
  isGoal?: boolean;
  isAlerting?: boolean;
  rewardId?: string | null;
  rewardEmoji?: string | null;
  rewardSpriteSrc?: string | null;
  isMurkyFar?: boolean;
}

export const GiantClamSVG = ({
  isDefeated = false,
  isBuried = false,
  isDigger = false,
  isGoal = false,
  isAlerting = false,
  rewardId = null,
  rewardEmoji,
  rewardSpriteSrc = null,
  isMurkyFar = false
}: GiantClamSVGProps) => {
  const isOpen = isDefeated || !isBuried;
  const topShellFill = isGoal ? '#f59e0b' : isDigger ? '#9333ea' : '#e11d48';
  const botShellFill = isGoal ? '#d97706' : isDigger ? '#7e22ce' : '#be123c';
  const strokeColor = isGoal ? '#fef08a' : isDigger ? '#d8b4fe' : '#fda4af';
  const innerFill = isGoal ? '#fef3c7' : isDigger ? '#f3e8ff' : '#ffe4e6';

  return (
    <svg
      viewBox="0 0 110 105"
      className={`w-16 h-16 sm:w-20 sm:h-20 drop-shadow-[0_6px_10px_rgba(0,0,0,0.7)] overflow-visible ${
        isAlerting ? 'animate-troll-mad' : ''
      }`}
    >
      <ellipse cx="55" cy="90" rx="44" ry="10" fill="#090d16" opacity="0.55" />
      <path d="M 14 88 Q 55 78 96 88 Q 78 96 55 96 Q 32 96 14 88 Z" fill="#78350f" opacity="0.75" />

      {isOpen ? (
        <>
          <path
            d="M 16 68 C 12 36 28 14 38 18 C 44 10 55 8 55 8 C 55 8 66 10 72 18 C 82 14 98 36 94 68 Z"
            fill={topShellFill}
            stroke={strokeColor}
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
          <ellipse cx="55" cy="64" rx="34" ry="15" fill={innerFill} stroke={strokeColor} strokeWidth="1.5" />
          {[32, 43, 55, 67, 78].map((x, idx) => (
            <line
              key={idx}
              x1={x}
              y1={16 + Math.abs(idx - 2) * 3}
              x2={55 + (x - 55) * 0.65}
              y2="56"
              stroke={strokeColor}
              strokeWidth="1.4"
              opacity="0.55"
              strokeLinecap="round"
            />
          ))}

          {!isDefeated && rewardEmoji && (
            <g>
              {isMurkyFar && !isGoal ? (
                <>
                  <circle
                    cx="55"
                    cy="52"
                    r="16"
                    fill="#0f172a"
                    fillOpacity="0.88"
                    stroke="#38bdf8"
                    strokeWidth="2.2"
                  />
                  <text x="55" y="59" textAnchor="middle" fontSize="20" fill="#7dd3fc" fontWeight="bold">
                    ❓
                  </text>
                </>
              ) : (
                <>
                  <circle
                    cx="55"
                    cy="54"
                    r="16"
                    fill={isGoal ? '#fde047' : '#ffffff'}
                    opacity="0.5"
                  />
                  <SvgEmbeddedSprite
                    id={rewardId}
                    spriteSrc={rewardSpriteSrc}
                    emoji={rewardEmoji}
                    x={55}
                    y={52}
                    size={28}
                    className="drop-shadow-md"
                  />
                </>
              )}
            </g>
          )}
        </>
      ) : (
        <>
          <path
            d="M 14 70 C 16 42 32 34 55 34 C 78 34 94 42 96 70 Z"
            fill={topShellFill}
            stroke={strokeColor}
            strokeWidth="2.5"
          />
          {[30, 42, 55, 68, 80].map((x, idx) => (
            <path
              key={idx}
              d={`M ${x} 38 Q 55 52 ${x} 68`}
              stroke={strokeColor}
              strokeWidth="1.5"
              fill="none"
              opacity="0.6"
            />
          ))}
          <path
            d="M 16 70 L 26 66 L 36 71 L 46 66 L 55 71 L 64 66 L 74 71 L 84 66 L 94 70"
            fill="none"
            stroke="#fef08a"
            strokeWidth="2.2"
            strokeLinejoin="round"
          />
        </>
      )}

      <path
        d="M 14 68 C 18 86 35 92 55 92 C 75 92 92 86 96 68 Q 75 76 55 76 Q 35 76 14 68 Z"
        fill={botShellFill}
        stroke={strokeColor}
        strokeWidth="2.5"
      />
    </svg>
  );
};

export const InkCloudSVG = () => (
  <svg viewBox="0 0 100 100" className="w-20 h-20 sm:w-24 sm:h-24 animate-pulse drop-shadow-[0_0_14px_rgba(15,23,42,0.95)]">
    <circle cx="50" cy="52" r="28" fill="#0f172a" opacity="0.92" />
    <circle cx="32" cy="48" r="20" fill="#1e1b4b" opacity="0.9" />
    <circle cx="68" cy="46" r="22" fill="#1e1b4b" opacity="0.9" />
    <circle cx="44" cy="34" r="18" fill="#311042" opacity="0.85" />
    <circle cx="60" cy="66" r="18" fill="#090d16" opacity="0.9" />
    <text x="50" y="58" textAnchor="middle" fontSize="22">
      🦑
    </text>
  </svg>
);

export interface SeaWaterOverlayProps {
  variant: 'underwater' | 'shipwreck';
  isTransformed?: boolean;
}

/**
 * Shared foreground translucent water sheet, caustic light shafts, rising bubbles,
 * and animated waterline meniscus rendered IN FRONT of submerged entities (`z-[112]`).
 */
export const SeaWaterOverlay = ({
  variant,
  isTransformed = true
}: SeaWaterOverlayProps) => {
  if (variant === 'underwater') {
    return (
      <div
        data-testid="underwater-water-overlay"
        className="absolute top-[13.8%] left-0 w-full h-[86.2%] pointer-events-none z-[112] overflow-hidden"
      >
        {/* Foreground Animated Cutaway Waterline Meniscus */}
        <div className="absolute top-0 left-0 w-full h-[2.6%] overflow-hidden pointer-events-none">
          <svg
            className="absolute inset-0 w-[200%] h-full animate-surface-wave-slow"
            viewBox="0 0 400 32"
            preserveAspectRatio="none"
          >
            <path
              d="M 0 13 Q 25 4 50 13 T 100 13 T 150 13 T 200 13 T 250 13 T 300 13 T 350 13 T 400 13 L 400 32 L 0 32 Z"
              fill="#0284c7"
              opacity="0.65"
            />
          </svg>
          <svg
            className="absolute inset-0 w-[200%] h-full animate-surface-wave-fast"
            viewBox="0 0 400 32"
            preserveAspectRatio="none"
          >
            <path
              d="M 0 16 Q 25 8 50 16 T 100 16 T 150 16 T 200 16 T 250 16 T 300 16 T 350 16 T 400 16 L 400 32 L 0 32 Z"
              fill="#06b6d4"
              opacity="0.72"
            />
            <path
              d="M 0 16 Q 25 8 50 16 T 100 16 T 150 16 T 200 16 T 250 16 T 300 16 T 350 16 T 400 16"
              fill="none"
              stroke="#e0f2fe"
              strokeWidth="2.4"
              strokeLinecap="round"
            />
          </svg>
        </div>

        {/* Foreground Translucent Water Tint & Sunlit Caustic Beams */}
        <svg
          className="absolute top-[1.8%] left-0 w-full h-[98.2%]"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="uwFgWaterSheet" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.14" />
              <stop offset="45%" stopColor="#0284c7" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#030712" stopOpacity="0.24" />
            </linearGradient>
            <linearGradient id="uwFgCausticBand" x1="0%" y1="0%" x2="18%" y2="100%">
              <stop offset="0%" stopColor="#bae6fd" stopOpacity="0.2" />
              <stop offset="55%" stopColor="#38bdf8" stopOpacity="0.06" />
              <stop offset="100%" stopColor="#0284c7" stopOpacity="0" />
            </linearGradient>
          </defs>
          <rect x="0" y="0" width="100" height="100" fill="url(#uwFgWaterSheet)" />
          <polygon points="8,0 26,0 44,52 16,52" fill="url(#uwFgCausticBand)" />
          <polygon points="44,0 64,0 82,50 52,50" fill="url(#uwFgCausticBand)" />
          <polygon points="78,0 94,0 104,48 86,48" fill="url(#uwFgCausticBand)" />
        </svg>

        {/* Foreground Rising Ambient Bubbles Below Waterline */}
        <div className="absolute inset-x-0 top-[2.5%] bottom-0 overflow-hidden pointer-events-none">
          {[15, 31, 47, 64, 79, 89].map((leftPct, i) => (
            <div
              key={`uw-fg-bub-${i}`}
              className="absolute rounded-full border border-cyan-100/45 bg-white/15 animate-bubble"
              style={{
                left: `${leftPct}%`,
                top: `${12 + ((i * 15) % 72)}%`,
                width: `${5 + (i % 3) * 3}px`,
                height: `${5 + (i % 3) * 3}px`,
                animationDelay: `${i * 1.3}s`,
                animationDuration: `${9 + (i % 3) * 2.5}s`
              }}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      data-testid="shipwreck-water-overlay"
      className="absolute inset-0 pointer-events-none z-[112] overflow-hidden"
    >
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        <defs>
          <mask id="swWaterOnlyMask">
            <rect x="0" y="0" width="100" height="100" fill="white" />
            <polygon points={AIR_POCKET_POINTS} fill="black" />
          </mask>

          <linearGradient id="swWaterSheet" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.14" />
            <stop offset="45%" stopColor="#0e7490" stopOpacity="0.21" />
            <stop offset="100%" stopColor="#075985" stopOpacity="0.30" />
          </linearGradient>

          <linearGradient id="swCausticBand" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#67e8f9" stopOpacity="0.10" />
            <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Water Tint & Ambient Life Masked Strictly Outside Air Pocket */}
        <g mask="url(#swWaterOnlyMask)">
          <rect x="0" y="0" width="100" height="100" fill="url(#swWaterSheet)" />
          <polygon points="15,0 32,0 56,95 28,95" fill="url(#swCausticBand)" />
          <polygon points="52,0 64,0 82,90 60,90" fill="url(#swCausticBand)" />

          {[
            { x: 37, y: 63, dur: '13s', delay: '0s', scale: 1 },
            { x: 58, y: 49, dur: '16s', delay: '-4s', scale: 0.9 },
            { x: 74, y: 48, dur: '14s', delay: '-7s', scale: 0.95 },
            { x: 24, y: 85, dur: '17s', delay: '-2s', scale: 1.1 },
            { x: 64, y: 74, dur: '15s', delay: '-9s', scale: 0.85 }
          ].map((f, idx) => (
            <g
              key={`amb-fish-${idx}`}
              className="animate-ambient-fish"
              style={{ animationDuration: f.dur, animationDelay: f.delay }}
            >
              <path
                d={`M ${f.x} ${f.y} q ${1.3 * f.scale} ${-0.7 * f.scale} ${2.4 * f.scale} 0 q ${-1.1 * f.scale} ${0.7 * f.scale} ${-2.4 * f.scale} 0 l ${-0.8 * f.scale} ${-0.55 * f.scale} l 0 ${1.1 * f.scale} z`}
                fill="#67e8f9"
                opacity="0.45"
              />
            </g>
          ))}
        </g>

        {/* Living Multi-Wave Meniscus Across the Air Pocket Waterline */}
        <g data-testid="air-pocket-meniscus">
          <rect
            x={AIR_POCKET_LEFT_X}
            y={AIR_POCKET_Y}
            width={AIR_POCKET_RIGHT_X - AIR_POCKET_LEFT_X}
            height="2.1"
            fill="#06b6d4"
            opacity="0.34"
          />
          <g className="animate-waterline-slosh">
            <path
              d={`M ${AIR_POCKET_LEFT_X} ${AIR_POCKET_Y} Q 68.5 ${AIR_POCKET_Y - 1.0} 72 ${AIR_POCKET_Y} T 79 ${AIR_POCKET_Y} T 86 ${AIR_POCKET_Y} T ${AIR_POCKET_RIGHT_X} ${AIR_POCKET_Y}`}
              fill="none"
              stroke={isTransformed ? '#38bdf8' : '#7dd3fc'}
              strokeWidth="1.25"
              strokeLinecap="round"
            />
            <path
              d={`M ${AIR_POCKET_LEFT_X} ${AIR_POCKET_Y} Q 68.5 ${AIR_POCKET_Y - 1.0} 72 ${AIR_POCKET_Y} T 79 ${AIR_POCKET_Y} T 86 ${AIR_POCKET_Y} T ${AIR_POCKET_RIGHT_X} ${AIR_POCKET_Y}`}
              fill="none"
              stroke={isTransformed ? '#e0f2fe' : '#fef08a'}
              strokeWidth="0.55"
              strokeLinecap="round"
            />
          </g>
        </g>

        {[73, 81, 88].map((rx, idx) => (
          <ellipse
            key={`drip-ring-${idx}`}
            cx={rx}
            cy={AIR_POCKET_Y + 0.2}
            rx="1.6"
            ry="0.35"
            fill="none"
            stroke="#e0f2fe"
            strokeWidth="0.25"
            opacity="0.55"
          />
        ))}
      </svg>

      {/* True-Circle Rising Bubbles Clipped Strictly Below the Waterline */}
      <div
        className="absolute inset-x-0 bottom-0 overflow-hidden pointer-events-none"
        style={{ top: `${AIR_POCKET_Y + 0.5}%` }}
      >
        {[14, 34, 48, 61, 71, 79, 86].map((leftPct, i) => (
          <div
            key={`sw-water-bub-${i}`}
            className="absolute rounded-full border border-cyan-200/45 bg-white/15 animate-bubble"
            style={{
              left: `${leftPct}%`,
              top: `${16 + ((i * 17) % 68)}%`,
              width: `${5 + (i % 3) * 3}px`,
              height: `${5 + (i % 3) * 3}px`,
              animationDelay: `${i * 1.15}s`,
              animationDuration: `${8 + (i % 3) * 2.5}s`
            }}
          />
        ))}
      </div>
    </div>
  );
};

export const UnderwaterWaterOverlay = () => <SeaWaterOverlay variant="underwater" />;

export const ShipwreckWaterOverlay = ({ isTransformed = true }: { isTransformed?: boolean }) => (
  <SeaWaterOverlay variant="shipwreck" isTransformed={isTransformed} />
);
