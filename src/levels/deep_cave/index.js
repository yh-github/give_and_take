import { items, entities } from './data.js';
import { DeepCaveBackground, CampIcon, RockSVG, ChasmSVG } from './components.jsx';
import { getProceduralObstacleSegments } from '../../logic/visibility.js';
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
    hasFog: true,
    isVertical: true,
    useIsotropicCoords: true,
    supportsProceduralWorker: true,
    screens: 3.4
  },
  specialEntityTemplate: 'mole',
  BackgroundComponent: DeepCaveBackground,
  RockComponent: RockSVG,
  ChasmComponent: ChasmSVG,
  GatekeeperPropComponent: () => null,
  CampIcon,
  generatePuzzle: generateDeepCavePuzzle,
  getObstacleSegments: (puzzleEntities, geometry, defeated = []) =>
    getProceduralObstacleSegments(puzzleEntities, geometry, defeated)
};

export default deepCave;
