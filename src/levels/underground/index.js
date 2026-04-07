import { items, entities, mapNodes, sceneryNodes } from './data.js';
import { CaveBackground, CampIcon } from './components.jsx';

const underground = {
  id: 'underground',
  name: 'The Cave',
  items,
  entities,
  mapNodes,
  sceneryNodes,
  campPos: { x: 50, y: 2 },
  mechanics: {
    hasPickaxe: true,
    hasDarkness: true,
    darknessType: 'radial',
    hasFog: true,
    isVertical: true,
    screens: 2.5,
  },
  specialEntityTemplate: 'mole',
  BackgroundComponent: CaveBackground,
  GatekeeperPropComponent: () => null,
  CampIcon,
};

export default underground;
