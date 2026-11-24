import { items, entities, mapNodes, sceneryNodes } from './data.ts';
import { ShipwreckBackground, ShipwreckCampIcon } from './components.tsx';
import { getShipwreckObstacleSegments, SHIPWRECK_SCREENS } from './geometry.ts';
import { generateShipwreckPuzzle } from './generator.ts';
import type { LevelDefinition } from '../../types/index.ts';

const shipwreck: LevelDefinition = {
  id: 'shipwreck',
  name: 'Ship Wreck',
  items,
  entities,
  mapNodes,
  sceneryNodes,
  campPos: { x: 36, y: 91 },
  mechanics: {
    hasAir: true,
    maxAir: 16,
    hasTransformation: true,
    startsTransformed: true,
    hasMurkyWater: true,
    hasDarkness: true,
    darknessType: 'radial',
    hasWalls: true,
    heroBobs: true,
    isVertical: true,
    screens: SHIPWRECK_SCREENS
  },
  specialEntityTemplate: 'clam',
  BackgroundComponent: ShipwreckBackground,
  GatekeeperPropComponent: () => null,
  CampIcon: ShipwreckCampIcon,
  getObstacleSegments: getShipwreckObstacleSegments,
  generatePuzzle: generateShipwreckPuzzle
};

export default shipwreck;
