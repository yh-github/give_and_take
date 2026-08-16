import React from 'react';

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
  dict
}) {
  const uniqueInventoryItems = Array.from(new Set(inventory));

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
      
      <div className="flex gap-[2cqw] bg-stone-900/50 p-[1.5cqw] rounded-[3cqw] border-[0.5cqw] border-stone-900">
        {[0, 1, 2, 3].map((slotIdx) => {
          const itemId = uniqueInventoryItems[slotIdx];
          let item = itemId ? level.items.find(x => x.id === itemId) : null;
          if (itemId === 'fish' && !item) {
            item = { id: 'fish', name: dict.items?.fish || 'Fish', emoji: '🐟' };
          }
          const count = itemId ? inventory.filter(i => i === itemId).length : 0;
          const isSelected = item && selectedItemTypes.includes(itemId);

          return (
            <button 
              key={`slot-${slotIdx}`} 
              onClick={() => item && toggleInventoryType(itemId)} 
              disabled={!item} 
              className={`w-[14cqw] h-[14cqw] rounded-[2.5cqw] relative flex flex-col items-center justify-center transition-all ${
                isSelected 
                  ? 'bg-amber-400 border-[0.8cqw] border-amber-200 scale-105 shadow-[0_0_15px_rgba(251,191,36,0.6)] z-10' 
                  : item 
                    ? 'bg-stone-600 border-[0.8cqw] border-stone-500 hover:bg-stone-500 cursor-pointer' 
                    : 'bg-stone-700/50 border-[0.8cqw] border-stone-700 border-dashed cursor-default'
              } ${isDemonstrating || isAnimatingLoot ? 'cursor-default' : ''}`}
            >
              <span className="text-[7cqw] drop-shadow-md emoji-shadow">{item ? item.emoji : ''}</span>
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
