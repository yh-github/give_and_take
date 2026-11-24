import React, { useEffect, useMemo, useState } from 'react';
import { isFishItem } from '../logic/underwater.ts';
import type { LanguageCode, LevelDefinition, TranslationDictionary } from '../types/index.ts';

export interface OutOfAirModalProps {
  items: string[];
  level: LevelDefinition;
  dict: TranslationDictionary;
  lang: LanguageCode;
  onConfirmKeep: (keepItemId: string | null) => void;
}

interface OutOfAirItemEntry {
  itemId: string;
  count: number;
  emoji: string;
  name: string;
  isFish: boolean;
}

export function OutOfAirModal({
  items,
  level,
  dict,
  lang,
  onConfirmKeep
}: OutOfAirModalProps) {
  const uniqueEntries = useMemo<OutOfAirItemEntry[]>(() => {
    const counts = new Map<string, number>();
    items.forEach((id) => {
      counts.set(id, (counts.get(id) || 0) + 1);
    });

    return Array.from(counts.entries()).map(([itemId, count]) => {
      const def = level.items.find((i) => i.id === itemId);
      const fallbackEmoji = itemId === 'gold_fish' ? '🐠' : itemId === 'fish' ? '🐟' : '❓';
      return {
        itemId,
        count,
        emoji: def?.emoji || fallbackEmoji,
        name: dict.items?.[itemId] || def?.name || itemId,
        isFish: isFishItem(itemId)
      };
    });
  }, [items, level.items, dict.items]);

  const needsChoice = items.length > 1;
  const hasFish = uniqueEntries.some((entry) => entry.isFish);

  const [selectedKeepId, setSelectedKeepId] = useState<string | null>(() =>
    uniqueEntries.length === 1 ? uniqueEntries[0].itemId : null
  );

  useEffect(() => {
    setSelectedKeepId(uniqueEntries.length === 1 ? uniqueEntries[0].itemId : null);
  }, [items, uniqueEntries]);

  const singleEntry = items.length === 1 ? uniqueEntries[0] : null;
  const canConfirm = !needsChoice || selectedKeepId !== null;
  const isShipwreck = level.id === 'shipwreck';
  const singleItemText = isShipwreck ? (dict.outOfAirWitchSingle || dict.outOfAirSingleItem) : dict.outOfAirSingleItem;
  const emptyText = isShipwreck ? (dict.outOfAirWitchEmpty || dict.outOfAirEmpty) : dict.outOfAirEmpty;
  const returnBtnText = isShipwreck ? (dict.outOfAirWitchBtn || dict.outOfAirSurfaceBtn) : dict.outOfAirSurfaceBtn;

  return (
    <div
      data-testid="out-of-air-modal"
      role="dialog"
      aria-modal="true"
      dir={lang === 'he' ? 'rtl' : 'ltr'}
      onClick={(e) => e.stopPropagation()}
      className="absolute inset-0 z-[260] bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4 font-sans"
    >
      <div className="w-full max-w-sm rounded-3xl bg-gradient-to-b from-sky-950 to-slate-900 border-2 border-cyan-400/80 shadow-[0_0_40px_rgba(6,182,212,0.45)] p-5 text-center text-white">
        <div className="text-4xl mb-1 flex items-center justify-center gap-2 select-none">
          <span>😵</span>
          <span>🫧</span>
        </div>
        <h2 className="text-xl sm:text-2xl font-black text-cyan-200 tracking-wide">
          {dict.outOfAirTitle}
        </h2>

        {needsChoice ? (
          <>
            <p className="mt-2 text-xs sm:text-sm text-sky-100 leading-snug">
              {dict.outOfAirChooseKeep}
            </p>
            {hasFish && (
              <p className="mt-1.5 text-[11px] sm:text-xs font-bold text-amber-300 bg-amber-950/50 border border-amber-500/40 rounded-lg px-2 py-1 inline-block">
                🐟 {dict.outOfAirFishLostHint}
              </p>
            )}

            <div className="mt-4 grid grid-cols-2 gap-2.5">
              {uniqueEntries.map((entry) => {
                const isSelected = selectedKeepId === entry.itemId;
                const isDimmed = selectedKeepId !== null && !isSelected;

                return (
                  <button
                    key={entry.itemId}
                    type="button"
                    data-testid={`out-of-air-item-${entry.itemId}`}
                    onClick={() => setSelectedKeepId(entry.itemId)}
                    className={`relative rounded-2xl p-3 border-2 transition-all flex flex-col items-center justify-center gap-1 cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-900/60 border-emerald-400 shadow-[0_0_16px_rgba(52,211,153,0.65)] scale-[1.03]'
                        : isDimmed
                          ? 'bg-slate-900/60 border-slate-700/70 opacity-65 hover:opacity-90'
                          : 'bg-sky-900/40 border-cyan-500/50 hover:border-cyan-300 hover:bg-sky-800/50'
                    }`}
                  >
                    {entry.count > 1 && (
                      <span className="absolute top-1.5 right-1.5 bg-blue-700 text-white text-[10px] font-black rounded-full px-1.5 py-0.5 border border-blue-400">
                        x{entry.count}
                      </span>
                    )}
                    <span className="text-3xl sm:text-4xl drop-shadow-md emoji-shadow">{entry.emoji}</span>
                    <span className="text-xs sm:text-sm font-bold text-white leading-tight">{entry.name}</span>

                    {selectedKeepId !== null && (
                      <span
                        className={`mt-0.5 text-[10px] font-black px-2 py-0.5 rounded-full ${
                          isSelected
                            ? 'bg-emerald-500/30 text-emerald-200 border border-emerald-400/60'
                            : entry.isFish
                              ? 'bg-rose-900/60 text-rose-200 border border-rose-500/50'
                              : 'bg-sky-900/70 text-cyan-200 border border-cyan-400/40'
                        }`}
                      >
                        {isSelected
                          ? `✓ ${dict.outOfAirKeepBadge}`
                          : entry.isFish
                            ? `💨 ${dict.outOfAirFishGone}`
                            : `🫧 ${dict.outOfAirDropFloat}`}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <div className="mt-3 mb-1 flex flex-col items-center gap-2">
            {singleEntry ? (
              <>
                <div className="w-16 h-16 rounded-2xl bg-sky-900/60 border-2 border-cyan-400/60 flex items-center justify-center text-4xl shadow-lg">
                  {singleEntry.emoji}
                </div>
                <p className="text-xs sm:text-sm text-sky-100">{singleItemText}</p>
              </>
            ) : (
              <p className="text-xs sm:text-sm text-sky-100">{emptyText}</p>
            )}
          </div>
        )}

        <button
          type="button"
          data-testid="out-of-air-confirm"
          disabled={!canConfirm}
          onClick={() => onConfirmKeep(needsChoice ? selectedKeepId : (items[0] ?? null))}
          className="mt-4 w-full py-2.5 px-4 rounded-2xl font-black text-sm sm:text-base transition-all bg-gradient-to-r from-cyan-500 to-sky-500 hover:from-cyan-400 hover:to-sky-400 text-slate-950 shadow-lg disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          {returnBtnText}
        </button>
      </div>
    </div>
  );
}

export default OutOfAirModal;
