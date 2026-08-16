import React from 'react';

export const GAME_VERSION = 'v1.7.10-secret-passage-sealed';

export const DEFAULT_LIGHTING = {
  radius: 50,
  blur: 1.2,
  darknessColor: '#080604',
  darknessOpacity: 0.95,
  ambientColor: '#ffaa3c',
  ambientOpacity: 0.06,
  flickerIntensity: 1.0
};

export function GenerationFailedScreen({ dict, onOpenSettings }) {
  return (
    <div className="min-h-screen bg-stone-900 flex flex-col items-center justify-center font-serif relative p-4 text-center">
      <div className="text-red-500 text-3xl font-black mb-4">{dict.genFailedTitle}</div>
      <div className="text-stone-300 max-w-md">{dict.genFailedDesc}</div>
      <button 
        onClick={onOpenSettings} 
        className="mt-8 bg-stone-700 p-4 rounded-xl text-white font-bold hover:bg-stone-600 transition-colors z-[100] relative"
      >
        {dict.openSettings}
      </button>
    </div>
  );
}

export function GeneratingScreen({ dict }) {
  return (
    <div className="min-h-screen bg-stone-900 flex flex-col items-center justify-center font-serif relative">
      <div className="absolute inset-0 bg-stone-900 opacity-80 z-40 backdrop-blur" />
      <div className="text-amber-500 text-3xl font-black z-50 animate-pulse tracking-widest uppercase shadow-black drop-shadow-lg border-y-2 border-amber-500 py-4 px-12">
        {dict.generating}
      </div>
    </div>
  );
}

export function GameMenu({
  isOpen,
  onClose,
  menuView,
  setMenuView,
  dict,
  lang,
  levelDictionary,
  menuSettings,
  setMenuSettings,
  onReplay,
  onShowSolution,
  onGenerateNew,
  isVictorious,
  isDemonstrating,
  isAnimatingLoot,
  puzzle,
  debugMode,
  setDebugMode,
  lightingSettings,
  setLightingSettings
}) {
  if (!isOpen) return null;

  return (
    <div 
      className="absolute inset-0 z-[300] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 font-serif" 
      dir={lang === 'he' ? 'rtl' : 'ltr'}
    >
      <div className="bg-stone-800 border-4 border-stone-600 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl flex flex-col gap-6 text-stone-200">
        {menuView === 'main' ? (
          <>
            <h2 className="text-3xl font-black text-amber-500 text-center border-b-2 border-stone-600 pb-4">{dict.menu}</h2>
            <button onClick={onReplay} className="w-full bg-stone-600 py-4 rounded-xl font-bold text-xl hover:bg-stone-500 shadow-lg border-b-4 border-stone-800 active:border-b-0 active:translate-y-1">{dict.restart}</button>
            <button onClick={onShowSolution} disabled={isVictorious || isDemonstrating || isAnimatingLoot || !puzzle} className="w-full bg-indigo-600 py-4 rounded-xl font-bold text-xl hover:bg-indigo-500 shadow-lg border-b-4 border-indigo-800 active:border-b-0 active:translate-y-1 disabled:opacity-50">{dict.showSolution}</button>
            <button onClick={() => setMenuView('settings')} className="w-full bg-amber-600 py-4 rounded-xl font-bold text-xl hover:bg-amber-500 shadow-lg border-b-4 border-amber-800 active:border-b-0 active:translate-y-1">{dict.generateMap}</button>
            <button onClick={onClose} className="mt-4 text-stone-400 hover:text-white font-bold tracking-widest uppercase transition-colors">{dict.resume}</button>
          </>
        ) : menuView === 'settings' ? (
          <>
            <h2 className="text-3xl font-black text-amber-500 text-center border-b-2 border-stone-600 pb-4">{dict.settings}</h2>
            <div className="space-y-4">
              <label className="flex flex-col gap-2 font-bold text-lg pt-2">
                <span>{dict.level}</span>
                <select 
                  className="w-full bg-stone-900 border-2 border-stone-600 rounded-lg p-3 outline-none focus:border-amber-500 text-amber-400" 
                  value={menuSettings.levelId} 
                  onChange={(e) => setMenuSettings({ ...menuSettings, levelId: e.target.value })}
                >
                  {Object.values(levelDictionary).map(lvl => (
                    <option key={lvl.id} value={lvl.id}>{dict.levels[lvl.id] || lvl.name}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-2 font-bold text-lg pt-2">
                <span className="flex justify-between">
                  <span>{dict.minQuestChain}</span> 
                  <span className="text-amber-400">{menuSettings.steps}</span>
                </span>
                <input 
                  type="range" 
                  min="3" 
                  max="8" 
                  value={menuSettings.steps} 
                  onChange={(e) => setMenuSettings({ ...menuSettings, steps: parseInt(e.target.value) })} 
                  className="w-full accent-amber-500 h-2 bg-stone-900 rounded-lg appearance-none cursor-pointer" 
                />
              </label>
              <label className="flex flex-col gap-2 font-bold text-lg">
                <span className="flex justify-between">
                  <span>{dict.diggersMemory}</span> 
                  <span className="text-amber-400">{menuSettings.diggers}</span>
                </span>
                <input 
                  type="range" 
                  min="0" 
                  max="3" 
                  value={menuSettings.diggers} 
                  onChange={(e) => setMenuSettings({ ...menuSettings, diggers: parseInt(e.target.value) })} 
                  className="w-full accent-amber-500 h-2 bg-stone-900 rounded-lg appearance-none cursor-pointer" 
                />
              </label>
              <button 
                onClick={() => onGenerateNew(menuSettings)} 
                className="w-full bg-amber-600 py-4 mt-2 rounded-xl font-bold text-xl hover:bg-amber-500 shadow-lg border-b-4 border-amber-800 active:border-b-0 active:translate-y-1"
              >
                {dict.genMap}
              </button>
            </div>
            <button onClick={() => setMenuView('main')} className="mt-4 text-stone-400 hover:text-white font-bold tracking-widest uppercase transition-colors">{dict.back}</button>
          </>
        ) : (
          <>
            <h2 className="text-3xl font-black text-amber-500 text-center border-b-2 border-stone-600 pb-4">{dict.lighting}</h2>
            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
              <label className="flex items-center justify-between font-bold text-lg pt-2 cursor-pointer">
                <span>{dict.specialVision}</span>
                <input 
                  type="checkbox" 
                  checked={debugMode} 
                  onChange={(e) => setDebugMode(e.target.checked)} 
                  className="w-6 h-6 accent-amber-500" 
                />
              </label>
              
              <div className="h-px bg-stone-700 my-2" />

              <label className="flex flex-col gap-1 font-bold">
                <span className="flex justify-between">
                  <span>{dict.radius}</span> 
                  <span className="text-amber-400">{lightingSettings.radius}</span>
                </span>
                <input 
                  type="range" 
                  min="10" 
                  max="100" 
                  value={lightingSettings.radius} 
                  onChange={(e) => setLightingSettings({ ...lightingSettings, radius: parseInt(e.target.value) })} 
                  className="w-full accent-amber-500" 
                />
              </label>

              <label className="flex flex-col gap-1 font-bold">
                <span className="flex justify-between">
                  <span>{dict.blur}</span> 
                  <span className="text-amber-400">{lightingSettings.blur}</span>
                </span>
                <input 
                  type="range" 
                  min="0" 
                  max="10" 
                  step="0.1" 
                  value={lightingSettings.blur} 
                  onChange={(e) => setLightingSettings({ ...lightingSettings, blur: parseFloat(e.target.value) })} 
                  className="w-full accent-amber-500" 
                />
              </label>

              <label className="flex flex-col gap-1 font-bold">
                <span className="flex justify-between">
                  <span>{dict.darknessOpacity}</span> 
                  <span className="text-amber-400">{lightingSettings.darknessOpacity}</span>
                </span>
                <input 
                  type="range" 
                  min="0" 
                  max="1" 
                  step="0.01" 
                  value={lightingSettings.darknessOpacity} 
                  onChange={(e) => setLightingSettings({ ...lightingSettings, darknessOpacity: parseFloat(e.target.value) })} 
                  className="w-full accent-amber-500" 
                />
              </label>

              <label className="flex flex-col gap-1 font-bold">
                <span className="flex justify-between">
                  <span>{dict.ambientOpacity}</span> 
                  <span className="text-amber-400">{lightingSettings.ambientOpacity}</span>
                </span>
                <input 
                  type="range" 
                  min="0" 
                  max="0.5" 
                  step="0.01" 
                  value={lightingSettings.ambientOpacity} 
                  onChange={(e) => setLightingSettings({ ...lightingSettings, ambientOpacity: parseFloat(e.target.value) })} 
                  className="w-full accent-amber-500" 
                />
              </label>

              <label className="flex flex-col gap-1 font-bold">
                <span className="flex justify-between">
                  <span>{dict.flicker}</span> 
                  <span className="text-amber-400">{lightingSettings.flickerIntensity}</span>
                </span>
                <input 
                  type="range" 
                  min="0" 
                  max="5" 
                  step="0.1" 
                  value={lightingSettings.flickerIntensity} 
                  onChange={(e) => setLightingSettings({ ...lightingSettings, flickerIntensity: parseFloat(e.target.value) })} 
                  className="w-full accent-amber-500" 
                />
              </label>

              <div className="grid grid-cols-2 gap-4">
                <label className="flex flex-col gap-1 font-bold">
                  <span>{dict.darknessColor}</span>
                  <input 
                    type="color" 
                    value={lightingSettings.darknessColor} 
                    onChange={(e) => setLightingSettings({ ...lightingSettings, darknessColor: e.target.value })} 
                    className="w-full h-10 bg-stone-900 border-2 border-stone-600 rounded cursor-pointer" 
                  />
                </label>
                <label className="flex flex-col gap-1 font-bold">
                  <span>{dict.ambientColor}</span>
                  <input 
                    type="color" 
                    value={lightingSettings.ambientColor} 
                    onChange={(e) => setLightingSettings({ ...lightingSettings, ambientColor: e.target.value })} 
                    className="w-full h-10 bg-stone-900 border-2 border-stone-600 rounded cursor-pointer" 
                  />
                </label>
              </div>

              <button 
                onClick={() => setLightingSettings(DEFAULT_LIGHTING)} 
                className="w-full bg-stone-700 py-2 mt-4 rounded-lg font-bold hover:bg-stone-600 border-b-2 border-stone-900 transition-all"
              >
                {dict.resetDefaults}
              </button>
            </div>
            <button onClick={() => setMenuView('main')} className="mt-4 text-stone-400 hover:text-white font-bold tracking-widest uppercase transition-colors">{dict.back}</button>
          </>
        )}
        <div className="text-center text-xs text-stone-500 font-mono pt-2 border-t border-stone-700/50">
          {GAME_VERSION}
        </div>
      </div>
    </div>
  );
}

export default GameMenu;
