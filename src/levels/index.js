import riverCrossing from './river_crossing/index.js';
import underground from './underground/index.js';
import underwater from './underwater/index.js';

/**
 * Central registry of all available levels.
 * To add a new level, create its module directory under src/levels/
 * and add a single import + entry here.
 */
const LEVEL_REGISTRY = {
  [riverCrossing.id]: riverCrossing,
  [underground.id]: underground,
  [underwater.id]: underwater,
};

export default LEVEL_REGISTRY;
