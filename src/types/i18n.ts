/**
 * Internationalization (i18n) dictionary types.
 */

export type LanguageCode = 'en' | 'he';

export type PresetNameKey = 'easy' | 'normal' | 'hard' | 'expert' | 'custom';

export type DeepCaveKnobKey =
  | 'targetSteps'
  | 'rows'
  | 'cols'
  | 'branchingFactor'
  | 'spurCount'
  | 'decoyCount'
  | 'pickaxeSurplus'
  | 'maxBacktracks'
  | 'maxBacktrackRows'
  | 'numDiggers'
  | 'encounterCount'
  | 'torchRadius';

export interface TranslationDictionary {
  menu: string;
  restart: string;
  showSolution: string;
  generateMap: string;
  resume: string;
  exportState: string;
  importState: string;
  exportTitle: string;
  exportDesc: string;
  copyToClipboard: string;
  copied: string;
  downloadFile: string;
  importTitle: string;
  importDesc: string;
  loadState: string;
  pastePlaceholder: string;
  invalidState: string;
  uploadFile: string;
  continueTitle: string;
  continueDesc: string;
  continueBtn: string;
  newGameBtn: string;
  savedAt: string;
  inventoryLabel: string;
  zonesLabel: string;
  inventoryFull: string;
  inventoryFullTip: string;
  inventoryFullTipBoat: string;
  inventoryFullTipAnchor: string;
  outOfAirTitle: string;
  outOfAirChooseKeep: string;
  outOfAirFishLostHint: string;
  outOfAirSingleItem: string;
  outOfAirEmpty: string;
  outOfAirWitchSingle: string;
  outOfAirWitchEmpty: string;
  outOfAirWitchBtn: string;
  outOfAirAirPocketSingle: string;
  outOfAirAirPocketEmpty: string;
  outOfAirAirPocketBtn: string;
  outOfAirLostAtSea: string;
  outOfAirRestartBtn: string;
  outOfAirKeepBadge: string;
  outOfAirDropFloat: string;
  outOfAirFishGone: string;
  outOfAirSurfaceBtn: string;
  fishingTapNow: string;
  fishingCaught: string;
  fishingEscaped: string;
  airPocketBlocked: string;
  settings: string;
  level: string;
  minQuestChain: string;
  diggersMemory: string;
  genMap: string;
  back: string;
  genFailedTitle: string;
  genFailedDesc: string;
  openSettings: string;
  generating: string;
  dropItem: string;
  blocked: string;
  exit: string;
  deeperCaveExit: string;
  descendDeeper: string;
  questComplete: string;
  entities: Record<string, string>;
  items: Record<string, string>;
  levels: Record<string, string>;
  carvingCave: string;
  difficultyPreset: string;
  presets: Record<PresetNameKey, string> & Record<string, string>;
  advancedSettings: string;
  knobs: Record<DeepCaveKnobKey, string> & Record<string, string>;
  deepCaveTimeoutHint: string;
  debugLightOverrideNote: string;
  saveVersionMismatch: string;
  or: string;
  lighting: string;
  specialVision: string;
  radius: string;
  blur: string;
  darknessColor: string;
  darknessOpacity: string;
  ambientColor: string;
  ambientOpacity: string;
  flicker: string;
  resetDefaults: string;
  classicEdition: string;
}

export type TranslationsMap = Record<LanguageCode, TranslationDictionary>;
