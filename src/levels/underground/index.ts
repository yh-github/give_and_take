import { items, entities, mapNodes, sceneryNodes } from './data.ts';
import { CaveBackground, CampIcon, RockSVG, CAVE_WALL_VERTICES } from './components.jsx';
import { getObstacleSegments } from '../../logic/visibility.ts';
import type { LevelDefinition, MapNode, PuzzleEntity } from '../../types/index.ts';

const underground: LevelDefinition = {
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
  getObstacleSegments: (
    puzzleEntities: ReadonlyArray<MapNode | PuzzleEntity>,
    unlockedZones: readonly number[] | null | undefined,
    defeated: readonly string[] = [],
    screens = 2.5
  ) => getObstacleSegments(puzzleEntities, CAVE_WALL_VERTICES, unlockedZones, defeated, screens),
};

export default underground;
