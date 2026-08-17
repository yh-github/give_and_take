import { describe, it, expect } from 'vitest';
import LEVEL_REGISTRY from '../src/levels/index.js';
import riverCrossing from '../src/levels/river_crossing/index.js';
import underground from '../src/levels/underground/index.js';
import underwater from '../src/levels/underwater/index.js';

describe('Levels Registry & Schema Regression Suite', () => {
  const registeredLevels = [riverCrossing, underground, underwater];

  it('contains exactly the 3 core levels in LEVEL_REGISTRY', () => {
    expect(Object.keys(LEVEL_REGISTRY)).toEqual(['river_crossing', 'underground', 'underwater']);
  });

  registeredLevels.forEach(level => {
    describe(`Level: ${level.id} (${level.name})`, () => {
      it('has valid top-level metadata and campPos', () => {
        expect(level.id).toBeTypeOf('string');
        expect(level.name).toBeTypeOf('string');
        expect(level.campPos).toBeDefined();
        expect(level.campPos.x).toBeGreaterThanOrEqual(0);
        expect(level.campPos.x).toBeLessThanOrEqual(100);
        expect(level.campPos.y).toBeGreaterThanOrEqual(0);
        expect(level.campPos.y).toBeLessThanOrEqual(100);
      });

      it('has valid mapNodes with coordinates and zones', () => {
        expect(Array.isArray(level.mapNodes)).toBe(true);
        expect(level.mapNodes.length).toBeGreaterThan(0);

        level.mapNodes.forEach(node => {
          expect(node.x).toBeGreaterThanOrEqual(0);
          expect(node.x).toBeLessThanOrEqual(100);
          expect(node.y).toBeGreaterThanOrEqual(0);
          expect(node.y).toBeLessThanOrEqual(100);
          expect(node.zone).toBeTypeOf('number');
          expect(node.zone).toBeGreaterThanOrEqual(1);
        });
      });

      it('has valid items with unique IDs, names, and emojis', () => {
        expect(Array.isArray(level.items)).toBe(true);
        expect(level.items.length).toBeGreaterThan(0);

        const itemIds = new Set();
        level.items.forEach(item => {
          expect(item.id).toBeTypeOf('string');
          expect(item.name).toBeTypeOf('string');
          expect(item.emoji).toBeTypeOf('string');
          expect(itemIds.has(item.id)).toBe(false);
          itemIds.add(item.id);
        });
      });

      it('has valid entities definitions', () => {
        expect(Array.isArray(level.entities)).toBe(true);
        expect(level.entities.length).toBeGreaterThan(0);

        level.entities.forEach(ent => {
          expect(ent.id).toBeTypeOf('string');
          expect(ent.name).toBeTypeOf('string');
          expect(ent.emoji).toBeTypeOf('string');
        });
      });

      it('has valid mechanics flags', () => {
        expect(level.mechanics).toBeDefined();
        const screens = level.mechanics.screens || 1;
        expect(screens).toBeGreaterThanOrEqual(1);
      });
    });
  });

  describe('Underground specific geometry integrity', () => {
    it('has valid CAVE_WALL_VERTICES with left, right, and central pillar walls', async () => {
      const { CAVE_WALL_VERTICES } = await import('../src/levels/underground/components.jsx');
      expect(CAVE_WALL_VERTICES.leftWall.length).toBeGreaterThan(10);
      expect(CAVE_WALL_VERTICES.rightWall.length).toBeGreaterThan(10);
      expect(CAVE_WALL_VERTICES.centralPillar.length).toBeGreaterThan(10);
    });

    it('has gatekeeper nodes in both left and right corridor channels', () => {
      const gatekeepers = underground.mapNodes.filter(n => n.isGatekeeper);
      expect(gatekeepers.length).toBeGreaterThanOrEqual(2);
      expect(gatekeepers.some(g => g.x < 50)).toBe(true);
      expect(gatekeepers.some(g => g.x >= 50)).toBe(true);
    });
  });

  describe('Underwater specific mechanics integrity', () => {
    it('has air mechanic enabled and vertical screens configured', () => {
      expect(underwater.mechanics.hasAir).toBe(true);
      expect(underwater.mechanics.isVertical).toBe(true);
      expect(underwater.mechanics.hasTransformation).toBe(true);
    });
  });
});
