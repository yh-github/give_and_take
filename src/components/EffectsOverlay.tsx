import React from 'react';
import type {
  CSSCustomProperties,
  ClickIndicatorState,
  HeroBubbleBurst,
  LevelDefinition,
  TranslationDictionary
} from '../types/index.ts';

export interface ClickIndicatorProps {
  indicator: ClickIndicatorState | null;
  toCssY?: ((y: number) => number) | null;
}

export function ClickIndicator({ indicator, toCssY = null }: ClickIndicatorProps) {
  if (!indicator) return null;
  const topPct = toCssY ? toCssY(indicator.y) : indicator.y;

  return (
    <div
      key={indicator.id}
      className="absolute pointer-events-none z-[180] -translate-x-1/2 -translate-y-1/2"
      style={{ left: `${indicator.x}%`, top: `${topPct}%` }}
    >
      {indicator.isValid ? (
        <div className="relative flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border-2 border-cyan-400 bg-cyan-400/20 animate-ping absolute" />
          <div className="w-3 h-3 rounded-full bg-cyan-300 border border-white shadow-[0_0_10px_rgba(34,211,238,0.9)] animate-pulse" />
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
