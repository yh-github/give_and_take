import React from 'react';

export function TopBar({
  lang,
  setLang,
  levelId,
  isMenuOpen,
  menuView,
  onOpenMenu,
  onOpenLighting
}) {
  return (
    <>
      <div className="absolute top-3 left-3 z-[150] flex gap-1.5 items-center">
        <button 
          onClick={(e) => { e.stopPropagation(); setLang('he'); }} 
          className={`w-9 h-9 rounded-full border-2 ${lang === 'he' ? 'border-amber-400 scale-105 shadow-lg' : 'border-stone-600 opacity-50'} flex items-center justify-center bg-stone-800 transition-all`}
          title="עברית"
        >
          🇮🇱
        </button>
        <button 
          onClick={(e) => { e.stopPropagation(); setLang('en'); }} 
          className={`w-9 h-9 rounded-full border-2 ${lang === 'en' ? 'border-amber-400 scale-105 shadow-lg' : 'border-stone-600 opacity-50'} flex items-center justify-center bg-stone-800 transition-all`}
          title="English"
        >
          🇺🇸
        </button>
        {(levelId === 'underground' || levelId === 'deep_cave') && (
          <button 
            onClick={(e) => { e.stopPropagation(); onOpenLighting(); }} 
            className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full border-2 ${menuView === 'lighting' && isMenuOpen ? 'border-amber-400 bg-amber-900/40 text-amber-500 scale-105 shadow-lg' : 'border-stone-600 opacity-70 text-stone-400'} flex items-center justify-center bg-stone-800 transition-all font-bold`}
            title="Lighting Settings"
          >
            👁️
          </button>
        )}
      </div>

      <button 
        onClick={(e) => { e.stopPropagation(); onOpenMenu(); }} 
        className="absolute top-3 right-3 z-[150] bg-stone-800 text-stone-200 w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center rounded-full border-2 border-stone-600 shadow-lg hover:bg-stone-700 transition-colors"
        title="Settings Menu"
      >
        <span className="text-xl pt-0.5">⚙️</span>
      </button>
    </>
  );
}

export default TopBar;
