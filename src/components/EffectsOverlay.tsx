import React from 'react';
import type {
  CSSCustomProperties,
  ClickIndicatorState,
  HeroBubbleBurst,
  LevelDefinition,
  TranslationDictionary,
  WaterSplashState
} from '../types/index.ts';

export interface ClickIndicatorProps {
  indicator: ClickIndicatorState | null;
  toCssX?: ((x: number) => number) | null;
  toCssY?: ((y: number) => number) | null;
}

export function ClickIndicator({ indicator, toCssX = null, toCssY = null }: ClickIndicatorProps) {
  if (!indicator) return null;
  const leftPct = toCssX ? toCssX(indicator.x) : indicator.x;
  const topPct = toCssY ? toCssY(indicator.y) : indicator.y;

  return (
    <div
      key={indicator.id}
      className="absolute pointer-events-none z-[180] -translate-x-1/2 -translate-y-1/2"
      style={{ left: `${leftPct}%`, top: `${topPct}%` }}
    >
      {indicator.isValid ? (
        <div className="relative flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border-2 border-cyan-400 bg-cyan-400/20 animate-ping absolute" />
          <div className="w-3 h-3 rounded-full bg-cyan-300 border border-white shadow-[0_0_10px_rgba(34,211,238,0.9)] animate-pulse" />
        </div>
      ) : indicator.kind === 'fish_whiff' ? (
        <div data-testid="fish-whiff-indicator" className="relative flex items-center justify-center">
          <div className="w-9 h-9 rounded-full border-2 border-cyan-300/80 bg-cyan-300/15 animate-ping absolute" />
          <span className="text-lg drop-shadow-md select-none">👐💨</span>
        </div>
      ) : indicator.kind === 'fish_spook' ? (
        <div data-testid="fish-spook-indicator" className="relative flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border-2 border-amber-300/70 bg-amber-300/10 animate-ping absolute" />
          <span className="text-lg drop-shadow-md select-none">💨</span>
        </div>
      ) : (
        <div className="relative flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border-2 border-rose-500 bg-rose-500/20 animate-ping absolute" />
          <span className="text-xl drop-shadow-md select-none">🚫</span>
        </div>
      )}
    </div>
  );
}

export interface HeroBubbleBurstsProps {
  bursts: HeroBubbleBurst[];
}

export function HeroBubbleBursts({ bursts }: HeroBubbleBurstsProps) {
  if (!bursts || bursts.length === 0) return null;

  return (
    <>
      {bursts.map(burst => (
        <div
          key={burst.id}
          className="absolute pointer-events-none z-[175] -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${burst.x}%`, top: `${burst.y}%` }}
        >
          {burst.bubbles.map(b => (
            <div
              key={b.id}
              className="absolute text-xl sm:text-2xl animate-hero-air-bubble select-none"
              style={{
                '--start-dx': `${b.dx}px`,
                '--end-dx': `${b.endDx}px`,
                animationDelay: `${b.delay}ms`,
                animationDuration: `${1.3 * b.speed}s`,
                transform: `scale(${b.scale})`,
              } as CSSCustomProperties}
            >
              🫧
            </div>
          ))}
        </div>
      ))}
    </>
  );
}

const SPLASH_DROPLETS = [
  { sx: -34, sy: -26, delay: 0, size: 7 },
  { sx: -22, sy: -36, delay: 35, size: 8 },
  { sx: -10, sy: -42, delay: 60, size: 6 },
  { sx: 0, sy: -46, delay: 20, size: 9 },
  { sx: 11, sy: -40, delay: 50, size: 6 },
  { sx: 23, sy: -34, delay: 25, size: 8 },
  { sx: 35, sy: -24, delay: 45, size: 7 },
  { sx: -16, sy: -28, delay: 90, size: 5 }
];

export interface WaterSplashBurstsProps {
  splashes: WaterSplashState[];
}

export function WaterSplashBursts({ splashes }: WaterSplashBurstsProps) {
  if (!splashes || splashes.length === 0) return null;

  return (
    <>
      {splashes.map((splash) => {
        const scale = splash.intensity === 'bounce' ? 1.25 : 1;
        return (
          <div
            key={splash.id}
            data-testid="water-splash-burst"
            className="absolute pointer-events-none z-[176] -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${splash.x}%`, top: `${splash.y}%` }}
          >
            {/* Expanding surface foam ring */}
            <div
              className="absolute left-0 top-0 w-12 h-3.5 rounded-full border-2 border-cyan-100/90 bg-cyan-300/35 animate-water-splash-ripple"
            />
            {/* Arcing water droplets */}
            {SPLASH_DROPLETS.map((d, idx) => (
              <div
                key={`drop-${idx}`}
                className="absolute rounded-full bg-gradient-to-b from-white via-cyan-200 to-sky-400 shadow-[0_0_6px_rgba(125,211,252,0.95)] animate-water-splash-drop"
                style={{
                  width: `${Math.round(d.size * scale)}px`,
                  height: `${Math.round(d.size * scale * 1.25)}px`,
                  '--sx': `${Math.round(d.sx * scale)}px`,
                  '--sy': `${Math.round(d.sy * scale)}px`,
                  animationDelay: `${d.delay}ms`
                } as CSSCustomProperties}
              />
            ))}
          </div>
        );
      })}
    </>
  );
}

export interface DrowningVignetteOverlayProps {
  isDrowning: boolean;
  isAscending?: boolean;
  dict: TranslationDictionary;
}

export function DrowningVignetteOverlay({
  isDrowning,
  isAscending = false,
  dict
}: DrowningVignetteOverlayProps) {
  if (!isDrowning) return null;

  return (
    <div
      data-testid="drowning-vignette"
      className="absolute inset-0 z-[195] pointer-events-none overflow-hidden"
    >
      {/* Pulsing Hypoxia Radial Vignette */}
      <div
        className="absolute inset-0 animate-drown-vignette"
        style={{
          background:
            'radial-gradient(circle at 50% 50%, rgba(15,23,42,0.08) 32%, rgba(88,28,135,0.42) 66%, rgba(190,18,60,0.72) 100%)',
          boxShadow: 'inset 0 0 70px rgba(244, 63, 94, 0.55)'
        }}
      />

      {/* Rising Atmospheric Distress Bubbles */}
      {[14, 30, 52, 70, 86].map((leftPct, idx) => (
        <div
          key={`vig-bub-${idx}`}
          className="absolute bottom-4 text-lg sm:text-xl animate-bubble opacity-80 select-none"
          style={{
            left: `${leftPct}%`,
            animationDelay: `${idx * 0.45}s`,
            animationDuration: `${4.2 + (idx % 3) * 0.8}s`
          }}
        >
          🫧
        </div>
      ))}

      {/* Dramatic Ascent Pill while Floating Slowly to the Surface */}
      {isAscending && (
        <div
          data-testid="drowning-ascent-banner"
          className="absolute top-16 left-1/2 -translate-x-1/2 bg-rose-950/90 border-2 border-rose-400 text-rose-100 rounded-full px-3.5 py-1 shadow-[0_0_20px_rgba(244,63,94,0.8)] flex items-center gap-1.5 text-xs sm:text-sm font-black whitespace-nowrap animate-pulse"
        >
          <span>🫧</span>
          <span className="inline-block rotate-180">😵</span>
          <span>{dict.outOfAirTitle}</span>
        </div>
      )}
    </div>
  );
}

export interface MagicTransformationOverlayProps {
  isMagicAnimating: boolean;
  playerVisualX: number;
  playerVisualY: number;
}

export function MagicTransformationOverlay({
  isMagicAnimating,
  playerVisualX,
  playerVisualY
}: MagicTransformationOverlayProps) {
  if (!isMagicAnimating) return null;

  return (
    <div className="fixed inset-0 z-[500] pointer-events-none flex items-center justify-center">
      <div className="absolute inset-0 bg-white/20 backdrop-blur-[2px] animate-pulse" />
      <div className="relative w-full h-full">
        {[...Array(40)].map((_, i) => (
          <div 
            key={i} 
            className="absolute text-4xl animate-magic-particle" 
            style={{
              left: `${playerVisualX}%`,
              top: `${playerVisualY}%`,
              '--dx': `${(Math.random() - 0.5) * 600}px`,
              '--dy': `${(Math.random() - 0.5) * 600}px`,
              '--rot': `${Math.random() * 360}deg`,
              animationDelay: `${Math.random() * 0.5}s`
            } as CSSCustomProperties}
          >
            {['✨', '🌟', '💫', '🟣', '💎'][Math.floor(Math.random() * 5)]}
          </div>
        ))}
      </div>
    </div>
  );
}

export interface VictoryCelebrationProps {
  showVictoryMsg: boolean;
  dict: TranslationDictionary;
}

export function VictoryCelebration({ showVictoryMsg, dict }: VictoryCelebrationProps) {
  if (!showVictoryMsg) return null;

  return (
    <div className="absolute inset-0 z-[100] pointer-events-none overflow-hidden">
      {[...Array(30)].map((_, i) => (
        <div 
          key={i} 
          className="absolute text-3xl animate-star-burst-infinite" 
          style={{ 
            left: `${10 + Math.random() * 80}%`, 
            top: `${10 + Math.random() * 80}%`, 
            '--tx': `${(Math.random() - 0.5) * 200}px`, 
            '--ty': `${(Math.random() - 0.5) * 200}px`, 
            animationDelay: `${Math.random() * 3}s` 
          } as CSSCustomProperties}
        >
          {['⭐', '🌟', '✨'][Math.floor(Math.random() * 3)]}
        </div>
      ))}
      <div className="absolute top-1/2 left-1/2 z-50 pointer-events-none animate-fade-out-up">
        <div className="bg-amber-100 p-6 rounded-3xl border-8 border-amber-600 text-center shadow-[0_0_80px_rgba(251,191,36,0.6)] whitespace-nowrap">
          <h2 className="text-3xl sm:text-4xl text-amber-900 font-black uppercase tracking-wider">
            {dict.questComplete}
          </h2>
        </div>
      </div>
    </div>
  );
}

export interface FogOverlayProps {
  level: LevelDefinition;
  unlockedZones: number[];
  isTransformed: boolean;
}

export function FogOverlay({ level, unlockedZones, isTransformed }: FogOverlayProps) {
  if (level.mechanics.isCaveType || !level.mechanics.hasFog) return null;

  return (
    <div className="absolute inset-0 pointer-events-none z-[120]" style={{ opacity: isTransformed ? 0.3 : 0.7 }}>
      {!unlockedZones.includes(2) && <div className="absolute left-0 w-[50%] bg-[#110c08] transition-opacity duration-1000" style={{ top: '21%', height: '22%' }} />}
      {!unlockedZones.includes(3) && <div className="absolute right-0 w-[50%] bg-[#110c08] transition-opacity duration-1000" style={{ top: '21%', height: '22%' }} />}
      {!unlockedZones.includes(4) && <div className="absolute left-0 w-[50%] bg-[#110c08] transition-opacity duration-1000" style={{ top: '45%', height: '20%' }} />}
      {!unlockedZones.includes(5) && <div className="absolute right-0 w-[50%] bg-[#110c08] transition-opacity duration-1000" style={{ top: '45%', height: '20%' }} />}
      {!unlockedZones.includes(6) && <div className="absolute left-0 right-0 w-full bg-[#110c08] transition-opacity duration-1000" style={{ top: '65%', height: '12%' }} />}
      {!unlockedZones.includes(7) && <div className="absolute left-0 right-0 w-full bg-[#110c08] transition-opacity duration-1000" style={{ top: '77%', height: '10%' }} />}
      {!unlockedZones.includes(8) && <div className="absolute left-0 right-0 w-full bg-[#110c08] transition-opacity duration-1000" style={{ top: '87%', height: '8%' }} />}
      {!unlockedZones.includes(9) && <div className="absolute left-0 right-0 w-full bg-[#110c08] transition-opacity duration-1000" style={{ top: '95%', height: '5%' }} />}
    </div>
  );
}
