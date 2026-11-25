import { MAX_AIR } from '../../constants.ts';
import { items, entities, mapNodes, sceneryNodes } from './data.ts';
import { ShipwreckBackground, ShipwreckCampIcon } from './components.tsx';
import {
  getShipwreckObstacleSegments,
  SHIPWRECK_SCREENS_X,
  SHIPWRECK_SCREENS_Y
} from './geometry.ts';
import { generateShipwreckPuzzle } from './generator.ts';
import type { LevelDefinition } from '../../types/index.ts';

const shipwreck: LevelDefinition = {
  id: 'shipwreck',
  name: 'Ship Wreck',
  items,
  entities,
  mapNodes,
  sceneryNodes,
  campPos: { x: 17, y: 81 },
  mechanics: {
    hasAir: true,
    maxAir: MAX_AIR,
    hasTransformation: true,
    startsTransformed: true,
    hasMurkyWater: true,
    hasDarkness: true,
    darknessType: 'radial',
    hasWalls: true,
    heroBobs: true,
    isVertical: true,
    screens: SHIPWRECK_SCREENS_Y,
    screensX: SHIPWRECK_SCREENS_X,
    yScaleOverride: 1
  },
  specialEntityTemplate: 'clam',
  BackgroundComponent: ShipwreckBackground,
  GatekeeperPropComponent: () => null,
  CampIcon: ShipwreckCampIcon,
  getObstacleSegments: getShipwreckObstacleSegments,
  generatePuzzle: generateShipwreckPuzzle
};

export default shipwreck;
