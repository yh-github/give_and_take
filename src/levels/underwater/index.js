import { items, entities, mapNodes, sceneryNodes } from './data.js';
import { UnderwaterBackground, CampIcon } from './components.jsx';
import { generateUnderwaterPuzzle } from './generator.js';

const underwater = {
  id: 'underwater',
  name: 'Under the Sea',
  items,
  entities,
  mapNodes,
  sceneryNodes,
  campPos: { x: 50, y: 14 },
  mechanics: {
    hasSchoolsOfFish: true,
    hasAir: true,
    hasTransformation: true,
    hasMurkyWater: true,
    heroBobs: true,
    isVertical: true,
    screens: 3.5,
  },
  specialEntityTemplate: 'clam',
  BackgroundComponent: UnderwaterBackground,
  GatekeeperPropComponent: () => null,
  CampIcon,
  generatePuzzle: generateUnderwaterPuzzle,
};

export default underwater;
