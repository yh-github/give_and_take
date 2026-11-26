import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FISHING_CATCH_CONFIG, MERMAN_TIMING_TOLERANCE_MULT } from '../constants.ts';
import { evaluateFishingCatch } from '../logic/underwater.ts';
import { SpriteIcon } from './sprites/SpriteIcon.tsx';
import type { LanguageCode, TranslationDictionary } from '../types/index.ts';

export interface FishingCatchOverlayProps {
  fishType: string;
  fishEmoji: string;
  fishName: string;
  isTransformed?: boolean;
  dict: TranslationDictionary;
  lang: LanguageCode;
  onResolve: (caught: boolean) => void;
}

export function FishingCatchOverlay({
  fishType,
  fishEmoji,
  fishName,
  isTransformed = false,
  dict,
  lang,
  onResolve
}: FishingCatchOverlayProps) {
  const cfg =
    FISHING_CATCH_CONFIG[fishType as keyof typeof FISHING_CATCH_CONFIG] ||
    FISHING_CATCH_CONFIG.fish;

  const [progress, setProgress] = useState(0);
  const [resultStatus, setResultStatus] = useState<'active' | 'caught' | 'miss'>('active');
  const startTimeRef = useRef<number>(performance.now());
  const resolvedRef = useRef(false);
  const resolveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const finishWithResult = useCallback(
    (caught: boolean) => {
      if (resolvedRef.current) return;
      resolvedRef.current = true;
      setResultStatus(caught ? 'caught' : 'miss');
      resolveTimerRef.current = setTimeout(() => {
        onResolve(caught);
      }, 220);
    },
    [onResolve]
  );

  useEffect(() => {
    startTimeRef.current = performance.now();
    resolvedRef.current = false;
    setProgress(0);
    setResultStatus('active');

    let frameId = 0;
    const tick = () => {
      if (resolvedRef.current) return;
      const elapsed = performance.now() - startTimeRef.current;
      const nextProgress = Math.min(1, Math.max(0, elapsed / cfg.durationMs));
      setProgress(nextProgress);

      if (nextProgress >= 1) {
        finishWithResult(false);
        return;
      }
      frameId = requestAnimationFrame(tick);
    };

    frameId = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frameId);
      if (resolveTimerRef.current) clearTimeout(resolveTimerRef.current);
    };
  }, [cfg.durationMs, finishWithResult]);

  const handleTap = useCallback(
    (e?: React.MouseEvent) => {
      e?.stopPropagation();
      if (resolvedRef.current) return;
      const elapsed = performance.now() - startTimeRef.current;
      const liveProgress = Math.min(1, Math.max(0, elapsed / cfg.durationMs));
      const { caught } = evaluateFishingCatch(liveProgress, fishType, isTransformed);
      finishWithResult(caught);
    },
    [cfg.durationMs, fishType, isTransformed, finishWithResult]
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        handleTap();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleTap]);

  // Visual ring radius shrinks linearly from 52 down to 8 in SVG viewBox 0..120 (golden target at r=30)
  const ringRadius = Math.max(8, 52 - progress * 44);
  const targetRadius = 30;
  const effectiveTolerance = isTransformed
    ? cfg.tolerance * MERMAN_TIMING_TOLERANCE_MULT
    : cfg.tolerance;
  const bandStrokeWidth = Math.max(8, effectiveTolerance * 44 * 2);

  return (
    <div
      data-testid="fishing-catch-overlay"
      role="dialog"
      aria-modal="true"
      dir={lang === 'he' ? 'rtl' : 'ltr'}
      onClick={(e) => handleTap(e)}
      className="absolute inset-0 z-[255] bg-slate-950/60 backdrop-blur-[2px] flex items-center justify-center p-4 select-none cursor-pointer font-sans"
    >
      <button
        type="button"
        data-testid="fishing-catch-button"
        data-progress={progress.toFixed(3)}
        onClick={(e) => handleTap(e)}
        className="w-60 rounded-3xl bg-sky-950/95 border-2 border-cyan-400/80 shadow-[0_0_32px_rgba(34,211,238,0.45)] p-4 flex flex-col items-center gap-2 text-white cursor-pointer"
      >
        <div className="text-xs font-bold uppercase tracking-wider text-cyan-200">{fishName}</div>

        <div className="relative w-36 h-36 flex items-center justify-center">
          <svg viewBox="0 0 120 120" className="w-full h-full overflow-visible">
            {/* Sweet-spot emerald tolerance band around target radius */}
            <circle
              cx="60"
              cy="60"
              r={targetRadius}
              fill="none"
              stroke="rgba(52, 211, 153, 0.25)"
              strokeWidth={bandStrokeWidth}
            />
            {/* Crisp golden target ring (progress = 0.5) */}
            <circle
              cx="60"
              cy="60"
              r={targetRadius}
              fill="none"
              stroke="#fbbf24"
              strokeWidth="2.8"
              strokeDasharray="6 4"
            />
            {/* Closing timing ring */}
            <circle
              cx="60"
              cy="60"
              r={ringRadius}
              fill="none"
              stroke={
                resultStatus === 'caught'
                  ? '#34d399'
                  : resultStatus === 'miss'
                    ? '#f43f5e'
                    : '#38bdf8'
              }
              strokeWidth="3.5"
            />
          </svg>

          <span className="absolute text-5xl drop-shadow-lg pointer-events-none flex items-center justify-center">
            <SpriteIcon id={fishType} emoji={fishEmoji} alt={fishName} />
          </span>
        </div>

        <div
          className={`px-3 py-1 rounded-full text-xs sm:text-sm font-black ${
            resultStatus === 'caught'
              ? 'bg-emerald-500 text-slate-950'
              : resultStatus === 'miss'
                ? 'bg-rose-600 text-white'
                : 'bg-cyan-500/20 text-amber-200 border border-amber-400/50'
          }`}
        >
          {resultStatus === 'caught'
            ? `✓ ${dict.fishingCaught}`
            : resultStatus === 'miss'
              ? `💨 ${dict.fishingEscaped}`
              : dict.fishingTapNow}
        </div>
      </button>
    </div>
  );
}

export default FishingCatchOverlay;
