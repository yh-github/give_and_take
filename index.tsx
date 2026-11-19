import React, { useState, useEffect } from 'react';
import LEVEL_REGISTRY from './src/levels/index.ts';
import ErrorBoundary from './src/components/ErrorBoundary.tsx';
import GameInstance from './src/components/GameInstance.tsx';
import { getAutoSaveWithStatus, clearAutoSave } from './src/logic/saveState.ts';
import STRINGS from './src/strings.ts';
import type {
  ActiveGameSettings,
  AutoSaveStatus,
  LanguageCode,
  LevelRegistry,
  SavePayload
} from './src/types/index.ts';

const LEVEL_DICTIONARY: LevelRegistry = LEVEL_REGISTRY;

export interface AppProps {
  autoResumePrompt?: boolean;
}

const App = ({ autoResumePrompt = (process.env.NODE_ENV !== 'test') }: AppProps) => {
  const isEditor = typeof window !== 'undefined' && new URLSearchParams(window.location?.search || '').get('editor') === 'true';
  const shouldPrompt = autoResumePrompt && !isEditor;

  const [initialAutoSave] = useState<AutoSaveStatus>(() => {
    if (!shouldPrompt) return { state: null, versionMismatch: false };
    const status = getAutoSaveWithStatus(LEVEL_DICTIONARY);
    if (status.versionMismatch) {
      clearAutoSave();
    }
    return status;
  });

  const [pendingResumeState, setPendingResumeState] = useState<SavePayload | null>(() => initialAutoSave.state);
  const [saveVersionWarning, setSaveVersionWarning] = useState(() => Boolean(initialAutoSave.versionMismatch));
  const [showResumePrompt, setShowResumePrompt] = useState(() => Boolean(initialAutoSave.state));
  const [activeSettings, setActiveSettings] = useState<ActiveGameSettings>(() => ({
    levelId: pendingResumeState?.levelId || 'underground',
    steps: pendingResumeState?.targetSteps || 5,
    diggers: pendingResumeState?.numDiggers ?? 1,
    deepCaveSettings: pendingResumeState?.settings || null
  }));
  const [gameKey, setGameKey] = useState(0);
  const [lang, setLang] = useState<LanguageCode>('he');
  const [savedState, setSavedState] = useState<SavePayload | null>(() => pendingResumeState);

  const dict = STRINGS[lang] || STRINGS.en;

  useEffect(() => {
    if (!shouldPrompt) return;
    if (!pendingResumeState && !saveVersionWarning) {
      const existingStatus = getAutoSaveWithStatus(LEVEL_DICTIONARY);
      if (existingStatus.versionMismatch) {
        clearAutoSave();
        setSaveVersionWarning(true);
        return;
      }
      const existing = existingStatus.state;
      if (existing) {
        setPendingResumeState(existing);
        setSavedState(existing);
        setActiveSettings({
          levelId: existing.levelId,
          steps: existing.targetSteps,
          diggers: existing.numDiggers,
          deepCaveSettings: existing.settings || null
        });
        setShowResumePrompt(true);
      }
    }
  }, [shouldPrompt, pendingResumeState, saveVersionWarning]);

  const handleContinueSaved = () => {
    setShowResumePrompt(false);
  };

  const handleStartNewGame = () => {
    clearAutoSave();
    setSavedState(null);
    setPendingResumeState(null);
    setShowResumePrompt(false);
    setGameKey(k => k + 1);
  };

  const applyAndGenerate = (newSettings: ActiveGameSettings) => {
    setActiveSettings(newSettings);
    setSavedState(null);
    setSaveVersionWarning(false);
    setGameKey(k => k + 1);
  };

  const handleLoadState = (importedState: SavePayload) => {
    setActiveSettings({
      levelId: importedState.levelId,
      steps: importedState.targetSteps,
      diggers: importedState.numDiggers,
      deepCaveSettings: importedState.settings || null
    });
    setSavedState(importedState);
    setSaveVersionWarning(false);
    setGameKey(k => k + 1);
  };

  return (
    <ErrorBoundary>
      <GameInstance 
        key={`${activeSettings.levelId}-${gameKey}`} 
        level={LEVEL_DICTIONARY[activeSettings.levelId]} 
        targetSteps={activeSettings.steps} 
        numDiggers={activeSettings.diggers} 
        deepCaveSettings={activeSettings.deepCaveSettings}
        onGenerateNew={applyAndGenerate} 
        onLoadState={handleLoadState}
        savedState={savedState}
        saveVersionWarning={saveVersionWarning}
        onDismissSaveVersionWarning={() => setSaveVersionWarning(false)}
        lang={lang} 
        setLang={setLang} 
      />

      {showResumePrompt && pendingResumeState && (
        <div 
          className="fixed inset-0 z-[400] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 font-serif" 
          dir={lang === 'he' ? 'rtl' : 'ltr'}
        >
          <div className="bg-stone-800 border-4 border-amber-600 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl flex flex-col gap-5 text-stone-200 text-center animate-in fade-in duration-300">
            <div className="flex justify-between items-center -mb-2">
              <span className="text-3xl">💾</span>
              <div className="flex gap-1.5">
                <button 
                  onClick={() => setLang('he')} 
                  className={`w-8 h-8 rounded-full border text-xs flex items-center justify-center ${lang === 'he' ? 'border-amber-400 bg-amber-950/60' : 'border-stone-600 opacity-60'}`}
                >
                  🇮🇱
                </button>
                <button 
                  onClick={() => setLang('en')} 
                  className={`w-8 h-8 rounded-full border text-xs flex items-center justify-center ${lang === 'en' ? 'border-amber-400 bg-amber-950/60' : 'border-stone-600 opacity-60'}`}
                >
                  🇺🇸
                </button>
              </div>
            </div>

            <h2 className="text-2xl sm:text-3xl font-black text-amber-500">{dict.continueTitle}</h2>
            <p className="text-sm text-stone-300 leading-relaxed">{dict.continueDesc}</p>

            <div className="bg-stone-900/90 border border-stone-700 rounded-2xl p-4 text-sm font-sans flex flex-col gap-2.5 text-stone-300 text-start">
              <div className="flex justify-between items-center">
                <span className="font-bold text-stone-400">{dict.level}</span>
                <span className="font-bold text-amber-400">{dict.levels[pendingResumeState.levelId] || pendingResumeState.levelId}</span>
              </div>
              {pendingResumeState.savedAt && (
                <div className="flex justify-between items-center text-xs text-stone-400">
                  <span>{dict.savedAt}</span>
                  <span>{new Date(pendingResumeState.savedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              )}
              <div className="flex justify-between items-center">
                <span className="font-bold text-stone-400">{dict.inventoryLabel}</span>
                <span className="flex gap-1 text-lg">
                  {pendingResumeState.inventory.length === 0 ? '—' : pendingResumeState.inventory.map((itemId, idx) => {
                    const itemObj = LEVEL_DICTIONARY[pendingResumeState.levelId]?.items.find(i => i.id === itemId);
                    return <span key={idx} title={itemObj?.name || itemId}>{itemObj?.emoji || '📦'}</span>;
                  })}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-stone-400">{dict.zonesLabel}</span>
                <span className="font-mono text-amber-400">
                  {pendingResumeState.unlockedZones?.join(', ') || '1'}
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-3 pt-2">
              <button
                onClick={handleContinueSaved}
                className="w-full bg-amber-600 hover:bg-amber-500 py-3.5 rounded-xl font-bold text-lg text-white shadow-lg border-b-4 border-amber-800 active:border-b-0 active:translate-y-1 transition-all"
              >
                {dict.continueBtn}
              </button>
              <button
                onClick={handleStartNewGame}
                className="w-full bg-stone-700 hover:bg-stone-600 py-3 rounded-xl font-bold text-base text-stone-300 shadow-lg border-b-4 border-stone-900 active:border-b-0 active:translate-y-1 transition-all"
              >
                {dict.newGameBtn}
              </button>
            </div>
          </div>
        </div>
      )}
    </ErrorBoundary>
  );
};

export default App;
