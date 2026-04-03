import { items, entities, mapNodes, sceneryNodes } from './data.js';
import { RiverBackground, BridgeSVG, CampIcon } from './components.jsx';

const riverCrossing = {
  id: 'river_crossing',
  name: 'River Crossing',
  items,
  entities,
  mapNodes,
  sceneryNodes,
  campPos: { x: 50, y: 92 },
  mechanics: {
    hasFish: true,
    gatekeeperId: 'troll',
    darknessType: 'horizontal',
  },
  specialEntityTemplate: 'dog',
  BackgroundComponent: RiverBackground,
  GatekeeperPropComponent: BridgeSVG,
  CampIcon,
};

export default riverCrossing;
