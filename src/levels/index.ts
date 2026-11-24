import riverCrossing from './river_crossing/index.ts';
import underground from './underground/index.ts';
import underwater from './underwater/index.ts';
import deepCave from './deep_cave/index.ts';
import shipwreck from './shipwreck/index.ts';
import type { LevelRegistry } from '../types/index.ts';

/**
 * Central registry of all available levels.
 * To add a new level, create its module directory under src/levels/
 * and add a single import + entry here.
 */
const LEVEL_REGISTRY: LevelRegistry = {
  [riverCrossing.id]: riverCrossing,
  [underground.id]: underground,
  [underwater.id]: underwater,
  [deepCave.id]: deepCave,
  [shipwreck.id]: shipwreck,
};

export default LEVEL_REGISTRY;
