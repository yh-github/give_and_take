import { describe, it, expect } from 'vitest';
import { 
  getCorridorBounds, 
  generateProceduralOrganicRock, 
  calculateFacetLighting 
} from '../src/logic/geometry.js';
import { CAVE_WALL_VERTICES } from '../src/levels/underground/components.jsx';

describe('Geometry & 3D Procedural Mesh Regression Suite', () => {
  it('deterministically generates identical boulders for identical seeds', () => {
    const seed = 'boulder_gate_y22';
    const mesh1 = generateProceduralOrganicRock(20, 48, 22, 4.0, seed);
    const mesh2 = generateProceduralOrganicRock(20, 48, 22, 4.0, seed);

    expect(mesh1.boulders.length).toBe(mesh2.boulders.length);
    for (let i = 0; i < mesh1.boulders.length; i++) {
      expect(mesh1.boulders[i].vertices).toEqual(mesh2.boulders[i].vertices);
      expect(mesh1.boulders[i].facets.length).toEqual(mesh2.boulders[i].facets.length);
    }
  });

  it('generates different boulder variations for different seeds', () => {
    const meshA = generateProceduralOrganicRock(20, 48, 22, 4.0, 'seed_A');
    const meshB = generateProceduralOrganicRock(20, 48, 22, 4.0, 'seed_B');

    const verticesA = meshA.boulders[0].vertices;
    const verticesB = meshB.boulders[0].vertices;
    expect(verticesA).not.toEqual(verticesB);
  });

  it('correctly bounds corridor channels from cave walls at various y heights', () => {
    // Top cavern (y=10)
    const topBounds = getCorridorBounds(10, CAVE_WALL_VERTICES, false);
    expect(topBounds.xLeft).toBeLessThan(30);
    expect(topBounds.xRight).toBeGreaterThan(70);

    // Mid-left channel (y=30)
    const midLeft = getCorridorBounds(30, CAVE_WALL_VERTICES, false);
    expect(midLeft.xLeft).toBeLessThan(30);
    expect(midLeft.xRight).toBeLessThan(55);

    // Mid-right channel (y=30)
    const midRight = getCorridorBounds(30, CAVE_WALL_VERTICES, true);
    expect(midRight.xLeft).toBeGreaterThan(45);
    expect(midRight.xRight).toBeGreaterThan(70);
  });

  it('computes realistic normal lighting with inverse-square falloff and torch flickering', () => {
    const facet = {
      mapCentroid: { x: 30, y: 30 },
      normal: { x: 0, y: -1, z: 0.5 }
    };

    // Hero directly facing the facet from above (y=10)
    const heroAbove = { x: 30, y: 10 };
    const lightingAbove = calculateFacetLighting(facet, heroAbove, 2.5);
    expect(lightingAbove.intensity).toBeGreaterThan(0.3);

    // Hero far below facet (y=80)
    const heroFar = { x: 30, y: 80 };
    const lightingFar = calculateFacetLighting(facet, heroFar, 2.5);
    expect(lightingFar.intensity).toBeLessThan(lightingAbove.intensity);
  });
});
