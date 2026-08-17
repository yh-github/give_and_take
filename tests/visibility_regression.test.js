import { describe, it, expect } from 'vitest';
import { 
  getVisibilityPolygon, 
  getObstacleSegments, 
  isPointInVisibilityPolygon, 
  checkCollision 
} from '../src/logic/visibility.js';
import { CAVE_WALL_VERTICES } from '../src/levels/underground/components.jsx';

describe('Visibility & Raycasting Regression Suite', () => {
  it('generates a visibility polygon using boundary obstacle segments', () => {
    const origin = { x: 50, y: 10 };
    const radius = 30;
    const segments = getObstacleSegments([], CAVE_WALL_VERTICES, [1], [], 2.5);
    const polygon = getVisibilityPolygon(origin, segments, radius, 2.5);

    expect(polygon.length).toBeGreaterThan(10);
    // Origin is illuminated
    expect(isPointInVisibilityPolygon(origin, polygon)).toBe(true);
  });

  it('casts shadow behind linear obstacle segment', () => {
    const origin = { x: 50, y: 10 };
    const radius = 40;
    // Bounding segments + a horizontal wall at y=25
    const segments = [
      { a: { x: 0, y: 0 }, b: { x: 100, y: 0 } },
      { a: { x: 100, y: 0 }, b: { x: 100, y: 100 } },
      { a: { x: 100, y: 100 }, b: { x: 0, y: 100 } },
      { a: { x: 0, y: 100 }, b: { x: 0, y: 0 } },
      { a: { x: 20, y: 25 }, b: { x: 80, y: 25 } }
    ];
    const polygon = getVisibilityPolygon(origin, segments, radius, 1);

    expect(polygon.length).toBeGreaterThan(6);
    // Point directly behind wall (e.g. x=50, y=35) should NOT be inside polygon
    const behindWall = { x: 50, y: 35 };
    expect(isPointInVisibilityPolygon(behindWall, polygon)).toBe(false);

    // Point in front of wall (e.g. x=50, y=18) should BE inside polygon
    const inFrontOfWall = { x: 50, y: 18 };
    expect(isPointInVisibilityPolygon(inFrontOfWall, polygon)).toBe(true);
  });

  it('detects line segment collisions accurately', () => {
    const segments = [
      { a: { x: 0, y: 50 }, b: { x: 100, y: 50 } }
    ];

    // Segment intersecting the horizontal wall (y=20 to y=80)
    expect(checkCollision({ x: 50, y: 20 }, { x: 50, y: 80 }, segments)).toBe(true);

    // Segment not intersecting (both above y=50)
    expect(checkCollision({ x: 10, y: 20 }, { x: 90, y: 20 }, segments)).toBe(false);
  });
});
