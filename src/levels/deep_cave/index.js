import { items, entities } from './data.js';
import { DeepCaveBackground, CampIcon, DeepCaveRockSVG, ChasmSVG } from './components.jsx';
import { getProceduralObstacleSegments } from '../../logic/visibility.ts';
import { generateDeepCavePuzzle } from './generator.js';
import { DEEP_CAVE_PRESETS, DEFAULT_DEEP_CAVE_SETTINGS } from './presets.js';

const deepCave = {
  id: 'deep_cave',
  name: 'The Abyssal Descent',
  items,
  entities,
  mapNodes: [],
  sceneryNodes: [],
  campPos: { x: 50, y: 20 },
  presets: DEEP_CAVE_PRESETS,
  defaultSettings: DEFAULT_DEEP_CAVE_SETTINGS,
  mechanics: {
    isCaveType: true,
    hasPickaxe: true,
    hasDarkness: true,
    darknessType: 'radial',
    hasFog: false,
    isVertical: true,
    useIsotropicCoords: true,
    supportsProceduralWorker: true,
    screens: 3.4
  },
  specialEntityTemplate: 'mole',
  BackgroundComponent: DeepCaveBackground,
  RockComponent: DeepCaveRockSVG,
  ChasmComponent: ChasmSVG,
  GatekeeperPropComponent: () => null,
  CampIcon,
  generatePuzzle: generateDeepCavePuzzle,
  getObstacleSegments: (puzzleEntities, unlockedZonesOrGeometry, defeated = [], _screens = 1, maybeGeometry = null) => {
    const isFiveArgCall = maybeGeometry !== null || Array.isArray(unlockedZonesOrGeometry);
    const geometry = isFiveArgCall ? maybeGeometry : unlockedZonesOrGeometry;
    const actualDefeated = Array.isArray(defeated) ? defeated : [];
    return getProceduralObstacleSegments(puzzleEntities, geometry, actualDefeated);
  }
};

export default deepCave;
