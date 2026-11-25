import React from 'react';
import { SpriteIcon } from './sprites/SpriteIcon.tsx';
import type { ItemDefinition, LevelDefinition, TranslationDictionary } from '../types/index.ts';

export interface InventoryBarProps {
  inventory: string[];
  selectedItemTypes: string[];
  toggleInventoryType: (itemId: string) => void;
  handleUndo: () => void;
  isDemonstrating: boolean;
  isAnimatingLoot: boolean;
  isRefillingAir: boolean;
  historyStack: unknown[];
  level: LevelDefinition;
  dict: TranslationDictionary;
  isInventoryFullAlert?: boolean;
}

export function InventoryBar({
  inventory,
  selectedItemTypes,
  toggleInventoryType,
  handleUndo,
  isDemonstrating,
  isAnimatingLoot,
  isRefillingAir,
  historyStack,
  level,
  dict,
  isInventoryFullAlert = false
}: InventoryBarProps) {
  const uniqueInventoryItems = Array.from(new Set(inventory));
  const uniqueCount = uniqueInventoryItems.length;
  const isFull = uniqueCount >= 4;

  return (
    <div className="w-full shrink-0 bg-stone-800 border-t-2 border-stone-700 sm:border-0 shadow-[0_-10px_30px_rgba(0,0,0,0.5)] z-[150] h-[12dvh] flex items-center justify-center relative px-[2cqw]">
      <button 
        onClick={handleUndo} 
        disabled={isDemonstrating || isAnimatingLoot || isRefillingAir || historyStack.length === 0} 
        className="bg-rose-700 p-[1.5cqw] rounded-[2cqw] text-[6cqw] hover:bg-rose-600 border-[0.5cqw] border-rose-600 hover:border-rose-500 transition-all shadow-lg text-white disabled:opacity-50 mr-[2cqw]"
        title="Undo"
      >
        ↩️
      </button>
      
      <div className={`relative flex gap-[2cqw] p-[1.5cqw] rounded-[3cqw] border-[0.5cqw] transition-all duration-300 ${
        isInventoryFullAlert
          ? 'bg-red-950/70 border-red-500 animate-inventory-shake shadow-[0_0_20px_rgba(239,68,68,0.8)]'
          : isFull
            ? 'bg-stone-900/80 border-amber-500/80 shadow-[0_0_12px_rgba(245,158,11,0.35)]'
            : 'bg-stone-900/50 border-stone-900'
      }`}>
        {/* Visual Backpack Capacity Pill (Dots for pre-reading kids) */}
        <div 
          className={`absolute -top-3 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full flex items-center gap-1.5 transition-all shadow-md select-none ${
            isInventoryFullAlert
              ? 'bg-red-600 text-white border-2 border-red-300 scale-110'
              : isFull
                ? 'bg-amber-500 text-stone-900 border border-amber-300 animate-pulse-full'
                : 'bg-stone-800/90 text-stone-300 border border-stone-700'
          }`}
          title={isFull ? (dict.inventoryFull || 'Bag Full (4/4)') : `${uniqueCount}/4`}
        >
          <span className="text-[3.2cqw] leading-none">🎒</span>
          <div className="flex gap-1 items-center">
            {[0, 1, 2, 3].map((idx) => {
              const isFilled = idx < uniqueCount;
              return (
                <span
                  key={idx}
                  className={`w-[1.8cqw] h-[1.8cqw] rounded-full transition-all ${
                    isFilled
                      ? isFull
                        ? 'bg-stone-950 shadow-[0_0_4px_rgba(0,0,0,0.5)]'
                        : 'bg-amber-400 shadow-[0_0_4px_rgba(251,191,36,0.8)]'
                      : 'bg-stone-600/70 border border-stone-500/50'
                  }`}
                />
              );
            })}
          </div>
          <span className="text-[2.6cqw] font-mono font-black tracking-tight ml-0.5">
            {uniqueCount}/4
          </span>
        </div>

        {/* Floating Bubble Alert pointing down when inventory is full */}
        {isInventoryFullAlert && (
          <div className="absolute -top-14 left-1/2 -translate-x-1/2 z-[200] pointer-events-none animate-bounce flex flex-col items-center">
            <div className="bg-amber-500 text-stone-950 border-2 border-amber-200 font-black rounded-2xl px-3 py-1 shadow-2xl flex items-center gap-1.5 text-xs sm:text-sm whitespace-nowrap">
              <span className="text-base sm:text-lg">🎒</span>
              <span className="text-red-700 text-base sm:text-lg font-black leading-none">✕</span>
              <span className="font-extrabold text-sm mx-0.5">➔</span>
              <span className="text-base sm:text-lg">{level?.id === 'underwater' ? '⛵' : level?.id === 'shipwreck' ? '⚓' : '⛺'}</span>
              <span className="font-black text-[11px] sm:text-xs ml-1 bg-amber-600/30 px-2 py-0.5 rounded text-stone-950">
                {level?.id === 'underwater'
                  ? (dict.inventoryFullTipBoat || 'Bag Full! Drop at ⛵')
                  : level?.id === 'shipwreck'
                    ? (dict.inventoryFullTipAnchor || 'Bag Full! Drop at ⚓')
                    : (dict.inventoryFullTip || 'Bag Full! Drop at ⛺')}
              </span>
            </div>
            <div className="w-3 h-3 bg-amber-500 border-b-2 border-r-2 border-amber-200 rotate-45 -mt-1.5" />
          </div>
        )}

        {[0, 1, 2, 3].map((slotIdx) => {
          const itemId = uniqueInventoryItems[slotIdx];
          let item: ItemDefinition | null | undefined = itemId ? level.items.find(x => x.id === itemId) : null;
          if (itemId === 'fish' && !item) {
            item = { id: 'fish', name: dict.items?.fish || 'Fish', emoji: '🐟' };
          }
          const count = itemId ? inventory.filter(i => i === itemId).length : 0;
          const isSelected = Boolean(item && selectedItemTypes.includes(itemId));

          return (
            <button 
              key={`slot-${slotIdx}`} 
              onClick={() => item && toggleInventoryType(itemId)} 
              disabled={!item} 
              className={`w-[14cqw] h-[14cqw] rounded-[2.5cqw] relative flex flex-col items-center justify-center transition-all ${
                isSelected 
                  ? 'bg-amber-400 border-[0.8cqw] border-amber-200 scale-105 shadow-[0_0_15px_rgba(251,191,36,0.6)] z-10' 
                  : item 
                    ? isFull 
                      ? 'bg-stone-600 border-[0.8cqw] border-amber-500/60 hover:bg-stone-500 cursor-pointer shadow-[inset_0_0_8px_rgba(245,158,11,0.2)]'
                      : 'bg-stone-600 border-[0.8cqw] border-stone-500 hover:bg-stone-500 cursor-pointer' 
                    : 'bg-stone-700/50 border-[0.8cqw] border-stone-700 border-dashed cursor-default'
              } ${isDemonstrating || isAnimatingLoot ? 'cursor-default' : ''}`}
            >
              <span className="text-[7cqw] drop-shadow-md emoji-shadow flex items-center justify-center">
                {item ? (
                  <SpriteIcon
                    id={item.spriteId || item.id}
                    spriteSrc={item.spriteSrc}
                    emoji={item.emoji}
                    alt={dict.items?.[item.id] || item.name || item.id}
                  />
                ) : ''}
              </span>
              {count > 1 && (
                <div className="absolute -bottom-[1cqw] -right-[1cqw] bg-blue-700 text-white text-[3cqw] font-black rounded-full px-[1.5cqw] py-0 border-[0.4cqw] border-blue-400 shadow-md">
                  {count}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default InventoryBar;
