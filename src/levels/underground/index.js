import { items, entities, mapNodes, sceneryNodes } from './data.js';
import { CaveBackground, CampIcon, RockSVG, CAVE_WALL_VERTICES } from './components.jsx';
import { getObstacleSegments } from '../../logic/visibility.js';

const underground = {
  id: 'underground',
  name: 'Underground',
  items,
  entities,
  mapNodes,
  sceneryNodes,
  campPos: { x: 50, y: 2 },
  mechanics: {
    isCaveType: true,
    hasPickaxe: true,
    hasDarkness: true,
    darknessType: 'radial',
    hasFog: true,
    isVertical: true,
    screens: 2.5,
  },
  specialEntityTemplate: 'mole',
  BackgroundComponent: CaveBackground,
  RockComponent: RockSVG,
  GatekeeperPropComponent: () => null,
  CampIcon,
  getObstacleSegments: (puzzleEntities, unlockedZones, defeated, screens = 2.5) =>
    getObstacleSegments(puzzleEntities, CAVE_WALL_VERTICES, unlockedZones, defeated, screens),
};

export default underground;
