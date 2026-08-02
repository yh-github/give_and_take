import { items, entities, mapNodes, sceneryNodes } from './data.js';
import { CaveBackground, CampIcon, RockSVG, CAVE_WALL_VERTICES } from './components.jsx';
import { getCorridorBounds } from '../../logic/geometry.js';

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
  getObstacleSegments: (puzzleEntities, unlockedZones, defeated, screens = 2.5) => {
    const segments = [];
    const height = screens * 100;

    // 1. Map Boundaries
    segments.push({ a: { x: 0, y: 0 }, b: { x: 100, y: 0 } });
    segments.push({ a: { x: 100, y: 0 }, b: { x: 100, y: height } });
    segments.push({ a: { x: 100, y: height }, b: { x: 0, y: height } });
    segments.push({ a: { x: 0, y: height }, b: { x: 0, y: 0 } });

    // 2. Cave Walls
    const processPath = (vertices) => {
      for (let i = 0; i < vertices.length - 1; i++) {
          segments.push({
              a: { x: vertices[i].x, y: vertices[i].y * screens },
              b: { x: vertices[i+1].x, y: vertices[i+1].y * screens }
          });
      }
    };

    if (CAVE_WALL_VERTICES.leftWall) processPath(CAVE_WALL_VERTICES.leftWall);
    if (CAVE_WALL_VERTICES.rightWall) processPath(CAVE_WALL_VERTICES.rightWall);
    if (CAVE_WALL_VERTICES.centralPillar) {
        processPath(CAVE_WALL_VERTICES.centralPillar);
        const p = CAVE_WALL_VERTICES.centralPillar;
        segments.push({
            a: { x: p[p.length-1].x, y: p[p.length-1].y * screens },
            b: { x: p[0].x, y: p[0].y * screens }
        });
    }

    // 3. Dynamic Rocks (Synchronized 100% to wall corridor bounds)
    if (puzzleEntities) {
      puzzleEntities.forEach(node => {
        if (node.isGatekeeper && !defeated.includes(node.id)) {
            const isRightChannel = node.x >= 50;
            const bounds = getCorridorBounds(node.y, CAVE_WALL_VERTICES, isRightChannel);
            const minX = bounds.xLeft;
            const maxX = bounds.xRight;
            const y = node.y * screens;
            
            segments.push({ a: { x: minX, y: y - 1.5 }, b: { x: maxX, y: y - 1.5 } });
            segments.push({ a: { x: maxX, y: y - 1.5 }, b: { x: maxX, y: y + 1.5 } });
            segments.push({ a: { x: maxX, y: y + 1.5 }, b: { x: minX, y: y + 1.5 } });
            segments.push({ a: { x: minX, y: y + 1.5 }, b: { x: minX, y: y - 1.5 } });
        } else if (node.isExtraRock && !defeated.includes(node.id)) {
            const sizeX = 2.5;
            const sizeY = 1.5;
            const x = node.x;
            const y = node.y * screens;
            segments.push({ a: { x: x - sizeX, y: y - sizeY }, b: { x: x + sizeX, y: y - sizeY } });
            segments.push({ a: { x: x + sizeX, y: y - sizeY }, b: { x: x + sizeX, y: y + sizeY } });
            segments.push({ a: { x: x + sizeX, y: y + sizeY }, b: { x: x - sizeX, y: y + sizeY } });
            segments.push({ a: { x: x - sizeX, y: y + sizeY }, b: { x: x - sizeX, y: y - sizeY } });
        }
      });
    }

    return segments;
  }
};

export default underground;
