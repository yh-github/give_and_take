import React, { useState, useEffect, useRef, type ChangeEvent, type Dispatch, type SetStateAction } from 'react';
import {
  DEEP_CAVE_PRESETS,
  DEEP_CAVE_KNOB_DEFS,
  DEFAULT_DEEP_CAVE_SETTINGS,
  detectDeepCavePresetId,
  normalizeDeepCaveSettings
} from '../levels/deep_cave/presets.ts';
import {
  SEA_PRESETS,
  SEA_KNOB_DEFS,
  detectSeaPresetId,
  normalizeSeaSettings,
  type SeaKnobKey
} from '../levels/sea_shared/presets.ts';
import type {
  ActiveGameSettings,
  DeepCaveKnobKey,
  DeepCavePresetId,
  DeepCaveSettings,
  ImportStateResult,
  LanguageCode,
  LevelRegistry,
  LightingSettings,
  MenuView,
  PuzzleData,
  TranslationDictionary
} from '../types/index.ts';

export const GAME_VERSION = 'v1.7.10-secret-passage-sealed';

export const DEFAULT_LIGHTING: LightingSettings = {
  radius: 50,
  blur: 1.2,
  darknessColor: '#080604',
  darknessOpacity: 0.95,
  ambientColor: '#ffaa3c',
  ambientOpacity: 0.06,
  flickerIntensity: 1.0
};

export interface GenerationFailedScreenProps {
  dict: TranslationDictionary;
  failureHint?: string | null;
  onOpenSettings: () => void;
}

export function GenerationFailedScreen({
  dict,
  failureHint = null,
  onOpenSettings
}: GenerationFailedScreenProps) {
  return (
    <div className="min-h-screen bg-stone-900 flex flex-col items-center justify-center font-serif relative p-4 text-center">
      <div className="text-red-500 text-3xl font-black mb-4">{dict.genFailedTitle}</div>
      <div className="text-stone-300 max-w-md">{dict.genFailedDesc}</div>
      {failureHint && (
        <div className="mt-4 max-w-md bg-amber-950/70 border border-amber-600/70 text-amber-200 px-4 py-3 rounded-xl text-sm font-sans">
          {failureHint}
        </div>
      )}
      <button 
        onClick={onOpenSettings} 
        className="mt-8 bg-stone-700 p-4 rounded-xl text-white font-bold hover:bg-stone-600 transition-colors z-[100] relative"
      >
        {dict.openSettings}
      </button>
    </div>
  );
}

export interface GeneratingScreenProps {
  dict: TranslationDictionary;
  isDeepCave?: boolean;
}

export function GeneratingScreen({ dict, isDeepCave = false }: GeneratingScreenProps) {
  const message = isDeepCave && dict.carvingCave ? dict.carvingCave : dict.generating;
  return (
    <div className="min-h-screen bg-stone-900 flex flex-col items-center justify-center font-serif relative">
      <div className="absolute inset-0 bg-stone-900 opacity-80 z-40 backdrop-blur" />
      <div className="text-amber-500 text-3xl font-black z-50 animate-pulse tracking-widest uppercase shadow-black drop-shadow-lg border-y-2 border-amber-500 py-4 px-12 text-center">
        {message}
      </div>
    </div>
  );
}

export interface GameMenuProps {
  isOpen: boolean;
  onClose: () => void;
  menuView: MenuView;
  setMenuView: Dispatch<SetStateAction<MenuView>>;
  dict: TranslationDictionary;
  lang: LanguageCode;
  levelDictionary: LevelRegistry;
  menuSettings: ActiveGameSettings;
  setMenuSettings: Dispatch<SetStateAction<ActiveGameSettings>>;
  onReplay: () => void;
  onShowSolution: () => void;
  onGenerateNew: (settings: ActiveGameSettings) => void;
  onExportState?: (() => string) | null;
  onImportState?: ((raw: string) => ImportStateResult) | null;
  isVictorious: boolean;
  isDemonstrating: boolean;
  isAnimatingLoot: boolean;
  puzzle: PuzzleData | null;
  debugMode: boolean;
  setDebugMode: Dispatch<SetStateAction<boolean>>;
  lightingSettings: LightingSettings;
  setLightingSettings: Dispatch<SetStateAction<LightingSettings>>;
  currentLevelId?: string | null;
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
  onExportState,
  onImportState,
  isVictorious,
  isDemonstrating,
  isAnimatingLoot,
  puzzle,
  debugMode,
  setDebugMode,
  lightingSettings,
  setLightingSettings,
  currentLevelId = null
}: GameMenuProps) {
  const [copied, setCopied] = useState(false);
  const [exportString, setExportString] = useState('');
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const [showAdvancedDeepCave, setShowAdvancedDeepCave] = useState(false);
  const [showAdvancedSea, setShowAdvancedSea] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const resolvedDeepCaveSettings: DeepCaveSettings = normalizeDeepCaveSettings(
    menuSettings.deepCaveSettings || DEFAULT_DEEP_CAVE_SETTINGS
  );
  const activePresetId = detectDeepCavePresetId(resolvedDeepCaveSettings);
  const resolvedSeaSettings = normalizeSeaSettings({
    targetSteps: menuSettings.steps,
    numDiggers: menuSettings.diggers
  });
  const activeSeaPresetId = detectSeaPresetId(resolvedSeaSettings);

  const handleSelectLevel = (newLevelId: string) => {
    if (newLevelId === 'deep_cave') {
      const nextDeep = normalizeDeepCaveSettings(
        menuSettings.deepCaveSettings || DEFAULT_DEEP_CAVE_SETTINGS
      );
      setMenuSettings({
        ...menuSettings,
        levelId: newLevelId,
        steps: nextDeep.targetSteps,
        diggers: nextDeep.numDiggers,
        deepCaveSettings: nextDeep
      });
    } else if (newLevelId === 'underwater' || newLevelId === 'shipwreck') {
      const nextSea = normalizeSeaSettings({
        targetSteps: menuSettings.steps,
        numDiggers: menuSettings.diggers
      });
      setMenuSettings({
        ...menuSettings,
        levelId: newLevelId,
        steps: nextSea.targetSteps,
        diggers: nextSea.numDiggers
      });
    } else {
      const clampedSteps = Math.max(3, Math.min(8, Number(menuSettings.steps) || 5));
      setMenuSettings({
        ...menuSettings,
        levelId: newLevelId,
        steps: clampedSteps
      });
    }
  };

  const handleSelectDeepCavePreset = (presetId: string) => {
    const preset = DEEP_CAVE_PRESETS[presetId as Exclude<DeepCavePresetId, 'custom'>];
    if (!preset) return;
    const normalized = normalizeDeepCaveSettings(preset);
    setMenuSettings({
      ...menuSettings,
      steps: normalized.targetSteps,
      diggers: normalized.numDiggers,
      deepCaveSettings: normalized
    });
  };

  const handleUpdateDeepCaveKnob = (key: DeepCaveKnobKey, rawValue: string) => {
    const nextDeep = normalizeDeepCaveSettings({
      ...resolvedDeepCaveSettings,
      preset: undefined,
      id: undefined,
      [key]: Number(rawValue)
    });
    setMenuSettings({
      ...menuSettings,
      steps: nextDeep.targetSteps,
      diggers: nextDeep.numDiggers,
      deepCaveSettings: nextDeep
    });
  };

  const handleUpdateSeaKnob = (key: SeaKnobKey, rawValue: string) => {
    const nextSea = normalizeSeaSettings({
      ...resolvedSeaSettings,
      [key]: Number(rawValue)
    });
    setMenuSettings({
      ...menuSettings,
      steps: nextSea.targetSteps,
      diggers: nextSea.numDiggers
    });
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError(null);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result;
      if (typeof content === 'string') {
        setImportText(content);
        const res = onImportState ? onImportState(content) : { success: false, error: 'No handler' };
        if (res && res.success) {
          setImportText('');
          setImportError(null);
          onClose();
        } else {
          setImportError(res?.error || dict.invalidState || 'Invalid state');
        }
      }
    };
    reader.onerror = () => {
      setImportError('Failed to read file');
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  useEffect(() => {
    if (menuView === 'export' && onExportState) {
      setExportString(onExportState());
    }
  }, [menuView, onExportState]);

  const handleCopy = async () => {
    const text = exportString || (onExportState ? onExportState() : '');
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const handleDownload = () => {
    const text = exportString || (onExportState ? onExportState() : '');
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `give_and_take_save_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportSubmit = () => {
    setImportError(null);
    if (!importText.trim()) {
      setImportError(dict.invalidState || 'Invalid state');
      return;
    }
    const res = onImportState ? onImportState(importText) : { success: false, error: 'No handler' };
    if (res && res.success) {
      setImportText('');
      setImportError(null);
      onClose();
    } else {
      setImportError(res?.error || dict.invalidState || 'Invalid state');
    }
  };

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
            <button onClick={onReplay} className="w-full bg-stone-600 py-3.5 rounded-xl font-bold text-lg hover:bg-stone-500 shadow-lg border-b-4 border-stone-800 active:border-b-0 active:translate-y-1">{dict.restart}</button>
            <button onClick={onShowSolution} disabled={isVictorious || isDemonstrating || isAnimatingLoot || !puzzle} className="w-full bg-indigo-600 py-3.5 rounded-xl font-bold text-lg hover:bg-indigo-500 shadow-lg border-b-4 border-indigo-800 active:border-b-0 active:translate-y-1 disabled:opacity-50">{dict.showSolution}</button>
            <button onClick={() => setMenuView('settings')} className="w-full bg-amber-600 py-3.5 rounded-xl font-bold text-lg hover:bg-amber-500 shadow-lg border-b-4 border-amber-800 active:border-b-0 active:translate-y-1">{dict.generateMap}</button>
            
            <div className="grid grid-cols-2 gap-3 pt-1">
              <button 
                onClick={() => { setCopied(false); setMenuView('export'); }} 
                className="w-full bg-emerald-700 py-3 rounded-xl font-bold text-base hover:bg-emerald-600 shadow-lg border-b-4 border-emerald-900 active:border-b-0 active:translate-y-1 transition-all"
              >
                {dict.exportState}
              </button>
              <button 
                onClick={() => { setImportError(null); setImportText(''); setMenuView('import'); }} 
                className="w-full bg-cyan-700 py-3 rounded-xl font-bold text-base hover:bg-cyan-600 shadow-lg border-b-4 border-cyan-900 active:border-b-0 active:translate-y-1 transition-all"
              >
                {dict.importState}
              </button>
            </div>

            <button onClick={onClose} className="mt-2 text-stone-400 hover:text-white font-bold tracking-widest uppercase transition-colors">{dict.resume}</button>
          </>
        ) : menuView === 'settings' ? (
          <>
            <h2 className="text-3xl font-black text-amber-500 text-center border-b-2 border-stone-600 pb-4">{dict.settings}</h2>
            <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1 custom-scrollbar">
              <label className="flex flex-col gap-2 font-bold text-lg pt-2">
                <span>{dict.level}</span>
                <select 
                  className="w-full bg-stone-900 border-2 border-stone-600 rounded-lg p-3 outline-none focus:border-amber-500 text-amber-400" 
                  value={menuSettings.levelId} 
                  onChange={(e) => handleSelectLevel(e.target.value)}
                >
                  {Object.values(levelDictionary).map(lvl => (
                    <option key={lvl.id} value={lvl.id}>{dict.levels[lvl.id] || lvl.name}</option>
                  ))}
                </select>
              </label>

              {menuSettings.levelId === 'deep_cave' ? (
                <div className="space-y-4 pt-1">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between font-bold text-base">
                      <span>{dict.difficultyPreset || 'Difficulty Preset:'}</span>
                      {activePresetId === 'custom' && (
                        <span
                          data-testid="deep-cave-custom-badge"
                          className="text-xs font-sans font-bold px-2.5 py-0.5 rounded-full bg-amber-950 border border-amber-500 text-amber-300"
                        >
                          {dict.presets?.custom || 'Custom'}
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {Object.keys(DEEP_CAVE_PRESETS).map((presetId) => {
                        const isSelected = activePresetId === presetId;
                        const label = dict.presets?.[presetId] || presetId;
                        return (
                          <button
                            key={presetId}
                            type="button"
                            data-testid={`preset-btn-${presetId}`}
                            onClick={() => handleSelectDeepCavePreset(presetId)}
                            className={`py-2 px-2 rounded-lg font-bold text-sm border-2 transition-all ${
                              isSelected
                                ? 'bg-amber-600 border-amber-400 text-white shadow-md'
                                : 'bg-stone-900 border-stone-600 text-stone-300 hover:border-stone-400'
                            }`}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="border-t border-stone-700 pt-2">
                    <button
                      type="button"
                      data-testid="toggle-advanced-settings"
                      onClick={() => setShowAdvancedDeepCave(prev => !prev)}
                      className="w-full flex items-center justify-between text-sm font-bold text-amber-300 hover:text-amber-200 py-1.5"
                    >
                      <span>{dict.advancedSettings || 'Advanced Settings'}</span>
                      <span className="font-mono">{showAdvancedDeepCave ? '▾' : '▸'}</span>
                    </button>

                    {showAdvancedDeepCave && (
                      <div className="mt-2 space-y-3 bg-stone-900/70 border border-stone-700 rounded-xl p-3">
                        {Object.entries(DEEP_CAVE_KNOB_DEFS).map(([key, def]) => {
                          const knobKey = key as DeepCaveKnobKey;
                          return (
                            <label key={key} className="flex flex-col gap-1 text-sm font-bold">
                              <span className="flex justify-between text-stone-300">
                                <span>{dict.knobs?.[knobKey] || key}</span>
                                <span className="text-amber-400 font-mono">{resolvedDeepCaveSettings[knobKey]}</span>
                              </span>
                              <input
                                type="range"
                                min={def.min}
                                max={def.max}
                                step={def.step}
                                data-testid={`knob-${key}`}
                                value={resolvedDeepCaveSettings[knobKey]}
                                onChange={(e) => handleUpdateDeepCaveKnob(knobKey, e.target.value)}
                                className="w-full accent-amber-500 h-2 bg-stone-800 rounded-lg appearance-none cursor-pointer"
                              />
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              ) : (menuSettings.levelId === 'underwater' || menuSettings.levelId === 'shipwreck') ? (
                <div className="space-y-4 pt-1">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between font-bold text-base">
                      <span>{dict.difficultyPreset || 'Difficulty Preset:'}</span>
                      {activeSeaPresetId === 'custom' && (
                        <span
                          data-testid="sea-custom-badge"
                          className="text-xs font-sans font-bold px-2.5 py-0.5 rounded-full bg-amber-950 border border-amber-500 text-amber-300"
                        >
                          {dict.presets?.custom || 'Custom'}
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {(Object.keys(SEA_PRESETS) as Array<Exclude<keyof typeof SEA_PRESETS, never>>).map((presetId) => {
                        const isSelected = activeSeaPresetId === presetId;
                        const label = dict.presets?.[presetId] || presetId;
                        return (
                          <button
                            key={presetId}
                            type="button"
                            data-testid={`sea-preset-${presetId}`}
                            onClick={() => setMenuSettings({
                              ...menuSettings,
                              steps: SEA_PRESETS[presetId].targetSteps,
                              diggers: SEA_PRESETS[presetId].numDiggers
                            })}
                            className={`py-2 px-2 rounded-lg font-bold text-sm border-2 transition-all ${
                              isSelected
                                ? 'bg-amber-600 border-amber-400 text-white shadow-md'
                                : 'bg-stone-900 border-stone-600 text-stone-300 hover:border-stone-400'
                            }`}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="border-t border-stone-700 pt-2">
                    <button
                      type="button"
                      data-testid="toggle-sea-advanced-settings"
                      onClick={() => setShowAdvancedSea(prev => !prev)}
                      className="w-full flex items-center justify-between text-sm font-bold text-amber-300 hover:text-amber-200 py-1.5"
                    >
                      <span>{dict.advancedSettings || 'Advanced Settings'}</span>
                      <span className="font-mono">{showAdvancedSea ? '▾' : '▸'}</span>
                    </button>

                    {showAdvancedSea && (
                      <div className="mt-2 space-y-3 bg-stone-900/70 border border-stone-700 rounded-xl p-3">
                        {(Object.entries(SEA_KNOB_DEFS) as Array<[SeaKnobKey, { min: number; max: number; step: number }]>).map(([knobKey, def]) => (
                          <label key={knobKey} className="flex flex-col gap-1 text-sm font-bold">
                            <span className="flex justify-between text-stone-300">
                              <span>{knobKey === 'numDiggers' ? (dict.diggersMemory || dict.knobs?.[knobKey] || knobKey) : (dict.knobs?.[knobKey] || knobKey)}</span>
                              <span className="text-amber-400 font-mono">{resolvedSeaSettings[knobKey]}</span>
                            </span>
                            <input
                              type="range"
                              min={def.min}
                              max={def.max}
                              step={def.step}
                              data-testid={`sea-knob-${knobKey}`}
                              value={resolvedSeaSettings[knobKey]}
                              onChange={(e) => handleUpdateSeaKnob(knobKey, e.target.value)}
                              className="w-full accent-amber-500 h-2 bg-stone-800 rounded-lg appearance-none cursor-pointer"
                            />
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <>
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
                </>
              )}

              <button 
                onClick={() => onGenerateNew(
                  menuSettings.levelId === 'deep_cave'
                    ? {
                        ...menuSettings,
                        steps: resolvedDeepCaveSettings.targetSteps,
                        diggers: resolvedDeepCaveSettings.numDiggers,
                        deepCaveSettings: resolvedDeepCaveSettings
                      }
                    : menuSettings
                )} 
                className="w-full bg-amber-600 py-4 mt-2 rounded-xl font-bold text-xl hover:bg-amber-500 shadow-lg border-b-4 border-amber-800 active:border-b-0 active:translate-y-1"
              >
                {dict.genMap}
              </button>
            </div>
            <button onClick={() => setMenuView('main')} className="mt-4 text-stone-400 hover:text-white font-bold tracking-widest uppercase transition-colors">{dict.back}</button>
          </>
        ) : menuView === 'export' ? (
          <>
            <h2 className="text-3xl font-black text-amber-500 text-center border-b-2 border-stone-600 pb-4">{dict.exportTitle}</h2>
            <p className="text-sm text-stone-300 text-center leading-relaxed">{dict.exportDesc}</p>
            <div className="flex flex-col gap-3">
              <textarea
                readOnly
                value={exportString}
                onFocus={(e) => e.target.select()}
                className="w-full h-44 bg-stone-900 border-2 border-stone-600 rounded-lg p-3 font-mono text-xs text-amber-300 outline-none select-all custom-scrollbar resize-none"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleCopy}
                  className="flex-1 bg-amber-600 hover:bg-amber-500 py-3 rounded-xl font-bold text-sm sm:text-base text-white shadow-lg border-b-4 border-amber-800 active:border-b-0 active:translate-y-1 transition-all"
                >
                  {copied ? dict.copied : dict.copyToClipboard}
                </button>
                <button
                  onClick={handleDownload}
                  className="bg-stone-700 hover:bg-stone-600 px-4 py-3 rounded-xl font-bold text-sm sm:text-base text-stone-200 shadow-lg border-b-4 border-stone-900 active:border-b-0 active:translate-y-1 transition-all"
                  title={dict.downloadFile}
                >
                  {dict.downloadFile}
                </button>
              </div>
            </div>
            <button onClick={() => setMenuView('main')} className="mt-2 text-stone-400 hover:text-white font-bold tracking-widest uppercase transition-colors">{dict.back}</button>
          </>
        ) : menuView === 'import' ? (
          <>
            <h2 className="text-3xl font-black text-amber-500 text-center border-b-2 border-stone-600 pb-4">{dict.importTitle}</h2>
            <p className="text-sm text-stone-300 text-center leading-relaxed">{dict.importDesc}</p>
            <div className="flex flex-col gap-3">
              <input
                type="file"
                ref={fileInputRef}
                accept=".json,application/json"
                className="hidden"
                onChange={handleFileChange}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full bg-stone-700 hover:bg-stone-600 py-3 rounded-xl font-bold text-base text-stone-100 border-2 border-stone-500 shadow-md flex items-center justify-center gap-2 active:translate-y-0.5 transition-all cursor-pointer"
              >
                {dict.uploadFile || "📁 Upload File (.json)"}
              </button>

              <div className="flex items-center gap-2 my-0.5">
                <div className="flex-1 h-px bg-stone-600" />
                <span className="text-xs text-stone-400 font-sans uppercase tracking-wider">{dict.or || "or"}</span>
                <div className="flex-1 h-px bg-stone-600" />
              </div>

              <textarea
                value={importText}
                onChange={(e) => { setImportText(e.target.value); setImportError(null); }}
                placeholder={dict.pastePlaceholder}
                className="w-full h-32 bg-stone-900 border-2 border-stone-600 rounded-lg p-3 font-mono text-xs text-stone-200 outline-none focus:border-amber-500 custom-scrollbar resize-none"
              />
              {importError && (
                <div className="bg-red-950/80 border border-red-500 text-red-200 px-3 py-2 rounded-lg text-xs font-sans">
                  ⚠️ {importError}
                </div>
              )}
              <button
                onClick={handleImportSubmit}
                className="w-full bg-cyan-700 hover:bg-cyan-600 py-3 rounded-xl font-bold text-base text-white shadow-lg border-b-4 border-cyan-900 active:border-b-0 active:translate-y-1 transition-all"
              >
                {dict.loadState}
              </button>
            </div>
            <button onClick={() => setMenuView('main')} className="mt-2 text-stone-400 hover:text-white font-bold tracking-widest uppercase transition-colors">{dict.back}</button>
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

              {(currentLevelId || menuSettings.levelId) === 'deep_cave' && dict.debugLightOverrideNote && (
                <div
                  data-testid="deep-cave-lighting-note"
                  className="bg-amber-950/60 border border-amber-600/70 text-amber-200 px-3 py-2 rounded-lg text-xs font-sans"
                >
                  {dict.debugLightOverrideNote}
                </div>
              )}

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
