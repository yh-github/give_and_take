import { items, entities, mapNodes, sceneryNodes } from './data.ts';
import {
  CaveBackground,
  CampIcon,
  ChasmSVG,
  RockSVG,
  CAVE_WALL_VERTICES,
  getUndergroundObstaclePolygons
} from './components.tsx';
import { generateUndergroundPuzzle } from './generator.ts';
import { UNDERGROUND_PRESETS, DEFAULT_UNDERGROUND_SETTINGS } from '../cave_shared/presets.ts';
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
  presets: UNDERGROUND_PRESETS,
  defaultSettings: DEFAULT_UNDERGROUND_SETTINGS,
  mechanics: {
    isCaveType: true,
    hasPickaxe: true,
    hasDarkness: true,
    darknessType: 'radial',
    hasFog: false,
    isVertical: true,
    screens: 2.5,
    nextLevelId: 'deep_cave',
  },
  specialEntityTemplate: 'mole',
  BackgroundComponent: CaveBackground,
  RockComponent: RockSVG,
  ChasmComponent: ChasmSVG,
  GatekeeperPropComponent: () => null,
  CampIcon,
  generatePuzzle: generateUndergroundPuzzle,
  getObstaclePolygons: (screens = 2.5) => getUndergroundObstaclePolygons(screens),
  getObstacleSegments: (
    puzzleEntities: ReadonlyArray<MapNode | PuzzleEntity>,
    unlockedZones: readonly number[] | null | undefined,
    defeated: readonly string[] = [],
    screens = 2.5
  ) => getObstacleSegments(puzzleEntities, CAVE_WALL_VERTICES, unlockedZones, defeated, screens),
};

export default underground;
