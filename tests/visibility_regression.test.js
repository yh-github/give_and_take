import { describe, it, expect } from 'vitest';
import { 
  castRays,
  getVisibilityPolygon, 
  getObstacleSegments, 
  isPointInVisibilityPolygon, 
  checkCollision,
  computeVisibleEntitiesSet
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

  it('reveals distant entities illuminated by extra static light sources (lit braziers)', () => {
    const distantEnt = { id: 'far_trader', x: 80, y: 220, zone: 2, requires: ['crystal'], reqType: 'AND', reward: 'relic' };
    const baseVisible = computeVisibleEntitiesSet({
      puzzleEntities: [distantEnt],
      playerPos: { x: 20, y: 20 },
      obstacleSegments: [],
      torchRadius: 48,
      yScale: 1,
      levelId: 'deep_cave',
      hasPickaxe: true
    });
    expect(baseVisible.has('far_trader')).toBe(false);

    const brazierLitVisible = computeVisibleEntitiesSet({
      puzzleEntities: [distantEnt],
      playerPos: { x: 20, y: 20 },
      obstacleSegments: [],
      torchRadius: 48,
      yScale: 1,
      levelId: 'deep_cave',
      hasPickaxe: true,
      extraLightSources: [{ x: 75, y: 215, radius: 42 }]
    });
    expect(brazierLitVisible.has('far_trader')).toBe(true);
  });

  it('does not leak rays through shared corner vertices or +/- PI wraparound boundaries', () => {
    const cornerSegs = [
      { a: { x: 0, y: 0 }, b: { x: 140, y: 0 } },
      { a: { x: 140, y: 0 }, b: { x: 140, y: 140 } },
      { a: { x: 140, y: 140 }, b: { x: 0, y: 140 } },
      { a: { x: 0, y: 140 }, b: { x: 0, y: 0 } },
      { a: { x: 94.0667, y: 16.1493 }, b: { x: 93.333333, y: 21.333333 } },
      { a: { x: 93.333333, y: 21.333333 }, b: { x: 106.666667, y: 21.333333 } }
    ];
    const origin = { x: 123, y: 51 };
    const poly = getVisibilityPolygon(origin, cornerSegs, 48, 1);

    expect(isPointInVisibilityPolygon({ x: 91, y: 19 }, poly)).toBe(false);
    expect(poly.every(v => v.angle >= -Math.PI && v.angle < Math.PI)).toBe(true);

    // Vertex directly left of origin (angle = +/- PI) must keep wrapped rays in [-PI, PI)
    const leftWallSegs = [
      { a: { x: 0, y: 0 }, b: { x: 100, y: 0 } },
      { a: { x: 100, y: 0 }, b: { x: 100, y: 100 } },
      { a: { x: 100, y: 100 }, b: { x: 0, y: 100 } },
      { a: { x: 0, y: 100 }, b: { x: 0, y: 0 } },
      { a: { x: 40, y: 30 }, b: { x: 40, y: 50 } },
      { a: { x: 40, y: 50 }, b: { x: 40, y: 100 } }
    ];
    const polyLeft = castRays({ x: 60, y: 50 }, leftWallSegs, 50);
    expect(polyLeft.every(v => v.angle >= -Math.PI && v.angle < Math.PI)).toBe(true);
    expect(isPointInVisibilityPolygon({ x: 30, y: 50 }, polyLeft)).toBe(false);
  });

  it('detects collisions even when origin is right next to a wall segment', () => {
    const wall = [{ a: { x: 50, y: 0 }, b: { x: 50, y: 100 } }];
    expect(checkCollision({ x: 49.98, y: 50 }, { x: 80, y: 50 }, wall)).toBe(true);
  });
});
