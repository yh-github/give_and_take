import { describe, it, expect } from 'vitest';
import { findGlobalPath } from './src/logic/pathfinding.js';
import { computeWaypoints } from './src/logic/navigation.js';
import { generateLevelPuzzle } from './src/logic/generator.js';
import { isPointInVisibilityPolygon } from './src/logic/visibility.js';

describe('Pathfinding', () => {
    it('does not early return when there are only polygons but no segments', () => {
        const start = { x: 0, y: 0 };
        const end = { x: 30, y: 30 };
        const polygons = [[
            {x: 10, y: -10}, {x: 15, y: -10}, {x: 15, y: 25}, {x: 10, y: 25}
        ]];
        const path = findGlobalPath(start, end, [], {width: 100, height: 100}, polygons, 3);
        expect(path.length).toBeGreaterThan(1);
    });

    it('returns empty array when target is unreachable or path is too complex', () => {
        const start = { x: 0, y: 0 };
        const end = { x: 50, y: 50 };
        // Create an enclosing box around start
        const segments = [
            { a: { x: -5, y: -5 }, b: { x: 10, y: -5 } },
            { a: { x: 10, y: -5 }, b: { x: 10, y: 10 } },
            { a: { x: 10, y: 10 }, b: { x: -5, y: 10 } },
            { a: { x: -5, y: 10 }, b: { x: -5, y: -5 } }
        ];
        const path = findGlobalPath(start, end, segments, {width: 100, height: 100}, [], 3);
        expect(path).toEqual([]); // Should fail and return empty array
    });
});

describe('Visibility', () => {
    it('correctly identifies if a point is within a visibility polygon', () => {
        const poly = [
            {x: 0, y: 0},
            {x: 10, y: 0},
            {x: 10, y: 10},
            {x: 0, y: 10}
        ];
        expect(isPointInVisibilityPolygon({x: 5, y: 5}, poly)).toBe(true);
        expect(isPointInVisibilityPolygon({x: 15, y: 5}, poly)).toBe(false);
        expect(isPointInVisibilityPolygon({x: -1, y: 5}, poly)).toBe(false);
    });
});

describe('Navigation', () => {
    it('orders waypoints correctly when exiting a branch', () => {
        const waypoints = computeWaypoints(2, 6);
        expect(waypoints.length).toBe(2);
        expect(waypoints[0].x).toBe(33);
        expect(waypoints[1].x).toBe(50);
    });

    it('orders waypoints correctly when entering a branch', () => {
        const waypoints = computeWaypoints(6, 2);
        expect(waypoints.length).toBe(2);
        expect(waypoints[0].x).toBe(50);
        expect(waypoints[1].x).toBe(33);
    });
});

describe('Generator', () => {
    it('preserves red-herring entities on available map nodes', () => {
        const level = {
            id: 'test',
            mechanics: { hasPickaxe: false },
            mapNodes: [
                { id: 'goal', x: 0, y: 0, zone: 1, isGoal: true },
                { id: 'random_node', x: 10, y: 0, zone: 1 } // Not a gatekeeper, becomes a merchant
            ],
            entities: [
                { id: 'goal', allowedReqs: ['a'] },
                { id: 'merchant', allowedReqs: ['b'] }
            ],
            items: [{id: 'a'}, {id: 'b'}],
            specialEntityTemplate: 'merchant'
        };

        const puzzle = generateLevelPuzzle(level, 0, 1);
        
        // Ensure the merchant (even if not strictly needed by shortest path) is preserved as a red herring / trade option
        const unused = puzzle.puzzleEntities.find(e => e.id.startsWith('merchant_'));
        expect(unused).toBeDefined();
    });
});

describe('Underground Level', () => {
    it('dynamically generates obstacle segments based on node coordinates and corridor bounds', async () => {
        const underground = (await import('./src/levels/underground/index.js')).default;
        
        const puzzleEntities = [
            { id: 'test_rock', isGatekeeper: true, x: 36, y: 22 }
        ];
        
        const segments = underground.getObstacleSegments(puzzleEntities, [], [], 2.5);
        
        // At y=22 left channel: xLeft=20, xRight=48
        const rockSegs = segments.filter(s => 
            (s.a.x === 20 || s.a.x === 48 || s.b.x === 20 || s.b.x === 48)
        );
        
        expect(rockSegs.length).toBeGreaterThanOrEqual(4);
    });
});

describe('Procedural Geometry & Lighting', () => {
    it('calculates accurate corridor bounds from cave walls', async () => {
        const { getCorridorBounds } = await import('./src/logic/geometry.js');
        const { CAVE_WALL_VERTICES } = await import('./src/levels/underground/components.jsx');

        const leftBounds = getCorridorBounds(22, CAVE_WALL_VERTICES, false);
        expect(leftBounds.xLeft).toBeCloseTo(20, 0);
        expect(leftBounds.xRight).toBeCloseTo(48, 0);

        const rightBounds = getCorridorBounds(23, CAVE_WALL_VERTICES, true);
        expect(rightBounds.xLeft).toBeCloseTo(52, 0);
        expect(rightBounds.xRight).toBeCloseTo(82, 0);
    });

    it('generates 3D organic boulder facets and evaluates dynamic normal lighting based on hero position', async () => {
        const { generateProceduralOrganicRock, calculateFacetLighting } = await import('./src/logic/geometry.js');

        const mesh = generateProceduralOrganicRock(20, 48, 30, 4, 'test_seed');
        expect(mesh.boulders.length).toBeGreaterThan(4);

        let allFacets = [];
        mesh.boulders.forEach(b => { allFacets = allFacets.concat(b.facets); });

        const topFacet = allFacets.find(f => f.normal.y < -0.2);
        const bottomFacet = allFacets.find(f => f.normal.y > 0.2);

        expect(topFacet).toBeDefined();
        expect(bottomFacet).toBeDefined();

        // When hero is ABOVE the rock (y=10): top facet should be brighter than bottom facet
        const heroAbove = { x: 34, y: 10 };
        const lightTopHeroAbove = calculateFacetLighting(topFacet, heroAbove, 2.5);
        const lightBotHeroAbove = calculateFacetLighting(bottomFacet, heroAbove, 2.5);
        expect(lightTopHeroAbove.intensity).toBeGreaterThan(lightBotHeroAbove.intensity);

        // When hero is BELOW the rock (y=50): bottom facet should be brighter than top facet
        const heroBelow = { x: 34, y: 50 };
        const lightTopHeroBelow = calculateFacetLighting(topFacet, heroBelow, 2.5);
        const lightBotHeroBelow = calculateFacetLighting(bottomFacet, heroBelow, 2.5);
        expect(lightBotHeroBelow.intensity).toBeGreaterThan(lightTopHeroBelow.intensity);
    });

    it('proves zero wall overlap: all generated boulder vertices stay strictly inside corridor bounds', async () => {
        const { getCorridorBounds, generateProceduralOrganicRock } = await import('./src/logic/geometry.js');
        const { CAVE_WALL_VERTICES } = await import('./src/levels/underground/components.jsx');
        const mapNodes = (await import('./src/levels/underground/mapNodes.json')).default;

        const rockNodes = mapNodes.filter(n => n.isGatekeeper || n.isExtraRock);
        expect(rockNodes.length).toBeGreaterThan(0);

        rockNodes.forEach(node => {
            const isRightChannel = node.x >= 50;
            const bounds = getCorridorBounds(node.y, CAVE_WALL_VERTICES, isRightChannel);
            const mesh = generateProceduralOrganicRock(bounds.xLeft, bounds.xRight, node.y, 4.0, node.id || 'rock');

            mesh.boulders.forEach(boulder => {
                boulder.vertices.forEach(v => {
                    // SVG local coordinates 0..150 correspond to bounds.xLeft .. bounds.xRight
                    expect(v.x).toBeGreaterThanOrEqual(0);
                    expect(v.x).toBeLessThanOrEqual(150);
                });
            });
        });
    });
});
