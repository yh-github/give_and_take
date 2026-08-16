import React, { useState } from 'react';
import LEVEL_REGISTRY from './src/levels/index.js';
import ErrorBoundary from './src/components/ErrorBoundary.jsx';
import GameInstance from './src/components/GameInstance.jsx';

const LEVEL_DICTIONARY = LEVEL_REGISTRY;

const App = () => {
  const [activeSettings, setActiveSettings] = useState({ levelId: 'underground', steps: 5, diggers: 1 });
  const [gameKey, setGameKey] = useState(0);
  const [lang, setLang] = useState('he');

  const applyAndGenerate = (newSettings) => {
    setActiveSettings(newSettings);
    setGameKey(k => k + 1);
  };

  return (
    <ErrorBoundary>
      <GameInstance 
        key={`${activeSettings.levelId}-${gameKey}`} 
        level={LEVEL_DICTIONARY[activeSettings.levelId]} 
        targetSteps={activeSettings.steps} 
        numDiggers={activeSettings.diggers} 
        onGenerateNew={applyAndGenerate} 
        lang={lang} 
        setLang={setLang} 
      />
    </ErrorBoundary>
  );
};

export default App;
