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
  campPos: { x: 50, y: 14, depth: 3 },
  mechanics: {
    hasFish: true,
    hasSchoolsOfFish: true,
    hasAir: true,
    hasTransformation: true,
    heroBobs: true,
    isVertical: true,
    screens: 3.5,
  },
  specialEntityTemplate: null,
  BackgroundComponent: UnderwaterBackground,
  GatekeeperPropComponent: () => null,
  CampIcon,
  generatePuzzle: generateUnderwaterPuzzle,
};

export default underwater;
